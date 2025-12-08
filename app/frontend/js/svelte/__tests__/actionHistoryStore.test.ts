import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
    actionHistoryEntries,
    addActionHistoryEntry,
    clearActionHistory
} from '../stores/actionHistoryStore.js';

describe('actionHistoryStore move_card overrides', () => {
    beforeEach(() => {
        clearActionHistory();
    });

    const getEntries = () => get(actionHistoryEntries);

    it('hides card details when moving a hand card to the top of the library', () => {
        addActionHistoryEntry({
            action: 'move_card',
            player: 'player1',
            details: {
                card: {
                    name: 'Card Alpha',
                    card_id: 'alpha-001'
                },
                source_zone: 'hand',
                target_zone: 'library',
                deck_position: 'top'
            }
        });

        const entries = getEntries();
        expect(entries).toHaveLength(1);
        const entry = entries[0];

        const labels = entry.details.map((detail) => detail.label);
        expect(labels).toEqual(['Source Zone', 'Target Zone']);

        const targetDetail = entry.details.find((detail) => detail.label === 'Target Zone');
        expect(targetDetail?.value).toBe('top library');
        expect(entry.cardRefs).toEqual([]);
    });

    it('keeps card details for other move_card scenarios', () => {
        addActionHistoryEntry({
            action: 'move_card',
            player: 'player1',
            details: {
                card: {
                    name: 'Card Alpha',
                    card_id: 'alpha-001'
                },
                source_zone: 'battlefield',
                target_zone: 'library',
                deck_position: 'top'
            }
        });

        const entries = getEntries();
        expect(entries).toHaveLength(1);
        const entry = entries[0];

        const labels = entry.details.map((detail) => detail.label);
        expect(labels).toContain('Card');

        const targetDetail = entry.details.find((detail) => detail.label === 'Target Zone');
        expect(targetDetail?.value).toBe('library');
        expect(entry.cardRefs.length).toBeGreaterThan(0);
    });
});
