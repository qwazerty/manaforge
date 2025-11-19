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
        (globalThis as Record<string, unknown>).GameCore = {
            getSelectedPlayer: () => 'player1',
            getGameState: () => ({
                players: [
                    { id: 'player1', graveyard: [] },
                    { id: 'player2', graveyard: [] }
                ]
            })
        };

        window.UIZonesManager.showZoneModal('graveyard');

        const popup = document.getElementById('zone-popup-graveyard');
        expect(popup).not.toBeNull();
        expect(popup?.classList.contains('hidden')).toBe(false);
        expect(popup?.getAttribute('aria-hidden')).toBe('false');
        expect(popup?.querySelector('.reveal-empty')).not.toBeNull();
    });
});
