import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import confusion_matrix, f1_score, roc_curve, auc
from sklearn.preprocessing import label_binarize


ROOT = Path(__file__).resolve().parent
REPORTS_DIR = ROOT / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

VAL_PRED_PATH = ROOT / "val_predictions.json"
RESNET_CALIB_PATH = ROOT / "calibration_report_resnet.json"
EFFNET_CALIB_PATH = ROOT / "calibration_report_effnet.json"
ENSEMBLE_METRICS_PATH = ROOT / "reports" / "ensemble_metrics.json"
THRESHOLDS_PATH = ROOT / "reports" / "best_thresholds_copy.json"

MODEL_NAMES = ["ResNet50", "EfficientNet-B3", "Ensemble"]
CLASS_NAMES = ["No DR", "Mild", "Moderate", "Severe", "PDR"]


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_model_metrics_chart(metrics):
    out_path = REPORTS_DIR / "model_comparison_metrics.png"

    fig, axes = plt.subplots(2, 2, figsize=(12, 8), dpi=220)
    axes = axes.flatten()

    chart_info = [
        ("Accuracy", [metrics[m]["accuracy"] for m in MODEL_NAMES], "#2563EB"),
        ("Macro F1", [metrics[m]["macro_f1"] for m in MODEL_NAMES], "#16A34A"),
        ("QWK", [metrics[m]["qwk"] for m in MODEL_NAMES], "#D97706"),
        ("ECE", [metrics[m]["ece"] for m in MODEL_NAMES], "#DC2626"),
    ]

    for ax, (title, values, color) in zip(axes, chart_info):
        x = np.arange(len(MODEL_NAMES))
        bars = ax.bar(x, values, color=color, alpha=0.9)
        ax.set_xticks(x)
        ax.set_xticklabels(MODEL_NAMES, rotation=10)
        ax.set_title(title, fontweight="bold")
        ax.grid(axis="y", linestyle="--", alpha=0.25)
        for b, v in zip(bars, values):
            ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.005, f"{v:.3f}", ha="center", fontsize=9)

    fig.suptitle("Comparison of 3 Models", fontsize=14, fontweight="bold")
    plt.tight_layout(rect=[0, 0.02, 1, 0.96])
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)


def save_f1_per_class_chart(class_f1):
    out_path = REPORTS_DIR / "f1_per_class_3models.png"

    x = np.arange(len(CLASS_NAMES))
    w = 0.25

    fig, ax = plt.subplots(figsize=(11, 6), dpi=220)
    ax.bar(x - w, class_f1["ResNet50"], width=w, label="ResNet50", color="#2563EB")
    ax.bar(x, class_f1["EfficientNet-B3"], width=w, label="EfficientNet-B3", color="#16A34A")
    ax.bar(x + w, class_f1["Ensemble"], width=w, label="Ensemble", color="#D97706")

    ax.set_xticks(x)
    ax.set_xticklabels(CLASS_NAMES)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("F1-score")
    ax.set_title("F1-score per class (3 models)", fontweight="bold")
    ax.grid(axis="y", linestyle="--", alpha=0.25)
    ax.legend()

    plt.tight_layout()
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)


def save_roc_chart(labels, probs_by_model):
    out_path = REPORTS_DIR / "roc_3models.png"

    y_true_bin = label_binarize(labels, classes=[0, 1, 2, 3, 4])

    fig, ax = plt.subplots(figsize=(8, 7), dpi=220)
    colors = {
        "ResNet50": "#2563EB",
        "EfficientNet-B3": "#16A34A",
        "Ensemble": "#D97706",
    }

    for model_name in MODEL_NAMES:
        probs = probs_by_model[model_name]
        fpr, tpr, _ = roc_curve(y_true_bin.ravel(), probs.ravel())
        roc_auc = auc(fpr, tpr)
        ax.plot(fpr, tpr, color=colors[model_name], lw=2, label=f"{model_name} (AUC={roc_auc:.3f})")

    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", lw=1)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("Micro-average ROC comparison (3 models)", fontweight="bold")
    ax.legend(loc="lower right")
    ax.grid(alpha=0.25)

    plt.tight_layout()
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)


def save_confusion_matrices(labels, probs_by_model):
    out_path = REPORTS_DIR / "confusion_matrices_3models.png"

    fig, axes = plt.subplots(1, 3, figsize=(15, 4.8), dpi=220)

    for ax, model_name in zip(axes, MODEL_NAMES):
        preds = np.argmax(probs_by_model[model_name], axis=1)
        cm = confusion_matrix(labels, preds, labels=[0, 1, 2, 3, 4])

        im = ax.imshow(cm, cmap="Blues")
        ax.set_title(model_name, fontweight="bold")
        ax.set_xticks(np.arange(5))
        ax.set_yticks(np.arange(5))
        ax.set_xticklabels([0, 1, 2, 3, 4])
        ax.set_yticklabels([0, 1, 2, 3, 4])
        ax.set_xlabel("Predicted")
        ax.set_ylabel("True")

        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                color = "white" if cm[i, j] > cm.max() * 0.5 else "black"
                ax.text(j, i, str(cm[i, j]), ha="center", va="center", color=color, fontsize=8)

    fig.colorbar(im, ax=axes.ravel().tolist(), fraction=0.02, pad=0.02)
    fig.suptitle("Confusion matrices (argmax predictions)", fontsize=13, fontweight="bold")
    plt.tight_layout(rect=[0, 0.02, 1, 0.95])
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)


def save_thresholds_chart(ensemble_accuracy, ensemble_macro_f1, best_thresholds):
    out_path = REPORTS_DIR / "thresholds_optimization.png"

    before_acc = ensemble_accuracy
    before_f1 = ensemble_macro_f1
    after_acc = best_thresholds["accuracy"]
    after_f1 = best_thresholds["macro_f1"]
    biases = best_thresholds["biases"]

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.8), dpi=220)

    x = np.arange(2)
    w = 0.35
    axes[0].bar(x - w / 2, [before_acc, before_f1], width=w, label="Before", color="#94A3B8")
    axes[0].bar(x + w / 2, [after_acc, after_f1], width=w, label="After", color="#2563EB")
    axes[0].set_xticks(x)
    axes[0].set_xticklabels(["Accuracy", "Macro F1"])
    axes[0].set_ylim(0, 1.0)
    axes[0].set_title("Threshold tuning impact", fontweight="bold")
    axes[0].legend()
    axes[0].grid(axis="y", linestyle="--", alpha=0.25)

    cls = np.arange(5)
    axes[1].bar(cls, biases, color="#D97706")
    axes[1].set_xticks(cls)
    axes[1].set_xticklabels(["C0", "C1", "C2", "C3", "C4"])
    axes[1].set_title("Learned class biases", fontweight="bold")
    axes[1].set_ylabel("Bias value")
    axes[1].axhline(0, color="black", linewidth=1)
    axes[1].grid(axis="y", linestyle="--", alpha=0.25)

    plt.tight_layout()
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)


def main():
    val_pred = load_json(VAL_PRED_PATH)
    res_calib = load_json(RESNET_CALIB_PATH)
    eff_calib = load_json(EFFNET_CALIB_PATH)
    ens_metrics = load_json(ENSEMBLE_METRICS_PATH)
    best_thr = load_json(THRESHOLDS_PATH)

    labels = np.array(val_pred["labels"], dtype=int)
    res_probs = np.array(val_pred["resnet_probs"], dtype=float)
    eff_probs = np.array(val_pred["eff_probs"], dtype=float)
    ens_probs = np.array(val_pred["ensemble_probs"], dtype=float)

    metrics = {
        "ResNet50": {
            "accuracy": float(res_calib["uncalibrated"]["accuracy"]),
            "macro_f1": float(res_calib["uncalibrated"]["report"]["macro avg"]["f1-score"]),
            "ece": float(res_calib["uncalibrated"]["ece"]),
            "qwk": np.nan,
        },
        "EfficientNet-B3": {
            "accuracy": float(eff_calib["uncalibrated"]["accuracy"]),
            "macro_f1": float(eff_calib["uncalibrated"]["report"]["macro avg"]["f1-score"]),
            "ece": float(eff_calib["uncalibrated"]["ece"]),
            "qwk": np.nan,
        },
        "Ensemble": {
            "accuracy": float(ens_metrics["classification_report"]["accuracy"]),
            "macro_f1": float(ens_metrics["classification_report"]["macro avg"]["f1-score"]),
            "ece": np.nan,
            "qwk": np.nan,
        },
    }

    res_pred = np.argmax(res_probs, axis=1)
    eff_pred = np.argmax(eff_probs, axis=1)
    ens_pred = np.argmax(ens_probs, axis=1)

    # Compute qwk and fallback ECE for missing entries from probabilistic outputs.
    # QWK is approximated via weighted confusion approach from sklearn's implementation inside f1 module is not available;
    # use a direct import here to keep script compact.
    from sklearn.metrics import cohen_kappa_score

    metrics["ResNet50"]["qwk"] = float(cohen_kappa_score(labels, res_pred, weights="quadratic"))
    metrics["EfficientNet-B3"]["qwk"] = float(cohen_kappa_score(labels, eff_pred, weights="quadratic"))
    metrics["Ensemble"]["qwk"] = float(cohen_kappa_score(labels, ens_pred, weights="quadratic"))

    def ece_from_probs(y_true, probs, n_bins=15):
        conf = probs.max(axis=1)
        pred = probs.argmax(axis=1)
        bins = np.linspace(0.0, 1.0, n_bins + 1)
        ece = 0.0
        for i in range(n_bins):
            mask = (conf > bins[i]) & (conf <= bins[i + 1])
            if mask.sum() == 0:
                continue
            acc = (pred[mask] == y_true[mask]).mean()
            avg_conf = conf[mask].mean()
            ece += (mask.sum() / len(y_true)) * abs(acc - avg_conf)
        return float(ece)

    if np.isnan(metrics["Ensemble"]["ece"]):
        metrics["Ensemble"]["ece"] = ece_from_probs(labels, ens_probs)

    class_f1 = {
        "ResNet50": [
            float(res_calib["uncalibrated"]["report"]["0"]["f1-score"]),
            float(res_calib["uncalibrated"]["report"]["1"]["f1-score"]),
            float(res_calib["uncalibrated"]["report"]["2"]["f1-score"]),
            float(res_calib["uncalibrated"]["report"]["3"]["f1-score"]),
            float(res_calib["uncalibrated"]["report"]["4"]["f1-score"]),
        ],
        "EfficientNet-B3": [
            float(eff_calib["uncalibrated"]["report"]["0"]["f1-score"]),
            float(eff_calib["uncalibrated"]["report"]["1"]["f1-score"]),
            float(eff_calib["uncalibrated"]["report"]["2"]["f1-score"]),
            float(eff_calib["uncalibrated"]["report"]["3"]["f1-score"]),
            float(eff_calib["uncalibrated"]["report"]["4"]["f1-score"]),
        ],
        "Ensemble": [
            float(ens_metrics["classification_report"]["0"]["f1-score"]),
            float(ens_metrics["classification_report"]["1"]["f1-score"]),
            float(ens_metrics["classification_report"]["2"]["f1-score"]),
            float(ens_metrics["classification_report"]["3"]["f1-score"]),
            float(ens_metrics["classification_report"]["4"]["f1-score"]),
        ],
    }

    probs_by_model = {
        "ResNet50": res_probs,
        "EfficientNet-B3": eff_probs,
        "Ensemble": ens_probs,
    }

    save_model_metrics_chart(metrics)
    save_f1_per_class_chart(class_f1)
    save_roc_chart(labels, probs_by_model)
    save_confusion_matrices(labels, probs_by_model)
    save_thresholds_chart(
        ensemble_accuracy=float(ens_metrics["classification_report"]["accuracy"]),
        ensemble_macro_f1=float(ens_metrics["classification_report"]["macro avg"]["f1-score"]),
        best_thresholds=best_thr,
    )

    print("Generated:")
    print(REPORTS_DIR / "model_comparison_metrics.png")
    print(REPORTS_DIR / "f1_per_class_3models.png")
    print(REPORTS_DIR / "roc_3models.png")
    print(REPORTS_DIR / "confusion_matrices_3models.png")
    print(REPORTS_DIR / "thresholds_optimization.png")


if __name__ == "__main__":
    main()
