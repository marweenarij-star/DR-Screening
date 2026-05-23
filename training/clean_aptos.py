"""
APTOS Dataset Cleaning Script
Cleans and prepares the APTOS 2019 Blindness Detection dataset for training.

Steps:
1. Verify image integrity (remove corrupted images)
2. Apply preprocessing (crop black borders, resize, normalize)
3. Analyze class distribution
4. Create train/validation split
5. Save cleaned dataset info
"""

import os
import sys
import pandas as pd
import numpy as np
from PIL import Image
import cv2
from tqdm import tqdm
import shutil
from collections import Counter
import json
from pathlib import Path

# Configuration
APTOS_DIR = Path(r"C:\Users\DELL\diabetic-retinopathy\APTOS")
TRAIN_IMAGES_DIR = APTOS_DIR / "train_images"
TRAIN_CSV = APTOS_DIR / "train.csv"
OUTPUT_DIR = APTOS_DIR / "cleaned"
PROCESSED_DIR = OUTPUT_DIR / "processed_images"
IMAGE_SIZE = 224  # Standard size for ImageNet models

# DR Grade labels
GRADE_LABELS = {
    0: "No DR",
    1: "Mild",
    2: "Moderate",
    3: "Severe",
    4: "Proliferative DR"
}


def crop_black_borders(image):
    """
    Remove black borders from fundus images.
    Uses thresholding to find the actual retina region.
    """
    # Convert to grayscale
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image
    
    # Threshold to find non-black regions
    _, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    
    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        # Get bounding box of largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Add small padding
        padding = 5
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(image.shape[1] - x, w + 2 * padding)
        h = min(image.shape[0] - y, h + 2 * padding)
        
        # Crop
        cropped = image[y:y+h, x:x+w]
        return cropped
    
    return image


def preprocess_image(image_path, target_size=IMAGE_SIZE):
    """
    Preprocess a single fundus image:
    1. Load image
    2. Crop black borders
    3. Resize to target size
    4. Apply CLAHE for contrast enhancement
    """
    try:
        # Read image
        img = cv2.imread(str(image_path))
        if img is None:
            return None, "Failed to load"
        
        # Crop black borders
        img = crop_black_borders(img)
        
        # Make square by padding
        h, w = img.shape[:2]
        if h != w:
            size = max(h, w)
            new_img = np.zeros((size, size, 3), dtype=np.uint8)
            y_offset = (size - h) // 2
            x_offset = (size - w) // 2
            new_img[y_offset:y_offset+h, x_offset:x_offset+w] = img
            img = new_img
        
        # Resize
        img = cv2.resize(img, (target_size, target_size), interpolation=cv2.INTER_AREA)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        
        return img, None
        
    except Exception as e:
        return None, str(e)


def verify_image(image_path):
    """
    Verify that an image is valid and not corrupted.
    """
    try:
        # Try to open with PIL
        with Image.open(image_path) as img:
            img.verify()
        
        # Try to read with OpenCV
        cv_img = cv2.imread(str(image_path))
        if cv_img is None:
            return False, "OpenCV failed to read"
        
        # Check minimum size
        if cv_img.shape[0] < 50 or cv_img.shape[1] < 50:
            return False, "Image too small"
        
        return True, None
        
    except Exception as e:
        return False, str(e)


def analyze_dataset(df, images_dir):
    """
    Analyze the dataset and print statistics.
    """
    print("\n" + "=" * 60)
    print("APTOS DATASET ANALYSIS")
    print("=" * 60)
    
    # Class distribution
    print("\nClass Distribution:")
    class_counts = df['diagnosis'].value_counts().sort_index()
    total = len(df)
    
    for grade, count in class_counts.items():
        percentage = (count / total) * 100
        bar = "█" * int(percentage / 2)
        print(f"  Grade {grade} ({GRADE_LABELS[grade]:20s}): {count:5d} ({percentage:5.1f}%) {bar}")
    
    print(f"\nTotal images: {total}")
    
    # Check for missing images
    missing = []
    for idx, row in df.iterrows():
        img_path = images_dir / f"{row['id_code']}.png"
        if not img_path.exists():
            missing.append(row['id_code'])
    
    if missing:
        print(f"\n⚠️  Missing images: {len(missing)}")
    else:
        print("\n✅ All images found!")
    
    return class_counts


def clean_dataset():
    """
    Main function to clean the APTOS dataset.
    """
    print("\n" + "=" * 60)
    print("APTOS DATASET CLEANING")
    print("=" * 60)
    
    # Load labels
    print(f"\n📂 Loading labels from {TRAIN_CSV}...")
    df = pd.read_csv(TRAIN_CSV)
    print(f"   Found {len(df)} entries")
    
    # Analyze original dataset
    analyze_dataset(df, TRAIN_IMAGES_DIR)
    
    # Create output directories
    OUTPUT_DIR.mkdir(exist_ok=True)
    PROCESSED_DIR.mkdir(exist_ok=True)
    
    # Verify and preprocess images
    print("\n🔍 Verifying and preprocessing images...")
    valid_entries = []
    corrupted = []
    processed_count = 0
    
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Processing"):
        img_name = f"{row['id_code']}.png"
        img_path = TRAIN_IMAGES_DIR / img_name
        
        if not img_path.exists():
            corrupted.append((row['id_code'], "File not found"))
            continue
        
        # Verify image
        is_valid, error = verify_image(img_path)
        if not is_valid:
            corrupted.append((row['id_code'], error))
            continue
        
        # Preprocess image
        processed_img, error = preprocess_image(img_path)
        if processed_img is None:
            corrupted.append((row['id_code'], error))
            continue
        
        # Save processed image
        output_path = PROCESSED_DIR / img_name
        cv2.imwrite(str(output_path), processed_img)
        
        valid_entries.append({
            'id_code': row['id_code'],
            'diagnosis': row['diagnosis'],
            'original_path': str(img_path),
            'processed_path': str(output_path)
        })
        processed_count += 1
    
    # Create cleaned dataframe
    clean_df = pd.DataFrame(valid_entries)
    
    # Report corrupted images
    if corrupted:
        print(f"\n⚠️  Corrupted/Invalid images: {len(corrupted)}")
        corrupted_df = pd.DataFrame(corrupted, columns=['id_code', 'error'])
        corrupted_df.to_csv(OUTPUT_DIR / "corrupted_images.csv", index=False)
        print(f"   Saved to: {OUTPUT_DIR / 'corrupted_images.csv'}")
    else:
        print("\n✅ No corrupted images found!")
    
    # Split into train/validation (80/20)
    print("\n📊 Creating train/validation split (80/20)...")
    
    # Stratified split to maintain class distribution
    from sklearn.model_selection import train_test_split
    
    train_df, val_df = train_test_split(
        clean_df,
        test_size=0.2,
        stratify=clean_df['diagnosis'],
        random_state=42
    )
    
    # Save splits
    train_df.to_csv(OUTPUT_DIR / "train_clean.csv", index=False)
    val_df.to_csv(OUTPUT_DIR / "val_clean.csv", index=False)
    
    print(f"   Training set: {len(train_df)} images")
    print(f"   Validation set: {len(val_df)} images")
    
    # Analyze cleaned dataset
    print("\n" + "=" * 60)
    print("CLEANED DATASET STATISTICS")
    print("=" * 60)
    
    print("\nTraining Set Distribution:")
    for grade in range(5):
        count = len(train_df[train_df['diagnosis'] == grade])
        percentage = (count / len(train_df)) * 100
        bar = "█" * int(percentage / 2)
        print(f"  Grade {grade}: {count:5d} ({percentage:5.1f}%) {bar}")
    
    print("\nValidation Set Distribution:")
    for grade in range(5):
        count = len(val_df[val_df['diagnosis'] == grade])
        percentage = (count / len(val_df)) * 100
        bar = "█" * int(percentage / 2)
        print(f"  Grade {grade}: {count:5d} ({percentage:5.1f}%) {bar}")
    
    # Save summary
    summary = {
        "original_count": len(df),
        "cleaned_count": len(clean_df),
        "corrupted_count": len(corrupted),
        "train_count": len(train_df),
        "val_count": len(val_df),
        "image_size": IMAGE_SIZE,
        "class_distribution": {
            str(k): int(v) for k, v in clean_df['diagnosis'].value_counts().items()
        }
    }
    
    with open(OUTPUT_DIR / "cleaning_summary.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n✅ Cleaning complete!")
    print(f"   Output directory: {OUTPUT_DIR}")
    print(f"   Processed images: {PROCESSED_DIR}")
    print(f"   Train CSV: {OUTPUT_DIR / 'train_clean.csv'}")
    print(f"   Val CSV: {OUTPUT_DIR / 'val_clean.csv'}")
    
    return clean_df, train_df, val_df


if __name__ == "__main__":
    # Check if sklearn is available
    try:
        from sklearn.model_selection import train_test_split
    except ImportError:
        print("Installing scikit-learn...")
        os.system(f"{sys.executable} -m pip install scikit-learn")
        from sklearn.model_selection import train_test_split
    
    clean_df, train_df, val_df = clean_dataset()
