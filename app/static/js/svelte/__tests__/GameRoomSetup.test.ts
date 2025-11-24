import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import GameRoomSetup from '../GameRoomSetup.svelte';
import type { ComponentType } from 'svelte';
import { DeckStorage } from '../../lib/deck-storage';

const GameRoomSetupComponent = GameRoomSetup as unknown as ComponentType;

const baseConfig = {
    gameId: 'GAME-123',
    playerRole: 'spectator',
    setupApiUrl: '',
    submitApiUrl: '',
    gameInterfaceUrl: '/game/GAME-123',
    shareLinks: {
        player1: 'https://example.com/p1',
        player2: 'https://example.com/p2',
        spectator: 'https://example.com/spec'
    },
    initialStatus: {
        status: 'Waiting for players',
        game_format: 'modern',
        phase_mode: 'strict',
        player_status: {
            player1: { seat_claimed: true, submitted: false, validated: false, deck_name: null },
            player2: { seat_claimed: false, submitted: false, validated: false, deck_name: null }
        }
    }
};

afterEach(() => {
    window.localStorage.clear();
});

describe('GameRoomSetup', () => {
    it('renders spectator overview and share links', () => {
        render(GameRoomSetupComponent, {
            props: {
                config: baseConfig
            }
        });

        expect(screen.getByText('⚙️ Duel Preparation')).toBeTruthy();
        expect(screen.getByText('Spectator Mode')).toBeTruthy();
        expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
        expect(screen.getByText('Deck submissions:')).toBeTruthy();
    });

    it('shows deck form for seated player with deck library entries', async () => {
        const deckState = {
            columns: {
                cmc1: ['entry-1'],
                cmc2: [],
                cmc3: [],
                cmc4: [],
                cmc5: [],
                cmc6plus: [],
                lands: [],
                sideboard: [],
                commander: []
            },
            entries: {
                'entry-1': { quantity: 4, card: { name: 'Lightning Bolt' } }
            }
        };
        DeckStorage.save({
            id: 'deck-1',
            name: 'Izzet Blitz',
            format: 'modern',
            state: deckState,
            updatedAt: new Date().toISOString()
        });

        render(GameRoomSetupComponent, {
            props: {
                config: {
                    ...baseConfig,
                    playerRole: 'player1',
                    initialStatus: {
                        ...baseConfig.initialStatus,
                        player_status: {
                            player1: { seat_claimed: true, submitted: false, validated: false },
                            player2: { seat_claimed: false, submitted: false, validated: false }
                        }
                    }
                }
            }
        });

        expect(await screen.findByText(/Submit Your Deck/i)).toBeTruthy();
        expect(await screen.findByRole('button', { name: /Load deck/i })).toBeTruthy();
    });

    it('loads a deck from the library into the textarea', async () => {
        const deckState = {
            columns: {
                cmc1: ['entry-1'],
                cmc2: [],
                cmc3: [],
                cmc4: [],
                cmc5: [],
                cmc6plus: [],
                lands: [],
                sideboard: [],
                commander: []
            },
            entries: {
                'entry-1': { quantity: 4, card: { name: 'Lightning Bolt' } }
            }
        };
        DeckStorage.save({
            id: 'deck-1',
            name: 'Red Deck',
            format: 'modern',
            state: deckState,
            updatedAt: new Date().toISOString()
        });

        render(GameRoomSetupComponent, {
            props: {
                config: {
                    ...baseConfig,
                    playerRole: 'player1',
                    initialStatus: {
                        ...baseConfig.initialStatus,
                        player_status: {
                            player1: { seat_claimed: true, submitted: false, validated: false },
                            player2: { seat_claimed: true, submitted: false, validated: false }
                        }
                    }
                }
            }
        });

        const user = userEvent.setup();
        await user.click(await screen.findByRole('button', { name: /Load deck/i }));

        const textarea = screen.getByPlaceholderText(/Paste your decklist here/i) as HTMLTextAreaElement;
        expect(textarea.value).toContain('4 Lightning Bolt');
    });
});
