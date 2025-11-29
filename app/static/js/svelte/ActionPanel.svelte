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
        tokenSearchButton = null,
        quickButtons = [],
        spectatorInfo = {
            icon: '👁️',
            title: 'Spectator Mode',
            message: 'Game controls are disabled while you are watching.'
        },
        phaseClickHandler = null,
        replayControls = null
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

    const replayTotalSteps = $derived(() => replayControls ? Math.max(replayControls.totalSteps || 0, 0) : 0);
    const replayCurrentStep = $derived(() => replayControls ? (replayControls.currentStep || 0) : 0);

    const replayProgress = $derived(() => {
        const total = Math.max(replayTotalSteps(), 1);
        const current = Math.max(Math.min(replayCurrentStep() + 1, total), 0);

        return Math.round((current / total) * 100);
    });

    const replayButtonClass = $derived(() => {
        const buttonConfig = (typeof UIConfig !== 'undefined' && UIConfig?.CSS_CLASSES?.button)
            ? UIConfig.CSS_CLASSES.button
            : null;
        return buttonConfig?.primarySmall;
    });

    const handleProgressClick = (event) => {
        if (!replayControls || typeof replayControls.onSeek !== 'function') {
            return;
        }
        const total = replayTotalSteps();
        if (!total) return;
        const rect = event.currentTarget?.getBoundingClientRect?.();
        if (!rect || !rect.width) return;
        const pct = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const target = Math.floor(pct * Math.max(total - 1, 0));
        replayControls.onSeek(target);
    };
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
        {#if replayControls}
            <div class="mt-4 p-4 border-t border-arena-border bg-arena-surface/50 rounded-lg shadow-inner flex flex-col gap-3">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                    <button 
                        class={`${replayButtonClass()} text-sm`}
                        onclick={replayControls.onPrev}
                        title="Previous Step"
                        aria-label="Previous step">
                        ⏮️ Prev
                    </button>
                    {#if replayControls.isPlaying}
                        <button 
                            class={`${replayButtonClass()} text-sm`}
                            onclick={replayControls.onPause}
                            title="Pause"
                            aria-label="Pause replay">
                            ⏸️ Pause
                        </button>
                    {:else}
                        <button 
                            class={`${replayButtonClass()} text-sm`}
                            onclick={replayControls.onPlay}
                            title="Play"
                            aria-label="Play replay">
                            ▶️ Play
                        </button>
                    {/if}
                    <button 
                        class={`${replayButtonClass()} text-sm`}
                        onclick={replayControls.onNext}
                        title="Next Step"
                        aria-label="Next step">
                        ⏭️ Next
                    </button>
                </div>

                <div class="flex items-center gap-3 flex-wrap">
                    <div class="flex-1 min-w-[180px]">
                        <div class="flex items-center justify-between text-[11px] text-arena-text-dim mb-1">
                            <span>Step progress</span>
                            <span class="font-mono text-xs text-arena-text-primary">{replayCurrentStep() + 1}/{replayTotalSteps()}</span>
                        </div>
                        <div class="h-2 bg-arena-border/40 rounded-full overflow-hidden cursor-pointer" onclick={handleProgressClick}>
                            <div class="h-full bg-gradient-to-r from-arena-accent to-yellow-400 transition-all duration-300" style={`width: ${replayProgress()}%`}></div>
                        </div>
                    </div>
                </div>
            </div>
        {:else}
            <div class="text-center py-6 border-t border-arena-accent/10">
                <div class="text-3xl mb-2 leading-none">{spectatorInfo.icon}</div>
                <div class="text-arena-accent font-semibold mb-1">{spectatorInfo.title}</div>
                <p class="text-arena-text-dim text-sm">{spectatorInfo.message}</p>
            </div>
        {/if}
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

        {#if searchButton || tokenSearchButton}
            <div class="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {#if searchButton}
                    <button
                        type="button"
                        class={combineButtonClasses(searchButton)}
                        title={searchButton.title}
                        disabled={searchButton.disabled}
                        onclick={() => handlePrimaryButtonClick(searchButton)}>
                        {searchButton.label}
                    </button>
                {/if}
                {#if tokenSearchButton}
                    <button
                        type="button"
                        class={combineButtonClasses(tokenSearchButton)}
                        title={tokenSearchButton.title}
                        disabled={tokenSearchButton.disabled}
                        onclick={() => handlePrimaryButtonClick(tokenSearchButton)}>
                        {tokenSearchButton.label}
                    </button>
                {/if}
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
