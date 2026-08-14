# Lenoseed — Audit G0-A2 au regard des mécanismes existants

## Statut

Deuxième audit réalisé selon `docs/recherche/methode-reutilisation-mecanismes-llm.md`.

Périmètre : **G0-A2 — première hypothèse sur soi**.

Cet audit ne modifie pas automatiquement le protocole, l’architecture ou le code. Il identifie les principes déjà connus dont Lenoseed peut s’inspirer, les mécanismes réellement spécifiques au projet et les règles expérimentales qui ne doivent pas être généralisées.

Date de l’audit : 2026-08-14.

---

## 1. Problème Lenoseed étudié

G0-A2 teste la chaîne suivante :

```text
intention historique structurée
→ observation comportementale
→ consolidation de plusieurs observations
→ SelfHypothesis provisoire
→ influence sur une intention future
→ possibilité de contestation et de révision
```

Le protocole ajoute plusieurs protections :

- la preuve vient d’une décision structurée réellement enregistrée, pas d’une auto-description textuelle ;
- plusieurs contextes indépendants sont nécessaires ;
- les contre-preuves sont conservées ;
- l’hypothèse reste provisoire et versionnée ;
- son influence est testée avant la formulation linguistique ;
- une ablation permet de vérifier son rôle causal ;
- une action causée par la même hypothèse est marquée comme causalement contaminée et ne peut pas la renforcer comme preuve indépendante pleine.

---

## 2. Sources externes examinées

### 2.1 Generative Agents — observation, réflexion et comportement futur

Source primaire : Park et al., **Generative Agents: Interactive Simulacra of Human Behavior**, UIST 2023.

- ACM : https://doi.org/10.1145/3586183.3606763
- arXiv : https://arxiv.org/abs/2304.03442

Principe pertinent : une architecture d’agent peut conserver des expériences, synthétiser ces expériences en réflexions de plus haut niveau, puis récupérer ces réflexions pour influencer planification et comportement futurs. Les auteurs évaluent aussi l’importance de composants par ablation.

Correspondance Lenoseed :

```text
observations historiques
→ réflexion / abstraction
→ comportement futur
```

est proche de :

```text
behavioral_observation
→ SelfHypothesis
→ intention future
```

La différence importante est que Lenoseed exige une provenance structurée vers les événements, une version durable explicite, des contre-preuves conservées et une séparation stricte entre l’hypothèse et le texte généré.

### 2.2 Reflexion — expérience persistante influençant les décisions suivantes

Source primaire : Shinn et al., **Reflexion: Language Agents with Verbal Reinforcement Learning**, NeurIPS 2023.

- NeurIPS : https://papers.nips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html
- arXiv : https://arxiv.org/abs/2303.11366

Principe pertinent : un agent peut transformer le retour obtenu après ses essais en information persistante et réutiliser cette information lors de décisions ultérieures, sans modifier les poids du modèle.

Correspondance Lenoseed : G0-A2 n’a pas besoin d’entraîner le LLM pour que son histoire influence la suite. L’effet peut être porté par un état externe persistant consommé par le moteur de décision.

Différence : Reflexion stocke principalement une réflexion linguistique destinée à améliorer la performance sur une tâche. Une `SelfHypothesis` Lenoseed représente une interprétation identitaire provisoire et doit donc être soumise à des contraintes de provenance, contestation et révision plus fortes.

### 2.3 Performative Prediction — la représentation peut modifier ce qu’elle observe ensuite

Source primaire : Perdomo et al., **Performative Prediction**, ICML 2020.

- PMLR : https://proceedings.mlr.press/v119/perdomo20a.html
- arXiv : https://arxiv.org/abs/2002.06673

Principe pertinent : lorsqu’une prédiction influence les décisions, elle peut modifier les observations futures sur lesquelles le système serait ensuite réévalué. Cela crée une boucle de rétroaction où les données ne sont plus indépendantes du modèle déployé.

La situation Lenoseed est différente, mais le problème causal est analogue :

```text
SelfHypothesis H
→ H influence décision D
→ D devient observation
→ observation D utilisée pour confirmer H
```

Le mécanisme G0-A2 `causalContamination = influenced_by_target` est donc fondé sur un problème de rétroaction bien réel. En revanche, la règle exacte « compte zéro dans tous les seuils » est une protection conservatrice propre à G0-A2, pas une règle générale dérivée de Performative Prediction.

### 2.4 Self-model explicite dans des agents

Source primaire : Haber et al., **Learning to Play with Intrinsically-Motivated Self-Aware Agents**, 2018.

- arXiv : https://arxiv.org/abs/1802.07442

Principe pertinent : des architectures d’agents ont déjà séparé un modèle du monde d’un modèle explicite décrivant certaines propriétés du fonctionnement propre de l’agent, puis utilisé ce self-model pour modifier son comportement.

Ce travail n’est pas équivalent à l’identité de Lenoseed : son self-model prédit notamment les erreurs d’un world-model. Il constitue néanmoins une preuve de concept qu’un état explicite « sur soi » peut être traité comme une structure fonctionnelle consommée par une politique de décision plutôt que comme une simple phrase produite par le modèle.

---

## 3. Audit mécanisme par mécanisme

### 3.1 `intention_selected` → `behavioral_observation`

**Classement : RÉUTILISABLE / SOLIDE.**

Transformer une expérience enregistrée en observation exploitable est cohérent avec les architectures d’agents fondées sur mémoire et réflexion.

La version Lenoseed est volontairement plus stricte : l’observation copie uniquement l’action structurée qui a réellement été sélectionnée et ne produit pas encore une interprétation psychologique.

Décision : **conserver**.

### 3.2 Plusieurs observations → `SelfHypothesis`

**Classement : À ADAPTER.**

La synthèse d’expériences en représentations de plus haut niveau est déjà utilisée dans les agents à réflexion. L’idée générale n’a donc pas besoin d’être inventée à partir de zéro.

En revanche, Lenoseed ne peut pas reprendre directement une réflexion textuelle générée par un LLM comme identité durable. Il doit conserver sa propre couche structurée et auditée.

Décision : **conserver `SelfHypothesis` comme projection Lenoseed distincte du LLM**.

### 3.3 `SelfHypothesis` → influence sur une décision future

**Classement : RÉUTILISABLE COMME PRINCIPE, À ADAPTER POUR LE PRODUIT.**

Generative Agents et Reflexion montrent tous deux qu’une représentation issue de l’expérience peut être réinjectée dans les décisions futures.

Le mécanisme G0-A2 applique volontairement cette influence de manière déterministe pour permettre une démonstration causale claire.

Important :

> La politique G0-A2 « hypothèse active → action correspondante » ne doit pas devenir la politique générale du futur Lenoseed.

Dans un individu plus complet, une hypothèse sur soi devra probablement être **un facteur parmi plusieurs** : situation actuelle, croyances, objectifs, valeurs, relation, risque, règles système et autres états internes. Une hypothèse sur soi ne doit pas devenir une commande rigide qui force systématiquement le comportement qu’elle décrit.

Décision : **conserver le sélecteur actuel pour l’expérience G0-A2 uniquement ; interdire sa généralisation implicite**.

### 3.4 Ablation de la `SelfHypothesis`

**Classement : RÉUTILISABLE / TRÈS PERTINENT.**

L’ablation est une méthode expérimentale classique pour vérifier qu’un composant contribue réellement au résultat. Generative Agents utilise également des ablations de composants de son architecture.

Le contrôle G0-A2 est particulièrement utile parce qu’il distingue :

```text
hypothèse présente
```

et :

```text
hypothèse réellement consommée et causale
```

Décision : **conserver cette méthode pour les futurs mécanismes importants de Lenoseed lorsque cela est techniquement possible**.

### 3.5 Contamination causale et auto-confirmation

**Classement : PRINCIPE SOLIDE, RÈGLE LOCALE À G0-A2.**

Le risque de boucle est réel : lorsqu’un modèle influence les données futures, traiter ces données comme indépendantes de ce modèle produit une boucle de rétroaction.

Lenoseed a donc raison d’enregistrer la cause de l’intention et de distinguer les observations antérieures indépendantes des comportements produits sous influence d’une `SelfHypothesis`.

Cependant :

```text
causalContamination = influenced_by_target
→ poids de seuil = 0
```

est un choix expérimental conservateur. Dans un futur moteur général, une action influencée par une hypothèse peut encore contenir une information nouvelle ; elle n’est simplement pas équivalente à une preuve indépendante.

Décision : **conserver l’exclusion totale pour G0-A2 ; ne pas en faire une règle universelle sans nouvelle étude**.

### 3.6 Indépendance des contextes

**Classement : RÉUTILISABLE COMME PRINCIPE, HEURISTIQUE LOCALE POUR LE COMPTAGE.**

Éviter que quatre reformulations de la même situation deviennent quatre preuves indépendantes est méthodologiquement nécessaire.

Le champ `independenceGroup` est une solution simple et traçable pour l’expérience actuelle.

Il ne prouve cependant pas une indépendance statistique ou causale générale. Dans la future vie ouverte de Lenoseed, déterminer si deux expériences sont réellement indépendantes demandera un mécanisme plus riche.

Décision : **conserver pour le protocole ; maintenir explicitement sa portée expérimentale**.

### 3.7 Seuil initial `3 supports + 1 contre-preuve`

**Classement : INCONNU / EXPÉRIMENTAL.**

Aucune source examinée ne justifie ce seuil comme règle générale de formation d’une représentation de soi.

Ce seuil reste utile pour produire un protocole déterministe, falsifiable et simple.

Décision : **ne pas le modifier maintenant ; ne jamais le présenter comme une propriété générale du moteur ou de la psychologie numérique**.

### 3.8 Deux contradictions → `disputed`, trois → révision

**Classement : INCONNU / EXPÉRIMENTAL.**

Même conclusion : ces nombres permettent de tester une dynamique de révision, mais ils ne dérivent pas d’une règle universelle reconnue.

À terme, leur remplacement pourrait s’appuyer sur un système plus continu de force d’évidence, diversité de contexte, récence, causalité et contre-preuves. Cette évolution n’est pas nécessaire pour G0-A2 validé.

Décision : **conserver le mécanisme actuel comme fixture de validation, ne pas généraliser**.

### 3.9 Versionnement v1 → v2 → v3 et historique complet

**Classement : RÉUTILISABLE / SOLIDE.**

Cette décision reste compatible avec les principes déjà retenus dans G0-A1 : une révision ne doit pas réécrire l’histoire qui l’a précédée.

Pour Lenoseed, ce choix apporte en plus une propriété essentielle : l’identité courante peut évoluer tout en restant reconstruisible depuis son histoire.

Décision : **conserver**.

---

## 4. Ce que G0-A2 réutilise déjà correctement

L’audit montre que G0-A2 réutilise ou rejoint déjà plusieurs idées éprouvées :

```text
expériences persistantes
→ abstraction de plus haut niveau
→ réutilisation dans une décision future
```

et :

```text
composant supposé causal
→ ablation ciblée
→ disparition attendue de l’effet
```

ainsi que la nécessité de traiter séparément les observations produites sous l’influence du modèle qui sera ensuite évalué.

Le projet n’a donc pas besoin de remplacer G0-A2 par un mécanisme « copié de ChatGPT ». L’approche actuelle est au contraire une version plus explicite et auditée de principes déjà présents dans plusieurs familles d’agents.

---

## 5. Ce qui reste réellement spécifique à Lenoseed

Les éléments suivants constituent la valeur architecturale propre du projet :

- séparer l’événement historique, l’observation et l’interprétation sur soi ;
- empêcher une auto-description du LLM de devenir directement une identité ;
- conserver supports et contre-preuves ;
- versionner les états de soi plutôt que réécrire le passé ;
- rendre les causes des intentions auditables ;
- conserver la continuité lorsque le modèle LLM est remplacé ;
- traiter la représentation de soi comme une partie évolutive de l’histoire de l’individu, et non comme un simple contexte de tâche temporaire.

Ces propriétés sont directement compatibles avec la mission de persistance individuelle de Lenoseed.

---

## 6. Décisions issues de l’audit

### Certain

1. Le principe `expériences → abstraction persistante → influence future` est déjà établi dans des architectures d’agents publiées.
2. L’utilisation d’une ablation pour tester l’effet causal d’un composant est pertinente et doit être conservée.
3. Une boucle où une représentation influence un comportement ensuite utilisé pour confirmer cette même représentation pose un problème réel de rétroaction causale.
4. Le choix de séparer `SelfHypothesis` du texte produit par le LLM reste justifié.

### Probable

1. Dans le futur moteur général, une `SelfHypothesis` devra contribuer à une décision plutôt que la déterminer seule.
2. La contamination causale devra probablement devenir plus nuancée qu’un simple poids nul lorsque Lenoseed sortira du protocole fermé G0-A2.
3. L’indépendance des expériences nécessitera probablement une représentation plus riche que `independenceGroup` dans une vie ouverte.

### Inconnu / à décider plus tard

1. La formule générale permettant de consolider une hypothèse sur soi.
2. Le poids exact d’une preuve influencée causalement.
3. Le nombre, la diversité et la durée d’expériences nécessaires pour passer d’une hypothèse à une tendance ou un trait plus stable.
4. La manière dont plusieurs `SelfHypothesis` de domaines différents interagiront dans une décision réelle.

---

## 7. Conséquence immédiate sur le code

**Aucune modification du code G0-A2 n’est requise par cet audit.**

Le code actuel est une implémentation volontairement bornée d’un protocole déjà validé. Le modifier pour adopter prématurément un modèle plus général détruirait la valeur expérimentale de G0-A2 sans besoin produit immédiat.

La règle à transporter vers les prochaines étapes est plutôt :

> **Ne pas généraliser les seuils, le tie-break, l’influence déterministe ou le discount causal binaire de G0-A2 au futur moteur sans nouvel audit et nouveau protocole.**

---

## 8. Prochaine application recommandée

La méthode doit maintenant être appliquée à **G0-A3 — mémoire épisodique minimale**, car la mémoire des agents LLM est un domaine déjà largement étudié et Lenoseed peut probablement réutiliser davantage de principes existants :

- écriture sélective ;
- récupération par pertinence ;
- récence ;
- importance ;
- consolidation ;
- séparation mémoire brute / abstraction ;
- prévention des souvenirs inventés ;
- rôle causal de la mémoire dans une décision future.

Aucune modification G0-A3 ne doit être décidée avant cet audit.