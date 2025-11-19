import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../ui/ui-zones-manager.js';

declare global {
    interface Window {
        UIZonesManager: {
            showZoneModal: (zone: string) => void;
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

    beforeEach(() => {
        document.body.innerHTML = '<div id="game-board" style="width: 800px; height: 600px;"></div>';
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        });
        (globalThis as Record<string, unknown>).GameUtils = {
            escapeHtml: (value: unknown) => String(value ?? '')
        };
    });

    afterEach(() => {
        delete (globalThis as Record<string, unknown>).GameCore;
        delete (globalThis as Record<string, unknown>).GameUtils;
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
