# Quick Reference: DICOM → JPEG Flow

## API Endpoints

### Admin Upload (POST)
```
POST /api/exams
Content-Type: multipart/form-data

Parameters:
  - patient_id: number (required)
  - eye_type: "left" | "right" (required)
  - exam_file: binary .dcm file (required)
  - center_id: number (optional)
  - notes: string (optional)

Response 201:
{
  "success": true,
  "data": {
    "id": 219,
    "image_path": "uploads/exams/patient_55/2026-05-08_050203_left.dcm",
    "status": "analyzing"
  }
}
```

### Doctor Get Exam (GET)
```
GET /api/exams/:id
Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "data": {
    "id": 219,
    "patient_id": 55,
    "grade": 4,
    "confidence": 60.1,
    "image_url": "/uploads/exams/patient_55/2026-05-08_050203_left.dcm",
    "image_preview_url": "/uploads/exams/patient_55/2026-05-08_050203_left_preview.jpg",
    "heatmap_url": "/uploads/exams/patient_55/2026-05-08_050203_left_gradcam.png",
    "status": "analyzed",
    "doctor_report_notes": null,
    "created_at": "2026-05-08T05:02:03Z"
  }
}
```

### Preview Image Endpoint (GET - No Auth)
```
GET /api/exams/:id/preview-image

Response 200 (image/jpeg):
  - If cached _preview.jpg exists: serve it
  - If .dcm exists: convert on-the-fly and serve JPEG
  - Otherwise: 404

Headers:
  Content-Type: image/jpeg
  Content-Length: 11123
  Cache-Control: public, max-age=0
```

## File Structure

### Upload Storage
```
backend/uploads/exams/patient_{patient_id}/
├── {timestamp}_left.dcm              ← Admin uploads
├── {timestamp}_left_preview.jpg       ← Generated JPEG
├── {timestamp}_left_gradcam.png       ← AI Grad-CAM heatmap
├── {timestamp}_right.dcm              ← Right eye
├── {timestamp}_right_preview.jpg
└── {timestamp}_right_gradcam.png
```

### File Naming Convention
```
Timestamp: 2026-05-08_050203 (YYYY-MM-DD_HHMMSS)
Extension: .dcm, .jpg, .png
Preview: {original_name}_preview.jpg
Heatmap: {original_name}_gradcam.png
Temp:    {original_name}_preview_tmp.jpg
```

## Database Fields

### exams table (Relevant Columns)
```sql
id                  INT PRIMARY KEY
patient_id          INT
image_path          TEXT    -- e.g., "uploads/exams/patient_55/file.dcm"
image_preview_url   TEXT    -- e.g., "/uploads/exams/patient_55/file_preview.jpg"
heatmap_url         TEXT    -- e.g., "/uploads/exams/patient_55/file_gradcam.png"
grade               INT     -- 0-4 (AI output)
confidence          REAL    -- % (AI output)
doctor_report_notes TEXT    -- Doctor's notes for PDF
status              TEXT    -- "analyzing" | "analyzed"
created_at          TIMESTAMP
```

## Code Flow Reference

### 1. Image Upload & Saving
**File:** `backend/src/routes/exams.js` → POST handler

```javascript
// Step 1: Move uploaded file to patient folder
const moveUploadToPatientFolder = async (file, examId, eyeType) => {
  // Calls: spawnSync(python, ['convert_dicom_to_jpeg.py', src, dst])
  // Creates: _preview.jpg
}

// Step 2: Save to DB
await db.insert('exams', {
  image_path: "uploads/exams/patient_55/2026-05-08_050203_left.dcm",
  image_preview_url: "/uploads/exams/patient_55/2026-05-08_050203_left_preview.jpg"
})

// Step 3: Trigger AI analysis
autoAnalyzeExam(exam_id, image_path)
```

### 2. Preview Endpoint
**File:** `backend/src/server.js` → GET /api/exams/:id/preview-image

```javascript
// Step 1: Find file candidates
const candidateOriginalBackend = path.join(__dirname, '..', rel);
const candidateOriginalProject = path.join(__dirname, '../../', rel);
const originalAbs = fs.existsSync(candidateOriginalBackend) ? 
  candidateOriginalBackend : candidateOriginalProject;

// Step 2: Check for cached preview
const previewAbsBackend = path.join(__dirname, '..', previewRel);
if (fs.existsSync(previewAbsBackend)) 
  return res.sendFile(previewAbsBackend);

// Step 3: On-the-fly conversion
const spawnSync = require('child_process').spawnSync;
const result = spawnSync(py, [script, originalAbs, tmpOut], { timeout: 20000 });
if (result.status === 0) 
  return res.sendFile(tmpOut);
```

### 3. DICOM Conversion
**File:** `backend/scripts/convert_dicom_to_jpeg.py`

```python
import pydicom
from PIL import Image
import numpy as np

def convert_dicom_to_jpeg(dicom_path, output_path, size=(512, 512)):
    # 1. Read DICOM
    ds = pydicom.dcmread(dicom_path)
    arr = ds.pixel_array
    
    # 2. Normalize to 0-255
    if arr.max() > arr.min():
        arr = ((arr - arr.min()) * 255 / (arr.max() - arr.min())).astype(np.uint8)
    
    # 3. Create PIL Image
    img = Image.fromarray(arr)
    
    # 4. Resize
    img.thumbnail(size, Image.Resampling.LANCZOS)
    
    # 5. Save JPEG
    img.save(output_path, "JPEG", quality=85)
```

### 4. Frontend Rendering
**File:** `backend/public/views/doctor/exam-detail.html`

```javascript
// Step 1: Get exam data
const exam = await API.get(`/api/exams/${examId}`);

// Step 2: Set image_display_url (preview preference)
const eyes = [{
  image_url: exam.image_url,              // Original .dcm
  image_preview_url: exam.image_preview_url || null,
  image_display_url: exam.image_preview_url || 
    `/api/exams/${exam.id}/preview-image` // Decision point
}];

// Step 3: Render inline image
document.innerHTML = `
  <img src="${eye.image_display_url}" alt="Original preview">
`;

// Step 4: Render download link
document.innerHTML = `
  <a href="${eye.image_url}">Télécharger l'original</a>
`;
```

### 5. PDF Generation
**File:** `backend/public/views/doctor/exam-detail.html`

```javascript
// Step 1: Build report HTML
const html = buildPrintReport(exam, eyes, worstGrade, doctorNotes);

// Step 2: Use image_display_url in <img> tags
return `
  <img src="${leftEye.image_display_url}" alt="OG preview">
  <img src="${leftHeatmap}" alt="OG heatmap">
`;

// Step 3: Wait for images to load
await waitForPrintImages(container);

// Step 4: Trigger browser print
window.print();
```

## Troubleshooting

### Issue: Preview returns 404
**Cause:** Path resolution failed

**Debug:**
```bash
# Check file exists
ls -la backend/uploads/exams/patient_55/

# Check server logs
# Look for: "Preview DEBUG candidates:" message
# Verify: previewAbsBackend path points to correct location
```

**Fix:**
```javascript
// Ensure BOTH path candidates are checked
const previewAbsBackend = path.join(__dirname, '..', previewRel);
const previewAbsProject = path.join(__dirname, '../../', previewRel);
if (fs.existsSync(previewAbsBackend)) return res.sendFile(previewAbsBackend);
if (fs.existsSync(previewAbsProject)) return res.sendFile(previewAbsProject);
```

### Issue: Preview takes too long (timeout)
**Cause:** On-the-fly conversion timeout or file I/O slow

**Debug:**
```bash
# Manual test conversion
python backend/scripts/convert_dicom_to_jpeg.py \
  backend/uploads/exams/patient_55/file.dcm \
  backend/uploads/exams/patient_55/file_test_preview.jpg
```

**Fix:**
- Batch pre-convert all DICOM files
- Increase timeout in server.js (currently 20 seconds)
- Use async spawnAsync instead of spawnSync for better performance

### Issue: Image doesn't display in browser
**Cause:** CORS issue or wrong URL

**Debug:**
```javascript
// Check console for CORS errors
// Check Network tab → image request URL
console.log('image_display_url:', eye.image_display_url);
```

**Fix:**
```javascript
// Ensure URL is absolute path
image_display_url = '/api/exams/219/preview-image' // ✓ Correct
image_display_url = 'api/exams/219/preview-image'  // ✗ Wrong (relative)
```

### Issue: PDF includes wrong image (still shows DICOM)
**Cause:** buildPrintReport using wrong URL

**Debug:**
```javascript
// Verify leftOriginal in buildPrintReport
console.log('leftOriginal:', leftOriginal);
// Should be: /uploads/... or /api/exams/.../preview-image
```

**Fix:**
```javascript
// Use image_display_url (with preview), not image_url (original .dcm)
const leftOriginal = leftEye?.image_display_url || leftEye?.image_url;
```

## Performance Optimization

### Cache Strategy
```
Level 1: Disk Cache (_preview.jpg)
  - Fast: Single file serve
  - Size: ~11KB per image
  - Hit rate: >95% after first conversion
  
Level 2: On-the-Fly (_preview_tmp.jpg)
  - Fallback if cache miss
  - 20-second timeout
  - Single use (not persisted)
```

### Batch Pre-Conversion
```bash
# Pre-convert all DICOMs in uploads folder
python backend/scripts/convert_dicom_to_jpeg.py \
  backend/uploads/exams/patient_55/ \
  --batch
```

## Key Metrics

| Metric | Value | Note |
|--------|-------|------|
| DICOM File Size | ~500 KB | Compressed medical data |
| JPEG Preview Size | ~11 KB | 512×512 normalized |
| Conversion Time | ~2-5 sec | Per file |
| Preview Endpoint Latency | <100ms (cached) | <5s (on-the-fly) |
| API Response Time | <50ms | DB query only |
| PDF Generation | <2 sec | With 2 images |

## References

- **DICOM Library:** pydicom (https://pydicom.readthedocs.io/)
- **Image Processing:** PIL/Pillow (https://python-pillow.org/)
- **Node.js File Serve:** Express.sendFile()
- **PDF Export:** Browser native (window.print())
- **AI Model:** EfficientNet/ResNet with Grad-CAM
