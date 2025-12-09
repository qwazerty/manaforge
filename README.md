# ManaForge - Magic The Gathering Online Platform

## Description

ManaForge is a functional web-based platform for playing Magic The Gathering online. This implementation provides a complete game interface with real-time multiplayer gameplay, card search functionality, and a fully working game engine with combat mechanics.

## Architecture

- **Backend**: FastAPI with async/await support and comprehensive API endpoints
- **Frontend**: Svelte 5 (Vite-built) game UI, plus server-rendered templates enhanced with HTMX where needed
- **Database**: PostgreSQL for card data and game state persistence
- **Real-time**: WebSockets for live game updates and player communication
- **Game Engine**: Complete MTG rules implementation with phase management, combat, and card interactions

## Quick Start

### Using Docker (Recommended)

```bash
# Start the application with Docker Compose
docker compose up --build -d

# The nginx reverse proxy listens on http://localhost:8080
```

### Local Development

```bash
# Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend (Node 24 + pnpm 10 via corepack)
corepack enable
pnpm install

# Run the application
uvicorn app.backend.main:app --reload --host 0.0.0.0 --port 8000
```

You can override the listener address via the `HOST` and `PORT` environment variables if needed.

> ℹ️ Docker’s frontend stage runs `pnpm install --frozen-lockfile` then `pnpm run build` (Vite + Tailwind). Local builds use the same commands—no separate `build:svelte` step is required.

### Building Frontend Assets

- Entry point: `app/frontend/js/main.ts` (Svelte 5 + Vite). Outputs to `app/static/dist/js`.
- Styles: `app/frontend/css/tailwind.css` (Tailwind CLI v4) → `app/static/dist/css/manaforge.css`.

Commands (via pnpm):

```bash
pnpm run build        # Vite production build + minified Tailwind
pnpm run dev:watch    # Parallel Tailwind watch + Vite build --watch (no HMR)
pnpm run dev:css      # Tailwind watch only
pnpm run build:css    # CSS only
```

### Reverse Proxy and Service Split
- The app uses a single FastAPI backend with server-rendered templates, so a hard frontend/backend split isn't necessary yet.
- A lightweight nginx reverse proxy now fronts the backend: it serves `/static` assets directly with caching and forwards everything else (including WebSockets) to FastAPI.
- `docker-compose.yml` runs the proxy on host port `8080`; the backend stays internal.
- For live reload, `docker-compose-dev.yml` also starts the proxy on `8080`.

## Features

### ✅ Implemented Features

- **Complete Game Interface**: Full-featured game board with player areas, battlefields, and hands
- **Real-time Multiplayer**: WebSocket-based live game updates and player communication
- **Combat System**: Full combat mechanics with attacking, blocking, and damage resolution
- **Phase Management**: Complete MTG turn structure (Begin, Main 1, Combat, Main 2, End phases)
- **Card Playing**: Interactive card casting with visual feedback and animations
- **Advanced Card Search**: Comprehensive search with filtering by type, rarity, color, and mana cost
- **Game Creation**: Quick game setup with pre-constructed decks
- **Chat System**: Real-time in-game communication between players
- **Modern UI**: Responsive design with magical theming and smooth animations
- **Game State Management**: Persistent game states with automatic synchronization

### 🚧 Planned Enhancements

- **XMage Integration**: Replace simplified engine with XMage for complete MTG rules coverage
- **Deck Builder**: Interactive deck construction with full card database
- **User Authentication**: Player accounts, profiles, and game history
- **Matchmaking**: Ranking system and tournament support
- **Multiple Formats**: Support for Commander Multi, Two-Headed Giant, and others
- **Mobile Support**: Native mobile application for iOS and Android

## Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **Pydantic**: Data validation and serialization
- **Uvicorn**: ASGI server

### Frontend
- **Svelte 5 (runes mode)** bundled with **Vite** (`app/frontend/js/main.ts`)
- **Tailwind CSS v4 CLI** for theming and animations (`app/frontend/css/tailwind.css`)

### Database
- **PostgreSQL**: Document database for flexible data storage

## Project Structure

```
app/
├── backend/               # Python backend (FastAPI)
│   ├── main.py           # Application entry point
│   ├── api/              # API routes and WebSocket handlers
│   │   ├── routes.py     # REST endpoints for cards and games
│   │   ├── websocket.py  # Real-time game communication
│   │   └── decorators.py # Route decorators and utilities
│   ├── core/             # Core configuration and database
│   │   ├── config.py     # Application settings
│   │   └── db.py         # PostgreSQL connection
│   ├── models/           # Pydantic models and data structures
│   │   └── game.py       # Game state, players, cards
│   ├── services/         # Business logic and game engine
│   │   ├── card_service.py   # Card search and management
│   │   └── game_engine.py    # Complete MTG rules engine
│   └── utils/            # Shared utilities
│       └── text.py       # Text normalization helpers
├── frontend/             # Frontend sources (Svelte + Tailwind)
│   ├── js/               # Vite entry + components
│   │   ├── main.ts       # Mounts Svelte apps
│   │   ├── svelte/       # Svelte 5 components (runes mode)
│   │   ├── ui/           # DOM helpers / legacy widgets
│   │   └── lib/          # Shared utilities
│   └── css/
│       └── tailwind.css  # Tailwind v4 source (compiled to static/dist/css)
├── templates/            # Jinja2 HTML templates
│   ├── base_arena.html   # Base template with styling
│   ├── index.html        # Homepage
│   ├── game_lobby.html   # Game creation/joining
│   ├── game.html         # Live game interface
│   └── error.html        # Error handling
└── static/               # Built assets (Vite + Tailwind), images
```

## Development Guidelines

### Code Style
- Follow PEP 8 conventions
- Use type hints throughout
- Add docstrings for public functions
- Use `black` for code formatting
- Use `flake8` for linting

### Testing
```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app
```

### Development Workflow
1. **Feature Development**: Create feature branches for new functionality
2. **Code Review**: All changes require review before merging
3. **Testing**: `corepack pnpm test:unit` for Svelte/Vite, `pytest` for backend, or `scripts/test.sh` to run both
4. **Documentation**: Update README and code documentation
5. **Performance**: Profile and optimize critical game paths

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Run tests and linting
6. Submit a pull request

## License

This project is under MIT license.
