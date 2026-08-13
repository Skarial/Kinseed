# ADR-001 — Stack technique mobile

- **Statut :** accepté
- **Date :** 2026-08-10
- **Périmètre :** application LenoSeed
- **Décision :** TypeScript + HTML/CSS + Capacitor

## 1. Contexte

LenoSeed a vocation à devenir une application mobile distribuable au grand public.

La cible initiale est **Android**, avec publication envisagée sur le **Google Play Store**. Si le projet rencontre un intérêt suffisant, une version **iOS** devra ensuite pouvoir être publiée sur l'**App Store** sans nécessiter la réécriture complète de l'application.

Le projet doit également conserver une architecture suffisamment claire pour faire évoluer indépendamment :

- le cœur métier de LenoSeed ;
- l'interface utilisateur ;
- le stockage local ;
- les éventuels services distants ;
- les fonctions propres à Android ou iOS.

Le choix technique doit donc privilégier une base de code commune, une complexité raisonnable et une séparation nette entre la logique de LenoSeed et la couche mobile.

## 2. Décision

La stack principale retenue est :

- **TypeScript** pour la logique applicative et le cœur métier ;
- **HTML** pour la structure de l'interface ;
- **CSS** pour la présentation ;
- **Capacitor** comme couche d'intégration et de packaging mobile pour Android et iOS.

La priorité de développement est :

1. application Android ;
2. publication sur Google Play ;
3. maintien d'une base de code compatible iOS ;
4. publication sur l'App Store seulement si cela devient pertinent pour le projet.

## 3. Principe d'architecture

Capacitor ne doit pas devenir le cœur de l'architecture de LenoSeed.

Le cœur métier doit rester aussi indépendant que possible de :

- Capacitor ;
- Android ;
- iOS ;
- l'interface graphique ;
- un fournisseur de stockage particulier ;
- un service distant particulier.

Schéma de principe :

```text
Android / iOS
    │
Capacitor
    │
Interface HTML / CSS / TypeScript
    │
Cœur métier LenoSeed en TypeScript
    │
Stockage / synchronisation / services externes
```

Les concepts centraux du projet — événements, sources, mémoires, croyances, hypothèses sur soi, hypothèses sur l'humain, intentions, relations, héritage et générations — doivent donc être modélisés dans le cœur métier et non dans du code spécifique à une plateforme mobile.

## 4. Pourquoi TypeScript

TypeScript est retenu plutôt que JavaScript pur principalement pour mieux sécuriser les structures de données et les relations entre les objets du domaine.

LenoSeed doit manipuler de nombreuses entités fortement liées entre elles. Le typage statique permettra notamment de :

- définir explicitement la forme des événements, mémoires, croyances et autres entités ;
- détecter plus tôt certaines incohérences ;
- rendre les contrats entre modules plus explicites ;
- faciliter les refactorisations futures ;
- améliorer la lisibilité du code à mesure que le projet grandit.

TypeScript reste suffisamment proche de JavaScript pour limiter le coût d'apprentissage et permet une migration progressive.

## 5. Pourquoi Capacitor

Capacitor est retenu comme couche mobile afin de conserver une base applicative majoritairement commune entre Android et iOS.

Son rôle doit rester limité à ce qui concerne la plateforme, par exemple :

- création des projets Android et iOS ;
- accès à certaines API natives ;
- notifications ;
- stockage ou fichiers natifs lorsque nécessaire ;
- intégration avec les fonctions propres au téléphone ;
- packaging destiné aux stores.

Lorsqu'une fonction native spécifique est nécessaire, du code Kotlin ou Swift pourra être ajouté localement sans déplacer le cœur métier de LenoSeed vers ces langages.

## 6. Alternatives considérées

### Kotlin natif

**Non retenu comme langage principal.**

Kotlin serait pertinent pour une application exclusivement Android, mais créerait une forte dépendance à Android. Une version iOS demanderait alors une seconde implémentation, généralement en Swift, avec davantage de code et de maintenance en parallèle.

Kotlin reste autorisé pour une intégration Android spécifique si Capacitor ou ses plugins ne suffisent pas.

### Swift natif

**Non retenu comme langage principal.**

Swift est adapté au développement iOS natif, mais ne répond pas au besoin d'une base commune Android/iOS.

Swift reste autorisé pour une intégration iOS spécifique si elle devient nécessaire.

### Flutter / Dart

**Non retenu à ce stade.**

Flutter permet une base de code multiplateforme, mais introduirait Dart et un nouvel écosystème complet alors que les besoins actuels peuvent être couverts avec des technologies web déjà proches des compétences existantes du projet.

Cette option pourra être réévaluée si LenoSeed développe plus tard des exigences graphiques ou natives que la stack retenue gère mal.

### React Native

**Non retenu à ce stade.**

React Native permet également de cibler Android et iOS, mais ajouterait React et ses abstractions alors qu'aucun besoin actuel ne justifie cette couche supplémentaire.

## 7. Règles techniques associées

À partir de cette décision :

1. le nouveau code métier doit être écrit en **TypeScript** ;
2. l'interface peut utiliser **HTML/CSS/TypeScript** sans framework majeur par défaut ;
3. **Capacitor doit rester une couche périphérique** ;
4. le code métier ne doit pas dépendre directement des API Android ou iOS ;
5. Kotlin et Swift sont réservés aux besoins natifs clairement identifiés ;
6. aucun framework supplémentaire ne doit être introduit sans besoin concret documenté ;
7. les choix de stockage, de backend et de synchronisation feront l'objet de décisions séparées ;
8. les structures de données de G0 doivent être conçues indépendamment du rendu de l'interface mobile.

## 8. Conséquences

### Avantages attendus

- une base de code largement commune entre Android et iOS ;
- une continuité avec les technologies web ;
- une architecture compatible avec une approche mobile et potentiellement PWA ;
- une séparation claire entre domaine et plateforme ;
- un typage utile pour les structures complexes de LenoSeed ;
- la possibilité d'ajouter ponctuellement du natif sans réécrire tout le projet.

### Contraintes acceptées

- une phase d'apprentissage de TypeScript sera nécessaire ;
- Capacitor ajoute une couche entre le code web et les plateformes natives ;
- certaines fonctions mobiles avancées pourront nécessiter un plugin ou du code natif ;
- la publication iOS nécessitera, au moment venu, l'environnement et les outils imposés par Apple.

## 9. Conditions de réévaluation

Cette décision est structurante mais non irréversible.

Elle devra être réexaminée si l'un des cas suivants apparaît :

- une fonction essentielle de LenoSeed ne peut pas être correctement réalisée avec Capacitor ;
- les performances deviennent insuffisantes pour un besoin central du produit ;
- l'interface exige des capacités graphiques ou natives incompatibles avec cette approche ;
- le coût de maintenance des adaptations natives devient supérieur au bénéfice de la base commune ;
- la stratégie produit évolue vers une plateforme unique ou vers une architecture significativement différente.

Toute modification majeure de cette décision devra être documentée dans un nouvel ADR plutôt que de supprimer l'historique de la décision initiale.

## 10. Décisions techniques à documenter ensuite

Les sujets suivants ne sont volontairement pas tranchés par cet ADR :

- stockage local ;
- synchronisation entre appareils ;
- backend ;
- authentification ;
- fonctionnement offline ;
- stratégie de sauvegarde ;
- notifications ;
- utilisation éventuelle de modèles d'IA locaux ou distants ;
- confidentialité et chiffrement des données ;
- architecture de distribution Android et iOS.

Ils devront être étudiés séparément lorsqu'ils deviennent nécessaires.