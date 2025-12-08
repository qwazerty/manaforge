<script module>
    const _isBrowserModule = typeof window !== 'undefined' && typeof document !== 'undefined';

    /**
     * Normalizes token filter list to support both old format (strings) and new format (objects with name and sourceSets)
     * Returns array of { name: string, sourceSets: string[] }
     */
    function normalizeTokenFilterList(filter) {
        if (!Array.isArray(filter)) {
            return [];
        }
        return filter
            .map((value) => {
                // Handle new format: { name: string, sourceSets: string[] }
                if (value && typeof value === 'object' && typeof value.name === 'string') {
                    return {
                        name: value.name.trim(),
                        sourceSets: Array.isArray(value.sourceSets) ? value.sourceSets : []
                    };
                }
                // Handle old format: plain string
                const strValue = String(value || '').trim();
                return strValue ? { name: strValue, sourceSets: [] } : null;
            })
            .filter((value) => value && value.name.length > 0);
    }

    const api = {
        _open: false,
        _submitHandler: null,
        _tokenHints: [],
        _targetZone: 'hand',
        _instance: null,

        show(zone = 'hand') {
            this._targetZone = zone;
            this._open = true;
            if (this._instance) {
                this._instance.open(zone, this._submitHandler, this._tokenHints);
            }
        },

        hide() {
            this._open = false;
            if (this._instance) {
                this._instance.close();
            }
        },

        setSubmitHandler(handler) {
            this._submitHandler = typeof handler === 'function' ? handler : null;
        },

        setTokenFilter(filter) {
            this._tokenHints = normalizeTokenFilterList(filter);
            if (this._instance) {
                this._instance.setTokenHints(this._tokenHints);
            }
        },

        _registerInstance(instance) {
            this._instance = instance;
        }
    };

    if (_isBrowserModule) {
        window.CardSearchModal = api;
        window.showCardSearch = (zone = 'hand') => api.show(zone);
        window.hideCardSearch = () => api.hide();
    }

    export { api };
</script>

<script>
    import { onDestroy, onMount, tick } from 'svelte';

    const SEARCH_DELAY = 200;
    const MIN_QUERY_LENGTH = 2;
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    let isOpen = $state(false);
    let targetZone = $state('hand');
    let query = $state('');
    let results = $state([]);
    let loading = $state(false);
    let error = $state('');
    let tokenOnly = $state(false);
    let exactMatch = $state(false);
    let selectedIndex = $state(-1);
    let isSubmitting = $state(false);
    let searchTimer = null;
    let searchInput = $state(null);
    let resultRefs = $state([]);
    let customSubmit = $state(null);
    let tokenHintNames = $state([]);

    const zoneLabels = {
        hand: 'the hand',
        battlefield: 'the battlefield',
        graveyard: 'the graveyard',
        exile: 'the exile',
        library: 'the library'
    };

    function openModal(zone = 'hand', submitHandler = null, tokenHints = []) {
        targetZone = zone;
        customSubmit = typeof submitHandler === 'function' ? submitHandler : null;
        tokenHintNames = dedupeTokenHints(tokenHints);
        if (tokenHintNames.length) {
            tokenOnly = true;
        }
        isOpen = true;
        focusSearchInput();
    }

    function closeModal() {
        isOpen = false;
        if (isBrowser && window.CardSearchModal) {
            window.CardSearchModal._open = false;
        }
    }

    function setTokenHintsExternal(hints) {
        tokenHintNames = dedupeTokenHints(hints);
        if (tokenHintNames.length) {
            tokenOnly = true;
        }
    }

    function normalizeTokenHint(value) {
        if (value === null || value === undefined) {
            return '';
        }
        // Handle object format { name: string, sourceSets: string[] }
        if (typeof value === 'object' && typeof value.name === 'string') {
            return value.name.replace(/\s+/g, ' ').trim();
        }
        return String(value).replace(/\s+/g, ' ').trim();
    }

    function dedupeTokenHints(source) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const seen = new Map(); // key -> { name, sourceSets }
        const result = [];
        if (!Array.isArray(source)) {
            return result;
        }
        for (const entry of source) {
            // Handle both old format (string) and new format ({ name, sourceSets })
            const isObject = entry && typeof entry === 'object' && typeof entry.name === 'string';
            const name = isObject ? entry.name.replace(/\s+/g, ' ').trim() : normalizeTokenHint(entry);
            const sourceSets = isObject && Array.isArray(entry.sourceSets) ? entry.sourceSets : [];
            
            if (!name) {
                continue;
            }
            const key = name.toLowerCase();
            if (seen.has(key)) {
                // Merge sourceSets if we've seen this token before
                const existing = seen.get(key);
                for (const set of sourceSets) {
                    if (!existing.sourceSets.includes(set)) {
                        existing.sourceSets.push(set);
                    }
                }
                continue;
            }
            const tokenHint = { name, sourceSets: [...sourceSets] };
            seen.set(key, tokenHint);
            result.push(tokenHint);
        }
        return result;
    }

    function normalizeTokenNameForFilter(value) {
        return normalizeTokenHint(value).toLowerCase();
    }

    $effect(() => {
        if (!isOpen) {
            resetState();
            return;
        }
        focusSearchInput();
    });

    $effect(() => {
        if (!isOpen || !isBrowser) return;
        const handler = (event) => handleKeydown(event);
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });

    $effect(() => {
        if (!isOpen) return;
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
        if (isBrowser && window.CardSearchModal) {
            window.CardSearchModal._registerInstance({
                open: openModal,
                close: closeModal,
                setTokenHints: setTokenHintsExternal
            });
        }
        return () => clearSearchTimer();
    });

    onDestroy(() => {
        clearSearchTimer();
        if (isBrowser && window.CardSearchModal) {
            window.CardSearchModal._instance = null;
        }
    });

    function resetState() {
        clearSearchTimer();
        query = '';
        results = [];
        error = '';
        tokenOnly = false;
        exactMatch = false;
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

    function handleBackdropClick(event) {
        if (event.target === event.currentTarget) {
            closeModal();
        }
    }

    function handleBackdropKeydown(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    function handleInput(event) {
        query = (event?.target?.value || '').trim();
        selectedIndex = -1;
        error = '';
        clearSearchTimer();

        // Clear token hints when user types
        if (query && tokenHintNames.length) {
            tokenHintNames = [];
            if (isBrowser && window.CardSearchModal) {
                window.CardSearchModal._tokenHints = [];
            }
        }

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
        const pendingExact = exactMatch;
        searchTimer = setTimeout(() => runSearch(pendingQuery, pendingToken, pendingExact), SEARCH_DELAY);
    }

    function handleTokenToggle(event) {
        tokenOnly = !!event?.target?.checked;
        if (query.length >= MIN_QUERY_LENGTH) {
            runSearch(query, tokenOnly, exactMatch);
        }
    }

    function handleExactMatchToggle(event) {
        exactMatch = !!event?.target?.checked;
        if (query.length >= MIN_QUERY_LENGTH) {
            runSearch(query, tokenOnly, exactMatch);
        }
    }

    function buildTokenFilterSet() {
        // Returns a Map of normalized token name -> array of source sets
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const tokenToSets = new Map();
        for (const hint of tokenHintNames) {
            const name = typeof hint === 'object' ? hint.name : hint;
            const normalized = normalizeTokenNameForFilter(name);
            if (!normalized) continue;
            const sourceSets = (typeof hint === 'object' && Array.isArray(hint.sourceSets)) 
                ? hint.sourceSets.map(s => s.toLowerCase()) 
                : [];
            tokenToSets.set(normalized, sourceSets);
        }
        return tokenToSets;
    }

    /**
     * Check if a token set matches a source set.
     * Token sets typically have a 't' prefix (e.g., 'tmh3' for 'mh3' tokens)
     * @param {string} tokenSet - The set code of the token (e.g., 'tmh3')
     * @param {string} sourceSet - The set code of the source card (e.g., 'mh3')
     */
    function setMatchesSource(tokenSet, sourceSet) {
        if (!tokenSet || !sourceSet) return false;
        // Direct match
        if (tokenSet === sourceSet) return true;
        // Token sets have 't' prefix: 'tmh3' matches 'mh3'
        if (tokenSet.startsWith('t') && tokenSet.slice(1) === sourceSet) return true;
        // Also check if source has 't' prefix matching token
        if (sourceSet.startsWith('t') && sourceSet.slice(1) === tokenSet) return true;
        return false;
    }

    /**
     * Sort cards so those matching source sets appear first
     * @param {Array} cards - List of cards to sort
     * @param {Map} tokenToSets - Map of token name -> source sets
     * @param {string} searchedTokenName - The token name being searched
     */
    function sortCardsBySourceSet(cards, tokenToSets, searchedTokenName) {
        const normalizedSearch = normalizeTokenNameForFilter(searchedTokenName);
        const sourceSets = tokenToSets.get(normalizedSearch) || [];
        
        if (!sourceSets.length) {
            return cards; // No source sets to prioritize
        }
        
        return [...cards].sort((a, b) => {
            const aSet = (a.set || a.set_code || '').toLowerCase();
            const bSet = (b.set || b.set_code || '').toLowerCase();
            // Check if the token's set matches any source set
            const aMatch = sourceSets.some(sourceSet => setMatchesSource(aSet, sourceSet));
            const bMatch = sourceSets.some(sourceSet => setMatchesSource(bSet, sourceSet));
            
            // Cards matching source set come first
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return 0; // Keep original order for cards with same priority
        });
    }

    function applyTokenHint(tokenName) {
        if (!tokenName) {
            return;
        }
        query = tokenName;
        exactMatch = true;
        selectedIndex = -1;
        clearSearchTimer();
        runSearch(tokenName, tokenOnly, true);
        if (searchInput && typeof searchInput.focus === 'function') {
            searchInput.focus();
        }
    }

    function clearTokenHintsAction(event) {
        event?.preventDefault();
        tokenHintNames = [];
        if (isBrowser && window.CardSearchModal) {
            window.CardSearchModal._tokenHints = [];
        }
    }

    function handleKeydown(event) {
        if (!isOpen) return;

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

    async function runSearch(term, tokenFlag, exactFlag = false) {
        clearSearchTimer();
        loading = true;
        error = '';

        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const params = new URLSearchParams({ q: term, limit: '50' });
        if (tokenFlag) {
            params.set('tokens_only', 'true');
        }
        if (exactFlag) {
            params.set('exact', 'true');
        }

        try {
            const response = await fetch(`/api/v1/cards/search?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Search failed');
            }

            const fetchedCards = await response.json();
            const tokenToSets = buildTokenFilterSet();
            let cardList = Array.isArray(fetchedCards) ? fetchedCards : [];
            if (tokenToSets.size) {
                cardList = cardList.filter((card) =>
                    tokenToSets.has(normalizeTokenNameForFilter(card?.name))
                );
                // Sort results so cards from source sets appear first
                cardList = sortCardsBySourceSet(cardList, tokenToSets, term);
            }

            if (query === term && tokenOnly === tokenFlag && exactMatch === exactFlag && isOpen) {
                results = cardList;
            }
        } catch (err) {
            console.error('[CardSearchModal] search failed', err);
            if (query === term && tokenOnly === tokenFlag && exactMatch === exactFlag && isOpen) {
                error = 'Search failed. Please try again.';
                results = [];
            }
        } finally {
            if (query === term && tokenOnly === tokenFlag && exactMatch === exactFlag && isOpen) {
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

{#if isOpen}
<div 
    class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Card Search"
    tabindex="-1">
    <div class="bg-arena-surface shadow-2xl rounded-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden border border-arena-accent/30">
        <header class="flex items-center justify-between p-4 border-b border-arena-surface-light">
            <div>
                <p class="text-xs uppercase tracking-[0.3em] text-arena-muted mb-1">Card Search</p>
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <span class="text-lg">🔍</span>
                    Add to <span class="text-arena-accent">{zoneLabel(targetZone)}</span>
                </h2>
            </div>
            <button class="text-arena-muted hover:text-white transition-colors" onclick={closeModal} aria-label="Close search modal">
                ✕
            </button>
        </header>

        <div class="p-4 space-y-4">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div class="relative flex-1">
                    <input
                        bind:this={searchInput}
                        value={query}
                        oninput={handleInput}
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
                    <input type="checkbox" class="rounded border-arena-accent/40 bg-arena-surface w-4 h-4 accent-arena-accent" checked={tokenOnly} onchange={handleTokenToggle} />
                    <span>Tokens only</span>
                </label>
                <label class="flex items-center gap-2 text-sm text-arena-text cursor-pointer select-none">
                    <input type="checkbox" class="rounded border-arena-accent/40 bg-arena-surface w-4 h-4 accent-arena-accent" checked={exactMatch} onchange={handleExactMatchToggle} />
                    <span>Exact match</span>
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
                            onclick={clearTokenHintsAction}>
                            Clear filter
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        {#each tokenHintNames as token (token.name)}
                            <button
                                type="button"
                                class="px-3 py-1.5 rounded-full border border-arena-accent/60 bg-arena-accent/20 text-sm font-medium text-white transition hover:border-arena-accent hover:bg-arena-accent/40 hover:text-white"
                                onclick={() => applyTokenHint(token.name)}>
                                {token.name}
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
                            {#each results as card, index (card.id || index)}
                                <button
                                    class={`rounded-lg overflow-hidden shadow-lg border-2 transition-transform ${selectedIndex === index ? 'border-arena-accent scale-[1.03]' : 'border-transparent hover:border-arena-accent/60 hover:scale-[1.01]'}`}
                                    onclick={() => submitCard(card)}
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
