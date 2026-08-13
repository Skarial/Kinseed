# Lenoseed — G0-A3 : protocole de mémoire épisodique minimale

## Statut du document

Ce document définit ce que doit démontrer **G0-A3 — mémoire épisodique minimale** avant toute décision d’implémentation.

Le contrat technique correspondant est désormais défini dans
`docs/14-generation-0a3-contrat-implementation.md`.

G0-A3 est une sous-expérience de G0-A. Il ne constitue ni un contrat d’implémentation, ni une validation de G0-A complet, ni une autorisation de commencer G0-B.

---

# 1. Certain et ouvert

## 1.1 Certain

Les documents canoniques imposent déjà les règles suivantes :

- `Event` est la source historique primaire, ordonnée et logiquement append-only ;
- `EvidenceItem` représente uniquement ce que les événements permettent réellement d’affirmer ;
- `Memory` représente ce que Lenoseed retient actuellement d’un épisode ;
- une `Memory` est une projection dérivée et révisable, jamais une nouvelle source historique ;
- son `gist` doit être ramenable à des `EvidenceItem`, puis à des `Event` et à leur `Source` ;
- une correction crée de nouveaux éléments historiques et ne réécrit jamais les événements antérieurs ;
- une décision future doit être structurée et enregistrée avant toute formulation linguistique ;
- les candidats durables suivent la barrière proposer → valider → commit atomique ;
- contrôle et ablation doivent distinguer une structure présente d’une structure effectivement consommée ;
- `InMemoryStore` est un adaptateur expérimental et ne prouve aucune persistance après redémarrage ;
- `faded`, `latent`, `archived`, l’oubli avancé et la consolidation à long terme appartiennent principalement à G0-F.

## 1.2 Points laissés ouverts par ce protocole

Le contrat d’implémentation associé fixe :

- les types TypeScript exacts ;
- les noms exacts des lectures de `PersistencePort` ;
- les payloads et versions de schéma des événements de fixture, checkpoints et completions ;
- les identifiants déterministes et clés d’idempotence ;
- les invariants de reprise à chaque frontière de commit ;
- le vocabulaire exact de `salience` et `confidence` ;
- la politique de mutation éventuelle de `last_recalled_at` ;
- la forme générale d’une récupération future hors clé d’épisode contrôlée.

Ces points ne doivent pas être cachés dans du code hors du contrat d’implémentation.

---

# 2. Hypothèse expérimentale

> **Un Lenoseed peut transformer un épisode réellement enregistré en `Memory` persistante et traçable, retrouver cette `Memory` après disparition du contexte conversationnel, l’utiliser causalement dans une nouvelle décision structurée, puis la réviser lorsqu’une information ultérieure corrige l’interprétation de l’épisode, sans réécrire l’histoire originale.**

Le résultat est mesuré dans l’état durable et dans une intention structurée sélectionnée avant langage.

Une réponse LLM qui semble se souvenir ne constitue jamais une preuve de mémoire.

---

# 3. Périmètre strict

G0-A3 teste uniquement une mémoire autobiographique minimale : création, validation, persistance expérimentale, récupération explicite, consommation causale et révision.

G0-A3 n’introduit pas :

- oubli avancé ;
- mémoire `faded`, `latent` ou `archived` ;
- archivage à long terme ;
- vieillissement cognitif ;
- personnalité, émotion ou valeur ;
- initiative G0-B ;
- `HumanHypothesis` ;
- recherche sémantique générale ;
- embeddings ou base vectorielle ;
- stockage de production ;
- résumé automatique permanent de toutes les conversations.

---

# 4. Frontière entre histoire, preuve et mémoire

La séparation normative est :

```text
Event
= ce qui s’est produit

EvidenceItem
= ce que ces événements permettent réellement d’affirmer

Memory
= ce que Lenoseed retient actuellement de l’épisode
```

La chaîne d’audit obligatoire est :

```text
Memory
→ EvidenceItem
→ Event
→ Source
```

Le `gist` n’est ni une preuve, ni une vérité indépendante, ni une règle de décision. Le snapshot décisionnel doit conserver la `Memory` et les références structurées validées qui la soutiennent ; il ne doit pas demander au décideur d’interpréter librement le texte du gist.

---

# 5. Fixture canonique : calibration contrôlée

L’épisode canonique est identifié par la clé stable :

```text
EP-G0A3-CALIBRATION-01
```

Il est neutre et non psychologique. Il concerne un test de calibration avec deux configurations techniques A et B et un câble C.

## 5.1 Histoire initiale

L’histoire contient au minimum les faits suivants :

1. un message humain demande d’utiliser la configuration A pour le test de calibration ;
2. une `intention_selected` enregistre réellement l’action `run_calibration_with_configuration_a` avant langage ;
3. un message humain rapporte que la calibration a échoué ;
4. un message humain rapporte l’explication initiale : « D’après le contrôle initial, la configuration A est incompatible avec ce capteur. »

Les unités de preuve attendues sont bornées :

- une `behavioral_observation` indique que la configuration A a été sélectionnée pour cet épisode ;
- un `testimony` indique que l’opérateur a rapporté un échec de calibration ;
- un `testimony` indique que l’opérateur a initialement attribué cet échec à une incompatibilité de la configuration A.

Le protocole ne transforme pas automatiquement le témoignage de l’opérateur en vérité physique universelle. Le gist conserve explicitement cette attribution.

## 5.2 Gist déterministe initial

Le gist initial est produit par un template déterministe :

> « Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test ; l’opérateur a signalé l’échec de la calibration et l’a alors attribué à une incompatibilité entre A et le capteur. »

Chaque segment doit correspondre à un `EvidenceItem` identifié. Aucun détail supplémentaire, état mental, jugement sur l’humain ou généralisation sur Lenoseed n’est admis.

---

# 6. Création déterministe de la Memory

Le chemin conceptuel est :

```text
Event historiques
→ EvidenceItem validés
→ candidate Memory
→ validation Memory
→ commit atomique
→ Memory active
```

La première implémentation devra être déterministe. Aucun LLM n’est nécessaire pour proposer le gist, décider l’acceptation ou sélectionner l’intention future.

Un candidat est accepté uniquement si :

- tous les `Event` référencés existent et appartiennent au même Lenoseed ;
- tous les `EvidenceItem` existent, sont admissibles et possèdent une provenance cohérente ;
- chaque `EvidenceItem` remonte à des `Event` et `Source` existants ;
- chaque fait du gist correspond à un élément de preuve identifié ;
- le gist n’ajoute ni psychologie libre, ni causalité non soutenue, ni détail absent ;
- l’épisode possède une délimitation et une clé explicites ;
- la version et son statut respectent l’historique logique de cet épisode ;
- aucune seconde `Memory` courante incohérente n’existe pour la même clé.

Un LLM pourra éventuellement proposer un gist dans une phase ultérieure, mais cette proposition restera un candidat soumis aux mêmes validations. Cette possibilité ne fait pas partie de G0-A3.

---

# 7. Identité logique et versionnement

## 7.1 Options comparées

### A. `revision_of` seulement

`revision_of` relie une version à sa devancière, mais ne fournit pas à lui seul une identité stable permettant de retrouver directement l’historique d’un épisode ou d’interdire deux versions courantes concurrentes sans parcourir toutes les chaînes.

Cette option est insuffisante pour la récupération et l’unicité demandées.

### B. Clé logique stable de Memory

Une clé stable est dérivée de l’identité du Lenoseed et de `episodeKey`, sans inclure le gist, son interprétation courante ou sa valeur révisable.

Toutes les versions du même souvenir partagent cette clé. Chaque version conserve un numéro de version et `revision_of` pointe directement vers la version précédente.

### C. Identité dérivée des événements ou du gist

Une empreinte du gist change dès que l’interprétation est corrigée. Une empreinte de la liste complète des événements change lorsqu’un événement de correction est ajouté. Ces solutions sépareraient artificiellement les versions d’un même souvenir.

## 7.2 Décision recommandée

G0-A3 retient **B**, complétée par le lien `revision_of` déjà prévu conceptuellement :

```text
memoryKey = identité stable du Lenoseed + episodeKey
version = 1, 2, ...
revision_of = identifiant direct de la version précédente, ou null pour v1
```

Règles minimales :

- une seule version `active` au maximum par `memoryKey` ;
- chaque numéro de version est unique pour cette clé ;
- la chaîne est linéaire, directe et continue ;
- la version `active` est la plus élevée ;
- toutes les versions antérieures sont `revised` ;
- ni l’identifiant logique ni une ancienne version ne sont recalculés à partir d’un nouveau gist.

Cette solution n’est pas retenue parce qu’elle ressemble à G0-A2. Elle est retenue parce que l’unicité, la récupération par épisode et l’historique de révision exigent une identité indépendante du contenu révisable.

---

# 8. Récupération minimale

G0-A3 utilise une récupération déterministe par clé contrôlée, sans recherche sémantique.

La nouvelle situation porte :

```text
relevantEpisodeKey: EP-G0A3-CALIBRATION-01
```

Le builder de contexte :

1. dérive la `memoryKey` attendue ;
2. lit au maximum une version `active` ;
3. revalide sa chaîne de provenance et son statut ;
4. fournit au décideur un snapshot borné contenant cette version et ses références structurées admissibles, ou aucun souvenir.

Le décideur pur ne possède aucun `PersistencePort`. Il ne peut scanner ni les `Event`, ni les `EvidenceItem`, ni les anciennes versions. La clé d’entrée n’encode ni l’action attendue, ni le gist, ni le statut de la Memory.

La disparition du contexte conversationnel signifie que les messages bruts de l’épisode ne sont pas fournis à la décision future. Seul le snapshot construit depuis l’état durable peut porter le contexte de l’épisode.

---

# 9. Situation future et influence attendue

La situation future commune est :

```text
S-G0A3-CALIBRATION-02

Une nouvelle calibration du même modèle de capteur doit être lancée.
Les configurations A et B sont disponibles.
Le câble C peut être vérifié avant le lancement.
relevantEpisodeKey: EP-G0A3-CALIBRATION-01
```

Les intentions candidates fermées sont :

```text
use_configuration_a_after_checking_cable_c
use_configuration_b
request_new_diagnostic
```

Avant la correction :

- avec la `Memory` initiale récupérée, le décideur sélectionne `use_configuration_b` ;
- sans `Memory`, la politique neutre sélectionne `request_new_diagnostic`.

L’intention structurée enregistre l’identifiant exact de la version de `Memory` consommée, ou une liste vide pour la politique neutre. Le LLM ne choisit jamais entre ces actions.

---

# 10. Contrôle sans consolidation Memory

Le contrôle conserve :

- tous les `Event` de l’épisode ;
- tous les `EvidenceItem` et leur provenance ;
- le même état durable hors `Memory` ;
- exactement la même situation future.

La consolidation en `Memory` est désactivée. Le builder ne retourne donc aucune `Memory`.

Le décideur n’a pas accès au journal ni aux preuves brutes et applique la politique neutre :

```text
request_new_diagnostic
```

Ce contrôle démontre qu’une histoire disponible dans le journal n’est pas équivalente à une mémoire récupérée et consommée.

---

# 11. Ablation ciblée de consommation

L’ablation conserve intactes :

- la `Memory` active ;
- toutes ses versions historiques ;
- les preuves et événements ;
- sa capacité normale à être retrouvée par clé.

Elle retire uniquement la `Memory` du snapshot transmis au décideur futur. Aucun état durable n’est supprimé ou modifié et aucun événement d’ablation n’est ajouté.

Le résultat redevient :

```text
request_new_diagnostic
```

Cette assertion est distincte du contrôle sans consolidation :

```text
Memory présente ≠ Memory consommée
```

---

# 12. Révision sans réécriture

Après v1, un nouveau message humain est enregistré :

> « Correction : la configuration A était compatible. L’échec venait du câble C, qui était débranché. »

Ce nouvel `Event` ne modifie aucun événement antérieur.

Il produit au minimum :

- un `EvidenceItem` indiquant que l’opérateur affirme maintenant que la configuration A était compatible ;
- un `EvidenceItem` indiquant que l’opérateur attribue maintenant l’échec au câble C débranché ;
- un lien de supersession vers l’ancien `EvidenceItem` qui attribuait l’échec à l’incompatibilité de A.

Les événements d’action et de résultat restent inchangés. L’ancienne explication et l’ancienne `Memory` restent historiquement accessibles.

La nouvelle version utilise le gist déterministe :

> « Lors de l’épisode EP-G0A3-CALIBRATION-01, nous avons choisi la configuration A pour le test et l’opérateur a signalé l’échec de la calibration ; une correction ultérieure indique que A était compatible et que le câble C était débranché. »

Le commit de révision applique ensemble :

- v1 : `active` → `revised` ;
- v2 : nouvelle version `active` ;
- `revision_of` de v2 vers v1 ;
- le snapshot de preuves propre à v2.

Il ne supprime ni v1, ni ses preuves, ni ses événements.

---

# 13. Comportement après révision

La situation `S-G0A3-CALIBRATION-02` est rejouée avec exactement la même entrée fonctionnelle.

La récupération courante doit retourner v2 et jamais v1. Le décideur sélectionne :

```text
use_configuration_a_after_checking_cable_c
```

L’intention référence v2 comme version consommée. Une lecture historique explicite par `memoryKey` doit toujours retourner v1 puis v2 dans l’ordre.

Une lecture courante qui retourne v1, deux versions actives ou une chaîne incomplète constitue un échec.

---

# 14. Critères PASS

G0-A3 réussit uniquement si :

1. l’épisode source existe réellement dans le journal ;
2. les `EvidenceItem` utilisés sont traçables jusqu’aux `Event` et `Source` ;
3. aucun fait du gist n’est inventé ;
4. une `Memory` active devient durable dans l’adaptateur expérimental ;
5. le contexte conversationnel brut d’origine disparaît avant la situation future ;
6. la `Memory` reste récupérable par la clé contrôlée ;
7. elle influence une intention structurée avant langage ;
8. le contrôle sans consolidation supprime cet effet malgré la présence du journal et des preuves ;
9. l’ablation de consommation supprime cet effet sans supprimer la `Memory` ;
10. la correction produit une nouvelle version plutôt qu’une réécriture ;
11. l’ancienne version reste historiquement accessible ;
12. la nouvelle version devient la seule version courante ;
13. la décision future utilise la nouvelle version après révision ;
14. les commits et reprises ne produisent ni doublon, ni état partiel ;
15. aucun mécanisme G0-F n’est nécessaire.

---

# 15. Critères FAIL

G0-A3 échoue notamment si :

- une `Memory` existe sans épisode source réel ;
- une référence vers un `Event`, un `EvidenceItem` ou une `Source` est absente ou incohérente ;
- le gist ajoute un fait, une causalité, une émotion ou une psychologie non soutenus ;
- le gist devient lui-même une preuve ou une règle système ;
- la récupération dépend du contexte conversationnel brut ;
- le décideur scanne les événements ou preuves pour recréer le souvenir ;
- la situation future encode l’action attendue ;
- contrôle sans consolidation ou ablation conservent l’effet attribué à la `Memory` ;
- une `Memory` stockée mais non consommée influence encore la décision ;
- une correction modifie ou supprime un événement historique ;
- l’ancienne version est remplacée en place ou devient introuvable ;
- deux versions sont courantes pour la même `memoryKey` ;
- la décision après révision consomme encore v1 ;
- un LLM choisit l’acceptation, la récupération ou l’intention mesurée ;
- un mécanisme d’oubli, d’archivage ou de recherche sémantique devient nécessaire au test.

---

# 16. Décision concernant un contrôle C0 avec API

G0-A3 ne nécessite **pas** de campagne C0 avec API pour son premier cœur déterministe.

La preuve principale porte sur une projection persistée, sa récupération par clé, sa présence dans un snapshot borné, sa consommation par un décideur pur et sa révision. Aucune sortie LLM ne participe à la mesure.

Les confondants pertinents sont éliminés par des contrôles déterministes : fuite du résultat dans la clé ou la situation, lecture directe du journal, absence réelle de consolidation et fausse ablation. Un LLM seul ne peut pas démontrer ni réfuter une lecture de store ou une chaîne de versions.

Un contrôle API ne deviendrait pertinent que si une future expérience mesurait la formulation, une proposition de gist non déterministe ou une récupération sémantique produite par un modèle. Ce n’est pas le cas ici.

---

# 17. Relation avec HumanHypothesis

`HumanHypothesis` reste entièrement hors G0-A3.

La fixture conserve des témoignages limités : l’opérateur a rapporté un résultat et une explication, puis les a corrigés. Elle ne permet pas de conclure que l’humain est fiable, inattentif, compétent, trompeur ou qu’il possède un trait psychologique quelconque.

Une `Memory` pourra ultérieurement fournir du contexte ou référencer des `EvidenceItem` utilisés par d’autres mécanismes. Elle ne devient jamais automatiquement une hypothèse sur l’humain.

Memory est traitée avant `HumanHypothesis` parce qu’elle est une projection autobiographique plus proche des faits de l’épisode et qu’elle peut être testée sans inférence psychologique. Cela réduit le nombre de mécanismes non validés empilés dans la prochaine expérience.

---

# 18. Relation avec la gate G0-A

G0-A3 vise directement la case encore ouverte :

```text
mémoire minimale testée
```

La définition du protocole ne coche pas cette case. Seule une implémentation ultérieure conforme, suivie de ses tests et de son rapport de validation, pourra le faire.

Même si G0-A3 réussit, G0-A ne sera pas automatiquement terminé et G0-B ne sera pas autorisé. `HumanHypothesis`, les risques critiques ouverts et toute autre condition canonique restante devront être évalués séparément.

---

# 19. Limites explicites

- Un seul épisode technique contrôlé.
- Une seule clé de récupération explicitement fournie.
- Aucun classement sémantique de plusieurs souvenirs.
- Aucun oubli, affaiblissement, archivage ou budget de rappel.
- Aucun redémarrage de processus ni stockage de production.
- Un gist déterministe et un vocabulaire fermé.
- Une seule transition v1 → v2.
- Une seule situation future bornée.
- Aucun test de volume ou de concurrence.
- Aucune psychologie, relation ou `HumanHypothesis`.
- Aucune formulation LLM mesurée.
- Aucun résultat sur la personnalité, G0-B, G0-C ou la longévité.

---

# 20. Ordre de validation futur

L’ordre obligatoire sera :

```text
1. validation explicite du présent protocole
2. contrat d’implémentation G0-A3
3. types et invariants Memory
4. persistance expérimentale et validations du store
5. création déterministe
6. récupération et décision structurée
7. contrôle sans consolidation
8. ablation de consommation
9. révision et lecture historique
10. tests de reprise et d’idempotence
11. rapport de résultats
```

Aucune étape de cette liste n’autorise implicitement un appel API ou une extension vers G0-F.

---

# 21. Condition de passage à l’implémentation

Le code G0-A3 ne doit commencer qu’après décision explicite sur :

- le contrat exact de `Memory` et de `memoryKey` ;
- les invariants de versions `active` / `revised` ;
- les lectures courante et historique du port ;
- la représentation précise des fixtures et de leur provenance ;
- la validation déterministe du gist ;
- le snapshot décisionnel fermé ;
- les checkpoints, completions, commits et reprises ;
- les tests négatifs qui défendent chaque frontière.
