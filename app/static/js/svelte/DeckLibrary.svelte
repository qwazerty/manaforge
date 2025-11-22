<script>
    import { onMount } from 'svelte';
    import { DeckStorage } from '@static/lib/deck-storage';

    let decks = [];
    let lastUpdate = '—';

    onMount(() => {
        loadDecks();
    });

    function loadDecks() {
        const baseDecks = DeckStorage.list();
        decks = Array.isArray(baseDecks) ? [...baseDecks] : [];
        decks.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        
        const latest = decks.length ? decks[0] : null;
        lastUpdate = latest ? formatTimestamp(latest.updatedAt) : '—';
    }

    function formatTimestamp(isoString) {
        if (!isoString) return '—';
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) {
            return '—';
        }
        return date.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function getCardCount(state, keys) {
        if (!state || !state.columns || !state.entries) return 0;
        const entries = state.entries;
        return keys.reduce((total, key) => {
            const columnEntries = state.columns[key] || [];
            return total + columnEntries.reduce((sum, entryId) => {
                const entry = entries[entryId];
                return sum + (entry?.quantity || 0);
            }, 0);
        }, 0);
    }

    function getSubtitleParts(deck) {
        const mainCount = getCardCount(deck.state, ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands']);
        const sideCount = getCardCount(deck.state, ['sideboard']);
        const commanderCount = getCardCount(deck.state, ['commander']);
        
        return [
            deck.format ? deck.format.toUpperCase() : 'UNKNOWN',
            `${mainCount} main`,
            `${sideCount} side`,
            commanderCount ? `${commanderCount} commander` : null
        ].filter(Boolean).join(' • ');
    }

    function handleDuplicate(deckId) {
        DeckStorage.duplicate(deckId);
        loadDecks();
    }

    function handleDelete(deckId) {
        if (confirm('Delete this saved deck? This cannot be undone.')) {
            DeckStorage.remove(deckId);
            loadDecks();
        }
    }
</script>

<section class="arena-card rounded-xl p-6 space-y-6 animate-slide-up">
    <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
            <p class="text-sm uppercase tracking-wide text-arena-muted">Saved decks</p>
            <h2 class="text-2xl font-semibold text-white flex items-center gap-2">
                <span>{decks.length}</span>
                <span class="text-base font-normal text-arena-text-dim">entries</span>
            </h2>
        </div>
        <div class="text-sm text-arena-text-dim">
            <span class="block">Last update:</span>
            <span class="text-white/70">{lastUpdate}</span>
        </div>
    </div>

    {#if decks.length === 0}
        <div class="text-center text-arena-muted py-10 border border-dashed border-arena-accent/30 rounded-lg">
            <p class="text-lg font-semibold mb-2">No decks saved yet</p>
            <p class="text-sm">Create a new deck or import one from the draft room to start building.</p>
        </div>
    {:else}
        <div class="grid gap-4 md:grid-cols-2">
            {#each decks as deck (deck.id)}
                <div class="bg-arena-surface/70 border border-arena-accent/10 rounded-xl p-4 flex flex-col gap-4">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <h3 class="text-xl font-semibold text-white">{deck.name || 'Untitled Deck'}</h3>
                            <p class="text-sm text-arena-text-dim">{getSubtitleParts(deck)}</p>
                        </div>
                        <div class="text-xs text-arena-text-dim text-right whitespace-nowrap">
                            <span class="block uppercase tracking-wide">Updated</span>
                            <span>{formatTimestamp(deck.updatedAt)}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <a href="/decks/builder?deckId={encodeURIComponent(deck.id)}" class="arena-button px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-1">
                            <span>✏️</span>Open
                        </a>
                        <button 
                            class="px-4 py-2 rounded-lg border border-arena-accent/30 hover:border-arena-accent transition text-sm flex items-center gap-1"
                            on:click={() => handleDuplicate(deck.id)}
                        >
                            <span>🧬</span>Duplicate
                        </button>
                        <button 
                            class="px-3 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 transition text-sm flex items-center gap-1"
                            on:click={() => handleDelete(deck.id)}
                        >
                            <span>🗑️</span>Delete
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</section>
