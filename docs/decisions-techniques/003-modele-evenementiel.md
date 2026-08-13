# ADR-003 — Modèle événementiel et séparation histoire / état

- **Statut :** accepté
- **Date :** 2026-08-10
- **Périmètre :** cœur métier de LenoSeed
- **Décision :** les événements constituent la trace historique fondamentale ; les mémoires, croyances, hypothèses et intentions sont des états interprétés ou dérivés qui doivent rester reliés à leur provenance.

## 1. Contexte

LenoSeed ne doit pas seulement conserver un état courant. L'identité d'un individu numérique doit se construire par son histoire.

Stocker uniquement des valeurs finales, par exemple une croyance ou une préférence actuelle, ferait perdre la possibilité de comprendre comment cet état est apparu, ce qui l'a renforcé, ce qui l'a contredit et comment il a évolué.

Cette traçabilité est également importante pour les futures transmissions intergénérationnelles : un descendant devra pouvoir hériter d'éléments transformés tout en conservant une provenance intelligible.

## 2. Décision

LenoSeed adopte un modèle où les **événements** représentent la trace historique fondamentale.

Un événement décrit quelque chose qui s'est produit pour l'individu ou dans son environnement et qui peut ensuite être interprété par le système.

Exemple conceptuel :

```text
interaction / observation / expérience
                ↓
             Event
                ↓
         interprétation
                ↓
       Memory / Belief / etc.
                ↓
      évolution de l'état actuel
```

Les éléments suivants ne doivent donc pas être considérés comme de simples champs isolés :

- mémoire ;
- croyance ;
- hypothèse sur soi ;
- hypothèse sur l'humain ;
- intention.

Ils doivent pouvoir conserver un lien explicite vers les événements, sources ou autres éléments qui ont contribué à leur formation.

## 3. Séparation histoire / état

LenoSeed distingue deux catégories principales.

### Histoire

Elle décrit ce qui s'est produit :

- événements ;
- interactions ;
- observations ;
- expériences ;
- transmissions ;
- transformations héritées.

Cette couche doit privilégier la traçabilité et éviter les réécritures silencieuses du passé.

### État interprété ou dérivé

Il décrit ce que l'individu pense ou poursuit actuellement :

- mémoires consolidées ;
- croyances ;
- hypothèses sur soi ;
- hypothèses sur l'humain ;
- intentions ;
- préférences et autres états futurs éventuels.

Ces éléments peuvent évoluer au fil du temps sans effacer l'histoire qui a conduit à leur état actuel.

## 4. Source de vérité

L'expression « source de vérité » ne signifie pas que tout l'état devra être recalculé depuis zéro à chaque lancement.

Elle signifie que l'historique pertinent ne doit pas être remplacé par le seul état final.

Une implémentation future pourra conserver des états matérialisés, index ou caches pour des raisons de performance, à condition qu'ils restent reliés à l'histoire et que leur évolution soit explicable.

## 5. Conséquences

### Positives

- traçabilité de la construction de l'identité ;
- possibilité d'expliquer l'origine d'une croyance ou d'une intention ;
- gestion plus propre des contradictions ;
- possibilité d'étudier l'évolution dans le temps ;
- meilleure base pour l'héritage intergénérationnel ;
- possibilité future de rejouer ou d'auditer certaines transformations.

### Contraintes

- volume de données supérieur à un modèle qui ne conserve que l'état courant ;
- nécessité de définir précisément les relations entre événements et états dérivés ;
- nécessité de prévoir des mécanismes de consolidation, d'oubli ou d'archivage si le volume devient important ;
- complexité supplémentaire lors de la synchronisation entre appareils.

## 6. Ce qui n'est pas décidé ici

Cet ADR ne définit pas encore :

- le schéma exact de `Event` ;
- le schéma exact de `Memory`, `Belief`, `SelfHypothesis`, `HumanHypothesis` ou `Intention` ;
- les algorithmes de consolidation ;
- les règles d'oubli ;
- les seuils de confiance ;
- la manière de résoudre les contradictions.

Ces éléments relèvent de la conception détaillée de G0-A.

## 7. Règle d'architecture

LenoSeed ne doit pas seulement savoir **ce qu'un individu est actuellement** ; il doit pouvoir conserver suffisamment de provenance pour comprendre **comment il en est arrivé là**.
