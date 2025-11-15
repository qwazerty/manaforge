/**
 * ManaForge Deck Manager
 * Client-side deck builder with Arena-style layout, stats, and import/export features.
 */
(function() {
    const STORAGE_KEY = 'manaforge:deck-manager:v1';
    const PENDING_IMPORT_KEY = 'manaforge:deck-manager:pending-import';
    const COMMANDER_FORMATS = new Set(['duel_commander', 'commander_multi']);
    const COLUMN_CONFIG = [
        { key: 'commander', label: 'Commander', icon: '👑', description: 'Command zone slot' },
        { key: 'cmc1', label: '1 CMC', icon: '1️⃣', description: '0-1 mana value' },
        { key: 'cmc2', label: '2 CMC', icon: '2️⃣', description: 'Two drops' },
        { key: 'cmc3', label: '3 CMC', icon: '3️⃣', description: 'Three drops' },
        { key: 'cmc4', label: '4 CMC', icon: '4️⃣', description: 'Four drops' },
        { key: 'cmc5', label: '5 CMC', icon: '5️⃣', description: 'Five drops' },
        { key: 'cmc6plus', label: '6+ CMC', icon: '6️⃣', description: 'Big spells' },
        { key: 'lands', label: 'Lands', icon: '🌍', description: 'Mana base' },
        { key: 'sideboard', label: 'Sideboard', icon: '🧰', description: 'Plan B' }
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

    const DeckManager = {
        state: null,
        elements: {},
        draggedEntryId: null,
        activeDropColumn: null,
        saveTimeout: null,

        init() {
            this.cacheElements();
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
                searchButton: document.getElementById('deck-search-button'),
                exportButtons: [
                    document.getElementById('deck-export-button'),
                    document.getElementById('deck-export-button-secondary')
                ],
                parseButton: document.getElementById('deck-parse-button'),
                importUrlButton: document.getElementById('deck-import-url-button'),
                clearButton: document.getElementById('deck-clear-button')
            };
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

            if (this.elements.searchButton) {
                this.elements.searchButton.addEventListener('click', () => {
                    if (window.CardSearchModal) {
                        window.CardSearchModal.show('hand');
                    }
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

            if (this.elements.clearButton) {
                this.elements.clearButton.addEventListener('click', () => this.clearDeck());
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
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    this.state = JSON.parse(stored);
                } else {
                    this.state = this.getDefaultState();
                }
            } catch (error) {
                console.warn('Unable to load stored deck state', error);
                this.state = this.getDefaultState();
            }
            this.ensureColumns();
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
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
            } catch (error) {
                console.warn('Unable to persist deck state', error);
            }
        },

        render() {
            if (!this.state) return;
            this.updateInputs();
            this.renderColumns();
            this.renderStats();
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
                    'bg-arena-surface/70',
                    'border',
                    'border-arena-accent/20',
                    'rounded-xl',
                    'p-3',
                    'flex',
                    'flex-col',
                    'gap-3'
                ].join(' ');

                if (column.key === 'commander' && !showCommander && entries.length === 0) {
                    columnEl.classList.add('hidden');
                }

                columnEl.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs uppercase tracking-wide text-arena-muted">${column.icon} ${column.label}</p>
                            <p class="text-sm text-arena-text-dim">${entries.reduce((sum, entry) => sum + entry.quantity, 0)} cards</p>
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
            entryEl.style.zIndex = String((totalEntries - entryIndex) + 1);
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
                        ? `<img src="${safeImage}" alt="${safeName}" class="w-full h-48 object-cover select-none">`
                        : `
                            <div class="w-full h-48 flex flex-col items-center justify-center bg-arena-surface/80 text-center text-sm px-4 text-arena-muted">
                                <span class="text-lg font-semibold">${safeName}</span>
                                <span>${manaCost}</span>
                                <span>${type}</span>
                            </div>
                        `}
                    <div class="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/80 text-white text-xs font-semibold pointer-events-none">
                        ${entry.quantity}x
                    </div>
                    <div class="deck-card-entry-controls absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
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

            entries.forEach(([label, count]) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'flex-1 flex flex-col items-center gap-1';

                const countLabel = document.createElement('span');
                countLabel.className = 'text-xs text-arena-muted';
                countLabel.textContent = count;

                const bar = document.createElement('div');
                bar.className = 'w-8 bg-gradient-to-t from-arena-accent/30 to-arena-accent rounded-t';
                const heightPercent = max ? Math.max(8, Math.round((count / max) * 100)) : 8;
                bar.style.height = `${heightPercent}%`;

                wrapper.appendChild(countLabel);
                wrapper.appendChild(bar);
                barsContainer.appendChild(wrapper);

                const labelItem = document.createElement('span');
                labelItem.className = 'flex-1 text-center text-xs text-arena-muted';
                labelItem.textContent = label;
                labelsContainer.appendChild(labelItem);
            });

            if (!entries.length) {
                barsContainer.innerHTML = '<p class="text-sm text-arena-muted">Add spells to visualize the curve.</p>';
                labelsContainer.innerHTML = '';
            }
        },

        computeStats() {
            const includeCommander = this.shouldShowCommanderColumn() || (this.state.columns.commander && this.state.columns.commander.length > 0);
            const mainColumns = includeCommander ? ['commander', ...MAIN_COLUMNS_BASE] : [...MAIN_COLUMNS_BASE];
            const mainEntries = this.getEntriesForColumns(mainColumns);
            const sideEntries = this.getEntriesForColumns(['sideboard']);

            const typeCounts = {};
            const colors = {};
            const manaCurve = {
                '0-1': 0,
                '2': 0,
                '3': 0,
                '4': 0,
                '5': 0,
                '6+': 0
            };

            mainEntries.forEach((entry) => {
                const card = entry.card || {};
                const typeKey = (card.card_type || 'other').toLowerCase();
                typeCounts[typeKey] = (typeCounts[typeKey] || 0) + entry.quantity;

                let cardColors = card.colors;
                if (!Array.isArray(cardColors) || !cardColors.length) {
                    cardColors = ['C'];
                }
                cardColors.forEach((color) => {
                    colors[color] = (colors[color] || 0) + entry.quantity;
                });

                const cardTypeLower = typeKey.toLowerCase();
                if (cardTypeLower !== 'land') {
                    const cmc = Number(card.cmc) || 0;
                    if (cmc <= 1) {
                        manaCurve['0-1'] += entry.quantity;
                    } else if (cmc === 2) {
                        manaCurve['2'] += entry.quantity;
                    } else if (cmc === 3) {
                        manaCurve['3'] += entry.quantity;
                    } else if (cmc === 4) {
                        manaCurve['4'] += entry.quantity;
                    } else if (cmc === 5) {
                        manaCurve['5'] += entry.quantity;
                    } else {
                        manaCurve['6+'] += entry.quantity;
                    }
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
            }
        },

        async importFromUrl() {
            const deckUrl = (this.elements.importUrlInput?.value || '').trim();
            if (!deckUrl) {
                this.setImportStatus('Enter a deck URL first.', 'error');
                return;
            }
            this.setImportStatus('Fetching decklist from URL...', 'info');
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
            }
        },

        loadDeckPayload(deck) {
            if (!deck) return;
            const nextState = this.getDefaultState();
            nextState.deckName = deck.name || nextState.deckName;
            nextState.format = deck.format || this.state.format;

            if (Array.isArray(deck.cards)) {
                deck.cards.forEach((entry) => {
                    const card = entry.card;
                    if (!card) return;
                    const quantity = Number(entry.quantity) || 1;
                    const columnKey = this.resolveDefaultColumn(card);
                    const entryId = this.generateEntryId(card.id);
                    nextState.entries[entryId] = {
                        id: entryId,
                        card,
                        quantity
                    };
                    nextState.columns[columnKey].push(entryId);
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
            this.saveState();
        },

        async exportDecklist() {
            const exportText = this.buildDeckExport();
            try {
                await navigator.clipboard.writeText(exportText);
            } catch (error) {
                console.warn('Clipboard write failed', error);
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
            this.render();
            this.saveState();
            if (this.elements.importTextarea) {
                this.elements.importTextarea.value = '';
            }
            if (this.elements.importUrlInput) {
                this.elements.importUrlInput.value = '';
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
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        DeckManager.init();
    });

    window.DeckManager = DeckManager;
})();
