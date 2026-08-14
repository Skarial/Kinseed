# Lenoseed — G0-A3 : contrat d’implémentation de la mémoire épisodique minimale

## Statut du document

Ce document traduit le protocole
`docs/13-generation-0a3-protocole-memoire-episodique-minimale.md` en contrat
d’implémentation déterministe.

Il fixe les structures, identifiants, fixtures, invariants, frontières de
persistance, checkpoints, completions, reprises et tests requis avant tout code
G0-A3. Il ne constitue ni une implémentation, ni une validation de G0-A3, ni une
autorisation de commencer G0-B.

Les noms TypeScript et les chaînes protocolaires présentés comme exacts sont
normatifs pour le premier lot G0-A3. Ils décrivent une expérience bornée et non
un système général de mémoire.

---

# 1. Certain et décisions fixées ici

## 1.1 Certain depuis le protocole

Le contrat hérite des règles suivantes sans les redéfinir :

- `Event` reste la source historique primaire, ordonnée et logiquement
  append-only ;
- `EvidenceItem` ne dépasse jamais ce que sa provenance permet d’affirmer ;
- `Memory` est une projection dérivée, persistée et révisable ;
- la chaîne d’audit reste `Memory → EvidenceItem → Event → Source` ;
- une correction ajoute de l’histoire et ne réécrit aucun événement antérieur ;
- une seule version courante peut exister pour une même mémoire logique ;
- la récupération est explicite par `episodeKey`, sans recherche sémantique ;
- le décideur consomme un snapshot borné avant toute formulation linguistique ;
- contrôle sans consolidation et ablation de consommation sont distincts ;
- le gist v1 et le gist v2 sont des templates déterministes ;
- aucun LLM ne crée, valide, récupère, révise ou sélectionne la décision mesurée ;
- aucun contrôle C0 avec API n’est nécessaire ;
- `InMemoryStore` ne démontre aucune durabilité après redémarrage ;
- G0-A reste ouvert et G0-B reste NO-GO.

## 1.2 Décisions techniques fixées par ce contrat

Ce contrat décide :

- la structure TypeScript minimale de `Memory` ;
- la réutilisation des vocabulaires ordinaux existants ;
- l’absence de mutation lors d’une simple lecture ;
- les formats exacts de `memoryKey`, identifiant de version et idempotence ;
- les trois lectures minimales de `PersistencePort` ;
- les payloads G0-A3 des types d’événements existants ;
- deux use cases distincts pour créer v1 et réviser vers v2 ;
- un checkpoint schema v4 et une completion schema v3 ;
- les reprises fermées à chaque frontière ;
- le snapshot décisionnel et le sélecteur pur ;
- la stratégie de tests déterministes.

---

# 2. Structure TypeScript minimale `Memory`

G0-A3 introduira exactement les types suivants :

```ts
import type { EntityId, Timestamp } from "./primitives.js";

export type MemorySalience =
  | "low"
  | "medium"
  | "high";

export type MemoryConfidence =
  | "low"
  | "moderate"
  | "moderate_high"
  | "high";

export type MemoryStatus = "active" | "revised";

export interface Memory {
  readonly id: EntityId;
  readonly lenoseedId: EntityId;

  readonly memoryKey: string;
  readonly episodeKey: string;
  readonly version: number;

  readonly eventIds: readonly EntityId[];
  readonly evidenceItemIds: readonly EntityId[];

  readonly gist: string;

  readonly createdAt: Timestamp;

  readonly salience: MemorySalience;
  readonly confidence: MemoryConfidence;

  readonly status: MemoryStatus;
  readonly revisionOf: EntityId | null;

  readonly lastRecalledAt: Timestamp | null;
}
```

Aucun champ de score numérique, embedding, résumé alternatif, tags libres,
compteur de rappel ou état G0-F n’est ajouté.

## 2.1 Salience

`MemorySalience` possède son propre type. Son vocabulaire est volontairement
aligné sur l’échelle déjà utilisée par `EvidenceWeight` :

```ts
type MemorySalience =
  | "low"
  | "medium"
  | "high";
```

`MemorySalience` n’est pas `EvidenceWeight` : le premier exprime l’importance
autobiographique d’une mémoire, tandis que le second exprime le poids ou
l’autorité d’une preuve. Les deux versions de la fixture canonique utilisent
exactement :

```text
salience: high
```

Cette valeur signifie uniquement que cette mémoire contrôlée est admissible
pour la situation future du protocole. Elle ne constitue pas une importance
psychologique générale.

## 2.2 Confidence propre à `Memory`

`Memory.confidence` utilise également un type propre au domaine mémoire :

```ts
type MemoryConfidence =
  | "low"
  | "moderate"
  | "moderate_high"
  | "high";
```

Le vocabulaire reste aligné sur l’échelle existante de `Belief`, mais
`MemoryConfidence` n’est pas `Belief.Confidence` et ne crée pas de dépendance
conceptuelle envers une croyance. Cette séparation empêche qu’une évolution du
modèle de preuve ou de croyance modifie implicitement la sémantique des
souvenirs. Une primitive générique commune ne sera extraite ultérieurement que
si le domaine démontre réellement qu’elle représente le même concept.

Les deux versions canoniques utilisent exactement :

```text
confidence: high
```

Cette confiance porte sur la fidélité de la projection au snapshot de preuves
retenu. Elle ne transforme pas l’explication de l’opérateur en vérité physique.
Le gist conserve explicitement l’attribution et la correction.

---

# 3. `lastRecalledAt` : lecture sans écriture

Le champ existe afin de ne pas fermer une évolution future, mais G0-A3 impose :

```text
lastRecalledAt: null
```

pour v1 et v2.

Une simple lecture par `readMemory`, `readActiveMemoryByKey` ou
`readMemoryHistoryByKey` :

- ne modifie aucune `Memory` ;
- n’écrit aucun `Event` ;
- n’appelle pas `atomicCommit` ;
- ne change pas `stateVersion` ;
- ne change pas le résultat d’une reprise.

Une future politique de rappel pourra introduire une écriture explicite et
idempotente, mais elle est hors G0-A3. Cette décision maintient la récupération
expérimentale pure et évite qu’une observation du mécanisme modifie le mécanisme
mesuré.

---

# 4. Identité logique et identifiants déterministes

## 4.1 `memoryKey`

Le builder futur est conceptuellement :

```ts
function buildG0A3MemoryKey(
  lenoseedId: EntityId,
  episodeKey: string,
): string {
  return `g0a3:${lenoseedId}:${episodeKey}`;
}
```

Pour la fixture canonique :

```text
g0a3:<lenoseedId>:EP-G0A3-CALIBRATION-01
```

`lenoseedId` et `episodeKey` doivent être non vides. `episodeKey` est une clé
contrôlée par le protocole et ne contient pas `:` dans G0-A3.

La clé ne dépend jamais de :

- `gist` ;
- `version` ;
- statut ;
- listes d’événements ou de preuves ;
- horodatage ;
- action future attendue.

## 4.2 Identifiant d’une version

Le builder futur est :

```ts
function buildG0A3MemoryId(
  lenoseedId: EntityId,
  episodeKey: string,
  version: number,
): EntityId {
  return `MEM-G0A3-${lenoseedId}-${episodeKey}-v${version}`;
}
```

Les deux identifiants de l’expérience sont donc :

```text
MEM-G0A3-<lenoseedId>-EP-G0A3-CALIBRATION-01-v1
MEM-G0A3-<lenoseedId>-EP-G0A3-CALIBRATION-01-v2
```

Le fonctionnement du domaine repose sur les champs structurés et les builders,
pas sur le parsing des préfixes de débogage.

## 4.3 Historique linéaire

Pour chaque `memoryKey` :

1. un numéro de version apparaît au maximum une fois ;
2. v1 a `version: 1` et `revisionOf: null` ;
3. vN, pour N > 1, référence directement l’id de vN-1 ;
4. aucun saut de version n’est admis ;
5. la chaîne est unique, directe et continue ;
6. au maximum une version est `active` ;
7. si une version `active` existe, elle est la version la plus élevée ;
8. toutes les versions antérieures sont `revised` ;
9. une version `revised` ne redevient jamais `active` ;
10. aucune branche n’est admise.

La seule mutation autorisée d’une version existante est la transition atomique
de la version courante `active` vers `revised`. Son id, sa clé, son épisode, sa
version, son gist, ses références, sa salience, sa confiance, `revisionOf`,
`createdAt` et `lastRecalledAt` restent identiques.

---

# 5. Extensions minimales de `PersistencePort`

Le port recevra exactement les lectures suivantes :

```ts
readMemory(
  lenoseedId: EntityId,
  memoryId: EntityId,
): Promise<Memory | null>;

readActiveMemoryByKey(
  lenoseedId: EntityId,
  memoryKey: string,
): Promise<Memory | null>;

readMemoryHistoryByKey(
  lenoseedId: EntityId,
  memoryKey: string,
): Promise<readonly Memory[]>;
```

`readMemoryHistoryByKey` trie strictement par `version` croissante. La lecture
active retourne zéro ou une `Memory` et échoue si l’état résultant contient une
ambiguïté.

`CommitMutations` ajoute :

```ts
readonly memories: readonly Memory[];
```

Les appels G0-A1 et G0-A2 existants fourniront mécaniquement `memories: []`.

Aucune API suivante n’est créée :

```text
searchMemories
findRelevantMemories
rankMemories
semanticSearch
embedding
vector index
```

La seule récupération décisionnelle G0-A3 dérive une clé connue puis effectue
une lecture active unique.

---

# 6. Fixture événementielle canonique

## 6.1 Sources

La fixture enregistre au minimum :

```text
SRC-G0A3-SYSTEM
kind: system

SRC-G0A3-OPERATOR
kind: human
actorRef: OP-G0A3-001
```

Tous les événements appartiennent au même `lenoseedId`. Les séquences et les
horodatages sont strictement croissants et fournis par la fixture.

## 6.2 Réutilisation des `EventType`

G0-A3 ne crée aucun nouvel `EventType`. Il utilise :

- `human_message_received` ;
- `intention_selected` ;
- `validation_decision_recorded` ;
- `state_commit_completed`.

Les messages et intentions de fixture utilisent `payloadSchemaVersion: 3`.
Les versions 1 et 2 existantes conservent leur sens historique.

## 6.3 Payload `human_message_received` schema v3

```text
payload:
  text: <texte exact>
  protocol: G0-A3
  episodeKey: EP-G0A3-CALIBRATION-01
  fixtureKind:
    configuration_request
    | calibration_failure_report
    | initial_failure_explanation
    | failure_explanation_correction
```

La situation future utilise le même type et la même version avec :

```text
payload:
  text: <texte exact de S-G0A3-CALIBRATION-02>
  protocol: G0-A3
  situationId: S-G0A3-CALIBRATION-02
  relevantEpisodeKey: EP-G0A3-CALIBRATION-01
  availableConfigurations: [A, B]
  cableCanBeChecked: true
```

Ce payload ne contient ni identifiant de `Memory`, ni version attendue, ni
action recommandée.

## 6.4 Payload `intention_selected` schema v3

L’action historique utilise :

```text
payload:
  intentionId: I-G0A3-<lenoseedId>-CALIBRATION-01
  protocol: G0-A3
  episodeKey: EP-G0A3-CALIBRATION-01
  kind: run_calibration_with_configuration_a
  motivation: execute_requested_calibration_configuration
  triggerEventIds: [<configuration_request.id>]
  triggerMemoryIds: []
```

Les intentions futures utilisent le même schema avec exactement :

```text
payload:
  intentionId: I-<turnId>
  protocol: G0-A3
  situationId: S-G0A3-CALIBRATION-02
  kind: <décision fermée>
  motivation: <motivation exacte>
  triggerEventIds: [<situationEvent.id>]
  triggerMemoryIds: [] | [<memory active id>]
```

## 6.5 Suite exacte de l’épisode

Les identifiants de fixture sont dérivés de `lenoseedId` et du suffixe indiqué.

Pour chaque ligne, les formats exacts sont :

```text
Event.id:
E-G0A3-<lenoseedId>-<suffixe>

Event.idempotencyKey:
g0a3:<lenoseedId>:EP-G0A3-CALIBRATION-01:fixture:<suffixe>
```

| Ordre | Suffixe d’Event | Type | Source | Texte ou action exacte |
|---:|---|---|---|---|
| 1 | `calibration-01-request` | `human_message_received` v3 | opérateur | `Utilise la configuration A pour le test de calibration.` |
| 2 | `calibration-01-intention` | `intention_selected` v3 | système | `run_calibration_with_configuration_a` |
| 3 | `calibration-01-failure` | `human_message_received` v3 | opérateur | `La calibration a échoué.` |
| 4 | `calibration-01-initial-explanation` | `human_message_received` v3 | opérateur | `D’après le contrôle initial, la configuration A est incompatible avec ce capteur.` |
| 5 | `calibration-01-correction` | `human_message_received` v3 | opérateur | `Correction : la configuration A était compatible. L’échec venait du câble C, qui était débranché.` |

L’intention est causée par la demande. Le rapport d’échec est postérieur à
l’intention. L’explication initiale est postérieure au rapport. La correction
est postérieure à l’explication. La relation épistémique de supersession reste
portée par les `EvidenceItem`, jamais par une réécriture de ces événements.

La situation future exacte reste celle du protocole :

```text
S-G0A3-CALIBRATION-02

Une nouvelle calibration du même modèle de capteur doit être lancée.
Les configurations A et B sont disponibles.
Le câble C peut être vérifié avant le lancement.
relevantEpisodeKey: EP-G0A3-CALIBRATION-01
```

---

# 7. `EvidenceItem` exacts

Les identifiants sont déterministes à partir de l’événement source et du rôle
de la proposition :

```text
E1: EV-G0A3-OBS-<calibration-01-intention.id>
E2: EV-G0A3-TESTIMONY-<calibration-01-failure.id>-outcome
E3: EV-G0A3-TESTIMONY-<calibration-01-initial-explanation.id>-cause
E4: EV-G0A3-TESTIMONY-<calibration-01-correction.id>-compatibility
E5: EV-G0A3-TESTIMONY-<calibration-01-correction.id>-cause
```

Tous les témoignages utilisent un grounding
`text_excerpt` exact ; l’observation utilise `structured_event`.

## 7.1 Preuves de v1

### E1 — sélection réelle de A

```text
kind: behavioral_observation
subjectRef: <lenoseedId>
predicate: selected_calibration_configuration
value: A
context:
  protocol: G0-A3
  episodeKey: EP-G0A3-CALIBRATION-01
eventIds: [<calibration-01-intention.id>]
sourceId: SRC-G0A3-SYSTEM
grounding: structured_event(<calibration-01-intention.id>)
status: active
supersedesId: null
```

Cette observation établit uniquement que A a été sélectionnée.

### E2 — rapport d’échec

```text
kind: testimony
subjectRef: OP-G0A3-001
predicate: reported_calibration_outcome
value: failure
context:
  protocol: G0-A3
  episodeKey: EP-G0A3-CALIBRATION-01
eventIds: [<calibration-01-failure.id>]
supportingExcerpt: La calibration a échoué.
status: active
supersedesId: null
```

### E3 — attribution initiale

```text
kind: testimony
subjectRef: OP-G0A3-001
predicate: attributed_calibration_failure_cause
value: configuration_a_sensor_incompatibility
context:
  protocol: G0-A3
  episodeKey: EP-G0A3-CALIBRATION-01
eventIds: [<calibration-01-initial-explanation.id>]
supportingExcerpt: D’après le contrôle initial, la configuration A est incompatible avec ce capteur.
status: active
supersedesId: null
```

La proposition reste un témoignage attribué à l’opérateur. Elle ne devient pas
un fait physique établi.

## 7.2 Preuves de correction

Le message de correction produit exactement deux témoignages atomiques.

### E4 — compatibilité corrigée

```text
kind: testimony
subjectRef: OP-G0A3-001
predicate: reported_configuration_compatibility
value: compatible
context:
  protocol: G0-A3
  episodeKey: EP-G0A3-CALIBRATION-01
  configuration: A
eventIds: [<calibration-01-correction.id>]
supportingExcerpt: la configuration A était compatible
status: active
supersedesId: null
```

### E5 — cause corrigée

```text
kind: testimony
subjectRef: OP-G0A3-001
predicate: attributed_calibration_failure_cause
value: cable_c_disconnected
context:
  protocol: G0-A3
  episodeKey: EP-G0A3-CALIBRATION-01
eventIds: [<calibration-01-correction.id>]
supportingExcerpt: L’échec venait du câble C, qui était débranché.
status: active
supersedesId: <E3.id>
```

Comme dans G0-A1, l’ancien `EvidenceItem` n’est pas remplacé en place. E3 reste
la trace historiquement vraie de l’explication initialement donnée ; E5 porte
explicitement la supersession. G0-A3 n’ajoute pas une mutation générale du
cycle de vie des `EvidenceItem`.

## 7.3 Snapshots retenus par les versions

v1 référence exactement :

```text
evidenceItemIds: [E1, E2, E3]
eventIds: [intention A, rapport d’échec, explication initiale]
```

v2 référence exactement :

```text
evidenceItemIds: [E1, E2, E4, E5]
eventIds: [intention A, rapport d’échec, correction]
```

Les listes sont triées par `Event.sequence`, puis par identifiant lorsque deux
preuves partagent le même événement. Elles ne contiennent aucun doublon.

E3 et son événement deviennent seulement historiques pour la projection v2 :
ils restent accessibles depuis v1 et depuis le journal. La relation
`E5.supersedesId = E3.id` permet d’auditer que v2 représente une correction et
non une histoire différente inventée après coup.

---

# 8. Gists déterministes exacts

## 8.1 Gist v1

La chaîne exacte, ponctuation comprise, est :

> Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test ; l’opérateur a signalé l’échec de la calibration et l’a alors attribué à une incompatibilité entre A et le capteur.

Elle est reconstruite uniquement si E1, E2 et E3 possèdent les propositions et
provenances exactes de la section 7.

## 8.2 Gist v2

La chaîne exacte, ponctuation comprise, est :

> Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test et l’opérateur a signalé l’échec de la calibration ; une correction ultérieure indique que A était compatible et que le câble C était débranché.

Elle est reconstruite uniquement depuis E1, E2, E4 et E5, avec la relation de
supersession E5 → E3 validée. Les mots « une correction ultérieure » préservent
le caractère historique de l’ancienne attribution ; v1 et E3 restent lisibles.

Le validateur compare une égalité exacte au template attendu. Il n’emploie ni
similarité textuelle, ni résumé libre, ni validation sémantique LLM.

## 8.3 Horodatage des versions

L’horodatage n’est pas fourni librement par l’appelant :

```text
v1.createdAt = calibration-01-initial-explanation.occurredAt
v2.createdAt = calibration-01-correction.occurredAt
```

Pour chaque opération, le checkpoint et la completion utilisent exactement le
`createdAt` de la nouvelle version planifiée. Une reprise conserve ces valeurs ;
elle ne consulte pas une nouvelle horloge.

---

# 9. Validateur pur `Memory`

Le futur domaine expose conceptuellement :

```ts
validateG0A3Memory(
  candidate: Memory,
  context: G0A3MemoryValidationContext,
): void;
```

Le contexte contient les `Event`, `EvidenceItem`, `Source` et l’historique
`Memory` déjà résolus par la couche applicative ou par le store. Le validateur
ne reçoit aucun `PersistencePort`, ne lit aucun état global et n’appelle aucun
LLM.

Il vérifie au minimum :

1. `lenoseedId`, `episodeKey`, `memoryKey` et id déterministe ;
2. version entière >= 1 ;
3. listes non vides, uniques et dans l’ordre canonique ;
4. appartenance de tous les événements et preuves au même Lenoseed ;
5. existence de chaque `Event`, `EvidenceItem` et `Source` ;
6. provenance `EvidenceItem → Event → Source` et grounding valide ;
7. exactitude des propositions bornées E1–E5 ;
8. égalité entre `eventIds` et l’union canonique des événements des preuves ;
9. gist exact attendu pour la version ;
10. `createdAt` conforme à la section 8.3, `salience: high`,
    `confidence: high`, `lastRecalledAt: null` ;
11. v1 `active` avec `revisionOf: null` lors de sa création ;
12. v2 `active` avec `revisionOf: v1.id` lors de sa création ;
13. continuité et unicité de l’historique ;
14. absence de version active concurrente ;
15. aucune modification d’un snapshot ancien, hors transition autorisée de
    son seul statut `active → revised` dans le commit de révision.

Une preuve absente, étrangère, invalidée, mal groundée, un gist seulement
proche, une liste réordonnée ou une chaîne de versions impossible provoquent
`DomainInvariantError`.

---

# 10. Défense en profondeur de `InMemoryStore`

`InMemoryStore` ajoutera une collection `memories` par Lenoseed et défendra les
mêmes invariants sur l’état résultant complet avant toute mutation réelle.

Pour chaque `memoryKey`, il vérifie simplement :

- unicité de chaque version ;
- présence de v1 ;
- continuité 1 → N ;
- `revisionOf` direct ;
- au maximum une `active` ;
- version active égale à N ;
- toutes les versions antérieures `revised` ;
- aucun branchement ;
- références de provenance existantes et cohérentes.

Une création ou révision d’un autre Lenoseed, un `EvidenceItem` absent, un
`Event` absent, une source incohérente, un saut de version, un prédécesseur faux,
une version dupliquée ou deux actives est rejeté avant application.

Le remplacement d’une `Memory` existante n’est autorisé que si :

```text
existing.status = active
replacement.status = revised
```

et si tous les autres champs sont strictement identiques. Une version déjà
`revised` est immuable.

Le fingerprint idempotent continue de porter sur l’objet complet de mutations.
À clé identique, un snapshot différent provoque `IdempotencyConflictError`.

---

# 11. Atomicité

## 11.1 Création v1

Un unique `atomicCommit` ajoute v1 `active` dans `memories`. Avant application,
l’état résultant doit ne contenir aucune autre version de la même `memoryKey`.

Le commit :

- utilise l’`expectedStateVersion` du checkpoint ;
- ajoute exactement v1 ;
- incrémente `stateVersion` une seule fois ;
- n’ajoute ni croyance, ni hypothèse, ni lien de preuve ;
- ne produit aucun sous-état visible en cas d’échec.

## 11.2 Révision v1 → v2

Un unique `atomicCommit` reçoit ensemble :

```text
v1 avec status: revised
v2 avec status: active
```

Il applique tout ou rien. Aucun instant durable ne peut exposer :

- v1 et v2 toutes deux actives ;
- v1 révisée sans v2 ;
- v2 active sans v1 révisée ;
- zéro version active après un commit de révision réussi.

La révision incrémente `stateVersion` exactement une fois.

---

# 12. Use case de création v1

Le use case futur s’appelle exactement :

```ts
consolidateG0A3Memory(...)
```

Son entrée minimale est :

```ts
interface ConsolidateG0A3MemoryInput {
  readonly lenoseedId: EntityId;
  readonly episodeKey: "EP-G0A3-CALIBRATION-01";
  readonly systemSourceId: EntityId;
  readonly evidenceItemIds: readonly EntityId[];
  readonly expectedStateVersion: StateVersion;
  readonly engineVersion: string;
}
```

`evidenceItemIds` doit contenir exactement E1, E2 et E3. Les identifiants de la
`Memory`, du checkpoint et de la completion sont dérivés, non choisis librement
par l’appelant.

Séquence normative :

```text
1. lire le checkpoint éventuel
2. sinon lire exactement E1, E2, E3 et leur provenance
3. vérifier qu’aucun historique Memory n’existe pour memoryKey
4. construire v1 et son gist déterministes
5. valider le plan pur
6. écrire le checkpoint
7. appeler atomicCommit avec le snapshot exact
8. valider l’état durable résultant
9. écrire state_commit_completed
10. retourner le résultat structuré
```

Le use case ne scanne pas librement le journal pour choisir un épisode, ne
choisit aucune preuve implicite, ne génère aucun gist libre et n’appelle aucun
LLM.

---

# 13. Checkpoint `memory_consolidation`

G0-A3 réutilise `validation_decision_recorded` avec :

```text
payloadSchemaVersion: 4
scope: memory_consolidation
```

Les schemas 1 à 3 existants conservent leur sens historique. Le checkpoint est
écrit avant `atomicCommit`.

## 13.1 Snapshot exact

```text
payload:
  scope: memory_consolidation
  operationId: <identité stable définie en section 15>
  action: create | revise
  memoryKey: <clé exacte>
  episodeKey: EP-G0A3-CALIBRATION-01
  version: 1 | 2
  inputEventIds: <liste canonique>
  inputEvidenceItemIds: <liste canonique>
  priorMemorySnapshot: <v1 active exacte ou null>
  nextMemorySnapshot: <v1 ou v2 active exacte>
  expectedStateVersion: N
```

`nextMemorySnapshot` contient tous les champs de `Memory`, donc notamment id,
clé, version, références, gist exact, salience, confiance, statut,
`revisionOf`, `createdAt` et `lastRecalledAt`.

Pour `create`, `priorMemorySnapshot` vaut `null`. Pour `revise`, il contient le
snapshot complet de v1 encore `active` attendu avant commit ; le snapshot v1
`revised` à committer se déduit exclusivement par changement de statut.

Le checkpoint :

- a `turnId: null` ;
- utilise une `Source` système ;
- porte `observedStateVersion = expectedStateVersion` ;
- possède les causes décrites ci-dessous ;
- est retrouvé par id, clé d’idempotence ou couple scope/operationId ;
- est unique.

Causes de création : les trois événements de v1, triés par `sequence`.

Causes de révision : l’événement de correction, puis le checkpoint de création
de v1. La frontière historique v1 doit avoir un checkpoint, une completion et
un état durable cohérents avant qu’elle soit admise comme prédécesseur.

Après ce checkpoint, aucun gist, identifiant, ordre de preuve ou version n’est
recalculé librement.

---

# 14. Completion

G0-A3 réutilise `state_commit_completed` avec :

```text
payloadSchemaVersion: 3
scope: memory_consolidation
```

Payload exact :

```text
payload:
  scope: memory_consolidation
  operationId: <identité stable>
  action: create | revise
  memoryKey: <clé exacte>
  version: 1 | 2
  previousStateVersion: N
  newStateVersion: N + 1
  changed: true
```

L’événement :

- a `turnId: null` ;
- utilise la même source système et le même `engineVersion` que le checkpoint ;
- a `causedByEventIds: [<checkpoint.id>]` ;
- a `observedStateVersion = previousStateVersion` ;
- utilise le même timestamp déterministe que le plan ;
- possède sa propre clé d’idempotence.

Une création ou révision valide change toujours l’état une fois. Un replay
retourne ce résultat historique ; il ne crée pas une completion `changed:false`.

---

# 15. Identités d’opération et clés d’idempotence

Les clés ne dépendent jamais du gist.

## 15.1 Création v1

```text
operationId:
g0a3:<lenoseedId>:<episodeKey>:v1:create

décision:
g0a3:<lenoseedId>:<episodeKey>:v1:create:decision

commit:
g0a3:<lenoseedId>:<episodeKey>:v1:create:commit

completed:
g0a3:<lenoseedId>:<episodeKey>:v1:create:completed
```

IDs d’événements :

```text
E-G0A3-<lenoseedId>-<episodeKey>-v1-create-decision
E-G0A3-<lenoseedId>-<episodeKey>-v1-create-completed
```

## 15.2 Révision v2

```text
operationId:
g0a3:<lenoseedId>:<episodeKey>:v2:revise

décision:
g0a3:<lenoseedId>:<episodeKey>:v2:revise:decision

commit:
g0a3:<lenoseedId>:<episodeKey>:v2:revise:commit

completed:
g0a3:<lenoseedId>:<episodeKey>:v2:revise:completed
```

IDs d’événements :

```text
E-G0A3-<lenoseedId>-<episodeKey>-v2-revise-decision
E-G0A3-<lenoseedId>-<episodeKey>-v2-revise-completed
```

Une même opération reproduit les mêmes snapshots et converge vers le même
résultat. Une clé identique avec un contenu différent est un conflit fermé.

---

# 16. Recovery normatif

La reprise suit un automate borné.

## R1 — aucun checkpoint

Le use case peut lire les entrées explicitement fournies, valider leur
provenance, construire une seule fois le plan déterministe et écrire le
checkpoint.

## R2 — checkpoint présent, commit absent

Le checkpoint est parsé et validé contre ses entrées historiques. Les mutations
sont reconstruites exclusivement depuis `priorMemorySnapshot` et
`nextMemorySnapshot`. Aucun nouveau gist, id ou ordre de preuve n’est produit.

Si `stateVersion` ne correspond plus à la frontière observée et que le commit
idempotent n’a pas été appliqué, la reprise échoue fermée.

## R3 — commit appliqué, completion absente

La reprise vérifie l’état durable exact, rappelle `atomicCommit` avec la même
clé et le même fingerprint afin de récupérer son résultat historique, puis
écrit uniquement la completion manquante.

## R4 — completion présente

La reprise valide :

```text
checkpoint
→ completion
→ état durable correspondant
```

Puis elle retourne le résultat historique sans mutation. Après une révision,
un replay de la création v1 accepte que la v1 historiquement créée soit
désormais `revised`, à condition que tous ses champs immuables correspondent au
snapshot du checkpoint.

## R5 — état durable partiel

Les états suivants sont impossibles et provoquent `DomainInvariantError` :

- v1 `revised` sans v2 ;
- v2 active sans v1 ;
- deux actives ;
- completion sans checkpoint ;
- completion annonçant un commit absent ;
- une partie seulement du snapshot durable.

Aucune tentative de réparation implicite n’est autorisée.

## R6 — checkpoint falsifié ou incompatible

Toute divergence d’identité, de source, de causes, de schema, de version d’état,
de preuve, de gist, de snapshot, de timestamp ou de clé provoque un échec fermé
avant commit.

## R7 — historique `Memory` impossible

Version dupliquée, trou, branche, mauvais prédécesseur, ancienne version active,
version maximale non active ou snapshot ancien modifié provoquent un échec
fermé.

## R8 — clé d’idempotence déjà appliquée

Même clé et même fingerprint retournent le résultat original. Même clé et
fingerprint différent provoquent `IdempotencyConflictError`. Aucun second
incrément de `stateVersion` n’est possible.

---

# 17. Récupération décisionnelle bornée

Le builder futur s’appelle :

```ts
buildG0A3MemoryDecisionContext(...)
```

Entrée minimale :

```ts
interface BuildG0A3MemoryDecisionContextInput {
  readonly lenoseedId: EntityId;
  readonly situationEvent: Event;
  readonly relevantEpisodeKey: "EP-G0A3-CALIBRATION-01";
  readonly includeMemory: boolean;
}
```

`includeMemory` sert uniquement à l’ablation expérimentale.

Séquence :

1. valider le `human_message_received` schema v3 de
   `S-G0A3-CALIBRATION-02` ;
2. dériver `memoryKey` ;
3. si `includeMemory` est vrai, appeler uniquement
   `readActiveMemoryByKey` ;
4. résoudre et valider uniquement la provenance référencée par cette `Memory` ;
5. construire le snapshot fermé ;
6. ne rien écrire.

Le builder ne peut appeler ni `readEventsInSequence`, ni une lecture générique
des preuves, ni une recherche sémantique. Il peut seulement résoudre les ids de
la `Memory` trouvée afin de valider son propre snapshot.

Le snapshot remis au décideur est :

```ts
interface G0A3MemoryDecisionSnapshot {
  readonly memory: Memory;
  readonly selectedConfiguration: "A";
  readonly reportedOutcome: "failure";
  readonly currentFailureAttribution:
    | "configuration_a_sensor_incompatibility"
    | "cable_c_disconnected";
  readonly configurationACompatibility: "unknown" | "compatible";
}

interface G0A3MemoryDecisionContext {
  readonly situationEvent: Event;
  readonly memorySnapshot: G0A3MemoryDecisionSnapshot | null;
}
```

Ces discriminants sont dérivés des propositions exactes validées. Le décideur
ne parse pas le gist et ne reçoit ni journal, ni `PersistencePort`, ni anciennes
versions.

---

# 18. Intention et sélecteur futur

## 18.1 Extensions minimales d’`Intention`

`IntentionKind` ajoutera :

```ts
type G0A3IntentionKind =
  | "run_calibration_with_configuration_a"
  | "use_configuration_a_after_checking_cable_c"
  | "use_configuration_b"
  | "request_new_diagnostic";
```

`Intention` ajoutera :

```ts
readonly triggerMemoryIds: readonly EntityId[];
```

Les intentions G0-A1/G0-A2 existantes utiliseront `[]`. Une décision G0-A3
influencée utilise exactement l’id de la version active consommée. La politique
neutre utilise `[]`.

L’`Intention` future est construite exactement ainsi :

```text
id: I-<turnId>
lenoseedId: <lenoseedId>
target: <humanActorRef>
triggerEventIds: [<situationEvent.id>]
triggerEvidenceItemIds: []
triggerBeliefIds: []
triggerSelfHypothesisIds: []
triggerMemoryIds: [] | [<memory active id>]
observedStateVersion: situationEvent.observedStateVersion
status: selected
createdAt: situationEvent.occurredAt
```

## 18.2 Politique pure

Le sélecteur ne dépend d’aucun port et applique exactement :

```text
memorySnapshot = null
→ request_new_diagnostic

v1 active + attribution configuration_a_sensor_incompatibility
→ use_configuration_b

v2 active + A compatible + attribution cable_c_disconnected
→ use_configuration_a_after_checking_cable_c
```

Toute autre combinaison est rejetée comme snapshot invalide ; elle ne reçoit
pas une heuristique de secours.

Motivations exactes :

```text
apply_active_g0a3_memory_avoid_reported_incompatibility
apply_active_g0a3_memory_check_corrected_cable_cause
apply_neutral_g0a3_policy_without_memory
```

La sélection et l’`intention_selected` existent avant toute formulation. Aucun
texte LLM ne participe à la variable mesurée.

## 18.3 Enregistrement et replay de la décision

Le use case futur s’appelle `selectG0A3MemoryIntention`. Il enregistre d’abord
la situation, construit le contexte borné, sélectionne l’intention pure, puis
ajoute l’`intention_selected` schema v3 avant toute formulation.

```text
Event.id: E-<turnId>-intention
Event.idempotencyKey: <turnId>:intention
causedByEventIds: [<situationEvent.id>]
observedStateVersion: situationEvent.observedStateVersion
```

### 18.3.1 Identité de la situation future

La situation future réutilise la convention générale d’entrée de tour déjà
utilisée par `processTurn`. Cette convention évite une identité parallèle
spécifique à G0-A3 et permet le replay déterministe par `turnId`.

```text
Event.id: E-<turnId>-input
Event.idempotencyKey: <turnId>:input
Event.type: human_message_received
payloadSchemaVersion: 3
turnId: <turnId> non null
sourceId: <humanSourceId>
actorRef: <humanActorRef>
causedByEventIds: []
observedStateVersion: version durable courante au premier enregistrement
occurredAt: timestamp déterministe fourni pour ce tour
engineVersion: version du moteur fournie au use case
payload: le payload canonique de S-G0A3-CALIBRATION-02
```

Les six champs du payload canonique ne sont pas modifiés par cette identité.

### 18.3.2 Situation enregistrée sans intention

Le cas d'une situation future présente sans `intention_selected` pour le même
`turnId` est un état partiel dont l'origine expérimentale ne peut pas être
reconstruite. `includeMemory` sert à l'ablation expérimentale, mais n'est
volontairement stocké ni dans le payload de situation, ni dans un événement
d'ablation, ni dans l'état durable. Après une interruption, il est donc
impossible de savoir si l'appel initial devait consommer la `Memory`.

Le use case futur échoue fermé avec `DomainInvariantError` et ne reprend pas
automatiquement la sélection pour ce `turnId`. Une nouvelle tentative
expérimentale utilise un nouveau `turnId`.

Il est interdit d'ajouter `includeMemory`, `memoryId`, une version de `Memory`
ou une action attendue au payload, ainsi que de créer un événement ou un
checkpoint d'ablation pour lever cette ambiguïté.

### 18.3.3 Replay complet

Si un même `turnId` possède une situation valide et un `intention_selected`
valide, le replay :

- valide les deux événements historiques ;
- reconstruit l'intention historique ;
- retourne `replayed: true` ;
- ne rappelle pas `buildG0A3MemoryDecisionContext` ;
- ne relit pas `readActiveMemoryByKey` ;
- ne resélectionne pas l'intention ;
- ne dépend pas du `stateVersion` courant ;
- conserve `situationEvent.observedStateVersion` et les `triggerMemoryIds`
  historiques.

La valeur `includeMemory` fournie lors d'un nouvel appel n'a aucun effet sur un
replay déjà complété. Une révision ultérieure de la `Memory` ne modifie pas la
décision historique.

### 18.3.4 États historiques impossibles

Le use case de décision échoue fermé avec `DomainInvariantError` dans les cas
suivants :

- plusieurs `human_message_received` pour le même tour de décision G0-A3 ;
- plusieurs `intention_selected` pour ce tour ;
- `intention_selected` sans situation correspondante ;
- situation présente sans intention lors d'une tentative de reprise ;
- situation incompatible avec l'identité ou le payload canonique du `turnId` ;
- intention historique incompatible avec la situation.

Aucun comportement de formulation n'est défini dans cette frontière.

---

# 19. Contrôle sans consolidation `C1-Memory`

Le contrôle s’appelle exactement `C1-Memory`.

Il conserve :

- les cinq événements de l’épisode lorsqu’ils sont pertinents au stade testé ;
- les `EvidenceItem` et leur provenance ;
- le même état durable hors `Memory` ;
- la même situation future.

Il n’appelle ni `consolidateG0A3Memory` ni `reviseG0A3Memory`. Aucune `Memory`
n’existe pour la clé. Le builder retourne `memorySnapshot: null` et le sélecteur
choisit :

```text
request_new_diagnostic
```

Le décideur ne peut pas reconstruire une mémoire à partir du journal brut.

---

# 20. Ablation de consommation

L’ablation appelle le même builder avec :

```text
includeMemory: false
```

Le builder ne lit pas la `Memory` et retourne `memorySnapshot: null`. Il
n’effectue aucune mutation et n’écrit aucun événement d’ablation.

Le résultat est :

```text
request_new_diagnostic
```

Après la décision, le test relit explicitement :

```text
readActiveMemoryByKey(lenoseedId, memoryKey)
```

et vérifie que la même `Memory` active est toujours présente. `stateVersion`
reste inchangée.

---

# 21. Use case de révision v1 → v2

La révision utilise un use case séparé :

```ts
reviseG0A3Memory(...)
```

Cette solution est retenue plutôt qu’une branche implicite de
`consolidateG0A3Memory` : les préconditions, preuves, snapshots, action,
idempotency keys et tests de falsification sont différents. Deux use cases
bornés sont plus lisibles qu’un consolidateur général à modes cachés.

Entrée minimale :

```ts
interface ReviseG0A3MemoryInput {
  readonly lenoseedId: EntityId;
  readonly episodeKey: "EP-G0A3-CALIBRATION-01";
  readonly systemSourceId: EntityId;
  readonly expectedActiveMemoryId: EntityId;
  readonly correctionEvidenceItemIds: readonly EntityId[];
  readonly expectedStateVersion: StateVersion;
  readonly engineVersion: string;
}
```

Les correction ids contiennent exactement E4 et E5. La révision :

1. lit v1 par id et par clé ;
2. valide la frontière historique de création de v1 ;
3. vérifie que v1 est encore la seule active et correspond à
   `expectedActiveMemoryId` ;
4. lit et valide E4, E5, leur événement de correction et E5 → E3 ;
5. construit v2 depuis E1, E2, E4 et E5 ;
6. produit le gist v2 exact ;
7. checkpoint-e v1 attendue et v2 planifiée ;
8. committe ensemble v1 `revised` et v2 `active` ;
9. valide les deux snapshots durables ;
10. écrit la completion.

Après checkpoint, aucun retry ne relit de nouvelles preuves pour produire une
autre v2.

---

# 22. Décision future après révision

Après un commit v2 réussi :

- `readActiveMemoryByKey` retourne uniquement v2 ;
- `readMemoryHistoryByKey` retourne `[v1 revised, v2 active]` ;
- le builder ne fournit que v2 au décideur ;
- `triggerMemoryIds` contient uniquement v2.id ;
- la décision exacte est
  `use_configuration_a_after_checking_cable_c`.

Une lecture active de v1, une consommation simultanée v1/v2 ou une décision
fondée sur v1 `revised` est un échec du protocole.

---

# 23. Stratégie de tests déterministes

Aucun test n’est créé par ce document. Le futur lot devra couvrir au minimum :

## A. Domaine `Memory`

- structure complète ;
- vocabulaires et valeurs canoniques ;
- `memoryKey` et id déterministes ;
- versions et statuts ;
- `revisionOf` ;
- immutabilité hors transition `active → revised`.

## B. Store

- création ;
- lecture par id ;
- lecture active par clé ;
- historique trié ;
- unicité de version ;
- unicité active ;
- chaîne v1 → v2 valide ;
- refus de branchement et de trou.

## C. Validation

- événement absent ;
- preuve absente ;
- source absente ;
- mauvais Lenoseed ;
- provenance ou grounding invalide ;
- mauvais `memoryKey` ;
- mauvais id ;
- mauvais gist ;
- mauvaise liste ou ordre de preuves ;
- mauvaise `revisionOf` ;
- saut ou duplication de version ;
- deux actives ;
- ancienne version modifiée.

## D. Consolidation v1

- plan exact ;
- checkpoint avant commit ;
- v1 active et `stateVersion + 1` ;
- aucune autre mutation.

## E. Reset du contexte

- aucun message brut de l’épisode fourni à la situation future ;
- récupération par clé toujours fonctionnelle.

## F. Influence pré-langage v1

- snapshot v1 exact ;
- `use_configuration_b` ;
- intention et `triggerMemoryIds` avant langage.

## G. `C1-Memory`

- histoire et preuves présentes ;
- aucune `Memory` ;
- `request_new_diagnostic`.

## H. Ablation

- `Memory` active avant et après ;
- snapshot retiré ;
- aucune mutation ;
- `request_new_diagnostic`.

## I. Révision v1 → v2

- correction, supersession E5 → E3 et gist exact ;
- v1 `revised` + v2 `active` dans un commit ;
- un seul incrément d’état.

## J. Influence pré-langage v2

- v2 seule consommée ;
- `use_configuration_a_after_checking_cable_c`.

## K. Historique

- v1 et v2 accessibles dans l’ordre ;
- snapshots inchangés ;
- v1 jamais retournée comme active.

## L. Idempotence

- mêmes clés et snapshots retournent le résultat historique ;
- contenu différent sous la même clé est rejeté.

## M. Recovery complet

- R1 à R8 pour création et révision ;
- replay de création après v2 ;
- aucune reconstruction post-checkpoint.

## N. Falsification

- checkpoint : identité, schema, source, causes, preuves, gist, statut,
  predecessor, version d’état ;
- completion : scope, opération, causes, versions et `changed` ;
- état durable différent du snapshot.

## O. Atomicité et failure injection

- échec avant commit ;
- échec injecté pendant commit ;
- commit appliqué avant completion ;
- aucune version partielle ou active concurrente.

Tous les tests G0-A1 et G0-A2 restent verts. Aucun test ne mesure la qualité
stylistique d’un texte.

---

# 24. Aucun C0 API et aucune policy IA

G0-A3 ne crée :

- aucun runner OpenAI ;
- aucune policy de prompt ;
- aucun JSON Schema IA ;
- aucune commande `test:ai` ou C0 ;
- aucune campagne de modèle.

La variable expérimentale est entièrement déterministe : présence d’une
projection persistée, récupération bornée, consommation structurée et révision.
Un LLM seul ne peut ni valider ni réfuter ces propriétés de store et de
causalité pré-langage.

---

# 25. Gate, risques et ADR

## 25.1 Gate

La case :

```text
mémoire minimale testée
```

reste décochée dans `docs/pilotage/03-gates-validation.md`. Protocole et contrat
définis ne valent pas implémentation ou résultat. G0-A reste ouvert et G0-B
reste NO-GO.

## 25.2 Risques

Le contrat renforce les garde-fous existants sans changer leur statut :

- R-001 : gist exact, snapshot fermé, intention pré-langage ;
- R-002 : preuves et groundings revalidés ;
- R-007 : atomicité et recovery logique, sans prétention de durabilité disque ;
- R-008 : oubli et longévité restent hors G0-A3 ;
- R-013 : contrôle, ablation et état causal mesurable.

Aucun risque transversal nouveau n’est révélé. Le registre des risques n’est
donc pas modifié et aucun risque n’est marqué résolu.

## 25.3 ADR et D-019

Aucun nouvel ADR n’est nécessaire. `PersistencePort` et `InMemoryStore` restent
dans le cadre d’ADR-005 ; l’événementiel reste dans ADR-003.

D-019 reste l’unique décision structurante sur l’identité logique de `Memory`.
Son index doit référencer le protocole et le présent contrat, sans créer une
décision dupliquée.

---

# 26. Ordre futur d’implémentation

Lorsque le code sera explicitement autorisé :

```text
1. type Memory et builders d’identité
2. validateur pur Memory
3. PersistencePort et défenses InMemoryStore
4. fixtures Event/Evidence G0-A3
5. consolidateG0A3Memory et recovery v1
6. builder borné et sélecteur pur
7. C1-Memory et ablation
8. reviseG0A3Memory et recovery v2
9. tests de falsification et failure injection
10. protocole déterministe complet
11. rapport de validation séparé
```

Chaque lot conserve G0-A1 et G0-A2. Aucun lot n’introduit recherche
sémantique, oubli G0-F, `HumanHypothesis`, interface, stockage de production ou
LLM.

---

## Décision finale du contrat

G0-A3 implémentera une seule mémoire épisodique contrôlée, identifiée par une
clé logique stable, validée depuis des preuves structurées, créée et révisée par
commits atomiques, récupérée uniquement par clé explicite et consommée par un
sélecteur pur avant langage.

Le mécanisme est invalide si le gist devient une preuve autonome, si une lecture
modifie l’état, si le décideur relit l’histoire brute, si une reprise recalcule
une autre version, si v1 et v2 sont partiellement exposées ou si un LLM choisit
la variable expérimentale.
