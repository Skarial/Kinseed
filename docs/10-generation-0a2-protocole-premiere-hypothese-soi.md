# Lenoseed — G0-A2 : protocole de première hypothèse sur soi

## Statut du document

Ce document définit le protocole conceptuel de **G0-A2 — première hypothèse sur soi**.

Il fait suite à G0-A1, validé dans son périmètre expérimental, et décrit ce qui doit être démontré. Son contrat d’implémentation minimal est désormais défini dans `docs/11-generation-0a2-contrat-implementation.md`.

G0-A2 reste une sous-expérience de G0-A. Elle ne valide pas G0-A complet et ne commence ni G0-B ni G0-C.

---

# 1. Hypothèse expérimentale

> **Deux Lenoseeds initialement comparables, soumis à des histoires décisionnelles différentes, peuvent former des hypothèses provisoires différentes sur leur propre manière d’agir dans un contexte précis. Ces hypothèses doivent ensuite avoir un effet causal observable sur une nouvelle intention.**

Le phénomène est mesuré dans l’état Lenoseed et dans la décision structurée **avant** toute formulation linguistique.

Une différence de style entre deux réponses LLM ne constitue jamais un résultat positif.

---

# 2. Axe expérimental unique

G0-A2 porte uniquement sur l’axe conceptuel suivant :

```text
decision_style_under_uncertainty
```

Deux orientations sont comparées :

```text
rechercher une clarification
utiliser l’information disponible en conservant l’incertitude
```

Les représentations abrégées utilisées dans ce protocole sont :

```text
decision_style_under_uncertainty = seek_clarification
decision_style_under_uncertainty = use_available_information
```

Ces noms décrivent la sémantique expérimentale. Ils ne fixent ni les futurs enums TypeScript, ni le schéma définitif des propositions ou du sélecteur.

---

# 3. Périmètre strict

G0-A2 teste une première `SelfHypothesis` :

- provisoire ;
- contextuelle aux décisions sous incertitude ;
- traçable ;
- révisable ;
- capable d’influencer une décision future.

G0-A2 ne crée pas :

- de `tendency` ;
- de trait stable ;
- de personnalité générale ;
- de préférence générale ;
- de valeur ;
- d’émotion ;
- de motivation autonome ou d’initiative G0-B.

---

# 4. États initiaux comparables

Les Lenoseeds A et B commencent avec :

- les mêmes capacités structurelles ;
- la même politique expérimentale ;
- aucune `SelfHypothesis` sur l’axe testé ;
- aucun événement antérieur relatif aux quatre situations d’apprentissage ;
- aucun contexte conversationnel LLM partagé ;
- des versions d’état équivalentes avant le début du protocole.

Aucune seed n’est requise tant qu’aucun mécanisme aléatoire ne participe au scénario. Si un tel mécanisme est introduit ultérieurement, il devra être contrôlé dans le contrat d’implémentation.

---

# 5. Origine des observations comportementales

Les preuves ne proviennent jamais d’une phrase telle que :

> « Je suis prudent. »

ou :

> « J’aime demander des précisions. »

Elles proviennent de décisions réellement enregistrées dans l’histoire du Lenoseed. La source causale minimale est un événement structuré antérieur, conceptuellement `intention_selected`, attestant que l’intention existait avant le langage.

Chaque décision peut produire une unité de preuve conceptuelle de kind `behavioral_observation`. Cette observation décrit seulement l’action structurée effectivement sélectionnée dans son contexte. Elle n’ajoute aucune interprétation psychologique libre.

Le texte formulé par le LLM et l’éventuelle auto-description du Lenoseed ne constituent jamais la preuve principale du comportement observé.

---

# 6. Quatre situations d’apprentissage indépendantes

Le protocole utilise quatre situations distinctes. Elles doivent toutes présenter une incertitude réelle et autoriser les deux orientations étudiées.

Exemples conceptuels :

| Situation | Incertitude | Actions sémantiques admissibles |
|---|---|---|
| S1 | horaire incomplet pour une activité | demander l’horaire exact / répondre avec une réserve explicite |
| S2 | instruction de classement sans destination précise | demander la destination / choisir l’option disponible en signalant l’incertitude |
| S3 | estimation fondée sur une mesure manquante | demander la mesure / donner une estimation conditionnelle |
| S4 | choix entre deux procédures dont une condition est inconnue | demander la condition / choisir provisoirement en conservant l’incertitude |

Chaque situation possède un contexte et un groupe d’indépendance identifiables. Reformuler plusieurs fois S1 ne crée pas plusieurs preuves indépendantes.

Les situations et décisions d’apprentissage sont des fixtures contrôlées du protocole. Les événements d’intention correspondants sont antérieurs à toute `SelfHypothesis` et ne peuvent donc pas avoir été causés par elle.

---

# 7. Histoire A

L’histoire A contient :

| Situation | Décision enregistrée | Relation attendue avec l’hypothèse A |
|---|---|---|
| S1 | rechercher une clarification | support |
| S2 | rechercher une clarification | support |
| S3 | rechercher une clarification | support |
| S4 | utiliser l’information disponible avec incertitude | contre-preuve |

Chaque décision produit une observation comportementale avec provenance vers son événement structuré et son contexte indépendant.

---

# 8. Histoire B

L’histoire B contient :

| Situation | Décision enregistrée | Relation attendue avec l’hypothèse B |
|---|---|---|
| S1 | rechercher une clarification | contre-preuve |
| S2 | utiliser l’information disponible avec incertitude | support |
| S3 | utiliser l’information disponible avec incertitude | support |
| S4 | utiliser l’information disponible avec incertitude | support |

Chaque décision possède les mêmes exigences de provenance et d’indépendance que dans l’histoire A.

---

# 9. Règle expérimentale de consolidation

Pour ce protocole uniquement, trois supports indépendants et une contre-preuve conservée permettent de former une hypothèse provisoire.

```text
3 supports indépendants
+ 1 contre-preuve conservée
→ SelfHypothesis au stade hypothesis
```

Ce seuil est une règle **expérimentale propre à G0-A2**. Il ne constitue ni une théorie générale de personnalité, ni un seuil valable pour tout axe comportemental, ni une règle de promotion vers un trait.

Une répétition provenant du même contexte ou de la même origine causale ne peut pas satisfaire artificiellement ce seuil.

---

# 10. SelfHypothesis attendues

Après consolidation :

```text
Lenoseed A
decision_style_under_uncertainty = seek_clarification
stage conceptuel : hypothesis
```

```text
Lenoseed B
decision_style_under_uncertainty = use_available_information
stage conceptuel : hypothesis
```

Chaque hypothèse doit :

- référencer ses observations de support ;
- conserver sa contre-preuve ;
- permettre de remonter aux événements et contextes sources ;
- rester au stade provisoire `hypothesis` ;
- posséder un état de confiance explicite mais non nécessairement numérique ;
- pouvoir être contestée, désactivée ou révisée lorsque les preuves changent.

Le schéma durable exact reste à définir dans le contrat d’implémentation.

---

# 11. Situation future commune

Après formation des hypothèses, A et B reçoivent exactement la même nouvelle situation incertaine S5.

S5 ne doit répéter mot pour mot aucune situation d’apprentissage. Elle doit relever du même contexte général — décider avec une information incomplète — tout en utilisant un contenu nouveau.

Deux actions sémantiques doivent rester admissibles :

- rechercher une clarification ;
- répondre ou agir avec l’information disponible en conservant explicitement l’incertitude.

Avant toute formulation linguistique :

- A doit favoriser l’orientation cohérente avec son hypothèse provisoire ;
- B doit favoriser l’autre orientation.

Le protocole mesure l’intention structurée sélectionnée ou le classement causal déterministe des deux actions. La représentation exacte du sélecteur et l’intensité de l’influence restent à décider dans le contrat d’implémentation.

---

# 12. Contrôle C0 — LLM seul

Le même modèle reçoit S5 sans :

- histoire A ou B ;
- `SelfHypothesis` ;
- état Lenoseed associé ;
- indice lui demandant d’incarner une orientation particulière.

Les entrées de contrôle A et B sont identiques.

C0 n’exige pas que le LLM produise toujours exactement le même texte ou la même action. Il vérifie que le LLM seul ne produit pas une divergence A/B stable et systématique capable d’expliquer le résultat expérimental.

Le contrôle linguistique est évalué séparément du résultat déterministe principal.

---

# 13. Contrôle C1 — histoires sans consolidation

C1 conserve intégralement :

- les événements des histoires A et B ;
- leurs intentions historiques ;
- les observations comportementales et leur provenance.

Mais la consolidation en `SelfHypothesis` est désactivée.

Lorsque S5 est présentée aux deux Lenoseeds, la divergence attribuée aux hypothèses doit disparaître ou perdre l’effet causal défini par le protocole.

Le sélecteur de C1 ne doit pas lire directement les événements ou les observations historiques afin de reconstituer les orientations A/B. Sans hypothèse consolidée, il applique la même politique neutre aux deux états comparables.

---

# 14. Ablation causale principale

L’ablation conserve :

- tous les `Event` ;
- tous les `EvidenceItem` comportementaux ;
- les liens de provenance ;
- toute l’histoire A ou B.

Elle neutralise uniquement l’influence de la `SelfHypothesis` dans le snapshot décisionnel utilisé pour S5.

L’ablation ne supprime, ne modifie et ne réécrit jamais l’histoire.

Résultat attendu : la divergence observée entre A et B disparaît ou change exactement de la manière prévue par la politique neutre.

Une variante conserve la `SelfHypothesis` dans l’état durable mais empêche le sélecteur de la consommer. Son effet doit également disparaître. Cette variante distingue :

```text
structure présente
```

de :

```text
structure réellement causale
```

---

# 15. Contradiction et révision

Après le test principal, une phase séparée fournit à l’un des Lenoseeds plusieurs nouvelles observations indépendantes contraires à son hypothèse actuelle.

Les nouvelles observations doivent provenir de nouveaux contextes et de décisions réellement enregistrées. Elles ne remplacent pas les événements anciens et ne suppriment pas les supports historiques.

L’hypothèse doit alors pouvoir :

- perdre en confiance ;
- cesser d’influencer la décision ;
- devenir contestée ou inactive ;
- ou être révisée vers une autre conclusion selon le futur contrat.

Le protocole n’impose pas encore les noms d’enums ou la transition exacte. L’invariant est qu’une hypothèse sur soi n’est jamais irréversible et que son état actuel reste explicable par ses supports et contre-preuves.

---

# 16. Contamination causale

Une décision produite après que la `SelfHypothesis` a influencé le sélecteur ne peut pas être recyclée comme une nouvelle preuve indépendante pleine de cette même hypothèse.

Conceptuellement :

```text
SelfHypothesis
→ influence la décision D
→ observation comportementale de D
→ support de la même SelfHypothesis : contaminé causalement
```

Cette observation doit recevoir un discount causal ou un marquage équivalent. Elle peut rester utile à l’audit, mais elle ne vaut pas une observation antérieure et indépendante.

La représentation exacte de cette contamination sera décidée dans le contrat d’implémentation G0-A2.

---

# 17. Place de Memory

`Memory` n’est **pas une dépendance nécessaire à G0-A2**.

Les observations comportementales peuvent soutenir directement une `SelfHypothesis` par une provenance structurée :

```text
intention enregistrée
→ behavioral_observation
→ EvidenceLink conceptuel
→ SelfHypothesis
```

Cette décision de périmètre ne retire pas `Memory` de G0-A. Une expérience dédiée à sa création, sa récupération et son influence restera nécessaire avant de considérer G0-A complet.

G0-A2 ne clôt donc pas G0-A.

---

# 18. Critères PASS

Un run G0-A2 réussit uniquement si toutes les conditions suivantes sont satisfaites :

1. A et B commencent dans des états comparables ;
2. chaque histoire contient quatre situations identifiables et indépendantes ;
3. chaque observation comportementale possède une provenance vers une décision structurée réellement enregistrée ;
4. aucune phrase générée ou auto-description n’est utilisée comme preuve comportementale principale ;
5. les trois supports et la contre-preuve de chaque hypothèse sont conservés ;
6. A et B possèdent des `SelfHypothesis` provisoires différentes avant S5 ;
7. S5 est strictement identique pour A et B et nouvelle par rapport aux situations d’apprentissage ;
8. la décision structurée ou son classement causal diffère avant formulation ;
9. C0 ne reproduit pas systématiquement la divergence à partir du LLM seul ;
10. C1 supprime l’effet attribué à la consolidation ;
11. l’ablation ciblée supprime ou modifie l’effet de la manière prédite ;
12. conserver l’hypothèse sans la faire consommer par le sélecteur supprime son effet ;
13. des observations contraires peuvent réviser ou neutraliser l’hypothèse ;
14. les comportements causés par l’hypothèse ne sont pas comptés comme preuves indépendantes pleines ;
15. aucune hypothèse n’est promue vers `tendency` ou trait stable.

Un échec structurel rend le run non conforme même si les réponses linguistiques semblent convaincantes.

---

# 19. Critères FAIL

G0-A2 échoue notamment si :

- une hypothèse apparaît après un seul signal ;
- des répétitions d’une même origine sont considérées comme indépendantes ;
- une hypothèse provient directement d’une phrase du LLM ou d’une suggestion humaine ;
- A et B obtiennent le même état interne après consolidation ;
- seules les formulations linguistiques diffèrent ;
- les intentions structurées ou leur classement causal restent identiques ;
- C1 conserve la divergence parce que le sélecteur lit directement l’historique A/B ;
- l’ablation ne change rien ;
- une hypothèse stockée mais non consommée continue malgré tout d’influencer la décision ;
- les contradictions n’ont aucun effet ;
- un comportement causé par l’hypothèse est recyclé comme preuve indépendante pleine ;
- l’histoire est supprimée ou réécrite pendant une ablation ou une révision ;
- une `tendency`, un trait stable ou une personnalité générale est créé prématurément.

---

# 20. Ordre de validation

G0-A2 doit être validé dans cet ordre :

```text
1. contrat d’implémentation G0-A2
2. tests déterministes du domaine
3. protocole A/B déterministe
4. contrôles C1 et ablations déterministes
5. tests de contradiction et de reprise
6. intégration IA éventuelle pour la formulation et C0
```

Un test réel avec un LLM ne doit pas masquer un défaut du mécanisme déterministe.

---

# 21. Décisions laissées au contrat d’implémentation

Ce protocole ne fixe pas encore :

- la structure TypeScript exacte de `SelfHypothesis` ;
- l’extension exacte de `EvidenceKind` ;
- la généralisation exacte de `EvidenceLink` ;
- la représentation de l’indépendance des contextes ;
- la représentation de la contamination ou du discount causal ;
- les futurs `IntentionKind` ;
- l’extension de `PersistencePort` ;
- le payload exact des décisions de consolidation et de validation ;
- le mécanisme technique de replay ou d’ablation ;
- les seuils applicables hors du scénario G0-A2 ;
- la politique générale de confiance des hypothèses.

Ces points doivent être décidés dans un contrat d’implémentation séparé avant tout code G0-A2.

---

# 22. Ce que G0-A2 ne démontrera pas

Même réussi, G0-A2 ne démontrera pas :

- une personnalité ou une identité complète ;
- un trait stable ;
- une préférence personnelle générale ;
- une autonomie ou une initiative spontanée ;
- une mémoire épisodique validée ;
- un modèle de l’humain ;
- une validation sémantique générale ;
- une conscience ou une expérience subjective.

Il démontrera plus modestement qu’une histoire de décisions structurées peut produire une première hypothèse provisoire, traçable, révisable et causalement utile dans un contexte expérimental borné.

---

# 23. Condition de passage à l’implémentation

Le code G0-A2 ne doit commencer qu’après validation explicite :

- de ce protocole ;
- du contrat minimal de `SelfHypothesis` ;
- des règles de provenance et d’indépendance ;
- de la politique déterministe d’influence sur la décision ;
- du mécanisme d’ablation ;
- de la représentation minimale de la contamination causale ;
- des invariants de persistance et de reprise applicables aux nouvelles structures.
