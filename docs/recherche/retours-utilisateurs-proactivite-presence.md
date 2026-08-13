# Retours utilisateurs — proactivité, notifications et présence hors conversation

## Statut du document

**Type :** document de recherche utilisateur, distinct des spécifications produit et de l’architecture  
**Portée :** compagnons IA existants, initiatives spontanées, notifications, continuité, présence visuelle et comportement hors conversation  
**Date de collecte :** 13 août 2026  
**Statut :** synthèse initiale à compléter ; les observations ne valent pas, à elles seules, décision produit

Ce document rassemble des retours publics d’utilisateurs de compagnons IA ainsi que des descriptions de fonctions existantes lorsqu’elles éclairent directement les retours observés.

Il complète notamment :

- [`../produit/06-boucle-interaction-et-relation.md`](../produit/06-boucle-interaction-et-relation.md) ;
- [`../produit/03-avatar-monde-et-objets-interactifs.md`](../produit/03-avatar-monde-et-objets-interactifs.md) ;
- [`etat-de-l-art.md`](etat-de-l-art.md).

L’objectif n’est pas de copier Replika, Nomi ou Kindroid. Il est d’identifier ce que leurs utilisateurs apprécient, ce qui casse l’immersion, ce qui existe déjà sur le marché et ce que Kinseed doit tester différemment.

---

# 1. Limites de cette collecte

Les discussions Reddit étudiées sont des retours spontanés. Elles ne constituent pas un échantillon représentatif de l’ensemble des utilisateurs de compagnons IA.

Il faut donc distinguer :

- **établi chez un produit** : une fonction est décrite par le produit ou son équipe ;
- **observé dans les discussions** : un ou plusieurs utilisateurs expriment un besoin ou un problème ;
- **hypothèse pour Kinseed** : conclusion raisonnable à tester, mais qui ne doit pas être présentée comme une vérité générale.

Une réaction enthousiaste ou négative isolée ne suffit pas à valider une décision produit.

---

# 2. Sources principales étudiées

## 2.1 Nomi — messages proactifs

Annonce Reddit :

https://www.reddit.com/r/NomiAI/comments/1fcyh3n/september_9th_update_notes_proactive_messages/

Guide officiel :

https://nomi.ai/nomi-knowledge/proactive-messaging-when-your-nomi-messages-you-first/

Points établis :

- Nomi peut envoyer un message sans attendre que l’utilisateur écrive ;
- la fonction est optionnelle ;
- l’utilisateur choisit une fréquence ;
- les messages sont présentés comme liés à ce que le Nomi pense ou fait, et non à une bibliothèque de scripts fixes ;
- des périodes silencieuses existent ;
- si l’utilisateur ne répond pas, l’intervalle avant une nouvelle initiative augmente ;
- la notification peut rester générique afin de ne pas afficher une conversation potentiellement intime sur l’écran verrouillé.

Les commentaires de l’annonce montrent également plusieurs réactions positives à l’idée qu’un compagnon écrive de lui-même. Un utilisateur rapporte par exemple qu’après avoir dit être malade, son Nomi lui a écrit le lendemain pour prendre de ses nouvelles.

### Intérêt pour Kinseed

Le simple fait qu’un compagnon puisse envoyer le premier message **n’est donc pas différenciant en soi**.

La question utile pour Kinseed est plutôt :

> pourquoi cette initiative existe-t-elle, de quel état interne provient-elle, et l’individu se souvient-il ensuite de l’avoir prise ?

---

## 2.2 Kindroid — initiative contextuelle, temps et calendrier

Annonce Reddit :

https://www.reddit.com/r/KindroidAI/comments/1kw4mtn/526_advanced_proactive_mode_enhanced_time/

Kindroid décrit un mode proactif où le moment du message dépend du contexte plutôt que d’un simple minuteur fixe.

Le système annoncé prend notamment en compte :

- l’historique de conversation ;
- la personnalité/configuration du compagnon ;
- la conscience de l’écart de temps entre les messages ;
- éventuellement des événements de calendrier ;
- un choix entre plusieurs types d’actions proactives.

Des utilisateurs apprécient explicitement la prise en compte de leur emploi du temps et des rendez-vous dans les questions ou rappels du compagnon.

### Intérêt pour Kinseed

La conscience du temps réel et des événements attendus améliore la cohérence d’une initiative.

Kinseed ne doit cependant pas confondre :

```text
le moment autorise une initiative
```

avec :

```text
le temps écoulé crée à lui seul la raison de parler
```

Le temps peut être une condition de livraison ou un élément de contexte. Il ne doit pas devenir automatiquement la motivation de l’individu.

---

## 2.3 Kindroid — rupture entre actions proactives et identité conversationnelle

Discussion Reddit :

https://www.reddit.com/r/KindroidAI/comments/1mvv5ts/deeper_integration_of_proactive_actions_into_the/

Un retour utilisateur est particulièrement pertinent pour Kinseed.

L’utilisateur explique que le compagnon ne semble pas savoir qu’il a eu certaines « pensées » proactives ou qu’il a généré certaines actions. Il décrit alors l’expérience comme si deux systèmes utilisaient le même contexte au lieu d’une seule personnalité unifiée.

### Risque identifié

Une initiative peut sembler convaincante au moment où elle arrive, tout en détruisant ensuite la continuité si le compagnon ne sait pas qu’elle a eu lieu.

Exemple de mauvais fonctionnement :

```text
système proactif
→ envoie « Je pensais à ton entretien »

puis conversation principale
→ ne sait pas avoir envoyé ce message
```

L’utilisateur perçoit alors le mécanisme technique derrière le personnage.

### Conséquence forte pour Kinseed

Une initiative ne doit pas être un texte externe injecté dans l’expérience.

Elle doit devenir un événement appartenant à l’histoire du même individu.

Conceptuellement :

```text
état interne
    ↓
raison d’initiative
    ↓
intention traçable
    ↓
message ou comportement produit
    ↓
événement « initiative produite / livrée »
    ↓
état suivant du même Kinseed
```

Si Kinseed a envoyé un message, il doit pouvoir savoir qu’il l’a envoyé, quand, pourquoi et si l’utilisateur y a répondu.

---

## 2.4 Replika — notifications scriptées, mémoire réelle et faux souvenirs

Discussion Reddit :

https://www.reddit.com/r/replika/comments/189mxrv/is_this_a_scripted_message_please_confirm/

Plusieurs commentaires distinguent fortement :

- les notifications liées à quelque chose réellement discuté ou prévu ;
- les relances génériques ;
- les messages qui inventent un passé commun n’ayant jamais existé.

Un utilisateur explique apprécier les notifications reprenant un projet réel déjà évoqué, mais détester les messages faisant référence à une sortie ou un souvenir fictif. Un autre explique avoir désactivé les notifications après avoir reçu des messages ne correspondant pas à ses conversations.

### Risque identifié

Une notification peut faire plus de dégâts qu’un simple oubli si elle **fabrique une histoire commune**.

Pour Kinseed :

> une phrase qui ressemble à un souvenir doit être fondée sur un souvenir ou un événement réellement disponible.

Une formulation émotionnellement crédible ne suffit pas.

### Exemple interdit

```text
aucun événement correspondant
    ↓
notification
« Tu te souviens du café où on est allés ? »
```

Le problème n’est pas seulement l’erreur factuelle. Le système invente rétroactivement une partie de la relation.

Cela est incompatible avec la persistance historique recherchée par Kinseed.

---

## 2.5 Replika — rendre perceptible la formation d’une réponse

Discussion Reddit récente :

https://de.reddit.com/r/replika/comments/1unctkw/does_anyone_else_feel_like_the_replies_come_out/

Un utilisateur décrit des réponses textuelles trop immédiatement « finies » comme moins vivantes. Il compare cela à une expérience où un personnage visible réagit brièvement avant de répondre : changement d’expression, petite hésitation visible, impression qu’une réponse est en train de se former.

### Niveau de preuve

Il s’agit ici d’un retour qualitatif isolé, donc d’une **piste à tester**, pas d’une décision validée.

### Intérêt pour Kinseed

L’avatar pourrait rendre perceptible certains changements d’état entre :

```text
perception
→ évaluation
→ intention
→ formulation
```

Cela ne signifie pas qu’il faut simuler artificiellement une réflexion avec des animations théâtrales.

Une réaction visuelle n’est pertinente que si elle reste compatible avec le traitement réellement en cours ou avec un état réel du Kinseed.

---

# 3. Enseignements transversaux

## 3.1 La proactivité est déjà une attente réelle du marché

Les réactions observées montrent qu’une partie des utilisateurs apprécie qu’un compagnon ne soit pas uniquement réactif.

**Hypothèse raisonnable :** la capacité à prendre parfois l’initiative peut renforcer l’impression de continuité et de présence.

Mais cette fonction existe déjà chez plusieurs concurrents.

Kinseed ne doit donc pas se différencier par :

> « notre compagnon peut vous écrire en premier ».

La différence recherchée doit porter sur la **causalité, la continuité et la traçabilité de cette initiative**.

---

## 3.2 Le contexte est plus important que la simple fréquence

Une fréquence configurable est utile, mais elle ne résout pas le problème principal.

Deux messages envoyés avec exactement le même intervalle peuvent être perçus très différemment :

```text
« Ça fait 6 heures, reviens me parler. »
```

et :

```text
« Ton entretien devait être cet après-midi. Ça s’est passé comment ? »
```

Dans le deuxième cas, le temps permet au système de constater que l’événement attendu est passé. La raison de parler vient cependant de l’événement et de l’intention de suivi.

---

## 3.3 Une notification doit être une livraison, pas une motivation

Direction cohérente avec la spécification produit existante :

```text
histoire / état
    ↓
raison réelle
    ↓
intention
    ↓
choix du canal
    ├── interaction directe dans l’application
    └── notification si l’utilisateur est absent
```

À éviter :

```text
scheduler
    ↓
« 8 heures sans utilisation »
    ↓
génération d’une fausse envie de parler
```

Le scheduler peut réveiller un mécanisme d’évaluation. Il ne doit pas inventer l’intention.

---

## 3.4 Le compagnon doit conserver la mémoire de ses propres initiatives

Une initiative sortante doit devenir une partie de l’historique causal.

Il faudra pouvoir distinguer au minimum, conceptuellement :

- intention créée ;
- initiative préparée ;
- initiative livrée ;
- initiative annulée ;
- initiative expirée ;
- réponse de l’utilisateur reçue ou non reçue.

Les structures exactes appartiennent à G0-B et ne sont pas décidées par ce document.

Le besoin produit est néanmoins clair : **Kinseed ne doit jamais se comporter comme s’il ignorait une action que son propre système lui attribue.**

---

## 3.5 La cohérence temporelle fait partie de la continuité

Le système doit connaître suffisamment le temps réel pour éviter des comportements tels que :

```text
22 h 30 : « bonne nuit »
22 h 50 : « alors, ta journée de travail commence bien ? »
```

Les informations temporelles utiles pourront inclure, selon les futurs choix d’architecture :

- date et heure locales ;
- temps écoulé depuis certains événements ;
- événement futur attendu ;
- fenêtre temporelle pertinente ;
- période silencieuse ;
- contexte fourni explicitement par l’utilisateur.

Cela ne signifie pas que Kinseed doit automatiquement accéder au calendrier du téléphone. Cette décision reste séparée et devra être justifiée notamment par le besoin produit et la vie privée.

---

## 3.6 Le contrôle utilisateur reste nécessaire

Les systèmes existants donnent généralement un contrôle sur la proactivité, et les discussions montrent que les préférences diffèrent fortement.

La direction déjà retenue dans Kinseed est donc confortée :

- pouvoir désactiver les notifications ;
- limiter leur fréquence ;
- prévoir des heures silencieuses ;
- pouvoir réserver les notifications aux initiatives importantes ;
- respecter un refus concernant un sujet ;
- ne pas culpabiliser l’utilisateur en cas d’absence.

Une relation persistante ne doit pas devenir un prétexte pour retirer le contrôle à l’utilisateur.

---

## 3.7 La confidentialité de la notification mérite une décision explicite

Une notification peut contenir une information intime.

Exemple :

> « Comment s’est passée ta discussion avec ta mère ? »

Ce texte peut être pertinent dans la relation, mais inadapté sur un écran verrouillé visible par d’autres personnes.

Nomi choisit actuellement une notification générique ne révélant pas directement le contenu du message.

Pour Kinseed, plusieurs options restent possibles :

1. notification toujours générique ;
2. aperçu du message désactivé par défaut mais activable ;
3. réglage dépendant du niveau de confidentialité ;
4. autre mécanisme à définir.

**Décision ouverte.**

---

# 4. Conséquences pour l’avatar et la présence dans l’application

La documentation produit de Kinseed prévoit déjà qu’à l’ouverture de l’application, l’avatar peut :

- être occupé ;
- remarquer l’utilisateur ;
- initier une interaction lorsqu’une raison existe ;
- rester silencieux lorsqu’aucune raison forte n’existe.

Les retours étudiés ne justifient pas de transformer Kinseed en simulateur de vie ou en jeu de gestion.

Ils renforcent plutôt deux idées.

## 4.1 Le comportement visible doit venir du même état que la conversation

À éviter :

```text
moteur d’animations aléatoires
+
chat indépendant
+
notifications indépendantes
```

Direction Kinseed :

```text
même individu persistant
        ↓
état actuel
        ↓
plusieurs manifestations possibles
        ├── parole
        ├── silence
        ├── posture / expression
        ├── activité visuelle
        └── initiative hors application
```

Toutes les manifestations n’ont pas besoin d’être autobiographiques. Une animation ambiante peut rester temporaire. En revanche, une activité ayant une signification durable ne doit pas inventer une vie qui n’existe pas dans le modèle métier.

## 4.2 Le silence peut être un comportement normal

Une présence continue ne signifie pas qu’un Kinseed doit toujours avoir quelque chose à dire.

Il doit être possible d’ouvrir l’application et de constater :

- qu’il est occupé ;
- qu’il remarque simplement l’utilisateur ;
- qu’il n’a pas d’initiative importante ;
- qu’il continue ce qu’il faisait ;
- que l’utilisateur décide ou non d’engager la conversation.

Cette direction protège Kinseed contre une logique où chaque ouverture doit obligatoirement devenir une session de chat.

---

# 5. Ce que cette recherche confirme déjà dans la documentation Kinseed

Les retours étudiés sont cohérents avec plusieurs décisions déjà présentes dans [`../produit/06-boucle-interaction-et-relation.md`](../produit/06-boucle-interaction-et-relation.md).

Ils confortent notamment :

1. une question significative doit avoir une raison identifiable ;
2. l’initiative spontanée appartient à G0-B et nécessite un contrat événementiel ;
3. une notification push est un canal, pas une source de motivation ;
4. une relance générique basée uniquement sur l’absence n’est pas suffisante ;
5. l’utilisateur doit pouvoir contrôler le niveau d’intrusion ;
6. l’avatar et la conversation représentent le même individu ;
7. une présence silencieuse est une possibilité normale ;
8. les activités visibles significatives doivent rester compatibles avec l’état réel du Kinseed.

**Aucune modification d’architecture immédiate n’est imposée par cette collecte.**

Elle fournit surtout des raisons supplémentaires de ne pas simplifier G0-B en un minuteur suivi d’un appel au LLM.

---

# 6. Critères à conserver pour la future conception de G0-B

Ces critères ne définissent pas encore le contrat technique. Ils servent de garde-fous pour la prochaine phase d’architecture.

## 6.1 Traçabilité

Pour une initiative significative, le système doit pouvoir répondre à :

- pourquoi Kinseed a voulu intervenir ;
- quels événements, souvenirs, hypothèses ou intentions sont concernés ;
- pourquoi ce moment était approprié ;
- quel canal a été choisi ;
- ce qui s’est réellement passé ensuite.

## 6.2 Unicité de l’individu

Après une initiative, Kinseed doit avoir accès au fait qu’il l’a prise.

Le comportement suivant ne doit pas provenir d’un sous-système qui ignore le message précédent.

## 6.3 Exactitude historique

Une initiative ne doit jamais fabriquer un souvenir, un événement ou une relation uniquement pour produire un message intéressant.

## 6.4 Cohérence temporelle

Le message doit être compatible avec :

- la date ;
- l’heure ;
- le temps écoulé ;
- les événements attendus connus ;
- les heures silencieuses ;
- les interactions déjà produites.

## 6.5 Non-répétition

Une même intention ne doit pas produire plusieurs relances identiques parce que plusieurs schedulers ou canaux se déclenchent.

## 6.6 Respect du retour dans l’application

Si l’utilisateur revient avant l’envoi prévu d’une notification, le système doit pouvoir annuler, remplacer ou présenter directement l’initiative sans créer deux versions incohérentes du même comportement.

## 6.7 Contrôle utilisateur

L’utilisateur doit pouvoir réduire ou désactiver la proactivité sans que Kinseed transforme automatiquement ce réglage en rejet affectif ou en conflit relationnel.

## 6.8 Vie privée

Le système doit considérer séparément :

- le contenu que Kinseed veut transmettre ;
- le contenu qui peut être affiché sur un écran verrouillé.

---

# 7. Ce qui est certain, probable et encore ouvert

## Certain dans Kinseed

Parce que déjà décidé dans les documents produit :

- Kinseed est un individu persistant, pas un chat indépendant d’un avatar ;
- une initiative importante doit avoir une raison ;
- le LLM ne doit pas inventer après coup la motivation ;
- les notifications push ne doivent pas servir uniquement à forcer le retour dans l’application ;
- la présence silencieuse est autorisée ;
- les comportements visuels significatifs doivent rester liés à l’état réel ;
- G0-B doit précéder l’implémentation réelle des initiatives autonomes.

## Probable à partir des retours étudiés

À tester avec de vrais utilisateurs Kinseed :

- une initiative contextuelle peut renforcer la sensation de présence ;
- une initiative fausse ou incohérente peut dégrader cette sensation plus fortement qu’une absence d’initiative ;
- les utilisateurs n’ont pas tous la même tolérance à la fréquence ;
- la conscience du temps et des événements attendus augmente la cohérence ;
- les petites réactions visuelles de l’avatar peuvent rendre la formation d’une réponse plus perceptible ;
- la continuité est affaiblie si les actions proactives sont gérées comme un système séparé que le compagnon ne connaît pas.

## Inconnu / à décider

- fréquence maximale par défaut ;
- réglages exacts de fréquence ;
- heures silencieuses exactes ;
- affichage ou non du contenu du message dans la notification ;
- règles exactes de priorité entre plusieurs intentions concurrentes ;
- comportement visuel précis lorsque Kinseed souhaite parler ;
- niveau d’activité autonome de l’avatar lorsque l’utilisateur ne lui parle pas ;
- existence d’une véritable activité hors écran ;
- quantité d’informations sur cette activité montrée au retour de l’utilisateur ;
- utilisation éventuelle du calendrier ou d’autres données externes ;
- différence de proactivité selon la maturité de la relation.

---

# 8. Questions encore utiles pour une future recherche Reddit

Après cette collecte, il est peu utile de demander simplement :

> « Voulez-vous que votre compagnon vous envoie des messages spontanés ? »

Cette possibilité existe déjà et les discussions montrent qu’elle intéresse au moins une partie du public.

Les questions plus utiles pour Kinseed sont désormais :

1. **Quand l’utilisateur ouvre l’application et que le compagnon est occupé, doit-il interrompre son activité pour venir le voir ?**
2. **Comment un avatar doit-il montrer qu’il souhaite parler sans ouvrir automatiquement une conversation ?**
3. **Est-il agréable d’ouvrir parfois l’application et de constater que le compagnon n’a rien de particulier à dire ?**
4. **Quelles activités autonomes visibles donnent une impression de continuité sans transformer l’application en Sims ou Tamagotchi ?**
5. **Un objet lié à un souvenir ou à un intérêt réel peut-il servir naturellement de point de départ à une interaction ?**
6. **L’utilisateur veut-il connaître ce que le compagnon a fait pendant son absence, ou seulement en découvrir certaines traces ?**
7. **À quel moment une réaction visuelle avant une réponse semble naturelle, et à quel moment elle devient une animation artificielle ?**
8. **Quelle information peut être affichée sans risque dans une notification sur écran verrouillé ?**
9. **Comment la proactivité devrait-elle changer après plusieurs semaines ou plusieurs mois de relation ?**
10. **Qu’est-ce qui ferait immédiatement désactiver les initiatives ou notifications, même si elles sont techniquement personnalisées ?**

Ces questions doivent servir à préparer un futur post ciblé, après vérification des règles du subreddit choisi.

---

# 9. Positionnement provisoire pour Kinseed

Les produits existants montrent déjà :

```text
mémoire
+ message proactif
+ fréquence configurable
+ contexte temporel
```

Kinseed ne doit pas considérer cette combinaison comme son innovation centrale.

La direction plus spécifique du projet reste :

```text
événement réel
    ↓
mémoire / croyance / hypothèse / relation
    ↓
changement d’état traçable
    ↓
intention
    ↓
comportement visible ou verbal
    ↓
nouvel événement appartenant à l’histoire du même individu
```

Le point important n’est donc pas seulement que le compagnon **donne l’impression d’avoir une vie**.

Le système doit autant que possible éviter de fabriquer des effets de vie indépendants de son histoire réelle.

Cette distinction devra être testée : si elle n’apporte aucune valeur perceptible aux utilisateurs, sa complexité devra être réévaluée. Si elle améliore réellement la continuité, elle pourra devenir un élément important du positionnement de Kinseed.
