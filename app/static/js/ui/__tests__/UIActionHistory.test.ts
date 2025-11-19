import { beforeAll, describe, expect, it } from 'vitest';

declare global {
    interface Window {
        UIActionHistory: any;
    }
}

let history: any = null;

beforeAll(async () => {
    if (typeof window === 'undefined') {
        (globalThis as unknown as { window: Window }).window = globalThis as Window;
    }
    await import('@ui/ui-action-history.js');
    history = window.UIActionHistory;
});

const buildEntry = (overrides: Record<string, unknown> = {}) => {
    const baseEntry = {
        rawAction: 'move_card',
        action: 'Move Card',
        details: [
            {
                label: 'Card',
                value: 'Card Alpha',
                cardRef: { cardId: 'alpha-001' },
                cardInfo: { name: 'Card Alpha' }
            },
            { label: 'Source Zone', value: 'hand' },
            { label: 'Target Zone', value: 'library' },
            { label: 'Deck Position', value: 'top' }
        ],
        cardRefs: [{ cardId: 'alpha-001' }],
        context: {
            payload: {
                source_zone: 'hand',
                target_zone: 'library',
                deck_position: 'top'
            }
        }
    };

    const contextOverride = overrides.context as
        | {
              payload?: Record<string, unknown>;
              [key: string]: unknown;
          }
        | undefined;

    return {
        ...baseEntry,
        ...overrides,
        details: overrides.details || baseEntry.details.map((detail) => ({ ...detail })),
        cardRefs: overrides.cardRefs || baseEntry.cardRefs.map((ref) => ({ ...ref })),
        context: contextOverride
            ? contextOverride
            : {
                  payload: { ...(baseEntry.context as any).payload }
              }
    };
};

describe('UIActionHistory move_card overrides', () => {
    it('hides card details when moving a hand card to the top of the library', () => {
        const entry = buildEntry();
        history._applyActionSpecificDetailOverrides(entry);

        const labels = entry.details.map((detail: { label: string }) => detail.label);
        expect(labels).toEqual(['Source Zone', 'Target Zone']);
        const targetDetail = entry.details.find(
            (detail: { label: string }) => detail.label === 'Target Zone'
        );
        expect(targetDetail?.value).toBe('top library');
        expect(entry.cardRefs).toEqual([]);
    });

    it('keeps card details for other move_card scenarios', () => {
        const entry = buildEntry({
            context: {
                payload: {
                    source_zone: 'battlefield',
                    target_zone: 'library',
                    deck_position: 'top'
                }
            }
        });
        history._applyActionSpecificDetailOverrides(entry);

        const labels = entry.details.map((detail: { label: string }) => detail.label);
        expect(labels).toContain('Card');
        const targetDetail = entry.details.find(
            (detail: { label: string }) => detail.label === 'Target Zone'
        );
        expect(targetDetail?.value).toBe('library');
        expect(entry.cardRefs.length).toBeGreaterThan(0);
    });
});
