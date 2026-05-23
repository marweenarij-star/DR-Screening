"""
Training Script for Diabetic Retinopathy Classification Model
Supports training from scratch or transfer learning with EfficientNet
"""

import os
import argparse
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
from PIL import Image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Train DR classification model")
    
    parser.add_argument(
        "--data-dir", 
        type=str, 
        required=True,
        help="Directory containing training data with subdirectories 0-4 for each grade"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="models",
        help="Directory to save trained model"
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="dr_model",
        help="Name for the saved model"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Number of training epochs"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for training"
    )
    parser.add_argument(
        "--img-size",
        type=int,
        default=224,
        help="Input image size"
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=1e-4,
        help="Initial learning rate"
    )
    parser.add_argument(
        "--validation-split",
        type=float,
        default=0.2,
        help="Fraction of data for validation"
    )
    parser.add_argument(
        "--pretrained",
        action="store_true",
        help="Use pretrained EfficientNet weights"
    )
    parser.add_argument(
        "--fine-tune",
        action="store_true",
        help="Fine-tune pretrained layers"
    )
    parser.add_argument(
        "--class-weights",
        action="store_true",
        help="Use class weights for imbalanced data"
    )
    
    return parser.parse_args()


def create_data_generators(data_dir: str, img_size: int, batch_size: int, validation_split: float):
    """Create training and validation data generators"""
    from tensorflow.keras.preprocessing.image import ImageDataGenerator
    
    # Training data augmentation
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=[0.8, 1.2],
        fill_mode='nearest',
        validation_split=validation_split
    )
    
    # Validation data (no augmentation)
    val_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=validation_split
    )
    
    train_generator = train_datagen.flow_from_directory(
        data_dir,
        target_size=(img_size, img_size),
        batch_size=batch_size,
        class_mode='categorical',
        subset='training',
        shuffle=True
    )
    
    val_generator = val_datagen.flow_from_directory(
        data_dir,
        target_size=(img_size, img_size),
        batch_size=batch_size,
        class_mode='categorical',
        subset='validation',
        shuffle=False
    )
    
    return train_generator, val_generator


def create_model(img_size: int, num_classes: int = 5, pretrained: bool = True):
    """Create EfficientNet-based model"""
    import tensorflow as tf
    from tensorflow.keras import layers, models
    from tensorflow.keras.applications import EfficientNetB0
    
    # Base model
    if pretrained:
        base_model = EfficientNetB0(
            weights='imagenet',
            include_top=False,
            input_shape=(img_size, img_size, 3)
        )
        base_model.trainable = False  # Freeze initially
    else:
        base_model = EfficientNetB0(
            weights=None,
            include_top=False,
            input_shape=(img_size, img_size, 3)
        )
    
    # Custom classification head
    model = models.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.BatchNormalization(),
        layers.Dropout(0.5),
        layers.Dense(256, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    return model


def compute_class_weights(data_dir: str) -> dict:
    """Compute class weights for imbalanced dataset"""
    from sklearn.utils.class_weight import compute_class_weight
    
    class_counts = []
    for i in range(5):
        class_dir = Path(data_dir) / str(i)
        if class_dir.exists():
            count = len(list(class_dir.glob("*")))
            class_counts.append(count)
        else:
            class_counts.append(0)
    
    total = sum(class_counts)
    weights = {}
    for i, count in enumerate(class_counts):
        if count > 0:
            weights[i] = total / (5 * count)
        else:
            weights[i] = 1.0
    
    logger.info(f"Class counts: {class_counts}")
    logger.info(f"Class weights: {weights}")
    
    return weights


def train(args):
    """Main training function"""
    import tensorflow as tf
    from tensorflow.keras.callbacks import (
        ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, TensorBoard
    )
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Log directory for TensorBoard
    log_dir = output_dir / "logs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    
    logger.info("Creating data generators...")
    train_gen, val_gen = create_data_generators(
        args.data_dir, 
        args.img_size, 
        args.batch_size, 
        args.validation_split
    )
    
    logger.info(f"Training samples: {train_gen.samples}")
    logger.info(f"Validation samples: {val_gen.samples}")
    
    # Class weights
    class_weights = None
    if args.class_weights:
        class_weights = compute_class_weights(args.data_dir)
    
    logger.info("Creating model...")
    model = create_model(args.img_size, pretrained=args.pretrained)
    
    # Compile
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.learning_rate),
        loss='categorical_crossentropy',
        metrics=[
            'accuracy',
            tf.keras.metrics.AUC(name='auc'),
            tf.keras.metrics.Precision(name='precision'),
            tf.keras.metrics.Recall(name='recall')
        ]
    )
    
    model.summary()
    
    # Callbacks
    callbacks = [
        ModelCheckpoint(
            str(output_dir / f"{args.model_name}_best.h5"),
            monitor='val_auc',
            mode='max',
            save_best_only=True,
            verbose=1
        ),
        EarlyStopping(
            monitor='val_auc',
            mode='max',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-7,
            verbose=1
        ),
        TensorBoard(
            log_dir=str(log_dir),
            histogram_freq=1
        )
    ]
    
    logger.info("Starting training...")
    history = model.fit(
        train_gen,
        epochs=args.epochs,
        validation_data=val_gen,
        callbacks=callbacks,
        class_weight=class_weights,
        verbose=1
    )
    
    # Fine-tuning phase
    if args.pretrained and args.fine_tune:
        logger.info("Starting fine-tuning phase...")
        
        # Unfreeze base model
        model.layers[0].trainable = True
        
        # Recompile with lower learning rate
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=args.learning_rate / 10),
            loss='categorical_crossentropy',
            metrics=[
                'accuracy',
                tf.keras.metrics.AUC(name='auc'),
                tf.keras.metrics.Precision(name='precision'),
                tf.keras.metrics.Recall(name='recall')
            ]
        )
        
        # Continue training
        history_fine = model.fit(
            train_gen,
            epochs=args.epochs // 2,
            validation_data=val_gen,
            callbacks=callbacks,
            class_weight=class_weights,
            verbose=1
        )
    
    # Save final model
    final_path = output_dir / f"{args.model_name}.h5"
    model.save(str(final_path))
    logger.info(f"Model saved to {final_path}")
    
    # Evaluate
    logger.info("Evaluating model...")
    results = model.evaluate(val_gen, verbose=1)
    
    metrics = dict(zip(model.metrics_names, results))
    logger.info(f"Final metrics: {metrics}")
    
    # Save metrics
    with open(output_dir / f"{args.model_name}_metrics.txt", "w") as f:
        for name, value in metrics.items():
            f.write(f"{name}: {value:.4f}\n")
    
    return model, history


def evaluate_model(model_path: str, data_dir: str, img_size: int = 224):
    """Evaluate a trained model"""
    import tensorflow as tf
    from sklearn.metrics import classification_report, confusion_matrix
    import matplotlib.pyplot as plt
    import seaborn as sns
    
    logger.info(f"Loading model from {model_path}")
    model = tf.keras.models.load_model(model_path)
    
    # Create validation generator
    datagen = tf.keras.preprocessing.image.ImageDataGenerator(rescale=1./255)
    generator = datagen.flow_from_directory(
        data_dir,
        target_size=(img_size, img_size),
        batch_size=32,
        class_mode='categorical',
        shuffle=False
    )
    
    # Predict
    predictions = model.predict(generator, verbose=1)
    y_pred = np.argmax(predictions, axis=1)
    y_true = generator.classes
    
    # Classification report
    class_names = ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4']
    report = classification_report(y_true, y_pred, target_names=class_names)
    print("\nClassification Report:")
    print(report)
    
    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=class_names, yticklabels=class_names)
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.title('Confusion Matrix')
    plt.savefig('confusion_matrix.png', dpi=150, bbox_inches='tight')
    plt.close()
    
    logger.info("Confusion matrix saved to confusion_matrix.png")


if __name__ == "__main__":
    args = parse_args()
    
    # Check TensorFlow GPU
    import tensorflow as tf
    gpus = tf.config.list_physical_devices('GPU')
    logger.info(f"GPUs available: {len(gpus)}")
    if gpus:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    
    train(args)
