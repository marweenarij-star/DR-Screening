import json
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'training'/'val_predictions_tta.json'
ENS_W=ROOT/'ai-service'/'models'/'ensemble_weights.json'
if not P.exists():
    print('Missing TTA predictions:', P)
    raise SystemExit
D=json.load(open(P,'r'))
labels=np.array(D['labels'])
res=np.array(D.get('resnet_probs_tta') or D.get('resnet_probs'))
eff=np.array(D.get('eff_probs_tta') or D.get('eff_probs'))
ens=np.array(D.get('ensemble_probs_tta') or D.get('ensemble_probs'))
if ENS_W.exists() and res is not None and eff is not None:
    w=json.load(open(ENS_W))
    rw=float(w.get('res_weight',1.0)); ew=float(w.get('eff_weight',1.0))
    combined=(rw*res+ew*eff)/(rw+ew)
else:
    combined=ens
n=combined.shape[1]
preds=combined.argmax(axis=1)
# overall average predicted prob per class
overall_avg=combined.mean(axis=0)
# average prob for class c when predicted as c
avg_when_pred=[]
for c in range(n):
    mask=(preds==c)
    avg = float(combined[mask,c].mean()) if mask.sum()>0 else None
    avg_when_pred.append(avg)
# average prob for class c when true label is c
avg_when_true=[]
for c in range(n):
    mask=(labels==c)
    avg = float(combined[mask,c].mean()) if mask.sum()>0 else None
    avg_when_true.append(avg)
# print
print('Overall average predicted prob per class:')
for i,v in enumerate(overall_avg):
    print(f'  Class {i}: {v*100:.2f}%')
print()
print('Average predicted prob for a class when it was predicted (confidence of predictions):')
for i,v in enumerate(avg_when_pred):
    if v is None: print(f'  Class {i}: N/A')
    else: print(f'  Class {i}: {v*100:.2f}% (n_pred={int((preds==i).sum())})')
print()
print('Average predicted prob for the true class (how confident when class was present):')
for i,v in enumerate(avg_when_true):
    if v is None: print(f'  Class {i}: N/A')
    else: print(f'  Class {i}: {v*100:.2f}% (n_true={int((labels==i).sum())})')
print()
conf_pred = combined[np.arange(len(preds)), preds]
print('Mean confidence of chosen class (overall):', f'{conf_pred.mean()*100:.2f}%')
