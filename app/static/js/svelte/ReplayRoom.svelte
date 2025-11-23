<script>
    import { onDestroy, onMount } from 'svelte';

    let {
        gameId = ''
    } = $props();

    let timeline = $state([]);
    let currentIndex = $state(0);
    let isPlaying = $state(false);
    let loading = $state(true);
    let errorMessage = $state('');

    const playbackSpeed = 500;
    const phases = Array.isArray(UIConfig?.GAME_PHASES) ? UIConfig.GAME_PHASES : [];

    let arenaApp = null;
    let arenaUnmount = null;
    let actionPanelApp = null;
    let playInterval = null;

    const totalSteps = () => Array.isArray(timeline) ? timeline.length : 0;
    const displayTotalSteps = () => Math.max(totalSteps(), 0);
    const displayStepIndex = () =>
        totalSteps() > 0 ? Math.min(currentIndex + 1, totalSteps()) : 0;
    const currentState = () => (timeline[currentIndex]?.state) || null;
    const hasTimeline = () => totalSteps() > 0;

    const replayControls = $derived(() => ({
        onPrev: prevStep,
        onPlay: startPlayback,
        onPause: pausePlayback,
        onNext: nextStep,
        onDownload: downloadReplay,
        onSeek: seekToStep,
        isPlaying,
        currentStep: currentIndex,
        totalSteps: totalSteps()
    }));

    onMount(async () => {
        await hydrateReplay();
        return cleanup;
    });

    onDestroy(cleanup);

    async function hydrateReplay() {
        loading = true;
        errorMessage = '';
        isPlaying = false;

        try {
            const replayData = await loadReplayData();
            if (replayData?.timeline?.length) {
                timeline = replayData.timeline;
                currentIndex = 0;
            } else {
                errorMessage = 'No replay data available.';
            }
        } catch (error) {
            console.error('[ReplayRoom] failed to load replay', error);
            errorMessage = error?.message || 'Unable to load replay data.';
        } finally {
            loading = false;
        }
    }

    async function loadReplayData() {
        if (gameId === 'local') {
            const stored = localStorage.getItem('replay_data');
            if (!stored) {
                throw new Error('No local replay data found.');
            }
            return JSON.parse(stored);
        }

        const response = await fetch(`/api/v1/games/${gameId}/replay`);
        if (!response.ok) {
            let detail = '';
            try {
                const payload = await response.json();
                detail = payload?.detail || '';
            } catch {
                // ignore parse errors
            }
            throw new Error(detail || 'Failed to fetch replay.');
        }
        return response.json();
    }

    function prevStep() {
        if (currentIndex > 0) {
            currentIndex -= 1;
        }
    }

    function nextStep() {
        if (currentIndex < totalSteps() - 1) {
            currentIndex += 1;
        } else {
            pausePlayback();
        }
    }

    function seekToStep(target) {
        if (!hasTimeline()) return;
        const clamped = Math.min(Math.max(Number(target) || 0, 0), Math.max(totalSteps() - 1, 0));
        currentIndex = clamped;
    }

    function startPlayback() {
        if (!hasTimeline()) return;
        if (currentIndex >= totalSteps() - 1) {
            currentIndex = 0;
        }
        isPlaying = true;
    }

    function pausePlayback() {
        isPlaying = false;
    }

    function downloadReplay() {
        if (!hasTimeline()) return;
        const data = { game_id: gameId || 'replay', timeline };
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', `replay-${gameId || 'local'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    $effect(() => {
        if (!isPlaying || !hasTimeline()) {
            clearPlayTimer();
            return;
        }

        clearPlayTimer();
        playInterval = setInterval(() => {
            nextStep();
        }, playbackSpeed);

        return clearPlayTimer;
    });

    $effect(() => {
        if (totalSteps() === 0 && currentIndex !== 0) {
            currentIndex = 0;
        } else if (currentIndex >= totalSteps() && totalSteps() > 0) {
            currentIndex = Math.max(totalSteps() - 1, 0);
        }
    });

    $effect(() => {
        if (loading || !currentState()) {
            return;
        }

        ensureArenaMounted(currentState());
        updateArena(currentState());
        ensureActionPanel(currentState());
        syncActionHistory(currentState());
        syncBattleChat(currentState());
    });

    function clearPlayTimer() {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
    }

    function ensureArenaMounted(state) {
        if (arenaApp) return;
        const root = document.getElementById('game-arena-root');
        if (!root) return;

        const component = typeof window !== 'undefined' ? window.GameArenaComponent : null;
        if (!component) {
            errorMessage = 'Game arena UI is unavailable.';
            return;
        }

        root.innerHTML = '';
        const mount = typeof component.mount === 'function' ? component.mount : null;
        const unmount = typeof component.unmount === 'function' ? component.unmount : null;
        arenaUnmount = unmount || null;

        const props = {
            gameState: state,
            selectedPlayer: 'spectator'
        };

        if (mount) {
            arenaApp = mount(component.default, { target: root, props });
        } else {
            const CompClass = component.default || component;
            arenaApp = new CompClass({ target: root, props });
        }
    }

    function updateArena(state) {
        if (!arenaApp) return;
        if (typeof arenaApp.$set === 'function') {
            arenaApp.$set({
                gameState: state,
                selectedPlayer: 'spectator'
            });
        }
    }

    function ensureActionPanel(state) {
        const target = document.getElementById('action-panel');
        if (!target) return;

        const component = typeof window !== 'undefined' ? window.ActionPanelComponent : null;
        if (!component) return;

        const props = buildActionPanelProps(state);
        if (!actionPanelApp) {
            const mount = typeof component.mount === 'function' ? component.mount : null;
            const CompClass = component.default || component;
            target.innerHTML = '';
            actionPanelApp = mount
                ? mount(component.default, { target, props })
                : new CompClass({ target, props });
        } else if (typeof actionPanelApp.$set === 'function') {
            actionPanelApp.$set(props);
        }
    }

    function buildActionPanelProps(state) {
        return {
            headerTitle: 'Replay Mode',
            headerIcon: '📼',
            gameInfo: {
                turn: state?.turn || 0,
                active: getActivePlayerLabel(state)
            },
            phases,
            currentPhase: state?.phase || 'begin',
            readOnlyPhases: true,
            spectatorMode: true,
            replayControls,
            spectatorInfo: {
                icon: '📼',
                title: 'Replay Mode',
                message: 'Viewing recorded game history.'
            }
        };
    }

    function syncActionHistory(state) {
        const history = Array.isArray(state?.action_history) ? state.action_history : [];
        const manager = typeof window !== 'undefined' ? window.UIActionHistory : null;
        if (!manager || typeof manager.loadFromState !== 'function') {
            return;
        }
        try {
            manager.loadFromState(history);
        } catch (error) {
            console.warn('Unable to load replay history into UIActionHistory', error);
        }
    }

    function syncBattleChat(state) {
        const messages = Array.isArray(state?.chat_log) ? state.chat_log : [];
        const chat = typeof window !== 'undefined' ? window.UIBattleChat : null;
        if (!chat || typeof chat.loadChatLog !== 'function') {
            return;
        }
        try {
            chat.loadChatLog(messages);
        } catch (error) {
            console.warn('Unable to load replay chat log into UIBattleChat', error);
        }
    }

    function getActivePlayerLabel(state) {
        const players = Array.isArray(state?.players) ? state.players : [];
        const rawActive = state?.active_player;
        let activeIndex = typeof rawActive === 'number' ? rawActive : null;

        if (activeIndex === null && typeof rawActive === 'string') {
            const matchIndex = players.findIndex(
                (p) =>
                    p?.id === rawActive ||
                    p?.key === rawActive ||
                    p?.player_id === rawActive
            );
            activeIndex = matchIndex >= 0 ? matchIndex : null;
        }

        if (activeIndex !== null && players[activeIndex]) {
            const name = (players[activeIndex]?.name || '').trim();
            if (name) return name;
        }

        if (typeof rawActive === 'string' && rawActive.trim()) {
            return rawActive;
        }

        if (activeIndex === 0) return 'Player 1';
        if (activeIndex === 1) return 'Player 2';
        if (activeIndex !== null) return `Player ${activeIndex + 1}`;
        return 'Player';
    }

    function destroyActionPanel() {
        if (actionPanelApp) {
            const component = typeof window !== 'undefined' ? window.ActionPanelComponent : null;
            try {
                if (component?.unmount) {
                    component.unmount(actionPanelApp);
                } else if (typeof actionPanelApp.$destroy === 'function') {
                    actionPanelApp.$destroy();
                }
            } catch (error) {
                console.warn('[ReplayRoom] failed to destroy ActionPanel', error);
            }
        }
        actionPanelApp = null;
    }

    function destroyArena() {
        if (arenaApp) {
            try {
                if (arenaUnmount) {
                    arenaUnmount(arenaApp);
                } else if (typeof arenaApp.$destroy === 'function') {
                    arenaApp.$destroy();
                }
            } catch (error) {
                console.warn('[ReplayRoom] failed to destroy GameArena', error);
            }
        }
        arenaApp = null;
    }

    function cleanup() {
        clearPlayTimer();
        destroyActionPanel();
        destroyArena();
    }

    function handleProgressClick(event) {
        if (!hasTimeline()) return;
        const total = Math.max(totalSteps() - 1, 0);
        if (total <= 0) return;
        const rect = event.currentTarget?.getBoundingClientRect?.();
        if (!rect || !rect.width) return;
        const pct = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const target = Math.floor(pct * total);
        seekToStep(target);
    }
</script>

<div class="min-h-screen bg-arena-gradient relative game-container-1080 compact-zones spectator-mode">
    <div class="mx-auto px-4 py-3 flex flex-col h-full">
        {#if loading}
            <div class="flex items-center justify-center h-full text-arena-text-dim">
                Loading replay data...
            </div>
        {:else if errorMessage}
            <div class="flex items-center justify-center h-full text-red-400 font-semibold text-center">
                {errorMessage}
            </div>
        {:else if !hasTimeline()}
            <div class="flex items-center justify-center h-full text-arena-text-dim">
                No replay steps available.
            </div>
        {:else}
            <div class="flex items-center justify-between gap-3 pb-3">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">📼</span>
                    <div>
                        <div class="font-magic text-xl text-arena-accent leading-tight">Replay Mode</div>
                        <div class="text-xs text-arena-text-dim">
                            Game {gameId || 'Replay'} • Step {displayStepIndex()} / {displayTotalSteps()}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    class="arena-button px-3 py-2 rounded-lg text-sm"
                    onclick={downloadReplay}>
                    💾 Download JSON
                </button>
            </div>

            <div id="game-arena-root" class="flex-grow">
                <div class="flex items-center justify-center h-full text-arena-text-dim">
                    Preparing arena...
                </div>
            </div>

            <div class="mt-3 flex flex-col gap-3 text-sm text-arena-text-dim">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-arena-text">Turn {currentState()?.turn || '-'}</span>
                        <span>•</span>
                        <span>Active {getActivePlayerLabel(currentState())}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button
                            class="arena-button px-3 py-1 rounded text-xs"
                            type="button"
                            onclick={prevStep}
                            title="Previous step">
                            ⏮️ Prev
                        </button>
                        {#if isPlaying}
                            <button
                                class="arena-button px-3 py-1 rounded text-xs"
                                type="button"
                                onclick={pausePlayback}
                                title="Pause replay">
                                ⏸️ Pause
                            </button>
                        {:else}
                            <button
                                class="arena-button px-3 py-1 rounded text-xs"
                                type="button"
                                onclick={startPlayback}
                                title="Play replay">
                                ▶️ Play
                            </button>
                        {/if}
                        <button
                            class="arena-button px-3 py-1 rounded text-xs"
                            type="button"
                            onclick={nextStep}
                            title="Next step">
                            ⏭️ Next
                        </button>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="flex-1">
                        <div class="flex items-center justify-between text-[11px] text-arena-text-dim mb-1">
                            <span>Step progress</span>
                            <span class="font-mono text-xs text-arena-text-primary">
                                {displayStepIndex()}/{displayTotalSteps()}
                            </span>
                        </div>
                        <div class="h-2 bg-arena-border/40 rounded-full overflow-hidden cursor-pointer" onclick={handleProgressClick}>
                            <div
                                class="h-full bg-gradient-to-r from-arena-accent to-yellow-400 transition-all duration-300"
                                style={`width: ${Math.min(
                                    100,
                                    Math.round(((displayStepIndex() || 0) / Math.max(totalSteps(), 1)) * 100)
                                )}%`}>
                            </div>
                        </div>
                    </div>
                    <div class="min-w-[100px] text-right">
                        {#if isPlaying}
                            <span class="text-green-400 font-semibold">Playing</span>
                        {:else}
                            <span class="text-yellow-300 font-semibold">Paused</span>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>
