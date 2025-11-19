import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GraveyardZone from '../GraveyardZone.svelte';

type GameCardsAPI = {
    renderCardWithLoadingState: (...args: unknown[]) => string;
};

afterEach(() => {
    const globalTarget = globalThis as { GameCards?: GameCardsAPI };
    delete globalTarget.GameCards;
    vi.restoreAllMocks();
});

describe('GraveyardZone', () => {
    it('shows the empty state when there are no cards', () => {
        (globalThis as { GameCards?: GameCardsAPI }).GameCards = {
            renderCardWithLoadingState: vi.fn()
        };

        render(GraveyardZone, {
            props: {
                zoneIdentifier: 'gy-1',
                cards: [],
                cardsRemaining: 0
            }
        });

        expect(screen.getByText('Empty')).toBeTruthy();
        expect(screen.getByText('0 cards')).toBeTruthy();
    });

    it('renders stacked cards, overlay, and pointer-safe overlay interaction', () => {
        const renderCard = vi.fn().mockReturnValue('<div data-testid="graveyard-card">Card</div>');
        (globalThis as { GameCards?: GameCardsAPI }).GameCards = {
            renderCardWithLoadingState: renderCard
        };

        const cards = Array.from({ length: 7 }, (_, index) => ({ id: `card-${index}` }));

        render(GraveyardZone, {
            props: {
                zoneIdentifier: 'gy-2',
                cards,
                cardsRemaining: cards.length,
                overlayHtml: 'View<br>All'
            }
        });

        const layers = document.querySelectorAll('.graveyard-card-layer');
        expect(layers.length).toBe(5);
        layers.forEach((layer) => {
            expect(layer.getAttribute('oncontextmenu')).toBeNull();
        });
        renderCard.mock.calls.forEach((callArgs) => {
            expect(callArgs[7]).toEqual(expect.objectContaining({ disableContextMenu: true }));
        });
        expect(screen.getAllByTestId('graveyard-card').length).toBeGreaterThan(0);
        const overlay = document.querySelector('.graveyard-click-overlay') as HTMLDivElement | null;
        expect(overlay).not.toBeNull();
        expect(overlay?.style.pointerEvents).toBe('none');
        expect(screen.getByText((text) => text.includes('View'))).toBeTruthy();
    });

    it('invokes the click handler for the zone stack', async () => {
        const renderCard = vi.fn().mockReturnValue('<div></div>');
        (globalThis as { GameCards?: GameCardsAPI }).GameCards = {
            renderCardWithLoadingState: renderCard
        };

        const user = userEvent.setup();
        const handleClick = vi.fn();

        render(GraveyardZone, {
            props: {
                zoneIdentifier: 'gy-3',
                cards: [{ id: 'card-1' }],
                cardsRemaining: 1,
                onClick: handleClick
            }
        });

        const button = screen.getByRole('button');
        await user.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
