<script>
    const noop = () => {};

    let {
        open = false,
        cardName = 'Card',
        cardId = '',
        uniqueId: _uniqueId = '',
        types = [],
        typeOptions = [],
        position = null,
        onClose = noop,
        onAddType = noop,
        onRemoveType = noop,
        onResetTypes = noop
    } = $props();

    const typeList = $derived(Array.isArray(types) ? types : []);
    const availableTypes = $derived(Array.isArray(typeOptions) && typeOptions.length
        ? typeOptions
        : [
            { value: 'creature', label: 'Creature' },
            { value: 'land', label: 'Land' },
            { value: 'artifact', label: 'Artifact' },
            { value: 'enchantment', label: 'Enchantment' },
            { value: 'planeswalker', label: 'Planeswalker' },
            { value: 'instant', label: 'Instant' },
            { value: 'sorcery', label: 'Sorcery' }
        ]);

    let selectedType = $state('');

    $effect(() => {
        if (open) {
            selectedType = '';
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

    const handleAddType = (event) => {
        event?.preventDefault();
        const value = selectedType.trim();
        if (!value) return;
        onAddType?.(value);
        selectedType = '';
    };

    const handleRemoveType = (type) => {
        if (!type) return;
        onRemoveType?.(type);
    };

    const handleResetTypes = () => {
        onResetTypes?.();
    };

    const formatLabel = (text) => {
        if (!text) return '';
        const value = String(text);
        return value.charAt(0).toUpperCase() + value.slice(1);
    };
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
            aria-label={`Custom Types - ${cardName || cardId || 'Card'}`}
            tabindex="-1"
            style={`${panelStyle} ${resolvePopoverStyle()}`}
            onclick={(event) => event.stopPropagation()}
            onkeydown={(event) => event.stopPropagation()}
        >
            <div class="counter-modal-header" style={headerStyle}>
                <h3>Custom Types - {cardName || cardId || 'Card'}</h3>
                <button
                    type="button"
                    class="counter-modal-close"
                    aria-label="Fermer"
                    style={closeButtonStyle}
                    onclick={close}
                >&times;</button>
            </div>
            <div class="counter-modal-body" style="padding: 1.25rem">
                <section class="card-manage-section">
                    <h4>Types actuels</h4>
                    {#if typeList.length}
                        <div class="keyword-tag-list">
                            {#each typeList as type (type)}
                                <span class="keyword-tag">
                                    <span class="keyword-label">{formatLabel(type) || type}</span>
                                    <button
                                        class="keyword-remove-btn"
                                        type="button"
                                        title="Remove type"
                                        onclick={() => handleRemoveType(type)}
                                    >&times;</button>
                                </span>
                            {/each}
                        </div>
                        <button class="type-reset-btn" type="button" onclick={handleResetTypes}>
                            Reset to automatic
                        </button>
                    {:else}
                        <p class="card-manage-empty">No custom type overrides yet.</p>
                    {/if}
                </section>

                <section class="card-manage-section card-type-manager">
                    <h4>Add a type</h4>
                    <form class="type-add-form" onsubmit={handleAddType}>
                        <select bind:value={selectedType}>
                            <option value="">Select a type</option>
                            {#each availableTypes as option (option.value)}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                        <button type="submit">Add</button>
                    </form>
                </section>
            </div>
        </div>
    </div>
{/if}
