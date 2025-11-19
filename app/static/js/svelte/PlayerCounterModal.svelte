<script>
    const noop = () => {};

    let {
        open = false,
        playerName = '',
        playerId = '',
        counters = [],
        amountInputMin = 1,
        amountInputStep = 1,
        addButtonClass = 'bg-green-500/20 border border-green-500/50 text-green-200 rounded px-3 py-2 text-xs font-semibold uppercase tracking-wide',
        decrementButtonClass = 'bg-red-500/20 border border-red-500/50 text-red-200 rounded px-2 py-1 text-xs font-semibold',
        incrementButtonClass = 'bg-green-500/20 border border-green-500/50 text-green-200 rounded px-2 py-1 text-xs font-semibold',
        resetButtonClass = 'bg-arena-surface border border-arena-accent/30 text-arena-text rounded px-3 py-2 text-xs',
        position = null,
        onClose = noop,
        onModify = noop,
        onRemove = noop,
        onAdd = noop
    } = $props();

    let newCounterType = $state('');
    let newCounterAmount = $state(amountInputMin);

    $effect(() => {
        if (!open) {
            newCounterType = '';
            newCounterAmount = 1;
        }
    });

    const close = () => {
        if (typeof onClose === 'function') {
            onClose();
        }
    };

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget) {
            close();
        }
    };

    const handleBackdropKeydown = (event) => {
        if (
            event.target === event.currentTarget &&
            (event.key === 'Enter' || event.key === ' ')
        ) {
            event.preventDefault();
            close();
        }
    };

    const handleModify = (type, delta) => {
        if (typeof onModify === 'function') {
            onModify(type, delta);
        }
    };

    const handleRemove = (type) => {
        if (typeof onRemove === 'function') {
            onRemove(type);
        }
    };

    const handleAdd = (event) => {
        event?.preventDefault();
        const normalizedType = newCounterType.trim();
        if (!normalizedType) {
            return;
        }
        const parsedAmount = Number(newCounterAmount);
        const amount = Number.isFinite(parsedAmount) ? parsedAmount : 1;
        if (typeof onAdd === 'function') {
            onAdd(normalizedType, amount);
        }
        newCounterType = '';
        newCounterAmount = amountInputMin;
    };

    const formatLabel = (type) => {
        if (!type) {
            return 'Compteur';
        }
        const text = String(type);
        return text.charAt(0).toUpperCase() + text.slice(1);
    };

    const panelStyle = `
        width: min(420px, 92vw);
        background: rgba(16, 21, 33, 0.97);
        border: 1px solid rgba(201, 170, 113, 0.45);
        border-radius: 18px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.65);
        padding: 0;
        overflow: hidden;
    `;

    const headerStyle = `
        background: rgba(21, 26, 41, 0.85);
        border-bottom: 1px solid rgba(201, 170, 113, 0.3);
        color: #fef3c7;
        padding: 0.85rem 1rem;
    `;

    const closeButtonStyle = 'color: #fef3c7;';

    const resolvePopoverStyle = () => {
        const fallback = () => {
            if (typeof window === 'undefined') {
                return { top: 200, left: 200, anchor: 'center' };
            }
            return {
                top: (window.scrollY || 0) + window.innerHeight / 2,
                left: (window.scrollX || 0) + window.innerWidth / 2,
                anchor: 'center'
            };
        };

        const resolved = position && typeof position === 'object'
            ? {
                top: position.top ?? null,
                left: position.left ?? null,
                anchor: typeof position.anchor === 'string' ? position.anchor : null
            }
            : { top: null, left: null, anchor: null };
        const fallbackPos = fallback();
        const top = typeof resolved.top === 'number' ? resolved.top : fallbackPos.top;
        const left = typeof resolved.left === 'number' ? resolved.left : fallbackPos.left;
        const anchor = (resolved.anchor || fallbackPos.anchor || 'center').toLowerCase();

        const has = (value) => anchor.includes(value);
        let translateX = '-50%';
        if (has('left')) {
            translateX = '0';
        } else if (has('right')) {
            translateX = '-100%';
        }

        let translateY = '-50%';
        if (has('top')) {
            translateY = '0';
        } else if (has('bottom')) {
            translateY = '-100%';
        }

        return `
            position: absolute;
            top: ${top}px;
            left: ${left}px;
            transform: translate(${translateX}, ${translateY});
        `;
    };
</script>

<svelte:window onkeydown={(event) => {
    if (open && event.key === 'Escape') {
        close();
    }
}} />

{#if open}
    <div
        id="player-counter-modal"
        class="player-counter-popover-overlay"
        style="position: fixed; inset: 0; z-index: 1300;"
        role="presentation"
        tabindex="-1"
        onclick={handleBackdropClick}
        onkeydown={handleBackdropKeydown}
    >
        <div
            class="player-counter-popover-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Compteurs - ${playerName || playerId || 'Player'}`}
            tabindex="-1"
            style={`${panelStyle} ${resolvePopoverStyle()}`}
            onclick={(event) => event.stopPropagation()}
            onkeydown={(event) => event.stopPropagation()}
        >
            <div class="counter-modal-header" style={headerStyle}>
                <h3>Compteurs - {playerName || playerId || 'Player'}</h3>
                <button
                    type="button"
                    class="counter-modal-close"
                    aria-label="Fermer"
                    style={closeButtonStyle}
                    onclick={close}
                >&times;</button>
            </div>
            <div class="counter-modal-body" style="padding: 1.25rem">
                <section class="player-counter-manager space-y-2">
                    <h4 class="text-sm font-semibold uppercase tracking-wide text-arena-muted">Compteurs actifs</h4>
                    {#if counters.length}
                        <div class="space-y-2">
                            {#each counters as counter (counter.type)}
                                <div class="flex items-center justify-between border border-arena-accent/30 rounded-lg px-3 py-2 bg-arena-surface/70">
                                    <div class="flex items-center gap-3">
                                        {#if counter.icon}
                                            <span class="text-xl">{counter.icon}</span>
                                        {/if}
                                        <div>
                                            <div class="text-sm font-semibold text-arena-text">{counter.label || formatLabel(counter.type)}</div>
                                            <div class="text-xs text-arena-muted break-all">{counter.type}</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            class={decrementButtonClass}
                                            aria-label={`Retirer un compteur ${counter.label || counter.type}`}
                                            onclick={() => handleModify(counter.type, -1)}
                                        >-</button>
                                        <span class="text-lg font-bold text-arena-accent">{counter.amount}</span>
                                        <button
                                            type="button"
                                            class={incrementButtonClass}
                                            aria-label={`Ajouter un compteur ${counter.label || counter.type}`}
                                            onclick={() => handleModify(counter.type, 1)}
                                        >+</button>
                                        <button
                                            type="button"
                                            class={resetButtonClass}
                                            onclick={() => handleRemove(counter.type)}
                                        >Réinitialiser</button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="text-sm text-arena-muted">Aucun compteur pour ce joueur.</p>
                    {/if}
                </section>

                <section class="player-counter-manager mt-4 space-y-2">
                    <h4 class="text-sm font-semibold uppercase tracking-wide text-arena-muted">Ajouter un compteur</h4>
                    <form class="grid gap-2" onsubmit={handleAdd}>
                        <input
                            type="text"
                            class="w-full rounded-lg border border-arena-accent/30 bg-arena-surface-light px-3 py-2 text-sm text-arena-text"
                            placeholder="Poison, charge..."
                            maxlength="30"
                            bind:value={newCounterType}
                            autocomplete="off"
                        />
                        <div class="flex gap-2">
                            <input
                                type="number"
                                class="w-24 rounded-lg border border-arena-accent/30 bg-arena-surface-light px-3 py-2 text-sm text-arena-text"
                                min={amountInputMin}
                                step={amountInputStep}
                                bind:value={newCounterAmount}
                            />
                            <button
                                type="submit"
                                class={`${addButtonClass} w-full text-center uppercase tracking-wide`}
                            >Ajouter</button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    </div>
{/if}
