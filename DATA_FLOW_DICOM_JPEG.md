# Data Flow: DICOM Upload → JPEG Preview → Doctor Display

## 1. ADMIN UPLOAD PHASE

### 1.1 File Upload
```
Admin Portal (center/new-exam.html)
    ↓
    ├─ Form: Select patient, upload .dcm file
    └─ POST /api/exams (multipart/form-data)
          │
          ├─ File saved to: backend/uploads/exams/patient_{id}/
          │                 └─ 2026-05-08_050203_left.dcm
          │
          └─ Database INSERT exams table
                ├─ id: 219
                ├─ patient_id: 55
                ├─ image_path: "uploads/exams/patient_55/2026-05-08_050203_left.dcm"
                ├─ image_preview_url: null (initially)
                └─ status: "analyzing"
```

### 1.2 Key Files Involved
- **Frontend:** `backend/public/views/center/new-exam.html`
- **Backend Route:** `backend/src/routes/exams.js` → POST `/api/exams`
- **Database:** `backend/src/config/database.js` (SQLite)
- **Storage:** `backend/uploads/exams/patient_{id}/`

---

## 2. AI ANALYSIS PHASE

### 2.1 Trigger & Processing
```
Backend Route (exams.js)
    ├─ autoAnalyzeExam(exam_id, image_path)
    │    │
    │    └─ Call ai-service (Python/FastAPI)
    │         ├─ Input: Full path to .dcm file
    │         ├─ Model: EfficientNet/ResNet (Grad-CAM)
    │         └─ Output: 
    │              ├─ grade (0-4)
    │              ├─ confidence (%)
    │              └─ heatmap (Grad-CAM visualization)
    │
    └─ Update exams table
         ├─ grade: 4
         ├─ confidence: 60.1
         ├─ heatmap_url: "/uploads/exams/patient_55/2026-05-08_050203_left_gradcam.png"
         └─ status: "analyzed"
```

### 2.2 Key Files Involved
- **Backend Service:** `backend/src/services/aiService.js`
- **AI Service:** `ai-service/main.py` (FastAPI server)
- **Grad-CAM Generator:** `ai-service/gradcam.py`
- **Output Storage:** `backend/uploads/exams/patient_{id}/*.png`

---

## 3. PREVIEW GENERATION PHASE

### 3.1 DICOM → JPEG Conversion

#### Path A: Batch Conversion (Historical)
```
Scripts/admin
    ├─ convert_dicom_to_jpeg.py (Manual batch processing)
    │    ├─ Read: .dcm file (pydicom)
    │    ├─ Extract: pixel array
    │    ├─ Process: normalize, resize (512×512)
    │    └─ Save: _preview.jpg
    │         └─ Example: 2026-05-08_050203_left_preview.jpg (11KB JPEG)
    │
    └─ Update DB: exams.image_preview_url = "uploads/exams/patient_55/2026-05-08_050203_left_preview.jpg"
```

#### Path B: On-the-Fly Conversion (On-Demand)
```
Doctor Requests Preview (via API)
    ├─ GET /api/exams/:id/preview-image
    │    │
    │    └─ Backend (server.js)
    │         ├─ Check: Does _preview.jpg exist?
    │         │    ├─ YES → sendFile(_preview.jpg) → HTTP 200 image/jpeg
    │         │    └─ NO → Proceed to on-the-fly conversion
    │         │
    │         └─ On-the-Fly (if .dcm exists)
    │              ├─ Spawn: python convert_dicom_to_jpeg.py
    │              │         {original_dcm_path} {temp_output.jpg}
    │              ├─ Timeout: 20 seconds
    │              └─ Response: JPEG bytes (Content-Type: image/jpeg)
    │
    └─ Browser receives JPEG → Render inline <img src="/api/exams/219/preview-image">
```

### 3.2 Key Files Involved
- **Conversion Script:** `backend/scripts/convert_dicom_to_jpeg.py`
- **Preview Endpoint:** `backend/src/server.js` (line 50-86)
- **Public Access:** No authentication required
- **Cache Strategy:** _preview.jpg cached on disk, _preview_tmp.jpg created on-the-fly

---

## 4. DOCTOR VIEWING PHASE

### 4.1 Exam Detail Page Load

```
Doctor Portal
    ├─ Navigate to: /doctor/exams/:id (exam-detail.html)
    │    │
    │    └─ Load exam metadata
    │         ├─ GET /api/exams/:id (authenticated)
    │         │    └─ Returns exam record + eyes data
    │         │         ├─ image_url: "/uploads/exams/patient_55/2026-05-08_050203_left.dcm"
    │         │         ├─ image_preview_url: "/uploads/exams/patient_55/2026-05-08_050203_left_preview.jpg"
    │         │         └─ heatmap_url: "/uploads/exams/patient_55/2026-05-08_050203_left_gradcam.png"
    │         │
    │         └─ Frontend (exam-detail.html)
    │              ├─ Set image_display_url = image_preview_url || `/api/exams/${id}/preview-image`
    │              ├─ Render <img src="{image_display_url}"> for inline display
    │              └─ Render <a href="{image_url}"> "Télécharger l'original" (DICOM download link)
    │
    └─ Display UI
         ├─ Original image preview (JPEG) ✓
         ├─ Grad-CAM heatmap (PNG) ✓
         ├─ AI grade & confidence ✓
         ├─ Download original button ✓
         └─ Print/PDF button ✓
```

### 4.2 Database Query Flow

```sql
-- Query exam with all details
SELECT 
  id, grade, confidence, eye_type, image_url, image_preview_url, heatmap_url,
  patient_id, created_at, doctor_report_notes
FROM exams
WHERE id = 219 AND doctor_id = 2;

-- Returns: Complete record with URLs pointing to:
--   - image_url → /uploads/exams/patient_55/2026-05-08_050203_left.dcm
--   - image_preview_url → /uploads/exams/patient_55/2026-05-08_050203_left_preview.jpg
--   - heatmap_url → /uploads/exams/patient_55/2026-05-08_050203_left_gradcam.png
```

### 4.3 Key Files Involved
- **Frontend View:** `backend/public/views/doctor/exam-detail.html`
- **API Route:** `backend/src/routes/exams.js` → GET `/api/exams/:id`
- **Display Logic:** `renderExam()` function (exam-detail.html)

---

## 5. PRINT/PDF PHASE

### 5.1 PDF Report Generation

```
Doctor clicks "Imprimer / PDF"
    ├─ JavaScript: buildPrintReport(exam, eyes, worstGrade, doctorNotes)
    │    │
    │    ├─ Extract eye images
    │    │    ├─ leftOriginal = eye.image_display_url (JPEG preview) ✓
    │    │    ├─ rightOriginal = eye.image_display_url (JPEG preview) ✓
    │    │    ├─ leftHeatmap = eye.heatmap_url (PNG) ✓
    │    │    └─ rightHeatmap = eye.heatmap_url (PNG) ✓
    │    │
    │    └─ Build HTML report with <img src="{preview_url}">
    │         ├─ Patient info
    │         ├─ AI grades & confidence
    │         ├─ Original image preview (JPEG) ← DICOM rendered as JPEG ✓
    │         ├─ Grad-CAM heatmap (PNG)
    │         ├─ Clinical recommendation
    │         └─ Doctor notes
    │
    ├─ Wait for images to load: waitForPrintImages()
    │
    └─ window.print() → Browser PDF export
         ├─ All JPEG/PNG images embedded in PDF
         └─ Output: Exam_219_Report.pdf
```

### 5.2 Key Files Involved
- **Print Handler:** `backend/public/views/doctor/exam-detail.html` (line 1159+)
- **Report Builder:** `buildPrintReport()` function (line 662+)
- **Image Loader:** `waitForPrintImages()` function (line 611+)
- **CSS for Print:** `@media print` styles in HTML

---

## 6. COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ADMIN PHASE                                │
├─────────────────────────────────────────────────────────────────────┤
│  Admin uploads .dcm → POST /api/exams → Saved to backend/uploads/  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AI ANALYSIS PHASE                            │
├─────────────────────────────────────────────────────────────────────┤
│  ai-service analyzes .dcm → Grade + Heatmap → DB update            │
│  ├─ grade: 0-4                                                      │
│  ├─ heatmap: PNG saved                                              │
│  └─ status: "analyzed"                                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PREVIEW GENERATION PHASE                          │
├─────────────────────────────────────────────────────────────────────┤
│  Path A: Batch convert .dcm → JPEG preview (convert_dicom_to_jpeg) │
│          └─ Saves: _preview.jpg (11KB cached on disk)              │
│                                                                      │
│  Path B: On-demand convert via /api/exams/:id/preview-image        │
│          └─ On-the-fly spawn Python → JPEG bytes                   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DOCTOR VIEWING PHASE                             │
├─────────────────────────────────────────────────────────────────────┤
│  Doctor: /doctor/exams/219                                          │
│  ├─ GET /api/exams/219 → Returns image_preview_url                 │
│  ├─ image_display_url = preview_url || /api/exams/219/preview-img  │
│  ├─ Render: <img src="{image_display_url}"> (JPEG inline) ✓       │
│  ├─ Download link: image_url (original .dcm)                        │
│  └─ Display: Grade, Confidence, Grad-CAM                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PRINT/PDF PHASE                                │
├─────────────────────────────────────────────────────────────────────┤
│  Doctor clicks "Imprimer / PDF"                                     │
│  ├─ buildPrintReport() uses image_display_url (JPEG) ✓            │
│  ├─ All images (JPEG + PNG) embedded in HTML report                │
│  ├─ waitForPrintImages() ensures all images loaded                 │
│  └─ window.print() → Browser native PDF export                     │
│       └─ Result: Professional PDF with all images ✓                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. FILE PATH MAPPINGS

### Storage Hierarchy
```
backend/uploads/exams/patient_55/
├── 2026-05-08_050203_left.dcm              ← Original DICOM (uploaded by admin)
├── 2026-05-08_050203_left_preview.jpg      ← JPEG preview (converted from .dcm)
├── 2026-05-08_050203_left_gradcam.png      ← Heatmap (AI output)
├── 2026-05-08_050203_right.dcm             ← Right eye DICOM
├── 2026-05-08_050203_right_preview.jpg     ← Right eye JPEG preview
└── 2026-05-08_050203_right_gradcam.png     ← Right eye Grad-CAM
```

### URL Mappings
```
Frontend → Backend Route → File System
───────────────────────────────────────

Original DICOM download:
  URL: /uploads/exams/patient_55/2026-05-08_050203_left.dcm
  FS:  backend/uploads/exams/patient_55/2026-05-08_050203_left.dcm

Preview via static serve:
  URL: /uploads/exams/patient_55/2026-05-08_050203_left_preview.jpg
  FS:  backend/uploads/exams/patient_55/2026-05-08_050203_left_preview.jpg

Preview via API endpoint (on-demand conversion):
  URL: /api/exams/219/preview-image
  FS:  → Queries DB image_path → Converts DICOM if needed → Serves JPEG

Grad-CAM heatmap:
  URL: /uploads/exams/patient_55/2026-05-08_050203_left_gradcam.png
  FS:  backend/uploads/exams/patient_55/2026-05-08_050203_left_gradcam.png
```

---

## 8. KEY CONVERSION LOGIC

### Server-Side (Node.js) - `backend/src/server.js`

```javascript
// Public endpoint: /api/exams/:id/preview-image
// ✓ No authentication required (public preview access)
// ✓ Serves JPEG with proper Content-Type header

GET /api/exams/:id/preview-image
  1. Query: SELECT image_path FROM exams WHERE id = ?
  2. Try: {path}/file_preview.jpg exists?
     └─ YES → res.sendFile(preview.jpg) + "Content-Type: image/jpeg"
     └─ NO → Proceed to on-the-fly conversion
  3. On-the-fly: Spawn python convert_dicom_to_jpeg.py
     └─ Input: /full/path/to/file.dcm
     └─ Output: /full/path/to/file_preview_tmp.jpg
     └─ Timeout: 20 seconds
     └─ res.sendFile(temp.jpg) + "Content-Type: image/jpeg"
  4. Return 404 if all paths fail
```

### Python (Conversion) - `backend/scripts/convert_dicom_to_jpeg.py`

```python
# Standalone script: Convert DICOM pixel array to JPEG
import pydicom
from PIL import Image
import sys

def convert_dicom_to_jpeg(dicom_path, output_path, size=(512, 512)):
    """
    Read DICOM file → Extract pixel array → 
    Normalize → Resize → Save as JPEG
    """
    ds = pydicom.dcmread(dicom_path)
    arr = ds.pixel_array
    
    # Normalize to 0-255
    arr = ((arr - arr.min()) * 255 / (arr.max() - arr.min())).astype(np.uint8)
    
    # Create PIL Image
    img = Image.fromarray(arr)
    
    # Resize
    img.thumbnail(size, Image.Resampling.LANCZOS)
    
    # Save as JPEG
    img.save(output_path, "JPEG", quality=85)
    print(f"Saved: {output_path}")
```

---

## 9. DATABASE SCHEMA RELEVANT FIELDS

```sql
CREATE TABLE exams (
  id INTEGER PRIMARY KEY,
  patient_id INTEGER,
  image_path TEXT,                  -- Original file path: "uploads/exams/patient_55/..."
  image_preview_url TEXT,           -- Preview URL: "/uploads/exams/patient_55/..._preview.jpg"
  grade INTEGER,                    -- AI grade (0-4)
  confidence REAL,                  -- AI confidence (%)
  heatmap_url TEXT,                 -- Grad-CAM: "/uploads/exams/patient_55/..._gradcam.png"
  doctor_report_notes TEXT,         -- Doctor's written notes (included in PDF)
  created_at TIMESTAMP,
  status TEXT                       -- "analyzing", "analyzed"
);
```

---

## 10. SUMMARY TABLE

| Phase | Component | Input | Output | Status |
|-------|-----------|-------|--------|--------|
| **Upload** | Form + POST | .dcm file | Saved file + DB record | ✅ Done |
| **Analysis** | ai-service | .dcm path | Grade + Heatmap | ✅ Done |
| **Preview** | convert_dicom_to_jpeg.py | .dcm | JPEG (11KB) | ✅ Done |
| **API** | /api/exams/:id/preview-image | exam_id | JPEG bytes | ✅ Done |
| **Display** | exam-detail.html | image_display_url | <img> inline | ✅ Done |
| **PDF** | buildPrintReport() | image_display_url | JPEG in PDF | ✅ Done |

---

## 11. TESTING CHECKLIST

- ✅ Admin uploads .dcm file → Stored in backend/uploads/
- ✅ AI analysis runs → Grade returned, heatmap saved
- ✅ Preview generated → JPEG file (_preview.jpg) exists
- ✅ GET /api/exams/219/preview-image → Returns 200 image/jpeg
- ✅ Doctor views exam → JPEG preview displays inline
- ✅ Doctor prints PDF → JPEG and Grad-CAM appear in report
- ✅ Download link works → Original .dcm downloadable

---

**Last Updated:** 2026-05-08  
**Version:** 1.0 - Complete DICOM → JPEG → PDF Flow
