# Architecture Système

## Vue d'ensemble

Le système DR Screening est une plateforme web distribuée simple et maintenable pour le dépistage de la rétinopathie diabétique. Le frontend est hébergé sur Vercel, le backend applicatif et le service d'intelligence artificielle sont déployés sur Render, et la base de données est gérée via Supabase. Cette séparation entre le backend et le service IA améliore la maintenabilité, la scalabilité et l'isolation des responsabilités.

## Diagramme d'Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                 Vercel-hosted Web UI (HTML/CSS/JS)              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │    │
│  │  │ Login Page  │  │ Admin       │  │ Doctor Dashboard        │  │    │
│  │  │             │  │ Centre UI   │  │ - Priority exams        │  │    │
│  │  │             │  │ - Patients  │  │ - Exam detail           │  │    │
│  │  │             │  │ - Doctors   │  │ - Alerts                │  │    │
│  │  │             │  │ - History   │  │ - Follow-up actions     │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │ HTTPS / WS                                 │
└──────────────────────────────┼──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                Application API (Render deployment)               │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │   │
│  │  │   Router   │  │Controllers │  │  Services  │  │  Auth/WS  │  │   │
│  │  │            │  │            │  │            │  │ Integration│   │   │
│  │  │ /api/*     │─►│ Patients   │─►│ Database   │  │ JWT + mail │   │   │
│  │  │            │  │ Doctors    │  │ Supabase   │  │ events     │   │   │
│  │  │            │  │ Exams      │  │ AI Client  │  │ notifications│  │   │
│  │  │            │  │ Alerts     │  │ Mail       │  │            │   │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         │                    │                    │                      │
│         ▼                    ▼                    ▼                      │
│  ┌────────────┐       ┌────────────┐       ┌────────────┐               │
│  │ Supabase   │       │ AI Service │       │ WebSocket  │               │
│  │ PostgreSQL │       │  (Render)  │       │  (Render)  │               │
│  │            │       │            │       │            │               │
│  │ - centers  │       │ - predict  │       │ - auth     │               │
│  │ - users    │       │ - gradcam  │       │ - broadcast│               │
│  │ - patients │       │ - inference│       │ - realtime │               │
│  │ - exams    │       │            │       │            │               │
│  │ - alerts   │       │            │       │            │               │
│  └────────────┘       └────────────┘       └────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Composants

### 1. Frontend Vercel

**Responsabilités:**
- Hébergement de l'interface web
- Navigation rapide et responsive
- Consommation de l'API backend via HTTPS
- Support des parcours admin et médecin

**Technologies:**
- HTML/CSS/JavaScript
- Déploiement statique/SSR selon la configuration Vercel

**Points d'entrée:**
- Pages dashboard et flux utilisateur

### 2. Backend API sur Render

**Responsabilités:**
- Authentification et gestion des sessions JWT
- CRUD patients, médecins, examens
- Orchestration des appels au service IA
- Envoi des emails et notifications temps réel
- Application des règles d'accès par rôle

**Technologies:**
- Node.js / services backend existants
- API REST sécurisée par JWT
- Intégration WebSocket et mail

**Points d'entrée:**
- `/api/*` - Endpoints applicatifs
- `/health` - Vérification de disponibilité

### 3. Base de Données Supabase

**Schéma:**

```
centers
├── id (PK)
├── name
├── address
├── phone
├── email
└── created_at

users
├── id (PK)
├── center_id (FK → centers)
├── email
├── password_hash
├── first_name
├── last_name
├── role (center_admin | doctor)
└── created_at

patients
├── id (PK)
├── center_id (FK → centers)
├── medical_record_number
├── first_name
├── last_name
├── birth_date
├── gender
├── phone
├── email
└── created_at

exams
├── id (PK)
├── patient_id (FK → patients)
├── doctor_id (FK → users)
├── image_path
├── grade (0-4)
├── confidence
├── gradcam_path
├── gradcam_overlay_path
├── notes
└── created_at

alerts
├── id (PK)
├── exam_id (FK → exams)
├── doctor_id (FK → users)
├── type (urgent | info)
├── message
├── read_at
├── resolved_at
├── resolution_note
└── created_at
```

### 4. Service IA sur Render

**Responsabilités:**
- Classification des images rétiniennes (grades 0-4)
- Génération de visualisations Grad-CAM
- Mode stub pour développement

**Technologies:**
- Python 3.10+
- FastAPI
- TensorFlow/Keras
- OpenCV

**Endpoints:**
- `POST /predict` - Analyse d'image
- `POST /gradcam` - Génération heatmap
- `GET /health` - Health check

**Mode Stub:**
Génère des prédictions aléatoires avec distribution réaliste pour le développement sans modèle entraîné.

### 5. Serveur WebSocket sur Render

**Responsabilités:**
- Connexions persistantes avec les clients
- Authentification JWT
- Broadcast des notifications temps réel

**Technologies:**
- Node.js 18+
- ws (WebSocket library)
- jsonwebtoken

**Messages:**
```javascript
// Client → Server
{ type: "auth", token: "jwt-token" }
{ type: "ping" }

// Server → Client
{ type: "welcome", message: "..." }
{ type: "authenticated", userId: 1 }
{ type: "new_exam", patient_name: "...", grade: 3 }
{ type: "new_alert", message: "...", exam_id: 1 }
```

## Flux de Données

### Flux: Création d'Examen

```
1. Utilisateur upload image
          │
          ▼
2. PHP reçoit l'image
   └─► Sauvegarde locale
          │
          ▼
3. PHP appelle AI Service
   └─► POST /predict (image)
          │
          ▼
4. AI retourne grade + confidence
   └─► PHP télécharge Grad-CAM
          │
          ▼
5. PHP crée enregistrement exam
   └─► INSERT INTO exams
          │
          ▼
6. Si grade >= 3:
   ├─► Créer alerte
   ├─► Envoyer email SMTP
   └─► Notifier via WebSocket
          │
          ▼
7. Retourner résultat au client
```

### Flux: Authentification

```
1. POST /api/auth/login
   └─► email + password
          │
          ▼
2. Vérification credentials
   └─► bcrypt verify
          │
          ▼
3. Génération JWT (8h)
   └─► HS256 signature
          │
          ▼
4. Client stocke token
   └─► localStorage
          │
          ▼
5. Requêtes API
   └─► Authorization: Bearer <token>
          │
          ▼
6. Middleware vérifie JWT
   └─► Extraction user_id, role
```

## Sécurité

### Authentification
- JWT avec signature HS256
- Expiration 8 heures
- Refresh tokens (optionnel)

### Autorisation
- Role-based: `center_admin`, `doctor`
- Isolation par `center_id`
- Middleware de vérification

### Protection
- Passwords hashés (bcrypt)
- Préparation SQL (PDO)
- Validation des uploads
- CORS configuré

## Déploiement cible

### Frontend
- Hébergé sur Vercel
- Optimisé pour chargement rapide et navigation fluide
- Variables d'environnement dédiées pour l'URL de l'API backend

### Backend
- Déployé sur Render
- Expose l'API métier, l'authentification, les emails et les notifications
- Communique uniquement avec le service IA via HTTP interne/externe sécurisé

### Service IA
- Déployé séparément sur Render
- Un seul service IA centralisé pour tous les centres, ce qui évite de dupliquer le modèle pour chaque clinique ou cabinet
- Reçoit les images à analyser depuis le backend
- Retourne la prédiction, la confiance et les données Grad-CAM
- Le backend transmet aussi les métadonnées utiles comme le centre, le patient et le médecin, afin de garder le suivi multi-centre cohérent

### Base de données
- Supabase PostgreSQL hébergé dans le cloud
- Base partagée pour toute la plateforme, avec séparation logique par `center_id` et par rôle
- Le centre et le médecin n'ont pas chacun une base physique locale distincte; ils accèdent à la même base via l'application et les permissions
- Support du scaling managé, des sauvegardes intégrées et des politiques de sécurité centralisées

### Cas réel en multi-centre
- Chaque centre médical voit uniquement ses patients, ses examens et ses médecins rattachés
- Le médecin n'héberge pas sa propre base de données: il consulte ses dossiers depuis le backend central
- L'isolation entre centres est assurée par les règles applicatives et la colonne `center_id`, pas par des serveurs de base séparés
- Cette approche simplifie le déploiement, réduit les coûts et facilite la maintenance

## Répartition Réelle Sur Le Terrain

### Au centre médical
- Poste administrateur à l'accueil ou au secrétariat: navigateur web pour accéder au frontend Vercel.
- Salle de dépistage: ordinateur ou tablette relié au navigateur pour saisir les patients et envoyer les examens.
- Caméra / appareil de fond d'œil: connecté localement au poste de dépistage pour charger les images dans l'application.
- Imprimante / scanner: optionnels, utiles pour les documents patients.

### Au cabinet du médecin
- Ordinateur portable ou poste de consultation: accès au tableau de bord médecin via Vercel.
- Aucun serveur local obligatoire: le médecin consulte les examens et alertes depuis son navigateur.
- Connexion internet stable recommandée pour recevoir les notifications et ouvrir les dossiers rapidement.

### Dans le cloud
- Vercel héberge l'interface web publique et les tableaux de bord.
- Render héberge le backend applicatif ainsi que le service IA, mais dans deux services séparés.
- Supabase héberge la base de données PostgreSQL de manière managée.
- Le backend échange avec le service IA par API HTTP, puis enregistre les résultats dans Supabase.

### Principe pratique
- Les centres et cabinets n'installent pas de serveur applicatif local.
- Le matériel local sert seulement à consulter l'application et à capturer / charger les images médicales.
- Toute la logique métier, l'IA et la base de données restent centralisées dans le cloud pour simplifier la maintenance.

## Procedure De Deploiement (Etapes + Fichiers)

### Etape 1 - Verifier et preparer le backend
- Objectif: s'assurer que l'API demarre correctement en production.
- Fichiers concernes:
   - `backend/package.json` (scripts start/dev et dependances)
   - `backend/src/server.js` (point d'entree applicatif)
   - `backend/.env` (variables d'environnement backend)

### Etape 2 - Configurer la base Supabase
- Objectif: disposer d'une base PostgreSQL managée pour tous les centres.
- Fichiers concernes:
   - `database/schema.sql` (structure des tables)
   - `database/seeds.sql` (donnees initiales, si necessaire)
   - `backend/.env` (identifiants/URL de connexion a la base)

### Etape 3 - Deployer le backend sur Render
- Objectif: exposer l'API backend via HTTPS.
- Fichiers concernes:
   - `backend/package.json` (commande de demarrage)
   - `backend/.env` (variables de production: JWT, SMTP, DB, IA)
   - `backend/src/routes/*` (verification des routes API utilisees)

### Etape 4 - Configurer et deployer le service IA sur Render
- Objectif: rendre disponible le service d'inference independamment du backend.
- Fichiers concernes:
   - `ai-service/requirements.txt` (dependances Python)
   - `ai-service/main.py` (point d'entree FastAPI)
   - `ai-service/.env.example` (modele de configuration a copier vers `.env`)

### Etape 5 - Connecter backend et IA
- Objectif: faire communiquer l'API metier avec le service IA deploye.
- Fichiers concernes:
   - `backend/.env` (variable `AI_SERVICE_URL` vers l'URL Render du service IA)
   - `backend/src/services/aiService.js` (client HTTP vers l'IA)

### Etape 6 - Deployer le frontend sur Vercel
- Objectif: publier l'interface utilisateur admin/medecin.
- Fichiers concernes:
   - `backend/public/views/*` (pages HTML)
   - `backend/public/css/app.css` (design system)
   - `backend/public/js/app.js` (client API/auth)

### Etape 7 - Configurer les URLs de production
- Objectif: lier frontend, backend et emails avec les bons domaines.
- Fichiers concernes:
   - `backend/.env` (APP_URL, SMTP_*, AI_SERVICE_URL)
   - `backend/src/services/mailService.js` (contenu et liens emails)

### Etape 8 - Validation finale et mise en service
- Objectif: verifier les parcours critiques avant ouverture aux centres.
- Fichiers concernes:
   - `backend/DEPLOYMENT_CHECKLIST.md` (checklist de verification)
   - `backend/test-api.ps1` (tests API rapides)
   - `backend/test-email.js` (test envoi email)

### Etape 9 - Exploitation multi-centre
- Objectif: garantir l'isolation logique des donnees par centre.
- Fichiers concernes:
   - `backend/src/middleware/auth.js` (controle JWT/roles)
   - `backend/src/routes/*` (filtres par `center_id`)
   - `database/schema.sql` (relations entre centres, users, patients, exams)

### Resume pratique
- Le centre et le medecin utilisent un navigateur (aucun serveur local requis).
- Le backend et l'IA sont deploiables et scalables separement sur Render.
- La base Supabase est unique, partagee, et isolee logiquement par centre.

## Scalabilité

### Horizontal
- Frontend Vercel: distribution CDN native
- Backend Render: multiple instances selon la charge
- AI Service Render: workers isolés pour l'inférence
- WebSocket: déploiement dédié avec montée en charge indépendante

### Vertical
- GPU pour inference IA
- SSD pour stockage images
- RAM pour cache applicatif

## Monitoring

### Health Checks
- PHP: `GET /api/health`
- AI: `GET /health`
- WS: `GET /health`

### Logs
- PHP: Error log Apache
- AI: stdout avec niveau configurable
- WS: stdout structuré

### Métriques
- WebSocket: connexions, messages
- AI: temps d'inférence
- MySQL: query performance
