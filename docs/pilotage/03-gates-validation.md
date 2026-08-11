# Kinseed — Gates de validation entre phases

## Statut

**Type :** document de pilotage  
**Portée :** décision de passage entre G0-A et G0-F  
**Date de création :** 11 août 2026

---

## 1. Rôle

La roadmap `docs/04-generation-0-roadmap-experimentale.md` reste la **source canonique** des objectifs et critères de sortie de G0-A à G0-F.

Ce document ne redéfinit pas ces critères. Il les transforme en une procédure opérationnelle de décision :

> **GO — la phase suivante peut devenir prioritaire.**  
> **GO CONDITIONNEL — le cœur est validé mais une limite explicitement documentée reste à traiter en parallèle.**  
> **NO-GO — la phase actuelle n’a pas encore démontré ce qu’elle devait démontrer.**

Le but est d’éviter d’empiler de nouveaux mécanismes sur une couche seulement convaincante en apparence.

---

## 2. Conditions communes à toutes les gates

Avant tout passage de phase, vérifier les points suivants.

### 2.1 Critère scientifique / métier

- le critère de sortie canonique de la phase est satisfait ;
- le résultat ne repose pas uniquement sur une réponse plausible du LLM ;
- la causalité du mécanisme est observable ;
- les contrôles, contre-exemples ou ablations pertinents ont été exécutés.

### 2.2 Qualité technique

- les tests adaptés passent ;
- aucun échec connu ne corrompt silencieusement l’état durable ;
- les chemins d’erreur importants sont compris ;
- les invariants de la phase précédente restent valides.

### 2.3 Documentation

- les résultats sont consignés ;
- les limites connues sont explicites ;
- toute décision structurante nouvelle est enregistrée dans `01-registre-decisions.md` ;
- les nouveaux risques importants sont inscrits dans `02-registre-risques.md` ;
- les documents canoniques ne se contredisent pas.

### 2.4 Périmètre

- les fonctions hors phase ne sont pas devenues des dépendances nécessaires ;
- aucune complexité future n’a été ajoutée uniquement « au cas où » ;
- les questions encore ouvertes sont clairement séparées des décisions validées.

### 2.5 Compréhension et maintenabilité

- l’architecture modifiée peut être expliquée simplement ;
- le rôle de chaque état durable important est identifiable ;
- il est possible de retrouver pourquoi une décision ou une mutation importante s’est produite ;
- si la complexité dépasse la capacité de vérification raisonnable du mainteneur, une revue extérieure est planifiée avant de poursuivre.

---

# 3. Gate G0-A → G0-B

## Source canonique

`docs/04-generation-0-roadmap-experimentale.md` — section **G0-A — Continuité minimale**.

## Démonstration attendue

Deux Kinseeds initialement comparables, soumis à des histoires différentes, doivent pouvoir produire des hypothèses internes différentes qui :

- ont une provenance identifiable ;
- influencent des décisions futures ;
- ne sont pas réductibles au LLM seul ;
- perdent ou modifient leur effet lorsque le mécanisme causal est retiré ou modifié.

## Checklist opérationnelle

- [ ] journal d’événements fiable et causal ;
- [ ] provenance exploitable ;
- [ ] extraction/validation d’éléments de preuve suffisamment robuste pour l’expérience ;
- [ ] mémoire minimale testée ;
- [ ] croyance ou hypothèse persistante révisable ;
- [ ] intention sélectionnée avant formulation ;
- [ ] écriture durable protégée par validation ;
- [ ] divergence entre histoires démontrée ;
- [ ] influence future démontrée ;
- [ ] contrôle sans mécanisme Kinseed ou équivalent exécuté ;
- [ ] ablation ciblée exécutée ;
- [ ] résultats et limites documentés ;
- [ ] aucun risque critique actuel non compris.

### Décision actuelle

G0-A1 a validé une partie limitée de la provenance et de la révision, mais **G0-A complet n’est pas encore déclaré terminé**. Le passage à G0-B reste donc soumis aux travaux restants de G0-A.

---

# 4. Gate G0-B → G0-C

## Source canonique

Roadmap — **G0-B — Initiative minimale**.

## Démonstration attendue

Kinseed doit produire au moins une initiative dont la cause existe **avant** sa formulation et peut être retrouvée dans son état.

## Checklist opérationnelle

- [ ] événement ou mécanisme déclenchant l’évaluation d’initiative défini ;
- [ ] motivations primitives explicitement représentées ;
- [ ] plusieurs actions candidates possibles, dont « ne rien faire » ;
- [ ] intention autonome sélectionnée avant langage ;
- [ ] cause et état observé traçables ;
- [ ] initiative reproductible dans un scénario contrôlé ;
- [ ] disparition ou changement de l’initiative après ablation de sa cause ;
- [ ] absence de simple règle générique « poser une question périodiquement » ;
- [ ] fréquence et anti-répétition testées ;
- [ ] si notification push utilisée, décision métier séparée du transport technique.

---

# 5. Gate G0-C → G0-D

## Source canonique

Roadmap — **G0-C — Identité émergente**.

## Démonstration attendue

Une caractéristique personnelle doit résulter de plusieurs expériences indépendantes, rester révisable et avoir un effet causal mesurable.

## Checklist opérationnelle

- [ ] distinction état momentané / tendance / trait ;
- [ ] plusieurs expériences indépendantes nécessaires avant stabilisation ;
- [ ] contre-exemples conservés ;
- [ ] mécanisme anti-auto-confirmation présent ;
- [ ] caractéristique capable de prédire partiellement des décisions futures ;
- [ ] ablation ou modification du trait change certaines décisions ;
- [ ] comparaison avec comportement du LLM seul réalisée ;
- [ ] aucune persona cachée ne remplace l’émergence attendue.

---

# 6. Gate G0-D → G0-E

## Source canonique

Roadmap — **G0-D — Relation humaine**.

## Démonstration attendue

La relation évolue à partir d’événements identifiables et influence le comportement sans être réduite à une récompense d’approbation ou à une jauge d’affection.

## Checklist opérationnelle

- [ ] modèle de l’humain révisable ;
- [ ] confiance contextuelle ou mécanisme équivalent traçable ;
- [ ] proximité distincte de la simple compatibilité ;
- [ ] désaccord possible sans pénalité automatique ;
- [ ] absence neutre par défaut ;
- [ ] événements relationnels identifiables ;
- [ ] conséquences comportementales mesurables ;
- [ ] pas de complaisance systématique ;
- [ ] pas d’adoption automatique des opinions de l’utilisateur ;
- [ ] mécanisme de limites/refus respecté ;
- [ ] tests sur plusieurs trajectoires relationnelles différentes.

---

# 7. Gate G0-E → G0-F

## Source canonique

Roadmap — **G0-E — Vie intérieure fonctionnelle**.

## Démonstration attendue

Les états internes ajoutés doivent avoir une fonction causale observable et ne pas être de simples phrases générées.

## Checklist opérationnelle

- [ ] états affectifs fonctionnels reliés à des événements ;
- [ ] intérêts persistants traçables ;
- [ ] objectifs ou projets personnels issus de mécanismes définis ;
- [ ] valeurs ou conflits de valeurs révisables ;
- [ ] consolidation hors interaction si elle existe réellement ;
- [ ] retrait d’un état supposé causal modifie la décision correspondante ;
- [ ] le LLM ne peut pas inventer seul l’état interne après coup ;
- [ ] limites et risques de boucle auto-renforçante testés.

---

# 8. Gate de sortie G0-F

## Source canonique

Roadmap — **G0-F — Longévité**.

## Démonstration attendue

Après une histoire longue ou accélérée, Kinseed doit rester cohérent, révisable et explicable sans dépendre d’un modèle linguistique précis.

## Checklist opérationnelle

- [ ] simulations longues automatisées ;
- [ ] oubli sans réécriture arbitraire du passé ;
- [ ] consolidation et archivage testés ;
- [ ] croyances obsolètes sans influence résiduelle indue ;
- [ ] réinterprétation du passé distincte des événements historiques ;
- [ ] résistance à la mémoire empoisonnée ;
- [ ] migration d’état testée ;
- [ ] changement de modèle LLM testé ;
- [ ] caractéristiques importantes toujours explicables par provenance ;
- [ ] dérive identitaire mesurée ;
- [ ] coûts mémoire, calcul et LLM mesurés sur longue durée.

La sortie de G0-F ne signifie pas que Kinseed est un produit commercial terminé. Elle signifie que le noyau de génération 0 dispose d’éléments suffisants pour envisager les couches futures sans abandonner les principes expérimentaux initiaux.

---

# 9. Gate avant bêta avec utilisateurs externes

Cette gate est distincte de G0-A → G0-F.

Avant une bêta réelle :

- [ ] politique de données personnelles documentée ;
- [ ] données envoyées au LLM identifiées ;
- [ ] suppression et restauration définies ;
- [ ] stockage durable sauvegardé ;
- [ ] authentification et autorisations testées ;
- [ ] secrets/API keys hors client ;
- [ ] contrôle des coûts et quotas ;
- [ ] comportement offline/réseau dégradé testé si applicable ;
- [ ] journalisation technique sans fuite excessive de données privées ;
- [ ] revue extérieure de l’architecture sécurité/données réalisée.

Si ces conditions ne sont pas satisfaites, le prototype peut continuer en environnement contrôlé, mais ne doit pas être présenté comme prêt pour une bêta publique.

---

# 10. Gate avant paiements ou multi-utilisateur sensible

Avant paiements, reproduction entre comptes ou partage de données entre propriétaires :

- [ ] modèle de propriété des données explicite ;
- [ ] consentement et révocation définis ;
- [ ] règles d’accès testées en négatif ;
- [ ] transactions critiques atomiques ou compensables ;
- [ ] idempotence des opérations externes ;
- [ ] sauvegarde/restauration testées ;
- [ ] audit externe ciblé réalisé ;
- [ ] conformité juridique pertinente examinée.

Cette gate est **bloquante avant mise en production**.

---

# 11. Règle de budget de complexité

Toute demande importante doit être classée avant implémentation :

```text
Nécessaire à la phase actuelle
→ concevoir précisément
→ implémenter minimalement
→ tester

Utile mais non nécessaire à la phase actuelle
→ documenter / backlog
→ ne pas implémenter maintenant
```

Une exception doit avoir une raison concrète : sécurité, dette bloquante, coût, bug critique ou dépendance nécessaire.

---

# 12. Format d’une décision de gate

Lorsqu’une phase arrive à son terme, consigner au minimum :

```text
Phase : G0-X
Date : ...
Décision : GO | GO CONDITIONNEL | NO-GO
Preuves : ...
Tests/contrôles : ...
Limites restantes : ...
Risques ouverts : ...
Décision suivante autorisée : ...
Expertise extérieure nécessaire : oui/non + raison
```

Une décision de GO ne doit jamais être déduite uniquement du fait que « la démo fonctionne ».

---

## Principe final

> **La phase suivante n’est pas une récompense pour avoir beaucoup codé ; elle devient prioritaire uniquement lorsque la phase actuelle a produit la preuve attendue.**