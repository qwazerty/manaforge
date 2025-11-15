/**
 * ManaForge Deck Manager
 * Client-side deck builder with layout, stats, and import/export features.
 */
(function() {
    const STORAGE_KEY = 'manaforge:deck-manager:v1';
    const PENDING_IMPORT_KEY = 'manaforge:deck-manager:pending-import';
    const COMMANDER_FORMATS = new Set(['duel_commander', 'commander_multi']);
    const COLUMN_CONFIG = [
        { key: 'commander', label: 'Commander', icon: '👑', description: 'Command zone slot' },
        { key: 'cmc1', label: '1 CMC', icon: '', description: '0-1 mana value' },
        { key: 'cmc2', label: '2 CMC', icon: '', description: 'Two mana value' },
        { key: 'cmc3', label: '3 CMC', icon: '', description: 'Three mana value' },
        { key: 'cmc4', label: '4 CMC', icon: '', description: 'Four mana value' },
        { key: 'cmc5', label: '5 CMC', icon: '', description: 'Five mana value' },
        { key: 'cmc6plus', label: '6+ CMC', icon: '', description: 'Six or more mana value' },
        { key: 'lands', label: 'Lands', icon: '🌍', description: 'Mana base' },
        { key: 'sideboard', label: 'Sideboard', icon: '🧰', description: 'Sideboard' }
    ];
    const TYPE_LABELS = {
        creature: 'Creatures',
        instant: 'Instants',
        sorcery: 'Sorceries',
        enchantment: 'Enchantments',
        artifact: 'Artifacts',
        planeswalker: 'Planeswalkers',
        land: 'Lands'
    };
    const COLOR_NAMES = {
        W: 'White',
        U: 'Blue',
        B: 'Black',
        R: 'Red',
        G: 'Green',
        C: 'Colorless'
    };
    const COLOR_CLASSES = {
        W: 'bg-yellow-200 text-gray-900',
        U: 'bg-blue-500 text-white',
        B: 'bg-gray-800 text-white',
        R: 'bg-red-500 text-white',
        G: 'bg-green-500 text-white',
        C: 'bg-gray-500 text-white'
    };
    const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'C'];
    const MAIN_COLUMNS_BASE = ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands'];
    const READY_EVENT_NAME = 'manaforge:deck-manager-ready';
    const BASIC_LAND_PRESETS = Object.freeze({
        plains: Object.freeze({
            id: '4069fb4a-8ee1-41ef-ab93-39a8cc58e0e5',
            oracle_id: 'bc71ebf6-2056-41f7-be35-b2e5c34afa99',
            name: 'Plains',
            card_type: 'land',
            type_line: 'Basic Land — Plains',
            mana_cost: '',
            cmc: 0,
            oracle_text: '({T}: Add {W}.)',
            text: '({T}: Add {W}.)',
            colors: [],
            color_identity: ['W'],
            produced_mana: ['W'],
            rarity: 'common',
            set: 'tla',
            collector_number: '282',
            image_url: 'https://cards.scryfall.io/normal/front/4/0/4069fb4a-8ee1-41ef-ab93-39a8cc58e0e5.jpg?1755290075',
            scryfall_uri: 'https://scryfall.com/card/tla/282/plains?utm_source=api'
        }),
        island: Object.freeze({
            id: 'a2e22347-f0cb-4cfd-88a3-4f46a16e4946',
            oracle_id: 'b2c6aa39-2d2a-459c-a555-fb48ba993373',
            name: 'Island',
            card_type: 'land',
            type_line: 'Basic Land — Island',
            mana_cost: '',
            cmc: 0,
            oracle_text: '({T}: Add {U}.)',
            text: '({T}: Add {U}.)',
            colors: [],
            color_identity: ['U'],
            produced_mana: ['U'],
            rarity: 'common',
            set: 'tla',
            collector_number: '283',
            image_url: 'https://cards.scryfall.io/normal/front/a/2/a2e22347-f0cb-4cfd-88a3-4f46a16e4946.jpg?1755290097',
            scryfall_uri: 'https://scryfall.com/card/tla/283/island?utm_source=api'
        }),
        swamp: Object.freeze({
            id: 'f0b234d8-d6bb-48ec-8a4d-d8a570a69c62',
            oracle_id: '56719f6a-1a6c-4c0a-8d21-18f7d7350b68',
            name: 'Swamp',
            card_type: 'land',
            type_line: 'Basic Land — Swamp',
            mana_cost: '',
            cmc: 0,
            oracle_text: '({T}: Add {B}.)',
            text: '({T}: Add {B}.)',
            colors: [],
            color_identity: ['B'],
            produced_mana: ['B'],
            rarity: 'common',
            set: 'tla',
            collector_number: '284',
            image_url: 'https://cards.scryfall.io/normal/front/f/0/f0b234d8-d6bb-48ec-8a4d-d8a570a69c62.jpg?1755290113',
            scryfall_uri: 'https://scryfall.com/card/tla/284/swamp?utm_source=api'
        }),
        mountain: Object.freeze({
            id: 'c44f81ca-f72f-445c-8901-3a894a2a47f9',
            oracle_id: 'a3fb7228-e76b-4e96-a40e-20b5fed75685',
            name: 'Mountain',
            card_type: 'land',
            type_line: 'Basic Land — Mountain',
            mana_cost: '',
            cmc: 0,
            oracle_text: '({T}: Add {R}.)',
            text: '({T}: Add {R}.)',
            colors: [],
            color_identity: ['R'],
            produced_mana: ['R'],
            rarity: 'common',
            set: 'tla',
            collector_number: '285',
            image_url: 'https://cards.scryfall.io/normal/front/c/4/c44f81ca-f72f-445c-8901-3a894a2a47f9.jpg?1755290125',
            scryfall_uri: 'https://scryfall.com/card/tla/285/mountain?utm_source=api'
        }),
        forest: Object.freeze({
            id: 'a305e44f-4253-4754-b83f-1e34103d77b0',
            oracle_id: 'b34bb2dc-c1af-4d77-b0b3-a0fb342a5fc6',
            name: 'Forest',
            card_type: 'land',
            type_line: 'Basic Land — Forest',
            mana_cost: '',
            cmc: 0,
            oracle_text: '({T}: Add {G}.)',
            text: '({T}: Add {G}.)',
            colors: [],
            color_identity: ['G'],
            produced_mana: ['G'],
            rarity: 'common',
            set: 'tla',
            collector_number: '286',
            image_url: 'https://cards.scryfall.io/normal/front/a/3/a305e44f-4253-4754-b83f-1e34103d77b0.jpg?1755290142',
            scryfall_uri: 'https://scryfall.com/card/tla/286/forest?utm_source=api'
        }),
        wastes: Object.freeze({
            id: 'baf8f4f2-9f25-4cd2-8d78-1041e134aeac',
            oracle_id: '05d24b0c-904a-46b6-b42a-96a4d91a0dd4',
            name: 'Wastes',
            card_type: 'land',
            type_line: 'Basic Land — Wastes',
            mana_cost: '',
            cmc: 0,
            oracle_text: '({T}: Add {C}.)',
            text: '({T}: Add {C}.)',
            colors: [],
            color_identity: [],
            produced_mana: ['C'],
            rarity: 'common',
            set: 'eoc',
            collector_number: '191',
            image_url: 'https://cards.scryfall.io/normal/front/b/a/baf8f4f2-9f25-4cd2-8d78-1041e134aeac.jpg?1752945584',
            scryfall_uri: 'https://scryfall.com/card/eoc/191/wastes?utm_source=api'
        })
    });

    const DeckManager = {
        state: null,
        currentDeckId: null,
        elements: {},
        draggedEntryId: null,
        activeDropColumn: null,
        saveTimeout: null,
        forceFreshState: false,
        externalContext: null,
        readyEventName: READY_EVENT_NAME,
        isReady: false,

        init() {
            this.cacheElements();
            this.externalContext = window.MANAFORGE_DECK_CONTEXT || null;
            const deckIdFromUrl = this.getDeckIdFromUrl();
            this.currentDeckId = (this.externalContext && this.externalContext.deckId) || deckIdFromUrl;
            if (this.externalContext && this.externalContext.startFresh) {
                this.forceFreshState = true;
            }
            if (this.shouldStartFreshSession()) {
                this.forceFreshState = true;
                this.currentDeckId = null;
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch (error) {
                    console.warn('Unable to reset deck manager storage', error);
                }
                this.stripFreshSessionFlag();
            }
            if (!this.elements.columnsContainer) {
                return;
            }
            this.loadState();
            this.applyPendingImport();
            this.bindEvents();
            this.bindCardSearch();
            this.render();

            if (window.GameCards && typeof GameCards.initializeHoverPreview === 'function') {
                GameCards.initializeHoverPreview();
            }

            this.isReady = true;
            this.dispatchReadyEvent();
        },

        cacheElements() {
            this.elements = {
                deckNameInput: document.getElementById('deck-name-input'),
                formatSelect: document.getElementById('deck-format-select'),
                mainDeckCount: document.getElementById('deck-main-count'),
                sideboardCount: document.getElementById('deck-sideboard-count'),
                colorChips: document.getElementById('deck-color-chips'),
                typeBreakdown: document.getElementById('deck-type-breakdown'),
                manaCurveBars: document.getElementById('deck-mana-curve-bars'),
                manaCurveLabels: document.getElementById('deck-mana-curve-labels'),
                columnsContainer: document.getElementById('deck-columns'),
                importTextarea: document.getElementById('deck-import-text'),
                importUrlInput: document.getElementById('deck-import-url'),
                importStatus: document.getElementById('deck-import-status'),
                importSection: document.getElementById('deck-import-section'),
                searchButtons: Array.from(document.querySelectorAll('[data-deck-search]')),
                exportButtons: [
                    document.getElementById('deck-export-button'),
                    document.getElementById('deck-export-button-secondary')
                ],
                parseButton: document.getElementById('deck-parse-button'),
                importUrlButton: document.getElementById('deck-import-url-button'),
                basicLandsToggle: document.getElementById('deck-basic-lands-toggle'),
                basicLandsPanel: document.getElementById('deck-basic-lands-panel'),
                basicLandsClose: document.getElementById('deck-basic-lands-close'),
                basicLandButtons: Array.from(document.querySelectorAll('[data-basic-land-add]'))
            };
        },

        getDeckIdFromUrl() {
            try {
                const params = new URLSearchParams(window.location.search);
                return params.get('deckId');
            } catch (error) {
                console.warn('Unable to parse deck id from URL', error);
                return null;
            }
        },

        shouldStartFreshSession() {
            try {
                const params = new URLSearchParams(window.location.search);
                return params.has('new');
            } catch (error) {
                console.warn('Unable to determine new deck flag', error);
                return false;
            }
        },

        stripFreshSessionFlag() {
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has('new')) {
                    url.searchParams.delete('new');
                    window.history.replaceState({}, '', url.toString());
                }
            } catch (error) {
                console.warn('Unable to strip new deck flag from URL', error);
            }
        },

        bindEvents() {
            if (this.elements.deckNameInput) {
                this.elements.deckNameInput.addEventListener('input', (event) => {
                    this.state.deckName = event.target.value;
                    this.queueSave();
                });
            }

            if (this.elements.formatSelect) {
                this.elements.formatSelect.addEventListener('change', (event) => {
                    const nextFormat = (event.target.value || '').toLowerCase();
                    this.state.format = nextFormat;
                    this.render();
                    this.queueSave();
                });
            }

            if (this.elements.columnsContainer) {
                this.elements.columnsContainer.addEventListener('dragstart', (event) => this.handleDragStart(event));
                this.elements.columnsContainer.addEventListener('dragend', () => this.clearDragState());
                this.elements.columnsContainer.addEventListener('dragover', (event) => this.handleDragOver(event));
                this.elements.columnsContainer.addEventListener('dragleave', (event) => this.handleDragLeave(event));
                this.elements.columnsContainer.addEventListener('drop', (event) => this.handleDrop(event));
                this.elements.columnsContainer.addEventListener('click', (event) => this.handleEntryAction(event));
            }

            if (Array.isArray(this.elements.searchButtons)) {
                this.elements.searchButtons.forEach((button) => {
                    if (!button) return;
                    button.addEventListener('click', () => {
                        if (window.CardSearchModal) {
                            window.CardSearchModal.show('hand');
                        }
                    });
                });
            }

            if (Array.isArray(this.elements.exportButtons)) {
                this.elements.exportButtons.forEach((button) => {
                    if (!button) return;
                    button.addEventListener('click', () => this.exportDecklist());
                });
            }

            if (this.elements.parseButton) {
                this.elements.parseButton.addEventListener('click', () => this.importFromText());
            }

            if (this.elements.importUrlButton) {
                this.elements.importUrlButton.addEventListener('click', () => this.importFromUrl());
            }

            if (this.elements.basicLandsToggle) {
                this.elements.basicLandsToggle.addEventListener('click', () => this.toggleBasicLandsPanel());
            }

            if (this.elements.basicLandsClose) {
                this.elements.basicLandsClose.addEventListener('click', () => this.toggleBasicLandsPanel(false));
            }

            if (Array.isArray(this.elements.basicLandButtons)) {
                this.elements.basicLandButtons.forEach((button) => {
                    if (!button) return;
                    button.addEventListener('click', (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        this.handleBasicLandButtonClick(button);
                    });
                });
            }

        },

        bindCardSearch() {
            if (!window.CardSearchModal || typeof window.CardSearchModal.setSubmitHandler !== 'function') {
                return;
            }

            window.CardSearchModal.setSubmitHandler((card) => {
                this.addCard(card);
            });
        },

        getDefaultState() {
            const columns = {};
            COLUMN_CONFIG.forEach((column) => {
                columns[column.key] = [];
            });
            return {
                deckName: 'Untitled Deck',
                format: 'modern',
                entries: {},
                columns
            };
        },

        loadState() {
            let nextState = null;
            const hasExternalDeckId = Boolean(this.externalContext && this.externalContext.deckId);
            if (!this.forceFreshState && this.currentDeckId && window.DeckLibrary) {
                const savedDeck = window.DeckLibrary.get(this.currentDeckId);
                if (savedDeck && savedDeck.state) {
                    nextState = this.cloneState(savedDeck.state);
                    nextState.deckName = savedDeck.name || nextState.deckName;
                    nextState.format = savedDeck.format || nextState.format;
                } else if (hasExternalDeckId) {
                    nextState = this.getDefaultState();
                } else {
                    this.resetDeckIdentity();
                }
            }

            if (!nextState && !this.forceFreshState) {
                try {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed && typeof parsed === 'object' && parsed.state) {
                            nextState = this.cloneState(parsed.state);
                            if (!this.currentDeckId && parsed.deckId) {
                                this.currentDeckId = parsed.deckId;
                            }
                        } else if (parsed) {
                            nextState = this.cloneState(parsed);
                        }
                    }
                } catch (error) {
                    console.warn('Unable to load stored deck state', error);
                }
            }

            if (!nextState) {
                nextState = this.getDefaultState();
            }

            this.state = nextState;
            this.applyContextDefaults();
            this.ensureColumns();
            const hadDeckId = Boolean(this.currentDeckId);
            this.ensureDeckIdentity();
            if (!hadDeckId) {
                this.saveState();
            } else {
                this.syncLibraryState();
            }
            this.forceFreshState = false;
        },

        applyPendingImport() {
            try {
                const pendingRaw = localStorage.getItem(PENDING_IMPORT_KEY);
                if (!pendingRaw) {
                    return;
                }
                localStorage.removeItem(PENDING_IMPORT_KEY);
                const payload = JSON.parse(pendingRaw);
                if (payload && payload.deck) {
                    this.loadDeckPayload(payload.deck);
                    const statusMessage = payload.message || 'Deck imported from draft.';
                    this.setImportStatus(statusMessage, 'success');
                }
            } catch (error) {
                console.warn('Unable to apply pending import', error);
                this.setImportStatus('Unable to load draft deck import.', 'error');
            }
        },

        applyContextDefaults() {
            if (!this.externalContext || !this.state) {
                return;
            }
            const { deckName, format, forceDeckName, forceDeckFormat } = this.externalContext;
            if (deckName && (forceDeckName || !this.state.deckName || this.state.deckName === 'Untitled Deck')) {
                this.state.deckName = deckName;
            }
            if (format && (forceDeckFormat || !this.state.format)) {
                this.state.format = format;
            }
        },

        ensureColumns() {
            if (!this.state) {
                this.state = this.getDefaultState();
                return;
            }
            if (!this.state.columns) {
                this.state.columns = {};
            }
            COLUMN_CONFIG.forEach((column) => {
                if (!Array.isArray(this.state.columns[column.key])) {
                    this.state.columns[column.key] = [];
                }
            });
            if (typeof this.state.entries !== 'object' || this.state.entries === null) {
                this.state.entries = {};
            }
        },

        queueSave() {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            this.saveTimeout = setTimeout(() => this.saveState(), 500);
        },

        saveState() {
            if (!this.state) return;
            this.ensureDeckIdentity();
            try {
                const payload = {
                    deckId: this.currentDeckId,
                    state: this.cloneState(this.state)
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
                this.syncLibraryState();
            } catch (error) {
                console.warn('Unable to persist deck state', error);
            }
        },

        render() {
            if (!this.state) return;
            this.updateInputs();
            this.renderColumns();
            this.renderStats();
            this.updateImportVisibility();
        },

        toggleBasicLandsPanel(forceOpen = null) {
            const panel = this.elements.basicLandsPanel;
            const toggle = this.elements.basicLandsToggle;
            if (!panel) return;
            const isHidden = panel.classList.contains('hidden');
            const shouldOpen = forceOpen === null ? isHidden : Boolean(forceOpen);
            if (shouldOpen) {
                panel.classList.remove('hidden');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'true');
                }
            } else {
                panel.classList.add('hidden');
                if (toggle) {
                    toggle.setAttribute('aria-expanded', 'false');
                }
            }
        },

        handleBasicLandButtonClick(button) {
            if (!button) return;
            const landKey = button.getAttribute('data-basic-land-add');
            if (!landKey) return;
            this.addBasicLand(landKey, 1);
            const landName = (BASIC_LAND_PRESETS[landKey] && BASIC_LAND_PRESETS[landKey].name) || 'Basic land';
            this.setImportStatus(`${landName} added to your deck.`, 'success');
        },

        updateInputs() {
            if (this.elements.deckNameInput && document.activeElement !== this.elements.deckNameInput) {
                this.elements.deckNameInput.value = this.state.deckName || '';
            }
            if (this.elements.formatSelect) {
                const current = this.elements.formatSelect.value;
                if (current !== this.state.format) {
                    this.elements.formatSelect.value = this.state.format;
                }
            }
        },

        renderColumns() {
            const container = this.elements.columnsContainer;
            if (!container) return;
            container.innerHTML = '';
            const showCommander = this.shouldShowCommanderColumn();

            COLUMN_CONFIG.forEach((column) => {
                const entries = this.getColumnEntries(column.key);
                const columnEl = document.createElement('div');
                columnEl.dataset.columnKey = column.key;
                columnEl.className = [
                    'deck-column',
                    'flex',
                    'flex-col',
                    'gap-3'
                ].join(' ');

                if (column.key === 'commander' && !showCommander && entries.length === 0) {
                    columnEl.classList.add('hidden');
                }

                const columnCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);
                columnEl.innerHTML = `
                    <div class="deck-column-header flex items-center justify-between">
                        <div>
                            <p>${column.icon} ${column.label}</p>
                            <p>${columnCount} cards</p>
                        </div>
                    </div>
                    <div class="flex-1 deck-column-stack" data-card-list></div>
                `;

                const listEl = columnEl.querySelector('[data-card-list]');
                if (!entries.length) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'text-center text-xs text-arena-muted border border-dashed border-arena-accent/30 rounded-lg py-6';
                    placeholder.textContent = 'Drop cards here';
                    listEl.appendChild(placeholder);
                } else {
                    entries.forEach((entry, entryIndex) => {
                        const entryEl = this.renderEntry(entry, entryIndex, entries.length);
                        listEl.appendChild(entryEl);
                    });
                }

                container.appendChild(columnEl);
            });
        },

        renderEntry(entry, entryIndex = 0, totalEntries = 1) {
            const card = entry.card || {};
            const entryEl = document.createElement('div');
            entryEl.className = 'deck-card-entry group relative cursor-grab';
            entryEl.draggable = true;
            entryEl.style.zIndex = String(entryIndex + 1);
            entryEl.dataset.entryId = entry.id;
            entryEl.dataset.cardId = card.id || '';
            entryEl.dataset.cardName = card.name || '';
            entryEl.dataset.cardImage = card.image_url || '';
            entryEl.dataset.cardData = JSON.stringify(card);

            const type = this.formatCardType(card.card_type);
            const manaCost = card.mana_cost || '—';
            const escapeHtml = window.GameUtils?.escapeHtml || ((value) => value);
            const safeName = escapeHtml(card.name || 'Unknown card');
            const safeImage = escapeHtml(card.image_url || '');

            entryEl.innerHTML = `
                <div class="card-visual relative rounded-xl overflow-hidden shadow-lg border border-arena-accent/40 bg-arena-surface/40">
                        ${card.image_url
                            ? `<img src="${safeImage}" alt="${safeName}" class="deck-card-image select-none">`
                        : `
                                <div class="w-full h-48 flex flex-col items-center justify-center bg-arena-surface/80 text-center text-sm px-4 text-arena-muted">
                                    <span class="text-lg font-semibold">${safeName}</span>
                                    <span>${manaCost}</span>
                                    <span>${type}</span>
                                </div>
                            `}
                        <div class="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/80 text-white text-xs font-semibold pointer-events-none">
                            ${entry.quantity}x
                        </div>
                        <div class="deck-card-entry-controls absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button class="rounded-full bg-black/60 text-white text-xs" data-entry-action="increment" data-entry-id="${entry.id}" title="Increase quantity">+</button>
                        <button class="rounded-full bg-black/60 text-white text-xs" data-entry-action="decrement" data-entry-id="${entry.id}" title="Decrease quantity">−</button>
                        <button class="rounded-full bg-red-600/70 text-white text-xs" data-entry-action="remove" data-entry-id="${entry.id}" title="Remove card">✕</button>
                    </div>
                </div>
            `;

            return entryEl;
        },

        renderStats() {
            const stats = this.computeStats();
            if (this.elements.mainDeckCount) {
                this.elements.mainDeckCount.textContent = stats.mainDeckTotal;
            }
            if (this.elements.sideboardCount) {
                this.elements.sideboardCount.textContent = stats.sideboardTotal;
            }
            this.renderColorChips(stats.colors);
            this.renderTypeBreakdown(stats.typeCounts);
            this.renderManaCurve(stats.manaCurve);
        },

        renderColorChips(colorCounts) {
            const container = this.elements.colorChips;
            if (!container) return;
            container.innerHTML = '';
            const entries = COLOR_ORDER
                .filter((color) => colorCounts[color])
                .map((color) => ({ color, count: colorCounts[color] }));

            if (!entries.length) {
                const span = document.createElement('span');
                span.className = 'text-xs text-arena-muted';
                span.textContent = 'No colors detected yet';
                container.appendChild(span);
                return;
            }

            entries.forEach(({ color, count }) => {
                const chip = document.createElement('span');
                chip.className = `px-2 py-1 rounded-full text-xs font-semibold ${COLOR_CLASSES[color] || 'bg-gray-600 text-white'}`;
                chip.textContent = `${COLOR_NAMES[color]} (${count})`;
                container.appendChild(chip);
            });
        },

        renderTypeBreakdown(typeCounts) {
            const container = this.elements.typeBreakdown;
            if (!container) return;
            container.innerHTML = '';
            const entries = Object.entries(typeCounts).filter(([, count]) => count > 0);

            if (!entries.length) {
                const span = document.createElement('span');
                span.className = 'text-sm text-arena-muted';
                span.textContent = 'Add cards to see type statistics.';
                container.appendChild(span);
                return;
            }

            entries.forEach(([type, count]) => {
                const badge = document.createElement('div');
                badge.className = 'px-3 py-2 rounded-lg bg-arena-surface border border-arena-accent/20 text-sm flex items-center gap-2';
                badge.innerHTML = `<span class="font-semibold">${count}</span><span>${TYPE_LABELS[type] || this.formatCardType(type)}</span>`;
                container.appendChild(badge);
            });
        },

        renderManaCurve(manaCurve) {
            const barsContainer = this.elements.manaCurveBars;
            const labelsContainer = this.elements.manaCurveLabels;
            if (!barsContainer || !labelsContainer) return;

            barsContainer.innerHTML = '';
            labelsContainer.innerHTML = '';

            const entries = Object.entries(manaCurve);
            const counts = entries.map(([, count]) => count);
            const max = Math.max(...counts, 1);
            const MAX_BAR_HEIGHT = 160;
            const MIN_BAR_HEIGHT = 12;
            const hasValues = counts.some((value) => value > 0);

            if (!hasValues) {
                barsContainer.innerHTML = '<p class="text-sm text-arena-muted">Add spells to visualize the curve.</p>';
                labelsContainer.innerHTML = '';
                return;
            }

            entries.forEach(([label, count]) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'flex-1 flex flex-col items-center gap-1';

                const countLabel = document.createElement('span');
                countLabel.className = 'text-xs text-arena-muted';
                countLabel.textContent = count;

                const bar = document.createElement('div');
                bar.className = 'w-8 bg-gradient-to-t from-arena-accent/30 to-arena-accent rounded-t';
                const heightRatio = max ? count / max : 0;
                const heightPx = Math.max(MIN_BAR_HEIGHT, Math.round(heightRatio * MAX_BAR_HEIGHT));
                bar.style.height = `${heightPx}px`;

                wrapper.appendChild(countLabel);
                wrapper.appendChild(bar);
                barsContainer.appendChild(wrapper);

                const labelItem = document.createElement('span');
                labelItem.className = 'flex-1 text-center text-xs text-arena-muted';
                labelItem.textContent = label;
                labelsContainer.appendChild(labelItem);
            });

        },

        computeStats() {
            const includeCommander = this.shouldShowCommanderColumn() || (this.state.columns.commander && this.state.columns.commander.length > 0);
            const mainColumns = includeCommander ? ['commander', ...MAIN_COLUMNS_BASE] : [...MAIN_COLUMNS_BASE];
            const mainEntries = this.getEntriesForColumns(mainColumns);
            const sideEntries = this.getEntriesForColumns(['sideboard']);

            const typeCounts = {};
            const colors = {};
            const manaCurve = {
                '0': 0,
                '1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                '5': 0,
                '6+': 0
            };

            mainEntries.forEach((entry) => {
                const card = entry.card || {};
                const typeKey = (card.card_type || 'other').toLowerCase();
                const isLand = /\bland\b/.test(typeKey);
                typeCounts[typeKey] = (typeCounts[typeKey] || 0) + entry.quantity;

                if (!isLand) {
                    let cardColors = card.colors;
                    if (!Array.isArray(cardColors) || !cardColors.length) {
                        cardColors = ['C'];
                    }
                    cardColors.forEach((color) => {
                        colors[color] = (colors[color] || 0) + entry.quantity;
                    });

                    const cmcRaw = Number(card.cmc);
                    let bucket = '0';
                    if (!Number.isFinite(cmcRaw) || cmcRaw < 0) {
                        bucket = '0';
                    } else if (cmcRaw >= 6) {
                        bucket = '6+';
                    } else {
                        bucket = String(Math.floor(cmcRaw));
                    }
                    if (!Object.prototype.hasOwnProperty.call(manaCurve, bucket)) {
                        bucket = '0';
                    }
                    manaCurve[bucket] += entry.quantity;
                }
            });

            return {
                mainDeckTotal: mainEntries.reduce((sum, entry) => sum + entry.quantity, 0),
                sideboardTotal: sideEntries.reduce((sum, entry) => sum + entry.quantity, 0),
                typeCounts,
                colors,
                manaCurve
            };
        },

        shouldShowCommanderColumn() {
            return COMMANDER_FORMATS.has((this.state.format || '').toLowerCase());
        },

        getColumnEntries(columnKey) {
            if (!this.state || !this.state.columns[columnKey]) {
                return [];
            }
            return this.state.columns[columnKey]
                .map((entryId) => this.state.entries[entryId])
                .filter(Boolean);
        },

        getEntriesForColumns(columnKeys) {
            const entries = [];
            columnKeys.forEach((key) => {
                const ids = this.state.columns[key] || [];
                ids.forEach((entryId) => {
                    const entry = this.state.entries[entryId];
                    if (entry) {
                        entries.push(entry);
                    }
                });
            });
            return entries;
        },

        handleDragStart(event) {
            if (window.GameCards && typeof GameCards.closeHoverPreview === 'function') {
                GameCards.closeHoverPreview();
            } else if (window.GameCards && typeof GameCards._closeActiveCardPreview === 'function') {
                GameCards._closeActiveCardPreview();
            }
            const entryEl = event.target.closest('[data-entry-id]');
            if (!entryEl) return;
            this.draggedEntryId = entryEl.getAttribute('data-entry-id');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', this.draggedEntryId);
            }
        },

        handleDragOver(event) {
            const columnEl = event.target.closest('[data-column-key]');
            if (!columnEl) return;
            event.preventDefault();
            if (this.activeDropColumn && this.activeDropColumn !== columnEl) {
                this.activeDropColumn.classList.remove('ring-2', 'ring-sky-400/40', 'ring-offset-2');
            }
            this.activeDropColumn = columnEl;
            columnEl.classList.add('ring-2', 'ring-sky-400/40', 'ring-offset-2');
        },

        handleDragLeave(event) {
            const columnEl = event.target.closest('[data-column-key]');
            if (!columnEl) return;
            if (columnEl.contains(event.relatedTarget)) return;
            columnEl.classList.remove('ring-2', 'ring-sky-400/40', 'ring-offset-2');
            if (this.activeDropColumn === columnEl) {
                this.activeDropColumn = null;
            }
        },

        handleDrop(event) {
            const columnEl = event.target.closest('[data-column-key]');
            if (!columnEl) return;
            event.preventDefault();
            const entryId = this.draggedEntryId || (event.dataTransfer && event.dataTransfer.getData('text/plain'));
            const targetColumn = columnEl.getAttribute('data-column-key');
            if (!entryId || !targetColumn) {
                this.clearDragState();
                return;
            }
            this.moveEntry(entryId, targetColumn);
            this.render();
            this.queueSave();
            this.clearDragState();
        },

        clearDragState() {
            this.draggedEntryId = null;
            if (this.activeDropColumn) {
                this.activeDropColumn.classList.remove('ring-2', 'ring-sky-400/40', 'ring-offset-2');
                this.activeDropColumn = null;
            }
        },

        handleEntryAction(event) {
            const actionButton = event.target.closest('[data-entry-action]');
            if (!actionButton) return;
            const entryId = actionButton.getAttribute('data-entry-id');
            const action = actionButton.getAttribute('data-entry-action');
            if (!entryId || !action) return;

            switch (action) {
                case 'increment':
                    this.updateEntryQuantity(entryId, this.state.entries[entryId].quantity + 1);
                    break;
                case 'decrement':
                    this.updateEntryQuantity(entryId, this.state.entries[entryId].quantity - 1);
                    break;
                case 'remove':
                    this.removeEntry(entryId);
                    break;
                default:
                    break;
            }
        },

        updateEntryQuantity(entryId, nextQuantity) {
            const entry = this.state.entries[entryId];
            if (!entry) return;
            if (nextQuantity <= 0) {
                this.removeEntry(entryId);
                return;
            }
            entry.quantity = nextQuantity;
            this.render();
            this.queueSave();
        },

        removeEntry(entryId) {
            if (!this.state.entries[entryId]) return;
            Object.keys(this.state.columns).forEach((columnKey) => {
                this.state.columns[columnKey] = this.state.columns[columnKey].filter((id) => id !== entryId);
            });
            delete this.state.entries[entryId];
            this.render();
            this.queueSave();
        },

        moveEntry(entryId, newColumn) {
            if (!this.state.entries[entryId]) return;
            Object.keys(this.state.columns).forEach((columnKey) => {
                const list = this.state.columns[columnKey];
                const idx = list.indexOf(entryId);
                if (idx >= 0) {
                    list.splice(idx, 1);
                }
            });
            this.state.columns[newColumn].push(entryId);
        },

        addCard(card, options = {}) {
            if (!card) return;
            const quantity = Number(options.quantity) || 1;
            const columnKey = options.columnKey || this.resolveDefaultColumn(card, options);
            const existing = this.findEntry(card.id, columnKey);

            if (existing) {
                existing.quantity += quantity;
            } else {
                const entryId = this.generateEntryId(card.id);
                this.state.entries[entryId] = {
                    id: entryId,
                    card,
                    quantity
                };
                this.state.columns[columnKey].push(entryId);
            }

            this.render();
            this.queueSave();
        },

        addBasicLand(landKey, quantity) {
            if (!landKey) return;
            const preset = BASIC_LAND_PRESETS[landKey];
            if (!preset) return;
            const card = { ...preset };
            card.text = card.text || card.oracle_text || '';
            card.unique_id = `${preset.id}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            this.addCard(card, { quantity, forceColumn: 'lands' });
        },

        findEntry(cardId, columnKey) {
            const ids = this.state.columns[columnKey] || [];
            for (const entryId of ids) {
                const entry = this.state.entries[entryId];
                if (entry && entry.card && entry.card.id === cardId) {
                    return entry;
                }
            }
            return null;
        },

        resolveDefaultColumn(card, options = {}) {
            if (options.isCommander) {
                return 'commander';
            }
            if (options.forceColumn && this.state.columns[options.forceColumn]) {
                return options.forceColumn;
            }
            const type = (card.card_type || '').toLowerCase();
            if (type === 'land') {
                return 'lands';
            }
            const cmc = Number(card.cmc) || 0;
            if (cmc <= 1) return 'cmc1';
            if (cmc === 2) return 'cmc2';
            if (cmc === 3) return 'cmc3';
            if (cmc === 4) return 'cmc4';
            if (cmc === 5) return 'cmc5';
            return 'cmc6plus';
        },

        formatCardType(rawType) {
            if (!rawType) return 'Other';
            const normalized = String(rawType).toLowerCase();
            const label = TYPE_LABELS[normalized];
            if (label) return label;
            return normalized.charAt(0).toUpperCase() + normalized.slice(1);
        },

        generateEntryId(cardId) {
            const random = Math.random().toString(36).slice(2, 8);
            return `${cardId || 'card'}-${random}`;
        },

        async importFromText() {
            const deckText = (this.elements.importTextarea?.value || '').trim();
            if (!deckText) {
                this.setImportStatus('Paste a decklist first.', 'error');
                return;
            }
            this.setImportStatus('Parsing decklist...', 'info');
            this.setButtonLoading(this.elements.parseButton, true);
            try {
                const response = await fetch('/api/v1/decks/parse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ decklist_text: deckText })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.detail || 'Deck parsing failed');
                }
                const deck = await response.json();
                this.loadDeckPayload(deck);
                this.setImportStatus('Deck imported from text.', 'success');
            } catch (error) {
                console.error('Deck parse error', error);
                this.setImportStatus(error.message || 'Unable to parse deck.', 'error');
            } finally {
                this.setButtonLoading(this.elements.parseButton, false);
            }
        },

        async importFromUrl() {
            const deckUrl = (this.elements.importUrlInput?.value || '').trim();
            if (!deckUrl) {
                this.setImportStatus('Enter a deck URL first.', 'error');
                return;
            }
            this.setImportStatus('Fetching decklist from URL...', 'info');
            this.setButtonLoading(this.elements.importUrlButton, true);
            try {
                const response = await fetch('/api/v1/decks/import-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deck_url: deckUrl })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.detail || 'Deck import failed');
                }
                const payload = await response.json();
                if (payload.deck_text && this.elements.importTextarea) {
                    this.elements.importTextarea.value = payload.deck_text;
                }
                if (payload.deck) {
                    this.loadDeckPayload(payload.deck);
                    this.setImportStatus(payload.message || 'Deck imported from URL.', 'success');
                } else {
                    this.setImportStatus(payload.message || 'Fetched decklist. Paste to parse.', 'info');
                }
            } catch (error) {
                console.error('Deck import error', error);
                this.setImportStatus(error.message || 'Unable to import deck.', 'error');
            } finally {
                this.setButtonLoading(this.elements.importUrlButton, false);
            }
        },

        loadDeckPayload(deck) {
            if (!deck) return;
            const nextState = this.getDefaultState();
            nextState.deckName = deck.name || nextState.deckName;
            nextState.format = deck.format || this.state.format;
            const entryLookup = new Map();
            const appendEntry = (deckEntry, columnKey) => {
                const card = deckEntry?.card;
                if (!card || !columnKey || !nextState.columns[columnKey]) {
                    return;
                }
                const quantity = Number(deckEntry.quantity) || 1;
                const cardKeyRaw = card.id || card.name || '';
                const mapKey = cardKeyRaw ? `${columnKey}:${String(cardKeyRaw).toLowerCase()}` : null;
                const existingEntryId = mapKey ? entryLookup.get(mapKey) : null;

                if (existingEntryId) {
                    nextState.entries[existingEntryId].quantity += quantity;
                    return;
                }

                const entryId = this.generateEntryId(card.id);
                nextState.entries[entryId] = {
                    id: entryId,
                    card,
                    quantity
                };
                nextState.columns[columnKey].push(entryId);
                if (mapKey) {
                    entryLookup.set(mapKey, entryId);
                }
            };

            if (Array.isArray(deck.cards)) {
                deck.cards.forEach((entry) => {
                    const columnKey = this.resolveDefaultColumn(entry.card);
                    appendEntry(entry, columnKey);
                });
            }

            if (Array.isArray(deck.sideboard)) {
                deck.sideboard.forEach((entry) => {
                    appendEntry(entry, 'sideboard');
                });
            }

            if (Array.isArray(deck.commanders) && deck.commanders.length) {
                const commanderGroups = new Map();
                deck.commanders.forEach((card) => {
                    if (!card) return;
                    const key = card.id || card.name;
                    if (!commanderGroups.has(key)) {
                        commanderGroups.set(key, { card, quantity: 0 });
                    }
                    commanderGroups.get(key).quantity += 1;
                });
                commanderGroups.forEach((data) => {
                    const entryId = this.generateEntryId(data.card.id);
                    nextState.entries[entryId] = {
                        id: entryId,
                        card: data.card,
                        quantity: data.quantity
                    };
                    nextState.columns.commander.push(entryId);
                });
            }

            this.state = nextState;
            this.ensureColumns();
            this.render();
            this.resetDeckIdentity();
            this.saveState();
        },

        async exportDecklist() {
            const exportText = this.buildDeckExport();
            try {
                await navigator.clipboard.writeText(exportText);
                this.setImportStatus('Deck copied to clipboard.', 'success');
            } catch (error) {
                console.warn('Clipboard write failed', error);
                this.setImportStatus('Unable to copy deck automatically. Please paste manually.', 'error');
            }
        },

        buildDeckExport() {
            const lines = [];
            const title = this.state.deckName || 'ManaForge Deck';
            lines.push(`# ${title}`);
            lines.push(`# Format: ${this.state.format || 'unknown'}`);
            lines.push(`# Exported via ManaForge Deck Manager`);
            lines.push('');

            const mainColumns = ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands'];
            const mainLines = [];
            mainColumns.forEach((key) => {
                const entries = this.getColumnEntries(key);
                entries.forEach((entry) => {
                    mainLines.push(`${entry.quantity} ${entry.card?.name || 'Unknown'}`);
                });
            });
            if (mainLines.length) {
                lines.push(...mainLines);
                lines.push('');
            }

            const sideEntries = this.getColumnEntries('sideboard');
            if (sideEntries.length) {
                lines.push('Sideboard');
                sideEntries.forEach((entry) => {
                    lines.push(`${entry.quantity} ${entry.card?.name || 'Unknown'}`);
                });
                lines.push('');
            }

            const commanderEntries = this.getColumnEntries('commander');
            if (commanderEntries.length) {
                lines.push('Commander');
                commanderEntries.forEach((entry) => {
                    lines.push(`${entry.quantity} ${entry.card?.name || 'Unknown'}`);
                });
            }

            return lines.join('\n').trim();
        },

        clearDeck() {
            if (!window.confirm('Clear the current deck? This action cannot be undone.')) {
                return;
            }
            this.state = this.getDefaultState();
            this.resetDeckIdentity();
            this.render();
            this.saveState();
            if (this.elements.importTextarea) {
                this.elements.importTextarea.value = '';
            }
            if (this.elements.importUrlInput) {
                this.elements.importUrlInput.value = '';
            }
        },

        cloneState(state) {
            try {
                return JSON.parse(JSON.stringify(state));
            } catch (error) {
                console.warn('Unable to clone deck state', error);
                return state;
            }
        },

        ensureDeckIdentity() {
            if (this.currentDeckId) {
                return;
            }
            let generatedId = null;
            if (window.DeckLibrary && typeof window.DeckLibrary.generateId === 'function') {
                generatedId = window.DeckLibrary.generateId();
            } else {
                generatedId = `deck_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            }
            this.currentDeckId = generatedId;
            this.updateDeckIdInUrl(generatedId);
        },

        resetDeckIdentity() {
            this.currentDeckId = null;
            this.updateDeckIdInUrl(null);
        },

        updateDeckIdInUrl(deckId) {
            if (this.externalContext && this.externalContext.suppressUrlUpdates) {
                return;
            }
            try {
                const url = new URL(window.location.href);
                if (!deckId) {
                    url.searchParams.delete('deckId');
                } else {
                    url.searchParams.set('deckId', deckId);
                }
                window.history.replaceState({}, '', url.toString());
            } catch (error) {
                console.warn('Unable to update deck id in URL', error);
            }
        },

        syncLibraryState(payloadOverride = null) {
            if (!window.DeckLibrary) return;
            if (!this.currentDeckId) return;
            const hasEntries = this.hasDeckEntries();
            const allowEmptySave = Boolean(this.externalContext && this.externalContext.persistEmpty);
            if (!hasEntries && !allowEmptySave) {
                try {
                    window.DeckLibrary.remove(this.currentDeckId);
                } catch (error) {
                    console.warn('Unable to remove deck from library', error);
                }
                return;
            }
            const payload = payloadOverride || {
                id: this.currentDeckId,
                name: this.state.deckName || 'Untitled Deck',
                format: this.state.format || 'modern',
                state: this.cloneState(this.state),
                updatedAt: new Date().toISOString()
            };
            try {
                window.DeckLibrary.save(payload);
            } catch (error) {
                console.warn('Unable to sync deck library entry', error);
            }
        },

        setImportStatus(message, variant = 'info') {
            const el = this.elements.importStatus;
            if (!el) return;
            el.textContent = message;
            el.classList.remove('text-arena-muted', 'text-arena-accent', 'text-red-300');
            if (variant === 'success') {
                el.classList.add('text-arena-accent');
            } else if (variant === 'error') {
                el.classList.add('text-red-300');
            } else {
                el.classList.add('text-arena-muted');
            }
        },

        setButtonLoading(button, isLoading) {
            if (!button) return;
            button.disabled = Boolean(isLoading);
            button.classList.toggle('opacity-50', Boolean(isLoading));
            button.classList.toggle('cursor-not-allowed', Boolean(isLoading));
        },

        hasDeckEntries() {
            if (!this.state || !this.state.columns || !this.state.entries) return false;
            return COLUMN_CONFIG.some((column) => {
                const ids = this.state.columns[column.key];
                return Array.isArray(ids) && ids.some((entryId) => {
                    const entry = this.state.entries[entryId];
                    return entry && entry.quantity > 0;
                });
            });
        },

        updateImportVisibility() {
            const section = this.elements.importSection;
            if (!section) return;
            if (this.hasDeckEntries()) {
                section.classList.add('hidden');
            } else {
                section.classList.remove('hidden');
            }
        },

        dispatchReadyEvent() {
            if (!this.readyEventName) {
                return;
            }
            try {
                window.dispatchEvent(new CustomEvent(this.readyEventName, {
                    detail: {
                        deckId: this.currentDeckId,
                        context: this.externalContext || null
                    }
                }));
            } catch (error) {
                console.warn('Unable to dispatch deck manager ready event', error);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        DeckManager.init();
    });

    window.DeckManager = DeckManager;
})();
