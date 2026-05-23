"""Generate a grouped bar chart for per-class precision and recall.

Default values are taken from the calibrated ensemble report documented in
METRIQUES_FINALES_DETAILLEES.md.
"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


CLASS_LABELS = ["Grade 0", "Grade 1", "Grade 2", "Grade 3", "Grade 4"]
PRECISION = [0.978, 0.564, 0.818, 0.706, 0.700]
RECALL = [0.959, 0.619, 0.612, 0.667, 0.750]


def plot_precision_recall(output_path: Path) -> None:
    x = np.arange(len(CLASS_LABELS))
    width = 0.36

    plt.style.use("seaborn-v0_8-whitegrid")
    fig, ax = plt.subplots(figsize=(10, 6))

    bars_precision = ax.bar(x - width / 2, PRECISION, width, label="Precision", color="#1f77b4")
    bars_recall = ax.bar(x + width / 2, RECALL, width, label="Recall", color="#ff7f0e")

    ax.set_title("Precision et Recall par classe", fontsize=16, fontweight="bold")
    ax.set_xlabel("Classe ICDR")
    ax.set_ylabel("Score")
    ax.set_xticks(x)
    ax.set_xticklabels(CLASS_LABELS)
    ax.set_ylim(0, 1.05)
    ax.legend(frameon=True)

    ax.bar_label(bars_precision, labels=[f"{value:.3f}" for value in PRECISION], padding=3, fontsize=9)
    ax.bar_label(bars_recall, labels=[f"{value:.3f}" for value in RECALL], padding=3, fontsize=9)

    fig.tight_layout()
    fig.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    output_path = Path(__file__).with_name("precision_recall_per_class.png")
    plot_precision_recall(output_path)
    print(f"Chart saved to {output_path}")


if __name__ == "__main__":
    main()