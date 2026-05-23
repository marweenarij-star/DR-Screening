import json
from pathlib import Path
import numpy as np
from sklearn.metrics import roc_auc_score, classification_report, confusion_matrix

ROOT = Path(__file__).resolve().parents[1]
IN_TTA = ROOT / 'training' / 'val_predictions_tta.json'
ENS_W = ROOT / 'ai-service' / 'models' / 'ensemble_weights.json'
OUT_DIR = ROOT / 'training' / 'reports'
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_JSON = OUT_DIR / 'ensemble_metrics.json'
OUT_CM = OUT_DIR / 'confusion_matrix_ensemble.csv'

if not IN_TTA.exists():
    raise SystemExit('Missing TTA predictions: run training/tta_eval.py first')

data = json.load(open(IN_TTA))
labels = np.array(data['labels'])
res = np.array(data.get('resnet_probs_tta') or data.get('resnet_probs'))
eff = np.array(data.get('eff_probs_tta') or data.get('eff_probs'))
ens = np.array(data.get('ensemble_probs_tta') or data.get('ensemble_probs'))

# If ensemble_weights specified, recompute combined
if (ENS_W.exists()) and (res is not None) and (eff is not None):
    w = json.load(open(ENS_W))
    rw = float(w.get('res_weight', 1.0))
    ew = float(w.get('eff_weight', 1.0))
    combined = (rw * res + ew * eff) / (rw + ew)
else:
    combined = ens

n_classes = combined.shape[1]
# per-class AUC
aucs = []
for c in range(n_classes):
    y = (labels == c).astype(int)
    try:
        auc = float(roc_auc_score(y, combined[:, c]))
    except Exception:
        auc = None
    aucs.append(auc)

preds = combined.argmax(axis=1)
report = classification_report(labels, preds, output_dict=True)
cm = confusion_matrix(labels, preds).tolist()

out = {
    'n_samples': int(labels.shape[0]),
    'aucs_per_class': aucs,
    'classification_report': report,
    'confusion_matrix': cm
}

with open(OUT_JSON, 'w') as f:
    json.dump(out, f, indent=2)

# write confusion matrix CSV
import csv
with open(OUT_CM, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    header = [''] + [f'pred_{i}' for i in range(n_classes)]
    w.writerow(header)
    for i,row in enumerate(cm):
        w.writerow([f'true_{i}'] + row)

print('Saved ensemble metrics to', OUT_JSON)
print('Saved confusion matrix CSV to', OUT_CM)
