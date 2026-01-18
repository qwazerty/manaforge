/**
 * Card Catalog Store
 *
 * Caches CardDefinition objects indexed by card_id.
 * Used to hydrate CardInstance objects into full Card objects
 * for UI rendering. This reduces payload size by deduplicating
 * static card data across multiple instances.
 *
 * @see PLAN_OPTIM_GAME_STATE.md for architecture details
 */

import { get, writable } from 'svelte/store';

/**
 * @typedef {Object} CardDefinition
 * @property {string} card_id - Unique card identifier
 * @property {string} [scryfall_id] - Scryfall's unique ID
 * @property {string} name - Card name
 * @property {string} mana_cost - Mana cost string
 * @property {number} cmc - Converted mana cost
 * @property {string} card_type - Primary card type
 * @property {string} subtype - Card subtype
 * @property {string} text - Card text/abilities
 * @property {number|string} [power] - Base power
 * @property {number|string} [toughness] - Base toughness
 * @property {string[]} colors - Card colors
 * @property {string} rarity - Card rarity
 * @property {string} [image_url] - Card image URL
 * @property {boolean} is_double_faced - Has multiple faces
 * @property {Object[]} card_faces - Face data for DFCs
 * @property {string} [set] - Set code
 * @property {string} [set_name] - Full set name
 */

/**
 * @typedef {Object} CardInstance
 * @property {string} unique_id - Unique instance identifier
 * @property {string} [card_id] - Reference to CardDefinition (may be absent for face-down)
 * @property {string} [scryfall_id] - Scryfall ID reference
 * @property {string} owner_id - ID of the player who owns this card
 * @property {string} [controller_id] - ID of the player who currently controls this card
 * @property {string} zone - Current zone
 * @property {boolean} tapped - Whether the card is tapped
 * @property {boolean} attacking - Whether attacking
 * @property {string} [blocking] - Unique ID of blocked attacker
 * @property {boolean} targeted - Whether targeted
 * @property {Object} counters - Counters on the card
 * @property {number} [damage] - Damage marked on the card
 * @property {boolean} [summoning_sick] - Whether the card has summoning sickness
 * @property {boolean} face_down - Whether face-down
 * @property {string} [face_down_owner] - Player ID who can see face-down card
 * @property {number} current_face - Current face index for DFCs
 * @property {string} [attached_to] - Host card unique_id
 * @property {number} [attachment_order] - Attachment ordering
 * @property {string[]} custom_keywords - Added keywords
 * @property {string[]} custom_types - Type overrides
 * @property {string} [current_power] - Overridden power
 * @property {string} [current_toughness] - Overridden toughness
 * @property {number} [loyalty] - Current planeswalker loyalty
 * @property {boolean} is_commander - Whether this is a commander
 * @property {boolean} is_token - Whether this is a token
 */

/** @type {import('svelte/store').Writable<Map<string, CardDefinition>>} */
const cardCatalog = writable(new Map());

/** @type {Set<string>} - Track card IDs currently being fetched to avoid duplicate requests */
const pendingFetches = new Set();

/**
 * Update the card catalog with new definitions.
 * Merges with existing catalog (does not replace).
 *
 * @param {Record<string, CardDefinition>} catalog - Object of card definitions keyed by card_id
 */
function updateCatalog(catalog) {
    if (!catalog || typeof catalog !== 'object') {
        return;
    }

    cardCatalog.update((currentMap) => {
        for (const [cardId, definition] of Object.entries(catalog)) {
            currentMap.set(cardId, definition);
        }
        return currentMap;
    });
}

/**
 * Fetch a card definition from the API and add it to the catalog.
 * Uses deduplication to avoid multiple requests for the same card.
 *
 * @param {string} cardId - The card_id to fetch
 * @returns {Promise<CardDefinition|null>} The card definition or null if fetch failed
 */
async function fetchCardDefinition(cardId) {
    if (!cardId) {
        return null;
    }

    const key = String(cardId);

    // Check if already in catalog
    const existing = get(cardCatalog).get(key);
    if (existing) {
        return existing;
    }

    // Check if already being fetched
    if (pendingFetches.has(key)) {
        // Wait a bit and check again
        await new Promise((resolve) => setTimeout(resolve, 100));
        return get(cardCatalog).get(key) || null;
    }

    pendingFetches.add(key);

    try {
        const response = await fetch(`/api/v1/cards/${encodeURIComponent(cardId)}`);
        if (!response.ok) {
            console.warn(`Failed to fetch card definition for ${cardId}: ${response.status}`);
            return null;
        }

        const cardData = await response.json();

        // Convert to CardDefinition format and store
        const definition = {
            card_id: cardData.id || cardId,
            scryfall_id: cardData.scryfall_id,
            name: cardData.name,
            mana_cost: cardData.mana_cost || '',
            cmc: cardData.cmc || 0,
            card_type: cardData.card_type,
            subtype: cardData.subtype || '',
            text: cardData.text || '',
            power: cardData.power,
            toughness: cardData.toughness,
            colors: cardData.colors || [],
            rarity: cardData.rarity || 'common',
            image_url: cardData.image_url,
            is_double_faced: cardData.is_double_faced || false,
            card_faces: cardData.card_faces || [],
            set: cardData.set,
            set_name: cardData.set_name,
        };

        // Add to catalog
        cardCatalog.update((currentMap) => {
            currentMap.set(key, definition);
            return currentMap;
        });

        return definition;
    } catch (error) {
        console.error(`Error fetching card definition for ${cardId}:`, error);
        return null;
    } finally {
        pendingFetches.delete(key);
    }
}

/**
 * Fetch multiple card definitions in batch.
 * Filters out cards already in catalog before fetching.
 *
 * @param {string[]} cardIds - Array of card_ids to fetch
 * @returns {Promise<void>}
 */
async function fetchMissingDefinitions(cardIds) {
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
        return;
    }

    const catalog = get(cardCatalog);
    const missing = cardIds.filter((id) => id && !catalog.has(String(id)));

    if (missing.length === 0) {
        return;
    }

    // Fetch in parallel with some concurrency limit
    const BATCH_SIZE = 10;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((id) => fetchCardDefinition(id)));
    }
}

/**
 * Get a card definition from the catalog.
 *
 * @param {string} cardId - The card_id to look up
 * @returns {CardDefinition|undefined} The card definition or undefined if not found
 */
function getCardDefinition(cardId) {
    if (!cardId) {
        return undefined;
    }
    const key = String(cardId);
    const catalog = get(cardCatalog);
    return catalog.get(key) ?? catalog.get(cardId);
}

/**
 * Hydrate a CardInstance into a full Card object for UI rendering.
 * Merges static data from CardDefinition (from cache) with dynamic state from CardInstance.
 * If the card definition is not in cache, returns a minimal object.
 * The UI can trigger a fetch to /api/v1/cards/{card_id} for missing definitions.
 *
 * @param {CardInstance} instance - The card instance
 * @returns {Object} A full card object suitable for UI rendering
 */
function hydrateCard(instance) {
    if (!instance) {
        return null;
    }

    const definitionKey = instance.card_id || instance.scryfall_id;
    const isFaceDown = Boolean(instance.face_down);

    // For face-down cards without card_id, return a minimal placeholder
    if (!definitionKey) {
        const placeholderId = isFaceDown ? 'face_down_hidden' : (instance.unique_id || 'unknown');
        const placeholderName = isFaceDown
            ? 'Face Down'
            : `Unknown (${instance.unique_id || 'card'})`;
        return {
            unique_id: instance.unique_id,
            id: placeholderId,
            card_id: instance.card_id || null,
            scryfall_id: instance.scryfall_id || null,
            name: placeholderName,
            card_type: 'unknown',
            face_down: isFaceDown,
            tapped: instance.tapped || false,
            attacking: instance.attacking || false,
            blocking: instance.blocking || null,
            targeted: instance.targeted || false,
            counters: instance.counters || {},
            damage: instance.damage,
            summoning_sick: instance.summoning_sick,
            current_face: instance.current_face || 0,
            attached_to: instance.attached_to || null,
            attachment_order: instance.attachment_order,
            custom_keywords: instance.custom_keywords || [],
            custom_types: instance.custom_types || [],
            current_power: instance.current_power,
            current_toughness: instance.current_toughness,
            base_power: instance.base_power,
            base_toughness: instance.base_toughness,
            loyalty: instance.loyalty,
            is_commander: instance.is_commander || false,
            is_token: instance.is_token || false,
            owner_id: instance.owner_id,
            controller_id: instance.controller_id,
            zone: instance.zone,
        };
    }

    // Get definition from local cache
    const definition = getCardDefinition(definitionKey);

    if (!definition) {
        // Cache miss - return instance with minimal data
        // The UI should handle fetching missing definitions via /api/v1/cards/{card_id}
        console.warn(`Card catalog miss for card_id: ${definitionKey}`);
        return {
            unique_id: instance.unique_id,
            id: definitionKey,
            card_id: instance.card_id || definitionKey,
            scryfall_id: instance.scryfall_id,
            name: `Unknown (${definitionKey})`,
            card_type: 'unknown',
            face_down: instance.face_down || false,
            tapped: instance.tapped || false,
            attacking: instance.attacking || false,
            blocking: instance.blocking || null,
            targeted: instance.targeted || false,
            counters: instance.counters || {},
            damage: instance.damage,
            summoning_sick: instance.summoning_sick,
            current_face: instance.current_face || 0,
            attached_to: instance.attached_to || null,
            attachment_order: instance.attachment_order,
            custom_keywords: instance.custom_keywords || [],
            custom_types: instance.custom_types || [],
            current_power: instance.current_power,
            current_toughness: instance.current_toughness,
            base_power: instance.base_power,
            base_toughness: instance.base_toughness,
            loyalty: instance.loyalty,
            is_commander: instance.is_commander || false,
            is_token: instance.is_token || false,
            owner_id: instance.owner_id,
            controller_id: instance.controller_id,
            zone: instance.zone,
        };
    }

    // Merge definition (static) with instance (dynamic)
    // Instance properties override definition properties where applicable
    const resolvedCardId = definition.card_id || definitionKey;
    return {
        // From definition (static)
        id: resolvedCardId,
        card_id: resolvedCardId,
        scryfall_id: definition.scryfall_id || instance.scryfall_id,
        name: definition.name,
        mana_cost: definition.mana_cost || '',
        cmc: definition.cmc || 0,
        card_type: definition.card_type,
        subtype: definition.subtype || '',
        text: definition.text || '',
        power: definition.power,
        toughness: definition.toughness,
        colors: definition.colors || [],
        rarity: definition.rarity || 'common',
        image_url: definition.image_url,
        is_double_faced: definition.is_double_faced || false,
        card_faces: definition.card_faces || [],
        set: definition.set,
        set_name: definition.set_name,

        // From instance (dynamic)
        unique_id: instance.unique_id,
        owner_id: instance.owner_id,
        controller_id: instance.controller_id,
        zone: instance.zone,
        tapped: instance.tapped || false,
        attacking: instance.attacking || false,
        blocking: instance.blocking || null,
        targeted: instance.targeted || false,
        counters: instance.counters || {},
        damage: instance.damage,
        summoning_sick: instance.summoning_sick,
        face_down: instance.face_down || false,
        face_down_owner: instance.face_down_owner,
        current_face: instance.current_face || 0,
        attached_to: instance.attached_to || null,
        attachment_order: instance.attachment_order,
        custom_keywords: instance.custom_keywords || [],
        custom_types: instance.custom_types || [],
        current_power: instance.current_power,
        current_toughness: instance.current_toughness,
        base_power: instance.base_power,
        base_toughness: instance.base_toughness,
        loyalty: instance.loyalty,
        is_commander: instance.is_commander || false,
        is_token: instance.is_token || false,
    };
}

/**
 * Hydrate a compact game state into the legacy format expected by the UI.
 * Converts players[].zones (arrays of unique_ids) into players[].zone (arrays of Card objects).
 * Fetches any missing card definitions from the API before hydrating.
 *
 * @param {Object} compactState - The compact game state from the API
 * @returns {Promise<Object>} A game state in the legacy format with full Card objects
 */
async function hydrateGameState(compactState) {
    if (!compactState) {
        return null;
    }

    const players = Array.isArray(compactState.players) ? compactState.players : [];
    const hasZonesObject = players.some((player) => player && player.zones && typeof player.zones === 'object');
    const hasCompactCollections = Boolean(compactState.card_instances);

    // Check if this is already a legacy format (no compact fields/zones present)
    if (!hasZonesObject && !hasCompactCollections) {
        // Already hydrated or legacy format
        return compactState;
    }

    const cardInstances = compactState.card_instances || {};

    // Fetch any missing card definitions before hydrating
    const missingCardIds = collectMissingCardIds(cardInstances, players);
    if (missingCardIds.length > 0) {
        await fetchMissingDefinitions(missingCardIds);
    }

    // Zone mapping: compact format uses 'zones' object, legacy uses direct properties
    const ZONE_NAMES = [
        'hand',
        'battlefield',
        'graveyard',
        'exile',
        'library',
        'commander_zone',
        'reveal_zone',
        'look_zone',
    ];

    // Zones that store card_ids directly (not unique_ids)
    const HIDDEN_ZONES = new Set(['library']);

    // Hydrate players
    const hydratedPlayers = (compactState.players || []).map((player) => {
        const hydratedPlayer = {
            id: player.id,
            name: player.name,
            deck_name: player.deck_name,
            life: player.life,
            mana_pool: player.mana_pool || {},
            counters: player.counters || {},
            commander_tax: player.commander_tax || 0,
        };

        // Hydrate each zone
        const zones = player.zones || {};
        for (const zoneName of ZONE_NAMES) {
            const zoneData = zones[zoneName] || [];
            const isHiddenZone = HIDDEN_ZONES.has(zoneName);

            if (isHiddenZone) {
                // Hidden zones: zoneData contains card_ids directly
                hydratedPlayer[zoneName] = zoneData.map((cardId, index) => {
                    const uniqueId = `${player.id}:${zoneName}:${index}`;
                    const minimalInstance = {
                        unique_id: uniqueId,
                        card_id: cardId,
                        owner_id: player.id,
                        controller_id: player.id,
                        zone: zoneName,
                        tapped: false,
                        face_down: false,
                        current_face: 0,
                        is_token: false,
                    };
                    return hydrateCard(minimalInstance);
                }).filter(Boolean);
            } else {
                // Regular zones: use card_instances
                hydratedPlayer[zoneName] = zoneData
                    .map((uniqueId) => {
                        const instance = cardInstances[uniqueId];
                        if (instance) {
                            return hydrateCard(instance);
                        }
                        console.warn(`Missing card instance for unique_id: ${uniqueId} in zone ${zoneName}`);
                        return null;
                    })
                    .filter(Boolean);
            }
        }

        return hydratedPlayer;
    });

    // Hydrate stack
    const stackIds = compactState.stack || [];
    const hydratedStack = stackIds
        .map((uniqueId) => {
            const instance = cardInstances[uniqueId];
            if (!instance) {
                return null;
            }
            return hydrateCard(instance);
        })
        .filter(Boolean);

    const hydratedState = {
        ...compactState,
        // Use game_id from compact format, fall back to id
        id: compactState.game_id || compactState.id,
        players: hydratedPlayers,
        stack: hydratedStack,
        action_history: compactState.action_history || [],
        chat_log: compactState.chat_log || [],
        targeting_arrows: compactState.targeting_arrows || [],
    };

    delete hydratedState.card_instances;
    delete hydratedState.card_catalog;
    delete hydratedState.hidden_zone_cards;

    return hydratedState;
}

/**
 * Collect all card_ids that are not in the catalog.
 *
 * @param {Object} cardInstances - Map of unique_id -> CardInstance
 * @param {Array} players - Array of player objects with zones
 * @returns {string[]} Array of missing card_ids
 */
function collectMissingCardIds(cardInstances, players) {
    const catalog = get(cardCatalog);
    const missing = new Set();

    // Check card_instances
    for (const instance of Object.values(cardInstances)) {
        const cardId = instance.card_id || instance.scryfall_id;
        if (cardId && !catalog.has(String(cardId))) {
            missing.add(cardId);
        }
    }

    // Check hidden zones (library contains card_ids directly)
    const HIDDEN_ZONES = ['library'];
    for (const player of players) {
        const zones = player.zones || {};
        for (const zoneName of HIDDEN_ZONES) {
            const cardIds = zones[zoneName] || [];
            for (const cardId of cardIds) {
                if (cardId && !catalog.has(String(cardId))) {
                    missing.add(cardId);
                }
            }
        }
    }

    return Array.from(missing);
}

/**
 * Clear the card catalog (useful for testing or when switching games).
 */
function clearCatalog() {
    cardCatalog.set(new Map());
}

/**
 * Get the current catalog size (for debugging).
 *
 * @returns {number} The number of card definitions in the catalog
 */
function getCatalogSize() {
    return get(cardCatalog).size;
}

export {
    cardCatalog,
    updateCatalog,
    getCardDefinition,
    fetchCardDefinition,
    fetchMissingDefinitions,
    hydrateCard,
    hydrateGameState,
    clearCatalog,
    getCatalogSize,
};
