# CSS Architecture Documentation

## CSS File Structure

The CSS for ManaForge has been fully consolidated into a single Tailwind-based stylesheet for improved maintainability, performance, and clarity.

### CSS Files

-   **`dist/manaforge.css`**: Generated Tailwind 4 bundle (built from `tailwind.css`) that provides all design tokens, utilities, and component styles. This includes:
    - Arena helpers (mana symbols, gradients, nav links, etc.)
    - Game core styles
    - Battlefield layout styles
    - Player information display styles
    - Stack and popup styles
    - Responsive adjustments
    - Context menus and action history

-   **`tailwind.css`**: Source file containing all custom CSS rules organized in Tailwind layers (`@layer base`, `@layer components`, `@layer utilities`).

### Loading Mechanism

Only `manaforge.css` needs to be loaded in the `<head>` of templates:

```html
<!-- In base_arena.html -->
<link rel="stylesheet" href="/static/css/dist/manaforge.css">
```

## Naming Conventions

-   Classes generally follow a component-based approach (e.g., `.card-mini`, `.zone-modal`, `.player-info`).
-   Utility classes are used where appropriate (e.g., `.hidden`).
-   CSS custom properties (variables) are used for theming (colors, spacing, etc.).
