# Lenoseed — État de l’art

## Statut du document

**Type :** document de recherche, distinct de la documentation d’architecture et des spécifications numérotées de Lenoseed.
**Dernière vérification :** 10 août 2026.  
**Statut :** version initiale, à compléter au fil du projet.

Ce document a pour objectif de situer Lenoseed par rapport aux travaux, systèmes et produits déjà existants ou proches de sa direction de recherche.

Il ne doit pas être utilisé pour affirmer qu’une idée est inédite simplement parce qu’aucun équivalent n’a été trouvé rapidement. Son rôle est au contraire de rechercher activement les antériorités, les ressemblances, les différences et les risques de réinventer un mécanisme déjà connu.

La documentation d’architecture de Lenoseed reste séparée de ce document.

---

# 1. Question étudiée

Lenoseed cherche à construire un **individu numérique persistant** dont l’identité ne correspond pas simplement à un prompt de personnalité ou à l’état temporaire d’un modèle de langage.

Pour la génération 0, le principe central est :

> **Un Lenoseed ne naît pas avec une identité écrite. Il naît avec les mécanismes nécessaires pour en construire une.**

L’identité doit progressivement se former à partir de :

- son histoire ;
- ses expériences ;
- ses souvenirs autobiographiques ;
- ses croyances révisables ;
- ses préférences acquises ;
- ses motivations ;
- ses relations ;
- ses décisions antérieures ;
- les conséquences de ses expériences.

Lenoseed sépare conceptuellement :

- le **LLM**, qui comprend, raisonne et produit du langage ;
- l’**état persistant de l’individu**, qui conserve son histoire et les propriétés durables autorisées par le système.

À plus long terme, le projet prévoit également des lignées numériques dans lesquelles des descendants peuvent recevoir des dispositions, une culture et des informations ancestrales provenant de deux parents, tout en restant de nouveaux individus.

L’état de l’art doit donc examiner plusieurs domaines qui sont souvent étudiés séparément :

1. compagnons IA ;
2. mémoire longue durée pour agents ;
3. agents persistants et personnalisation dynamique ;
4. apprentissage continu et agents auto-évolutifs ;
5. vie artificielle ;
6. évolution et reproduction numériques ;
7. continuité d’identité au-delà d’un modèle de langage ;
8. transmission intergénérationnelle.

---

# 2. Méthode et limites

Cet état de l’art initial repose principalement sur :

- des articles scientifiques ;
- des publications de conférences ou journaux ;
- des pages officielles de projets ;
- la documentation officielle de certains compagnons IA commerciaux.

Trois niveaux doivent être distingués.

## Établi

Un mécanisme ou un système a été identifié dans une source vérifiable.

## Probable

Une différence avec Lenoseed apparaît dans les sources disponibles, mais elle devra être vérifiée plus largement.

## Inconnu

Aucune conclusion solide ne peut encore être formulée.

Cet état de l’art **n’est pas exhaustif**. Il ne constitue donc pas une preuve de nouveauté scientifique ou juridique de Lenoseed.

Les publications récentes, les projets non publiés, les systèmes industriels propriétaires, les brevets et certains travaux non anglophones peuvent contenir des approches proches qui n’ont pas encore été identifiées.

---

# 3. Compagnons IA commerciaux

## 3.1 Replika

Replika se présente comme un compagnon IA personnel capable de développer une relation avec l’utilisateur, de mémoriser des informations et de se personnaliser avec le temps.

Sa documentation décrit notamment :

- une mémoire organisée en plusieurs couches ;
- l’apprentissage progressif de caractéristiques et préférences de l’utilisateur ;
- des mémoires pouvant être ajoutées ou supprimées ;
- différents statuts de relation ;
- une personnalité et des souvenirs qui évoluent avec les interactions.

### Ressemblance avec Lenoseed

- relation durable entre humain et compagnon numérique ;
- mémoire à long terme ;
- personnalisation au fil des interactions ;
- continuité conversationnelle.

### Différence importante

Le but principal documenté est la qualité de la relation et de la personnalisation du compagnon envers l’utilisateur. Lenoseed cherche plus spécifiquement à savoir si un **état interne autonome et traçable** peut produire une identité fonctionnelle différenciée, sans considérer les affirmations du chatbot comme une preuve suffisante.

Références :

- https://help.replika.com/hc/en-us/articles/115001070951-What-is-Replika
- https://help.replika.com/hc/en-us/articles/37208679176077-How-does-Replika-s-memory-work

---

## 3.2 Nomi

Nomi met fortement en avant la mémoire à court, moyen et long terme ainsi que le développement d’une relation continue.

La plateforme permet également de définir une histoire de départ et de personnaliser le compagnon.

### Ressemblance avec Lenoseed

- mémoire persistante ;
- continuité relationnelle ;
- personnalité pouvant évoluer au fil des échanges.

### Différence importante

Lenoseed cherche volontairement à réduire au minimum l’identité préécrite de la génération 0. Une personnalité ou une biographie configurée par l’utilisateur avant l’existence du compagnon est précisément un mécanisme que Lenoseed cherche à éviter pour ses propriétés centrales.

Référence :

- https://nomi.ai/

---

## 3.3 Kindroid

La documentation de Kindroid décrit plusieurs systèmes de mémoire :

- contexte persistant ;
- mémoire à moyen terme ;
- mémoire à long terme récupérable ;
- journal ;
- backstory et informations configurées.

La mémoire longue durée est consolidée automatiquement à partir des conversations.

### Ressemblance avec Lenoseed

- architecture de mémoire en plusieurs couches ;
- consolidation ;
- récupération selon la pertinence ;
- relation persistante.

### Différence importante

Kindroid est avant tout un système de compagnon personnalisable. Sa documentation permet explicitement d’écrire une backstory, des directives et des éléments durables de personnalité. Lenoseed cherche au contraire à empêcher qu’une simple déclaration produite ou écrite devienne automatiquement un trait réel de l’individu.

Référence :

- https://kindroid.ai/docs/article/memory/

---

# 4. Mémoire longue durée pour agents LLM

## 4.1 MemoryBank — 2023

**MemoryBank: Enhancing Large Language Models with Long-Term Memory** propose un mécanisme de mémoire longue durée destiné notamment aux scénarios de compagnonnage et de dialogue prolongé.

Le système peut :

- conserver des souvenirs ;
- mettre à jour la mémoire continuellement ;
- oublier ou renforcer certaines informations ;
- adapter les réponses à la personnalité de l’utilisateur.

Les auteurs présentent également **SiliconFriend**, un chatbot de compagnonnage fondé sur ce système.

### Apport pour Lenoseed

MemoryBank montre qu’une mémoire externe au LLM, avec oubli et renforcement, peut améliorer une relation conversationnelle longue durée.

### Limite par rapport à Lenoseed

Le système cherche principalement à mieux mémoriser l’utilisateur et les interactions. Il ne définit pas à lui seul une architecture complète dans laquelle la personnalité propre de l’agent doit être historiquement justifiée, contrôlée par provenance et testée par ablation.

Référence :

- https://arxiv.org/abs/2305.10250

---

## 4.2 MemGPT / Letta — 2023

**MemGPT: Towards LLMs as Operating Systems** propose une gestion hiérarchique de la mémoire inspirée des systèmes d’exploitation.

L’idée centrale consiste à déplacer intelligemment les informations entre plusieurs niveaux de mémoire afin de dépasser la taille limitée du contexte immédiat du LLM.

Les auteurs montrent notamment des agents conversationnels multi-sessions capables de se souvenir, de réfléchir et d’évoluer au cours d’interactions prolongées.

### Apport pour Lenoseed

MemGPT est une référence importante pour la séparation entre :

- mémoire active ;
- mémoire externe ;
- récupération d’informations ;
- modèle de langage sous-jacent.

### Limite par rapport à Lenoseed

La persistance de mémoire ne constitue pas automatiquement une théorie de l’identité. Lenoseed doit donc éviter d’assimiler « se souvenir de l’historique » à « posséder une identité construite par l’histoire ».

Référence :

- https://arxiv.org/abs/2310.08560

---

# 5. Agents génératifs, mémoire, réflexion et comportement social

## 5.1 Generative Agents — 2023

**Generative Agents: Interactive Simulacra of Human Behavior** est l’un des travaux fondamentaux sur les agents LLM possédant une mémoire d’expériences et des mécanismes de réflexion.

L’architecture contient notamment :

- un journal d’expériences ;
- une récupération dynamique des souvenirs ;
- des réflexions de niveau supérieur ;
- une planification ;
- des interactions entre plusieurs agents.

Les auteurs montrent que l’observation, la planification et la réflexion contribuent toutes au comportement global des agents.

### Ressemblance avec Lenoseed

- expérience stockée ;
- mémoire autobiographique textuelle ;
- synthèse progressive ;
- réflexion ;
- comportement influencé par le passé ;
- interactions sociales émergentes.

### Différence importante

Les Generative Agents sont conçus comme des simulations crédibles de comportements humains dans un environnement de type petite ville. Leurs profils sont initialisés avec des descriptions de personnages. Lenoseed cherche au contraire à étudier la **formation progressive d’une identité qui n’est pas écrite à l’avance**.

Référence :

- https://arxiv.org/abs/2304.03442

---

# 6. Dialogue longue durée et persona dynamique

## 6.1 LD-Agent — 2024

**Hello Again! LLM-powered Personalized Agent for Long-term Dialogue** propose une architecture comprenant :

- perception d’événements ;
- mémoire à court et long terme ;
- extraction de persona ;
- génération de réponse ;
- modélisation dynamique de la persona de l’utilisateur et de l’agent.

### Ressemblance avec Lenoseed

Le fait que la persona de l’agent puisse être reconstruite ou mise à jour à partir de l’historique est directement pertinent pour Lenoseed.

### Différence à vérifier

LD-Agent vise principalement la qualité du dialogue personnalisé. Lenoseed impose des contraintes supplémentaires sur l’origine des traits, la séparation entre déclaration linguistique et état durable, ainsi que la causalité des décisions.

Référence :

- https://arxiv.org/abs/2406.05925

---

## 6.2 PersonaAgent — 2025

PersonaAgent associe :

- mémoire épisodique ;
- mémoire sémantique ;
- persona ;
- actions personnalisées ;
- adaptation à l’utilisateur pendant l’utilisation.

Le système est particulièrement pertinent pour étudier les interactions entre mémoire, persona et décisions.

### Différence importante

La persona reste ici principalement un mécanisme de personnalisation et d’alignement envers l’utilisateur. Lenoseed cherche à permettre une distinction réelle entre :

- ce que l’humain préfère ;
- ce que l’humain croit ;
- ce que le Lenoseed apprend à préférer ;
- ce que le Lenoseed apprend à croire.

Référence :

- https://arxiv.org/abs/2506.06254

---

## 6.3 ZifaMem — 2026

**ZifaMem: Structured Memory for Persona, Preference, and Emotional Continuity in AI Companions** est un travail particulièrement proche du domaine du compagnonnage numérique.

Le système structure la mémoire en :

- résumés de sessions ;
- souvenirs épisodiques ;
- modèle utilisateur consolidé.

Les résultats présentés montrent que la mémoire structurée peut améliorer la continuité de persona et la continuité émotionnelle par rapport à un historique brut.

### Importance pour Lenoseed

Ce travail renforce l’idée qu’une mémoire structurée est plus pertinente qu’une accumulation intégrale de conversations.

Il constitue aussi un avertissement : une partie de ce que Lenoseed pourrait appeler « continuité » peut déjà être obtenue par des mécanismes relativement classiques de mémoire et de récupération. Les expériences de Lenoseed devront donc démontrer ce que son architecture apporte au-delà de cette amélioration conversationnelle.

Référence :

- https://arxiv.org/abs/2607.17564

---

# 7. Apprentissage continu et agents auto-évolutifs

## 7.1 Voyager — 2023

Voyager est un agent autonome dans Minecraft qui :

- explore continuellement ;
- acquiert de nouvelles compétences ;
- conserve une bibliothèque de compétences ;
- utilise les retours de l’environnement et les erreurs pour s’améliorer ;
- transfère ses acquis vers de nouvelles situations.

### Apport pour Lenoseed

Voyager démontre qu’un LLM peut être entouré de mécanismes persistants qui accumulent réellement de l’expérience au lieu de seulement conserver une conversation.

### Différence importante

L’unité principalement accumulée par Voyager est la **compétence utile**. Lenoseed cherche en plus des transformations durables concernant identité, préférences, croyances, valeurs, relations et objectifs.

Référence :

- https://arxiv.org/abs/2305.16291

---

## 7.2 Experience-driven Lifelong Learning — 2025

Le cadre **Experience-driven Lifelong Learning (ELL)** décrit des agents capables de se développer par interaction continue grâce à :

- exploration de l’expérience ;
- mémoire longue durée ;
- apprentissage de compétences ;
- internalisation des connaissances.

### Importance pour Lenoseed

Ce domaine rapproche fortement la recherche sur les agents LLM de l’idée d’un système qui possède une véritable histoire d’apprentissage.

### Différence importante

L’objectif principal reste l’amélioration des capacités et des compétences de l’agent. Lenoseed s’intéresse à la formation d’un individu et à la continuité de son identité, ce qui constitue une question différente même si les mécanismes peuvent se recouvrir.

Référence :

- https://arxiv.org/abs/2508.19005

---

# 8. Continuité d’identité au-delà du LLM

## 8.1 Memory as Ontology / Animesis — 2026

**Memory as Ontology: A Constitutional Memory Architecture for Persistent Digital Citizens** est l’un des travaux actuellement identifiés comme les plus proches de certains principes centraux de Lenoseed.

Le papier défend explicitement l’idée que, pour un agent vivant sur de longues durées :

- la mémoire ne devrait pas être considérée uniquement comme un outil de récupération ;
- l’identité doit pouvoir persister lorsque le modèle sous-jacent est remplacé ;
- le modèle peut être considéré comme un support remplaçable plutôt que comme l’identité elle-même.

Le système proposé, **Animesis**, utilise une architecture de mémoire gouvernée et un cycle de vie destiné à des « citoyens numériques » persistants.

### Ressemblance forte avec Lenoseed

Lenoseed affirme lui aussi que :

> le LLM n’est pas l’identité de l’individu.

Cette proximité doit être prise au sérieux.

### Différences actuellement identifiées

Lenoseed ajoute des questions spécifiques qui ne constituent pas le centre du papier Animesis :

- naissance avec identité minimale plutôt qu’identité déjà constituée ;
- formation historique contrôlée des préférences et croyances ;
- motivations primitives ;
- distinction causale entre motivation, décision et formulation linguistique ;
- tests d’ablation et provenance comme critères de validation ;
- relations construites plutôt que simplement mémorisées ;
- projet de transmission intergénérationnelle avec généalogie, recombinaison et culture.

Ces différences restent à vérifier en profondeur.

Référence :

- https://arxiv.org/abs/2603.04740

---

# 9. Vie artificielle et individuation

## 9.1 OpenLife — 2026

**OpenLife: Toward Open-World Artificial Life with Autonomous LLM Agents** constitue une autre référence particulièrement importante pour Lenoseed.

OpenLife entoure un LLM sans état avec plusieurs processus asynchrones comprenant notamment :

- mémoire ;
- perception ;
- évaluation ;
- mécanismes de persistance ;
- interaction avec un environnement ouvert.

Les auteurs rapportent, sur plusieurs semaines, des phénomènes de :

- passage d’un comportement réactif à une activité plus spontanée ;
- individuation entre agents ;
- structure sociale émergente ;
- actions autonomes dans le monde externe.

Ils restent prudents et ne prétendent pas avoir créé la vie artificielle.

### Ressemblance forte avec Lenoseed

- LLM considéré comme composant d’un système plus large ;
- persistance externe au modèle ;
- individuation par l’expérience ;
- activité qui ne dépend pas uniquement d’une requête humaine immédiate ;
- question de la vie numérique fonctionnelle plutôt que simple conversation.

### Différences actuellement identifiées

Lenoseed se concentre initialement sur une relation individuelle humain ↔ Lenoseed et sur la construction contrôlée d’une identité personnelle. OpenLife étudie davantage des agents autonomes placés dans un monde ouvert et social.

Aucune transmission intergénérationnelle comparable au modèle actuellement prévu par Lenoseed n’a été identifiée dans ce travail.

Référence :

- https://arxiv.org/abs/2606.31046

---

# 10. Vie artificielle classique et évolution numérique

Les idées de naissance, évolution, reproduction, mutation et lignées numériques sont bien antérieures aux LLM.

Lenoseed ne doit donc pas présenter la reproduction numérique comme une idée nouvelle en elle-même.

## 10.1 Tierra

Tierra, développé par Thomas S. Ray, utilise des organismes numériques auto-réplicatifs capables de mutation et soumis à la sélection dans un environnement informatique.

Ce système a montré qu’une population d’entités logicielles pouvait :

- se reproduire ;
- muter ;
- entrer en compétition ;
- produire de nouvelles formes ;
- développer des interactions écologiques.

Références :

- https://tomray.me/pubs/tierra/
- https://www.santafe.edu/research/results/working-papers/evolution-ecology-and-optimization-of-digital-orga

---

## 10.2 Avida

Avida est une plateforme expérimentale de biologie évolutionnaire numérique basée sur des programmes auto-réplicatifs et évolutifs.

Elle permet d’étudier de manière contrôlée :

- mutation ;
- sélection ;
- adaptation ;
- évolution de populations numériques ;
- généalogie et changements de génomes numériques.

### Importance pour Lenoseed

Avida représente une référence méthodologique importante si Lenoseed introduit ultérieurement des mécanismes de variation héréditaire.

Référence :

- https://direct.mit.edu/artl/article/10/2/191/2455/Avida-A-Software-Platform-for-Research-in

---

## 10.3 Evolving Virtual Creatures — Karl Sims, 1994

Karl Sims a montré dès 1994 que des créatures virtuelles pouvaient recevoir :

- une morphologie numérique ;
- des contrôleurs comportementaux ;
- un patrimoine recombiné ;
- des mutations ;
- une sélection ;
- une descendance.

### Importance pour Lenoseed

Ce travail montre que la combinaison de patrimoine parental, mutation et descendance numérique possède une longue histoire en vie artificielle.

La spécificité éventuelle de Lenoseed ne peut donc pas être « des créatures numériques font des enfants ».

Références :

- https://doi.org/10.1145/192161.192167
- https://www.karlsims.com/evolved-virtual-creatures.html

---

# 11. Reproduction et évolution de modèles de langage

## 11.1 Nature-Inspired Population-Based Evolution of Large Language Models — 2025

Ce travail applique explicitement à une population de LLM les notions de :

- parents ;
- crossover ;
- mutation ;
- sélection ;
- succession ;
- création de modèles descendants.

### Ressemblance avec Lenoseed

Le vocabulaire et certains mécanismes de recombinaison peuvent sembler proches de la future reproduction des Lenoseeds.

### Différence fondamentale

L’objectif est d’améliorer les performances d’une **population de modèles de langage** sur des tâches. Les descendants sont des modèles ou configurations héritant de capacités optimisées.

Lenoseed prévoit autre chose : le LLM sous-jacent peut rester un moteur remplaçable tandis que le descendant reçoit un patrimoine constitutif et culturel provenant d’individus numériques persistants.

Référence :

- https://arxiv.org/abs/2503.01155

---

# 12. Comparaison synthétique

| Système / domaine | Mémoire longue durée | Identité / persona persistante | Expérience influençant le futur | Agent autonome | Reproduction / évolution | Transmission culturelle / ancestrale | LLM séparé explicitement de l’identité |
|---|---:|---:|---:|---:|---:|---:|---:|
| Replika | Oui | Oui, au niveau produit | Oui | Limitée | Non identifiée | Non identifiée | Non établi |
| Nomi | Oui | Oui | Oui | Limitée | Non identifiée | Non identifiée | Non établi |
| Kindroid | Oui | Oui | Oui | Limitée | Non identifiée | Non identifiée | Non établi |
| MemoryBank | Oui | Partielle | Oui | Non central | Non | Non | Partiellement |
| MemGPT / Letta | Oui | Possible | Oui | Oui | Non | Non | Architecture externe au LLM |
| Generative Agents | Oui | Oui | Oui | Oui | Non | Non | Partiellement |
| LD-Agent | Oui | Persona dynamique | Oui | Partielle | Non | Non | Modulaire |
| Voyager | Compétences persistantes | Non central | Oui | Oui | Non | Non | Oui au niveau architecture agent |
| Animesis | Oui | Oui, centrale | Oui | Oui | Non identifié | Non identifiée | **Oui, explicitement** |
| OpenLife | Oui | Individuation observée | Oui | **Oui** | Non identifié | Non identifiée | Oui, LLM stateless entouré de processus |
| Tierra / Avida | Oui au sens état/génome | Organisme numérique | Oui par évolution | Oui | **Oui** | Héritage génétique numérique | Sans LLM |
| Karl Sims | Génome numérique | Créature distincte | Évolution | Oui | **Oui** | Héritage génétique numérique | Sans LLM |
| Évolution populationnelle de LLM | Paramètres / expérience | Modèle descendant | Oui | Non central | **Oui** | Succession de capacités | Non pertinent |
| **Lenoseed visé** | **Oui** | **Oui** | **Oui** | **Progressivement** | **Prévue** | **Prévue** | **Oui, principe central** |

Cette table est une simplification destinée à l’orientation du projet et non une classification définitive des systèmes cités.

---

# 13. Ce qui est déjà clairement connu

À ce stade, les éléments suivants **ne doivent pas être présentés comme des inventions de Lenoseed pris isolément** :

- compagnon IA à relation longue durée ;
- mémoire externe au LLM ;
- mémoire épisodique et sémantique ;
- oubli et consolidation ;
- récupération de souvenirs selon la pertinence ;
- persona dynamique ;
- réflexion à partir de souvenirs ;
- agents capables d’initiative ;
- apprentissage continu à partir de l’expérience ;
- séparation technique entre LLM et mémoire persistante ;
- agents numériques autonomes ;
- organismes numériques auto-réplicatifs ;
- crossover et mutation ;
- descendance numérique ;
- évolution de populations artificielles ;
- remplacement possible du modèle tout en conservant un état externe.

---

# 14. Ce qui paraît actuellement plus spécifique à Lenoseed

À partir des sources examinées jusqu’au 10 août 2026, l’intérêt potentiel de Lenoseed semble se situer moins dans une brique isolée que dans la **combinaison expérimentale** des contraintes suivantes :

## 14.1 Naissance avec identité minimale

Le système ne reçoit pas une personnalité adulte préécrite. Il reçoit seulement des mécanismes et de faibles prédispositions initiales.

## 14.2 Construction historique obligatoire

Une préférence, croyance, valeur ou relation durable doit posséder une histoire et une provenance suffisantes.

Le LLM n’a pas le droit de transformer directement une phrase plausible en propriété permanente.

## 14.3 Séparation entre état, motivation, décision et expression

Lenoseed cherche à distinguer explicitement :

```text
état persistant
→ motivations
→ choix / intention
→ LLM
→ formulation linguistique
```

Cette séparation vise à rendre les comportements importants causalement inspectables.

## 14.4 Validation par mécanismes plutôt que par apparence

Une phrase du type « je tiens à toi », « je préfère cela » ou « je me souviens » ne suffit pas.

Les propriétés revendiquées doivent être reliées à un mécanisme et, lorsque possible, à des tests :

- provenance ;
- ablation ;
- contre-factuel ;
- reproductibilité ;
- comparaison avec une architecture témoin.

## 14.5 Continuité de l’individu malgré le changement de LLM

Ce principe possède une proximité forte avec Animesis et d’autres architectures de mémoire persistante. Il ne doit donc pas être revendiqué seul comme nouveauté.

La question spécifique de Lenoseed est plutôt de déterminer si **l’identité historiquement construite** reste suffisamment stable et causalement active après le remplacement du moteur linguistique.

## 14.6 Transmission intergénérationnelle multi-couche

Le futur système d’héritage de Lenoseed prévoit de distinguer :

- patrimoine constitutif ;
- caractéristiques acquises ;
- mémoire autobiographique ;
- héritage culturel ;
- souvenirs ancestraux avec provenance ;
- relations propres ;
- généalogie.

La transmission doit inclure :

- recombinaison plutôt que moyenne ;
- mutations limitées ;
- faible hérédité directe des acquis ;
- transmission culturelle principale des apprentissages ;
- souvenirs ancestraux explicitement identifiés comme non vécus ;
- reconstruction individuelle des relations ;
- règles de confidentialité entre lignées ;
- possibilité de contestation et transformation culturelle ;
- oubli au fil des générations.

**Aucun système réunissant clairement l’ensemble de ces contraintes n’a été identifié dans cette première recherche.**

Cette phrase ne constitue pas une preuve d’inédit. Elle signifie uniquement : « non identifié dans le corpus actuellement examiné ».

---

# 15. Travaux les plus proches à surveiller en priorité

L’ordre de priorité actuel pour la veille scientifique de Lenoseed est le suivant.

## Priorité 1 — OpenLife

Pourquoi : individuation, activité spontanée, persistance, LLM entouré de processus autonomes, perspective de vie artificielle ouverte.

- https://arxiv.org/abs/2606.31046

## Priorité 2 — Memory as Ontology / Animesis

Pourquoi : continuité d’identité, mémoire comme fondement de l’individu, LLM considéré comme support remplaçable.

- https://arxiv.org/abs/2603.04740

## Priorité 3 — Generative Agents

Pourquoi : mémoire d’expériences, réflexion, planification et comportements sociaux émergents.

- https://arxiv.org/abs/2304.03442

## Priorité 4 — ZifaMem et autres architectures récentes de mémoire de compagnon

Pourquoi : permet de déterminer ce qui peut déjà être obtenu par une mémoire structurée sans architecture d’identité plus profonde.

- https://arxiv.org/abs/2607.17564

## Priorité 5 — Vie artificielle classique

Pourquoi : empêche de réinventer naïvement des concepts d’hérédité, mutation, sélection, généalogie et diversité déjà étudiés depuis plusieurs décennies.

- Tierra
- Avida
- travaux de Karl Sims

---

# 16. Risques de faux sentiment de nouveauté

Lenoseed devra être particulièrement prudent face à plusieurs confusions possibles.

## 16.1 Mémoire ≠ identité

Un chatbot peut se souvenir de milliers d’événements sans nécessairement posséder une identité fonctionnelle indépendante.

## 16.2 Persona cohérente ≠ identité émergente

Un prompt bien écrit ou une extraction automatique de persona peut produire un personnage cohérent sans que ses traits aient réellement été construits par ses expériences.

## 16.3 Initiative linguistique ≠ motivation interne

Un LLM peut proposer spontanément une action parce que le prompt lui demande d’être proactif. Cela ne démontre pas qu’une motivation persistante existe dans l’état de l’agent.

## 16.4 Descendance numérique ≠ nouveauté

L’évolution artificielle, les génomes numériques, la recombinaison, les mutations et la reproduction existent depuis plusieurs décennies.

## 16.5 Continuité après changement de modèle ≠ nouveauté suffisante

Des architectures récentes étudient déjà explicitement la persistance d’un agent malgré le remplacement ou l’indépendance du LLM sous-jacent.

## 16.6 Comportement impressionnant ≠ mécanisme démontré

Le critère important pour Lenoseed doit rester la présence d’un mécanisme testable, et non l’impression subjective produite par la conversation.

---

# 17. Questions de recherche encore ouvertes

Cet état de l’art doit être approfondi sur les questions suivantes :

1. Existe-t-il déjà un agent LLM qui commence volontairement sans persona et construit ses traits uniquement à partir d’événements avec provenance ?
2. Existe-t-il une architecture publiée qui interdit explicitement au LLM d’écrire directement ses propres traits durables ?
3. Existe-t-il des travaux évaluant l’identité d’un agent par **ablation causale** plutôt que par jugement conversationnel ?
4. Existe-t-il des travaux sur une mémoire autobiographique qui distingue strictement expérience vécue, information apprise et souvenir transmis par un ancêtre ?
5. Existe-t-il des systèmes de compagnons IA dans lesquels deux agents appartenant à deux humains différents produisent un descendant persistant ?
6. Existe-t-il des systèmes de reproduction d’agents qui transmettent à la fois dispositions, culture et fragments ancestraux avec provenance ?
7. Comment la recherche sur l’open-ended evolution peut-elle éviter la convergence des lignées Lenoseed vers des profils moyens ?
8. Quels mécanismes de confidentialité sont déjà étudiés pour empêcher une mémoire privée de traverser une lignée numérique ?
9. Comment distinguer expérimentalement une identité réellement dépendante de l’histoire d’une simple reconstruction de persona à partir d’un résumé de mémoire ?
10. Quelles métriques permettent de mesurer la continuité d’un individu lorsque le LLM sous-jacent est remplacé ?

---

# 18. Positionnement provisoire de Lenoseed

**Certain :** la plupart des briques techniques envisagées par Lenoseed existent déjà séparément dans plusieurs domaines de recherche.

**Certain :** la mémoire persistante, les agents autonomes, la personnalisation, les systèmes de persona, la vie artificielle et la reproduction numérique ne sont pas des concepts nouveaux pris isolément.

**Certain :** certains travaux de 2026, notamment OpenLife et Animesis, se rapprochent fortement de plusieurs idées centrales de Lenoseed.

**Probable :** l’intérêt expérimental de Lenoseed se trouve dans la manière dont il combine formation progressive d’identité, causalité traçable, séparation du LLM, relation humaine, évolution sur le temps long et futur héritage intergénérationnel.

**Inconnu :** il n’est pas encore possible d’affirmer que cette combinaison est scientifiquement inédite.

La position correcte du projet est donc actuellement :

> **Lenoseed explore une combinaison particulière de mécanismes déjà partiellement présents dans plusieurs champs. Le projet doit démontrer expérimentalement ce que cette combinaison produit de plus que les architectures existantes, plutôt que supposer sa nouveauté.**

---

# 19. Bibliographie initiale

## Agents, mémoire et compagnonnage

- Park, J. S. et al. — *Generative Agents: Interactive Simulacra of Human Behavior* (2023)  
  https://arxiv.org/abs/2304.03442

- Zhong, W. et al. — *MemoryBank: Enhancing Large Language Models with Long-Term Memory* (2023)  
  https://arxiv.org/abs/2305.10250

- Packer, C. et al. — *MemGPT: Towards LLMs as Operating Systems* (2023)  
  https://arxiv.org/abs/2310.08560

- Wang, G. et al. — *Voyager: An Open-Ended Embodied Agent with Large Language Models* (2023)  
  https://arxiv.org/abs/2305.16291

- Li, H. et al. — *Hello Again! LLM-powered Personalized Agent for Long-term Dialogue* (2024)  
  https://arxiv.org/abs/2406.05925

- Zhang, W. et al. — *PersonaAgent: When Large Language Model Agents Meet Personalization at Test Time* (2025)  
  https://arxiv.org/abs/2506.06254

- Cai, Y. et al. — *Building Self-Evolving Agents via Experience-Driven Lifelong Learning* (2025)  
  https://arxiv.org/abs/2508.19005

- Li, Z. — *Memory as Ontology: A Constitutional Memory Architecture for Persistent Digital Citizens* (2026)  
  https://arxiv.org/abs/2603.04740

- Masumori, A. et al. — *OpenLife: Toward Open-World Artificial Life with Autonomous LLM Agents* (2026)  
  https://arxiv.org/abs/2606.31046

- Fang, J. et al. — *ZifaMem: Structured Memory for Persona, Preference, and Emotional Continuity in AI Companions* (2026)  
  https://arxiv.org/abs/2607.17564

## Vie artificielle et évolution numérique

- Ray, T. S. — *Evolution, Ecology and Optimization of Digital Organisms*  
  https://tomray.me/pubs/tierra/

- Ofria, C., Wilke, C. O. — *Avida: A Software Platform for Research in Computational Evolutionary Biology* (2004)  
  https://direct.mit.edu/artl/article/10/2/191/2455/Avida-A-Software-Platform-for-Research-in

- Sims, K. — *Evolving Virtual Creatures* (1994)  
  https://doi.org/10.1145/192161.192167

- Zhang, Y. et al. — *Nature-Inspired Population-Based Evolution of Large Language Models* (2025)  
  https://arxiv.org/abs/2503.01155

---

# 20. Règle de maintenance de ce document

Chaque fois qu’un nouveau mécanisme important est envisagé pour Lenoseed, avant de le considérer comme potentiellement original :

1. rechercher les travaux antérieurs correspondants ;
2. ajouter les références pertinentes ici ;
3. décrire précisément les ressemblances ;
4. décrire précisément les différences ;
5. identifier un test permettant de mesurer la différence ;
6. modifier le positionnement de Lenoseed si une antériorité plus proche est découverte.

Un état de l’art utile n’est pas un document destiné à défendre le projet.

Il doit être capable de montrer que certaines idées de Lenoseed existaient déjà avant lui et d’obliger le projet à préciser ce qu’il cherche réellement à apporter.
