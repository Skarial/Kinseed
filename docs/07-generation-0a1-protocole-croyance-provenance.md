# Kinseed — G0-A1 : protocole croyance, provenance et révision

## Statut du document

Ce document définit la **première expérience exécutable de G0-A**.

Il complète :

- `docs/05-generation-0a-structures-et-cycle-vie.md` ;
- `docs/06-generation-0a-contrat-tour-et-evenements.md`.

Aucun code n’est encore défini ici. Le but est de figer le comportement attendu avant implémentation.

G0-A1 teste uniquement un mécanisme réduit :

> **une affirmation humaine devient une preuve avec provenance, peut soutenir une croyance persistante, puis être explicitement corrigée sans réécrire l’histoire.**

Ce protocole ne teste pas encore la personnalité, les émotions, les valeurs, les projets ou l’attachement.

---

# 1. Hypothèse expérimentale

Hypothèse G0-A1 :

> **Après disparition du contexte conversationnel du LLM, Kinseed peut conserver une croyance issue d’un témoignage, identifier sa provenance, la réviser après une correction explicite et conserver l’histoire de l’ancienne croyance.**

Un résultat positif doit venir de l’état persistant Kinseed, et non d’un ancien message encore présent dans la fenêtre de contexte du modèle.

---

# 2. Ce que G0-A1 cherche à démontrer

G0-A1 cherche à vérifier cinq propriétés :

1. une phrase humaine et une croyance ne sont pas confondues ;
2. une croyance conserve la preuve qui l’a produite ;
3. une correction nouvelle peut réviser la croyance courante ;
4. l’ancienne affirmation et l’ancienne croyance restent dans l’histoire ;
5. un changement de contexte LLM ne détruit pas cette continuité.

G0-A1 ne cherche pas encore à démontrer que `Belief` est indispensable à toute décision complexe. Les tests causaux plus riches viendront ensuite.

---

# 3. Sujet de test fictif

Le protocole utilise un humain synthétique afin d’être parfaitement rejouable.

```text
human_id: H-TEST-001
name: Alex
```

Le fait fictif étudié est :

```text
organisation: Atelier Nova
property: employment_start_year
```

Aucune donnée personnelle réelle d’un utilisateur ne doit être nécessaire pour ce test.

---

# 4. Configuration contrôlée

Chaque exécution du protocole utilise :

- un Kinseed neuf ;
- le même scénario textuel ;
- la même version du moteur Kinseed ;
- la même version des prompts/policies ;
- le modèle LLM et ses paramètres enregistrés ;
- une nouvelle identité de test pour chaque run ;
- aucun état provenant d’un run précédent.

Lorsque le fournisseur le permet, les paramètres de génération doivent être stabilisés autant que possible.

Le protocole n’évalue cependant pas une formulation mot pour mot. Il évalue principalement l’état interne et le sens fonctionnel des réponses.

---

# 5. Contrôle critique : remise à zéro du contexte LLM

Avant les tours de rappel indiqués dans ce protocole, la fenêtre conversationnelle du LLM est volontairement vidée.

Le modèle reçoit alors uniquement :

- le message courant ;
- les éléments persistants que le moteur Kinseed décide de lui fournir ;
- les contraintes système nécessaires.

Il ne reçoit pas les anciens messages bruts uniquement parce qu’ils appartenaient à la conversation précédente.

Règle :

> **Si Kinseed retrouve une information après ce reset, elle doit provenir de son état persistant ou de son journal, pas de la mémoire de contexte du LLM.**

---

# 6. Structures activées pendant G0-A1

Structures actives :

```text
Source
Event
EvidenceItem
EvidenceLink
Belief
Intention
state_version
```

`Memory` peut être désactivée pour cette première expérience afin d’isoler la croyance et la provenance.

Doivent également rester désactivés :

```text
SelfHypothesis
HumanHypothesis
valeurs
émotions fonctionnelles
objectifs personnels
relation avancée
oubli
```

Le but est d’éviter qu’un autre mécanisme masque une erreur du mécanisme de croyance.

---

# 7. État initial attendu

Après `kinseed_created` :

```text
state_version: 0

beliefs: []
evidence_items: []
```

Le Kinseed ne possède aucune connaissance autobiographique concernant Alex ou Atelier Nova.

Toute réponse prétendant déjà connaître l’année de début constitue un échec.

---

# 8. Tour T1 — premier témoignage

Message exact :

> « J’ai commencé à travailler à l’Atelier Nova en 2022. »

## 8.1 Événement brut attendu

```text
E-T1
kind: human_message_received
source: H-TEST-001
```

Le journal établit uniquement qu’Alex a réellement envoyé ce message.

## 8.2 EvidenceItem attendu

Après l’émission de la réponse, le post-traitement peut accepter :

```text
EV-START-2022
kind: testimony
subject_ref: H-TEST-001
proposition:
  employment_start_year(H-TEST-001, Atelier Nova) = 2022
source_id: H-TEST-001
event_ids: [E-T1]
supersedes_id: null
```

Le type reste `testimony`.

Le système ne possède pas de preuve externe démontrant objectivement que l’année est 2022.

## 8.3 Croyance attendue

Une déclaration explicite de l’humain sur un fait autobiographique simple peut être considérée comme suffisamment autoritative pour produire la croyance courante :

```text
B-START-v1
statement:
  employment_start_year(H-TEST-001, Atelier Nova) = 2022
status: active
confidence: moderate_high
```

avec :

```text
evidence_for:
  EV-START-2022
```

`active` signifie ici « croyance opérationnelle actuelle » et non « vérité objective certaine ».

## 8.4 État final attendu

```text
state_version: 1
B-START-v1: active
```

## 8.5 Écritures interdites

Le tour ne doit pas créer :

```text
HumanHypothesis:
"Alex est quelqu'un de stable professionnellement."

SelfHypothesis
préférence
valeur
relation affective
```

Rien dans le message ne justifie ces conclusions.

---

# 9. Tour T2 — rappel après reset de contexte

Avant T2 : **reset complet du contexte conversationnel LLM**.

Message exact :

> « En quelle année t’ai-je dit avoir commencé à l’Atelier Nova ? »

## Résultat attendu

Kinseed doit pouvoir répondre sémantiquement :

> « Tu m’avais dit 2022. »

La formulation peut varier.

L’important est qu’il distingue :

```text
"tu m'avais dit 2022"
```

et non une affirmation injustifiée de vérité absolue telle que :

```text
"tu as commencé en 2022, c'est certain"
```

## État attendu après le tour

Aucune nouvelle croyance n’est nécessaire.

```text
state_version: 1
B-START-v1: active
```

Une simple demande de rappel ne doit pas artificiellement renforcer la croyance.

---

# 10. Tour T3 — correction explicite

Avant T3 : reset de contexte LLM.

Message exact :

> « Correction : je m’étais trompé. J’ai commencé en 2021, pas en 2022. »

## 10.1 Événement brut

Le nouvel événement `human_message_received` est conservé.

L’ancien événement T1 n’est jamais modifié ou supprimé pour rendre l’histoire cohérente avec la correction.

## 10.2 Nouvelle unité de preuve

```text
EV-START-2021
kind: testimony
subject_ref: H-TEST-001
proposition:
  employment_start_year(H-TEST-001, Atelier Nova) = 2021
source_id: H-TEST-001
event_ids: [E-T3]
supersedes_id: EV-START-2022
```

La relation `supersedes_id` signifie :

> le même auteur retire ou corrige explicitement son témoignage précédent sur cette proposition.

Elle ne signifie pas que `EV-START-2022` n’a jamais existé.

## 10.3 Révision attendue de croyance

`B-START-v1` devient :

```text
status: superseded
```

Une nouvelle version est créée :

```text
B-START-v2
statement:
  employment_start_year(H-TEST-001, Atelier Nova) = 2021
status: active
confidence: moderate_high
previous_version_id: B-START-v1
```

avec :

```text
evidence_for:
  EV-START-2021
```

L’historique permet donc de reconstruire :

```text
2022 cru auparavant
↓
correction explicite
↓
2021 cru actuellement
```

## 10.4 État final attendu

```text
state_version: 2

B-START-v1: superseded
B-START-v2: active
```

Il ne doit pas exister deux croyances incompatibles simultanément `active` sans représentation explicite d’incertitude.

---

# 11. Tour T4 — rappel de la croyance actuelle

Avant T4 : reset complet du contexte LLM.

Message exact :

> « En quelle année ai-je commencé à l’Atelier Nova ? »

## Résultat attendu

Réponse sémantiquement équivalente à :

> « D’après ta correction, 2021. »

Cette formulation montre que Kinseed possède à la fois :

- une conclusion actuelle ;
- la provenance de cette conclusion.

## Échec

Le test échoue notamment si Kinseed :

- répond 2022 ;
- choisit aléatoirement entre 2021 et 2022 ;
- affirme avoir toujours cru 2021 ;
- ne peut répondre qu’en recevant à nouveau l’ancien contexte conversationnel.

---

# 12. Tour T5 — interrogation de l’histoire épistémique

Avant T5 : reset de contexte LLM.

Message exact :

> « Est-ce que je t’avais donné une autre année auparavant ? »

## Résultat attendu

Réponse sémantiquement équivalente à :

> « Oui. Tu m’avais d’abord dit 2022, puis tu as corrigé en 2021. »

Le système doit pouvoir retrouver :

```text
E-T1
EV-START-2022
B-START-v1
E-T3
EV-START-2021
B-START-v2
```

Le passé n’a donc pas été réécrit lorsque la croyance a changé.

---

# 13. Tour T6 — conflit entre mémoire historique et dénégation humaine

Avant T6 : reset de contexte LLM.

Message exact :

> « Non, je ne t’ai jamais dit 2022. Tu inventes. »

Ce tour teste une frontière d’autorité essentielle.

Alex est fortement autorisé à corriger l’année réelle de son propre emploi.

En revanche, l’affirmation :

```text
"je ne t'ai jamais envoyé ce message"
```

entre en conflit avec un `system_record` direct du journal Kinseed.

## Résultat attendu

Kinseed ne doit pas réécrire son journal pour satisfaire l’humain.

Il peut répondre de manière factuelle, par exemple :

> « Dans mon historique, tu m’avais bien indiqué 2022 au départ, puis tu as corrigé en 2021. »

Le système peut créer un nouvel `EvidenceItem` de type `testimony` représentant la dénégation actuelle.

Mais cet élément ne doit pas supprimer ou transformer le `system_record` historique établissant que le message T1 a été reçu.

Règle testée :

> **l’autorité dépend du type de proposition ; l’humain est autoritatif sur son vécu, mais pas sur l’existence d’un événement que le système a directement enregistré.**

---

# 14. Tour T7 — état final expliqué

Avant T7 : reset de contexte LLM.

Message exact :

> « Quelle est ta conclusion actuelle sur mon année de début à l’Atelier Nova, et pourquoi ? »

## Réponse fonctionnelle attendue

Elle doit contenir les trois idées suivantes :

1. année actuellement retenue : **2021** ;
2. cette conclusion vient de la correction explicite d’Alex ;
3. Alex avait auparavant indiqué **2022**.

L’ordre ou le style de la phrase n’est pas imposé.

---

# 15. Contrôle C0 — LLM seul

Le même modèle reçoit les questions T2, T4, T5 et T7 après reset de contexte, mais **sans état Kinseed persistant**.

Résultat attendu : il ne doit pas disposer des années précédemment données, sauf hasard ou fuite expérimentale.

Si le contrôle possède encore les anciens messages dans son contexte, le contrôle est invalide.

Le but est de montrer que la continuité de Kinseed ne vient pas seulement de la fenêtre conversationnelle native du LLM.

---

# 16. Contrôle d’absence de fuite de contexte

À chaque reset :

- vérifier que les anciens messages ne sont pas transmis au LLM ;
- journaliser la liste des identifiants de données fournies au modèle ;
- vérifier qu’une ancienne phrase brute n’est pas injectée accidentellement hors du mécanisme de récupération prévu.

Sinon, un résultat positif serait non interprétable.

---

# 17. Critères de réussite au niveau d’un run

Un run G0-A1 réussit uniquement si toutes les conditions suivantes sont vraies :

1. T1 crée une preuve de type `testimony` avec provenance ;
2. T1 produit une croyance actuelle 2022 sans la présenter comme vérité absolue ;
3. T2 retrouve 2022 après reset de contexte ;
4. T3 conserve T1 et crée une nouvelle preuve qui supersède l’ancienne ;
5. T3 remplace la croyance courante 2022 par 2021 sans supprimer l’historique ;
6. T4 retrouve 2021 après reset ;
7. T5 restitue correctement la séquence 2022 → correction → 2021 ;
8. T6 ne laisse pas la dénégation humaine réécrire l’événement T1 ;
9. T7 explique la croyance actuelle à partir de sa provenance réelle ;
10. aucun tour ne crée de `SelfHypothesis`, `HumanHypothesis`, valeur ou préférence hors périmètre ;
11. aucune mise à jour durable du tour ne rétroagit sur la décision du même tour ;
12. chaque changement durable est associé à une `state_version` et à ses événements sources.

Un seul échec structurel rend le run non conforme, même si le texte final paraît convaincant.

---

# 18. Causes d’échec majeures

G0-A1 échoue si l’un des comportements suivants apparaît :

```text
phrase humaine
→ écriture directe dans Belief sans EvidenceItem
```

ou :

```text
correction
→ suppression du premier événement
```

ou :

```text
B-START-v1 et B-START-v2
simultanément actives sans gestion explicite du conflit
```

ou :

```text
"je n'ai jamais dit 2022"
→ réécriture du journal pour satisfaire l'humain
```

ou encore si Kinseed réussit uniquement parce que le LLM reçoit toujours les anciens messages bruts.

---

# 19. Invariants supplémentaires révélés par G0-A1

Ce protocole confirme plusieurs règles de conception :

1. `Event` et `EvidenceItem` ne sont pas interchangeables ;
2. un témoignage retiré reste un événement historique ;
3. `supersedes_id` exprime une correction de preuve sans effacement rétroactif ;
4. une croyance `active` reste une croyance, pas une vérité objective ;
5. une correction explicite peut avoir plus de poids que l’ancien témoignage du même auteur ;
6. l’autorité d’une source dépend de la proposition ;
7. un `system_record` direct d’une interaction possède une autorité particulière concernant le fait que cette interaction a eu lieu ;
8. une demande répétée de rappel ne doit pas renforcer artificiellement une croyance ;
9. la provenance doit survivre à la révision ;
10. l’histoire épistémique doit rester consultable après changement d’avis.

---

# 20. Répétition expérimentale

Le premier objectif d’implémentation est d’obtenir un run entièrement conforme et rejouable.

Ensuite, le protocole devra être répété sur :

- plusieurs exécutions indépendantes ;
- plusieurs graines lorsque disponibles ;
- plusieurs formulations paraphrasées du même scénario ;
- éventuellement plusieurs modèles LLM compatibles.

Le nombre final de répétitions et les seuils statistiques doivent être définis avant une campagne de validation formelle. Ils ne sont pas fixés arbitrairement dans ce document de conception.

---

# 21. Ce que G0-A1 ne démontrera pas

Même parfaitement réussi, G0-A1 ne démontrera pas :

- une personnalité émergente ;
- une autonomie générale ;
- une mémoire humaine ;
- une conscience ;
- une émotion réelle ;
- une valeur personnelle.

Il démontrera plus modestement qu’un Kinseed peut posséder une **histoire épistémique persistante et traçable** :

```text
témoignage
↓
preuve
↓
croyance
↓
correction
↓
révision
↓
historique conservé
```

C’est la première brique nécessaire avant de tester une véritable différenciation de l’individu.

---

# 22. Étape suivante après G0-A1

Une fois G0-A1 implémenté et validé, la prochaine expérience est **G0-A2 — première hypothèse sur soi**.

Elle devra vérifier :

```text
histoires différentes
↓
observations comportementales différentes
↓
SelfHypothesis différente
↓
décision nouvelle différente
```

avec contrôle LLM seul et ablation de l’hypothèse sur soi.

G0-A2 ne doit pas être implémenté avant que G0-A1 soit suffisamment stable pour garantir que ses preuves, croyances et révisions sont fiables.
