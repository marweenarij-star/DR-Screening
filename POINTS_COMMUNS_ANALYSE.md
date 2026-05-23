# Points Communs : DR Screening vs Projet Ibtigha Jomaa & Hiba Trabelsi

---

## 1. Domaine & Objectif Médical

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Sujet** | Dépistage automatisé rétinopathie diabétique (DR) | Les deux projets |
| **Objectif** | Triage médical : cas sains vs pathologiques | Les deux |
| **Classification** | 5 stades ICDR (0 = sain, 1-4 = pathologiques) | Les deux |
| **Problème clinique** | Pénurie ophtalmologues, zones rurales isolées | Les deux |
| **Public cible** | Médecins, centres ophtalmologiques | Les deux |
| **Impact social** | Prévention cécité, dépistage précoce | Les deux |

---

## 2. Dataset & Données

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Dataset utilisé** | APTOS 2019 (3662 images annotées) | Les deux |
| **Qualité données** | Images haut résolution, annotées par experts | Les deux |
| **Localisation** | Cliniques rurales en Inde (conditions réelles) | Les deux |
| **Variabilité technique** | Différents modèles caméras rétiniennes | Les deux |
| **Défi** | Déséquilibre classes (beaucoup cas sains) | Les deux |
| **Preprocessing** | Images de tailles différentes → normalisation | Les deux |

---

## 3. Pipeline Machine Learning

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Approche** | Transfer Learning (ImageNet → APTOS) | Les deux |
| **Backbone** | CNN pré-entraîné ImageNet | Les deux |
| **Fine-tuning** | Gel couches base, nouvel head de classification | Les deux |
| **Taux apprentissage** | Ultra-faible (5e-6 à 1e-4) pour stabilité | Les deux |
| **Équilibrage classes** | Class weights pour données déséquilibrées | Les deux |
| **Régularisation** | Dropout 0.5 pour robustesse | Les deux |
| **Loss function** | CrossEntropyLoss + Class Weights | Les deux |
| **Métrique principale** | Accuracy + F1-score pondéré | Les deux |

---

## 4. Prétraitement Images

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Auto-crop** | Suppression pixels noirs inutiles | Les deux |
| **Redimensionnement** | Normalisation taille (224x224 ou 300x300) | Les deux |
| **Méthode Ben Graham** | Soustraction moyenne locale (flou gaussien) | **Les deux** (point clé) |
| **Normalisation** | ImageNet mean/std (0.485, 0.456, 0.406) | Les deux |
| **Objectif** | Faire "jaillir" les anomalies (taches rouges, blanches) | Les deux |

**Citation identique :**
- Leur projet : *"La méthode Ben Graham standardise chaque œil, qu'il ait été photographié en Inde ou dans notre laboratoire."*
- Ton projet : même logique de robustesse inter-caméras

---

## 5. Explicabilité & Interpretabilité

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Technique** | Grad-CAM (Class Activation Map) | Les deux |
| **Objectif** | Visualiser zones d'importance du modèle | Les deux |
| **Usage** | Montrer au médecin "où le modèle a regardé" | Les deux |
| **Couche cible** | Dernière couche convolutive (layer4 ou conv_head) | Les deux |
| **Format sortie** | Heatmap superposée sur image originale | Les deux |
| **Clinique** | Augmente confiance médecin dans diagnostic | Les deux |

---

## 6. Performance & Métriques

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Recall stade 0 (sain)** | Très élevé (~99% vs 90%) | Les deux prioritisent |
| **Sécurité dépistage** | Ne pas confondre grave (3,4) avec sain (0) | Les deux |
| **Matrice confusion** | Montrent diagonale forte (vrais positifs) | Les deux |
| **Interprétation clinique** | "Bon premier filtre pour triage médical" | Les deux |

---

## 7. Architecture Technique Globale

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Microservices** | API IA séparée du reste du système | Les deux |
| **Containerisation** | Docker pour déploiement | Les deux |
| **Scalabilité** | Capacité à monter en charge | Les deux |
| **Séparation responsabilités** | IA ≠ logique métier | Les deux |

---

## 8. Déploiement

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Docker** | Conteneurisation de l'application IA | Les deux |
| **Vision production** | Ambition d'être exploitable en clinique | Les deux |
| **Standards interopérabilité** | Mention de FHIR/HL7 comme futur | Les deux |
| **PACS** | Intégration Orthanc comme perspective | Les deux |

---

## 9. Méthodologie Scientifique

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Approche empirique** | Train/test sur APTOS | Les deux |
| **Validation** | Métriques quantitatives (accuracy, F1, recall) | Les deux |
| **Reproducibilité** | Architecture claire, poids sauvegardés | Les deux |
| **Documentation** | Explication du pourquoi/comment de chaque étape | Les deux |

---

## 10. Valorisation Clinique

| Point Commun | Détail | Référence |
|--------------|-----համ---|-----------|
| **"Aide à la décision"** | IA complément au médecin, pas remplacement | Les deux |
| **Sécurité patient** | Prioriser false negatives (mieux avoir FP que FN) | Les deux |
| **Workflow triage** | Cas sains → rejet auto, cas douteux → révision | Les deux |
| **Message honnête** | L'IA n'est qu'un composant d'une vraie solution | Les deux |

---

## 11. Format de Présentation

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Slides structurées** | Contexte → dataset → méthode → résultats → déploiement | Les deux |
| **Storytelling médical** | "Pénurie, zones rurales, prévention cécité" | Les deux |
| **Définition ICDR** | Explication des stades 0-4 | Les deux |
| **Figures explicatives** | Diagrammes architecture, exemples d'images | Les deux |

---

## 12. Vision Honnête & Perspectives

| Point Commun | Détail | Référence |
|--------------|--------|-----------|
| **Limitations reconnues** | Ne pas prétendre 100% accuracy | Les deux |
| **Roadmap future** | Extension multi-pathologies, IA explicable | Les deux |
| **Intégration hospitalière** | Pas encore implémenté, c'est perspective | Les deux |
| **Ton professionnel** | "Voici ce qu'on a fait, voici ce qu'on peut faire" | Les deux |

---

## RÉSUMÉ : Les 5 Points Communs CRITIQUES

### 🎯 **Essence Partagée**

1. **Même problème médical** : DR screening dans zones rurales
2. **Même approche IA** : Transfer Learning ImageNet + fine-tuning APTOS
3. **Même prétraitement** : Ben Graham (ultra-important)
4. **Même dataset** : APTOS 2019, 3662 images
5. **Même vision** : IA comme aide médecin, pas remplacement

---

## Pourquoi C'est Important Pour Toi

### ✅ **C'est normal d'avoir des points communs**
- Même sujet = même dataset quasi obligatoire
- Même dataset = même preprocessing standard
- Même problème = même approche IA qui marche

### ⚠️ **Mais TES DIFFÉRENCES TE DISTINGUENT**
- **Eux** : bien sur IA, bon storytelling
- **Toi** : IA + système complet + production-ready
- **Eux** : 1 modèle (MobileNetV3)
- **Toi** : ensemble + calibration (82.7% vs 72%)
- **Eux** : prototype académique
- **Toi** : plateforme exploitable

---

## 💡 Comment Utiliser Cette Analyse

**Dans ta présentation :**
> *"Nous partageons avec d'autres projets sur ce thème les bases solides : dataset APTOS, transfer learning, Ben Graham. Mais notre plus-value c'est l'intégration système complète : workflow médecin réel, alertes temps réel, déploiement production."*

---

**TL;DR : Points communs = fondations scientifiques bonnes. Différences = vraie valeur ajoutée. 👍**
