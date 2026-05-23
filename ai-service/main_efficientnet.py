"""
Diabetic Retinopathy AI Microservice
Using EfficientNetB3 trained on APTOS dataset with ImageNet transfer learning
With real Grad-CAM visualization
"""

import os
import io
import json
import logging
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
import timm

# Load environment
load_dotenv()

# Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", 10 * 1024 * 1024))
ALLOWED_EXTENSIONS = os.getenv("ALLOWED_EXTENSIONS", "jpg,jpeg,png").split(",")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Model Configuration
MODEL_PATH = Path(__file__).parent / "models" / "dr_efficientnet_b3.pth"
MODEL_INFO_PATH = Path(__file__).parent / "models" / "model_info_efficientnet.json"

# Fallback to ResNet50 if EfficientNet not found
RESNET_MODEL_PATH = Path(__file__).parent / "models" / "dr_resnet50.pth"

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Standard DR Grade labels (0-4 scale)
GRADE_LABELS = {
    0: "No DR",
    1: "Mild",
    2: "Moderate", 
    3: "Severe",
    4: "Proliferative DR"
}

# Global model variables
model = None
processor = None
device = None
gradcam_extractor = None
model_type = None  # 'efficientnet_b3' or 'resnet50'
image_size = 300   # EfficientNetB3 default


class EfficientNetB3Classifier(nn.Module):
    """
    EfficientNetB3-based classifier for Diabetic Retinopathy.
    """
    def __init__(self, num_classes=5, drop_rate=0.5):
        super(EfficientNetB3Classifier, self).__init__()
        
        # Load EfficientNetB3 backbone (no pretrained for inference)
        self.backbone = timm.create_model(
            'efficientnet_b3',
            pretrained=False,
            num_classes=0,
            global_pool='avg'
        )
        
        self.num_features = self.backbone.num_features  # 1536 for B3
        
        # Custom classification head (same as training)
        self.classifier = nn.Sequential(
            nn.BatchNorm1d(self.num_features),
            nn.Dropout(drop_rate),
            nn.Linear(self.num_features, 512),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(512),
            nn.Dropout(drop_rate * 0.6),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(drop_rate * 0.4),
            nn.Linear(256, num_classes)
        )
        
    def forward(self, x):
        features = self.backbone(x)
        out = self.classifier(features)
        return out


class EfficientNetGradCAM:
    """Grad-CAM implementation for EfficientNet"""
    
    def __init__(self, model):
        self.model = model
        self.gradients = None
        self.activations = None
        self.hooks = []
        self._register_hooks()
    
    def _register_hooks(self):
        """Register forward and backward hooks on the last conv layer"""
        try:
            # Hook into conv_head (last convolutional layer of EfficientNet)
            target_layer = self.model.backbone.conv_head
            
            def forward_hook(module, input, output):
                self.activations = output.detach()
            
            def backward_hook(module, grad_input, grad_output):
                self.gradients = grad_output[0].detach()
            
            self.hooks.append(target_layer.register_forward_hook(forward_hook))
            self.hooks.append(target_layer.register_full_backward_hook(backward_hook))
            logger.info("Grad-CAM hooks registered successfully for EfficientNetB3")
        except Exception as e:
            logger.warning(f"Could not register Grad-CAM hooks: {e}")
    
    def generate(self, input_tensor, target_class):
        """Generate Grad-CAM heatmap"""
        self.model.eval()
        
        # Enable gradient computation
        input_tensor.requires_grad = True
        
        # Forward pass
        output = self.model(input_tensor)
        
        # Zero gradients
        self.model.zero_grad()
        
        # Create one-hot encoding for target class
        one_hot = torch.zeros_like(output)
        one_hot[0, target_class] = 1
        
        # Backward pass
        output.backward(gradient=one_hot, retain_graph=True)
        
        if self.gradients is None or self.activations is None:
            logger.warning("Gradients or activations are None, returning default heatmap")
            return np.ones((image_size, image_size), dtype=np.float32) * 0.5
        
        # Global average pooling of gradients
        weights = torch.mean(self.gradients, dim=[2, 3], keepdim=True)
        
        # Weighted combination of activation maps
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)
        
        # ReLU and normalize
        cam = F.relu(cam)
        cam = cam.squeeze().cpu().numpy()
        
        # Resize to input size
        cam = cv2.resize(cam, (image_size, image_size))
        
        # Normalize to [0, 1]
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        
        return cam
    
    def cleanup(self):
        """Remove hooks"""
        for hook in self.hooks:
            hook.remove()


def get_transforms(img_size=300):
    """Get preprocessing transforms for inference."""
    return transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])


def load_model():
    """Load the trained model (EfficientNetB3 or fallback to ResNet50)."""
    global model, device, gradcam_extractor, model_type, processor, image_size
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")
    
    # Try to load EfficientNetB3 first
    if MODEL_PATH.exists():
        logger.info(f"Loading EfficientNetB3 model from {MODEL_PATH}")
        
        # Create model
        model = EfficientNetB3Classifier(num_classes=5)
        
        # Load checkpoint
        checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint['model_state_dict'])
        model = model.to(device)
        model.eval()
        
        # Get image size from config
        if 'config' in checkpoint and 'image_size' in checkpoint['config']:
            image_size = checkpoint['config']['image_size']
        else:
            image_size = 300
        
        # Setup Grad-CAM
        gradcam_extractor = EfficientNetGradCAM(model)
        
        # Setup transforms
        processor = get_transforms(image_size)
        
        model_type = 'efficientnet_b3'
        logger.info(f"✓ EfficientNetB3 model loaded successfully (image_size={image_size})")
        
        # Log model info if available
        if MODEL_INFO_PATH.exists():
            with open(MODEL_INFO_PATH, 'r') as f:
                info = json.load(f)
                logger.info(f"Model accuracy: {info.get('val_accuracy', 'N/A')}%")
                logger.info(f"Model QWK: {info.get('qwk', 'N/A')}")
    
    # Fallback to ResNet50
    elif RESNET_MODEL_PATH.exists():
        logger.info(f"EfficientNetB3 not found, falling back to ResNet50")
        from main_resnet import load_custom_model
        load_custom_model()
        model_type = 'resnet50'
        image_size = 224
    
    else:
        logger.error("No trained model found! Please train a model first.")
        raise RuntimeError("No model available")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load model on startup."""
    logger.info("Starting DR Screening AI Service (EfficientNetB3)...")
    try:
        load_model()
        logger.info("Model loaded successfully!")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise
    yield
    # Cleanup
    if gradcam_extractor:
        gradcam_extractor.cleanup()
    logger.info("AI Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="DR Screening AI Service",
    description="Diabetic Retinopathy classification using EfficientNetB3 with Grad-CAM",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def preprocess_image(image: Image.Image) -> torch.Tensor:
    """Preprocess image for model input."""
    # Convert to RGB if needed
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Apply transforms
    tensor = processor(image)
    
    # Add batch dimension
    tensor = tensor.unsqueeze(0)
    
    return tensor.to(device)


def generate_heatmap_overlay(original_image: Image.Image, cam: np.ndarray) -> Image.Image:
    """Generate heatmap overlay on original image."""
    # Convert PIL to numpy
    img_array = np.array(original_image.resize((image_size, image_size)))
    
    # Create colored heatmap
    heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    
    # Blend with original
    alpha = 0.4
    blended = cv2.addWeighted(img_array, 1 - alpha, heatmap, alpha, 0)
    
    return Image.fromarray(blended)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_type": model_type,
        "image_size": image_size,
        "device": str(device),
        "gradcam_available": gradcam_extractor is not None
    }


@app.get("/model/info")
async def model_info():
    """Get model information."""
    info = {
        "model_type": model_type,
        "architecture": "EfficientNetB3" if model_type == 'efficientnet_b3' else "ResNet50",
        "input_size": image_size,
        "num_classes": 5,
        "grade_labels": GRADE_LABELS,
        "device": str(device),
        "gradcam_layer": "conv_head" if model_type == 'efficientnet_b3' else "layer4"
    }
    
    # Add training info if available
    if MODEL_INFO_PATH.exists():
        with open(MODEL_INFO_PATH, 'r') as f:
            training_info = json.load(f)
            info.update({
                "val_accuracy": training_info.get('val_accuracy'),
                "qwk": training_info.get('qwk'),
                "training_date": training_info.get('training_date')
            })
    
    return info


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    return_heatmap: bool = Query(True, description="Return Grad-CAM heatmap")
):
    """
    Predict DR grade from fundus image.
    
    Returns:
    - grade: 0-4 DR grade
    - grade_label: Human-readable grade
    - confidence: Prediction confidence percentage
    - probabilities: Per-class probabilities
    - heatmap_base64: Base64-encoded heatmap (if requested)
    """
    global model, gradcam_extractor
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    ext = file.filename.split('.')[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {ALLOWED_EXTENSIONS}"
        )
    
    try:
        # Read image
        contents = await file.read()
        if len(contents) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        image = Image.open(io.BytesIO(contents))
        
        # Preprocess
        input_tensor = preprocess_image(image)
        
        # Predict
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = F.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)
        
        grade = predicted.item()
        conf = confidence.item() * 100
        probs = probabilities[0].cpu().numpy().tolist()
        
        response = {
            "success": True,
            "grade": grade,
            "grade_label": GRADE_LABELS[grade],
            "confidence": round(conf, 2),
            "probabilities": {
                GRADE_LABELS[i]: round(p * 100, 2) 
                for i, p in enumerate(probs)
            },
            "model_type": model_type
        }
        
        # Generate Grad-CAM heatmap
        if return_heatmap and gradcam_extractor:
            try:
                # Need to recompute with gradients
                input_tensor = preprocess_image(image)
                cam = gradcam_extractor.generate(input_tensor, grade)
                
                # Create overlay
                heatmap_image = generate_heatmap_overlay(image, cam)
                
                # Convert to base64
                import base64
                buffer = io.BytesIO()
                heatmap_image.save(buffer, format='PNG')
                heatmap_base64 = base64.b64encode(buffer.getvalue()).decode()
                
                response["heatmap_base64"] = heatmap_base64
                
            except Exception as e:
                logger.warning(f"Failed to generate heatmap: {e}")
                response["heatmap_error"] = str(e)
        
        return JSONResponse(content=response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/heatmap")
async def predict_with_heatmap_image(file: UploadFile = File(...)):
    """
    Predict and return heatmap as image file.
    """
    global model, gradcam_extractor
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Preprocess
        input_tensor = preprocess_image(image)
        
        # Get prediction
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = F.softmax(outputs, dim=1)
            _, predicted = torch.max(probabilities, 1)
        
        grade = predicted.item()
        
        # Generate Grad-CAM
        input_tensor = preprocess_image(image)
        cam = gradcam_extractor.generate(input_tensor, grade)
        
        # Create overlay
        heatmap_image = generate_heatmap_overlay(image, cam)
        
        # Return as image
        buffer = io.BytesIO()
        heatmap_image.save(buffer, format='PNG')
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="image/png",
            headers={
                "X-DR-Grade": str(grade),
                "X-DR-Label": GRADE_LABELS[grade]
            }
        )
        
    except Exception as e:
        logger.error(f"Heatmap generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch/predict")
async def batch_predict(files: list[UploadFile] = File(...)):
    """
    Batch prediction for multiple images.
    """
    results = []
    
    for file in files:
        try:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            input_tensor = preprocess_image(image)
            
            with torch.no_grad():
                outputs = model(input_tensor)
                probabilities = F.softmax(outputs, dim=1)
                confidence, predicted = torch.max(probabilities, 1)
            
            results.append({
                "filename": file.filename,
                "grade": predicted.item(),
                "grade_label": GRADE_LABELS[predicted.item()],
                "confidence": round(confidence.item() * 100, 2)
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e)
            })
    
    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
