<script>
    let {
        headerIcon = '⚡',
        headerTitle = 'Game Actions',
        spectatorMode = false,
        gameInfo = { turn: 1, active: '-' },
        phases = [],
        currentPhase = 'begin',
        readOnlyPhases = false,
        phaseModeLabel = 'Strict',
        passButton = null,
        searchButton = null,
        quickButtons = [],
        spectatorInfo = {
            icon: '👁️',
            title: 'Spectator Mode',
            message: 'Game controls are disabled while you are watching.'
        },
        phaseClickHandler = null
    } = $props();

    const handlePrimaryButtonClick = (button) => {
        if (!button || button.disabled) {
            return;
        }
        if (typeof button.onClick === 'function') {
            button.onClick();
        }
    };

    const handlePhaseClick = (phase) => {
        if (!phase || !phase.isInteractive || typeof phaseClickHandler !== 'function') {
            return;
        }
        phaseClickHandler(phase.id);
    };

    const combineButtonClasses = (button) => {
        if (!button) return '';
        const disabledClasses = button.disabled ? ' opacity-40 cursor-not-allowed' : '';
        return `${button.className || ''}${disabledClasses}`;
    };

    const normalizedPhase = $derived(() => currentPhase || 'begin');
    let timelinePhases = $state([]);

    $effect(() => {
        const phaseList = Array.isArray(phases) ? phases : [];
        const normalized = normalizedPhase();
        const readOnly = readOnlyPhases;

        const activeIndex = Math.max(
            phaseList.findIndex((phase) => phase.id === normalized),
            0
        );

        timelinePhases = phaseList.map((phase, index) => {
            const isCurrent = phase.id === normalized;
            const timelineState = index < activeIndex
                ? 'completed'
                : (isCurrent ? 'current' : 'upcoming');

            let stateClasses = '';
            if (timelineState === 'current') {
                stateClasses = 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 shadow';
            } else if (timelineState === 'completed') {
                stateClasses = readOnly
                    ? 'text-green-300 border border-green-500/20'
                    : 'text-green-200 border border-green-500/30';
            } else {
                stateClasses = 'text-arena-text-dim border border-transparent';
            }

            let interactionClasses = readOnly || isCurrent
                ? 'cursor-default'
                : 'cursor-pointer';

            if (!readOnly && !isCurrent) {
                interactionClasses += timelineState === 'completed'
                    ? ' hover:border-green-400/50 hover:text-green-100'
                    : ' hover:text-arena-text hover:border-yellow-500/30';
            }

            return {
                ...phase,
                timelineState,
                isCurrent,
                isInteractive: !readOnly && !isCurrent,
                stateClasses,
                interactionClasses
            };
        });
    });

    const hasQuickButtons = $derived(() => Array.isArray(quickButtons) && quickButtons.length > 0);
</script>

<div>
    <h4 class="font-magic font-semibold mb-2 text-arena-accent flex items-center">
        <span class="mr-2">{headerIcon}</span>{headerTitle}
    </h4>

    <div class="grid grid-cols-2 gap-2 mb-4">
        <div class="text-center">
            <div class="bg-blue-500/20 rounded-lg p-3 border border-blue-500/30">
                <div class="text-blue-300 font-semibold text-sm">Turn</div>
                <div class="text-lg font-bold text-arena-accent">{gameInfo.turn}</div>
            </div>
        </div>
        <div class="text-center">
            <div class="bg-yellow-500/20 rounded-lg p-3 border border-yellow-500/30">
                <div class="text-yellow-300 font-semibold text-sm">Active</div>
                <div class="text-lg font-bold text-arena-accent">{gameInfo.active}</div>
            </div>
        </div>
    </div>
    {#if timelinePhases.length}
        <div class="mb-4 bg-arena-surface/30 border border-arena-accent/20 rounded-lg p-3">
            <div class="grid grid-cols-7 gap-1">
                {#each timelinePhases as phase (phase.id)}
                    <button
                        type="button"
                        class={`text-center py-2 px-1 rounded transition-all duration-200 ${phase.stateClasses} ${phase.interactionClasses}`}
                        title={`${phase.name} Phase`}
                        onclick={() => handlePhaseClick(phase)}>
                        <div class="text-lg mb-1 leading-none">{phase.icon}</div>
                        <div class="text-xs font-medium leading-tight">{phase.name}</div>
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    {#if spectatorMode}
        <div class="text-center py-6 border-t border-arena-accent/10">
            <div class="text-3xl mb-2 leading-none">{spectatorInfo.icon}</div>
            <div class="text-arena-accent font-semibold mb-1">{spectatorInfo.title}</div>
            <p class="text-arena-text-dim text-sm">{spectatorInfo.message}</p>
        </div>
    {:else}
        <div class="text-center text-xs text-arena-muted mb-3">
            Phase Mode: {phaseModeLabel}
        </div>

        {#if passButton}
            <div class="flex items-center mb-3">
                <button
                    type="button"
                    class={combineButtonClasses(passButton)}
                    title={passButton.title}
                    disabled={passButton.disabled}
                    onclick={() => handlePrimaryButtonClick(passButton)}>
                    {passButton.label}
                </button>
            </div>
        {/if}

        {#if searchButton}
            <div class="mb-4">
                <button
                    type="button"
                    class={combineButtonClasses(searchButton)}
                    title={searchButton.title}
                    disabled={searchButton.disabled}
                    onclick={() => handlePrimaryButtonClick(searchButton)}>
                    {searchButton.label}
                </button>
            </div>
        {/if}

        {#if hasQuickButtons}
            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                {#each quickButtons as button, index (button.id || index)}
                    <button
                        type="button"
                        class={combineButtonClasses(button)}
                        title={button.title}
                        disabled={button.disabled}
                        onclick={() => handlePrimaryButtonClick(button)}>
                        {button.label}
                    </button>
                {/each}
            </div>
        {/if}
    {/if}
</div>
