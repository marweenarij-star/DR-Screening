"""
Grad-CAM (Gradient-weighted Class Activation Mapping) Implementation
For visualizing CNN attention in diabetic retinopathy detection
"""

import numpy as np
from PIL import Image
import cv2
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class GradCAMGenerator:
    """
    Generates Grad-CAM visualizations for CNN models.
    
    Grad-CAM uses the gradients of any target concept flowing into the final 
    convolutional layer to produce a coarse localization map highlighting the 
    important regions in the image for predicting the concept.
    """
    
    def __init__(self, model, target_layer: Optional[str] = None):
        """
        Initialize Grad-CAM generator.
        
        Args:
            model: Keras model
            target_layer: Name of the target convolutional layer.
                         If None, uses the last conv layer.
        """
        import tensorflow as tf
        
        self.model = model
        self.target_layer = target_layer or self._find_target_layer()
        
        # Create gradient model
        self.grad_model = tf.keras.models.Model(
            inputs=self.model.input,
            outputs=[
                self.model.get_layer(self.target_layer).output,
                self.model.output
            ]
        )
        
        logger.info(f"Grad-CAM initialized with target layer: {self.target_layer}")
    
    def _find_target_layer(self) -> str:
        """Find the last convolutional layer in the model"""
        for layer in reversed(self.model.layers):
            if len(layer.output_shape) == 4:  # Conv layer has 4D output
                return layer.name
        raise ValueError("Could not find a convolutional layer in the model")
    
    def generate(
        self, 
        image: np.ndarray, 
        target_class: int,
        original_image: Optional[Image.Image] = None,
        alpha: float = 0.4
    ) -> Image.Image:
        """
        Generate Grad-CAM visualization with overlay.
        
        Args:
            image: Preprocessed image array (1, H, W, 3)
            target_class: Target class index (0-4)
            original_image: Original PIL image for overlay (optional)
            alpha: Overlay transparency (0-1)
            
        Returns:
            PIL Image with Grad-CAM overlay
        """
        import tensorflow as tf
        
        # Compute gradients
        with tf.GradientTape() as tape:
            conv_output, predictions = self.grad_model(image)
            class_output = predictions[:, target_class]
        
        grads = tape.gradient(class_output, conv_output)
        
        # Global average pooling of gradients
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        
        # Weight feature maps by pooled gradients
        conv_output = conv_output[0]
        heatmap = conv_output @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        
        # ReLU and normalize
        heatmap = tf.maximum(heatmap, 0) / tf.maximum(tf.reduce_max(heatmap), 1e-10)
        heatmap = heatmap.numpy()
        
        # Resize heatmap to original image size
        if original_image is not None:
            size = original_image.size
        else:
            size = (image.shape[2], image.shape[1])
        
        heatmap_resized = cv2.resize(heatmap, size)
        
        # Apply colormap
        heatmap_colored = cv2.applyColorMap(
            (heatmap_resized * 255).astype(np.uint8), 
            cv2.COLORMAP_JET
        )
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)
        
        # Overlay on original image
        if original_image is not None:
            original_array = np.array(original_image.convert("RGB").resize(size))
        else:
            original_array = (image[0] * 255).astype(np.uint8)
            original_array = cv2.resize(original_array, size)
        
        overlay = (alpha * heatmap_colored + (1 - alpha) * original_array).astype(np.uint8)
        
        return Image.fromarray(overlay)
    
    def generate_heatmap_only(
        self, 
        image: np.ndarray, 
        target_class: int,
        size: Tuple[int, int] = (512, 512)
    ) -> Image.Image:
        """
        Generate raw Grad-CAM heatmap without overlay.
        
        Args:
            image: Preprocessed image array
            target_class: Target class index
            size: Output size (width, height)
            
        Returns:
            PIL Image of colored heatmap
        """
        import tensorflow as tf
        
        with tf.GradientTape() as tape:
            conv_output, predictions = self.grad_model(image)
            class_output = predictions[:, target_class]
        
        grads = tape.gradient(class_output, conv_output)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        
        conv_output = conv_output[0]
        heatmap = conv_output @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = tf.maximum(heatmap, 0) / tf.maximum(tf.reduce_max(heatmap), 1e-10)
        heatmap = heatmap.numpy()
        
        # Resize
        heatmap_resized = cv2.resize(heatmap, size)
        
        # Apply colormap
        heatmap_colored = cv2.applyColorMap(
            (heatmap_resized * 255).astype(np.uint8), 
            cv2.COLORMAP_JET
        )
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)
        
        return Image.fromarray(heatmap_colored)
    
    def batch_generate(
        self,
        images: np.ndarray,
        target_classes: Optional[list] = None
    ) -> list:
        """
        Generate Grad-CAM for a batch of images.
        
        Args:
            images: Batch of preprocessed images (N, H, W, 3)
            target_classes: List of target classes. If None, uses predicted class.
            
        Returns:
            List of heatmap arrays
        """
        import tensorflow as tf
        
        results = []
        
        for i, image in enumerate(images):
            image_batch = np.expand_dims(image, 0)
            
            if target_classes is None:
                # Use predicted class
                pred = self.model.predict(image_batch, verbose=0)
                target_class = int(np.argmax(pred[0]))
            else:
                target_class = target_classes[i]
            
            with tf.GradientTape() as tape:
                conv_output, predictions = self.grad_model(image_batch)
                class_output = predictions[:, target_class]
            
            grads = tape.gradient(class_output, conv_output)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
            
            conv_output = conv_output[0]
            heatmap = conv_output @ pooled_grads[..., tf.newaxis]
            heatmap = tf.squeeze(heatmap)
            heatmap = tf.maximum(heatmap, 0) / tf.maximum(tf.reduce_max(heatmap), 1e-10)
            
            results.append(heatmap.numpy())
        
        return results


def create_comparison_image(
    original: Image.Image,
    heatmap: Image.Image,
    overlay: Image.Image,
    padding: int = 10
) -> Image.Image:
    """
    Create a side-by-side comparison image.
    
    Args:
        original: Original retinal image
        heatmap: Grad-CAM heatmap
        overlay: Overlay image
        padding: Padding between images
        
    Returns:
        Combined comparison image
    """
    # Ensure same size
    size = (512, 512)
    original = original.resize(size)
    heatmap = heatmap.resize(size)
    overlay = overlay.resize(size)
    
    # Create combined image
    total_width = size[0] * 3 + padding * 4
    total_height = size[1] + padding * 2
    
    combined = Image.new("RGB", (total_width, total_height), (255, 255, 255))
    
    # Paste images
    x = padding
    for img in [original, heatmap, overlay]:
        combined.paste(img, (x, padding))
        x += size[0] + padding
    
    return combined
