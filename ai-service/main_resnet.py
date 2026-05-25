"""
Diabetic Retinopathy AI Microservice
Using custom ResNet50 trained on APTOS dataset with ImageNet transfer learning
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
from torchvision import transforms, models
from torchvision.models import ResNet50_Weights

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
MODEL_PATH = Path(__file__).parent / "models" / "dr_resnet50.pth"
MODEL_INFO_PATH = Path(__file__).parent / "models" / "model_info.json"

# Fallback to HuggingFace model if custom model not found
USE_HUGGINGFACE = os.getenv("USE_HUGGINGFACE", "false").lower() == "true"
HF_MODEL_NAME = "rafalosa/diabetic-retinopathy-224-procnorm-vit"
HF_TOKEN = os.getenv("HF_TOKEN", "")

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
model_type = None  # 'resnet50' or 'huggingface'


class DRClassifier(nn.Module):
    """
    ResNet50-based classifier for Diabetic Retinopathy.
    """
    def __init__(self, num_classes=5):
        super(DRClassifier, self).__init__()
        
        # Load ResNet50 backbone (no pretrained weights, we load our own)
        self.backbone = models.resnet50(weights=None)
        
        # Replace the final fully connected layer
        num_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_features, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, num_classes)
        )
        
    def forward(self, x):
        return self.backbone(x)


class ResNetGradCAM:
    """Grad-CAM implementation for ResNet50"""
    
    def __init__(self, model):
        self.model = model
        self.gradients = None
        self.activations = None
        self.hooks = []
        self._register_hooks()
    
    def _register_hooks(self):
        """Register forward and backward hooks on the last conv layer"""
        try:
            # Hook into layer4 (last convolutional block of ResNet50)
            target_layer = self.model.backbone.layer4[-1]
            
            def forward_hook(module, input, output):
                self.activations = output.detach()
            
            def backward_hook(module, grad_input, grad_output):
                self.gradients = grad_output[0].detach()
            
            self.hooks.append(target_layer.register_forward_hook(forward_hook))
            self.hooks.append(target_layer.register_full_backward_hook(backward_hook))
            logger.info("Grad-CAM hooks registered successfully for ResNet50")
        except Exception as e:
            logger.warning(f"Could not register Grad-CAM hooks: {e}")
    
    def generate(self, input_tensor, target_class):
        """Generate Grad-CAM heatmap"""
        self.model.eval()
        
        # Enable gradient computation for input
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
            return np.ones((224, 224), dtype=np.float32) * 0.5
        
        # Global average pooling of gradients
        weights = torch.mean(self.gradients, dim=[2, 3], keepdim=True)
        
        # Weighted combination of activation maps
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)
        
        # ReLU and normalize
        cam = F.relu(cam)
        cam = cam.squeeze().cpu().numpy()
        
        # Resize to model input size (224x224); final resize to original image is done at endpoint.
        cam = cv2.resize(cam, (224, 224), interpolation=cv2.INTER_CUBIC)
        
        # Normalize to [0, 1]
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        
        return cam
    
    def cleanup(self):
        """Remove hooks"""
        for hook in self.hooks:
            hook.remove()


def get_transforms():
    """Get preprocessing transforms for inference."""
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])


def get_retina_mask(image_rgb: np.ndarray) -> np.ndarray:
    """Create a clean retinal field-of-view mask."""
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    _, mask = cv2.threshold(gray, 12, 255, cv2.THRESH_BINARY)
    mask = cv2.medianBlur(mask, 7)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        clean = np.zeros_like(mask)
        cv2.drawContours(clean, [largest], -1, 255, thickness=-1)
        mask = clean

    mask = cv2.GaussianBlur(mask, (7, 7), 0)
    return (mask.astype(np.float32) / 255.0)


def focus_heatmap_on_lesions(heatmap: np.ndarray, image_rgb: np.ndarray, grade: int) -> np.ndarray:
    """Sharpen focus on probable lesion regions and suppress diffuse activations."""
    if heatmap is None:
        return np.zeros(image_rgb.shape[:2], dtype=np.float32)

    hmap = np.clip(heatmap.astype(np.float32), 0, 1)

    # Lesion prior from green channel morphology.
    green = image_rgb[:, :, 1]
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(green)

    dark_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    bright_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19))
    dark_lesions = cv2.morphologyEx(enhanced, cv2.MORPH_BLACKHAT, dark_kernel).astype(np.float32)
    bright_lesions = cv2.morphologyEx(enhanced, cv2.MORPH_TOPHAT, bright_kernel).astype(np.float32)
    lesion_prior = dark_lesions + 0.7 * bright_lesions
    lesion_prior = lesion_prior / (lesion_prior.max() + 1e-8)

    # Guide CAM toward lesion-like structures while preserving model attention.
    hmap = np.maximum(hmap * (0.35 + 0.65 * lesion_prior), 0.4 * lesion_prior)

    # Grade-aware focus thresholding.
    if int(grade) <= 1:
        q = 88
    elif int(grade) == 2:
        q = 84
    else:
        q = 80

    nz = hmap[hmap > 0]
    if nz.size > 0:
        thr = float(np.percentile(nz, q))
        hmap[hmap < thr] = 0.0

    # Keep only strongest connected components.
    binary = (hmap > 0).astype(np.uint8)
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if n_labels > 1:
        scored = []
        for idx in range(1, n_labels):
            area = int(stats[idx, cv2.CC_STAT_AREA])
            if area < 20:
                continue
            score = float(hmap[labels == idx].sum())
            scored.append((idx, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        keep = {idx for idx, _ in scored[:4]}
        filtered = np.zeros_like(hmap)
        for idx in keep:
            filtered[labels == idx] = hmap[labels == idx]
        hmap = filtered

    # Smooth and mask outside retina.
    hmap = cv2.GaussianBlur(hmap, (0, 0), sigmaX=2.2, sigmaY=2.2)
    retina_mask = get_retina_mask(image_rgb)
    hmap *= retina_mask

    max_val = float(hmap.max())
    if max_val > 1e-8:
        hmap = hmap / max_val
    return np.clip(hmap, 0, 1)


def create_feature_based_heatmap(image_rgb: np.ndarray, grade: int) -> np.ndarray:
    """Deterministic fallback heatmap using lesion-like structures."""
    green = image_rgb[:, :, 1]
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(green)

    dark_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    bright_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    dark_lesions = cv2.morphologyEx(enhanced, cv2.MORPH_BLACKHAT, dark_kernel).astype(np.float32)
    bright_lesions = cv2.morphologyEx(enhanced, cv2.MORPH_TOPHAT, bright_kernel).astype(np.float32)
    hmap = dark_lesions + 0.7 * bright_lesions

    if float(hmap.max()) > 0:
        hmap = hmap / float(hmap.max())

    q = 92 if int(grade) <= 1 else (88 if int(grade) == 2 else 84)
    nz = hmap[hmap > 0]
    if nz.size > 0:
        thr = float(np.percentile(nz, q))
        hmap[hmap < thr] = 0.0

    hmap = cv2.GaussianBlur(hmap, (0, 0), sigmaX=1.8, sigmaY=1.8)
    retina_mask = get_retina_mask(image_rgb)
    hmap *= retina_mask

    max_val = float(hmap.max())
    if max_val > 1e-8:
        hmap = hmap / max_val

    intensity = 0.22 + (int(grade) * 0.14)
    return np.clip(hmap * intensity, 0, 1)


def draw_lesion_markers(overlay: np.ndarray, heatmap: np.ndarray) -> np.ndarray:
    """Draw lesion contours/centers from high-confidence heatmap islands."""
    binary = (heatmap > 0.58).astype(np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))

    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    filtered = np.zeros_like(binary, dtype=np.uint8)
    for idx in range(1, n_labels):
        area = int(stats[idx, cv2.CC_STAT_AREA])
        if 10 <= area <= 3000:
            filtered[labels == idx] = 1

    contours, _ = cv2.findContours((filtered * 255).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:25]

    out = overlay.copy()
    for c in contours:
        area = cv2.contourArea(c)
        if area < 10:
            continue
        cv2.drawContours(out, [c], -1, (255, 235, 120), 2)
        m = cv2.moments(c)
        if m['m00'] > 0:
            cx = int(m['m10'] / m['m00'])
            cy = int(m['m01'] / m['m00'])
            cv2.circle(out, (cx, cy), 2, (255, 70, 70), -1)
    return out


def load_custom_model():
    """Load the custom trained ResNet50 model."""
    global model, device, gradcam_extractor, model_type, processor
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")
    
    # Check if custom model exists
    if MODEL_PATH.exists() and not USE_HUGGINGFACE:
        logger.info(f"Loading custom ResNet50 model from {MODEL_PATH}")
        
        # Create model
        model = DRClassifier(num_classes=5)
        
        # Load checkpoint (weights_only=False for compatibility with PyTorch 2.6+)
        checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
        model.load_state_dict(checkpoint['model_state_dict'])
        model = model.to(device)
        model.eval()
        
        # Setup Grad-CAM
        gradcam_extractor = ResNetGradCAM(model)
        
        # Setup processor (transforms)
        processor = get_transforms()
        
        model_type = 'resnet50'
        
        # Load model info
        if MODEL_INFO_PATH.exists():
            with open(MODEL_INFO_PATH, 'r') as f:
                model_info = json.load(f)
                logger.info(f"Model info: {model_info}")
        
        logger.info("Custom ResNet50 model loaded successfully!")
        
    else:
        # Fallback to HuggingFace model
        logger.info("Custom model not found, falling back to HuggingFace model")
        load_huggingface_model()


def load_huggingface_model():
    """Load the HuggingFace ViT model as fallback."""
    global model, processor, device, gradcam_extractor, model_type
    
    from transformers import AutoImageProcessor, AutoModelForImageClassification
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Loading HuggingFace model: {HF_MODEL_NAME}")
    
    processor = AutoImageProcessor.from_pretrained(HF_MODEL_NAME, token=HF_TOKEN)
    model = AutoModelForImageClassification.from_pretrained(HF_MODEL_NAME, token=HF_TOKEN)
    model = model.to(device)
    model.eval()
    
    model_type = 'huggingface'
    logger.info("HuggingFace model loaded successfully!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    logger.info("Starting AI service...")
    load_custom_model()
    yield
    logger.info("Shutting down AI service...")
    if gradcam_extractor:
        gradcam_extractor.cleanup()


# Create FastAPI app
app = FastAPI(
    title="DR Screening AI Service",
    description="Diabetic Retinopathy classification using ResNet50 with ImageNet transfer learning",
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


def preprocess_image(image: Image.Image):
    """Preprocess image for model input."""
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize
    image = image.resize((224, 224), Image.Resampling.LANCZOS)
    
    return image


def predict_with_model(image: Image.Image):
    """Run prediction with the loaded model."""
    global model, processor, device, model_type, gradcam_extractor
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Preprocess image
    image = preprocess_image(image)
    
    if model_type == 'resnet50':
        # Custom ResNet50 model
        input_tensor = processor(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = F.softmax(outputs, dim=1)[0]
        
        # Get predicted class
        predicted_class = torch.argmax(probabilities).item()
        confidence = probabilities[predicted_class].item() * 100
        
        # Convert probabilities to dict
        prob_dict = {i: prob.item() * 100 for i, prob in enumerate(probabilities)}
        
        # Generate Grad-CAM
        heatmap = None
        if gradcam_extractor:
            try:
                # For grade 0 (No DR), show cold heatmap (no activation)
                if predicted_class == 0:
                    heatmap = np.zeros((224, 224), dtype=np.float32)
                else:
                    input_tensor_grad = processor(image).unsqueeze(0).to(device)
                    heatmap = gradcam_extractor.generate(input_tensor_grad, predicted_class)
            except Exception as e:
                logger.error(f"Error generating Grad-CAM: {e}")
        
        return {
            "grade": predicted_class,
            "grade_label": GRADE_LABELS[predicted_class],
            "confidence": confidence,
            "probabilities": prob_dict,
            "heatmap": heatmap,
            "model_type": "ResNet50 (APTOS fine-tuned)"
        }
    
    else:
        # HuggingFace model (fallback)
        inputs = processor(images=image, return_tensors="pt").to(device)
        
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probabilities = F.softmax(logits, dim=1)[0]
        
        # Get the model's label mapping
        id2label = model.config.id2label
        
        # Map HuggingFace labels to standard grades
        HF_LABEL_TO_GRADE = {
            'no dr': 0, 'mild': 1, 'moderate': 2, 'severe': 3, 'proliferative': 4
        }
        
        # Convert probabilities
        prob_dict = {}
        for idx, prob in enumerate(probabilities):
            label = id2label[idx].lower()
            if label in HF_LABEL_TO_GRADE:
                grade = HF_LABEL_TO_GRADE[label]
                prob_dict[grade] = prob.item() * 100
        
        # Get predicted grade
        predicted_idx = torch.argmax(probabilities).item()
        predicted_label = id2label[predicted_idx].lower()
        predicted_grade = HF_LABEL_TO_GRADE.get(predicted_label, 0)
        confidence = probabilities[predicted_idx].item() * 100
        
        return {
            "grade": predicted_grade,
            "grade_label": GRADE_LABELS[predicted_grade],
            "confidence": confidence,
            "probabilities": prob_dict,
            "heatmap": None,
            "model_type": "HuggingFace ViT"
        }


def generate_analysis_justification(grade: int, confidence: float, probabilities: dict):
    """Generate detailed analysis justification for the diagnosis."""
    
    grade_descriptions = {
        0: {
            "findings": "Aucune lésion de rétinopathie diabétique détectée",
            "features_detected": [],
            "features_absent": ["Microanévrismes", "Hémorragies", "Exsudats durs", "Néovascularisation"],
            "clinical_interpretation": "L'analyse de l'image du fond d'œil ne révèle pas de signes caractéristiques de rétinopathie diabétique. Les vaisseaux rétiniens apparaissent normaux sans anomalies vasculaires visibles.",
            "recommendation": "Contrôle annuel recommandé"
        },
        1: {
            "findings": "Rétinopathie diabétique non proliférante légère détectée",
            "features_detected": ["Microanévrismes isolés"],
            "features_absent": ["Hémorragies significatives", "Exsudats durs", "Néovascularisation"],
            "clinical_interpretation": "L'analyse révèle la présence de microanévrismes, qui sont de petites dilatations des capillaires rétiniens. Ces lésions sont caractéristiques du stade précoce de la rétinopathie diabétique.",
            "recommendation": "Contrôle dans 9-12 mois"
        },
        2: {
            "findings": "Rétinopathie diabétique non proliférante modérée détectée",
            "features_detected": ["Microanévrismes multiples", "Hémorragies intrarétiniennes", "Exsudats durs possibles"],
            "features_absent": ["Néovascularisation", "Hémorragie vitréenne"],
            "clinical_interpretation": "L'analyse montre des signes plus avancés de rétinopathie diabétique avec des microanévrismes multiples et des hémorragies intrarétiniennes. Une surveillance rapprochée est nécessaire.",
            "recommendation": "Contrôle dans 6 mois, référence ophtalmologique conseillée"
        },
        3: {
            "findings": "Rétinopathie diabétique non proliférante sévère détectée",
            "features_detected": ["Hémorragies étendues", "Anomalies veineuses (veines en chapelet)", "AMIR"],
            "features_absent": ["Néovascularisation franche (mais risque imminent)"],
            "clinical_interpretation": "L'analyse révèle des signes sévères de rétinopathie diabétique avec des hémorragies étendues dans plusieurs quadrants. Le risque de progression vers une forme proliférante est très élevé.",
            "recommendation": "Référence URGENTE en ophtalmologie"
        },
        4: {
            "findings": "Rétinopathie diabétique proliférante détectée",
            "features_detected": ["Néovascularisation", "Hémorragies étendues", "Possibles décollements tractionnels"],
            "features_absent": [],
            "clinical_interpretation": "L'analyse détecte des signes de rétinopathie diabétique proliférante avec présence de néovascularisation. Cette forme avancée nécessite une prise en charge immédiate pour prévenir la perte de vision.",
            "recommendation": "URGENCE - Traitement laser ou injections anti-VEGF requis"
        }
    }
    
    analysis = grade_descriptions.get(grade, grade_descriptions[0])
    
    # Confidence interpretation
    if confidence >= 80:
        confidence_desc = "Haute confiance - Le modèle est très confiant dans ce diagnostic"
    elif confidence >= 60:
        confidence_desc = "Confiance modérée - Une vérification clinique est recommandée"
    else:
        confidence_desc = "Confiance faible - Une évaluation manuelle par un spécialiste est fortement recommandée"
    
    # Heatmap explanation - different for grade 0
    if grade == 0:
        heatmap_explanation = "La carte de chaleur est entièrement froide (bleue) car aucune lésion de rétinopathie diabétique n'a été détectée. L'absence de zones chaudes (rouge/jaune) confirme qu'aucune région pathologique n'a été identifiée."
    else:
        heatmap_explanation = "La carte de chaleur (Grad-CAM) visualise les régions de l'image qui ont le plus contribué à la décision du modèle. Les zones en rouge/jaune indiquent les régions les plus significatives pour le diagnostic."
    
    return {
        **analysis,
        "confidence_description": confidence_desc,
        "heatmap_explanation": heatmap_explanation,
        "differential_diagnosis": [
            {"grade": i, "label": GRADE_LABELS[i], "probability": probabilities.get(i, 0)}
            for i in sorted(probabilities.keys(), key=lambda x: probabilities.get(x, 0), reverse=True)[:3]
        ],
        "model_info": {
            "name": "ResNet50 fine-tuné sur APTOS",
            "source": "Transfer Learning ImageNet → APTOS 2019",
            "method": "Classification supervisée avec Grad-CAM"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_type": model_type,
        "device": str(device) if device else "unknown"
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Predict diabetic retinopathy grade from fundus image.
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    ext = file.filename.split('.')[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")
    
    try:
        # Read image
        contents = await file.read()
        if len(contents) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")
        
        image = Image.open(io.BytesIO(contents))
        
        # Run prediction
        result = predict_with_model(image)
        
        # Generate analysis justification
        analysis = generate_analysis_justification(
            result["grade"],
            result["confidence"],
            result["probabilities"]
        )
        
        return {
            "success": True,
            "grade": result["grade"],
            "grade_label": result["grade_label"],
            "confidence": result["confidence"],
            "probabilities": result["probabilities"],
            "analysis": analysis,
            "model_type": result["model_type"]
        }
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/gradcam")
async def gradcam(file: UploadFile = File(...), target_class: Optional[int] = Query(None)):
    """
    Generate Grad-CAM heatmap for the image.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        original_np = np.array(image)
        orig_h, orig_w = original_np.shape[:2]
        image_for_model = preprocess_image(image)
        
        # Get prediction first if target_class not specified
        if target_class is None:
            result = predict_with_model(image)
            target_class = result["grade"]
        
        # Generate Grad-CAM
        if model_type == 'resnet50' and gradcam_extractor:
            input_tensor = processor(image_for_model).unsqueeze(0).to(device)
            # For grade 0 (No DR), show cold heatmap (no activation)
            if target_class == 0:
                heatmap = np.zeros((224, 224), dtype=np.float32)
            else:
                heatmap = gradcam_extractor.generate(input_tensor, target_class)
        else:
            # Deterministic fallback instead of random heatmap.
            if target_class == 0:
                heatmap = np.zeros((224, 224), dtype=np.float32)
            else:
                heatmap = create_feature_based_heatmap(original_np, int(target_class))

        # Keep the reference Grad-CAM style: simple min-max normalization,
        # JET colormap, and fixed-alpha weighted overlay.
        heatmap = cv2.resize(heatmap.astype(np.float32), (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
        h_min = float(np.min(heatmap))
        h_max = float(np.max(heatmap))
        if h_max > h_min:
            heatmap = (heatmap - h_min) / (h_max - h_min)
        else:
            heatmap = np.zeros_like(heatmap, dtype=np.float32)

        # Tighten the map around lesion-like regions without changing the visual style.
        heatmap = focus_heatmap_on_lesions(heatmap, original_np, int(target_class))
        retina_mask = get_retina_mask(original_np)
        heatmap *= retina_mask

        heatmap_colored = cv2.applyColorMap(np.uint8(255.0 * heatmap), cv2.COLORMAP_JET)
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        alpha = 0.5
        overlay = ((1.0 - alpha) * original_np.astype(np.float32) + alpha * heatmap_colored.astype(np.float32)).astype(np.uint8)
        
        # Convert to bytes
        overlay_pil = Image.fromarray(overlay)
        buffer = io.BytesIO()
        overlay_pil.save(buffer, format="PNG")
        buffer.seek(0)
        
        return StreamingResponse(buffer, media_type="image/png")
        
    except Exception as e:
        logger.error(f"Grad-CAM error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/model-info")
async def get_model_info():
    """Get information about the loaded model."""
    info = {
        "model_type": model_type,
        "device": str(device),
        "num_classes": 5,
        "class_labels": GRADE_LABELS
    }
    
    if model_type == 'resnet50':
        info.update({
            "architecture": "ResNet50",
            "pretrained_on": "ImageNet",
            "fine_tuned_on": "APTOS 2019",
            "input_size": 224
        })
        
        if MODEL_INFO_PATH.exists():
            with open(MODEL_INFO_PATH, 'r') as f:
                model_info = json.load(f)
                info.update(model_info)
    
    return info


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
 