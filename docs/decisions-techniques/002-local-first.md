# ADR-002 — Architecture local-first

- **Statut :** accepté
- **Date :** 2026-08-10
- **Périmètre :** persistance et fonctionnement de Kinseed
- **Décision :** l'état essentiel d'un individu Kinseed doit exister localement et rester exploitable sans dépendre en permanence d'un service distant.

## 1. Contexte

Kinseed repose sur l'idée d'un individu numérique persistant dont l'identité se construit dans le temps à partir de son histoire, de ses expériences, de ses mémoires, de ses croyances et de ses intentions.

Une architecture entièrement cloud-first créerait une dépendance forte à la disponibilité d'un serveur, à une connexion réseau et à un fournisseur externe. Cette dépendance serait en tension avec l'objectif de continuité de l'individu numérique.

Kinseed doit pouvoir évoluer vers des fonctions connectées, notamment la synchronisation, les interactions entre individus, les transmissions intergénérationnelles ou l'appel à des services d'IA distants. Ces fonctions ne doivent toutefois pas devenir la condition d'existence de l'état fondamental de l'individu.

## 2. Décision

Kinseed adopte une approche **local-first**.

Cela signifie que :

- l'état essentiel de l'individu est conservé localement ;
- les données nécessaires à son identité et à sa continuité doivent pouvoir être relues sans connexion réseau ;
- l'application doit pouvoir démarrer et accéder à cet état hors ligne ;
- les services distants sont considérés comme des extensions ou des moyens de synchronisation, et non comme l'unique source de vérité de l'individu ;
- le choix précis de la technologie de stockage local est volontairement différé.

## 3. Données concernées

Sont considérées comme candidates à la persistance locale au minimum :

- identité de l'individu ;
- événements ;
- sources ;
- mémoires ;
- croyances ;
- hypothèses sur soi ;
- hypothèses sur l'humain ;
- intentions ;
- liens de filiation et provenance des éléments hérités lorsqu'ils seront introduits.

La liste exacte sera affinée par l'architecture de G0-A.

## 4. Conséquences

### Positives

- continuité de l'individu même en l'absence de réseau ;
- meilleure maîtrise des données personnelles ;
- réduction du couplage entre identité de Kinseed et infrastructure serveur ;
- possibilité d'ajouter plus tard plusieurs stratégies de synchronisation ou de sauvegarde ;
- cohérence avec une application mobile pouvant fonctionner partiellement ou totalement hors ligne.

### Contraintes

- il faudra gérer plus tard la sauvegarde et la restauration ;
- une synchronisation multi-appareils nécessitera une stratégie explicite de conflits ;
- les interactions entre plusieurs utilisateurs nécessiteront malgré tout une infrastructure distante ;
- la sécurité et le chiffrement du stockage devront être traités avant une diffusion publique.

## 5. Ce qui n'est pas décidé ici

Cet ADR ne choisit pas :

- SQLite, IndexedDB ou une autre technologie de stockage ;
- Firebase ou un autre backend ;
- le mécanisme de synchronisation ;
- le format de sauvegarde ;
- le chiffrement ;
- l'authentification utilisateur.

Ces décisions seront prises lorsque les besoins réels de G0-A et des générations suivantes seront suffisamment définis.

## 6. Règle d'architecture

La perte temporaire d'une connexion Internet ou d'un service distant ne doit pas, à elle seule, faire disparaître l'identité ou l'histoire locale de l'individu Kinseed.
