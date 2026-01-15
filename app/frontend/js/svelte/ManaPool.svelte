<script>
    /**
     * ManaPool component displays the floating mana available to a player
     * @component
     */
    let {
        manaPool = {},
        playerId = ''
    } = $props();

    // Mana colors in WUBRG order
    const MANA_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];
    
    // Map mana colors to their symbols and display colors
    const MANA_SYMBOLS = {
        'W': { symbol: '⚪', color: 'text-gray-100', bg: 'bg-gray-100/20', border: 'border-gray-100/40', name: 'White' },
        'U': { symbol: '💧', color: 'text-blue-400', bg: 'bg-blue-400/20', border: 'border-blue-400/40', name: 'Blue' },
        'B': { symbol: '💀', color: 'text-gray-300', bg: 'bg-gray-800/30', border: 'border-gray-600/40', name: 'Black' },
        'R': { symbol: '🔥', color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/40', name: 'Red' },
        'G': { symbol: '🌿', color: 'text-green-500', bg: 'bg-green-500/20', border: 'border-green-500/40', name: 'Green' },
        'C': { symbol: '◇', color: 'text-gray-400', bg: 'bg-gray-400/20', border: 'border-gray-400/40', name: 'Colorless' }
    };

    // Computed derived value for mana entries
    const manaEntries = $derived.by(() => {
        if (!manaPool || typeof manaPool !== 'object') {
            return [];
        }
        
        return MANA_COLORS
            .map(colorKey => {
                const amount = manaPool[colorKey] || 0;
                const symbolData = MANA_SYMBOLS[colorKey];
                return {
                    colorKey,
                    amount,
                    symbol: symbolData.symbol,
                    colorClass: symbolData.color,
                    bg: symbolData.bg,
                    border: symbolData.border,
                    name: symbolData.name
                };
            })
            .filter(entry => entry.amount > 0);
    });

    const hasMana = $derived(manaEntries.length > 0);
</script>

{#if hasMana}
    <div class="mana-pool-container mt-2">
        <div class="mana-pool-display flex flex-wrap gap-1.5">
            {#each manaEntries as mana (mana.colorKey)}
                <div
                    class="mana-pool-badge inline-flex items-center gap-1.5 px-2 py-1 rounded-md border {mana.bg} {mana.border}"
                    title="{mana.amount} {mana.name} mana"
                    data-mana-color={mana.colorKey}
                    data-player-id={playerId}>
                    <span class="text-base leading-none">{mana.symbol}</span>
                    <span class="font-bold text-sm {mana.colorClass}">{mana.amount}</span>
                </div>
            {/each}
        </div>
    </div>
{/if}
