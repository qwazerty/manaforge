import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DecisionModal from '../DecisionModal.svelte';

describe('DecisionModal', () => {
    it('emits confirm with collected decisions when every card is resolved', async () => {
        const user = userEvent.setup();
        const confirmHandler = vi.fn();
        render(DecisionModal, {
            props: {
                open: true,
                actionType: 'scry',
                cards: [
                    { id: 'card-1', name: 'Opt', image_url: '/opt.jpg' },
                    { id: 'card-2', name: 'Island' }
                ],
                onConfirm: ({ decisions }) => confirmHandler(decisions)
            }
        });

        await user.click(screen.getAllByRole('button', { name: 'Top' })[0]);
        await user.click(screen.getAllByRole('button', { name: 'Bottom' })[0]);

        await waitFor(() => expect(confirmHandler).toHaveBeenCalled());
        expect(confirmHandler).toHaveBeenCalledWith([
            { card_id: 'card-1', destination: 'top' },
            { card_id: 'card-2', destination: 'bottom' }
        ]);
    });

    it('notifies listeners when requesting another card', async () => {
        const user = userEvent.setup();
        const addOneMore = vi.fn();
        render(DecisionModal, {
            props: {
                open: true,
                actionType: 'surveil',
                cards: [{ id: 'card-3', name: 'Consider' }],
                onAddOneMore: addOneMore
            }
        });

        await user.click(screen.getByRole('button', { name: 'Surveil 1 more' }));
        expect(addOneMore).toHaveBeenCalledTimes(1);
    });

    it('falls back to default destinations when closing without manual choices', async () => {
        const user = userEvent.setup();
        const confirmHandler = vi.fn();
        render(DecisionModal, {
            props: {
                open: true,
                actionType: 'scry',
                cards: [{ id: 'card-4', name: 'Impulse' }],
                onConfirm: ({ decisions }) => confirmHandler(decisions)
            }
        });

        await user.click(screen.getByLabelText('Close modal'));

        await waitFor(() => expect(confirmHandler).toHaveBeenCalled());
        expect(confirmHandler).toHaveBeenCalledWith([
            { card_id: 'card-4', destination: 'bottom' }
        ]);
    });
});
