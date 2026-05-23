import json
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, classification_report

ROOT='.'
IN_TTA = ROOT + '/training/val_predictions_tta.json'
IN_STD = ROOT + '/training/val_predictions.json'
ENS_WEIGHTS = ROOT + '/ai-service/models/ensemble_weights.json'

# Load predictions
if __name__=='__main__':
    data=None
    try:
        data=json.load(open(IN_TTA))
    except Exception:
        data=json.load(open(IN_STD))

    labels = np.array(data['labels'])
    res = np.array(data.get('resnet_probs_tta') or data.get('resnet_probs'))
    eff = np.array(data.get('eff_probs_tta') or data.get('eff_probs'))
    ens = np.array(data.get('ensemble_probs_tta') or data.get('ensemble_probs'))

    # Load ensemble weights if available
    try:
        ew = json.load(open(ENS_WEIGHTS))
        rw = float(ew.get('res_weight',1.0))
        efw = float(ew.get('eff_weight',1.0))
        if res is not None and eff is not None:
            combined = (rw * res + efw * eff) / (rw + efw)
        else:
            combined = ens
    except Exception:
        combined = ens

    preds = combined.argmax(axis=1)
    acc = accuracy_score(labels, preds)
    macro_f1 = f1_score(labels, preds, average='macro')

    # ECE: simple fixed-bins implementation
    def ece_score(probs, labels, n_bins=15):
        confidences = probs.max(axis=1)
        predictions = probs.argmax(axis=1)
        bins = np.linspace(0.0, 1.0, n_bins+1)
        ece = 0.0
        for i in range(n_bins):
            mask = (confidences > bins[i]) & (confidences <= bins[i+1])
            if mask.sum() == 0:
                continue
            avg_conf = confidences[mask].mean()
            acc = (predictions[mask] == labels[mask]).mean()
            ece += (mask.sum() / probs.shape[0]) * abs(avg_conf - acc)
        return ece

    probs_norm = combined / combined.sum(axis=1, keepdims=True)
    ece = ece_score(probs_norm, labels)

    print('Validation report:')
    print(f'  Samples: {len(labels)}')
    print(f'  Accuracy: {acc:.4f}')
    print(f'  Macro-F1: {macro_f1:.4f}')
    print(f'  ECE: {ece:.4f}')
    print('\nClassification report:')
    print(classification_report(labels, preds, digits=4))

    # Save brief report
    out = {
        'n_samples': int(len(labels)),
        'accuracy': float(acc),
        'macro_f1': float(macro_f1),
        'ece': float(ece)
    }
    json.dump(out, open(ROOT + '/training/val_report_summary.json','w'), indent=2)
    print('\nSaved summary to training/val_report_summary.json')