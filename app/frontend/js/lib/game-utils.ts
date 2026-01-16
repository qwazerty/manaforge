/**
 * ManaForge Game Utils Module
 * Utility functions for the game interface
 */

// ===== URL PARAMETER MANAGEMENT =====
export function getPlayerFromUrl(): string {
    if (typeof window === 'undefined') return 'player1';
    const urlParams = new URLSearchParams(window.location.search);
    const player = urlParams.get('player') || '';
    if (player === 'spectator') return 'spectator';
    return player.match(/^player\d+$/) ? player : 'player1';
}

export function setPlayerInUrl(playerType: string): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('player', playerType);
    window.history.replaceState({}, '', url.toString());
}

// ===== UTILITY FUNCTIONS =====
export function escapeJavaScript(str: string | null | undefined): string {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

export function escapeHtml(str: string | null | undefined): string {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ===== GAME CONFIG INITIALIZATION =====
export function initializeGameConfig(): Record<string, unknown> | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;

    // Already initialized
    if ((window as any).gameData && Object.keys((window as any).gameData).length) {
        return (window as any).gameData;
    }

    const source = document.querySelector('[data-game-config]') as HTMLElement | null;
    if (!source || !source.dataset.gameConfig) {
        return null;
    }

    try {
        const config = JSON.parse(source.dataset.gameConfig);
        if (config && typeof config === 'object') {
            (window as any).gameData = config;
            return config;
        }
    } catch (error) {
        console.warn('Unable to parse game configuration dataset', error);
    }

    return null;
}

export function getGameData(): Record<string, unknown> | null {
    if (typeof window === 'undefined') return null;
    return (window as any).gameData || null;
}

export function setGameDataField(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    if (!(window as any).gameData) {
        (window as any).gameData = {};
    }
    (window as any).gameData[key] = value;
}
