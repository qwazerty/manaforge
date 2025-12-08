/**
 * Unified browser entrypoint (Vite + Svelte).
 * Mounts core components and imports side-effect modules.
 */
import { mount } from 'svelte';

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
        } catch (e) {
            config = {};
        }
        mount(GameRoomSetup, { target: gameSetupRoot, props: { config } });
    }

    const deckLibraryRoot = document.getElementById('deck-library-root');
    if (deckLibraryRoot) {
        mount(DeckLibrary, { target: deckLibraryRoot });
    }
});
