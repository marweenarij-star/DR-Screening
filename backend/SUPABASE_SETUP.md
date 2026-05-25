# Configuration Backend Supabase

## Étape 1 : Récupérer les clés Supabase

1. **Accède au tableau de bord Supabase** :
   - URL: https://hewhoohhxuhouxiaofnt.supabase.co
   - Connecte-toi avec tes credentials

2. **Trouve tes clés** :
   - Clique sur **Settings** (⚙️ en bas à gauche)
   - Sélectionne **API** dans la section Configuration
   - Tu trouveras :
     - **Project URL** → `SUPABASE_URL`
     - **anon public** → `SUPABASE_ANON_KEY`
     - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`
   - **Important** : le backend doit utiliser uniquement la clé `service_role`.
     La clé publishable / anon ne peut pas écrire dans les tables protégées par RLS.

3. **Récupère DATABASE_URL** (pour migrations/seeds via CI/CD) :
   - Va dans **Settings > Database**
   - Clique **Connection Pooling** ou **Direct Connection**
   - Copie la connection string PostgreSQL
   - Format: `postgresql://postgres:[PASSWORD]@db.hewhoohhxuhouxiaofnt.supabase.co:5432/postgres`

## Étape 2 : Configurer le backend

1. **Crée le fichier `.env`** (à partir du template) :
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Remplis les valeurs réelles** :
   ```env
   SUPABASE_URL=https://hewhoohhxuhouxiaofnt.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   DATABASE_URL=postgresql://postgres:232019Mouch%401@db.hewhoohhxuhouxiaofnt.supabase.co:5432/postgres
   AI_SERVICE_URL=http://localhost:8000
   APP_URL=http://localhost:3000
   NODE_ENV=development
   PORT=3000
   ```

3. **Ne commite JAMAIS `.env`** (contient des secrets) :
   - `.env` est dans `.gitignore`
   - Seul `.env.example` est versionné

## Étape 3 : Tester la connexion

```bash
cd backend
npm install  # Si pas déjà fait
npm test     # Ou: node -e "require('./src/services/supabaseClient.js'); console.log('✅ Connected to Supabase')"
```

## Étape 4 : Mode Hybride - Logique Backend

Le backend doit maintenant vérifier **`centers.mode`** pour adapter le comportement :

### Mode: `full_platform`
- ✅ Toutes les données stockées dans Supabase immédiatement
- ✅ Pas de base locale (SQLite désactivée)
- ✅ Synchronisation centralisée

### Mode: `integration`
- ✅ Patients/Exams stockés localement (SQLite)
- ✅ Seuls les résultats IA synchronisés vers Supabase
- ✅ Infrastructure locale maintenue

**À implémenter dans** `backend/src/routes/exams.js` et `backend/src/routes/patients.js` :
```javascript
const { supabase } = require('../services/supabaseClient');

// Récupère le mode du centre
const center = await db.query('SELECT mode FROM centers WHERE id = ?', [centerId]);

if (center.mode === 'full_platform') {
  // Stocke dans Supabase
  const { data, error } = await supabase
    .from('exams')
    .insert([examData]);
} else {
  // Stocke localement
  await db.insert('exams', examData);
}
```

## Étape 5 : Configuration GitHub Secrets (CI/CD)

Pour que GitHub Actions déploie les migrations automatiquement :

1. Va sur ton repo GitHub
2. **Settings > Secrets and variables > Actions**
3. Crée deux secrets :
   - `DATABASE_URL`: `postgresql://postgres:232019Mouch%401@db.hewhoohhxuhouxiaofnt.supabase.co:5432/postgres`
   - `RUN_DB_SEEDS`: `false` (ou `true` si tu veux repeupler à chaque push)

Alors, chaque push à `main` exécutera `.github/workflows/deploy-supabase.yml` automatiquement.

## ✅ Checklist Déploiement

- [ ] Clés Supabase récupérées
- [ ] `.env` configuré avec valeurs réelles
- [ ] Connexion testée (`npm test`)
- [ ] GitHub Secrets configurés
- [ ] Mode hybride compris
- [ ] Backend prêt pour les implémentations mode-spécifiques
