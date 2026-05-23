"""
Evaluate ResNet50 and EfficientNetB3, compute ROC/AUC, thresholds, calibration,
TTA and soft-voting ensemble. Exports models to ai-service/models for inference.
"""
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import numpy as np
import pandas as pd
from pathlib import Path
from train_resnet50 import DRDataset as ResNetDataset, get_transforms as get_resnet_transforms, DRClassifier as ResNetModel, CONFIG as RESNET_CONFIG
from train_efficientnet import DRDataset as EffDataset, get_transforms as get_eff_transforms, EfficientNetB3Classifier as EffModel, CONFIG as EFF_CONFIG
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve, f1_score
import json
import warnings
warnings.filterwarnings('ignore')

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Paths
ROOT = Path(__file__).resolve().parents[1]
RESNET_CHECKPOINT = ROOT / 'training' / 'checkpoints' / 'best_model.pth'
# find last efficientnet output folder under training/
eff_ck_dir = None
training_dir = ROOT / 'training'
if training_dir.exists():
    for d in sorted(training_dir.iterdir(), reverse=True):
        if d.is_dir() and 'efficientnet_b3_' in d.name:
            eff_ck_dir = d
            break
if eff_ck_dir is None:
    eff_ck_dir = training_dir  # fallback
EFF_CHECKPOINT = eff_ck_dir / 'best_model_finetuned.pth'
# fallback: pre-exported inference checkpoint in ai-service/models
alt_eff = ROOT / 'ai-service' / 'models' / 'dr_efficientnet_b3.pth'
if not EFF_CHECKPOINT.exists() and alt_eff.exists():
    EFF_CHECKPOINT = alt_eff

# CSVs
TRAIN_CSV = ROOT / 'APTOS' / 'cleaned' / 'train_clean.csv'
VAL_CSV = ROOT / 'APTOS' / 'cleaned' / 'val_clean.csv'

# Utils
def load_model_resnet(path, device):
    model = ResNetModel(num_classes=RESNET_CONFIG['num_classes'], pretrained=False)
    try:
        ck = torch.load(path, map_location=device, weights_only=False)
    except TypeError:
        ck = torch.load(path, map_location=device)
    except Exception:
        # fallback: allowlist pathlib.WindowsPath if necessary
        import pathlib
        try:
            torch.serialization.add_safe_globals([pathlib.WindowsPath])
        except Exception:
            pass
        ck = torch.load(path, map_location=device)
    model.load_state_dict(ck['model_state_dict'])
    model.to(device).eval()
    return model

def load_model_eff(path, device):
    model = EffModel(num_classes=EFF_CONFIG['num_classes'], pretrained=False)
    try:
        ck = torch.load(path, map_location=device, weights_only=False)
    except TypeError:
        ck = torch.load(path, map_location=device)
    model.load_state_dict(ck['model_state_dict'])
    model.to(device).eval()
    return model

# Dataset loaders
val_resnet_transform = get_resnet_transforms(is_training=False, image_size=RESNET_CONFIG['image_size'])
val_eff_transform = get_eff_transforms(is_training=False, image_size=EFF_CONFIG['image_size'])
val_dataset_res = ResNetDataset(VAL_CSV, transform=val_resnet_transform)
val_dataset_eff = EffDataset(VAL_CSV, transform=val_eff_transform)
val_loader_res = DataLoader(val_dataset_res, batch_size=RESNET_CONFIG['batch_size'], shuffle=False, num_workers=0)
val_loader_eff = DataLoader(val_dataset_eff, batch_size=EFF_CONFIG['batch_size'], shuffle=False, num_workers=0)

# Predict function
def predict_logits(model, loader, device):
    logits_list = []
    labels = []
    with torch.no_grad():
        for imgs, labs in loader:
            imgs = imgs.to(device)
            out = model(imgs)
            logits_list.append(out.cpu())
            labels.extend(labs.numpy())
    logits = torch.cat(logits_list, dim=0).numpy()
    return logits, np.array(labels)

# Ensemble soft voting
def soft_vote(probs_list, weights=None):
    probs = np.sum([w * p for w, p in zip(weights, probs_list)], axis=0) / np.sum(weights)
    return probs

# Main
if __name__ == '__main__':
    print('Device:', DEVICE)
    print('Loading models...')
    res_model = load_model_resnet(RESNET_CHECKPOINT, DEVICE)
    try:
        eff_model = load_model_eff(EFF_CHECKPOINT, DEVICE)
    except Exception as e:
        print('Warning: could not load EfficientNet checkpoint:', e)
        eff_model = None

    print('Predicting validation logits...')
    res_logits, labels = predict_logits(res_model, val_loader_res, DEVICE)
    if eff_model is not None:
        eff_logits, _ = predict_logits(eff_model, val_loader_eff, DEVICE)

    # apply temperature-scaling if available for resnet
    temp_path = ROOT / 'ai-service' / 'models' / 'resnet_temperature.json'
    if temp_path.exists():
        try:
            with open(temp_path, 'r') as f:
                temp = float(json.load(f).get('temperature', 1.0))
        except Exception:
            temp = 1.0
    else:
        temp = 1.0

    res_probs = torch.softmax(torch.from_numpy(res_logits) / float(temp), dim=1).numpy()
    if eff_model is not None:
        eff_probs = torch.softmax(torch.from_numpy(eff_logits), dim=1).numpy()
    else:
        eff_probs = None

    # Metrics per model
    print('\nResNet metrics:')
    res_preds = res_probs.argmax(axis=1)
    print(classification_report(labels, res_preds, digits=3))

    if eff_probs is not None:
        print('\nEfficientNet metrics:')
        eff_preds = eff_probs.argmax(axis=1)
        print(classification_report(labels, eff_preds, digits=3))

    # Soft voting
    if eff_probs is not None:
        # weights: proportional to val accuracy
        res_acc = (res_preds == labels).mean()
        eff_acc = (eff_preds == labels).mean()
        w_res, w_eff = res_acc, eff_acc
        print(f'Using weights (resnet,eff): {w_res:.3f}, {w_eff:.3f}')
        ensemble_probs = soft_vote([res_probs, eff_probs], weights=[w_res, w_eff])
        ens_preds = ensemble_probs.argmax(axis=1)
        print('\nEnsemble (soft voting) metrics:')
        print(classification_report(labels, ens_preds, digits=3))

    # ROC / AUC (one-vs-rest)
    print('\nPer-class AUC:')
    n_classes = res_probs.shape[1]
    for c in range(n_classes):
        y_true = (labels == c).astype(int)
        auc = roc_auc_score(y_true, res_probs[:, c])
        print(f' Class {c} AUC (ResNet): {auc:.3f}')
        if eff_probs is not None:
            auc2 = roc_auc_score(y_true, eff_probs[:, c])
            auce = roc_auc_score(y_true, ensemble_probs[:, c])
            print(f'           AUC (Eff): {auc2:.3f}  AUC (Ens): {auce:.3f}')

    # Save predictions and probs
    out = {
        'labels': labels.tolist(),
        'resnet_probs': res_probs.tolist(),
    }
    if eff_probs is not None:
        out['eff_probs'] = eff_probs.tolist()
        out['ensemble_probs'] = ensemble_probs.tolist()
    with open(ROOT / 'training' / 'val_predictions.json', 'w') as f:
        json.dump(out, f)

    # Export models to ai-service/models
    ai_models_dir = ROOT / 'ai-service' / 'models'
    ai_models_dir.mkdir(parents=True, exist_ok=True)
    torch.save({'model_state_dict': res_model.state_dict()}, ai_models_dir / 'dr_resnet50_for_inference.pth')
    if eff_model is not None:
        torch.save({'model_state_dict': eff_model.state_dict()}, ai_models_dir / 'dr_efficientnet_b3_for_inference.pth')

    print('\nSaved validation predictions and exported models to ai-service/models')
