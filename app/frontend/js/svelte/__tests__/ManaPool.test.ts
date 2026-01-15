import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ManaPool from '../ManaPool.svelte';

describe('ManaPool', () => {
    it('renders nothing when mana pool is empty', () => {
        const { container } = render(ManaPool, {
            props: {
                manaPool: {},
                playerId: 'player1'
            }
        });

        expect(container.querySelector('.mana-pool-container')).toBeNull();
    });

    it('renders mana badges for each color with mana', () => {
        render(ManaPool, {
            props: {
                manaPool: {
                    W: 3,
                    U: 2,
                    R: 1
                },
                playerId: 'player1'
            }
        });

        const whiteBadge = screen.getByTitle(/3 White mana/i);
        const blueBadge = screen.getByTitle(/2 Blue mana/i);
        const redBadge = screen.getByTitle(/1 Red mana/i);

        expect(whiteBadge).toBeTruthy();
        expect(blueBadge).toBeTruthy();
        expect(redBadge).toBeTruthy();
        
        expect(screen.getByText('3')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy();
    });

    it('displays mana in WUBRG order', () => {
        const { container } = render(ManaPool, {
            props: {
                manaPool: {
                    G: 1,
                    W: 2,
                    B: 3,
                    R: 4,
                    U: 5
                },
                playerId: 'player1'
            }
        });

        const badges = container.querySelectorAll('.mana-pool-badge');
        expect(badges.length).toBe(5);
        
        // Check order is WUBRG
        expect(badges[0].getAttribute('data-mana-color')).toBe('W');
        expect(badges[1].getAttribute('data-mana-color')).toBe('U');
        expect(badges[2].getAttribute('data-mana-color')).toBe('B');
        expect(badges[3].getAttribute('data-mana-color')).toBe('R');
        expect(badges[4].getAttribute('data-mana-color')).toBe('G');
    });

    it('filters out colors with zero mana', () => {
        const { container } = render(ManaPool, {
            props: {
                manaPool: {
                    W: 0,
                    U: 3,
                    B: 0,
                    R: 2,
                    G: 0
                },
                playerId: 'player1'
            }
        });

        const badges = container.querySelectorAll('.mana-pool-badge');
        expect(badges.length).toBe(2);
        expect(badges[0].getAttribute('data-mana-color')).toBe('U');
        expect(badges[1].getAttribute('data-mana-color')).toBe('R');
    });

    it('handles colorless mana', () => {
        render(ManaPool, {
            props: {
                manaPool: {
                    C: 5
                },
                playerId: 'player1'
            }
        });

        const colorlessBadge = screen.getByTitle(/5 Colorless mana/i);
        expect(colorlessBadge).toBeTruthy();
        expect(screen.getByText('5')).toBeTruthy();
    });

    it('includes player ID in data attributes', () => {
        const { container } = render(ManaPool, {
            props: {
                manaPool: {
                    W: 1
                },
                playerId: 'player2'
            }
        });

        const badge = container.querySelector('.mana-pool-badge');
        expect(badge?.getAttribute('data-player-id')).toBe('player2');
    });
});
