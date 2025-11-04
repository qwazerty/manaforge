/* Game Lobby JavaScript - game listing and room creation */

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
let gameListPollId = null;
let isFetchingGameList = false;
let lastGameListSnapshot = '';

function formatLobbyTimestamp(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
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

function ensureSelectValue(selectElement, value, labelMap) {
    if (!selectElement) return;
    const normalized = normalizeChoice(value);
    if (!normalized) return;

    const options = Array.from(selectElement.options);
    const existingOption = options.find(
        (option) => normalizeChoice(option.value) === normalized
    );

    if (existingOption) {
        existingOption.selected = true;
        return;
    }

    const newOption = document.createElement('option');
    newOption.value = normalized;
    newOption.textContent = formatChoiceLabel(labelMap, normalized);
    selectElement.appendChild(newOption);
    newOption.selected = true;
}

function syncSelectionsWithSetup(setupStatus) {
    if (!setupStatus) return;
    const formatSelect = document.getElementById('gameFormat');
    const phaseSelect = document.getElementById('phaseMode');

    ensureSelectValue(formatSelect, setupStatus.game_format, GAME_FORMAT_LABELS);
    ensureSelectValue(phaseSelect, setupStatus.phase_mode, PHASE_MODE_LABELS);
}

function determineSeatFromStatus(playerStatus = {}) {
    const player1 = playerStatus.player1 || {};
    const player2 = playerStatus.player2 || {};

    if (!player1.seat_claimed) return 'player1';
    if (!player2.seat_claimed) return 'player2';
    return 'spectator';
}

// Generate random game name
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

    const gameName = `${randomAdjective}-${randomNoun}-${randomNumber}`;
    document.getElementById('gameId').value = gameName;
}

// Fetch and display the list of ongoing and waiting games
async function fetchGameList(force = false) {
    if (isFetchingGameList) return;
    isFetchingGameList = true;

    try {
        const response = await fetch('/api/v1/games/list', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load games');
        const games = await response.json();

        const snapshot = JSON.stringify(games);
        if (!force && snapshot === lastGameListSnapshot) {
            isFetchingGameList = false;
            return;
        }
        lastGameListSnapshot = snapshot;

        const gameListDiv = document.getElementById('game-list');
        gameListDiv.innerHTML = '';

        if (games.length === 0) {
            gameListDiv.innerHTML = '<div class="text-center text-arena-text-dim py-4">No games available</div>';
            return;
        }

        const sortedGames = [...games].sort((a, b) => {
            if ((a.ready && b.ready) || (!a.ready && !b.ready)) return 0;
            return a.ready ? 1 : -1;
        });

        sortedGames.forEach((game, index) => {
            const formatLabel = formatChoiceLabel(GAME_FORMAT_LABELS, game.game_format);
            const phaseLabel = formatChoiceLabel(PHASE_MODE_LABELS, game.phase_mode);
            const submittedCount = typeof game.submitted_count === 'number' ? game.submitted_count : 0;
            const validatedCount = typeof game.validated_count === 'number' ? game.validated_count : 0;
            const seatClaimedCount = typeof game.seat_claimed_count === 'number' ? game.seat_claimed_count : 0;
            const playerStatus = game.player_status || {};
            const encodedId = encodeURIComponent(game.game_id);
            const createdAtLabel = formatLobbyTimestamp(game.created_at);
            const openSeats = ['player1', 'player2'].filter((seat) => {
                const info = playerStatus[seat];
                return !info || !info.seat_claimed;
            });

            const gameCard = document.createElement('div');
            gameCard.className = 'arena-card rounded-lg p-4 mb-3 hover:scale-[1.02] transition-all duration-200 animate-fade-in';
            gameCard.style.animationDelay = `${index * 100}ms`;

            const titleBlock = document.createElement('div');
            titleBlock.className = 'flex items-center justify-between mb-2';
            titleBlock.innerHTML = `
                <div>
                    <h3 class="font-magic text-lg font-bold text-arena-accent">${game.game_id}</h3>
                    <p class="text-xs text-arena-text-muted">${formatLabel} • ${phaseLabel}</p>
                </div>
                <span class="text-sm text-arena-text-dim">${game.ready ? 'Ongoing' : 'Setup'}</span>
            `;

            const statusLine = document.createElement('div');
            statusLine.className = 'text-sm text-arena-text-muted mb-3';
            if (game.ready) {
                statusLine.textContent = `Battle in progress • Turn ${game.turn ?? 1}`;
            } else {
                const seatSummary = `${seatClaimedCount}/2 seats filled`;
                const deckSummary = `${submittedCount}/2 decks submitted`;
                const seatHint = openSeats.length
                    ? `Waiting on ${openSeats.map((seat) => seat.replace('player', 'Player ')).join(' & ')}`
                    : `${validatedCount}/2 decks validated`;
                statusLine.textContent = `${seatSummary} • ${deckSummary} • ${seatHint}`;
            }

            if (createdAtLabel) {
                const creationLine = document.createElement('div');
                creationLine.className = 'text-xs text-arena-text-muted mb-1';
                creationLine.textContent = `Created ${createdAtLabel}`;
                gameCard.appendChild(creationLine);
            }

            const joinButton = document.createElement('button');
            joinButton.className = 'arena-button mt-2 w-full py-2 px-4 rounded text-sm';

            if (game.ready) {
                joinButton.textContent = 'Spectate Game';
                joinButton.onclick = () => {
                    window.location.href = `/game-interface/${encodedId}?spectator=true`;
                };
            } else {
                const seatToJoin = determineSeatFromStatus(playerStatus);
                const buttonLabel = seatToJoin === 'spectator'
                    ? 'View Room'
                    : `Join as ${seatToJoin === 'player1' ? 'Player 1' : 'Player 2'}`;
                joinButton.textContent = buttonLabel;
                joinButton.onclick = () => {
                    window.location.href = `/game-room/${encodedId}?player=${seatToJoin}`;
                };
            }

            gameCard.appendChild(titleBlock);
            gameCard.appendChild(statusLine);
            gameCard.appendChild(joinButton);
            gameListDiv.appendChild(gameCard);
        });
    } catch (error) {
        console.error('Error fetching game list:', error);
        const gameListDiv = document.getElementById('game-list');
        gameListDiv.innerHTML = '<div class="text-center text-red-400 py-4">Error loading games</div>';
    } finally {
        isFetchingGameList = false;
    }
}

function startGameListPolling() {
    if (gameListPollId) clearInterval(gameListPollId);
    gameListPollId = setInterval(() => fetchGameList(), GAME_LIST_REFRESH_MS);
}

// Initialize page with random game name and fetch game list on load
document.addEventListener('DOMContentLoaded', function() {
    generateRandomGameName();
    fetchGameList(true);
    startGameListPolling();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        if (gameListPollId) {
            clearInterval(gameListPollId);
            gameListPollId = null;
        }
    } else {
        fetchGameList(true);
        startGameListPolling();
    }
});

window.addEventListener('beforeunload', () => {
    if (gameListPollId) {
        clearInterval(gameListPollId);
    }
});

// ===== HELPER FUNCTIONS =====

// Set button state to loading or enabled
function setButtonState(isLoading) {
    const battleButton = document.querySelector('button[onclick="joinOrCreateBattle()"]');
    if (!battleButton) return;

    if (isLoading) {
        battleButton.disabled = true;
        battleButton.classList.add('opacity-50', 'cursor-not-allowed');
        battleButton.innerHTML = `
            <span class="mr-3 animate-spin">⚡</span>
            Processing...
            <span class="ml-3 animate-pulse">⏳</span>
        `;
    } else {
        battleButton.disabled = false;
        battleButton.classList.remove('opacity-50', 'cursor-not-allowed');
        battleButton.innerHTML = `
            <span class="mr-3 group-hover:animate-pulse">⚡</span>
            Enter Battlefield
            <span class="ml-3 group-hover:animate-pulse">⚔️</span>
        `;
    }
}

// Display status messages
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('battle-status');
    let colorClasses = 'border-blue-500/50 text-blue-400';
    let icon = '🔍';

    if (type === 'error') {
        colorClasses = 'border-red-500/50 text-red-400';
        icon = '❌';
    } else if (type === 'success') {
        colorClasses = 'border-green-500/50 text-green-400';
        icon = '✨';
    } else if (type === 'warning') {
        colorClasses = 'border-yellow-500/50 text-yellow-400';
        icon = '⏳';
    }

    statusDiv.innerHTML = `
        <div class="arena-surface ${colorClasses} px-4 py-2 rounded-lg mt-2 animate-pulse">
            ${icon} ${message}
        </div>
    `;
}

async function ensureGameRoomExists(gameId, gameFormat, phaseMode) {
    const encodedId = encodeURIComponent(gameId);
    const setupUrl = `/api/v1/games/${encodedId}/setup`;
    const normalizedFormat = normalizeChoice(gameFormat) || 'standard';
    const normalizedPhase = normalizeChoice(phaseMode) || 'casual';

    let response = await fetch(setupUrl);
    if (response.ok) {
        const setup = await response.json();
        return setup;
    }

    if (response.status === 404) {
        response = await fetch(`/api/v1/games?game_id=${encodedId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_format: normalizedFormat,
                phase_mode: normalizedPhase
            })
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.detail || 'Unable to create battlefield');
        }

        const newSetup = await response.json();
        return newSetup;
    }

    throw new Error('Unable to fetch battlefield setup');
}

function determinePlayerRoleFromSetup(setupStatus) {
    const playerInfo = setupStatus.player_status || {};
    const player1 = playerInfo.player1 || { submitted: false, validated: false };
    const player2 = playerInfo.player2 || { submitted: false, validated: false };

    const player1NeedsDeck = !player1.validated;
    const player2NeedsDeck = !player2.validated;

    if (player1NeedsDeck) return 'player1';
    if (player2NeedsDeck) return 'player2';
    return 'spectator';
}

function redirectToGameRoom(gameId, playerRole, setupStatus) {
    const encodedId = encodeURIComponent(gameId);

    if (setupStatus.ready) {
        const interfaceUrl = `/game-interface/${encodedId}`;
        if (playerRole === 'player1' || playerRole === 'player2') {
            window.location.href = `${interfaceUrl}?player=${playerRole}`;
        } else {
            window.location.href = `${interfaceUrl}?spectator=true`;
        }
        return;
    }

    const roleParam = playerRole || 'spectator';
    window.location.href = `/game-room/${encodedId}?player=${roleParam}`;
}

// Main function for joining or creating battle
async function joinOrCreateBattle() {
    const rawGameId = document.getElementById('gameId').value;
    const gameId = rawGameId.trim();
    const formatSelect = document.getElementById('gameFormat');
    const phaseModeSelect = document.getElementById('phaseMode');
    const selectedFormat = normalizeChoice(formatSelect ? formatSelect.value : 'standard') || 'standard';
    const selectedPhaseMode = normalizeChoice(phaseModeSelect ? phaseModeSelect.value : 'casual') || 'casual';

    if (!gameId) {
        showStatus('Please enter a battlefield name', 'error');
        return;
    }

    setButtonState(true);
    showStatus('Preparing battlefield...', 'warning');

    try {
        const setupStatus = await ensureGameRoomExists(gameId, selectedFormat, selectedPhaseMode);
        syncSelectionsWithSetup(setupStatus);

        const actualFormat = normalizeChoice(setupStatus.game_format);
        const actualPhaseMode = normalizeChoice(setupStatus.phase_mode);
        const mismatchMessages = [];

        if (actualFormat && actualFormat !== selectedFormat) {
            mismatchMessages.push(
                `Battlefield already configured for ${formatChoiceLabel(GAME_FORMAT_LABELS, actualFormat)}.`
            );
        }
        if (actualPhaseMode && actualPhaseMode !== selectedPhaseMode) {
            mismatchMessages.push(
                `Phase mode locked to ${formatChoiceLabel(PHASE_MODE_LABELS, actualPhaseMode)}.`
            );
        }

        if (mismatchMessages.length) {
            showStatus(mismatchMessages.join(' '), 'warning');
        }

        const playerRole = determinePlayerRoleFromSetup(setupStatus);

        if (playerRole === 'spectator' && !setupStatus.ready) {
            showStatus('Both seats already reserved for validation. Try another battlefield name.', 'error');
            setButtonState(false);
            return;
        }

        if (playerRole === 'player1' || playerRole === 'player2') {
            showStatus(`Battlefield ready! Redirecting as ${playerRole.toUpperCase()}...`, 'success');
        } else if (setupStatus.ready) {
            showStatus('Battlefield already active. Joining as spectator...', 'success');
        }

        setTimeout(() => {
            redirectToGameRoom(gameId, playerRole, setupStatus);
        }, 600);
    } catch (error) {
        console.error('Error during battlefield preparation:', error);
        showStatus(error.message || 'Failed to prepare battlefield', 'error');
        setButtonState(false);
    }
}

async function searchCards() {
    const query = document.getElementById('searchQuery').value;
    const resultsDiv = document.getElementById('searchResults');

    if (!query) {
        resultsDiv.innerHTML = '<div class="text-center text-arena-text-dim py-4">Please enter a search query</div>';
        return;
    }

    try {
        resultsDiv.innerHTML = `
            <div class="text-center py-8">
                <div class="w-8 h-8 border-2 border-arena-accent/30 border-t-arena-accent rounded-full animate-spin mx-auto mb-2"></div>
                <div class="text-arena-text-dim animate-pulse">Searching the multiverse...</div>
            </div>
        `;

        const response = await fetch(`/api/v1/cards/search?q=${encodeURIComponent(query)}`);
        const cards = await response.json();

        if (cards.length === 0) {
            resultsDiv.innerHTML = `
                <div class="text-center py-8 text-arena-text-dim">
                    <span class="text-4xl mb-4 block">🔍</span>
                    No cards found in the multiverse
                </div>
            `;
            return;
        }

        resultsDiv.innerHTML = cards.map((card, index) => `
            <div class="arena-card rounded-lg p-4 mb-3 hover:scale-[1.02] transition-all duration-200 animate-fade-in" style="animation-delay: ${index * 100}ms;">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <h3 class="font-magic text-lg font-bold text-arena-accent">${card.name}</h3>
                            ${card.mana_cost ? `<span class="text-arena-text-dim">${card.mana_cost}</span>` : ''}
                        </div>
                        <div class="flex items-center space-x-4 mb-2">
                            <span class="text-sm text-arena-text-dim bg-arena-surface-light px-2 py-1 rounded">${card.card_type}</span>
                            <span class="text-sm text-arena-accent">${card.rarity}</span>
                        </div>
                        ${card.text ? `<p class="text-arena-text text-sm leading-relaxed">${card.text}</p>` : ''}
                    </div>
                    <div class="ml-4 flex flex-col items-center space-y-1">
                        ${card.power !== null && card.toughness !== null ?
                            `<div class="bg-arena-accent text-arena-bg px-2 py-1 rounded text-sm font-bold">${card.power}/${card.toughness}</div>` :
                            ''
                        }
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        resultsDiv.innerHTML = `
            <div class="text-center py-8 text-red-400">
                <span class="text-4xl mb-4 block">💥</span>
                Error searching cards: ${error.message}
            </div>
        `;
    }
}

// Enhanced HTMX integration for search results
document.addEventListener('htmx:afterSwap', function(event) {
    if (event.target.id === 'searchResults') {
        // Add staggered animations to cards
        const cards = event.target.querySelectorAll('.arena-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 100}ms`;
            card.classList.add('animate-fade-in');
        });
    }
});
