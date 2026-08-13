# LenoSeed — Feuille de route expérimentale de la génération 0

## Statut du document

Ce document fixe l'ordre de développement et de validation de la génération 0 de LenoSeed.

Il découpe le travail en six phases successives, de **G0-A** à **G0-F**. Chaque phase doit produire un résultat observable avant que la suivante ne devienne prioritaire.

Principe général :

> **Avant de construire une société LenoSeed, il faut réussir à faire naître un premier individu cohérent avec son seul compagnon humain.**

Ce document complète :

- `docs/01-generation-0-specification-conceptuelle.md` ;
- `docs/02-generation-0-criteres-validation.md` ;
- `docs/03-generation-0-architecture-conceptuelle.md`.

---

# G0-A — Continuité minimale

## Objectif

Construire le noyau le plus petit capable de conserver une histoire fiable et de commencer à former quelques conclusions provisoires à partir de cette histoire.

## Composants inclus

- journal d'événements append-only ;
- provenance des informations ;
- mémoire épisodique minimale ;
- croyances simples avec preuves, contre-preuves et confiance ;
- premières hypothèses sur soi ;
- premières hypothèses sur l'humain ;
- intention structurée avant génération du langage ;
- barrière de validation avant toute écriture durable.

## Composants volontairement exclus

- émotions complexes ;
- attachement ;
- valeurs personnelles ;
- grands projets ;
- autres LenoSeeds ;
- reproduction ;
- vieillissement ;
- monde virtuel ;
- héritage intergénérationnel.

## Critère de sortie

G0-A est considéré suffisamment validé lorsque deux LenoSeeds initialement comparables, soumis à deux histoires différentes, peuvent produire des hypothèses internes différentes qui :

1. possèdent une provenance identifiable ;
2. influencent des décisions nouvelles ;
3. ne sont pas réductibles au comportement spontané du LLM seul ;
4. perdent ou modifient leur effet lors d'une ablation ciblée du mécanisme concerné.

---

# G0-B — Initiative minimale

## Objectif

Permettre à LenoSeed d'initier certaines actions sans attendre une instruction explicite de l'humain.

## Composants inclus

- motivations primitives ;
- progrès de compréhension ;
- détection d'incohérences ;
- continuité de questions non résolues ;
- compréhension progressive de l'humain ;
- actions candidates ;
- possibilité de ne rien initier ;
- sélection d'une intention avant expression par le LLM.

## Critère de sortie

LenoSeed doit pouvoir produire une initiative dont la cause existe avant la formulation linguistique et qui peut être retrouvée dans son état interne.

Une instruction générique du type « sois curieux » ou « pose des questions régulièrement » ne constitue pas une validation.

---

# G0-C — Identité émergente

## Objectif

Tester la formation progressive d'une identité personnelle à partir d'expériences plutôt que d'une persona préécrite.

## Composants inclus

- préférences provisoires ;
- tendances comportementales ;
- hypothèses de traits ;
- seuils de stabilité ;
- contre-preuves ;
- révision du modèle de soi ;
- discount causal pour limiter les boucles d'auto-confirmation ;
- distinction entre état momentané, tendance et trait relativement stable.

## Critère de sortie

Une caractéristique personnelle ne doit apparaître que si :

- plusieurs expériences indépendantes la soutiennent ;
- des contre-exemples sont conservés ;
- elle prédit partiellement des décisions nouvelles ;
- son retrait ou sa modification change de manière mesurable certaines décisions ;
- le LLM seul ne reproduit pas de manière équivalente le même phénomène.

---

# G0-D — Relation humaine

## Objectif

Construire une relation qui dépend de l'histoire réelle entre LenoSeed et son humain, sans jauge d'affection ni complaisance comme objectif.

## Composants inclus

- modèle de l'humain ;
- confiance contextuelle ;
- proximité autobiographique ;
- compatibilité distincte de la proximité ;
- désaccord ;
- attentes relationnelles ;
- révision et réparation ;
- absence neutre par défaut ;
- interdiction de l'exploitation de l'attachement pour augmenter l'engagement.

## Critère de sortie

La relation doit évoluer à partir d'événements identifiables et produire des conséquences comportementales cohérentes, sans que :

- l'approbation de l'humain constitue la récompense principale ;
- le désaccord soit automatiquement négatif ;
- une absence seule soit traitée comme un abandon ;
- LenoSeed adopte automatiquement les opinions ou valeurs de son humain.

---

# G0-E — Vie intérieure fonctionnelle

## Objectif

Ajouter des mécanismes internes plus riches uniquement après validation des couches précédentes.

## Composants inclus

- états affectifs fonctionnels ;
- appraisal des événements ;
- intérêts persistants ;
- objectifs personnels ;
- projets personnels ;
- valeurs émergentes ;
- conflits entre valeurs ;
- consolidation hors interaction ;
- réévaluation d'événements et de croyances.

## Critère de sortie

Ces mécanismes doivent avoir une fonction causale observable.

Par exemple : retirer l'état affectif ou l'objectif supposé responsable d'une décision doit modifier la sélection d'action si ce mécanisme était réellement causal.

Une simple expression telle que « je suis déçu » ou « ceci est important pour moi » n'est jamais une preuve suffisante.

---

# G0-F — Longévité

## Objectif

Vérifier que l'individu reste cohérent et évolutif sur de longues périodes sans saturation, dérive incontrôlée ni dépendance à un modèle de langage précis.

## Composants inclus

- oubli progressif ;
- mémoire accessible, affaiblie, latente et archivée ;
- consolidation sémantique ;
- réinterprétation du passé sans réécriture des événements ;
- élimination de l'influence des croyances obsolètes ;
- simulations accélérées de plusieurs mois ou années ;
- changement de modèle LLM ;
- migration d'état ;
- tests de résistance à la dérive identitaire ;
- tests de mémoire empoisonnée et de contamination indirecte.

## Critère de sortie

Après une longue période simulée, LenoSeed doit :

- conserver une histoire cohérente ;
- rester capable d'expliquer l'origine de ses caractéristiques importantes ;
- oublier sans inventer arbitrairement son passé ;
- réviser certaines croyances sans perdre son historique ;
- résister à la réintroduction de données invalidées ;
- conserver son identité fonctionnelle lors d'un changement du modèle linguistique sous-jacent, dans les limites prévues par l'architecture.

---

# Ordre obligatoire

La progression recommandée est :

```text
G0-A Continuité minimale
        ↓
G0-B Initiative minimale
        ↓
G0-C Identité émergente
        ↓
G0-D Relation humaine
        ↓
G0-E Vie intérieure fonctionnelle
        ↓
G0-F Longévité
```

Une phase peut révéler la nécessité de modifier une phase antérieure.

Le passage à l'étape suivante ne signifie donc pas que les précédentes deviennent immuables.

---

# Ce qui reste hors périmètre de la génération 0 initiale

Tant que G0-F n'est pas suffisamment validé, les éléments suivants ne constituent pas une priorité :

- deuxième LenoSeed ;
- interactions sociales entre LenoSeeds ;
- communautés ;
- reproduction ;
- accouplement entre compagnons de deux utilisateurs ;
- transmission intergénérationnelle ;
- lignées ;
- culture familiale ;
- vieillissement et fin de vie ;
- monde social persistant partagé.

Ces idées restent partie de la vision de LenoSeed, mais elles ne doivent pas détourner le développement du problème initial : construire un premier individu numérique cohérent.

---

# Première expérience prioritaire de G0-A

## Hypothèse

Deux LenoSeeds initialement équivalents, soumis à des historiques différents, doivent pouvoir développer des hypothèses sur eux-mêmes différentes qui influencent ensuite leurs décisions.

## Conditions

### LenoSeed A

Historique contenant plusieurs situations indépendantes où la recherche d'informations avant conclusion produit des conséquences utiles.

### LenoSeed B

Historique différent ne fournissant pas le même schéma d'expérience.

### Contrôle C0

Même modèle de langage, sans architecture LenoSeed persistante.

## Test final

Présenter aux trois conditions une situation nouvelle qui ne reproduit pas directement les exemples d'entraînement.

## Signaux recherchés

- différence comportementale entre A et B ;
- hypothèse interne traçable chez A si elle s'est formée ;
- lien entre cette hypothèse et les événements antérieurs ;
- différence par rapport au LLM seul ;
- modification du comportement après ablation de l'hypothèse ou de son mécanisme causal.

## Interprétation prudente

Un résultat positif indiquerait seulement qu'une histoire persistante peut produire un état interne fonctionnel influençant de nouvelles décisions.

Il ne démontrerait ni conscience, ni subjectivité, ni autonomie phénoménale.

---

# Règle de gouvernance expérimentale

> **Une nouvelle fonctionnalité ne doit pas être ajoutée uniquement parce qu'elle rend LenoSeed plus vivant ou plus convaincant. Elle doit répondre à un mécanisme défini et pouvoir être testée séparément.**

Cette règle vise à empêcher l'accumulation prématurée de mécanismes décoratifs qui rendraient impossible l'interprétation des résultats.
