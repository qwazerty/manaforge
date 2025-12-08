/**
 * Unified browser entrypoint (Vite + Svelte).
 * Mounts core components and page-specific components.
 */
import { mount } from 'svelte';
import { mountOnReady } from '@lib/mount-utils';

// Core game components (always loaded)
import GameCore from '@svelte/GameCore.svelte';
import GameActions from '@svelte/GameActions.svelte';
import WebSocketManager from '@svelte/WebSocketManager.svelte';
import UIZonesManager from '@svelte/UIZonesManager.svelte';
import UIRenderersTemplates from '@svelte/UIRenderersTemplates.svelte';
import GameCombat from '@svelte/GameCombat.svelte';
import GameCardsModule from '@svelte/GameCardsModule.svelte';
import CardManager from '@svelte/CardManager.svelte';
import CardContextMenu from '@svelte/CardContextMenu.svelte';
import CardPreviewModal from '@svelte/CardPreviewModal.svelte';
import CardSearchModal from '@svelte/CardSearchModal.svelte';
import ActionHistory from '@svelte/ActionHistory.svelte';
import GameRoomSetup from '@svelte/GameRoomSetup.svelte';
import DeckLibrary from '@svelte/DeckLibrary.svelte';

// Page-specific components
import DeckManager from '@svelte/DeckManager.svelte';
import DraftLobby from '@svelte/DraftLobby.svelte';
import DraftRoom from '@svelte/DraftRoom.svelte';
import ErrorPage from '@svelte/ErrorPage.svelte';
import FormatStats from '@svelte/FormatStats.svelte';
import GameLobby from '@svelte/GameLobby.svelte';
import HomePage from '@svelte/HomePage.svelte';
import HorizontalScrollManager from '@svelte/HorizontalScrollManager.svelte';
import ReplayLobby from '@svelte/ReplayLobby.svelte';
import ReplayRoom from '@svelte/ReplayRoom.svelte';

// Side-effect modules (global utilities)
import './ui/ui-battle-chat.js';
import './ui/ui-global.js';

// ============================================================================
// Page-specific component mounts (consolidated from ui-*.js files)
// ============================================================================
mountOnReady([
    // Home page
    { targetId: 'home-root', component: HomePage, moduleName: 'home-page' },

    // Deck management
    { targetId: 'deck-manager-root', component: DeckManager, moduleName: 'deck-manager' },

    // Game lobby
    { targetId: 'svelte-game-lobby', component: GameLobby, moduleName: 'game-lobby' },

    // Draft pages
    { targetId: 'svelte-draft-lobby', component: DraftLobby, moduleName: 'draft-lobby' },
    {
        targetId: 'draft-room-root',
        component: DraftRoom,
        propsDataAttr: 'room',
        moduleName: 'draft-room'
    },

    // Replay pages
    { targetId: 'replay-lobby-root', component: ReplayLobby, moduleName: 'replay-lobby' },
    {
        targetId: 'replay-app',
        component: ReplayRoom,
        propFromDataAttr: { attrName: 'gameId', propName: 'gameId' },
        moduleName: 'replay-room'
    },

    // Error page
    {
        targetId: 'error-root',
        component: ErrorPage,
        propsScriptId: 'error-props',
        moduleName: 'error-page'
    },

    // Format stats
    {
        targetId: 'format-stats-root',
        component: FormatStats,
        propsScriptId: 'format-stats-props',
        moduleName: 'format-stats'
    },

    // Horizontal scroll (creates its own container)
    {
        targetId: 'horizontal-scroll-root',
        component: HorizontalScrollManager,
        createIfMissing: true,
        moduleName: 'horizontal-scroll'
    }
]);

// ============================================================================
// Core game components (mounted on game pages)
// ============================================================================
const onReady = (fn: () => void) => {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
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

onReady(() => {
    const gameInterface = document.getElementById('game-interface-root') || document.body;
    mount(GameCore, { target: gameInterface });
    mount(GameActions, { target: document.body });
    mount(WebSocketManager, { target: document.body });
    mount(UIZonesManager, { target: document.body });
    mount(UIRenderersTemplates, { target: document.body });
    mount(GameCombat, { target: document.getElementById('game-combat-root') || document.body });

    const cardsMount = ensureElement('game-cards-module-mount');
    cardsMount.style.display = 'none';
    mount(GameCardsModule, { target: cardsMount });

    mount(CardManager, { target: ensureElement('card-manager-root') });
    mount(CardContextMenu, { target: document.body });
    mount(CardPreviewModal, { target: document.body });
    mount(CardSearchModal, { target: document.body });

    const attachActionHistory = () => {
        const target = document.getElementById('action-history-panel');
        if (!target) {
            requestAnimationFrame(attachActionHistory);
            return;
        }
        mount(ActionHistory, { target });
    };
    attachActionHistory();

    const gameSetupRoot = document.getElementById('game-setup-root');
    if (gameSetupRoot) {
        let config = {};
        try {
            config = JSON.parse(gameSetupRoot.dataset?.gameRoomConfig || '{}');
        } catch {
            config = {};
        }
        mount(GameRoomSetup, { target: gameSetupRoot, props: { config } });
    }

    const deckLibraryRoot = document.getElementById('deck-library-root');
    if (deckLibraryRoot) {
        mount(DeckLibrary, { target: deckLibraryRoot });
    }
});
