# DICOM → JPEG Flow Diagram (Mermaid)

## Complete Data Flow - Admin to Doctor

```mermaid
graph TD
    A["👨‍💼 ADMIN<br/>Upload .dcm"] -->|POST /api/exams<br/>multipart/form-data| B["📁 FILE SYSTEM<br/>backend/uploads/exams/patient_55/"]
    
    B -->|Stored| C["📄 DICOM FILE<br/>2026-05-08_050203_left.dcm<br/>~500KB"]
    
    C -->|image_path| D["🗄️ DATABASE<br/>exams table<br/>INSERT"]
    
    D -->|id: 219<br/>status: analyzing| E["🤖 AI SERVICE<br/>FastAPI<br/>EfficientNet/ResNet"]
    
    E -->|pixel_array +<br/>Grad-CAM| F["🎨 OUTPUTS SAVED"]
    
    F -->|Grade + Conf.| D
    F -->|Heatmap PNG| C
    
    D -->|image_path| G["🔄 PREVIEW GENERATION"]
    
    G -->|Batch or<br/>On-Demand| H["🐍 convert_dicom_to_jpeg.py"]
    
    H -->|pydicom +<br/>PIL| I["🖼️ JPEG PREVIEW<br/>2026-05-08_050203_left<br/>_preview.jpg<br/>~11KB"]
    
    I -->|_preview_url| D
    
    J["👨‍⚕️ DOCTOR<br/>View /doctor/exams/219"] -->|GET /api/exams/219| D
    
    D -->|image_url<br/>image_preview_url<br/>heatmap_url| K["🌐 FRONTEND JS<br/>exam-detail.html<br/>renderExam()"]
    
    K -->|image_display_url =<br/>preview_url || API| L["📺 BROWSER<br/>DISPLAY"]
    
    L -->|&lt;img src=&quot;/api/exams/219/preview-image&quot;&gt;| M["✅ JPEG INLINE<br/>Doctor sees preview"]
    
    L -->|&lt;a href=&quot;/uploads/...dcm&quot;&gt;| N["📥 DOWNLOAD LINK<br/>Original .dcm available"]
    
    J -->|Print/PDF| O["📄 buildPrintReport()"]
    
    O -->|Use image_display_url| P["🖨️ BROWSER PRINT"]
    
    P -->|JPEG + PNG<br/>embedded| Q["📋 PDF REPORT<br/>All images included"]
    
    style A fill:#e1f5ff
    style B fill:#fff3e0
    style C fill:#f3e5f5
    style D fill:#e8f5e9
    style E fill:#fce4ec
    style F fill:#f3e5f5
    style G fill:#fff3e0
    style H fill:#e0f2f1
    style I fill:#fff9c4
    style J fill:#e1f5ff
    style K fill:#f1f8e9
    style L fill:#e0f2f1
    style M fill:#c8e6c9
    style N fill:#bbdefb
    style O fill:#ffccbc
    style P fill:#fff9c4
    style Q fill:#c8e6c9
```

## Conversion Process Detail

```mermaid
graph LR
    subgraph Upload["1️⃣ UPLOAD"]
        A1["Admin Form"]
        A2["File Input: .dcm"]
        A1 --> A2
    end
    
    subgraph Transfer["2️⃣ TRANSFER"]
        B1["POST /api/exams"]
        B2["multipart/form-data"]
        B1 --> B2
    end
    
    subgraph Save["3️⃣ SAVE"]
        C1["backend/uploads/exams/patient_55/"]
        C2["2026-05-08_050203_left.dcm"]
        C1 --> C2
    end
    
    subgraph Analysis["4️⃣ AI ANALYSIS"]
        D1["ai-service reads .dcm"]
        D2["Model inference"]
        D3["Grad-CAM generation"]
        D1 --> D2 --> D3
    end
    
    subgraph Convert["5️⃣ DICOM→JPEG"]
        E1["convert_dicom_to_jpeg.py"]
        E2["pydicom.dcmread"]
        E3["Extract pixel_array"]
        E4["Normalize 0-255"]
        E5["PIL.Image resize"]
        E6["Save JPEG quality=85"]
        E1 --> E2 --> E3 --> E4 --> E5 --> E6
    end
    
    subgraph Store["6️⃣ CACHE PREVIEW"]
        F1["_preview.jpg<br/>~11KB"]
        F2["Update DB:<br/>image_preview_url"]
        F1 --> F2
    end
    
    subgraph Serve["7️⃣ SERVE"]
        G1["/api/exams/:id/preview-image"]
        G2["Content-Type: image/jpeg"]
        G1 --> G2
    end
    
    subgraph Display["8️⃣ DISPLAY"]
        H1["&lt;img src=...&gt;"]
        H2["Browser renders"]
        H3["Doctor sees JPEG"]
        H1 --> H2 --> H3
    end
    
    subgraph PDF["9️⃣ PDF"]
        I1["buildPrintReport()"]
        I2["Embed JPEG in HTML"]
        I3["window.print()"]
        I4["PDF with images"]
        I1 --> I2 --> I3 --> I4
    end
    
    Upload --> Transfer --> Save --> Analysis --> Convert --> Store --> Serve --> Display --> PDF
    
    style Upload fill:#e3f2fd
    style Transfer fill:#f3e5f5
    style Save fill:#fff3e0
    style Analysis fill:#fce4ec
    style Convert fill:#e0f2f1
    style Store fill:#f1f8e9
    style Serve fill:#ffe0b2
    style Display fill:#c8e6c9
    style PDF fill:#bbdefb
```

## Database → Frontend → View

```mermaid
graph TD
    DB["🗄️ EXAMS TABLE<br/>id=219"]
    
    DB --> F1["image_url<br/>/uploads/exams/.../file.dcm"]
    DB --> F2["image_preview_url<br/>/uploads/exams/.../file_preview.jpg"]
    DB --> F3["heatmap_url<br/>/uploads/exams/.../file_gradcam.png"]
    
    F1 --> R1["DOCTOR EXAM DETAIL PAGE"]
    F2 --> R1
    F3 --> R1
    
    R1 --> R2["renderExam() function"]
    
    R2 -->|image_display_url =<br/>image_preview_url ||<br/>/api/exams/219/preview-image| R3["image_display_url DECIDED"]
    
    R3 --> V1["&lt;img src='image_display_url'&gt;<br/>← JPEG PREVIEW DISPLAYS"]
    R3 --> V2["&lt;a href='image_url'&gt;<br/>← DOWNLOAD DICOM LINK"]
    R3 --> V3["&lt;img src='heatmap_url'&gt;<br/>← GRAD-CAM HEATMAP"]
    
    V1 --> PRINT["buildPrintReport()<br/>for PDF"]
    V3 --> PRINT
    
    PRINT --> PDF["PDF Generated<br/>with JPEG + Heatmap"]
    
    style DB fill:#e8f5e9
    style F1 fill:#fff3e0
    style F2 fill:#fff9c4
    style F3 fill:#ffe0b2
    style R1 fill:#e3f2fd
    style R2 fill:#f3e5f5
    style R3 fill:#c8e6c9
    style V1 fill:#bbdefb
    style V2 fill:#b3e5fc
    style V3 fill:#81c784
    style PRINT fill:#ffcc80
    style PDF fill:#a5d6a7
```

## File Path Resolution

```mermaid
graph TD
    DBPATH["DB: image_path<br/>uploads/exams/patient_55/2026-05-08_050203_left.dcm"]
    
    DBPATH --> CHECK1{"Path exists in<br/>backend/uploads/?"}
    
    CHECK1 -->|YES| PATHB["Use backend-relative<br/>Path: backend/uploads/exams/..."]
    CHECK1 -->|NO| CHECK2{"Path exists in<br/>project-root/uploads/?"}
    
    CHECK2 -->|YES| PATHP["Use project-relative<br/>Path: uploads/exams/..."]
    CHECK2 -->|NO| NOTFOUND["Path not found"]
    
    PATHB --> CHECKPREV{"Check for<br/>_preview.jpg?"}
    PATHP --> CHECKPREV
    
    CHECKPREV -->|YES| SERVE["Serve cached<br/>_preview.jpg"]
    CHECKPREV -->|NO| ONTHEFLY["On-the-fly<br/>conversion:<br/>spawn python"]
    
    ONTHEFLY --> CONVERT["convert_dicom_to_jpeg.py"]
    
    CONVERT --> OUTPUT["_preview_tmp.jpg<br/>created"]
    
    OUTPUT --> RETURN["Return JPEG<br/>Content-Type: image/jpeg"]
    
    SERVE --> RETURN
    RETURN --> BROWSER["Browser receives<br/>JPEG bytes"]
    
    style DBPATH fill:#fff3e0
    style CHECK1 fill:#f3e5f5
    style PATHB fill:#e0f2f1
    style CHECK2 fill:#f3e5f5
    style PATHP fill:#e0f2f1
    style NOTFOUND fill:#ffcdd2
    style CHECKPREV fill:#f3e5f5
    style SERVE fill:#c8e6c9
    style ONTHEFLY fill:#fff9c4
    style CONVERT fill:#e0f2f1
    style OUTPUT fill:#fff9c4
    style RETURN fill:#c8e6c9
    style BROWSER fill:#bbdefb
```

## API Call Sequence

```mermaid
sequenceDiagram
    actor Doctor
    participant Browser
    participant Backend
    participant DB
    participant FileSystem
    
    Doctor->>Browser: 1. Navigate /doctor/exams/219
    Browser->>Backend: 2. GET /api/exams/219
    Backend->>DB: 3. SELECT * FROM exams WHERE id=219
    DB-->>Backend: 4. Return exam record
    Backend-->>Browser: 5. JSON: {id, grade, image_url, image_preview_url, heatmap_url}
    
    Browser->>Browser: 6. renderExam() sets image_display_url
    
    Note over Browser: image_display_url = image_preview_url ||<br/>/api/exams/219/preview-image
    
    Browser->>Browser: 7. Create &lt;img src='image_display_url'&gt;
    Browser->>Backend: 8a. GET /api/exams/219/preview-image (if needed)
    Backend->>DB: 8b. SELECT image_path FROM exams WHERE id=219
    DB-->>Backend: 8c. Return: uploads/exams/patient_55/...dcm
    Backend->>FileSystem: 8d. Check _preview.jpg or convert .dcm
    FileSystem-->>Backend: 8e. _preview.jpg found OR generated
    Backend-->>Browser: 9. Response: JPEG bytes (Content-Type: image/jpeg)
    Browser->>Browser: 10. &lt;img&gt; renders JPEG inline
    Doctor-->>Browser: 11. Sees preview image ✓
    
    Doctor->>Browser: 12. Click "Imprimer/PDF"
    Browser->>Browser: 13. buildPrintReport() → HTML with &lt;img src=image_display_url&gt;
    Browser->>Browser: 14. waitForPrintImages() → ensure all loaded
    Browser->>Browser: 15. window.print() → Browser native PDF
    Browser-->>Doctor: 16. PDF with JPEG + Grad-CAM ✓
```
