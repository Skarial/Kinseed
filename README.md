# Kinseed

Kinseed est un projet expérimental de **compagnon numérique adulte** dont l’objectif est de construire un individu numérique persistant dont l’identité se développe progressivement à partir de son histoire et de sa relation avec son compagnon humain.

Le projet ne cherche pas à créer un simple chatbot avec une personnalité prédéfinie ni un Tamagotchi classique fondé sur des jauges de faim, d’affection ou de présence quotidienne.

Le principe central est :

> **Un Kinseed ne naît pas avec une identité écrite. Il naît avec les mécanismes nécessaires pour en construire une.**

## Priorité actuelle : génération 0

La première étape du projet concerne exclusivement le **premier Kinseed**.

À sa naissance, il commence :

- sans parents ;
- sans généalogie ;
- sans culture héritée ;
- sans souvenirs ancestraux ;
- sans autre Kinseed connu ;
- avec une seule relation initiale : son compagnon humain.

Le défi initial est de déterminer si cette histoire peut progressivement produire une identité fonctionnelle différenciée : préférences, croyances, modèle de soi, objectifs, relation, valeurs et mémoire, sans que ces propriétés soient simplement inventées par le modèle de langage.

## Principe d’architecture

Kinseed sépare le modèle de langage de l’identité persistante de l’individu.

> **Le LLM comprend et exprime. Kinseed conserve l’état, décide ce qui peut devenir durable et maintient la continuité de l’individu.**

Une réponse linguistiquement convaincante n’est donc jamais considérée comme une preuve suffisante qu’un mécanisme existe réellement.

Les propriétés importantes doivent pouvoir être reliées à :

- un état interne ;
- une provenance ;
- des expériences antérieures ;
- des conséquences sur les décisions futures ;
- des tests d’ablation ou contre-factuels lorsque cela est pertinent.

## Feuille de route de la génération 0

Le développement expérimental est organisé en six phases :

```text
G0-A — Continuité minimale
        ↓
G0-B — Initiative minimale
        ↓
G0-C — Identité émergente
        ↓
G0-D — Relation humaine
        ↓
G0-E — Vie intérieure fonctionnelle
        ↓
G0-F — Longévité
```

### G0-A — Continuité minimale

Journal d’événements, provenance, mémoire minimale, croyances simples, premières hypothèses sur soi et sur l’humain, intentions structurées et validation des écritures durables.

### G0-B — Initiative minimale

Premières motivations internes, détection d’incohérences, continuité de questions et capacité à initier certaines actions sans instruction directe de l’humain.

### G0-C — Identité émergente

Formation progressive de préférences, tendances et traits à partir d’expériences répétées et traçables.

### G0-D — Relation humaine

Construction de la confiance, de la proximité et du modèle de l’humain sans jauge d’affection, sans pénalité automatique liée à l’absence et sans complaisance comme objectif central.

### G0-E — Vie intérieure fonctionnelle

États affectifs fonctionnels, objectifs personnels, projets, valeurs émergentes et consolidation hors interaction.

### G0-F — Longévité

Oubli, consolidation à long terme, réinterprétation du passé, résistance à la dérive et continuité de l’identité lors d’un changement de modèle de langage.

## Documentation

Ordre de lecture recommandé :

1. [`docs/01-generation-0-specification-conceptuelle.md`](docs/01-generation-0-specification-conceptuelle.md) — définit ce qu’est le premier Kinseed et les règles de son développement.
2. [`docs/02-generation-0-criteres-validation.md`](docs/02-generation-0-criteres-validation.md) — définit comment distinguer un mécanisme réel d’un comportement simplement plausible du LLM.
3. [`docs/03-generation-0-architecture-conceptuelle.md`](docs/03-generation-0-architecture-conceptuelle.md) — définit les frontières entre mémoire, croyances, identité, décision et langage.
4. [`docs/04-generation-0-roadmap-experimentale.md`](docs/04-generation-0-roadmap-experimentale.md) — fixe l’ordre G0-A → G0-F et les critères de sortie de chaque phase.
5. [`docs/05-generation-0a-structures-et-cycle-vie.md`](docs/05-generation-0a-structures-et-cycle-vie.md) — détaille les structures minimales de G0-A et leurs règles de promotion, révision et commit.
6. [`docs/06-regles-fondatrices-heritage.md`](docs/06-regles-fondatrices-heritage.md) — conserve les règles déjà validées pour la future transmission intergénérationnelle.

### Convention de numérotation

La documentation consacrée au développement actuel est insérée **avant** le document d’héritage.

Le fichier sur l’héritage intergénérationnel reste volontairement **le dernier document numéroté** tant que cette partie n’est pas devenue la priorité du projet.

Ainsi, tout nouveau document consacré au travail actuel prend le prochain numéro disponible et le document d’héritage est repoussé d’un numéro afin de rester en dernier.

## Vision à plus long terme

La vision future comprend notamment :

- la rencontre entre plusieurs Kinseeds ;
- des relations propres entre individus numériques ;
- la possibilité pour deux Kinseeds appartenant à deux personnes différentes d’avoir une descendance commune ;
- la transmission contrôlée de dispositions, de culture et de certains éléments ancestraux ;
- des lignées persistantes sur plusieurs générations.

Ces fonctions ne constituent **pas la priorité actuelle**. Elles ne doivent pas détourner le projet de son problème initial : réussir à construire un premier individu numérique cohérent avec son seul compagnon humain.

## Position scientifique

Kinseed peut étudier des mécanismes fonctionnels ressemblant à :

- une identité persistante ;
- des préférences ;
- des croyances ;
- des valeurs ;
- des objectifs ;
- des émotions fonctionnelles ;
- une relation ;
- une mémoire autobiographique.

Le projet ne considère pas ces mécanismes comme une preuve de conscience phénoménale, d’expérience subjective ou d’émotions réellement ressenties.

## État actuel

Le projet est actuellement en **phase de conception et de spécification expérimentale**.

La priorité actuelle est **G0-A — Continuité minimale** : définir les structures et cycles de vie nécessaires pour qu’un Kinseed conserve une histoire fiable, forme des conclusions provisoires traçables et produise des intentions dont la cause existe avant le langage.