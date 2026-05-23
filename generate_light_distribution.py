from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image, ImageFilter, ImageOps


INPUT_IMAGE = Path(r"c:\Users\DELL\diabetic-retinopathy\backend\uploads\exams\2026\03\exam_7758e752-4d6f-4b18-bee7-c8448a7c54a7.jpeg")
OUTPUT_IMAGE = Path(r"c:\Users\DELL\diabetic-retinopathy\light_distribution.png")


def main() -> None:
    image = Image.open(INPUT_IMAGE).convert("RGB")
    resized = image.resize((768, 768), Image.Resampling.LANCZOS)

    rgb = np.asarray(resized).astype(np.float32) / 255.0
    gray = np.asarray(ImageOps.grayscale(resized)).astype(np.float32) / 255.0

    # Smooth the illumination map so the structure reflects light distribution,
    # not local texture only.
    illumination = Image.fromarray((gray * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=18))
    illum = np.asarray(illumination).astype(np.float32) / 255.0

    fig = plt.figure(figsize=(16, 6), facecolor="white")
    grid = fig.add_gridspec(2, 3, width_ratios=[1, 1, 1.1], height_ratios=[1, 0.24], wspace=0.25, hspace=0.15)

    ax1 = fig.add_subplot(grid[0, 0])
    ax2 = fig.add_subplot(grid[0, 1])
    ax3 = fig.add_subplot(grid[0, 2])
    ax4 = fig.add_subplot(grid[1, :])

    ax1.imshow(rgb)
    ax1.set_title("Image originale", fontweight="bold")
    ax1.axis("off")

    im2 = ax2.imshow(illum, cmap="inferno")
    ax2.set_title("Distribution de la lumière", fontweight="bold")
    ax2.axis("off")
    cbar2 = fig.colorbar(im2, ax=ax2, fraction=0.046, pad=0.04)
    cbar2.set_label("Intensité normalisée", rotation=90)

    ax3.imshow(rgb)
    ax3.imshow(illum, cmap="inferno", alpha=0.55)
    ax3.set_title("Superposition lumière + image", fontweight="bold")
    ax3.axis("off")

    ax4.hist(gray.ravel(), bins=60, color="#d35400", alpha=0.85, edgecolor="black")
    ax4.set_title("Histogramme de luminance", fontweight="bold")
    ax4.set_xlabel("Intensité lumineuse")
    ax4.set_ylabel("Nombre de pixels")
    ax4.grid(axis="y", alpha=0.25, linestyle="--")

    fig.suptitle("Étape de prétraitement: distribution de la lumière", fontsize=18, fontweight="bold")
    fig.text(0.5, 0.01, "La carte de chaleur met en évidence les zones plus éclairées et les zones plus sombres du fond d'œil.",
             ha="center", fontsize=11, color="#444444")

    plt.tight_layout(rect=[0, 0.04, 1, 0.93])
    fig.savefig(OUTPUT_IMAGE, dpi=300, bbox_inches="tight")
    print(f"Saved: {OUTPUT_IMAGE}")


if __name__ == "__main__":
    main()
