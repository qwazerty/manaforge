/**
 * ManaForge Action History Module
 * Maintains and renders the recent game action history in the UI.
 */

class UIActionHistory {
    static MAX_ENTRIES = 5000;
    static entries = [];
    static entrySignatures = new Set();
    static _actionHistoryComponent = null;
    static _actionHistoryTarget = null;
    static _previewHandlers = null;

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
        const metadata = this._extractEntryMetadata(context);
        const entry = {
            action: this._formatLabel(rawAction),
            rawAction,
            displayAction: null,
            player: this._formatPlayer(player),
            success: success !== false,
            details: preparedDetails.items,
            cardRefs: preparedDetails.cardRefs,
            timestamp: this._normalizeTimestamp(timestamp),
            origin,
            context,
            phase: metadata.phase || null,
            turn: metadata.turn || null,
            turnPlayerId: metadata.turnPlayerId || null,
            turnPlayerName: metadata.turnPlayerName || null,
            turnPlayerLabel: metadata.turnPlayerLabel || null
        };

        const entrySignature = this._buildEntrySignature({
            action: rawAction,
            player,
            success: entry.success,
            timestamp,
            origin,
            phase: entry.phase,
            turn: entry.turn
        });

        if (entrySignature && this.entrySignatures.has(entrySignature)) {
            return;
        }

        entry.displayAction = this._buildActionTitle(entry);

        this._enrichCardDetails(entry, context);
        this._applyActionSpecificDetailOverrides(entry);

        if (this._shouldSkipActionEntry(rawAction, entry)) {
            return;
        }

        entry._signature = entrySignature;
        if (entrySignature) {
            this.entrySignatures.add(entrySignature);
        }

        this.entries.push(entry);
        if (this.entries.length > this.MAX_ENTRIES) {
            const removed = this.entries.shift();
            if (removed && removed._signature) {
                this.entrySignatures.delete(removed._signature);
            }
        }

        this._render();
    }

    /**
     * Replace the current entries with a serialized list from the server.
     */
    static loadFromState(entries = []) {
        this.entries = [];
        this.entrySignatures.clear();

        if (!Array.isArray(entries) || entries.length === 0) {
            this._render();
            return;
        }

        for (const entry of entries) {
            this.addFromActionResult(entry, { source: 'state' });
        }
    }

    /**
     * Merge entries from the latest synchronized game state.
     */
    static mergeStateEntries(entries = []) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return;
        }

        for (const entry of entries) {
            if (!entry || typeof entry !== 'object') {
                continue;
            }

            const signature = this._buildEntrySignature(entry);
            if (signature && this.entrySignatures.has(signature)) {
                continue;
            }

            this.addFromActionResult(entry, { source: 'state-sync' });
        }
    }

    /**
     * Add an entry directly from a WebSocket action_result payload.
     */
    static addFromActionResult(actionResult, options = null) {
        if (!actionResult || !actionResult.action) {
            return;
        }

        const resolvedSource = options && options.source ? options.source : 'websocket';

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
            { source: resolvedSource, payload: actionResult }
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
        this.entrySignatures.clear();
        this._render();
    }

    // ===== RENDERING =====

    static _render() {
        const component = this._ensureActionHistoryComponent();
        if (!component) {
            return;
        }

        try {
            component.$set(this._buildComponentProps());
        } catch (error) {
            console.error('Failed to update action history component', error);
        }
    }

    static _buildComponentProps() {
        return {
            entries: Array.isArray(this.entries) ? [...this.entries] : [],
            panelIcon: '📜',
            panelTitle: 'Action History',
            previewHandlers: this._getCardPreviewHandlers()
        };
    }

    static _ensureActionHistoryComponent() {
        if (typeof document === 'undefined') {
            return null;
        }

        if (typeof ActionHistoryComponent === 'undefined') {
            return null;
        }

        const container = document.getElementById('action-history-panel');
        if (!container) {
            this._destroyActionHistoryComponent();
            return null;
        }

        if (this._actionHistoryComponent && this._actionHistoryTarget === container) {
            return this._actionHistoryComponent;
        }

        this._destroyActionHistoryComponent();

        try {
            container.innerHTML = '';
            const mount = typeof ActionHistoryComponent.mount === 'function'
                ? ActionHistoryComponent.mount
                : null;
            if (!mount) {
                throw new Error('ActionHistoryComponent.mount is not available');
            }
            this._actionHistoryComponent = mount(ActionHistoryComponent.default, {
                target: container,
                props: this._buildComponentProps()
            });
            this._actionHistoryTarget = container;
        } catch (error) {
            console.error('Failed to initialize action history component', error);
            this._actionHistoryComponent = null;
            this._actionHistoryTarget = null;
        }

        return this._actionHistoryComponent;
    }

    static _destroyActionHistoryComponent() {
        if (this._actionHistoryComponent) {
            try {
                if (typeof ActionHistoryComponent?.unmount === 'function') {
                    ActionHistoryComponent.unmount(this._actionHistoryComponent);
                } else if (typeof this._actionHistoryComponent.$destroy === 'function') {
                    this._actionHistoryComponent.$destroy();
                }
            } catch (error) {
                console.error('Failed to destroy action history component', error);
            }
        }
        this._actionHistoryComponent = null;
        this._actionHistoryTarget = null;
    }

    /**
     * Request a UI refresh for the action history panel.
     * Useful when the container is re-rendered by another framework.
     */
    static refreshPanel() {
        this._render();
    }

    static _getCardPreviewHandlers() {
        if (!this._previewHandlers) {
            this._previewHandlers = {
                show: (event, cardInfo, fallbackValue = '', element = null) =>
                    this._handleCardPreviewShow(event, cardInfo, fallbackValue, element),
                move: (event) => this._handleCardPreviewMove(event),
                hide: () => this._handleCardPreviewHide()
            };
        }
        return this._previewHandlers;
    }

    static _handleCardPreviewShow(event, cardInfo, fallbackValue = '', element = null) {
        const previewInfo =
            cardInfo ||
            this._buildPreviewInfoFromFallback(fallbackValue);

        if (!previewInfo) {
            return;
        }

        if (
            typeof GameCards === 'undefined' ||
            typeof GameCards.showCardPreview !== 'function'
        ) {
            return;
        }

        const payload = this._resolveCardPreviewPayload(previewInfo, fallbackValue);
        if (!payload) {
            return;
        }

        const pointerEvent = this._ensurePointerEvent(event, element);
        GameCards.showCardPreview(
            payload.cardId,
            payload.cardName,
            payload.previewImage,
            pointerEvent,
            payload.info
        );
    }

    static _handleCardPreviewMove(event) {
        if (
            typeof GameCards === 'undefined' ||
            typeof GameCards.positionCardPreview !== 'function'
        ) {
            return;
        }

        if (
            !event ||
            typeof event.clientX !== 'number' ||
            typeof event.clientY !== 'number'
        ) {
            return;
        }

        const preview = document.getElementById('card-preview-modal');
        if (preview) {
            GameCards.positionCardPreview(preview, event);
        }
    }

    static _handleCardPreviewHide() {
        if (
            typeof GameCards !== 'undefined' &&
            typeof GameCards._closeActiveCardPreview === 'function'
        ) {
            GameCards._closeActiveCardPreview();
        }
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
            const normalizedKey = key ? String(key).toLowerCase() : '';

            if (
                normalizedKey === 'attacking_creatures' &&
                Array.isArray(value) &&
                value.length === 0
            ) {
                items.push({
                    label: '',
                    value: 'None',
                    hideLabel: true
                });
                return;
            }

            if (
                normalizedKey === 'blocking_assignments' &&
                value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                Object.keys(value).length === 0
            ) {
                items.push({
                    label: '',
                    value: 'None',
                    hideLabel: true
                });
                return;
            }

            const ref = this._deriveCardRef(key ?? label, value);

            if (this._shouldSkipDetailLabel(key ?? label)) {
                if (ref) {
                    registerRef(ref);
                }
                return;
            }

            if (Array.isArray(value) && value.length > 0) {
                const cardListDetail = this._buildCardListDetail(
                    value,
                    key,
                    normalizedLabel,
                    registerRef
                );
                if (cardListDetail) {
                    items.push(cardListDetail);
                    return;
                }
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

                const assignmentDetail = this._buildCardAssignmentDetail(
                    value,
                    key,
                    normalizedLabel,
                    registerRef
                );
                if (assignmentDetail) {
                    items.push(assignmentDetail);
                    return;
                }
            }

            const detail = {
                label: normalizedLabel,
                value: this._formatValue(value)
            };

            if (normalizedLabel && normalizedLabel.toLowerCase() === 'card') {
                detail.hideLabel = true;
            }

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

    // ===== ENTRY METADATA =====

    static _extractEntryMetadata(context) {
        const metadata = {
            phase: null,
            turn: null,
            turnPlayerId: null,
            turnPlayerName: null,
            turnPlayerLabel: null
        };

        const assignFromSource = (source) => {
            if (!source || typeof source !== 'object') {
                return;
            }

            if (!metadata.phase && typeof source.phase === 'string') {
                metadata.phase = source.phase;
            }

            if (
                (metadata.turn === null || Number.isNaN(metadata.turn)) &&
                Object.prototype.hasOwnProperty.call(source, 'turn') &&
                source.turn !== null &&
                source.turn !== ''
            ) {
                const turnValue = Number(source.turn);
                if (!Number.isNaN(turnValue)) {
                    metadata.turn = turnValue;
                }
            }

            const candidateId =
                source.turn_player_id ||
                source.active_player_id ||
                source.turn_player;
            if (!metadata.turnPlayerId && typeof candidateId === 'string') {
                metadata.turnPlayerId = candidateId;
            }

            const candidateName =
                source.turn_player_name ||
                source.active_player_name;
            if (!metadata.turnPlayerName && typeof candidateName === 'string') {
                metadata.turnPlayerName = candidateName;
            }
        };

        if (context && context.payload) {
            assignFromSource(context.payload);
        }

        const shouldFallbackToState =
            context &&
            context.source === 'websocket' &&
            (metadata.phase === null ||
                metadata.turn === null ||
                (!metadata.turnPlayerId && !metadata.turnPlayerName));

        if (
            shouldFallbackToState &&
            typeof GameCore !== 'undefined' &&
            typeof GameCore.getGameState === 'function'
        ) {
            const state = GameCore.getGameState();
            if (state) {
                if (!metadata.phase && state.phase) {
                    metadata.phase = state.phase;
                }
                if (
                    (metadata.turn === null || Number.isNaN(metadata.turn)) &&
                    typeof state.turn === 'number'
                ) {
                    metadata.turn = state.turn;
                }

                if (
                    (!metadata.turnPlayerId && !metadata.turnPlayerName) &&
                    typeof state.active_player === 'number' &&
                    Array.isArray(state.players)
                ) {
                    const activePlayer = state.players[state.active_player];
                    if (activePlayer) {
                        if (!metadata.turnPlayerId && activePlayer.id) {
                            metadata.turnPlayerId = activePlayer.id;
                        }
                        if (!metadata.turnPlayerName && activePlayer.name) {
                            metadata.turnPlayerName = activePlayer.name;
                        }
                    }
                }
            }
        }

        if (!metadata.turnPlayerLabel) {
            if (metadata.turnPlayerName) {
                metadata.turnPlayerLabel = metadata.turnPlayerName;
            } else if (metadata.turnPlayerId) {
                metadata.turnPlayerLabel = this._formatPlayer(metadata.turnPlayerId);
            }
        }

        return metadata;
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

        if (normalized === 'preview_attackers' || normalized === 'preview_blockers') {
            return true;
        }

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
            if (detail.cardList && detail.cardList.length > 0) {
                detail.cardList = detail.cardList
                    .map((ref) => this._buildCardItemFromRef(ref))
                    .filter(Boolean);
                return;
            }

            if (detail.assignmentList && detail.assignmentList.length > 0) {
                detail.assignmentList = detail.assignmentList
                    .map((assignment) => {
                        const source = this._buildCardItemFromRef(
                            assignment.sourceRef,
                            assignment.sourceFallback
                        );

                        const targets = (assignment.targetRefs || [])
                            .map((ref) => this._buildCardItemFromRef(ref))
                            .filter(Boolean);

                        const targetFallbacks =
                            assignment.targetFallbacks || [];

                        if (
                            !source &&
                            targets.length === 0 &&
                            targetFallbacks.length === 0
                        ) {
                            return null;
                        }

                        return {
                            source,
                            sourceFallback: assignment.sourceFallback || null,
                            targets,
                            targetFallbacks
                        };
                    })
                    .filter(Boolean);
                return;
            }

            if (detail.cardRef) {
                const info =
                    detail.cardRef.info ||
                    this._buildFallbackInfoFromRef(detail.cardRef);
                if (info) {
                    detail.value = info.name || detail.value;
                    detail.cardInfo = info;
                }
            } else if (
                detail.label &&
                detail.label.toLowerCase().includes('card')
            ) {
                detail.value = this._formatCardName(detail.value);
            }
        });
    }

    static _applyActionSpecificDetailOverrides(entry) {
        if (!entry) {
            return;
        }

        const normalizedAction = entry.rawAction
            ? String(entry.rawAction).toLowerCase()
            : '';
        if (normalizedAction === 'scry' || normalizedAction === 'surveil') {
            entry.details = [];
            entry.cardRefs = [];
            return;
        }

        const moveContext = this._resolveHandToLibraryMoveContext(entry);
        if (!moveContext) {
            return;
        }

        this._removeCardDetailsFromEntry(entry);
        this._mergeDeckPositionIntoTargetZone(
            entry,
            moveContext.deckPosition,
            moveContext.targetZone
        );
    }

    static _resolveHandToLibraryMoveContext(entry) {
        if (!entry) {
            return null;
        }

        const action = entry.rawAction || entry.action;
        if (!action || String(action).toLowerCase() !== 'move_card') {
            return null;
        }

        const payload = entry?.context?.payload || {};
        const sourceZone =
            payload.source_zone ??
            payload?.additional_data?.source_zone ??
            this._resolveDetailValue(entry, ['Source Zone', 'Source zone']);
        const targetZone =
            payload.target_zone ??
            payload?.additional_data?.target_zone ??
            this._resolveDetailValue(entry, ['Target Zone', 'Target zone']);
        const deckPosition =
            payload.deck_position ??
            payload?.additional_data?.deck_position ??
            this._resolveDetailValue(entry, ['Deck Position', 'Deck position']);

        const normalizedSource = sourceZone
            ? String(sourceZone).trim().toLowerCase()
            : '';
        const normalizedTarget = targetZone
            ? String(targetZone).trim().toLowerCase()
            : '';
        const normalizedDeck = deckPosition
            ? String(deckPosition).trim().toLowerCase()
            : '';

        const isHandToLibrary =
            normalizedSource === 'hand' && normalizedTarget === 'library';
        const isTopOrBottom =
            normalizedDeck === 'top' || normalizedDeck === 'bottom';

        if (!isHandToLibrary || !isTopOrBottom) {
            return null;
        }

        return {
            sourceZone: sourceZone || normalizedSource || 'hand',
            targetZone: targetZone || normalizedTarget || 'library',
            deckPosition: normalizedDeck
        };
    }

    static _removeCardDetailsFromEntry(entry) {
        if (!entry || !Array.isArray(entry.details)) {
            return;
        }

        entry.details = entry.details
            .map((detail) => {
                if (!detail) {
                    return null;
                }
                const label = detail.label
                    ? String(detail.label).toLowerCase()
                    : '';
                const isCardDetail =
                    label === 'card' || Boolean(detail.cardRef || detail.cardInfo);
                return isCardDetail ? null : detail;
            })
            .filter(Boolean);

        if (Array.isArray(entry.cardRefs) && entry.cardRefs.length > 0) {
            entry.cardRefs = [];
        }
    }

    static _mergeDeckPositionIntoTargetZone(entry, deckPosition, fallbackZone) {
        if (!entry || !Array.isArray(entry.details) || !deckPosition) {
            return;
        }

        const normalizedDeck = String(deckPosition).trim().toLowerCase();
        if (!normalizedDeck) {
            return;
        }

        const targetDetail = entry.details.find(
            (detail) =>
                detail?.label &&
                String(detail.label).toLowerCase() === 'target zone'
        );

        const currentValue = targetDetail?.value || fallbackZone || 'library';
        const normalizedZone = currentValue
            ? String(currentValue).trim().toLowerCase()
            : 'library';
        const combined = `${normalizedDeck} ${normalizedZone}`.trim();

        if (targetDetail) {
            targetDetail.value = combined;
        } else {
            entry.details.push({
                label: 'Target Zone',
                value: combined
            });
        }

        entry.details = entry.details.filter((detail) => {
            if (!detail?.label) {
                return true;
            }
            return String(detail.label).toLowerCase() !== 'deck position';
        });
    }

    static _resolveDetailValue(entry, labels) {
        if (!entry || !Array.isArray(entry.details) || !labels) {
            return null;
        }

        const targetLabels = Array.isArray(labels) ? labels : [labels];
        const normalizedLookup = targetLabels
            .map((label) => String(label).toLowerCase())
            .filter((label) => label.length > 0);

        if (normalizedLookup.length === 0) {
            return null;
        }

        for (const detail of entry.details) {
            if (!detail?.label) {
                continue;
            }
            const normalizedLabel = String(detail.label).toLowerCase();
            if (normalizedLookup.includes(normalizedLabel)) {
                return detail.value ?? null;
            }
        }

        return null;
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

    static _convertValueToCardRef(value, key = null) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'object') {
            return this._extractCardRefFromObject(value);
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
                return null;
            }

            const derived = this._deriveCardRef(key, trimmed);
            if (derived) {
                return derived;
            }

            if (this._looksLikeCardUniqueId(trimmed)) {
                return { uniqueId: trimmed };
            }

            if (/^\d+$/.test(trimmed)) {
                return { cardId: trimmed };
            }
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return { cardId: String(value) };
        }

        return null;
    }

    static _looksLikeCardUniqueId(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }

        const trimmed = value.trim();
        if (trimmed.length < 8) {
            return false;
        }

        return /^[a-f0-9-]+$/i.test(trimmed);
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

    static _buildCardListDetail(list, key, label, registerRef) {
        if (!Array.isArray(list) || list.length === 0) {
            return null;
        }

        const cardRefs = [];
        const extraValues = [];

        list.forEach((item) => {
            const ref = this._convertValueToCardRef(item, key);
            if (ref) {
                const registered = registerRef(ref);
                if (registered) {
                    cardRefs.push(registered);
                    return;
                }
            }

            if (item !== null && item !== undefined && item !== '') {
                extraValues.push(this._formatValue(item));
            }
        });

        if (cardRefs.length === 0) {
            return null;
        }

        const detail = {
            label,
            cardList: cardRefs,
            hideLabel: true
        };

        if (extraValues.length > 0) {
            detail.extraValues = extraValues;
        }

        return detail;
    }

    static _buildCardAssignmentDetail(obj, key, label, registerRef) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return null;
        }

        const assignments = [];

        Object.entries(obj).forEach(([sourceKey, targetValue]) => {
            const sourceRef = this._convertValueToCardRef(
                sourceKey,
                `${key || 'assignment'}_source`
            );
            const registeredSource = sourceRef ? registerRef(sourceRef) : null;

            const targets = Array.isArray(targetValue)
                ? targetValue
                : targetValue !== undefined
                    ? [targetValue]
                    : [];

            const targetRefs = [];
            const targetFallbacks = [];

            targets.forEach((target) => {
                const targetRef = this._convertValueToCardRef(
                    target,
                    `${key || 'assignment'}_target`
                );
                if (targetRef) {
                    const registeredTarget = registerRef(targetRef);
                    if (registeredTarget) {
                        targetRefs.push(registeredTarget);
                        return;
                    }
                }
                if (target !== null && target !== undefined && target !== '') {
                    targetFallbacks.push(this._formatValue(target));
                }
            });

            if (
                !registeredSource &&
                targetRefs.length === 0 &&
                targetFallbacks.length === 0
            ) {
                return;
            }

            assignments.push({
                sourceRef: registeredSource,
                sourceFallback: this._formatValue(sourceKey),
                targetRefs,
                targetFallbacks
            });
        });

        if (assignments.length === 0) {
            return null;
        }

        return {
            label,
            assignmentList: assignments,
            hideLabel: true
        };
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

    static _buildFallbackInfoFromRef(ref) {
        if (!ref) {
            return null;
        }

        if (ref.info) {
            return ref.info;
        }

        const info = {
            name: this._formatCardName(
                ref.name ||
                    ref.cardId ||
                    ref.uniqueId ||
                    'Card'
            ),
            imageUrl: ref.imageUrl || ref.image_url || null,
            cardId: ref.cardId || ref.card_id || null,
            uniqueId: ref.uniqueId || ref.unique_id || null,
            card_type: ref.cardType || ref.card_type || null,
            cardType: ref.cardType || ref.card_type || null
        };

        ref.info = info;
        return info;
    }

    static _buildCardItemFromRef(ref, fallbackValue = null) {
        if (!ref) {
            return null;
        }

        const info = ref.info || this._buildFallbackInfoFromRef(ref);
        if (!info) {
            return null;
        }

        const displayName =
            info.name ||
            this._formatCardName(
                fallbackValue ||
                    ref.cardId ||
                    ref.name ||
                    ref.uniqueId ||
                    'Card'
            );

        return {
            ref,
            cardInfo: info,
            displayName
        };
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

    static _buildTurnKey(entry) {
        if (!entry || typeof entry.turn !== 'number' || Number.isNaN(entry.turn)) {
            return null;
        }
        const playerKey =
            entry.turnPlayerId ||
            entry.turnPlayerLabel ||
            entry.turnPlayerName ||
            '';
        return `${entry.turn}-${playerKey}`;
    }

    static _formatTurnLabel(entry) {
        if (!entry) {
            return 'Nouveau tour';
        }

        const parts = [];
        if (typeof entry.turn === 'number' && !Number.isNaN(entry.turn)) {
            parts.push(`Tour ${entry.turn}`);
        }

        if (entry.turnPlayerLabel) {
            parts.push(entry.turnPlayerLabel);
        } else if (entry.turnPlayerName) {
            parts.push(entry.turnPlayerName);
        } else if (entry.turnPlayerId) {
            parts.push(this._formatPlayer(entry.turnPlayerId));
        }

        if (parts.length === 0) {
            return 'Nouveau tour';
        }

        return parts.join(' • ');
    }

    static _resolveCardPreviewPayload(cardInfo, fallbackValue = '') {
        if (!cardInfo) {
            return null;
        }

        const info = cardInfo;
        const ref = {
            uniqueId: info.uniqueId || info.unique_id || null,
            cardId: info.cardId || info.card_id || info.id || null,
            name: info.name || fallbackValue || null
        };
        const cardElement = this._findCardElement(ref);
        const previewImage =
            info.imageUrl ||
            info.image_url ||
            (cardElement ? cardElement.getAttribute('data-card-image') : null) ||
            null;

        const cardId =
            ref.cardId ||
            (cardElement ? cardElement.getAttribute('data-card-id') : null) ||
            ref.name ||
            fallbackValue ||
            null;

        const cardName =
            info.name ||
            fallbackValue ||
            cardId ||
            'Card';

        if (!cardId && !cardName && !previewImage) {
            return null;
        }

        return {
            info,
            previewImage,
            cardId,
            cardName
        };
    }

    static _ensurePointerEvent(event, element) {
        if (
            event &&
            typeof event.clientX === 'number' &&
            typeof event.clientY === 'number'
        ) {
            return event;
        }

        return this._buildElementPointerEvent(element);
    }

    static _buildElementPointerEvent(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') {
            return null;
        }

        const rect = element.getBoundingClientRect();
        return {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        };
    }

    static _buildPreviewInfoFromFallback(value) {
        if (!value) {
            return null;
        }

        const info = {
            name: this._formatCardName(value)
        };

        if (this._looksLikeCardUniqueId(value)) {
            info.uniqueId = value;
        } else if (/^\d+$/.test(value)) {
            info.cardId = value;
        }

        return info;
    }

    // ===== ACTION PRESENTATION HELPERS =====

    static _buildActionTitle(entry) {
        if (!entry) {
            return '';
        }

        const normalizedAction = entry.rawAction
            ? String(entry.rawAction).toLowerCase()
            : '';

        if (normalizedAction === 'pass_phase') {
            const phaseName = this._formatPhaseName(entry.phase);
            return phaseName || entry.action;
        }

        if (normalizedAction === 'change_phase') {
            const phaseName = this._formatPhaseName(entry.phase);
            if (phaseName) {
                return `Forced phase: ${phaseName}`;
            }
        }

        return entry.action;
    }

    static _formatPhaseName(phase) {
        if (!phase) {
            return null;
        }
        const normalized = String(phase).toLowerCase();
        const mapping = {
            begin: 'Beginning Phase',
            main1: 'Main Phase 1',
            attack: 'Attack Phase',
            block: 'Block Phase',
            damage: 'Damage Phase',
            main2: 'Main Phase 2',
            end: 'Ending Phase'
        };
        return mapping[normalized] || this._formatLabel(phase);
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

        if (typeof player === 'string') {
            if (
                typeof GameCore !== 'undefined' &&
                GameCore &&
                typeof GameCore.getPlayerDisplayName === 'function'
            ) {
                const resolved = GameCore.getPlayerDisplayName(player);
                if (resolved) {
                    return resolved;
                }
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

    static _buildEntrySignature(source) {
        if (!source || typeof source !== 'object') {
            return null;
        }

        const action = this._normalizeSignaturePart(source.rawAction || source.action);
        const player = this._normalizeSignaturePart(source.player);
        const success = source.success === false ? '0' : '1';
        const origin = this._normalizeSignaturePart(source.origin);
        const phase = this._normalizeSignaturePart(source.phase);
        const turn =
            source.turn === undefined || source.turn === null
                ? ''
                : String(source.turn);
        const timestamp = this._normalizeSignatureTimestamp(source.timestamp);

        return [action, player, success, origin, phase, turn, timestamp].join('|');
    }

    static _normalizeSignaturePart(value) {
        if (value === undefined || value === null) {
            return '';
        }
        return String(value).trim().toLowerCase();
    }

    static _normalizeSignatureTimestamp(value) {
        if (value === undefined || value === null || value === '') {
            return '';
        }

        if (typeof value === 'number') {
            const normalized = value < 1e12 ? Math.floor(value * 1000) : Math.floor(value);
            return String(normalized);
        }

        if (typeof value === 'string') {
            const numeric = Number(value);
            if (!Number.isNaN(numeric)) {
                const normalized =
                    numeric < 1e12 ? Math.floor(numeric * 1000) : Math.floor(numeric);
                return String(normalized);
            }

            const parsed = Date.parse(value);
            if (!Number.isNaN(parsed)) {
                return String(parsed);
            }

            return value.trim();
        }

        if (value instanceof Date) {
            return String(value.getTime());
        }

        return String(value);
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
            'origin',
            'phase',
            'turn',
            'active_player',
            'active_player_id',
            'active_player_name',
            'turn_player',
            'turn_player_id',
            'turn_player_name'
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
