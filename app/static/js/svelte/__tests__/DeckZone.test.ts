import { screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@ui/testing/renderWithProviders';
import DeckZone from '../DeckZone.svelte';

describe('DeckZone', () => {
    it('shows an empty state when no cards remain', () => {
        renderWithProviders(DeckZone, {
            props: {
                cardsRemaining: 0,
                deckClass: 'deck-button',
                zoneIdentifier: 'library',
                overlayText: 'Draw'
            }
        });

        const button = screen.getByRole('button');
        expect(button.dataset.zoneContext).toBe('library');

        const emptyState = screen.getByTestId('empty-zone');
        expect(emptyState.getAttribute('aria-label')).toBe('Deck is empty');
        expect(screen.getByText('0 cards')).toBeTruthy();
    });

    it('renders stacked cards when the deck has cards remaining', () => {
        renderWithProviders(DeckZone, {
            props: {
                cardsRemaining: 3,
                deckClass: 'deck-button',
                zoneIdentifier: 'library',
                overlayText: 'Draw a card'
            }
        });

        expect(screen.getByText('Draw a card')).toBeTruthy();
        expect(screen.getByText('3 cards')).toBeTruthy();
        const layers = document.querySelectorAll('.deck-card-layer');
        expect(layers.length).toBe(3);
    });

    it('invokes the click handler when provided', async () => {
        const handleClick = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(DeckZone, {
            props: {
                cardsRemaining: 5,
                deckClass: 'deck-button',
                zoneIdentifier: 'library',
                overlayText: 'Draw one',
                onClick: handleClick
            }
        });

        const button = screen.getByRole('button');
        await user.click(button);
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
