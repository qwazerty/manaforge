/**
 * ManaForge Game Cards Module
 * Functions for card rendering and management
 */
const CARD_BACK_IMAGE = '/static/images/card-back.jpg';

const GameCards = {
    draggedCardElement: null,
    _lastContextPosition: null,
    _attachmentSelection: null,
    _attachmentTargets: [],
    _boundAttachmentClickHandler: null,
    _boundAttachmentKeydownHandler: null,
    _boundCloseAttachmentClick: null,
    _boundAttachmentMenuClose: null,
    _boundAttachmentMenuKeydown: null,
    getCurrentViewerSeat: function() {
        if (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function') {
            return GameCore.getSelectedPlayer();
        }
        return null;
    },
    canViewerSeeFaceDownCard: function(card, viewerId = null) {
        if (!card) {
            return false;
        }
        if (!this.isFaceDownCard(card)) {
            return true;
        }
        const resolvedViewer = viewerId || this.getCurrentViewerSeat();
        if (!resolvedViewer || resolvedViewer === 'spectator') {
            return false;
        }
        const ownerId = card.face_down_owner || card.face_down_owner_id || card.faceDownOwner || card.faceDownOwnerId;
        if (!ownerId) {
            return false;
        }
        return ownerId.toLowerCase() === String(resolvedViewer).toLowerCase();
    },
    _buildMaskedCardData: function(card, displayName = 'Face-down Card') {
        if (!card) {
            return null;
        }
        const masked = {
            ...card,
            name: displayName,
            oracle_text: '',
            text: '',
            type_line: 'Face-down Card',
            image_url: null,
            card_faces: []
        };
        return masked;
    },
    isFaceDownCard: function(card) {
        if (!card) return false;
        const name = (card.name || '').toLowerCase();
        const typeLine = (card.type_line || card.typeLine || '').toLowerCase();
        const setCode = (card.set || card.set_code || card.setCode || '').toLowerCase();
        const explicitFlag = card.face_down || card.is_face_down || card.faceDown;
        const manifestOrMorphToken = name === 'manifest' || name === 'morph' || (typeLine.includes('manifest') && card.is_token);
        const mentionsFaceDown = typeLine.includes('face-down') || typeLine.includes('face down');
        const isMueFaceDown = setCode === 'mue';
        return Boolean(explicitFlag || manifestOrMorphToken || mentionsFaceDown || isMueFaceDown);
    },

    /**
     * Check if a card is a creature (face-down cards are always creatures)
     */
    isCreatureCard: function(card) {
        if (!card) return false;
        if (this.isFaceDownCard(card)) return true;
        const typeLine = (card.type_line || card.typeLine || card.card_type || card.cardType || '').toLowerCase();
        if (typeLine.includes('creature')) return true;
        const customTypes = card.custom_types || card.customTypes;
        if (Array.isArray(customTypes) && customTypes.some(t => String(t).toLowerCase().includes('creature'))) return true;
        return false;
    },

    getSafeImageUrl: function(card, options = {}) {
        if (!card) return null;

        const viewerId = options.viewerId || this.getCurrentViewerSeat();
        const ignoreFaceDown = Boolean(options.ignoreFaceDown);
        const canRevealFaceDown = ignoreFaceDown || this.canViewerSeeFaceDownCard(card, viewerId);
        const treatAsFaceDown = this.isFaceDownCard(card) && !canRevealFaceDown;
        const baseImage = card.image_url || card.image;

        // Allow back-face images for double-faced cards
        if (card.is_double_faced && card.card_faces && card.card_faces.length > 1) {
            const currentFace = card.current_face || 0;
            if (currentFace < card.card_faces.length && card.card_faces[currentFace].image_url) {
                if (treatAsFaceDown) {
                    return CARD_BACK_IMAGE;
                }
                return card.card_faces[currentFace].image_url;
            }
        }

        if (treatAsFaceDown) {
            return CARD_BACK_IMAGE;
        }

        if (!baseImage) {
            return null;
        }

        // For single-faced cards, skip generic "/back/" images unless it's an intentional face-down card
        if (baseImage.includes("/back/") && !card.is_double_faced) {
            return null;
        }

        return baseImage;
    },


    preloadCardImages: function(cards) {
        if (!cards || !Array.isArray(cards)) return;
        cards.forEach(card => {
            const imageUrl = this.getSafeImageUrl(card);
            if (imageUrl) {
                const img = new Image();
                img.src = imageUrl;
            }
        });
    },

    buildSearchIndex: function(card) {
        if (!card) {
            return '';
        }

        const fragments = [];
        const push = (value) => {
            if (value) {
                fragments.push(String(value).toLowerCase());
            }
        };

        push(card.name);
        push(card.type_line || card.typeLine);
        push(card.oracle_text || card.text);

        if (Array.isArray(card.keywords) && card.keywords.length) {
            push(card.keywords.join(' '));
        }

        if (Array.isArray(card.subtypes) && card.subtypes.length) {
            push(card.subtypes.join(' '));
        }

        if (Array.isArray(card.card_faces)) {
            card.card_faces.forEach((face) => {
                if (!face) {
                    return;
                }
                push(face.name);
                push(face.type_line || face.typeLine);
                push(face.oracle_text || face.text);
                if (Array.isArray(face.keywords)) {
                    push(face.keywords.join(' '));
                }
            });
        }

        const combined = fragments.join(' ').replace(/\s+/g, ' ').trim();
        return combined;
    },

    computeEffectivePowerToughness: function(card) {
        if (!card) {
            return null;
        }

        const normalize = (value) => {
            if (value === undefined || value === null) {
                return null;
            }
            const text = String(value).trim();
            return text.length ? text : null;
        };

        const isNumeric = (text) => /^-?\d+$/.test(text);

        const basePowerRaw = normalize(card.power);
        const baseToughnessRaw = normalize(card.toughness);

        const overridePowerRaw = normalize(
            card.current_power ?? card.currentPower ??
            card.power_override ?? card.powerOverride ??
            card.effective_power ?? card.effectivePower ??
            card.display_power ?? card.displayPower ??
            card.modified_power ?? card.modifiedPower ?? null
        );

        const overrideToughnessRaw = normalize(
            card.current_toughness ?? card.currentToughness ??
            card.toughness_override ?? card.toughnessOverride ??
            card.effective_toughness ?? card.effectiveToughness ??
            card.display_toughness ?? card.displayToughness ??
            card.modified_toughness ?? card.modifiedToughness ?? null
        );

        const displayPowerText = overridePowerRaw && isNumeric(overridePowerRaw)
            ? overridePowerRaw
            : (basePowerRaw && isNumeric(basePowerRaw) ? basePowerRaw : null);

        const displayToughnessText = overrideToughnessRaw && isNumeric(overrideToughnessRaw)
            ? overrideToughnessRaw
            : (baseToughnessRaw && isNumeric(baseToughnessRaw) ? baseToughnessRaw : null);

        if (!displayPowerText || !displayToughnessText) {
            return null;
        }

        const hasModification = (overridePowerRaw !== null && overridePowerRaw !== basePowerRaw) ||
            (overrideToughnessRaw !== null && overrideToughnessRaw !== baseToughnessRaw);

        return {
            basePowerText: basePowerRaw,
            baseToughnessText: baseToughnessRaw,
            displayPowerText,
            displayToughnessText,
            hasModification
        };
    },

    generatePowerToughnessOverlay: function(card) {
        // For face-down cards hidden from the viewer, show 2/2 (standard Morph stats)
        if (this.isFaceDownCard(card)) {
            return `
            <div class="card-pt-overlay"
                data-pt-base="2/2"
                data-pt-value="2/2">
                <span class="card-pt-value">2</span>/<span class="card-pt-value">2</span>
            </div>
        `;
        }

        const stats = this.computeEffectivePowerToughness(card);
        if (!stats) {
            return '';
        }

        const powerText = GameUtils.escapeHtml(stats.displayPowerText);
        const toughnessText = GameUtils.escapeHtml(stats.displayToughnessText);
        const basePowerText = stats.basePowerText ? GameUtils.escapeHtml(stats.basePowerText) : '';
        const baseToughnessText = stats.baseToughnessText ? GameUtils.escapeHtml(stats.baseToughnessText) : '';
        const dataBase = basePowerText || baseToughnessText
            ? `${basePowerText}/${baseToughnessText}`
            : '';
        const dataValue = `${powerText}/${toughnessText}`;
        const overlayClass = stats.hasModification
            ? 'card-pt-overlay card-pt-overlay-modified'
            : 'card-pt-overlay';

        return `
            <div class="${overlayClass}"
                data-pt-base="${dataBase}"
                data-pt-value="${dataValue}">
                <span class="card-pt-value">${powerText}</span>/<span class="card-pt-value">${toughnessText}</span>
            </div>
        `;
    },

    _computeCardVisualState: function(card, zone = 'unknown', isOpponent = false) {
        const isTapped = Boolean(card?.tapped);
        const isTargeted = Boolean(card?.targeted);
        const isAttacking = Boolean(card?.attacking);
        const isBlocking = Boolean(card?.blocking);
        const gameState = (typeof GameCore !== 'undefined' && typeof GameCore.getGameState === 'function')
            ? GameCore.getGameState()
            : null;
        const inCombatPhase = ['attack', 'block', 'damage'].includes(
            (gameState?.phase || '').toLowerCase()
        );
        const combatState = gameState?.combat_state || {};
        const pendingBlockers = combatState && typeof combatState.pending_blockers === 'object'
            ? combatState.pending_blockers
            : {};
        const combatStep = combatState?.step || null;
        const frontendCombatMode = typeof GameCombat !== 'undefined' ? GameCombat.combatMode : null;
        const isDeclaringAttackers =
            combatStep === 'declare_attackers' || frontendCombatMode === 'declaring_attackers';
        const isPendingBlocker = Object.prototype.hasOwnProperty.call(
            pendingBlockers,
            card?.unique_id
        );

        const suppressTappedVisual =
            inCombatPhase &&
            isTapped &&
            (isAttacking || isBlocking || isPendingBlocker) &&
            isDeclaringAttackers;

        const classes = {
            tapped: isTapped && !suppressTappedVisual,
            combatTapped: inCombatPhase && isAttacking && isTapped,
            targeted: isTargeted,
            attacking: isAttacking,
            blocking: isBlocking
        };

        let transformValue = '';
        if (isAttacking) {
            const transforms = [];
            const translateY = isOpponent ? 20 : -20;
            if (translateY !== 0) {
                transforms.push(`translateY(${translateY}px)`);
            }
            if (isTapped && !suppressTappedVisual) {
                transforms.push('rotate(90deg)');
            }
            if (transforms.length) {
                transformValue = transforms.join(' ');
            }
        }

        return {
            classes,
            data: {
                isTapped,
                isTargeted,
                isAttacking,
                isBlocking
            },
            transformValue,
            styleText: transformValue ? `transform: ${transformValue};` : ''
        };
    },

    renderCardWithLoadingState: function(card, cardClass = 'card-mini', showTooltip = true, zone = 'unknown', isOpponent = false, index = 0, playerId = null, options = {}) {
        const cardId = card.id || card.name;
        const cardName = card.name || 'Unknown';
        const viewerSeat = this.getCurrentViewerSeat();
        const isFaceDown = this.isFaceDownCard(card);
        const maskForViewer = isFaceDown && !this.canViewerSeeFaceDownCard(card, viewerSeat);
        const displayCardLabel = isFaceDown ? 'Face-down Card' : cardName;
        const actualImageUrl = this.getSafeImageUrl(card, { ignoreFaceDown: true });
        const thumbnailImageUrl = isFaceDown ? CARD_BACK_IMAGE : actualImageUrl;
        const previewImageUrl = maskForViewer ? CARD_BACK_IMAGE : actualImageUrl;
        const cardDataForAttr = maskForViewer ? this._buildMaskedCardData(card, displayCardLabel) : card;
        const serializedCardData = JSON.stringify(cardDataForAttr).replace(/'/g, "&#39;");
        const visualState = this._computeCardVisualState(card, zone, isOpponent);
        const stateClasses = visualState.classes;
        const stateFlags = visualState.data;
        const combatTappedClass = stateClasses.combatTapped ? ' combat-tapped' : '';
        const tappedClass = stateClasses.tapped ? ' tapped' : '';
        const targetedClass = stateClasses.targeted ? ' targeted' : '';
        const attackingClass = stateClasses.attacking ? ' attacking-creature' : '';
        const blockingClass = stateClasses.blocking ? ' blocking-creature' : '';
        const uniqueCardId = card.unique_id;

        // Resolve card type - face-down cards are ONLY creatures
        const customTypes = this.getCustomTypes(card);
        let typeLine = '';
        let primaryCardType = '';

        if (this.isFaceDownCard(card)) {
            // Face-down = creature only (unless custom types override)
            typeLine = customTypes.length ? customTypes.join(' ').toLowerCase() : 'creature';
            primaryCardType = 'creature';
            if (customTypes.length) {
                const priorityOrder = ['creature', 'land', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery'];
                const normalizedTypes = customTypes.map(type => type.toLowerCase());
                const prioritized = priorityOrder.find(type => normalizedTypes.includes(type));
                primaryCardType = prioritized || customTypes[0];
            }
        } else {
            // Normal type resolution
            const typePieces = [];
            const pushType = (value) => {
                if (value) {
                    typePieces.push(String(value));
                }
            };
            pushType(card.card_type);
            pushType(card.cardType);
            pushType(card.type_line);
            pushType(card.typeLine);
            pushType(card.subtype);
            if (Array.isArray(card.types)) {
                card.types.forEach(pushType);
            }
            if (Array.isArray(card.subtypes)) {
                card.subtypes.forEach(pushType);
            }
            if (Array.isArray(card.supertypes)) {
                card.supertypes.forEach(pushType);
            }
            if (Array.isArray(card.card_faces)) {
                card.card_faces.forEach(face => {
                    pushType(face?.type_line);
                    pushType(face?.typeLine);
                    if (Array.isArray(face?.types)) {
                        face.types.forEach(pushType);
                    }
                    if (Array.isArray(face?.subtypes)) {
                        face.subtypes.forEach(pushType);
                    }
                });
            }
            if (customTypes.length) {
                customTypes.forEach(pushType);
            }
            typeLine = typePieces.join(' ').toLowerCase();

            if (customTypes.length) {
                const priorityOrder = ['creature', 'land', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery'];
                const normalizedTypes = customTypes.map(type => type.toLowerCase());
                const prioritized = priorityOrder.find(type => normalizedTypes.includes(type));
                primaryCardType = prioritized || customTypes[0];
            } else if (typeLine.includes('creature')) {
                primaryCardType = 'creature';
            } else if (typeLine.includes('land')) {
                primaryCardType = 'land';
            } else if (typeLine.includes('planeswalker')) {
                primaryCardType = 'planeswalker';
            } else if (typeLine.includes('artifact')) {
                primaryCardType = 'artifact';
            } else if (typeLine.includes('enchantment')) {
                primaryCardType = 'enchantment';
            } else if (typeLine.includes('instant')) {
                primaryCardType = 'instant';
            } else if (typeLine.includes('sorcery')) {
                primaryCardType = 'sorcery';
            }
        }

        const controllerId = card.controller_id || card.controllerId || card.owner_id || card.ownerId || '';
        const ownerId = card.owner_id || card.ownerId || '';

        const dataCardId = GameUtils.escapeHtml(cardId || '');
        const dataCardName = GameUtils.escapeHtml((!maskForViewer ? cardName : displayCardLabel) || '');
        const dataImageUrl = GameUtils.escapeHtml(previewImageUrl || '');
        const dataUniqueId = GameUtils.escapeHtml(uniqueCardId || '');
        const dataZone = GameUtils.escapeHtml(zone || '');
        const dataCardType = GameUtils.escapeHtml(primaryCardType || '');
        const dataCardOwner = GameUtils.escapeHtml(ownerId || '');
        const dataCardController = GameUtils.escapeHtml(controllerId || '');
        const attachmentHostId = card.attached_to || card.attachedTo || '';
        const parsedAttachmentOrder = (() => {
            const raw = card?.attachment_order ?? card?.attachmentOrder;
            if (Number.isFinite(raw)) {
                return raw;
            }
            const parsed = parseInt(raw, 10);
            return Number.isFinite(parsed) ? parsed : null;
        })();
        const dataAttachmentHost = GameUtils.escapeHtml(attachmentHostId || '');
        const dataAttachmentOrder = parsedAttachmentOrder !== null ? parsedAttachmentOrder : '';
        const searchIndex = GameUtils.escapeHtml(maskForViewer ? 'face-down card' : this.buildSearchIndex(card));
        const jsCardId = JSON.stringify(cardId || '');
        const jsUniqueCardId = JSON.stringify(uniqueCardId || '');
        const zoneAttr = (zone || '').replace(/'/g, "\\'");
        const selectedPlayer = (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function')
            ? GameCore.getSelectedPlayer()
            : null;
        const spectatorView = selectedPlayer === 'spectator';
        const hasReadOnlyOption = options && Object.prototype.hasOwnProperty.call(options, 'readOnly');
        const readOnly = hasReadOnlyOption ? Boolean(options.readOnly) : spectatorView;
        const allowInteractions = !readOnly;
        const disableContextMenu = Boolean(options && options.disableContextMenu);
        const disableDrag = Boolean(options && options.disableDrag);
        const allowDrag = allowInteractions && !disableDrag;

        let onClickAction = '';
        if (allowInteractions && (zone === 'creatures' || zone === 'support' || zone === 'permanents' || zone === 'lands' || zone === 'battlefield')) {
            onClickAction = `onclick='GameCards.handleCardClick(${jsCardId}, ${jsUniqueCardId}, "${zone}"); event.stopPropagation();'`;
        } else if (allowInteractions && zone === 'hand') {
            onClickAction = `onclick='GameActions.playCardFromHand(${jsCardId}, ${jsUniqueCardId}); event.stopPropagation();'`;
        }

        const enableDrop =
            zone === 'battlefield' ||
            zone === 'lands' ||
            zone === 'creatures' ||
            zone === 'support' ||
            zone === 'permanents';
        const dropAttributes = enableDrop
            ? `ondragover="UIZonesManager.handleZoneDragOver(event)" ondragleave="UIZonesManager.handleZoneDragLeave(event)" ondrop="UIZonesManager.handleZoneDrop(event, '${zoneAttr}')"`
            : '';
        const dropAttr = allowDrag ? dropAttributes : '';
        const dragStartAttr = allowDrag ? 'ondragstart="GameCards.handleDragStart(event, this)"' : '';
        const dragEndAttr = allowDrag ? 'ondragend="GameCards.handleDragEnd(event, this)"' : '';
        const allowCardContextMenu = allowInteractions && !disableContextMenu;
        const contextMenuAttr = allowCardContextMenu ? 'oncontextmenu="GameCards.showCardContextMenu(event, this); return false;"' : '';
        
        // Apply transform for attacking creatures, keeping rotation when tapped
        let combinedTransform = visualState.transformValue || '';
        if (options && options.offsetTransform) {
            combinedTransform = combinedTransform
                ? `${combinedTransform} ${options.offsetTransform}`
                : options.offsetTransform;
        }
        const styleParts = [];
        if (combinedTransform) {
            styleParts.push(`transform: ${combinedTransform};`);
        }
        if (options && options.inlineStyle) {
            styleParts.push(String(options.inlineStyle));
        }
        const inlineStyleText = styleParts.join(' ');

        // Generate counters display
        const countersHtml = this.generateCountersHtml(card);
        const powerToughnessHtml = this.generatePowerToughnessOverlay(card);
        const overlayStack = this.generateCardOverlayStack(card);

        return `
            <div class="${cardClass}${tappedClass}${combatTappedClass}${targetedClass}${attackingClass}${blockingClass}" 
                data-card-id="${dataCardId}"
                data-card-unique-id="${dataUniqueId}"
                data-card-name="${dataCardName}"
                data-card-image="${dataImageUrl}"
                data-card-zone="${dataZone}"
                data-card-type="${dataCardType}"
                data-card-owner="${dataCardOwner}"
                data-card-controller="${dataCardController}"
                data-attached-to="${dataAttachmentHost}"
                data-attachment-order="${dataAttachmentOrder}"
                data-card-tapped="${stateFlags.isTapped}"
                data-card-targeted="${stateFlags.isTargeted}"
                data-card-search="${searchIndex}"
                data-card-data='${serializedCardData}'
                data-is-opponent="${isOpponent}"
                data-readonly="${readOnly}"
                style="${inlineStyleText}"
                draggable="${allowDrag ? 'true' : 'false'}"
                ${dragStartAttr}
                ${dropAttr}
                ${onClickAction}
                ${dragEndAttr}
                ${contextMenuAttr}>
                ${thumbnailImageUrl ? `
                    <div class="relative">
                        <img src="${thumbnailImageUrl}" 
                             alt="${displayCardLabel}" 
                             style="opacity: 0; transition: opacity 0.3s ease;"
                             onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="card-fallback" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none;">
                        </div>
                        ${overlayStack}
                        ${countersHtml}
                        ${powerToughnessHtml}
                    </div>
                ` : `
                    <div class="card-fallback relative" aria-label="${displayCardLabel}">
                        ${overlayStack}
                        ${countersHtml}
                        ${powerToughnessHtml}
                    </div>
                `}
            </div>
        `;
    },

    renderCardWithAttachments: function(card, attachments = [], zone = 'battlefield', isOpponent = false, playerId = null) {
        const hostHtml = this.renderCardWithLoadingState(
            card,
            'card-battlefield',
            true,
            zone,
            isOpponent,
            null,
            playerId
        );
        const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
        const hostId = card?.unique_id || card?.uniqueId || '';
        const safeHostId = GameUtils.escapeHtml(hostId || '');
        const visibleAttachments = normalizedAttachments.slice(0, 4);
        const overflowCount = normalizedAttachments.length - visibleAttachments.length;
        const offsetStep = 15;
        const offsetPadding = normalizedAttachments.length
            ? (normalizedAttachments.length * offsetStep) + 20
            : 0;
        const groupStyle = offsetPadding
            ? `style="padding-bottom:${offsetPadding}px; padding-right:${offsetPadding}px;"`
            : '';
        const attachmentHtml = visibleAttachments.map((attachment, index) => {
            return this.renderCardWithLoadingState(
                attachment,
                UIConfig?.CSS_CLASSES?.card?.attachment || 'card-attachment',
                true,
                zone,
                isOpponent,
                index,
                playerId,
                { disableDrag: true }
            );
        }).join('');
        const overflowBadge = overflowCount > 0
            ? `<div class="card-attachment-overflow">+${overflowCount}</div>`
            : '';
        const attachmentsSection = normalizedAttachments.length
            ? `<div class="card-attachment-pile">
                    ${attachmentHtml}
                    ${overflowBadge}
               </div>`
            : '';

        return `
            <div class="card-attachment-group"
                 data-attachment-host="${safeHostId}"
                 data-attachment-count="${normalizedAttachments.length}"
                 ${groupStyle}>
                <div class="card-host">
                    ${hostHtml}
                </div>
                ${attachmentsSection}
            </div>
        `;
    },

    updateCardElementState: function(cardElement, cardData, zone = 'unknown', isOpponent = false) {
        if (!cardElement || !cardData) {
            return;
        }

        const visualState = this._computeCardVisualState(cardData, zone, isOpponent);
        const stateClasses = visualState.classes;
        const stateFlags = visualState.data;

        cardElement.classList.toggle('tapped', Boolean(stateClasses.tapped));
        cardElement.classList.toggle('combat-tapped', Boolean(stateClasses.combatTapped));
        cardElement.classList.toggle('targeted', Boolean(stateClasses.targeted));
        cardElement.classList.toggle('attacking-creature', Boolean(stateClasses.attacking));
        cardElement.classList.toggle('blocking-creature', Boolean(stateClasses.blocking));

        const viewerSeat = this.getCurrentViewerSeat();
        const maskForViewer = this.isFaceDownCard(cardData) && !this.canViewerSeeFaceDownCard(cardData, viewerSeat);
        const maskedData = maskForViewer ? this._buildMaskedCardData(cardData, 'Face-down Card') : cardData;
        const serializedData = JSON.stringify(maskedData).replace(/'/g, "&#39;");
        cardElement.setAttribute('data-card-data', serializedData);
        cardElement.setAttribute('data-card-tapped', stateFlags.isTapped ? 'true' : 'false');
        cardElement.setAttribute('data-card-targeted', stateFlags.isTargeted ? 'true' : 'false');

        if (visualState.transformValue) {
            cardElement.style.transform = visualState.transformValue;
        } else {
            cardElement.style.removeProperty('transform');
        }
    },

    generateCountersHtml: function(card) {
        if (!card.counters || Object.keys(card.counters).length === 0) {
            return '';
        }

        let countersHtml = '<div class="card-counters">';
        
        // Sort counters to show loyalty first for planeswalkers
        const counterTypes = Object.keys(card.counters).sort((a, b) => {
            if (a === 'loyalty') return -1;
            if (b === 'loyalty') return 1;
            return a.localeCompare(b);
        });

        for (const counterType of counterTypes) {
            const count = card.counters[counterType];
            if (count > 0) {
                const counterClass = this.getCounterClass(counterType);
                
                // Special handling for +1/+1 and -1/-1 counters
                if (counterType === '+1/+1') {
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            <span class="counter-value">+${count}/+${count}</span>
                        </div>
                    `;
                } else if (counterType === '-1/-1') {
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            <span class="counter-value">-${count}/-${count}</span>
                        </div>
                    `;
                } else {
                    // Default handling for other counter types
                    const counterIcon = this.getCounterIcon(counterType);
                    const iconMarkup = counterIcon
                        ? `<span class="counter-icon">${counterIcon}</span>`
                        : `<span class="counter-icon counter-icon-text">${counterType}</span>`;
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            ${iconMarkup}
                            <span class="counter-value">${count}</span>
                        </div>
                    `;
                }
            }
        }
        
        countersHtml += '</div>';
        return countersHtml;
    },

    getCustomKeywords: function(cardData) {
        if (!cardData) {
            return [];
        }

        const source = cardData.custom_keywords || cardData.customKeywords;
        if (!Array.isArray(source)) {
            return [];
        }

        return source
            .map(keyword => String(keyword).trim())
            .filter(keyword => keyword.length > 0);
    },

    getCustomTypes: function(cardData) {
        if (!cardData) {
            return [];
        }

        const source = cardData.custom_types || cardData.customTypes;
        if (!Array.isArray(source)) {
            return [];
        }

        return source
            .map(type => String(type).trim().toLowerCase())
            .filter(type => type.length > 0);
    },

    generateKeywordOverlay: function(card) {
        const keywords = this.getCustomKeywords(card);
        if (!keywords.length) {
            return '';
        }

        const escape = (typeof GameUtils !== 'undefined' && typeof GameUtils.escapeHtml === 'function')
            ? GameUtils.escapeHtml
            : (value) => value;
        const maxVisible = 3;
        const visible = keywords.slice(0, maxVisible).map(escape);
        const extraCount = keywords.length - visible.length;
        const suffix = extraCount > 0 ? ` +${extraCount}` : '';

        return `
            <div class="card-keyword-overlay" title="${escape(keywords.join(', '))}">
                ${visible.join(' • ')}${suffix}
            </div>
        `;
    },

    generateTypeOverlay: function(card) {
        const types = this.getCustomTypes(card);
        if (!types.length) {
            return '';
        }

        const escape = (typeof GameUtils !== 'undefined' && typeof GameUtils.escapeHtml === 'function')
            ? GameUtils.escapeHtml
            : (value) => value;
        const displayTypes = types.map(type => {
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            return escape(label);
        });

        return `
            <div class="card-type-overlay" title="Custom types: ${escape(displayTypes.join(', '))}">
                ${displayTypes.join(' • ')}
            </div>
        `;
    },

    generateCardOverlayStack: function(card) {
        const keywordOverlay = this.generateKeywordOverlay(card);
        const typeOverlay = this.generateTypeOverlay(card);
        if (!keywordOverlay && !typeOverlay) {
            return '';
        }

        return `
            <div class="card-overlay-stack">
                ${keywordOverlay}
                ${typeOverlay}
            </div>
        `;
    },

    getCounterIcon: function(counterType) {
        if (!counterType) {
            return null;
        }

        const icons = {
            'loyalty': '🛡️',
            '+1/+1': '💪',
            '-1/-1': '💀',
            'charge': '⚡',
            'poison': '☠️',
            'energy': '⚡',
            'experience': '🎓',
            'treasure': '💰',
            'food': '🍖',
            'clue': '🔍',
            'blood': '🩸',
            'oil': '🛢️'
        };

        if (Object.prototype.hasOwnProperty.call(icons, counterType)) {
            return icons[counterType];
        }

        const normalized = typeof counterType === 'string'
            ? counterType.toLowerCase()
            : counterType;
        if (normalized && Object.prototype.hasOwnProperty.call(icons, normalized)) {
            return icons[normalized];
        }

        return null;
    },

    getCounterClass: function(counterType) {
        const classes = {
            'loyalty': 'counter-loyalty',
            '+1/+1': 'counter-plus',
            '-1/-1': 'counter-minus',
            'charge': 'counter-charge',
            'poison': 'counter-poison'
        };
        return classes[counterType] || 'counter-generic';
    },

    showCardContextMenu: function(event, cardElement) {
        event.preventDefault();
        // Delegate to Svelte CardContextMenu component
        if (typeof CardContextMenu !== 'undefined' && typeof CardContextMenu.show === 'function') {
            CardContextMenu.show(event, cardElement);
        } else {
            console.warn('[GameCards] CardContextMenu component not available');
        }
    },

    toggleCardTarget: function(uniqueCardId) {
        CardPreviewModal.hide();
        
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const isTargeted = cardElement.classList.toggle('targeted');
            cardElement.setAttribute('data-card-targeted', isTargeted.toString());
            const cardId = cardElement.getAttribute('data-card-id');
            
            GameActions.performGameAction('target_card', {
                unique_id: uniqueCardId,
                card_id: cardId,
                targeted: isTargeted
            });
        }
    },

    closeContextMenu: function() {
        // Delegate to Svelte CardContextMenu component
        if (typeof CardContextMenu !== 'undefined' && typeof CardContextMenu.hide === 'function') {
            CardContextMenu.hide();
        }
    },

    _getAttachmentsFromState: function(hostUniqueId) {
        if (
            typeof GameCore === 'undefined' ||
            typeof GameCore.getGameState !== 'function'
        ) {
            return [];
        }
        const state = GameCore.getGameState();
        const players = Array.isArray(state?.players) ? state.players : [];
        const collector = (cards, hostId, acc = []) => {
            const normalizeOrder = (value) => {
                const parsed = parseInt(value, 10);
                return Number.isFinite(parsed) ? parsed : null;
            };
            const list = cards
                .filter((c) => (c?.attached_to || c?.attachedTo) === hostId)
                .sort((a, b) => {
                    const orderA = normalizeOrder(a?.attachment_order ?? a?.attachmentOrder);
                    const orderB = normalizeOrder(b?.attachment_order ?? b?.attachmentOrder);
                    if (orderA !== null && orderB !== null && orderA !== orderB) {
                        return orderA - orderB;
                    }
                    return 0;
                });
            list.forEach((card) => {
                acc.push(card);
                collector(cards, card?.unique_id || card?.uniqueId, acc);
            });
            return acc;
        };
        for (const player of players) {
            const battlefield = Array.isArray(player?.battlefield) ? player.battlefield : [];
            const attachments = collector(battlefield, hostUniqueId, []);
            if (attachments.length) {
                return attachments;
            }
        }
        return [];
    },

    showAttachmentsModal: function(hostUniqueId, hostName = 'Attached Cards') {
        if (!hostUniqueId) {
            return;
        }

        const attachmentsFromState = this._getAttachmentsFromState(hostUniqueId);
        const domAttachments = Array.from(document.querySelectorAll(`[data-attached-to="${hostUniqueId}"]`));
        const attachments = attachmentsFromState.length
            ? attachmentsFromState
            : domAttachments.map((el) => {
                try {
                    const parsed = JSON.parse(el.getAttribute('data-card-data') || '{}');
                    const zoneAttr = el.getAttribute('data-card-zone') || 'battlefield';
                    return {
                        ...parsed,
                        card_zone: parsed.card_zone || zoneAttr,
                        zone: parsed.zone || zoneAttr,
                        name: parsed.name || el.getAttribute('data-card-name') || parsed.id || 'Card'
                    };
                } catch (_err) {
                    return null;
                }
            }).filter(Boolean);
        if (!attachments.length) {
            return;
        }

        // Remove any existing attachment modal
        this.closeAttachmentsModal();

        const modal = document.createElement('div');
        modal.id = 'attachment-popup';
        modal.className = 'stack-popup attachment-popup';
        modal.dataset.appear = 'visible';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Attached Cards');

        const countLabel = attachments.length;
        const itemsHtml = attachments.map((cardData, index) => {
            const zone = cardData?.zone || cardData?.card_zone || 'battlefield';
            const ownerId = cardData?.owner_id || cardData?.ownerId || '';
            const controllerId = cardData?.controller_id || cardData?.controllerId || ownerId;
            const cardId = cardData?.id || cardData?.card_id || cardData?.name || '';
            const uniqueId = cardData?.unique_id || cardData?.uniqueId || '';
            const cardName = cardData?.name || 'Card';
            const imageUrl = (typeof GameCards.getSafeImageUrl === 'function')
                ? GameCards.getSafeImageUrl(cardData)
                : (cardData?.image_url || cardData?.image || '');
            const safeName = GameUtils.escapeHtml(cardName);
            const safeImage = GameUtils.escapeHtml(imageUrl || '');
            const serialized = GameUtils.escapeHtml(JSON.stringify(cardData));

            return `
                <div class="stack-spell"
                     data-card-id="${GameUtils.escapeHtml(cardId)}"
                     data-card-unique-id="${GameUtils.escapeHtml(uniqueId)}"
                     data-card-name="${safeName}"
                     data-card-image="${safeImage}"
                     data-card-zone="${GameUtils.escapeHtml(zone)}"
                     data-card-owner="${GameUtils.escapeHtml(ownerId)}"
                     data-card-controller="${GameUtils.escapeHtml(controllerId)}"
                     data-card-data='${serialized}'
                     draggable="true"
                     ondragstart="GameCards.handleDragStart(event, this)"
                     ondragend="GameCards.handleDragEnd(event, this)"
                     oncontextmenu="GameCards.handleAttachmentModalContextMenu(event, this); return false;">
                    <div class="stack-card-container">
                        ${safeImage
                            ? `<img src="${safeImage}" alt="${safeName}" class="stack-card-image" />`
                            : `<div class="stack-card-fallback"></div>`}
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="stack-popup-header" data-draggable-handle>
                <div class="stack-popup-title">
                    <span class="stack-popup-icon">📎</span>
                    <span class="stack-popup-label">${GameUtils.escapeHtml(hostName)}</span>
                    <span class="stack-popup-count">${countLabel}</span>
                </div>
                <button class="counter-modal-close" onclick="GameCards.closeAttachmentsModal()" aria-label="Close attachments">&times;</button>
            </div>
            <div class="stack-popup-body">
                <div class="stack-container">
                    <div class="stack-content" role="list" aria-label="Attached Cards">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const clampPosition = (left, top) => {
            const padding = 12;
            const rect = modal.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width - padding;
            const maxY = window.innerHeight - rect.height - padding;
            const clampedLeft = Math.min(Math.max(left, padding), Math.max(maxX, padding));
            const clampedTop = Math.min(Math.max(top, padding), Math.max(maxY, padding));
            modal.style.left = `${clampedLeft}px`;
            modal.style.top = `${clampedTop}px`;
        };

        const pointer = this._lastContextPosition;
        const modalRect = modal.getBoundingClientRect();
        const fallbackLeft = Math.max(16, window.innerWidth - (modalRect.width || 360) - 32);
        const fallbackTop = Math.max(24, (window.innerHeight - (modalRect.height || 240)) / 2);
        const initialLeft = pointer ? pointer.x + 12 : fallbackLeft;
        const initialTop = pointer ? pointer.y + 12 : fallbackTop;
        clampPosition(initialLeft, initialTop);

        const dragHandle = modal.querySelector('[data-draggable-handle]');
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onMouseDown = (event) => {
            dragging = true;
            modal.classList.add('stack-popup-dragging');
            offsetX = event.clientX - modal.getBoundingClientRect().left;
            offsetY = event.clientY - modal.getBoundingClientRect().top;
            event.preventDefault();
        };

        const onMouseMove = (event) => {
            if (!dragging) return;
            clampPosition(event.clientX - offsetX, event.clientY - offsetY);
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            modal.classList.remove('stack-popup-dragging');
        };

        if (dragHandle) {
            dragHandle.addEventListener('mousedown', onMouseDown);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        modal._attachmentDragCleanup = () => {
            if (dragHandle) dragHandle.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        if (!this._boundCloseAttachmentClick) {
            this._boundCloseAttachmentClick = (event) => {
                if (event.target === modal) {
                    this.closeAttachmentsModal();
                }
            };
        }
        modal.addEventListener('click', this._boundCloseAttachmentClick);
    },

    handleAttachmentModalContextMenu: function(event, element = null) {
        event.preventDefault();
        event.stopPropagation();
        const cardElement = element || event.currentTarget || event.target.closest('[data-card-unique-id]');
        if (!cardElement) {
            return false;
        }

        const cardId = cardElement.getAttribute('data-card-id');
        const uniqueId = cardElement.getAttribute('data-card-unique-id');
        if (!cardId || !uniqueId) {
            return false;
        }

        this.closeAttachmentContextMenu();

        const menu = document.createElement('div');
        menu.id = 'attachment-context-menu';
        menu.className = 'card-context-menu';

        const detachItem = document.createElement('div');
        detachItem.className = 'card-context-menu-item';
        detachItem.innerHTML = '<span class="icon">🔓</span> Detach';
        detachItem.onclick = () => {
            if (typeof GameActions !== 'undefined' && typeof GameActions.detachCard === 'function') {
                GameActions.detachCard(cardId, uniqueId);
            }
            this.closeAttachmentContextMenu();
            this.closeAttachmentsModal();
        };

        menu.appendChild(detachItem);

        const pointerX = event.clientX || 0;
        const pointerY = event.clientY || 0;
        menu.style.left = `${pointerX}px`;
        menu.style.top = `${pointerY}px`;

        document.body.appendChild(menu);
        this._lastContextPosition = { x: pointerX, y: pointerY };

        if (!this._boundAttachmentMenuClose) {
            this._boundAttachmentMenuClose = (evt) => {
                if (!menu.contains(evt.target)) {
                    this.closeAttachmentContextMenu();
                }
            };
        }

        if (!this._boundAttachmentMenuKeydown) {
            this._boundAttachmentMenuKeydown = (evt) => {
                if (evt.key === 'Escape') {
                    this.closeAttachmentContextMenu();
                }
            };
        }

        document.addEventListener('click', this._boundAttachmentMenuClose, true);
        document.addEventListener('keydown', this._boundAttachmentMenuKeydown);

        return false;
    },

    closeAttachmentContextMenu: function() {
        const existing = document.getElementById('attachment-context-menu');
        if (existing) {
            existing.remove();
        }
        if (this._boundAttachmentMenuClose) {
            document.removeEventListener('click', this._boundAttachmentMenuClose, true);
        }
        if (this._boundAttachmentMenuKeydown) {
            document.removeEventListener('keydown', this._boundAttachmentMenuKeydown);
        }
    },

    closeAttachmentsModal: function() {
        const modal = document.getElementById('attachment-popup');
        if (modal) {
            if (this._boundCloseAttachmentClick) {
                modal.removeEventListener('click', this._boundCloseAttachmentClick);
            }
            if (typeof modal._attachmentDragCleanup === 'function') {
                modal._attachmentDragCleanup();
            }
            modal.remove();
        }
        this.closeAttachmentContextMenu();
        CardPreviewModal.hide();
    },

    _boundCloseContextMenu: null,

    startAttachmentSelection: function(cardId, uniqueCardId) {
        CardPreviewModal.hide();
        this.closeContextMenu();
        this.cancelAttachmentSelection();

        const sourceElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        const sourceOwner = sourceElement ? sourceElement.getAttribute('data-card-owner') : null;

        const candidates = Array.from(
            document.querySelectorAll('.battlefield-zone [data-card-unique-id]')
        ).filter((el) => {
            const uid = el.getAttribute('data-card-unique-id');
            return uid && uid !== uniqueCardId;
        });

        if (!candidates.length) {
            console.warn('[GameCards] No valid attachment targets found.');
            return;
        }

        this._attachmentSelection = {
            cardId,
            uniqueId: uniqueCardId,
            owner: sourceOwner
        };
        this._attachmentTargets = candidates;
        candidates.forEach((el) => el.classList.add('attachment-targetable'));

        if (!this._boundAttachmentClickHandler) {
            this._boundAttachmentClickHandler = this.handleAttachmentTargetClick.bind(this);
        }
        if (!this._boundAttachmentKeydownHandler) {
            this._boundAttachmentKeydownHandler = this.handleAttachmentKeydown.bind(this);
        }

        document.addEventListener('click', this._boundAttachmentClickHandler, true);
        document.addEventListener('keydown', this._boundAttachmentKeydownHandler);
    },

    handleAttachmentTargetClick: function(event) {
        if (!this._attachmentSelection) {
            return;
        }

        const targetElement = event.target.closest('[data-card-unique-id]');
        if (!targetElement) {
            this.cancelAttachmentSelection();
            return;
        }

        const targetUniqueId = targetElement.getAttribute('data-card-unique-id');
        if (!targetUniqueId || targetUniqueId === this._attachmentSelection.uniqueId) {
            this.cancelAttachmentSelection();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (typeof GameActions !== 'undefined' && typeof GameActions.attachCard === 'function') {
            const targetCardId = targetElement.getAttribute('data-card-id');
            GameActions.attachCard(
                this._attachmentSelection.cardId,
                this._attachmentSelection.uniqueId,
                targetCardId,
                targetUniqueId
            );
        }

        this.cancelAttachmentSelection();
    },

    handleAttachmentKeydown: function(event) {
        if (event.key === 'Escape') {
            this.cancelAttachmentSelection();
        }
    },

    cancelAttachmentSelection: function() {
        if (this._attachmentTargets && this._attachmentTargets.length) {
            this._attachmentTargets.forEach((el) => el.classList.remove('attachment-targetable'));
        }
        this._attachmentTargets = [];
        this._attachmentSelection = null;

        if (this._boundAttachmentClickHandler) {
            document.removeEventListener('click', this._boundAttachmentClickHandler, true);
        }
        if (this._boundAttachmentKeydownHandler) {
            document.removeEventListener('keydown', this._boundAttachmentKeydownHandler);
        }
    },

    flipCard: function(cardId, uniqueCardId) {
        CardPreviewModal.hide();
        
        GameActions.performGameAction('flip_card', {
            card_id: cardId,
            unique_id: uniqueCardId
        });

        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const socket = window.websocket;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.warn('Card flip processed without active WebSocket; UI may require manual sync.');
            }
        }
    },

    handleDragStart: function(event, cardElement) {
        CardPreviewModal.hide();

        const cardId = cardElement.getAttribute('data-card-id');
        const cardZone = cardElement.getAttribute('data-card-zone');
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id');
        const cardOwnerId = cardElement.getAttribute('data-card-owner');
        event.dataTransfer.setData('text/plain', JSON.stringify({
            cardId,
            cardZone,
            uniqueCardId,
            cardOwnerId
        }));
        // Optionally: add visual feedback
        const dragHandle = cardElement.closest('.card-attachment-group') || cardElement;
        dragHandle.classList.add('dragging');
        if (dragHandle !== cardElement) {
            cardElement.classList.add('dragging');
        }
        event.dataTransfer.effectAllowed = 'move';
        GameCards.draggedCardElement = dragHandle;
    },

    /**
     * Handle card click - check combat mode first, then default to tap/untap
     */
    handleCardClick: function(cardId, uniqueCardId, zone) {
        // Check if we're in combat mode and this is a creature
        if (typeof GameCombat !== 'undefined') {
            if (GameCombat.combatMode === 'declaring_attackers' && zone === 'creatures') {
                GameCombat.toggleAttacker(uniqueCardId);
                return;
            }
            
            if (GameCombat.combatMode === 'declaring_blockers' && zone === 'creatures') {
                GameCombat.toggleBlocker(uniqueCardId);
                return;
            }
        }
        
        // Default behavior: tap/untap the card
        GameActions.tapCard(cardId, uniqueCardId);
    },

    handleDragEnd: function(event, cardElement) {
        if (!cardElement) return;
        
        cardElement.classList.remove('dragging');
        const dragHandle = cardElement.closest('.card-attachment-group') || cardElement;
        if (dragHandle && dragHandle !== cardElement) {
            dragHandle.classList.remove('dragging');
        }
        cardElement.style.removeProperty('opacity');
        cardElement.style.removeProperty('pointer-events');
        if (GameCards.draggedCardElement === cardElement || GameCards.draggedCardElement === dragHandle) {
            GameCards.draggedCardElement = null;
        }
    },

    showTypePopover: function(uniqueCardId, cardId) {
        CardPreviewModal.hide();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openTypePopover === 'function') {
            UICardManager.openTypePopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Type popover is unavailable.');
        }
    },

    showCounterPopover: function(uniqueCardId, cardId) {
        CardPreviewModal.hide();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openCounterPopover === 'function') {
            UICardManager.openCounterPopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Counter popover is unavailable.');
        }
    },

    showPowerToughnessPopover: function(uniqueCardId, cardId) {
        CardPreviewModal.hide();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openPowerPopover === 'function') {
            UICardManager.openPowerPopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Power/Toughness popover is unavailable.');
        }
    },

    // Backward compatibility shim
    showCounterModal: function(uniqueCardId, cardId) {
        this.showCounterPopover(uniqueCardId, cardId);
    },

    closeCounterModal: function() {
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.closeAll === 'function') {
            UICardManager.closeAll();
        }
    }
};

window.GameCards = GameCards;
