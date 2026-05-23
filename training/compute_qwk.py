import json
from pathlib import Path
import numpy as np
from sklearn.metrics import cohen_kappa_score, confusion_matrix

ROOT = Path(__file__).resolve().parents[1]
IN_TTA = ROOT / 'training' / 'val_predictions_tta.json'
ENS_W = ROOT / 'ai-service' / 'models' / 'ensemble_weights.json'
OUT = ROOT / 'training' / 'metrics_qwk.json'

if not IN_TTA.exists():
    raise SystemExit('Missing TTA predictions: run training/tta_eval.py first')

data = json.load(open(IN_TTA))
labels = np.array(data['labels'])
res = np.array(data.get('resnet_probs_tta') or data.get('resnet_probs'))
eff = np.array(data.get('eff_probs_tta') or data.get('eff_probs'))
ens = np.array(data.get('ensemble_probs_tta') or data.get('ensemble_probs'))

# If explicit best weights exist, recompute ensemble using them
if ENS_W.exists() and (res is not None) and (eff is not None):
    w = json.load(open(ENS_W))
    rw = float(w.get('res_weight', 1.0))
    ew = float(w.get('eff_weight', 1.0))
    combined = (rw * res + ew * eff) / (rw + ew)
else:
    combined = ens

preds = combined.argmax(axis=1)

kappa = float(cohen_kappa_score(labels, preds, weights='quadratic'))
cm = confusion_matrix(labels, preds).tolist()

out = {
    'n_samples': int(labels.shape[0]),
    'quadratic_weighted_kappa': kappa,
    'confusion_matrix': cm
}

json.dump(out, open(OUT, 'w'), indent=2)
print('Saved QWK to', OUT)
print('QWK:', kappa)
