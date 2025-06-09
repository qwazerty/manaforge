# ManaForge - Instructions pour Cline

## Vue d'ensemble du projet

**ManaForge** est une plateforme web Magic The Gathering permettant des parties multijoueurs en temps réel. Le projet utilise FastAPI + Jinja2 + HTMX + Tailwind CSS pour créer une interface moderne sans JavaScript complexe.

### État actuel du développement

Le projet dispose actuellement de :
- ✅ **Backend FastAPI** complet avec API REST et WebSockets
- ✅ **Moteur de jeu simple** (actions de base : jouer cartes, piocher, passer tour/phase)
- ✅ **Interface de jeu** fonctionnelle avec templates Jinja2
- ✅ **Service de cartes** avec intégration API Scryfall
- ✅ **Modèles de données** Pydantic (Card, Deck, GameState, Player, etc.)
- ✅ **Tests d'intégration** via script `test_game_creation.sh`
- ✅ **Configuration Docker** pour le développement

## Architecture technique

### Stack principal
```
Frontend: FastAPI + Jinja2 + HTMX + Tailwind CSS
Backend: FastAPI + WebSockets natifs
Base de données: MongoDB (actuellement désactivée, données en mémoire)
Cartes: API Scryfall pour récupération dynamique
Déploiement: Docker + docker compose
```

### Structure des dossiers
```
app/
├── main.py              # Point d'entrée FastAPI
├── api/                 # Routes API et WebSockets
├── core/                # Configuration et base de données
├── models/              # Modèles Pydantic (Card, GameState, etc.)
├── services/            # Services métier (CardService, GameEngine)
├── templates/           # Templates Jinja2
└── static/              # CSS, JS, images
```

## Fonctionnalités actuelles

### ✅ Implémenté
- **Création de parties** avec decks personnalisés ou pré-configurés
- **Actions de jeu de base** : piocher, jouer cartes, passer tour/phase
- **Interface web** complète avec zones de jeu visuelles
- **WebSockets** pour communication temps réel
- **Recherche de cartes** via API Scryfall
- **Parsing de decklists** (format texte)
- **Gestion des phases** simplifiées (Begin → Main1 → Combat → Main2 → End)

### 🚧 En cours / À développer
- **Base de données MongoDB** (infrastructure présente mais désactivée)
- **Moteur de règles avancé** (actuellement : actions basiques uniquement)
- **Authentification utilisateurs** (actuellement : mode anonyme)
- **Collection de cartes personnelles**
- **Constructeur de decks intégré**

## Instructions pour Cline

### 🛑 INTERDICTIONS STRICTES

**NE PAS faire automatiquement :**
- Relancer l'application (`docker compose up/down/restart`) - **le reload automatique est actif**
- Créer des fichiers de tests (`.py` dans `tests/`) sans demande explicite
- Créer de la documentation (`.md`) sans demande explicite
- Lancer des tests sans demande explicite

### ✅ Actions autorisées

**Modifier directement :**
- Fichiers source existants (`app/`, templates, CSS, JS)
- Configuration existante
- Modèles et services

**Tester avec :**
- `curl` pour tester les endpoints API
- `./test_game_creation.sh` pour tester la boucle de jeu complète
- `docker compose logs` pour consulter les logs en cas d'erreur 5XX

### 🧪 Comment tester les modifications

1. **Pour l'API :** Utiliser `curl` directement
   ```bash
   curl -X POST http://localhost:8000/api/v1/games -H "Content-Type: application/json" -d '{}'
   ```

2. **Pour le jeu complet :** Lancer le script de test
   ```bash
   ./test_game_creation.sh
   ```

3. **Pour l'interface :** Ouvrir http://localhost:8000 dans le navigateur

4. **Pour les logs :** Consulter les erreurs serveur
   ```bash
   docker compose logs
   ```

### 📝 Règles de codage

**Style Python :**
- Suivre PEP 8 avec type hints obligatoires
- Docstrings pour toutes les fonctions publiques
- Maximum 300 lignes par fichier
- Utiliser Pydantic pour la validation des données

**Architecture :**
- Garder la séparation API / Services / Modèles
- Privilégier l'async/await partout
- WebSockets pour les updates temps réel
- Templates Jinja2 pour le rendu côté serveur

**Performance :**
- HTMX pour les interactions dynamiques sans JS lourd
- Tailwind CSS pour le styling
- Lazy loading pour les images de cartes
- Feedback visuel si action > 300ms

### 🎯 Objectifs prioritaires

1. **Stabilité** : S'assurer que les fonctionnalités existantes marchent bien
2. **Interface utilisateur** : Améliorer l'expérience de jeu
3. **Moteur de règles** : Ajouter progressivement les règles MTG
4. **Performance** : Optimiser les temps de réponse

### 🔍 Points d'attention

**MongoDB :**
- Infrastructure présente dans `app/core/database.py`
- Actuellement désactivée dans `app/main.py` (mode développement)
- À réactiver quand nécessaire pour la persistance

**Cartes :**
- Service intégré Scryfall dans `app/services/card_service.py`
- Cache en mémoire des cartes recherchées
- Images hébergées par Scryfall (pas encore en local)

**WebSockets :**
- Implémentés dans `app/api/websocket.py`
- Utilisés pour les updates de jeu en temps réel
- Gestion des rooms par game_id

### 💡 Exemples d'améliorations courantes

**Interface :**
- Améliorer les animations CSS dans `app/static/css/`
- Ajouter des interactions HTMX dans les templates
- Optimiser la responsivité mobile

**Backend :**
- Ajouter de nouvelles actions de jeu dans `SimpleGameEngine`
- Enrichir les modèles dans `app/models/game.py`
- Améliorer la validation des données

**Tests :**
- Enrichir le script `test_game_creation.sh`
- Ajouter des cas de test avec `curl`

## État technique actuel

- **Serveur** : Uvicorn avec reload automatique (port 8000)
- **Base de données** : En mémoire (MongoDB désactivée temporairement)
- **Authentification** : Mode anonyme (pas d'inscription)
- **Cartes** : API Scryfall en temps réel
- **Interface** : Templates Jinja2 + HTMX + Tailwind CSS
- **Tests** : Script bash intégré pour validation complète

Le projet est fonctionnel pour des parties basiques entre 2 joueurs avec des decks personnalisés.
