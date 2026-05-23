# 📖 Guide d'Intégration HL7/DICOM/PACS - DR Screening

**Version** : 1.0  
**Date** : Mai 2026  
**Audience** : Développeurs, Administrateurs système, Intégrateurs hospitaliers

---

## 1️⃣ Prérequis & Installation

### Dépendances Python

```bash
# Dans ai-service/requirements.txt, ajouter:

# DICOM support
pydicom>=2.4.0              # Parse/create DICOM files
pynetdicom>=2.0.0           # DICOM network operations (C-FIND, C-STORE)

# HL7 support  
hl7>=0.4.5                  # Parse/generate HL7 messages
python-mllp>=0.2.0          # MLLP protocol handler (optional)

# Image processing (déjà présent)
Pillow>=9.0.0
numpy>=1.21.0
```

### Installation

```bash
cd ai-service
pip install -r requirements.txt

# Test des imports
python -c "import pydicom, hl7; print('OK')"
```

### Configuration Hôpital Requise

```
Éléments à fournir par l'hôpital:
- PACS hostname/IP      → PACS_HOST
- PACS port             → PACS_PORT (défaut: 104)
- PACS AE Title         → PACS_AE_TITLE (ex: "PACSSERVER")
- RIS/HIS hostname/IP   → RIS_HOST
- RIS/HIS port          → RIS_PORT (défaut: 2575 pour MLLP)
- DR Screening AE Title → DR_SCREENING (identifiant unique)
```

---

## 2️⃣ Configuration Backend

### Variables d'environnement (.env)

```env
# PACS Configuration
PACS_HOST=pacs.hospital.local
PACS_PORT=104
PACS_AE_TITLE=PACSSERVER
PACS_ENABLED=true

# RIS/HIS Configuration
RIS_HOST=ris.hospital.local
RIS_PORT=2575
MLLP_ENABLED=true

# DR Screening DICOM Identity
DR_SCREENING_AE_TITLE=DR_SCREENING
DICOM_NETWORK_PORT=2575

# Features (Phase-based)
DICOM_FILE_SUPPORT=true     # Phase 2: Accept .dcm files
DICOM_PACS_QUERY=false      # Phase 3: Query PACS
HL7_ORM_RECEIVER=false      # Phase 2: Receive HL7 ORM
HL7_ORU_SENDER=false        # Phase 3: Send HL7 ORU
```

### Étape suivante: connexion PACS

Une fois la soumission DICOM validée côté admin, la prochaine évolution consiste à brancher le système sur un PACS hospitalier. Le flux cible devient alors:

1. le rétinographe ou le centre dépose des DICOM dans le circuit,
2. le backend interroge la modality worklist via C-FIND,
3. les examens sont récupérés ou envoyés via C-GET / C-STORE,
4. les résultats restent traçables dans le dossier patient et dans le PACS.

Dans l'état actuel, cette brique est préparée fonctionnellement mais pas encore activée en production.

---

## 3️⃣ Intégration dans le Backend (Node.js)

### Ajouter endpoint pour recevoir HL7 ORM

**File: backend/src/routes/exams.js**

```javascript
const router = require('express').Router();
const { HL7IntegrationService } = require('../services/hl7-integration');

// Recevoir HL7 ORM (exam request from RIS)
router.post('/api/exams/hl7/orm-receiver', async (req, res) => {
    try {
        const hl7Message = req.body.message;  // Raw HL7 string
        
        // Parse ORM
        const parsed = HL7IntegrationService.parseORM(hl7Message);
        
        // Create exam request in database
        const exam = await ExamController.createFromORM(parsed);
        
        // Return HL7 ACK (Acknowledge)
        const ack = HL7IntegrationService.generateACK(hl7Message);
        res.set('Content-Type', 'text/plain');
        res.send(ack);
        
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Valider résultat IA et générer HL7 ORU
router.post('/api/exams/:id/validate', async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        const aiResults = req.body.ai_results;
        const doctorNotes = req.body.doctor_notes;
        
        // Générer HL7 ORU
        const oru = HL7IntegrationService.generateORU({
            exam,
            aiResults,
            doctorNotes
        });
        
        // Envoyer au RIS/HIS
        await HL7IntegrationService.sendORU(oru);
        
        // Mettre à jour statut exam
        exam.status = 'VALIDATED';
        exam.hl7_oru_sent = true;
        await exam.save();
        
        res.json({ success: true, oru_id: oru.id });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

### Service HL7 (Node.js)

**File: backend/src/services/hl7-integration.js**

```javascript
const net = require('net');

class HL7IntegrationService {
    
    static parseORM(hl7Message) {
        // Parse HL7 string into segments
        const segments = hl7Message.split('\r');
        const parsed = {};
        
        for (let seg of segments) {
            const fields = seg.split('|');
            if (fields[0] === 'PID') {
                parsed.patient = {
                    id: fields[3]?.split('^')[0],
                    name: fields[5]?.split('^'),
                    birthDate: fields[7],
                    gender: fields[8],
                };
            }
            if (fields[0] === 'OBR') {
                parsed.exam = {
                    accessionNumber: fields[3],
                    examCode: fields[4]?.split('^')[0],
                    examName: fields[4]?.split('^')[1],
                    priority: fields[5],
                    modality: fields[6] || 'RF',
                };
            }
        }
        
        return parsed;
    }
    
    static generateORU(data) {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        
        const oru = [
            `MSH|^~\\&|DR_SCREENING|CENTER-001|RIS|HOSPITAL|${timestamp}||ORU^R01|MSG-${timestamp}|P|2.5|||`,
            `PID|||${data.exam.patient_id}^^^HOSPITAL||${data.exam.patient_name}||||`,
            `OBR|1|${data.exam.accession_number}|${data.exam.study_uid}|RF^RETINAL FUNDUS|||${timestamp}|${timestamp}||${data.exam.priority}||||${timestamp}|`,
            `OBX|1|NM|DR_GRADE^Grade||${data.aiResults.grade}||0-4|N||||F|`,
            `OBX|2|NM|CONFIDENCE^Confiance||${(data.aiResults.confidence * 100).toFixed(1)}||0-100|N||||F|`,
            `OBX|3|TX|NOTES^Notes||${data.doctorNotes || ''}||||||F|`,
        ];
        
        return oru.join('\r');
    }
    
    static async sendORU(oru) {
        return new Promise((resolve, reject) => {
            const client = net.createConnection({
                host: process.env.RIS_HOST,
                port: process.env.RIS_PORT,
            });
            
            // MLLP wrap: <VT> + message + <FS><CR>
            const mllpMessage = `\x0b${oru}\x1c\r`;
            
            client.write(mllpMessage);
            
            client.on('data', (data) => {
                resolve(data.toString());
                client.end();
            });
            
            client.on('error', reject);
            
            setTimeout(() => {
                client.end();
                reject(new Error('HL7 send timeout'));
            }, 5000);
        });
    }
}

module.exports = { HL7IntegrationService };
```

---

## 4️⃣ Intégration dans le Service IA (Python)

### Ajouter endpoints DICOM

**File: ai-service/main.py**

```python
from fastapi import File, UploadFile, Form, HTTPException
from hl7_dicom_integration import DICOMHandler, PACSClient, HL7Handler

# Configuration PACS (au startup)
pacs_client = None
if os.getenv('PACS_ENABLED', 'false').lower() == 'true':
    pacs_client = PACSClient(
        pacs_host=os.getenv('PACS_HOST'),
        pacs_port=int(os.getenv('PACS_PORT', 104)),
        ae_title=os.getenv('PACS_AE_TITLE', 'PACSSERVER')
    )

# Endpoint 1: Accept DICOM files
@app.post("/predict/dicom")
async def predict_from_dicom(
    file: UploadFile = File(...),
    patient_id: str = Form(None),
    study_uid: str = Form(None)
):
    """
    Accept DICOM file, extract image, and predict
    """
    try:
        # Save temporary
        temp_path = f"/tmp/{file.filename}"
        with open(temp_path, 'wb') as f:
            f.write(await file.read())
        
        # Parse DICOM
        dicom_tags, pixel_bytes = DICOMHandler.parse_dicom_file(temp_path)
        
        # Convert to PIL Image
        from PIL import Image
        import io
        image = Image.open(io.BytesIO(pixel_bytes)).convert('RGB')
        
        # Predict
        results = predict_dr(image)
        
        # Log DICOM tags
        logger.info(f"DICOM prediction: PatientID={dicom_tags['patient_id']}, Grade={results['grade']}")
        
        # Store artifacts with DICOM metadata
        results['dicom_tags'] = dicom_tags
        
        # Optional: Store in PACS if configured
        if pacs_client and os.getenv('DICOM_PACS_STORE', 'false') == 'true':
            # Create DICOM SR (Structured Report) with results
            pacs_client.store_dicom(temp_path)
        
        return results
        
    except Exception as e:
        logger.error(f"DICOM prediction failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# Endpoint 2: Query PACS MWL
@app.get("/pacs/mwl")
async def query_pacs_worklist(study_date: str = None):
    """
    Query PACS for Modality Worklist (for admin dashboard)
    """
    if not pacs_client:
        raise HTTPException(status_code=503, detail="PACS not configured")
    
    try:
        mwl_list = pacs_client.query_mwl(study_date)
        return {"worklist": mwl_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint 3: Get DICOM from PACS
@app.post("/pacs/retrieve")
async def retrieve_from_pacs(patient_id: str, study_uid: str):
    """
    Retrieve DICOM from PACS for processing
    """
    if not pacs_client:
        raise HTTPException(status_code=503, detail="PACS not configured")
    
    try:
        # This requires C-GET implementation
        dicom_path = pacs_client.retrieve_dicom(patient_id, study_uid)
        return {"dicom_path": dicom_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 5️⃣ Mise à jour Dashboard Admin

### Afficher liste MWL (Modality Worklist)

**File: php-app/public/admin/exams/worklist.php** (Nouveau)

```php
<?php
// Récupérer MWL du service IA
$ai_service_url = getenv('AI_SERVICE_URL');
$response = file_get_contents("$ai_service_url/pacs/mwl");
$mwl_list = json_decode($response, true)['worklist'];
?>

<div class="worklist-container">
    <h2>📋 Modality Worklist (Patients à examiner aujourd'hui)</h2>
    
    <table class="worklist-table">
        <thead>
            <tr>
                <th>Patient ID</th>
                <th>Nom Patient</th>
                <th>Accession Number</th>
                <th>Study Date</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($mwl_list as $item): ?>
            <tr>
                <td><?= htmlspecialchars($item['patient_id']) ?></td>
                <td><?= htmlspecialchars($item['patient_name']) ?></td>
                <td><?= htmlspecialchars($item['accession_number']) ?></td>
                <td><?= htmlspecialchars($item['study_date']) ?></td>
                <td>
                    <button onclick="selectPatient('<?= $item['patient_id'] ?>')">
                        ✓ Sélectionner
                    </button>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
```

---

## 6️⃣ Tests

### Test unitaire HL7

```python
# tests/test_hl7_integration.py

from ai_service.hl7_dicom_integration import HL7Handler

def test_orm_parsing():
    orm_message = """MSH|^~\\&|RIS|HOSPITAL|DR_SCREENING|CENTER-001|20260507143025||ORM^O01|MSG-001|P|2.5|||
PID|||PAT-2026-001^^^HOSPITAL||DUPONT^JEAN||19650315|M|||
OBR|1|ACC-2026-1234|1.2.3.4.5.6.7|RF^RETINAL FUNDUS|||20260507143000|20260507143000||U||||20260507143000|"""
    
    parsed = HL7Handler.parse_orm_message(orm_message)
    
    assert parsed['patient']['id'] == 'PAT-2026-001'
    assert parsed['patient']['name'] == 'DUPONT^JEAN'
    assert parsed['exam']['exam_name'] == 'RETINAL FUNDUS'
    print("✓ ORM parsing test passed")

def test_oru_generation():
    exam_data = {
        'patient': {'id': 'PAT-001', 'name': 'TEST^PATIENT'},
        'exam': {'accession_number': 'ACC-001', 'study_uid': '1.2.3.4.5'},
    }
    
    ai_results = {'grade': 2, 'confidence': 0.875}
    
    oru = HL7Handler.create_oru_message(exam_data, ai_results, "Test notes")
    
    assert 'ORU^R01' in oru
    assert 'DR_GRADE' in oru
    assert '2' in oru
    print("✓ ORU generation test passed")
```

### Test DICOM

```python
# tests/test_dicom_integration.py

import numpy as np
from ai_service.hl7_dicom_integration import DICOMHandler

def test_dicom_creation():
    # Create test image
    pixel_array = np.random.randint(0, 256, (512, 512, 3), dtype=np.uint8)
    
    # Create DICOM
    output_path = '/tmp/test_image.dcm'
    DICOMHandler.create_dicom_file(
        pixel_array,
        patient_id='PAT-TEST-001',
        patient_name='TEST^PATIENT',
        study_uid='1.2.3.4.5',
        series_uid='1.2.3.4.5.1',
        output_path=output_path
    )
    
    # Parse created DICOM
    tags, pixel_bytes = DICOMHandler.parse_dicom_file(output_path)
    
    assert tags['patient_id'] == 'PAT-TEST-001'
    assert tags['modality'] == 'RF'
    print("✓ DICOM creation test passed")
```

### Exécuter les tests

```bash
cd ai-service
pytest tests/test_hl7_integration.py -v
pytest tests/test_dicom_integration.py -v
```

---

## 7️⃣ Validation Pré-Production

### Checklist de déploiement

```
CONFIGURATION HOSPITAL
☐ PACS accessible (telnet <host> 104 works)
☐ RIS/HIS accessible (telnet <host> 2575 works)
☐ Firewall rules configured (DICOM port 104, MLLP port 2575)
☐ Network latency acceptable (<100ms)

BACKEND CONFIGURATION
☐ All environment variables set correctly
☐ DICOM certificate/TLS configured (if required)
☐ Logs destination configured

TESTING
☐ Test ORM reception from RIS
☐ Test MWL query response
☐ Test DICOM file parsing
☐ Test ORU generation and sending
☐ Test PACS C-FIND response
☐ Test PACS C-STORE operation
☐ End-to-end workflow test

MONITORING
☐ HL7 message logging enabled
☐ DICOM operation logging enabled
☐ Error alerting configured
☐ PACS connectivity health check running
☐ Dashboard metrics setup
```

---

## 8️⃣ Troubleshooting

### Erreur: "PACS connection refused"

```
Solution:
1. Vérifier firewall: telnet <PACS_HOST> <PACS_PORT>
2. Vérifier config .env: PACS_HOST et PACS_PORT
3. Vérifier AE Title configuration à l'hôpital
4. Vérifier logs du serveur PACS
```

### Erreur: "Invalid DICOM file"

```
Solution:
1. Vérifier format DICOM (pydicom peut lire)
2. Vérifier fichier pas corrompu
3. Vérifier codec pixel_array (RGB vs Grayscale)
4. Voir logs détaillés: LOG_LEVEL=DEBUG
```

### Erreur: "HL7 message parsing failed"

```
Solution:
1. Vérifier format HL7 v2.5 correct
2. Vérifier segments requis (MSH, PID, OBR)
3. Vérifier delimiters: |^~\&
4. Tester avec message exemple
```

---

## 📚 Ressources Additionnelles

- [DICOM Standard (PS 3.x)](https://www.dicomstandard.org/)
- [HL7 v2.5 Specification](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=6)
- [pydicom Documentation](https://pydicom.readthedocs.io/)
- [pynetdicom Documentation](https://pynetdicom.readthedocs.io/)
- [MLLP Protocol Spec](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=140)

---

**Document Version**: 1.0  
**Dernière mise à jour**: Mai 2026
