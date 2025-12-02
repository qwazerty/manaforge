import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActionHistory from '../ActionHistory.svelte';
import {
    addActionHistoryEntry,
    clearActionHistory
} from '../stores/actionHistoryStore.js';

declare global {
    interface Window {
        CardPreviewModal?: {
            show?: ReturnType<typeof vi.fn>;
            updatePosition?: ReturnType<typeof vi.fn>;
            hide?: ReturnType<typeof vi.fn>;
        };
    }
}

beforeEach(() => {
    clearActionHistory();
});

afterEach(() => {
    clearActionHistory();
    delete window.CardPreviewModal;
});

describe('ActionHistory', () => {
    it('shows an empty placeholder when no entries exist', async () => {
        render(ActionHistory);

        expect(await screen.findByText('No actions yet')).toBeTruthy();
        expect(document.querySelector('[data-placeholder="true"]')).not.toBeNull();
    });

    it('renders action entries from the shared store', async () => {
        addActionHistoryEntry(
            {
                action: 'draw_card',
                player: 'player2',
                success: true,
                timestamp: 1_700_000_000_000,
                details: []
            },
            {
                payload: {
                    turn: 3,
                    turn_player_name: 'Alice'
                }
            }
        );

        render(ActionHistory);

        expect(await screen.findByText('Draw Card')).toBeTruthy();
        expect(screen.getByText('Player 2')).toBeTruthy();
        expect(screen.getByText(/Tour 3/i)).toBeTruthy();
    });

    it('connects preview interactions to CardPreviewModal helpers', async () => {
        const show = vi.fn();
        const move = vi.fn();
        const hide = vi.fn();
        const user = userEvent.setup();

        window.CardPreviewModal = {
            show: show,
            updatePosition: move,
            hide: hide
        };

        addActionHistoryEntry({
            action: 'reveal_card',
            player: 'player1',
            success: true,
            details: {
                card: {
                    name: 'Lightning Bolt',
                    card_id: 'lb-123'
                }
            }
        });

        render(ActionHistory);

        const cardButton = await screen.findByRole('button', { name: 'Lightning Bolt' });
        await user.hover(cardButton);
        expect(show).toHaveBeenCalledTimes(1);

        const moveCallsBefore = move.mock.calls.length;
        await fireEvent.mouseMove(cardButton);
        expect(move.mock.calls.length).toBeGreaterThan(moveCallsBefore);

        await user.unhover(cardButton);
        expect(hide).toHaveBeenCalledTimes(1);
    });
});
