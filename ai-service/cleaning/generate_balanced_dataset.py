"""
Generate a balanced training CSV by augmenting minority-class images on-the-fly and
saving augmented images to disk. Default target is `max` (match the majority class).

Outputs:
 - APTOS/cleaned/train_balanced.csv
 - APTOS/cleaned/augmented/ (augmented images)

Usage: python training/generate_balanced_dataset.py
"""
import os
import argparse
from pathlib import Path
import random
import pandas as pd
from PIL import Image
from torchvision import transforms

ROOT = Path(__file__).resolve().parents[1]
CLEANED_DIR = ROOT / 'APTOS' / 'cleaned'
TRAIN_CSV = CLEANED_DIR / 'train_clean.csv'
BALANCED_CSV = CLEANED_DIR / 'train_balanced.csv'
AUG_DIR = CLEANED_DIR / 'augmented'

# PIL-based strong augmentation (suitable for saving back to disk)
def pil_strong_transform(image_size):
    return transforms.Compose([
        transforms.RandomResizedCrop(image_size, scale=(0.75, 1.0)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(30),
        transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.3, hue=0.08),
        transforms.RandomAffine(degrees=12, translate=(0.08, 0.08), scale=(0.9, 1.1)),
        transforms.Resize((image_size, image_size)),
    ])


def generate_balanced(target_strategy='max', target_count=None, seed=1, image_size=224):
    random.seed(seed)

    if not TRAIN_CSV.exists():
        raise FileNotFoundError(f"Train CSV not found: {TRAIN_CSV}")

    df = pd.read_csv(TRAIN_CSV)
    counts = df['diagnosis'].value_counts().sort_index()
    max_count = int(counts.max())
    num_classes = len(counts)

    if target_strategy == 'max':
        tgt = max_count
    elif target_strategy == 'equal':
        tgt = int(len(df) / num_classes)
    elif target_strategy == 'custom':
        assert target_count is not None and target_count > 0
        tgt = int(target_count)
    else:
        raise ValueError('Unknown target_strategy')

    print(f"Current counts: {counts.to_dict()}")
    print(f"Target per-class count: {tgt} (strategy={target_strategy})")

    AUG_DIR.mkdir(parents=True, exist_ok=True)

    transform = pil_strong_transform(image_size)

    rows = []
    # Keep all existing rows
    for _, r in df.iterrows():
        rows.append(r.to_dict())

    # For each class, augment until count == tgt
    for cls in range(num_classes):
        cls_df = df[df['diagnosis'] == cls]
        current = len(cls_df)
        need = tgt - current
        print(f"Class {cls}: current={current}, need={need}")
        if need <= 0:
            continue

        images = cls_df['processed_path'].fillna(cls_df['original_path']).tolist()
        if len(images) == 0:
            print(f"  Warning: no images for class {cls}, skipping")
            continue

        # Cycle through existing images and create augmented variants
        idx = 0
        created = 0
        while created < need:
            src = images[idx % len(images)]
            src_path = Path(src)
            if not src_path.exists():
                # try resolving relative to CLEANED_DIR
                candidate = CLEANED_DIR / src_path.name
                if candidate.exists():
                    src_path = candidate
                else:
                    idx += 1
                    continue

            try:
                img = Image.open(src_path).convert('RGB')
                aug_img = transform(img)
                aug_name = f"{src_path.stem}_aug_{created}_{cls}.png"
                aug_path = AUG_DIR / aug_name
                # aug_img is PIL (after transform.Resize), save
                aug_img.save(aug_path)

                rows.append({
                    'id_code': aug_path.stem,
                    'original_path': str(aug_path),
                    'processed_path': str(aug_path),
                    'diagnosis': int(cls)
                })

                created += 1
                idx += 1
            except Exception as e:
                print(f"  Skipping {src_path} due to error: {e}")
                idx += 1
                continue

    balanced_df = pd.DataFrame(rows)
    balanced_df.to_csv(BALANCED_CSV, index=False)
    print(f"Saved balanced CSV: {BALANCED_CSV}")

    # Print new counts
    new_counts = balanced_df['diagnosis'].value_counts().sort_index()
    print('New distribution:', new_counts.to_dict())
    return balanced_df


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--strategy', choices=['max', 'equal', 'custom'], default='max')
    parser.add_argument('--count', type=int, default=None, help='target count per class when strategy=custom')
    parser.add_argument('--image-size', type=int, default=224)
    args = parser.parse_args()

    df_bal = generate_balanced(target_strategy=args.strategy, target_count=args.count, image_size=args.image_size)
    print('\nDone.')
