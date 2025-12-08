<script>
    import { onMount } from 'svelte';
    import { addActionHistoryEntry } from './stores/actionHistoryStore.js';

    /**
     * RandomButton Component
     * Provides coin flip, d6, and d20 dice roll functionality with animations
     */

    let { className = '' } = $props();

    let isOpen = $state(false);
    let isAnimating = $state(false);
    let animationType = $state(null);
    let animationResult = $state(null);
    let animationPlayer = $state(null);

    const toggleDropdown = () => {
        if (!isAnimating) {
            isOpen = !isOpen;
        }
    };

    const closeDropdown = () => {
        isOpen = false;
    };

    const getPlayerName = () => {
        if (typeof window !== 'undefined' && window.WebSocketManager) {
            const playerInfo = window.WebSocketManager.getLocalPlayerInfo?.() || {};
            return playerInfo.name || 'Player';
        }
        return 'Player';
    };

    const sendRandomAnimation = (type) => {
        if (typeof window !== 'undefined' && window.WebSocketManager) {
            const playerName = getPlayerName();
            
            // Send raw message to broadcast animation to all players
            // Result is calculated server-side for fairness
            const websocket = window.WebSocketManager.websocket;
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({
                    type: 'random_animation',
                    animation_type: type,
                    player: playerName
                }));
            }
        }
    };

    const flipCoin = () => {
        if (isAnimating) return;
        isOpen = false;
        sendRandomAnimation('coin');
    };

    const rollD6 = () => {
        if (isAnimating) return;
        isOpen = false;
        sendRandomAnimation('d6');
    };

    const rollD20 = () => {
        if (isAnimating) return;
        isOpen = false;
        sendRandomAnimation('d20');
    };

    const getActionLabel = (type) => {
        switch (type) {
            case 'coin': return 'Coin Flip';
            case 'd6': return 'D6 Roll';
            case 'd20': return 'D20 Roll';
            default: return 'Random';
        }
    };

    const getResultMessage = (type, result) => {
        switch (type) {
            case 'coin': return `🪙 ${result}`;
            case 'd6': return `🎲 Rolled ${result}`;
            case 'd20': 
                if (result === 20) return `🎯 Rolled 20 - CRITICAL!`;
                if (result === 1) return `🎯 Rolled 1 - CRITICAL FAIL!`;
                return `🎯 Rolled ${result}`;
            default: return `Result: ${result}`;
        }
    };

    // Play animation when receiving from WebSocket
    const playAnimation = (type, result, player) => {
        if (isAnimating) return;
        
        isAnimating = true;
        animationType = type;
        animationResult = null;
        animationPlayer = player;

        // Animate for 1.5 seconds then show result
        setTimeout(() => {
            animationResult = result;
            
            // Get current game state for turn metadata
            let contextPayload = {};
            if (typeof GameCore !== 'undefined' && typeof GameCore.getGameState === 'function') {
                const state = GameCore.getGameState();
                if (state) {
                    contextPayload = {
                        turn: state.turn,
                        phase: state.phase,
                        turn_player_id: state.players?.[state.active_player]?.id,
                        turn_player_name: state.players?.[state.active_player]?.name
                    };
                }
            }
            
            // Add to action history with turn metadata in context
            addActionHistoryEntry({
                action: getActionLabel(type),
                player: player,
                success: true,
                details: {
                    message: getResultMessage(type, result)
                }
            }, { source: 'client', payload: contextPayload });
            
            // Reset after showing result
            setTimeout(() => {
                isAnimating = false;
                animationType = null;
                animationResult = null;
                animationPlayer = null;
            }, 2000);
        }, 1500);
    };

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
        const target = event.target;
        if (!target.closest('.random-button-container')) {
            closeDropdown();
        }
    };

    $effect(() => {
        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    });

    // D6 faces for animation
    const d6Faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    let currentD6Face = $state(0);
    let currentD20Value = $state(1);
    let coinSide = $state(0);

    // Animation intervals
    $effect(() => {
        if (isAnimating && animationType === 'd6' && !animationResult) {
            const interval = setInterval(() => {
                currentD6Face = Math.floor(Math.random() * 6);
            }, 100);
            return () => clearInterval(interval);
        }
    });

    $effect(() => {
        if (isAnimating && animationType === 'd20' && !animationResult) {
            const interval = setInterval(() => {
                currentD20Value = Math.floor(Math.random() * 20) + 1;
            }, 80);
            return () => clearInterval(interval);
        }
    });

    $effect(() => {
        if (isAnimating && animationType === 'coin' && !animationResult) {
            const interval = setInterval(() => {
                coinSide = coinSide === 0 ? 1 : 0;
            }, 150);
            return () => clearInterval(interval);
        }
    });

    // Expose playAnimation to window for WebSocket handler to call
    onMount(() => {
        if (typeof window !== 'undefined') {
            window.RandomButton = {
                playAnimation
            };
        }
        
        return () => {
            if (typeof window !== 'undefined') {
                delete window.RandomButton;
            }
        };
    });
</script>

<div class="random-button-container relative inline-block w-full">
    <button
        type="button"
        class="{className} w-full"
        title="Roll dice or flip coin"
        onclick={toggleDropdown}
        disabled={isAnimating}
    >
        🎲 Random
    </button>

    {#if isOpen}
        <div class="absolute bottom-full left-0 mb-1 w-full bg-arena-surface border border-arena-accent/30 rounded-lg shadow-lg z-50 overflow-hidden">
            <button
                type="button"
                class="w-full px-3 py-2 text-xs text-left hover:bg-arena-accent/20 transition-colors flex items-center gap-2"
                onclick={flipCoin}
            >
                <span class="text-base">🪙</span>
                <span>Flip Coin</span>
            </button>
            <button
                type="button"
                class="w-full px-3 py-2 text-xs text-left hover:bg-arena-accent/20 transition-colors flex items-center gap-2 border-t border-arena-border/50"
                onclick={rollD6}
            >
                <span class="text-base">🎲</span>
                <span>Roll D6</span>
            </button>
            <button
                type="button"
                class="w-full px-3 py-2 text-xs text-left hover:bg-arena-accent/20 transition-colors flex items-center gap-2 border-t border-arena-border/50"
                onclick={rollD20}
            >
                <span class="text-base">🎯</span>
                <span>Roll D20</span>
            </button>
        </div>
    {/if}
</div>

<!-- Animation Overlay -->
{#if isAnimating}
    <div class="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
        <div class="text-center bg-arena-surface/90 rounded-2xl p-8 shadow-2xl border border-arena-accent/30">
            {#if animationPlayer}
                <div class="text-lg text-arena-accent mb-4 animate-fade-in">
                    {animationPlayer}
                </div>
            {/if}
            {#if animationType === 'coin'}
                <div class="coin-animation mb-4">
                    {#if animationResult}
                        <div class="text-8xl animate-bounce-in">
                            {animationResult === 'Heads' ? '🪙' : '⭕'}
                        </div>
                        <div class="text-3xl font-bold text-yellow-400 mt-4 animate-fade-in">
                            {animationResult}!
                        </div>
                    {:else}
                        <div class="text-8xl animate-coin-flip">
                            {coinSide === 0 ? '🪙' : '⭕'}
                        </div>
                    {/if}
                </div>
            {:else if animationType === 'd6'}
                <div class="dice-animation mb-4">
                    {#if animationResult}
                        <div class="text-8xl animate-bounce-in">
                            {d6Faces[animationResult - 1]}
                        </div>
                        <div class="text-3xl font-bold text-yellow-400 mt-4 animate-fade-in">
                            {animationResult}!
                        </div>
                    {:else}
                        <div class="text-8xl animate-dice-roll">
                            {d6Faces[currentD6Face]}
                        </div>
                    {/if}
                </div>
            {:else if animationType === 'd20'}
                <div class="d20-animation mb-4">
                    {#if animationResult}
                        <div class="relative">
                            <div class="text-8xl animate-bounce-in">🎯</div>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <span class="text-4xl font-bold text-white drop-shadow-lg">{animationResult}</span>
                            </div>
                        </div>
                        <div class="text-3xl font-bold mt-4 animate-fade-in {animationResult === 20 ? 'text-green-400' : animationResult === 1 ? 'text-red-400' : 'text-yellow-400'}">
                            {animationResult === 20 ? 'CRITICAL!' : animationResult === 1 ? 'CRITICAL FAIL!' : animationResult + '!'}
                        </div>
                    {:else}
                        <div class="relative">
                            <div class="text-8xl animate-d20-roll">🎯</div>
                            <div class="absolute inset-0 flex items-center justify-center">
                                <span class="text-4xl font-bold text-white drop-shadow-lg animate-number-spin">{currentD20Value}</span>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}
