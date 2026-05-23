"""
Diabetic Retinopathy Classification - Transfer Learning with ResNet50
Fine-tunes a ResNet50 model pretrained on ImageNet for DR classification.

Architecture:
- ResNet50 backbone (pretrained on ImageNet)
- Custom classification head for 5 DR grades
- Uses mixed precision training for efficiency
- Implements class weighting for imbalanced data
"""

import os
import sys
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torch.utils.data import WeightedRandomSampler
from torchvision import transforms, models
from torchvision.models import ResNet50_Weights
import pandas as pd
import numpy as np
from PIL import Image
from pathlib import Path
from tqdm import tqdm
import matplotlib.pyplot as plt
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Configuration
CONFIG = {
    "data_dir": Path(r"C:\Users\DELL\diabetic-retinopathy\APTOS\cleaned"),
    "output_dir": Path(r"C:\Users\DELL\diabetic-retinopathy\training\checkpoints"),
    "image_size": 224,
    "batch_size": 16,
    "num_epochs": 25,
    "num_epochs": 25,
    "learning_rate": 1e-4,
    "weight_decay": 1e-5,
    "num_classes": 5,
    "use_focal_loss": True,
    "focal_gamma": 2.0,
    "use_weighted_sampler": True,
    # clip class weights to avoid extreme scaling
    "class_weight_clip": [0.2, 5.0],
    "patience": 5,  # Early stopping patience
    "num_workers": 0,  # Set to 0 for Windows compatibility
    "device": "cuda" if torch.cuda.is_available() else "cpu",
    "model_name": "resnet50_dr_classifier",
}

# DR Grade labels
GRADE_LABELS = {
    0: "No DR",
    1: "Mild", 
    2: "Moderate",
    3: "Severe",
    4: "Proliferative DR"
}


class DRDataset(Dataset):
    """
    Dataset class for Diabetic Retinopathy images.
    """
    def __init__(self, csv_path, transform=None, use_processed=True):
        self.df = pd.read_csv(csv_path)
        self.transform = transform
        self.use_processed = use_processed
        
    def __len__(self):
        return len(self.df)
    
    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        
        # Use processed or original path
        if self.use_processed and 'processed_path' in row:
            img_path = row['processed_path']
        else:
            img_path = row['original_path']
        
        # Load image
        image = Image.open(img_path).convert('RGB')
        label = int(row['diagnosis'])
        
        if self.transform:
            image = self.transform(image)
        
        return image, label


class DRClassifier(nn.Module):
    """
    ResNet50-based classifier for Diabetic Retinopathy.
    """
    def __init__(self, num_classes=5, pretrained=True, freeze_backbone=False):
        super(DRClassifier, self).__init__()
        
        # Load pretrained ResNet50
        if pretrained:
            self.backbone = models.resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
        else:
            self.backbone = models.resnet50(weights=None)
        
        # Optionally freeze backbone layers
        if freeze_backbone:
            for param in self.backbone.parameters():
                param.requires_grad = False
        
        # Replace the final fully connected layer
        num_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes)
        )
        
    def forward(self, x):
        return self.backbone(x)
    
    def get_features(self, x):
        """Extract features before the final FC layer (for Grad-CAM)"""
        # Get features from layer4 (last conv block)
        x = self.backbone.conv1(x)
        x = self.backbone.bn1(x)
        x = self.backbone.relu(x)
        x = self.backbone.maxpool(x)
        x = self.backbone.layer1(x)
        x = self.backbone.layer2(x)
        x = self.backbone.layer3(x)
        x = self.backbone.layer4(x)
        return x


def get_transforms(is_training=True, image_size=224):
    """
    Get data augmentation transforms.
    """
    if is_training:
        return transforms.Compose([
            transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomVerticalFlip(p=0.5),
            transforms.RandomRotation(20),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.02),
            transforms.ToTensor(),
            # RandomErasing requires tensor input
            transforms.RandomErasing(p=0.2, scale=(0.02, 0.33), ratio=(0.3, 3.3)),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
    else:
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])


def compute_class_weights(df):
    """
    Compute class weights to handle imbalanced data.
    """
    class_counts = df['diagnosis'].value_counts().sort_index()
    total = len(df)
    weights = []
    
    for grade in range(CONFIG['num_classes']):
        count = class_counts.get(grade, 1)
        weight = total / (CONFIG['num_classes'] * count)
        weights.append(weight)
    # clip weights to stable range
    clip_min, clip_max = CONFIG.get('class_weight_clip', [0.1, 10.0])
    weights = np.clip(weights, clip_min, clip_max)
    
    return torch.FloatTensor(weights)


class FocalLoss(nn.Module):
    """Focal Loss for multi-class classification.
    Accepts optional `alpha` class-wise weights (Tensor of shape [C]).
    """
    def __init__(self, gamma=2.0, alpha=None, reduction='mean'):
        super(FocalLoss, self).__init__()
        self.gamma = gamma
        self.alpha = alpha
        self.reduction = reduction
        self.ce = nn.CrossEntropyLoss(weight=alpha, reduction='none') if alpha is not None else nn.CrossEntropyLoss(reduction='none')

    def forward(self, inputs, targets):
        # inputs: logits [B, C]
        logpt = -self.ce(inputs, targets)
        pt = torch.exp(logpt)
        loss = -((1 - pt) ** self.gamma) * logpt
        if self.reduction == 'mean':
            return loss.mean()
        elif self.reduction == 'sum':
            return loss.sum()
        return loss


def train_epoch(model, train_loader, criterion, optimizer, device, scaler=None):
    """
    Train for one epoch.
    """
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    pbar = tqdm(train_loader, desc="Training")
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)
        
        optimizer.zero_grad()
        
        # Mixed precision training
        if scaler is not None:
            with torch.amp.autocast('cuda'):
                outputs = model(images)
                loss = criterion(outputs, labels)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
        
        running_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
        
        pbar.set_postfix({
            'loss': f'{loss.item():.4f}',
            'acc': f'{100 * correct / total:.2f}%'
        })
    
    epoch_loss = running_loss / len(train_loader)
    epoch_acc = 100 * correct / total
    return epoch_loss, epoch_acc


def validate(model, val_loader, criterion, device):
    """
    Validate the model.
    """
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Validating"):
            images, labels = images.to(device), labels.to(device)
            
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    
    epoch_loss = running_loss / len(val_loader)
    epoch_acc = 100 * correct / total
    
    return epoch_loss, epoch_acc, np.array(all_preds), np.array(all_labels)


def compute_metrics(preds, labels):
    """
    Compute per-class metrics.
    """
    from sklearn.metrics import classification_report, confusion_matrix
    
    report = classification_report(
        labels, preds,
        target_names=[GRADE_LABELS[i] for i in range(5)],
        output_dict=True
    )
    
    cm = confusion_matrix(labels, preds)
    
    return report, cm


def plot_training_history(history, output_dir):
    """
    Plot training curves.
    """
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Loss
    axes[0].plot(history['train_loss'], label='Train Loss', color='blue')
    axes[0].plot(history['val_loss'], label='Val Loss', color='red')
    axes[0].set_xlabel('Epoch')
    axes[0].set_ylabel('Loss')
    axes[0].set_title('Training & Validation Loss')
    axes[0].legend()
    axes[0].grid(True)
    
    # Accuracy
    axes[1].plot(history['train_acc'], label='Train Acc', color='blue')
    axes[1].plot(history['val_acc'], label='Val Acc', color='red')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('Accuracy (%)')
    axes[1].set_title('Training & Validation Accuracy')
    axes[1].legend()
    axes[1].grid(True)
    
    plt.tight_layout()
    plt.savefig(output_dir / 'training_curves.png', dpi=150)
    plt.close()


def plot_confusion_matrix(cm, output_dir):
    """
    Plot confusion matrix.
    """
    fig, ax = plt.subplots(figsize=(10, 8))
    
    im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    
    labels = [GRADE_LABELS[i] for i in range(5)]
    ax.set(xticks=np.arange(5),
           yticks=np.arange(5),
           xticklabels=labels,
           yticklabels=labels,
           ylabel='True Label',
           xlabel='Predicted Label',
           title='Confusion Matrix')
    
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
    
    # Add text annotations
    thresh = cm.max() / 2.
    for i in range(5):
        for j in range(5):
            ax.text(j, i, format(cm[i, j], 'd'),
                   ha="center", va="center",
                   color="white" if cm[i, j] > thresh else "black")
    
    plt.tight_layout()
    plt.savefig(output_dir / 'confusion_matrix.png', dpi=150)
    plt.close()


def train():
    """
    Main training function.
    """
    print("\n" + "=" * 60)
    print("DIABETIC RETINOPATHY CLASSIFIER TRAINING")
    print("Transfer Learning with ResNet50 (ImageNet)")
    print("=" * 60)
    
    # Setup
    device = torch.device(CONFIG['device'])
    print(f"\n📱 Device: {device}")
    
    if device.type == 'cuda':
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
        print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    
    # Create output directory
    CONFIG['output_dir'].mkdir(parents=True, exist_ok=True)
    
    # Load data
    print(f"\n📂 Loading data from {CONFIG['data_dir']}...")
    train_csv = CONFIG['data_dir'] / 'train_clean.csv'
    val_csv = CONFIG['data_dir'] / 'val_clean.csv'
    
    if not train_csv.exists():
        print("❌ Train CSV not found! Run clean_aptos.py first.")
        return
    
    train_df = pd.read_csv(train_csv)
    val_df = pd.read_csv(val_csv)
    
    print(f"   Training samples: {len(train_df)}")
    print(f"   Validation samples: {len(val_df)}")
    
    # Create datasets
    train_transform = get_transforms(is_training=True, image_size=CONFIG['image_size'])
    val_transform = get_transforms(is_training=False, image_size=CONFIG['image_size'])
    
    train_dataset = DRDataset(train_csv, transform=train_transform)
    val_dataset = DRDataset(val_csv, transform=val_transform)
    
    # Optionally use a WeightedRandomSampler to oversample minority classes
    if CONFIG.get('use_weighted_sampler', False):
        print("\n🎯 Using WeightedRandomSampler to balance classes during training")
        counts = train_df['diagnosis'].value_counts().to_dict()
        sample_weights = [
            (len(train_df) / (CONFIG['num_classes'] * counts[int(row['diagnosis'])]))
            for _, row in train_df.iterrows()
        ]
        sample_weights = torch.DoubleTensor(sample_weights)
        sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)
        train_loader = DataLoader(
            train_dataset,
            batch_size=CONFIG['batch_size'],
            sampler=sampler,
            num_workers=CONFIG['num_workers'],
            pin_memory=True if device.type == 'cuda' else False
        )
    else:
        train_loader = DataLoader(
            train_dataset,
            batch_size=CONFIG['batch_size'],
            shuffle=True,
            num_workers=CONFIG['num_workers'],
            pin_memory=True if device.type == 'cuda' else False
        )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=CONFIG['batch_size'],
        shuffle=False,
        num_workers=CONFIG['num_workers'],
        pin_memory=True if device.type == 'cuda' else False
    )
    
    # Create model
    print("\n🧠 Creating model...")
    model = DRClassifier(
        num_classes=CONFIG['num_classes'],
        pretrained=True,
        freeze_backbone=False  # Fine-tune entire model
    )
    model = model.to(device)
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"   Total parameters: {total_params:,}")
    print(f"   Trainable parameters: {trainable_params:,}")
    
    # Compute class weights and create loss
    
    class_weights = compute_class_weights(train_df).to(device)
    print(f"\n⚖️  Class weights: {class_weights.cpu().numpy()}")

    if CONFIG.get('use_focal_loss', False):
        print(f"\n🔥 Using FocalLoss (gamma={CONFIG.get('focal_gamma', 2.0)}) with class weights as alpha")
        criterion = FocalLoss(gamma=CONFIG.get('focal_gamma', 2.0), alpha=class_weights)
    else:
        criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.AdamW(
        model.parameters(),
        lr=CONFIG['learning_rate'],
        weight_decay=CONFIG['weight_decay']
    )
    
    # Learning rate scheduler
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3
    )
    
    # Mixed precision scaler (for GPU only)
    scaler = torch.amp.GradScaler('cuda') if device.type == 'cuda' else None
    
    # Training history
    history = {
        'train_loss': [],
        'train_acc': [],
        'val_loss': [],
        'val_acc': []
    }
    
    best_val_acc = 0.0
    best_val_loss = float('inf')
    patience_counter = 0
    
    print(f"\n🚀 Starting training for {CONFIG['num_epochs']} epochs...")
    print("-" * 60)
    
    for epoch in range(CONFIG['num_epochs']):
        print(f"\nEpoch {epoch + 1}/{CONFIG['num_epochs']}")
        
        # Train
        train_loss, train_acc = train_epoch(
            model, train_loader, criterion, optimizer, device, scaler
        )
        
        # Validate
        val_loss, val_acc, preds, labels = validate(
            model, val_loader, criterion, device
        )
        
        # Update scheduler
        scheduler.step(val_loss)
        
        # Record history
        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)
        
        print(f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
        print(f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")
        
        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_val_loss = val_loss
            patience_counter = 0
            
            checkpoint = {
                'epoch': epoch + 1,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_acc,
                'val_loss': val_loss,
                'config': CONFIG,
            }
            
            torch.save(checkpoint, CONFIG['output_dir'] / 'best_model.pth')
            print(f"✅ New best model saved! Val Acc: {val_acc:.2f}%")
        else:
            patience_counter += 1
            if patience_counter >= CONFIG['patience']:
                print(f"\n⏹️  Early stopping after {epoch + 1} epochs")
                break
    
    # Final evaluation
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    
    # Load best model (ensure weights_only=False to allow full checkpoint loading)
    try:
        checkpoint = torch.load(CONFIG['output_dir'] / 'best_model.pth', map_location=device, weights_only=False)
    except TypeError:
        # Older torch versions may not support weights_only kwarg
        checkpoint = torch.load(CONFIG['output_dir'] / 'best_model.pth', map_location=device)
    model.load_state_dict(checkpoint['model_state_dict'])
    
    # Final validation
    val_loss, val_acc, preds, labels = validate(model, val_loader, criterion, device)
    
    # Compute metrics
    report, cm = compute_metrics(preds, labels)
    
    print(f"\nBest Model Performance:")
    print(f"   Validation Accuracy: {val_acc:.2f}%")
    print(f"   Validation Loss: {val_loss:.4f}")
    
    print("\nPer-Class Metrics:")
    for grade in range(5):
        class_name = GRADE_LABELS[grade]
        precision = report[class_name]['precision']
        recall = report[class_name]['recall']
        f1 = report[class_name]['f1-score']
        print(f"   {class_name:20s}: P={precision:.3f} R={recall:.3f} F1={f1:.3f}")
    
    # Plot and save results
    plot_training_history(history, CONFIG['output_dir'])
    plot_confusion_matrix(cm, CONFIG['output_dir'])
    
    # Save training summary
    summary = {
        'model_name': CONFIG['model_name'],
        'num_epochs_trained': len(history['train_loss']),
        'best_epoch': checkpoint['epoch'],
        'best_val_acc': best_val_acc,
        'best_val_loss': best_val_loss,
        'final_metrics': report,
        'config': {k: str(v) if isinstance(v, Path) else v for k, v in CONFIG.items()},
        'trained_at': datetime.now().isoformat()
    }
    
    with open(CONFIG['output_dir'] / 'training_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n📁 Outputs saved to: {CONFIG['output_dir']}")
    print(f"   - best_model.pth")
    print(f"   - training_curves.png")
    print(f"   - confusion_matrix.png")
    print(f"   - training_summary.json")
    
    # Export model for inference
    export_for_inference(model, CONFIG['output_dir'])
    
    return model, history


def export_for_inference(model, output_dir):
    """
    Export the model in a format ready for the AI service.
    """
    print("\n📦 Exporting model for inference...")
    
    # Save the full model (easier to load)
    model.eval()
    
    # Save model architecture info
    model_info = {
        'architecture': 'ResNet50',
        'pretrained_on': 'ImageNet',
        'num_classes': 5,
        'input_size': 224,
        'mean': [0.485, 0.456, 0.406],
        'std': [0.229, 0.224, 0.225],
        'class_labels': GRADE_LABELS
    }
    
    with open(output_dir / 'model_info.json', 'w') as f:
        json.dump(model_info, f, indent=2)
    
    # Copy model to AI service
    ai_service_dir = Path(r"C:\Users\DELL\diabetic-retinopathy\ai-service\models")
    ai_service_dir.mkdir(parents=True, exist_ok=True)
    
    import shutil
    shutil.copy(output_dir / 'best_model.pth', ai_service_dir / 'dr_resnet50.pth')
    shutil.copy(output_dir / 'model_info.json', ai_service_dir / 'model_info.json')
    
    print(f"   Model exported to: {ai_service_dir}")


if __name__ == "__main__":
    # Install dependencies if needed
    try:
        from sklearn.metrics import classification_report
    except ImportError:
        print("Installing scikit-learn...")
        os.system(f"{sys.executable} -m pip install scikit-learn")
    
    try:
        import matplotlib
    except ImportError:
        print("Installing matplotlib...")
        os.system(f"{sys.executable} -m pip install matplotlib")
    
    # Train the model
    model, history = train()
