/**
 * ManaForge UI Utilities Module
 * Contains utility functions for UI generation
 */

class UIUtils {
    /**
     * Create CSS transform string
     */
    static createTransform(x = 0, y = 0, rotation = 0) {
        return `transform: translateX(${x}px) translateY(${y}px) rotate(${rotation}deg)`;
    }

    /**
     * Create CSS z-index string
     */
    static createZIndex(index) {
        return `z-index: ${index}`;
    }

    /**
     * Calculate anchor position for contextual popovers.
     */
    static calculateAnchorPosition(anchorElement = null, options = {}) {
        const {
            preferredAnchor = 'center',
            panelWidth = 380,
            panelHeight = 320,
            viewportPadding = 16,
            horizontalOffset = 0,
            verticalOffset = 8
        } = options || {};

        const normalizeAnchor = (anchorValue) => {
            const normalized = typeof anchorValue === 'string'
                ? anchorValue.toLowerCase()
                : '';
            if (!normalized || normalized === 'center') {
                return { vertical: 'center', horizontal: 'center' };
            }
            const parts = normalized.split('-');
            const verticalOptions = ['top', 'bottom', 'center'];
            const horizontalOptions = ['left', 'right', 'center'];
            let vertical = parts.find((part) => verticalOptions.includes(part)) || 'bottom';
            let horizontal = parts.find((part) => horizontalOptions.includes(part) && part !== vertical) || 'center';
            if (!horizontalOptions.includes(horizontal)) {
                horizontal = 'center';
            }
            return { vertical, horizontal };
        };

        const clamp = (value, min, max) => {
            if (Number.isNaN(value)) {
                return min;
            }
            if (Number.isNaN(min) || Number.isNaN(max)) {
                return value;
            }
            const normalizedMin = Math.min(min, max);
            const normalizedMax = Math.max(min, max);
            return Math.min(Math.max(value, normalizedMin), normalizedMax);
        };

        if (typeof window === 'undefined') {
            return { top: 200, left: 200, anchor: preferredAnchor || 'center' };
        }

        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let top = scrollY + viewportHeight / 2;
        let left = scrollX + viewportWidth / 2;
        const { vertical, horizontal } = normalizeAnchor(preferredAnchor);
        let resolvedAnchor = (vertical === 'center' && horizontal === 'center')
            ? 'center'
            : `${vertical}-${horizontal}`;

        if (anchorElement && typeof anchorElement.getBoundingClientRect === 'function') {
            const rect = anchorElement.getBoundingClientRect();
            if (vertical === 'top') {
                top = scrollY + rect.top - verticalOffset;
            } else if (vertical === 'bottom') {
                top = scrollY + rect.bottom + verticalOffset;
            } else {
                top = scrollY + rect.top + rect.height / 2;
            }

            if (horizontal === 'left') {
                left = scrollX + rect.left + horizontalOffset;
            } else if (horizontal === 'right') {
                left = scrollX + rect.right - horizontalOffset;
            } else {
                left = scrollX + rect.left + rect.width / 2;
            }
        }

        // Clamp horizontal position based on anchor orientation
        if (horizontal === 'center') {
            const minLeft = scrollX + viewportPadding + panelWidth / 2;
            const maxLeft = scrollX + viewportWidth - viewportPadding - panelWidth / 2;
            left = clamp(left, minLeft, maxLeft);
        } else if (horizontal === 'left') {
            const minLeft = scrollX + viewportPadding;
            const maxLeft = scrollX + viewportWidth - viewportPadding - panelWidth;
            left = clamp(left, minLeft, maxLeft);
        } else if (horizontal === 'right') {
            const minLeft = scrollX + viewportPadding + panelWidth;
            const maxLeft = scrollX + viewportWidth - viewportPadding;
            left = clamp(left, minLeft, maxLeft);
        }

        // Clamp vertical position based on anchor orientation
        if (vertical === 'center') {
            const minTop = scrollY + viewportPadding + panelHeight / 2;
            const maxTop = scrollY + viewportHeight - viewportPadding - panelHeight / 2;
            top = clamp(top, minTop, maxTop);
        } else if (vertical === 'top') {
            const minTop = scrollY + viewportPadding;
            const maxTop = scrollY + viewportHeight - viewportPadding - panelHeight;
            top = clamp(top, minTop, maxTop);
        } else if (vertical === 'bottom') {
            const minTop = scrollY + viewportPadding + panelHeight;
            const maxTop = scrollY + viewportHeight - viewportPadding;
            top = clamp(top, minTop, maxTop);
        }

        return { top, left, anchor: resolvedAnchor };
    }

    /**
     * Generate HTML button element
     */
    static generateButton(onclick, classes, title, content, disabled = false) {
        const disabledClasses = disabled ? ' opacity-40 cursor-not-allowed' : '';
        const disabledAttr = disabled ? 'disabled' : '';
        const styleAttr = disabled ? 'style="opacity: 0.4;"' : '';
        return `
            <button onclick="${onclick}" 
                    class="${classes}${disabledClasses}"
                    title="${title}"
                    ${disabledAttr}
                    ${styleAttr}>
                ${content}
            </button>
        `;
    }

    /**
     * Generate zone wrapper
     */
    static generateZoneWrapper(content, zoneType) {
        return `
            <div class="${UIConfig.CSS_CLASSES.zone.container} ${zoneType}-zone">
                ${content}
            </div>
        `;
    }

    /**
     * Generate empty zone content
     */
    static generateEmptyZoneContent(icon, message) {
        return `
            <div class="${UIConfig.CSS_CLASSES.zone.empty}">
                <div class="text-arena-text-dim text-center py-4">${icon} ${message}</div>
            </div>
        `;
    }

    /**
     * Generate empty zone fallback
     */
    static generateEmptyZone(icon, name) {
        return `
            <div class="card-fallback text-xs">
                <span class="text-2xl mb-2">${icon}</span>
                <div>${name}</div>
            </div>
        `;
    }

    /**
     * Generate click handler for zone modal
     */
    static generateZoneClickHandler(isOpponent, prefix, zoneType, title) {
        const handlerPrefix = isOpponent ? 'Opponent' : '';
        return `onclick="ZoneManager.show${handlerPrefix}ZoneModal('${prefix}${zoneType}')" title="Click to view ${title}"`;
    }

    /**
     * Filter cards by type for battlefield zones
     */
    static filterCardsByType(cards, zoneName) {
        if (!cards || !Array.isArray(cards)) return [];

        const workingSet = cards.filter((card) => {
            const hostId = card?.attached_to || card?.attachedTo;
            return !hostId;
        });

        const normalizeTypeText = (card) => {
            if (!card) return '';

            // Face-down cards are ONLY creatures (no other types)
            const isFaceDown = typeof GameCards !== 'undefined' && GameCards.isFaceDownCard?.(card);
            if (isFaceDown) {
                // Check for custom type overrides first
                const overrides = card.custom_types || card.customTypes;
                if (Array.isArray(overrides) && overrides.length > 0) {
                    return overrides.map(v => String(v).trim().toLowerCase()).filter(Boolean).join(' ');
                }
                return 'creature';
            }

            const customTypes = (() => {
                const overrides = card.custom_types || card.customTypes;
                if (!Array.isArray(overrides) || overrides.length === 0) {
                    return [];
                }
                return overrides
                    .map(value => String(value).trim().toLowerCase())
                    .filter(Boolean);
            })();

            if (customTypes.length) {
                return customTypes.join(' ');
            }

            const faceTypes = (() => {
                if (!Array.isArray(card.card_faces) || card.card_faces.length === 0) {
                    return [];
                }
                const currentFaceIndex = typeof card.current_face === 'number' ? card.current_face : 0;
                const activeFace = card.card_faces[currentFaceIndex] || card.card_faces[0];
                return activeFace && activeFace.type_line ? [activeFace.type_line] : [];
            })();
            const pieces = [
                card.card_type,
                card.cardType,
                card.type_line,
                card.typeLine,
                card.subtype,
                ...faceTypes
            ].filter(Boolean);
            return pieces.join(' ').toLowerCase();
        };

        if (zoneName === 'lands') {
            return workingSet.filter(card => {
                const typeText = normalizeTypeText(card);
                return typeText.includes('land');
            });
        } else if (zoneName === 'creatures') {
            return workingSet.filter(card => {
                const typeText = normalizeTypeText(card);
                return typeText.includes('creature');
            });
        } else if (zoneName === 'support') {
            return workingSet.filter(card => {
                const typeText = normalizeTypeText(card);
                const isCreature = typeText.includes('creature');
                const isLand = typeText.includes('land');
                const hasSupportType = ['artifact', 'enchantment', 'planeswalker'].some(type => typeText.includes(type));
                return hasSupportType && !isCreature && !isLand;
            });
        }
        return workingSet;
    }

    /**
     * Get zone configuration for player type
     */
    static getZoneConfiguration(isOpponent, playerIndex, playerName = null) {
        const prefix = isOpponent ? 'opponent_' : '';
        const safeName = typeof playerName === 'string' && playerName.trim().length
            ? playerName.trim()
            : null;
        const fallbackTitle = isOpponent ? "Opponent" : "Player";
        const titlePrefix = safeName ? `${safeName}'s ` : `${fallbackTitle}'s `;
        
        // Generate unique IDs for zone elements
        const zoneIds = {
            deck: isOpponent ? 'opponent-deck-preview' : 'deck-preview-container',
            graveyard: isOpponent ? 'opponent-graveyard-preview' : 'graveyard-preview',
            exile: isOpponent ? 'opponent-exile-preview' : 'exile-preview'
        };
        
        // Determine the correct player ID
        let playerId;
        if (playerIndex !== null) {
            playerId = `player${playerIndex + 1}`;
        } else {
            playerId = isOpponent ? 'player2' : 'player1';
        }

        return { prefix, titlePrefix, zoneIds, playerId };
    }
}

window.UIUtils = UIUtils;
