function formatCounterLabel(counterType) {
    if (!counterType) {
        return 'Compteur';
    }
    const normalized = String(counterType).trim();
    if (!normalized) {
        return 'Compteur';
    }
    const lower = normalized.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function getCounterIcon(counterType) {
    if (typeof GameCards !== 'undefined' && typeof GameCards.getCounterIcon === 'function') {
        const icon = GameCards.getCounterIcon(counterType);
        if (icon) {
            return icon;
        }
        const lower = typeof counterType === 'string' ? counterType.toLowerCase() : counterType;
        if (lower) {
            return GameCards.getCounterIcon(lower) || null;
        }
    }
    return null;
}

function buildCounterEntries(playerData = {}) {
    const counters = playerData?.counters || {};
    return Object.entries(counters)
        .filter(([, value]) => Number(value) > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, amount]) => ({
            type,
            amount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
            label: formatCounterLabel(type),
            icon: getCounterIcon(type)
        }));
}

export { formatCounterLabel, getCounterIcon, buildCounterEntries };
