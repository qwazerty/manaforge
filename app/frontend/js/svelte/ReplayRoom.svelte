<script>
    import { onDestroy, onMount } from 'svelte';
    import GameArena from './GameArena.svelte';
    import { loadActionHistoryFromState } from './stores/actionHistoryStore.js';
    import { UIConfig } from '@lib/ui-config';

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

    let actionPanelApp = null;
    let playInterval = null;

    const totalSteps = $derived(() => Array.isArray(timeline) ? timeline.length : 0);
    const _displayTotalSteps = $derived(() => Math.max(totalSteps(), 0));
    const _displayStepIndex = $derived(() =>
        totalSteps() > 0 ? Math.min(currentIndex + 1, totalSteps()) : 0
    );
    const currentState = $derived(() => (timeline[currentIndex]?.state) || null);
    const hasTimeline = $derived(() => totalSteps() > 0);

    const replayControls = $derived({
        onPrev: prevStep,
        onPlay: startPlayback,
        onPause: pausePlayback,
        onNext: nextStep,
        onDownload: downloadReplay,
        onSeek: seekToStep,
        isPlaying,
        currentStep: currentIndex,
        totalSteps: totalSteps()
    });

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
            replayControls: replayControls,
            spectatorInfo: {
                icon: '📼',
                title: 'Replay Mode',
                message: 'Viewing recorded game history.'
            }
        };
    }

    function syncActionHistory(state) {
        const history = Array.isArray(state?.action_history) ? state.action_history : [];
        try {
            loadActionHistoryFromState(history);
        } catch (error) {
            console.warn('Unable to load replay history into action history store', error);
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

    function cleanup() {
        clearPlayTimer();
        destroyActionPanel();
    }

    function _handleProgressClick(event) {
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
            <div id="game-arena-root" class="flex-grow">
                {#if currentState()}
                    <GameArena gameState={currentState()} selectedPlayer="spectator" />
                {:else}
                    <div class="flex items-center justify-center h-full text-arena-text-dim">
                        Preparing arena...
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
