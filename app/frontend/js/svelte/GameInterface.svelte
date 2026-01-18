<script>
    import { onMount } from 'svelte';
    import { navigate } from '@lib/router';

    // Import all game-related components
    import GameCore from './GameCore.svelte';
    import GameActions from './GameActions.svelte';
    import WebSocketManager from './WebSocketManager.svelte';
    import UIZonesManager from './UIZonesManager.svelte';
    import UIRenderersTemplates from './UIRenderersTemplates.svelte';
    import GameCombat from './GameCombat.svelte';
    import GameCardsModule from './GameCardsModule.svelte';
    import CardManager from './CardManager.svelte';
    import CardContextMenu from './CardContextMenu.svelte';
    import CardPreviewModal from './CardPreviewModal.svelte';
    import CardSearchModal from './CardSearchModal.svelte';
    import BattleChatManager from './BattleChatManager.svelte';

    let { gameId = '' } = $props();

    const isBrowser = typeof window !== 'undefined';

    const getPlayerParam = () => {
        if (!isBrowser) return null;
        const params = new URLSearchParams(window.location.search);
        return params.get('player');
    };

    const resolveGameIdFromPath = () => {
        if (!isBrowser) return '';
        const match = window.location.pathname.match(/^\/game\/([^/]+)\/play$/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    let resolvedGameId = $state('');

    $effect(() => {
        resolvedGameId = gameId || resolveGameIdFromPath();
    });

    const gameConfig = $derived.by(() => (resolvedGameId ? JSON.stringify({ gameId: resolvedGameId }) : ''));

    $effect(() => {
        if (!isBrowser || !resolvedGameId) return;
        const existing = window.gameData && typeof window.gameData === 'object' ? window.gameData : {};
        const playerParam = getPlayerParam();
        window.gameData = {
            ...existing,
            gameId: resolvedGameId,
            playerId: playerParam || existing.playerId || null
        };
    });

    let isLoading = $state(true);
    let error = $state(null);
    let gameState = $state(null);

    // Container refs for mounting
    let gameInterfaceRoot = $state(null);
    let gameCombatRoot = $state(null);
    let gameCardsModuleMount = $state(null);
    let cardManagerRoot = $state(null);

    async function loadGameState() {
        if (!resolvedGameId) {
            error = 'No game ID provided';
            isLoading = false;
            return;
        }

        try {
            const response = await fetch(`/api/v1/games/${resolvedGameId}/state`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    error = 'Game not found';
                } else {
                    const data = await response.json().catch(() => ({}));
                    error = data.detail || `Failed to load game (${response.status})`;
                }
                isLoading = false;
                return;
            }

            gameState = await response.json();
            isLoading = false;
        } catch (err) {
            console.error('[GameInterface] Failed to load game state:', err);
            error = 'Network error. Please check your connection.';
            isLoading = false;
        }
    }

    function handleBackToLobby() {
        navigate('/game');
    }

    onMount(() => {
        loadGameState();
    });
</script>

<svelte:head>
    <title>ManaForge - Game {gameId}</title>
</svelte:head>

{#if isLoading}
    <div class="flex items-center justify-center min-h-screen bg-arena-bg">
        <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gold-500 border-t-transparent"></div>
            <p class="mt-4 text-arena-text text-lg">Loading battlefield...</p>
            <p class="mt-2 text-arena-text-muted text-sm">Game: {resolvedGameId}</p>
        </div>
    </div>
{:else if error}
    <div class="flex items-center justify-center min-h-screen bg-arena-bg">
        <div class="max-w-md mx-auto text-center p-8">
            <div class="text-6xl mb-4">⚠️</div>
            <h1 class="text-2xl font-bold text-red-400 mb-2">Game Error</h1>
            <p class="text-arena-text-muted mb-6">{error}</p>
            <button
                class="arena-button px-6 py-3 rounded-lg font-semibold"
                onclick={handleBackToLobby}
            >
                ← Back to Lobby
            </button>
        </div>
    </div>
{:else}
    <!-- Game Interface Container -->
    <div
        id="game-interface-root"
        class="min-h-screen bg-arena-gradient relative game-container-1080 compact-zones"
        data-game-config={gameConfig}
        bind:this={gameInterfaceRoot}
    >
        <!-- Core Game Components -->
        <GameCore />
        <GameActions />
        <WebSocketManager />
        <UIZonesManager />
        <UIRenderersTemplates />

        <div class="mx-auto px-4 py-3 flex flex-col h-full">
            <!-- Game Control Buttons -->
            <div class="absolute right-4 top-4 flex gap-2 z-20">
                <button
                    id="end-game-btn"
                    title="End Game"
                    class="bg-red-900 hover:bg-red-950 text-white px-3 py-2 rounded-lg shadow transition-colors focus:outline-none"
                    onclick={() => window.GameCore?.endGame?.()}
                >
                    ❌
                </button>
                <button
                    id="restart-game-btn"
                    title="Restart Game"
                    class="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg shadow transition-colors focus:outline-none"
                    onclick={() => window.GameCore?.restartGame?.()}
                >
                    🔄
                </button>
                <button
                    id="export-replay-btn"
                    title="Export Replay"
                    class="bg-arena-accent hover:bg-arena-accent-dark text-black px-3 py-2 rounded-lg shadow transition-colors focus:outline-none"
                    onclick={() => window.GameCore?.exportReplay?.()}
                >
                    💾
                </button>
                <button
                    id="fullscreen-btn"
                    title="Fullscreen"
                    class="bg-arena-accent hover:bg-arena-accent-dark text-black px-3 py-2 rounded-lg shadow transition-colors focus:outline-none"
                    onclick={() => window.GameUI?.toggleFullscreen?.()}
                >
                    🔲
                </button>
            </div>

            <div id="game-arena-root" class="flex-grow"></div>
        </div>

        <div id="game-combat-root" bind:this={gameCombatRoot}>
            <GameCombat />
        </div>

        <BattleChatManager />

        <!-- Cards Module (hidden container) -->
        <div id="game-cards-module-mount" class="hidden" bind:this={gameCardsModuleMount}>
            <GameCardsModule />
        </div>

        <!-- Card Management -->
        <div id="card-manager-root" bind:this={cardManagerRoot}>
            <CardManager />
        </div>
        <CardContextMenu />
        <CardPreviewModal />
        <CardSearchModal />

    </div>
{/if}
