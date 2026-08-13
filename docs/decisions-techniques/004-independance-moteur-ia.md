# ADR-004 — Indépendance vis-à-vis du moteur IA

- **Statut :** accepté
- **Date :** 2026-08-10
- **Périmètre :** cœur métier et intégration IA de Lenoseed
- **Décision :** l'individu Lenoseed ne doit pas être confondu avec un modèle d'IA particulier ; les modèles externes doivent rester des moteurs remplaçables utilisés par le système.

## 1. Contexte

Lenoseed peut avoir besoin de modèles d'IA pour interpréter du langage, produire des réponses, raisonner sur certaines informations, résumer des expériences ou proposer des transformations.

Cependant, si l'identité, les mémoires, les croyances et les intentions de l'individu résident uniquement dans le contexte interne d'un modèle donné, Lenoseed deviendrait dépendant de ce fournisseur, de cette version de modèle et de ses limites techniques.

Cela empêcherait notamment de garantir la continuité de l'individu lorsqu'un modèle est remplacé, devient indisponible, change de comportement ou n'est plus économiquement viable.

## 2. Décision

Lenoseed distingue explicitement :

```text
INDIVIDU Lenoseed
├── identité
├── histoire
├── événements
├── mémoires
├── croyances
├── hypothèses
├── intentions
├── relations
└── état persistant
        ↓
  utilise éventuellement
        ↓
MOTEUR IA
```

Le moteur IA est donc une dépendance fonctionnelle éventuelle, pas le lieu où l'individu existe.

## 3. Règles

### 3.1 Le cœur persistant appartient à Lenoseed

Les données structurantes doivent être stockées dans les structures propres au projet et non uniquement dans :

- le contexte d'une conversation ;
- l'historique propriétaire d'un fournisseur ;
- les paramètres implicites d'un modèle ;
- une mémoire inaccessible ou non exportable d'un service tiers.

### 3.2 Le fournisseur doit être remplaçable

Le cœur métier doit éviter de dépendre directement d'une API particulière.

Une couche d'adaptation devra permettre, lorsque cela sera nécessaire, de passer par exemple :

```text
Lenoseed
   ↓
interface de moteur IA
   ├── fournisseur A
   ├── fournisseur B
   └── modèle local éventuel
```

Le schéma précis de cette interface sera défini uniquement lorsqu'un premier besoin d'intégration IA apparaîtra.

### 3.3 Les sorties d'un modèle ne sont pas automatiquement des faits

Une réponse générée par un modèle doit être traitée comme une proposition, une interprétation ou une transformation produite par une source identifiée.

Elle ne doit pas devenir automatiquement une mémoire fiable, une croyance certaine ou une vérité sur le monde sans passer par les règles propres à Lenoseed.

### 3.4 Changer de modèle ne doit pas créer un nouvel individu

Le remplacement d'un modèle d'IA ne doit pas, à lui seul, effacer :

- l'identité ;
- l'histoire ;
- les mémoires ;
- les croyances ;
- les relations ;
- les intentions ;
- la filiation.

Il pourra modifier certaines performances ou certains comportements, mais l'individu persistant doit rester le même.

## 4. Conséquences

### Positives

- réduction du verrouillage fournisseur ;
- possibilité de comparer plusieurs modèles ;
- continuité de l'individu malgré l'évolution des technologies IA ;
- meilleure traçabilité de ce qui vient de Lenoseed et de ce qui vient d'un modèle externe ;
- possibilité future d'utiliser certains traitements localement et d'autres à distance ;
- architecture plus compatible avec une démarche expérimentale.

### Contraintes

- nécessité future de concevoir une interface d'abstraction pour les moteurs IA ;
- nécessité de convertir les entrées et sorties des modèles vers les structures internes de Lenoseed ;
- certains fournisseurs pourront avoir des fonctionnalités particulières qui ne seront pas communes à tous ;
- il faudra tester qu'un changement de moteur ne modifie pas silencieusement les règles fondamentales du système.

## 5. Ce qui n'est pas décidé ici

Cet ADR ne choisit pas :

- OpenAI, Anthropic, Mistral ou un autre fournisseur ;
- un modèle précis ;
- une API ;
- un modèle local ;
- la fréquence des appels ;
- le budget d'inférence ;
- la stratégie de prompt ;
- la manière exacte dont un modèle contribue aux mémoires, croyances ou intentions.

Ces décisions seront prises à partir de besoins expérimentaux concrets.

## 6. Règle d'architecture

**Le modèle peut aider Lenoseed à penser ou à communiquer ; il ne doit pas être Lenoseed.**
