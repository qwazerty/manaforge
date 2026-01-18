<script>
    import { onMount } from 'svelte';
    import { navigate } from '@lib/router';

    const GAME_FORMAT_LABELS = {
        standard: 'Standard',
        modern: 'Modern',
        pioneer: 'Pioneer',
        pauper: 'Pauper',
        legacy: 'Legacy',
        vintage: 'Vintage',
        duel_commander: 'Duel Commander',
        commander_multi: 'Commander Multi'
    };

    const PHASE_MODE_LABELS = {
        casual: 'Casual',
        strict: 'Strict'
    };

    const GAME_LIST_REFRESH_MS = 4000;
    const COMMANDER_MULTI_MIN_PLAYERS = 2;
    const COMMANDER_MULTI_MAX_PLAYERS = 4;

    let games = $state([]);
    let gameId = $state('');
    let selectedFormat = $state('standard');
    let selectedPhaseMode = $state('strict');
    let selectedMaxPlayers = $state(COMMANDER_MULTI_MAX_PLAYERS);
    let isFetchingGameList = $state(false);
    let battleStatus = $state({ message: '', type: '' });
    let isProcessing = $state(false);
    let gameListPollId = $state(null);

    function formatLobbyTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
        });
    }

    function normalizeChoice(value) {
        if (value === undefined || value === null) return '';
        return String(value).trim().toLowerCase().replace(/\s+/g, '_');
    }

    function formatChoiceLabel(labelMap, value) {
        const normalized = normalizeChoice(value);
        if (!normalized) return '';
        if (labelMap[normalized]) return labelMap[normalized];
        return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function formatList(items = []) {
        if (!items || !items.length) return '';
        if (typeof Intl !== 'undefined' && Intl.ListFormat) {
            return new Intl.ListFormat('en', { style: 'short', type: 'conjunction' }).format(items);
        }
        return items.join(' & ');
    }

    function generateRandomGameName() {
        const adjectives = [
            'Epic', 'Mystic', 'Ancient', 'Blazing', 'Shadow', 'Crystal', 'Thunder', 'Frozen',
            'Sacred', 'Dark', 'Golden', 'Silver', 'Crimson', 'Azure', 'Emerald', 'Eternal',
            'Savage', 'Noble', 'Wild', 'Divine', 'Arcane', 'Primal', 'Celestial', 'Infernal'
        ];

        const nouns = [
            'Arena', 'Battlefield', 'Sanctum', 'Citadel', 'Fortress', 'Temple', 'Nexus', 'Realm',
            'Domain', 'Throne', 'Spire', 'Vault', 'Chamber', 'Grove', 'Peak', 'Depths',
            'Gateway', 'Portal', 'Academy', 'Colosseum', 'Duel', 'Clash', 'Conquest', 'Trial'
        ];

        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 999) + 1;

        gameId = `${randomAdjective}-${randomNoun}-${randomNumber}`;
    }

    async function fetchGameList() {
        if (isFetchingGameList) return;
        isFetchingGameList = true;

        try {
            const response = await fetch('/api/v1/games/list', { cache: 'no-store' });
            if (!response.ok) throw new Error('Unable to load games');
            const newGames = await response.json();
            const parseTimestamp = (value) => {
                if (!value) return 0;
                const date = new Date(value);
                return Number.isNaN(date.getTime()) ? 0 : date.getTime();
            };

            // Sort games by most recent update (descending)
            games = [...newGames].sort((a, b) => {
                const aTs = parseTimestamp(a.updated_at ?? a.created_at);
                const bTs = parseTimestamp(b.updated_at ?? b.created_at);
                return bTs - aTs;
            });
        } catch (error) {
            console.error('Error fetching game list:', error);
        } finally {
            isFetchingGameList = false;
        }
    }

    function determineSeatFromStatus(playerStatus = {}) {
        const seats = resolveSeatList(playerStatus);
        for (const seat of seats) {
            if (!playerStatus?.[seat]?.seat_claimed) {
                return seat;
            }
        }
        return 'spectator';
    }

    function determinePlayerRoleFromSetup(setupStatus) {
        const playerInfo = setupStatus?.player_status || {};
        const seats = resolveSeatList(playerInfo, setupStatus?.max_players);

        for (const seat of seats) {
            const status = playerInfo[seat] || { submitted: false, validated: false };
            if (!status.validated) {
                return seat;
            }
        }
        return 'spectator';
    }

    function resolveSeatList(playerStatus = {}, maxPlayers = null) {
        const statusKeys = Object.keys(playerStatus || {}).filter((key) => key.startsWith('player'));
        const numericMax = Number.isFinite(Number(maxPlayers)) ? Number(maxPlayers) : null;
        const seatCount = Math.max(statusKeys.length || 0, numericMax || 2);
        return Array.from({ length: seatCount }, (_, index) => `player${index + 1}`);
    }

    const isSeatRole = (role) => typeof role === 'string' && role.startsWith('player');
    const formatSeatLabel = (seat) => (isSeatRole(seat) ? seat.replace('player', 'Player ') : seat);

    function clampCommanderPlayers(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return COMMANDER_MULTI_MAX_PLAYERS;
        return Math.min(COMMANDER_MULTI_MAX_PLAYERS, Math.max(COMMANDER_MULTI_MIN_PLAYERS, Math.trunc(numeric)));
    }

    async function ensureGameRoomExists(targetGameId, targetFormat, targetPhase, targetMaxPlayers = null) {
        const encodedId = encodeURIComponent(targetGameId);
        const normalizedFormat = normalizeChoice(targetFormat) || 'standard';
        const normalizedPhase = normalizeChoice(targetPhase) || 'strict';
        const normalizedMaxPlayers = Number.isFinite(Number(targetMaxPlayers)) ? Number(targetMaxPlayers) : null;

        const payload = {
            game_format: normalizedFormat,
            phase_mode: normalizedPhase
        };
        if (normalizedFormat === 'commander_multi' && normalizedMaxPlayers) {
            payload.max_players = clampCommanderPlayers(normalizedMaxPlayers);
        }

        let response = await fetch(`/api/v1/games?game_id=${encodedId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return await response.json();
        }

        // Fallback to setup fetch if the create endpoint fails
        response = await fetch(`/api/v1/games/${encodedId}/setup`);
        if (response.ok) {
            return await response.json();
        }

        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.detail || 'Unable to create battlefield');
    }

    function redirectToGameRoom(targetGameId, playerRole, setupStatus) {
        const encodedId = encodeURIComponent(targetGameId);

        if (setupStatus.ready) {
            const interfaceUrl = `/game/${encodedId}/play`;
            if (isSeatRole(playerRole)) {
                navigate(`${interfaceUrl}?player=${playerRole}`);
            } else {
                navigate(`${interfaceUrl}?player=spectator`);
            }
            return;
        }

        const roleParam = playerRole || 'spectator';
        navigate(`/game/${encodedId}?player=${roleParam}`);
    }

    async function joinOrCreateBattle() {
        if (!gameId.trim()) {
            battleStatus = { message: 'Please enter a battlefield name', type: 'error' };
            return;
        }

        isProcessing = true;
        battleStatus = { message: 'Preparing battlefield...', type: 'warning' };

        try {
            const setupStatus = await ensureGameRoomExists(
                gameId,
                selectedFormat,
                selectedPhaseMode,
                selectedFormat === 'commander_multi' ? selectedMaxPlayers : null
            );
            
            // Sync selections (optional, but good for feedback)
            selectedFormat = normalizeChoice(setupStatus.game_format) || selectedFormat;
            selectedPhaseMode = normalizeChoice(setupStatus.phase_mode) || selectedPhaseMode;

            const actualFormat = normalizeChoice(setupStatus.game_format);
            const actualPhaseMode = normalizeChoice(setupStatus.phase_mode);
            const mismatchMessages = [];

            if (actualFormat && actualFormat !== normalizeChoice(selectedFormat)) {
                mismatchMessages.push(
                    `Battlefield already configured for ${formatChoiceLabel(GAME_FORMAT_LABELS, actualFormat)}.`
                );
            }
            if (actualPhaseMode && actualPhaseMode !== normalizeChoice(selectedPhaseMode)) {
                mismatchMessages.push(
                    `Phase mode locked to ${formatChoiceLabel(PHASE_MODE_LABELS, actualPhaseMode)}.`
                );
            }
            if (actualFormat === 'commander_multi' && setupStatus?.max_players) {
                const desiredPlayers = clampCommanderPlayers(selectedMaxPlayers);
                const resolvedPlayers = clampCommanderPlayers(setupStatus.max_players);
                if (Number(setupStatus.max_players) !== desiredPlayers) {
                    mismatchMessages.push(
                        `Commander Multi locked to ${setupStatus.max_players} players.`
                    );
                }
                selectedMaxPlayers = resolvedPlayers;
            }

            if (mismatchMessages.length) {
                battleStatus = { message: mismatchMessages.join(' '), type: 'warning' };
            }

            const playerRole = determinePlayerRoleFromSetup(setupStatus);

            if (playerRole === 'spectator' && !setupStatus.ready) {
                battleStatus = { message: 'All seats already reserved for validation. Try another battlefield name.', type: 'error' };
                isProcessing = false;
                return;
            }

            if (isSeatRole(playerRole)) {
                battleStatus = { message: `Battlefield ready! Redirecting as ${formatSeatLabel(playerRole)}...`, type: 'success' };
            } else if (setupStatus.ready) {
                battleStatus = { message: 'Battlefield already active. Joining as spectator...', type: 'success' };
            }

            setTimeout(() => {
                redirectToGameRoom(gameId, playerRole, setupStatus);
            }, 600);

        } catch (error) {
            console.error('Error during battlefield preparation:', error);
            battleStatus = { message: error.message || 'Failed to prepare battlefield', type: 'error' };
            isProcessing = false;
        }
    }

    function joinGame(game, role = null) {
        const encodedId = encodeURIComponent(game.game_id);
        if (game.ready) {
            navigate(`/game/${encodedId}/play?player=spectator`);
            return;
        }

        const seatToJoin = role || determineSeatFromStatus(game.player_status);
        if (seatToJoin === 'spectator') {
            navigate(`/game/${encodedId}?player=spectator`);
            return;
        }

        navigate(`/game/${encodedId}?player=${seatToJoin}`);
    }

    onMount(() => {
        generateRandomGameName();
        fetchGameList();
        gameListPollId = setInterval(fetchGameList, GAME_LIST_REFRESH_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                if (gameListPollId) {
                    clearInterval(gameListPollId);
                    gameListPollId = null;
                }
            } else {
                fetchGameList();
                gameListPollId = setInterval(fetchGameList, GAME_LIST_REFRESH_MS);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (gameListPollId) clearInterval(gameListPollId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    });
</script>

<div class="py-12 px-4">
    <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12 animate-fade-in">
            <h1 class="font-magic text-4xl md:text-5xl font-bold text-arena-accent mb-4">
                ⚔️ Planeswalker Lobby
            </h1>
            <p class="text-xl text-arena-text-dim">
                Forge new battles or join existing conflicts across the multiverse
            </p>
        </div>

        <!-- Main Arena Card -->
        <div class="arena-card rounded-xl mb-8 animate-slide-up">
            <!-- Play Content -->
            <div class="p-8">
                <div class="text-center mb-6">
                    <div class="w-20 h-20 bg-accent-gradient rounded-full flex items-center justify-center mx-auto mb-4 shadow-arena">
                        <span class="text-4xl">⚔️</span>
                    </div>
                    <h2 class="font-magic text-3xl font-bold text-arena-accent mb-2">Enter Battle Arena</h2>
                    <p class="text-arena-text-dim">Join or create a battlefield automatically. Import your deck and challenge other planeswalkers!</p>
                </div>

                <div class="max-w-2xl mx-auto space-y-6">
                    <!-- Game ID Input -->
                    <div class="relative">
                        <input
                            type="text"
                            bind:value={gameId}
                            placeholder="Enter Battlefield Name..."
                            class="w-full px-6 py-4 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200 text-center text-lg font-semibold"
                        >
                        <div class="absolute right-4 top-1/2 transform -translate-y-1/2 text-arena-accent">
                            🎯
                        </div>
                        <button
                            onclick={generateRandomGameName}
                            class="absolute left-4 top-1/2 transform -translate-y-1/2 text-arena-accent hover:text-arena-accent-light transition-colors"
                            title="Generate random name"
                        >
                            🎲
                        </button>
                    </div>

                    <!-- Game Configuration -->
                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="text-left space-y-2">
                            <label for="gameFormat" class="text-sm font-semibold text-arena-accent uppercase tracking-wide">
                                Game Format
                            </label>
                            <select
                                id="gameFormat"
                                bind:value={selectedFormat}
                                class="w-full px-4 py-3 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200"
                            >
                                {#each Object.entries(GAME_FORMAT_LABELS) as [value, label] (value)}
                                    <option value={value}>{label}</option>
                                {/each}
                            </select>
                            <p class="text-xs text-arena-muted">
                                Commander variants are in preview and may have limited gameplay support.
                            </p>
                        </div>
                        {#if selectedFormat === 'commander_multi'}
                            <div class="text-left space-y-2">
                                <label for="commanderPlayers" class="text-sm font-semibold text-arena-accent uppercase tracking-wide">
                                    Commander Players
                                </label>
                                <select
                                    id="commanderPlayers"
                                    bind:value={selectedMaxPlayers}
                                    class="w-full px-4 py-3 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200"
                                >
                                    {#each [2, 3, 4] as count (count)}
                                        <option value={count}>{count} Players</option>
                                    {/each}
                                </select>
                                <p class="text-xs text-arena-muted">
                                    Choose between 2 and 4 players for Commander Multi.
                                </p>
                            </div>
                        {/if}
                        <div class="text-left space-y-2">
                            <label for="phaseMode" class="text-sm font-semibold text-arena-accent uppercase tracking-wide">
                                Phase Mode
                            </label>
                            <select
                                id="phaseMode"
                                bind:value={selectedPhaseMode}
                                class="w-full px-4 py-3 bg-arena-surface border border-arena-accent/30 rounded-lg text-arena-text focus:border-arena-accent focus:ring-2 focus:ring-arena-accent/20 focus:outline-none transition-all duration-200"
                            >
                                {#each Object.entries(PHASE_MODE_LABELS) as [value, label] (value)}
                                    <option value={value}>{label}</option>
                                {/each}
                            </select>
                            <p class="text-xs text-arena-muted">
                                Casual lets you skip detailed phase confirmations, while Strict follows full turn structure.
                            </p>
                        </div>
                    </div>

                    <!-- Main Action Button -->
                    <button
                        onclick={joinOrCreateBattle}
                        disabled={isProcessing}
                        class="arena-button w-full py-6 px-8 rounded-lg font-semibold text-xl transition-all duration-300 group {isProcessing ? 'opacity-50 cursor-not-allowed' : ''}"
                    >
                        {#if isProcessing}
                            <span class="mr-3 animate-spin">⚡</span>
                            Processing...
                            <span class="ml-3 animate-pulse">⏳</span>
                        {:else}
                            <span class="mr-3 group-hover:animate-pulse">⚡</span>
                            Create Room
                            <span class="ml-3 group-hover:animate-pulse">⚔️</span>
                        {/if}
                    </button>

                    {#if battleStatus.message}
                        <div class="text-center">
                            <div class="arena-surface px-4 py-2 rounded-lg mt-2 animate-pulse
                                {battleStatus.type === 'error' ? 'border-red-500/50 text-red-400' : 
                                 battleStatus.type === 'success' ? 'border-green-500/50 text-green-400' : 
                                 'border-yellow-500/50 text-yellow-400'}">
                                {battleStatus.type === 'error' ? '❌' : 
                                 battleStatus.type === 'success' ? '✨' : '⏳'} 
                                {battleStatus.message}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Game List Section -->
        <div class="arena-card rounded-xl mb-8 animate-slide-up">
            <div class="p-8">
                <div class="text-center mb-6">
                    <div class="w-20 h-20 bg-accent-gradient rounded-full flex items-center justify-center mx-auto mb-4 shadow-arena">
                        <span class="text-4xl">🎮</span>
                    </div>
                    <h2 class="font-magic text-3xl font-bold text-arena-accent mb-2">🌐 Join Ongoing Games</h2>
                    <p class="text-arena-text-dim">Spectate or join games in progress or waiting for players</p>
                </div>

                <div class="p-8 m-8 space-y-4">
                    {#if games.length === 0}
                        <div class="text-center text-arena-text-dim py-4">No games available</div>
                    {:else}
                        {#each games as game (game.game_id)}
                            {@const seats = resolveSeatList(game.player_status, game.max_players)}
                            {@const seatChoice = determineSeatFromStatus(game.player_status)}
                            <div class="arena-card rounded-lg p-4 mb-3 hover:scale-[1.02] transition-all duration-200 animate-fade-in">
                                <div class="flex items-center justify-between mb-2">
                                    <div>
                                        <h3 class="font-magic text-lg font-bold text-arena-accent">{game.game_id}</h3>
                                        <p class="text-xs text-arena-muted">
                                            {formatChoiceLabel(GAME_FORMAT_LABELS, game.game_format)} • {formatChoiceLabel(PHASE_MODE_LABELS, game.phase_mode)}
                                        </p>
                                    </div>
                                    <span class="text-sm text-arena-text-dim">{game.ready ? 'Ongoing' : 'Setup'}</span>
                                </div>

                                <div class="text-sm text-arena-muted mb-3">
                                    {#if game.ready}
                                        Battle in progress • Turn {game.turn ?? 1}
                                    {:else}
                                        {game.seat_claimed_count ?? 0}/{seats.length} seats filled • 
                                        {game.submitted_count ?? 0}/{seats.length} decks submitted • 
                                        {#if (seats.filter(s => !(game.player_status?.[s]?.seat_claimed))).length > 0}
                                            Waiting on {formatList((seats.filter(s => !(game.player_status?.[s]?.seat_claimed))).map(s => s.replace('player', 'Player ')))}
                                        {:else}
                                            {game.validated_count ?? 0}/{seats.length} decks validated
                                        {/if}
                                    {/if}
                                </div>

                                <div class="flex flex-wrap gap-2 text-xs text-arena-text mb-2">
                                    {#each seats as seat (seat)}
                                        <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-arena-surface-light border border-arena-accent/10">
                                            {seat === 'player1' ? '🛡️' : '🎯'}
                                            {#if !game.player_status?.[seat]?.seat_claimed}
                                                Seat Open
                                            {:else}
                                                {game.player_status?.[seat]?.player_name || seat.replace('player', 'Player ')}
                                                {game.player_status?.[seat]?.validated ? '✅' : (game.player_status?.[seat]?.submitted ? '✍️' : '⏳')}
                                            {/if}
                                        </span>
                                    {/each}
                                </div>

                                {#if game.created_at}
                                    <div class="text-xs text-arena-muted mb-1">
                                        Created {formatLobbyTimestamp(game.created_at)}
                                    </div>
                                {/if}
                                {#if game.updated_at || game.created_at}
                                    <div class="text-xs text-arena-muted mb-1">
                                        Last updated {formatLobbyTimestamp(game.updated_at ?? game.created_at)}
                                    </div>
                                {/if}

                                <button
                                    class="arena-button mt-2 w-full py-2 px-4 rounded text-sm"
                                    onclick={() => joinGame(game)}
                                >
                                    {#if game.ready}
                                        Spectate Game
                                    {:else}
                                        {#if seatChoice === 'spectator'}
                                            View Room
                                        {:else}
                                            Join as {seatChoice.replace('player', 'Player ')}
                                        {/if}
                                    {/if}
                                </button>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
