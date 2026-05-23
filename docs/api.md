# Documentation API

Base URL: `http://localhost/diabetic-retinopathy/php-app/public/api`

## Authentification

Toutes les routes protégées requièrent un header `Authorization: Bearer <token>`.

### POST /auth/login

Connexion utilisateur.

**Request:**
```json
{
    "email": "admin@centre-ophtalmo.fr",
    "password": "password123"
}
```

**Response (200):**
```json
{
    "success": true,
    "data": {
        "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
        "expires_at": "2024-01-15T18:00:00Z",
        "user": {
            "id": 1,
            "email": "admin@centre-ophtalmo.fr",
            "first_name": "Admin",
            "last_name": "Centre",
            "role": "center_admin",
            "center_id": 1
        }
    }
}
```

**Errors:**
- `401` - Identifiants invalides

---

### GET /auth/verify

Vérifie la validité du token.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "valid": true,
        "user": { ... }
    }
}
```

---

### POST /auth/logout

Déconnexion (invalide le refresh token si utilisé).

**Response (200):**
```json
{
    "success": true,
    "message": "Déconnexion réussie"
}
```

---

## Patients

### GET /patients

Liste les patients du centre.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 1 | Numéro de page |
| per_page | int | 20 | Éléments par page |
| search | string | - | Recherche nom/prénom/dossier |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "patients": [
            {
                "id": 1,
                "medical_record_number": "DM-2024-001",
                "first_name": "Jean",
                "last_name": "Dupont",
                "birth_date": "1965-03-15",
                "gender": "M",
                "phone": "+33612345678",
                "email": "jean.dupont@email.fr",
                "exam_count": 3,
                "last_exam_date": "2024-01-10"
            }
        ],
        "pagination": {
            "current_page": 1,
            "per_page": 20,
            "total": 45,
            "total_pages": 3
        }
    }
}
```

---

### GET /patients/:id

Détails d'un patient.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "medical_record_number": "DM-2024-001",
        "first_name": "Jean",
        "last_name": "Dupont",
        "birth_date": "1965-03-15",
        "gender": "M",
        "phone": "+33612345678",
        "email": "jean.dupont@email.fr",
        "created_at": "2024-01-01T10:00:00Z",
        "exams": [
            {
                "id": 1,
                "grade": 2,
                "confidence": 87.5,
                "created_at": "2024-01-10T14:30:00Z"
            }
        ]
    }
}
```

---

### POST /patients

Créer un patient.

**Request:**
```json
{
    "first_name": "Marie",
    "last_name": "Martin",
    "birth_date": "1970-05-20",
    "gender": "F",
    "phone": "+33698765432",
    "email": "marie.martin@email.fr"
}
```

**Response (201):**
```json
{
    "success": true,
    "data": {
        "id": 11,
        "medical_record_number": "DM-2024-011",
        ...
    }
}
```

---

### PUT /patients/:id

Modifier un patient.

**Request:** (champs optionnels)
```json
{
    "phone": "+33611223344"
}
```

---

### DELETE /patients/:id

Supprimer un patient.

**Response (200):**
```json
{
    "success": true,
    "message": "Patient supprimé"
}
```

---

## Médecins

### GET /doctors

Liste les médecins du centre.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "doctors": [
            {
                "id": 2,
                "email": "dr.martin@centre-ophtalmo.fr",
                "first_name": "Sophie",
                "last_name": "Martin",
                "role": "doctor",
                "exam_count": 25,
                "last_exam_date": "2024-01-14"
            }
        ],
        "pagination": { ... }
    }
}
```

---

### POST /doctors

Créer un médecin.

**Request:**
```json
{
    "email": "dr.nouveau@centre-ophtalmo.fr",
    "password": "motdepasse123",
    "first_name": "Pierre",
    "last_name": "Nouveau"
}
```

---

### PUT /doctors/:id

Modifier un médecin.

---

### DELETE /doctors/:id

Supprimer un médecin.

---

## Examens

### POST /exams

Créer un examen avec analyse IA.

**Request (multipart/form-data):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | file | ✓ | Image rétinienne (JPEG/PNG) |
| patient_id | int | ✓ | ID du patient |
| doctor_id | int | ✓ | ID du médecin |
| eye_type | string | - | "left" ou "right" |
| notes | string | - | Notes libres |

**Response (201):**
```json
{
    "success": true,
    "data": {
        "id": 15,
        "patient_id": 1,
        "doctor_id": 2,
        "grade": 3,
        "confidence": 89.5,
        "grade_label": "RD sévère",
        "is_urgent": true,
        "image_path": "/uploads/exams/2024/01/exam_15.jpg",
        "gradcam_path": "/uploads/exams/2024/01/gradcam_15.png",
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

---

### GET /exams/:id

Détails d'un examen.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "id": 15,
        "grade": 3,
        "confidence": 89.5,
        "eye_type": "left",
        "notes": null,
        "image_url": "/diabetic-retinopathy/php-app/public/uploads/exams/2024/01/exam_15.jpg",
        "heatmap_url": "/diabetic-retinopathy/php-app/public/uploads/exams/2024/01/gradcam_15.png",
        "overlay_url": null,
        "patient": {
            "id": 1,
            "first_name": "Jean",
            "last_name": "Dupont",
            "medical_record_number": "DM-2024-001",
            "birth_date": "1965-03-15",
            "gender": "M"
        },
        "doctor": {
            "id": 2,
            "first_name": "Sophie",
            "last_name": "Martin"
        },
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

---

## Doctor Endpoints

### GET /doctor/exams

Liste des examens pour le médecin connecté.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | int | Numéro de page |
| search | string | Recherche patient |
| grade | int | Filtrer par grade (0-4) |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "exams": [
            {
                "id": 15,
                "patient_name": "Jean Dupont",
                "patient_age": 58,
                "medical_record_number": "DM-2024-001",
                "grade": 3,
                "grade_label": "RD sévère",
                "grade_class": "badge-danger",
                "confidence": 89.5,
                "is_urgent": true,
                "created_at": "2024-01-15T10:30:00Z"
            }
        ],
        "pagination": { ... }
    }
}
```

**Note:** Les examens sont triés par grade DESC puis date DESC.

---

### GET /doctor/exams/:id

Détails d'un examen.

---

### GET /doctor/stats

Statistiques du tableau de bord.

**Response (200):**
```json
{
    "success": true,
    "data": {
        "total_exams": 50,
        "severe_cases": 12,
        "unread_alerts": 3,
        "exams_today": 5,
        "grade_distribution": [
            { "grade": 0, "label": "Pas de RD", "count": 15 },
            { "grade": 1, "label": "RD légère", "count": 12 },
            { "grade": 2, "label": "RD modérée", "count": 11 },
            { "grade": 3, "label": "RD sévère", "count": 8 },
            { "grade": 4, "label": "RD proliférante", "count": 4 }
        ],
        "weekly_trend": [
            { "date": "2024-01-09", "count": 6 },
            { "date": "2024-01-10", "count": 8 },
            { "date": "2024-01-11", "count": 5 }
        ]
    }
}
```

---

### GET /doctor/alerts

Liste des alertes.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | "unread", "read", "resolved" |
| page | int | Numéro de page |

**Response (200):**
```json
{
    "success": true,
    "data": {
        "alerts": [
            {
                "id": 5,
                "type": "urgent",
                "message": "Rétinopathie sévère détectée (Grade 3) - Confiance: 89.5%",
                "exam_id": 15,
                "exam": {
                    "id": 15,
                    "grade": 3,
                    "confidence": 89.5
                },
                "patient": {
                    "id": 1,
                    "first_name": "Jean",
                    "last_name": "Dupont",
                    "medical_record_number": "DM-2024-001"
                },
                "read_at": null,
                "resolved_at": null,
                "created_at": "2024-01-15T10:30:00Z"
            }
        ],
        "counts": {
            "all": 10,
            "unread": 3,
            "read": 4,
            "resolved": 3
        },
        "pagination": { ... }
    }
}
```

---

### PUT /doctor/alerts/:id/read

Marquer une alerte comme lue.

---

### PUT /doctor/alerts/:id/resolve

Résoudre une alerte.

**Request:**
```json
{
    "resolution_note": "Patient contacté, rendez-vous pris pour le 20/01"
}
```

---

## Codes d'Erreur

| Code | Description |
|------|-------------|
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Accès interdit |
| 404 | Ressource non trouvée |
| 422 | Erreur de validation |
| 500 | Erreur serveur |

**Format d'erreur:**
```json
{
    "success": false,
    "error": "Description de l'erreur"
}
```

---

## AI Service API

Base URL: `http://localhost:8000`

### POST /predict

Analyse d'image rétinienne.

**Request (multipart/form-data):**
| Field | Type | Description |
|-------|------|-------------|
| image | file | Image JPEG/PNG |
| include_gradcam | bool | Inclure URL Grad-CAM |

**Response (200):**
```json
{
    "grade": 2,
    "confidence": 87.5,
    "label": "Moderate",
    "probabilities": {
        "0": 0.05,
        "1": 0.08,
        "2": 0.875,
        "3": 0.04,
        "4": 0.005
    },
    "gradcam_available": true,
    "stub_mode": false
}
```

---

### POST /gradcam

Génère la visualisation Grad-CAM.

**Request (multipart/form-data):**
| Field | Type | Description |
|-------|------|-------------|
| image | file | Image JPEG/PNG |
| target_class | int | Classe cible (0-4), optionnel |

**Response:** Image PNG

---

## WebSocket API

URL: `ws://localhost:8080`

### Connection Flow

1. Connecter au WebSocket
2. Recevoir message `welcome`
3. Envoyer `auth` avec JWT
4. Recevoir `authenticated` ou `error`

### Messages Client → Serveur

**Authentification:**
```json
{
    "type": "auth",
    "token": "jwt-token"
}
```

**Ping:**
```json
{
    "type": "ping"
}
```

### Messages Serveur → Client

**Welcome:**
```json
{
    "type": "welcome",
    "message": "Connected to DR Screening WebSocket Server",
    "serverTime": "2024-01-15T10:00:00Z"
}
```

**Authenticated:**
```json
{
    "type": "authenticated",
    "userId": 2,
    "role": "doctor"
}
```

**Nouvel Examen:**
```json
{
    "type": "new_exam",
    "exam_id": 15,
    "patient_name": "Jean Dupont",
    "grade": 3,
    "is_urgent": true
}
```

**Nouvelle Alerte:**
```json
{
    "type": "new_alert",
    "alert_id": 5,
    "message": "Rétinopathie sévère détectée",
    "exam_id": 15
}
```
