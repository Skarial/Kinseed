# LenoSeed — G0-A : structures minimales et cycle de vie

## Statut du document

Ce document détaille la phase **G0-A — Continuité minimale** définie dans `docs/04-generation-0-roadmap-experimentale.md`.

Il ne fixe encore ni langage, ni base de données, ni framework. Il définit uniquement les structures minimales nécessaires pour que LenoSeed puisse conserver une histoire fiable, former quelques conclusions provisoires, les réviser et produire des intentions traçables.

Principe central :

> **Un événement peut être compris immédiatement, mais aucune interprétation durable ne devient vraie uniquement parce qu’un LLM l’a formulée.**

G0-A doit pouvoir répondre à trois questions :

1. qu’est-ce qui s’est réellement produit ?
2. qu’est-ce que LenoSeed en conclut actuellement ?
3. pourquoi a-t-il choisi cette action ou cette réponse ?

---

# 1. Structures durables minimales

G0-A utilise huit structures principales :

- `Source` ;
- `Event` ;
- `EvidenceItem` ;
- `Memory` ;
- `Belief` ;
- `SelfHypothesis` ;
- `HumanHypothesis` ;
- `Intention`.

Deux mécanismes transversaux les relient :

- `EvidenceLink` ;
- `state_version`.

Les structures comme émotions complexes, valeurs personnelles, grands projets ou attachement ne font pas partie de G0-A.

La séparation fondamentale est :

```text
Event
= ce qui s'est produit

EvidenceItem
= ce qui peut être extrait de cet événement sans dépasser ce qu'il permet d'affirmer

Belief / Hypothesis
= ce que LenoSeed en conclut provisoirement
```

Cette couche intermédiaire empêche le passage direct :

```text
phrase humaine
→ croyance durable
```

---

# 2. Source

Une `Source` indique l’origine sémantique d’une information.

Schéma conceptuel minimal :

```text
Source

id
kind
actor_ref
channel
created_at
```

Exemples de `kind` :

```text
human
lenoseed_internal
llm
system
external_tool
external_document
```

Une source ne possède pas un score global de fiabilité universel.

L’autorité dépend de la proposition concernée.

Exemple : l’humain est une source fortement autorisée concernant son propre prénom, mais il n’est pas autorisé à décréter directement un trait du LenoSeed.

Règle :

> **Autorité = source + type de proposition + contexte.**

Il faut distinguer la **source de l’information** du mécanisme qui l’extrait.

Si Jordan écrit une phrase et qu’un LLM la transforme en structure, la source reste Jordan. Le modèle utilisé pour l’extraction est enregistré comme métadonnée technique et ne devient pas artificiellement la source du contenu.

---

# 3. Event : source historique primaire

`Event` représente ce qui s’est réellement produit dans le système.

Schéma conceptuel de travail :

```text
Event

id
sequence
type
occurred_at
turn_id
source_id
actor_ref
caused_by_event_ids
observed_state_version
payload
payload_schema_version
engine_version
```

`sequence` fournit un ordre historique strict lorsque les horodatages ne suffisent pas.

`turn_id` regroupe les événements appartenant à une même interaction.

`caused_by_event_ids` exprime une causalité opérationnelle entre événements, sans remplacer les liens de preuve épistémiques.

`observed_state_version` indique la version durable de LenoSeed disponible lorsque l’événement décisionnel a été produit.

Exemple :

```text
E-000104

sequence: 104
type: human_message_received
turn_id: T-0041
source_id: SRC-HUMAN
observed_state_version: 31
payload: "Je préfère généralement travailler seul."
```

Le journal d’événements est logiquement append-only.

Une correction ultérieure ne modifie pas silencieusement l’ancien événement. Elle apparaît comme un **nouvel** `human_message_received`. Le fait que ce nouveau message corrige une affirmation antérieure est ensuite représenté dans `EvidenceItem`, notamment via `supersedes_id`.

Exemple :

```text
E-000583

type: human_message_received
payload: "Je me suis trompé, c'était en 2021."

EV-000583
kind: testimony
supersedes_id: EV-000104
```

Cette règle évite de confondre le fait brut « un nouveau message a été reçu » avec l’interprétation « ce message corrige une preuve précédente ».

Les besoins système liés à l’effacement ou à la confidentialité sont traités séparément de cette règle de cohérence historique.

## Cycle de vie d’un événement

```text
REÇU
  ↓
VALIDATION STRUCTURELLE
  ↓
APPEND AU JOURNAL
  ↓
IMMUTABLE LOGIQUEMENT
```

Un événement n’est jamais « promu » en croyance ou en trait. Il constitue la matière historique à partir de laquelle des unités de preuve peuvent être extraites.

---

# 4. EvidenceItem : unité épistémique extraite d’un événement

`EvidenceItem` constitue la couche intermédiaire entre le journal brut et les croyances ou hypothèses.

Il représente une proposition limitée à ce que l’événement permet réellement d’affirmer.

Schéma conceptuel minimal :

```text
EvidenceItem

id
kind
proposition
subject_ref
source_id
event_ids
grounding
extraction_confidence
status
created_at
supersedes_id
extractor_version
```

`event_ids` exprime la provenance générale. Lorsqu'une extraction textuelle doit
être vérifiable, `grounding` désigne l'événement précis et le passage textuel
qui soutiennent la proposition :

```text
grounding:
  eventId: E-104
  supportingExcerpt: "J'aime beaucoup travailler seul"
```

Ce mécanisme est un grounding lexical minimal : il ne démontre pas à lui seul
l'implication, la négation ou la portée sémantique de la proposition.

Types initiaux autorisés en G0-A :

```text
testimony
behavioral_observation
system_record
```

## 4.1 Testimony

Exemple d’événement brut :

```text
Jordan écrit :
"J'aime beaucoup travailler seul."
```

L’unité de preuve correcte est :

```text
EV-014
kind: testimony
proposition:
"Jordan affirme aimer beaucoup travailler seul."
source_id: SRC-JORDAN
event_ids: [E-104]
```

Elle ne doit pas être :

```text
"Jordan préfère réellement travailler seul."
```

Cette seconde proposition est déjà une conclusion et appartient à `Belief`.

Elle ne doit pas non plus être :

```text
"Jordan est profondément indépendant."
```

Cette proposition constitue une interprétation psychologique plus large et appartient éventuellement à `HumanHypothesis`.

## 4.2 Behavioral observation

Une action réelle du LenoSeed peut être transformée en observation comportementale.

Exemple :

```text
EV-090
kind: behavioral_observation
proposition:
"Dans cette situation, LenoSeed a cherché une information supplémentaire avant de conclure."
event_ids: [E-510, E-511]
```

Cette unité peut servir de preuve à une `SelfHypothesis`.

En revanche :

```text
LenoSeed dit : "Je suis prudent."
```

reste une auto-déclaration linguistique et ne possède pas le même poids qu’une observation comportementale indépendante.

## 4.3 System record

Certains faits techniques peuvent être établis directement par le système.

Exemple :

```text
EV-001
kind: system_record
proposition:
"Le LenoSeed a été créé à l'instant T."
event_ids: [E-001]
```

## 4.4 Ce qui est interdit dans EvidenceItem

`EvidenceItem` ne doit pas contenir une inférence psychologique libre.

Exemples interdits comme unités de preuve directes :

```text
"Jordan valorise profondément son autonomie."
"LenoSeed est une personne prudente."
"Jordan était probablement triste."
```

Ces propositions nécessitent une interprétation et doivent passer par les registres de croyances ou d’hypothèses appropriés.

## 4.5 Validation d’extraction

Avant qu’un `EvidenceItem` devienne durable, le système vérifie notamment :

- que les événements référencés existent ;
- que la proposition est bien soutenue par ces événements ;
- qu’elle ne transforme pas un témoignage en fait établi ;
- qu’elle n’ajoute pas de détail absent ;
- que son `kind` correspond réellement à sa provenance ;
- que la source sémantique n’est pas confondue avec l’extracteur technique.

Pour un témoignage G0-A1 extrait d'un `human_message_received`, la validation
lexicale minimale exige en outre un `grounding` non nul : son événement doit
appartenir à `event_ids`, son extrait doit être non vide et être une sous-chaîne
exacte du texte de l'événement. Pour les propositions scalaires simples couvertes
par G0-A1, la valeur proposée doit aussi apparaître dans cet extrait. Pour une
année, sa représentation décimale doit apparaître comme un nombre distinct, sans
chiffre immédiatement adjacent.

Cette protection empêche par exemple une valeur `20212021` d'être acceptée à
partir d'un extrait ne contenant que `2021`. Elle ne constitue pas une validation
sémantique complète : « Je n'ai pas commencé en 2021 » contient lexicalement
`2021` sans soutenir `employment_start_year = 2021`.

Les invariants de grounding sont contrôlés une première fois pour la preuve
temporaire, puis de nouveau au moment de valider l'état à committer. Cette seconde
vérification est une défense en profondeur.

Cycle de vie :

```text
candidate
   ↓ validation d'extraction
active
   ↓ correction / nouvel élément
superseded ou invalidated

candidate ──→ rejected
```

Un `EvidenceItem` ancien peut rester historiquement vrai tout en cessant d’être pertinent pour l’état actuel.

Exemple :

```text
"Jordan a affirmé en 2026 avoir commencé son travail en 2022."
```

reste historiquement vrai même si Jordan corrige ensuite l’année à 2021.

---

# 5. EvidenceLink : relation entre unité de preuve et conclusion

`EvidenceLink` ne relie plus directement un événement brut à une croyance.

Il relie un `EvidenceItem` validé à une conclusion déterminée.

```text
EvidenceLink

evidence_item_id
target_type
target_id
relation
source_authority
independence_group
causal_contamination
relevance
weight_class
```

Exemples de `target_type` :

```text
belief
self_hypothesis
human_hypothesis
```

Exemples de `relation` :

```text
supports
contradicts
context_only
```

`source_authority` est évaluée relativement à la conclusion ciblée.

`independence_group` évite de considérer dix répétitions provenant de la même origine comme dix preuves indépendantes.

`causal_contamination` indique si une action a été fortement provoquée par la conclusion qu’elle est ensuite censée confirmer.

Exemple :

```text
evidence_item_id: EV-090
target_type: self_hypothesis
target_id: SH-004
relation: supports
source_authority: high
independence_group: CONTEXT-12
causal_contamination: low
relevance: high
weight_class: medium
```

Aucune formule numérique définitive n’est fixée à ce stade.

---

# 6. Memory : ce que LenoSeed retient

Un événement n’est pas automatiquement une mémoire autobiographique.

Schéma minimal :

```text
Memory

id
event_ids
evidence_item_ids
gist
created_at
salience
confidence
status
last_recalled_at
revision_of
```

Le `gist` représente le souvenir actuel du LenoSeed. Il n’est jamais la source historique primaire.

Les faits contenus dans le `gist` doivent pouvoir être ramenés à des `EvidenceItem` actifs ou à des événements historiques identifiables.

## Cycle de vie G0-A

```text
candidate
   ↓ validation
active
   ↓ nouvelle interprétation
revised

candidate ──→ rejected
```

Les mécanismes avancés `faded`, `latent` ou `archived` appartiennent principalement à G0-F et ne sont pas nécessaires au premier prototype G0-A.

## Règle de création

Un `candidate_memory` peut être proposé lorsqu’un événement possède une utilité autobiographique ou une importance suffisante pour les décisions futures.

Pour être accepté :

- tous les événements référencés doivent exister ;
- les unités de preuve utilisées doivent être traçables ;
- le `gist` ne doit ajouter aucun détail factuel absent des sources ;
- observation et interprétation doivent rester distinguables ;
- la provenance doit être conservée.

Une phrase plausible du LLM ne peut pas devenir une mémoire si aucun événement correspondant n’existe.

---

# 7. Belief : conclusion provisoire sur le monde ou l’humain

Schéma minimal :

```text
Belief

id
statement
scope
evidence_for
evidence_against
confidence
status
created_at
updated_at
previous_version_id
```

`evidence_for` et `evidence_against` référencent des `EvidenceLink`, et non directement le texte brut d’une conversation.

Scopes initiaux :

```text
world
human
```

Les croyances sur LenoSeed lui-même sont traitées par `SelfHypothesis`.

## Cycle de vie

```text
candidate
    ↓
provisional
    ↓ preuves suffisantes
active
    ↓ contradiction significative
uncertain / disputed
    ↓ nouvelle évaluation
active révisée
       ou
superseded

candidate ──→ rejected
```

## Promotion `candidate → provisional`

La proposition doit :

- être clairement formulée ;
- posséder au moins une unité de preuve validée ;
- ne pas transformer une interprétation en observation ;
- conserver les contre-preuves déjà connues.

## Promotion `provisional → active`

Elle ne dépend pas d’un nombre fixe de messages.

La validation examine notamment :

- nature des preuves ;
- autorité de la source pour la proposition ;
- indépendance des preuves ;
- cohérence entre contextes ;
- contre-preuves ;
- possibilité de vérification.

Une seule preuve directe très autoritative peut parfois être suffisante pour un fait simple. Plusieurs répétitions faibles d’une même affirmation ne le sont pas nécessairement.

## Révision

Une nouvelle preuve ne remplace jamais immédiatement la croyance actuelle.

Le système ajoute d’abord une unité de preuve et un `EvidenceLink`, recalcule son statut, puis peut produire une nouvelle version.

L’ancienne version reste accessible comme histoire épistémique mais ne doit plus influencer les décisions courantes si elle est `superseded`.

---

# 8. SelfHypothesis : début du modèle de soi

G0-A ne possède pas encore de `stable_trait`.

Schéma minimal :

```text
SelfHypothesis

id
statement
stage
evidence_for
evidence_against
confidence
created_at
updated_at
status
```

Les preuves sont des `EvidenceLink` vers des observations comportementales ou d’autres unités admissibles.

Stages autorisés en G0-A :

```text
observation
hypothesis
tendency
```

## Règle fondamentale

> **Ce que LenoSeed dit être ne constitue jamais, à lui seul, une preuve de ce qu’il est.**

Une déclaration du type :

```text
"Je suis prudent."
```

peut devenir un événement linguistique et éventuellement un `EvidenceItem` de type témoignage sur sa propre représentation actuelle, mais ne peut pas promouvoir directement une `SelfHypothesis`.

Même règle si l’humain déclare :

```text
"Tu es prudent."
```

Cette phrase constitue d’abord un témoignage concernant le regard de l’humain sur LenoSeed. Elle ne vaut pas observation comportementale indépendante.

## Promotion `observation → hypothesis`

Une hypothèse sur soi nécessite plusieurs signaux comportementaux suffisamment indépendants.

Le validateur examine notamment :

- contextes différents ;
- décisions réellement prises ;
- actions précédant éventuellement l’hypothèse ;
- contre-exemples ;
- dépendance à un prompt ou à une suggestion humaine ;
- contamination causale par une hypothèse déjà existante.

## Discount causal

Si `SH-004` influence fortement une action, l’`EvidenceItem` comportemental issu de cette action reçoit un poids réduit lorsqu’il sert ensuite à confirmer `SH-004`.

```text
SH-004 "je tends à chercher plus d'informations"
    ↓ cause partielle
ACTION A
    ↓
EV-090 observation comportementale
    ↓
preuve de SH-004 = décotée
```

Cette règle évite les boucles d’auto-confirmation.

## Promotion `hypothesis → tendency`

Elle exige davantage de stabilité, de diversité contextuelle et de résistance aux contre-exemples.

Le passage vers un véritable trait relativement stable appartient à une phase ultérieure, principalement G0-C.

---

# 9. HumanHypothesis : interprétation sur l’humain

Schéma minimal :

```text
HumanHypothesis

id
statement
evidence_for
evidence_against
confidence
status
created_at
updated_at
```

Cette structure ne remplace pas les faits déclarés par l’humain.

Exemple :

```text
EvidenceItem testimony:
"Jordan affirme aimer souvent travailler seul."
```

peut soutenir une croyance prudente concernant cette préférence déclarée.

Mais :

```text
HumanHypothesis:
"Mon humain valorise fortement son autonomie."
```

constitue une interprétation plus large et nécessite davantage de preuves indépendantes.

## Cycle de vie

```text
candidate
   ↓
hypothesis
   ↓
provisional_model

candidate ──→ rejected
hypothesis/provisional_model ──→ disputed
```

G0-A doit rester conservateur dans ces promotions afin d’éviter une pseudo-psychologie produite par le LLM à partir d’une seule phrase.

---

# 10. Intention : cause enregistrée avant le langage

Schéma minimal :

```text
Intention

id
kind
target
trigger_event_ids
trigger_evidence_item_ids
trigger_belief_ids
motivation
observed_state_version
created_at
status
```

Exemple :

```text
I-031

kind: ask_clarification
target: human
trigger_belief_ids: [B-021]
trigger_evidence_item_ids: [EV-122]
trigger_event_ids: [E-415]
motivation: resolve_significant_inconsistency
observed_state_version: 154
```

## Cycle de vie

```text
candidate
   ↓ règles / contraintes
eligible
   ↓ sélection
selected
   ↓ génération linguistique
expressed
   ↓
completed

candidate/eligible/selected ──→ aborted
```

Une intention `selected` est journalisée avant la génération de la réponse.

Le LLM reçoit ensuite l’intention comme contrainte de formulation.

Un contrôle de cohérence vérifie que le texte généré correspond bien à l’intention et n’ajoute pas d’accusation, de croyance ou de fait non soutenu.

Ainsi, l’explication ultérieure de la décision repose sur l’intention enregistrée et non sur une justification inventée après coup.

---

# 11. Barrière d’un tour : preuve éphémère mais pas d’auto-rétroaction durable

G0-A adopte une règle importante :

> **Les mises à jour durables dérivées d’un tour sont committées après l’émission de la réponse et ne peuvent donc pas rétroagir sur la décision du même tour.**

Le message courant doit néanmoins être compris avant la réponse.

Le système peut donc créer des `candidate EvidenceItem` temporaires pour le tour courant.

Ils doivent subir une validation minimale d’extraction avant d’influencer une intention, mais ils ne font pas encore partie de l’état persistant.

Un candidat qui échoue seulement à cette recevabilité déterministe est rejeté :
il ne peut influencer ni l'intention, ni la formulation, ni l'état durable. Le
tour peut continuer avec les autres candidats validés, ou sans nouvelle preuve
temporaire. Ce rejet est distinct d'une panne technique.

Le résultat complet de l'extraction et de la validation temporaire est
journalisé avant toute intention sous la forme d'un checkpoint atomique de lot
`EVIDENCE_READY`. Ce checkpoint utilise `validation_decision_recorded`, avec
`payloadSchemaVersion: 2`, et contient un résultat pour chaque candidat. Une
extraction valide sans candidat est représentée explicitement par
`outcomes: []` ; l'absence de checkpoint ne signifie jamais « zéro candidat ».

Pour un candidat `ACCEPT`, le checkpoint conserve le snapshot minimal permettant
de reconstruire exactement le `CandidateEvidenceItem`. Pour un `REJECT`, il
conserve seulement son identifiant et ses reason codes. Ce journal technique ne
constitue ni un `EvidenceItem` durable, ni une croyance, ni une promotion
épistémique.

Pipeline :

```text
1. message humain
        ↓
2. Event d'entrée ajouté
        ↓
3. extraction de candidate EvidenceItem
        ↓
4. validation minimale d'extraction pour le tour
        ↓
5. checkpoint atomique EVIDENCE_READY
        ↓
6. snapshot de l'état durable N
        ↓
7. comparaison preuve du tour + état N
        ↓
8. intentions candidates
        ↓
9. intention sélectionnée
        ↓
10. Event intention_selected
        ↓
11. génération et validation du langage
        ↓
12. Event lenoseed_message_emitted
        ↓
13. validation durable des EvidenceItem et autres candidats
        ↓
14. commit atomique
        ↓
15. state_version N+1
```

Ainsi une affirmation nouvelle peut immédiatement provoquer une question de clarification sans devenir immédiatement une croyance durable.

Exemple :

```text
Jordan :
"Finalement je préfère travailler en groupe."
```

peut provoquer :

```text
"Est-ce que cela dépend du contexte ou tu as vraiment l'impression d'avoir changé ?"
```

sans que LenoSeed ait déjà committé :

```text
Belief:
"Jordan préfère travailler en groupe."
```

---

# 12. Pipeline proposer → auditer → commit

Toutes les structures dérivées suivent le même modèle :

```text
événements
    ↓
extracteur
    ↓
EvidenceItem candidates
    ↓
validation d'extraction
    ↓
raisonneur
    ↓
autres candidats
    ↓
validation structurelle
    ↓
validation provenance
    ↓
validation épistémique
    ↓
validation spécifique au registre
    ↓
ACCEPT / REJECT / DEFER
    ↓
commit atomique éventuel
```

`DEFER` est un résultat important.

Il signifie :

> les informations sont intéressantes mais insuffisantes pour promouvoir actuellement cette conclusion.

LenoSeed n’est donc pas obligé de choisir entre vrai et faux à chaque interaction.

`DEFER` ne s'applique pas à un échec de grounding lexical : dans ce cas la
recevabilité déterministe du candidat a échoué et la décision est `REJECT`.

---

# 13. Décisions de validation

Chaque candidat doit produire un résultat auditable :

```text
ValidationDecision

candidate_id
decision
rule_ids
reason_codes
evidence_snapshot
engine_version
created_at
```

Décisions possibles :

```text
accept
reject
defer
```

Les candidats rejetés ou différés ne sont pas nécessairement conservés comme état psychologique, mais leur décision peut être journalisée pour les tests.

Pour le grounding lexical G0-A1, les codes stables minimaux sont :

```text
supporting_excerpt_empty
supporting_excerpt_not_in_event_text
proposition_value_not_in_supporting_excerpt
```

Cela permettra de comprendre non seulement pourquoi une propriété existe, mais également pourquoi une propriété proposée n’a pas été créée.

Dans G0-A1, les décisions relatives aux preuves temporaires sont regroupées dans
un seul `validation_decision_recorded` de lot par tour. L'écriture atomique du
lot évite qu'un crash ne laisse une série de décisions partielle et ambiguë.
Chaque résultat `accept` conserve le candidat validé ; chaque résultat `reject`
conserve ses `reason_codes`. Le tableau vide atteste explicitement que
l'extraction et la validation sont terminées sans candidat.

Règle de reprise :

> **Lire avant de créer ; un Event historique existant est réutilisé tel quel et
> n'est jamais reconstruit avec une nouvelle séquence.**

Une fois le checkpoint écrit, l'extracteur ne doit plus être rappelé pour ce
tour. La réponse historique et l'état durable produit par son tour doivent
partager la même chaîne causale de preuves temporaires validées.

---

# 14. Commit atomique et state_version

Une interaction peut produire plusieurs modifications liées.

Exemple :

```text
nouvelle EvidenceItem
→ nouveau EvidenceLink
→ révision de B-021
→ nouvelle hypothèse sur l'humain
```

Ces changements doivent être appliqués sur un état cohérent.

Chaque commit durable crée une nouvelle version :

```text
state_version = N + 1
```

Une intention conserve la version utilisée pour sa sélection.

Cela permettra ultérieurement de reconstruire exactement ce que LenoSeed savait ou croyait au moment d’une action.

---

# 15. Exemple complet : témoignage, preuve, croyance et hypothèse

Message humain :

```text
"Je crois que j'ai changé, maintenant j'aime beaucoup travailler avec d'autres personnes."
```

Le système produit :

```text
E-920 human_message_received
        ↓
candidate EV-301
kind: testimony
"Jordan affirme qu'il pense avoir changé et aimer maintenant travailler avec d'autres personnes."
        ↓
validation minimale d'extraction
        ↓
EV-301 temporaire contredit partiellement B-021
        ↓
I-188 candidate
kind: ask_clarification
motivation: resolve_significant_inconsistency
        ↓
I-188 selected et journalisée
        ↓
LLM formule la question
        ↓
E-921 lenoseed_message_emitted
        ↓
validation durable EV-301
        ↓
EvidenceLink EV-301 → B-021 : contradicts
        ↓
B-021 peut passer de active à uncertain
        ↓
HumanHypothesis sur un changement profond : DEFER
        ↓
commit state_version 155
```

Le système ne conclut donc pas immédiatement que l’humain a changé de personnalité.

Il distingue :

```text
ce qui a été dit
≠
ce qui est probablement vrai
≠
ce que cela signifie psychologiquement
```

---

# 16. Exemple complet : formation d’une hypothèse sur soi

Supposons plusieurs situations indépendantes.

Dans chacune, LenoSeed doit choisir entre conclure rapidement ou rechercher davantage d’information.

Les actions réelles produisent des observations :

```text
EV-401
"Dans le contexte A, LenoSeed a demandé une information supplémentaire avant de conclure."

EV-517
"Dans le contexte B, LenoSeed a différé sa conclusion afin de vérifier un élément contradictoire."

EV-622
"Dans le contexte C, LenoSeed a cherché une nouvelle preuve avant de trancher."
```

Ces trois `EvidenceItem` peuvent ensuite soutenir :

```text
SH-004
"J'ai tendance à rechercher davantage d'informations avant de conclure."
```

En revanche, si l’un de ces comportements a été principalement provoqué par `SH-004` déjà actif, son `EvidenceLink` reçoit une contamination causale plus élevée et un poids réduit.

Une auto-déclaration :

```text
"Je crois que je suis prudent."
```

ne remplace jamais ces observations comportementales.

---

# 17. Correction d’une information

Exemple initial :

```text
E-700
Jordan : "J'ai commencé ce travail en 2022."

EV-700
kind: testimony
"Jordan affirme avoir commencé ce travail en 2022."
supersedes_id: null
```

Puis :

```text
E-901
Jordan : "Je me suis trompé, c'était en 2021."

EV-901
kind: testimony
"Jordan corrige son affirmation précédente et affirme avoir commencé ce travail en 2021."
supersedes_id: EV-700
```

`EV-700` n’est pas effacé : Jordan a réellement formulé cette affirmation auparavant.

Mais pour la croyance courante concernant l’année de début :

```text
EV-901
```

possède une autorité particulière puisqu’il s’agit d’une correction explicite de l’humain sur son propre historique.

La croyance courante peut donc être révisée vers 2021, tout en conservant l’histoire de l’erreur et de la correction.

---

# 18. Ce que G0-A ne doit pas encore faire

G0-A n’implémente volontairement pas :

- des émotions complexes ;
- des valeurs personnelles matures ;
- un attachement ;
- de grands projets autonomes ;
- un trait identitaire déclaré comme définitivement stable ;
- un système d’oubli complet ;
- d’autres LenoSeeds ;
- reproduction, lignées ou héritage.

Il peut conserver des structures préparant les phases futures, mais il ne doit pas simuler ces capacités avant leur validation dédiée.

---

# 19. Critère de réussite de G0-A

G0-A sera considéré comme fonctionnel lorsque le système pourra démontrer de manière reproductible la chaîne suivante :

```text
HISTOIRE
   ↓
EVENTS
   ↓
EVIDENCE ITEMS AVEC PROVENANCE
   ↓
EVIDENCE LINKS
   ↓
CROYANCES / HYPOTHÈSES PROVISOIRES
   ↓
INTENTION TRAÇABLE
   ↓
DÉCISION NOUVELLE
```

Et lorsque :

- les conclusions durables ne peuvent pas être créées par une simple auto-déclaration du LLM ;
- une affirmation répétée de l’humain ne devient pas automatiquement une identité ;
- témoignage, observation et conclusion restent distincts ;
- les croyances peuvent entrer dans un état d’incertitude et être révisées ;
- les hypothèses sur soi conservent leurs preuves et contre-preuves ;
- les intentions existent avant le langage ;
- une ablation ciblée peut modifier les décisions futures ;
- la cause d’une décision importante peut être reconstruite à partir de l’état historique.

Un succès de G0-A ne démontrera aucune conscience phénoménale. Il démontrera plus modestement qu’une histoire persistante peut produire des états internes structurés et causalement utiles au-delà du comportement spontané du modèle de langage.

---

# 20. État de la conception G0-A

La couche épistémique minimale est désormais définie conceptuellement :

```text
Event
→ EvidenceItem
→ EvidenceLink
→ Belief / SelfHypothesis / HumanHypothesis
```

Le contrat causal d’un tour et ses événements minimaux sont définis dans `docs/06-generation-0a-contrat-tour-et-evenements.md`.

La première expérience exécutable est définie dans `docs/07-generation-0a1-protocole-croyance-provenance.md`.

La prochaine étape ne consiste donc plus à inventer de nouvelles structures pour G0-A1, mais à traduire ce protocole en **schémas d’implémentation minimaux et tests reproductibles**, avant d’écrire le code applicatif complet.
