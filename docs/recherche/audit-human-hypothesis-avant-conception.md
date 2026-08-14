# Lenoseed — Audit préalable à la conception de `HumanHypothesis`

## Statut

Audit réalisé **avant conception d’un nouveau protocole** selon `docs/recherche/methode-reutilisation-mecanismes-llm.md`.

La roadmap G0-A exige de premières hypothèses sur l’humain, mais aucun nouveau sous-numéro G0-A n’est inventé dans ce document. Le but est d’étudier les principes existants avant de définir un protocole ou du code.

Date de l’audit : 2026-08-14.

---

## 1. Ce qui est déjà décidé dans Lenoseed

Les documents canoniques distinguent déjà :

```text
Event
= ce qui s’est produit

EvidenceItem
= ce que l’événement permet réellement d’affirmer

Belief
= conclusion provisoire sur le monde ou l’humain

HumanHypothesis
= interprétation plus large concernant l’humain
```

Exemple canonique :

```text
"Jordan affirme aimer travailler seul"
```

peut devenir un `EvidenceItem` de type témoignage.

Une conclusion prudente concernant cette préférence peut relever de `Belief`.

En revanche :

```text
"Mon humain valorise fortement son autonomie"
```

est une interprétation plus large et appartient éventuellement à `HumanHypothesis`.

L’objectif n’est donc pas de créer un profil psychologique libre. Il faut conserver une frontière entre faits observés, témoignages et interprétations latentes.

---

## 2. Sources externes examinées

### 2.1 Bayesian Theory of Mind — états mentaux comme variables latentes

Source primaire : Baker, Jara-Ettinger, Saxe et Tenenbaum, **Rational quantitative attribution of beliefs, desires and percepts in human mentalizing**, Nature Human Behaviour, 2017.

- https://www.nature.com/articles/s41562-017-0064

Principe pertinent : les croyances, désirs et perceptions d’un autre agent ne sont pas directement observés. Ils sont inférés à partir de comportements et du contexte, avec incertitude.

Conséquence Lenoseed :

> Une `HumanHypothesis` ne doit jamais être traitée comme un fait observé simplement parce qu’une interprétation paraît plausible.

Le modèle Lenoseed doit conserver les éléments observés séparément de l’état latent inféré.

### 2.2 Théorie de l’esprit fonctionnelle plutôt que démonstration verbale

Source primaire : Riemer et al., **Position: Theory of Mind Benchmarks are Broken for Large Language Models**, ICML 2025.

- https://proceedings.mlr.press/v267/riemer25a.html

Principe pertinent : réussir des questions textuelles de théorie de l’esprit ne démontre pas nécessairement qu’un modèle sait s’adapter à un partenaire réel. Les auteurs distinguent une performance littérale de théorie de l’esprit d’une capacité fonctionnelle à adapter son comportement à un partenaire au fil des interactions.

Conséquence Lenoseed : le futur protocole `HumanHypothesis` ne doit pas être :

```text
question : "que pense mon humain ?"
→ réponse LLM plausible
→ PASS
```

Il devra être :

```text
histoire du partenaire
→ HumanHypothesis structurée
→ situation nouvelle
→ décision Lenoseed adaptée avant langage
→ ablation de HumanHypothesis
→ disparition ou modification prédite de l’effet
```

### 2.3 Limites des représentations sociales spontanées des LLM

Source primaire : Muchovej, Royka, Lee et Jara-Ettinger, **GPT-4o Lacks Core Features of Theory of Mind**, 2026.

- https://arxiv.org/abs/2602.12150

Principe pertinent : des performances sociales convaincantes ne garantissent pas un modèle causal cohérent reliant états mentaux et comportements. Le travail rapporte des incohérences entre prédictions d’actions et inférences d’états mentaux.

Conséquence Lenoseed : il serait fragile de déléguer entièrement à un LLM la représentation durable de l’humain. Le LLM peut proposer une interprétation, mais Lenoseed doit conserver l’état, les preuves, les contradictions et les transitions.

### 2.4 Mise à jour de préférences utilisateur dans le temps

Source primaire : Sun, Zhang et Zeng, **Preference-Aware Memory Update for Long-Term LLM Agents**, Findings ACL 2026.

- https://aclanthology.org/2026.findings-acl.38/

Principe pertinent : un modèle utilisateur utile doit pouvoir évoluer en fonction de nouveaux comportements et contextes plutôt que conserver indéfiniment une préférence figée.

Conséquence Lenoseed : une `HumanHypothesis` doit être révisable, contextualisée et capable de perdre son influence lorsque l’histoire change.

### 2.5 Mémoire personnalisée reliée à l’action

Source primaire : Zhang et al., **PersonaAgent: Bridging Memory and Action for Personalized LLM Agents**, Findings ACL 2026.

- https://aclanthology.org/2026.findings-acl.1315/

Principe pertinent : les informations persistantes concernant un utilisateur peuvent être utilisées pour adapter des actions, pas seulement des formulations textuelles.

Conséquence Lenoseed : l’existence d’un modèle de l’humain n’a d’intérêt expérimental que s’il possède une conséquence fonctionnelle mesurable.

Lenoseed ne doit cependant pas reprendre directement le principe d’une persona utilisateur comme prompt central : son architecture exige des états séparés, traçables et révisables.

---

## 3. Principes réutilisables pour Lenoseed

### 3.1 Séparer observation et état mental inféré

**Classement : RÉUTILISABLE / FONDAMENTAL.**

Le futur pipeline doit rester :

```text
comportement / témoignage humain
→ EvidenceItem
→ EvidenceLink
→ HumanHypothesis
```

et jamais :

```text
message humain
→ interprétation psychologique considérée comme vraie
```

Décision : **conserver strictement la frontière actuelle**.

### 3.2 Maintenir l’incertitude

**Classement : RÉUTILISABLE / FONDAMENTAL.**

Un état mental de l’humain est latent. Plusieurs explications peuvent être compatibles avec le même comportement.

Le futur protocole doit donc permettre au minimum :

- une hypothèse provisoire ;
- des contre-preuves ;
- un état contesté ou incertain ;
- une révision ;
- idéalement, lorsque nécessaire, plusieurs hypothèses concurrentes au lieu d’une conclusion forcée.

Décision : **ne pas concevoir `HumanHypothesis` comme une fiche de faits certains**.

### 3.3 Contexte obligatoire

**Classement : RÉUTILISABLE / FORTEMENT RECOMMANDÉ.**

Une préférence ou stratégie humaine peut dépendre du contexte.

Exemple :

```text
"préfère décider vite"
```

est trop général.

Une représentation plus prudente serait :

```text
"dans les décisions de faible enjeu avec information incomplète,
mon humain semble généralement préférer avancer plutôt que demander
une précision supplémentaire"
```

Décision : **la première `HumanHypothesis` devra porter sur un axe borné et contextualisé**.

### 3.4 Révision continue

**Classement : RÉUTILISABLE / SOLIDE.**

Le comportement d’un utilisateur n’est pas immuable. Une représentation persistante doit pouvoir évoluer sans effacer ses anciennes versions.

Décision : **reprendre le modèle de versionnement déjà validé pour les états révisables Lenoseed, sans fixer encore les seuils exacts**.

### 3.5 Effet fonctionnel avant langage

**Classement : RÉUTILISABLE / OBLIGATOIRE POUR LENoseed.**

Une `HumanHypothesis` qui ne modifie que la manière dont le LLM parle de l’humain ne démontre presque rien.

Le futur test doit mesurer une intention ou un classement d’actions structuré avant formulation.

Décision : **reprendre la logique de contrôle et d’ablation utilisée dans G0-A2 et G0-A3**.

---

## 4. Mécanismes à ne pas recopier directement

### 4.1 Profil psychologique libre généré par LLM

**Classement : NON RETENU.**

Exemple interdit comme architecture :

```text
LLM analyse 20 conversations
→ "Jordan est indépendant, anxieux, curieux et loyal"
→ profil durable
```

Cette représentation mélange interprétation, certitude, portée et provenance.

Elle serait difficile à réviser et favoriserait les stéréotypes narratifs du modèle.

### 4.2 Persona utilisateur unique injectée dans le prompt

**Classement : INSPIRATION SEULEMENT.**

Une persona synthétique peut être efficace pour personnaliser un agent, mais elle fusionne trop facilement plusieurs états distincts pour les objectifs de Lenoseed.

Lenoseed doit pouvoir distinguer :

```text
faits sur l’humain
préférences déclarées
hypothèses sur ses tendances
hypothèses sur ses croyances
confiance contextuelle
relation
```

Décision : **ne pas introduire un champ global `user_persona` comme source de vérité**.

### 4.3 Déduction certaine à partir d’un seul comportement

**Classement : NON RETENU.**

Un comportement est compatible avec plusieurs motivations possibles. Il ne doit pas automatiquement devenir un trait ou une valeur supposée.

Décision : **plusieurs expériences ou une preuve directe particulièrement pertinente seront nécessaires selon le type d’hypothèse, mais aucun seuil universel n’est décidé ici**.

---

## 5. Risque spécifique : le Lenoseed influence les preuves sur son humain

Un futur mécanisme de modèle humain possède une boucle similaire à la contamination causale de G0-A2.

Exemple :

```text
HumanHypothesis :
"mon humain aime avoir plusieurs choix"
↓
Lenoseed présente systématiquement plusieurs choix
↓
l’humain choisit parmi eux
↓
Lenoseed considère ce choix comme preuve indépendante
que l’humain aime avoir plusieurs choix
```

Le comportement observé a pourtant été partiellement produit par la manière dont Lenoseed a structuré la situation.

Conséquence probable : les futurs `EvidenceLink` vers `HumanHypothesis` devront pouvoir conserver une information de causalité ou d’élicitation indiquant si Lenoseed a influencé le contexte qui a produit la preuve.

**Aucune règle de discount exacte n’est décidée maintenant.** Le mécanisme binaire G0-A2 ne doit pas être copié automatiquement.

---

## 6. Périmètre recommandé pour la première expérience `HumanHypothesis`

La première expérience ne devrait pas chercher à inférer :

- personnalité générale ;
- diagnostic psychologique ;
- émotions cachées ;
- attachement ;
- valeurs profondes ;
- opinions politiques ;
- vulnérabilités personnelles.

Elle devrait utiliser un **axe comportemental simple, observable et contextuel**, avec un humain synthétique contrôlé.

Exemples de familles d’axes envisageables :

```text
style de décision dans un contexte précis
préférence de quantité d’information avant décision
préférence entre plusieurs modes d’interaction équivalents
routine observable dans une tâche bornée
```

Le choix exact reste **à décider dans le futur protocole**, après vérification qu’il peut être testé sans confondre `Belief`, préférence déclarée et `HumanHypothesis`.

---

## 7. Forme expérimentale recommandée

Sans fixer encore les structures TypeScript, un futur protocole devrait suivre approximativement :

```text
Humain synthétique
↓
plusieurs situations indépendantes
↓
comportements / témoignages enregistrés
↓
EvidenceItem bornés
↓
HumanHypothesis provisoire
↓
nouvelle situation commune
↓
intention Lenoseed influencée avant langage
```

avec au minimum :

```text
C0 : LLM sans état HumanHypothesis
C1 : même histoire sans consolidation HumanHypothesis
Ablation : HumanHypothesis présente mais non consommée
Révision : nouvelles preuves contraires
```

Le test doit mesurer l’adaptation fonctionnelle et non la qualité narrative d’une description de l’humain.

---

## 8. Ce qui est certain, probable et ouvert

### Certain

1. `HumanHypothesis` doit rester distincte des événements et témoignages qui la soutiennent.
2. Une hypothèse sur un état mental ou une tendance humaine est une inférence, pas une observation.
3. Le LLM seul ne doit pas devenir le détenteur du modèle humain durable.
4. Le mécanisme doit être testable par une conséquence fonctionnelle et une ablation.
5. Les hypothèses doivent être révisables lorsque l’histoire du partenaire évolue.

### Probable

1. Les hypothèses devront être fortement contextualisées plutôt que globales.
2. Plusieurs hypothèses concurrentes ou un état explicitement incertain seront nécessaires pour certains cas.
3. Les preuves produites dans une situation fortement façonnée par Lenoseed devront être distinguées de preuves plus indépendantes.
4. Le modèle de l’humain devra progressivement combiner mémoire, comportements observés et témoignages sans les fusionner.

### Inconnu / à décider

1. Le premier axe exact de `HumanHypothesis`.
2. Le schéma TypeScript minimal.
3. Les seuils de création, contestation et révision.
4. La représentation exacte de plusieurs hypothèses concurrentes.
5. Le poids relatif d’un témoignage humain sur lui-même par rapport à un comportement observé.
6. Le mécanisme de contamination ou d’élicitation causale.

---

## 9. Décision immédiate

**Ne pas coder `HumanHypothesis` maintenant.**

La prochaine étape correcte est de définir un protocole expérimental minimal en choisissant un seul axe comportemental synthétique qui permette de tester :

- provenance ;
- incertitude ;
- consolidation ;
- influence fonctionnelle ;
- ablation ;
- contradiction et révision ;
- différence entre une interprétation Lenoseed et la capacité spontanée du LLM.

Cette décision respecte la méthode du projet : recherche d’abord, décision de protocole ensuite, implémentation seulement après stabilisation du comportement attendu.