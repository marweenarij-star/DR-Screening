# Analyse Comparative : DR Screening vs Projet Ibtigha Jomaa & Hiba Trabelsi

**Date** : 6 mai 2026  
**Sujet** : Dépistage automatisé de la rétinopathie diabétique par Deep Learning  
**Auteur de cette analyse** : [Ton nom]

---

## 1. Synthèse Exécutive

| Critère | **Ton projet (DR Screening)** | **Projet Autres Étudiants** | Meilleur |
|---------|------|------|---------|
| **Portée système** | Plateforme complète (web app + IA + temps réel) | Étude modèle IA pur | ✅ Ton projet |
| **Matérialité** | Production-ready (Vercel, Render, Supabase) | Académique/prototype | ✅ Ton projet |
| **Modèle IA** | Ensemble ResNet + EfficientNet | MobileNetV3 unique | ⚖️ Équilibré |
| **Performance IA** | 82.7% accuracy (ensemble calibré) | 72% accuracy (MobileNetV3) | ✅ Ton projet |
| **Facilité déploiement IA** | Complexe (multi-modèle) | Simple (1 modèle léger) | ✅ Autres étudiants |
| **Workflow clinique complet** | Oui (admin→médecin→alertes) | Non (classification seulement) | ✅ Ton projet |
| **Intégration hospitalière** | En place (WebSocket, SMTP, rôles) | Roadmap FHIR/PACS (non implémenté) | ✅ Ton projet |
| **Documentation** | Technique+architecture | Pédagogique+storytelling | ⚖️ Leurs forces |
| **Jury "facile à présenter"** | Non (complexe, plusieurs modèles) | Oui (simple, linéaire) | ✅ Autres étudiants |
| **Utilité réelle/exploitabilité** | Haute (production utilisable) | Moyenne (prototype académique) | ✅ Ton projet |

---

## 2. Verdict Global

### ✅ **TON PROJET EST MEILLEUR GLOBALEMENT**

**Pourquoi :**
1. **Complétude système** : tu as construit une **plateforme exploitable**, pas juste un modèle.
2. **Pertinence clinique** : tu réponds au besoin réel (workflow médecin), pas juste à une métrique de classification.
3. **Maturité technique** : architecture distribuée, déploiement cloud, gestion des rôles.
4. **Performance réelle** : 82.7% accuracy vs 72% (et surtout **ensemble calibré** vs single model).
5. **Défendabilité devant jury** : tu peux dire "voici une vraie solution", pas "voici une étude de modèle".

### ⚠️ **MAIS leurs forces existent**

1. **Narration plus simple** : 1 modèle = discours linéaire et facile à présenter.
2. **MobileNetV3 = choix justifié** : léger, rapide, "plus réaliste pour smartphone" (même si non implémenté).
3. **Slides plus lisibles** : storytelling médical clair (contexte → dataset → modèle → résultats).
4. **Grad-CAM bien valorisé** : meilleure explication visuelle pour jury non technique.

---

## 3. Choses UTILES de Leur Projet que TU PEUX INTÉGRER

### A. **Narration médicale simplifiée**
**Leur avantage** : slides 1-4 excellent en contexte clinique  
**Comment l'utiliser** : reprendre leur formulation du problème :
- *"Pénurie d'ophtalmologues : 1 pour 100 000 habitants en zones rurales"*
- *"90% des cas de cécité évitables par dépistage précoce"*
- *"Maladie silencieuse : symptômes apparaissent trop tard"*

**Action** : ajoute ces phrases dans ta présentation avant ton système.

---

### B. **Formalisme ICDR 0-4**
**Leur avantage** : bien expliqué, figures claires  
**Comment l'utiliser** : leur définition des stades est correcte et pédagogique
- Stade 0 = Sain
- Stade 1 = Léger (microanévrismes)
- Stade 2 = Modéré (exsudats, hémorragies)
- Stade 3 = Sévère (lésions proliférantes)
- Stade 4 = Prolifératif (néovaisseaux)

**Action** : réutilise exactement leurs descriptions (c'est du domaine public médical).

---

### C. **Prétraitement Ben Graham justifié**
**Leur avantage** : bonne explication du pourquoi du comment  
**Citation utile** : 
> *"La méthode Ben Graham soustrait la moyenne locale (flou gaussien) à l'originale. Cela élimine le fond orange dominant et fait 'jaillir' les anomalies rouges."*

**Action** : ajoute cette explication dans tes slides IA si tu la mentionnes.

---

### D. **Matrice de confusion bien interprétée**
**Leur avantage** : expliquent cliniquement les vrais/faux positifs  
**Citation clé** :
> *"Le modèle est cliniquement sécurisé — il ne confond presque jamais un stade grave (3 ou 4) avec un stade sain (0). C'est la garantie d'un bon 'premier filtre' pour le triage médical."*

**Action** : ajoute cette interprétation dans ta slide "Sécurité du dépistage".

---

### E. **Vision roadmap honnête**
**Leur avantage** : honest about limitations  
**Citation** :
> *"À l'avenir : dépistage multi-pathologies, IA explicable pour mieux assister les cliniciens."*

**Action** : ajoute une slide "Perspectives" similaire (tu as des perspectives IA + intégration FHIR).

---

## 4. Choses QU'IL NE FAUT PAS COPIER

### ❌ **À ÉVITER** :
1. **Affirmer MobileNetV3 si tu l'as pas** → reste honnête sur ResNet + EfficientNet.
2. **Prétendre que ça marche sur smartphone** → dis plutôt "scalable vers on-device si quantized".
3. **PACS Orthanc + FHIR comme déjà implémenté** → clarifie que c'est roadmap.
4. **72% accuracy si tes modèles font 82.7%** → utilise ta vraie métrique.

---

## 5. Ce qui TE POSITIONNE MEILLEUR

### Force 1 : Architecture Système Complète
**Eux** : "Voici un modèle entraîné"  
**Toi** : "Voici une plateforme web où un médecin voit les résultats en temps réel avec alertes, rôles, historique"  
→ C'est 10x plus utile.

### Force 2 : Performance Calibrée
**Eux** : 72% accuracy (données brutes)  
**Toi** : 82.7% accuracy (calibration d'inférence incluse), + ensemble robuste  
→ Plus crédible.

### Force 3 : Déploiement Réel
**Eux** : "modèle entraîné localement"  
**Toi** : "déployé sur cloud (Render), fronted Vercel, DB Supabase, WebSocket temps réel"  
→ Production-ready vs prototype.

### Force 4 : Workflow Complet
**Eux** : patient → image → prédiction → résultat  
**Toi** : patient → examen → diagnostic → alerte urgence → email médecin → follow-up + statistiques  
→ C'est un vrai système.

---

## 6. SCRIPT POUR PRÉSENTER DEVANT JURY

```
Jury: "Quel est votre avantage comparé à autres projets similaires ?"

TOI (Réponse): 
"Notre projet se positionne différemment : 
- Eux se concentrent sur l'excellence du modèle IA pur (72% accuracy).
- Nous, nous avons construit une PLATEFORME complète de dépistage.

Techniquement :
  • Modèle ensemble (ResNet + EfficientNet) → 82.7% accuracy.
  • Mais ce qui fait la différence : c'est l'intégration médicale.
  
Cliniquement :
  • L'IA n'est qu'UN composant.
  • Notre vraie valeur : workflow médecin (examens priorités, alertes urgence, historique).
  • C'est ce qui permet au clinicien d'utiliser vraiment le système en cabinet.
  
Déploiement :
  • Notre architecture cloud est prête production (Render + Vercel + Supabase).
  • C'est une différence fondamentale entre 'un modèle académique' et 'un produit utilisable'.

Si le jury veut parler IA : on explique ensemble + calibration.
Si le jury veut parler système : on parle workflow + temps réel.
"
```

---

## 7. Réponse au Mail de l'Encadrante

**Voici la réponse proposée :**

```
Chère [Nom Encadrante],

Merci de m'avoir partagé le projet des autres étudiants sur le même sujet.

J'ai analysé leur travail et le nôtre. SYNTHÈSE:

🎯 **Meilleur projet** : Le nôtre, pour les raisons suivantes:

1. **Portée** : nous avons une plateforme complète (système web + API + IA + notifications temps réel), 
   tandis que leur projet se concentre uniquement sur l'excellence du modèle IA.

2. **Pertinence clinique** : leur modèle fait 72% accuracy, le nôtre fait 82.7% (ensemble calibré). 
   Surtout, nous avons intégré le workflow médical réel (rôles, priorités, alertes, historique patient).

3. **Maturité technique** : notre architecture est déployable en production (cloud: Render/Vercel/Supabase), 
   tandis que leur projet est plus académique/prototype.

4. **Utilité réelle** : un médecin peut *vraiment* utiliser notre système en cabinet. 
   Leur projet est une belle étude de classification, mais pas un produit utilisable.

📌 **Choses utiles de leur travail** que nous intégrons:

- ✅ Narration médicale : nous utilisons leur formulation du contexte clinique (pénurie ophtalmologues, 90% cécité évitable).
- ✅ Définition ICDR : leurs descriptions des stades 0-4 sont correctes et pédagogiques.
- ✅ Explication Ben Graham : nous adoptons leur clarté sur le prétraitement.
- ✅ Interprétation matrice confusion : nous expliquons comme eux pourquoi le modèle est "cliniquement sûr".
- ✅ Vision honnête : nous avons aussi une roadmap (intégration FHIR, multi-pathologies).

⚠️ **Différences importantes qu'on doit clarifier** :

- Nous utilisons ResNet50 + EfficientNet-B3 (ensemble robuste), pas MobileNetV3 (leur choix).
- Notre accuracy est 82.7%, pas 72%.
- Notre PACS/FHIR est en roadmap, pas implémenté (honnêteté).
- Notre système marche en production, pas juste en prototype local.

💡 **Conclusion** : leur projet est bon en recherche IA pure. Le nôtre est meilleur en ingénierie système et utilité clinique réelle.

Cordialement,
[Ton nom]
```

---

## 8. CHECKLIST pour ta soutenance

### À AJOUTER à ta présentation :

- [ ] Slide contexte médical (reprendre leur wording du problème clinique)
- [ ] Slide ICDR 0-4 avec leurs descriptions des stades
- [ ] Expliquer Ben Graham avec leur formulation
- [ ] Matrice confusion + interprétation clinique
- [ ] Roadmap FHIR + multi-pathologies (perspective)
- [ ] Slide comparaison: "plateforme système complète" vs "modèle IA pur"

### À CLARIFIER oral :

- [ ] Performance: expliquer 82.7% vs 72% (ensemble vs single model, calibration)
- [ ] Déploiement: "cloud production" vs "prototype académique"
- [ ] Workflow: montrer la vraie utilité (pas juste classification)
- [ ] Honnêteté: dire clairement "IA est 1 composant, système est notre valeur"

---

## 9. Scoring Comparatif (10 critères jury)

### **TON PROJET (DR Screening)**
| Critère | Note | Commentaire |
|---------|------|------------|
| Complétude système | 9/10 | Plateforme complète |
| Performance IA | 8/10 | 82.7% > 72% |
| Maturité déploiement | 9/10 | Cloud production-ready |
| Workflow médical | 10/10 | Vrai système utilisable |
| Clarté présentation | 6/10 | Complexe, multi-modèle |
| Robustesse code | 8/10 | Bien architecturé |
| Innovation | 8/10 | Ensemble + calibration |
| Exploitabilité | 10/10 | Prêt production |
| Portée géographique | 7/10 | Cloud, mais limité zones rurales sans internet |
| Pertinence clinique | 9/10 | Vraie solution médecin |
| **TOTAL** | **84/100** | **Projet d'ingénierie excellent** |

### **PROJET AUTRES ÉTUDIANTS**
| Critère | Note | Commentaire |
|---------|------|------------|
| Complétude système | 5/10 | Modèle IA uniquement |
| Performance IA | 6/10 | 72% correct mais < ensemble |
| Maturité déploiement | 4/10 | Prototype local |
| Workflow médical | 3/10 | Pas d'intégration clinique |
| Clarté présentation | 9/10 | Simple, linéaire, lisible |
| Robustesse code | 7/10 | Modèle bien entraîné |
| Innovation | 5/10 | MobileNetV3 standard |
| Exploitabilité | 3/10 | Nécessite refactoring pour production |
| Portée géographique | 8/10 | Mobile potentiel pour zones rurales |
| Pertinence clinique | 5/10 | Bonne étude, peu d'application réelle |
| **TOTAL** | **55/100** | **Projet de recherche IA correct** |

---

## 10. TL;DR pour toi

**Si jury te demande:** "Pourquoi ton projet est meilleur ?"

**Réponse en 30 secondes :**
> *"Notre projet est une **plateforme complète et déployable** pour les médecins. Leur projet est une **belle étude de modèle IA pur**. Nous utilisons un ensemble (ResNet + EfficientNet) qui fait 82.7% accuracy vs 72%, mais surtout : nous avons un **vrai workflow médical** (alertes urgence, historique, statistiques, rôles). C'est la différence entre un prototype académique et un produit utilisable en cabinet."*

---

**Fin de l'analyse. Bonne chance pour ta soutenance ! 🎓**
