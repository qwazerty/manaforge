import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PlayerCounterModal from '../PlayerCounterModal.svelte';

describe('PlayerCounterModal', () => {
    it('renders counters and triggers the modify/remove handlers', async () => {
        const onModify = vi.fn();
        const onRemove = vi.fn();
        const onClose = vi.fn();
        const user = userEvent.setup();

        render(PlayerCounterModal, {
            props: {
                open: true,
                playerName: 'Alice',
                playerId: 'player1',
                counters: [
                    { type: 'poison', amount: 2, label: 'Poison', icon: '☠️' }
                ],
                onModify,
                onRemove,
                onClose
            }
        });

        await user.click(screen.getByLabelText('Retirer un compteur Poison'));
        await user.click(screen.getByLabelText('Ajouter un compteur Poison'));
        await user.click(screen.getByRole('button', { name: 'Réinitialiser' }));

        expect(onModify).toHaveBeenNthCalledWith(1, 'poison', -1);
        expect(onModify).toHaveBeenNthCalledWith(2, 'poison', 1);
        expect(onRemove).toHaveBeenCalledWith('poison');

        await user.click(screen.getByRole('button', { name: 'Fermer' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('submits a new counter via the form', async () => {
        const onAdd = vi.fn();
        const user = userEvent.setup();

        render(PlayerCounterModal, {
            props: {
                open: true,
                playerName: 'Bob',
                playerId: 'player2',
                counters: [],
                onAdd
            }
        });

        const typeInput = screen.getByPlaceholderText('Poison, charge...');
        const amountInput = screen.getByRole('spinbutton') as HTMLInputElement;
        const submitButton = screen.getByRole('button', { name: /ajouter/i });

        await user.type(typeInput, 'energy');
        await user.clear(amountInput);
        await user.type(amountInput, '4');
        await user.click(submitButton);

        expect(onAdd).toHaveBeenCalledWith('energy', 4);
        expect((typeInput as HTMLInputElement).value).toBe('');
        expect(amountInput.value).toBe('1');
    });

    it('closes when clicking the backdrop or pressing Escape', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();

        const { container } = render(PlayerCounterModal, {
            props: {
                open: true,
                playerName: 'Eve',
                playerId: 'player3',
                counters: [],
                onClose
            }
        });

        const backdrop = container.querySelector('#player-counter-modal');
        expect(backdrop).not.toBeNull();
        await user.click(backdrop as Element);
        expect(onClose).toHaveBeenCalledTimes(1);

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
