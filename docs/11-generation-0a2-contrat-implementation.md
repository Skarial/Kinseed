# Kinseed — G0-A2 : contrat d’implémentation de la première hypothèse sur soi

## Statut du document

Ce document fixe le contrat minimal à implémenter pour l’expérience déterministe
**G0-A2 — première hypothèse sur soi** définie dans
`docs/10-generation-0a2-protocole-premiere-hypothese-soi.md`.

Il ne modifie ni les résultats ni les critères de G0-A1. Il précise uniquement
les structures, invariants et contrôles nécessaires à G0-A2 avant tout code.

Les noms TypeScript présentés ici sont normatifs pour le premier lot G0-A2. Les
règles sont expérimentales et ne constituent pas un modèle général de
personnalité.

---

# 1. Contraintes héritées

Le contrat conserve les décisions déjà établies :

- l’`Event` append-only reste la source historique primaire ;
- une interprétation durable reste distincte de l’événement et de la preuve ;
- toute provenance doit pouvoir être reconstruite jusqu’à l’`Event` et à la
  `Source` ;
- une intention structurée existe avant toute formulation linguistique ;
- le LLM n’est ni le détenteur de l’identité, ni l’autorité de consolidation ;
- un commit de projections est atomique, idempotent et contrôlé par
  `stateVersion` ;
- `InMemoryStore` reste l’adaptateur expérimental et ne valide aucune durabilité
  après redémarrage ;
- les checkpoints et événements historiques existants ne sont jamais
  réinterprétés avec une nouvelle sémantique.

Le code actuel G0-A1 est volontairement plus étroit que le modèle conceptuel :
il ne matérialise pas encore `behavioral_observation`, cible seulement les
`Belief` dans `EvidenceLink`, et ne persiste aucune `SelfHypothesis`. G0-A2 étend
ces points sans changer leur sens G0-A1.

---

# 2. Origine non circulaire des histoires A et B

Pour le premier protocole déterministe, les décisions S1 à S4 de A et B sont des
**fixtures historiques contrôlées**. Chaque décision est matérialisée par un
véritable `Event` de type `intention_selected` cohérent avec l’action indiquée
par le protocole.

Ces événements :

- appartiennent au Kinseed concerné ;
- utilisent une `Source` système enregistrée ;
- identifient S1, S2, S3 ou S4 dans leur payload ;
- portent l’un des deux `IntentionKind` G0-A2 définis plus bas ;
- utilisent `payloadSchemaVersion: 2`, car leur payload G0-A2 comporte les
  champs causaux versionnés définis en section 14 ;
- sont écrits avant toute `SelfHypothesis` sur la clé testée ;
- contiennent `triggerSelfHypothesisIds: []` ;
- ne sont pas produits par le nouveau sélecteur fondé sur une hypothèse.

G0-A2 ne cherche donc pas encore à expliquer pourquoi A et B ont pris des
décisions historiques différentes. Il isole strictement la chaîne :

```text
intention historique enregistrée
→ behavioral_observation
→ EvidenceLink
→ SelfHypothesis
→ influence structurée sur S5
```

Les fixtures sont du matériau expérimental contrôlé, mais leurs événements sont
réels au sens du journal Kinseed : la provenance, l’ordre, l’idempotence et les
invariants normaux s’appliquent. Cette convention est compatible avec le
protocole canonique, qui les déclare déjà antérieures à toute hypothèse.

---

# 3. Vocabulaire borné de G0-A2

Les deux valeurs admises sont exactement :

```ts
type G0A2DecisionStyle =
  | "seek_clarification"
  | "use_available_information";
```

La proposition d’une hypothèse utilise :

```text
subjectRef: <kinseedId>
predicate: decision_style_under_uncertainty
value: seek_clarification | use_available_information
context:
  protocol: G0-A2
```

La proposition d’une observation utilise :

```text
subjectRef: <kinseedId>
predicate: selected_decision_style_under_uncertainty
value: seek_clarification | use_available_information
context:
  protocol: G0-A2
  situationId: S1 | S2 | S3 | S4 | <nouvelle situation de révision>
```

L’observation dit uniquement quelle orientation fonctionnelle a été
sélectionnée dans une situation identifiée. Elle ne dit jamais « Kinseed est
prudent », « Kinseed préfère toujours clarifier » ou une autre généralisation
psychologique.

Ce vocabulaire fermé rend la première consolidation déterministe. Il ne crée pas
un registre générique de traits.

---

# 4. Contrat minimal `SelfHypothesis`

```ts
type SelfHypothesisStage = "hypothesis";

type SelfHypothesisStatus = "active" | "disputed" | "superseded";

interface SelfHypothesis {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly hypothesisKey: string;
  readonly version: number;
  readonly proposition: Proposition;
  readonly stage: SelfHypothesisStage;
  readonly supportLinkIds: readonly EntityId[];
  readonly againstLinkIds: readonly EntityId[];
  readonly confidence: Confidence;
  readonly status: SelfHypothesisStatus;
  readonly previousVersionId: EntityId | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
```

`Confidence` est réutilisé depuis le domaine des croyances :

```ts
type Confidence = "low" | "moderate" | "moderate_high" | "high";
```

G0-A2 n’utilise toutefois que `low` et `moderate`. Il n’introduit ni probabilité
ni formule numérique.

## 4.1 Nature

Une `SelfHypothesis` est une interprétation matérialisée de plusieurs preuves.
Elle n’est jamais :

- un `Event` ;
- un `EvidenceItem` ;
- une auto-description produite par le LLM ;
- une `tendency` ;
- un trait stable.

Son seul `stage` possible en G0-A2 est `hypothesis`.

## 4.2 Clé logique

`hypothesisKey` est construit comme `buildBeliefKey` : sérialisation déterministe
de `subjectRef`, `predicate` et du `context` trié, en excluant `value`.

Les deux orientations opposées de l’axe G0-A2 partagent donc la même clé. Une
révision de valeur reste dans le même historique logique.

## 4.3 Statuts et unicité

- `active` : version courante éligible et consommable par le sélecteur ;
- `disputed` : version courante contestée, conservée mais non consommable ;
- `superseded` : ancienne version historique, jamais consommable.

Pour une `hypothesisKey`, le store autorise au maximum une version courante :
soit une `active`, soit une `disputed`, soit aucune. Toutes les autres versions
sont `superseded`. Il ne peut jamais exister deux versions `active`.

Le statut `inactive` n’est pas ajouté : `disputed` couvre la neutralisation
révisable et `superseded` couvre l’historique remplacé.

## 4.4 Versionnement

La première hypothèse a `version: 1` et `previousVersionId: null`. Toute
contestation ou inversion durable crée une nouvelle version :

- l’ancienne version courante devient `superseded` ;
- la nouvelle version incrémente `version` ;
- `previousVersionId` référence directement l’ancienne version ;
- les `Event`, `EvidenceItem` et `EvidenceLink` historiques ne sont ni supprimés
  ni réécrits ;
- les liens de la nouvelle version ciblent son propre identifiant.

Les champs immuables d’une version sont son identifiant, son Kinseed, sa clé, son
numéro, sa proposition, son prédécesseur et sa date de création. Le remplacement
d’une version par son état `superseded` ne peut modifier ces champs.

---

# 5. `behavioral_observation` et grounding structuré

`EvidenceKind` est étendu au strict nécessaire :

```ts
type EvidenceKind = "testimony" | "system_record" | "behavioral_observation";
```

Le grounding devient une union discriminée :

```ts
type EvidenceGrounding =
  | {
      readonly kind: "text_excerpt";
      readonly eventId: EntityId;
      readonly supportingExcerpt: string;
    }
  | {
      readonly kind: "structured_event";
      readonly eventId: EntityId;
    };
```

Le champ `EvidenceItem.grounding` reste de type `EvidenceGrounding | null` pour
les kinds qui n’exigent aucun grounding dans le périmètre existant.

Les témoignages G0-A1 utilisent `text_excerpt` et conservent exactement leurs
invariants lexicaux. Les observations G0-A2 utilisent `structured_event` et ne
fabriquent jamais de `supportingExcerpt`.

Pour une `behavioral_observation` G0-A2 :

- `id` est dérivé de manière stable de l’identifiant de l’`intention_selected`
  source ;
- `createdAt` vaut exactement `sourceEvent.occurredAt` ;
- `eventIds` contient exactement l’identifiant de l’`intention_selected`
  source ;
- `grounding.kind` vaut `structured_event` et `grounding.eventId` désigne ce
  même événement ;
- `sourceId` est celui de l’événement, donc une `Source` système connue ;
- `extractorVersion` identifie la transformation déterministe, par exemple
  `kinseed-g0a2-behavioral-observation-v1`, et non un modèle IA ;
- `extractionConfidence` vaut `high`, car l’observation recopie une décision
  structurée validée, sans certifier une interprétation psychologique ;
- `supersedesId` vaut `null` pour les fixtures du protocole.

La matérialisation est une transformation entièrement déterministe. À événement
source identique correspondent obligatoirement le même `EvidenceItem` complet,
incluant `id`, `createdAt`, `extractorVersion`, proposition, grounding,
`sourceId`, `eventIds`, `extractionConfidence`, `status` et `supersedesId`.
Ces champs sont dérivés exclusivement de l’événement source et des constantes
versionnées du protocole. Aucun `Date.now()`, horodatage de traitement, valeur
aléatoire ni timestamp recalculé lors d’un retry ne peut y participer.

Cette règle est nécessaire au contrat actuel de `InMemoryStore` : son commit
atomique fingerprinte l’objet complet `mutations` avec `JSON.stringify`. Avec la
même clé d’idempotence, un commit déjà appliqué ne retourne son résultat
historique que si le nouveau fingerprint est identique ; une valeur telle qu’un
`createdAt` différente provoquerait donc un `IdempotencyConflictError`.

Le validateur vérifie que l’événement existe, appartient au même Kinseed, est de
type `intention_selected`, provient de la même source, possède le
`payloadSchemaVersion` attendu et encode de façon cohérente le `situationId`, le
`kind` et l’orientation recopiés dans la proposition. Il vérifie également que
l’intention historique n’est pas postérieure à l’hypothèse qu’elle est censée
soutenir.

---

# 6. Généralisation minimale de `EvidenceLink`

Le champ spécifique `targetBeliefId` devient :

```ts
type EvidenceTargetType = "belief" | "self_hypothesis";

interface EvidenceLink {
  readonly id: EntityId;
  readonly kinseedId: EntityId;
  readonly evidenceItemId: EntityId;
  readonly targetType: EvidenceTargetType;
  readonly targetId: EntityId;
  readonly relation: "supports" | "contradicts";
  readonly sourceAuthority: EvidenceWeight;
  readonly independenceGroup: string;
  readonly causalContamination: "none" | "influenced_by_target";
  readonly weightClass: EvidenceWeight;
  readonly createdAt: Timestamp;
}
```

Les liens G0-A1 existants deviennent conceptuellement
`targetType: "belief"` avec le même identifiant cible. Leur relation, leur poids
et leurs invariants ne changent pas. Aucune migration durable n’est nécessaire,
car `InMemoryStore` est recréé pour chaque expérience.

`human_hypothesis` n’est pas ajouté au type d’implémentation : G0-A2 n’en a pas
besoin.

Pour chaque discriminant, le store vérifie que `targetId` référence une entité
du type annoncé dans l’état résultant du commit. Une `SelfHypothesis` ne peut
référencer dans `supportLinkIds` que des liens `supports` qui la ciblent, et dans
`againstLinkIds` que des liens `contradicts` qui la ciblent.

La chaîne d’audit est alors :

```text
SelfHypothesis
→ EvidenceLink(targetType=self_hypothesis)
→ EvidenceItem(kind=behavioral_observation)
→ Event(type=intention_selected)
→ Source(kind=system)
```

Pour les fixtures propres, `sourceAuthority` et `weightClass` valent `high`. Un
lien contaminé conserve `sourceAuthority: "high"`, puisque l’action enregistrée
reste certaine, mais utilise `weightClass: "low"` et demeure exclu du seuil par
la règle prioritaire de contamination.

---

# 7. Indépendance des preuves

Le champ actuel `independenceGroup` suffit. Aucune nouvelle structure n’est
créée.

Dans les fixtures initiales, les groupes sont exactement :

```text
g0a2:S1
g0a2:S2
g0a2:S3
g0a2:S4
```

Une situation de révision reçoit un nouvel identifiant stable, par exemple
`g0a2:R1`, jamais celui d’une fixture existante.

Règles de comptage :

1. seuls les groupes des liens admissibles sont comptés ;
2. un groupe contribue au maximum une unité à une relation donnée ;
3. plusieurs messages, événements ou observations issus de la même situation ne
   multiplient pas le support ;
4. si un même groupe présente des liens incompatibles, il est conservé pour
   audit mais ne compte pour aucun côté lors de cette consolidation ;
5. ces identifiants expriment l’indépendance contrôlée du protocole, pas une
   indépendance statistique générale.

---

# 8. Contamination causale

G0-A2 utilise exactement :

```ts
type CausalContamination = "none" | "influenced_by_target";
```

Un lien vaut `influenced_by_target` lorsque l’`intention_selected` à l’origine de
son observation référence, dans `triggerSelfHypothesisIds`, une hypothèse de la
même `hypothesisKey` que la cible du lien. La comparaison porte sur la clé
logique, pas seulement sur l’identifiant de version.

La règle expérimentale est binaire :

> Un lien `influenced_by_target` reste enregistré pour l’audit, mais compte zéro
> dans les seuils de création, de contestation ou de révision de cette même clé.

Il ne reçoit donc pas un demi-vote ou un coefficient probabiliste. Son
`weightClass` peut rester `low` à titre descriptif, mais aucun poids ne peut
annuler son exclusion du comptage G0-A2.

Les fixtures S1–S4 ont obligatoirement `causalContamination: "none"`, puisqu’elles
précèdent toute hypothèse.

---

# 9. Confiance, seuil initial et contradiction

## 9.1 Création initiale

Une orientation devient éligible uniquement avec :

```text
au moins 3 groupes indépendants supports non contaminés
+ au moins 1 groupe indépendant contradictoire conservé
```

La version initiale est :

```text
stage: hypothesis
status: active
confidence: moderate
```

Un quatrième support ne produit pas `high`. Aucun niveau au-dessus de
`moderate` n’est attribué par G0-A2.

## 9.2 Contestation

Après création, deux **nouveaux** groupes indépendants, non contaminés et
contraires à la valeur active suffisent à neutraliser l’influence. Une nouvelle
version de même valeur est créée avec :

```text
status: disputed
confidence: low
```

L’ancienne version devient `superseded`. Les supports et contre-preuves restent
accessibles. Une version `disputed` n’est jamais fournie au sélecteur comme
hypothèse éligible.

## 9.3 Révision vers l’orientation opposée

Lorsque trois nouveaux groupes indépendants, non contaminés, soutiennent
l’orientation opposée et qu’au moins une contre-preuve de cette orientation est
conservée, une nouvelle version devient :

```text
proposition.value: <orientation opposée>
status: active
confidence: moderate
```

La version courante précédente devient `superseded`. Cette règle est limitée au
scénario de contradiction G0-A2 ; elle ne définit pas une politique générale de
confiance.

---

# 10. Consolidation déterministe

Le premier consolidateur G0-A2 est une fonction métier pure. Il ne dépend ni de
`AIEngine`, ni d’un prompt, ni d’un texte formulé.

Entrées explicites :

- `kinseedId` ;
- `consolidationId` stable ;
- la proposition candidate connue du protocole ;
- les identifiants d’observations à considérer ;
- l’éventuelle version courante ;
- `observedStateVersion`.

Algorithme borné :

1. lire et valider chaque `behavioral_observation` et son événement structuré ;
2. construire les liens vers l’identifiant de version candidat ;
3. classer `supports` si la valeur observée égale la valeur candidate, sinon
   `contradicts` ;
4. déterminer la contamination depuis les causes de l’intention source ;
5. éliminer du comptage les liens contaminés et les groupes ambigus ;
6. dédupliquer les groupes ;
7. appliquer exclusivement les règles des sections 9.1 à 9.3 ;
8. produire une décision `create`, `dispute`, `revise` ou `no_change` ;
9. checkpoint-er cette décision avant le commit ;
10. committer atomiquement les nouveaux liens, la nouvelle version et le statut
    `superseded` de l’ancienne version, le cas échéant.

Pour les histoires initiales, les quatre observations existent avant la
consolidation. Les liens et l’hypothèse sont créés ensemble afin qu’aucun lien ne
cible une entité absente.

La matérialisation des quatre observations est un commit atomique distinct,
identifié par
`g0a2:<kinseedId>:<historyId>:behavioral-observations:commit`. Elle reconstruit
toujours les `EvidenceItem` déterministes décrits en section 5, notamment avec
`createdAt = sourceEvent.occurredAt`, avant d’appeler `atomicCommit`. Après le
commit, un `state_commit_completed` de scope
`behavioral_observation_materialization`, causé par les quatre événements
`intention_selected`, enregistre les versions d’état. Cette transformation
directe n’utilise pas `validation_decision_recorded` : elle ne choisit aucune
hypothèse. Une reprise reconstruit les mêmes mutations, récupère le résultat du
même commit idempotent et n’écrit que l’événement de complétion manquant.

Si aucune orientation n’atteint le seuil, aucune `SelfHypothesis` n’est créée et
la décision `no_change` reste auditable.

---

# 11. Influence déterministe sur S5

Les deux nouveaux `IntentionKind` sont exactement :

```ts
type G0A2IntentionKind =
  | "ask_clarification"
  | "respond_with_available_information_under_uncertainty";
```

Ils décrivent une action fonctionnelle et ne mentionnent ni S1–S5, ni A/B.

`Intention` reçoit le champ explicite :

```ts
readonly triggerSelfHypothesisIds: readonly EntityId[];
```

Les intentions G0-A1 utilisent `[]`. Une intention S5 influencée utilise
exactement l’identifiant de la version `active` consommée.

## 11.1 Représentation de l’entrée S5

S5 ne crée aucun nouvel `EventType`. G0-A2 n’introduit pas
`decision_situation_presented`, `situation_received`, `uncertainty_presented` ni
aucun autre type expérimental spécifique. Le fait historique primaire reste
`human_message_received` : S5 est une situation présentée au Kinseed par
l’humain, distincte de l’intention et de l’interprétation qui en découlent.

Le premier protocole G0-A2 représente l’entrée S5 ainsi :

```text
type: human_message_received
payloadSchemaVersion: 2
turnId: <turnId S5 non null>
sourceId: <Source de kind human>
actorRef: <identifiant de l’humain>
observedStateVersion: <version durable utilisée pour construire le snapshot>

payload:
  text: <contenu textuel contrôlé de S5>
  protocol: G0-A2
  situationId: S5
  decisionAxis: decision_style_under_uncertainty
```

`protocol`, `situationId` et `decisionAxis` sont normatifs pour ce protocole.
Le payload ne contient ni l’histoire A ou B, ni orientation attendue,
`SelfHypothesisId`, `favoredKind`, `selectedKind`, réponse attendue ou indication
sur l’action à choisir. L’entrée S5 ne peut donc pas encoder le résultat
expérimental.

L’ordre causal est strict :

```text
human_message_received S5
→ construction du snapshot décisionnel
→ sélection déterministe
→ intention structurée
→ intention_selected schema v2
→ formulation éventuelle plus tard
```

`human_message_received` doit être persisté avant l’appel au sélecteur. Le
`situationEvent` reçu par celui-ci est exactement cet événement S5 historique
déjà persisté.

Pour le test principal, A et B reçoivent la même situation contrôlée. Les champs
`payload.text`, `payload.protocol`, `payload.situationId` et
`payload.decisionAxis` sont strictement identiques. Les identifiants techniques
(`Event.id`, `kinseedId`, `turnId` et références de Source/acteur) peuvent
différer, mais aucun ne doit encoder l’orientation A ou B. La divergence doit
provenir exclusivement du snapshot de `SelfHypothesis` consommé par le
sélecteur.

S5 reste une nouvelle situation du même axe décisionnel sous incertitude ; elle
ne répète pas mot pour mot S1–S4. Les deux actions restent admissibles :
`ask_clarification` et `respond_with_available_information_under_uncertainty`.

Ce lot ne matérialise pas immédiatement S5 en `behavioral_observation`.
L’événement humain est l’entrée de décision ; une éventuelle observation future
proviendra de l’`intention_selected` résultante, jamais directement du message
humain. Si cette intention devient une preuve, les règles existantes de
`triggerSelfHypothesisIds` et de contamination causale s’appliquent.

## 11.2 Entrée fermée du sélecteur

Le sélecteur est pur et ne reçoit qu’un snapshot :

```ts
interface G0A2DecisionContext {
  readonly situationEvent: Event;
  readonly activeSelfHypotheses: readonly SelfHypothesis[];
}
```

Il ne reçoit aucun port de persistance et ne peut lire ni événements historiques,
ni observations, ni liens.

## 11.3 Politique

Le résultat interne borné contient :

```text
eligibleKinds: les deux IntentionKind
favoredKind: IntentionKind | null
selectedKind: IntentionKind
triggerSelfHypothesisIds: EntityId[]
neutralTieBreakApplied: boolean
```

- sans hypothèse `active` éligible, `favoredKind` vaut `null`, les deux candidats
  restent équivalents et un tie-break fixe choisit
  `respond_with_available_information_under_uncertainty` ;
- avec l’hypothèse A, `favoredKind` et `selectedKind` valent
  `ask_clarification` ;
- avec l’hypothèse B, ils valent
  `respond_with_available_information_under_uncertainty` ;
- une hypothèse `disputed` ou `superseded` est ignorée.

Le tie-break est une règle de reproductibilité du protocole, pas une préférence
du Kinseed. Même lorsque l’orientation B coïncide avec le tie-break, le champ
`favoredKind`, la motivation et `triggerSelfHypothesisIds` distinguent
l’influence causale de la simple politique neutre.

L’`Intention` produite enregistre :

- l’événement S5 dans `triggerEventIds` ;
- l’hypothèse consommée dans `triggerSelfHypothesisIds`, ou `[]` ;
- `apply_active_self_hypothesis_under_uncertainty` comme motivation influencée ;
- `apply_neutral_g0a2_policy` comme motivation neutre.

La formulation linguistique éventuelle reçoit ensuite cette intention ; elle ne
choisit pas l’orientation.

---

# 12. C1 et ablation

## 12.1 Contrôle C1

C1 matérialise les mêmes événements, observations et groundings structurés que
les histoires principales, mais n’exécute pas la consolidation. Il ne crée donc
ni lien ciblant une `SelfHypothesis`, ni hypothèse. Le même sélecteur reçoit dans
les deux cas :

```text
activeSelfHypotheses: []
```

Il applique donc la même politique neutre et le même tie-break à A et B. La
signature fermée du sélecteur interdit de reconstituer l’orientation depuis
l’historique brut.

## 12.2 Ablation de test

L’ablation n’est pas une fonctionnalité produit. Le builder de snapshot utilisé
par les tests accepte une option équivalente à :

```ts
{ includeSelfHypotheses: false }
```

Le store, les `Event`, les preuves, les liens et les hypothèses restent
inchangés. Aucun `Event` d’ablation n’est écrit. Le sélecteur reçoit simplement
`activeSelfHypotheses: []`.

Deux assertions sont distinctes :

1. retirer l’hypothèse du snapshot supprime la divergence A/B ;
2. conserver l’hypothèse dans le store mais empêcher sa consommation supprime
   `favoredKind` et `triggerSelfHypothesisIds`, même si le tie-break neutre peut
   sélectionner la même action que l’ancienne orientation B.

---

# 13. Persistance et invariants du store

`PersistencePort` est étendu uniquement par :

```text
readSelfHypothesis(kinseedId, selfHypothesisId)
readActiveSelfHypothesisByKey(kinseedId, hypothesisKey)
readSelfHypothesisHistoryByKey(kinseedId, hypothesisKey)
```

`readEvidenceLink` suffit à résoudre les liens référencés ; aucune requête
générique supplémentaire n’est nécessaire au premier protocole.

`CommitMutations` ajoute :

```text
selfHypotheses: readonly SelfHypothesis[]
```

Le commit atomique peut ainsi contenir ensemble :

- les nouveaux `EvidenceLink` ;
- la nouvelle version de `SelfHypothesis` ;
- le remplacement contrôlé de la version précédente par son état
  `superseded`.

`InMemoryStore` défend au minimum :

1. appartenance au même Kinseed ;
2. existence et cohérence des `Source`, `Event`, `EvidenceItem` et groundings ;
3. cible conforme au discriminant de chaque `EvidenceLink` ;
4. relations des tableaux support/contre-preuve conformes à leur cible ;
5. chaîne de versions continue, même clé et numéro incrémenté de un ;
6. au maximum une version courante, et au maximum une `active`, par clé ;
7. une `active` respecte le seuil 3/1 et possède `confidence: moderate` ;
8. une `disputed` n’est pas exposée par la lecture active ;
9. aucune observation contaminée ne satisfait un groupe compté ;
10. contrôle de `expectedStateVersion`, idempotence par clé et application tout
    ou rien.

Cette extension ne choisit aucun stockage disque et ne revendique aucune
durabilité après arrêt du processus.

---

# 14. Journalisation de la consolidation

Les `EventType` actuels suffisent. La consolidation utilise
`validation_decision_recorded`, sans réutiliser le checkpoint
`temporary_evidence` v2.

Le nouveau payload est explicitement distinct :

```text
type: validation_decision_recorded
payloadSchemaVersion: 3
turnId: null
idempotencyKey: g0a2:<kinseedId>:<consolidationId>:decision
causedByEventIds:
  - <intention_selected sources, triés par sequence>
  - <décision de consolidation précédente, pour une révision>
observedStateVersion: N

payload:
  scope: self_hypothesis_consolidation
  consolidationId: <identifiant stable fourni par le scénario>
  hypothesisKey: <clé logique>
  candidateProposition: <proposition complète>
  inputEvidenceItemIds: <liste ordonnée>
  countedSupportGroups: <liste ordonnée>
  countedAgainstGroups: <liste ordonnée>
  ignoredContaminatedLinkIds: <liste ordonnée>
  outcome: create | dispute | revise | no_change
  linkSnapshots: <nouveaux liens exacts à committer>
  nextHypothesisSnapshot: <nouvelle version exacte ou null>
  supersededHypothesisId: <ancienne version ou null>
```

L’événement est écrit **avant** le commit. Ses snapshots sont suffisants pour
reprendre exactement la décision sans recompter ni réinterpréter les entrées.
Une clé déjà présente avec un contenu différent provoque un conflit
d’idempotence.

Le commit utilise une clé distincte :

```text
g0a2:<kinseedId>:<consolidationId>:commit
```

Après succès, un `state_commit_completed` est écrit avec :

- le `validation_decision_recorded` dans `causedByEventIds` ;
- `previousStateVersion`, `newStateVersion` et `changed` ;
- `scope: self_hypothesis_consolidation` et le même `consolidationId` ;
- une clé `g0a2:<kinseedId>:<consolidationId>:completed`.

## 14.1 Versions de payload G0-A2

Les événements G0-A1 déjà écrits restent historiques. Le futur parser de reprise
doit toujours discriminer explicitement :

```text
event.type
+ payloadSchemaVersion
+ payload.scope lorsque cette version l’utilise
```

Un payload v1 ne doit jamais être lu comme la forme G0-A2 enrichie.

### `human_message_received`

Les `human_message_received` G0-A1 en payload schema v1 conservent leur forme et
leur signification historiques. Ils ne doivent jamais être réinterprétés comme
une entrée expérimentale S5.

Pour S5, G0-A2 utilise explicitement `payloadSchemaVersion: 2` avec au minimum :

```text
text
protocol: G0-A2
situationId: S5
decisionAxis: decision_style_under_uncertainty
```

Le parser futur doit discriminer `event.type = human_message_received` avec
`payloadSchemaVersion`. Un événement v1 ne reçoit jamais implicitement les
champs ni la sémantique de la version v2.

### `intention_selected`

Les intentions G0-A2 S1 à S5 utilisent `payloadSchemaVersion: 2`. Leur payload
contient au minimum `intentionId`, `kind`, `motivation` et `situationId` lorsque
pertinent. Il contient aussi `triggerSelfHypothesisIds`, vide pour les fixtures
S1–S4 antérieures à toute hypothèse, puis l’identifiant de la version active
consommée pour une intention S5 influencée. `favoredKind` et
`neutralTieBreakApplied` sont présents lorsque la sélection S5 les évalue.

Les `intention_selected` G0-A1 en version 1 conservent leur forme et leur
signification historiques ; ils ne reçoivent ni nouveaux champs ni nouvelle
interprétation.

### `state_commit_completed`

Les commits G0-A2 enrichis utilisent `payloadSchemaVersion: 2` pour au minimum
les scopes suivants :

```text
behavioral_observation_materialization
self_hypothesis_consolidation
```

Le payload v2 contient `scope`, l’identifiant stable de matérialisation ou de
consolidation applicable, `previousStateVersion`, `newStateVersion` et `changed`.
Les `state_commit_completed` G0-A1 en version 1 restent historiques et ne sont
jamais interprétés comme un commit G0-A2 v2.

---

# 15. Reprise et idempotence

Les règles minimales sont :

```text
avant décision de consolidation
→ consolidation autorisée une fois à partir des entrées validées

décision présente, commit absent
→ reconstruire les mutations depuis les snapshots v3
→ ne pas recompter et ne pas prendre une nouvelle décision

commit appliqué, complétion absente
→ récupérer le résultat idempotent du commit
→ écrire seulement state_commit_completed

complétion présente
→ retourner le résultat historique
→ aucune mutation
```

Le fingerprint des mutations reste contrôlé comme en G0-A1. Le retry du même
`consolidationId` ne peut ni créer une seconde version, ni dupliquer les liens,
ni incrémenter deux fois `stateVersion`.

Après `intention_selected` pour S5, un retry réutilise l’intention historique et
ses `triggerSelfHypothesisIds`. Il ne relit pas l’état courant pour choisir une
autre orientation. Si une formulation est ajoutée plus tard, les règles G0-A1
de réutilisation de la réponse émise continuent de s’appliquer.

Les étapes supplémentaires de `processing_failure_recorded` sont bornées à :

```text
behavioral_observation_validation
self_hypothesis_consolidation
intention_selection
state_commit
```

Une panne ne peut jamais laisser des liens sans cible, deux hypothèses actives,
un ancien statut non remplacé alors que la nouvelle version est active, ou une
mutation d’ablation.

---

# 16. Tests déterministes obligatoires

Avant tout test IA, la suite G0-A2 doit vérifier au minimum :

1. **Fixtures et observations** — chaque S1–S4 produit exactement une
   `behavioral_observation`, issue de l’`intention_selected` attendu, sans
   `supportingExcerpt` ;
2. **Provenance** — chaque chaîne hypothèse → lien → preuve → événement → source
   est complète et appartient au même Kinseed ;
3. **Indépendance** — S1–S4 ont quatre groupes distincts et un doublon de S1 ne
   compte qu’une fois ;
4. **Seuil 3/1** — trois supports propres et une contre-preuve propre créent une
   hypothèse `active`, `moderate`, avec tous les liens accessibles ;
5. **Seuil insuffisant** — deux groupes supports, même répétés, ne créent aucune
   hypothèse ;
6. **Histoire A** — la valeur active est `seek_clarification` ;
7. **Histoire B** — la valeur active est `use_available_information` ;
8. **S5 A/B** — un `human_message_received` S5 schema v2 valide est écrit avant
   `intention_selected`; son payload sémantique est identique entre A et B et
   n’encode aucune orientation A/B, puis `favoredKind`, `selectedKind`, les
   intentions et les causes attendues divergent avant langage ;
9. **C1** — sans consolidation, A et B ont `favoredKind: null`, le même tie-break
   et aucun `triggerSelfHypothesisIds` ;
10. **Ablation** — le snapshot filtré ne modifie pas le store et supprime la
    divergence ;
11. **Présente mais non consommée** — une hypothèse durable exclue du snapshot
    n’apparaît ni dans la préférence ni dans l’intention ;
12. **Contamination** — une observation causée par une hypothèse de même clé est
    enregistrée, marquée, mais ne compte dans aucun seuil ;
13. **Contradiction** — deux nouveaux groupes contraires produisent une version
    `disputed`, `low`, non consommable ;
14. **Révision et historique** — trois nouveaux groupes contraires et une
    contre-preuve conservée produisent l’orientation opposée `active`, lient les
    versions et laissent les anciennes `superseded` ;
15. **Retry de matérialisation** — un premier commit d’observations appliqué,
    suivi d’une panne simulée avant `state_commit_completed`, est repris avec des
    mutations strictement identiques : `atomicCommit` retourne son résultat
    historique, sans `IdempotencyConflictError`, observation dupliquée ni second
    incrément de `stateVersion` ; l’événement final contient les vraies versions
    précédente et nouvelle ;
16. **Retry de consolidation** — les reprises aux trois frontières de
    journalisation produisent les mêmes IDs, un seul commit effectif et une seule
    version courante ;
17. **Atomicité** — une erreur d’invariant ou un échec injecté ne persiste aucun
    sous-ensemble des liens/hypothèses ;
18. **Régression G0-A1** — tous les tests déterministes existants restent verts,
    notamment grounding lexical, T1→T7 et reprise causale.

Les tests comparent l’état structuré et les événements. Aucun texte convaincant
ne peut remplacer une assertion de causalité.

---

# 17. Place exacte du LLM

Le premier lot G0-A2 n’appelle aucun LLM pour :

- produire les histoires A/B ;
- créer les observations ;
- proposer la valeur de l’hypothèse ;
- compter les supports ou contre-preuves ;
- consolider ou réviser ;
- sélectionner l’intention S5.

Après stabilisation du cœur déterministe, un LLM pourra seulement :

- formuler linguistiquement une intention déjà sélectionnée ;
- participer au contrôle C0 sans état Kinseed.

Aucune nouvelle policy OpenAI n’est définie par ce contrat.

---

# 18. Hors périmètre

Ne font pas partie du premier lot G0-A2 :

- `Memory` ;
- `HumanHypothesis` ;
- `tendency` et trait stable ;
- personnalité générale ;
- G0-B et initiative autonome ;
- embeddings et base vectorielle ;
- stockage durable et synchronisation ;
- grounding sémantique général ;
- modèle probabiliste de personnalité ;
- moteur générique de scoring psychologique.

G0-A2 ne clôt pas G0-A : la mémoire minimale reste notamment à valider selon la
gate existante.

---

# 19. Ordre d’implémentation minimal futur

Lorsque le code sera autorisé :

```text
1. types SelfHypothesis et extensions Evidence/Intention
2. invariants et lectures PersistencePort/InMemoryStore
3. matérialisation déterministe des behavioral_observations
4. consolidateur et checkpoint v3
5. sélecteur S5 pur
6. C1 et builder d’ablation de test
7. contradiction, révision et reprises
8. protocole A/B déterministe complet
9. seulement ensuite formulation LLM et C0 éventuels
```

Chaque lot doit rester petit et conserver les tests G0-A1.

---

## Décision finale du contrat

G0-A2 démontre uniquement qu’une histoire contrôlée de décisions structurées
peut produire une hypothèse sur soi provisoire, traçable, révisable et
causalement consommée par un sélecteur déterministe. La démonstration est
invalidée si l’orientation vient du LLM, si le sélecteur relit directement
l’histoire A/B, si une preuve causée par l’hypothèse est recomptée comme
indépendante, ou si l’ablation ne retire pas la cause structurée attendue.
