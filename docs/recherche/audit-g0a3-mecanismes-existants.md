# Lenoseed — Audit G0-A3 au regard des mécanismes existants

## Statut

Troisième audit réalisé selon `docs/recherche/methode-reutilisation-mecanismes-llm.md`.

Périmètre : **G0-A3 — mémoire épisodique minimale**.

Cet audit examine le protocole, le contrat d’implémentation et les primitives déjà présentes dans le dépôt. Il ne transforme pas G0-A3 en système général de mémoire : son objectif est d’identifier ce qui est déjà solidement fondé, ce qui peut être réutilisé plus tard et ce qui doit rester explicitement expérimental.

Date de l’audit : 2026-08-14.

---

## 1. Problème Lenoseed étudié

G0-A3 teste la chaîne minimale suivante :

```text
Event historiques
→ EvidenceItem validés
→ Memory dérivée
→ récupération après disparition du contexte conversationnel
→ consommation par une décision structurée
→ révision de Memory après nouvelle information
```

Les propriétés centrales sont :

- séparation histoire / preuve / mémoire ;
- provenance complète `Memory → EvidenceItem → Event → Source` ;
- mémoire versionnée et révisable ;
- absence de réécriture du passé ;
- récupération déterministe par clé pour l’expérience ;
- effet causal mesuré avant langage ;
- contrôle sans consolidation ;
- ablation de consommation ;
- gist déterministe et borné par les preuves.

---

## 2. Sources externes examinées

### 2.1 Generative Agents — mémoire, importance, récence, pertinence et réflexion

Source primaire : Park et al., **Generative Agents: Interactive Simulacra of Human Behavior**, UIST 2023.

- https://doi.org/10.1145/3586183.3606763
- https://arxiv.org/abs/2304.03442

Principe pertinent : les agents conservent un flux d’expériences, produisent des réflexions de plus haut niveau et récupèrent les souvenirs pertinents pour la planification. La récupération combine notamment des notions de pertinence, récence et importance.

Conséquence Lenoseed : la séparation entre expérience persistée et contexte de décision est bien fondée. En revanche, la future récupération générale ne devra probablement pas être inventée de zéro ; des stratégies multi-facteurs existent déjà.

### 2.2 MemGPT — mémoire externe au contexte limité du LLM

Source primaire : Packer et al., **MemGPT: Towards LLMs as Operating Systems**, 2023.

- https://arxiv.org/abs/2310.08560

Principe pertinent : la continuité sur de longues interactions peut être portée par des niveaux de mémoire externes au contexte immédiat du modèle, avec récupération contrôlée.

Conséquence Lenoseed : la mémoire persistante ne doit pas dépendre de la fenêtre conversationnelle native du LLM. Le choix G0-A3 de reconstruire un snapshot depuis l’état Lenoseed reste justifié.

### 2.3 GAM — séparation encodage / consolidation

Source primaire : Wu et al., **GAM: Hierarchical Graph-based Agentic Memory for LLM Agents**, ACL 2026.

- https://aclanthology.org/2026.acl-long.1600/

Principe pertinent : l’architecture sépare explicitement l’encodage des événements de leur consolidation en mémoire plus stable, afin de limiter le bruit et préserver la cohérence à long terme.

Correspondance Lenoseed :

```text
Event / EvidenceItem
≠
Memory consolidée
```

Cette séparation est donc particulièrement cohérente avec l’état de l’art récent.

### 2.4 MemORAI — provenance et récupération adaptative

Source primaire : Van et al., **MemORAI: Memory Organization and Retrieval via Adaptive Graph Intelligence for LLM Conversational Agents**, Findings ACL 2026.

- https://aclanthology.org/2026.findings-acl.1408/

Principe pertinent : le système enrichit la mémoire avec une provenance au niveau des tours et utilise une récupération adaptée à la requête plutôt qu’un rappel uniforme.

Conséquence Lenoseed : la provenance structurée de G0-A3 est un choix solide. Pour la future récupération ouverte, une simple similarité vectorielle ou un scan uniforme ne devra pas être adopté par défaut.

### 2.5 APEX-MEM — historique append-only et informations qui évoluent

Source primaire : Banerjee et al., **APEX-MEM: Agentic Semi-Structured Memory with Temporal Reasoning for Long-Term Conversational AI**, ACL 2026.

- https://aclanthology.org/2026.acl-long.749/

Principe pertinent : l’architecture conserve une histoire append-only de l’évolution de l’information et résout les conflits ou mises à jour sans effacer l’évolution antérieure.

Correspondance Lenoseed :

```text
ancienne version conservée
+ nouvelle information
→ état courant révisé
```

est directement compatible avec `Memory v1 revised → Memory v2 active` et le journal historique immuable.

### 2.6 Temporal Semantic Memory — distinguer les temps

Source primaire : Su et al., **Beyond Dialogue Time: Temporal Semantic Memory for Personalized LLM Agents**, Findings ACL 2026.

- https://aclanthology.org/2026.findings-acl.1496/

Principe pertinent : organiser la mémoire uniquement selon le moment du dialogue peut produire des erreurs temporelles. Le travail distingue le temps sémantique réel de l’information et permet des représentations duratives.

Conséquence Lenoseed : le futur modèle de mémoire devra distinguer clairement :

- quand les événements se sont réellement produits ;
- quand une projection Memory a été formée ou révisée ;
- éventuellement la durée ou l’intervalle de l’épisode.

Le champ expérimental G0-A3 `createdAt` ne doit donc jamais devenir, par inertie, l’unique notion temporelle de toute mémoire Lenoseed.

### 2.7 Mem2ActBench — mesurer l’utilisation de la mémoire par l’action

Source primaire : Shen et al., **Mem2ActBench: A Benchmark for Evaluating Long-Term Memory Utilization in Task-Oriented Autonomous Agents**, ACL 2026.

- https://aclanthology.org/2026.acl-long.370/

Principe pertinent : évaluer uniquement la récupération passive de faits ne mesure pas si un agent sait réellement utiliser une mémoire pour agir. Le benchmark évalue explicitement l’application de mémoire dans des actions.

Conséquence Lenoseed : le test G0-A3 `Memory → intention structurée` est méthodologiquement plus fort qu’un simple « te souviens-tu de X ? ».

### 2.8 RecMem — ne pas consolider tout immédiatement

Source primaire : Dai et al., **RecMem: Recurrence-based Memory Consolidation for Efficient and Effective Long-Running LLM Agents**, Findings ACL 2026.

- https://aclanthology.org/2026.findings-acl.1619/

Principe pertinent : traiter chaque interaction par un LLM pour produire immédiatement une mémoire consolidée est coûteux ; RecMem retarde certaines consolidations jusqu’à ce qu’une récurrence pertinente apparaisse.

Conséquence Lenoseed : la décision actuelle de ne pas résumer automatiquement toutes les conversations est cohérente. La future politique d’écriture mémoire devra être sélective.

---

## 3. Audit mécanisme par mécanisme

### 3.1 `Event → EvidenceItem → Memory`

**Classement : RÉUTILISABLE / TRÈS SOLIDE.**

La séparation entre événements bruts, preuves structurées et mémoire consolidée rejoint directement des architectures récentes qui séparent encodage et consolidation.

Pour Lenoseed, elle apporte en plus une traçabilité indispensable à l’évolution de l’individu.

Décision : **conserver**.

### 3.2 Provenance complète de la Memory

**Classement : RÉUTILISABLE / TRÈS SOLIDE.**

Les travaux récents identifient explicitement l’absence de provenance comme une faiblesse des systèmes de mémoire. G0-A3 fait de la provenance un invariant dur.

Décision : **conserver comme principe général de Lenoseed**, pas seulement comme règle de test.

### 3.3 Gist déterministe fondé sur les preuves

**Classement : RÉUTILISABLE COMME GARDE-FOU, À ASSOUPLIR PLUS TARD.**

Pour G0-A3, un template exact permet de prouver que le souvenir n’ajoute aucune information inventée.

Un futur système réel ne pourra évidemment pas avoir un template codé pour chaque épisode. Le LLM pourra proposer un résumé, mais celui-ci devra rester un candidat vérifié contre les preuves.

Décision : **conserver le déterminisme pour G0-A3 ; ne pas généraliser les templates littéraux au produit**.

### 3.4 Versionnement `active / revised` sans réécriture

**Classement : RÉUTILISABLE / SOLIDE.**

Les systèmes récents de mémoire temporelle et conflictuelle conservent l’évolution des informations au lieu de remplacer silencieusement le passé.

Pour Lenoseed, cette propriété est particulièrement importante : un souvenir actuel peut changer sans que l’histoire de l’individu soit falsifiée.

Décision : **conserver**.

### 3.5 Récupération par `relevantEpisodeKey`

**Classement : EXPÉRIMENTAL / ORACLE DE TEST.**

La clé explicite permet d’isoler proprement la question expérimentale : « une Memory persistée peut-elle être consommée causalement ? »

Mais elle ne démontre aucune capacité réelle de recherche de mémoire.

```text
relevantEpisodeKey fourni dans l’entrée
≠
Lenoseed sait identifier lui-même le souvenir pertinent
```

La littérature actuelle propose déjà plusieurs familles de récupération :

- pertinence + récence + importance ;
- graphes temporels, causaux, sémantiques et d’entités ;
- récupération adaptée à la requête ;
- activation associative.

Décision : **conserver l’oracle pour G0-A3 uniquement**. Une future expérience de récupération ouverte devra retirer cette clé explicite et comparer des mécanismes existants avant toute implémentation maison.

### 3.6 `Memory → intention` avant langage

**Classement : RÉUTILISABLE / TRÈS PERTINENT.**

Les évaluations modernes commencent à distinguer le rappel de l’utilisation effective de la mémoire. G0-A3 mesure directement une modification d’intention structurée avant formulation.

Décision : **conserver ce type de test causal pour les futures mémoires**.

### 3.7 Contrôle sans consolidation et ablation de consommation

**Classement : RÉUTILISABLE / SOLIDE.**

Ces deux contrôles démontrent deux choses différentes :

```text
histoire existante ≠ mémoire consolidée
```

et :

```text
mémoire présente ≠ mémoire réellement consommée
```

Décision : **conserver**.

### 3.8 `salience`

**Classement : PRINCIPE RÉUTILISABLE, VALEUR G0-A3 EXPÉRIMENTALE.**

L’importance d’un souvenir est déjà utilisée dans des systèmes de récupération existants. G0-A3 fixe `salience: high` uniquement pour rendre la fixture admissible.

Le champ ne doit pas encore recevoir de formule numérique ou influencer une récupération générale inexistante.

Décision : **conserver le concept ; différer la politique de calcul et d’utilisation**.

### 3.9 `lastRecalledAt`

**Classement : PISTE FUTURE, INUTILE À G0-A3.**

La récence peut être utile dans une future politique de récupération. Toutefois, mettre à jour ce champ pendant G0-A3 introduirait une mutation provoquée par la simple observation du mécanisme et compliquerait la causalité du test.

Décision : **conserver `null` et l’absence d’écriture lors du rappel pour G0-A3**.

### 3.10 Temps de la mémoire

**Classement : À DÉCIDER AVANT LA MÉMOIRE GÉNÉRALE.**

Le contrat actuel utilise `createdAt` de manière déterministe pour les versions de la fixture. Cette règle est suffisante pour le protocole fermé.

Elle ne doit pas être extrapolée vers une sémantique générale où `createdAt` représenterait à la fois :

- le temps de l’événement ;
- le temps de l’épisode ;
- le temps de consolidation ;
- le temps de révision.

Décision : **aucune modification de G0-A3 maintenant**, mais une décision temporelle dédiée sera nécessaire avant une mémoire ouverte ou durative.

### 3.11 Consolidation de chaque interaction

**Classement : NON RETENU POUR LE FUTUR PAR DÉFAUT.**

La littérature récente montre le coût et le bruit d’une consolidation systématique de chaque interaction.

Lenoseed ne doit donc pas évoluer vers :

```text
chaque message
→ nouvelle Memory durable automatique
```

sans mécanisme de sélection.

Décision : **maintenir la consolidation comme opération contrôlée et préparer plus tard une politique sélective**.

---

## 4. Ce que G0-A3 réutilise déjà correctement

G0-A3 est déjà très proche de plusieurs principes robustes :

```text
histoire brute
→ encodage / preuves
→ consolidation distincte
→ mémoire persistante
→ récupération contrôlée
→ utilisation fonctionnelle
```

Il adopte également une propriété particulièrement importante pour Lenoseed : les corrections enrichissent l’histoire au lieu de la réécrire.

Le projet n’a donc pas besoin de remplacer son modèle par celui d’un système de mémoire existant. Il doit plutôt réutiliser leurs enseignements pour les parties encore ouvertes : sélection d’écriture, récupération générale, temporalité, consolidation et oubli.

---

## 5. Ce qui reste spécifique à Lenoseed

La valeur propre du modèle Lenoseed reste notamment :

- une `Memory` n’est pas la source de vérité historique ;
- la mémoire actuelle peut être reconstruite depuis une chaîne de preuves ;
- l’ancienne version du souvenir reste accessible ;
- l’identité du souvenir est indépendante de son gist révisable ;
- la mémoire est une partie de l’histoire individuelle, pas uniquement un cache destiné à améliorer une réponse LLM ;
- un changement de modèle LLM ne doit pas remplacer silencieusement cette mémoire.

Ces propriétés sont directement compatibles avec la persistance individuelle et, plus tard, avec la possibilité de transmettre des fragments transformés d’histoire à une génération suivante.

---

## 6. Décisions issues de l’audit

### Certain

1. La séparation encodage / consolidation utilisée par G0-A3 est cohérente avec l’état de l’art récent.
2. La provenance explicite des souvenirs est une propriété à conserver.
3. Tester l’utilisation de la mémoire dans une décision est plus informatif qu’un simple test de rappel verbal.
4. Conserver les versions historiques lors d’une correction est compatible avec les systèmes modernes de mémoire temporelle et avec la mission Lenoseed.
5. Une récupération générale dispose déjà de nombreuses approches établies ; Lenoseed ne devra pas en inventer une arbitrairement sans les comparer.

### Probable

1. La future récupération Lenoseed combinera plusieurs dimensions plutôt qu’une unique similarité textuelle : pertinence, temporalité, causalité, entités, salience ou associations.
2. La future politique d’écriture sera sélective plutôt qu’un résumé durable de chaque interaction.
3. Les notions temporelles de l’épisode et de la projection Memory devront être séparées.

### Inconnu / à décider plus tard

1. La formule exacte de salience.
2. La politique exacte de récupération générale.
3. Le rôle futur de `lastRecalledAt` et de la récence.
4. Les critères de consolidation automatique d’un épisode en Memory.
5. Les mécanismes d’oubli, archivage et transformation G0-F.
6. La représentation des épisodes longs ou duratifs.

---

## 7. Conséquence immédiate sur le code G0-A3

**Aucune modification du code actuellement implémenté n’est requise par cet audit.**

Les primitives présentes (`Memory`, versionnement, sélection déterministe et snapshot décisionnel) sont volontairement bornées au protocole. Les complexifier maintenant avec embeddings, graphes, scores numériques, recherche sémantique ou écritures de rappel ferait perdre l’isolation expérimentale sans répondre au besoin actuel.

Deux interdictions doivent néanmoins être transportées explicitement vers la suite :

> **La présence de `relevantEpisodeKey` dans G0-A3 ne valide pas une capacité générale de récupération de mémoire.**

> **Le champ `createdAt` de G0-A3 ne définit pas à lui seul le futur modèle temporel des souvenirs Lenoseed.**

---

## 8. Prochaine étape recommandée

G0-A3 étant déjà en cours d’implémentation dans le dépôt, l’action immédiate reste de terminer et valider le protocole déterministe existant sans étendre son périmètre.

Après validation de G0-A3, la prochaine primitive ouverte de G0-A devra être auditée avec la même méthode avant implémentation. Si la prochaine étape porte sur la récupération générale de mémoire, il faudra d’abord comparer explicitement les familles existantes de récupération plutôt que choisir directement embeddings ou base vectorielle.