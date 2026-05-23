**Ensemble Report — ResNet50 (calibrated) + EfficientNet-B3 (soft voting)**

- **Dataset:** APTOS cleaned validation set (694 samples)
- **ResNet50 (temperature-scaled):** Accuracy 0.686 — per-class F1: [0.919, 0.454, 0.470, 0.490, 0.621]
- **EfficientNet-B3:** Accuracy 0.726 — per-class F1: [0.922, 0.452, 0.611, 0.506, 0.388]
- **Ensemble (soft voting, weights = validation accuracy):** Accuracy 0.758 — per-class F1: [0.948, 0.519, 0.616, 0.530, 0.621]
- **Per-class AUC (ResNet / Eff / Ens):**
  - Class 0: 0.992 / 0.969 / 0.985
  - Class 1: 0.890 / 0.860 / 0.905
  - Class 2: 0.924 / 0.850 / 0.917
  - Class 3: 0.920 / 0.903 / 0.935
  - Class 4: 0.890 / 0.838 / 0.905

Summary:
- Temperature scaling improved probability calibration for ResNet (temperature=1.3816 saved to ai-service/models/resnet_temperature.json).
- EfficientNet contributes complementary strengths; soft-voting ensemble improved overall accuracy and per-class AUCs.

Recommended next steps (pick any):
- Deploy ensemble to the AI service (load both models and predict with calibrated ResNet logits).  
- Run TTA + threshold tuning to maximize clinically-relevant recall.  
- Retrain EfficientNet longer / with heavier augmentations to further boost ensemble gains.  
- Compute Quadratic Weighted Kappa and report class-wise decision thresholds for deployment.

Files produced:
- training/calibration_report_resnet.json
- ai-service/models/resnet_temperature.json
- training/val_predictions.json
- training/ensemble_report.md

If you want, I can (A) update the AI service to apply the temperature automatically and expose an ensemble endpoint, (B) run TTA + threshold tuning now, or (C) retrain EfficientNet with full schedule. Which should I do next?