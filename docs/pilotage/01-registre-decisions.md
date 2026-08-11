# Kinseed — Registre des décisions

## Statut

**Type :** document de pilotage  
**Portée :** décisions structurantes produit, architecture et expérimentation  
**Date de création :** 11 août 2026

---

## 1. Rôle du registre

Ce fichier sert d’**index des décisions importantes** prises pour Kinseed.

Il ne remplace pas les documents détaillés qui font autorité. Son rôle est de permettre de retrouver rapidement :

- ce qui est décidé ;
- le statut de la décision ;
- sa source canonique ;
- ce qui reste ouvert ;
- ce qui a éventuellement été remplacé.

Principe :

> **Une décision structurante ne doit pas dépendre uniquement de la mémoire d’une conversation.**

---

## 2. Statuts utilisés

- **VALIDÉE** : décision retenue et applicable tant qu’elle n’est pas remplacée.
- **EXPÉRIMENTALE** : décision retenue pour une phase ou un protocole limité, sans engagement définitif pour le produit final.
- **OUVERTE** : question identifiée mais non tranchée.
- **REMPLACÉE** : ancienne décision conservée pour traçabilité mais qui ne doit plus guider l’implémentation.

Lorsqu’une décision est remplacée, la nouvelle source doit être indiquée explicitement.

---

## 3. Règle de source de vérité

Le registre est un index, pas une seconde source de vérité.

En cas de divergence :

1. consulter le document canonique indiqué ;
2. privilégier la décision validée la plus récente ;
3. signaler toute contradiction avant de coder ;
4. mettre à jour le registre après la résolution.

Les ADR de `docs/decisions-techniques/` restent les sources canoniques pour les décisions techniques correspondantes.

---

## 4. Décisions structurantes actuelles

| ID | Domaine | Décision | Statut | Source canonique |
|---|---|---|---|---|
| D-001 | Mission | Kinseed vise un individu numérique persistant dont l’état actuel dépend de son histoire. | VALIDÉE | `README.md`, `docs/01-generation-0-specification-conceptuelle.md` |
| D-002 | Héritage | La transmission intergénérationnelle doit permettre combinaison, transformation, variation et oubli, jamais une simple copie. | VALIDÉE | `docs/10-regles-fondatrices-heritage.md` |
| D-003 | Priorité | La priorité actuelle est le premier Kinseed de génération 0 ; reproduction, société et lignées restent hors priorité immédiate. | VALIDÉE | `README.md`, `docs/04-generation-0-roadmap-experimentale.md` |
| D-004 | Architecture IA | Le LLM comprend et formule ; l’état Kinseed conserve la continuité, la causalité et les écritures durables. | VALIDÉE | `README.md`, `docs/03-generation-0-architecture-conceptuelle.md`, ADR-004 |
| D-005 | Événements | L’histoire fiable repose sur un modèle événementiel traçable avec ordre causal et validation des écritures durables. | VALIDÉE | `docs/06-generation-0a-contrat-tour-et-evenements.md`, ADR-003 |
| D-006 | Mobile | La cible produit prioritaire est mobile, avec Play Store avant App Store. | VALIDÉE | ADR-001 |
| D-007 | Stockage prototype | G0-A1 utilise une abstraction de persistance avec adaptateur mémoire sans choisir prématurément le stockage durable final. | EXPÉRIMENTALE | ADR-005 |
| D-008 | Premières minutes | La première session doit montrer rapidement que Kinseed se construit par son histoire plutôt que par une personnalité choisie. | VALIDÉE | `docs/produit/01-experience-5-premieres-minutes.md` |
| D-009 | Avatar | L’avatar représente l’individu ; son monde peut devenir une projection visuelle traçable de son histoire. | VALIDÉE | `docs/produit/03-avatar-monde-et-objets-interactifs.md` |
| D-010 | Apparence initiale | L’utilisateur choisit seulement une base visuelle masculine ou féminine ; le reste est généré de façon modulaire et déterministe avec une seed persistante. | VALIDÉE | `docs/produit/03-avatar-monde-et-objets-interactifs.md` |
| D-011 | Interaction | Pendant les premiers jours, Kinseed prend davantage l’initiative ; avec le temps, les interactions doivent s’appuyer de plus en plus sur l’histoire réelle. | VALIDÉE | `docs/produit/06-boucle-interaction-et-relation.md` |
| D-012 | Relation | Pas de streak obligatoire, de pénalité automatique d’affection ou de culpabilisation liée à l’absence. | VALIDÉE | `docs/produit/06-boucle-interaction-et-relation.md` |
| D-013 | Notifications | Une notification push peut livrer une initiative déjà justifiée par l’état de Kinseed ; elle ne doit pas créer artificiellement la motivation. | VALIDÉE | `docs/produit/06-boucle-interaction-et-relation.md` |
| D-014 | Réversibilité | Le produit doit prévoir une manière cohérente de gérer une relation qui ne convient plus à l’utilisateur sans nier artificiellement la continuité passée. | VALIDÉE AU NIVEAU PRODUIT | `docs/produit/02-separation-recommencement-et-continuite.md` |
| D-015 | Vie | Le cycle de vie, le vieillissement et la fin de vie appartiennent à la vision produit mais ne doivent pas détourner la priorité expérimentale actuelle. | VALIDÉE AU NIVEAU PRODUIT | `docs/produit/04-cycle-de-vie-vieillissement-et-fin-de-vie.md` |
| D-016 | Grounding | Les témoignages textuels G0-A1 doivent fournir un `supportingExcerpt` vérifiable ; une validation lexicale déterministe est requise avant influence ou persistance. | EXPÉRIMENTALE | `docs/05-generation-0a-structures-et-cycle-vie.md`, `docs/08-generation-0a1-contrat-implementation.md` |
| D-017 | Reprise causale | Le résultat de validation temporaire est checkpointé avant l’intention ; après ce checkpoint, une reprise réutilise les preuves, l’intention et la réponse historiques sans relancer silencieusement l’IA. | EXPÉRIMENTALE | `docs/06-generation-0a-contrat-tour-et-evenements.md`, `docs/08-generation-0a1-contrat-implementation.md` |

---

## 5. Questions ouvertes à surveiller

Les questions suivantes sont importantes mais ne doivent pas être tranchées avant que leur phase les rende nécessaires :

- stockage local durable final et synchronisation ;
- modèle exact de maturité de la relation ;
- fréquence et règles détaillées des initiatives G0-B ;
- contrat événementiel des initiatives hors message humain ;
- politique détaillée de données personnelles avant bêta externe ;
- technologie de notifications push ;
- infrastructure multi-utilisateur ;
- mécanisme d’héritage et de reproduction entre deux lignées ;
- modèle économique final ;
- stratégie de longévité et d’oubli à grande échelle.

Une question ouverte ne doit pas être implémentée comme si elle était déjà décidée.

---

## 6. Quand ajouter une décision ici

Mettre à jour ce registre lorsqu’une décision :

- change l’architecture ou le modèle de données ;
- définit un comportement produit structurant ;
- ferme une question jusque-là ouverte ;
- remplace une décision existante ;
- ajoute une contrainte durable pour les phases futures ;
- conditionne plusieurs fichiers ou plusieurs mécanismes.

Ne pas ajouter chaque détail d’implémentation local.

---

## 7. Format recommandé pour une nouvelle entrée

```text
ID : D-XXX
Domaine : ...
Décision : ...
Statut : VALIDÉE | EXPÉRIMENTALE | OUVERTE | REMPLACÉE
Date : ...
Source canonique : ...
Remplace : ... si nécessaire
```

---

## Principe de contrôle

Avant une modification structurante, vérifier ce registre puis les sources canoniques associées.

Si une proposition contredit une décision existante, la contradiction doit être traitée explicitement avant l’implémentation.
