# Lenoseed — Audit G0-A1 au regard des mécanismes existants

## Statut

Premier audit réalisé selon `docs/recherche/methode-reutilisation-mecanismes-llm.md`.

Périmètre : **G0-A1 — croyance, provenance et révision**.

Cet audit ne modifie pas automatiquement l’architecture ou le code. Son but est d’identifier ce qui est déjà fondé sur des principes connus, ce qui peut être amélioré par réutilisation, et ce qui doit rester spécifique à Lenoseed.

Date de l’audit : 2026-08-14.

---

## 1. Problème Lenoseed étudié

G0-A1 doit permettre à Lenoseed de :

1. recevoir un témoignage humain ;
2. conserver sa provenance ;
3. construire une croyance opérationnelle ;
4. conserver cette croyance hors contexte conversationnel du LLM ;
5. réviser la croyance après une correction explicite ;
6. conserver l’ancienne affirmation et l’ancienne croyance dans l’histoire ;
7. empêcher une dénégation ultérieure de réécrire un événement effectivement enregistré par Lenoseed.

Le mécanisme actuel utilise notamment :

- `Event` append-only ;
- `EvidenceItem` ;
- `EvidenceLink` ;
- `Belief` versionnée ;
- `beliefKey` ;
- `previousVersionId` ;
- `supersedesId` ;
- provenance par `sourceId`, `eventIds` et `grounding` ;
- confiance ordinale ;
- validation déterministe avant commit.

---

## 2. Sources externes examinées

### 2.1 W3C PROV

Source primaire : W3C Recommendation, **PROV-O: The PROV Ontology**, 30 avril 2013.

https://www.w3.org/TR/prov-o/

Principes pertinents :

- distinction entre `Entity`, `Activity` et `Agent` ;
- chaînes de provenance ;
- `wasDerivedFrom` ;
- `wasRevisionOf` ;
- `hadPrimarySource` ;
- possibilité de conserver la provenance d’une révision sans remplacer silencieusement la version précédente.

### 2.2 AGM — théorie de la révision des croyances

Source primaire : Carlos E. Alchourrón, Peter Gärdenfors, David Makinson, **On the Logic of Theory Change: Partial Meet Contraction and Revision Functions**, Journal of Symbolic Logic, 1985.

DOI : https://doi.org/10.2307/2274239

Principe pertinent : une révision de croyance n’est pas simplement un remplacement arbitraire ; elle doit intégrer la nouvelle information tout en préservant autant que possible la cohérence et le contenu antérieur compatible.

### 2.3 Révision de croyance et confiance dans la source

Source primaire : Aaron Hunter, **Belief Revision and Trust**, 2014.

https://arxiv.org/abs/1405.0034

Principe pertinent : la confiance accordée à une source peut dépendre du domaine ou du type de proposition, et ne doit pas être modélisée uniquement comme une confiance globale envers un agent.

### 2.4 Révision de croyance par les LLM

Source primaire : Bryan Wilie et al., **Belief Revision: The Adaptability of Large Language Models Reasoning**, 2024.

https://arxiv.org/abs/2406.19764

Résultat pertinent : les LLM testés ne révisent pas systématiquement correctement leurs conclusions lorsque de nouvelles informations imposent une révision. Une capacité linguistique native de révision ne doit donc pas être considérée comme une garantie suffisante pour l’état durable de Lenoseed.

### 2.5 Mémoire d’agent versionnée et révision formelle

Source primaire récente : Young Bin Park, **Graph-Native Cognitive Memory for AI Agents: Formal Belief Revision Semantics for Versioned Memory Architectures**, 2026.

https://arxiv.org/abs/2603.17244

Principes pertinents :

- révisions immuables ;
- liens de dépendance typés ;
- mémoire versionnée ;
- séparation entre structure persistante et modèle LLM utilisé ;
- rapprochement explicite entre mémoire d’agent et théorie formelle de révision des croyances.

Cette source est récente et ne constitue pas à elle seule une norme. Elle confirme néanmoins que plusieurs primitives déjà choisies par Lenoseed appartiennent à une direction de recherche active.

---

# 3. Audit mécanisme par mécanisme

## 3.1 Provenance `Event → EvidenceItem → Belief`

### Existant Lenoseed

Une croyance durable doit être reliée à une preuve, elle-même reliée à un ou plusieurs événements et à une source. Le grounding lexical relie en plus un témoignage au passage textuel qui le soutient.

### Principe externe analogue

W3C PROV représente explicitement les entités, activités, agents et relations de dérivation ou de révision.

### Certain

Le besoin de conserver une chaîne de provenance structurée n’est pas une invention propre à Lenoseed. Il correspond à un problème formalisé et standardisé depuis longtemps.

### Statut

**R — Réutilisable conceptuellement.**

### Décision

Conserver l’architecture Lenoseed actuelle.

Ne pas importer PROV-O ou RDF dans le prototype : cela ajouterait une dépendance et une complexité inutiles. Utiliser PROV comme référence conceptuelle et vocabulaire de contrôle lors des futurs audits de provenance.

### Modification de code maintenant

**Aucune.**

---

## 3.2 Conservation des anciennes versions de croyance

### Existant Lenoseed

`reviseBelief()` ne modifie pas la proposition de l’ancienne croyance. L’ancienne version devient `superseded` et la nouvelle version pointe vers elle par `previousVersionId`.

### Principes externes analogues

- W3C PROV distingue une révision d’une suppression de provenance ;
- la littérature sur la révision de croyance traite la modification de l’état épistémique comme une transition entre états ;
- les architectures récentes de mémoire versionnée utilisent également des révisions immuables.

### Certain

Le choix de conserver les états antérieurs plutôt que de réécrire silencieusement le passé est cohérent avec plusieurs familles de mécanismes existants.

### Statut

**R — Réutilisable / déjà correctement appliqué.**

### Décision

Conserver `previousVersionId`, `superseded` et l’historique append-only.

### Modification de code maintenant

**Aucune.**

---

## 3.3 Autorité dépendante du type de proposition

### Existant Lenoseed

G0-A1 distingue notamment :

- l’humain comme source fortement autorisée pour corriger un fait autobiographique simple le concernant ;
- l’humain comme source non autorisée à réécrire l’existence d’un message que Lenoseed a effectivement enregistré.

### Principe externe analogue

Les travaux sur belief revision + trust montrent que la confiance dans une source peut être restreinte à un domaine ou au type d’information concerné.

### Certain

Le principe « l’autorité dépend de la proposition » possède un fondement externe clair.

### Statut

**R — Réutilisable et déjà correctement orienté.**

### Décision

Conserver ce principe comme fondation générale.

### Adaptation future

Lorsque plusieurs types de sources et de propositions seront réellement nécessaires, formaliser les règles d’autorité dans une structure dédiée plutôt que multiplier les `if` dispersés.

Ne pas construire cette généralisation maintenant : G0-A1 ne nécessite qu’un cas très réduit.

### Modification de code maintenant

**Aucune.**

---

## 3.4 Révision après correction explicite

### Existant Lenoseed

Dans le scénario G0-A1, lorsque le même humain corrige explicitement son année de début :

```text
2022
↓ correction explicite du même auteur
2021
```

la croyance 2022 devient `superseded` et 2021 devient la croyance active.

### Principe externe analogue

La théorie de la révision des croyances étudie précisément l’intégration d’une information nouvelle pouvant entrer en conflit avec l’état actuel.

### Certain

Le problème général possède une littérature formelle importante.

### Important

La règle actuelle de Lenoseed est **beaucoup plus étroite** qu’un moteur général de belief revision.

Elle fonctionne parce que le protocole impose simultanément :

- un fait autobiographique simple ;
- une correction explicite ;
- le même auteur ;
- une autorité élevée de cet auteur sur ce type de proposition ;
- une seule croyance active sur le même `beliefKey`.

### Statut

**A — À adapter, mais seulement lors de la généralisation future.**

### Décision

Conserver la règle actuelle pour G0-A1.

Ajouter comme contrainte conceptuelle :

> **La supersession directe G0-A1 ne doit jamais être généralisée automatiquement à tous les conflits de croyances.**

Lorsque Lenoseed rencontrera réellement :

- plusieurs sources ;
- des sources de fiabilité différente ;
- des preuves partielles ;
- plusieurs contre-preuves ;
- une incertitude réelle ;

alors le mécanisme devra être réévalué à partir des travaux de belief revision plutôt que prolongé mécaniquement depuis G0-A1.

### Modification de code maintenant

**Aucune.**

La limitation appartient d’abord à la documentation et aux futurs contrats.

---

## 3.5 Confiance ordinale

### Existant Lenoseed

```text
low
moderate
moderate_high
high
```

G0-A1 ne prétend pas convertir ces niveaux en probabilités.

### Existant externe

La littérature contient de nombreux modèles numériques, logiques, ordonnés et probabilistes de confiance et de révision.

### Certain

Aucun besoin de G0-A1 ne justifie actuellement un moteur probabiliste complet.

### Statut

**N — Ne pas importer de mécanisme plus complexe pour l’instant.**

### Décision

Conserver l’échelle ordinale actuelle tant qu’un test concret ne démontre pas qu’elle est insuffisante.

---

## 3.6 Détection sémantique de contradiction par le LLM

### Existant Lenoseed

Le LLM extrait un candidat structuré. Lenoseed valide ensuite la provenance et certains invariants de manière déterministe.

### Résultat externe pertinent

Les évaluations de belief revision montrent que les LLM peuvent échouer à réviser correctement leurs raisonnements lorsque les informations évoluent.

### Certain

Le LLM peut être utile pour comprendre le langage, mais sa capacité native ne constitue pas une garantie suffisante pour maintenir l’état durable de Lenoseed.

### Statut

**A — À utiliser comme moteur sémantique, pas comme autorité d’état.**

### Décision

Le principe architectural existant est confirmé :

> le LLM propose/interprète ; Lenoseed valide et committe.

Le grounding lexical v3 reste utile comme première barrière déterministe, même s’il ne constitue pas une validation sémantique générale.

### Modification de code maintenant

**Aucune.**

---

# 4. Ce que l’audit change réellement

L’audit ne révèle pas de cause justifiant une réécriture de G0-A1.

Il montre au contraire que plusieurs choix importants du prototype sont compatibles avec des principes déjà connus :

| Mécanisme G0-A1 | Source analogue | Statut |
|---|---|---|
| provenance explicite | W3C PROV | R |
| historique de révision | PROV + belief revision + mémoire versionnée | R |
| autorité dépendante du type de proposition | belief revision + trust | R |
| correction explicite autobiographique | belief revision | A, cas G0-A1 conservé |
| confiance ordinale simple | multiples approches externes | N pour toute complexification immédiate |
| LLM pour extraction, moteur pour état | résultats sur les limites de belief revision des LLM | A, architecture actuelle confirmée |

---

# 5. Règle nouvelle à conserver pour la suite

L’audit fait apparaître une règle importante qui doit accompagner G0-A1 :

> **Une règle de révision validée dans un scénario contrôlé ne devient pas automatiquement la politique générale de révision des croyances de Lenoseed.**

En particulier :

```text
même humain
+ fait autobiographique simple
+ correction explicite
```

peut justifier une supersession directe dans G0-A1.

Mais :

```text
source A affirme X
source B affirme Y
```

ou :

```text
plusieurs preuves partielles se contredisent
```

nécessiteront un mécanisme plus riche qui devra être conçu à partir de principes établis de révision de croyance, de provenance et d’autorité.

---

# 6. Tests : capacité du LLM vs apport de Lenoseed

Le contrôle C0 actuel est pertinent pour son objectif : après reset du contexte, le LLM seul ne dispose pas de l’état persistant de Lenoseed.

Il démontre donc la provenance de la continuité observée dans G0-A1.

Il ne cherche pas à démontrer que le LLM serait incapable de comprendre une correction s’il recevait toutes les informations dans sa fenêtre de contexte.

Cette distinction doit être conservée pour les prochains protocoles :

- ne pas utiliser un test de continuité pour prétendre démontrer une supériorité générale de raisonnement ;
- ne pas utiliser une réussite native du LLM pour prétendre avoir validé un mécanisme persistant Lenoseed.

---

# 7. Conclusion de l’audit G0-A1

## Certain

- G0-A1 possède déjà une séparation saine entre compréhension LLM et état durable Lenoseed.
- La provenance explicite est fortement fondée par des travaux et standards existants.
- La conservation des révisions et de l’histoire est cohérente avec les approches formelles et les architectures versionnées.
- L’autorité dépendante du type de proposition possède un fondement externe.
- Les LLM seuls ne doivent pas être considérés comme un moteur fiable de révision persistante des croyances.

## Probable

- Les primitives actuelles de G0-A1 constituent une bonne base pour la suite à condition de ne pas transformer les règles simplifiées du protocole en lois générales du moteur.

## Inconnu / à décider plus tard

- la politique générale de révision lorsque plusieurs sources crédibles se contredisent ;
- le calcul futur de confiance ;
- la gestion de preuves partielles ou ambiguës ;
- les règles d’arbitrage entre témoignage, observation comportementale, source externe et inférence interne.

## Décision

> **G0-A1 est conservé sans modification de code à la suite de cet audit.**

Le principal apport immédiat est méthodologique : ses règles limitées sont maintenant distinguées des mécanismes généraux qui devront être étudiés avant généralisation.

La prochaine application de la méthode doit porter sur **G0-A2 — première hypothèse sur soi**, où le risque de réinventer arbitrairement des mécanismes de consolidation, de confiance, d’auto-observation et d’auto-confirmation est plus élevé.
