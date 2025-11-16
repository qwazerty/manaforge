# ManaForge - Magic The Gathering Online Platform

## Description

ManaForge is a functional web-based platform for playing Magic The Gathering online. This implementation provides a complete game interface with real-time multiplayer gameplay, card search functionality, and a fully working game engine with combat mechanics.

## Architecture

- **Backend**: FastAPI with async/await support and comprehensive API endpoints
- **Frontend**: Responsive server-side templates with HTMX for dynamic interactions
- **Database**: MongoDB for card data and game state persistence
- **Real-time**: WebSockets for live game updates and player communication
- **Game Engine**: Complete MTG rules implementation with phase management, combat, and card interactions

## Quick Start

### Using Docker (Recommended)

```bash
# Start the application with Docker Compose
docker compose up --build -d

# The application will be available at http://localhost:8000
```

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Install frontend tooling (Tailwind CSS)
npm install

# Start MongoDB (required)
# Install MongoDB locally or use Docker:
# docker run -d -p 27017:27017 mongo:7.0

# Run the application
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Alternatively, run the existing Compose stack with `DEV_MODE=dev` so the entrypoint installs the tooling and starts the watchers before Uvicorn:

```bash
DEV_MODE=dev docker compose up --build
```

You can override the listener address via the `HOST` and `PORT` environment variables if needed.

> ℹ️ The Docker build uses a Node-based stage to run `npm ci` and `npm run build:css`, so every container image ships with the freshly generated Tailwind bundle. For local development outside of Docker, keep running `npm run dev:css` as needed.

### Building Frontend Styles

Tailwind CSS is now bundled locally (no CDN). Run the build once before launching the app or whenever you change `app/static/css/tailwind.css`:

```bash
npm run build:css            # single build (minified)
npm run dev:css              # watch mode during development
npm run build:svelte         # bundle all Svelte components
npm run dev:svelte           # watch Svelte sources and rebuild on change
```

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
- **Error Handling**: Robust error management with user-friendly feedback
- **Game State Management**: Persistent game states with automatic synchronization

### 🚧 Planned Enhancements

- **XMage Integration**: Replace simplified engine with XMage for complete MTG rules coverage
- **Deck Builder**: Interactive deck construction with full card database
- **User Authentication**: Player accounts, profiles, and game history
- **Advanced Matchmaking**: Ranking system and tournament support
- **Multiple Formats**: Support for Standard, Modern, Legacy, and other formats
- **Collection Management**: Personal card collections and deck libraries
- **Mobile Support**: Native mobile application for iOS and Android

## API Endpoints

### REST API

- `GET /` - Homepage with navigation to game and card search
- `GET /game` - Game lobby for creating and joining games
- `GET /cards` - Advanced card search interface
- `GET /game-interface/{game_id}` - Live game interface
- `GET /api/v1/cards/search?q={query}&limit={n}` - Search cards with filtering
- `GET /api/v1/cards/{card_id}` - Get detailed card information
- `POST /api/v1/games?game_id={id}` - Create new game with pre-built decks
- `GET /api/v1/games/{game_id}/state` - Get current game state
- `POST /api/v1/games/{game_id}/actions` - Perform game actions

### WebSocket

- `WS /ws/game/{game_id}` - Real-time game communication and updates

## Game Actions

Fully implemented game actions:

```json
{
  "player_id": "player1",
  "action_type": "play_card",
  "card_id": "lightning_bolt"
}
```

```json
{
  "player_id": "player1", 
  "action_type": "pass_turn"
}
```

```json
{
  "player_id": "player1",
  "action_type": "draw_card"
}
```

```json
{
  "player_id": "player1",
  "action_type": "declare_attackers",
  "additional_data": {"attacking_creatures": ["creature_id_1", "creature_id_2"]}
}
```

```json
{
  "player_id": "player1",
  "action_type": "declare_blockers", 
  "additional_data": {"blocking_assignments": {"blocker_id": "attacker_id"}}
}
```

## Game Features Deep Dive

### Combat System
- **Attacking Phase**: Players can declare attacking creatures with visual feedback
- **Blocking Phase**: Defending player assigns blockers with drag-and-drop interface
- **Damage Resolution**: Automatic combat damage calculation and creature destruction
- **Life Tracking**: Real-time life point updates from combat and spell effects

### Game Engine Capabilities
- **Complete Phase System**: Begin, Main1, Combat, Main2, End phases
- **Priority Management**: Proper priority passing between players according to MTG rules
- **Card Zones**: Full zone management (Hand, Battlefield, Library, Graveyard, Exile)
- **Spell Resolution**: Stack-based spell and ability resolution
- **Combat Mechanics**: First strike, double strike, trample, flying support (framework ready)

### User Interface Features
- **Responsive Design**: Optimized for desktop, tablet, and mobile gameplay
- **Real-time Synchronization**: Instant game state updates via WebSocket connections
- **Visual Feedback**: Smooth card animations, hover effects, and transition animations
- **Accessibility**: Screen reader support and keyboard navigation
- **Modern Styling**: Dark theme with magical aesthetics and MTG-inspired design

### Technical Architecture
- **Scalable Backend**: FastAPI with async/await for high-performance concurrent games
- **Efficient Database**: MongoDB with optimized queries for card search and game state
- **Real-time Communication**: WebSocket implementation for sub-second game updates
- **Error Resilience**: Comprehensive error handling with graceful degradation
- **Performance Optimized**: Lazy loading, caching, and efficient state management

## Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **Motor**: Async MongoDB driver
- **Pydantic**: Data validation and serialization
- **Uvicorn**: ASGI server

### Frontend
- **Jinja2**: Template engine
- **HTMX**: Dynamic HTML without complex JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Alpine.js**: Minimal JavaScript framework

### Database
- **MongoDB**: Document database for flexible data storage

## Project Structure

```
app/
├── api/                    # API routes and WebSocket handlers
│   ├── routes.py          # REST endpoints for cards and games
│   └── websocket.py       # Real-time game communication
├── core/                  # Core configuration and database
│   ├── config.py          # Application settings
│   └── database.py        # MongoDB connection
├── models/                # Pydantic models and data structures
│   ├── game.py           # Game state, players, cards
│   └── card.py           # Card definitions and types
├── services/              # Business logic and game engine
│   ├── card_service.py   # Card search and management
│   └── game_engine.py    # Complete MTG rules engine
├── templates/             # Jinja2 HTML templates
│   ├── base_arena.html   # Base template with styling
│   ├── index.html        # Homepage
│   ├── game_lobby.html   # Game creation/joining
│   ├── game.html         # Live game interface
│   ├── cards.html        # Card search page
│   └── error.html        # Error handling
└── static/               # Static assets (CSS, JS, images)
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

# Integration tests
./integration_test.sh
./test_arena_interface.sh
```

### Development Workflow
1. **Feature Development**: Create feature branches for new functionality
2. **Code Review**: All changes require review before merging
3. **Testing**: Comprehensive test coverage for game logic and API
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

This project is under MIT license. The XMage integration component maintains its GPL license separately.

## Next Steps

### Short Term (Current Sprint)
1. **Enhanced Card Database**: Integrate MTGJson and Scryfall API for complete card data
2. **User Authentication**: Implement JWT-based authentication system
3. **Game History**: Store and display completed games and statistics

### Medium Term (Next Quarter)
4. **Deck Builder**: Complete deck construction interface with visual editor
5. **Tournament System**: Bracketed tournaments and leaderboards
6. **Mobile App**: React Native application for mobile gameplay

### Long Term (Future Releases)
7. **XMage Integration**: Replace simplified engine with XMage for complete rules coverage
8. **Multi-format Support**: Standard, Modern, Legacy, Commander format support
9. **AI Opponents**: Machine learning-based AI for solo play
10. **Community Features**: Guilds, forums, and social features

## Current Status

✅ **Production Ready Features:**
- Complete game interface with real-time multiplayer
- Full combat system with creature interactions
- Card search and database functionality
- WebSocket-based live updates
- Responsive design for all devices

🚧 **In Development:**
- Enhanced card database integration
- User authentication system
- Game statistics and history

📋 **Planned:**
- Deck builder interface
- Tournament support
- Mobile applications
