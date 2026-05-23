import json
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from sklearn.metrics import roc_curve, auc, classification_report
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'training' / 'reports'
OUT.mkdir(parents=True, exist_ok=True)

# Load TTA predictions
IN_TTA = ROOT / 'training' / 'val_predictions_tta.json'
if not IN_TTA.exists():
    raise SystemExit('Missing validation TTA predictions: run tta_eval.py first')
data = json.load(open(IN_TTA))
labels = np.array(data['labels'])
ens = np.array(data.get('ensemble_probs_tta') or data.get('ensemble_probs'))

# ROC per class
n_classes = ens.shape[1]
plt.figure(figsize=(8,6))
for c in range(n_classes):
    y_true = (labels == c).astype(int)
    fpr, tpr, _ = roc_curve(y_true, ens[:, c])
    roc_auc = auc(fpr, tpr)
    plt.plot(fpr, tpr, label=f'Class {c} (AUC={roc_auc:.3f})')
plt.plot([0,1],[0,1],'k--')
plt.xlabel('False Positive Rate')
plt.ylabel('True Positive Rate')
plt.title('Final ROC curves (ensemble)')
plt.legend()
plt.grid(True)
plt.savefig(OUT / 'roc_final.png', bbox_inches='tight')
plt.close()

# Best thresholds
THR = ROOT / 'ai-service' / 'models' / 'thresholds.json'
best_thresholds = None
if THR.exists():
    best_thresholds = json.load(open(THR))
    print('Loaded best thresholds/biases from', THR)
    json.dump(best_thresholds, open(OUT / 'best_thresholds_copy.json', 'w'), indent=2)
else:
    print('No thresholds.json found; run threshold_tuning.py')

# Training curves: copy existing if present
tc = ROOT / 'training' / 'checkpoints' / 'training_curves.png'
if tc.exists():
    # also save a copy into reports
    from shutil import copyfile
    copyfile(tc, OUT / 'training_curves.png')
    print('Found training curves image:', tc)
else:
    print('No training_curves.png found; per-epoch arrays unavailable')

# Brightness distributions: before vs after cleaning
before_paths = []
raw_dir = ROOT / 'archive' / 'unused' / 'APTOS'
for sub in ('train_images', 'test_images'):
    p = raw_dir / sub
    if p.exists():
        before_paths.extend([p / f for f in sorted([x for x in p.iterdir() if x.suffix.lower() in ('.png','.jpg','.jpeg')])])

after_dir = ROOT / 'APTOS' / 'cleaned' / 'processed_images'
after_paths = []
if after_dir.exists():
    after_paths = [after_dir / f for f in sorted([x for x in after_dir.iterdir() if x.suffix.lower() in ('.png','.jpg','.jpeg')])]

def brightness_list(paths, limit=None):
    vals = []
    for i,p in enumerate(paths):
        if limit and i>=limit:
            break
        try:
            im = Image.open(p).convert('L')
            st = ImageStat.Stat(im)
            vals.append(st.mean[0])
        except Exception:
            continue
    return vals

before_b = brightness_list(before_paths, limit=2000) if before_paths else []
after_b = brightness_list(after_paths, limit=2000) if after_paths else []

plt.figure(figsize=(8,5))
bins = np.linspace(0,255,60)
if before_b:
    plt.hist(before_b, bins=bins, alpha=0.6, label='Before cleaning')
if after_b:
    plt.hist(after_b, bins=bins, alpha=0.6, label='After cleaning')
plt.xlabel('Mean brightness (0-255)')
plt.ylabel('Image count')
plt.title('Brightness distribution: before vs after cleaning')
plt.legend()
plt.savefig(OUT / 'brightness_distribution.png', bbox_inches='tight')
plt.close()

summary = {
    'n_val_samples': int(labels.shape[0]),
    'roc_plot': str(OUT / 'roc_final.png'),
    'training_curves': str(OUT / 'training_curves.png') if tc.exists() else None,
    'best_thresholds': best_thresholds,
    'brightness_before_count': len(before_b),
    'brightness_after_count': len(after_b),
}

json.dump(summary, open(OUT / 'final_report_summary.json', 'w'), indent=2)
print('Saved final report to', OUT)
