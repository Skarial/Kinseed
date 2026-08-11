# Kinseed — G0-A1 : contrat d’implémentation minimal

## Statut du document

Ce document traduit le protocole `docs/07-generation-0a1-protocole-croyance-provenance.md` en un **contrat d’implémentation minimal**.

Il ne contient pas encore le code de Kinseed. Le stockage du premier prototype est désormais encadré par `docs/decisions-techniques/005-stockage-prototype-g0a1.md` : le cœur dépend d’un port de persistance abstrait et les premiers tests utilisent un adaptateur en mémoire.

Il respecte les décisions techniques déjà acceptées :

- TypeScript pour le cœur métier ;
- architecture local-first ;
- modèle événementiel ;
- indépendance vis-à-vis d’un fournisseur ou modèle IA particulier ;
- persistance abstraite avec `InMemoryStore` pour le premier stade expérimental.

Principe :

> **La première implémentation doit prouver G0-A1 avec le plus petit cœur métier possible, sans application mobile, sans interface graphique et sans mécanismes psychologiques supplémentaires.**

---

# 1. Périmètre exact de la première implémentation

La première implémentation G0-A1 doit uniquement savoir :

1. créer un Kinseed de test ;
2. enregistrer un message humain comme événement ;
3. extraire ou recevoir un `EvidenceItem` candidat ;
4. valider sa provenance ;
5. créer ou réviser une croyance ;
6. sélectionner une intention simple ;
7. produire une réponse via une abstraction de moteur IA ;
8. committer les changements de manière atomique ;
9. rejouer le protocole T1 → T7 ;
10. vérifier automatiquement les états attendus.

Doivent rester absents de cette première implémentation :

```text
interface mobile
Capacitor
HTML/CSS
synchronisation cloud
backend distant
compte utilisateur réel
mémoire vectorielle
embeddings
SelfHypothesis
HumanHypothesis
Memory autobiographique avancée
émotions
valeurs
objectifs personnels
relations avancées
héritage
```

Cette réduction est volontaire.

---

# 2. Premier artefact : cœur métier testable sans interface

G0-A1 doit d’abord fonctionner comme un **cœur TypeScript testable en isolation**.

L’application Android ne doit pas être nécessaire pour exécuter le protocole.

Le cœur doit pouvoir recevoir conceptuellement :

```text
message humain
+
état persistant
+
moteur IA abstrait
```

et produire :

```text
événements
+
réponse
+
nouvel état persistant
```

Cette séparation permettra de construire plus tard l’interface mobile autour d’un cœur déjà validé.

---

# 3. Types primitifs communs

Les détails de génération des identifiants ne sont pas encore imposés.

Les contrats utilisent néanmoins les catégories suivantes :

```text
EntityId      = identifiant opaque stable
TurnId        = identifiant opaque stable
StateVersion  = entier >= 0
Sequence      = entier strictement croissant
Timestamp     = date/heure sérialisable sans ambiguïté
```

Les identifiants ne doivent pas porter de logique métier implicite.

Les préfixes tels que `E-`, `EV-`, `B-` peuvent être utilisés pour le débogage, mais ne doivent pas devenir nécessaires au fonctionnement du domaine.

---

# 4. Représentation minimale d’une proposition G0-A1

G0-A1 doit comparer deux affirmations portant sur le même sujet mais avec des valeurs incompatibles : 2022 puis 2021.

Une simple chaîne de caractères serait fragile.

On introduit donc une représentation structurée minimale :

```text
Proposition

subject_ref
predicate
value
context
```

Exemple :

```text
subject_ref: H-TEST-001
predicate: employment_start_year
value: 2022
context:
  organisation: Atelier Nova
```

Cette structure n’est **pas** présentée comme l’ontologie universelle de toutes les futures croyances Kinseed.

Elle constitue seulement le format canonique minimal nécessaire aux faits simples de G0-A1.

---

# 5. `belief_key` : identité logique d’une croyance révisable

Pour reconnaître que :

```text
année = 2022
```

et :

```text
année = 2021
```

concernent la même question, chaque croyance G0-A1 possède un `belief_key` indépendant de la valeur.

Exemple conceptuel :

```text
belief_key:
human:H-TEST-001/employment_start_year/Atelier-Nova
```

Le `belief_key` dépend de :

- sujet ;
- prédicat ;
- contexte pertinent.

Il ne dépend pas de la valeur courante.

Invariant G0-A1 :

> **Pour un `belief_key` donné, au maximum une version de croyance peut être `active`.**

---

# 6. Contrat `Source`

Champs nécessaires à G0-A1 :

```text
Source

id
kind
actor_ref
channel
created_at
```

Kinds nécessaires au premier prototype :

```text
human
system
llm
```

Les types externes déjà prévus par l’architecture pourront être ajoutés lorsqu’ils deviennent nécessaires.

---

# 7. Contrat `Event`

Champs minimaux :

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
idempotency_key
```

Types réellement nécessaires à G0-A1 :

```text
kinseed_created
human_message_received
intention_selected
kinseed_message_emitted
validation_decision_recorded
state_commit_completed
processing_failure_recorded
```

Invariant :

```text
sequence(n+1) > sequence(n)
```

pour un même Kinseed.

Un événement déjà enregistré ne doit pas être remplacé silencieusement.

---

# 8. Contenu des messages dans G0-A1

Pour le prototype expérimental, le contenu textuel des messages peut être stocké directement dans le payload des événements d’entrée et de sortie.

Exemple :

```text
human_message_received.payload
  text
```

Cette décision est uniquement une simplification de G0-A1.

La séparation future entre journal causal et contenu conversationnel, ainsi que les règles de suppression pour la confidentialité, restent des sujets distincts.

---

# 9. Contrat `EvidenceItem`

Champs minimaux :

```text
EvidenceItem

id
kind
proposition
source_id
event_ids
extraction_confidence
status
supersedes_id
extractor_version
created_at
```

Kinds utilisés dans G0-A1 :

```text
testimony
system_record
```

`behavioral_observation` est déjà prévu conceptuellement mais ne sera nécessaire qu’à G0-A2.

Statuts :

```text
active
superseded
invalidated
```

Invariant :

> chaque `EvidenceItem` doit référencer au moins un événement existant qui permet réellement d’établir sa proposition au niveau épistémique déclaré.

---

# 10. Contrat `EvidenceLink`

Champs nécessaires :

```text
EvidenceLink

id
evidence_item_id
target_belief_id
relation
source_authority
independence_group
weight_class
created_at
```

Relations G0-A1 :

```text
supports
contradicts
```

Les champs liés au discount causal des `SelfHypothesis` pourront être ajoutés ou activés dans G0-A2.

G0-A1 ne doit pas implémenter prématurément leur logique.

---

# 11. Contrat `Belief`

Champs minimaux :

```text
Belief

id
belief_key
version
proposition
status
confidence
evidence_for_link_ids
evidence_against_link_ids
previous_version_id
created_at
updated_at
```

Statuts nécessaires :

```text
active
uncertain
superseded
rejected
```

Pour G0-A1, une croyance issue d’une déclaration autobiographique simple de l’humain peut devenir directement `active` si les règles d’autorité l’acceptent.

`active` ne signifie jamais vérité certaine.

## Invariants

1. `previous_version_id` ne peut pointer que vers une croyance du même `belief_key` ;
2. une nouvelle version ne modifie pas l’ancienne ;
3. au maximum une croyance est `active` pour un même `belief_key` ;
4. toute croyance active possède au moins un `EvidenceLink` valide ;
5. une croyance `superseded` ne doit pas être sélectionnée comme croyance actuelle.

---

# 12. Confiance : rester simple

G0-A1 ne nécessite pas encore un modèle probabiliste complexe.

Une échelle ordinale suffit :

```text
low
moderate
moderate_high
high
```

L’objectif n’est pas d’affirmer que `moderate_high = 78 %`.

Cette échelle sert uniquement à comparer des états et à rendre les règles explicites pendant le prototype.

Un modèle numérique pourra être étudié plus tard si un besoin expérimental réel apparaît.

---

# 13. Contrat `Intention`

Champs minimaux :

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
status
created_at
```

Kinds nécessaires à G0-A1 :

```text
answer_question
acknowledge_correction
report_record_conflict
```

Le but n’est pas encore de créer un moteur motivationnel général.

L’intention sert ici surtout à garantir :

```text
cause fonctionnelle
→ avant
→ formulation linguistique
```

---

# 14. `state_version`

Chaque Kinseed possède une version d’état entière :

```text
0, 1, 2, ...
```

Une mutation durable utilise :

```text
expected_state_version
```

Le commit réussit uniquement si la version courante correspond encore à cette valeur.

Le commit atomique produit ensuite :

```text
new_state_version
```

Si aucune projection ne change, le tour peut être finalisé sans incrémenter la version.

---

# 15. Capacités minimales du stockage

Le cœur métier ne dépend pas d’une technologie de stockage particulière.

Conformément à `docs/decisions-techniques/005-stockage-prototype-g0a1.md`, il dépend d’un port abstrait de persistance offrant au minimum :

```text
append_event
read_events_in_sequence
read_events_by_turn
read_evidence_item
read_active_belief_by_key
read_belief_history_by_key
atomic_commit(expected_state_version, mutations)
check_idempotency_key
```

La première implémentation de ce port est un `InMemoryStore` destiné aux tests déterministes et au premier replay G0-A1.

Le choix SQLite / IndexedDB / autre reste volontairement différé jusqu’au moment où la persistance après redémarrage devient elle-même un objet de validation.

`InMemoryStore` ne doit pas contourner les invariants du futur stockage durable : séquence, idempotence, contrôle de `state_version` et atomicité logique doivent déjà être testés.

---

# 16. Frontière IA minimale

Le cœur métier ne dépend pas d’un fournisseur précis.

G0-A1 nécessite conceptuellement deux capacités IA distinctes.

## 16.1 Extraction

Entrée :

```text
message humain
+
contexte de tour autorisé
```

Sortie :

```text
candidate EvidenceItem[]
```

Le moteur IA propose uniquement.

Le validateur Kinseed accepte ou refuse.

## 16.2 Formulation

Entrée :

```text
Intention sélectionnée
+
état pertinent explicitement fourni
```

Sortie :

```text
candidate response text
```

Le moteur IA ne reçoit aucun droit d’écriture dans les croyances.

---

# 17. Tests déterministes avant tests LLM

La première suite de tests doit pouvoir fonctionner **sans appeler aucun LLM réel**.

On injecte directement des `candidate EvidenceItem` prédéfinis et une formulation factice.

Cela permet de tester indépendamment :

- journal événementiel ;
- provenance ;
- versionnement ;
- `supersedes_id` ;
- révision des croyances ;
- unicité de la croyance active ;
- atomicité ;
- idempotence.

Principe :

> **Si les tests déterministes échouent, un LLM plus performant ne doit pas masquer le bug.**

---

# 18. Tests d’intégration IA ensuite

Une seconde famille de tests utilise un vrai moteur IA derrière l’interface abstraite.

Elle vérifie :

- extraction correcte du témoignage 2022 ;
- extraction correcte de la correction 2021 ;
- absence d’inférence psychologique hors périmètre ;
- respect de l’intention lors de la formulation ;
- fonctionnement après reset du contexte conversationnel.

Un échec de cette couche ne doit pas modifier les résultats des tests déterministes du cœur.

---

# 19. Test end-to-end G0-A1

La troisième famille exécute le protocole complet T1 → T7 de `docs/07-generation-0a1-protocole-croyance-provenance.md`.

Elle doit vérifier automatiquement après chaque tour :

```text
state_version attendu
EvidenceItem attendus
Belief active attendue
historique des Belief
événements conservés
intention sélectionnée
absence d'écritures hors périmètre
```

La qualité stylistique du texte est secondaire par rapport à la conformité de l’état.

---

# 20. Tests de panne indispensables

Avant de considérer G0-A1 stable, il faut au minimum simuler :

```text
échec avant génération IA
échec après intention_selected
échec après message émis mais avant commit
échec pendant commit
retry du même turn_id
retry de la même idempotency_key
```

Résultat attendu :

> **aucune panne ne peut produire une croyance partiellement mise à jour ou deux réponses émises pour le même tour.**

Avec `InMemoryStore`, ces tests valident d’abord les garanties logiques du domaine et du port de persistance. La récupération après redémarrage réel devra être revalidée plus tard avec l’adaptateur local durable.

---

# 21. Organisation de code recommandée, sans la créer encore

Lorsque le premier code sera autorisé, je recommande une séparation de ce type :

```text
src/
  domain/
    source
    event
    proposition
    evidence
    belief
    intention
    state

  application/
    process-turn
    validate-evidence
    revise-belief
    commit-turn

  ports/
    persistence
    ai-engine

  adapters/
    persistence/
      in-memory

tests/
  domain/
  g0a1/
```

Les extensions exactes, outils de build et runner de tests ne sont pas décidés par ce document.

Cette organisation vise uniquement à maintenir :

```text
domaine
≠
IA externe
≠
stockage
≠
future interface mobile
```

---

# 22. Ce qu’il ne faut pas ajouter lors du premier commit de code

Le premier lot de code ne doit pas introduire « pour plus tard » :

- une base vectorielle ;
- un framework frontend ;
- Firebase ;
- un ORM ;
- SQLite ou IndexedDB tant que G0-A1 déterministe n’en a pas besoin ;
- un système multi-utilisateur ;
- des agents autonomes de fond ;
- des émotions ;
- une génétique numérique ;
- une synchronisation ;
- un système complet de personnalité.

Toute dépendance supplémentaire devra répondre à un besoin concret de G0-A1.

---

# 23. Critère permettant enfin de coder

Les décisions nécessaires au premier lot de code sont désormais fixées :

1. représentation minimale `Proposition + belief_key` ;
2. frontière `PersistencePort`, commit atomique et premier adaptateur `InMemoryStore` ;
3. stratégie de tests en trois couches : déterministe, intégration IA, end-to-end.

Le premier développement peut donc commencer par **le domaine TypeScript, le port de persistance, l’adaptateur en mémoire et les tests déterministes**, sans interface mobile et sans appel à un vrai LLM.

---

# 24. Limite avant l’étape suivante

Le stockage local durable reste à choisir, mais il ne bloque plus le premier développement G0-A1.

Ce choix doit être rouvert avant de prétendre valider :

- persistance après fermeture de l’application ;
- récupération après redémarrage ;
- durabilité réelle sur disque ;
- premier prototype mobile utilisable par une personne.

À ce stade, SQLite, IndexedDB ou une autre solution devront être comparés à partir des besoins effectivement observés et non anticipés.

La prochaine étape du projet est donc **le premier lot de code G0-A1**, limité au cœur métier déterministe et à ses tests.