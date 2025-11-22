(async function() {
    const root = document.getElementById('replay-interface-root');
    const gameId = root.dataset.gameId;
    const arenaRoot = document.getElementById('game-arena-root');
    
    let timeline = [];
    let currentIndex = 0;
    let isPlaying = false;
    let playInterval = null;
    let gameArenaApp = null;
    let actionPanelApp = null;
    let actionHistoryApp = null;

    let playbackSpeed = 2000;

    function prevStep() {
        if (currentIndex > 0) {
            currentIndex--;
            updateUI();
        }
    }

    function nextStep() {
        if (currentIndex < timeline.length - 1) {
            currentIndex++;
            updateUI();
        } else {
            pausePlayback();
        }
    }

    function seekToStep(targetIndex) {
        if (!Array.isArray(timeline) || !timeline.length) return;
        const clamped = Math.min(Math.max(Number(targetIndex) || 0, 0), timeline.length - 1);
        currentIndex = clamped;
        updateUI();
    }

    function startPlayback() {
        if (currentIndex >= timeline.length - 1) currentIndex = 0;
        isPlaying = true;
        updateUI();
        playInterval = setInterval(nextStep, playbackSpeed);
    }

    function pausePlayback() {
        isPlaying = false;
        clearInterval(playInterval);
        updateUI();
    }
    
    function downloadReplay() {
        if (!timeline || timeline.length === 0) return;
        const data = { game_id: gameId, timeline: timeline };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `replay-${gameId}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function getReplayControls() {
        return {
            onPrev: prevStep,
            onPlay: startPlayback,
            onPause: pausePlayback,
            onNext: nextStep,
            onDownload: downloadReplay,
            onSeek: seekToStep,
            isPlaying: isPlaying,
            currentStep: currentIndex,
            totalSteps: timeline.length
        };
    }

    async function loadReplayData() {
        if (gameId === 'local') {
            const data = localStorage.getItem('replay_data');
            if (!data) {
                alert('No local replay data found.');
                return null;
            }
            return JSON.parse(data);
        } else {
            const response = await fetch(`/api/v1/games/${gameId}/replay`);
            if (!response.ok) {
                alert('Failed to load replay.');
                return null;
            }
            return await response.json();
        }
    }

    const PHASES = (window.UIConfig && window.UIConfig.GAME_PHASES) ? window.UIConfig.GAME_PHASES : [
        { id: 'begin', name: 'Begin', icon: '🌅' },
        { id: 'main1', name: 'Main 1', icon: '☀️' },
        { id: 'combat', name: 'Combat', icon: '⚔️' },
        { id: 'attack', name: 'Attack', icon: '🗡️' },
        { id: 'block', name: 'Block', icon: '🛡️' },
        { id: 'damage', name: 'Damage', icon: '💥' },
        { id: 'main2', name: 'Main 2', icon: '🌙' },
        { id: 'end', name: 'End', icon: '🔚' }
    ];

    function updateUI() {
        renderFrame();
    }

    let mount;
    let unmount;
    let Component;

    function renderFrame() {
        if (!timeline[currentIndex]) return;
        const state = timeline[currentIndex].state;
        
        if (gameArenaApp && typeof gameArenaApp.$set === 'function') {
            gameArenaApp.$set({ 
                gameState: state,
                selectedPlayer: 'spectator' 
            });
            updateSubComponents(state);
        } else {
            // Re-mount strategy for Svelte 5 if $set is not available
            // Note: This is less efficient but works for replay
            if (unmount && gameArenaApp) {
                unmount(gameArenaApp);
                gameArenaApp = null;
                // Sub-components are inside GameArena, so they are destroyed too
                actionPanelApp = null;
                actionHistoryApp = null;
            } else if (gameArenaApp && typeof gameArenaApp.$destroy === 'function') {
                gameArenaApp.$destroy();
                gameArenaApp = null;
                actionPanelApp = null;
                actionHistoryApp = null;
            } else {
                arenaRoot.innerHTML = '';
            }
            
            mountComponent(state);
            // Wait for DOM update then mount sub-components
            setTimeout(() => mountSubComponents(state), 0);
        }
    }

    function updateSubComponents(state) {
        if (actionPanelApp && typeof actionPanelApp.$set === 'function') {
            actionPanelApp.$set({
                gameInfo: { turn: state.turn, active: state.active_player },
                currentPhase: state.phase,
                replayControls: getReplayControls()
            });
        }
        if (actionHistoryApp && typeof actionHistoryApp.$set === 'function') {
            actionHistoryApp.$set({
                entries: state.action_history || []
            });
        }
    }

    function mountSubComponents(state) {
        const actionPanelRoot = document.getElementById('action-panel');
        const actionHistoryRoot = document.getElementById('action-history-panel');

        if (actionPanelRoot && !actionPanelApp && window.ActionPanelComponent) {
            const props = {
                headerTitle: 'Replay Mode',
                headerIcon: '📼',
                gameInfo: { turn: state.turn, active: state.active_player },
                phases: PHASES,
                currentPhase: state.phase,
                readOnlyPhases: true,
                spectatorMode: true,
                replayControls: getReplayControls(),
                spectatorInfo: {
                    icon: '📼',
                    title: 'Replay Mode',
                    message: 'Viewing recorded game history.'
                }
            };
            
            if (typeof window.ActionPanelComponent.mount === 'function') {
                actionPanelApp = window.ActionPanelComponent.mount(window.ActionPanelComponent.default, {
                    target: actionPanelRoot,
                    props: props
                });
            } else {
                const Comp = window.ActionPanelComponent.default || window.ActionPanelComponent;
                actionPanelApp = new Comp({
                    target: actionPanelRoot,
                    props: props
                });
            }
        }

        if (actionHistoryRoot && !actionHistoryApp && window.ActionHistoryComponent) {
            const props = {
                entries: state.action_history || [],
                panelTitle: 'Replay Log'
            };

            if (typeof window.ActionHistoryComponent.mount === 'function') {
                actionHistoryApp = window.ActionHistoryComponent.mount(window.ActionHistoryComponent.default, {
                    target: actionHistoryRoot,
                    props: props
                });
            } else {
                const Comp = window.ActionHistoryComponent.default || window.ActionHistoryComponent;
                actionHistoryApp = new Comp({
                    target: actionHistoryRoot,
                    props: props
                });
            }
        }
    }

    function mountComponent(state) {
        if (mount && Component && Component.default) {
             gameArenaApp = mount(Component.default, {
                target: arenaRoot,
                props: {
                    gameState: state,
                    selectedPlayer: 'spectator'
                }
             });
        } else if (Component) {
             const CompClass = Component.default || Component;
             gameArenaApp = new CompClass({
                target: arenaRoot,
                props: {
                    gameState: state,
                    selectedPlayer: 'spectator'
                }
            });
        }
    }

    // Init
    const replayData = await loadReplayData();
    if (replayData && replayData.timeline) {
        timeline = replayData.timeline;
        
        Component = window.GameArenaComponent;
        
        if (Component) {
            if (typeof Component.mount === 'function') {
                mount = Component.mount;
                unmount = Component.unmount; // Assuming unmount is also exported or available
            }
            
            arenaRoot.innerHTML = ''; // Clear loading message
            mountComponent(timeline[0].state);
            setTimeout(() => mountSubComponents(timeline[0].state), 0);
        } else {
            console.error('GameArenaComponent not found');
            arenaRoot.innerHTML = '<div class="text-red-500 text-center mt-10">Error: GameArena component not loaded.</div>';
        }
    }
})();
