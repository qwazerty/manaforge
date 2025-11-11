# CSS Modernization & Tailwind Strategy

ManaForge currently ships **3.5k+ lines** of handcrafted CSS spread across eight legacy files (`game-*.css`). (`arena.css` has already been merged into Tailwind helpers.) This provides fine-grained control but makes the UI hard to evolve: duplicated colors, inconsistent spacing scales, and limited reuse between templates/components.

This document captures the plan to standardize styling around Tailwind CSS while keeping room for bespoke MTG visuals.

## 1. Current Snapshot (Feb 2025)

| Area | Details |
| --- | --- |
| CSS Footprint | 9 linked stylesheets · `wc -l app/static/css/*.css` ⇒ 3 493 LOC |
| Utility Coverage | Tailwind CLI 4.1.17 builds (`npm run build:css`) produce `static/css/dist/manaforge.css` from `static/css/tailwind.css`; CDN + runtime config removed |
| Repeated Values | `#c9aa71` (accent gold), `#1a1f2e` (surfaces), slate gray spectrum, etc. duplicated across files |
| Page Types | Game arena pages dominate; lobby/search reuse parts of the same palette |
| Pain Points | Hard to keep colors/spacing in sync, CSS growth >500 LOC per new feature, no autoprefixing/minification |

## 2. Objectives

1. **Single source of design tokens** (colors, typography, radii, spacing) exposed to both Tailwind utilities and bespoke CSS.
2. **Gradual migration**: allow templates to opt into Tailwind utilities component by component without a big-bang rewrite.
3. **Lean CSS payload** via Tailwind JIT purging only referenced classes.
4. **Developer ergonomics**: predictable `npm run dev:css` watcher + `npm run build:css` for deployment.

## 3. Tailwind-Centric Architecture

### 3.1 Tooling

- Node toolchain already added (Tailwind 4.1.17 + `@tailwindcss/cli` + PostCSS/Autoprefixer).  
- Entry file: `app/static/css/tailwind.css` contains the new `@import "tailwindcss";` directive, design tokens (`@theme`) and component layer helpers.
- Output file: `app/static/css/dist/manaforge.css` is generated via `npm run build:css` and linked in `base_arena.html`.
- Tailwind 4's CLI handles content scanning automatically for now; we'll introduce explicit `@source` globs or a config file when dynamic class generation becomes necessary.

### 3.2 Design Tokens

Expose the Magic Arena palette + typography as both Tailwind theme entries and CSS variables to help the legacy styles migrate.

Example (in `tailwind.css` base layer):

```css
:root {
  --arena-bg: #0a0e1a;
  --arena-surface: #1a1f2e;
  --arena-accent: #c9aa71;
  --arena-text: #e8e8e8;
  --arena-muted: #6b7280;
}
```

Then in Tailwind config:

```js
extend: {
  colors: {
    arena: {
      bg: 'rgb(var(--arena-bg) / <alpha-value>)',
      // …
    }
  },
  fontFamily: {
    ui: ['"Cinzel Decorative"', 'serif']
  }
}
```

Legacy CSS can progressively swap hard-coded colors for these variables, while templates can already rely on `bg-arena-bg`, `text-arena-text`, `font-ui`, etc.

### 3.3 Component Layer

Use `@layer components`/`@layer utilities` to re-express bespoke helpers with Tailwind primitives and keep semantic hooks for the templates:

```css
@layer components {
  .arena-card {
    @apply border border-arena-accent/30 bg-gradient-to-br from-arena-surface to-arena-surface-light rounded-lg shadow-lg transition-transform;
  }

  .arena-button {
    @apply bg-gradient-to-br from-arena-accent to-arena-accent-light text-arena-bg font-semibold px-4 py-2 rounded-md shadow-md hover:translate-y-[-1px];
  }

  .nav-link {
    @apply inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-arena-text transition-colors hover:text-arena-accent;
  }

  .accent-pill {
    @apply inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border border-arena-accent/30 text-arena-accent bg-arena-surface/60;
  }
}

@layer utilities {
  .bg-accent-gradient {
    background-image: linear-gradient(135deg, var(--color-arena-accent), var(--color-arena-accent-light));
  }

  .animate-glow {
    animation: glow 3s ease-in-out infinite alternate;
  }
}
```

This replaces entire rule blocks in `arena.css` while keeping the same class names for now (zero template churn). Over time, consumers can move to pure utility class compositions and delete the helper classes.

### 3.4 File Structure Going Forward

```
app/static/css/
│
├── dist/
│   └── manaforge.css        # generated bundle (git-ignored except for reference snapshot)
├── tailwind.css             # @tailwind entry + tokens/components
├── game-battlefield.css     # legacy (to refactor gradually)
├── …                        # other legacy files
└── README.md                # updated architecture notes
```

Legacy files shrink as responsibilities move into Tailwind layers or direct utilities. Once a file reaches < ~200 LOC and is utility-driven, merge it into `tailwind.css` or delete it.

Docker images now have a Node-based build stage that runs `npm ci && npm run build:css` before the Python runtime is assembled, so every container ships with up-to-date utilities without requiring Node in production.

## 4. Migration Roadmap

| Phase | Scope | Notes |
| --- | --- | --- |
| 0 · Foundation (current PR) | Tooling, tokens, component layer skeleton, templates load `dist/manaforge.css` instead of CDN | Keeps old CSS untouched |
| 1 · Shared Layouts | Header/footer, lobby/search pages adopt Tailwind utilities; delete redundant rules in `arena.css`, `game-ui.css` | Focus on non-battlefield UI |
| 2 · Game Zones & Cards | Convert layout grids to Tailwind (`grid`, `flex`, `gap`, responsive modifiers). Extract card sizes into CSS variables. | Requires pairing with JS that toggles classes |
| 3 · Polish & Cleanup | Remove unused legacy files, ensure docs/tests updated, watch size budgets | Use `npx tailwindcss --minify` in CI |

## 5. Action Items Checklist

- [x] Land Tailwind CLI toolchain + npm scripts (`dev:css`, `build:css`).
- [x] Update Docker build pipeline to run `npm run build:css` (multi-stage Node builder + README note).
- [x] Replace CDN `<script src="https://cdn.tailwindcss.com">` with local build artifact.
- [x] Start moving `arena.css` helpers into `@layer components` (`arena-card`, `arena-border`, `arena-button`, `mana-symbol`, nav links, pills, notifications, gradients, animations, etc.).
- [x] Identify two pilot templates (`index.html`, `game_lobby.html`) to showcase utility-based layout and remove redundant CSS; keep them as references for future conversions.
- [ ] Track CSS deletion metrics per PR to ensure progress.

Keeping this document close to the repo ensures everyone follows the same migration path and prevents regressions when new UI pieces land.
