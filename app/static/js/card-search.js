/**
 * Card Search with Autocomplete
 * Simple Scryfall search with live suggestions
 */

class CardSearchModal {
    constructor() {
        this.modal = null;
        this.isOpen = false;
        this.searchTimeout = null;
        this.currentResults = [];
        this.targetZone = 'hand';
        this.selectedIndex = -1;
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.submitHandler = null;
    }

    /**
     * Show the card search modal
     */
    show(targetZone = 'hand') {
        this.targetZone = targetZone;
        this.createModal();
        this.isOpen = true;
        
        // Focus on search input
        setTimeout(() => {
            const searchInput = this.modal.querySelector('#card-search-input');
            if (searchInput) {
                searchInput.focus();
            }
        }, 100);
    }

    /**
     * Hide the card search modal
     */
    hide() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.modal = null;
        this.isOpen = false;
        this.currentResults = [];
        this.selectedIndex = -1;
        document.removeEventListener('keydown', this.boundHandleKeydown);
    }

    /**
     * Create the search modal HTML
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        this.modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <!-- Header -->
                <div class="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 class="text-xl font-bold text-white">
                        🔍 Add to <span class="text-blue-400">${this.getZoneDisplayName(this.targetZone)}</span>
                    </h2>
                    <button id="close-search-modal" class="text-gray-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <!-- Search Input with Token Option -->
                <div class="p-4">
                    <div class="relative mb-3">
                        <input 
                            id="card-search-input" 
                            type="text" 
                            placeholder="Type a card name (e.g., Bir → Birds of Paradise, Light → Lightning Bolt...)"
                            class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                            autocomplete="off"
                        >
                        <div id="search-loading" class="hidden absolute right-3 top-3">
                            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                    </div>
                    
                    <!-- Token Checkbox -->
                    <div class="flex items-center">
                        <input 
                            id="token-checkbox" 
                            type="checkbox" 
                            class="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                        >
                        <label for="token-checkbox" class="ml-2 text-sm text-gray-300">
                            Tokens only
                        </label>
                    </div>
                </div>

                <!-- Live Search Results -->
                <div class="overflow-y-auto max-h-[70vh] px-4 pb-4">
                    <div id="search-results">
                        <div class="text-center text-gray-400 py-16">
                            <svg class="w-20 h-20 mx-auto mb-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <p class="text-xl mb-2">Start typing to see suggestions</p>
                            <p class="text-gray-500">A few letters are enough: "Bir" finds "Birds of Paradise"</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for the modal
     */
    setupEventListeners() {
        // Close modal
        const closeBtn = this.modal.querySelector('#close-search-modal');
        closeBtn.addEventListener('click', () => this.hide());

        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Close on escape key, navigation with arrows
        document.addEventListener('keydown', this.boundHandleKeydown);

        // Search input with live autocomplete
        const searchInput = this.modal.querySelector('#card-search-input');
        searchInput.addEventListener('input', this.handleSearchInput.bind(this));
        
        // Token checkbox - re-run search when it changes
        const tokenCheckbox = this.modal.querySelector('#token-checkbox');
        tokenCheckbox.addEventListener('change', () => {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                this.searchCards(query);
            }
        });
    }

    /**
     * Handle keyboard navigation and shortcuts
     */
    handleKeydown(e) {
        if (!this.isOpen) return;

        if (e.key === 'Escape') {
            this.hide();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedIndex >= 0 && this.currentResults[this.selectedIndex]) {
                this.addCardToGame(this.currentResults[this.selectedIndex]);
            }
        }
    }

    /**
     * Handle search input changes with real-time feedback
     */
    handleSearchInput(e) {
        const query = e.target.value.trim();
        this.selectedIndex = -1;

        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Show loading indicator
        const loadingEl = this.modal.querySelector('#search-loading');
        const resultsContainer = this.modal.querySelector('#search-results');

        if (query.length === 0) {
            loadingEl.classList.add('hidden');
            resultsContainer.innerHTML = `
                <div class="text-center text-gray-400 py-16">
                    <svg class="w-20 h-20 mx-auto mb-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <p class="text-xl mb-2">Start typing to see suggestions</p>
                </div>
            `;
            return;
        }

        if (query.length < 2) {
            resultsContainer.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <p class="text-lg">Keep typing...</p>
                    <p class="text-sm text-gray-500 mt-2">At least 2 characters required</p>
                </div>
            `;
            return;
        }

        // Show loading
        loadingEl.classList.remove('hidden');

        // Debounce search for better UX
        this.searchTimeout = setTimeout(() => {
            this.searchCards(query);
        }, 200);
    }

    /**
     * Search for cards via API
     */
    async searchCards(query) {
        if (!this.modal) return;
        const loadingEl = this.modal.querySelector('#search-loading');
        const isTokenOnly = this.modal.querySelector('#token-checkbox').checked;
        
        try {
            let searchUrl = `/api/v1/cards/search?q=${encodeURIComponent(query)}&limit=20`;
            if (isTokenOnly) {
                searchUrl += '&type=token';
            }
            
            const response = await fetch(searchUrl);
            if (!response.ok) {
                throw new Error('Search failed');
            }
            
            const cards = await response.json();
            this.currentResults = cards;
            this.displayResults(cards, query);
        } catch (error) {
            console.error('Search error:', error);
            this.displayError('Error during the search');
        } finally {
            loadingEl.classList.add('hidden');
        }
    }

    /**
     * Display search results as a list
     */
    displayResults(cards, query) {
        if (!this.modal) return;
        const resultsContainer = this.modal.querySelector('#search-results');
        
        if (cards.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg class="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.837 0-5.374-1.194-7.172-3.109M15 11.25L8.75 4.5a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75H15z"/>
                    </svg>
                    <p class="text-lg mb-2">No cards found</p>
                    <p class="text-sm text-gray-500">Try different keywords for "${query}"</p>
                </div>
            `;
            return;
        }

        const cardsList = cards.map((card, index) => {
            return `
                <div class="card-result-item cursor-pointer transition-all hover:scale-105 border-2 border-transparent ${index === this.selectedIndex ? 'border-blue-400 scale-105' : ''}" 
                     data-index="${index}">
                    
                    <!-- Card Image Only -->
                    <div class="w-40 h-56 rounded-lg bg-gray-600 overflow-hidden shadow-lg">
                        ${card.image_url ? `
                            <img src="${card.image_url}" alt="${card.name}" class="w-full h-full object-cover hover:opacity-90 transition-opacity">
                        ` : `
                            <div class="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-700 p-4">
                                <svg class="w-12 h-12 mb-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                                </svg>
                                <div class="text-xs text-center font-semibold text-white">${card.name}</div>
                                <div class="text-xs text-center mt-1">${card.mana_cost || ''}</div>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = `
            <div>
                <div class="text-sm text-gray-400 mb-4 flex items-center justify-between">
                    <span>💡 ${cards.length} result${cards.length > 1 ? 's' : ''} for "${query}"</span>
                    <span class="text-xs">Click a card to add it</span>
                </div>
                <div class="grid grid-cols-4 gap-4">
                    ${cardsList}
                </div>
            </div>
        `;

        // Add click handlers to results
        resultsContainer.querySelectorAll('.card-result-item').forEach(result => {
            result.addEventListener('click', (e) => {
                const cardIndex = parseInt(e.currentTarget.dataset.index, 10);
                if (!Number.isNaN(cardIndex) && this.currentResults[cardIndex]) {
                    this.addCardToGame(this.currentResults[cardIndex]);
                } else {
                    console.warn('Invalid card index from search results', cardIndex);
                }
            });
        });
    }

    /**
     * Update visual selection
     */
    updateSelection() {
        const results = this.modal.querySelectorAll('.card-result-item');
        results.forEach((result, index) => {
            if (index === this.selectedIndex) {
                result.className = result.className.replace('border-transparent', 'border-blue-400');
                result.classList.add('bg-blue-600');
                result.scrollIntoView({ block: 'nearest' });
            } else {
                result.className = result.className.replace('border-blue-400', 'border-transparent');
                result.classList.remove('bg-blue-600');
            }
        });
    }

    /**
     * Get color class for mana colors
     */
    getColorClass(colors) {
        if (!colors) return 'bg-gray-500 text-gray-100';
        
        const colorMap = {
            'W': 'bg-yellow-200 text-gray-800',
            'U': 'bg-blue-500 text-white',
            'B': 'bg-gray-800 text-white',
            'R': 'bg-red-500 text-white',
            'G': 'bg-green-500 text-white'
        };
        
        if (colors.length === 1) {
            return colorMap[colors] || 'bg-gray-500 text-gray-100';
        }
        
        return 'bg-gradient-to-r from-yellow-400 to-red-500 text-white'; // Multicolor
    }

    /**
     * Display error message
     */
    displayError(message) {
        if (!this.modal) return;
        const resultsContainer = this.modal.querySelector('#search-results');
        resultsContainer.innerHTML = `
            <div class="text-center text-red-400 py-8">
                <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="text-lg">${message}</p>
                <p class="text-sm text-gray-500 mt-2">Check your connection and try again</p>
            </div>
        `;
    }

    /**
     * Add selected card to the game
     */
    async addCardToGame(card) {
        if (typeof this.submitHandler === 'function') {
            try {
                const result = this.submitHandler(card);
                if (result && typeof result.then === 'function') {
                    const resolved = await result;
                    if (resolved === false) {
                        return;
                    }
                } else if (result === false) {
                    return;
                }
                this.hide();
            } catch (error) {
                console.error('Custom submit handler failed', error);
            }
            return;
        }

        if (!window.gameData || !window.gameData.gameId) {
            console.error('No game data available');
            return;
        }

        const playerId = window.GameCore?.getSelectedPlayer?.();
        const isToken = this.modal.querySelector('#token-checkbox').checked;

        try {
            let actionData;
            
            if (isToken) {
                // Create as token
                actionData = {
                    action_type: 'create_token',
                    player_id: playerId,
                    scryfall_id: card.scryfall_id,
                };
            } else {
                // Add as regular card
                actionData = {
                    action_type: 'search_and_add_card',
                    player_id: playerId,
                    card_name: card.name,
                    target_zone: this.targetZone
                };
            }

            const response = await fetch(`/api/v1/games/${window.gameData.gameId}/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(actionData)
            });

            if (response.ok) {
                // Show success notification
                if (typeof UINotifications !== 'undefined') {
                    const tokenText = isToken ? ' (token)' : '';
                    const zoneName = isToken ? 'le champ de bataille' : this.getZoneDisplayName(this.targetZone);
                    UINotifications.showNotification(
                        `✅ ${card.name}${tokenText} added to ${zoneName}`,
                        'success'
                    );
                }
                this.hide();
            } else {
                throw new Error('Failed to add card');
            }
        } catch (error) {
            console.error('Error adding card:', error);
            if (typeof UINotifications !== 'undefined') {
                UINotifications.showNotification('❌ Error adding the card', 'error');
            }
        }
    }

    /**
     * Get display name for zone
     */
    getZoneDisplayName(zone) {
        const zoneNames = {
            'hand': 'the hand',
            'battlefield': 'the battlefield',
            'graveyard': 'the graveyard',
            'exile': 'the exile',
            'library': 'the library'
        };
        return zoneNames[zone] || zone;
    }

    /**
     * Allow other modules to override submit behavior.
     */
    setSubmitHandler(handler) {
        if (typeof handler === 'function' || handler === null) {
            this.submitHandler = handler;
        } else {
            console.warn('CardSearchModal submit handler must be a function or null');
        }
    }
}

// Global instance
window.CardSearchModal = new CardSearchModal();

// Global functions for easy access
window.showCardSearch = (targetZone = 'hand') => {
    window.CardSearchModal.show(targetZone);
};

window.hideCardSearch = () => {
    window.CardSearchModal.hide();
};
