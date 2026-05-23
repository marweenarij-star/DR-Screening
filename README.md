# DR Screening - Système de Dépistage de la Rétinopathie Diabétique

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![PHP](https://img.shields.io/badge/PHP-8.x-purple)
![Python](https://img.shields.io/badge/Python-3.10+-green)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

Système web complet pour le dépistage de la rétinopathie diabétique avec analyse IA et visualisation Grad-CAM.

## 📋 Table des Matières

- [Fonctionnalités](#-fonctionnalités)
- [Architecture](#-architecture)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Utilisation](#-utilisation)
- [API](#-api)
- [Structure du Projet](#-structure-du-projet)
- [Développement](#-développement)

## ✨ Fonctionnalités

### Portail Centre (Admin)
- 📋 Gestion des patients (CRUD complet)
- 👨‍⚕️ Gestion des médecins
- 📷 Upload d'images rétiniennes
- 🔬 Analyse IA automatique avec grading 0-4
- 📧 Alertes email pour cas urgents (grade ≥ 3)

### Tableau de Bord Médecin
- 📊 Statistiques et graphiques en temps réel
- 📋 Liste des examens triés par sévérité
- 🔍 Détails d'examen avec images Grad-CAM
- 🔔 Notifications temps réel (WebSocket)
- ⚠️ Gestion des alertes

### Microservice IA
- 🧠 Classification par deep learning (EfficientNet)
- 🔥 Visualisation Grad-CAM
- 🎯 Mode stub pour développement
- 📈 Pipeline d'entraînement inclus

## 🏗 Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │◄───►│  PHP App    │◄───►│   MySQL     │
└─────────────┘     │  (Apache)   │     │  Database   │
                    └──────┬──────┘     └─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Service │     │  WebSocket  │     │    SMTP     │
│  (FastAPI)  │     │  (Node.js)  │     │   Server    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 📦 Prérequis

- **XAMPP** (PHP 8.x + MySQL 8 + Apache)
- **Python** 3.10+
- **Node.js** 18+
- **Git**

## 🚀 Installation

### 1. Cloner le projet

```bash
cd C:\xampp\htdocs
git clone <repo-url> diabetic-retinopathy
cd diabetic-retinopathy
```

### 2. Base de données

```bash
# Ouvrir phpMyAdmin ou terminal MySQL
mysql -u root -p

# Créer la base et importer le schéma
CREATE DATABASE dr_screening;
USE dr_screening;
SOURCE database/schema.sql; 
SOURCE database/seeds.sql;
```

### 3. Application PHP

```bash
cd php-app
copy .env.example .env
# Éditer .env avec vos paramètres
```

### 4. Microservice IA

```bash
cd ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

### 5. Serveur WebSocket

```bash
cd ws-server
npm install
copy .env.example .env
```

## ⚙️ Configuration

### PHP (.env)

```env
# Database
DB_HOST=localhost
DB_NAME=dr_screening
DB_USER=root
DB_PASS=

# JWT
JWT_SECRET=votre-clé-secrète-très-longue

# SMTP (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-app-password
SMTP_FROM=noreply@drscreening.com
SMTP_FROM_NAME=DR Screening

# Services
AI_SERVICE_URL=http://localhost:8000
WS_SERVICE_URL=http://localhost:8080
WS_API_KEY=internal-ws-api-key
```

### AI Service (.env)

```env
STUB_MODE=true  # false en production avec modèle
MODEL_PATH=models/dr_model.h5
PORT=8000
```

### WebSocket (.env)

```env
PORT=8080
JWT_SECRET=même-clé-que-php
INTERNAL_API_KEY=même-clé-que-php
```

## 🎯 Utilisation

### Démarrer les services

```bash
# 1. Apache + MySQL (via XAMPP Control Panel)

# 2. Microservice IA
cd ai-service
venv\Scripts\activate
python main.py

# 3. WebSocket Server
cd ws-server
npm start
```

### Accès

- **Portail Centre**: http://localhost/diabetic-retinopathy/php-app/public/login
- **Dashboard Médecin**: http://localhost/diabetic-retinopathy/php-app/public/doctor/login

### Comptes de test

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@centre-ophtalmo.fr | password123 |
| Médecin | dr.martin@centre-ophtalmo.fr | password123 |
| Médecin | dr.dubois@centre-ophtalmo.fr | password123 |

## 📚 API

Voir [docs/api.md](docs/api.md) pour la documentation complète de l'API.

### Endpoints principaux

```
POST /api/auth/login          - Connexion
GET  /api/patients            - Liste patients
POST /api/exams               - Créer examen
GET  /api/doctor/exams        - Examens du médecin
GET  /api/doctor/alerts       - Alertes
```

## 📁 Structure du Projet

```
diabetic-retinopathy/
├── php-app/                 # Application PHP principale
│   ├── public/              # Point d'entrée web
│   │   ├── index.php        # Router
│   │   ├── css/             # Styles
│   │   ├── js/              # JavaScript
│   │   └── uploads/         # Images uploadées
│   └── src/
│       ├── config/          # Configuration
│       ├── controllers/     # Contrôleurs
│       ├── middleware/      # Middleware (Auth)
│       ├── services/        # Services (DB, JWT, Mail, AI)
│       └── views/           # Vues PHP
│
├── ai-service/              # Microservice IA (FastAPI)
│   ├── main.py              # Point d'entrée
│   ├── gradcam.py           # Génération Grad-CAM
│   ├── train.py             # Script d'entraînement
│   └── models/              # Modèles entraînés
│
├── ws-server/               # Serveur WebSocket (Node.js)
│   └── server.js            # Serveur WS
│
├── database/                # Scripts SQL
│   ├── schema.sql           # Schéma de la base
│   └── seeds.sql            # Données de test
│
└── docs/                    # Documentation
    ├── api.md               # Documentation API
    ├── architecture.md      # Architecture détaillée
    └── setup-windows-xampp.md
```

## 🔧 Développement

### Mode Stub IA

Le microservice IA fonctionne en mode stub par défaut, générant des prédictions aléatoires. Pour utiliser un vrai modèle :

1. Préparer les données dans le format requis
2. Entraîner le modèle :
   ```bash
   python train.py --data-dir /path/to/data --pretrained --fine-tune
   ```
3. Configurer `MODEL_PATH` et désactiver `STUB_MODE`

### Entraînement du modèle

Structure des données attendue :
```
data/
├── 0/    # Pas de RD
├── 1/    # RD légère
├── 2/    # RD modérée
├── 3/    # RD sévère
└── 4/    # RD proliférante
```

### Palette de couleurs

- **Primary**: `#00897b` (Teal)
- **Primary Dark**: `#00695c`
- **Primary Light**: `#4db6ac`
- **Success**: `#43a047` (Grade 0)
- **Info**: `#1e88e5` (Grade 1)
- **Warning**: `#fb8c00` (Grade 2)
- **Danger**: `#e53935` (Grade 3)
- **Critical**: `#b71c1c` (Grade 4)

## 📄 Licence

Ce projet est sous licence MIT.

## 👥 Auteurs

Développé pour le dépistage de la rétinopathie diabétique.
