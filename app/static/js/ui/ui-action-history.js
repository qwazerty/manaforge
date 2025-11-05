/**
 * ManaForge Action History Module
 * Maintains and renders the recent game action history in the UI.
 */

class UIActionHistory {
    static MAX_ENTRIES = 30;
    static entries = [];

    /**
     * Add an entry to the action history.
     */
    static addEntry(
        {
            action,
            player,
            success = true,
            details = null,
            timestamp = Date.now(),
            origin = 'system'
        },
        context = null
    ) {
        if (!action) {
            return;
        }

        const rawAction = action;
        const preparedDetails = this._prepareDetails(details, context);
        const entry = {
            action: this._formatLabel(rawAction),
            rawAction,
            player: this._formatPlayer(player),
            success: success !== false,
            details: preparedDetails.items,
            cardRefs: preparedDetails.cardRefs,
            timestamp: this._normalizeTimestamp(timestamp),
            origin,
            context
        };

        this._enrichCardDetails(entry, context);

        if (this._shouldSkipActionEntry(rawAction, entry)) {
            return;
        }

        this.entries.push(entry);
        if (this.entries.length > this.MAX_ENTRIES) {
            this.entries.shift();
        }

        this._render();
    }

    /**
     * Replace the current entries with a serialized list from the server.
     */
    static loadFromState(entries = []) {
        this.entries = [];

        if (!Array.isArray(entries) || entries.length === 0) {
            this._render();
            return;
        }

        for (const entry of entries) {
            this.addFromActionResult(entry);
        }
    }

    /**
     * Add an entry directly from a WebSocket action_result payload.
     */
    static addFromActionResult(actionResult) {
        if (!actionResult || !actionResult.action) {
            return;
        }

        const {
            action,
            player,
            success = true,
            timestamp,
            ...rest
        } = actionResult;

        const cleanedDetails = this._stripReservedKeys(rest);
        this.addEntry(
            {
                action,
                player,
                success,
                timestamp,
                details: cleanedDetails,
                origin: 'websocket'
            },
            { source: 'websocket', payload: actionResult }
        );
    }

    /**
     * Log a failure with a message.
     */
    static addFailure(
        action,
        message,
        player = null,
        details = null,
        context = null
    ) {
        const payload = details || (message ? { error: message } : null);
        const mergedContext = context || {
            source: 'error',
            payload: { action, message, player }
        };

        this.addEntry(
            {
                action,
                player,
                success: false,
                details: payload,
                origin: 'error'
            },
            mergedContext
        );
    }

    /**
     * Clear history and restore placeholder.
     */
    static clear() {
        this.entries = [];
        this._render();
    }

    // ===== RENDERING =====

    static _render() {
        const container = document.getElementById('action-history');
        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (this.entries.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.dataset.placeholder = 'true';
            placeholder.className = 'action-history-empty text-center';
            placeholder.textContent = 'No actions yet';
            container.appendChild(placeholder);
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const entry of [...this.entries].reverse()) {
            fragment.appendChild(this._createEntryElement(entry));
        }
        container.appendChild(fragment);
    }

    static _createEntryElement(entry) {
        const entryElement = document.createElement('div');
        entryElement.className = 'action-history-entry';

        const header = document.createElement('div');
        header.className = 'action-history-header';

        const playerSpan = document.createElement('span');
        playerSpan.className = 'action-history-player';
        playerSpan.textContent = entry.player;
        header.appendChild(playerSpan);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'action-history-time';
        timeSpan.textContent = this._formatTime(entry.timestamp);
        header.appendChild(timeSpan);

        const statusSpan = document.createElement('span');
        statusSpan.className = `action-history-status ${entry.success ? 'success' : 'failure'}`;
        statusSpan.textContent = entry.success ? 'Success' : 'Failed';
        header.appendChild(statusSpan);

        entryElement.appendChild(header);

        const actionSpan = document.createElement('div');
        actionSpan.className = 'action-history-action';
        actionSpan.textContent = entry.action;
        entryElement.appendChild(actionSpan);

        if (entry.details.length > 0) {
            for (const detail of entry.details) {
                const detailRow = document.createElement('div');
                detailRow.className = 'action-history-detail';

                if (detail.label) {
                    const labelSpan = document.createElement('span');
                    labelSpan.textContent = `${detail.label}: `;
                    labelSpan.style.fontWeight = '600';
                    detailRow.appendChild(labelSpan);
                }

                if (
                    detail.cardInfo &&
                    typeof GameCards !== 'undefined' &&
                    typeof GameCards.showCardPreview === 'function'
                ) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'action-history-card-link';
                    button.textContent = detail.cardInfo.name || detail.value;
                    button.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const info = detail.cardInfo;
                        const cardElement = this._findCardElement(info);
                        const previewImage =
                            info.imageUrl ||
                            (cardElement
                                ? cardElement.getAttribute('data-card-image')
                                : null) ||
                            null;
                        const cardId =
                            info.cardId ||
                            info.id ||
                            (cardElement
                                ? cardElement.getAttribute('data-card-id')
                                : null) ||
                            info.name ||
                            detail.value;
                        const cardName = info.name || detail.value;

                        GameCards.showCardPreview(cardId, cardName, previewImage, event, info);
                    });
                    detailRow.appendChild(button);
                } else {
                    const valueSpan = document.createElement('span');
                    valueSpan.textContent = detail.value;
                    detailRow.appendChild(valueSpan);
                }

                entryElement.appendChild(detailRow);
            }
        }

        return entryElement;
    }

    // ===== DETAIL PREPARATION =====

    static _prepareDetails(rawDetails, context) {
        const items = [];
        const cardRefs = [];

        const registerRef = (ref) => this._registerCardRef(cardRefs, ref);

        const addDetail = (label, value, key = null) => {
            if (value === undefined || value === null || value === '') {
                return;
            }

            const normalizedLabel = label ? this._formatLabel(label) : '';
            const ref = this._deriveCardRef(key ?? label, value);

            if (this._shouldSkipDetailLabel(key ?? label)) {
                if (ref) {
                    registerRef(ref);
                }
                return;
            }

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const nestedRef = this._extractCardRefFromObject(value);
                if (nestedRef) {
                    const registered = registerRef(nestedRef);
                    items.push({
                        label: normalizedLabel,
                        value: nestedRef.name
                            ? nestedRef.name
                            : this._formatCardName(
                                  nestedRef.cardId || nestedRef.name || '[Card]'
                              ),
                        cardRef: registered
                    });
                    return;
                }
            }

            const detail = {
                label: normalizedLabel,
                value: this._formatValue(value)
            };

            if (ref) {
                detail.cardRef = registerRef(ref);
            }

            items.push(detail);
        };

        if (!rawDetails) {
            const extraRefs = this._extractCardRefsFromContext(context);
            extraRefs.forEach(registerRef);
            return { items, cardRefs };
        }

        if (typeof rawDetails === 'string') {
            items.push({ label: '', value: rawDetails });
        } else if (Array.isArray(rawDetails)) {
            rawDetails.forEach((item) => {
                if (!item) {
                    return;
                }
                if (typeof item === 'string') {
                    items.push({ label: '', value: item });
                    return;
                }
                if (Array.isArray(item) && item.length >= 2) {
                    addDetail(item[0], item[1], item[0]);
                    return;
                }
                if (typeof item === 'object') {
                    const label = 'label' in item ? item.label : '';
                    const value = 'value' in item ? item.value : item;
                    addDetail(label, value, label);
                }
            });
        } else if (typeof rawDetails === 'object') {
            Object.entries(rawDetails).forEach(([key, value]) => {
                addDetail(key, value, key);
            });
        } else {
            items.push({ label: '', value: String(rawDetails) });
        }

        const extraRefs = this._extractCardRefsFromContext(context);
        extraRefs.forEach(registerRef);

        return { items, cardRefs };
    }

    static _registerCardRef(refs, ref) {
        if (!ref) {
            return null;
        }

        const candidate = { ...ref };
        for (const existing of refs) {
            if (
                (candidate.uniqueId && existing.uniqueId === candidate.uniqueId) ||
                (!candidate.uniqueId &&
                    candidate.cardId &&
                    existing.cardId === candidate.cardId)
            ) {
                Object.assign(existing, candidate);
                return existing;
            }
        }

        refs.push(candidate);
        return candidate;
    }

    static _shouldSkipActionEntry(action, entry) {
        if (!action) {
            return false;
        }

        const normalized = String(action).toLowerCase();

        if (normalized === 'flip_card') {
            return true;
        }

        if (normalized === 'move_card') {
            const payload = entry?.context?.payload || {};
            const sourceZoneFromPayload =
                payload.source_zone ??
                payload?.additional_data?.source_zone ??
                null;
            const targetZoneFromPayload =
                payload.target_zone ??
                payload?.additional_data?.target_zone ??
                null;

            const findDetailValue = (label) => {
                if (!entry?.details) {
                    return null;
                }
                const match = entry.details.find((detail) => {
                    if (!detail?.label) {
                        return false;
                    }
                    return detail.label.toLowerCase() === label.toLowerCase();
                });
                return match ? match.value : null;
            };

            const sourceZone =
                sourceZoneFromPayload ??
                findDetailValue('Source Zone') ??
                findDetailValue('Source zone');
            const targetZone =
                targetZoneFromPayload ??
                findDetailValue('Target Zone') ??
                findDetailValue('Target zone');

            if (
                sourceZone &&
                targetZone &&
                String(sourceZone).toLowerCase() ===
                    String(targetZone).toLowerCase()
            ) {
                return true;
            }
        }

        if (normalized !== 'tap_card') {
            return false;
        }

        if (!entry?.cardRefs || entry.cardRefs.length === 0) {
            return false;
        }

        return entry.cardRefs.some((ref) => {
            let info = ref.info;
            if (!info) {
                return false;
            }
            info = this._ensureCardInfoEnrichment(info);
            if (!info || !info.card_type) {
                return false;
            }
            return String(info.card_type).toLowerCase() === 'land';
        });
    }

    static _applyRefOverrides(ref, info) {
        if (!info) {
            return info;
        }

        const cardType =
            (ref && ref.cardType) ||
            info.card_type ||
            info.cardType ||
            null;

        if (cardType) {
            if (!info.card_type) {
                info.card_type = cardType;
            }
            if (!info.cardType) {
                info.cardType = cardType;
            }
        }

        return this._ensureCardInfoEnrichment(info);
    }

    static _ensureCardInfoEnrichment(info) {
        if (!info) {
            return info;
        }

        const needsType = !info.card_type && !info.cardType;
        const needsImage = !info.imageUrl && !info.image_url;
        const needsName = !info.name;

        if (!needsType && !needsImage && !needsName) {
            return info;
        }

        if (
            typeof GameCore === 'undefined' ||
            typeof GameCore.getGameState !== 'function'
        ) {
            return info;
        }

        const state = GameCore.getGameState();
        if (!state) {
            return info;
        }

        const ref = {
            cardId: info.cardId || info.card_id || null,
            uniqueId: info.uniqueId || info.unique_id || null,
            name: info.name || null
        };

        const card = this._searchCardInfoInState(state, ref);
        if (!card) {
            return info;
        }

        const enriched = this.createCardInfoFromCard(card);
        if (needsType && enriched.card_type) {
            info.card_type = enriched.card_type;
            info.cardType = enriched.card_type;
        }
        if (needsImage && enriched.image_url) {
            info.imageUrl = enriched.image_url;
        }
        if (needsName && enriched.name) {
            info.name = enriched.name;
        }

        return info;
    }

    static _enrichCardDetails(entry, context) {
        const refs = entry.cardRefs || [];
        const extraRefs = this._extractCardRefsFromContext(context);
        extraRefs.forEach((ref) => this._registerCardRef(refs, ref));

        refs.forEach((ref) => {
            const info = this._resolveCardInfo(ref);
            if (info) {
                ref.info = info;
            }
        });

        entry.details.forEach((detail) => {
            if (detail.cardRef && detail.cardRef.info) {
                const info = detail.cardRef.info;
                detail.value = info.name || detail.value;
                detail.cardInfo = info;
            } else if (
                detail.label &&
                detail.label.toLowerCase().includes('card')
            ) {
                detail.value = this._formatCardName(detail.value);
            }
        });
    }

    // ===== CARD RESOLUTION HELPERS =====

    static _deriveCardRef(key, value) {
        if (!key && typeof value !== 'object') {
            return null;
        }

        const normalizedKey = key ? String(key).toLowerCase() : '';
        const ref = {};

        if (typeof value === 'object' && value) {
            const nested = this._extractCardRefFromObject(value);
            if (nested) {
                return nested;
            }
        }

        if (typeof value === 'string') {
            if (normalizedKey.includes('unique')) {
                ref.uniqueId = value;
            }
            if (normalizedKey.includes('card')) {
                if (normalizedKey.includes('name')) {
                    ref.name = value;
                } else {
                    ref.cardId = value;
                }
            }
            if (normalizedKey.includes('type')) {
                ref.cardType = value;
            }
        }

        if (Object.keys(ref).length > 0) {
            return ref;
        }

        return null;
    }

    static _extractCardRefFromObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return null;
        }

        const ref = {};
        if (obj.unique_id) ref.uniqueId = obj.unique_id;
        if (obj.uniqueId) ref.uniqueId = obj.uniqueId;
        if (obj.card_unique_id) ref.uniqueId = obj.card_unique_id;
        if (obj.card_id) ref.cardId = obj.card_id;
        if (obj.cardId) ref.cardId = obj.cardId;
        if (obj.id) ref.cardId = obj.id;
        if (obj.name) ref.name = obj.name;
        if (obj.card_name) ref.name = obj.card_name;
        if (obj.image_url) ref.imageUrl = obj.image_url;
        if (obj.card_type) ref.cardType = obj.card_type;
        if (obj.cardType) ref.cardType = obj.cardType;

        if (Object.keys(ref).length > 0) {
            return ref;
        }

        return null;
    }

    static _extractCardRefsFromContext(context) {
        if (!context) {
            return [];
        }

        const payload = context.payload ?? context;
        const refs = [];
        const visited = new WeakSet();

        const visit = (value, key = null, depth = 0) => {
            if (
                value === null ||
                value === undefined ||
                depth > 4 ||
                typeof value === 'function'
            ) {
                return;
            }

            if (typeof value === 'string' || typeof value === 'number') {
                const ref = this._deriveCardRef(key, String(value));
                if (ref) {
                    refs.push(ref);
                }
                return;
            }

            if (typeof value !== 'object') {
                return;
            }

            if (visited.has(value)) {
                return;
            }
            visited.add(value);

            const objRef = this._extractCardRefFromObject(value);
            if (objRef) {
                refs.push(objRef);
            }

            if (Array.isArray(value)) {
                value.forEach((item) => visit(item, key, depth + 1));
            } else {
                Object.entries(value).forEach(([childKey, childValue]) => {
                    const derived = this._deriveCardRef(childKey, childValue);
                    if (derived) {
                        refs.push(derived);
                    }
                    visit(childValue, childKey, depth + 1);
                });
            }
        };

        visit(payload);
        return refs;
    }

    static _resolveCardInfo(ref) {
        if (ref.info) {
            return ref.info;
        }

        const element = this._findCardElement(ref);
        if (element) {
            let info = {
                name:
                    element.getAttribute('data-card-name') ||
                    this._formatCardName(ref.name || ref.cardId || 'Card'),
                imageUrl: element.getAttribute('data-card-image') || null,
                cardId:
                    element.getAttribute('data-card-id') ||
                    ref.cardId ||
                    null,
                uniqueId:
                    element.getAttribute('data-card-unique-id') ||
                    ref.uniqueId ||
                    null
            };
            info = this._applyRefOverrides(ref, info);
            ref.info = info;
            return info;
        }

        const state =
            typeof GameCore !== 'undefined' && GameCore.getGameState
                ? GameCore.getGameState()
                : null;

        if (state) {
            const card = this._searchCardInfoInState(state, ref);
            if (card) {
                let info = {
                    name: card.name || this._formatCardName(ref.cardId || ref.name || 'Card'),
                    imageUrl: card.image_url || null,
                    cardId: card.id || ref.cardId || null,
                    uniqueId: card.unique_id || ref.uniqueId || null,
                    card_type: card.card_type || null,
                    cardType: card.card_type || null
                };
                info = this._applyRefOverrides(ref, info);
                ref.info = info;
                return info;
            }
        }

        if (ref.name) {
            let info = {
                name: this._formatCardName(ref.name),
                imageUrl: ref.imageUrl || null,
                cardId: ref.cardId || null,
                uniqueId: ref.uniqueId || null,
                card_type: ref.cardType || null,
                cardType: ref.cardType || null
            };
            info = this._applyRefOverrides(ref, info);
            ref.info = info;
            return info;
        }

        if (ref.cardId) {
            let info = {
                name: this._formatCardName(ref.cardId),
                imageUrl: ref.imageUrl || null,
                cardId: ref.cardId,
                uniqueId: ref.uniqueId || null,
                card_type: ref.cardType || null,
                cardType: ref.cardType || null
            };
            info = this._applyRefOverrides(ref, info);
            ref.info = info;
            return info;
        }

        return null;
    }

    static createCardInfoFromCard(card) {
        const info = {
            id: card.id || card.card_id || null,
            card_id: card.id || card.card_id || null,
            unique_id: card.unique_id || null,
            name: card.name || null,
            image_url: null,
            card_type: card.card_type || null,
            cardType: card.card_type || null
        };

        if (
            typeof GameCards !== 'undefined' &&
            typeof GameCards.getSafeImageUrl === 'function'
        ) {
            info.image_url = GameCards.getSafeImageUrl(card);
        } else if (card.image_url) {
            info.image_url = card.image_url;
        } else if (
            Array.isArray(card.card_faces) &&
            card.card_faces.length > 0
        ) {
            const face = card.card_faces[card.current_face || 0] || card.card_faces[0];
            if (face && face.image_url) {
                info.image_url = face.image_url;
            }
            if (!info.name && face && face.name) {
                info.name = face.name;
            }
        }

        if (!info.name) {
            const fallback = info.card_id || card.unique_id || card.id;
            if (fallback) {
                info.name = this._formatCardName(fallback);
            }
        }

        return info;
    }

    static _searchCardInfoInState(state, ref) {
        const matchCard = (card) => {
            if (!card) {
                return null;
            }

            if (ref.uniqueId && card.unique_id === ref.uniqueId) {
                return card;
            }

            if (
                ref.cardId &&
                (card.id === ref.cardId || card.card_id === ref.cardId)
            ) {
                return card;
            }

            if (
                ref.name &&
                card.name &&
                this._formatCardName(card.name) === this._formatCardName(ref.name)
            ) {
                return card;
            }

            return null;
        };

        const zones = ['hand', 'battlefield', 'graveyard', 'exile', 'temporary_zone'];

        if (Array.isArray(state.stack)) {
            for (const spell of state.stack) {
                const match = matchCard(spell);
                if (match) {
                    return match;
                }
            }
        }

        if (Array.isArray(state.players)) {
            for (const player of state.players) {
                for (const zoneName of zones) {
                    const zone = player[zoneName];
                    if (!Array.isArray(zone)) {
                        continue;
                    }
                    for (const card of zone) {
                        const match = matchCard(card);
                        if (match) {
                            return match;
                        }
                    }
                }
            }
        }

        return null;
    }

    static _findCardElement(ref) {
        if (typeof document === 'undefined') {
            return null;
        }

        if (ref.uniqueId) {
            const byUnique = document.querySelector(
                `[data-card-unique-id="${ref.uniqueId}"]`
            );
            if (byUnique) {
                return byUnique;
            }
        }

        if (ref.cardId) {
            const byId = document.querySelector(
                `[data-card-id="${ref.cardId}"]`
            );
            if (byId) {
                return byId;
            }
        }

        if (ref.name) {
            const normalized = this._formatCardName(ref.name);
            const byName = Array.from(
                document.querySelectorAll('[data-card-name]')
            ).find(
                (el) =>
                    this._formatCardName(
                        el.getAttribute('data-card-name')
                    ) === normalized
            );
            if (byName) {
                return byName;
            }
        }

        return null;
    }

    // ===== FORMATTING HELPERS =====

    static _normalizeTimestamp(timestamp) {
        if (!timestamp) {
            return Date.now();
        }
        if (typeof timestamp === 'number') {
            if (timestamp < 1e12) {
                return Math.floor(timestamp * 1000);
            }
            return Math.floor(timestamp);
        }
        return Date.now();
    }

    static _formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    static _formatLabel(text) {
        if (!text) {
            return '';
        }
        return String(text)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    static _formatPlayer(player) {
        if (!player) {
            return 'Unknown';
        }

        if (typeof player !== 'string') {
            return this._formatLabel(player);
        }

        if (player.toLowerCase() === 'spectator') {
            return 'Spectator';
        }

        const match = player.match(/player(\d+)/i);
        if (match) {
            return `Player ${match[1]}`;
        }

        return this._formatLabel(player);
    }

    static _formatValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }

        return String(value);
    }

    static _formatCardName(value) {
        if (!value) {
            return '';
        }
        const text = String(value)
            .replace(/[_-]+/g, ' ')
            .trim();
        return text
            .split(' ')
            .filter((part) => part.length)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    static _shouldSkipDetailLabel(label) {
        if (!label) {
            return false;
        }
        const normalized = String(label).toLowerCase().replace(/[\s_-]/g, '');
        return (
            normalized.includes('uniqueid') ||
            normalized === 'broadcastdata' ||
            normalized === 'success' ||
            normalized === 'timestamp' ||
            normalized === 'origin'
        );
    }

    static _stripReservedKeys(payload) {
        if (!payload || typeof payload !== 'object') {
            return payload;
        }

        const reserved = new Set([
            'broadcast_data',
            'success',
            'action',
            'player',
            'timestamp',
            'origin'
        ]);

        const cleaned = {};
        Object.entries(payload).forEach(([key, value]) => {
            if (reserved.has(key)) {
                return;
            }
            cleaned[key] = value;
        });

        return cleaned;
    }
}

window.UIActionHistory = UIActionHistory;
