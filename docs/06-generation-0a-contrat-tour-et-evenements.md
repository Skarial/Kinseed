# Kinseed — G0-A : contrat d’un tour et événements minimaux

## Statut du document

Ce document complète `docs/05-generation-0a-structures-et-cycle-vie.md`.

Il définit le **contrat minimal d’un tour d’interaction G0-A** : quels événements sont obligatoires, dans quel ordre ils apparaissent, comment un tour est finalisé et ce qui doit se passer lorsqu’un appel LLM, une validation ou un commit échoue.

Le but est de garantir une propriété simple :

> **Un tour incomplet peut produire une erreur, mais ne doit jamais produire un état identitaire partiellement corrompu.**

---

# 1. Un seul tour mutateur à la fois

Pour G0-A, les tours d’un même Kinseed sont sérialisés.

Deux messages ne doivent pas modifier simultanément le même état durable.

Principe :

```text
T-041 doit être finalisé
avant que T-042 puisse modifier l'état.
```

Cette contrainte simplifie :

- la causalité ;
- le versionnement ;
- les replays ;
- les tests d’ablation ;
- la récupération après erreur.

Une architecture plus concurrente pourra être étudiée plus tard, mais elle n’est pas nécessaire pour G0-A.

---

# 2. Identifiants minimaux d’un tour

Chaque interaction possède au minimum :

```text
turn_id
kinseed_id
input_event_id
observed_state_version
created_at
```

Toutes les opérations importantes du tour utilisent le même `turn_id`.

Le système doit également utiliser des clés d’idempotence par étape, par exemple :

```text
T-041:input
T-041:intention
T-041:response
T-041:post_validation
T-041:commit
```

Si une opération est répétée après un timeout ou un crash, elle doit retrouver le résultat déjà enregistré au lieu de créer un doublon.

---

# 3. Types d’événements G0-A

Le journal primaire reste volontairement petit.

Les types fondamentaux sont :

```text
kinseed_created
human_message_received
intention_selected
kinseed_message_emitted
validation_decision_recorded
state_commit_completed
processing_failure_recorded
```

Les corrections, contradictions et témoignages ne nécessitent pas obligatoirement un nouveau type d’événement spécifique : ils peuvent être représentés par `human_message_received` puis structurés dans `EvidenceItem`.

Cette règle évite de confondre le fait brut « un message a été reçu » avec l’interprétation « ce message corrige une information précédente ».

---

# 4. `kinseed_created`

Premier événement autobiographique et technique du Kinseed.

Exemple :

```text
E-000001

type: kinseed_created
sequence: 1
turn_id: null
observed_state_version: 0
payload:
  kinseed_id: K-001
  generation: 0
  created_at: ...
```

Aucun événement autobiographique personnel ne doit exister avant celui-ci.

---

# 5. `human_message_received`

Tout tour conversationnel commence par l’écriture durable de l’entrée humaine.

Exemple :

```text
E-000152

type: human_message_received
sequence: 152
turn_id: T-041
source_id: SRC-HUMAN
observed_state_version: 31
payload:
  message_ref: MSG-041
```

Le contenu peut être référencé plutôt que dupliqué directement dans le journal.

Règle importante :

> **Le message doit être enregistré avant toute décision Kinseed fondée sur ce message.**

Ainsi, aucune réponse significative ne peut apparaître dans l’histoire sans entrée correspondante.

---

# 6. Extraction temporaire des EvidenceItem

Après l’événement d’entrée, l’extracteur peut produire des `candidate EvidenceItem`.

Exemple :

```text
Jordan :
"Je crois que finalement je préfère travailler avec d'autres personnes."
```

peut produire :

```text
candidate EV-301
kind: testimony
proposition:
"Jordan affirme penser préférer maintenant travailler avec d'autres personnes."
```

Cette unité subit une validation minimale d’extraction avant d’être utilisée dans le tour courant.

Elle reste cependant **éphémère** jusqu’au post-traitement.

Elle peut aider Kinseed à détecter une contradiction et à poser une question, mais elle ne devient pas encore une croyance persistante.

---

# 7. Construction du snapshot décisionnel

La décision utilise une version durable précise :

```text
observed_state_version = N
```

Le snapshot contient uniquement l’état déjà committé avant le tour.

Les preuves temporaires issues du message courant sont ajoutées séparément comme informations du tour.

Conceptuellement :

```text
DECISION CONTEXT
=
STATE N
+
INPUT EVENT
+
TEMPORARY VALIDATED EVIDENCE
```

et non :

```text
STATE N
+
NEW BELIEFS CREATED FROM THE SAME MESSAGE
```

---

# 8. Sélection de l’intention

Plusieurs actions candidates peuvent être générées.

Exemple :

```text
answer_normally
ask_clarification
mention_contradiction
request_evidence
no_special_initiative
```

Après évaluation, une intention est sélectionnée.

Elle doit être enregistrée **avant** la génération du langage.

Exemple :

```text
I-029

kind: ask_clarification
motivation: resolve_significant_inconsistency
trigger_belief_ids: [B-014]
trigger_evidence_item_ids: [EV-301]
observed_state_version: 31
```

Puis :

```text
E-000153

type: intention_selected
turn_id: T-041
payload:
  intention_id: I-029
```

Cette séquence constitue la preuve que l’intention existait avant la phrase finale.

---

# 9. Génération et validation linguistique

Le LLM reçoit notamment :

- le contexte conversationnel nécessaire ;
- les souvenirs autorisés ;
- les croyances pertinentes ;
- l’intention sélectionnée ;
- les contraintes système.

Le LLM produit une **proposition de formulation**.

Avant émission, une validation vérifie au minimum que la formulation :

- respecte l’intention ;
- n’invente pas un souvenir ;
- ne transforme pas une hypothèse en certitude ;
- ne crée pas une nouvelle propriété identitaire uniquement dans le texte ;
- respecte les contraintes de sécurité.

Si la formulation échoue, elle peut être régénérée sans modifier l’identité durable.

Les tentatives internes de génération peuvent rester dans des logs techniques séparés ; elles ne doivent pas nécessairement polluer le journal autobiographique principal.

---

# 10. `kinseed_message_emitted`

Seul le texte effectivement présenté à l’humain devient un événement historique de sortie.

```text
E-000154

type: kinseed_message_emitted
turn_id: T-041
caused_by_event_ids: [E-000152, E-000153]
observed_state_version: 31
payload:
  message_ref: KMSG-041
  intention_id: I-029
  generation_metadata_ref: GEN-...
```

Un brouillon rejeté n’est donc pas traité comme une parole autobiographique réellement prononcée par Kinseed.

---

# 11. Post-traitement après émission

Après l’émission seulement, le système évalue ce que le tour doit laisser comme état durable.

Le post-traitement peut proposer :

```text
EvidenceItem
Memory
EvidenceLink
Belief revision
SelfHypothesis update
HumanHypothesis update
```

Chaque candidat passe par les validateurs définis dans le document précédent.

Règle :

> **La réponse a déjà été décidée. Le post-traitement ne peut plus modifier rétroactivement pourquoi elle a été produite.**

Cette règle n'empêche pas une validation temporaire préalable. Avant
`intention_selected`, Kinseed valide les candidats extraits du message courant
afin qu'un candidat irrecevable ne puisse pas influencer la décision du tour.
Le résultat complet est journalisé par un unique `validation_decision_recorded`
de lot avant `intention_selected`. Il constitue le checkpoint `EVIDENCE_READY`.
Un `REJECT` ne crée ni preuve, ni lien, ni croyance ; le tour continue avec les
seuls candidats temporaires validés, éventuellement aucun.

---

# 12. `validation_decision_recorded`

Pour les changements significatifs, la décision de validation peut être journalisée.

Exemple :

```text
E-000155

type: validation_decision_recorded
turn_id: T-041
payload:
  candidate_id: HH-CAND-18
  decision: defer
  reason_codes:
    - insufficient_independent_evidence
```

Décisions :

```text
accept
reject
defer
```

Le système peut ainsi expliquer pourquoi une hypothèse n’a pas été créée malgré une proposition du raisonneur.

Pour un rejet lexical de candidat temporaire, `decision` vaut `reject`. Ce n'est
pas un `processing_failure_recorded` : ce dernier reste réservé à une anomalie
interne, telle qu'un événement Kinseed introuvable, un payload de message
inexploitable, une erreur de persistence ou une exception inattendue.

## 12.1 Checkpoint de preuves temporaires G0-A1

Le checkpoint utilise le type existant, sans ajouter d'`EventType` :

```text
type: validation_decision_recorded
payloadSchemaVersion: 2
id: E-<turnId>-temporary-evidence
idempotencyKey: <turnId>:temporary-evidence
causedByEventIds:
  - <human_message_received.id>
observedStateVersion: N

payload:
  scope: temporary_evidence
  completed: true
  outcomes:
    - candidateId: CAND-<turnId>-1
      decision: accept
      candidateSnapshot:
        kind: testimony
        proposition: <proposition complète>
        supportingExcerpt: <extrait exact>
        extractionConfidence: high
        extractorVersion: <version>
    - candidateId: CAND-<turnId>-2
      decision: reject
      reasonCodes:
        - <reason code>
```

Un résultat sans candidat est représenté par `outcomes: []`. L'absence de cet
Event reste ambiguë et ne doit jamais être interprétée comme une extraction vide.

Le `candidateSnapshot` d'un `ACCEPT` ne contient ni `eventId` ni `sourceId` :
Kinseed les reconstruit depuis le `human_message_received` du tour. Aucun snapshot
complet d'un `REJECT` n'est requis en G0-A1.

Les payloads `validation_decision_recorded` de version 1 restent des événements
historiques avec leur sémantique propre et ne sont pas réinterprétés comme ce
checkpoint de lot.

---

# 13. Commit atomique

Toutes les écritures durables acceptées du tour sont appliquées ensemble.

Exemple :

```text
EV-301 active
EvidenceLink ajouté à B-014
B-014 : active → uncertain
HH-CAND-18 : deferred
```

Le commit utilise :

```text
expected_state_version = 31
```

Si l’état courant n’est plus 31, le commit est refusé plutôt que d’écraser une version plus récente.

Lorsque le commit réussit :

```text
state_version = 32
```

Puis :

```text
E-000156

type: state_commit_completed
turn_id: T-041
payload:
  previous_state_version: 31
  new_state_version: 32
  changed: true
```

Si aucun état dérivé ne change, l’événement peut indiquer :

```text
changed: false
previous_state_version: 31
new_state_version: 31
```

Le tour reste ainsi explicitement finalisé même lorsqu’il n’a rien appris de durable.

---

# 14. Échec avant émission de la réponse

Supposons :

```text
human_message_received
↓
intention_selected
↓
appel LLM impossible
```

Le système enregistre :

```text
processing_failure_recorded
stage: language_generation
```

Aucune croyance, mémoire ou hypothèse nouvelle n’est committée.

L’état durable reste exactement `N`.

Le message humain et l’intention déjà journalisés restent dans l’historique technique ; le système peut reprendre le même tour grâce à son `turn_id` et à ses clés d’idempotence.

Une nouvelle tentative ne doit pas créer un second message d’entrée identique.

Les erreurs techniques antérieures à l'intention sont également journalisables.
Une erreur d'appel de l'extracteur utilise le stage `evidence_extraction` ; une
exception interne pendant validation ou création du checkpoint utilise
`evidence_validation`. Un rejet lexical contrôlé n'emprunte jamais ce chemin.

---

# 15. Échec après émission mais avant commit

Cas plus délicat :

```text
message humain
↓
intention
↓
réponse envoyée à l'humain
↓
crash avant post-traitement
```

L’événement `kinseed_message_emitted` existe déjà : la conversation a réellement eu lieu.

Mais l’état durable reste encore `N`.

Le système doit pouvoir reprendre uniquement :

```text
post_validation
→ commit
```

sans régénérer ni réémettre la réponse.

Il ne doit pas non plus rappeler l'extracteur, recalculer l'intention ou
reconstruire les preuves temporaires depuis une nouvelle sortie IA. Le checkpoint,
l'intention et la réponse historiques sont réutilisés ; le commit est produit à
partir des mêmes `candidateSnapshot` acceptés que ceux ayant causé la réponse.

Le `turn_id` et les événements déjà écrits permettent de reconstruire cette situation.

Cette propriété est importante :

> **un crash après la réponse ne doit ni faire parler Kinseed deux fois, ni créer un demi-changement identitaire.**

---

# 16. Échec du commit

Si la validation réussit mais que le commit atomique échoue :

- aucun des changements dérivés ne devient actif ;
- `state_version` ne change pas ;
- l’échec est journalisé ;
- le commit peut être repris de façon idempotente.

Aucune situation du type suivant n’est autorisée :

```text
Memory créée
Belief non mise à jour
SelfHypothesis partiellement modifiée
```

Le principe est :

```text
TOUT
ou
RIEN
```

pour les projections d’un même commit.

---

# 17. `processing_failure_recorded`

Schéma conceptuel :

```text
processing_failure_recorded

turn_id
stage
error_class
retryable
observed_state_version
created_at
```

Les détails sensibles ou volumineux de l’erreur peuvent rester dans des logs techniques externes.

L’événement principal sert surtout à reconstruire l’état du pipeline.

Stages minimaux G0-A1 :

```text
evidence_extraction
evidence_validation
language_generation
state_commit
```

Les IDs et clés d'idempotence sont spécifiques au stage, par exemple
`E-<turnId>-failure-evidence-validation` et
`<turnId>:failure:evidence_validation`. Plusieurs échecs techniques successifs
d'étapes différentes peuvent ainsi être journalisés sans collision.

---

# 18. États conceptuels d’un tour

Sans créer nécessairement une nouvelle table `Turn`, le statut d’un tour peut être reconstruit à partir de ses événements.

```text
INPUT_RECORDED
      ↓
EVIDENCE_READY
      ↓
INTENTION_SELECTED
      ↓
RESPONSE_EMITTED
      ↓
POST_VALIDATED
      ↓
FINALIZED
```

Une erreur peut apparaître entre n’importe quelles étapes.

Le système doit savoir depuis quelle étape reprendre.

Reprise normative :

```text
A. INPUT_RECORDED seul
   → extraction et validation autorisées
   → écrire le checkpoint

B. EVIDENCE_READY présent, intention absente
   → reconstruire les ACCEPT depuis le checkpoint
   → ne pas extraire
   → sélectionner et enregistrer l'intention

C. INTENTION_SELECTED présente, réponse absente
   → checkpoint obligatoire
   → réutiliser l'intention historique
   → formulation uniquement

D. RESPONSE_EMITTED présente, commit absent
   → checkpoint obligatoire
   → réutiliser candidats, intention et réponse historiques
   → aucune opération IA
   → reprendre post-traitement et commit

E. FINALIZED
   → retourner le résultat historique
   → aucun retraitement
```

Une intention ou une réponse sans checkpoint `temporary_evidence` complet est un
état impossible. Kinseed échoue fermé et enregistre si possible un
`processing_failure_recorded` ; il ne tente jamais une nouvelle extraction
silencieuse.

Règle d'idempotence : un Event existant est lu et réutilisé dans sa forme
historique. Il n'est pas repassé dans un mécanisme de création qui lui attribuerait
une nouvelle `sequence`. `IdempotencyConflictError` reste une protection contre
une divergence réelle et ne doit pas être ignoré.

---

# 19. Règle de finalisation avant le tour suivant

Pour G0-A :

> **un nouveau tour mutateur ne doit pas commencer tant que le précédent n’est pas finalisé ou explicitement clôturé en échec sans changement d’état.**

Cette règle évite :

```text
T-041 utilise state 31
T-042 utilise aussi state 31
T-041 commit 32
T-042 écrase avec une conclusion fondée sur l'ancien état
```

Le prototype privilégie donc la causalité claire à la performance maximale.

---

# 20. Différence entre journal autobiographique et logs techniques

Tous les détails techniques n’ont pas besoin d’entrer dans l’histoire conceptuelle du Kinseed.

Exemples pouvant rester dans des logs opérationnels :

- latence API ;
- nombre exact de retries HTTP ;
- tokens consommés ;
- brouillons LLM rejetés ;
- stack trace d’une exception.

Le journal `Event` doit contenir ce qui est nécessaire pour reconstruire :

- les interactions réellement vécues ;
- les décisions fonctionnelles ;
- les changements d’état ;
- les échecs ayant interrompu la continuité.

Cette séparation évite de transformer Kinseed en journal de serveur géant.

---

# 21. Contrat minimal d’un tour réussi

Un tour G0-A réussi respecte donc :

```text
E1 human_message_received
        ↓
extraction de candidats temporaires
        ↓
validation / grounding
        ↓
validation_decision_recorded v2 de lot : EVIDENCE_READY
        ↓
EvidenceItem temporaires validés
        ↓
snapshot state N
        ↓
I1 intention sélectionnée
        ↓
E2 intention_selected
        ↓
LLM formule
        ↓
validation linguistique
        ↓
E3 kinseed_message_emitted
        ↓
post-validation
        ↓
E4... validation_decision_recorded si nécessaire
        ↓
commit atomique
        ↓
E5 state_commit_completed
        ↓
state N ou N+1
```

Le tour est alors finalisé.

---

# 22. Invariants de sécurité de l’état

Les invariants G0-A sont :

1. aucun message Kinseed émis sans `human_message_received` correspondant dans un tour conversationnel normal ;
2. aucune réponse importante sans intention sélectionnée enregistrée ;
3. aucune nouvelle croyance durable avant émission de la réponse du même tour ;
4. aucune écriture durable partielle ;
5. aucun double traitement d’une même étape grâce à l’idempotence ;
6. aucun commit sur une `state_version` inattendue ;
7. aucun nouveau tour mutateur avant finalisation du précédent ;
8. aucun brouillon LLM rejeté traité comme parole réellement prononcée ;
9. un crash n’efface jamais un événement déjà réellement survenu ;
10. un crash n’invente jamais un changement identitaire non committé.
11. toute intention et toute réponse possèdent un checkpoint `EVIDENCE_READY` antérieur ;
12. une réponse historique et son commit utilisent les mêmes preuves temporaires validées.

---

# 23. Critère de réussite de ce contrat

Le contrat est considéré suffisant pour commencer G0-A lorsque des tests peuvent provoquer artificiellement une panne à chaque étape et vérifier que :

- le journal reste cohérent ;
- aucune réponse n’est dupliquée ;
- aucune croyance ou hypothèse n’est partiellement écrite ;
- le tour peut être repris ou clôturé proprement ;
- la `state_version` finale est déterminable ;
- l’ordre causal du tour peut être reconstruit.

---

# 24. Prochaine décision

Après ce contrat, les structures conceptuelles et le flux transactionnel minimal de G0-A sont suffisamment précis pour passer à la **première spécification d’expérience exécutable**.

La prochaine étape consiste à définir un scénario expérimental très réduit :

- état initial exact de deux Kinseeds ;
- suite d’événements imposée à A et B ;
- EvidenceItem attendus ;
- croyances et SelfHypothesis autorisées ou interdites ;
- situation nouvelle finale ;
- contrôle LLM seul ;
- ablation du mécanisme testé ;
- critères précis de réussite et d’échec.

Ce scénario doit être défini avant le choix final des technologies et avant le premier code de G0-A.
