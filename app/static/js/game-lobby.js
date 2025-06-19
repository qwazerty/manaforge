/* Game Lobby JavaScript - Deck import, battle creation, and game listing */

// Global variables
let parsedDeck = null;

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
async function fetchGameList() {
    try {
        const response = await fetch('/api/v1/games/list');
        const games = await response.json();

        const gameListDiv = document.getElementById('game-list');
        gameListDiv.innerHTML = '';

        if (games.length === 0) {
            gameListDiv.innerHTML = '<div class="text-center text-arena-text-dim py-4">No games available</div>';
            return;
        }

        games.forEach((game, index) => {
            const gameCard = document.createElement('div');
            gameCard.className = 'arena-card rounded-lg p-4 mb-3 hover:scale-[1.02] transition-all duration-200 animate-fade-in';
            gameCard.style.animationDelay = `${index * 100}ms`;

            const gameTitle = document.createElement('div');
            gameTitle.className = 'flex items-center justify-between mb-2';
            gameTitle.innerHTML = `
                <h3 class="font-magic text-lg font-bold text-arena-accent">${game.game_id}</h3>
                <span class="text-sm text-arena-text-dim">${game.status}</span>
            `;

            const joinButton = document.createElement('button');
            joinButton.className = 'arena-button mt-2 w-full py-2 px-4 rounded text-sm';
            if (game.status === 'waiting for players') {
                joinButton.innerHTML = 'Join Game';
joinButton.onclick = () => {
    const gameIdInput = document.getElementById('gameId');
    gameIdInput.value = game.game_id;
    gameIdInput.classList.add('animate-pulse-green');
    setTimeout(() => {
        gameIdInput.classList.remove('animate-pulse-green');
    }, 1000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};
            } else {
                joinButton.innerHTML = 'Spectate Game';
                joinButton.onclick = () => {
                    window.location.href = `/game-interface/${game.game_id}?spectator=true`;
                };
            }

            gameCard.appendChild(gameTitle);
            gameCard.appendChild(joinButton);

            gameListDiv.appendChild(gameCard);
        });
    } catch (error) {
        console.error('Error fetching game list:', error);
        const gameListDiv = document.getElementById('game-list');
        gameListDiv.innerHTML = '<div class="text-center text-red-400 py-4">Error loading games</div>';
    }
}

// Initialize page with random game name and fetch game list on load
document.addEventListener('DOMContentLoaded', function() {
    generateRandomGameName();
    fetchGameList();
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

// ===== CORE BATTLE LOGIC =====

// Step 1: Parse decklist
async function parseDeck(decklistText) {
    showStatus('Parsing your deck...');
    const response = await fetch('/api/v1/decks/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist_text: decklistText })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to parse deck: ${error.detail || 'Unknown error'}`);
    }

    parsedDeck = await response.json();
    showDeckPreview(parsedDeck);
    return parsedDeck;
}

// Step 2: Check game and join or create
async function checkAndJoinGame(gameId, decklistText) {
    showStatus('Checking battlefield status...');
    const gameCheckResponse = await fetch(`/api/v1/games/${gameId}/state`);
    let playerRole = 'player1';
    let actionText = 'Creating battlefield as Player 1';
    let apiUrl = `/api/v1/games?game_id=${gameId}`;
    let method = 'POST';

    if (gameCheckResponse.ok) {
        const gameData = await gameCheckResponse.json();
        if (gameData.players && gameData.players.length >= 2) {
            throw new Error('Battlefield is full (2 players already)');
        }
        playerRole = 'player2';
        actionText = 'Joining battlefield as Player 2';
        apiUrl = `/api/v1/games/${gameId}/join`;
    }

    showStatus(actionText + '...');
    const gameResponse = await fetch(apiUrl, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decklist_text: decklistText })
    });

    if (!gameResponse.ok) {
        const error = await gameResponse.json();
        throw new Error(error.detail || 'Failed to join battlefield');
    }

    const gameData = await gameResponse.json();
    if (gameData.players && gameData.players.length < 2) {
        showStatus('Waiting for opponent to join...', 'warning');
        waitForOpponent(gameId, playerRole);
    } else {
        showStatus('Both players ready! Starting the duel...', 'success');
        setTimeout(() => {
            window.location.href = `/game-interface/${gameId}?player=${playerRole}`;
        }, 1500);
    }
}

// Main function for joining or creating battle
async function joinOrCreateBattle() {
    const gameId = document.getElementById('gameId').value.trim();
    const decklistText = document.getElementById('decklistText').value.trim();

    if (!gameId) {
        showStatus('Please enter a battlefield name', 'error');
        return;
    }
    if (!decklistText) {
        showStatus('Please paste your decklist', 'error');
        return;
    }

    setButtonState(true);

    try {
        await parseDeck(decklistText);
        await checkAndJoinGame(gameId, decklistText);
    } catch (error) {
        showStatus(error.message, 'error');
        setButtonState(false);
    }
}

// Show deck preview
function showDeckPreview(deck) {
    const previewDiv = document.getElementById('deck-preview');
    const cardsDiv = document.getElementById('deck-cards');

    cardsDiv.innerHTML = deck.cards.map(deckCard => `
        <div class="flex justify-between items-center p-2 bg-arena-surface/30 rounded">
            <span class="text-arena-text">${deckCard.quantity}x ${deckCard.card.name}</span>
            <span class="text-arena-text-muted text-xs">${deckCard.card.mana_cost || 'No cost'}</span>
        </div>
    `).join('');

    previewDiv.classList.remove('hidden');
}

// Wait for opponent to join
async function waitForOpponent(gameId, playerRole) {
    const statusDiv = document.getElementById('battle-status');
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout

    const checkInterval = setInterval(async () => {
        attempts++;

        try {
            const response = await fetch(`/api/v1/games/${gameId}/state`);
            if (response.ok) {
                const gameData = await response.json();

                if (gameData.players && gameData.players.length >= 2) {
                    clearInterval(checkInterval);

                    statusDiv.innerHTML = `
                        <div class="arena-surface border border-green-500/50 text-green-400 px-4 py-2 rounded-lg mt-2">
                            ⚔️ Opponent joined! Starting the duel...
                        </div>
                    `;

                    setTimeout(() => {
                        window.location.href = `/game-interface/${gameId}?player=${playerRole}`;
                    }, 1500);
                }
            }
        } catch (error) {
            console.error('Error checking game status:', error);
        }

        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            statusDiv.innerHTML = `
                <div class="arena-surface border border-yellow-500/50 text-yellow-400 px-4 py-2 rounded-lg mt-2">
                    ⏰ Timeout waiting for opponent. You can still join manually.
                    <br><a href="/game-interface/${gameId}?player=${playerRole}" class="text-arena-accent underline">Enter battlefield anyway</a>
                </div>
            `;
            // Re-enable the main button when timeout occurs
            setButtonState(false);
        }
    }, 1000);
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
