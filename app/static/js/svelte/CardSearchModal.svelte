<script>
    import { onDestroy, onMount, tick } from 'svelte';

    const SEARCH_DELAY = 200;
    const MIN_QUERY_LENGTH = 2;

    let {
        open: incomingOpen = false,
        targetZone: incomingTargetZone = 'hand',
        submitHandler = null,
        onClose = null,
        tokenHints: incomingTokenHints = []
    } = $props();

    let open = $state(incomingOpen);
    let targetZone = $state(incomingTargetZone || 'hand');
    let query = $state('');
    let results = $state([]);
    let loading = $state(false);
    let error = $state('');
    let tokenOnly = $state(false);
    let selectedIndex = $state(-1);
    let isSubmitting = $state(false);
    let searchTimer = null;
    let searchInput = null;
    let resultRefs = [];
    let customSubmit = $state(typeof submitHandler === 'function' ? submitHandler : null);
    let tokenHintNames = $state(dedupeTokenHints(incomingTokenHints));

    const zoneLabels = {
        hand: 'the hand',
        battlefield: 'the battlefield',
        graveyard: 'the graveyard',
        exile: 'the exile',
        library: 'the library'
    };

    function normalizeTokenHint(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value).replace(/\s+/g, ' ').trim();
    }

    function dedupeTokenHints(source) {
        const seen = new Set();
        const result = [];
        if (!Array.isArray(source)) {
            return result;
        }
        for (const entry of source) {
            const hint = normalizeTokenHint(entry);
            if (!hint) {
                continue;
            }
            const key = hint.toLowerCase();
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            result.push(hint);
        }
        return result;
    }

    function normalizeTokenNameForFilter(value) {
        return normalizeTokenHint(value).toLowerCase();
    }

    $effect(() => {
        open = incomingOpen;
    });

    $effect(() => {
        targetZone = incomingTargetZone || 'hand';
    });

    $effect(() => {
        customSubmit = typeof submitHandler === 'function' ? submitHandler : null;
    });

    $effect(() => {
        tokenHintNames = dedupeTokenHints(incomingTokenHints);
    });

    $effect(() => {
        if (tokenHintNames.length) {
            tokenOnly = true;
        }
    });

    $effect(() => {
        if (!open) {
            resetState();
            return;
        }

        focusSearchInput();
    });

    $effect(() => {
        if (!open) return;
        const handler = (event) => handleKeydown(event);
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    $effect(() => {
        if (!open) return;
        const active = resultRefs[selectedIndex];
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ block: 'nearest' });
        }
    });

    $effect(() => {
        const length = results.length;
        if (selectedIndex >= length) {
            selectedIndex = length ? length - 1 : -1;
        }
        resultRefs = [];
    });

    onMount(() => {
        return () => clearSearchTimer();
    });

    onDestroy(() => {
        clearSearchTimer();
    });

    function resetState() {
        clearSearchTimer();
        query = '';
        results = [];
        error = '';
        tokenOnly = false;
        selectedIndex = -1;
        loading = false;
        isSubmitting = false;
    }

    function clearSearchTimer() {
        if (searchTimer) {
            clearTimeout(searchTimer);
            searchTimer = null;
        }
    }

    async function focusSearchInput() {
        await tick();
        searchInput?.focus();
    }

    function closeModal() {
        open = false;
        if (typeof onClose === 'function') {
            onClose();
        }
    }

    function handleBackdropClick(event) {
        if (event.target === event.currentTarget) {
            closeModal();
        }
    }

    function handleInput(event) {
        query = (event?.target?.value || '').trim();
        selectedIndex = -1;
        error = '';
        clearSearchTimer();

        if (!query) {
            loading = false;
            results = [];
            return;
        }

        if (query.length < MIN_QUERY_LENGTH) {
            loading = false;
            results = [];
            return;
        }

        loading = true;
        const pendingQuery = query;
        const pendingToken = tokenOnly;
        searchTimer = setTimeout(() => runSearch(pendingQuery, pendingToken), SEARCH_DELAY);
    }

    function handleTokenToggle(event) {
        tokenOnly = !!event?.target?.checked;
        if (query.length >= MIN_QUERY_LENGTH) {
            runSearch(query, tokenOnly);
        }
    }

    function buildTokenFilterSet() {
        const normalized = tokenHintNames
            .map((value) => normalizeTokenNameForFilter(value))
            .filter(Boolean);
        return new Set(normalized);
    }

    function applyTokenHint(tokenName) {
        if (!tokenName) {
            return;
        }
        query = tokenName;
        selectedIndex = -1;
        clearSearchTimer();
        runSearch(tokenName, tokenOnly);
        if (searchInput && typeof searchInput.focus === 'function') {
            searchInput.focus();
        }
    }

    function clearTokenHints(event) {
        event?.preventDefault();
        if (
            typeof window !== 'undefined' &&
            window.CardSearchModal &&
            typeof window.CardSearchModal.setTokenFilter === 'function'
        ) {
            window.CardSearchModal.setTokenFilter([]);
        } else {
            tokenHintNames = [];
        }
    }

    function handleKeydown(event) {
        if (!open) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
            return;
        }

        if (!results.length) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (selectedIndex >= 0 && results[selectedIndex]) {
                submitCard(results[selectedIndex]);
            }
        }
    }

    async function runSearch(term, tokenFlag) {
        clearSearchTimer();
        loading = true;
        error = '';

        const params = new URLSearchParams({ q: term, limit: 50 });
        if (tokenFlag) {
            params.set('tokens_only', 'true');
        }

        try {
            const response = await fetch(`/api/v1/cards/search?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Search failed');
            }

            const fetchedCards = await response.json();
            const normalizedSet = buildTokenFilterSet();
            let cardList = Array.isArray(fetchedCards) ? fetchedCards : [];
            if (normalizedSet.size) {
                cardList = cardList.filter((card) =>
                    normalizedSet.has(normalizeTokenNameForFilter(card?.name))
                );
            }

            if (query === term && tokenOnly === tokenFlag && open) {
                results = cardList;
            }
        } catch (err) {
            console.error('[CardSearchModal] search failed', err);
            if (query === term && tokenOnly === tokenFlag && open) {
                error = 'Search failed. Please try again.';
                results = [];
            }
        } finally {
            if (query === term && tokenOnly === tokenFlag && open) {
                loading = false;
            }
        }
    }

    async function submitCard(card) {
        if (!card || isSubmitting) {
            return;
        }

        if (customSubmit) {
            try {
                const result = customSubmit(card);
                if (result && typeof result.then === 'function') {
                    const resolved = await result;
                    if (resolved === false) {
                        return;
                    }
                } else if (result === false) {
                    return;
                }
                closeModal();
            } catch (err) {
                console.error('[CardSearchModal] custom submit failed', err);
            }
            return;
        }

        const gameId = window?.gameData?.gameId;
        const playerId = window?.GameCore?.getSelectedPlayer?.();

        if (!gameId || !playerId) {
            error = 'Missing game context.';
            return;
        }

        isSubmitting = true;

        const payload = tokenOnly
            ? {
                  action_type: 'create_token',
                  player_id: playerId,
                  scryfall_id: card.scryfall_id
              }
            : {
                  action_type: 'search_and_add_card',
                  player_id: playerId,
                  card_name: card.name,
                  target_zone: targetZone
              };

        try {
            const response = await fetch(`/api/v1/games/${gameId}/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            closeModal();
        } catch (err) {
            console.error('[CardSearchModal] add card failed', err);
            error = 'Unable to add this card right now.';
        } finally {
            isSubmitting = false;
        }
    }

    function zoneLabel(zone) {
        return zoneLabels[zone] || zone || 'the hand';
    }

    function renderIntroMessage() {
        if (!query) {
            return 'Start typing to see suggestions';
        }
        if (query.length < MIN_QUERY_LENGTH) {
            return 'Keep typing... At least 2 characters required';
        }
        if (loading) {
            return 'Searching...';
        }
        return '';
    }
</script>

{#if open}
<div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" on:click={handleBackdropClick}>
    <div class="bg-arena-surface shadow-2xl rounded-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden border border-arena-accent/30">
        <header class="flex items-center justify-between p-4 border-b border-arena-surface-light">
            <div>
                <p class="text-xs uppercase tracking-[0.3em] text-arena-muted mb-1">Card Search</p>
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <span class="text-lg">🔍</span>
                    Add to <span class="text-arena-accent">{zoneLabel(targetZone)}</span>
                </h2>
            </div>
            <button class="text-arena-muted hover:text-white transition-colors" on:click={closeModal} aria-label="Close search modal">
                ✕
            </button>
        </header>

        <div class="p-4 space-y-4">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div class="relative flex-1">
                    <input
                        bind:this={searchInput}
                        value={query}
                        on:input={handleInput}
                        class="w-full px-4 py-3 bg-arena-surface-light border border-arena-accent/30 rounded-lg text-white placeholder-arena-muted focus:outline-none focus:ring-2 focus:ring-arena-accent/50 text-base"
                        type="text"
                        autocomplete="off"
                        placeholder='Type a card name (e.g., "Bir" → Birds of Paradise)'
                    />
                    {#if loading}
                        <div class="absolute right-3 top-3">
                            <div class="h-6 w-6 border-2 border-arena-accent border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    {/if}
                </div>
                <label class="flex items-center gap-2 text-sm text-arena-text cursor-pointer select-none">
                    <input type="checkbox" class="rounded border-arena-accent/40 bg-arena-surface w-4 h-4 accent-arena-accent" checked={tokenOnly} on:change={handleTokenToggle} />
                    <span>Tokens only</span>
                </label>
            </div>

            {#if tokenHintNames.length}
                <div class="flex flex-col gap-2 rounded-xl border border-arena-border/30 bg-arena-surface/60 p-3 text-xs text-arena-text-dim">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-[11px] uppercase tracking-[0.3em] text-arena-muted">Battlefield tokens</span>
                        <span class="text-[11px] font-semibold text-white">{tokenHintNames.length} detected</span>
                        <button
                            type="button"
                            class="text-[11px] underline text-arena-text-dim hover:text-white transition-colors"
                            on:click={clearTokenHints}>
                            Clear filter
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        {#each tokenHintNames as token (token)}
                            <button
                                type="button"
                                class="px-3 py-1.5 rounded-full border border-arena-accent/60 bg-arena-accent/20 text-sm font-medium text-white transition hover:border-arena-accent hover:bg-arena-accent/40 hover:text-white"
                                on:click={() => applyTokenHint(token)}>
                                {token}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="overflow-y-auto max-h-[65vh] pr-1">
                {#if error}
                    <div class="text-center text-red-300 bg-red-950/40 border border-red-500/30 rounded-lg p-6 text-sm">
                        {error}
                    </div>
                {:else if !query || query.length < MIN_QUERY_LENGTH}
                    <div class="text-center text-arena-muted py-12">
                        <p class="text-lg">{renderIntroMessage()}</p>
                        <p class="text-sm text-arena-text-dim mt-2">A few letters are enough: "Bir" finds "Birds of Paradise"</p>
                    </div>
                {:else if loading}
                    <div class="flex items-center justify-center py-12 text-arena-text gap-3">
                        <div class="h-6 w-6 border-2 border-arena-accent border-t-transparent rounded-full animate-spin"></div>
                        <span>Searching cards...</span>
                    </div>
                {:else if results.length === 0}
                    <div class="text-center text-arena-muted py-12">
                        <p class="text-lg">No cards found for "{query}"</p>
                        <p class="text-sm text-arena-text-dim">Try different keywords</p>
                    </div>
                {:else}
                    <div class="space-y-3">
                        <div class="text-sm text-arena-text-dim flex items-center justify-between">
                            <span>💡 {results.length} result{results.length > 1 ? 's' : ''} for "{query}"</span>
                            <span class="text-xs">Click a card or press Enter</span>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {#each results as card, index}
                                <button
                                    class={`rounded-lg overflow-hidden shadow-lg border-2 transition-transform ${selectedIndex === index ? 'border-arena-accent scale-[1.03]' : 'border-transparent hover:border-arena-accent/60 hover:scale-[1.01]'}`}
                                    on:click={() => submitCard(card)}
                                    bind:this={resultRefs[index]}
                                >
                                    {#if card?.image_url}
                                        <img src={card.image_url} alt={card.name || 'Card'} class="w-full h-full object-cover block" loading="lazy" />
                                    {:else}
                                        <div class="w-full h-full min-h-[220px] flex flex-col items-center justify-center bg-arena-surface-light text-arena-muted p-4">
                                            <div class="text-3xl mb-2">🃏</div>
                                            <div class="font-semibold text-white text-center">{card?.name || 'Unknown card'}</div>
                                            {#if card?.mana_cost}
                                                <div class="text-sm text-arena-text-dim mt-1">{card.mana_cost}</div>
                                            {/if}
                                        </div>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
{/if}
