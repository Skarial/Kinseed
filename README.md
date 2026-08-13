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
5. [`docs/05-generation-0a-structures-et-cycle-vie.md`](docs/05-generation-0a-structures-et-cycle-vie.md) — détaille les structures minimales de G0-A, la couche `EvidenceItem` et leurs règles de promotion, révision et commit.
6. [`docs/06-generation-0a-contrat-tour-et-evenements.md`](docs/06-generation-0a-contrat-tour-et-evenements.md) — fixe les événements minimaux, l’ordre causal d’un tour, l’idempotence et le comportement attendu en cas d’échec.
7. [`docs/07-generation-0a1-protocole-croyance-provenance.md`](docs/07-generation-0a1-protocole-croyance-provenance.md) — définit la première expérience exécutable G0-A1 sur la provenance, la persistance et la révision d’une croyance.
8. [`docs/08-generation-0a1-contrat-implementation.md`](docs/08-generation-0a1-contrat-implementation.md) — traduit G0-A1 en contrat d’implémentation minimal, définit les invariants et la stratégie de tests.
9. [`docs/09-generation-0a1-resultats-validation.md`](docs/09-generation-0a1-resultats-validation.md) — consigne la validation expérimentale limitée de G0-A1, ses résultats reproductibles et sa prochaine limite de robustesse.
10. [`docs/10-generation-0a2-protocole-premiere-hypothese-soi.md`](docs/10-generation-0a2-protocole-premiere-hypothese-soi.md) — définit la sous-expérience G0-A2 sur une première `SelfHypothesis` provisoire, sa provenance, son influence causale et son ablation.
11. [`docs/11-generation-0a2-contrat-implementation.md`](docs/11-generation-0a2-contrat-implementation.md) — fixe les structures, invariants, contrôles et reprises minimaux du cœur déterministe G0-A2.
12. [`docs/12-generation-0a2-resultats-validation.md`](docs/12-generation-0a2-resultats-validation.md) — consigne la validation expérimentale limitée de G0-A2, ses contrôles causaux, son contrôle C0 et ses limites.
13. [`docs/13-regles-fondatrices-heritage.md`](docs/13-regles-fondatrices-heritage.md) — conserve les règles déjà validées pour la future transmission intergénérationnelle.

Les décisions techniques sont documentées séparément dans `docs/decisions-techniques/`. Pour G0-A1, ADR-005 fixe l’utilisation initiale d’un `PersistencePort` avec un adaptateur `InMemoryStore`, sans choisir prématurément le stockage local durable.

### Pilotage du projet

Les documents de `docs/pilotage/` servent de garde-fous transversaux et ne remplacent pas les spécifications canoniques :

- [`docs/pilotage/01-registre-decisions.md`](docs/pilotage/01-registre-decisions.md) — indexe les décisions structurantes et leur source de vérité ;
- [`docs/pilotage/02-registre-risques.md`](docs/pilotage/02-registre-risques.md) — suit les risques conceptuels, techniques, produit et les seuils nécessitant une expertise extérieure ;
- [`docs/pilotage/03-gates-validation.md`](docs/pilotage/03-gates-validation.md) — transforme les critères de sortie de la roadmap en checklists GO / GO CONDITIONNEL / NO-GO.

Avant une modification structurante ou un changement de phase, ces documents doivent être consultés avec les spécifications concernées.

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

- G0-A1 est validé dans son périmètre.
- G0-A2 est validé dans son périmètre.
- G0-A reste ouvert.
- Memory et `HumanHypothesis` doivent encore être traitées avant de considérer G0-A complet.
