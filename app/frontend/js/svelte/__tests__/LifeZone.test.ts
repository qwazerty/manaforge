import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LifeZone from '../LifeZone.svelte';

describe('LifeZone', () => {
    it('renders the life total, counters, and provided buttons', () => {
        render(LifeZone, {
            props: {
                life: 18,
                counters: [
                    { type: 'poison', amount: 3, icon: '☠️', label: 'Poison' }
                ],
                negativeControls: [
                    { id: 'neg-1', label: '-1', className: 'btn-neg', title: 'Lose 1 life' }
                ],
                positiveControls: [
                    { id: 'pos-1', label: '+1', className: 'btn-pos', title: 'Gain 1 life' }
                ]
            }
        });

        expect(screen.getByText(/18/)).toBeTruthy();
        expect(screen.getByText('Poison')).toBeTruthy();
        expect(screen.getByText('3')).toBeTruthy();
        expect(screen.getByRole('button', { name: '-1' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '+1' })).toBeTruthy();
    });

    it('calls the control handlers and manage button when clicked', async () => {
        const loseLife = vi.fn();
        const gainLife = vi.fn();
        const manageCounters = vi.fn();
        const user = userEvent.setup();

        render(LifeZone, {
            props: {
                negativeControls: [
                    { id: 'neg', label: '-2', className: 'btn-neg', title: 'Lose 2 life', onClick: loseLife }
                ],
                positiveControls: [
                    { id: 'pos', label: '+2', className: 'btn-pos', title: 'Gain 2 life', onClick: gainLife }
                ],
                manageButton: {
                    label: 'Manage counters',
                    title: 'Open counter manager',
                    className: 'btn-manage',
                    onClick: manageCounters
                }
            }
        });

        await user.click(screen.getByRole('button', { name: '-2' }));
        await user.click(screen.getByRole('button', { name: '+2' }));
        await user.click(screen.getByRole('button', { name: 'Manage counters' }));

        expect(loseLife).toHaveBeenCalledTimes(1);
        expect(gainLife).toHaveBeenCalledTimes(1);
        expect(manageCounters).toHaveBeenCalledTimes(1);
    });

    it('reveals the custom life controls when enabled', () => {
        render(LifeZone, {
            props: {
                playerId: 'alpha',
                hasCustomLifeControls: true
            }
        });

        expect(screen.getByText('Enter a custom amount')).toBeTruthy();
        const customContainer = document.getElementById('life-custom-input-alpha');
        expect(customContainer).not.toBeNull();
        expect(customContainer?.classList.contains('hidden')).toBe(true);
    });

    it('displays mana pool when provided', () => {
        const { container } = render(LifeZone, {
            props: {
                life: 20,
                playerId: 'player1',
                manaPool: {
                    W: 2,
                    U: 3
                }
            }
        });

        const manaPoolContainer = container.querySelector('.mana-pool-container');
        expect(manaPoolContainer).not.toBeNull();
        expect(screen.getByTitle(/2 White mana/i)).toBeTruthy();
        expect(screen.getByTitle(/3 Blue mana/i)).toBeTruthy();
    });
});
