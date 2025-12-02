<script>
    import { onMount, onDestroy } from 'svelte';
    import { DeckStorage, deepClone } from '../../lib/deck-storage';
    import { createPriceLookup, formatPrice, getCachedPrice } from '../../lib/pricing';

    // Constants
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
        commander: 'Commander',
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
    
    // Price cache - populated by batch API calls
    let cardPrices = $state({});
    let pricingDataLoaded = $state(false);
    const queuePriceLookup = createPriceLookup({
        delay: 100,
        onPrices: (prices) => {
            cardPrices = { ...cardPrices, ...prices };
        },
        onComplete: () => {
            pricingDataLoaded = true;
        }
    });

    const pricingPending = $derived(() => !pricingDataLoaded);

    const LAND_HINTS = {
        draft: { recommendation: '17 lands' },
        duel_commander: { recommendation: '37-38 lands' },
        commander_multi: { recommendation: '36-38 lands' },
        default60: { recommendation: '24 lands' }
    };

    const resolveErrorMessage = async (response, fallback = 'An error occurred.') => {
        if (!response) {
            return fallback;
        }
        try {
            const data = await response.json();
            if (data?.detail) return data.detail;
            if (data?.message) return data.message;
        } catch {
            // ignore json parse errors
        }
        try {
            const text = await response.text();
            if (text) return text;
        } catch {
            // ignore text read errors
        }
        return fallback;
    };

    // Helper functions
    function isCommanderFormat(format) {
        return COMMANDER_FORMATS.has((format || '').toLowerCase());
    }

    function safeNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    const BASIC_LAND_PRESETS = {
        plains: {
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
        },
        island: {
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
        },
        swamp: {
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
        },
        mountain: {
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
        },
        forest: {
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
        },
        wastes: {
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
        }
    };

    // State
    let { embedded = false } = $props();
    let state = $state(getDefaultState());
    let currentDeckId = $state(null);
    let importStatus = $state({ message: '', type: 'info' });
    let isParsing = $state(false);
    let isImportingUrl = $state(false);
    let showBasicLands = $state(false);
    let draggedEntryId = $state(null);
    let activeDropColumn = $state(null);
    let showListView = $state(false);
    let importText = $state('');
    let importUrl = $state('');
    let copyToastMessage = $state('');
    let showCopyToast = $state(false);
    let copyToastTimer = null;
    let suppressUrlUpdates = false;

    // Derived
    let stats = $derived(computeStats(state));
    let pricing = $derived(computePricing(state));
    let showCommander = $derived(isCommanderFormat(state.format));
    let showSideboard = $derived(!isCommanderFormat(state.format));
    let mainGroups = $derived(
        groupEntriesForList(
            collectEntriesWithColumn(getMainColumnKeys())
        )
    );
    let mainColumnsSplit = $derived(
        showSideboard ? { left: mainGroups, right: [] } : splitIntoTwoColumns(mainGroups)
    );
    let sideboardGroups = $derived(
        showSideboard ? groupEntriesForList(collectEntriesWithColumn(['sideboard'])) : []
    );

    function getDefaultState() {
        const columns = {};
        COLUMN_CONFIG.forEach((column) => {
            columns[column.key] = [];
        });
        return {
            deckName: 'Untitled Deck',
            format: 'modern',
            entries: {},
            columns,
            filters: {
                color: 'all',
                rarity: 'all',
                sideboardOnly: false
            },
            sorting: {
                sideboard: 'default'
            }
        };
    }

    function ensureStateDefaults(current) {
        if (!current) return;
        if (!current.filters) {
            current.filters = { color: 'all', rarity: 'all', sideboardOnly: false };
        } else {
            if (!current.filters.color) current.filters.color = 'all';
            if (!current.filters.rarity) current.filters.rarity = 'all';
            if (typeof current.filters.sideboardOnly !== 'boolean') current.filters.sideboardOnly = false;
        }
        if (!current.sorting) {
            current.sorting = { sideboard: 'default' };
        } else if (!current.sorting.sideboard) {
            current.sorting.sideboard = 'default';
        }
    }

    function computeStats(currentState) {
        if (!currentState) return { mainDeckTotal: 0, sideboardTotal: 0, typeCounts: {}, colors: {}, manaCurve: {} };

        const includeCommander = isCommanderFormat(currentState.format) || (currentState.columns.commander?.length > 0);
        const mainColumns = includeCommander ? ['commander', ...MAIN_COLUMNS_BASE] : [...MAIN_COLUMNS_BASE];
        const mainEntries = getEntriesForColumns(currentState, mainColumns);
        const sideEntries = !isCommanderFormat(currentState.format) ? getEntriesForColumns(currentState, ['sideboard']) : [];

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
                const cardColors = (Array.isArray(card.colors) && card.colors.length) ? card.colors : ['C'];
                cardColors.forEach((color) => {
                    colors[color] = (colors[color] || 0) + entry.quantity;
                });

                const cmc = safeNumber(card.cmc);
                const bucket = cmc < 0 ? '0' : cmc >= 6 ? '6+' : String(Math.floor(cmc));
                manaCurve[bucket] = (manaCurve[bucket] || 0) + entry.quantity;
            }
        });

        return {
            mainDeckTotal: mainEntries.reduce((sum, entry) => sum + entry.quantity, 0),
            sideboardTotal: sideEntries.reduce((sum, entry) => sum + entry.quantity, 0),
            typeCounts,
            colors,
            manaCurve
        };
    }

    function computePricing(currentState) {
        const empty = { main: 0, sideboard: 0, total: 0, missingCopies: 0, pricedCopies: 0 };
        if (!currentState) return empty;

        const includeCommander = isCommanderFormat(currentState.format) || (currentState.columns.commander?.length > 0);
        const mainColumns = includeCommander ? ['commander', ...MAIN_COLUMNS_BASE] : [...MAIN_COLUMNS_BASE];
        const mainEntries = getEntriesForColumns(currentState, mainColumns);
        const sideEntries = !isCommanderFormat(currentState.format) ? getEntriesForColumns(currentState, ['sideboard']) : [];

        const main = sumEntries(mainEntries);
        const side = sumEntries(sideEntries);

        return {
            main: main.total,
            sideboard: side.total,
            total: main.total + side.total,
            missingCopies: main.missingCopies + side.missingCopies,
            pricedCopies: main.pricedCopies + side.pricedCopies
        };
    }

    function sumEntries(entries) {
        return entries.reduce(
            (acc, entry) => {
                const price = getCardPrice(entry?.card);
                if (!Number.isFinite(price)) {
                    acc.missingCopies += Number(entry?.quantity) || 0;
                    return acc;
                }
                const quantity = Number(entry?.quantity) || 0;
                acc.total += price * quantity;
                acc.pricedCopies += quantity;
                return acc;
            },
            { total: 0, missingCopies: 0, pricedCopies: 0 }
        );
    }

    function getCardPrice(card = {}) {
        return getCachedPrice(cardPrices, card);
    }

    function normalizeName(name) {
        return typeof name === 'string' ? name.trim().toLowerCase() : '';
    }

    function getEntriesForColumns(currentState, columnKeys) {
        const entries = [];
        columnKeys.forEach((key) => {
            const ids = currentState.columns[key] || [];
            ids.forEach((entryId) => {
                const entry = currentState.entries[entryId];
                if (entry) {
                    entries.push(entry);
                }
            });
        });
        return entries;
    }

    function getColumnEntries(columnKey) {
        if (!state || !state.columns[columnKey]) {
            return [];
        }
        return state.columns[columnKey]
            .map((entryId) => state.entries[entryId])
            .filter(Boolean);
    }

    function getMainColumnKeys() {
        const includeCommander = isCommanderFormat(state.format) || (state.columns.commander?.length > 0);
        return includeCommander ? ['commander', ...MAIN_COLUMNS_BASE] : [...MAIN_COLUMNS_BASE];
    }

    function filterEntries(entries, columnKey = null) {
        const applyOnlyToSideboard = Boolean(state?.filters?.sideboardOnly);
        if (applyOnlyToSideboard && columnKey !== 'sideboard') {
            return entries;
        }
        return entries.filter((entry) => passesFilters(entry?.card));
    }

    function classifyType(card = {}, columnKey = null) {
        // Si la carte est dans la colonne commander, classifier comme commander
        if (columnKey === 'commander') return 'commander';
        
        const typeLine = String(card.type_line || card.card_type || '').toLowerCase();
        if (typeLine.includes('creature')) return 'creature';
        if (typeLine.includes('planeswalker')) return 'planeswalker';
        if (typeLine.includes('instant')) return 'instant';
        if (typeLine.includes('sorcery')) return 'sorcery';
        if (typeLine.includes('enchantment')) return 'enchantment';
        if (typeLine.includes('artifact')) return 'artifact';
        if (typeLine.includes('land')) return 'land';
        return 'other';
    }

    function getTypeLabel(typeKey) {
        const normalized = String(typeKey || '').toLowerCase();
        return TYPE_LABELS[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Other');
    }

    function collectEntriesWithColumn(columnKeys) {
        const result = [];
        columnKeys.forEach((columnKey) => {
            const ids = state.columns[columnKey] || [];
            ids.forEach((entryId) => {
                const entry = state.entries[entryId];
                if (entry) {
                    result.push({ ...entry, __column: columnKey });
                }
            });
        });
        return result;
    }

    function groupEntriesForList(entriesWithColumn) {
        const filtered = entriesWithColumn.filter((entry) => filterEntries([entry], entry.__column).length > 0);
        const buckets = new Map();
        filtered.forEach((entry) => {
            const typeKey = classifyType(entry.card, entry.__column);
            const label = getTypeLabel(typeKey);
            if (!buckets.has(label)) {
                buckets.set(label, { label, typeKey, entries: [], count: 0 });
            }
            const bucket = buckets.get(label);
            bucket.entries.push(entry);
            bucket.count += Number(entry.quantity) || 0;
        });
        const groups = Array.from(buckets.values());
        groups.forEach((group) => {
            group.entries.sort((a, b) => {
                const cmcA = Number(a.card?.cmc) || 0;
                const cmcB = Number(b.card?.cmc) || 0;
                if (cmcA !== cmcB) return cmcA - cmcB;
                return compareByName(a.card, b.card);
            });
        });
        // Trier les groupes: Commander en premier, terrains en dernier, reste alphabétique
        return groups.sort((a, b) => {
            if (a.typeKey === 'commander') return -1;
            if (b.typeKey === 'commander') return 1;
            if (a.typeKey === 'land' && b.typeKey !== 'land') return 1;
            if (b.typeKey === 'land' && a.typeKey !== 'land') return -1;
            return a.label.localeCompare(b.label);
        });
    }

    function splitIntoTwoColumns(groups) {
        const left = [];
        const right = [];
        let leftCount = 0;
        let rightCount = 0;
        groups.forEach(group => {
            if (leftCount <= rightCount) {
                left.push(group);
                leftCount += group.count;
            } else {
                right.push(group);
                rightCount += group.count;
            }
        });
        return { left, right };
    }

    function formatManaCost(manaCost) {
        if (!manaCost) return [];
        const matches = String(manaCost).match(/\{[^}]+\}/g);
        return matches || [];
    }

    function buildManaSymbols(manaCost) {
        return formatManaCost(manaCost).map((code) => {
            const raw = code.slice(1, -1).toLowerCase();
            // Handle hybrid mana (e.g., {W/U}, {2/W})
            if (raw.includes('/')) {
                const parts = raw.split('/');
                // Hybrid mana class format: ms-wp for {W/P}, ms-wu for {W/U}, ms-2w for {2/W}
                return { class: `ms-${parts.join('')}`, isHybrid: true };
            }
            // Handle Phyrexian mana (e.g., {W/P} or {P})
            if (raw === 'p') {
                return { class: 'ms-p' };
            }
            // Handle numeric mana
            const numeric = Number(raw);
            if (Number.isFinite(numeric)) {
                return { class: `ms-${numeric}` };
            }
            // Handle X, Y, Z
            if (raw === 'x' || raw === 'y' || raw === 'z') {
                return { class: `ms-${raw}` };
            }
            // Handle snow mana
            if (raw === 's') {
                return { class: 'ms-s' };
            }
            // Handle colorless energy {E}
            if (raw === 'e') {
                return { class: 'ms-e' };
            }
            // Handle tap/untap
            if (raw === 't') {
                return { class: 'ms-tap' };
            }
            if (raw === 'q') {
                return { class: 'ms-untap' };
            }
            // Standard color mana: w, u, b, r, g, c
            const colorMap = { w: 'ms-w', u: 'ms-u', b: 'ms-b', r: 'ms-r', g: 'ms-g', c: 'ms-c' };
            return { class: colorMap[raw] || `ms-${raw}` };
        });
    }

    function handleListDragOver(event, targetColumn) {
        if (!targetColumn) return;
        event.preventDefault();
        activeDropColumn = targetColumn;
    }

    function handleListDrop(event, targetColumn) {
        event.preventDefault();
        const entryId = draggedEntryId;
        activeDropColumn = null;
        if (!entryId || !targetColumn) {
            draggedEntryId = null;
            return;
        }
        if (!showSideboard && targetColumn === 'sideboard') {
            draggedEntryId = null;
            return;
        }
        moveEntry(entryId, targetColumn);
        draggedEntryId = null;
    }

    function passesFilters(card = {}) {
        const filters = state?.filters || {};
        const colorFilter = filters.color || 'all';
        const rarityFilter = filters.rarity || 'all';

        if (colorFilter !== 'all' && !cardMatchesColor(card, colorFilter)) {
            return false;
        }

        if (rarityFilter !== 'all') {
            const rarity = String(card.rarity || '').toLowerCase();
            if (rarity !== rarityFilter) {
                return false;
            }
        }

        return true;
    }

    function cardMatchesColor(card = {}, filter) {
        const colors = Array.isArray(card.colors) ? card.colors : (Array.isArray(card.color_identity) ? card.color_identity : []);
        const normalized = colors.map((c) => String(c || '').toUpperCase()).filter(Boolean);

        if (filter === 'multi') {
            return normalized.length > 1;
        }

        if (filter === 'C') {
            return normalized.length === 0 || normalized.includes('C');
        }

        return normalized.includes(filter);
    }

    function sortEntriesForColumn(entries, columnKey) {
        if (!entries.length) {
            return entries;
        }

        const sortMode = columnKey === 'sideboard'
            ? (state?.sorting?.sideboard || 'default')
            : 'default';

        if (sortMode === 'default') {
            return entries;
        }

        const sorted = [...entries];
        if (sortMode === 'rarity') {
            sorted.sort((a, b) => {
                const rarityA = getRarityWeight(a?.card);
                const rarityB = getRarityWeight(b?.card);
                if (rarityA !== rarityB) {
                    return rarityA - rarityB;
                }
                return compareByName(a?.card, b?.card);
            });
        } else if (sortMode === 'cmc') {
            sorted.sort((a, b) => {
                const cmcA = Number(a?.card?.cmc);
                const cmcB = Number(b?.card?.cmc);
                const safeA = Number.isFinite(cmcA) ? cmcA : Number.POSITIVE_INFINITY;
                const safeB = Number.isFinite(cmcB) ? cmcB : Number.POSITIVE_INFINITY;
                if (safeA !== safeB) {
                    return safeA - safeB;
                }
                return compareByName(a?.card, b?.card);
            });
        }

        return sorted;
    }

    function getRarityWeight(card = {}) {
        const rarityOrder = {
            mythic: 0,
            rare: 1,
            uncommon: 2,
            common: 3
        };
        const rarity = String(card.rarity || '').toLowerCase();
        return Object.prototype.hasOwnProperty.call(rarityOrder, rarity) ? rarityOrder[rarity] : 99;
    }

    function compareByName(cardA = {}, cardB = {}) {
        const nameA = String(cardA.name || '').toLowerCase();
        const nameB = String(cardB.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    }

    function getLandHintForFormat(format) {
        const normalized = (format || '').toLowerCase();
        if (normalized === 'draft') return LAND_HINTS.draft;
        if (normalized === 'duel_commander') return LAND_HINTS.duel_commander;
        if (normalized === 'commander_multi') return LAND_HINTS.commander_multi;
        return LAND_HINTS.default60;
    }

    function resolveDefaultColumn(card, options = {}) {
        if (options.isCommander) {
            return 'commander';
        }
        if (options.forceColumn && state.columns[options.forceColumn]) {
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
    }

    function generateEntryId(cardId) {
        const random = Math.random().toString(36).slice(2, 8);
        return `${cardId || 'card'}-${random}`;
    }

    // Actions
    function saveState() {
        if (!state) return;
        ensureDeckIdentity();
        try {
            const payload = {
                deckId: currentDeckId,
                state: deepClone(state)
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            syncLibraryState();
        } catch (error) {
            console.warn('Unable to persist deck state', error);
        }
    }

    function ensureDeckIdentity() {
        if (currentDeckId) return;
        let generatedId = DeckStorage.generateId();
        currentDeckId = generatedId;
        updateDeckIdInUrl(generatedId);
    }

    function updateDeckIdInUrl(deckId) {
        if (typeof window === 'undefined' || suppressUrlUpdates) {
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
    }

    function applyDeckContext() {
        if (typeof window === 'undefined' || !window.MANAFORGE_DECK_CONTEXT) {
            return;
        }
        const context = window.MANAFORGE_DECK_CONTEXT;
        suppressUrlUpdates = Boolean(context.suppressUrlUpdates);
        if (context.deckId) {
            currentDeckId = context.deckId;
        }
        if (context.deckName) {
            state.deckName = context.deckName;
        }
        if (context.format) {
            state.format = context.format;
        }
        if (context.forceDeckFormat && context.format) {
            state.format = context.format;
        }
    }

    function syncLibraryState() {
        if (!currentDeckId) return;
        const hasEntries = hasDeckEntries();
        // Note: externalContext logic omitted for simplicity, can be added if needed
        if (!hasEntries) {
            DeckStorage.remove(currentDeckId);
            return;
        }
        const payload = {
            id: currentDeckId,
            name: state.deckName || 'Untitled Deck',
            format: state.format || 'modern',
            state: deepClone(state),
            updatedAt: new Date().toISOString()
        };
        DeckStorage.save(payload);
    }

    function hasDeckEntries() {
        if (!state || !state.columns || !state.entries) return false;
        return COLUMN_CONFIG.some((column) => {
            const ids = state.columns[column.key];
            return Array.isArray(ids) && ids.some((entryId) => {
                const entry = state.entries[entryId];
                return entry && entry.quantity > 0;
            });
        });
    }

    function loadState() {
        const params = new URLSearchParams(window.location.search);
        const deckIdFromUrl = params.get('deckId');
        const isNew = params.has('new');

        if (isNew) {
            currentDeckId = null;
            state = getDefaultState();
            // Clear storage for fresh start
            localStorage.removeItem(STORAGE_KEY);
            // Strip 'new' param
            const url = new URL(window.location.href);
            url.searchParams.delete('new');
            window.history.replaceState({}, '', url.toString());
            return;
        }

        if (deckIdFromUrl) {
            currentDeckId = deckIdFromUrl;
            const savedDeck = DeckStorage.get(deckIdFromUrl);
            if (savedDeck && savedDeck.state) {
                state = deepClone(savedDeck.state);
                state.deckName = savedDeck.name || state.deckName;
                state.format = savedDeck.format || state.format;
                ensureStateDefaults(state);
                return;
            }
        }

        // Fallback to local storage state if no ID or ID not found in library
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.state) {
                    state = deepClone(parsed.state);
                    ensureStateDefaults(state);
                    if (!currentDeckId && parsed.deckId) {
                        currentDeckId = parsed.deckId;
                    }
                }
            }
        } catch (e) {
            console.warn('Error loading local state', e);
        }
    }

    function applyPendingImport() {
        try {
            const pendingRaw = localStorage.getItem(PENDING_IMPORT_KEY);
            if (!pendingRaw) return;
            localStorage.removeItem(PENDING_IMPORT_KEY);
            const payload = JSON.parse(pendingRaw);
            if (payload && payload.deck) {
                loadDeckPayload(payload.deck);
                importStatus = { message: payload.message || 'Deck imported from draft.', type: 'success' };
            }
        } catch (error) {
            console.warn('Unable to apply pending import', error);
            importStatus = { message: 'Unable to load draft deck import.', type: 'error' };
        }
    }

    function loadDeckPayload(deck) {
        if (!deck) return;
        const nextState = getDefaultState();
        nextState.deckName = deck.name || nextState.deckName;
        nextState.format = deck.format || state.format;
        const entryLookup = new Map();

        const appendEntry = (deckEntry, columnKey) => {
            const card = deckEntry?.card;
            if (!card || !columnKey || !nextState.columns[columnKey]) return;
            
            const quantity = Number(deckEntry.quantity) || 1;
            const cardKeyRaw = card.id || card.name || '';
            const mapKey = cardKeyRaw ? `${columnKey}:${String(cardKeyRaw).toLowerCase()}` : null;
            const existingEntryId = mapKey ? entryLookup.get(mapKey) : null;

            if (existingEntryId) {
                nextState.entries[existingEntryId].quantity += quantity;
                return;
            }

            const entryId = generateEntryId(card.id);
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
                const columnKey = resolveDefaultColumn(entry.card);
                appendEntry(entry, columnKey);
            });
        }

        if (Array.isArray(deck.sideboard)) {
            deck.sideboard.forEach((entry) => {
                appendEntry(entry, 'sideboard');
            });
        }

        if (Array.isArray(deck.commanders) && deck.commanders.length) {
            deck.commanders.forEach((card) => {
                if (!card) return;
                // Simplified commander handling (assuming 1 qty per card object in array)
                const entryId = generateEntryId(card.id);
                nextState.entries[entryId] = {
                    id: entryId,
                    card: card,
                    quantity: 1
                };
                nextState.columns.commander.push(entryId);
            });
        }

        state = nextState;
        currentDeckId = null; // Reset ID for new import
        updateDeckIdInUrl(null);
        saveState();
        // Fetch prices for all cards in the imported deck
        fetchPricesForDeck();
    }

    function addCard(card, options = {}) {
        if (!card) return;
        const quantity = Number(options.quantity) || 1;
        const columnKey = options.columnKey || resolveDefaultColumn(card, options);
        
        // Find existing
        let existingEntryId = null;
        const ids = state.columns[columnKey] || [];
        for (const id of ids) {
            const entry = state.entries[id];
            if (entry && entry.card && entry.card.id === card.id) {
                existingEntryId = id;
                break;
            }
        }

        if (existingEntryId) {
            state.entries[existingEntryId].quantity += quantity;
        } else {
            const entryId = generateEntryId(card.id);
            state.entries[entryId] = {
                id: entryId,
                card,
                quantity
            };
            state.columns[columnKey].push(entryId);
        }
        saveState();
        // Fetch price for the new card if not already in cache
        if (card.name && !(card.name in cardPrices)) {
            fetchPricesForDeck();
        }
    }

    function updateEntryQuantity(entryId, nextQuantity) {
        const entry = state.entries[entryId];
        if (!entry) return;
        if (nextQuantity <= 0) {
            removeEntry(entryId);
            return;
        }
        entry.quantity = nextQuantity;
        saveState();
    }

    function removeEntry(entryId) {
        if (!state.entries[entryId]) return;
        Object.keys(state.columns).forEach((columnKey) => {
            state.columns[columnKey] = state.columns[columnKey].filter((id) => id !== entryId);
        });
        delete state.entries[entryId];
        saveState();
    }

    function moveEntry(entryId, targetColumn) {
        if (!state.entries[entryId]) return;
        Object.keys(state.columns).forEach((columnKey) => {
            const list = state.columns[columnKey];
            const idx = list.indexOf(entryId);
            if (idx >= 0) {
                list.splice(idx, 1);
            }
        });
        state.columns[targetColumn].push(entryId);
        saveState();
    }

    // Drag and Drop
    function handleDragStart(event, entryId) {
        draggedEntryId = entryId;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', entryId);
        }
        if (window.CardPreviewModal) {
            window.CardPreviewModal.hide();
        }
    }

    function handleDragOver(event, columnKey) {
        event.preventDefault();
        activeDropColumn = columnKey;
    }

    function handleDrop(event, columnKey) {
        event.preventDefault();
        const entryId = draggedEntryId;
        if (!entryId || !columnKey) {
            draggedEntryId = null;
            activeDropColumn = null;
            return;
        }
        if (!showSideboard && columnKey === 'sideboard') {
            draggedEntryId = null;
            activeDropColumn = null;
            return;
        }
        moveEntry(entryId, columnKey);
        draggedEntryId = null;
        activeDropColumn = null;
    }

    // Imports
    async function importFromText() {
        if (!importText.trim()) {
            importStatus = { message: 'Paste a decklist first.', type: 'error' };
            return;
        }
        importStatus = { message: 'Parsing decklist...', type: 'info' };
        isParsing = true;
        try {
            const response = await fetch('/api/v1/decks/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decklist_text: importText })
            });
            if (!response.ok) {
                const message = await resolveErrorMessage(response, 'Deck parsing failed');
                throw new Error(message);
            }
            const deck = await response.json();
            loadDeckPayload(deck);
            importStatus = { message: 'Deck imported from text.', type: 'success' };
        } catch (error) {
            console.error(error);
            importStatus = { message: error.message || 'Unable to parse deck.', type: 'error' };
        } finally {
            isParsing = false;
        }
    }

    async function importFromUrl() {
        if (!importUrl.trim()) {
            importStatus = { message: 'Enter a deck URL first.', type: 'error' };
            return;
        }
        importStatus = { message: 'Fetching decklist from URL...', type: 'info' };
        isImportingUrl = true;
        try {
            const response = await fetch('/api/v1/decks/import-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deck_url: importUrl })
            });
            if (!response.ok) {
                const message = await resolveErrorMessage(response, 'Deck import failed');
                throw new Error(message);
            }
            const payload = await response.json();
            if (payload.deck_text) importText = payload.deck_text;
            if (payload.deck) {
                loadDeckPayload(payload.deck);
                importStatus = { message: payload.message || 'Deck imported from URL.', type: 'success' };
            } else {
                importStatus = { message: payload.message || 'Fetched decklist. Paste to parse.', type: 'info' };
            }
        } catch (error) {
            console.error(error);
            importStatus = { message: error.message || 'Unable to import deck.', type: 'error' };
        } finally {
            isImportingUrl = false;
        }
    }

    function triggerCopyToast(message) {
        copyToastMessage = message;
        showCopyToast = true;
        if (copyToastTimer) {
            clearTimeout(copyToastTimer);
        }
        copyToastTimer = setTimeout(() => {
            showCopyToast = false;
            copyToastMessage = '';
        }, 2400);
    }

    async function exportDecklist() {
        // Simplified export logic
        const lines = [];
        lines.push(`# ${state.deckName || 'ManaForge Deck'}`);
        lines.push(`# Format: ${state.format || 'unknown'}`);
        lines.push('');
        
        const mainColumns = ['cmc1', 'cmc2', 'cmc3', 'cmc4', 'cmc5', 'cmc6plus', 'lands'];
        mainColumns.forEach(key => {
            getColumnEntries(key).forEach(entry => {
                lines.push(`${entry.quantity} ${entry.card?.name}`);
            });
        });
        
        const sideEntries = getColumnEntries('sideboard');
        if (sideEntries.length) {
            lines.push('Sideboard');
            sideEntries.forEach(entry => lines.push(`${entry.quantity} ${entry.card?.name}`));
        }

        const commanderEntries = getColumnEntries('commander');
        if (commanderEntries.length) {
            lines.push('Commander');
            commanderEntries.forEach(entry => lines.push(`${entry.quantity} ${entry.card?.name}`));
        }

        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            importStatus = { message: 'Deck copied to clipboard.', type: 'success' };
            triggerCopyToast('Deck copied to clipboard');
        } catch (e) {
            importStatus = { message: 'Unable to copy deck.', type: 'error' };
            triggerCopyToast('Unable to copy deck.');
        }
    }

    function addBasicLand(landKey) {
        const preset = BASIC_LAND_PRESETS[landKey];
        if (!preset) return;
        const card = { ...preset };
        card.unique_id = `${preset.id}_${Date.now().toString(36)}`;
        addCard(card, { quantity: 1, forceColumn: 'lands' });
        importStatus = { message: `${preset.name} added.`, type: 'success' };
    }

    function fetchPricesForDeck() {
        // Collect all unique card names in the deck
        const cardNames = new Set();
        Object.values(state.entries).forEach((entry) => {
            if (entry?.card?.name) {
                cardNames.add(entry.card.name);
            }
        });

        if (cardNames.size === 0) {
            pricingDataLoaded = true;
            return;
        }

        const missingNames = Array.from(cardNames).filter((name) => !(name in cardPrices));
        if (!missingNames.length) {
            pricingDataLoaded = true;
            return;
        }

        pricingDataLoaded = false;
        queuePriceLookup(missingNames);
    }

    function handleMouseEnter(e, entry) {
        if (window.CardPreviewModal) {
            window.CardPreviewModal.show(
                entry.card.id, 
                entry.card.name, 
                entry.card.image_url || entry.card.image, 
                e, 
                entry.card
            );
        }
    }

    function handleMouseMove(e) {
        if (window.CardPreviewModal) {
            window.CardPreviewModal.updatePosition(e);
        }
    }

    function handleMouseLeave() {
        if (window.CardPreviewModal) {
            window.CardPreviewModal.hide();
        }
    }

    function openSearch() {
        if (window.CardSearchModal) {
            window.CardSearchModal.show('hand');
        }
    }

    onMount(() => {
        if (!embedded) {
            loadState();
        }
        applyDeckContext();
        applyPendingImport();
        
        // Fetch prices for cards already in the deck
        fetchPricesForDeck();
        
        // Hook into global search modal
        if (window.CardSearchModal && typeof window.CardSearchModal.setSubmitHandler === 'function') {
            window.CardSearchModal.setSubmitHandler((card) => {
                addCard(card);
            });
        }

        // Expose API for external scripts (e.g. draft-room.js)
        window.DeckManager = {
            get state() { return state; },
            addCard,
            updateEntryQuantity,
            removeEntry,
            moveEntry
        };

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('manaforge:deck-manager-ready', {
            detail: { deckId: currentDeckId }
        }));
    });

    onDestroy(() => {
        if (window.DeckManager) {
            delete window.DeckManager;
        }
    });
</script>

{#snippet listEntryRow(entry)}
    <div 
        class="flex items-center gap-2 py-1 px-1 rounded hover:bg-arena-accent/10 transition cursor-grab text-sm"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, entry.id)}
        ondragover={(e) => handleListDragOver(e, entry.__column)}
        ondrop={(e) => handleListDrop(e, entry.__column)}
        onmouseenter={(e) => handleMouseEnter(e, entry)}
        onmousemove={(e) => handleMouseMove(e)}
        onmouseleave={() => handleMouseLeave()}
        role="listitem"
    >
        <span class="bg-arena-surface-dark px-1.5 py-0.5 rounded text-xs font-medium w-6 text-center flex-shrink-0">{entry.quantity}</span>
        <span class="font-medium text-arena-text truncate flex-1 min-w-0">{entry.card.name}</span>
        <span class="flex items-center gap-0.5 flex-shrink-0 w-24 justify-start">
            {#each buildManaSymbols(entry.card.mana_cost) as symbol}
                <i class={`ms ms-cost ${symbol.class}`}></i>
            {/each}
        </span>
        <span class="text-xs text-arena-text-dim flex-shrink-0 w-16 text-right">
            {#if getCardPrice(entry.card) !== null}{formatPrice(getCardPrice(entry.card) * entry.quantity)}{:else}—{/if}
        </span>
        <span class="flex items-center gap-0.5 flex-shrink-0">
            <button onclick={() => updateEntryQuantity(entry.id, entry.quantity + 1)} class="w-5 h-5 rounded bg-black/60 text-green-400 hover:text-green-300 text-xs font-bold" title="Add">+</button>
            <button onclick={() => updateEntryQuantity(entry.id, entry.quantity - 1)} class="w-5 h-5 rounded bg-black/60 text-red-400 hover:text-red-300 text-xs font-bold" title="Remove">−</button>
        </span>
    </div>
{/snippet}

{#snippet listGroup(group)}
    <div class="space-y-1 rounded-lg border border-arena-accent/10 bg-arena-surface/60 p-3">
        <div class="text-sm font-medium text-arena-accent flex items-center gap-2">
            <span>{group.label}</span>
            <span class="text-arena-text-dim">({group.count})</span>
        </div>
        <div class="divide-y divide-arena-accent/10" role="list">
            {#each group.entries as entry (entry.id)}
                {@render listEntryRow(entry)}
            {/each}
        </div>
    </div>
{/snippet}

<div class="{embedded ? '' : 'py-12 px-4'}">
    <div class="{embedded ? '' : 'max-w-[1800px] mx-auto space-y-8'}">
        {#if !embedded}
        <div class="text-center space-y-4 animate-fade-in">
            <h1 class="font-magic text-4xl md:text-5xl font-bold text-arena-accent">Deck Architect</h1>
            <p class="text-lg text-arena-text-dim max-w-3xl mx-auto">
                Import, refine, save and export your decks.
            </p>
        </div>

        {#if !hasDeckEntries()}
        <section class="arena-card rounded-xl p-6 space-y-6 animate-slide-up">
            <div class="flex flex-col lg:flex-row lg:items-stretch gap-8">
                <div class="space-y-5 flex-1">
                    <h3 class="font-semibold text-arena-accent text-xl flex items-center gap-2">
                        <span>🕸️</span>Import from URL
                    </h3>
                    <input
                        type="url"
                        bind:value={importUrl}
                        placeholder="https://moxfield.com/decks/..."
                        class="w-full px-4 py-3 bg-arena-surface border border-arena-accent/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-arena-accent/30"
                    >
                    <p class="text-sm text-arena-text-dim">
                        Paste a public deck URL from Moxfield, Scryfall, MTGGoldfish, etc.
                    </p>
                    <button 
                        onclick={importFromUrl}
                        disabled={isImportingUrl}
                        class="arena-button px-6 py-3 rounded-lg font-semibold flex items-center gap-2 {isImportingUrl ? 'opacity-50' : ''}">
                        <span>🌐</span>Import from URL
                    </button>
                </div>
                <div class="flex items-center justify-center lg:flex-none lg:self-stretch">
                    <div class="flex flex-col items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-arena-muted h-full justify-center text-center">
                        <span class="h-6 w-px bg-arena-accent/30"></span>
                        <span>or</span>
                        <span class="h-6 w-px bg-arena-accent/30"></span>
                    </div>
                </div>
                <div class="space-y-3 flex-1">
                    <h3 class="font-semibold text-arena-accent text-xl flex items-center gap-2">
                        <span>📥</span>Import from text
                    </h3>
                    <textarea
                        bind:value={importText}
                        rows="4"
                        placeholder="4 Lightning Bolt&#10;4 Dragon's Rage Channeler&#10;..."
                        class="w-full px-4 py-3 bg-arena-surface border border-arena-accent/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-arena-accent/30"
                    ></textarea>
                    <button 
                        onclick={importFromText}
                        disabled={isParsing}
                        class="arena-button px-6 py-3 rounded-lg font-semibold {isParsing ? 'opacity-50' : ''}">
                        Import
                    </button>
                </div>
            </div>
            {#if importStatus.message}
                <div class="text-sm {importStatus.type === 'error' ? 'text-red-300' : 'text-arena-accent'}">
                    {importStatus.message}
                </div>
            {/if}
        </section>
        {/if}
        {/if}

        <section class="arena-card rounded-xl p-6 space-y-6 animate-slide-up">
            <div class="grid md:grid-cols-2 gap-4">
                <div>
                    <label for="deck-name" class="block text-sm font-semibold text-arena-muted uppercase tracking-wide mb-2">
                        Deck name
                    </label>
                    <input
                        type="text"
                        id="deck-name"
                        bind:value={state.deckName}
                        oninput={saveState}
                        placeholder="Untitled brew"
                        class="w-full px-4 py-3 bg-arena-surface border border-arena-accent/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-arena-accent/30"
                    >
                </div>
                <div>
                    <label for="deck-format" class="block text-sm font-semibold text-arena-muted uppercase tracking-wide mb-2">
                        Format
                    </label>
                    <select
                        id="deck-format"
                        bind:value={state.format}
                        onchange={saveState}
                        class="w-full px-4 py-3 bg-arena-surface border border-arena-accent/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-arena-accent/30"
                    >
                        <option value="standard">Standard</option>
                        <option value="modern">Modern</option>
                        <option value="pioneer">Pioneer</option>
                        <option value="pauper">Pauper</option>
                        <option value="legacy">Legacy</option>
                        <option value="vintage">Vintage</option>
                        <option value="duel_commander">Duel Commander</option>
                        <option value="commander_multi">Commander Multi</option>
                        <option value="draft">Draft</option>
                    </select>
                </div>
            </div>

            <div class="grid md:grid-cols-4 gap-4">
                <div class="p-4 bg-arena-surface rounded-lg border border-arena-accent/10 text-center">
                    <p class="text-sm uppercase tracking-wide text-arena-muted">Main deck</p>
                    <p class="text-3xl font-bold text-arena-accent mt-1">{stats.mainDeckTotal}</p>
                    <p class="text-xs text-arena-text-dim mt-2">Sideboard {showSideboard ? stats.sideboardTotal : 0}</p>
                </div>
                <div class="p-4 bg-arena-surface rounded-lg border border-arena-accent/10 text-center">
                    <p class="text-sm uppercase tracking-wide text-arena-muted">Deck price (Cardmarket)</p>
                    <p class="text-3xl font-bold text-arena-text mt-1">{pricingPending() ? 'N/A' : formatPrice(pricing.total)}</p>
                    <p class="text-xs text-arena-text-dim mt-2">
                        {#if pricingPending()}
                            Getting prices from Cardmarket...
                        {:else}
                            Main {formatPrice(pricing.main)} • Side {formatPrice(pricing.sideboard)}
                        {/if}
                    </p>
                    {#if !pricingPending() && pricing.missingCopies > 0}
                        <p class="text-xs text-red-300 mt-1">
                            {pricing.missingCopies} {pricing.missingCopies > 1 ? 'copies' : 'copy'} missing prices
                        </p>
                    {/if}
                </div>
                <div class="p-4 bg-arena-surface rounded-lg border border-arena-accent/10">
                    <p class="text-sm uppercase tracking-wide text-arena-muted">Colors</p>
                    <div class="flex flex-wrap gap-2 mt-2 text-sm">
                        {#each COLOR_ORDER as color}
                            {#if stats.colors[color]}
                                <span class="px-2 py-1 rounded-full text-xs font-semibold {COLOR_CLASSES[color]}">
                                    {COLOR_NAMES[color]} ({stats.colors[color]})
                                </span>
                            {/if}
                        {/each}
                    </div>
                </div>
                <div class="p-4 bg-arena-surface rounded-lg border border-arena-accent/10">
                    <p class="text-sm uppercase tracking-wide text-arena-muted">Mana curve</p>
                    <div class="h-42 flex items-end gap-1 mt-2 h-24">
                        {#each Object.entries(stats.manaCurve) as [label, count]}
                            <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                                <span class="text-xs text-arena-muted">{count}</span>
                                <div class="w-full bg-gradient-to-t from-arena-accent/30 to-arena-accent rounded-t"
                                     style="height: {Math.max(4, (count / (Math.max(...Object.values(stats.manaCurve)) || 1)) * 80)}px"></div>
                                <span class="text-xs text-arena-muted">{label}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
            
            <div>
                <p class="text-sm font-semibold text-arena-muted uppercase tracking-wide mb-2">Type counts</p>
                <div class="flex flex-wrap gap-2">
                    {#each Object.entries(stats.typeCounts) as [type, count]}
                        <div class="px-3 py-2 rounded-lg bg-arena-surface border border-arena-accent/20 text-sm flex items-center gap-2">
                            <span class="font-semibold">{count}</span>
                            <span>{getTypeLabel(type)}</span>
                            {#if type.includes('land')}
                                <span class="text-xs text-arena-text-dim bg-arena-accent/10 border border-arena-accent/20 px-2 py-1 rounded-full">
                                    💡 {getLandHintForFormat(state.format).recommendation}
                                </span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        </section>

        <section class="arena-card rounded-xl p-6 space-y-6 animate-slide-up mt-10">
            <div class="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 class="font-magic text-2xl text-arena-accent">Deck layout</h2>
                    <p class="text-arena-text-dim text-sm">Drag & drop cards between columns.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <div class="flex items-center gap-2">
                        <select bind:value={state.filters.color} onchange={saveState} class="bg-arena-surface border border-arena-accent/20 rounded px-3 py-2 text-sm">
                            <option value="all">All Colors</option>
                            <option value="W">White</option>
                            <option value="U">Blue</option>
                            <option value="B">Black</option>
                            <option value="R">Red</option>
                            <option value="G">Green</option>
                            <option value="C">Colorless</option>
                            <option value="multi">Multicolor</option>
                        </select>
                        <select bind:value={state.filters.rarity} onchange={saveState} class="bg-arena-surface border border-arena-accent/20 rounded px-3 py-2 text-sm">
                            <option value="all">All Rarities</option>
                            <option value="mythic">Mythic</option>
                            <option value="rare">Rare</option>
                            <option value="uncommon">Uncommon</option>
                            <option value="common">Common</option>
                        </select>
                        <select bind:value={state.sorting.sideboard} onchange={saveState} class="bg-arena-surface border border-arena-accent/20 rounded px-3 py-2 text-sm">
                            <option value="default">Sort: Default</option>
                            <option value="rarity">Rarity</option>
                            <option value="cmc">CMC</option>
                        </select>
                        <label class="flex items-center gap-2 text-sm text-arena-text">
                            <input type="checkbox" bind:checked={state.filters.sideboardOnly} onchange={saveState} class="rounded border-arena-accent/40 bg-arena-surface px-3 py-2" />
                            Filter sideboard only
                        </label>
                    </div>
                    <button onclick={() => showBasicLands = !showBasicLands} class="arena-button px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                        <span>🌱</span>Lands
                    </button>
                    <button onclick={exportDecklist} class="arena-button px-5 py-2 rounded-lg font-semibold flex items-center gap-2">
                        <span>📤</span>Export
                    </button>
                    <button onclick={openSearch} class="arena-button px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                        <span>🔍</span>Search
                    </button>
                    <button onclick={() => showListView = !showListView} class="arena-button px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                        <span>🗒️</span>{showListView ? 'Grid view' : 'List view'}
                    </button>
                </div>
            </div>

            {#if showBasicLands}
            <div class="rounded-lg border border-arena-accent/20 bg-arena-surface/80 p-4 space-y-4">
                <div class="flex justify-between">
                    <p class="text-sm text-arena-text">Tap a card to add.</p>
                    <button onclick={() => showBasicLands = false} class="text-sm text-arena-text-dim hover:text-arena-accent">Close ✕</button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {#each Object.entries(BASIC_LAND_PRESETS) as [key, land]}
                        <button 
                            onclick={() => addBasicLand(key)}
                            class="group relative rounded-xl overflow-hidden border border-arena-accent/20 bg-black/40 hover:ring-2 hover:ring-arena-accent transition">
                            <img src={land.image_url} alt={land.name} class="w-full aspect-[2/3] object-cover">
                            <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                <span class="font-bold text-white">+ Add</span>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
            {/if}

            {#if showListView}
                <div class="space-y-6">
                    <div class="grid md:grid-cols-2 gap-5">
                        <div class="space-y-4" role="list">
                            {#each mainColumnsSplit.left as group}
                                {@render listGroup(group)}
                            {/each}
                        </div>
                        {#if showSideboard}
                            <div class="space-y-4"
                                ondragover={(e) => handleListDragOver(e, 'sideboard')}
                                ondrop={(e) => handleListDrop(e, 'sideboard')}
                                role="list"
                            >
                                <div class="text-sm font-medium text-arena-accent">Sideboard ({stats.sideboardTotal})</div>
                                {#each sideboardGroups as group}
                                    {@render listGroup(group)}
                                {/each}
                            </div>
                        {:else}
                            <div class="space-y-4" role="list">
                                {#each mainColumnsSplit.right as group}
                                    {@render listGroup(group)}
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
                    {#each COLUMN_CONFIG as column}
                        {#if (column.key !== 'sideboard' || showSideboard) && (column.key !== 'commander' || showCommander || getColumnEntries('commander').length > 0)}
                            <div 
                                class="flex-1 min-w-[200px] flex flex-col gap-3 p-2 rounded-lg transition-colors {activeDropColumn === column.key ? 'bg-arena-accent/10 ring-2 ring-arena-accent/40' : ''}"
                                ondragover={(e) => handleDragOver(e, column.key)}
                                ondrop={(e) => handleDrop(e, column.key)}
                                role="listbox"
                                tabindex="0"
                            >
                                <div class="flex items-center justify-between text-sm font-semibold text-arena-muted">
                                    <span>{column.icon} {column.label}</span>
                                    <span>{getColumnEntries(column.key).reduce((sum, e) => sum + e.quantity, 0)}</span>
                                </div>
                                
                                <div class="flex flex-col min-h-[100px] pb-4">
                                    {#each sortEntriesForColumn(filterEntries(getColumnEntries(column.key), column.key), column.key) as entry (entry.id)}
                                        <div 
                                            class="relative group cursor-grab active:cursor-grabbing peer -mt-[120%] first:mt-0 hover:[&+.peer]:mt-0 transition-all duration-200 z-0"
                                            draggable="true"
                                            ondragstart={(e) => handleDragStart(e, entry.id)}
                                            onmouseenter={(e) => handleMouseEnter(e, entry)}
                                            onmousemove={(e) => handleMouseMove(e)}
                                            onmouseleave={() => handleMouseLeave()}
                                            role="option"
                                            aria-selected="false"
                                            tabindex="0"
                                        >
                                            <div class="relative rounded-xl overflow-hidden shadow-lg bg-arena-surface/40 border border-white/5 transition">
                                                {#if entry.card.image_url || entry.card.image}
                                                    <img src={entry.card.image_url || entry.card.image} alt={entry.card.name} class="w-full select-none pointer-events-none">
                                                {:else}
                                                    <div class="w-full h-32 flex flex-col items-center justify-center bg-arena-surface/80 text-center text-xs p-2">
                                                        <span class="font-bold">{entry.card.name}</span>
                                                        <span>{entry.card.mana_cost}</span>
                                                    </div>
                                                {/if}
                                                
                                                <div class="absolute bottom-1 left-1">
                                                    {#if getCardPrice(entry.card) !== null}
                                                        <span class="bg-black/70 text-white text-[11px] font-semibold px-2 py-1 rounded-full shadow-md">
                                                            {formatPrice(getCardPrice(entry.card))}
                                                        </span>
                                                    {:else}
                                                        <span class="bg-black/50 text-white/70 text-[10px] font-semibold px-2 py-1 rounded-full">
                                                            Prix N/A
                                                        </span>
                                                    {/if}
                                                </div>
                                                
                                                <div class="absolute top-1 right-1 flex flex-col items-center gap-1 z-20">
                                                    <div class="bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                                                        {entry.quantity}x
                                                    </div>
                                                    
                                                    <div class="opacity-0 group-hover:opacity-100 transition flex flex-col gap-1">
                                                        <button 
                                                            onclick={() => updateEntryQuantity(entry.id, entry.quantity + 1)} 
                                                            class="w-7 h-7 rounded-full bg-black/70 text-green-300 hover:text-green-200 border border-green-700/30 hover:border-green-600/40 shadow flex items-center justify-center font-bold text-sm transform hover:scale-105 transition"
                                                            title="Add copy"
                                                        >+</button>
                                                        <button 
                                                            onclick={() => updateEntryQuantity(entry.id, entry.quantity - 1)} 
                                                            class="w-7 h-7 rounded-full bg-black/70 text-red-300 hover:text-red-200 border border-red-700/30 hover:border-red-600/40 shadow flex items-center justify-center font-bold text-sm transform hover:scale-105 transition"
                                                            title="Remove copy"
                                                        >-</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                    {#if filterEntries(getColumnEntries(column.key), column.key).length === 0}
                                        <div class="h-24 border-2 border-dashed border-arena-accent/10 rounded-lg flex items-center justify-center text-arena-muted text-sm">
                                            Drop here
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    {/each}
                </div>
            {/if}
        </section>
    </div>
</div>

{#if showCopyToast}
<div class="fixed bottom-6 right-6 bg-arena-surface/90 border border-arena-accent/40 text-arena-text px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
    <span>✅</span>
    <span class="font-semibold text-sm">{copyToastMessage}</span>
</div>
{/if}
