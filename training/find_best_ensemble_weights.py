import json
from pathlib import Path
import numpy as np
from sklearn.metrics import accuracy_score, f1_score

ROOT = Path(__file__).resolve().parents[1]
IN = ROOT / 'training' / 'val_predictions_tta.json'
OUT = ROOT / 'ai-service' / 'models' / 'ensemble_weights.json'

if not IN.exists():
    raise SystemExit(f'Validation predictions not found: {IN} — run tta_eval.py first')

data = json.load(open(IN))
res = np.array(data.get('resnet_probs_tta') or data.get('resnet_probs'))
eff = np.array(data.get('eff_probs_tta') or data.get('eff_probs'))
labels = np.array(data.get('labels'))

if res is None or eff is None:
    raise SystemExit('Both resnet and efficientnet predictions are required in val_predictions_tta.json')

n = labels.shape[0]

best = {'score': -1.0, 'metric': 'accuracy', 'res_weight': 1.0, 'eff_weight': 1.0}

grid = np.linspace(0.1, 2.0, 20)
for wr in grid:
    for we in grid:
        ens = (wr * res + we * eff) / (wr + we)
        preds = ens.argmax(axis=1)
        acc = accuracy_score(labels, preds)
        if acc > best['score']:
            best.update({'score': float(acc), 'res_weight': float(wr), 'eff_weight': float(we)})

OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump(best, open(OUT, 'w'), indent=2)
print('Best ensemble weights saved to', OUT)
print(best)
