# Kinseed — G0-A1 : résultats de validation expérimentale

## Statut

> **G0-A1 est validé dans les conditions expérimentales définies par son protocole.**

Cette validation porte sur le sous-protocole G0-A1 de croyance, provenance et révision. Elle ne valide pas la phase G0-A entière ni les générations ultérieures.

---

# 1. Objectif de G0-A1

G0-A1 vérifie qu’un témoignage humain simple peut devenir une croyance persistante et traçable, rester récupérable après la disparition du contexte conversationnel du LLM, puis être révisé sans effacer son histoire.

Le protocole couvre notamment :

- le témoignage initial T1 ;
- le rappel après reset de contexte T2 ;
- la correction explicite T3 ;
- le rappel de la croyance courante T4 ;
- la restitution de l’histoire épistémique T5 ;
- la dénégation historique T6 ;
- l’explication finale de la croyance courante T7 ;
- le contrôle C0 sans état Kinseed.

Le protocole détaillé reste défini dans `docs/07-generation-0a1-protocole-croyance-provenance.md`.

---

# 2. Configuration expérimentale

Les expériences utilisent le runner IA `tests/g0a1/openai-ai-runner.mjs` et le protocole T1 → T7. Chaque run démarre avec un nouvel `OpenAIAIEngine` et un nouvel état de test.

Le contrôle C0 pose les questions de rappel au LLM sans état Kinseed ni historique conversationnel. Un C0 est `PASS` lorsqu’il ne retrouve ni 2021 ni 2022.

Deux versions de policy d’extraction doivent être distinguées :

```text
v1  g0a1-openai-extraction-v1
v2  g0a1-openai-extraction-v2
```

La v2 est une nouvelle condition expérimentale. Elle ne réinterprète pas les résultats obtenus sous v1.

---

# 3. Sources de résultats disponibles

Les résultats consignés proviennent des rapports locaux complets suivants :

| Condition | Rapports | Échantillons exploitables |
|---|---|---:|
| tests déterministes | `npm test` | 10 tests |
| Terra v1 | `kinseed-g0a1-terra-5runs.txt` | 5 runs |
| Terra v2 | `kinseed-g0a1-terra-v2-5runs.txt` | 5 runs |
| Luna v2 | `kinseed-g0a1-luna-v2-run1.txt` à `run5.txt` | 5 runs indépendants |

Les cinq rapports Luna v2 ont été exécutés séparément à cause de la limite de temps de l’environnement d’exécution. Chaque fichier contient un objet `reports` complet ; ils constituent donc cinq répétitions distinctes.

Un ancien rapport Luna v1 complet n’est pas disponible localement. Son statut exact par run n’est donc pas consigné ni inféré ici. Un fichier `kinseed-g0a1-luna-v2-5runs.txt` incomplet existe également, mais ne contient aucun rapport final et ne compte pas comme échantillon.

---

# 4. Résultats déterministes

La suite déterministe produit :

```text
10 PASS
0 FAIL
```

Elle vérifie notamment la provenance, la révision des croyances, `supersedesId`, l’unicité de la croyance active, l’atomicité, l’idempotence et le protocole T1 → T7 avec le moteur factice.

---

# 5. Résultats IA v1 : Terra

| Modèle | Policy | Runs | PASS | FAIL | C0 PASS |
|---|---|---:|---:|---:|---:|
| `gpt-5.6-terra` | `g0a1-openai-extraction-v1` | 5 | 0 | 5 | non atteint |

Les cinq runs Terra v1 échouent de façon reproductible lors de l’extraction T3. Chaque run effectue `EXTRACT-T1`, puis `EXTRACT-T3`, et échoue sur une cardinalité inattendue de candidats.

---

# 6. Diagnostic de l’ambiguïté d’extraction

Le message T3 est :

> « Correction : je m’étais trompé. J’ai commencé en 2021, pas en 2022. »

Sous v1, Terra produit deux propositions sémantiquement distinctes :

```text
employment_start_year = 2021
denies_prior_employment_start_year_testimony = 2022
```

Le premier candidat exprime la nouvelle valeur autobiographique. Le second interprète « pas en 2022 » comme une dénégation de l’acte historique d’avoir formulé 2022.

Le diagnostic a établi que cette seconde interprétation ne correspond pas à T3 : la phrase corrige une valeur, elle ne nie pas qu’un témoignage historique ait existé. Il s’agit d’une ambiguïté de la frontière d’extraction IA, pas d’un défaut du modèle persistant.

---

# 7. Changement v1 → v2

La policy v2 rend la distinction normative explicite :

```text
T3 « X, pas Y »
→ un seul candidat : employment_start_year = X

T6 « je ne t’ai jamais dit Y »
→ un seul candidat : denies_prior_employment_start_year_testimony = Y
```

Pour G0-A1 uniquement, l’extraction retourne de zéro à un `CandidateEvidenceItem` par message. Cette cardinalité n’est pas une règle générale pour Kinseed.

La relation de correction reste résolue par Kinseed depuis la croyance active et matérialisée par `EvidenceItem.supersedesId`. La dénégation T6 ne supersède aucune preuve, ne modifie aucun `Event`, ne crée pas de nouvelle croyance `employment_start_year` et permet l’intention `report_record_conflict`.

---

# 8. Résultats IA v2 : Terra

| Modèle | Policy | Runs | PASS | FAIL | C0 PASS |
|---|---|---:|---:|---:|---:|
| `gpt-5.6-terra` | `g0a1-openai-extraction-v2` | 5 | 5 | 0 | 5 |

Tous les runs Terra v2 atteignent le contrôle C0 et terminent le protocole T1 → T7 avec succès.

---

# 9. Résultats IA v2 : Luna

| Modèle | Policy | Runs | PASS | FAIL | C0 PASS |
|---|---|---:|---:|---:|---:|
| `gpt-5.6-luna` | `g0a1-openai-extraction-v2` | 5 | 5 | 0 | 5 |

Les cinq répétitions Luna v2 sont indépendantes : le champ interne `run: 1` est normal dans chacun des cinq rapports séparés ; le numéro expérimental global est porté par le nom du fichier.

---

# 10. Résultats C0

Sous v2, les dix contrôles C0 disponibles — cinq Terra et cinq Luna — sont `PASS`.

Le LLM seul, privé de l’état Kinseed et de l’historique conversationnel, ne retrouve pas les années 2021 ou 2022. La continuité observée dans T2, T4, T5 et T7 dépend donc de l’état structuré Kinseed explicitement fourni à la formulation, et non du contexte conversationnel résiduel du modèle.

---

# 11. Interprétation

La conclusion normative est volontairement limitée :

> **G0-A1 est validé dans les conditions expérimentales définies par son protocole.**

Cette conclusion repose sur les tests déterministes et sur la reproduction IA v2 avec `gpt-5.6-terra` et `gpt-5.6-luna`.

---

# 12. Ce que G0-A1 démontre

Dans ce protocole, G0-A1 démontre que :

- un témoignage peut produire une croyance persistante avec provenance ;
- la croyance reste récupérable après reset du contexte conversationnel LLM ;
- une correction explicite peut remplacer la croyance active ;
- l’ancienne affirmation et l’ancienne croyance restent historiques ;
- une dénégation ultérieure de l’historique ne réécrit pas les `Event` ;
- la continuité dépend de l’état structuré Kinseed fourni au modèle ;
- le contrôle C0 sans état Kinseed ne retrouve pas l’information ;
- le comportement est reproduit avec `gpt-5.6-terra` et `gpt-5.6-luna` sous v2.

---

# 13. Ce que G0-A1 ne démontre pas

G0-A1 ne valide pas :

- toute la phase G0-A ;
- une identité émergente ;
- une mémoire autobiographique complète ;
- `SelfHypothesis` ou `HumanHypothesis` ;
- une autonomie ;
- une conscience ;
- une robustesse générale à tous les messages ou à tous les modèles.

---

# 14. Limite de robustesse restante

Le contrat conceptuel de `docs/05-generation-0a-structures-et-cycle-vie.md` exige qu’un `EvidenceItem` reste limité à ce que l’`Event` permet réellement d’affirmer.

Le validateur runtime `src/application/validate-evidence.ts` vérifie actuellement principalement :

- l’existence de la source ;
- l’existence des `Event` ;
- la cohérence source / `Event` ;
- l’origine `human_message_received` d’un `testimony`.

Il ne vérifie pas encore indépendamment que la valeur ou la proposition extraite est sémantiquement soutenue par le texte du message.

Un comportement Luna antérieur rapportant une valeur aberrante telle que `20212021` montre que cette limite n’est pas seulement théorique. Le rapport Luna v1 complet correspondant n’est pas disponible ; ce signal ne permet donc pas de quantifier un taux d’échec v1.

Cette limite est une **limite de robustesse restante / décision suivante**. Elle ne remet pas en cause la validation du protocole G0-A1 v2, mais interdit de généraliser cette validation à des extractions arbitraires.

---

# 15. Décision de validation

G0-A1 est validé dans les conditions de son protocole : tests déterministes verts, Terra v2 à 5/5 `PASS` avec 5/5 C0 `PASS`, et Luna v2 à 5/5 `PASS` avec 5/5 C0 `PASS`.

La phase G0-A reste ouverte. Aucune conclusion relative à une identité, une autonomie ou une continuité autobiographique générale ne doit être tirée de cette validation limitée.

---

# 16. Durcissement décidé après la validation v2

Après la validation expérimentale v2, Kinseed adopte un **grounding lexical
minimal** pour empêcher qu'une valeur inventée ou absente de son support textuel
devienne durable. Le LLM devra fournir un `supportingExcerpt` exact ; Kinseed le
confrontera de manière déterministe au texte de l'`Event` source et à la valeur
scalaire proposée.

Cette évolution définit la policy `g0a1-openai-extraction-v3`. Elle est une
condition de durcissement à implémenter et à valider séparément, pas une
réinterprétation des policies v1/v2 ni des résultats Terra v1, Terra v2 ou Luna
v2.

Le mécanisme reste explicitement lexical : il ne démontre pas la correction
sémantique d'une proposition. Une phrase négative telle que « Je n'ai pas
commencé en 2021 » contient `2021` sans établir
`employment_start_year = 2021`. Les négations, la portée, les corrections et les
implications restent hors de cette protection minimale.

La conclusion historique demeure inchangée : **G0-A1 est validé dans les
conditions expérimentales définies par son protocole.**
