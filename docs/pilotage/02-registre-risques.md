# Lenoseed — Registre des risques et garde-fous

## Statut

**Type :** document de pilotage  
**Portée :** risques conceptuels, techniques, produit, données et exploitation  
**Date de création :** 11 août 2026

---

## 1. Objectif

Lenoseed comporte des risques qui ne sont pas seulement des bugs techniques. Un système peut fonctionner sans erreur visible tout en échouant conceptuellement, par exemple si le LLM invente une continuité qui n’existe pas réellement.

Ce registre sert à rendre ces risques explicites, à identifier les signaux d’alerte et à définir les garde-fous à mettre en place avant qu’ils deviennent coûteux à corriger.

> **Un risque connu ne doit pas rester implicite lorsqu’il peut modifier l’architecture, les tests ou le moment où une expertise extérieure devient nécessaire.**

---

## 2. Niveaux de criticité

- **CRITIQUE** : peut invalider le concept, compromettre des données utilisateurs, la sécurité ou provoquer un coût difficilement réversible.
- **ÉLEVÉ** : peut bloquer une phase, dégrader fortement la maintenabilité ou rendre une partie du produit peu fiable.
- **MOYEN** : important à contrôler, mais ne justifie pas à lui seul de bloquer la phase actuelle.
- **FAIBLE** : impact limité ou facilement réversible.

---

## 3. Registre initial

| ID | Risque | Criticité | Signal / déclencheur | Garde-fou principal | État |
|---|---|---|---|---|---|
| R-001 | Le LLM invente une mémoire, une croyance, une motivation ou une justification qui n’existe pas dans l’état Lenoseed. | CRITIQUE | Une réponse affirme un état interne sans provenance ou cause préexistante. | Séparer décision, état durable et formulation ; valider avant persistance ; tests d’ablation. | TRAITÉ PARTIELLEMENT EN G0-A |
| R-002 | Une extraction sémantique incorrecte devient une preuve durable et contamine l’identité. | CRITIQUE | `EvidenceItem` accepté alors que le texte source ne soutient pas réellement la proposition. | `supportingExcerpt` exact, grounding lexical déterministe, défense au commit, tests adversariaux ; validation sémantique générale restante. | TRAITÉ PARTIELLEMENT — grounding lexical v3 validé ; validation sémantique générale ouverte |
| R-003 | Le projet accumule trop de fonctionnalités avant de valider son noyau. | ÉLEVÉ | Travail simultané sur avatar avancé, reproduction, monde, notifications, relation complète, backend, etc. | Budget de complexité ; gates de phase ; backlog futur pour tout élément non nécessaire à la validation actuelle. | ACTIF |
| R-004 | Les coûts LLM deviennent difficiles à maîtriser. | ÉLEVÉ | Hausse du nombre d’appels, contexte trop long, tests massifs non bornés, recharge automatique. | Plafonds explicites, métriques d’usage, campagnes de tests bornées, modèles adaptés au niveau de difficulté. | SOUS CONTRÔLE À SURVEILLER |
| R-005 | Des données personnelles ou intimes sont stockées sans politique claire. | CRITIQUE | Première bêta externe ou stockage durable de conversations réelles sur backend. | Politique de données avant bêta : finalité, durée, suppression, export, minimisation, flux vers le LLM. | FUTUR — BLOQUANT AVANT BÊTA |
| R-006 | Authentification ou règles d’accès insuffisantes exposent l’histoire d’un utilisateur. | CRITIQUE | Comptes réels, backend partagé, plusieurs utilisateurs. | Revue de sécurité, tests de règles d’accès, séparation stricte des propriétaires, audit extérieur avant production sensible. | FUTUR — BLOQUANT AVANT PRODUCTION MULTI-UTILISATEUR |
| R-007 | Perte ou corruption de l’histoire persistante lors d’une migration, synchronisation ou panne. | CRITIQUE | Introduction d’un stockage durable réel, migration de schéma, synchronisation multi-appareils. | Sauvegardes, migrations testées, idempotence, restauration, tests de crash et de reprise. | FUTUR |
| R-008 | L’identité dérive sur plusieurs mois et devient incohérente ou saturée. | CRITIQUE | Simulations longues, accumulation importante de souvenirs/croyances, changement de LLM. | Tests accélérés longue durée, oubli/consolidation, migration d’état, scénarios de dérive G0-F. | FUTUR G0-F |
| R-009 | Les notifications ou initiatives deviennent une mécanique artificielle d’engagement. | ÉLEVÉ | Relances à fréquence fixe, culpabilisation, fausse urgence, « tu me manques » sans état causal. | Toute initiative doit avoir une motivation métier traçable ; canal push séparé de la décision. | RÈGLE PRODUIT DÉFINIE, IMPLÉMENTATION FUTURE |
| R-010 | Le code généré par IA devient trop complexe pour être compris et vérifié par le mainteneur du projet. | ÉLEVÉ | Modification importante impossible à expliquer, dépendances ou services ajoutés sans compréhension claire, corrections en cascade. | Petits changements testables, documentation, pas de refactor massif, revue humaine extérieure quand la compréhension devient insuffisante. | ACTIF |
| R-011 | Une architecture multi-utilisateur ou de reproduction mélange les données de deux propriétaires ou rend le consentement ambigu. | CRITIQUE | Début de la reproduction entre Lenoseeds de deux utilisateurs ou partage de lignées. | Contrat de propriété/consentement, permissions, transactions atomiques, audit d’architecture externe avant mise en production. | FUTUR — BLOQUANT AVANT REPRODUCTION |
| R-012 | Le monde visuel devient une seconde source de vérité indépendante du modèle métier. | ÉLEVÉ | Un objet, une relation ou une activité apparaît sans cause traçable dans l’histoire. | Le monde est une projection d’états existants ; provenance des traces visuelles ; pas d’invention par le rendu. | RÈGLE PRODUIT DÉFINIE |
| R-013 | Une phase est déclarée validée parce que le comportement semble convaincant sans preuve causale. | CRITIQUE | Démonstration linguistique réussie sans ablation, contrôle ou état interne vérifiable ; hypothèse qui se confirme avec des comportements qu’elle a elle-même influencés. | Critères de validation G0, contrôles, ablations, gates formelles avant passage de phase ; marquage causal et exclusion des preuves auto-influencées du seuil G0-A2. | ACTIF |
| R-014 | Dépendance excessive à un fournisseur ou modèle LLM particulier. | ÉLEVÉ | Identité ou logique métier encodée dans les prompts d’un modèle spécifique. | Port d’IA, état séparé du LLM, tests multi-modèles, G0-F avec changement de modèle. | TRAITÉ PARTIELLEMENT |

---

## 4. Seuils imposant une expertise extérieure

Une revue par un développeur ou expert externe devient recommandée, et parfois bloquante, lorsque l’un des seuils suivants est atteint :

### Revue fortement recommandée

- bêta avec utilisateurs extérieurs au projet ;
- stockage durable de données personnelles sur un backend de production ;
- authentification et règles d’accès réelles ;
- synchronisation multi-appareils ;
- migration de données persistantes ;
- notifications push de production ;
- architecture devenue trop complexe pour être expliquée et vérifiée clairement par le mainteneur.

### Revue considérée comme bloquante avant mise en production

- paiement, abonnement, droits d’accès payants ou webhooks de facturation ;
- données sensibles accessibles à plusieurs comptes ;
- mécanisme de reproduction entre Lenoseeds de propriétaires différents ;
- migration irréversible d’histoires utilisateurs ;
- faiblesse de sécurité connue non résolue.

Le type d’expert dépend du risque : développeur backend, sécurité, mobile, données, juridique/RGPD ou autre spécialité adaptée.

---

## 5. Budget de complexité

Avant d’ajouter une fonctionnalité ou un mécanisme important, poser dans cet ordre :

1. Est-il nécessaire pour démontrer la phase actuelle ?
2. S’il n’est pas nécessaire, peut-il rester documenté sans être implémenté ?
3. Ajoute-t-il une nouvelle dépendance, un nouvel état durable ou une nouvelle source de vérité ?
4. Peut-il être testé isolément ?
5. Rend-il plus difficile la traçabilité de l’identité ?

Règle par défaut :

```text
Idée utile mais non nécessaire maintenant
        ↓
documenter ou placer au backlog futur
        ↓
ne pas implémenter pendant la phase actuelle
```

Une idée attrayante ne constitue pas à elle seule une raison de dépasser le périmètre de la phase.

---

## 6. Mise à jour du registre

Le registre doit être revu :

- avant un changement de phase ;
- avant une mise en production ;
- après un incident ou une découverte importante ;
- lorsqu’une nouvelle dépendance structurante est introduite ;
- lorsqu’un risque passe de théorique à réellement actif.

Pour chaque risque, mettre à jour l’état plutôt que supprimer l’historique sans raison.

---

## Principe de contrôle

Avant de poursuivre une étape importante, vérifier :

> **Quel est le pire échec plausible de cette étape, comment le détecter, et est-il encore facilement réversible ?**

Si la réponse n’est pas claire, l’étape nécessite d’abord une conception, un test ou une expertise supplémentaire.
