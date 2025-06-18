# CSS Architecture Documentation

## CSS File Structure

The CSS for ManaForge has been consolidated to improve maintainability, performance, and clarity. The new structure is based on loading a set of modular, purpose-driven stylesheets directly via `<link>` tags in the main `base_arena.html` template. The old practice of using `@import` has been removed.

### Final CSS Files

-   **`arena.css`**: Base styles for the overall site theme and non-game pages.
-   **`game-battlefield.css`**: Styles specific to the battlefield area where permanents reside.
-   **`game-cards.css`**: Core styles for all card representations (in hand, on battlefield, tapped, etc.).
-   **`game-core.css`**: Fundamental styles for the main game layout, containers, and core elements.
-   **`game-modals.css`**: Styles for all modal dialogs, including zone viewers and selection prompts.
-   **`game-players.css`**: Styles for the player and opponent information displays (life, mana, etc.).
-   **`game-responsive.css`**: Contains all media queries and responsive adjustments for different screen sizes, particularly for 1080p height optimization.
-   **`game-stack.css`**: Styles for the game stack where spells and abilities are placed.
-   **`game-ui.css`**: Styles for common UI elements like buttons, notifications, context menus, and other interactive components.
-   **`game-zones.css`**: Consolidated styles for all player and opponent zones (Hand, Deck, Graveyard, Exile).

### Loading Mechanism

All the stylesheets listed above are now linked directly in the `<head>` of the `app/templates/base_arena.html` template. This allows for parallel downloading by the browser and a more straightforward dependency management.

```html
<!-- In base_arena.html -->
<link rel="stylesheet" href="{{ url_for('static', path='css/arena.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-battlefield.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-cards.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-stack.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-zones.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-players.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-core.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-ui.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-modals.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-responsive.css') }}">
```

## Naming Conventions

-   Classes generally follow a component-based approach (e.g., `.card-mini`, `.zone-modal`, `.player-info`).
-   Utility classes are used where appropriate (e.g., `.hidden`).
-   CSS variables should be considered for common values like colors and spacing in future development.
