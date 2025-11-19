import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionHistory from '../ActionHistory.svelte';

declare global {
    interface Window {
        UIActionHistory?: {
            _formatTime?: (timestamp: number) => string;
            _formatTurnLabel?: (entry: unknown) => string;
            _buildTurnKey?: (entry: unknown) => string | null;
            _formatPlayer?: (playerId: string) => string;
        };
    }
}

afterEach(() => {
    delete window.UIActionHistory;
});

describe('ActionHistory', () => {
    it('shows an empty placeholder when no entries exist', async () => {
        const { component } = render(ActionHistory, {
            props: {
                entries: []
            }
        });

        // eslint-disable-next-line no-console
        console.log('captured state', (component as any).$capture_state?.());

        expect(await screen.findByText('No actions yet')).toBeTruthy();
        expect(document.querySelector('[data-placeholder="true"]')).not.toBeNull();
    });

    it('uses helper hooks when provided on the window', async () => {
        const formatTime = vi.fn().mockReturnValue('10:10:10');
        const formatTurnLabel = vi.fn().mockReturnValue('Custom Turn Label');
        const buildTurnKey = vi.fn().mockReturnValue('turn-1');
        window.UIActionHistory = {
            _formatTime: formatTime,
            _formatTurnLabel: formatTurnLabel,
            _buildTurnKey: buildTurnKey
        };

        render(ActionHistory, {
            props: {
                entries: [
                    {
                        turn: 3,
                        turnPlayerLabel: 'Alice',
                        timestamp: 1_700_000_000_000,
                        player: 'Alice',
                        success: true,
                        action: 'Drew a card',
                        details: []
                    }
                ]
            }
        });

        expect(await screen.findByText('Custom Turn Label')).toBeTruthy();
        expect(screen.getByText('Drew a card')).toBeTruthy();
        expect(formatTime).toHaveBeenCalledWith(1_700_000_000_000);
        expect(formatTurnLabel).toHaveBeenCalled();
        expect(buildTurnKey).toHaveBeenCalled();
    });

    it('connects preview handlers to card interactions', async () => {
        const show = vi.fn();
        const move = vi.fn();
        const hide = vi.fn();
        const user = userEvent.setup();

        render(ActionHistory, {
            props: {
                previewHandlers: { show, move, hide },
                entries: [
                    {
                        turn: 5,
                        turnPlayerLabel: 'Bob',
                        timestamp: 1_700_000_500_000,
                        player: 'Bob',
                        success: true,
                        action: 'Revealed a card',
                        details: [
                            {
                                label: 'Reveal',
                                cardInfo: { name: 'Lightning Bolt' }
                            }
                        ]
                    }
                ]
            }
        });

        const cardButton = await screen.findByRole('button', { name: 'Lightning Bolt' });
        await user.hover(cardButton);
        expect(show).toHaveBeenCalledTimes(1);
        const [event, cardInfo, label, anchor] = show.mock.calls[0];
        expect(cardInfo).toEqual({ name: 'Lightning Bolt' });
        expect(label).toBe('Lightning Bolt');
        expect(anchor).toBe(cardButton);
        expect(event).toBeInstanceOf(MouseEvent);

        const moveCallsBefore = move.mock.calls.length;
        await fireEvent.mouseMove(cardButton);
        expect(move.mock.calls.length).toBeGreaterThan(moveCallsBefore);

        await user.unhover(cardButton);
        expect(hide).toHaveBeenCalledTimes(1);
    });
});
