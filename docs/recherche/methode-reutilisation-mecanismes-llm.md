# Lenoseed — Méthode de réutilisation des mécanismes issus des LLM et de l’état de l’art

## Statut

Décision méthodologique de projet.

Cette méthode doit être appliquée avant d’inventer ou d’implémenter un nouveau mécanisme du moteur Lenoseed lorsque ce mécanisme ressemble à une capacité déjà étudiée dans les LLM, les agents, les systèmes de mémoire, les systèmes de croyances ou d’autres architectures d’IA.

Elle complète l’architecture existante sans la remplacer.

---

## 1. Objectif

Lenoseed ne doit pas reconstruire à partir de zéro un mécanisme déjà bien compris ailleurs si un principe robuste peut être réutilisé ou adapté.

Pour chaque besoin du moteur, la question préalable devient :

> **Existe-t-il déjà, dans les LLM modernes, leur documentation publique, la littérature scientifique ou des architectures d’agents connues, un principe permettant de résoudre tout ou partie de ce problème ?**

Si oui, Lenoseed doit d’abord étudier ce principe, puis décider s’il peut être :

- réutilisé directement ;
- adapté ;
- utilisé uniquement comme source d’inspiration ;
- rejeté car incompatible avec les invariants de Lenoseed.

Le but est de réduire les mécanismes inventés arbitrairement, accélérer le développement et améliorer la qualité des règles du moteur.

---

## 2. Ce que cette méthode signifie — et ce qu’elle ne signifie pas

### 2.1 Ce qui est autorisé

Lenoseed peut s’appuyer sur :

- les spécifications et documentations publiques de fournisseurs de LLM ;
- les principes comportementaux publiquement documentés ;
- les articles scientifiques et travaux de recherche ;
- les architectures d’agents documentées ;
- les méthodes connues de mémoire, récupération, gestion de croyances, provenance, confiance, planification ou métacognition ;
- des comportements observables d’un LLM, à condition qu’ils soient explicitement identifiés comme observations empiriques et non comme description certaine de son fonctionnement interne ;
- des stratégies explicites proposées par un LLM, à condition de les considérer comme hypothèses de conception à évaluer et non comme révélation de son algorithme interne.

### 2.2 Ce qui est interdit comme conclusion

Il ne faut jamais affirmer que Lenoseed « copie le moteur interne de ChatGPT » ou connaît une règle interne exacte d’un modèle sans source publique permettant de l’établir.

Une grande partie du comportement d’un LLM provient de paramètres appris pendant l’entraînement et ne correspond pas nécessairement à des règles explicites du type :

```text
si contradiction alors confiance -= 0.2
```

Par conséquent :

> **Lenoseed réutilise des principes accessibles, documentés ou expérimentalement observables ; il ne prétend pas reproduire des mécanismes internes inconnus.**

---

## 3. Hiérarchie des sources

Pour un mécanisme donné, privilégier les sources dans cet ordre :

1. documentation ou spécification publique primaire ;
2. article scientifique ou publication technique primaire ;
3. architecture open source documentée et inspectable ;
4. travaux secondaires sérieux comparant plusieurs méthodes ;
5. observation expérimentale reproductible sur un LLM ;
6. proposition ou explication générée par un LLM, considérée uniquement comme hypothèse de travail.

Chaque mécanisme repris par Lenoseed doit indiquer, lorsque pertinent :

- sa source ;
- ce qui est directement établi par la source ;
- ce qui est adapté à Lenoseed ;
- ce qui reste hypothétique.

---

## 4. Procédure obligatoire avant un nouveau mécanisme

### Étape 1 — Définir précisément le problème Lenoseed

Avant toute recherche, formuler le besoin sans proposer immédiatement de solution.

Exemple :

```text
Problème : comment une croyance durable doit-elle évoluer lorsqu’un nouvel événement la contredit ?
```

et non :

```text
Solution supposée : diminuer la confiance de 20 % à chaque contradiction.
```

### Étape 2 — Vérifier l’existant Lenoseed

Lire les décisions, contrats et tests déjà présents afin de ne pas réintroduire une décision déjà prise ou de créer une contradiction.

### Étape 3 — Chercher les mécanismes analogues existants

Examiner les approches pertinentes dans :

- LLM ;
- agents ;
- mémoire artificielle ;
- systèmes de croyances ;
- apprentissage en ligne ;
- systèmes de provenance ;
- planification ;
- métacognition ;
- architectures cognitives ;
- autres domaines directement liés au problème.

La recherche doit rester ciblée sur le besoin courant.

### Étape 4 — Extraire le principe, pas copier aveuglément l’implémentation

Exemple :

```text
Principe observé : une nouvelle information contradictoire ne doit pas nécessairement écraser immédiatement l’état précédent ; la provenance, la confiance et les contre-preuves doivent être conservées.
```

Ce principe peut ensuite être traduit dans les structures propres à Lenoseed.

### Étape 5 — Vérifier la compatibilité avec les invariants Lenoseed

Un mécanisme externe ne peut pas être repris s’il viole notamment les règles suivantes :

- le LLM ne possède pas l’état identitaire durable ;
- le LLM ne peut pas écrire directement dans cet état ;
- les modifications durables doivent conserver leur provenance ;
- l’histoire validée ne doit pas être silencieusement réécrite ;
- un changement de modèle LLM ne doit pas remplacer l’identité du Lenoseed ;
- faits, souvenirs, interprétations, croyances, hypothèses et intentions doivent rester distinguables lorsque cette distinction est utile.

### Étape 6 — Choisir explicitement le niveau de réutilisation

Chaque mécanisme examiné reçoit l’un des statuts suivants :

#### R — Réutilisable

Le principe peut être repris presque directement dans Lenoseed.

#### A — À adapter

Le principe est utile mais doit être transformé pour respecter la persistance, la provenance, la traçabilité ou les autres invariants du projet.

#### I — Inspiration seulement

Le mécanisme fournit une idée intéressante mais aucune règle suffisamment robuste pour être reprise telle quelle.

#### N — Non retenu

Le mécanisme n’apporte rien, est incompatible avec Lenoseed ou ajoute une complexité injustifiée.

#### ? — Inconnu

Les éléments disponibles sont insuffisants pour décider.

### Étape 7 — Tester l’apport propre de Lenoseed

Lorsqu’un LLM sait déjà exécuter une partie de la tâche, les tests doivent éviter de confondre une capacité native du modèle avec une réussite du moteur Lenoseed.

Lorsque pertinent, comparer :

```text
même LLM seul
vs
même LLM + mécanisme Lenoseed
```

Le test doit mesurer ce que Lenoseed est censé apporter, par exemple :

- persistance ;
- traçabilité ;
- provenance ;
- stabilité dans le temps ;
- évolution progressive ;
- résistance à l’auto-confirmation ;
- récupération contrôlée ;
- indépendance vis-à-vis du modèle de langage utilisé.

---

## 5. Frontière entre le LLM et le moteur Lenoseed

Cette méthode ne modifie pas le principe architectural existant :

> **Le LLM comprend et exprime. Lenoseed conserve l’état, décide ce qui peut devenir durable et maintient la continuité de l’individu.**

Un principe emprunté à un LLM peut donc être transformé en règle explicite du moteur, mais le LLM ne devient pas pour autant la source de vérité de l’individu.

Exemple :

```text
Capacité générale du LLM
« identifier qu’une nouvelle information contredit une croyance »

        ↓ adaptation

Mécanisme Lenoseed
- conserver l’événement contradictoire ;
- conserver sa provenance ;
- retrouver la croyance concernée ;
- calculer ou proposer une révision ;
- vérifier les contre-preuves ;
- décider si une modification durable est autorisée ;
- conserver la justification de la modification.
```

Le raisonnement sémantique peut être confié au LLM lorsque c’est pertinent, mais la transition d’état reste gouvernée par Lenoseed.

---

## 6. Fiche minimale d’audit d’un mécanisme

Pour chaque mécanisme étudié, produire au minimum :

```text
Nom du mécanisme :

Problème Lenoseed :

Existant Lenoseed concerné :

Mécanismes analogues trouvés :

Sources :

Certain :

Probable :

Inconnu :

Principe réutilisable :

Statut : R / A / I / N / ?

Adaptation nécessaire pour Lenoseed :

Risque de dépendance au LLM :

Règles qui doivent rester déterministes :

Tests nécessaires :

Décision :
```

Cette fiche peut rester courte pour un mécanisme simple.

---

## 7. Application aux mécanismes déjà construits

La méthode doit également être appliquée rétroactivement aux mécanismes importants déjà présents dans la génération 0 afin de détecter :

- des règles réinventées inutilement ;
- des choix arbitraires remplaçables par des principes mieux établis ;
- des tests qui mesurent principalement une capacité native du LLM ;
- des mécanismes corrects qu’il suffit au contraire de confirmer et conserver.

Ordre initial d’audit :

1. **G0-A1 — croyance et provenance** ;
2. **G0-A2 — première hypothèse sur soi** ;
3. **G0-A3 — mémoire épisodique minimale**.

L’audit ne justifie pas un refactor automatique.

Une modification du code ou de l’architecture n’est effectuée que si l’audit identifie un gain concret et compatible avec les décisions déjà validées.

---

## 8. Principe de simplicité

La présence d’un mécanisme plus sophistiqué dans un autre système ne constitue pas une raison suffisante pour l’adopter.

Entre deux solutions répondant correctement au besoin, Lenoseed privilégie celle qui est :

- la plus simple ;
- explicite ;
- testable ;
- traçable ;
- indépendante autant que raisonnable d’un fournisseur de LLM ;
- compatible avec l’évolution future vers la persistance individuelle et la transmission intergénérationnelle.

Cette méthode sert donc à **réutiliser de la connaissance existante**, pas à importer de la complexité.

---

## 9. Décision retenue

À partir de ce document, avant de concevoir un nouveau mécanisme cognitif ou identitaire important de Lenoseed :

1. vérifier l’existant du dépôt ;
2. rechercher les principes analogues déjà connus ;
3. distinguer clairement faits publics, observations et hypothèses ;
4. sélectionner le principe minimal pertinent ;
5. l’adapter aux invariants de Lenoseed ;
6. définir les tests qui démontrent l’apport propre du moteur ;
7. seulement ensuite décider d’implémenter, modifier ou conserver l’existant.

Cette procédure devient la méthode par défaut pour la suite du développement du moteur Lenoseed.
