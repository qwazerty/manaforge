# CSS Architecture Documentation

## CSS File Structure

The CSS for ManaForge has been consolidated to improve maintainability, performance, and clarity. The new structure is based on loading a set of modular, purpose-driven stylesheets directly via `<link>` tags in the main `base_arena.html` template. The old practice of using `@import` has been removed.

### Final CSS Files

-   **`dist/manaforge.css`**: Generated Tailwind 4 bundle (built from `tailwind.css`) that provides the design tokens, utilities, and shared Arena helpers (mana symbols, gradients, nav links, etc.). Always load this first.
-   **`game-battlefield.css`**: Styles specific to the battlefield area where permanents reside.
-   **`game-core.css`**: Fundamental styles for the main game layout, containers, and core elements.
-   **`game-players.css`**: Styles for the player and opponent information displays (life, mana, etc.).
-   **`game-responsive.css`**: Contains all media queries and responsive adjustments for different screen sizes, particularly for 1080p height optimization.
-   **`game-stack.css`**: Styles for the game stack where spells and abilities are placed.
-   **`game-ui.css`**: Styles for common UI elements like buttons, notifications, context menus, and other interactive components.

### Loading Mechanism

`manaforge.css` replaces the previous Tailwind CDN script and must be loaded before the legacy files to ensure variables/utilities are available. All other stylesheets are linked directly in the `<head>` of `app/templates/base_arena.html`, which allows for parallel downloading by the browser and straightforward dependency management.

```html
<!-- In base_arena.html -->
<link rel="stylesheet" href="{{ url_for('static', path='css/dist/manaforge.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-battlefield.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-stack.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-players.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-core.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-ui.css') }}">
<link rel="stylesheet" href="{{ url_for('static', path='css/game-responsive.css') }}">
```

## Naming Conventions

-   Classes generally follow a component-based approach (e.g., `.card-mini`, `.zone-modal`, `.player-info`).
-   Utility classes are used where appropriate (e.g., `.hidden`).
-   CSS variables should be considered for common values like colors and spacing in future development.
