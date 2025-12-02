/**
 * Minimal helper to mount/unmount Svelte class components in ESM mode.
 * Keeps mounting consistent across entry points without duplicating code.
 */
export function mountComponent(Component, options = {}) {
    if (!Component) throw new Error('mountComponent requires a component');
    const { target, props } = options;
    if (!target) throw new Error('mountComponent requires a target element');
    return new Component({ target, props });
}

export function unmountComponent(instance) {
    if (instance && typeof instance.$destroy === 'function') {
        instance.$destroy();
    }
}
