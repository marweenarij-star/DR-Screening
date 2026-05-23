import torch
import torch.nn.functional as F
from pathlib import Path
import json
import numpy as np
from PIL import Image
from torchvision import transforms
import torchvision.transforms.functional as TF
from train_resnet50 import DRDataset as ResNetDataset, get_transforms as get_resnet_transforms, DRClassifier as ResNetModel, CONFIG as RESNET_CONFIG
from train_efficientnet import DRDataset as EffDataset, get_transforms as get_eff_transforms, EfficientNetB3Classifier as EffModel, CONFIG as EFF_CONFIG

ROOT = Path(__file__).resolve().parents[1]
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

VAL_CSV = ROOT / 'APTOS' / 'cleaned' / 'val_clean.csv'
RES_CHECKPOINT = ROOT / 'training' / 'checkpoints' / 'best_model.pth'
EFF_CHECKPOINT = ROOT / 'ai-service' / 'models' / 'dr_efficientnet_b3.pth'
TEMP_PATH = ROOT / 'ai-service' / 'models' / 'resnet_temperature.json'
EFF_TEMP_PATH = ROOT / 'ai-service' / 'models' / 'effnet_temperature.json'
OUT_JSON = ROOT / 'training' / 'val_predictions_tta.json'

# Simple safe loader
def load_state(path):
    try:
        # Try safe load first
        ck = torch.load(path, map_location=DEVICE, weights_only=False)
        return ck
    except TypeError:
        # older torch versions
        ck = torch.load(path, map_location=DEVICE)
        return ck
    except Exception as e:
        # Fallback: allowlist pathlib.WindowsPath if present in checkpoint
        import pathlib
        try:
            torch.serialization.add_safe_globals([pathlib.WindowsPath])
        except Exception:
            pass
        try:
            ck = torch.load(path, map_location=DEVICE)
            return ck
        except Exception as e2:
            print('Failed to load checkpoint', path, e2)
            raise


def load_model_resnet(path):
    model = ResNetModel(num_classes=RESNET_CONFIG['num_classes'], pretrained=False)
    ck = load_state(path)
    model.load_state_dict(ck['model_state_dict'])
    model.to(DEVICE).eval()
    return model


def load_model_eff(path):
    model = EffModel(num_classes=EFF_CONFIG['num_classes'], pretrained=False)
    ck = load_state(path)
    model.load_state_dict(ck['model_state_dict'])
    model.to(DEVICE).eval()
    return model

# TTA augmentations (modes)
TTA_MODES = ['orig', 'hflip', 'vflip', 'rot+15', 'rot-15']

def apply_tta(pil_img, mode, image_size):
    img = TF.resize(pil_img, (image_size, image_size))
    if mode == 'hflip':
        img = TF.hflip(img)
    elif mode == 'vflip':
        img = TF.vflip(img)
    elif mode == 'rot+15':
        img = TF.rotate(img, 15)
    elif mode == 'rot-15':
        img = TF.rotate(img, -15)
    # to tensor + normalize
    t = TF.to_tensor(img)
    t = TF.normalize(t, mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    return t

if __name__ == '__main__':
    print('Device:', DEVICE)
    if not VAL_CSV.exists():
        raise SystemExit('Validation CSV missing: %s' % VAL_CSV)

    # Load models if available
    res_model = None
    eff_model = None
    if RES_CHECKPOINT.exists():
        res_model = load_model_resnet(RES_CHECKPOINT)
    if EFF_CHECKPOINT.exists():
        try:
            eff_model = load_model_eff(EFF_CHECKPOINT)
        except Exception:
            eff_model = None

    # Load temperature for resnet and efficientnet (if available)
    temp = 1.0
    if TEMP_PATH.exists():
        try:
            temp = float(json.load(open(TEMP_PATH))['temperature'])
        except Exception:
            temp = 1.0
    eff_temp = 1.0
    if EFF_TEMP_PATH.exists():
        try:
            eff_temp = float(json.load(open(EFF_TEMP_PATH))['temperature'])
        except Exception:
            eff_temp = 1.0
    print('ResNet temperature:', temp, 'EfficientNet temperature:', eff_temp)

    # Dataset without transforms to get PIL images
    val_dataset = ResNetDataset(VAL_CSV, transform=None)

    n = len(val_dataset)
    n_classes = RESNET_CONFIG['num_classes']

    res_probs_all = []
    eff_probs_all = []
    labels_all = []

    for i in range(n):
        pil_img, label = val_dataset[i]
        labels_all.append(int(label))

        # ResNet TTA
        if res_model is not None:
            acc_probs = np.zeros((n_classes,), dtype=float)
            for mode in TTA_MODES:
                t = apply_tta(pil_img, mode, RESNET_CONFIG['image_size']).unsqueeze(0).to(DEVICE)
                with torch.no_grad():
                    logits = res_model(t)
                    logits = logits / float(temp)
                    probs = F.softmax(logits, dim=1).cpu().numpy()[0]
                acc_probs += probs
            acc_probs /= len(TTA_MODES)
            res_probs_all.append(acc_probs.tolist())
        else:
            res_probs_all.append([0.0]*n_classes)

        # EfficientNet TTA
        if eff_model is not None:
            acc_probs = np.zeros((n_classes,), dtype=float)
            for mode in TTA_MODES:
                t = apply_tta(pil_img, mode, EFF_CONFIG['image_size']).unsqueeze(0).to(DEVICE)
                with torch.no_grad():
                    logits = eff_model(t)
                    # apply efficientnet temperature scaling if available
                    logits = logits / float(eff_temp)
                    probs = F.softmax(logits, dim=1).cpu().numpy()[0]
                acc_probs += probs
            acc_probs /= len(TTA_MODES)
            eff_probs_all.append(acc_probs.tolist())
        else:
            eff_probs_all.append([0.0]*n_classes)

        if (i+1) % 50 == 0 or i == n-1:
            print(f'Processed {i+1}/{n} images')

    res_probs = np.vstack(res_probs_all)
    eff_probs = np.vstack(eff_probs_all) if eff_model is not None else None
    labels = np.array(labels_all)

    # Compute per-model accuracy and ensemble weights
    res_preds = res_probs.argmax(axis=1)
    res_acc = (res_preds == labels).mean() if res_model is not None else 0.0
    eff_acc = (eff_probs.argmax(axis=1) == labels).mean() if eff_model is not None else 0.0
    print('ResNet TTA acc:', res_acc, 'Eff TTA acc:', eff_acc)

    if eff_probs is not None:
        w_res, w_eff = res_acc, eff_acc
        ensemble_probs = (w_res * res_probs + w_eff * eff_probs) / (w_res + w_eff)
    else:
        ensemble_probs = res_probs

    ens_preds = ensemble_probs.argmax(axis=1)

    # Save outputs
    out = {
        'labels': labels.tolist(),
        'resnet_probs_tta': res_probs.tolist(),
        'eff_probs_tta': eff_probs.tolist() if eff_probs is not None else None,
        'ensemble_probs_tta': ensemble_probs.tolist()
    }
    with open(OUT_JSON, 'w') as f:
        json.dump(out, f)

    # Print classification reports
    from sklearn.metrics import classification_report
    print('\nEnsemble TTA report:')
    print(classification_report(labels, ens_preds, digits=3))

    print('Saved TTA predictions to', OUT_JSON)
