import { cleanup } from '@testing-library/svelte';
import 'whatwg-fetch';
import { afterEach } from 'vitest';

afterEach(() => {
    cleanup();
});

if (typeof window !== 'undefined' && !('matchMedia' in window)) {
    window.matchMedia = () => ({
        matches: false,
        media: '',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    });
}

if (!('ResizeObserver' in globalThis)) {
    class ResizeObserver {
        observe() {
            return undefined;
        }
        unobserve() {
            return undefined;
        }
        disconnect() {
            return undefined;
        }
    }
    // @ts-ignore - exposing mock globally for tests
    globalThis.ResizeObserver = ResizeObserver;
}

if (!('UIUtils' in globalThis)) {
    // @ts-ignore - DeckZone and other legacy scripts expect a UIUtils global
    globalThis.UIUtils = {
        generateEmptyZoneContent(icon: string, label: string) {
            return `<div data-testid="empty-zone" aria-label="${label}">${icon}<span>${label}</span></div>`;
        }
    };
}
