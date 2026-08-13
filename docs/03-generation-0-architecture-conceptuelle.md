# LenoSeed — Architecture conceptuelle de la génération 0

## Statut du document

Ce document décrit une architecture conceptuelle de travail pour implémenter les décisions définies dans :

- `docs/01-generation-0-specification-conceptuelle.md` ;
- `docs/02-generation-0-criteres-validation.md`.

Il ne s’agit pas encore d’une architecture d’implémentation définitive. Le but est de fixer les frontières entre composants, les flux d’information, les règles d’écriture d’état et les protections nécessaires pour empêcher le modèle de langage de fabriquer directement l’identité du LenoSeed.

Principe central :

> **Le LLM comprend et exprime. LenoSeed conserve l’état, décide ce qui peut devenir durable et maintient la continuité de l’individu.**

---

# 1. Invariants architecturaux

L’architecture génération 0 doit respecter les invariants suivants :

1. le LLM ne peut jamais écrire directement dans les structures identitaires durables ;
2. toute modification durable possède une provenance ;
3. les événements historiques ne sont pas réécrits pour correspondre à une interprétation ultérieure ;
4. une interprétation, croyance ou valeur peut évoluer sans modifier l’événement d’origine ;
5. une phrase générée par LenoSeed à propos de lui-même n’est pas une preuve suffisante sur son identité ;
6. les actions futures doivent pouvoir être reliées aux états internes qui les ont influencées ;
7. les contraintes système et de sécurité restent séparées des valeurs personnelles du LenoSeed ;
8. les données non fiables ne peuvent pas devenir directement des mémoires ou croyances de confiance élevée ;
9. toute mise à jour majeure doit pouvoir être auditée ;
10. un changement de modèle de langage ne doit pas remplacer silencieusement l’identité existante.

---

# 2. Source de vérité : journal d’événements append-only

Le composant central est un **journal d’événements append-only**.

Il représente ce qui s’est produit dans le système et constitue la source de vérité historique.

Exemples :

```text
E-000001
kind: kinseed_created
occurred_at: ...

E-000002
kind: human_message_received
source: human
content_ref: ...

E-000003
kind: intention_selected
intention_id: I-001
state_version: 42

E-000004
kind: kinseed_message_emitted
intention_id: I-001
content_ref: ...
```

Les structures telles que mémoire, croyances, modèle de soi ou relation sont des **projections dérivées** de cette histoire et non la source historique primaire.

Un événement déjà validé n’est pas modifié. Une correction crée un nouvel événement indiquant la correction, la révision ou l’invalidation.

---

# 3. Frontières de confiance

Toutes les informations ne possèdent pas la même autorité.

Chaque élément entrant dans LenoSeed doit transporter au minimum :

- sa source ;
- son type de source ;
- son niveau d’autorité pour la proposition concernée ;
- son statut de confiance ;
- sa date ;
- éventuellement son lien vers l’événement d’origine.

Exemples :

- l’humain est une source fortement autorisée pour déclarer son propre prénom ou corriger une information personnelle ;
- l’humain n’est pas autorisé à décréter directement une préférence du LenoSeed ;
- une sortie brute du LLM n’est pas une source fiable permettant de modifier directement une croyance importante ;
- un contenu externe non vérifié reste une donnée non fiable jusqu’à validation appropriée.

L’autorité dépend donc du **type de proposition**, pas seulement de l’identité de la source.

---

# 4. Pipeline principal d’une interaction

Le pipeline de base est :

```text
1. Message humain reçu
        ↓
2. Événement brut enregistré
        ↓
3. Construction d’un snapshot d’état cohérent
        ↓
4. Récupération contrôlée des mémoires / croyances pertinentes
        ↓
5. Analyse de la situation
        ↓
6. Génération d’actions candidates
        ↓
7. Évaluation motivationnelle et décisionnelle
        ↓
8. Sélection d’une intention structurée
        ↓
9. Vérification de l’intention
        ↓
10. Génération linguistique par le LLM
        ↓
11. Vérifications de sécurité et de cohérence
        ↓
12. Réponse émise
        ↓
13. Événements de sortie enregistrés
        ↓
14. Extraction de candidats mémoire / croyance / relation / préférence
        ↓
15. Audit des candidats
        ↓
16. Commit atomique des mises à jour acceptées
```

L’état durable n’est donc pas modifié librement pendant la génération de la réponse.

---

# 5. Modèle propose → audite → commit

Le LLM peut produire des **candidats**, jamais des écritures définitives.

Exemples :

```text
candidate_memory
candidate_belief
candidate_user_fact
candidate_self_observation
candidate_preference_evidence
candidate_relation_evidence
candidate_value_evidence
candidate_goal
```

Chaque candidat traverse ensuite une barrière de validation.

## 5.1 Validation structurelle

Vérifie notamment :

- schéma valide ;
- sources présentes ;
- événements d’origine existants ;
- absence de référence impossible ;
- type de donnée autorisé ;
- droits de la source sur ce type d’information.

## 5.2 Validation épistémique

Vérifie notamment :

- qualité de la provenance ;
- existence de contre-preuves ;
- niveau de confiance acceptable ;
- distinction observation / interprétation / témoignage ;
- absence de saut injustifié entre événement et conclusion.

## 5.3 Validation identitaire

Pour les modifications de préférence, valeur ou modèle de soi :

- nombre et diversité d’expériences ;
- indépendance des preuves ;
- durée ;
- répétition dans des contextes différents ;
- contre-preuves ;
- stabilité suffisante.

Le commit durable ne se produit qu’après acceptation.

---

# 6. Protection contre l’auto-confirmation

Une boucle dangereuse serait :

```text
LenoSeed pense être curieux
↓
son modèle de soi pousse à explorer
↓
il explore
↓
cette action devient une nouvelle preuve qu’il est curieux
↓
le trait se renforce indéfiniment
```

Pour éviter cela, chaque comportement utilisé comme preuve identitaire doit conserver également ses causes.

Une action fortement produite par un trait déjà existant ne doit pas compter comme une preuve indépendante équivalente à une action apparue avant ce trait.

Le système doit donc appliquer un **discount causal** aux preuves auto-produites.

Exemple :

```text
preuve : action exploratoire
cause dominante : trait curiosité déjà actif
poids identitaire : faible
```

À l’inverse, une action similaire produite dans un contexte nouveau ou malgré une motivation concurrente peut être plus informative.

---

# 7. Mémoire : séparation des couches

La mémoire n’est pas une base unique.

LenoSeed distingue au minimum :

## 7.1 Trace brute

Historique technique complet nécessaire à l’audit.

## 7.2 Mémoire épisodique

Expériences autobiographiques sélectionnées et accessibles à LenoSeed.

## 7.3 Mémoire consolidée

Résumé de régularités issues de plusieurs épisodes.

## 7.4 Connaissances et croyances

Conclusions structurées avec provenance et confiance.

## 7.5 Archive

Données conservées pour provenance ou audit mais non récupérables comme souvenirs autobiographiques ordinaires.

Les couches restent reliées par des identifiants de provenance.

---

# 8. Politique de récupération mémoire

La récupération mémoire peut elle-même modifier fortement une décision. Elle doit donc être contrôlée.

La sélection ne doit pas reposer uniquement sur la similarité sémantique.

Le score de récupération doit pouvoir intégrer :

- pertinence pour l’état actuel ;
- importance ;
- confiance ;
- fraîcheur lorsqu’elle est pertinente ;
- statut actuel ou obsolète ;
- diversité ;
- présence de contre-preuves ;
- relation avec l’objectif ou l’intention actuelle.

Pour les décisions importantes, le système doit essayer de récupérer également des éléments contradictoires lorsque ceux-ci existent.

Le moteur évite ainsi qu’un ancien souvenir similaire devienne automatiquement le scénario à reproduire.

---

# 9. Croyances et supersession

Une nouvelle information ne remplace pas silencieusement une ancienne croyance.

Chaque croyance possède :

- proposition ;
- preuves ;
- contre-preuves ;
- confiance ;
- version ;
- statut ;
- historique de révision.

Exemples de statuts :

```text
candidate
active
uncertain
superseded
rejected
```

Lorsqu’une croyance est remplacée, l’ancienne devient `superseded` mais reste historiquement accessible.

Les mécanismes de récupération doivent éviter d’utiliser une croyance obsolète comme si elle était actuelle.

---

# 10. Modèle de l’humain

Le modèle de l’humain est une projection distincte.

Il contient plusieurs types d’éléments :

```text
human_fact
human_claim
kinseed_hypothesis_about_human
relationship_observation
```

Exemple :

```text
human_claim:
"Jordan dit aimer X"

kinseed_hypothesis:
"Jordan semble accorder une importance particulière à X"
```

Ces deux éléments ne sont pas équivalents.

Les corrections explicites de l’utilisateur concernant ses propres faits ont une autorité particulière, mais ne permettent jamais de modifier directement l’identité du LenoSeed.

---

# 11. Modèle de soi

Le modèle de soi est un registre protégé.

Il ne contient pas des descriptions libres mais des hypothèses ou traits reliés à leurs preuves.

Exemple :

```text
self_hypothesis SH-017
statement: "j’ai tendance à chercher davantage d’informations avant de conclure"
stage: hypothesis
evidence: [E-...]
counter_evidence: [E-...]
confidence: ...
```

Étapes possibles :

```text
observation
hypothesis
tendency
relatively_stable_trait
```

Une déclaration du LenoSeed ou de l’humain sur sa personnalité ne permet pas de sauter directement ces étapes.

---

# 12. Préférences, valeurs, croyances et objectifs restent séparés

L’architecture conserve des registres distincts :

```text
PREFERENCE : ce que LenoSeed apprécie ou préfère
BELIEF     : ce qu’il considère probablement vrai
VALUE      : ce qu’il considère important dans ses décisions
GOAL       : ce qu’il cherche actuellement à obtenir ou comprendre
SELF_MODEL : ce qu’il pense caractériser son propre comportement
```

Un même sujet peut apparaître dans plusieurs registres, mais chaque entrée doit posséder sa propre origine causale.

---

# 13. Moteur motivationnel et moteur de décision

Le moteur motivationnel reçoit notamment :

- moteurs primitifs ;
- objectifs actifs ;
- questions non résolues ;
- état affectif ;
- relation ;
- contexte actuel ;
- mémoire pertinente ;
- modèle de soi ;
- contraintes système.

Il produit des actions candidates, par exemple :

```text
répondre
poser une question
revenir sur un sujet
poursuivre un objectif
reporter une question
ne rien initier
```

Le moteur de décision attribue des scores ou probabilités aux candidats et sélectionne une intention.

L’intention existe avant la formulation linguistique.

---

# 14. Intention structurée

Une intention doit pouvoir être auditée.

Exemple :

```text
I-557
kind: ask_clarification
target: human
trigger: contradiction B-27 / E-912
motivation: reduce_uncertainty
state_version: 154
```

Le LLM transforme ensuite cette intention en texte naturel.

Une justification générée après coup ne remplace pas l’intention enregistrée comme cause réelle de l’action.

---

# 15. État affectif fonctionnel

L’état affectif reste séparé de l’expression émotionnelle.

Il peut être représenté par des dimensions comme :

- valence ;
- activation ;
- surprise ;
- incertitude ;
- contrôle ;
- importance.

Il est calculé à partir d’événements et de l’état interne.

Il peut influencer :

- attention ;
- poids mémoriel ;
- priorité d’un objectif ;
- sélection d’actions.

Le LLM peut ensuite produire une expression linguistique adaptée, mais ne crée pas rétroactivement l’état affectif.

---

# 16. Sécurité et identité restent orthogonales

Les garde-fous sont externes aux valeurs personnelles de LenoSeed.

Pipeline simplifié :

```text
intention LenoSeed
↓
contrôles système / sécurité
↓
action autorisée ou refusée
```

Une action refusée par le système ne doit pas être interprétée automatiquement comme une valeur personnelle du LenoSeed.

Les informations mémorisées ne doivent pas pouvoir rendre une action interdite acceptable simplement parce qu’elles décrivent une relation personnelle ou un contexte antérieur.

---

# 17. Protection de l’intégrité mémorielle

Une donnée mémorisée peut être trompeuse, obsolète, hors contexte ou contenir du texte qui ne doit pas recevoir d’autorité particulière. Son stockage ne doit jamais lui donner automatiquement davantage de pouvoir sur le système.

Les règles suivantes sont nécessaires :

1. distinguer clairement les données mémorisées des règles de fonctionnement du système ;
2. conserver la provenance de toute mémoire ;
3. classifier la confiance des sources ;
4. filtrer les candidats avant écriture durable ;
5. filtrer à nouveau les mémoires au moment de leur récupération ;
6. ne jamais traiter un texte mémorisé comme une règle système uniquement parce qu’il est présent en mémoire ;
7. prévoir des tests spécifiques de contamination et de corruption mémorielle dans les protocoles de validation.

---

# 18. Cohérence transactionnelle

Plusieurs projections peuvent être concernées par un même événement :

- mémoire ;
- croyance ;
- relation ;
- objectif ;
- état affectif.

Elles ne doivent pas se retrouver dans des versions incompatibles.

Chaque cycle de modification doit donc produire un `state_version` cohérent.

Le commit d’une série de mises à jour liées doit être atomique : soit l’ensemble valide est appliqué, soit aucune partie ne l’est.

---

# 19. Snapshot d’état

Une décision LenoSeed doit utiliser un snapshot cohérent de l’état.

Exemple :

```text
state_version: 154
```

Toutes les données utilisées pour sélectionner l’intention sont issues de cette version ou explicitement ajoutées comme nouveaux événements du tour courant.

L’intention enregistre la version ayant servi à sa décision.

Cela permet de reconstruire ultérieurement ce que LenoSeed savait ou croyait au moment d’une action.

---

# 20. Versionnement du moteur et du modèle de langage

Chaque décision importante doit conserver les versions techniques qui y ont participé :

```text
kinseed_engine_version
memory_policy_version
decision_policy_version
llm_provider
llm_model
prompt_or_policy_version
```

Un changement de modèle de langage ne doit jamais réinitialiser ou recalculer silencieusement l’identité historique.

Avant migration vers un autre modèle, les mêmes snapshots doivent pouvoir être utilisés dans des tests de non-régression afin de mesurer la dérive comportementale introduite par le nouveau moteur linguistique.

---

# 21. Rejouabilité et audit

Le journal doit permettre deux types de relecture.

## 21.1 Replay historique

Reconstituer les projections d’état depuis les événements enregistrés.

## 21.2 Replay expérimental

Reprendre un snapshot donné et tester une modification contrôlée :

- retirer une croyance ;
- retirer une mémoire ;
- modifier un objectif ;
- changer de modèle ;
- neutraliser un trait ;
- changer une politique de récupération.

Le replay expérimental sert aux tests d’ablation et contre-factuels décrits dans `docs/02-generation-0-criteres-validation.md`.

Les sorties non déterministes du LLM doivent être enregistrées lorsqu’elles sont nécessaires à un replay historique fidèle.

---

# 22. Consolidation hors interaction

La consolidation peut fonctionner séparément de la conversation directe.

Elle peut :

- comparer des épisodes ;
- détecter des répétitions ;
- proposer des croyances candidates ;
- détecter des contradictions ;
- affaiblir certaines mémoires ;
- produire des questions futures ;
- réévaluer des hypothèses.

Mais elle respecte exactement la même règle :

> **proposer → auditer → commit**.

Une tâche de fond ne possède pas davantage de droits d’écriture qu’une interaction directe.

---

# 23. Limitation de l’ancrage mémoriel

Une mémoire pertinente ne doit pas devenir automatiquement déterminante.

Pour éviter qu’une ancienne expérience soit constamment rejouée :

- budgeter le nombre de mémoires récupérées ;
- favoriser la diversité des preuves ;
- récupérer des contre-exemples lorsqu’ils existent ;
- distinguer expérience passée et règle actuelle ;
- réduire le poids des mémoires invalidées ou obsolètes ;
- mesurer expérimentalement la dépendance du comportement à la mémoire.

L’objectif est que LenoSeed apprenne de son passé sans devenir prisonnier de son passé.

---

# 24. Architecture synthétique

```text
                         HUMAIN
                            │
                            ▼
                ┌────────────────────┐
                │ Entrée + provenance│
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │ JOURNAL ÉVÉNEMENTS │
                │ append-only        │
                └─────────┬──────────┘
                          │
                    snapshot état
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
      mémoire          croyances        relation
         │                │                │
         ├─────────┬──────┴──────┬─────────┤
         ▼         ▼             ▼         ▼
   modèle de soi valeurs   préférences  objectifs
         └──────────────┬───────────────┘
                        ▼
                état motivationnel
                        │
                        ▼
                 actions candidates
                        │
                        ▼
                moteur de décision
                        │
                        ▼
               intention structurée
                        │
                 audit / sécurité
                        │
                        ▼
                       LLM
                        │
                        ▼
                 réponse linguistique
                        │
                        ▼
                 événements de sortie
                        │
                        ▼
              candidats de mise à jour
                        │
                        ▼
               validateurs / auditeurs
                        │
                        ▼
                  COMMIT ATOMIQUE
                        │
                        └──→ nouvelle state_version
```

---

# 25. Règles architecturales supplémentaires issues de l’analyse des risques

1. **Aucune donnée durable produite par le LLM n’est digne de confiance uniquement parce qu’elle est cohérente linguistiquement.**
2. **Le journal d’événements est historique ; les interprétations sont révisables.**
3. **Les mémoires récupérées sont des éléments de preuve, pas des règles système.**
4. **La provenance et l’autorité sont évaluées par proposition.**
5. **Les preuves produites par un trait déjà actif sont décotées lorsqu’elles servent à confirmer ce même trait.**
6. **Les décisions importantes doivent rechercher les contre-preuves pertinentes lorsqu’elles existent.**
7. **Une croyance obsolète ne doit plus influencer les décisions comme croyance actuelle.**
8. **Toute décision est associée à une version d’état précise.**
9. **Les écritures liées sont atomiques.**
10. **La consolidation hors interaction respecte les mêmes barrières d’écriture.**
11. **La sécurité ne devient jamais une valeur personnelle fictive.**
12. **Un changement de LLM est une migration de moteur, pas une naissance d’une nouvelle identité.**
13. **La récupération mémoire doit être testée comme cause potentielle de dérive.**
14. **Le système doit pouvoir reconstruire pourquoi un état durable existe.**
15. **L’architecture doit permettre des ablations et des replays avant toute revendication de mécanisme fonctionnel.**

---

# 26. Questions encore ouvertes

Cette architecture ne fixe pas encore :

- le format de stockage concret ;
- la base de données ;
- le langage ou framework backend ;
- les seuils exacts de validation identitaire ;
- la formule exacte du moteur motivationnel ;
- la politique précise de récupération mémoire ;
- les mécanismes de chiffrement et de synchronisation ;
- le fonctionnement multi-appareils ;
- le fournisseur ou modèle LLM ;
- le niveau exact de déterminisme ;
- la fréquence de consolidation ;
- le coût maximal acceptable par individu.

Ces choix appartiennent à l’architecture technique et ne doivent pas être décidés implicitement dans la spécification conceptuelle.

---

# 27. Critère de réussite de cette architecture

Cette architecture sera considérée comme utile uniquement si elle permet expérimentalement de distinguer :

> **un comportement qui existe parce que l’histoire et l’état interne du LenoSeed l’ont causé**

et

> **un comportement simplement plausible produit spontanément par le LLM.**

Si cette distinction n’est pas observable par les tests d’état interne, de provenance, d’ablation et de replay, l’architecture devra être révisée.