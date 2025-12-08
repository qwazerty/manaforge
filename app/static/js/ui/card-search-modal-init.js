/**
 * ManaForge Card Search Modal Initialization
 * Bootstraps the CardSearchModal Svelte component
 */
/**
 * ManaForge Card Search Modal Initialization
 * Bootstraps the CardSearchModal Svelte component
 */
import CardSearchModal, { mount } from './components/CardSearchModal.esm.js';

if (typeof document !== 'undefined') {
    const init = () => {
        const target = document.body;
        if (!target) return;
        try {
            mount(CardSearchModal, { target });
        } catch (error) {
            console.error('[CardSearchModal] failed to initialize', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
