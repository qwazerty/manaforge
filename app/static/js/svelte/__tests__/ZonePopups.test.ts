import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { createClassComponent } from 'svelte/legacy';
import ZonePopup from '../ZonePopup.svelte';
import UIZonesManager from '../UIZonesManager.svelte';

declare global {
    interface Window {
        UIZonesManager: {
            showZoneModal: (zone: string) => void;
            closeZoneModal: (zone: string) => void;
            _zonePopupElements: Map<string, unknown>;
            _zonePopupComponents: Map<string, unknown>;
            _deckZoneConfigs: Map<string, unknown>;
            _graveyardZoneConfigs: Map<string, unknown>;
            _exileZoneConfigs: Map<string, unknown>;
            _lifeZoneConfigs: Map<string, unknown>;
        };
    }
}

describe('Zone popups', () => {
    const installGameCore = (stateOverrides: Record<string, unknown> = {}) => {
        const defaultState = {
            players: [
                { id: 'player1', graveyard: [], exile: [] },
                { id: 'player2', graveyard: [], exile: [] }
            ]
        };
        (globalThis as Record<string, unknown>).GameCore = {
            getSelectedPlayer: () => 'player1',
            getGameState: () => ({
                ...defaultState,
                ...stateOverrides
            })
        };
    };

    beforeEach(async () => {
        document.body.innerHTML = '<div id="game-board" style="width: 800px; height: 600px;"></div>';
        
        // Render the UIZonesManager component to install window.UIZonesManager
        render(UIZonesManager);
        
        // Wait for onMount to execute
        await waitFor(() => {
            expect(window.UIZonesManager).toBeDefined();
        });
        
        // Reset UIZonesManager state
        if (window.UIZonesManager) {
            window.UIZonesManager._zonePopupElements = new Map();
            window.UIZonesManager._zonePopupComponents = new Map();
            window.UIZonesManager._deckZoneConfigs = new Map();
            window.UIZonesManager._graveyardZoneConfigs = new Map();
            window.UIZonesManager._exileZoneConfigs = new Map();
            window.UIZonesManager._lifeZoneConfigs = new Map();
        }

        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        });
        (globalThis as Record<string, unknown>).GameUtils = {
            escapeHtml: (value: unknown) => String(value ?? '')
        };

        (globalThis as Record<string, unknown>).ZonePopupComponent = {
            default: ZonePopup,
            mount: (component: unknown, options: Record<string, unknown>) =>
                createClassComponent({ component, ...options })
        };
    });

    afterEach(() => {
        delete (globalThis as Record<string, unknown>).GameCore;
        delete (globalThis as Record<string, unknown>).GameUtils;
        delete (globalThis as Record<string, unknown>).ZonePopupComponent;
        vi.unstubAllGlobals();
    });

    it('shows the graveyard popup even when the zone is empty', () => {
        installGameCore();

        window.UIZonesManager.showZoneModal('graveyard');

        const popup = document.getElementById('zone-popup-graveyard');
        expect(popup).not.toBeNull();
        expect(popup?.classList.contains('hidden')).toBe(false);
        expect(popup?.getAttribute('aria-hidden')).toBe('false');
        expect(popup?.dataset.appear).toBe('visible');
        expect(popup?.querySelector('.reveal-empty')).not.toBeNull();
    });

    it('sets the correct appear state when opening the exile popup', () => {
        installGameCore();

        window.UIZonesManager.showZoneModal('exile');

        const popup = document.getElementById('zone-popup-exile');
        expect(popup).not.toBeNull();
        expect(popup?.dataset.appear).toBe('visible');
        expect(popup?.classList.contains('hidden')).toBe(false);
    });

    it('resets the appear state when the popup is closed', () => {
        installGameCore();
        window.UIZonesManager.showZoneModal('graveyard');

        window.UIZonesManager.closeZoneModal('graveyard');

        const popup = document.getElementById('zone-popup-graveyard');
        expect(popup).not.toBeNull();
        expect(popup?.dataset.appear).toBe('hidden');
        expect(popup?.classList.contains('hidden')).toBe(true);
        expect(popup?.getAttribute('aria-hidden')).toBe('true');
    });
});
