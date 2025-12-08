/**
 * Unified browser entrypoint.
 * Mounts Svelte components and loads page-specific UI modules.
 */

type Mountable = { default: any; mount: (component: any, options: { target: Element }) => any };

const onReady = (fn: () => void) => {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
};

const mountSimple = async (loader: () => Promise<Mountable>, target: Element) => {
    const mod = await loader();
    mod.mount(mod.default, { target });
};

const ensureElement = (id: string, tag = 'div', parent: HTMLElement = document.body) => {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement(tag);
        el.id = id;
        parent.appendChild(el);
    }
    return el;
};

// Mount tasks
onReady(() => {
    // Game Core
    mountSimple(
        () => import('./ui/components/GameCore.esm.js'),
        document.getElementById('game-interface-root') || document.body
    );

    // Game Actions overlay
    mountSimple(() => import('./ui/components/GameActions.esm.js'), document.body);

    // WebSocket manager
    mountSimple(() => import('./ui/components/WebSocketManager.esm.js'), document.body);

    // Zones manager
    mountSimple(() => import('./ui/components/UIZonesManager.esm.js'), document.body);

    // Renderers/templates
    mountSimple(() => import('./ui/components/UIRenderersTemplates.esm.js'), document.body);

    // Combat panel
    mountSimple(
        () => import('./ui/components/GameCombat.esm.js'),
        document.getElementById('game-combat-root') || document.body
    );

    // Game cards module (hidden)
    mountSimple(() => import('./ui/components/GameCardsModule.esm.js'), (() => {
        const mountPoint = ensureElement('game-cards-module-mount');
        mountPoint.style.display = 'none';
        return mountPoint;
    })());

    // Card manager root
    mountSimple(() => import('./ui/components/CardManager.esm.js'), ensureElement('card-manager-root'));

    // Card context menu
    mountSimple(() => import('./ui/components/CardContextMenu.esm.js'), document.body);

    // Card preview modal
    mountSimple(() => import('./ui/components/CardPreviewModal.esm.js'), document.body);

    // Card search modal
    mountSimple(() => import('./ui/components/CardSearchModal.esm.js'), document.body);

    // Action history: wait for panel
    const attachActionHistory = async () => {
        const target = document.getElementById('action-history-panel');
        if (!target) {
            requestAnimationFrame(attachActionHistory);
            return;
        }
        mountSimple(() => import('./ui/components/ActionHistory.esm.js'), target);
    };
    attachActionHistory();
});

// Non-mount side-effect modules (remain as before)
import './ui/ui-horizontal-scroll.js';
import './ui/ui-battle-chat.js';
import './ui/ui-deck-manager.js';
import './ui/ui-home-page.js';
import './ui/ui-error-page.js';
import './ui/ui-game-lobby.js';
import './ui/ui-replay-room.js';
import './ui/ui-draft-lobby.js';
import './ui/ui-draft-room.js';
import './ui/ui-format-stats.js';
import './ui/ui-replay-lobby.js';
