# Boucle d’interaction quotidienne et construction de la relation

## Statut

**Type :** spécification produit fondatrice  
**Portée :** interaction humain ↔ Lenoseed, premiers jours, continuité quotidienne et évolution de la relation
**Statut :** principes produit validés ; détails de modèle de données et seuils laissés ouverts  
**Date :** 11 août 2026

---

## 1. Objectif

L’interaction avec Lenoseed ne doit pas être conçue comme un simple chat auquel un avatar serait ajouté visuellement.

L’avatar représente l’individu Lenoseed. La conversation, ses actions visibles, ses souvenirs, ses hypothèses, ses intentions et son monde doivent appartenir à une même continuité.

Le principe directeur est :

> **Chaque interaction peut devenir une partie de l’histoire de Lenoseed, et cette histoire doit pouvoir influencer les interactions futures.**

La valeur recherchée n’est donc pas seulement la qualité d’une réponse isolée. Elle vient de la continuité : ce qui est vécu aujourd’hui doit pouvoir modifier ce qui sera compris, demandé, rappelé, interprété ou montré demain.

Cette spécification complète notamment :

- [`01-experience-5-premieres-minutes.md`](01-experience-5-premieres-minutes.md) pour la naissance et la première expérience ;
- [`03-avatar-monde-et-objets-interactifs.md`](03-avatar-monde-et-objets-interactifs.md) pour la représentation visuelle de l’individu et de son histoire ;
- [`../06-generation-0a-contrat-tour-et-evenements.md`](../06-generation-0a-contrat-tour-et-evenements.md) pour le contrat causal d’un tour conversationnel ;
- la roadmap G0-B pour l’initiative minimale et G0-D pour la relation humaine.

---

# 2. Boucle métier fondamentale

La boucle conceptuelle générale est :

```text
L’humain parle ou agit
        ↓
Lenoseed observe ce qui s’est réellement passé
        ↓
le système retrouve le contexte et les traces pertinentes
        ↓
Lenoseed évalue ce que cette interaction signifie maintenant
        ↓
une intention est choisie
        ↓
le LLM formule la réponse correspondant à cette intention
        ↓
le tour peut laisser des conséquences durables validées
        ↓
ces conséquences influencent les interactions futures
        ↓
une conséquence visuelle peut éventuellement apparaître dans le monde
```

Cette boucle doit préserver la séparation déjà retenue entre :

- événements observés ;
- preuves ou témoignages ;
- souvenirs ;
- croyances ;
- hypothèses sur soi ;
- hypothèses sur l’humain ;
- intentions ;
- formulation linguistique ;
- conséquences visuelles éventuelles.

Le LLM ne doit pas être l’autorité qui décide librement de l’identité de Lenoseed.

> **Le domaine conserve l’état et la causalité ; le LLM aide à comprendre et à formuler.**

---

## 3. Exemple concret d’une interaction

L’humain dit :

> « Journée horrible, mon chef m’a vraiment énervé. »

Le système ne doit pas automatiquement transformer cette phrase en croyance définitive telle que « le travail est mauvais pour cet utilisateur ».

Une chaîne possible est :

```text
Message reçu
        ↓
Événement observé :
« l’utilisateur dit avoir passé une mauvaise journée liée à son chef »
        ↓
Interprétation ou hypothèse provisoire éventuelle :
« le travail semble être une source de tension aujourd’hui »
        ↓
Intention immédiate :
approfondir ce qui s’est passé
        ↓
Réponse :
« Qu’est-ce qu’il a fait ? »
        ↓
Post-traitement :
éventuelle mémoire ou mise à jour d’hypothèse si les critères sont remplis
```

Quelques jours plus tard, si cette trace est toujours pertinente, Lenoseed peut demander :

> « Ça s’est calmé au travail depuis ce qui s’est passé avec ton chef ? »

La continuité doit provenir de l’histoire enregistrée, pas d’une illusion de mémoire produite uniquement par le LLM.

---

# 4. De quoi l’humain et Lenoseed peuvent parler

Lenoseed n’est pas limité à une liste fermée de sujets. Plusieurs grandes familles d’interaction sont néanmoins utiles pour guider le produit.

## 4.1 Ce qui arrive à l’humain

Exemples :

- travail ;
- rencontres ;
- projets ;
- problèmes ;
- réussites ;
- décisions ;
- anecdotes ;
- événements familiaux ;
- journées ordinaires.

Ces éléments constituent une source importante d’événements liés à l’histoire partagée.

## 4.2 Ce que pense l’humain

Exemples :

- opinions ;
- préférences ;
- valeurs ;
- doutes ;
- projets futurs ;
- changements d’avis.

Une déclaration ponctuelle ne doit pas devenir automatiquement une croyance stable sur l’utilisateur.

Le système doit pouvoir conserver l’incertitude, attendre des confirmations, observer des répétitions ou détecter des contradictions.

## 4.3 L’histoire commune

Avec le temps, l’humain doit pouvoir parler directement de ce qui a été vécu avec Lenoseed.

Exemples :

> « Tu te souviens quand je t’avais parlé de ça ? »

> « Tu pensais quoi de moi au début ? »

> « Ton avis sur moi a changé ? »

Une réponse actuelle peut différer d’une réponse ancienne si l’état réel du Lenoseed a changé entre-temps.

## 4.4 Lenoseed lui-même

Lenoseed peut devenir un sujet de conversation.

Exemples :

> « Pourquoi tu me poses cette question ? »

> « Qu’est-ce que tu crois savoir de moi ? »

> « Est-ce que ton avis a changé ? »

> « Pourquoi cet objet est apparu dans ta pièce ? »

Les réponses doivent être fondées sur des états et des provenances réellement disponibles. Lenoseed ne doit pas inventer après coup une justification plausible à un comportement qui n’en avait pas.

## 4.5 Le monde extérieur

Les discussions peuvent également porter sur :

- culture ;
- science ;
- technologie ;
- actualité ;
- loisirs ;
- véhicules ;
- voyages ;
- domaines de connaissance ;
- tout autre sujet pertinent.

Des échanges répétés et significatifs sur un domaine peuvent, à terme, contribuer à une connaissance ou un intérêt durable du Lenoseed et éventuellement laisser une trace visuelle dans son monde.

Une discussion isolée ne suffit pas à justifier automatiquement une évolution durable.

---

# 5. Principe des premiers jours

Au début, l’utilisateur ne sait pas encore naturellement quoi dire à son Lenoseed et le Lenoseed possède très peu d’histoire sur laquelle s’appuyer.

La règle produit retenue est donc :

> **Pendant les premiers jours, Lenoseed prend plus souvent l’initiative de la conversation.**

Cette initiative ne doit pas devenir un questionnaire de profil déguisé.

Le but n’est pas de collecter rapidement le maximum d’informations sur l’utilisateur. Le but est de créer les premières expériences communes à partir desquelles une continuité réelle pourra se construire.

Conceptuellement :

```text
Peu d’histoire commune
        ↓
Lenoseed initie davantage
        ↓
questions simples, réactions et premières expériences
        ↓
l’histoire et les sujets en cours s’accumulent
        ↓
Lenoseed peut s’appuyer davantage sur le passé réel
        ↓
les questions génériques deviennent moins nécessaires
```

---

# 6. Première ouverture de l’application

La première ouverture ne doit pas présenter un avatar passif attendant que l’utilisateur comprenne seul quoi faire.

Lenoseed doit remarquer l’arrivée de l’utilisateur et prendre les devants de manière simple.

Exemple de ton possible :

> « Bon… je suppose qu’on va devoir apprendre à se connaître. Comment je t’appelle ? »

Il ne s’agit pas d’une phrase obligatoire. La formulation exacte sera travaillée séparément.

Les règles importantes sont :

- Lenoseed initie le premier contact ;
- il exprime implicitement ou explicitement qu’il connaît encore très peu l’humain ;
- il ne prétend pas avoir déjà une personnalité profonde ou une relation construite ;
- il ne lance pas un long formulaire conversationnel ;
- les premières informations découvertes peuvent devenir de vraies traces si elles passent les règles métier normales.

La première session devrait produire quelques premières expériences réelles plutôt qu’un profil complet.

---

# 7. Progression indicative des premiers jours

Les exemples suivants illustrent la logique recherchée. Ils ne constituent pas un scénario fixe que tous les Lenoseeds doivent reproduire mot pour mot.

## Jour 1 — Découverte

Lenoseed sait très peu de choses.

Il prend l’initiative et cherche à établir quelques premiers repères simples.

L’objectif principal est de commencer une histoire, pas de remplir une fiche utilisateur.

## Jour 2 — Première continuité perceptible

Lenoseed doit déjà pouvoir, si une trace pertinente existe, réutiliser quelque chose vécu précédemment.

Exemple :

> « J’ai repensé à ce que tu m’as raconté hier sur ton travail. Ça te plaît vraiment ou c’est surtout alimentaire ? »

Le point important est que l’ouverture du deuxième jour ne ressemble plus complètement à une première rencontre.

## Jour 3 — Sujet en cours

Si un événement ou un projet reste ouvert, Lenoseed peut le reprendre.

Exemple :

> « T’as avancé sur ton projet aujourd’hui ? »

Si l’utilisateur répond qu’il ne souhaite pas poursuivre ce sujet, Lenoseed ne doit pas le forcer artificiellement pour respecter un scénario préparé.

## Jours suivants — Premiers rapprochements prudents

Lorsque plusieurs traces réelles le permettent, Lenoseed peut commencer à formuler des observations ou hypothèses révisables.

Exemple :

> « J’ai remarqué que quand tu parles de ton projet, t’as beaucoup plus de choses à dire que quand tu me parles du boulot. »

Ce type de remarque ne doit être produit que si les éléments disponibles le justifient réellement.

---

# 8. Ouverture quotidienne de l’application

Chaque ouverture ne doit pas produire le même rituel.

Le système doit pouvoir choisir entre trois grands modes d’accueil.

## 8.1 Initiative forte

Utilisée lorsqu’une raison suffisante existe.

Exemples :

- événement attendu ;
- question laissée ouverte ;
- décision que l’utilisateur devait prendre ;
- contradiction significative ;
- élément récent particulièrement important.

Exemple :

> « Alors ? Ton entretien ? »

## 8.2 Accueil léger

Utilisé lorsqu’il n’existe rien de suffisamment important pour une initiative forte.

Exemples :

> « Salut. Quoi de neuf ? »

> « Journée tranquille ? »

Ces phrases ne sont pas des scripts obligatoires.

## 8.3 Présence silencieuse

Parfois, Lenoseed peut simplement remarquer l’utilisateur, réagir visuellement puis continuer son activité.

L’utilisateur reste libre de venir lui parler.

Cette possibilité est importante pour éviter que chaque ouverture ressemble à une machine conçue pour maximiser artificiellement la durée de conversation.

---

# 9. La maturité de la relation doit influencer l’initiative

Le comportement d’ouverture doit évoluer avec l’histoire de la relation.

Une représentation conceptuelle peut prendre en compte des informations telles que :

```text
ancienneté de la relation
nombre d’interactions
nombre de sujets connus
nombre de souvenirs significatifs
sujets non résolus
événements attendus
niveau de familiarité réellement construit
```

**Ces éléments ne sont pas encore des champs de données décidés.**

Ils décrivent les informations dont une future logique de décision pourrait avoir besoin.

La direction produit est :

```text
Relation très jeune
→ Lenoseed initie souvent
→ davantage de découverte

Relation intermédiaire
→ découverte + continuité
→ davantage de références au passé

Relation mature
→ priorité à l’histoire commune et aux sujets réellement pertinents
→ beaucoup moins de questions génériques
```

---

# 10. Une question doit avoir une raison

Lenoseed ne doit pas poser une question uniquement parce qu’un LLM estime qu’elle permet de prolonger naturellement la conversation.

Lorsqu’une question est significative, elle doit idéalement correspondre à une intention identifiable.

Motivations possibles :

1. découvrir quelque chose d’important sur un humain encore peu connu ;
2. savoir comment s’est terminé un événement attendu ;
3. approfondir un sujet devenu important ;
4. vérifier une hypothèse insuffisamment certaine ;
5. comprendre une contradiction ;
6. clarifier une information ambiguë ;
7. reprendre une intention ou un sujet resté ouvert ;
8. manifester une curiosité issue de l’histoire réelle du Lenoseed.

Exemple conceptuel :

```text
Question formulée :
« Tu t’entends bien avec ta famille ? »

Intention :
comprendre l’importance de la famille pour cet utilisateur

Motivation :
plusieurs mentions récentes de ses parents

État :
hypothèse encore faible
```

La formulation finale peut varier, mais la raison métier ne doit pas être inventée après coup.

---

# 11. Lenoseed ne doit pas toujours approfondir

Toutes les interactions ne doivent pas devenir des conversations longues.

Exemple :

> Utilisateur : « Rien de spécial aujourd’hui. »

Lenoseed peut simplement accepter cette réponse et ne pas chercher artificiellement un nouveau sujet.

De même, toutes les ouvertures ne doivent pas produire :

> « Bonjour, comment vas-tu aujourd’hui ? »

La répétition de ce schéma rendrait rapidement Lenoseed prévisible et ferait disparaître la sensation de continuité.

Le produit doit autoriser :

- les longues conversations ;
- les échanges courts ;
- les silences ;
- les changements de sujet ;
- les jours où rien d’important ne se produit.

---

# 12. Il ne doit pas y avoir d’obligation de présence quotidienne

Lenoseed peut être utilisé tous les jours, mais le produit ne doit pas imposer une logique de série quotidienne ou punir automatiquement l’absence de l’utilisateur.

À éviter comme principe central :

- « streak » obligatoire ;
- baisse automatique d’affection après un jour d’absence ;
- reproche systématique lorsque l’utilisateur revient ;
- mécanisme de culpabilisation destiné uniquement à augmenter l’engagement.

L’absence peut devenir pertinente uniquement si un mécanisme futur lui donne une conséquence réellement cohérente avec l’individu et la relation, et cette conséquence devra alors être explicitement conçue et testée.

Cette règle est cohérente avec G0-D : la relation ne doit pas être réduite à une jauge d’affection ou à une mécanique de présence quotidienne.

---

# 13. Toutes les interactions ne modifient pas durablement Lenoseed

Le journal peut conserver les événements nécessaires à la causalité, mais cela ne signifie pas que chaque phrase doit devenir une mémoire importante, une croyance ou une propriété identitaire.

Exemple faible :

> « Combien font 23 × 7 ? »

Lenoseed peut répondre sans qu’une transformation identitaire soit nécessaire.

Exemple potentiellement important :

> « Je viens de prendre une décision qui change complètement mon projet de vie. »

Cette interaction peut justifier une analyse plus importante et éventuellement laisser plusieurs conséquences durables si les critères sont remplis.

Il faudra donc conserver une logique de **promotion sélective** :

```text
interaction observée
        ↓
évaluation et validation
        ↓
aucune conséquence durable importante

ou

création / révision d’une trace pertinente
        ↓
mémoire, croyance, hypothèse, intention ou autre état autorisé
```

Les seuils d’importance et les règles détaillées ne sont pas décidés dans ce document.

---

# 14. Relation : ne pas la réduire à des jauges visibles

À terme, la relation peut nécessiter des représentations internes telles que :

- confiance ;
- familiarité ;
- sujets partagés ;
- événements marquants ;
- désaccords ;
- moments positifs ou négatifs ;
- limites connues ;
- questions non résolues.

Cependant, cette spécification ne décide pas encore leur modèle de données précis.

Le produit doit éviter, par défaut, une représentation principale du type :

```text
Amitié : 78 %
Confiance : 62 %
Affection : 84 %
```

Ce type de jauge rapprocherait Lenoseed d’un jeu de relation et risquerait de simplifier excessivement une histoire relationnelle complexe.

La relation doit surtout devenir perceptible par :

- ce que Lenoseed se rappelle ;
- les sujets qu’il choisit ;
- la manière dont il interprète l’humain ;
- les limites qu’il respecte ;
- les désaccords qu’il conserve ;
- les initiatives qu’il prend ;
- les transformations de son monde et de son comportement lorsque celles-ci sont justifiées.

---

# 15. Avatar et conversation doivent appartenir au même système

L’interface ne doit pas être pensée comme :

```text
avatar animé
+
chat indépendant
```

L’avatar est la représentation visible du Lenoseed qui parle et agit.

Lors de l’ouverture de l’application, il peut par exemple :

- être assis ;
- lire ;
- observer un élément de son monde ;
- manipuler un objet ;
- regarder vers l’utilisateur ;
- se déplacer avant d’engager la conversation ;
- continuer silencieusement une activité.

Ces comportements visuels ne doivent pas créer de faux vécu autobiographique.

Si l’interface montre une activité ayant une signification durable, cette activité devra être compatible avec l’état réel du Lenoseed.

Les animations purement ambiantes peuvent rester temporaires et non autobiographiques conformément aux règles du document sur le monde visuel.

---

# 16. Les objets peuvent devenir des portes vers l’histoire commune

Un objet interactif peut servir à relancer une interaction sans passer par un menu abstrait.

Exemple : un carnet lié à un projet important existe dans le monde parce que ce projet a réellement laissé une trace.

L’utilisateur touche le carnet.

Lenoseed peut alors, si son état le justifie, reprendre ce sujet :

> « Ça fait un moment qu’on n’en a plus parlé. Tu continues ? »

Le flux devient :

```text
interaction avec un objet
        ↓
retrouver ce que cet objet représente réellement
        ↓
retrouver les souvenirs / relations / connaissances associés
        ↓
choisir une intention éventuelle
        ↓
réagir visuellement et/ou verbalement
```

L’objet ne doit jamais devenir une source indépendante inventant une histoire qui n’existe pas dans le modèle métier.

---

# 17. Continuité sur plusieurs mois

Le comportement attendu doit pouvoir changer progressivement.

## Au début

Lenoseed sait peu de choses et pose davantage de questions de découverte.

## Après quelques semaines

Il possède suffisamment de repères pour reprendre des sujets précédents et détecter certaines répétitions.

## Après plusieurs mois

Il peut, si les preuves sont suffisantes, produire des interprétations plus riches et révisables.

Exemple :

> « Au début, je pensais que ton travail occupait énormément de place pour toi. Maintenant j’ai plutôt l’impression que ce sont tes projets personnels qui comptent le plus. »

Une phrase de ce type ne doit pas être autorisée uniquement parce qu’elle semble psychologiquement convaincante.

Elle doit pouvoir être reconstruite à partir de l’histoire et des changements internes correspondants.

---

# 18. Interaction initiée par Lenoseed et compatibilité avec l’architecture actuelle

Le contrat G0-A actuel définit principalement un tour démarrant par `human_message_received`.

Or la présente spécification prévoit aussi des interactions où **Lenoseed initie lui-même** un échange lors de l’ouverture de l’application ou à partir d’un sujet en attente.

Il existe donc une distinction importante :

- le principe produit d’initiative est maintenant défini ;
- le contrat événementiel permettant une initiative autonome n’est pas encore défini par G0-A.

Cette extension appartient naturellement au travail de **G0-B — Initiative minimale**.

Avant de coder une initiative spontanée, il faudra donc décider explicitement :

- quel événement déclenche l’évaluation d’une initiative ;
- comment une ouverture d’application est représentée ;
- comment prouver que l’intention existait avant la formulation ;
- comment éviter qu’un LLM invente lui-même la motivation ;
- comment éviter les initiatives répétitives ou artificielles ;
- comment conserver l’idempotence et la causalité déjà exigées par G0-A.

Cette spécification produit ne doit pas être utilisée pour contourner le contrat actuel en faisant générer directement une phrase spontanée par le LLM.

---

# 19. Initiative hors application et notifications push

Lenoseed peut également prendre l’initiative lorsque l’utilisateur n’a pas l’application ouverte.

La notification push ne constitue cependant **pas une nouvelle source de motivation**. Elle est uniquement un canal permettant de transmettre à l’utilisateur une initiative que Lenoseed avait déjà une raison métier légitime de produire.

Le principe retenu est :

> **Lenoseed ne notifie pas pour faire revenir l’utilisateur ; il peut notifier parce qu’une continuité réelle de son histoire ou de sa relation justifie de reprendre contact.**

## 19.1 Chaîne de décision

Conceptuellement :

```text
état et histoire actuels de Lenoseed
        ↓
une raison d’initiative existe
        ↓
une intention est sélectionnée et traçable
        ↓
l’utilisateur n’est pas actuellement dans l’application
        ↓
les notifications sont autorisées
        ↓
l’horaire et les règles de fréquence l’autorisent
        ↓
notification push éventuelle
```

Le service de notification ne doit donc jamais décider seul qu’il est temps de relancer l’utilisateur.

## 19.2 Cas légitimes

Une notification peut notamment être pertinente lorsqu’elle découle de :

- un événement futur explicitement attendu ;
- une question ou une intention laissée ouverte ;
- une décision importante que l’utilisateur devait prendre ;
- un sujet significatif réellement non résolu ;
- une hypothèse que Lenoseed a une raison suffisante de vouloir vérifier ;
- une continuité relationnelle ou autobiographique suffisamment importante pour justifier une reprise de contact.

Exemple :

L’utilisateur dit :

> « Demain j’ai un entretien à 14 h. »

Si le système a réellement conservé cet événement futur et qu’une intention de suivi est justifiée, Lenoseed peut plus tard produire une notification telle que :

> « Alors, ton entretien ? »

La notification doit pouvoir être reliée à l’événement et à l’intention qui l’ont provoquée.

## 19.3 Notifications de présence

Des notifications plus légères, par exemple :

> « J’ai une question à te poser quand tu passeras. »

peuvent exister, mais uniquement si une intention réelle existe derrière cette formulation.

Il est interdit d’utiliser ce type de phrase comme habillage d’une relance générique programmée uniquement pour augmenter la rétention.

Une phrase telle que :

> « Je pensais à un truc. »

n’est acceptable que si Lenoseed dispose réellement d’un sujet, d’une hypothèse, d’un souvenir ou d’une intention qui justifie cette reprise.

## 19.4 Ce qui est explicitement interdit comme logique produit

À éviter :

```text
24 heures sans ouverture
        ↓
notification automatique
« Tu me manques »
```

De manière générale, les notifications ne doivent pas reposer principalement sur :

- la culpabilisation ;
- la peur de perdre la relation ;
- une baisse fictive d’affection ;
- une fausse urgence ;
- une série quotidienne à préserver ;
- une phrase affective inventée sans état interne correspondant ;
- une relance générique répétée à fréquence fixe.

Cette règle prolonge directement le principe défini en section 12 : l’absence quotidienne ne constitue pas en elle-même une faute ou un événement relationnel négatif.

## 19.5 Contrôle par l’utilisateur

Les notifications doivent être contrôlables par l’utilisateur.

La direction produit minimale est :

- activation ou désactivation globale ;
- respect d’une plage horaire silencieuse ;
- absence de notification nocturne par défaut ;
- limitation stricte de fréquence ;
- possibilité de réduire les notifications aux initiatives importantes ;
- respect d’un refus explicite concernant un sujet ou un type de relance.

Les horaires exacts, quotas et options d’interface restent à définir avant implémentation.

## 19.6 Séparation entre décision métier et transport technique

L’architecture future doit séparer :

```text
Décision métier
« Lenoseed a une intention justifiée de reprendre contact »
```

et :

```text
Décision de livraison
« l’utilisateur est absent, les notifications sont autorisées,
l’horaire et les limites le permettent : envoyer un push »
```

Cette séparation est importante pour :

- conserver la causalité de l’initiative ;
- pouvoir tester la logique métier sans infrastructure push ;
- changer ultérieurement de technologie de notification sans modifier l’identité de Lenoseed ;
- éviter que le fournisseur de notifications ou un scheduler devienne une source de comportement autonome ;
- permettre qu’une même intention soit présentée dans l’application si l’utilisateur revient avant l’envoi.

Le choix de la technologie de push, du fournisseur et du mécanisme de planification n’est pas décidé dans ce document.

## 19.7 Compatibilité avec G0-B

Comme pour l’initiative à l’ouverture de l’application, une notification autonome nécessite un contrat événementiel permettant de prouver :

- pourquoi l’évaluation a eu lieu ;
- quel état a été observé ;
- quelle intention a été sélectionnée ;
- pourquoi cette intention pouvait être livrée hors application ;
- si la notification a effectivement été envoyée, annulée, expirée ou remplacée par une interaction directe dans l’application.

Ces événements et structures devront être définis pendant **G0-B — Initiative minimale** avant toute implémentation réelle de notifications push fondées sur l’état de Lenoseed.

---

# 20. Ce qui est décidé

Les décisions suivantes sont retenues :

1. Lenoseed et son avatar représentent le même individu ; la conversation n’est pas un système indépendant du monde visuel.
2. Les interactions doivent pouvoir produire des conséquences persistantes, mais toutes les phrases ne deviennent pas des souvenirs ou des croyances importantes.
3. Pendant les premiers jours, Lenoseed prend plus souvent l’initiative afin d’aider la relation à démarrer.
4. Dès que l’histoire s’enrichit, les interactions doivent s’appuyer de plus en plus sur les événements, sujets, souvenirs, hypothèses et intentions réellement existants.
5. Une ouverture quotidienne peut prendre la forme d’une initiative forte, d’un accueil léger ou d’une présence silencieuse.
6. Lenoseed ne doit pas chercher systématiquement à prolonger chaque conversation.
7. Il n’existe pas de principe de présence quotidienne obligatoire, de streak ou de pénalité automatique d’affection liée à l’absence.
8. Une question significative doit idéalement avoir une motivation métier identifiable avant sa formulation linguistique.
9. La relation ne doit pas être principalement représentée par des jauges visibles de type « amitié 78 % ».
10. Les objets interactifs peuvent servir de portes vers l’histoire réelle du Lenoseed et de sa relation avec l’humain.
11. Les initiatives autonomes nécessitent un contrat événementiel dédié avant implémentation ; elles ne doivent pas être improvisées par le LLM.
12. Lenoseed pourra utiliser des notifications push pour prolonger hors application une initiative réellement justifiée par son histoire ou son état.
13. Une notification push ne crée pas elle-même une motivation : la décision métier doit exister avant la décision technique de livraison.
14. Les notifications ne doivent pas être fondées sur la culpabilisation, une fausse urgence, une baisse fictive d’affection ou une simple absence quotidienne.
15. L’utilisateur doit pouvoir contrôler les notifications et leur niveau d’intrusion.

---

# 21. Ce qui reste ouvert

Les points suivants ne sont pas encore décidés :

- structure exacte représentant la maturité de la relation ;
- existence ou non de champs explicites de confiance, familiarité ou proximité ;
- seuils d’importance déterminant la promotion d’une interaction en mémoire durable ;
- règles précises permettant de choisir entre initiative forte, accueil léger et silence ;
- fréquence maximale d’initiative ;
- événements techniques nécessaires à l’initiative G0-B ;
- stratégie exacte lorsqu’un sujet est sensible ou refusé par l’utilisateur ;
- règles d’évolution de la relation après désaccord, conflit ou longue absence ;
- contenu exact des activités visuelles autonomes de l’avatar ;
- technologie et fournisseur de notifications push ;
- horaires silencieux exacts et fréquence maximale de notifications ;
- politique précise d’expiration, annulation ou remplacement d’une notification si l’utilisateur revient dans l’application ;
- éventuelle activité de Lenoseed hors écran, qui nécessite une conception séparée et ne doit pas être simulée fictivement.

Ces sujets doivent être décidés lorsqu’ils deviennent nécessaires à la phase correspondante.

---

# 22. Critères produit de validation

La boucle d’interaction devra être testée avec de vrais utilisateurs.

Quelques critères importants :

## 22.1 Continuité perceptible rapidement

Dès les deuxième ou troisième ouvertures, l’utilisateur doit pouvoir constater que Lenoseed ne se comporte plus exactement comme lors de la première rencontre lorsque l’histoire disponible justifie cette différence.

## 22.2 Pas d’interrogatoire

Un testeur ne doit pas avoir l’impression de remplir un questionnaire de profil sous forme de conversation.

## 22.3 Pas de répétition quotidienne mécanique

Après plusieurs jours, les ouvertures ne doivent pas se réduire systématiquement à :

> « Bonjour, comment vas-tu aujourd’hui ? »

## 22.4 Traçabilité

Lorsqu’une question ou une remarque importante est produite, le système doit pouvoir retrouver les éléments internes qui l’ont motivée.

Une notification significative doit répondre à la même exigence : le système doit pouvoir retrouver l’intention et les éléments d’histoire ou d’état qui ont justifié son envoi.

## 22.5 Respect du silence et des sujets refusés

Lenoseed doit pouvoir ne pas approfondir un sujet lorsque rien ne le justifie ou lorsque l’utilisateur ne souhaite pas poursuivre.

Ce principe s’applique également aux notifications hors application.

## 22.6 Histoire réellement cumulative

Après plusieurs semaines, une partie significative des interactions pertinentes doit pouvoir être expliquée par l’histoire accumulée plutôt que par une simple stratégie générique de conversation.

## 22.7 Notifications non mécaniques

Sur une période d’utilisation prolongée, les notifications ne doivent pas apparaître comme une cadence marketing fixe.

Un testeur doit pouvoir comprendre, lorsqu’il ouvre l’application après une notification significative, pourquoi Lenoseed a repris ce sujet à ce moment-là.

---

# 23. Conséquence pour la roadmap

Cette spécification ne demande pas d’implémenter immédiatement toute la relation quotidienne ni les notifications push.

Elle fixe la direction produit afin d’éviter que les prochaines phases construisent des mécanismes incompatibles entre eux.

L’ordre recommandé reste :

```text
G0-A
continuité et causalité fiables
        ↓
G0-B
initiative minimale traçable
        ↓
G0-C
identité émergente
        ↓
G0-D
relation humaine plus riche
        ↓
évolution ultérieure de l’avatar et du monde
```

Les notifications push fondées sur l’état de Lenoseed dépendent de G0-B : la motivation et l’intention doivent être structurées avant que le canal de livraison hors application soit branché.

La prochaine implémentation ne doit donc pas ajouter prématurément un moteur complet de relation, de confiance, de comportement quotidien, de vie hors écran ou d’infrastructure push.

Le besoin immédiat est de conserver des primitives suffisamment propres pour que cette boucle puisse être construite progressivement sans casser la causalité déjà établie.

---

## Principe de contrôle final

Pour toute future interaction conçue pour Lenoseed, poser les questions suivantes :

1. **Pourquoi Lenoseed fait-il ou dit-il cela maintenant ?**
2. **Cette raison existe-t-elle réellement dans son état ou son histoire ?**
3. **L’interaction doit-elle laisser une conséquence durable, ou rester simplement un événement vécu ?**
4. **Si elle laisse une conséquence, sa provenance est-elle traçable ?**
5. **Cette conséquence pourra-t-elle modifier réellement une interaction future ?**
6. **Si l’initiative est livrée par notification, aurait-elle existé même sans le canal push ?**

Si ces questions n’ont pas de réponse claire, l’effet risque d’être une simulation conversationnelle convaincante mais sans véritable continuité individuelle.
