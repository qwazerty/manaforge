<script>
    let {
        life = 20,
        playerId = '',
        negativeControls = [],
        positiveControls = [],
        hasCustomLifeControls = false,
        counters = [],
        manageButton = null
    } = $props();

    const handleControlClick = (event, control) => {
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        if (control && typeof control.onClick === 'function') {
            control.onClick(event);
        }
    };

    const handleManageClick = (event) => {
        if (event && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }
        if (manageButton && typeof manageButton.onClick === 'function') {
            manageButton.onClick(event);
        }
    };

    const chipClass = [
        'player-counter-chip inline-flex items-center gap-2',
        'bg-green-500/20 border border-green-500/50 text-green-300 py-1 px-2 rounded text-xs font-semibold'
    ].join(' ');

    const formatCounterLabel = (entry) => {
        const source = entry?.label || entry?.type;
        if (!source) {
            return 'Compteur';
        }
        const text = String(source);
        return text.charAt(0).toUpperCase() + text.slice(1);
    };
</script>

<div class="life-zone-container">
    <div class="life-total-wrapper">
        <div class="text-2xl font-bold text-red-400 life-total-display">
            ❤️ {life}
        </div>
    </div>

    <div class="life-controls-stack">
        <div class="life-controls-group">
            {#each negativeControls as control, index (control.id || `${control.label}-${index}`)}
                <button
                    type="button"
                    class={control.className}
                    title={control.title}
                    onclick={(event) => handleControlClick(event, control)}>
                    {control.label}
                </button>
            {/each}
        </div>
        <div class="life-controls-group">
            {#each positiveControls as control, index (control.id || `${control.label}-${index}`)}
                <button
                    type="button"
                    class={control.className}
                    title={control.title}
                    onclick={(event) => handleControlClick(event, control)}>
                    {control.label}
                </button>
            {/each}
        </div>
    </div>

    {#if hasCustomLifeControls}
        <div class="life-custom-input hidden" id={`life-custom-input-${playerId}`} data-direction="">
            <p class="text-xs text-arena-muted" id={`life-custom-input-label-${playerId}`}>
                Enter a custom amount
            </p>
            <input
                type="number"
                id={`life-custom-value-${playerId}`}
                min="1"
                step="1"
                class="w-full rounded-lg border border-arena-accent/30 bg-arena-surface-light px-3 py-2 text-sm text-arena-text"
                placeholder="Amount"
                onkeydown={(e) => {
                    if (e.key === 'Enter') {
                        UIZonesManager.submitCustomLifeInput(playerId);
                    }
                }} />
            <div class="life-custom-actions">
                <button
                    type="button"
                    class="flex-1 px-3 py-2 rounded-lg bg-emerald-500/30 border border-emerald-400/60 text-emerald-50 text-sm"
                    onclick={() => UIZonesManager.submitCustomLifeInput(playerId)}>
                    Confirm
                </button>
                <button
                    type="button"
                    class="flex-1 px-3 py-2 rounded-lg bg-arena-surface-light border border-arena-accent/30 text-arena-text text-sm"
                    onclick={() => UIZonesManager.cancelCustomLifeInput(playerId)}>
                    Cancel
                </button>
            </div>
        </div>
    {/if}

    <div class="player-counter-section">
        {#if counters && counters.length}
            <div class="player-counter-badges flex flex-wrap gap-2">
                {#each counters as counter, index (counter.type || index)}
                    <span class={chipClass}>
                        {#if counter.icon}
                            <span class="text-base">{counter.icon}</span>
                        {/if}
                        <span class="uppercase tracking-wide text-[10px] text-white/70">
                            {formatCounterLabel(counter)}
                        </span>
                        <span class="font-semibold text-white">{counter.amount}</span>
                    </span>
                {/each}
            </div>
        {/if}
        {#if manageButton}
            <button
                type="button"
                class={manageButton.className}
                title={manageButton.title}
                onclick={handleManageClick}>
                {manageButton.label}
            </button>
        {/if}
    </div>
</div>
