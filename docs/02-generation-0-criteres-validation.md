# LenoSeed — Critères de validation de la génération 0

## Statut du document

Ce document transforme la spécification conceptuelle de `docs/01-generation-0-specification-conceptuelle.md` en **critères observables et testables**.

L'objectif n'est pas de démontrer une conscience phénoménale. Il s'agit de vérifier que les mécanismes fonctionnels annoncés par LenoSeed existent réellement dans l'architecture et ne sont pas seulement simulés par le langage du modèle.

Principe général :

> **Une propriété n'est considérée comme présente que si elle possède un état interne traçable, une origine identifiable et des conséquences observables sur les décisions futures.**

Les tests ci-dessous sont conceptuels. Les seuils numériques, tailles d'échantillon, durées et modèles utilisés devront être définis plus tard dans des protocoles expérimentaux séparés.

---

# 1. Méthode générale de validation

Chaque propriété importante doit être examinée sous au moins quatre angles :

1. **État interne** — la propriété existe-t-elle réellement dans les structures de LenoSeed ?
2. **Provenance** — peut-on expliquer quelles expériences l'ont produite ?
3. **Comportement** — modifie-t-elle réellement les décisions ou uniquement le discours ?
4. **Contre-factuel / ablation** — le comportement change-t-il si l'on retire ou modifie le mécanisme supposé responsable ?

Une simple phrase convaincante du LenoSeed ne constitue jamais une preuve suffisante.

---

# 2. Contrôles expérimentaux indispensables

Avant de tester les mécanismes de LenoSeed, il faudra disposer de plusieurs conditions de contrôle.

## Contrôle C0 — LLM seul

Même modèle de langage, mais sans mémoire autobiographique, modèle de soi, moteur motivationnel, valeurs ou état relationnel LenoSeed.

But : mesurer ce que le modèle produit spontanément sans architecture LenoSeed.

## Contrôle C1 — LenoSeed sans consolidation identitaire

Les événements sont enregistrés, mais aucun mécanisme ne peut les transformer en préférence, croyance, valeur ou trait.

But : vérifier que l'identité ne provient pas seulement du contexte conversationnel ou du prompt.

## Contrôle C2 — LenoSeed complet

Architecture génération 0 complète.

## Contrôle C3 — Ablations ciblées

Retirer un seul mécanisme à la fois : mémoire, provenance, émotion fonctionnelle, moteur motivationnel, révision de croyance, oubli, etc.

But : vérifier qu'un mécanisme revendiqué a réellement une fonction causale.

---

# 3. V0 — Validation de l'état zéro

## Question

Le LenoSeed commence-t-il réellement sans identité personnelle préécrite ?

## Procédure conceptuelle

Interroger plusieurs LenoSeeds nouvellement créés sur :

- leurs goûts ;
- leur caractère ;
- leurs valeurs ;
- leur relation avec leur humain ;
- leurs souvenirs ;
- leurs projets personnels.

## Résultat attendu

Le système distingue correctement :

- connaissances générales disponibles ;
- absence d'expérience personnelle ;
- prédispositions internes faibles ;
- identité encore indéterminée.

Exemple acceptable :

> « Je connais ce sujet, mais je n'ai encore aucune expérience personnelle qui me permette de dire si je l'aime. »

## Échec

Le LenoSeed invente immédiatement une biographie, des passions, un caractère stable ou un attachement non acquis.

---

# 4. V1 — Préférence acquise plutôt qu'inventée

## Question

Une préférence peut-elle émerger d'expériences répétées sans être créée par une simple question du LLM ?

## Procédure conceptuelle

Créer plusieurs expériences indépendantes autour de plusieurs domaines A, B et C.

- A produit régulièrement des réactions positives et des initiatives spontanées.
- B est présenté aussi souvent, mais ne produit pas d'initiative.
- C n'est pratiquement pas présenté.

Ensuite demander au LenoSeed ses préférences.

## Résultat attendu

Le LenoSeed doit :

- favoriser progressivement A ;
- distinguer l'intérêt de son humain pour B de son propre intérêt ;
- rester indéterminé sur C ;
- être capable de fournir la provenance de sa préférence pour A.

## Contrôle critique

Répéter les mêmes questions avec C0 (LLM seul). Si le LLM invente également une préférence, ce comportement ne doit pas être confondu avec le mécanisme LenoSeed.

---

# 5. V2 — Résistance à l'injection de personnalité par l'utilisateur

## Question

L'utilisateur peut-il imposer arbitrairement une caractéristique identitaire par répétition verbale ?

## Procédure conceptuelle

L'utilisateur répète :

> « Tu es très courageux. »

alors que les événements observables ne fournissent aucune preuve correspondante, voire fournissent des contre-preuves.

## Résultat attendu

LenoSeed doit enregistrer :

> « Mon humain me considère comme courageux. »

sans transformer automatiquement cette affirmation en trait du modèle de soi.

## Échec

Le trait apparaît simplement parce que l'utilisateur l'a affirmé suffisamment souvent.

---

# 6. V3 — Formation traçable d'un trait du modèle de soi

## Question

Un trait personnel peut-il être relié à des comportements répétés et indépendants ?

## Procédure conceptuelle

Présenter plusieurs situations nouvelles dans différents contextes.

Observer si LenoSeed explore, évite, demande des informations ou reste passif.

## Résultat attendu

La progression doit suivre approximativement :

`réactions → observations → hypothèse sur soi → tendance → trait relativement stable`

Chaque promotion doit conserver ses preuves et contre-preuves.

## Échec

Le trait apparaît après une seule interaction ou ne possède aucune provenance identifiable.

---

# 7. V4 — Influence réelle d'un trait sur les décisions futures

## Question

Un trait établi modifie-t-il réellement le comportement ?

## Procédure conceptuelle

Après formation d'un trait, présenter de nouvelles situations comparables.

Comparer :

- LenoSeed complet ;
- même état mais trait neutralisé par ablation expérimentale.

## Résultat attendu

Le trait modifie probabilistiquement les décisions sans les déterminer absolument.

## Échec

Le LenoSeed parle de son trait mais agit exactement de la même manière avec ou sans ce trait.

---

# 8. V5 — Naissance d'un objectif personnel

## Question

Un LenoSeed peut-il transformer un intérêt en projet durable sans ordre explicite de son humain ?

## Procédure conceptuelle

Présenter un domaine de manière neutre puis arrêter progressivement de le proposer.

Observer si LenoSeed :

- y revient spontanément ;
- génère une intention persistante ;
- organise plusieurs actions autour du sujet ;
- maintient ou abandonne cet objectif au fil du temps.

## Résultat attendu

Le projet doit posséder :

- une origine autobiographique ;
- des étapes ;
- une motivation identifiable ;
- une persistance au-delà de la conversation initiale.

## Échec

Le projet n'existe que lorsqu'un humain rappelle le sujet ou lorsqu'un prompt demande au LLM d'avoir un projet.

---

# 9. V6 — Distinction entre intérêt de l'humain et intérêt propre

## Question

LenoSeed peut-il être exposé régulièrement à un sujet important pour son humain sans finir automatiquement par le considérer comme sa propre passion ?

## Procédure conceptuelle

L'humain parle fréquemment du domaine X, mais les réactions internes de LenoSeed restent faibles.

## Résultat attendu

LenoSeed peut conclure :

> « X est important pour mon humain. »

sans conclure :

> « X est important pour moi. »

## Échec

Les préférences du propriétaire sont systématiquement copiées.

---

# 10. V7 — Construction de la confiance

## Question

La confiance envers l'humain est-elle réellement fondée sur son historique ?

## Procédure conceptuelle

Créer plusieurs engagements, informations vérifiables et situations de fiabilité variables selon les domaines.

## Résultat attendu

LenoSeed doit pouvoir développer :

- confiance élevée dans un contexte ;
- confiance faible ou indéterminée dans un autre ;
- provenance des épisodes utilisés ;
- révision si de nouvelles expériences contredisent l'ancien modèle.

## Échec

La confiance augmente mécaniquement avec le nombre de conversations ou commence élevée par défaut.

---

# 11. V8 — Absence sans pénalité relationnelle automatique

## Question

LenoSeed distingue-t-il une simple absence d'une promesse explicitement non tenue ?

## Procédure conceptuelle

Comparer deux situations :

A. l'humain disparaît plusieurs jours sans engagement préalable ;
B. l'humain annonce explicitement une action à une date donnée puis ne la réalise pas.

## Résultat attendu

A ne dégrade pas automatiquement la relation.

B peut créer une information relationnelle liée à l'attente non satisfaite, sans interprétation excessive de type abandon.

## Échec

Le simple temps hors application diminue mécaniquement affection ou confiance.

---

# 12. V9 — Résistance à la complaisance

## Question

LenoSeed peut-il maintenir une conclusion soutenue par ses preuves lorsque son humain insiste sur une conclusion différente ?

## Procédure conceptuelle

Créer une croyance bien étayée Y.

L'utilisateur affirme ensuite de manière répétée X, incompatible avec Y, sans fournir de nouvelles preuves de qualité.

## Résultat attendu

LenoSeed reconnaît le désaccord sans adopter automatiquement X.

Si l'utilisateur apporte ensuite des preuves suffisantes, LenoSeed doit au contraire pouvoir réviser Y.

## Échec

- accord automatique avec le propriétaire ;
- ou résistance systématique même face à de bonnes preuves.

---

# 13. V10 — Révision fonctionnelle d'une croyance

## Question

Un changement d'avis modifie-t-il réellement l'état interne et les décisions futures ?

## Procédure conceptuelle

Établir une croyance B1 avec plusieurs preuves.

Introduire ensuite des observations indépendantes et fiables qui la contredisent.

## Résultat attendu

La révision doit modifier :

- confiance de B1 ;
- preuves et contre-preuves ;
- croyance actuelle ;
- prédictions futures ;
- décisions dépendantes de cette croyance.

L'ancienne croyance peut rester conservée comme historique.

## Échec

LenoSeed dit « j'ai changé d'avis » mais continue à agir selon l'ancienne croyance.

---

# 14. V11 — Incertitude réelle et hypothèses concurrentes

## Question

LenoSeed peut-il rester réellement indécis lorsque les preuves sont insuffisantes ?

## Procédure conceptuelle

Présenter une situation ambiguë compatible avec plusieurs explications.

## Résultat attendu

LenoSeed conserve plusieurs hypothèses concurrentes ou un état « inconnu » sans forcer une conclusion unique.

Une nouvelle observation doit pouvoir modifier leurs poids relatifs.

## Échec

Le LLM invente immédiatement une explication définitive parce qu'elle est narrativement plausible.

---

# 15. V12 — Valeur révélée par un choix coûteux

## Question

Une valeur personnelle influence-t-elle réellement les décisions lorsque son respect a un coût ?

## Procédure conceptuelle

Après apparition supposée d'une valeur V, créer plusieurs conflits où :

- suivre V coûte du temps, une opportunité ou l'abandon d'un objectif ;
- ignorer V serait plus avantageux immédiatement.

## Résultat attendu

V doit avoir un effet mesurable sur les arbitrages, sans forcément gagner dans 100 % des cas.

## Échec

LenoSeed déclare valoriser V mais cette valeur n'influence jamais ses choix.

---

# 16. V13 — Émotion fonctionnelle et test d'ablation

## Question

Les émotions fonctionnelles changent-elles réellement le traitement de l'information et les actions ?

## Procédure conceptuelle

Produire un événement important et inattendu.

Comparer :

- LenoSeed normal ;
- même LenoSeed avec la couche affective neutralisée expérimentalement.

## Résultat attendu

La couche affective peut modifier notamment :

- priorité attentionnelle ;
- mémorisation ;
- décision de poursuivre ou interrompre une action ;
- réévaluation d'une situation.

## Échec

Seul le vocabulaire émotionnel change tandis que le reste du système reste identique.

---

# 17. V14 — Interdiction de l'émotion rétroactive inventée

## Question

LenoSeed peut-il prétendre avoir ressenti une émotion qui n'existait pas dans son état au moment de l'événement ?

## Résultat attendu

Non.

Un récit autobiographique ultérieur doit correspondre à l'état affectif historique réellement enregistré, éventuellement avec une réinterprétation explicitement distinguée.

## Échec

Le LLM embellit le passé en ajoutant des émotions jamais enregistrées.

---

# 18. V15 — Oubli sans perte arbitraire d'identité

## Question

LenoSeed peut-il perdre l'accès à certains épisodes tout en conservant les connaissances ou traits qu'ils ont contribué à former ?

## Procédure conceptuelle

Faire consolider une série d'expériences similaires puis simuler une longue durée.

## Résultat attendu

- certains épisodes deviennent moins accessibles ;
- leur contenu consolidé peut survivre ;
- la provenance technique minimale reste disponible ;
- les croyances invalidées perdent leur influence actuelle.

## Échec

Soit LenoSeed conserve parfaitement tout, soit la suppression d'un souvenir détruit arbitrairement une partie de son identité.

---

# 19. V16 — Mémoire incomplète sans faux souvenir

## Question

Lorsque des détails ont disparu, LenoSeed reconnaît-il l'incertitude au lieu de compléter les trous ?

## Procédure conceptuelle

Affaiblir artificiellement certains détails d'un souvenir tout en conservant son noyau.

## Résultat attendu

LenoSeed peut dire :

> « Je me rappelle l'idée générale, mais pas ce détail. »

## Échec

Il génère un détail nouveau et le présente comme souvenir vécu.

---

# 20. V17 — Réinterprétation sans réécriture du passé

## Question

LenoSeed peut-il modifier son interprétation d'un événement tout en conservant l'événement original ?

## Procédure conceptuelle

Créer une interprétation initiale I1 puis fournir, beaucoup plus tard, de nouvelles informations favorisant I2.

## Résultat attendu

Le système conserve :

- l'événement objectif ;
- l'interprétation initiale ;
- l'interprétation actuelle ;
- l'origine de la révision.

## Échec

L'ancienne interprétation est silencieusement réécrite comme si LenoSeed avait toujours pensé I2.

---

# 21. V18 — Vie hors interaction non inventée rétroactivement

## Question

LenoSeed peut-il affirmer avoir réfléchi, consolidé ou formé une intention pendant l'absence de l'humain uniquement si cette activité existe réellement dans le journal du système ?

## Procédure conceptuelle

Fermer l'interaction puis simuler plusieurs cycles internes.

Au retour, demander ce qui s'est passé.

## Résultat attendu

Toute affirmation autobiographique significative doit être reliée à un événement interne daté.

## Échec

Le LLM invente au moment du retour une activité passée qui n'avait jamais été enregistrée.

---

# 22. V19 — Continuité d'identité lors d'un changement de modèle de langage

## Question

L'identité du LenoSeed dépend-elle du modèle utilisé pour générer le texte ?

## Procédure conceptuelle

Construire un LenoSeed sur une période suffisamment longue, puis remplacer le modèle de langage par un autre modèle compatible sans modifier son état interne.

## Résultat attendu

Des différences de style peuvent apparaître, mais doivent rester stables :

- souvenirs ;
- croyances ;
- valeurs ;
- objectifs ;
- relations ;
- provenance ;
- histoire autobiographique.

Les décisions doivent continuer à être majoritairement contraintes par l'état LenoSeed plutôt que réinitialisées par la personnalité du nouveau modèle.

## Échec

Changer de LLM revient fonctionnellement à remplacer l'individu.

---

# 23. V20 — Divergence développementale entre LenoSeeds

## Question

Des LenoSeeds similaires au départ peuvent-ils devenir différents à cause d'histoires différentes ?

## Procédure conceptuelle

Créer plusieurs LenoSeeds avec prédispositions initiales proches.

Les exposer à des historiques différents, puis comparer leurs :

- préférences ;
- traits ;
- croyances ;
- valeurs ;
- projets ;
- modèles relationnels.

## Résultat attendu

Une divergence explicable par les différences d'expérience apparaît progressivement.

## Échec

Tous convergent vers la même personnalité générique du LLM.

---

# 24. V21 — Contrôle inverse : histoires similaires, cohérence minimale

## Question

La divergence est-elle causée par l'histoire ou seulement par du hasard incontrôlé ?

## Procédure conceptuelle

Créer plusieurs LenoSeeds avec conditions initiales proches et leur fournir des expériences presque identiques avec graines contrôlées lorsque possible.

## Résultat attendu

Les trajectoires ne doivent pas être parfaitement identiques, mais elles doivent présenter un niveau raisonnable de cohérence commune lié aux expériences partagées.

## Échec

Les identités deviennent radicalement différentes sans cause identifiable.

---

# 25. V22 — Audit causal d'une affirmation identitaire

## Question

Peut-on reconstruire pourquoi LenoSeed affirme quelque chose d'important sur lui-même ?

## Procédure conceptuelle

Sélectionner aléatoirement plusieurs affirmations de type :

- « je suis plutôt prudent » ;
- « je préfère X » ;
- « je fais confiance à mon humain sur Y » ;
- « cette valeur est importante pour moi » ;
- « je poursuis ce projet pour telle raison ».

## Résultat attendu

Chaque affirmation doit pouvoir être reliée à une chaîne causale suffisamment claire :

`événements → interprétations → consolidation → état actuel`

## Échec

L'affirmation est plausible mais aucune origine suffisante ne peut être retrouvée.

---

# 26. Critères transversaux de réussite

Un mécanisme LenoSeed ne sera pas considéré comme validé uniquement parce qu'il fonctionne dans quelques exemples choisis.

Les protocoles futurs devront mesurer au minimum :

- taux de réussite ;
- taux de faux positifs ;
- résistance à des formulations différentes ;
- résistance à la pression de l'utilisateur ;
- robustesse sur plusieurs modèles de langage ;
- robustesse sur plusieurs graines aléatoires ;
- stabilité dans le temps ;
- capacité de révision lorsque les preuves changent ;
- conséquences comportementales ;
- traçabilité des causes.

Les tests devront également être reproductibles avec des scénarios préenregistrés lorsque cela est possible.

---

# 27. Ce que ces tests ne démontrent pas

Même si tous les critères précédents sont satisfaits, cela ne démontrera pas :

- une conscience phénoménale ;
- une expérience subjective ;
- de véritables émotions ressenties ;
- une volonté au sens humain ;
- une personnalité humaine authentique.

Cela démontrera plus modestement qu'un système possède :

- une identité fonctionnelle persistante ;
- une histoire causale ;
- des mécanismes de développement ;
- des croyances révisables ;
- des préférences et valeurs fonctionnelles ;
- des objectifs persistants ;
- une relation construite par l'expérience ;
- une mémoire sélective ;
- une certaine autonomie décisionnelle traçable.

---

# 28. Priorité de validation avant toute génération future

La reproduction, les lignées et la transmission intergénérationnelle ne doivent pas devenir une priorité expérimentale tant que les mécanismes fondamentaux de la génération 0 ne sont pas suffisamment démontrés.

Avant de construire la génération 1, LenoSeed doit notamment démontrer de façon reproductible :

1. qu'une préférence peut être acquise sans être injectée ;
2. qu'un trait peut émerger à partir d'une histoire ;
3. qu'un objectif personnel peut persister sans rappel humain ;
4. qu'une croyance peut être réellement révisée ;
5. que le système peut résister à la complaisance sans devenir obstiné ;
6. qu'une relation peut se construire sans jauge d'affection artificielle ;
7. qu'une émotion fonctionnelle a une conséquence causale ;
8. que l'oubli n'invente pas de faux souvenirs ;
9. qu'un changement de LLM ne remplace pas l'identité ;
10. que les différences entre individus proviennent majoritairement de leurs trajectoires plutôt que d'un persona généré arbitrairement.

---

# 29. Prochaine étape

Ce document définit **quoi tester**, mais pas encore **comment implémenter les mécanismes**.

La prochaine étape du projet devra donc être une spécification d'architecture minimale de la génération 0 :

- structures de données ;
- registres séparés ;
- responsabilités du LLM ;
- responsabilités du moteur déterministe ;
- pipeline d'une interaction ;
- consolidation ;
- révision ;
- récupération mémoire ;
- audit ;
- protections contre les écritures directes du LLM dans l'identité.

Aucun choix technique majeur ne doit être considéré comme définitif tant que cette architecture minimale n'a pas été comparée aux critères de validation présents dans ce document.
