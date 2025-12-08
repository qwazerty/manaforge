<script>
    const noop = () => {};

    let {
        open = false,
        cardName = 'Card',
        cardId = '',
        uniqueId = '',
        counters = [],
        counterOptions = [],
        position = null,
        onClose = noop,
        onModifyCounter = noop,
        onRemoveAllCounters = noop,
        onAddCounter = noop
    } = $props();

    const counterList = $derived(Array.isArray(counters) ? counters : []);
    const counterTypeOptions = $derived.by(() => {
        const base = (Array.isArray(counterOptions) && counterOptions.length
            ? counterOptions
            : [
                { value: '+1/+1', label: '+1/+1' },
                { value: '-1/-1', label: '-1/-1' },
                { value: 'loyalty', label: 'Loyalty' },
                { value: 'charge', label: 'Charge' },
                { value: 'poison', label: 'Poison' },
                { value: 'energy', label: 'Energy' },
                { value: 'experience', label: 'Experience' },
                { value: 'treasure', label: 'Treasure' },
                { value: 'food', label: 'Food' },
                { value: 'clue', label: 'Clue' },
                { value: 'blood', label: 'Blood' },
                { value: 'oil', label: 'Oil' }
            ]);
        const hasOther = base.some((entry) => entry?.value === 'other');
        return hasOther ? base : [...base, { value: 'other', label: 'Other' }];
    });

    let selectedCounterType = $state('');
    let customCounterType = $state('');
    let counterAmount = $state(1);

    $effect(() => {
        if (open) {
            selectedCounterType = counterTypeOptions?.[0]?.value || '';
            customCounterType = '';
            counterAmount = 1;
        }
    });

    $effect(() => {
        if (selectedCounterType !== 'other') {
            customCounterType = '';
        }
    });

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
        if (has('left')) translateX = '0';
        else if (has('right')) translateX = '-100%';
        let translateY = '-50%';
        if (has('top')) translateY = '0';
        else if (has('bottom')) translateY = '-100%';

        return `
            position: absolute;
            top: ${top}px;
            left: ${left}px;
            transform: translate(${translateX}, ${translateY});
        `;
    };

    const close = () => onClose?.();

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget) {
            close();
        }
    };

    const handleBackdropKeydown = (event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            close();
        }
    };

    const handleModify = (type, delta) => {
        if (!type || !Number.isFinite(delta)) return;
        onModifyCounter?.(type, delta);
    };

    const handleRemoveAll = (type) => {
        if (!type) return;
        onRemoveAllCounters?.(type);
    };

    const handleAddCounter = (event) => {
        event?.preventDefault();
        const useCustom = selectedCounterType === 'other';
        const trimmedCustom = customCounterType.trim();
        if (useCustom && !trimmedCustom) {
            return;
        }
        const chosenType = useCustom ? trimmedCustom : selectedCounterType;
        if (!chosenType) return;
        const parsedAmount = parseInt(counterAmount, 10);
        const amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1;
        onAddCounter?.(chosenType, amount);
        customCounterType = '';
        counterAmount = 1;
    };

    const resolveCounterLabel = (entry) => entry?.label || entry?.type || 'Counter';
    const resolveCounterIcon = (entry) => entry?.icon || null;
</script>

<svelte:window onkeydown={(event) => {
    if (open && event.key === 'Escape') {
        close();
    }
}} />

{#if open}
    <div
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
            aria-label={`Counters - ${cardName || cardId || 'Card'}`}
            tabindex="-1"
            style={`${panelStyle} ${resolvePopoverStyle()}`}
            onclick={(event) => event.stopPropagation()}
            onkeydown={(event) => event.stopPropagation()}
        >
            <div class="counter-modal-header" style={headerStyle}>
                <h3>Counters - {cardName || cardId || 'Card'}</h3>
                <button
                    type="button"
                    class="counter-modal-close"
                    aria-label="Fermer"
                    style={closeButtonStyle}
                    onclick={close}
                >&times;</button>
            </div>
            <div class="counter-modal-body" style="padding: 1.25rem">
                <section class="card-manage-section counter-manager">
                    <h4>Existing counters</h4>
                    {#if counterList.length}
                        <div class="counter-controls">
                            {#each counterList as counterEntry (counterEntry.type)}
                                <div class="counter-control-row">
                                    <div class="flex items-center gap-2">
                                        {#if resolveCounterIcon(counterEntry)}
                                            <span class="counter-icon">{resolveCounterIcon(counterEntry)}</span>
                                        {:else}
                                            <span class="counter-icon counter-icon-text">{counterEntry.type}</span>
                                        {/if}
                                        <span class="counter-type">{resolveCounterLabel(counterEntry)}</span>
                                    </div>
                                    <div class="counter-controls-buttons">
                                        <button type="button" onclick={() => handleModify(counterEntry.type, -1)}>-</button>
                                        <span class="counter-amount">{counterEntry.amount}</span>
                                        <button type="button" onclick={() => handleModify(counterEntry.type, 1)}>+</button>
                                        <button
                                            class="remove-counter-btn"
                                            type="button"
                                            onclick={() => handleRemoveAll(counterEntry.type)}
                                        >Remove All</button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="counter-empty">No counters on this card.</p>
                    {/if}
                </section>

                <section class="card-manage-section">
                    <h4>Add a counter</h4>
                    <form class="add-counter-form" onsubmit={handleAddCounter}>
                        <label for={`counter-type-select-${uniqueId}`}>Counter Type:</label>
                        <select
                            id={`counter-type-select-${uniqueId}`}
                            bind:value={selectedCounterType}
                        >
                            {#each counterTypeOptions as option (option.value)}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                        {#if selectedCounterType === 'other'}
                            <label for={`counter-type-custom-${uniqueId}`}>Custom Type:</label>
                            <input
                                id={`counter-type-custom-${uniqueId}`}
                                type="text"
                                placeholder="Quest, Shield, etc."
                                maxlength="30"
                                bind:value={customCounterType}
                                required
                            />
                        {/if}
                        <label for={`counter-amount-input-${uniqueId}`}>Amount:</label>
                        <input
                            id={`counter-amount-input-${uniqueId}`}
                            type="number"
                            min="1"
                            max="20"
                            bind:value={counterAmount}
                        />
                        <button class="add-counter-btn" type="submit">Add Counter</button>
                    </form>
                </section>
            </div>
        </div>
    </div>
{/if}
