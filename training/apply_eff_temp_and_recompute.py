import json
from pathlib import Path
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix, cohen_kappa_score

ROOT = Path(__file__).resolve().parents[1]
IN = ROOT / 'training' / 'val_predictions_tta.json'
EFF_TEMP = ROOT / 'ai-service' / 'models' / 'effnet_temperature.json'
ENS_W = ROOT / 'ai-service' / 'models' / 'ensemble_weights.json'
OUT_JSON = ROOT / 'training' / 'val_predictions_tta_calib.json'
OUT_REPORT = ROOT / 'training' / 'reports' / 'ensemble_metrics_calib.json'
OUT_CM = ROOT / 'training' / 'reports' / 'confusion_matrix_ensemble_calib.csv'
OUT_QWK = ROOT / 'training' / 'metrics_qwk_calib.json'
OUT_THRESH = ROOT / 'ai-service' / 'models' / 'thresholds_calib.json'

if not IN.exists():
    raise SystemExit('Missing TTA preds')
data = json.load(open(IN))
labels = np.array(data['labels'])
res = np.array(data.get('resnet_probs_tta') or data.get('resnet_probs'))
eff = np.array(data.get('eff_probs_tta') or data.get('eff_probs'))
ens = np.array(data.get('ensemble_probs_tta') or data.get('ensemble_probs'))

# load eff temp
eff_temp = None
if EFF_TEMP.exists():
    eff_temp = float(json.load(open(EFF_TEMP))['temperature'])

# calibrate eff probs using power transform
if eff_temp is not None and eff is not None:
    invT = 1.0 / eff_temp
    eff_cal = np.power(np.clip(eff,1e-12,1.0), invT)
    eff_cal = eff_cal / eff_cal.sum(axis=1, keepdims=True)
else:
    eff_cal = eff

# compute combined using ensemble weights
if ENS_W.exists() and res is not None and eff_cal is not None:
    w = json.load(open(ENS_W))
    rw = float(w.get('res_weight',1.0)); ew = float(w.get('eff_weight',1.0))
    combined = (rw * res + ew * eff_cal) / (rw + ew)
else:
    combined = ens

# save new predictions json (copy but update ensemble_probs_tta)
outp = data.copy()
outp['ensemble_probs_tta'] = combined.tolist()
with open(OUT_JSON,'w') as f:
    json.dump(outp, f)

# metrics
preds = combined.argmax(axis=1)
acc = float(accuracy_score(labels, preds))
macro_f1 = float(f1_score(labels, preds, average='macro'))
# ECE
confidences = combined.max(axis=1)
predictions = preds
bins = np.linspace(0.0,1.0,16)
ece = 0.0
for i in range(len(bins)-1):
    mask = (confidences > bins[i]) & (confidences <= bins[i+1])
    if mask.sum()==0: continue
    avg_conf = confidences[mask].mean()
    acc_bin = (predictions[mask]==labels[mask]).mean()
    ece += (mask.sum()/len(labels)) * abs(avg_conf - acc_bin)

report = classification_report(labels, preds, output_dict=True)
cm = confusion_matrix(labels, preds).tolist()

out = {
    'n_samples': int(labels.shape[0]),
    'accuracy': acc,
    'macro_f1': macro_f1,
    'ece': ece,
    'classification_report': report,
    'confusion_matrix': cm
}
with open(OUT_REPORT,'w') as f:
    json.dump(out, f, indent=2)

# save confusion matrix csv
import csv
with open(OUT_CM,'w',newline='',encoding='utf-8') as f:
    w = csv.writer(f)
    header = [''] + [f'pred_{i}' for i in range(combined.shape[1])]
    w.writerow(header)
    for i,row in enumerate(cm):
        w.writerow([f'true_{i}'] + row)

# QWK
kappa = float(cohen_kappa_score(labels, preds, weights='quadratic'))
outq = {'n_samples': int(labels.shape[0]), 'quadratic_weighted_kappa': kappa, 'confusion_matrix': cm}
with open(OUT_QWK,'w') as f:
    json.dump(outq, f, indent=2)

# run threshold tuning (coordinate descent) on combined
n_classes = combined.shape[1]
log_probs = np.log(np.clip(combined,1e-12,1.0))
from sklearn.metrics import f1_score, accuracy_score

def score_with_bias(biases):
    adjusted = log_probs + biases[np.newaxis,:]
    preds = adjusted.argmax(axis=1)
    return f1_score(labels, preds, average='macro'), accuracy_score(labels, preds), preds

biases = np.zeros(n_classes)
best_score, best_acc, _ = score_with_bias(biases)
grid = np.linspace(-1.0,1.0,41)
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
        biases[c] = best_local
    if not improved:
        break

# save thresholds
OUT_THRESH.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_THRESH,'w') as f:
    json.dump({'biases': biases.tolist(), 'macro_f1': float(best_score), 'accuracy': float(best_acc)}, f, indent=2)

print('Saved calibrated ensemble preds to', OUT_JSON)
print('Saved metrics to', OUT_REPORT)
print('Saved QWK to', OUT_QWK)
print('Saved thresholds to', OUT_THRESH)
