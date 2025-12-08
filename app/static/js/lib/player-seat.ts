/**
 * Shared helpers to format player/seat names consistently.
 * Prefer these over ad‑hoc fallbacks spread across components.
 */

type CoreNameGetter = (playerId: string) => string | null | undefined;

// Simple cache to avoid re-formatting the same seat key repeatedly.
const seatFallbackCache = new Map<string, string>();

export function formatSeatFallback(playerKey: string | null | undefined): string {
    if (!playerKey) return 'Unknown';

    const key = String(playerKey);
    const cached = seatFallbackCache.get(key);
    if (cached) return cached;

    let resolved: string;
    if (key === 'spectator') {
        resolved = 'Spectator';
    } else {
        const match = key.toLowerCase().match(/player\s*(\d+)/);
        resolved = match ? `Player ${match[1]}` : key;
    }

    seatFallbackCache.set(key, resolved);
    return resolved;
}

interface ResolvePlayerOptions {
    playerDataName?: string | null;
    fallbackName?: string | null;
    getCoreDisplayName?: CoreNameGetter | null;
}

/**
 * Resolve a display name using (in order):
 * 1. Explicit playerData name
 * 2. GameCore-provided getter (if supplied)
 * 3. Provided fallbackName
 * 4. Standard seat fallback derived from playerKey
 */
export function resolvePlayerDisplayName(
    playerKey: string | null | undefined,
    {
        playerDataName,
        fallbackName,
        getCoreDisplayName
    }: ResolvePlayerOptions = {}
): string {
    const id = playerKey || 'player1';

    const normalizedDataName = typeof playerDataName === 'string' ? playerDataName.trim() : '';
    if (normalizedDataName) return normalizedDataName;

    const coreGetter: CoreNameGetter | null =
        getCoreDisplayName ||
        (typeof GameCore !== 'undefined' &&
            typeof (GameCore as any).getPlayerDisplayName === 'function'
                ? (GameCore as any).getPlayerDisplayName
                : null);

    const coreName = coreGetter ? coreGetter(id) : null;
    if (coreName) return coreName;

    if (fallbackName) return fallbackName;

    return formatSeatFallback(id);
}
