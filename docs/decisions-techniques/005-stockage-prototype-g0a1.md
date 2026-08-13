# ADR-005 — Stockage du prototype G0-A1

- **Statut :** accepté
- **Date :** 2026-08-11
- **Périmètre :** première implémentation expérimentale de G0-A1
- **Décision :** le cœur métier dépend d’un port de persistance abstrait ; les premiers tests utilisent un stockage en mémoire, et le choix du stockage local durable est différé jusqu’à validation du cœur G0-A1.

## 1. Contexte

G0-A1 doit vérifier un mécanisme très réduit :

```text
témoignage
→ EvidenceItem
→ croyance persistante dans l'état Lenoseed
→ correction
→ révision
→ historique conservé
```

Les invariants importants à tester sont notamment :

- provenance des preuves ;
- unicité de la croyance active pour une même question ;
- versionnement des croyances ;
- `state_version` ;
- commit atomique ;
- idempotence ;
- conservation des événements ;
- absence de réécriture silencieuse de l'histoire.

Le projet a déjà adopté une architecture **local-first** dans ADR-002. Cette décision concerne l’architecture du produit et reste inchangée.

Cependant, choisir immédiatement SQLite, IndexedDB ou une autre technologie de stockage pour le premier lot de code ajouterait une décision et une dépendance qui ne sont pas nécessaires pour vérifier les règles métier de G0-A1.

## 2. Décision

La première implémentation utilisera une frontière abstraite de persistance, appelée conceptuellement `PersistencePort`.

Le cœur métier dépend uniquement de cette interface.

Pour les premiers tests déterministes et le protocole G0-A1, une implémentation en mémoire sera fournie :

```text
Core Lenoseed
    ↓
PersistencePort
    ↓
InMemoryStore
```

Une implémentation locale durable sera ajoutée plus tard derrière le même port :

```text
Core Lenoseed
    ↓
PersistencePort
    ├── InMemoryStore        ← tests initiaux
    └── DurableLocalStore    ← étape ultérieure
```

Le choix concret de `DurableLocalStore` n’est pas décidé par cet ADR.

## 3. Pourquoi un stockage en mémoire suffit au premier stade

Le premier objectif est de tester le **domaine**, pas la résistance d’une base de données particulière.

Un stockage en mémoire permet déjà de vérifier :

- l’ordre des événements ;
- les liens de provenance ;
- la création et la révision des croyances ;
- l’unicité d’une croyance `active` par `belief_key` ;
- l’atomicité logique d’un commit ;
- le contrôle de `expected_state_version` ;
- l’idempotence d’un tour ;
- le replay T1 → T7 ;
- la remise à zéro du contexte conversationnel du LLM entre les tours.

La remise à zéro du contexte LLM ne nécessite pas que le processus applicatif soit redémarré. Elle vérifie que le modèle ne reçoit plus l’ancien historique conversationnel brut et doit utiliser l’état que Lenoseed lui fournit.

## 4. Ce que cette décision ne valide pas

`InMemoryStore` ne démontre pas encore :

- la persistance après fermeture ou crash du processus ;
- la restauration après redémarrage de l’application ;
- la robustesse d’un fichier ou d’une base locale ;
- la durabilité réelle d’une transaction sur disque ;
- le chiffrement ;
- la sauvegarde ;
- la synchronisation multi-appareils.

Ces propriétés ne doivent donc pas être revendiquées comme validées par G0-A1 tant qu’un stockage durable n’a pas été introduit et testé.

## 5. Contrat minimal de `PersistencePort`

Le port doit couvrir uniquement les besoins déjà définis dans G0-A1.

Conceptuellement :

```text
registerSource(...)
readSource(...)

appendEvent(...)
readEventById(...)
readEventsInSequence(...)
readEventsByTurn(...)

readEvidenceItem(...)
readEvidenceLink(...)

readActiveBeliefByKey(...)
readBeliefHistoryByKey(...)

atomicCommit(expectedStateVersion, mutations)
checkIdempotencyKey(...)
```

Les lectures directes par identifiant sont nécessaires pour auditer réellement une chaîne de provenance :

```text
Belief
→ EvidenceLink
→ EvidenceItem
→ Event
→ Source
```

Sans ces opérations, le domaine pourrait stocker des identifiants de provenance sans pouvoir vérifier efficacement qu’ils correspondent à des éléments existants et cohérents.

La signature TypeScript exacte sera définie pendant l’implémentation.

Le port ne doit pas exposer des concepts propres à une technologie donnée, par exemple :

- requête SQL ;
- transaction SQLite ;
- objet IndexedDB ;
- document Firebase.

Le domaine doit rester indépendant du stockage choisi.

## 6. InMemoryStore

L’implémentation de test doit rester volontairement simple.

Elle doit néanmoins reproduire les invariants du futur stockage réel :

1. séquence d’événements strictement ordonnée ;
2. événements déjà écrits non remplacés silencieusement ;
3. contrôle d’idempotence ;
4. vérification de `expected_state_version` ;
5. application atomique des mutations d’un commit ;
6. lecture de l’historique des croyances ;
7. au maximum une croyance `active` par `belief_key` ;
8. une `Source` référencée doit exister ;
9. un `EvidenceItem` doit référencer des événements existants ;
10. un `EvidenceLink` doit référencer un `EvidenceItem` et une croyance existants dans l’état résultant du commit.

Un stockage en mémoire permissif qui contournerait ces règles rendrait les tests sans valeur.

## 7. Ordre de développement associé

La progression devient :

```text
1. Types du domaine TypeScript
2. PersistencePort
3. InMemoryStore
4. règles déterministes Evidence / Belief
5. tests unitaires des invariants
6. orchestration minimale d'un tour
7. faux moteur IA / stubs
8. protocole G0-A1 déterministe
9. intégration d'un vrai moteur IA derrière AIEnginePort
10. protocole G0-A1 avec reset de contexte
```

Le stockage local durable ne doit pas bloquer ces premières étapes.

## 8. Quand choisir le stockage durable

Le choix doit être rouvert lorsque l’un des besoins suivants devient prioritaire :

- tester la continuité après redémarrage du processus ;
- exécuter G0-A1 sur plusieurs sessions réelles ;
- commencer un prototype mobile utilisable ;
- tester la récupération après crash avec données sur disque ;
- mesurer des contraintes réelles de volume, transaction ou migration.

À ce moment-là, les solutions concrètes seront comparées à partir des besoins observés du domaine.

## 9. Compatibilité avec ADR-002 local-first

Cette décision ne transforme pas Lenoseed en architecture cloud-first.

`InMemoryStore` est uniquement un **adaptateur expérimental de test**.

L’architecture produit reste :

> **l’état essentiel d’un Lenoseed doit exister localement et ne pas dépendre en permanence d’un service distant.**

Avant toute version destinée à un utilisateur réel, un stockage local durable conforme à ADR-002 devra donc remplacer ou compléter l’adaptateur en mémoire.

## 10. Conséquences

### Positives

- aucun verrouillage prématuré sur une base de données ;
- aucun package de stockage nécessaire au premier lot de domaine ;
- tests rapides et reproductibles ;
- séparation nette entre logique Lenoseed et infrastructure ;
- possibilité de tester les invariants avant d’introduire les erreurs propres à une couche de persistance ;
- futur changement de stockage facilité par le port abstrait.

### Limites acceptées

- la durabilité après redémarrage n’est pas testée immédiatement ;
- l’atomicité est d’abord une propriété logique simulée par l’adaptateur ;
- un second adaptateur devra être développé avant un prototype utilisateur persistant.

## 11. Règle de gouvernance

> **Le stockage réel doit s’adapter aux invariants du domaine Lenoseed ; les invariants du domaine ne doivent pas être simplifiés pour s’adapter prématurément à un stockage choisi trop tôt.**
