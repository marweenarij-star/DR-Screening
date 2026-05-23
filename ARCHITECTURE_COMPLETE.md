# 🏗️ ARCHITECTURE COMPLÈTE - DR SCREENING

**Système de Dépistage Automatisé de la Rétinopathie Diabétique**  
*Version 1.0.0 - 2026*

---

## 📋 Table des Matières

1. [Vue d'ensemble générale](#vue-densemble-générale)
2. [Stack technologique](#stack-technologique)
3. [Composants système](#composants-système)
4. [Architecture de données](#architecture-de-données)
5. [Flux de communication](#flux-de-communication)
6. [Module IA & Deep Learning](#module-ia--deep-learning)
7. [Workflows métier](#workflows-métier)
8. [Infrastructure & Déploiement](#infrastructure--déploiement)
9. [Sécurité & Authentification](#sécurité--authentification)
10. [Scalabilité & Performance](#scalabilité--performance)

---

## 🎯 Vue d'ensemble générale

### Architecture Macro

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COUCHE PRÉSENTATION                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│  │  Portail Centre  │   │  Dashboard       │   │   Admin Super    │   │
│  │   (HTML/CSS/JS)  │   │  Médecin         │   │   (Monitoring)   │   │
│  │                  │   │  (Real-time UI)  │   │                  │   │
│  │ • CRUD Patients  │   │ • Statistiques   │   │ • KPI Dashboard  │   │
│  │ • Gestion Docs   │   │ • Exams List     │   │ • Tickets        │   │
│  │ • Upload Images  │   │ • Alertes        │   │ • Reporting      │   │
│  └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘   │
│           │HTTP/WS               │HTTP/WS               │HTTP/WS      │
└───────────┼───────────────────────┼─────────────────────┼──────────────┘
            │                       │                     │
            ▼                       ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    COUCHE APPLICATION (BACKEND)                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │              PHP Application (Apache - Port 80)                    │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │                                                                     │  │
│  │  ROUTING LAYER                                                     │  │
│  │  ├─ /public/index.php (Main Router)                               │  │
│  │  ├─ RESTful API Routes                                            │  │
│  │  └─ File Upload Handling                                          │  │
│  │                                                                     │  │
│  │  CONTROLLER LAYER                                                 │  │
│  │  ├─ AuthController (JWT token management)                        │  │
│  │  ├─ PatientController (CRUD patients)                            │  │
│  │  ├─ DoctorController (CRUD doctors)                              │  │
│  │  ├─ ExamController (Upload, predict, storage)                    │  │
│  │  ├─ AlertController (Alert management)                           │  │
│  │  └─ SuperAdminController (Monitoring & reporting)                │  │
│  │                                                                     │  │
│  │  SERVICE LAYER                                                    │  │
│  │  ├─ DatabaseService (MySQL queries & transactions)              │  │
│  │  ├─ JWTAuthService (Token generation & validation)              │  │
│  │  ├─ AIClientService (HTTP calls to AI service)                  │  │
│  │  ├─ WebSocketClientService (Real-time notifications)           │  │
│  │  ├─ EmailService (SMTP for alerts)                              │  │
│  │  ├─ FileUploadService (Image validation & storage)             │  │
│  │  └─ ErrorHandlerService (Logging & error management)            │  │
│  │                                                                     │  │
│  │  MIDDLEWARE LAYER                                                 │  │
│  │  ├─ JWT Validation                                               │  │
│  │  ├─ Role-Based Access Control (RBAC)                            │  │
│  │  ├─ Request Validation                                           │  │
│  │  ├─ CORS Headers                                                 │  │
│  │  └─ Error Handling                                               │  │
│  │                                                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌────────────────────────────┬──────────────────┬──────────────────┐   │
│  │  AI Service (FastAPI)      │  WebSocket       │  Email Service   │   │
│  │  (Python - Port 8000)      │  Server (Node.js)│  (SMTP)          │   │
│  │  ┌──────────────────────┐  │  (Port 8080)    │  ┌────────────┐  │   │
│  │  │ Deep Learning Model │  │  ┌────────────┐ │  │ Nodemailer │  │   │
│  │  │ • EfficientNet      │  │  │ WebSocket  │ │  │            │  │   │
│  │  │ • ResNet            │  │  │ Auth       │ │  │ • SMTP     │  │   │
│  │  │ • Ensemble Voting   │  │  ├────────────┤ │  │ • Template │  │   │
│  │  │ • Temperature Cal.  │  │  │ Broadcast  │ │  │ • Tracking │  │   │
│  │  │ • TTA               │  │  │ to Clients │ │  └────────────┘  │   │
│  │  │ • Grad-CAM          │  │  └────────────┘ │                   │   │
│  │  │                     │  │                  │                   │   │
│  │  │ Endpoints:          │  │ Events:         │                   │   │
│  │  │ • /predict          │  │ • user-login   │                   │   │
│  │  │ • /gradcam          │  │ • exam-created │                   │   │
│  │  │ • /health           │  │ • alert-raised │                   │   │
│  │  └──────────────────────┘  │ • doctor-stats │                   │   │
│  │                            └────────────────┘                   │   │
│  └────────────────────────────┴──────────────────┴──────────────────┘   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
            │                       │                     │
            │ SQL                   │ HTTP                │ Email
            │ JSON                  │                     │ Notifications
            ▼                       ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       COUCHE DONNÉES & SERVICES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│  │  MySQL Database  │   │   File Storage   │   │   Email Server   │   │
│  │  (Port 3306)     │   │   (Local FS)     │   │   (SMTP)         │   │
│  │                  │   │                  │   │                  │   │
│  │ • centers        │   │ • Original       │   │ • Alert          │   │
│  │ • users          │   │   images         │   │   notifications  │   │
│  │ • patients       │   │ • Heatmaps       │   │ • Activation     │   │
│  │ • exams          │   │ • Overlays       │   │   emails         │   │
│  │ • alerts         │   │                  │   │                  │   │
│  │ • refresh_tokens │   │ Path:            │   │ Transport:       │   │
│  │                  │   │ /uploads/        │   │ TLS/SSL          │   │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack technologique

### Frontend
| Couche | Technologie | Détails |
|--------|-------------|---------|
| **Markup** | HTML 5 | Vues générées en PHP/Blade |
| **Styling** | CSS 3 | Assets: `/public/css/app.css` |
| **Scripting** | JavaScript (Vanilla + AJAX) | Real-time updates |
| **WebSocket** | `ws://` protocol | Client-side event listeners |
| **Build** | N/A | Non compilé (served as-is) |

### Backend PHP
| Couche | Technologie | Détails |
|--------|-------------|---------|
| **Framework** | PHP 8.x (custom MVC) | Non Laravel/Symfony |
| **Serveur** | Apache 2.4 (XAMPP) | Port 80 |
| **Router** | `/public/index.php` | Dispatch manual |
| **Auth** | JWT (jsonwebtoken lib) | Stateless sessions |
| **DB** | MySQLi (procedural) | Direct SQL queries |
| **HTTP Client** | `curl` / `file_get_contents` | Call AI service |
| **Email** | Nodemailer via Node.js | Delegated to ws-server |
| **File Upload** | `$_FILES` handling | Multer-like validation |

### Backend Node.js (WebSocket + Email)
| Couche | Technologie | Détails |
|--------|-------------|---------|
| **Runtime** | Node.js 18+ | LTS |
| **Framework** | Express 4.x | HTTP + WS routing |
| **WebSocket** | `ws` 8.x | Real-time bidirectional |
| **Email** | Nodemailer 6.x | SMTP client |
| **Auth** | JWT validation | Inherit from PHP |
| **Database** | SQLite (optional) + MySQL | For session/queue mgmt |
| **Port** | 8080 | WebSocket server |

### AI Service (Python)
| Couche | Technologie | Détails |
|--------|-------------|---------|
| **Framework** | FastAPI 0.104 | Async HTTP API |
| **Server** | Uvicorn 0.24 | ASGI application server |
| **Port** | 8000 | AI inference endpoint |
| **DL Framework** | PyTorch 2.0+ | Model training & inference |
| **Vision** | Torchvision | Pre-trained models |
| **Image Proc** | OpenCV, Pillow, NumPy | Preprocessing & visualization |
| **Models** | ResNet, EfficientNet | Transfer learning |
| **XAI** | Grad-CAM | Attention visualization |

### Base de données
| Composant | Technologie | Détails |
|-----------|-------------|---------|
| **SGBD Principal** | MySQL 8.0+ | Relational, ACID compliant |
| **Moteur** | InnoDB | Transactions, foreign keys |
| **Charset** | utf8mb4 | Full Unicode support |
| **Port** | 3306 | Standard MySQL |
| **Stockage** | Fichier `.sql` | Schema en `/database/schema.sql` |

### Stockage fichiers
| Type | Localisation | Format |
|------|-------------|--------|
| **Images originales** | `/uploads/exams/` | `.jpg`, `.png` |
| **Heatmaps** | `/uploads/heatmaps/` | `.png` (Grad-CAM) |
| **Overlays** | `/uploads/overlays/` | `.png` (Image + heatmap) |
| **Logs** | `/logs/` | `.txt` |

---

## 🔧 Composants système

### 1. Application PHP (Portail Web)

#### Structure des fichiers
```
/php-app
├── /public
│   ├── index.php              # Router principal
│   ├── /css
│   │   ├── app.css            # Styles applicatifs
│   │   └── bootstrap.css      # Framework CSS
│   ├── /js
│   │   ├── app.js             # App JS principal
│   │   ├── websocket.js       # WS client
│   │   └── chart.js           # Graphiques
│   ├── /uploads
│   │   ├── /exams             # Images rétiniennes
│   │   ├── /heatmaps          # Grad-CAM visualizations
│   │   └── /overlays          # Combined overlays
│   └── /img
├── /src
│   ├── /config
│   │   ├── Database.php       # MySQL connection
│   │   └── Constants.php      # App constants
│   ├── /controllers
│   │   ├── AuthController.php
│   │   ├── PatientController.php
│   │   ├── DoctorController.php
│   │   ├── ExamController.php
│   │   ├── AlertController.php
│   │   └── SuperAdminController.php
│   ├── /middleware
│   │   ├── JWTMiddleware.php
│   │   ├── RBACMiddleware.php
│   │   └── ValidationMiddleware.php
│   ├── /services
│   │   ├── DatabaseService.php
│   │   ├── JWTAuthService.php
│   │   ├── AIClientService.php
│   │   ├── WebSocketClientService.php
│   │   ├── EmailService.php
│   │   └── FileUploadService.php
│   └── /views
│       ├── login.php
│       ├── center_dashboard.php
│       ├── doctor_dashboard.php
│       ├── patient_list.php
│       ├── exam_detail.php
│       └── superadmin_dashboard.php
└── package.json               # Dependencies (composer)
```

#### Rôles utilisateurs

| Rôle | Permissions | Détails |
|------|-------------|---------|
| **Administrateur Centre** | CRUD Patients, CRUD Doctors, Voir exams, Alerts | `center_admin` |
| **Médecin** | Voir patients (centre), Voir exams personnels, Traiter alertes | `doctor` |
| **Super Admin** | Tous les centres, KPI globaux, Support tickets | `super_admin` (futur) |

#### Workflows PHP

**1. Authentification**
```
POST /api/auth/login
├── Validate email/password (MySQL)
├── Check account_status (active/pending)
├── Generate JWT token (24h validity)
├── Return token + user data
└── Client stores token in localStorage
```

**2. Upload examen**
```
POST /api/exams/upload
├── JWT validation middleware
├── File validation (size, type, mime)
├── Store image in /uploads/exams/
├── Create exam record (MySQL)
├── Call AI service /predict (HTTP POST)
├── Save grade, confidence, image_path
├── If grade >= 3: Create alert + send email
├── Trigger WebSocket event 'exam-created'
└── Return exam data + heatmap path
```

**3. Tableau de bord médecin (Real-time)**
```
WebSocket connection
├── Server: 'doctor-login' event
├── Broadcast 'doctor-online' to all
├── Listen for 'exam-created' events
├── Receive real-time notifications
└── Auto-refresh stats every 30s
```

---

### 2. Service IA (FastAPI)

#### Structure des fichiers
```
/ai-service
├── main.py                    # FastAPI application
├── main_resnet.py            # ResNet model wrapper
├── main_efficientnet.py       # EfficientNet model wrapper
├── train.py                  # Training script
├── gradcam.py                # Grad-CAM implementation
├── /models
│   ├── resnet_model.pth      # Saved ResNet weights
│   ├── efficientnet_model.pth # Saved EfficientNet weights
│   └── ensemble_model.pth     # Ensemble weights
├── /heatmaps                 # Output heatmaps (temp)
├── /cleaning                 # Preprocessing scripts
├── requirements.txt          # Python dependencies
└── .env                       # Configuration
```

#### Modèles de Deep Learning

**Architecture Ensemble**
```
Input Image (224x224)
    │
    ├─► [ResNet50]  ──► Softmax ──► p_resnet (5 classes)
    │                              │
    ├─► [EfficientNet-B3] ► Softmax ► p_eff (5 classes)
    │                                 │
    └─► [EfficientNet-B4] ► Softmax ► p_eff2 (5 classes)
                                       │
                    Soft Voting (weighted average)
                            │
                    ┌───────┴───────┐
                    ▼               ▼
            [Temperature Scaling]  [Threshold Tuning]
                    │
                ┌───┴───┬───┬───┬────┐
                ▼       ▼   ▼   ▼    ▼
            Grade (0/1/2/3/4)  +  Confidence
                    │
            [Grad-CAM Visualization]
                    │
                ▼ Output
            {
              "grade": 2,
              "confidence": 87.5,
              "prediction": "Moderate NPDR",
              "heatmap": "/heatmaps/exam_001.png",
              "overlay": "/overlays/exam_001.png"
            }
```

#### Endpoints FastAPI

| Method | Path | Entrée | Sortie | Détails |
|--------|------|--------|--------|---------|
| **POST** | `/predict` | Image (multipart) | JSON prediction | Grade + confidence |
| **POST** | `/gradcam` | Image + model | Image PNG | Attention map |
| **GET** | `/health` | - | `{"status": "ok"}` | Health check |
| **POST** | `/calibrate` | Validation data | JSON model | Calibrate temp |

#### Processus inférence (step-by-step)

```python
1. Receive image from PHP backend (HTTP POST)
2. Validate image (size, format, EXIF)
3. Preprocess:
   - Resize to 224x224
   - Normalize (ImageNet stats)
   - Apply TTA (5 augmentations)
4. Load ensemble models (GPU if available)
5. Forward pass each model
6. Soft voting with learned weights
7. Apply temperature scaling calibration
8. Generate Grad-CAM heatmap
9. Create overlay image
10. Save outputs to disk
11. Return JSON with paths & confidence
```

#### Hyperparamètres clés

| Paramètre | Valeur | Raison |
|-----------|--------|--------|
| **Input size** | 224x224 | Standard pour ImageNet models |
| **Batch size** | 32 | Trade-off mémoire/performance |
| **Learning rate** | 1e-4 | Transfer learning (frozen backbone) |
| **Optimizer** | Adam | Adaptation rapide |
| **Loss** | CrossEntropyLoss + Class Weights | Imbalance handling |
| **Epochs** | 50 | Early stopping |
| **Temperature (T)** | ~1.3 | Calibration post-training |
| **TTA augmentations** | 5 | Robustness |

---

### 3. Serveur WebSocket (Node.js)

#### Structure des fichiers
```
/ws-server
├── src
│   ├── server.js             # Express + WS server
│   ├── /config
│   │   ├── database.js
│   │   └── mqtt.js (optional)
│   ├── /routes
│   │   ├── auth.js
│   │   ├── exams.js
│   │   └── alerts.js
│   ├── /middleware
│   │   ├── jwt.js
│   │   └── rbac.js
│   ├── /services
│   │   ├── ws-broadcaster.js
│   │   ├── email.js
│   │   └── database.js
│   └── /events
│       ├── exam-events.js
│       ├── alert-events.js
│       └── user-events.js
├── package.json
├── .env
└── .env.example
```

#### WebSocket Events

**Client → Server**
| Event | Payload | Action |
|-------|---------|--------|
| `user-login` | `{user_id, role}` | Authenticate WS user |
| `subscribe-exam-updates` | `{patient_id}` | Subscribe to patient exams |
| `alert-ack` | `{alert_id}` | Mark alert as read |
| `alert-resolve` | `{alert_id, comment}` | Resolve alert |

**Server → Client**
| Event | Broadcast | Détails |
|-------|-----------|---------|
| `user-online` | To all users | User connected |
| `exam-created` | To doctor | New exam for patient |
| `exam-analyzed` | To doctor | AI analysis complete |
| `alert-raised` | To doctor | New alert (grade >= 3) |
| `stats-update` | To dashboard | Real-time KPI refresh |

#### Flux d'alerte en temps réel

```
User uploads exam image (PHP)
    │
    ├─► PHP calls AI service (8000)
    │
    ├─► AI returns: grade=3, confidence=92%
    │
    ├─► PHP creates Alert record (MySQL)
    │
    ├─► PHP emits HTTP POST to Node.js WS
    │   POST /ws/broadcast/alert
    │   Body: {exam_id, doctor_id, grade, message}
    │
    ├─► Node.js broadcasts to WebSocket clients
    │   event: 'alert-raised'
    │
    ├─► Connected doctors receive notification
    │   → Browser shows popup alert
    │   → Dashboard refreshes
    │
    └─► Node.js sends email via Nodemailer
        event: 'send-email'
        Recipients: [doctor_email]
```

---

## 💾 Architecture de données

### Schéma MySQL complet

```
┌─────────────────────────────────────────────────────────────────────┐
│                         centers                                      │
├──────┬───────────┬──────────┬───────────┬──────────┬──────────────────┤
│ id   │ name      │ address  │ phone     │ email    │ created_at       │
│ PK   │ VARCHAR   │ TEXT     │ VARCHAR   │ VARCHAR  │ TIMESTAMP        │
├──────┴───────────┴──────────┴───────────┴──────────┴──────────────────┤
│ 1-to-many relationships: users, patients, exams                        │
└─────────────────────────────────────────────────────────────────────┘
       │
       ├─── FK: users.center_id
       │    └─► Cascade delete
       │
       ├─── FK: patients.center_id
       │    └─► Cascade delete
       │
       └─── FK: exams.center_id
            └─► Cascade delete

┌─────────────────────────────────────────────────────────────────────────┐
│                              users                                       │
├────┬──────────┬──────┬─────────┬──────────┬──────────┬───────────────────┤
│ id │ center_id│ role │ email   │ name     │ password │ account_status    │
│ PK │ FK       │ ENUM │ UNIQUE  │ VARCHAR  │ HASH     │ pending|active    │
├────┼──────────┼──────┼─────────┼──────────┼──────────┼───────────────────┤
│ 1  │ 1        │ admin│ a@m.com │ Ahmed    │ $2y$10$… │ active            │
│ 2  │ 1        │ doc  │ b@m.com │ Fatima   │ $2y$10$… │ pending           │
├────┴──────────┴──────┴─────────┴──────────┴──────────┴───────────────────┤
│ Attributes: identity, phone, speciality, is_active, activation_token    │
│ Indexes: idx_email, idx_center_role, idx_account_status               │
│ FK: refresh_tokens.user_id (Cascade)                                  │
│ FK: exams.doctor_id (Cascade)                                         │
│ FK: alerts.doctor_id (Cascade)                                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           patients                                       │
├────┬──────────┬─────────────┬──────────┬──────────┬────────────────────┤
│ id │ center_id│ full_name   │ age      │ gender   │ diabetes_type      │
│ PK │ FK       │ VARCHAR     │ INT      │ ENUM     │ ENUM               │
├────┼──────────┼─────────────┼──────────┼──────────┼────────────────────┤
│ 1  │ 1        │ Mohammed I. │ 52       │ M        │ type2              │
│ 2  │ 1        │ Fatima B.   │ 38       │ F        │ type1              │
├────┴──────────┴─────────────┴──────────┴──────────┴────────────────────┤
│ Attributes: medical_record_number, date_of_birth, diabetic_years       │
│ Indexes: idx_center, idx_medical_record, idx_name, idx_created        │
│ FK: exams.patient_id (Cascade)                                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                            exams                                          │
├────┬──────────┬────────┬──────────┬──────────┬───────┬──────┬───────────┤
│ id │ center_id│patient │ doctor   │ image    │ grade │ conf │ eye       │
│ PK │ FK       │ FK     │ FK       │ VARCHAR  │ INT   │ DEC  │ ENUM      │
├────┼──────────┼────────┼──────────┼──────────┼───────┼──────┼───────────┤
│ 1  │ 1        │ 1      │ 1        │/uploads..│ 2     │ 87.5 │ left      │
│ 2  │ 1        │ 2      │ 2        │/uploads..│ 0     │ 95.2 │ right     │
├────┴──────────┴────────┴──────────┴──────────┴───────┴──────┴───────────┤
│ Attributes: heatmap_path, overlay_path, notes, created_at              │
│ Indexes: idx_doctor_grade_date, idx_patient, idx_grade, idx_created   │
│ FK: alerts.exam_id (Cascade)                                           │
│ Grade scale: 0=No DR, 1=Mild, 2=Moderate, 3=Severe, 4=Proliferative  │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           alerts                                          │
├────┬────────┬──────────┬─────────┬──────────┬───────────┬───────────────┤
│ id │ exam_id│ doctor_id│ type    │ message  │ is_read   │ is_resolved   │
│ PK │ FK     │ FK       │ ENUM    │ TEXT     │ TINYINT   │ TINYINT       │
├────┼────────┼──────────┼─────────┼──────────┼───────────┼───────────────┤
│ 1  │ 1      │ 1        │ urgent  │ Grade 3..│ 0         │ 0             │
│ 2  │ 2      │ 2        │ urgent  │ Grade 4..│ 1         │ 1             │
├────┴────────┴──────────┴─────────┴──────────┴───────────┴───────────────┤
│ Attributes: read_at, resolved_at, resolved_comment                     │
│ Indexes: idx_doctor_read_resolved, idx_exam, idx_created              │
│ Trigger: is_read=1 → send WebSocket 'alert-read' event               │
│ Trigger: is_resolved=1 → email doctor confirmation                    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      refresh_tokens                                       │
├────┬───────┬─────────────────────┬──────────────┬───────────────────────┤
│ id │user_id│ token               │ expires_at   │ created_at            │
│ PK │ FK    │ VARCHAR(500)        │ TIMESTAMP    │ TIMESTAMP             │
├────┼───────┼─────────────────────┼──────────────┼───────────────────────┤
│ 1  │ 1     │ eyJhbGciOiJIUzI1NiI│ 2026-05-19   │ 2026-05-05            │
├────┴───────┴─────────────────────┴──────────────┴───────────────────────┤
│ Purpose: JWT refresh token management (7 days validity)                │
│ Index: idx_user, idx_token                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### Relations & Intégrité

```
centers (1) ──────────► (N) users
              MUST       • Administrators
                        • Doctors

centers (1) ──────────► (N) patients
              MUST       • Medical records

centers (1) ──────────► (N) exams
              MUST       • Screening results

patients (1) ──────────► (N) exams
              MUST       • Multi-eye exams

users (1:doctor) ──────────► (N) exams
              MUST       • Performed by

exams (1) ──────────► (N) alerts
              CAN        • If grade >= 3

users (1:doctor) ──────────► (N) alerts
              MUST       • Notified
```

---

## 📡 Flux de communication

### HTTP Request/Response Flow

```
1. USER UPLOADS EXAM IMAGE
   ┌─────────────┐
   │   Browser   │
   └──────┬──────┘
          │ POST /api/exams/upload
          │ Multipart: {image, patient_id}
          │ Headers: {Authorization: Bearer <JWT>}
          ▼
   ┌──────────────────────┐
   │   PHP Backend        │
   ├──────────────────────┤
   │ 1. Validate JWT      │
   │ 2. Check RBAC        │
   │ 3. Validate file     │
   │ 4. Store image       │
   │ 5. Create exam rec   │
   │ 6. Call AI service   │──────────┐
   │    POST /predict     │          │
   │    File: image       │          │
   │    Auth: internal    │          │
   └──────────────────────┘          │
          │◄─────────────────────────┘ HTTP 200 OK
          │ {grade, confidence, heatmap}
          │
          ├─► MySQL: UPDATE exams SET grade, confidence
          │
          ├─► Check grade >= 3?
          │   ├─► YES: Create alert
          │   ├─► YES: Emit WS event
          │   └─► YES: Queue email
          │
          ▼
   ┌──────────────────────┐
   │   Node.js WS Server  │
   ├──────────────────────┤
   │ POST /ws/broadcast   │
   │ Event: 'exam-created'│
   │ Payload: {exam_id}   │
   └──────────────────────┘
          │
          ├─► Broadcast to connected doctors
          │   event: 'exam-created'
          │   Message: 'New exam for patient X'
          │
          └─► Send email (Nodemailer)
              To: doctor_email
              Subject: 'New urgent case'
```

### WebSocket Real-Time Architecture

```
CLIENT SIDE (Browser)
┌──────────────────────────────┐
│ JavaScript (websocket.js)    │
├──────────────────────────────┤
│ const ws = new WebSocket(    │
│   'ws://localhost:8080/ws'   │
│ );                           │
│                              │
│ ws.onopen = (evt) => {       │
│   ws.send({                  │
│     type: 'user-login',      │
│     user_id: 123,            │
│     role: 'doctor'           │
│   });                        │
│ };                           │
│                              │
│ ws.onmessage = (evt) => {    │
│   const msg = JSON.parse(    │
│     evt.data                 │
│   );                         │
│   if (msg.type === 'alert') {│
│     showNotification(msg);   │
│   }                          │
│ };                           │
└──────────┬───────────────────┘
           │ WebSocket
           │ upgrade:
           │ GET /ws?token=JWT
           ▼
┌────────────────────────────────┐
│  Node.js WS Server (8080)      │
├────────────────────────────────┤
│ wss.on('connection', (ws) => {│
│   ws.on('message', (msg) => {│
│     if msg.type === 'user-login'│
│       → Validate JWT            │
│       → Store client in map     │
│       → Emit 'user-online'      │
│     if msg.type === 'alert-ack' │
│       → Update MySQL            │
│       → Broadcast status        │
│   });                           │
│ });                            │
│                                │
│ // Receive HTTP POST from PHP  │
│ app.post('/ws/broadcast', ...) │
│   → Get all connected doctors  │
│   → Filter by center/access    │
│   → Send WebSocket message     │
└────────────────────────────────┘
```

---

## 🧠 Module IA & Deep Learning

### Pipeline Training

```
DONNÉES BRUTES (APTOS dataset)
├─ ~3500 images rétiniennes
├─ Grades: 0-4 (imbalancé)
└─ Résolution: ~1024x1024 px
    │
    ▼ PREPROCESSING
├─ Resize: 224x224
├─ Normalize: ImageNet stats
├─ Remove EXIF data
├─ Augmentation: Rotation, Flip, Brightness
└─ Split: 70% train, 15% val, 15% test
    │
    ▼ TRAINING (PyTorch)
├─ Model: ResNet50 / EfficientNet-B3/B4
├─ Pretrained: ImageNet weights
├─ Loss: CrossEntropy + Class Weights
├─ Optimizer: Adam
├─ Epochs: 50 (Early Stop @ 20 patience)
├─ Batch size: 32
├─ Learning rate: 1e-4 (freeze backbone)
└─ Device: GPU (CUDA) or CPU
    │
    ▼ VALIDATION
├─ Metrics: Accuracy, F1 (macro), ROC-AUC
├─ Confusion matrix
├─ Per-class precision/recall
└─ Calibration check (ECE)
    │
    ▼ CALIBRATION (Post-training)
├─ Method: Temperature Scaling
├─ Fit T on validation set
├─ Minimize NLL loss
├─ T ≈ 1.3 (model overconfident)
└─ Validate on test set
    │
    ▼ ENSEMBLE
├─ Combine 3 models (ResNet + 2x EfficientNet)
├─ Soft voting: p_final = (w1*p1 + w2*p2 + w3*p3) / (w1+w2+w3)
├─ Learn weights on val set
└─ Threshold tuning: adjust decision boundaries
    │
    ▼ TESTING
├─ Metrics on holdout test set
├─ Threshold validation
├─ TTA (Test-Time Aug) robustness
└─ Grad-CAM validation
    │
    ▼ DEPLOYMENT
├─ Save models: .pth files
├─ Package into FastAPI service
├─ Docker container (optional)
└─ Health checks + monitoring
```

### Grad-CAM (Explainability)

```
Forward Pass (normal)
Input: Image (224x224x3)
    ▼
[CNN Backbone: ResNet/EfficientNet]
    ├─ Conv blocks (layer1 → layer4)
    ├─ Feature maps extracted
    └─ Logits: (batch_size, 5 classes)
        │
        ▼ Softmax
    Predictions: [0.02, 0.15, 0.72, 0.08, 0.03]
                  └─► Grade 2 (Moderate)

Grad-CAM Computation
Input: Last conv layer features (spatial)
    ▼
1. Forward pass: compute activations A
   A shape: (batch, channels, height, width)
   
2. Backward pass: compute gradients ∂L/∂A
   where L = loss w.r.t. predicted class
   
3. Compute weights: w_c = (1/N) * Σ(∂L/∂A)
   Average pooling over spatial dimensions
   
4. Weighted combination: Grad-CAM_c = ReLU(Σ w_c * A)
   Apply ReLU to keep only positive activations
   
5. Bilinear upsample to original image size
   
6. Normalize to 0-255
   
Output: Heatmap highlighting important regions
    ├─ Red: High activation (strong indicator)
    ├─ Yellow: Medium activation
    └─ Blue: Low/no activation
    
Overlay: Original image + heatmap (transparency)
```

---

## 🔄 Workflows métier

### 1. Workflow d'activation médecin

```
STEP 1: Centre Admin crée compte médecin
┌──────────────────────────────────┐
│ Admin accède: /doctors/create    │
├──────────────────────────────────┤
│ Saisit:                          │
│ • Identity: DOC-12345            │
│ • Name: Ahmed Hassan             │
│ • Email: ahmed@email.com         │
│ • Specialty: Ophthalmology       │
│ • Phone: +212-XXX-XXX            │
│                                  │
│ [CREATE ACCOUNT]                 │
└──────┬───────────────────────────┘
       │ POST /api/doctors
       ▼
┌──────────────────────────────────┐
│ PHP Backend                      │
├──────────────────────────────────┤
│ 1. Validate inputs (required)    │
│ 2. Generate JWT token (24h)      │
│ 3. Create user record:           │
│    - account_status: 'pending'   │
│    - activation_token: JWT       │
│    - password_hash: NULL         │
│ 4. Store in MySQL                │
│ 5. Queue email                   │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Node.js sends email              │
├──────────────────────────────────┤
│ To: ahmed@email.com              │
│                                  │
│ Subject: Activez votre compte    │
│                                  │
│ Click: https://platform.local/  │
│ activate?token=JWT_TOKEN         │
│                                  │
│ Valid for: 24 hours              │
└──────┬───────────────────────────┘
       │ Doctor receives email
       │
STEP 2: Doctor activates account

┌──────────────────────────────────┐
│ Browser: Activation link         │
├──────────────────────────────────┤
│ URL: /activate?token=JWT_TOKEN   │
│                                  │
│ Shows: Password setup form       │
│ • New password:                  │
│ • Confirm password:              │
│ • [ACTIVATE]                     │
└──────┬───────────────────────────┘
       │ POST /api/activate
       ▼
┌──────────────────────────────────┐
│ PHP Backend                      │
├──────────────────────────────────┤
│ 1. Validate token (JWT)          │
│ 2. Check expiry (24h)            │
│ 3. Verify not already activated  │
│ 4. Hash password (bcrypt)        │
│ 5. Update user record:           │
│    - password_hash: HASH         │
│    - account_status: 'active'    │
│    - activation_token: NULL      │
│ 6. Clear refresh tokens          │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Response: Success                │
├──────────────────────────────────┤
│ Message: "Account activated"     │
│ Link: Redirect to login          │
└──────────────────────────────────┘

STEP 3: Doctor logs in

┌──────────────────────────────────┐
│ Login form                       │
├──────────────────────────────────┤
│ • Email: ahmed@email.com         │
│ • Password: ••••••               │
│ • [LOGIN]                        │
└──────┬───────────────────────────┘
       │ POST /api/auth/login
       ▼
┌──────────────────────────────────┐
│ PHP Backend                      │
├──────────────────────────────────┤
│ 1. Find user by email            │
│ 2. Verify password (bcrypt)      │
│ 3. Check account_status=active   │
│ 4. Generate JWT token (24h)      │
│ 5. Generate refresh token (7d)   │
│ 6. Store refresh token (MySQL)   │
│ 7. Update last_login timestamp   │
│ 8. Return JWT + user data        │
└──────┬───────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ Client: Store tokens             │
├──────────────────────────────────┤
│ localStorage.accessToken = JWT   │
│ localStorage.refreshToken = RTK  │
│                                  │
│ Navigate: /doctor/dashboard      │
└──────────────────────────────────┘
```

### 2. Workflow d'examen & alerte

```
STEP 1: Admin uploads exam image
┌────────────────────────────────────┐
│ Form: /exams/new                   │
├────────────────────────────────────┤
│ • Select patient: [Dropdown]       │
│ • Select eye: [Left/Right/Both]    │
│ • Upload image: [Choose file]      │
│ • Doctor assigned: [Dropdown]      │
│ • [UPLOAD & ANALYZE]               │
└────┬───────────────────────────────┘
     │ POST /api/exams/upload
     │ Multipart: image
     │ Headers: Authorization
     ▼
┌────────────────────────────────────┐
│ PHP: File validation               │
├────────────────────────────────────┤
│ Check:                             │
│ • File size < 10MB                 │
│ • MIME type: image/jpeg|png        │
│ • Dimensions >= 512x512            │
│ • No malware                       │
│                                    │
│ Generate filename: exam_001.jpg    │
│ Save to: /uploads/exams/           │
└────┬───────────────────────────────┘
     │
     ├─► MySQL: INSERT exams
     │   (patient, doctor, image_path, status=pending)
     │
     ▼
STEP 2: PHP calls AI service

┌────────────────────────────────────┐
│ FastAPI /predict                   │
├────────────────────────────────────┤
│ POST /predict                      │
│ File: image (binary)               │
│ Auth: Internal API key             │
│                                    │
│ Process:                           │
│ 1. Load image                      │
│ 2. Preprocess (224x224)            │
│ 3. Forward ensemble (3 models)     │
│ 4. Soft voting                     │
│ 5. Temperature scaling             │
│ 6. Grad-CAM generation             │
│ 7. Save heatmap + overlay          │
│ 8. Return JSON                     │
└────┬───────────────────────────────┘
     │ HTTP 200 OK
     │ {
     │   "grade": 3,
     │   "confidence": 92.5,
     │   "heatmap_path": "/heatmaps/exam_001.png",
     │   "overlay_path": "/overlays/exam_001.png"
     │ }
     ▼
STEP 3: PHP updates exam record

┌────────────────────────────────────┐
│ MySQL UPDATE exams                 │
├────────────────────────────────────┤
│ SET:                               │
│ • grade = 3                        │
│ • confidence = 92.5                │
│ • heatmap_path = /heatmaps/...   │
│ • overlay_path = /overlays/...   │
│ • status = analyzed                │
│                                    │
│ WHERE id = exam_id                 │
└────┬───────────────────────────────┘
     │
     ├─ IS GRADE >= 3?
     │  YES ─────────────────────────┐
     │                               │
     │                              STEP 4: Create alert
     │                              
     │                              ┌──────────────────┐
     │                              │ MySQL: INSERT    │
     │                              ├──────────────────┤
     │                              │ INSERT alerts    │
     │                              │ SET:             │
     │                              │ • exam_id        │
     │                              │ • doctor_id      │
     │                              │ • type: urgent   │
     │                              │ • message        │
     │                              │ • is_read = 0    │
     │                              └────────┬─────────┘
     │                                       │
     │                          STEP 5: Broadcast WebSocket
     │                          
     │                          ┌──────────────────────┐
     │                          │ HTTP POST to Node.js │
     │                          ├──────────────────────┤
     │                          │ POST /ws/broadcast   │
     │                          │ Body: {              │
     │                          │   type: alert,       │
     │                          │   exam_id,           │
     │                          │   doctor_id,         │
     │                          │   grade: 3           │
     │                          │ }                    │
     │                          └────────┬─────────────┘
     │                                   │
     │                   STEP 6: Node.js broadcasts
     │                   
     │                   ┌──────────────────────────┐
     │                   │ ws.broadcast({           │
     │                   │   type: 'alert-raised',  │
     │                   │   message: 'New urgent'  │
     │                   │ })                       │
     │                   └────────┬─────────────────┘
     │                            │
     │          Connected browser receives notification
     │          • Browser popup
     │          • Sound alert
     │          • Dashboard refresh
     │          • Notification badge
     │
     │                     STEP 7: Send email
     │
     │                   ┌──────────────────────────┐
     │                   │ Nodemailer               │
     │                   ├──────────────────────────┤
     │                   │ To: doctor_email         │
     │                   │ Subject: Cas urgent      │
     │                   │ Template: alert_email.html
     │                   │ Data: patient name,      │
     │                   │       grade, confidence  │
     │                   │ Transport: TLS/SMTP      │
     │                   └────────────────────────┘
     │
     └──► Response: Exam created + alert sent
```

---

## 🚀 Infrastructure & Déploiement

### Topologie cible

La plateforme suit une architecture distribuée simple:
- Frontend hébergé sur Vercel
- Backend applicatif déployé sur Render
- Service d'intelligence artificielle déployé séparément sur Render
- Base de données gérée via Supabase PostgreSQL

La séparation entre le backend et le service IA améliore la maintenabilité, l'isolation des responsabilités et la scalabilité.

### Architecture d'hébergement

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FIREWALL / REVERSE PROXY                      │
│              (Nginx ou CloudFlare)                              │
├─────────────────────────────────────────────────────────────────┤
│ • SSL/TLS termination                                           │
│ • Rate limiting                                                 │
│ • DDoS protection                                               │
│ • Caching (static assets)                                       │
│ • Request routing                                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌─────────────┐ ┌──────────────┐ ┌─────────────┐
    │  Vercel     │ │  Render      │ │  Render    │
    │ Frontend    │ │ Backend API  │ │ AI Service  │
    │             │ │              │ │             │
    │ Web UI      │ │ Auth + CRUD  │ │ Predict +  │
    │ delivery    │ │ Emails + WS  │ │ Grad-CAM    │
    └────────┬────┘ └──────┬───────┘ └────────┬────┘
         │             │                  │
         └─────────┬───┴──────────────────┘
                   │ SQL queries
                   │ File I/O
                   ▼
         ┌──────────────────────┐
         │ Supabase PostgreSQL  │
         │ Managed Database     │
         │  Data persistence    │
         └──────────────────────┘

         File storage (Disk)
         ├── /uploads/exams/
         ├── /uploads/heatmaps/
         └── /uploads/overlays/
```

### Répartition des services
```
Frontend (Vercel)
├── UI publique
├── Pages de connexion et tableaux de bord
└── Requêtes HTTPS vers le backend

Backend API (Render)
├── Authentification et autorisation
├── CRUD patients / médecins / examens
├── Envoi d'emails et notifications
└── Orchestration des appels IA

AI Service (Render)
├── Prédiction des images
├── Génération Grad-CAM
└── Endpoint de health check

Database (Supabase)
├── centers
├── users
├── patients
├── exams
└── alerts
```

### Répartition réelle sur le terrain

#### Dans le centre médical
- Le poste administrateur est installé à l'accueil ou au secrétariat.
- Le poste de dépistage est placé dans la salle d'examen ou la zone de triage.
- Le navigateur web du poste sert à accéder au frontend hébergé sur Vercel.
- La caméra / l'appareil de fond d'œil est branché sur le poste de dépistage pour téléverser les images.
- Une imprimante ou un scanner peuvent être ajoutés si le centre a besoin de documents papier.

#### Dans le cabinet du médecin
- Le médecin utilise un ordinateur de consultation ou un ordinateur portable.
- Il accède au tableau de bord via le navigateur, sans serveur local à installer.
- Les alertes et examens arrivent depuis le backend cloud, ce qui garde le cabinet léger et simple à maintenir.

#### Dans le cloud
- Vercel héberge le frontend et les pages utilisateur.
- Render héberge le backend applicatif et le service IA, chacun comme service distinct.
- Supabase héberge la base de données PostgreSQL gérée.
- La base est partagée pour toute la plateforme, avec séparation logique par centre et par rôle; il n'existe pas une base physique différente pour chaque médecin.
- Le backend appelle un service IA centralisé pour l'analyse, puis stocke les résultats dans Supabase.

#### Logique d'installation
- Aucun composant serveur n'est installé physiquement dans le centre ou le cabinet.
- Les sites locaux ne gardent que les postes de travail, les écrans, et le matériel médical d'acquisition d'image.
- Tout ce qui est logique applicative, IA, sécurité d'accès et persistance est externalisé dans le cloud.
- En mode multi-centre, chaque centre accède à ses propres données via des règles d'accès applicatives, sans déployer une base locale ou un serveur IA par médecin.

### Fichiers de configuration importants

| Fichier | Localisation | Rôle |
|---------|-------------|------|
| **httpd.conf** | XAMPP/apache/conf/ | Apache configuration |
| **php.ini** | XAMPP/php/ | PHP settings |
| **.env** | Root + ai-service + ws-server | Credentials, ports, keys |
| **schema.sql** | /database/ | Database initialization |
| **requirements.txt** | /ai-service/ | Python packages |
| **package.json** | /ws-server/ + /backend/ | Node.js dependencies |

---

## 🔐 Sécurité & Authentification

### Authentication Flow (JWT)

```
1. LOGIN
   Client POST /api/auth/login
   Body: {email, password}
        │
        ▼
    Backend API: Validate credentials (bcrypt)
        │
        ▼ Generate JWT (HS256)
   Payload: {
     "user_id": 1,
     "role": "doctor",
     "center_id": 1,
     "email": "doctor@example.com",
     "iat": 1714942800,
     "exp": 1715029200    // +24 hours
   }
        │
        ▼ Generate Refresh Token (7 days)
   Store in MySQL: refresh_tokens table
        │
        ▼
   Response 200 OK: {
     "access_token": "eyJhbGc...",
     "refresh_token": "eyJhbGc...",
     "user": {...},
     "expires_in": 86400
   }

2. CLIENT STORAGE
   localStorage.accessToken = JWT
   localStorage.refreshToken = RTK

3. API REQUESTS
   GET /api/exams
   Headers: {
     "Authorization": "Bearer eyJhbGc...",
     "Content-Type": "application/json"
   }
        │
        ▼
    Backend API Middleware: Validate JWT
   • Extract token from header
   • Verify signature (secret key)
   • Check expiry
   • Extract claims
   • Proceed or return 401

4. TOKEN REFRESH
   If expired, POST /api/auth/refresh
   Body: {refresh_token: RTK}
        │
        ▼
    Backend API: Validate RTK
   • Check in MySQL
   • Verify not expired
   • Generate new JWT
        │
        ▼
   Response: {access_token: new_JWT}
```

### Role-Based Access Control (RBAC)

```
Roles & Permissions Matrix:

╔════════════════════╦═════════╦═════════╦═════════════╗
║ Resource           ║ Admin   ║ Doctor  ║ SuperAdmin  ║
╠════════════════════╬═════════╬═════════╬═════════════╣
║ Patients (own)     ║ CREATE  ║ READ    ║ READ        ║
║                    ║ READ    ║ (own)   ║ (all)       ║
║                    ║ UPDATE  ║         ║             ║
║                    ║ DELETE  ║         ║             ║
╠════════════════════╬═════════╬═════════╬═════════════╣
║ Exams (own)        ║ CREATE  ║ READ    ║ READ        ║
║                    ║ READ    ║ (own)   ║ (all)       ║
║                    ║ VIEW    ║ UPDATE  ║             ║
║                    ║ ANALYZE ║ COMMENT ║             ║
╠════════════════════╬═════════╬═════════╬═════════════╣
║ Alerts             ║ CREATE  ║ READ    ║ READ        ║
║                    ║ READ    ║ UPDATE  ║ (all)       ║
║                    ║         ║ RESOLVE ║             ║
╠════════════════════╬═════════╬═════════╬═════════════╣
║ Doctors            ║ MANAGE  ║ -       ║ MANAGE      ║
║                    ║ (center)║         ║ (all)       ║
╠════════════════════╬═════════╬═════════╬═════════════╣
║ Reports/Dashboard  ║ CENTER  ║ PERSONAL║ GLOBAL      ║
║                    ║ VIEW    ║ VIEW    ║ VIEW        ║
╚════════════════════╩═════════╩═════════╩═════════════╝

Middleware Implementation:
```php
function checkAccess($requiredRole, $resource) {
    $userRole = jwt_decode()['role'];
    $permissions = RBAC_MATRIX[$resource];
    
    if (!in_array($userRole, $permissions)) {
        http_response_code(403);
        die('Forbidden');
    }
}
```
```

### Data Protection

| Mesure | Implémentation | Bénéfice |
|--------|----------------|----------|
| **Password Hashing** | bcrypt (cost=10) | Secure against brute-force |
| **HTTPS/TLS** | SSL certificate | Encryption en transit |
| **CORS** | Whitelist domains | Prevent CSRF attacks |
| **HTTPS only** | SameSite=Strict cookies | Session fixation prevention |
| **Input Validation** | Sanitize + Type check | SQL injection prevention |
| **File Upload** | MIME + size check | Malware upload prevention |
| **HIPAA Compliance** | Data encryption at rest | Medical data protection |

---

## ⚡ Scalabilité & Performance

### Optimisations existantes

```
1. DATABASE
   ├── Indexes on frequently queried columns
   │   └── idx_doctor_grade_date (Exams)
   │   └── idx_center_role (Users)
   ├── Foreign key constraints (data integrity)
   ├── Prepared statements (SQL injection prevention)
   └── Connection pooling (MySQL Replication ready)

2. API CACHING
   ├── GET endpoints: HTTP Cache-Control headers
   ├── ETags for conditional requests
   ├── Browser cache: 1 hour assets
   └── API response caching: Optional (Redis)

3. IMAGE OPTIMIZATION
   ├── Resize on upload: 1024x1024 max
   ├── Compress JPEG: 85% quality
   ├── Lazy loading in dashboard
   └── CDN delivery (optional)

4. FRONTEND OPTIMIZATION
   ├── Minified CSS/JS
   ├── Async script loading
   ├── Debounced search (300ms)
   ├── Pagination: 20 items/page
   └── AJAX for dynamic updates

5. MODEL INFERENCE
   ├── GPU acceleration (CUDA)
   ├── Batch prediction (future)
   ├── Model quantization (optional)
   └── Caching predictions (optional)
```

### Scaling strategy (futur)

```
HORIZONTAL SCALING
├── Load Balancer (Nginx/HAProxy)
│   ├── Round-robin PHP servers
│   ├── Sticky sessions (JWT)
│   └── Health checks
│
├── Multiple PHP instances
│   ├── Server 1, 2, 3 (Port 80)
│   ├── Shared file storage (NFS)
│   └── Database replication (MySQL)
│
├── Multiple AI services
│   ├── FastAPI replicas (8000-8003)
│   ├── Queue (RabbitMQ/Celery)
│   └── Load balance predictions
│
└── Multiple WS servers
    ├── Redis pub/sub (broadcast)
    ├── Session sharing
    └── Horizontal scaling ready

VERTICAL SCALING
├── Upgrade server CPU/RAM
├── GPU tier upgrade (better models)
├── SSD storage (faster disk I/O)
└── Database optimization (better indices)

CACHING LAYERS
├── Redis (session + cache)
├── Memcached (distributed cache)
├── Browser cache (static assets)
└── CDN (geographic distribution)
```

---

## 📊 KPIs & Monitoring

### Métriques clés

| KPI | Localisation | Seuil | Alerte |
|-----|-------------|-------|--------|
| **Response Time** | PHP logs | < 500ms | > 1s |
| **Prediction Accuracy** | AI logs | > 95% | < 90% |
| **Alert Response Time** | WS logs | < 5s | > 10s |
| **Database Latency** | MySQL | < 50ms | > 100ms |
| **Error Rate** | App logs | < 0.1% | > 1% |
| **Uptime** | Monitoring | > 99.9% | < 99% |

### Monitoring & Logging

```
Application Logs
├── PHP: /logs/app.log
├── Node.js: /logs/ws.log
├── FastAPI: /logs/ai.log
└── MySQL: /var/log/mysql/error.log

Metrics
├── CPU usage (per process)
├── Memory usage (heap)
├── Disk I/O (image processing)
├── Network bandwidth
└── Database query times

Health Checks
├── GET /api/health → {status: ok}
├── MySQL connectivity test
├── File storage accessible test
└── External service reachability
```

---

## 🔗 Points d'intégration

### API REST Endpoints (PHP)

```
AUTH
├── POST /api/auth/login
├── POST /api/auth/logout
├── POST /api/auth/refresh
└── POST /api/auth/activate

PATIENTS (Admin/Doctor)
├── GET /api/patients
├── GET /api/patients/{id}
├── POST /api/patients (Admin only)
├── PUT /api/patients/{id}
├── DELETE /api/patients/{id}
└── GET /api/patients/{id}/exams

EXAMS
├── GET /api/exams
├── GET /api/exams/{id}
├── POST /api/exams (Upload)
├── PUT /api/exams/{id}
└── GET /api/exams/{id}/heatmap

ALERTS
├── GET /api/alerts
├── GET /api/alerts/{id}
├── PUT /api/alerts/{id}/read
├── PUT /api/alerts/{id}/resolve
└── DELETE /api/alerts/{id}

DASHBOARD
├── GET /api/dashboard/stats
├── GET /api/dashboard/charts
└── GET /api/dashboard/alerts
```

### External Services Integration

```
AI Service (FastAPI 8000)
├── POST /predict (image → grade)
├── POST /gradcam (image → heatmap)
└── GET /health

WebSocket Server (Node.js 8080)
├── WS /ws (real-time events)
├── POST /ws/broadcast (PHP push)
└── POST /ws/alert (email queue)

Email Service (SMTP)
├── Alert notifications
├── Account activation
└── Weekly reports
```

---

## 📝 Conclusion

Cette plateforme de dépistage automatisé combine:
- **Backend robuste** (PHP + MySQL)
- **IA avancée** (Ensemble + Calibration + XAI)
- **Real-time communication** (WebSocket)
- **Security** (JWT + RBAC)
- **Scalability** (Architecture microservices-ready)

Pour des questions ou clarifications, consultez les fichiers détaillés dans le workspace.
