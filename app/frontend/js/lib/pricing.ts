export type PriceMap = Record<string, number>;

const DEFAULT_ENDPOINT = '/api/v1/pricing/lookup';

export const PRICE_FORMATTER = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

export function formatPrice(value: number | null | undefined, fallback = 'N/A'): string {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    return PRICE_FORMATTER.format(Number(value));
}

export function getCachedPrice(cache: PriceMap, cardOrName: { name?: string } | string | null | undefined): number | null {
    if (!cache || typeof cache !== 'object') {
        return null;
    }
    const key = typeof cardOrName === 'string' ? cardOrName : cardOrName?.name;
    if (!key) {
        return null;
    }
    const price = cache[key];
    return Number.isFinite(price) ? Number(price) : null;
}

async function fetchPriceBatch(cardNames: string[], endpoint = DEFAULT_ENDPOINT): Promise<PriceMap> {
    if (!cardNames.length) {
        return {};
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_names: cardNames })
        });

        if (!response.ok) {
            return {};
        }

        const payload = await response.json().catch(() => ({}));
        if (payload?.prices && typeof payload.prices === 'object') {
            return payload.prices as PriceMap;
        }
    } catch (error) {
        console.warn('Failed to fetch card prices:', error);
    }

    return {};
}

type PriceLookupOptions = {
    delay?: number;
    endpoint?: string;
    onPrices?: (prices: PriceMap) => void;
    onComplete?: () => void;
};

export function createPriceLookup(options: PriceLookupOptions = {}) {
    const delay = Number.isFinite(options.delay) ? Number(options.delay) : 100;
    const endpoint = options.endpoint || DEFAULT_ENDPOINT;
    const onPrices = options.onPrices || (() => {});
    const onComplete = options.onComplete || (() => {});
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    return (names: string[]) => {
        const normalized = Array.from(new Set((Array.isArray(names) ? names : []).filter(Boolean)));
        if (!normalized.length) {
            onComplete();
            return;
        }

        if (pendingTimer) {
            clearTimeout(pendingTimer);
        }

        pendingTimer = setTimeout(async () => {
            const prices = await fetchPriceBatch(normalized, endpoint);
            if (prices && Object.keys(prices).length) {
                onPrices(prices);
            }
            pendingTimer = null;
            onComplete();
        }, delay);
    };
}
