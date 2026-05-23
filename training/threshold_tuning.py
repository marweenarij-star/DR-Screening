import json
from pathlib import Path
import numpy as np
from sklearn.metrics import f1_score, classification_report, accuracy_score

ROOT = Path(__file__).resolve().parents[1]
IN_TTA = ROOT / 'training' / 'val_predictions_tta.json'
IN_STD = ROOT / 'training' / 'val_predictions.json'
OUT = ROOT / 'ai-service' / 'models' / 'thresholds.json'

# load probs
if IN_TTA.exists():
    data = json.load(open(IN_TTA))
    probs = np.array(data.get('ensemble_probs_tta') or data.get('ensemble_probs') or data.get('resnet_probs'))
    labels = np.array(data['labels'])
elif IN_STD.exists():
    data = json.load(open(IN_STD))
    probs = np.array(data.get('ensemble_probs') or data.get('resnet_probs'))
    labels = np.array(data['labels'])
else:
    raise SystemExit('No validation predictions found (val_predictions_tta.json or val_predictions.json)')

n_classes = probs.shape[1]

# scoring function using additive bias in log-prob space
log_probs = np.log(np.clip(probs, 1e-12, 1.0))

def score_with_bias(biases):
    adjusted = log_probs + biases[np.newaxis, :]
    preds = adjusted.argmax(axis=1)
    return f1_score(labels, preds, average='macro'), accuracy_score(labels, preds), preds

# coordinate descent grid search
biases = np.zeros(n_classes)
best_score, best_acc, _ = score_with_bias(biases)
print(f'Baseline macro-F1: {best_score:.4f}, acc: {best_acc:.4f}')

grid = np.linspace(-1.0, 1.0, 41)
for it in range(5):
    improved = False
    for c in range(n_classes):
        cur = biases[c]
        best_local = cur
        for g in grid:
            trial = biases.copy()
            trial[c] = g
            sc, ac, _ = score_with_bias(trial)
            if sc > best_score + 1e-6:
                best_score = sc
                best_acc = ac
                best_local = g
                biases = trial
                improved = True
        # accept best_local
        biases[c] = best_local
    if not improved:
        break

print(f'Optimized macro-F1: {best_score:.4f}, acc: {best_acc:.4f}')
_, _, preds = score_with_bias(biases)
print('\nClassification report after tuning:')
print(classification_report(labels, preds, digits=3))

OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump({'biases': biases.tolist(), 'macro_f1': float(best_score), 'accuracy': float(best_acc)}, open(OUT, 'w'), indent=2)
print('Saved thresholds/biases to', OUT)
