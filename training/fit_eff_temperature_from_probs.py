import json
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN = ROOT / 'training' / 'val_predictions_tta.json'
OUT_TEMP = ROOT / 'ai-service' / 'models' / 'effnet_temperature.json'
OUT_REPORT = ROOT / 'training' / 'calibration_report_effnet_from_probs.json'

if not IN.exists():
    raise SystemExit('Missing TTA preds: run training/tta_eval.py first')

data = json.load(open(IN))
labels = np.array(data['labels'])
eff = np.array(data.get('eff_probs_tta') or data.get('eff_probs'))
if eff is None:
    raise SystemExit('No efficientnet probs found in TTA preds')

# define NLL as function of T, where transformed probs = p_i^(1/T)/sum_j p_j^(1/T)
def nll_for_T(T):
    if T <= 0:
        return np.inf
    invT = 1.0 / T
    # raise probs to power invT
    with np.errstate(divide='ignore', invalid='ignore'):
        p_pow = np.power(np.clip(eff, 1e-12, 1.0), invT)
    p_norm = p_pow / p_pow.sum(axis=1, keepdims=True)
    # compute negative log likelihood
    nll = -np.log(np.clip(p_norm[np.arange(len(labels)), labels], 1e-12, 1.0)).mean()
    return nll

# coarse grid search in logspace
grid = np.logspace(-1, 1, 101)  # 0.1 to 10
nlls = [nll_for_T(t) for t in grid]
best_idx = int(np.argmin(nlls))
best_T = float(grid[best_idx])
# refine around best_T
lo = max(best_T * 0.5, 1e-3)
hi = best_T * 2.0
grid2 = np.linspace(lo, hi, 101)
nlls2 = [nll_for_T(t) for t in grid2]
best_idx2 = int(np.argmin(nlls2))
best_T = float(grid2[best_idx2])
# final refine
lo = max(best_T * 0.8, 1e-3)
hi = best_T * 1.25
grid3 = np.linspace(lo, hi, 101)
nlls3 = [nll_for_T(t) for t in grid3]
best_idx3 = int(np.argmin(nlls3))
best_T = float(grid3[best_idx3])

# compute metrics before/after
from sklearn.metrics import accuracy_score
# original ensemble uses eff as part; but we report eff calibration metrics
uncal_probs = eff
invT = 1.0 / best_T
cal_probs = np.power(np.clip(eff,1e-12,1.0), invT)
cal_probs = cal_probs / cal_probs.sum(axis=1, keepdims=True)
uncal_pred = uncal_probs.argmax(axis=1)
cal_pred = cal_probs.argmax(axis=1)
acc_uncal = float(accuracy_score(labels, uncal_pred))
acc_cal = float(accuracy_score(labels, cal_pred))

out_report = {
    'temperature': best_T,
    'uncalibrated': {'accuracy': acc_uncal},
    'calibrated': {'accuracy': acc_cal}
}

OUT_TEMP.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_TEMP, 'w') as f:
    json.dump({'temperature': best_T}, f)
with open(OUT_REPORT, 'w') as f:
    json.dump(out_report, f, indent=2)

print('Saved effnet temperature', best_T)
print('Uncal acc', acc_uncal, 'Cal acc', acc_cal)
