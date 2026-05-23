# 🏥 Architecture Complète : Intégration HL7/DICOM/PACS/RIS/MWL

**Document Architecture Hospitalière**  
*DR Screening v2.0+ - Intégration Production*  
**Date** : Mai 2026

---

## 📋 Table des Matières

1. [Workflows complets](#workflows-complets)
2. [Composants système](#composants-système)
3. [Messages HL7 détaillés](#messages-hl7-détaillés)
4. [Opérations DICOM](#opérations-dicom)
5. [Implémentation recommandée](#implémentation-recommandée)
6. [Plan de déploiement](#plan-de-déploiement)

---

## 🔄 Workflows Complets

### **Workflow 1 : Création d'examen par médecin → HL7 ORM**

```
1. Médecin crée patient + demande examen
   ↓
   POST /api/exams/request
   {
     "patient_id": "PAT-2026-001",
     "patient_name": "Jean Dupont",
     "birth_date": "1965-03-15",
     "doctor_id": "DR-002",
     "exam_type": "RETINAL_FUNDUS",
     "urgency": "R"  // R=Routine, U=Urgent, S=STAT
   }
   ↓
2. Backend génère HL7 ORM (Order Entry Message)
   ↓
3. ORM envoyé au RIS (Radiology Information System)
   ↓
4. RIS crée étude dans base
   ↓
5. RIS populate Modality Worklist (MWL)
   ↓
6. ✅ Patient apparaît dans dashboard admin
```

### **Workflow 2 : Rétinographe query MWL via C-FIND**

```
1. Rétinographe (DICOM Modality) démarre
   ↓
2. Query MWL via DICOM C-FIND
   POST C-FIND query
   {
     "QueryRetrieveLevel": "STUDY",
     "PatientID": "*",         // Tous les patients
     "PatientName": "",
     "StudyDate": "20260507",  // Aujourd'hui
     "Modality": "RF"          // Fundus = RF
   }
   ↓
3. RIS répond avec C-FIND response (liste des études)
   [
     {
       "PatientID": "PAT-2026-001",
       "PatientName": "DUPONT^JEAN",
       "StudyInstanceUID": "1.2.3.4.5.6.7",
       "StudyDate": "20260507",
       "StudyTime": "100530",
       "AccessionNumber": "ACC-2026-1234"
     }
   ]
   ↓
4. ✅ Modality affiche liste patients à examiner
```

### **Workflow 3 : Acquisition + DICOM Tags + C-STORE**

```
1. Admin sélectionne patient de la MWL
   ↓
2. Détails de l'étude appliqués localement (DICOM tags)
   {
     "PatientID": "PAT-2026-001",
     "PatientName": "DUPONT^JEAN",
     "PatientBirthDate": "19650315",
     "StudyInstanceUID": "1.2.3.4.5.6.7",
     "SeriesInstanceUID": "1.2.3.4.5.6.7.1",
     "StudyDescription": "RETINAL FUNDUS SCREENING",
     "StudyDate": "20260507",
     "AccessionNumber": "ACC-2026-1234"
   }
   ↓
3. Rétinographe capture image
   ↓
4. Image ENCODÉE en DICOM avec tags → fichier .dcm
   ├─ Pixel data (image brute)
   ├─ Patient tags
   ├─ Study tags
   ├─ Series tags
   └─ Equipment tags (rétinographe model, serial, etc.)
   ↓
5. DICOM C-STORE : Envoyer au PACS
   POST DICOM C-STORE
   Destination: pacs.hospital.local:104
   File: image_fundus.dcm
   ↓
6. ✅ PACS reçoit et archive DICOM
```

### **Workflow 4 : Transmission au système DR Screening**

```
1. PACS reçoit DICOM (C-STORE)
   ↓
2. PACS notifie backend DR Screening
   POST /api/dicom/received
   {
     "PatientID": "PAT-2026-001",
     "StudyInstanceUID": "1.2.3.4.5.6.7",
     "SeriesInstanceUID": "1.2.3.4.5.6.7.1",
     "DicomPath": "/archive/pacs/2026/05/07/study.dcm"
   }
   ↓
3. Backend DR Screening récupère DICOM depuis PACS
   ├─ DICOM C-GET ou HTTP API (DICOMweb)
   └─ Local: /uploads/dicoms/PAT-2026-001_study.dcm
   ↓
4. Backend convertit DICOM → Image RGB
   └─ Extraction pixel_array + normalisation
   ↓
5. Backend envoie au Service IA
   POST /predict
   {
     "image": <RGB_bytes>,
     "patient_id": "PAT-2026-001",
     "study_uid": "1.2.3.4.5.6.7"
   }
   ↓
6. ✅ Service IA retourne prédiction + Grad-CAM
   {
     "grade": 2,
     "confidence": 0.875,
     "gradcam_image": <bytes>
   }
```

### **Workflow 5 : Rapport HL7 ORU → Patient Record + PACS**

```
1. Médecin valide résultats IA
   POST /api/exams/validate
   {
     "exam_id": 15,
     "ai_grade": 2,
     "doctor_notes": "Microanévrysmes légers. Suivi 6 mois recommandé.",
     "clinical_grade": 2,  // Override IA si nécessaire
     "verified_at": "2026-05-07T14:30:00Z"
   }
   ↓
2. Backend génère HL7 ORU (Observation Result Message)
   ├─ Patient demographics
   ├─ Study info
   ├─ AI results (grade, confidence)
   ├─ Doctor notes
   ├─ Timestamps
   └─ Attachments (Grad-CAM image)
   ↓
3. Backend envoie ORU au RIS/HIS (Hospital Information System)
   POST HL7_RIS://<ris.hospital>:2575
   Message: ORU message
   ↓
4. RIS associe rapport au dossier patient
   └─ Patient folder now has: DICOM images + HL7 report
   ↓
5. (Optionnel) Backend envoie aussi au PACS
   DICOM SR (Structured Report) créé
   └─ Contient: résultats IA + notes + références images
   ↓
6. ✅ Dossier patient complet:
   ├─ DICOM images (brutes)
   ├─ DICOM SR (rapport structuré)
   └─ HL7 ORU (rapport texte)
```

---

## 🏗️ Composants Système

### **Architecture Global**

```
┌─────────────────────────────────────────────────────────────────┐
│                    HÔPITAL INFRASTRUCTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐  │
│  │   RIS/HIS      │   │   PACS Server  │   │   LIS (Optional)│
│  │ (Radiology/    │   │ (Archive DICOM)│   │   (Lab System) │
│  │  Hospital Info)│   │                │   │                │
│  │                │   │ • Orthanc      │   │                │
│  │ • Receive ORM  │   │ • GE Centricity│   │ • Lab reports  │
│  │ • Create MWL   │   │ • Philips      │   │ • Integration  │
│  │ • Receive ORU  │   │ • DICOM C-*    │   │                │
│  │ • Store report │   │ • DICOMweb API │   │                │
│  └────────┬────────┘   └────────┬────────┘   └────────────────┘
│           │                     │
│  DICOM C-FIND (MWL query)      │ DICOM C-STORE (image storage)
│  HL7 ORM/ORU                    │ DICOM C-GET/C-MOVE
│           │                     │
└───────────┼─────────────────────┼──────────────────────────────┘
            │                     │
            ▼                     ▼
┌────────────────────────────────────────────────────────────────┐
│           DR SCREENING BACKEND (Node.js + Python)              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  HL7 HANDLER                                              │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  • HL7 Parser (npm: hl7)                                 │ │
│  │  • ORM Receiver: Parse patient + exam details            │ │
│  │  • ORU Generator: Create report message                  │ │
│  │  • HAPI FHIR Converter (HL7 ↔ FHIR)                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  DICOM HANDLER                                            │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  • DICOM Parser (pydicom)                                │ │
│  │  • DICOM Network (pynetdicom)                            │ │
│  │  │  ├─ C-FIND query (MWL)                               │ │
│  │  │  ├─ C-GET/C-MOVE (retrieve images)                   │ │
│  │  │  └─ C-STORE (send images)                            │ │
│  │  • DICOM SR Creator (Structured Reports)                │ │
│  │  • DICOM Tag Manager                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  EXAM WORKFLOW                                            │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  1. Receive HL7 ORM → Create exam request               │ │
│  │  2. Query PACS for DICOM (C-FIND/C-GET)                │ │
│  │  3. Parse DICOM tags + extract image                    │ │
│  │  4. Send to AI Service for prediction                   │ │
│  │  5. Doctor validates results                             │ │
│  │  6. Create HL7 ORU report                                │ │
│  │  7. Send ORU to RIS/HIS                                  │ │
│  │  8. (Optional) Create DICOM SR for PACS                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
            │                     │
            │                     │
            ▼                     ▼
┌────────────────────┐   ┌────────────────────┐
│   AI Service       │   │   Frontend/         │
│   (FastAPI)        │   │   Dashboard         │
├────────────────────┤   ├────────────────────┤
│ • Predict DR grade │   │ • Show MWL list    │
│ • Grad-CAM viz     │   │ • Show exam status │
│ • Store artifacts  │   │ • Reports viewer   │
└────────────────────┘   └────────────────────┘
```

---

## 📨 Messages HL7 Détaillés

### **Message HL7 ORM (Order Entry)**

```
MSH|^~\&|DR_SCREENING|CENTER-001|RIS|HOSPITAL|20260507143025||ORM^O01|MSG-001|P|2.5|||
PID|||PAT-2026-001^^^HOSPITAL~DM-2026-001^^^CENTER-001||DUPONT^JEAN||19650315|M|||123 RUE DE PARIS, 75000 PARIS|||06 12 34 56 78^PH~jean.dupont@email.fr^NET|
OBR|1|ACC-2026-1234|1.2.3.4.5.6.7|RF^RETINAL FUNDUS SCREENING|||20260507143000|20260507143000||U||||20260507143000|CENTER-001^RETINOGRAPHY^^^DICOM||||||E
OBX|1|DT|EXAM_DATE^Exam Date||20260507||||||F
OBX|2|TX|CLINICAL_HISTORY^Clinical History||Patient diabetic for 10 years, suspected mild DR||||||F
```

**Segments:**
- `MSH` : Message header
- `PID` : Patient demographics
- `OBR` : Order segment (exam request, urgency, modality)
- `OBX` : Observation/result segments

### **Message HL7 ORU (Observation Result)**

```
MSH|^~\&|DR_SCREENING|CENTER-001|RIS|HOSPITAL|20260507143530||ORU^R01|MSG-002|P|2.5|||
PID|||PAT-2026-001^^^HOSPITAL~DM-2026-001^^^CENTER-001||DUPONT^JEAN||19650315|M|||123 RUE DE PARIS, 75000 PARIS|||
OBR|1|ACC-2026-1234|1.2.3.4.5.6.7|RF^RETINAL FUNDUS SCREENING|||20260507143000|20260507143530||U||||20260507143530|
OBX|1|NM|DR_GRADE^Diabetic Retinopathy Grade||2^Moderate||0-4|N||||F|
OBX|2|NM|AI_CONFIDENCE^AI Confidence Score||87.5||0-100|N||||F|
OBX|3|TX|CLINICAL_NOTES^Clinical Notes||Microanévrysmes et exudats légers. Référence ophtalmologue recommandée. Suivi 6 mois.||||||F|
OBX|4|TX|GRADCAM_IMAGE^Grad-CAM Visualization||[BASE64_ENCODED_IMAGE]||||||F|
OBX|5|DT|VALIDATION_DATE^Validation Date||20260507143530||||||F|
OBX|6|ST|VALIDATED_BY^Validated By||DR-002^MARTIN^SOPHIE||||||F|
```

**Segments:**
- `OBX|1` : AI grade
- `OBX|2` : Confidence score
- `OBX|3` : Doctor notes
- `OBX|4` : Grad-CAM image (base64)
- `OBX|5-6` : Validation metadata

---

## 🔄 Opérations DICOM Détaillées

### **Opération 1: C-FIND (Query MWL)**

```python
# Backend code to query PACS for worklist

from pynetdicom import AE, debug_logger
from pydicom.dataset import Dataset

# Setup Association Entity
ae = AE()
ae.add_requested_context('1.2.840.10008.5.1.4.31.1')  # Modality Worklist

# Connect to PACS
assoc = ae.associate('pacs.hospital.local', 104)

if assoc.is_established:
    # Build query dataset
    ds = Dataset()
    ds.PatientName = '*'  # All patients
    ds.PatientID = '*'
    ds.StudyDate = '20260507'  # Today
    ds.Modality = 'RF'  # Retinal Fundus
    
    # Send C-FIND query
    responses = assoc.send_c_find(ds, check_find_responses=False)
    
    # Process responses
    mwl_list = []
    for (status, identifier) in responses:
        if status.Status in (0xFF00, 0xFF01):  # Pending / More responses
            mwl_list.append({
                'PatientID': identifier.PatientID,
                'PatientName': identifier.PatientName,
                'StudyInstanceUID': identifier.StudyInstanceUID,
                'StudyDate': identifier.StudyDate,
                'AccessionNumber': identifier.AccessionNumber
            })
    
    assoc.release()
    return mwl_list
```

### **Opération 2: C-STORE (Send DICOM to PACS)**

```python
# Backend code to store DICOM file in PACS

from pynetdicom import AE
from pydicom import dcmread

ae = AE()
ae.add_requested_context('1.2.840.10008.5.1.4.1.1.66.4')  # Retinal image

# Load DICOM file (with tags already set)
dicom_file = dcmread('/uploads/dicoms/patient_study.dcm')

# Connect to PACS and send
assoc = ae.associate('pacs.hospital.local', 104)

if assoc.is_established:
    status = assoc.send_c_store(dicom_file)
    
    if status.Status == 0x0000:  # Success
        logger.info(f"DICOM stored successfully in PACS")
        # Update database
        exam.pacs_stored = True
        exam.pacs_path = '/archive/2026/05/07/...'
    else:
        logger.error(f"DICOM storage failed: {status}")
    
    assoc.release()
```

### **Opération 3: C-GET (Retrieve DICOM from PACS)**

```python
# Backend code to retrieve DICOM from PACS

from pynetdicom import AE
from pydicom.dataset import Dataset

ae = AE()
ae.add_requested_context('1.2.840.10008.5.1.4.1.1.66.4')

# Query dataset
ds = Dataset()
ds.PatientID = 'PAT-2026-001'
ds.StudyInstanceUID = '1.2.3.4.5.6.7'
ds.QueryRetrieveLevel = 'STUDY'

# Connect and retrieve
assoc = ae.associate('pacs.hospital.local', 104)

if assoc.is_established:
    # C-GET: PACS pushes files to us
    responses = assoc.send_c_get(ds)
    
    for (status, identifier) in responses:
        if status.Status == 0x0000:  # Success
            logger.info(f"Retrieved: {identifier.SOPInstanceUID}")
            # DICOM saved locally by AE handler
```

---

## 🛠️ Implémentation Recommandée

### **Phase 2: Support DICOM File (Court terme)**

```
dependencies:
  - pydicom        # Parse DICOM files
  - numpy          # Pixel array manipulation
  - Pillow         # Image conversion
  
tasks:
  ✓ Add DICOM parser to ai-service
  ✓ Support DICOM upload in backend
  ✓ Extract + normalize pixel_array → RGB
  ✓ Update API to accept .dcm files
  ✓ Unit tests for DICOM parsing
```

### **Phase 2.5: HL7 Message Handling (Moyen terme)**

```
dependencies:
  - hl7             # Parse/generate HL7 messages
  - mllp            # MLLP protocol (TCP wrapper)
  - python-fhir     # FHIR conversion

modules:
  - hl7_handler.py      # ORM receiver, ORU generator
  - mllp_server.py      # TCP listener for HL7
  - fhir_converter.py   # HL7 ↔ FHIR mapping
  
endpoints:
  - POST /hl7/receive/orm    # Receive exam orders
  - POST /hl7/send/oru       # Send reports
  - POST /fhir/convert       # HL7 ↔ FHIR
```

### **Phase 3: PACS Connection (Long terme)**

```
dependencies:
  - pynetdicom      # DICOM network protocol
  - dcmread         # Already included (pydicom)
  
modules:
  - pacs_client.py        # C-FIND, C-GET, C-STORE operations
  - dicom_sr_builder.py   # Create Structured Reports
  - mwl_manager.py        # Modality Worklist management

workflows:
  ✓ Query MWL (C-FIND)
  ✓ Retrieve DICOM (C-GET/C-MOVE)
  ✓ Store DICOM (C-STORE)
  ✓ Create DICOM SR (Structured Report)
```

---

## 📋 Plan de Déploiement

### **Étape 1 : Préparation Hôpital (Avant intégration)**

```
Checklist:
- [ ] PACS hospital disponible (Orthanc/GE/Philips)
- [ ] RIS/HIS accessible via HL7 (port 2575 ou MLLP)
- [ ] DICOM network configuré (AE Title, port 104)
- [ ] Firewall autorisant connections DICOM
- [ ] PACS credentials (AE Title, hostname, port)
- [ ] Test connectivity: telnet <pacs.host> 104
```

### **Étape 2 : Configuration Backend**

```
.env additions:
PACS_HOST=pacs.hospital.local
PACS_PORT=104
PACS_AE_TITLE=DR_SCREENING
PACS_RECEIVING_PORT=2575

RIS_HOST=ris.hospital.local
RIS_PORT=2575
RIS_AE_TITLE=RIS

MLLP_ENABLED=true
DICOM_C_FIND_ENABLED=true
DICOM_C_STORE_ENABLED=true
```

### **Étape 3 : Test Intégration**

```python
# Test script: test_pacs_integration.py

# 1. Test C-FIND
test_mwl_query()  # Query worklist

# 2. Test HL7 ORM parsing
test_orm_receiver()  # Parse sample ORM

# 3. Test DICOM file creation
test_dicom_creation()  # Create DICOM with tags

# 4. Test C-STORE
test_dicom_to_pacs()  # Send to PACS

# 5. Test C-GET
test_retrieve_from_pacs()  # Retrieve from PACS

# 6. Test HL7 ORU generation
test_oru_generation()  # Create report message
```

### **Étape 4 : Monitoring Production**

```
KPIs:
- [ ] HL7 ORM receipt time < 5 seconds
- [ ] DICOM C-STORE success rate > 99%
- [ ] PACS retrieval time < 10 seconds
- [ ] DICOM tag accuracy 100%
- [ ] HL7 ORU delivery time < 3 seconds

Logs:
- [ ] All HL7 messages logged (ORM/ORU)
- [ ] DICOM network events (C-FIND/C-STORE/C-GET)
- [ ] PACS connectivity issues
- [ ] Data integrity checks
```

---

## 📚 Standards & References

### **Standards Utilisés**
- **HL7 v2.5** : Message format, ORM/ORU segments
- **DICOM PS 3.x** : Medical imaging standard
- **DICOM Network** : C-FIND, C-GET, C-STORE operations
- **MLLP** : Minimal Lower-Layer Protocol (TCP wrapper for HL7)
- **FHIR** : Futur (HL7 v3+ equivalent)

### **Documentation DICOM Cruciale**
- PS 3.1 : Overview & Characteristics
- PS 3.3 : Information Object Definitions (IOD)
- PS 3.4 : Service-Object Pair (SOP) Class Definitions
- PS 3.5 : Data Structures and Encoding
- PS 3.7 : Message Exchange
- PS 3.8 : Network Communication Support
- PS 3.11 : Media Storage and File Format for Media Interchange

### **Specifications HL7 Cruciales**
- HL7 v2.5 Chapter 4 : Orders (ORM segments)
- HL7 v2.5 Chapter 7 : Observations (ORU segments, OBX)
- MLLP Envelope specification

---

## ✅ Checklist Intégration Complète

```
PRE-PRODUCTION
- [ ] DICOM file parsing working (pydicom)
- [ ] HL7 ORM receiver implemented
- [ ] HL7 ORU generator implemented
- [ ] PACS connectivity tested
- [ ] DICOM C-FIND/C-GET/C-STORE working
- [ ] End-to-end test with real hospital data
- [ ] Error handling + fallbacks defined
- [ ] Logging + monitoring configured
- [ ] Documentation complete
- [ ] Staff trained on new workflow

PRODUCTION
- [ ] Gradual rollout to one center first
- [ ] Monitor DICOM success rates 24/7
- [ ] Backup plan (fallback to JPEG if DICOM fails)
- [ ] Regular PACS/RIS connectivity checks
- [ ] Data integrity audits
```

---

**Ce document décrit une intégration hospitalière RÉELLE et COMPLÈTE, conforme aux standards DICOM/HL7 actuels.**
