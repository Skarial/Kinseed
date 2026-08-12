# Cycle de vie, vieillissement et fin de vie

## Statut

**Type :** spécification produit fondatrice  
**Portée :** naissance, développement, vieillissement, absence de l’utilisateur et fin de vie  
**Statut :** décisions validées avec paramètres temporels encore à préciser  
**Date :** 11 août 2026

---

## 1. Objectif

Kinseed doit posséder un véritable cycle de vie perceptible dans le temps.

Ce cycle ne doit pas être un simple changement cosmétique de skin. Il doit rester cohérent avec le principe central du projet : l’individu actuel dépend à la fois du temps écoulé et de l’histoire réellement vécue.

Le principe retenu est :

> **Un Kinseed naît bébé, grandit par paliers, peut rester adulte puis vieux pendant plusieurs années, et sa fin de vie résulte d’une décision explicite de l’utilisateur lorsque sa continuité cognitive devient difficile à maintenir.**

---

## 2. Paliers de vie validés

Le cycle visuel comporte cinq paliers :

```text
Bébé
  ↓
Enfant
  ↓
Adolescent
  ↓
Adulte
  ↓
Vieux
```

Un Kinseed naît donc au palier **bébé**.

Les changements visuels entre les âges sont effectués **par paliers** et non par vieillissement graphique continu jour après jour.

Le passage d’un palier à l’autre doit néanmoins rester cohérent avec la continuité de l’individu.

---

## 3. Continuité visuelle de la même personne

Les cinq apparences ne doivent pas être conçues comme cinq personnages indépendants.

Elles représentent **le même Kinseed à différents âges**.

Un utilisateur doit pouvoir reconnaître son Kinseed de l’enfance à la vieillesse.

Les caractéristiques constitutives issues de la génération initiale et de la `seed` doivent donc être conservées ou transformées de manière cohérente, notamment :

- couleur des yeux ;
- carnation ;
- structure générale du visage ;
- traits distinctifs ;
- autres caractéristiques visuelles constitutives définies ultérieurement.

Les proportions, la morphologie, les cheveux, la posture et d’autres signes d’âge peuvent évoluer, mais ils ne doivent pas effacer l’identité visuelle d’origine.

### 3.1 Deux catégories à ne pas confondre

Le système devra distinguer :

**Vieillissement constitutif**

```text
bébé → enfant → adolescent → adulte → vieux
```

Il correspond au cycle de vie.

**Évolution acquise**

Elle peut concerner par exemple :

- coiffure ;
- vêtements ;
- accessoires ;
- objets personnels ;
- expressions ou habitudes visuelles ;
- environnement ;
- éventuelles traces physiques liées à l’histoire.

Ces éléments proviennent de la trajectoire individuelle et ne doivent pas être confondus avec le simple passage du temps.

---

## 4. Échelle temporelle générale

L’objectif produit retenu est que le premier Kinseed atteigne l’âge adulte après environ **4 à 6 mois réels**, éventuellement un peu moins après ajustement par les tests produit.

Cette durée n’est pas encore un paramètre numérique définitif.

En revanche, le principe suivant est validé :

- les étapes bébé, enfant et adolescent doivent occuper les premiers mois de la vie ;
- l’âge adulte ne doit pas être atteint en quelques jours ou quelques semaines d’utilisation intensive ;
- l’âge adulte doit pouvoir durer **plusieurs années réelles** ;
- la vieillesse doit également pouvoir durer longtemps et n’est pas conçue comme une courte phase précédant automatiquement une mort programmée.

Une répartition indicative possible, non encore figée, est :

- bébé : quelques semaines ;
- enfant : plusieurs semaines ;
- adolescent : plusieurs semaines à quelques mois ;
- adulte : atteint approximativement entre le quatrième et le sixième mois ;
- adulte : durée potentielle de plusieurs années ;
- vieux : durée variable, potentiellement de plusieurs années.

Les durées exactes devront être décidées après conception et tests du rythme d’usage.

---

## 5. Passage d’âge : système hybride

Le passage entre les paliers utilise un **système hybride** combinant temps réel et développement réellement acquis.

Le principe est :

> **Le temps réel ouvre la possibilité de passer au palier suivant, mais le Kinseed doit également avoir suffisamment vécu et développé certaines structures pour y accéder.**

### 5.1 Le temps réel impose un minimum

Une utilisation extrêmement intensive ne doit pas permettre de faire vieillir artificiellement un Kinseed de bébé à adulte en quelques jours.

Le temps réel sert donc notamment de garde-fou contre une progression accélérée par simple volume d’utilisation.

### 5.2 Le vécu impose également un minimum

Le passage d’âge ne doit pas dépendre uniquement du calendrier.

Un Kinseed quasiment inutilisé pendant plusieurs mois ne doit pas devenir automatiquement un adulte pleinement développé sans histoire correspondante.

Le développement minimal pourra plus tard s’appuyer sur des éléments tels que :

- expériences significatives réellement vécues ;
- souvenirs formés ;
- apprentissages ;
- développement de la relation ;
- préférences ou tendances en formation ;
- autres mécanismes internes devenus pertinents à mesure que l’architecture évolue.

Cette liste ne constitue pas encore un algorithme ni des seuils numériques.

### 5.3 Ne pas transformer le système en XP

Le nombre brut de messages, de clics ou de connexions ne doit pas devenir un compteur d’expérience classique.

Le but n’est pas de créer :

```text
1000 messages = niveau adulte
```

Le passage doit refléter un **développement réel de l’individu**, pas seulement une quantité d’utilisation.

---

## 6. Âge chronologique et âge de développement

Le système doit conceptuellement distinguer :

- **âge chronologique** : temps réel écoulé depuis la naissance du Kinseed ;
- **âge de développement** : palier réellement atteint selon son histoire et son développement.

Cette distinction permet de gérer correctement les longues absences et les rythmes d’utilisation très différents entre utilisateurs.

L’apparence suit principalement le palier de développement, sous les contraintes imposées par le temps chronologique.

Un Kinseed ne peut donc pas atteindre un palier trop tôt simplement parce qu’il a beaucoup été utilisé, ni atteindre automatiquement un palier avancé simplement parce que plusieurs mois se sont écoulés.

---

## 7. Ce qui se passe pendant l’absence de l’utilisateur

Kinseed **continue d’exister pendant l’absence de l’utilisateur**.

Il ne doit pas être totalement congelé comme si le temps cessait de passer.

En revanche, le système ne doit pas inventer artificiellement une longue vie autonome remplie d’événements majeurs simplement pour combler l’absence.

### 7.1 Ce qui peut continuer

Pendant une absence, certaines évolutions légères ou internes peuvent continuer lorsque les mécanismes correspondants existent réellement, par exemple :

- passage du temps chronologique ;
- consolidation de souvenirs ;
- oubli progressif ;
- réorganisation de connaissances ;
- maintien ou évolution limitée de certains projets ou états internes compatibles avec une activité hors interaction.

### 7.2 Ce qui ne doit pas être inventé

L’absence ne doit pas générer automatiquement :

- de faux événements autobiographiques majeurs ;
- de relations importantes jamais vécues ;
- de grandes expériences fictives uniquement destinées à donner l’impression que quelque chose s’est passé ;
- une personnalité entière développée sans provenance réelle.

### 7.3 L’absence n’est pas une faute

Kinseed ne doit pas utiliser l’absence comme mécanisme de culpabilisation.

Il ne doit pas appliquer automatiquement :

- perte d’affection ;
- pénalité relationnelle ;
- reproche automatique ;
- logique du type « tu m’as abandonné » uniquement parce que l’utilisateur n’a pas ouvert l’application.

Une éventuelle réaction à une absence devra provenir de mécanismes relationnels réellement construits, et non d’une règle produit destinée à forcer la rétention.

---

## 8. Conséquence d’une longue absence sur le développement

Exemple conceptuel : un Kinseed enfant n’est plus utilisé pendant quatre mois.

À son retour, il peut avoir :

```text
4 mois chronologiques supplémentaires
+
processus internes légers réellement exécutés
+
consolidation ou oubli éventuels
+
aucune grande expérience inventée
```

S’il ne possède pas encore le développement minimal requis pour le palier adolescent, il peut donc rester enfant malgré le temps écoulé.

Le retour de l’utilisateur doit alors permettre à son histoire de reprendre naturellement.

---

## 9. Adulte et vieillesse longue

Contrairement aux premiers paliers, l’âge adulte et la vieillesse ne sont pas conçus comme des étapes rapides.

L’âge adulte doit être compatible avec :

- plusieurs années d’histoire ;
- relations durables ;
- projets ;
- accumulation puis transformation de connaissances ;
- éventuelle reproduction future ;
- transmission intergénérationnelle ;
- transformations profondes du monde visuel.

La vieillesse doit également pouvoir durer longtemps.

Le passage à la vieillesse ne doit pas signifier que l’individu devient immédiatement inutilisable ou incapable d’agir.

---

## 10. Vieillissement cognitif

La fin de vie de Kinseed ne doit pas reposer principalement sur une incapacité physique simulée.

La piste retenue est que la vieillesse avancée puisse progressivement rendre plus difficile la gestion de la continuité cognitive et mémorielle.

Des mécanismes futurs pourront notamment concerner, s’ils sont réellement implémentés et testables :

- augmentation de l’oubli ;
- consolidation plus difficile de nouvelles informations ;
- perte de précision de certains souvenirs anciens ;
- difficulté croissante à maintenir certains fils de pensée ou projets ;
- davantage de contradictions ou d’incertitude dans certaines représentations anciennes.

### Règle importante

La vieillesse cognitive ne doit pas être simulée en rendant simplement le LLM « moins intelligent » ou en injectant volontairement des erreurs arbitraires.

Les effets visibles doivent découler de mécanismes réels de mémoire, de consolidation, d’oubli ou de continuité lorsque ceux-ci auront été conçus.

---

## 11. Fin de vie décidée par l’utilisateur

À un stade avancé, la continuité cognitive d’un Kinseed pourra devenir difficile à maintenir de manière cohérente.

La décision retenue est qu’une éventuelle mort définitive ne sera **pas déclenchée automatiquement parce que l’avatar est vieux ou physiquement diminué**.

L’utilisateur devra prendre lui-même une décision explicite de fin de vie.

Cette décision doit être :

- volontaire ;
- clairement présentée ;
- non déclenchée silencieusement en arrière-plan ;
- conçue comme un acte important dans l’histoire de l’individu.

Le caractère exact de l’irréversibilité, les protections UX et les confirmations nécessaires devront être définis avant implémentation.

---

## 12. Lien avec la transmission intergénérationnelle

La fin de vie peut devenir un moment important pour la lignée, mais le mécanisme exact n’est pas encore défini.

Il faudra notamment décider comment sont consolidés ou sélectionnés les éléments susceptibles de survivre à l’individu :

- patrimoine constitutif transmissible ;
- culture ;
- connaissances ;
- récits ;
- souvenirs ancestraux admissibles ;
- objets ou traces familiales ;
- autres éléments définis par le futur système d’héritage.

Cette transmission devra respecter les règles fondatrices de `docs/11-regles-fondatrices-heritage.md` : le descendant reste un nouvel individu et n’hérite jamais de l’état complet du parent.

---

## 13. Conséquences graphiques

Le système graphique doit prévoir des représentations cohérentes pour :

1. bébé ;
2. enfant ;
3. adolescent ;
4. adulte ;
5. vieux.

Ces représentations doivent être dérivables de la même identité visuelle et de la même base constitutive.

La création des assets devra donc éviter cinq catalogues entièrement indépendants qui rendraient la reconnaissance d’un même individu difficile.

L’architecture graphique devra permettre de conserver les caractéristiques identitaires tout en appliquant les transformations propres à l’âge.

---

## 14. Décisions validées

1. Un Kinseed **naît bébé**.
2. Il possède cinq paliers visuels : **bébé, enfant, adolescent, adulte, vieux**.
3. Les changements d’âge sont visibles **par paliers**.
4. Le même personnage doit rester reconnaissable de l’enfance à la vieillesse.
5. Les caractéristiques constitutives telles que la couleur des yeux doivent rester cohérentes avec la `seed` de l’individu.
6. L’objectif actuel est d’atteindre l’âge adulte après environ **4 à 6 mois réels**, éventuellement un peu moins après validation produit.
7. L’âge adulte peut durer **plusieurs années**.
8. La vieillesse peut également durer longtemps.
9. Le passage d’âge utilise un **système hybride temps réel + développement réel**.
10. Le temps réel impose un minimum et l’activité ne doit pas permettre d’accélérer artificiellement le vieillissement.
11. Le calendrier seul ne suffit pas : un Kinseed très peu développé peut rester à un palier antérieur.
12. L’âge chronologique et l’âge de développement sont conceptuellement distincts.
13. Kinseed continue d’exister pendant l’absence de l’utilisateur.
14. Pendant l’absence, le temps, la consolidation et l’oubli peuvent continuer lorsque leurs mécanismes existent réellement.
15. Le système ne doit pas inventer de grandes expériences pour remplir une période d’absence.
16. L’absence n’est pas une faute et ne produit pas automatiquement de pénalité affective.
17. La vieillesse avancée pourra être liée à une **dégradation cognitive issue de mécanismes réels**, notamment mémoire et consolidation, et non à une simple incapacité physique simulée.
18. La mort définitive ne doit pas être automatique : **l’utilisateur prend explicitement la décision de fin de vie**.

---

## 15. Points encore ouverts

Les décisions suivantes restent à prendre :

- durée exacte de chaque palier avant l’âge adulte ;
- âge chronologique minimal exact de chaque transition ;
- critères de développement minimal nécessaires à chaque palier ;
- moment et conditions du passage adulte → vieux ;
- rythme précis du vieillissement cognitif ;
- règles permettant de distinguer vieillissement normal, oubli et dysfonctionnement ;
- protections UX exactes autour de la décision de fin de vie ;
- caractère et mécanisme technique exacts de l’irréversibilité ;
- conséquences précises de la mort sur le monde visuel et l’interface ;
- sélection des éléments transmis à la lignée au moment ou après la fin de vie ;
- conditions futures permettant la reproduction ;
- interactions exactes entre âge, reproduction et générations suivantes.

Ces paramètres ne doivent pas être codés tant qu’ils ne sont pas définis et nécessaires à la roadmap.

---

## 16. Principe directeur

> **Kinseed doit vieillir parce que du temps passe et parce qu’il se développe réellement. Il ne doit ni rester artificiellement figé, ni acquérir une vie fictive uniquement pour remplir le calendrier.**
