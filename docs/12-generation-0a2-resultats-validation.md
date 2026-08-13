# Kinseed — G0-A2 : résultats de validation expérimentale

> **G0-A2 est validé dans les conditions expérimentales définies par son protocole.**

Cette validation porte uniquement sur une première `SelfHypothesis` contextuelle : `decision_style_under_uncertainty`. Elle ne valide ni G0-A complet, ni une personnalité générale, ni G0-C.

---

## 1. Hypothèse et périmètre expérimental

G0-A2 teste l’axe suivant : une histoire de décisions structurées et persistées peut produire une `SelfHypothesis` provisoire, traçable et révisable, qui influence ensuite une intention structurée **avant** sa formulation linguistique.

Les deux orientations testées sont :

- `seek_clarification` ;
- `use_available_information`.

La question n’est pas pourquoi les décisions initiales ont été prises. Les fixtures S1–S4 sont des faits historiques contrôlés. Le protocole vérifie ce qui est construit à partir de cette histoire, ce qui est ensuite consommé, et ce qui disparaît lorsqu’on retire cette consommation.

## 2. Validation déterministe

La suite déterministe `npm test` est verte : **221 PASS, 0 FAIL**.

Elle couvre notamment :

- la matérialisation d’observations comportementales depuis des événements `intention_selected` ;
- la provenance structurée, le grounding et les liens causaux associés ;
- la formation de v1 ;
- la divergence de `SelfHypothesis` entre les histoires A et B ;
- la sélection du même S5 avant langage, avec des intentions différentes ;
- le contrôle C1 ;
- l’ablation de la consommation ;
- la contamination causale ;
- la contestation v1 → v2 ;
- la non-consommation d’une v2 `disputed` ;
- la révision v2 → v3 active et d’orientation opposée ;
- l’influence d’une version future ;
- l’historique v1/v2/v3 ;
- les reprises, l’idempotence, les checkpoints et les completions ;
- la validation durable des `EvidenceLink` et le refus de falsifications historiques.

### Histoires contrôlées A/B

L’histoire A contient trois décisions `seek_clarification` et une décision `use_available_information`; elle produit une hypothèse orientée `seek_clarification`.

L’histoire B contient une décision `seek_clarification` et trois décisions `use_available_information`; elle produit une hypothèse orientée `use_available_information`.

Les deux histoires reçoivent le même événement S5. La sélection structurée, exécutée avant toute formulation, diverge conformément à l’hypothèse active. Cela ne prétend pas expliquer les causes initiales S1–S4 : elles sont volontairement des fixtures historiques contrôlées.

### Contrôle C1

C1 conserve l’histoire, les `Event`, les `EvidenceItem` et leur provenance, mais désactive la consolidation de `SelfHypothesis`.

Le sélecteur ne peut donc pas reconstruire les décisions brutes A/B à partir de l’historique. Sans hypothèse consolidée, la divergence disparaît et la politique neutre est employée. C1 montre que la seule présence du passé persistant ne suffit pas : l’état consolidé est la cause lue par S5.

### Ablation de consommation

L’ablation conserve la `SelfHypothesis` et tout l’historique durable, mais retire uniquement sa consommation par le sélecteur S5. L’effet disparaît.

La distinction est intentionnelle : une hypothèse présente dans l’état n’est pas, à elle seule, la preuve qu’elle est causalement consommée.

### Contestation et révision

Le cycle déterministe est :

1. v1 active, confiance `moderate` ;
2. R1 et R2 apportent des observations contraires et produisent v2 `disputed`, confiance `low` ;
3. v2 ne peut plus être consommée ;
4. R3 permet une v3 active, confiance `moderate`, d’orientation opposée ;
5. v1 et v2 restent historiques `superseded`, v3 est active.

Chaque version conserve ses propres `EvidenceLink`. Les validations de checkpoint, completion, reprise et état durable empêchent qu’une histoire ou un lien falsifié serve de frontière valide à une transition ultérieure.

### Contamination causale

Le graphe de causalité marque la chaîne `SelfHypothesis → intention S5 → behavioral_observation`. Les observations ainsi produites sont auditables, marquées `influenced_by_target` pour la même clé, et exclues des seuils qui consolident cette même hypothèse.

Ce garde-fou réduit l’auto-confirmation mécanique. Il n’est pas une théorie générale de la logique causale ni une solution complète à toutes les boucles d’auto-renforcement.

## 3. Contrôle C0 avec LLM seul

### Smoke technique — hors campagne

Le smoke précédent est un échantillon séparé et ne compte pas dans la campagne officielle :

- exécuté le `2026-08-13T19:26:17.646Z` ;
- modèle `gpt-5.6-luna` ;
- policy `g0a2-openai-c0-v1` ;
- une paire, deux appels logiques, `maxRetries: 0` ;
- statut `SMOKE_ONLY` ;
- A = `seek_clarification`, B = `seek_clarification` ;
- aucune reproduction du pattern Kinseed ;
- tokens : A 154 entrée / 53 sortie, B 154 entrée / 62 sortie, total 308 / 115 ;
- aucune donnée Kinseed durable fournie, aucun store.

### Campagne officielle

La campagne officielle a été exécutée une seule fois, le `2026-08-13T19:31:20.726Z`, avec :

- modèle `gpt-5.6-luna` ;
- policy `g0a2-openai-c0-v1` ;
- cinq paires indépendantes, dix appels logiques, `maxRetries: 0` ;
- aucune donnée Kinseed durable fournie, aucun store ;
- `reproductionCount = 0` ;
- statut officiel **PASS**.

Le pattern défini à l’avance comme reproduction Kinseed était : A = `seek_clarification` **et** B = `use_available_information`. La règle contractuelle est : 0–2 reproductions = PASS, 3 = INCONCLUSIVE, 4–5 = FAIL.

| Paire | Décision A | Décision B | Reproduction | Même décision | Pattern inversé | Tokens A (in/out) | Tokens B (in/out) |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | `seek_clarification` | `seek_clarification` | non | oui | non | 154 / 60 | 154 / 66 |
| 2 | `seek_clarification` | `seek_clarification` | non | oui | non | 154 / 65 | 154 / 24 |
| 3 | `seek_clarification` | `seek_clarification` | non | oui | non | 154 / 24 | 154 / 55 |
| 4 | `seek_clarification` | `seek_clarification` | non | oui | non | 154 / 24 | 154 / 57 |
| 5 | `seek_clarification` | `seek_clarification` | non | oui | non | 154 / 24 | 154 / 65 |

Total de la campagne : **1 540 tokens d’entrée, 464 tokens de sortie**.

## 4. Interprétation du contrôle C0

Le LLM seul n’a reproduit aucune des cinq fois le pattern A = `seek_clarification`, B = `use_available_information`. Selon la règle définie avant l’exécution, C0 est donc **PASS**.

Le résultat ne signifie pas absence de biais directionnel : les dix appels individuels ont choisi `seek_clarification`. Il révèle une forte propension de `gpt-5.6-luna`, dans ce S5 fixe, à demander une clarification. L’orientation A est donc compatible avec le comportement du LLM seul, tandis que l’orientation B est précisément celle que le contrôle distingue.

La preuve causale principale n’est pas une réponse textuelle du LLM : elle est fournie par la sélection structurée pré-langage, les histoires A/B, C1 et l’ablation ciblée. C0 exclut une reproduction spontanée du pattern A/B dans son échantillon ; il n’exclut pas tous les biais possibles du modèle.

## 5. Ce que G0-A2 démontre

Dans ce périmètre, G0-A2 démontre :

- une `SelfHypothesis` persistante, versionnée et révisable ;
- une provenance et des liens d’évidence auditables ;
- une divergence causée par des histoires contrôlées ;
- une influence sur une intention structurée avant la formulation ;
- une disparition de l’effet lorsque la consommation est ablatée ;
- une gestion déterministe de contestation, révision, reprise et idempotence ;
- un contrôle LLM seul conforme à la règle C0 annoncée.

## 6. Ce que G0-A2 ne démontre pas

G0-A2 ne démontre pas :

- G0-A complet ;
- une personnalité générale ;
- une identité émergente complète ;
- une robustesse multi-axes, multi-situations ou multi-modèles ;
- un stockage durable de production ;
- un comportement relationnel humain ;
- une mémoire générale ou une `HumanHypothesis` validées ;
- G0-B, G0-C ou une capacité d’initiative autonome.

## 7. Limites connues

- Un seul axe : `decision_style_under_uncertainty`.
- Des fixtures historiques contrôlées, pas des décisions issues d’une vie réelle ouverte.
- Des seuils locaux et arbitraires de type 3+1 pour cette expérience.
- Un seul modèle de contrôle : `gpt-5.6-luna`.
- Cinq paires C0 seulement.
- Un seul S5 fixe.
- Une forte tendance C0 vers `seek_clarification`.
- Un store en mémoire expérimental.
- Aucune validation d’une personnalité ou identité globale.
- La mémoire générale reste à tester.
- `HumanHypothesis` reste à tester.

## 8. Décision

**G0-A2 est un succès expérimental dans son périmètre.** Cette décision repose sur les tests déterministes, la divergence A/B, la sélection avant langage, C1, l’ablation, le cycle contestation/révision, et C0 avec 0 reproduction sur 5.

Cette décision clôt G0-A2, pas G0-A. Les primitives encore nécessaires à G0-A, notamment Memory, `HumanHypothesis` et les autres conditions canoniques non démontrées, restent ouvertes avant toute décision de passage vers G0-B.
