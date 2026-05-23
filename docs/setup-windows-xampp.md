# Guide d'Installation - Windows + XAMPP

Ce guide détaille l'installation complète du système DR Screening sur Windows avec XAMPP.

## Prérequis

### 1. XAMPP

1. Télécharger XAMPP depuis [apachefriends.org](https://www.apachefriends.org/)
2. Installer avec les composants:
   - Apache
   - MySQL
   - PHP 8.x
   - phpMyAdmin

### 2. Python 3.10+

1. Télécharger depuis [python.org](https://www.python.org/downloads/)
2. **Important:** Cocher "Add Python to PATH" lors de l'installation

### 3. Node.js 18+

1. Télécharger LTS depuis [nodejs.org](https://nodejs.org/)
2. Installer avec les options par défaut

### 4. Git (optionnel)

Télécharger depuis [git-scm.com](https://git-scm.com/)

---

## Installation Étape par Étape

### Étape 1: Télécharger le Projet

```powershell
cd C:\xampp\htdocs
git clone <repo-url> diabetic-retinopathy
# OU extraire le ZIP dans C:\xampp\htdocs\diabetic-retinopathy
```

### Étape 2: Démarrer XAMPP

1. Ouvrir **XAMPP Control Panel**
2. Démarrer **Apache**
3. Démarrer **MySQL**

### Étape 3: Créer la Base de Données

#### Option A: Via phpMyAdmin

1. Ouvrir http://localhost/phpmyadmin
2. Créer nouvelle base: `dr_screening`
3. Onglet SQL → Copier/coller le contenu de `database/schema.sql`
4. Exécuter
5. Répéter avec `database/seeds.sql`

#### Option B: Via Terminal

```powershell
cd C:\xampp\htdocs\diabetic-retinopathy

# Ouvrir MySQL
C:\xampp\mysql\bin\mysql -u root

# Dans MySQL:
CREATE DATABASE dr_screening CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dr_screening;
SOURCE database/schema.sql;
SOURCE database/seeds.sql;
EXIT;
```

### Étape 4: Configurer l'Application PHP

```powershell
cd C:\xampp\htdocs\diabetic-retinopathy\php-app
copy .env.example .env
```

Éditer `.env` avec Notepad ou VS Code:

```env
# Database (XAMPP defaults)
DB_HOST=localhost
DB_PORT=3306
DB_NAME=dr_screening
DB_USER=root
DB_PASS=

# JWT - CHANGER EN PRODUCTION!
JWT_SECRET=votre-cle-secrete-tres-longue-minimum-32-caracteres

# SMTP (Gmail avec App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre-app-password-16-caracteres
SMTP_FROM=noreply@drscreening.com
SMTP_FROM_NAME=DR Screening

# Services
AI_SERVICE_URL=http://localhost:8000
WS_SERVICE_URL=http://localhost:8080
WS_API_KEY=internal-ws-api-key-change-this
```

#### Configuration Gmail App Password

1. Activer 2FA sur votre compte Google
2. Aller dans [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Créer un nouveau mot de passe d'application
4. Utiliser ce mot de passe (16 caractères) dans `SMTP_PASS`

### Étape 5: Créer les Dossiers d'Upload

```powershell
cd C:\xampp\htdocs\diabetic-retinopathy\php-app\public
mkdir uploads
mkdir uploads\exams
mkdir uploads\exams\2024
mkdir uploads\exams\2024\01
```

### Étape 6: Installer le Microservice IA

```powershell
cd C:\xampp\htdocs\diabetic-retinopathy\ai-service

# Créer environnement virtuel
python -m venv venv

# Activer
venv\Scripts\activate

# Installer dépendances
pip install -r requirements.txt

# Configurer
copy .env.example .env
```

Éditer `.env`:
```env
STUB_MODE=true
PORT=8000
HOST=0.0.0.0
```

### Étape 7: Installer le Serveur WebSocket

```powershell
cd C:\xampp\htdocs\diabetic-retinopathy\ws-server

npm install

copy .env.example .env
```

Éditer `.env`:
```env
PORT=8080
JWT_SECRET=même-valeur-que-php
INTERNAL_API_KEY=même-valeur-que-php
```

---

## Démarrage

### 1. XAMPP (Apache + MySQL)

Via XAMPP Control Panel, cliquer **Start** sur Apache et MySQL.

### 2. Microservice IA

```powershell
cd C:\xampp\htdocs\diabetic-retinopathy\ai-service
venv\Scripts\activate
python main.py
```

Vous devriez voir:
```
INFO - AI Service started on 0.0.0.0:8000
INFO - Stub mode: True
```

### 3. Serveur WebSocket

Ouvrir un **nouveau terminal**:

```powershell
cd C:\xampp\htdocs\diabetic-retinopathy\ws-server
npm start
```

Vous devriez voir:
```
[INFO] WebSocket server running on ws://0.0.0.0:8080
[INFO] Internal API running on http://0.0.0.0:8080
```

---

## Vérification

### Test Application PHP

Ouvrir: http://localhost/diabetic-retinopathy/php-app/public/login

Connexion:
- Email: `admin@centre-ophtalmo.fr`
- Mot de passe: `password123`

### Test Microservice IA

```powershell
curl http://localhost:8000/health
```

Réponse attendue:
```json
{"status":"ok"}
```

### Test WebSocket

```powershell
curl http://localhost:8080/health
```

Réponse attendue:
```json
{"status":"ok","clients":0,...}
```

---

## Scripts de Démarrage

Créer un fichier `start-all.bat` à la racine:

```batch
@echo off
echo Démarrage DR Screening...

:: Démarrer XAMPP Apache et MySQL
start "" "C:\xampp\xampp-control.exe"

:: Attendre 3 secondes
timeout /t 3

:: Démarrer AI Service
start "AI Service" cmd /k "cd /d C:\xampp\htdocs\diabetic-retinopathy\ai-service && venv\Scripts\activate && python main.py"

:: Démarrer WebSocket
start "WebSocket" cmd /k "cd /d C:\xampp\htdocs\diabetic-retinopathy\ws-server && npm start"

echo Tous les services démarrés!
echo.
echo URLs:
echo - Application: http://localhost/diabetic-retinopathy/php-app/public/login
echo - AI Service:  http://localhost:8000
echo - WebSocket:   http://localhost:8080
pause
```

---

## Résolution des Problèmes

### Apache ne démarre pas

**Port 80 occupé:**
1. Ouvrir CMD en admin: `netstat -ano | findstr :80`
2. Identifier le processus
3. Arrêter le processus ou changer le port Apache

**Changer le port:**
1. XAMPP → Config Apache → httpd.conf
2. Modifier `Listen 80` en `Listen 8081`
3. Modifier les URLs en conséquence

### MySQL ne démarre pas

**Port 3306 occupé:**
Même procédure, vérifier `netstat -ano | findstr :3306`

### Erreur "Class not found" en PHP

Vérifier que les extensions PHP sont activées dans `php.ini`:
```ini
extension=pdo_mysql
extension=openssl
extension=mbstring
```

### Python "not recognized"

1. Réinstaller Python en cochant "Add to PATH"
2. Ou ajouter manuellement: `C:\Users\<user>\AppData\Local\Programs\Python\Python310\`

### npm "not recognized"

Redémarrer le terminal après installation de Node.js.

### Connexion WebSocket échoue

1. Vérifier que le serveur WS est démarré
2. Vérifier que `JWT_SECRET` est identique dans PHP et WS
3. Vérifier la console du navigateur pour les erreurs

---

## Configuration Production

Pour la production:

1. **Désactiver le mode debug**
2. **Changer tous les secrets**
3. **Configurer HTTPS**
4. **Désactiver STUB_MODE pour l'IA**
5. **Configurer un vrai serveur SMTP**
6. **Activer les logs**

```env
# php-app/.env
APP_DEBUG=false
JWT_SECRET=production-secret-minimum-64-caracteres-aleatoires
```

```env
# ai-service/.env
STUB_MODE=false
MODEL_PATH=models/dr_model.h5
DEBUG=false
```
