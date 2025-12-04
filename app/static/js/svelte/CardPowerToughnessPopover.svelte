<script>
    const noop = () => {};

    let {
        open = false,
        cardName = 'Card',
        cardId = '',
        uniqueId: _uniqueId = '',
        powerToughness = null,
        position = null,
        onClose = noop,
        onApply = noop,
        onReset = noop
    } = $props();

    const ptInfo = $derived(() => powerToughness);

    let powerInput = $state('');
    let toughnessInput = $state('');

    $effect(() => {
        if (!open) {
            return;
        }
        powerInput = normalize(ptInfo()?.overridePower);
        toughnessInput = normalize(ptInfo()?.overrideToughness);
    });

    const normalize = (value) => {
        if (value === undefined || value === null) return '';
        const text = String(value).trim();
        return text.length ? text : '';
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

    const handleApply = (event) => {
        event?.preventDefault();
        const normalizeValue = (text) => {
            const trimmed = String(text ?? '').trim();
            if (!trimmed) return null;
            if (!/^-?\d+$/.test(trimmed)) {
                return null;
            }
            return parseInt(trimmed, 10);
        };
        const powerValue = normalizeValue(powerInput);
        const toughnessValue = normalizeValue(toughnessInput);
        onApply?.(powerValue, toughnessValue);
    };

    const handleReset = () => {
        onReset?.();
        powerInput = '';
        toughnessInput = '';
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
            aria-label={`Power / Toughness - ${cardName || cardId || 'Card'}`}
            tabindex="-1"
            style={`${panelStyle} ${resolvePopoverStyle()}`}
            onclick={(event) => event.stopPropagation()}
            onkeydown={(event) => event.stopPropagation()}
        >
            <div class="counter-modal-header" style={headerStyle}>
                <h3>Power / Toughness - {cardName || cardId || 'Card'}</h3>
                <button
                    type="button"
                    class="counter-modal-close"
                    aria-label="Fermer"
                    style={closeButtonStyle}
                    onclick={close}
                >&times;</button>
            </div>
            <div class="counter-modal-body" style="padding: 1.25rem">
                {#if ptInfo()}
                    <div class="pt-manager">
                        <div class="pt-manager-header">
                            <span class="pt-manager-title">Override values</span>
                            <span class="pt-manager-base">
                                Base: {ptInfo().basePower || '—'}/{ptInfo().baseToughness || '—'}
                            </span>
                        </div>
                        <div class="pt-manager-inputs">
                            <label class="pt-manager-field">
                                <span>Power</span>
                                <input
                                    type="number"
                                    inputmode="numeric"
                                    pattern="^-?\\d*$"
                                    bind:value={powerInput}
                                    placeholder={ptInfo().basePower || ''}
                                />
                            </label>
                            <label class="pt-manager-field">
                                <span>Toughness</span>
                                <input
                                    type="number"
                                    inputmode="numeric"
                                    pattern="^-?\\d*$"
                                    bind:value={toughnessInput}
                                    placeholder={ptInfo().baseToughness || ''}
                                />
                            </label>
                        </div>
                        <div class="pt-manager-footer">
                            <div class="pt-manager-actions">
                                <button class="pt-manager-apply" type="button" onclick={handleApply}>Apply</button>
                                <button class="pt-manager-reset" type="button" onclick={handleReset}>Reset</button>
                            </div>
                            <div class="pt-manager-current">
                                Current: {ptInfo().currentPower}/{ptInfo().currentToughness}
                            </div>
                        </div>
                        <p class="pt-manager-hint">
                            Only integer values are allowed. Leave a field blank to keep the base value.
                        </p>
                    </div>
                {:else}
                    <p class="card-manage-empty">This card has no visible power/toughness stats.</p>
                {/if}
            </div>
        </div>
    </div>
{/if}
