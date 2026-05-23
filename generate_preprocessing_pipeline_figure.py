import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch


steps = [
    "1. Contrôle d'intégrité\ndes images",
    "2. Suppression des\nbordures noires",
    "3. Mise au format carré\n(par padding)",
    "4. Redimensionnement",
    "5. Renforcement du\ncontraste (CLAHE)",
    "6. Gestion du\ndéséquilibre",
]


def draw_pipeline(output_path: str = "preprocessing_pipeline_figure.png") -> None:
    fig, ax = plt.subplots(figsize=(18, 4.8), dpi=220)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    fig.patch.set_facecolor("white")

    box_w = 0.135
    box_h = 0.47
    x0 = 0.03
    gap = 0.027
    y = 0.28

    colors = ["#EAF4FF", "#ECFDF3", "#FFF7E8", "#F5F3FF", "#FFF1F2", "#F1F5F9"]

    for i, text in enumerate(steps):
        x = x0 + i * (box_w + gap)

        box = FancyBboxPatch(
            (x, y),
            box_w,
            box_h,
            boxstyle="round,pad=0.012,rounding_size=0.02",
            linewidth=1.8,
            edgecolor="#1F2937",
            facecolor=colors[i],
        )
        ax.add_patch(box)

        ax.text(
            x + box_w / 2,
            y + box_h / 2,
            text,
            ha="center",
            va="center",
            fontsize=11,
            color="#111827",
            fontweight="bold",
            linespacing=1.3,
        )

        if i < len(steps) - 1:
            x_start = x + box_w + 0.004
            x_end = x + box_w + gap - 0.004
            y_mid = y + box_h / 2
            ax.annotate(
                "",
                xy=(x_end, y_mid),
                xytext=(x_start, y_mid),
                arrowprops=dict(arrowstyle="-|>", lw=1.8, color="#374151"),
            )

    ax.text(
        0.5,
        0.9,
        "Pipeline de prétraitement des images rétiniennes",
        ha="center",
        va="center",
        fontsize=18,
        fontweight="bold",
        color="#0F172A",
    )

    ax.text(
        0.5,
        0.12,
        "Ordre des étapes appliquées avant l'entraînement du modèle",
        ha="center",
        va="center",
        fontsize=11,
        color="#475569",
    )

    plt.tight_layout()
    fig.savefig(output_path, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {output_path}")


if __name__ == "__main__":
    draw_pipeline()
