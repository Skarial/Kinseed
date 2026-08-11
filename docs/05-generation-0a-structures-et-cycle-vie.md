# Kinseed — G0-A : structures minimales et cycle de vie

## Statut du document

Ce document détaille la phase **G0-A — Continuité minimale** définie dans `docs/04-generation-0-roadmap-experimentale.md`.

Il ne fixe encore ni langage, ni base de données, ni framework. Il définit uniquement les structures minimales nécessaires pour que Kinseed puisse conserver une histoire fiable, former quelques conclusions provisoires, les réviser et produire des intentions traçables.

Principe central :

> **Un événement peut être compris immédiatement, mais aucune interprétation durable ne devient vraie uniquement parce qu’un LLM l’a formulée.**

G0-A doit pouvoir répondre à trois questions :

1. qu’est-ce qui s’est réellement produit ?
2. qu’est-ce que Kinseed en conclut actuellement ?
3. pourquoi a-t-il choisi cette action ou cette réponse ?

---

# 1. Structures durables minimales

G0-A utilise sept structures principales :

- `Source` ;
- `Event` ;
- `Memory` ;
- `Belief` ;
- `SelfHypothesis` ;
- `HumanHypothesis` ;
- `Intention`.

Deux mécanismes transversaux les relient :

- `EvidenceLink` ;
- `state_version`.

Les structures comme émotions complexes, valeurs personnelles, grands projets ou attachement ne font pas partie de G0-A.

---

# 2. Source

Une `Source` indique l’origine d’une information.

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
kinseed_internal
llm
system
external_tool
external_document
```

Une source ne possède pas un score global de fiabilité universel.

L’autorité dépend de la proposition concernée.

Exemple : l’humain est une source fortement autorisée concernant son propre prénom, mais il n’est pas autorisé à décréter directement un trait du Kinseed.

Règle :

> **Autorité = source + type de proposition + contexte.**

---

# 3. Event : source historique primaire

`Event` représente ce qui s’est réellement produit dans le système.

Schéma conceptuel minimal :

```text
Event

id
type
occurred_at
source_id
actor_ref
payload
parent_event_ids
state_version
```

Exemple :

```text
E-000104

type: human_message_received
source_id: SRC-HUMAN
payload: "Je préfère généralement travailler seul."
```

Le journal d’événements est logiquement append-only.

Une correction ultérieure ne modifie pas silencieusement l’ancien événement. Elle produit un nouvel événement :

```text
E-000583

type: correction_received
corrects: E-000104
```

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

Un événement n’est jamais « promu » en croyance ou en trait. Il peut seulement devenir une preuve utilisée par d’autres structures.

---

# 4. EvidenceLink : relation entre preuve et conclusion

Une simple liste d’identifiants d’événements ne suffit pas.

`EvidenceLink` décrit comment une donnée soutient ou contredit une conclusion.

```text
EvidenceLink

event_id
relation
directness
source_authority
independence_group
causal_contamination
weight_class
```

Exemples de `relation` :

```text
supports
contradicts
context_only
```

`independence_group` évite de considérer dix répétitions provenant de la même origine comme dix preuves indépendantes.

`causal_contamination` indique si une action a été fortement provoquée par la conclusion qu’elle est ensuite censée confirmer.

Exemple :

```text
event_id: E-208
relation: supports
directness: direct_behavior
source_authority: high
independence_group: CONTEXT-12
causal_contamination: low
weight_class: medium
```

Aucune formule numérique définitive n’est fixée à ce stade.

---

# 5. Memory : ce que Kinseed retient

Un événement n’est pas automatiquement une mémoire autobiographique.

Schéma minimal :

```text
Memory

id
event_ids
gist
created_at
salience
confidence
status
last_recalled_at
revision_of
```

Le `gist` représente le souvenir actuel du Kinseed. Il n’est jamais la source historique primaire.

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
- le `gist` ne doit ajouter aucun détail factuel absent des sources ;
- observation et interprétation doivent rester distinguables ;
- la provenance doit être conservée.

Une phrase plausible du LLM ne peut pas devenir une mémoire si aucun événement correspondant n’existe.

---

# 6. Belief : conclusion provisoire sur le monde ou l’humain

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

Scopes initiaux :

```text
world
human
```

Les croyances sur Kinseed lui-même sont traitées par `SelfHypothesis`.

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
- posséder au moins une provenance identifiable ;
- ne pas transformer une interprétation en observation ;
- conserver les contre-preuves déjà connues.

## Promotion `provisional → active`

Elle ne dépend pas d’un nombre fixe de messages.

La validation examine notamment :

- directivité des preuves ;
- autorité de la source pour la proposition ;
- indépendance des preuves ;
- cohérence entre contextes ;
- contre-preuves ;
- possibilité de vérification.

Une seule preuve directe très autoritative peut parfois être suffisante pour un fait simple. Plusieurs répétitions faibles d’une même affirmation ne le sont pas nécessairement.

## Révision

Une nouvelle preuve ne remplace jamais immédiatement la croyance actuelle.

Le système ajoute d’abord une `EvidenceLink`, recalcule son statut, puis peut produire une nouvelle version.

L’ancienne version reste accessible comme histoire épistémique mais ne doit plus influencer les décisions courantes si elle est `superseded`.

---

# 7. SelfHypothesis : début du modèle de soi

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

Stages autorisés en G0-A :

```text
observation
hypothesis
tendency
```

## Règle fondamentale

> **Ce que Kinseed dit être ne constitue jamais, à lui seul, une preuve de ce qu’il est.**

Une déclaration du type :

```text
"Je suis prudent."
```

peut devenir un événement linguistique, mais ne peut pas promouvoir directement une `SelfHypothesis`.

Même règle si l’humain déclare :

```text
"Tu es prudent."
```

Cette phrase renseigne d’abord sur la représentation que l’humain possède du Kinseed.

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

Si `SH-004` influence fortement une action, cette action reçoit un poids réduit lorsqu’elle sert ensuite à confirmer `SH-004`.

```text
SH-004 "je tends à chercher plus d'informations"
    ↓ cause partielle
ACTION A
    ↓
preuve de SH-004 = décotée
```

Cette règle évite les boucles d’auto-confirmation.

## Promotion `hypothesis → tendency`

Elle exige davantage de stabilité, de diversité contextuelle et de résistance aux contre-exemples.

Le passage vers un véritable trait relativement stable appartient à une phase ultérieure, principalement G0-C.

---

# 8. HumanHypothesis : interprétation sur l’humain

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
human claim:
"J'aime souvent travailler seul."
```

peut produire une croyance concernant ce témoignage.

Mais :

```text
HumanHypothesis:
"Mon humain valorise fortement son autonomie."
```

constitue une interprétation plus large et nécessite davantage de preuves.

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

# 9. Intention : cause enregistrée avant le langage

Schéma minimal :

```text
Intention

id
kind
target
trigger_event_ids
trigger_belief_ids
motivation
state_version
created_at
status
```

Exemple :

```text
I-031

kind: ask_clarification
target: human
trigger_belief_ids: [B-021]
trigger_event_ids: [E-415]
motivation: resolve_significant_inconsistency
state_version: 154
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

# 10. Barrière d’un tour : pas d’auto-rétroaction immédiate

G0-A adopte une règle importante :

> **Les mises à jour durables dérivées d’un tour sont committées après l’émission de la réponse et ne peuvent donc pas rétroagir sur la décision du même tour.**

Pipeline :

```text
1. message humain
        ↓
2. Event d'entrée ajouté
        ↓
3. snapshot de l'état durable N
        ↓
4. analyse du message + état N
        ↓
5. intentions candidates
        ↓
6. intention sélectionnée
        ↓
7. Event intention_selected
        ↓
8. génération et validation du langage
        ↓
9. Event kinseed_message_emitted
        ↓
10. extraction des candidats de mise à jour
        ↓
11. validation
        ↓
12. commit atomique
        ↓
13. state_version N+1
```

Le message courant peut évidemment être pris en compte pour répondre.

Mais une nouvelle croyance ou une nouvelle hypothèse identitaire issue de ce message n’est pas autorisée à se renforcer elle-même pendant le même cycle de décision.

---

# 11. Pipeline proposer → auditer → commit

Toutes les structures dérivées suivent le même modèle :

```text
événements
    ↓
extracteur / raisonneur
    ↓
candidat
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

Kinseed n’est donc pas obligé de choisir entre vrai et faux à chaque interaction.

---

# 12. Décisions de validation

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

Cela permettra de comprendre non seulement pourquoi une propriété existe, mais également pourquoi une propriété proposée n’a pas été créée.

---

# 13. Commit atomique et state_version

Une interaction peut produire plusieurs modifications liées.

Exemple :

```text
nouvelle preuve
→ révision de B-021
→ nouvelle hypothèse sur l'humain
```

Ces changements doivent être appliqués sur un état cohérent.

Chaque commit durable crée une nouvelle version :

```text
state_version = N + 1
```

Une intention conserve la version utilisée pour sa sélection.

Cela permettra ultérieurement de reconstruire exactement ce que Kinseed savait ou croyait au moment d’une action.

---

# 14. Exemple complet

Message humain :

```text
"Je crois que j'ai changé, maintenant j'aime beaucoup travailler avec d'autres personnes."
```

Le système produit :

```text
E-920 human_message_received
        ↓
le message contredit partiellement B-021
        ↓
I-188 candidate
kind: ask_clarification
motivation: resolve_significant_inconsistency
        ↓
I-188 selected et journalisée
        ↓
LLM formule la question
        ↓
E-921 kinseed_message_emitted
        ↓
candidate EvidenceLink pour B-021
candidate HumanHypothesis éventuelle
        ↓
validateurs
        ↓
B-021 peut passer de active à uncertain
        ↓
commit state_version 155
```

Le tour suivant utilise alors cette nouvelle version.

Le système ne conclut pas immédiatement que l’humain a changé de personnalité. Il constate seulement qu’une information nouvelle mérite une réévaluation.

---

# 15. Ce que G0-A ne doit pas encore faire

G0-A n’implémente volontairement pas :

- des émotions complexes ;
- des valeurs personnelles matures ;
- un attachement ;
- de grands projets autonomes ;
- un trait identitaire déclaré comme définitivement stable ;
- un système d’oubli complet ;
- d’autres Kinseeds ;
- reproduction, lignées ou héritage.

Il peut conserver des structures préparant les phases futures, mais il ne doit pas simuler ces capacités avant leur validation dédiée.

---

# 16. Critère de réussite de G0-A

G0-A sera considéré comme fonctionnel lorsque le système pourra démontrer de manière reproductible la chaîne suivante :

```text
HISTOIRE
   ↓
ÉVÉNEMENTS AVEC PROVENANCE
   ↓
PREUVES
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
- les croyances peuvent entrer dans un état d’incertitude et être révisées ;
- les hypothèses sur soi conservent leurs preuves et contre-preuves ;
- les intentions existent avant le langage ;
- une ablation ciblée peut modifier les décisions futures ;
- la cause d’une décision importante peut être reconstruite à partir de l’état historique.

Un succès de G0-A ne démontrera aucune conscience phénoménale. Il démontrera plus modestement qu’une histoire persistante peut produire des états internes structurés et causalement utiles au-delà du comportement spontané du modèle de langage.

---

# 17. Prochaine décision

Après validation de ces structures conceptuelles, la prochaine étape consiste à définir **les types précis d’événements et les schémas minimums de données nécessaires pour implémenter une première expérience G0-A**, avant de choisir les technologies de stockage ou de commencer le code applicatif.
