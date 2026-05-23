"""
Diabetic Retinopathy Classification - Transfer Learning with EfficientNetB3
Fine-tunes an EfficientNetB3 model pretrained on ImageNet for DR classification.

EfficientNetB3 vs ResNet50:
- Better accuracy with fewer parameters
- Compound scaling (depth, width, resolution)
- Input size: 300x300 (vs 224x224 for ResNet50)
- Parameters: 12M (vs 25.6M for ResNet50)
"""

import os
import sys
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from torchvision.models import efficientnet_b3, EfficientNet_B3_Weights
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
    "image_size": 300,  # EfficientNetB3 optimal size
    "batch_size": 8,    # Smaller batch due to larger model
    "num_epochs": 30,
    "learning_rate": 1e-4,
    "weight_decay": 1e-5,
    "num_classes": 5,
    "patience": 7,      # Early stopping patience
    "num_workers": 0,   # Set to 0 for Windows compatibility
    "device": "cuda" if torch.cuda.is_available() else "cpu",
    "model_name": "efficientnet_b3_dr_classifier",
    "fine_tune_epochs": 10,  # Additional fine-tuning epochs
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


class EfficientNetB3Classifier(nn.Module):
    """
    EfficientNetB3-based classifier for Diabetic Retinopathy.
    Uses Transfer Learning from ImageNet pretrained weights.
    """
    def __init__(self, num_classes=5, pretrained=True, drop_rate=0.5):
        super(EfficientNetB3Classifier, self).__init__()
        
        # Load pretrained EfficientNetB3 from torchvision
        if pretrained:
            self.backbone = efficientnet_b3(weights=EfficientNet_B3_Weights.IMAGENET1K_V1)
        else:
            self.backbone = efficientnet_b3(weights=None)
        
        # Get the number of features from the classifier
        self.num_features = self.backbone.classifier[1].in_features  # 1536 for B3
        
        # Replace the classifier with custom head
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(drop_rate, inplace=True),
            nn.Linear(self.num_features, 512),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(512),
            nn.Dropout(drop_rate * 0.6),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(drop_rate * 0.4),
            nn.Linear(256, num_classes)
        )
        
        # Store the last conv layer for Grad-CAM
        self.gradients = None
        self.activations = None
        
    def forward(self, x):
        return self.backbone(x)
    
    def get_last_conv_layer(self):
        """Return the last convolutional layer for Grad-CAM"""
        return self.backbone.features[-1]
    
    def freeze_backbone(self):
        """Freeze all backbone layers for initial training"""
        for name, param in self.backbone.named_parameters():
            if 'classifier' not in name:
                param.requires_grad = False
        print("Backbone frozen - only classifier will be trained")
    
    def unfreeze_backbone(self, num_layers=50):
        """Unfreeze last N layers for fine-tuning"""
        # Unfreeze all first
        for param in self.backbone.parameters():
            param.requires_grad = True
        
        # Freeze early layers (features 0-4)
        layers_frozen = 0
        for name, param in self.backbone.named_parameters():
            if 'features.0.' in name or 'features.1.' in name or 'features.2.' in name:
                param.requires_grad = False
                layers_frozen += 1
        
        print(f"Backbone unfrozen - {layers_frozen} early layers still frozen")


def get_transforms(is_training=True, image_size=300):
    """
    Get data augmentation transforms.
    EfficientNetB3 uses 300x300 input by default.
    """
    # EfficientNet normalization (ImageNet stats)
    normalize = transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
    
    if is_training:
        return transforms.Compose([
            transforms.Resize((image_size + 20, image_size + 20)),
            transforms.RandomCrop(image_size),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomVerticalFlip(p=0.5),
            transforms.RandomRotation(20),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
            transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.9, 1.1)),
            transforms.ToTensor(),
            normalize,
        ])
    else:
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ToTensor(),
            normalize,
        ])


def compute_class_weights(df):
    """
    Compute class weights to handle imbalanced data.
    """
    class_counts = df['diagnosis'].value_counts().sort_index()
    total = len(df)
    weights = []
    
    print("\nClass Distribution:")
    for grade in range(5):
        count = class_counts.get(grade, 1)
        weight = total / (5 * count)
        weights.append(weight)
        print(f"  Grade {grade} ({GRADE_LABELS[grade]}): {count} images, weight: {weight:.3f}")
    
    return torch.FloatTensor(weights)


def train_epoch(model, train_loader, criterion, optimizer, device, scaler=None):
    """Train for one epoch."""
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
    """Validate the model."""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    all_probs = []
    
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Validating"):
            images, labels = images.to(device), labels.to(device)
            
            outputs = model(images)
            loss = criterion(outputs, labels)
            probs = torch.softmax(outputs, dim=1)
            
            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            all_probs.extend(probs.cpu().numpy())
    
    epoch_loss = running_loss / len(val_loader)
    epoch_acc = 100 * correct / total
    
    return epoch_loss, epoch_acc, np.array(all_preds), np.array(all_labels), np.array(all_probs)


def compute_metrics(preds, labels, probs=None):
    """Compute per-class metrics."""
    from sklearn.metrics import classification_report, confusion_matrix, cohen_kappa_score
    
    report = classification_report(
        labels, preds,
        target_names=[GRADE_LABELS[i] for i in range(5)],
        output_dict=True
    )
    
    cm = confusion_matrix(labels, preds)
    
    # Quadratic Weighted Kappa (important for DR grading)
    qwk = cohen_kappa_score(labels, preds, weights='quadratic')
    
    return report, cm, qwk


def plot_training_history(history, output_dir):
    """Plot training curves."""
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
    plt.savefig(output_dir / 'training_curves_efficientnet.png', dpi=150)
    plt.close()


def plot_confusion_matrix(cm, output_dir):
    """Plot confusion matrix."""
    fig, ax = plt.subplots(figsize=(10, 8))
    
    im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    
    classes = [GRADE_LABELS[i] for i in range(5)]
    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=classes,
        yticklabels=classes,
        ylabel='True label',
        xlabel='Predicted label'
    )
    
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
    
    # Add text annotations
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, format(cm[i, j], 'd'),
                   ha="center", va="center",
                   color="white" if cm[i, j] > thresh else "black")
    
    plt.title('Confusion Matrix - EfficientNetB3')
    plt.tight_layout()
    plt.savefig(output_dir / 'confusion_matrix_efficientnet.png', dpi=150)
    plt.close()


class EarlyStopping:
    """Early stopping to prevent overfitting."""
    def __init__(self, patience=7, min_delta=0.001, mode='min'):
        self.patience = patience
        self.min_delta = min_delta
        self.mode = mode
        self.counter = 0
        self.best_score = None
        self.early_stop = False
        
    def __call__(self, score):
        if self.mode == 'min':
            score = -score
            
        if self.best_score is None:
            self.best_score = score
            return True
        elif score < self.best_score + self.min_delta:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
            return False
        else:
            self.best_score = score
            self.counter = 0
            return True


def train():
    """Main training function."""
    print("=" * 60)
    print("EfficientNetB3 Transfer Learning for Diabetic Retinopathy")
    print("=" * 60)
    
    # Create output directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = CONFIG["output_dir"] / f"efficientnet_b3_{timestamp}"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Check for CSV files (clean_aptos.py creates train_clean.csv and val_clean.csv)
    train_csv = CONFIG["data_dir"] / "train_clean.csv"
    val_csv = CONFIG["data_dir"] / "val_clean.csv"
    
    if not train_csv.exists() or not val_csv.exists():
        print(f"\nError: CSV files not found in {CONFIG['data_dir']}")
        print("Expected: train_clean.csv and val_clean.csv")
        print("Please run clean_aptos.py first to prepare the data.")
        sys.exit(1)
    
    # Load data
    print("\nLoading datasets...")
    train_df = pd.read_csv(train_csv)
    val_df = pd.read_csv(val_csv)
    
    print(f"Training samples: {len(train_df)}")
    print(f"Validation samples: {len(val_df)}")
    
    # Transforms
    train_transform = get_transforms(is_training=True, image_size=CONFIG["image_size"])
    val_transform = get_transforms(is_training=False, image_size=CONFIG["image_size"])
    
    # Datasets
    train_dataset = DRDataset(train_csv, transform=train_transform)
    val_dataset = DRDataset(val_csv, transform=val_transform)
    
    # DataLoaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=CONFIG["batch_size"],
        shuffle=True,
        num_workers=CONFIG["num_workers"],
        pin_memory=True
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=CONFIG["batch_size"],
        shuffle=False,
        num_workers=CONFIG["num_workers"],
        pin_memory=True
    )
    
    # Device
    device = torch.device(CONFIG["device"])
    print(f"\nUsing device: {device}")
    
    # Class weights for imbalanced data
    class_weights = compute_class_weights(train_df)

    # Clip weights for stability
    min_w, max_w = CONFIG.get("class_weight_clip", [0.1, 10.0])
    class_weights = torch.clamp(class_weights, min=min_w, max=max_w).to(device)

    # Model
    print("\n" + "=" * 60)
    print("PHASE 1: Training classifier head (backbone frozen)")
    print("=" * 60)
    
    model = EfficientNetB3Classifier(
        num_classes=CONFIG["num_classes"],
        pretrained=True,
        drop_rate=0.5
    )
    model.freeze_backbone()  # Freeze backbone initially
    model = model.to(device)
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\nTotal parameters: {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,}")
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=CONFIG["learning_rate"] * 10,  # Higher LR for head training
        weight_decay=CONFIG["weight_decay"]
    )
    
    # Learning rate scheduler
    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=CONFIG["num_epochs"]
    )
    
    # Mixed precision scaler
    scaler = torch.amp.GradScaler('cuda') if device.type == 'cuda' else None
    
    # Training history
    history = {
        'train_loss': [], 'train_acc': [],
        'val_loss': [], 'val_acc': [],
        'lr': []
    }
    
    # Early stopping
    early_stopping = EarlyStopping(patience=CONFIG["patience"], mode='max')
    
    best_val_acc = 0
    best_qwk = 0
    
    # Phase 1: Train classifier head
    num_head_epochs = min(10, CONFIG["num_epochs"] // 2)
    
    for epoch in range(num_head_epochs):
        print(f"\nEpoch {epoch+1}/{num_head_epochs} (Head Training)")
        print("-" * 40)
        
        current_lr = optimizer.param_groups[0]['lr']
        print(f"Learning rate: {current_lr:.6f}")
        
        # Train
        train_loss, train_acc = train_epoch(
            model, train_loader, criterion, optimizer, device, scaler
        )
        
        # Validate
        val_loss, val_acc, preds, labels, probs = validate(
            model, val_loader, criterion, device
        )
        
        # Compute QWK
        _, _, qwk = compute_metrics(preds, labels, probs)
        
        scheduler.step()
        
        # Save history
        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)
        history['lr'].append(current_lr)
        
        print(f"\nTrain Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
        print(f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")
        print(f"Quadratic Weighted Kappa: {qwk:.4f}")
        
        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_qwk = qwk
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_acc,
                'qwk': qwk,
                'config': CONFIG,
            }, output_dir / 'best_model_head.pth')
            print("✓ Best model saved!")
    
    # Phase 2: Fine-tune entire model
    print("\n" + "=" * 60)
    print("PHASE 2: Fine-tuning entire model (backbone unfrozen)")
    print("=" * 60)
    
    model.unfreeze_backbone()
    
    # Update trainable params count
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Trainable parameters: {trainable_params:,}")
    
    # Lower learning rate for fine-tuning
    optimizer = optim.AdamW(
        model.parameters(),
        lr=CONFIG["learning_rate"] * 0.1,  # Lower LR for fine-tuning
        weight_decay=CONFIG["weight_decay"]
    )
    
    scheduler = optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=CONFIG["fine_tune_epochs"]
    )
    
    early_stopping = EarlyStopping(patience=CONFIG["patience"], mode='max')
    
    for epoch in range(CONFIG["fine_tune_epochs"]):
        print(f"\nEpoch {epoch+1}/{CONFIG['fine_tune_epochs']} (Fine-tuning)")
        print("-" * 40)
        
        current_lr = optimizer.param_groups[0]['lr']
        print(f"Learning rate: {current_lr:.6f}")
        
        # Train
        train_loss, train_acc = train_epoch(
            model, train_loader, criterion, optimizer, device, scaler
        )
        
        # Validate
        val_loss, val_acc, preds, labels, probs = validate(
            model, val_loader, criterion, device
        )
        
        # Compute metrics
        report, cm, qwk = compute_metrics(preds, labels, probs)
        
        scheduler.step()
        
        # Save history
        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)
        history['lr'].append(current_lr)
        
        print(f"\nTrain Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
        print(f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")
        print(f"Quadratic Weighted Kappa: {qwk:.4f}")
        
        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_qwk = qwk
            torch.save({
                'epoch': epoch + num_head_epochs,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_acc': val_acc,
                'qwk': qwk,
                'config': CONFIG,
            }, output_dir / 'best_model_finetuned.pth')
            print("✓ Best fine-tuned model saved!")
        
        # Early stopping check
        if not early_stopping(val_acc):
            print(f"No improvement for {early_stopping.counter} epochs")
        
        if early_stopping.early_stop:
            print(f"\n⚠ Early stopping triggered at epoch {epoch+1}")
            break
    
    # Final evaluation
    print("\n" + "=" * 60)
    print("FINAL EVALUATION")
    print("=" * 60)
    
    # Load best model (allow weights_only=False fallback to avoid torch 2.6 pickle issues)
    try:
        checkpoint = torch.load(output_dir / 'best_model_finetuned.pth', map_location=device, weights_only=False)
    except TypeError:
        checkpoint = torch.load(output_dir / 'best_model_finetuned.pth', map_location=device)
    model.load_state_dict(checkpoint['model_state_dict'])
    
    val_loss, val_acc, preds, labels, probs = validate(
        model, val_loader, criterion, device
    )
    
    report, cm, qwk = compute_metrics(preds, labels, probs)
    
    print(f"\nBest Validation Accuracy: {best_val_acc:.2f}%")
    print(f"Best Quadratic Weighted Kappa: {best_qwk:.4f}")
    
    print("\nPer-class Performance:")
    for grade in range(5):
        grade_name = GRADE_LABELS[grade]
        precision = report[grade_name]['precision']
        recall = report[grade_name]['recall']
        f1 = report[grade_name]['f1-score']
        print(f"  {grade_name}: Precision={precision:.3f}, Recall={recall:.3f}, F1={f1:.3f}")
    
    # Plot results
    plot_training_history(history, output_dir)
    plot_confusion_matrix(cm, output_dir)
    
    # Save final model for deployment
    final_model_path = output_dir / 'dr_efficientnet_b3.pth'
    torch.save({
        'model_state_dict': model.state_dict(),
        'config': {
            'model_name': 'efficientnet_b3',
            'num_classes': 5,
            'image_size': CONFIG["image_size"],
            'val_accuracy': best_val_acc,
            'qwk': best_qwk,
        }
    }, final_model_path)
    
    # Copy to ai-service models folder
    ai_models_dir = Path(r"C:\Users\DELL\diabetic-retinopathy\ai-service\models")
    ai_models_dir.mkdir(parents=True, exist_ok=True)
    
    import shutil
    shutil.copy(final_model_path, ai_models_dir / 'dr_efficientnet_b3.pth')
    
    # Save model info
    model_info = {
        'model_name': 'EfficientNetB3',
        'architecture': 'efficientnet_b3',
        'input_size': CONFIG["image_size"],
        'num_classes': 5,
        'pretrained': True,
        'val_accuracy': best_val_acc,
        'qwk': best_qwk,
        'training_date': timestamp,
        'grade_labels': GRADE_LABELS,
    }
    
    with open(ai_models_dir / 'model_info_efficientnet.json', 'w') as f:
        json.dump(model_info, f, indent=2)
    
    print(f"\n✓ Model saved to: {final_model_path}")
    print(f"✓ Model copied to: {ai_models_dir / 'dr_efficientnet_b3.pth'}")
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE!")
    print("=" * 60)


if __name__ == "__main__":
    train()
