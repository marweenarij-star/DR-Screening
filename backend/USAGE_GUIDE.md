# 📖 GUIDE D'UTILISATION - Section Support & Assistance

## Table des Matières
1. [Vue d'ensemble](#vue-densemble)
2. [KPI Dashboard](#kpi-dashboard)
3. [Recherche](#recherche)
4. [Filtres Avancés](#filtres-avancés)
5. [Tri des Tickets](#tri-des-tickets)
6. [Actions sur Tickets](#actions-sur-tickets)
7. [Scénarios Réels](#scénarios-réels)
8. [Raccourcis](#raccourcis)

---

## 🎯 Vue d'Ensemble

La section Support & Assistance est maintenant divisée en **3 zones principales** :

```
┌─────────────────────────────────────────────────┐
│  1️⃣  KPI DASHBOARD (4 cartes statistiques)      │
├─────────────────────────────────────────────────┤
│  2️⃣  BARRE RECHERCHE (search multi-champs)      │
│  3️⃣  FILTRES AVANCÉS (statut, priorité, tri)   │
│  4️⃣  BOUTONS STATUS (À traiter, En cours, OK)  │
├─────────────────────────────────────────────────┤
│  5️⃣  LISTE DES TICKETS                         │
│      - Chaque ticket = card avec toutes infos  │
│      - Couleurs et indicateurs visuels         │
│      - Actions rapides                         │
└─────────────────────────────────────────────────┘
```

---

## 📊 KPI Dashboard

### Les 4 Indicateurs Clés

#### 1. **Total** (Boîte bleue)
- Affiche le nombre total de tickets (tous statuts confondus)
- Inclut : À traiter + En traitement + Traité

**Exemple** : Total = 47 tickets
```
📊 Total
    47
```

#### 2. **Temps moyen** (Boîte bleue)
- Temps moyen de résolution d'un ticket
- Calculé uniquement sur les tickets traités

**Exemples** :
```
🕐 Temps moyen
    4h      = délai moyen 4 heures
    2j      = délai moyen 2 jours
    -       = pas assez de données
```

**Signification** :
- `< 1h` = Excellent ⚡
- `1-4h` = Bon ✅
- `4-24h` = Correct 🟡
- `> 1j` = À améliorer 🔴

#### 3. **Critiques** (Boîte rouge/warning)
- Nombre de tickets haute priorité NOT resolved
- Indicateur d'urgence immédiate

**Exemple** :
```
🆘 Critiques
    3      = 3 tickets urgent à traiter
```

**Action à prendre** :
- Si > 5 : Urgence élevée → Focus immédiat
- Si 1-3 : Traiter après "À traiter"
- Si 0 : Situation normale ✅

#### 4. **Taux résolution** (Boîte bleue)
- Pourcentage de tickets traités vs total

**Exemple** :
```
✅ Taux résolution
    82%     = 82% des tickets sont traités
```

**Benchmark** :
- `> 80%` = Excellent 🏆
- `60-80%` = Satisfaisant ✅
- `< 60%` = À améliorer 🔴

### Utilisation des KPI

**Chaque matin** :
1. Regarder les 4 KPI
2. Si "Critiques > 5" → Action urgente
3. Si "Taux résol < 70%" → Analyser goulets

**Avant réunion d'équipe** :
- Screenshot des KPI pour rapport
- Comparer avec période précédente

---

## 🔍 Recherche

### Fonctionnalité

Barre de recherche qui filtre en **temps réel** (pas besoin de cliquer "Chercher")

```
🔍 Rechercher par sujet, centre ou administrateur...
```

### Que recherche-t-elle ?

La recherche scanne :
- ✅ Le **sujet** du ticket
- ✅ Le **contenu** du message
- ✅ Le **nom du centre**
- ✅ Le **nom de l'administrateur**
- ✅ Toute autre information textuelle

### Exemples de Recherche

#### Chercher par centre
```
Taper: "Clinique Dupont"
Résultat: Tous les tickets de ce centre
```

#### Chercher par administrateur
```
Taper: "Marie"
Résultat: Tous les tickets transmis par "Marie"
```

#### Chercher par problème
```
Taper: "connexion"
Résultat: Tous les tickets contenant "connexion"
```

#### Chercher par code ticket (si présent)
```
Taper: "#12345"
Résultat: Le ticket spécifique
```

### Tips & Tricks

**✓ Recherche efficace**
```
❌ "vérification de patient" (trop spécifique)
✅ "patient" (terme clé)
✅ "Dupont" (nom du centre)
✅ "Pierre" (administrateur)
```

**Recherche agressive** (combine plusieurs termes)
```
Taper: "Dupont connexion"
Recherche: Tickets de Dupont OU contenant connexion
```

**Cas insensitif** (majuscules/minuscules)
```
Taper: "marie" ou "Marie" ou "MARIE"
Résultat: Identique dans tous les cas
```

### Performance
- ⚡ Résultats instantanés (debounce 300ms)
- 🎯 Filtre côté client (vs API)
- 📊 Nombre résultats affiché en bas

---

## 🎛️ Filtres Avancés

### Localisation des Filtres

```
┌─────────────────────────────────────────┐
│ 📋 Statut   | Priorité | Trier par      │
│ [Dropdown ] | [Dropdown]  | [Dropdown]   │
│             |            | [Réinitialiser]│
└─────────────────────────────────────────┘
```

### 1. Filtre Statut

**Options** :
```
- Tous          (par défaut)
- À traiter     (status = open)
- En traitement (status = in_progress)  
- Traité        (status = resolved)
```

**Utilisation** :
```
Matin      → Filtrer "À traiter" (voir ce qui attend)
Après-midi → Filtrer "En traitement" (voir en cours)
Soir       → Filtrer "Traité" (vérifier fait)
```

### 2. Filtre Priorité

**Options** :
```
- Toutes    (par défaut)
- Haute     (tickets urgents/critiques)
- Normale   (tickets standards)
- Basse     (questions mineures)
```

**Utilisation** :
```
Gestion urgence  → Filtrer "Haute"
Travail normal   → Laisser "Toutes"
Tâches mineures  → Filtrer "Basse"
```

### 3. Tri

**Options** :
```
- Plus récent (par défaut)   = Tickets créés récemment d'abord
- Plus urgent               = Priorité high d'abord, puis par date
- Plus ancien               = Tickets créés il y longtemps d'abord
```

**Utilisation** :
```
Premier check  → "Plus urgent" (traiter critiques d'abord)
Planning jour  → "Plus nouveau" (voir quoi de neuf)
Analyse        → "Plus ancien" (vérifier vieux tickets)
```

### 4. Réinitialiser Filtres

**Bouton** : "Réinitialiser"
- Remet tous les filtres à défaut
- Vide la barre de recherche
- Retour à l'état initial

**Utilisation** :
```
Après analyse → Réinitialiser avant prochaine session
Erreur filtre → Réinitialiser + recommencer
```

### Combinaison de Filtres

**Scénario 1** : "Je veux voir les tickets haute priorité en traitement"
```
1. Statut = "En traitement"
2. Priorité = "Haute"
3. Tri = "Plus nouveau"
Résultat: Tickets urgent en cours d'exécution
```

**Scénario 2** : "Je veux voir les tickets d'un centre spécifique à traiter"
```
1. Recherche = "Nom centre"
2. Statut = "À traiter"
3. Tri = "Plus urgent"
Résultat: Tickets du centre à traiter (urgent first)
```

---

## 📊 Tri des Tickets

### 3 Modes de Tri Disponibles

#### Mode 1 : Plus Récent (⏱️ Défaut)
```
Ordre: Tickets créés les plus récemment en premier
Cas d'usage: Vue générale, nouvelles requêtes
```

#### Mode 2 : Plus Urgent 🔴
```
Ordre: 
  1. Priorité HAUTE (tous)
  2. Priorité NORMALE (plus récent d'abord)
  3. Priorité BASSE (plus récent d'abord)
  
Cas d'usage: Triage par importance
```

#### Mode 3 : Plus Ancien ⏳
```
Ordre: Tickets créés il y longtemps en premier
Cas d'usage: SLA tracking, éviter oublier les anciens
```

### Impact Visuel du Tri

Selon le tri, les tickets se réordonnent **instantanément** dans la liste.

```
AVANT:
- Ticket créé le 2 avril
- Ticket créé le 30 mars
- Ticket créé le 25 mars

APRÈS "Plus ancien":
- Ticket créé le 25 mars
- Ticket créé le 30 mars
- Ticket créé le 2 avril
```

---

## ✍️ Actions sur Tickets

### Acces aux Actions

Chaque ticket a, en bas, **3 boutons d'action** :

```
┌─────────────────────────────────────┐
│                                     │
│  [À traiter] [En traitement] [Traité]│
│                                     │
└─────────────────────────────────────┘
```

### Types d'Actions

#### 1. Marquer "À traiter"
```
Bouton: À traiter
État: Actif = bouton surligné en bleu
Action: Clic = revenir le ticket à l'état "à traiter"
Cas: Réouvrir un ticket traité par erreur
```

#### 2. Marquer "En traitement"
```
Bouton: En traitement
État: Actif = bouton surligné en bleu
Action: Clic = ticket passe en "traitement"
Cas: J'ai commencé à travailler dessus
```

#### 3. Marquer "Traité"
```
Bouton: Traité
État: Actif = bouton surligné en bleu
Action: Clic = ticket résolu
Cas: Problème resolved, réponse envoyée
```

### Feedback Immédiat

Après clique:
- ✅ Toast vert "Statut mis à jour" 
- 📊 Ticket se déplace ou disparaît de la liste (selon filtres)
- ⚡ Les KPI se mettent à jour
- 🔄 Auto-refresh s'ajoute sur la liste

### Indicateurs Visuels

Chaque ticket a une **couleur de border-left** indiquant son statut :

```
🟢 À traiter (vert clair) = priorité voir rapidement
🟠 En traitement (orange) = en cours
🔵 Traité (gris bleu) = fermé

+ Pour les HAUTE priorité :
🔴 Badge rouge "En attente depuis Xj" = escalade urgente
```

---

## 🎬 Scénarios Réels

### Scénario 1 : Matin - Triage des Priorités (5 min)

```
1. Accéder à Support & Assistance
2. Regarder le KPI "Critiques" → Voir s'il y a urgences
3. Filtrer: Priorité = "Haute" + Tri = "Plus urgent"
4. Traiter les 2-3 critiques en premier
5. Réinitialiser filtres
6. Voir "À traiter" pour la journée
7. Planifier le travail
```

**Temps optimal** : ~5 minutes

### Scénario 2 : Chercher un Ticket Perdu

```
1. Barre de recherche
2. Taper "Nom centre" ou "Admin"
3. Résultat immédiat
4. Cliquer sur le ticket
5. Effectuer l'action nécessaire
```

**Temps optimal** : ~1 minute

### Scénario 3 : Fin de Journée - Report de Statut

```
1. Filtrer "En traitement"
2. Passer en revue les tickets
3. Les valider ("Traité") ou les laisser ("En traitement")
4. Fermer la session
```

**Temps optimal** : ~5-10 minutes

### Scénario 4 : État du Support Globale

```
1. Regarder KPI Dashboard :
   - Total = 28
   - Temps moyen = 3h
   - Critiques = 1
   - Taux résol = 85%
2. Analyse :
   - Status global = BON ✅
   - 1 critique à traiter immédiatement
3. Action :
   - Chercher le critiques
   - Le traiter
   - Continuer travail normal
```

**Temps optimal** : ~2 minutes pour l'analyse

### Scénario 5 : Formation - New Super Admin

```
1. Expliquer les 4 KPI
2. Montrer la recherche (avec exemple)
3. Montrer les filtres (combiner 2-3)
4. Montrer le tri (all 3 modes)
5. Montrer actions sur tickets
6. Passer par 1-2 scénarios réels
7. Laisser explorer 10 min
```

**Temps formation** : ~20 minutes

---

## ⌨️ Raccourcis

### Raccourcis Clavier (Phase 2 à venir)

En attendant, voici les actions rapides :

| Action | Méthode Actuelle |
|--------|-------------------|
| Chercher | Clic barre + Taper |
| Filter | Dropdown + Sélectionner |
| Refresh | Bouton "Actualiser" |
| Marquer écran | Cliquer le bouton d'action |

### Tips de Productivité

**Utiliser Tab + Arrow for navigation** (bonne pratique WCAG)
```
1. Tab = naviguer entre éléments
2. Arrows = naviguer dans dropdowns
3. Enter = confirmer sélection
```

### Automatisation Futures (Phase 3)

```
À venir:
- Shortcut "?" pour afficher l'aide
- Shortcut "f" pour focus recherche
- Shortcut "r" pour refresh
- Shortcut "e" pour exporter
```

---

## 🔧 Dépannage

### Q: La recherche ne fonctionne pas ?
**R**: 
- Attendre 300ms (debounce)
- Vérifier l'orthographe
- Essayer un terme plus court
- Réinitialiser via le bouton

### Q: Un ticket a disparu après l'action ?
**R**:
- C'est normal si les filtres sont appliqués
- Exemple: Si filtré "À traiter" et ticket marqué "Traité", il disparaît
- Réinitialiser filtres pour le voir

### Q: Les KPI ne se mettent pas à jour ?
**R**:
- Attendre l'auto-refresh (30 secondes)
- Ou cliquer "Actualiser" manuellement
- Rafraîchir la page (F5)

### Q: Comment exporter les tickets ?
**R**:
- Fonctionnalité Phase 3
- Pour maintenant: Screenshot + Copier-coller
- Contact admin pour autre solution

---

## 📞 Support

**Questions sur l'utilisation ?**
- Consulter ce guide
- Contacter l'administrateur
- Signaler les bugs

**Suggestions d'amélioration ?**
- Remplir le formulaire de feedback
- Contact: [email support]
- Prioriser votre proposition

---

**Version Guide** : 1.0
**Última Actualización** : Avril 2026
**Statut** : Prêt pour Production

