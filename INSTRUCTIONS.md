# Workspace Instructions

- Do not run `npm run ...` or `npm build ...` commands from this environment. The user will execute all `npm run` tasks manually on their side.
- You can run tests, using the `corepack pnpm test:unit` command.

## Svelte Development Guidelines

This project uses Svelte 5 in Runes mode. When writing or migrating Svelte components, you MUST follow these rules:

1.  **Reactivity**: Use Runes for state management.
    -   Use `$state(initialValue)` for reactive variables instead of `let variable = initialValue;`.
    -   Use `$derived(expression)` for derived values instead of `$: derived = expression;`.
    -   Use `$effect(() => { ... })` for side effects instead of `$: { ... }`.

2.  **Event Handling**: Use standard HTML attributes.
    -   Use `onclick={handler}` instead of `on:click={handler}`.
    -   Use `oninput={handler}` instead of `on:input={handler}`.
    -   This applies to all events (submit, keydown, etc.).

3.  **Props**: Use `$props()` rune.
    -   `let { prop1, prop2 = default } = $props();`

4.  **Component Mounting**:
    -   Use `mount(Component, { target: element })` from `svelte` (or `svelte/legacy` if using `createClassComponent` wrapper) instead of `new Component({ target: element })`.