<script>
    export let life = 20;
    export let playerId = '';
    export let negativeControls = [];
    export let positiveControls = [];
    export let hasCustomLifeControls = false;
    export let countersHtml = '';
    export let manageButton = null;

    const handleControlClick = (control) => {
        if (control && typeof control.onClick === 'function') {
            control.onClick();
        }
    };

    const handleManageClick = () => {
        if (manageButton && typeof manageButton.onClick === 'function') {
            manageButton.onClick();
        }
    };
</script>

<div class="life-zone-container p-4">
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
                    on:click={() => handleControlClick(control)}>
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
                    on:click={() => handleControlClick(control)}>
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
                placeholder="Amount" />
            <div class="life-custom-actions">
                <button
                    type="button"
                    class="flex-1 px-3 py-2 rounded-lg bg-emerald-500/30 border border-emerald-400/60 text-emerald-50 text-sm"
                    on:click={() => UIZonesManager.submitCustomLifeInput(playerId)}>
                    Confirm
                </button>
                <button
                    type="button"
                    class="flex-1 px-3 py-2 rounded-lg bg-arena-surface-light border border-arena-accent/30 text-arena-text text-sm"
                    on:click={() => UIZonesManager.cancelCustomLifeInput(playerId)}>
                    Cancel
                </button>
            </div>
        </div>
    {/if}

    <div class="player-counter-section">
        {@html countersHtml}
        {#if manageButton}
            <button
                type="button"
                class={manageButton.className}
                title={manageButton.title}
                on:click={handleManageClick}>
                {manageButton.label}
            </button>
        {/if}
    </div>
</div>
