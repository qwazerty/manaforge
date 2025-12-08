import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ActionPanel from '../ActionPanel.svelte';

describe('ActionPanel', () => {
    it('renders spectator messaging when spectator mode is active', () => {
        render(ActionPanel, {
            props: {
                spectatorMode: true,
                spectatorInfo: {
                    icon: '👀',
                    title: 'Spectateur',
                    message: 'Les contrôles sont verrouillés.'
                }
            }
        });

        expect(screen.getByText('👀')).toBeTruthy();
        expect(screen.getByText('Spectateur')).toBeTruthy();
        expect(screen.getByText('Les contrôles sont verrouillés.')).toBeTruthy();
    });

    it('invokes provided handlers for main controls', async () => {
        const passHandler = vi.fn();
        const searchHandler = vi.fn();
        const quickHandler = vi.fn();
        const user = userEvent.setup();

        render(ActionPanel, {
            props: {
                spectatorMode: false,
                passButton: {
                    label: 'Pass Priority',
                    title: 'Passes priority to opponent',
                    className: 'primary-btn',
                    onClick: passHandler
                },
                searchButton: {
                    label: 'Search Library',
                    title: 'Opens deck search',
                    className: 'secondary-btn',
                    onClick: searchHandler
                },
                quickButtons: [
                    {
                        id: 'qb-1',
                        label: 'Investigate',
                        title: 'Investigate clues',
                        className: 'quick-btn',
                        onClick: quickHandler
                    }
                ]
            }
        });

        await user.click(screen.getByRole('button', { name: 'Pass Priority' }));
        await user.click(screen.getByRole('button', { name: 'Search Library' }));
        await user.click(screen.getByRole('button', { name: 'Investigate' }));

        expect(passHandler).toHaveBeenCalledTimes(1);
        expect(searchHandler).toHaveBeenCalledTimes(1);
        expect(quickHandler).toHaveBeenCalledTimes(1);
    });

    it('only triggers the phase click handler for interactive phases', async () => {
        const phaseClickHandler = vi.fn();
        const user = userEvent.setup();
        const baseProps = {
            spectatorMode: false,
            phases: [
                { id: 'begin', name: 'Begin Phase', icon: '🌅' },
                { id: 'main', name: 'Main Phase', icon: '⚔️' },
                { id: 'end', name: 'End Phase', icon: '🌙' }
            ],
            currentPhase: 'begin',
            phaseClickHandler
        };

        const { rerender } = render(ActionPanel, { props: baseProps });

        const mainPhaseButton = await screen.findByTitle('Main Phase Phase');
        await user.click(mainPhaseButton);
        expect(phaseClickHandler).toHaveBeenCalledWith('main');

        await user.click(await screen.findByTitle('Begin Phase Phase'));
        expect(phaseClickHandler).toHaveBeenCalledTimes(1);

        type PanelTestProps = typeof baseProps & { readOnlyPhases?: boolean };
        const rerenderComponent = rerender as unknown as (props: PanelTestProps) => void;
        await rerenderComponent({ ...baseProps, readOnlyPhases: true });
        await user.click(await screen.findByTitle('Main Phase Phase'));
        expect(phaseClickHandler).toHaveBeenCalledTimes(1);
    });
});
