import json
from pathlib import Path
import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import confusion_matrix, roc_auc_score, roc_curve, classification_report, accuracy_score
import matplotlib.pyplot as plt
from PIL import Image, ImageStat
from train_resnet50 import DRDataset, get_transforms, DRClassifier, CONFIG as RESNET_CONFIG
from train_efficientnet import DRDataset as EffDataset, EfficientNetB3Classifier, get_transforms as get_eff_transforms, CONFIG as EFF_CONFIG

ROOT = Path(__file__).resolve().parents[1]
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
VAL_CSV = ROOT / 'APTOS' / 'cleaned' / 'val_clean.csv'
RES_CHECKPOINT = ROOT / 'training' / 'checkpoints' / 'best_model.pth'
EFF_CHECKPOINT = ROOT / 'ai-service' / 'models' / 'dr_efficientnet_b3.pth'
TEMP_PATH = ROOT / 'ai-service' / 'models' / 'resnet_temperature.json'
OUT_DIR = ROOT / 'training' / 'checkpoints'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Load models
def safe_load(path):
    try:
        ck = torch.load(path, map_location=DEVICE, weights_only=False)
    except TypeError:
        ck = torch.load(path, map_location=DEVICE)
    except Exception:
        import pathlib
        try:
            torch.serialization.add_safe_globals([pathlib.WindowsPath])
        except Exception:
            pass
        ck = torch.load(path, map_location=DEVICE)
    return ck

res_model = None
if RES_CHECKPOINT.exists():
    ck = safe_load(RES_CHECKPOINT)
    res_model = DRClassifier(num_classes=RESNET_CONFIG['num_classes'], pretrained=False)
    res_model.load_state_dict(ck['model_state_dict'])
    res_model.to(DEVICE).eval()

eff_model = None
if EFF_CHECKPOINT.exists():
    try:
        ck2 = safe_load(EFF_CHECKPOINT)
        eff_model = EfficientNetB3Classifier(num_classes=EFF_CONFIG['num_classes'], pretrained=False)
        eff_model.load_state_dict(ck2['model_state_dict'])
        eff_model.to(DEVICE).eval()
    except Exception:
        eff_model = None

# Load temperature
temp = 1.0
if TEMP_PATH.exists():
    try:
        temp = float(json.load(open(TEMP_PATH))['temperature'])
    except Exception:
        temp = 1.0

# Prepare dataset
val_dataset = DRDataset(VAL_CSV, transform=get_transforms(is_training=False, image_size=RESNET_CONFIG['image_size']))
from torch.utils.data import DataLoader
val_loader = DataLoader(val_dataset, batch_size=RESNET_CONFIG['batch_size'], shuffle=False, num_workers=0)

all_labels = []
res_probs = []
eff_probs = []

with torch.no_grad():
    for imgs, labs in val_loader:
        imgs = imgs.to(DEVICE)
        labs = labs.numpy()
        all_labels.extend(labs.tolist())
        if res_model is not None:
            logits = res_model(imgs)
            logits = logits / float(temp)
            p = F.softmax(logits, dim=1).cpu().numpy()
            res_probs.append(p)
        if eff_model is not None:
            logits2 = eff_model(imgs)
            p2 = F.softmax(logits2, dim=1).cpu().numpy()
            eff_probs.append(p2)

if res_probs:
    res_probs = np.vstack(res_probs)
else:
    res_probs = None
if eff_probs:
    eff_probs = np.vstack(eff_probs)
else:
    eff_probs = None
labels = np.array(all_labels)

# Ensemble weights
if res_probs is not None:
    res_preds = res_probs.argmax(axis=1)
    res_acc = (res_preds == labels).mean()
else:
    res_acc = 0.0
if eff_probs is not None:
    eff_preds = eff_probs.argmax(axis=1)
    eff_acc = (eff_preds == labels).mean()
else:
    eff_acc = 0.0

if eff_probs is not None and res_probs is not None:
    w_res, w_eff = res_acc, eff_acc
    ensemble_probs = (w_res * res_probs + w_eff * eff_probs) / (w_res + w_eff)
else:
    ensemble_probs = res_probs if res_probs is not None else eff_probs

ensemble_preds = ensemble_probs.argmax(axis=1)

# Confusion matrix
cm = confusion_matrix(labels, ensemble_preds)
plt.figure(figsize=(6,6))
plt.imshow(cm, cmap='Blues')
plt.title('Ensemble Confusion Matrix')
plt.xlabel('Predicted')
plt.ylabel('True')
for (i,j), val in np.ndenumerate(cm):
    plt.text(j, i, int(val), ha='center', va='center', color='black')
plt.savefig(OUT_DIR / 'confusion_matrix_ensemble.png', bbox_inches='tight')
plt.close()

# ROC / AUC per class
n_classes = ensemble_probs.shape[1]
auc_per_class = {}
plt.figure(figsize=(8,6))
for c in range(n_classes):
    y_true = (labels == c).astype(int)
    auc = roc_auc_score(y_true, ensemble_probs[:, c])
    auc_per_class[c] = float(auc)
    fpr, tpr, _ = roc_curve(y_true, ensemble_probs[:, c])
    plt.plot(fpr, tpr, label=f'Class {c} (AUC={auc:.3f})')
plt.plot([0,1],[0,1],'k--')
plt.xlabel('FPR')
plt.ylabel('TPR')
plt.title('Ensemble ROC curves')
plt.legend()
plt.savefig(OUT_DIR / 'roc_ensemble.png', bbox_inches='tight')
plt.close()

# Training curves: copy existing if present
train_curves = ROOT / 'training' / 'checkpoints' / 'training_curves.png'
if train_curves.exists():
    # leave as-is; path known
    pass

# Best validation accuracy and AUC
best_val_acc = None
best_val_auc = None
summary_path = ROOT / 'training' / 'checkpoints' / 'training_summary.json'
if summary_path.exists():
    summary = json.load(open(summary_path))
    best_val_acc = summary.get('best_val_acc')
# compute macro AUC
best_val_auc = float(np.mean(list(auc_per_class.values())))

# Brightness statistics: compute per-image mean brightness from PIL
import csv
brightness = []
with open(VAL_CSV, 'r', encoding='utf8') as f:
    import pandas as pd
    df = pd.read_csv(VAL_CSV)
    for p in df['processed_path'].fillna(df['original_path']).tolist():
        try:
            im = Image.open(p).convert('L')
            stat = ImageStat.Stat(im)
            brightness.append(stat.mean[0])
        except Exception:
            brightness.append(None)

brightness_vals = [b for b in brightness if b is not None]
brightness_stats = {
    'count': len(brightness_vals),
    'mean': float(np.mean(brightness_vals)) if brightness_vals else None,
    'std': float(np.std(brightness_vals)) if brightness_vals else None,
    'min': float(np.min(brightness_vals)) if brightness_vals else None,
    'max': float(np.max(brightness_vals)) if brightness_vals else None,
}

# Save report
report = {
    'best_val_acc': best_val_acc,
    'best_val_auc_macro': best_val_auc,
    'auc_per_class': auc_per_class,
    'res_acc': res_acc,
    'eff_acc': eff_acc,
    'ensemble_acc': float(accuracy_score(labels, ensemble_preds)),
    'brightness_stats': brightness_stats,
}
json.dump(report, open(OUT_DIR / 'detailed_report.json', 'w'), indent=2)
print('Report saved to', OUT_DIR / 'detailed_report.json')
print('Confusion matrix:', OUT_DIR / 'confusion_matrix_ensemble.png')
print('ROC:', OUT_DIR / 'roc_ensemble.png')
print('Training curves:', train_curves)
