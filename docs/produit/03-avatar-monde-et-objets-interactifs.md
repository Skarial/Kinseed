# Avatar, monde visuel et objets interactifs

## Statut

**Type :** spécification produit  
**Portée :** représentation visuelle de l’individu, environnement personnel et interactions avec le monde  
**Statut :** décisions de conception validées, avec certains détails explicitement laissés ouverts  
**Date :** 11 août 2026

---

## 1. Objectif

Le graphisme de LenoSeed ne doit pas servir uniquement à décorer l’application.

L’avatar et son monde doivent rendre perceptible le principe central du projet : **un individu numérique persistant dont l’état actuel dépend de son histoire**.

Le monde visuel doit donc pouvoir montrer, avec le temps, des traces de ce que le LenoSeed a vécu, appris, construit, perdu, transformé ou hérité.

L’objectif n’est pas de créer un Tamagotchi plus détaillé, un personnage à collectionner ou un simple système de skins.

Le principe directeur est :

> **L’avatar représente l’individu ; son monde représente une partie visible de son histoire.**

---

## 2. Direction graphique générale

La direction retenue est celle d’un **avatar humanoïde semi-stylisé**, capable d’être représenté de la naissance à la vieillesse dans un univers cohérent avec lui.

Le rendu doit éviter deux extrêmes :

- l’hyperréalisme, coûteux à produire et susceptible de créer un effet d’« uncanny valley » ;
- le petit personnage ou animal très cartoon, qui rapprocherait trop LenoSeed d’un Tamagotchi ou d’un jeu pour enfant.

Le langage visuel recherché est donc :

- adulte dans son traitement artistique, même lorsque le LenoSeed est représenté bébé ou enfant ;
- semi-stylisé ;
- chaleureux ;
- expressif ;
- suffisamment simple pour rester compatible avec une application mobile ;
- suffisamment distinctif pour permettre à chaque LenoSeed de devenir reconnaissable dans le temps.

L’avatar et le monde doivent former une scène cohérente : le LenoSeed est présent dans son environnement personnel, et cet environnement peut évoluer avec son histoire.

---

## 3. Sexe visuel choisi par l’utilisateur

À la création du premier LenoSeed, l’utilisateur choisit uniquement entre deux bases visuelles :

- **masculin** ;
- **féminin**.

Il ne choisit pas les autres caractéristiques de l’apparence de départ.

En particulier, l’utilisateur ne sélectionne pas :

- le visage ;
- les cheveux ;
- la carnation ;
- les yeux ;
- les détails physiques ;
- les vêtements initiaux ;
- les accessoires initiaux.

Le but est d’éviter un éditeur de personnage classique dans lequel l’utilisateur fabrique entièrement son avatar.

L’utilisateur choisit le sexe visuel, puis **découvre l’individu qui lui est attribué**.

Les bases masculine et féminine doivent partager le même langage graphique, le même niveau de stylisation et les mêmes règles d’évolution.

Cette décision concerne l’apparence et l’expérience utilisateur. Elle ne définit pas encore les règles biologiques ou numériques de la future reproduction intergénérationnelle.

---

## 4. Génération de l’apparence initiale

L’apparence initiale doit être produite par un système **modulaire et déterministe**.

### 4.1 Bibliothèque modulaire

Le système disposera d’une bibliothèque d’éléments visuels compatibles entre eux, par exemple :

- formes de visage ;
- carnations ;
- coiffures ;
- yeux ;
- détails ou particularités visuelles ;
- vêtements de départ ;
- autres éléments nécessaires au rendu final.

La liste exacte des catégories et le nombre de variantes restent à définir lors de la conception graphique détaillée.

### 4.2 Seed persistante

Une graine de génération (`seed`) doit permettre d’obtenir une apparence déterministe.

Exemple conceptuel :

```text
Sexe visuel : masculin
Seed : 583104

Visage : M_04
Carnation : S_03
Cheveux : H_07
Yeux : E_02
Détail : D_05
Vêtement initial : O_03
```

Ces paramètres internes ne sont pas destinés à être présentés comme un écran de personnalisation à l’utilisateur.

Le même individu doit conserver une continuité visuelle : sa base ne doit pas être régénérée arbitrairement à chaque session.

### 4.3 Pourquoi ce choix

Cette solution est préférée à :

- une génération aléatoire non reproductible ;
- une génération procédurale très complexe dès la première version ;
- une génération d’image par IA à chaque naissance, difficile à rendre parfaitement cohérente entre les poses, scènes et animations ;
- un petit catalogue de personnages complets fixes, qui produirait rapidement des doublons visibles.

Le système modulaire + seed offre un compromis entre :

- diversité ;
- persistance ;
- coût ;
- contrôle artistique ;
- maintenabilité ;
- compatibilité avec une future hérédité visuelle.

### 4.4 Compatibilité avec l’héritage

Le modèle visuel doit rester compatible avec la future transmission intergénérationnelle.

Cela ne signifie pas que l’algorithme d’héritage visuel doit être conçu maintenant.

La contrainte actuelle est seulement de ne pas enfermer l’apparence dans un format qui empêcherait plus tard de recombiner certains éléments provenant de deux lignées, avec variation, transformation ou mutation.

Un descendant devra rester un nouvel individu et non une copie visuelle d’un parent.

### 4.5 Continuité visuelle à travers les âges

Un LenoSeed possède cinq paliers visuels de vie :

```text
Bébé → Enfant → Adolescent → Adulte → Vieux
```

Ces cinq représentations doivent rester celles du **même personnage**.

La `seed` et les caractéristiques constitutives doivent permettre de conserver une continuité reconnaissable, notamment pour :

- couleur des yeux ;
- carnation ;
- structure générale du visage ;
- traits distinctifs ;
- autres caractéristiques constitutives définies ultérieurement.

Les proportions, la morphologie, les cheveux, la posture et certains détails peuvent changer avec l’âge, mais l’utilisateur doit pouvoir reconnaître son LenoSeed de l’enfance à la vieillesse.

Les transitions visuelles se font **par paliers** et non par morphing graphique permanent.

Les règles complètes de cycle de vie, de temps réel, de développement, de vieillissement et de fin de vie sont documentées dans [`04-cycle-de-vie-vieillissement-et-fin-de-vie.md`](04-cycle-de-vie-vieillissement-et-fin-de-vie.md).

---

## 5. Monde initial

Tous les LenoSeeds commencent dans **le même type d’environnement de base**.

La direction retenue est une petite pièce ou un petit refuge personnel :

- simple ;
- peu chargé ;
- encore largement neutre ;
- contenant peu de traces d’histoire au moment de la naissance.

L’objectif est que les grandes différences visibles entre les mondes apparaissent principalement **à cause de ce qui a été vécu après la naissance**.

Si chaque monde était déjà totalement différent au départ, il deviendrait difficile de distinguer ce qui appartient à la génération initiale de ce qui résulte réellement de l’histoire du LenoSeed.

### 5.1 Variations initiales mineures

Le monde de départ peut néanmoins recevoir quelques variations mineures déterministes, également liées à la génération initiale.

Exemples possibles :

- nuance lumineuse ;
- petite variation de texture ;
- disposition légèrement différente ;
- petite plante ;
- petit objet de départ ;
- variation de la vue extérieure.

Ces variations servent à éviter une uniformité absolue, mais elles ne doivent pas donner l’impression que le LenoSeed possède déjà une longue histoire.

---

## 6. Le monde comme trace visible de l’histoire

Une règle centrale est retenue :

> **Un changement durable et significatif dans le monde doit correspondre à quelque chose de réellement arrivé dans l’histoire du LenoSeed.**

Le décor ne doit pas se modifier arbitrairement uniquement pour donner une impression de nouveauté.

Un élément visuel important doit pouvoir avoir une cause identifiable dans l’état ou l’histoire de l’individu.

### 6.1 Sources possibles d’évolution

Le cadre de conception retient notamment les grandes sources suivantes :

1. **expérience importante** — un événement marquant peut laisser une trace ou un objet ;
2. **relation importante** — une relation durable peut être représentée par une photo, un cadeau, un souvenir ou un autre signe ;
3. **intérêt ou habitude durable** — un domaine réellement développé peut progressivement modifier l’environnement ;
4. **étape de vie** — certaines étapes ou accomplissements peuvent laisser une trace ;
5. **héritage** — certaines traces liées à la lignée pourront plus tard apparaître dans le monde d’un descendant.

Ces catégories donnent un cadre produit. Leurs règles exactes de déclenchement restent à définir avant implémentation.

### 6.2 Exemple : développement d’un intérêt

Une seule discussion sur l’astronomie ne doit pas automatiquement faire apparaître un télescope.

Une évolution cohérente pourrait être :

```text
information ou discussion isolée
        ↓
connaissances et expériences répétées
        ↓
intérêt suffisamment durable
        ↓
apparition d’un premier livre ou d’une première trace visuelle
        ↓
approfondissement du domaine
        ↓
objets ou expériences plus importantes liés à ce domaine
```

Ainsi, si un télescope apparaît plusieurs mois plus tard, sa présence signifie quelque chose dans l’histoire du LenoSeed.

---

## 7. État temporaire et traces durables

Le monde doit permettre de distinguer deux familles de changements.

### 7.1 Changements temporaires

Ils représentent principalement l’état actuel ou une activité en cours.

Exemples :

- posture de l’avatar ;
- lumière de la scène ;
- activité momentanée ;
- fenêtre ouverte ou fermée ;
- LenoSeed assis à un bureau.

Ces éléments peuvent disparaître sans constituer un oubli autobiographique.

### 7.2 Traces persistantes

Elles représentent une partie de l’histoire construite.

Exemples :

- objet personnel ;
- photo ;
- livre ;
- souvenir matériel ;
- transformation durable d’une zone du monde.

Une trace persistante ne doit pas apparaître ou disparaître arbitrairement.

---

## 8. Persistance, transformation et oubli du monde

Le monde visuel **n’est pas une archive infinie**.

Les objets et traces peuvent :

- rester ;
- évoluer ;
- être déplacés ;
- être rangés ;
- être remplacés ;
- perdre de l’importance ;
- disparaître.

Cette évolution doit être cohérente avec l’évolution réelle du LenoSeed.

### 8.1 Niveaux de persistance

Le cadre retenu distingue conceptuellement :

- **traces fortes** : événements majeurs, relations importantes, grandes étapes de vie, héritages importants ; elles peuvent persister très longtemps ou définitivement ;
- **traces moyennes** : intérêts, habitudes ou souvenirs moins structurants ; elles peuvent être transformées, déplacées ou remplacées ;
- **traces faibles** : éléments de faible importance ; elles peuvent disparaître si elles ne sont plus pertinentes.

Les seuils exacts et la manière de calculer cette importance restent ouverts.

### 8.2 La disparition doit avoir une cause

Une disparition ou une transformation significative doit rester explicable.

Exemples de causes possibles :

- oubli progressif ;
- perte d’importance ;
- changement d’intérêt ;
- transformation d’une croyance ;
- changement ou fin d’une relation ;
- réinterprétation d’un souvenir.

Le système ne doit pas faire disparaître aléatoirement un objet important uniquement pour renouveler le décor.

### 8.3 Déplacement plutôt que suppression brutale

Certains éléments pourront changer de statut plutôt que disparaître immédiatement.

Exemple :

```text
objet exposé
    ↓
objet moins utilisé
    ↓
objet rangé
    ↓
souvenir archivé ou éventuellement oublié
```

Ce type d’évolution permet au monde de donner une sensation de passé sans accumuler indéfiniment tous les éléments dans la scène principale.

---

## 9. Provenance des éléments visuels

Pour rester compatible avec les principes d’architecture de LenoSeed, une trace visuelle importante doit pouvoir être reliée à sa provenance.

Exemple conceptuel :

```text
Objet : petit télescope
Apparu : 18 novembre 2026
Cause : intérêt durable pour l’astronomie
Origines :
  - souvenir X
  - expérience Y
  - apprentissage Z
Importance : élevée
Persistance : durable
```

L’utilisateur n’a pas nécessairement besoin de voir ces données techniques.

En revanche, le système doit pouvoir expliquer pourquoi un élément important existe.

Le monde visuel ne doit donc pas devenir une seconde source de vérité indépendante de la mémoire, des relations, des connaissances ou de l’état interne.

Idéalement, il doit être une **projection visuelle traçable** de certains éléments déjà présents dans le modèle de l’individu.

---

## 10. Objets interactifs

Tous les éléments du décor ne doivent pas être interactifs.

Un monde dans lequel chaque détail devient un bouton ou un hotspot risquerait de ressembler à une interface de jeu classique et de perdre sa lisibilité.

Certains objets auront cependant une fonction interactive forte : ils pourront servir de **portes d’entrée vers une partie de la vie du LenoSeed**.

Une classification de travail utile est :

- **objets décoratifs** : racontent indirectement l’histoire sans interaction nécessaire ;
- **objets-mémoire** : ouvrent un contenu lié au passé, aux relations ou à des traces autobiographiques ;
- **objets-expérience** : ouvrent une petite expérience spécifique liée au monde ou aux intérêts du LenoSeed.

Cette classification est un cadre de conception et pourra être affinée lors de la conception UX détaillée.

---

## 11. Livres liés aux domaines appris

L’idée retenue est que **chaque livre important puisse représenter un domaine de connaissance réellement développé par le LenoSeed**.

Exemples :

- astronomie ;
- musique ;
- histoire ;
- jardinage ;
- psychologie ;
- autre domaine réellement appris au cours de sa trajectoire.

### 11.1 Apparition d’un livre

Un livre ne doit pas apparaître après l’apprentissage d’une seule information isolée.

Il doit correspondre à un domaine devenu suffisamment important, structuré ou durable.

L’étagère doit ainsi devenir progressivement une représentation visible de ce que l’individu a réellement appris au cours de sa vie.

### 11.2 Interaction

Un livre peut être ouvert par l’utilisateur pour explorer son contenu.

Le détail exact du contenu reste à spécifier, mais une structure cohérente avec l’architecture de LenoSeed devra préserver la distinction entre :

- **connaissances acquises** ;
- **interprétations, opinions ou hypothèses du LenoSeed** ;
- **souvenirs ou expériences ayant contribué à cet apprentissage**.

Une représentation possible serait :

```text
Livre : Astronomie

Chapitres de connaissances
Annotations personnelles du LenoSeed
Marque-pages renvoyant à certaines expériences ou souvenirs
```

Cette structure détaillée est une piste de conception à confirmer avant implémentation ; la décision déjà retenue est que les livres sont liés à des domaines réellement appris et peuvent être consultables.

---

## 12. Album familial et relations

Un album photo familial fait partie des exemples retenus d’objet interactif possible.

Il peut montrer :

- des relations existantes ;
- des emplacements encore vides ;
- l’évolution d’une famille ou d’une lignée dans le temps.

L’exemple discuté comprend notamment des emplacements tels que :

- « femme » ;
- « enfant ».

Un emplacement peut donc être vide tant que cette relation ou cette partie de l’histoire n’existe pas, puis être occupé si la vie du LenoSeed évolue dans cette direction.

### Point à ne pas figer trop tôt

L’album ne doit pas imposer artificiellement à tous les LenoSeeds un parcours de vie prédéfini.

Les catégories relationnelles exactes, leur vocabulaire et la manière de gérer différentes trajectoires de vie restent à concevoir.

La règle importante est que **l’album reflète les relations réellement construites et non des relations fictives ajoutées pour remplir l’interface**.

---

## 13. Télescope et expériences immersives

Le télescope constitue un exemple d’**objet-expérience**.

S’il existe réellement dans le monde d’un LenoSeed, l’utilisateur peut cliquer dessus et accéder à une vue dédiée du ciel étoilé.

Cette vue peut devenir une petite expérience immersive associée à l’intérêt ou à l’histoire du LenoSeed.

Le télescope ne doit toutefois pas être un objet standard distribué à tous les individus sans raison. Sa présence doit résulter de l’histoire, de l’intérêt ou d’un événement pertinent.

Le même principe pourra être appliqué plus tard à d’autres objets, sans transformer automatiquement chaque objet du décor en mini-jeu.

---

## 14. Conséquences pour l’architecture future

Aucun modèle de données détaillé n’est décidé dans ce document.

Cependant, les décisions produit imposent plusieurs contraintes importantes pour l’implémentation future.

### 14.1 Ne pas dupliquer la vérité métier

Le monde visuel ne doit pas inventer une connaissance, une relation ou un souvenir uniquement parce qu’un asset graphique est présent.

La causalité attendue est plutôt :

```text
événements vécus
    ↓
mémoire / connaissance / relation / état interne
    ↓
évaluation de l’importance et de la persistance
    ↓
trace ou transformation visuelle éventuelle
```

### 14.2 Conserver la provenance

Lorsqu’un élément visuel durable apparaît, il doit être possible de retrouver les informations internes qui ont justifié son apparition.

### 14.3 Séparer apparence initiale et histoire acquise

La `seed` et les caractéristiques visuelles de naissance ne doivent pas être confondues avec les traces acquises au cours de la vie.

Cette séparation sera également importante pour la future hérédité : il faudra pouvoir distinguer ce qui est constitutif, ce qui est hérité et ce qui est acquis.

### 14.4 Ne pas coder prématurément le moteur visuel

Avant d’implémenter le système de monde évolutif, il faudra définir précisément :

- la structure minimale d’une trace visuelle ;
- son lien avec les entités métier existantes ;
- ses règles d’apparition ;
- ses règles de transformation et de disparition ;
- la manière dont le rendu est reconstruit de façon déterministe.

Ces décisions doivent être prises lorsque cette partie devient réellement prioritaire dans la roadmap.

---

## 15. Hors périmètre pour l’instant

Les décisions suivantes ne sont pas prises dans ce document :

- technologie exacte de rendu : 2D, 2.5D, isométrique ou 3D ;
- format précis des assets ;
- quantité d’éléments nécessaires dans la bibliothèque ;
- animations exactes de l’avatar ;
- seuils numériques d’apparition ou d’oubli d’un objet ;
- structure de données définitive des traces visuelles ;
- algorithme exact d’hérédité de l’apparence ;
- règles de reproduction liées au sexe ;
- catégories relationnelles définitives de l’album familial ;
- nombre et nature des zones que le monde pourra contenir ;
- éventuelle extension du refuge vers plusieurs pièces ou lieux.

Les durées, règles de développement et autres décisions de cycle de vie sont suivies séparément dans `04-cycle-de-vie-vieillissement-et-fin-de-vie.md`.

Ces sujets doivent rester ouverts tant qu’ils ne sont pas nécessaires à l’étape de développement en cours.

---

## 16. Résumé des décisions validées

1. LenoSeed est représenté par un **avatar humanoïde semi-stylisé** qui conserve son identité visuelle de la naissance à la vieillesse.
2. Il existe une **base masculine** et une **base féminine** partageant le même langage graphique.
3. L’utilisateur choisit **uniquement le sexe visuel** à la création ; il ne personnalise pas les autres caractéristiques de départ.
4. L’apparence initiale est générée automatiquement à partir d’une **bibliothèque modulaire** et d’une **seed déterministe et persistante**.
5. Le modèle visuel doit rester compatible avec une future **hérédité intergénérationnelle**, sans définir encore son algorithme.
6. Tous les LenoSeeds commencent dans le même type de **petit refuge sobre**, avec seulement quelques variations initiales mineures.
7. Les différences majeures du monde doivent principalement provenir de **l’histoire vécue**.
8. Une transformation durable significative doit avoir une **cause traçable**.
9. Le monde n’est pas une archive infinie : les traces peuvent rester, évoluer, être déplacées, rangées ou disparaître selon leur importance et l’évolution réelle du LenoSeed.
10. Une disparition importante doit avoir une cause explicable, jamais être uniquement aléatoire.
11. Certains objets du monde sont interactifs tandis que d’autres restent visuels.
12. Les **livres** peuvent représenter des domaines réellement appris et être consultables.
13. Un **album familial** peut matérialiser des relations existantes ou encore absentes, sans inventer de relations fictives.
14. Un **télescope** peut ouvrir une expérience de ciel étoilé s’il existe pour une raison cohérente dans l’histoire du LenoSeed.
15. Le monde visuel doit rester une **projection traçable de l’individu et de son histoire**, pas une source de vérité indépendante.
16. L’avatar possède cinq paliers visuels cohérents — **bébé, enfant, adolescent, adulte, vieux** — et doit rester reconnaissable à travers tous ces âges.

---

## 17. Principe directeur

Le système visuel devra toujours respecter la question suivante :

> **Ce que l’utilisateur voit dans le monde de son LenoSeed raconte-t-il réellement quelque chose de cet individu et de son histoire, ou s’agit-il seulement de décoration ?**

Si un élément n’apporte rien à l’identité, au vécu, à la relation, à l’apprentissage ou à la continuité du LenoSeed, sa complexité doit être justifiée par un autre besoin produit concret.
