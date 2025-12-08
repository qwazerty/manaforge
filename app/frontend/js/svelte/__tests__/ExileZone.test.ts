import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExileZone from '../ExileZone.svelte';

type GameCardsAPI = {
    renderCardWithLoadingState: (...args: unknown[]) => string;
};

afterEach(() => {
    const globalTarget = globalThis as { GameCards?: GameCardsAPI };
    delete globalTarget.GameCards;
    vi.restoreAllMocks();
});

describe('ExileZone', () => {
    it('renders the empty state when no cards remain', () => {
        const renderCard = vi.fn();
        (globalThis as { GameCards?: GameCardsAPI }).GameCards = {
            renderCardWithLoadingState: renderCard
        };

        render(ExileZone, {
            props: {
                zoneIdentifier: 'exile-zone',
                cards: [],
                cardsRemaining: 0
            }
        });

        expect(screen.getByText('Empty')).toBeTruthy();
        expect(screen.getByText('0 cards')).toBeTruthy();
        expect(document.querySelectorAll('.exile-card-layer').length).toBe(0);
        expect(renderCard).not.toHaveBeenCalled();
    });

    it('renders stacked cards, overlay, and top-card preview when cards exist', () => {
        const renderCard = vi.fn().mockReturnValue('<div data-testid="exile-top-card">Top Card</div>');
        (globalThis as { GameCards?: GameCardsAPI }).GameCards = {
            renderCardWithLoadingState: renderCard
        };

        const cards = Array.from({ length: 6 }, (_, index) => ({ id: `card-${index}` }));

        render(ExileZone, {
            props: {
                zoneIdentifier: 'exile-zone',
                cards,
                cardsRemaining: cards.length,
                overlayHtml: 'Inspect<br>Zone',
                topCard: { id: 'top-card' }
            }
        });

        // capped to five layers even if more cards exist
        expect(document.querySelectorAll('.exile-card-layer').length).toBe(5);
        expect(
            screen.getByText((text) => text.includes('Inspect'))
        ).toBeTruthy();
        expect(screen.getByText(`${cards.length} cards`)).toBeTruthy();
        expect(screen.getByTestId('exile-top-card')).toBeTruthy();
        expect(renderCard).toHaveBeenCalledWith({ id: 'top-card' }, 'card-front-mini', true, 'exile');
    });

    it('invokes the click handler when the stack is pressed', async () => {
        const renderCard = vi.fn().mockReturnValue('');
        (globalThis as { GameCards?: GameCardsAPI }).GameCards = {
            renderCardWithLoadingState: renderCard
        };

        const user = userEvent.setup();
        const handleClick = vi.fn();

        render(ExileZone, {
            props: {
                zoneIdentifier: 'exile-zone',
                cards: [{ id: 'test-card' }],
                cardsRemaining: 1,
                topCard: { id: 'test-card' },
                onClick: handleClick
            }
        });

        const button = screen.getByRole('button');
        await user.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
