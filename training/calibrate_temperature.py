import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader
from pathlib import Path
import json
import numpy as np
from train_resnet50 import DRClassifier, get_transforms, DRDataset, CONFIG as RESNET_CONFIG

ROOT = Path(__file__).resolve().parents[1]
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

VAL_CSV = ROOT / 'APTOS' / 'cleaned' / 'val_clean.csv'
MODEL_PTH = ROOT / 'ai-service' / 'models' / 'dr_resnet50_for_inference.pth'
OUT_JSON = ROOT / 'training' / 'calibration_report_resnet.json'
OUT_TEMP = ROOT / 'ai-service' / 'models' / 'resnet_temperature.json'


def load_model(path, device):
    model = DRClassifier(num_classes=RESNET_CONFIG['num_classes'], pretrained=False)
    ck = torch.load(path, map_location=device)
    model.load_state_dict(ck['model_state_dict'])
    model.to(device).eval()
    return model


def get_logits_and_labels(model, loader, device):
    logits_list = []
    labels_list = []
    with torch.no_grad():
        for imgs, labs in loader:
            imgs = imgs.to(device)
            out = model(imgs)
            logits_list.append(out.cpu())
            labels_list.append(labs)
    logits = torch.cat(logits_list, dim=0)
    labels = torch.cat(labels_list, dim=0)
    return logits, labels


def nll_loss_temp(logits, labels, temp):
    # logits: [N, C], temp: scalar >0
    scaled = logits / temp
    return F.cross_entropy(scaled, labels)


def fit_temperature(logits, labels, device):
    # Initialize temperature
    temp = torch.ones(1, device=device, requires_grad=True)
    optimizer = torch.optim.LBFGS([temp], lr=0.01, max_iter=300)

    labels = labels.to(device)
    logits = logits.to(device)

    def closure():
        optimizer.zero_grad()
        loss = nll_loss_temp(logits, labels, temp)
        loss.backward()
        return loss

    optimizer.step(closure)
    # ensure temperature > 0
    temp_val = temp.detach().cpu().item()
    if temp_val <= 0:
        temp_val = max(1e-3, temp_val)
    return float(temp_val)


def compute_metrics_from_logits(logits, labels, temp=1.0):
    scaled = logits / temp
    probs = F.softmax(scaled, dim=1).numpy()
    preds = probs.argmax(axis=1)
    labels_np = labels.numpy()
    from sklearn.metrics import accuracy_score, classification_report, brier_score_loss
    acc = accuracy_score(labels_np, preds)
    report = classification_report(labels_np, preds, output_dict=True)
    # compute ECE
    ece = expected_calibration_error(probs, labels_np, n_bins=15)
    return acc, report, ece, probs


def expected_calibration_error(probs, labels, n_bins=15):
    # probs: [N, C]
    confidences = probs.max(axis=1)
    predictions = probs.argmax(axis=1)
    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    for bin_lower, bin_upper in zip(bin_boundaries[:-1], bin_boundaries[1:]):
        mask = (confidences > bin_lower) & (confidences <= bin_upper)
        if mask.sum() == 0:
            continue
        acc = (predictions[mask] == labels[mask]).mean()
        conf = confidences[mask].mean()
        ece += (mask.sum() / len(labels)) * abs(acc - conf)
    return float(ece)


if __name__ == '__main__':
    if not VAL_CSV.exists():
        print('val_clean.csv not found at', VAL_CSV)
        raise SystemExit(1)
    if not MODEL_PTH.exists():
        print('Model checkpoint not found at', MODEL_PTH)
        raise SystemExit(1)

    print('Device:', DEVICE)
    model = load_model(MODEL_PTH, DEVICE)

    val_transform = get_transforms(is_training=False, image_size=RESNET_CONFIG['image_size'])
    val_dataset = DRDataset(VAL_CSV, transform=val_transform)
    val_loader = DataLoader(val_dataset, batch_size=RESNET_CONFIG['batch_size'], shuffle=False, num_workers=0)

    print('Collecting logits on validation set...')
    logits, labels = get_logits_and_labels(model, val_loader, DEVICE)
    print('Logits shape:', logits.shape, 'Labels shape:', labels.shape)

    print('Fitting temperature...')
    temp = fit_temperature(logits, labels, DEVICE)
    print('Optimal temperature:', temp)

    print('Computing calibrated metrics...')
    acc_cal, report_cal, ece_cal, probs_cal = compute_metrics_from_logits(logits, labels, temp=temp)
    acc_uncal, report_uncal, ece_uncal, probs_uncal = compute_metrics_from_logits(logits, labels, temp=1.0)

    out = {
        'temperature': temp,
        'uncalibrated': {
            'accuracy': acc_uncal,
            'ece': ece_uncal,
            'report': report_uncal
        },
        'calibrated': {
            'accuracy': acc_cal,
            'ece': ece_cal,
            'report': report_cal
        }
    }

    with open(OUT_JSON, 'w') as f:
        json.dump(out, f, indent=2)

    # save temperature
    with open(OUT_TEMP, 'w') as f:
        json.dump({'temperature': temp}, f)

    print('Calibration complete. Results saved to', OUT_JSON)
