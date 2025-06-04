# Contexte et objectifs

## Objectif principal

Développer une plateforme web permettant à des joueurs de s'affronter à Magic The Gathering en ligne (parties multijoueurs en temps réel ou asynchrone), en tirant parti de ressources open source existantes (moteurs de règles, bases de données de cartes, clients front-end, etc.), afin de réduire le temps de développement et la charge de travail.

Nom du projet : ManaForge

## Scope du projet

* Un prototype d'interface front-end montrant l'écran de jeu (biblio de cartes, zone de jeu, chronologie, actions).
* Intégration un moteur open source capable d'interpréter et d'appliquer les règles MTG (gestion de phases, résolution de sorts, état du jeu).
* Un backend pour gérer les connexions, la synchronisation des états de partie, l'authentification et la persistance (historique des parties, profils de joueurs, collection de cartes).
* Une interface de construction de deck.
* L'intégration d'une base de données de cartes (images + métadonnées) sous licence libre (MTGJson, Scryfall, etc.).
* Des tests automatisés (unitaires et d'intégration) pour valider le bon fonctionnement du moteur de règles et de la communication en temps réel.
* Une documentation de déploiement (Docker, CI/CD, hébergement suggéré).
* Un plan de maintenance et d'évolution (ajout des nouvelles extensions, des formats, du game balancing).

# Périmètre fonctionnel attendu

## Formats de jeu

Standard pour commencer
Parties amicales avec Deck préconstruit (importé depuis une liste)
Parties en temps réel

## Modes de jeu

Joueur contre joueur (PvP) uniquement.
Pas de construction de deck pour l'instant
Interface de création/modification/import/export de decks (fichier .dek, .txt, .json).
Règles de validation selon le format (limite de 60 cartes, singleton, etc.).

## Collection de cartes

Pas de gestion de collection pour l'instant

## Gestion des comptes

Pas d'inscription pour l'instant
Uniquement du mode anonyme

## Évolutivité et maintenance

Mise à jour automatique de la base de données des cartes (ajout des nouvelles extensions).
Architecture modulaire pour ajouter de futurs modes (Modern, Draft, Sealed).

# Contraintes techniques et ressources open source à exploiter

## Moteur de règles

XMage, exécuté comme micro-service indépendant, couplé à un backend Python via une API REST/gRPC.

Justifications

* Complétude : XMage est sans équivalent open source en termes de couverture des règles MTG (y compris dernières extensions, nouvelles mécaniques).
* Maturité et communauté : des correctifs et des mises à jour régulières, un code éprouvé sur des milliers de parties en ligne.
* Architecture micro-service : en faisant tourner XMage dans un conteneur Java séparé, on isole la partie moteur et on contourne la contrainte GPL – l'application finale peut rester sous licence MIT/Apache, à condition que le service XMage soit distinct et qu'on ne redistribue pas directement son code ; en déréférençant strictement le binaire XMage comme dépendance externe, on évite de lier notre code à la GPL.
* Performances : Java offre de bonnes performances pour le calcul des règles, et exposer via gRPC permet de rester rapide (RPC internes en cluster).

## Bases de données de cartes open source

Combinaison MTGJson + dump Scryfall hébergé en interne.

Justifications

* MTGJson fournit une base de données complète, régulièrement mise à jour, sans contrainte de licence.
* Scryfall assure des images de haute qualité : en téléchargeant le dump mensuel, on héberge soi-même toutes les images (PNG à 600 × 880 px par exemple) dans un bucket S3 ou un CDN, garantissant performance et conformité licite (usage non commercial, sauf accord avec Wizards).
* En agrégeant MTGJson (pour les données structurées) et Scryfall (pour les images), on construit une base MongoDB avec Motor (driver async) avec index textuels pour la recherche instantanée.
* Ce système garantit que, même en cas de surcharge de l'API Scryfall, notre application reste pleinement fonctionnelle (images en cache via CDN).

L'automatisation d'un cron (ou lambda) qui :

* Télécharge le JSON MTGJson hebdomadaire, le parse et met à jour la base des cartes.
* Télécharge le dump Scryfall (ou uniquement les nouvelles cartes) pour héberger en interne les nouvelles illustrations.

## Frontend

FastAPI avec templates Jinja2 + HTMX + Tailwind CSS pour une interface moderne sans JavaScript complexe, avec WebSockets natifs pour le temps réel.

Justifications

* Architecture unifiée : FastAPI permet de servir à la fois l'API REST et les templates HTML dans une seule application Python, simplifiant le déploiement et la maintenance.
* HTMX : Permet d'avoir des interactions dynamiques (AJAX, WebSockets) directement en HTML sans écrire de JavaScript complexe, idéal pour les mises à jour en temps réel du plateau de jeu.
* Templates Jinja2 : Système de templates puissant et familier aux développeurs Python, avec héritage, macros et filtres personnalisés pour les composants de cartes.
* Tailwind CSS : Framework CSS utility-first qui permet d'obtenir rapidement un design moderne et responsive sans CSS personnalisé lourd.
* WebSockets natifs : FastAPI intègre nativement le support WebSocket, permettant la communication temps réel sans dépendance externe.
* Animations CSS : Transitions et animations via CSS/Tailwind, avec possibilité d'ajouter Alpine.js pour des interactions plus complexes si nécessaire.
* Tests : Pytest + Playwright pour les tests end-to-end, avec la possibilité de tester directement les endpoints FastAPI.
* Performance : FastAPI est basé sur Starlette et Pydantic, offrant des performances comparables à Node.js avec une syntaxe Python familière.

## Backend

FastAPI pour l'API REST + WebSockets natifs pour la couche temps réel + XMage en micro-service Java exposé en gRPC, avec base MongoDB/Motor.

Justifications

* Cohérence Python : Utiliser Python partout (backend, scripts de maintenance, tests) simplifie l'équipe et permet de partager des modèles Pydantic entre l'API et la logique métier.
* FastAPI : Framework moderne avec documentation automatique (OpenAPI), validation automatique des données (Pydantic), support natif async/await et WebSockets.
* WebSockets natifs : FastAPI intègre le support WebSocket sans dépendance externe, permettant de gérer les "rooms" de parties et la diffusion en temps réel.
* Motor + MongoDB : Driver async pour MongoDB avec Python, parfait pour stocker des documents JSON complexes (états de jeu, cartes, decks). MongoDB gère nativement les structures de données imbriquées et offre une excellente performance pour les requêtes de recherche textuelle.
* gRPC avec Python : La bibliothèque grpcio permet d'interfacer facilement avec XMage, avec génération automatique des stubs Python depuis les fichiers .proto.
* Pydantic : Validation et sérialisation automatique des données, avec génération de schémas JSON Schema pour l'API. Les modèles Pydantic se mappent naturellement aux documents MongoDB.

XMage exposé en gRPC :

On construit un adaptateur minimal qui :
* Lance XMage en mode headless (sans interface graphique) dans un conteneur Java.
* Expose, via un serveur gRPC (ou HTTP REST minimal), des méthodes telles que InitGame, PlayCard, ResolveStack, GetGameState.
* Le backend FastAPI appelle ces méthodes pour chaque action envoyée par le client, puis diffuse la réponse (état mis à jour) aux deux joueurs via WebSockets.
* Cette solution garantit la meilleure couverture des règles (XMage) sans lier le code Python à la GPL, puisque XMage reste un composant externe.

## Exemple d'architecture globale

                                      ┌─────────────┐
                                      │  Frontend   │
                                      │ FastAPI +   │
                                      │ Jinja2 +    │
                                      │ HTMX +      │
                                      │ Tailwind    │
                                      └─────┬───────┘
                                            │ HTTPS (REST, WebSocket)
                   ┌────────────────────────▼───────────────────────────┐
                   │                       Backend                      │
                   │   FastAPI + WebSockets + MongoDB/Motor             │
                   │   - Auth (JWT/OAuth)                               │
                   │   - API REST (profiles, collection, decks)         │
                   │   - WebSocket (matchmaking, synchronisation jeu)   │
                   │   - Adaptateur gRPC vers XMage (moteur de règles)  │
                   └───────────┬───────────────┬──────────┬─────────────┘
                               │               │          │
                       REST  API routes        │          │
                       (cartes, users, ...)    │          │
                                               │          │
                                         gRPC calls       │
                                        vers XMage        │
                                                          │
                                                ┌─────────▼──────────┐
                                                │    XMage Headless  │
                                                │(Java micro-service)│
                                                └─────────┬──────────┘
                                                          │
                                        Expose gRPC / REST
                                        (InitGame, PlayCard, …)
                                                          │
                                                    ┌─────▼──────┐
                                                    │MongoDB    │
                                                    │(cartes,   │
                                                    │users,     │
                                                    │decks,     │
                                                    │parties)   │
                                                    └───────────┘

Flux principal pour une partie :

* Le joueur A clique « Jouer carte » → l'action est envoyée en JSON au backend via WebSocket/HTMX.
* Le backend FastAPI appelle, en gRPC, la méthode PlayCard du service XMage (avec l'ID de partie et détails de la carte).
* XMage calcule l'effet, met à jour son état interne (pile, zones de jeu, blessures, etc.) et renvoie, via gRPC, l'état de jeu actualisé.
* Le backend diffuse l'état mis à jour aux deux joueurs A et B (via WebSockets), qui rafraîchissent leur interface en conséquence grâce à HTMX.

Mise à jour de la base de cartes (cron quotidien ou hebdomadaire) :

* Un script Python télécharge la dernière version de MTGJson + dump Scryfall (images).
* Les cartes et métadonnées sont importées/mergées dans MongoDB via Motor.
* Les images nouvelles ou modifiées sont envoyées vers un bucket S3/CloudFront, le champ image_url mis à jour en conséquence.

## Technologies Python recommandées

### Backend
* **FastAPI** : Framework web moderne avec support async natif
* **Motor** : Driver MongoDB async pour Python
* **Pydantic** : Validation et sérialisation des données
* **grpcio** : Client gRPC pour communiquer avec XMage
* **python-jose** : JWT tokens pour l'authentification
* **passlib** : Hachage sécurisé des mots de passe
* **pytest** : Tests unitaires et d'intégration
* **black** : Formatage automatique du code
* **flake8** : Linting du code

### Frontend
* **Jinja2** : Templates HTML
* **HTMX** : Interactions dynamiques sans JavaScript complexe
* **Alpine.js** : JavaScript minimal pour interactions avancées
* **Tailwind CSS** : Framework CSS utility-first

### Base de données
* **MongoDB** : Base de données principale
* **Redis** : Cache et sessions (optionnel)

### Déploiement
* **Docker** : Conteneurisation
* **docker compose** : Orchestration locale
* **Uvicorn** : Serveur ASGI pour FastAPI

# Règles de conduite pour l'Agent IA

## Instructions

Quand tu veux consulter les logs ou l'état de l'application, utilise les commandes suivantes :
```bash
# Pour consulter les logs du backend web
docker compose logs web

# Pour démarrer l'application en mode développement. Pas nécessaire de redémarrer le conteneur à chaque modification de code.
docker compose up --build -d

# Pour exécuter les tests unitaires
pytest
```

* Poser des questions de clarification chaque fois qu'un point n'est pas assez précis (ne jamais faire d'hypothèses risquées).
* Documenter toute décision technique (pourquoi tel moteur, pourquoi telle librairie).
* Privilégier les solutions open source éprouvées
* Toujours vérifier la licence (éviter la contamination GPLv3 si le projet final doit être sous licence MIT).

Modularité & évolutivité

* Chaque composant (front, back, rules engine, database) doit être découplé pour évoluer indépendamment.
* Prévoir des interfaces/niveaux d'abstraction clairs (ex. adapter différent moteur de règles via une classe abstraite).

Sécurité & confidentialité

* Toutes les communications utilisateur doivent passer en HTTPS/TLS.
* Les mots de passe doivent être stockés avec un algorithme de hachage sécurisé (bcrypt/argon2).
* Les tokens JWT doivent être rafraîchis périodiquement.

Qualité du code & bonnes pratiques

* Utiliser des versions le plus up to date des bibliothèques pour bénéficier des dernières fonctionnalités et correctifs de sécurité.
* Respecter les conventions de style Python (PEP 8) avec black et flake8.
* Documenter le code public avec des docstrings Python.
* Écrire des tests automatisés avant d'ajouter de nouvelles fonctionnalités critiques (TDD partiel).
* Effectuer régulièrement des revues de code (code review) pour garantir la maintenabilité.
* Utiliser type hints Python pour améliorer la lisibilité et détecter les erreurs.

Expérience utilisateur

* Les temps de chargement doivent être optimisés (lazy loading des images, compression).
* Lorsqu'une action prend plus de 300 ms, afficher des feedbacks visuels (spinner, barre de progression) via HTMX.
* Utiliser les transitions CSS pour des animations fluides sans JavaScript.
