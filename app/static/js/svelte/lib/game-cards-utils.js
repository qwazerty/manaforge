/**
 * ManaForge Game Cards Utilities
 * Pure functions for card data processing and rendering
 */

export const CARD_BACK_IMAGE = '/static/images/card-back.jpg';

// ===== HELPER FUNCTIONS =====
function getGameState() {
    if (typeof GameCore !== 'undefined' && typeof GameCore.getGameState === 'function') {
        return GameCore.getGameState();
    }
    return null;
}

function getCurrentViewerSeat() {
    if (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function') {
        return GameCore.getSelectedPlayer();
    }
    return null;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ===== FACE DOWN CARD DETECTION =====
export function isFaceDownCard(card) {
    if (!card) return false;
    const name = (card.name || '').toLowerCase();
    const typeLine = (card.type_line || card.typeLine || '').toLowerCase();
    const setCode = (card.set || card.set_code || card.setCode || '').toLowerCase();
    const explicitFlag = card.face_down || card.is_face_down || card.faceDown;
    const manifestOrMorphToken = name === 'manifest' || name === 'morph' || (typeLine.includes('manifest') && card.is_token);
    const mentionsFaceDown = typeLine.includes('face-down') || typeLine.includes('face down');
    const isMueFaceDown = setCode === 'mue';
    return Boolean(explicitFlag || manifestOrMorphToken || mentionsFaceDown || isMueFaceDown);
}

export function canViewerSeeFaceDownCard(card, viewerId = null) {
    if (!card) return false;
    if (!isFaceDownCard(card)) return true;

    const resolvedViewer = viewerId || getCurrentViewerSeat();
    if (!resolvedViewer || resolvedViewer === 'spectator') return false;

    const ownerId = card.face_down_owner || card.face_down_owner_id || card.faceDownOwner || card.faceDownOwnerId;
    if (!ownerId) return false;

    return ownerId.toLowerCase() === String(resolvedViewer).toLowerCase();
}

export function buildMaskedCardData(card, displayName = 'Face-down Card') {
    if (!card) return null;
    return {
        ...card,
        name: displayName,
        oracle_text: '',
        text: '',
        type_line: 'Face-down Card',
        image_url: undefined,
        card_faces: []
    };
}

// ===== CREATURE DETECTION =====
export function isCreatureCard(card) {
    if (!card) return false;
    if (isFaceDownCard(card)) return true;
    const typeLine = (card.type_line || card.typeLine || card.card_type || card.cardType || '').toLowerCase();
    if (typeLine.includes('creature')) return true;
    const customTypes = card.custom_types || card.customTypes;
    if (Array.isArray(customTypes) && customTypes.some(t => String(t).toLowerCase().includes('creature'))) return true;
    return false;
}

// ===== IMAGE URL HANDLING =====
export function getSafeImageUrl(card, options = {}) {
    if (!card) return null;

    const viewerId = options.viewerId || getCurrentViewerSeat();
    const ignoreFaceDown = Boolean(options.ignoreFaceDown);
    const canRevealFaceDown = ignoreFaceDown || canViewerSeeFaceDownCard(card, viewerId);
    const treatAsFaceDown = isFaceDownCard(card) && !canRevealFaceDown;
    const baseImage = card.image_url || card.image;

    if (card.is_double_faced && card.card_faces && card.card_faces.length > 1) {
        const currentFace = card.current_face || 0;
        if (currentFace < card.card_faces.length && card.card_faces[currentFace].image_url) {
            if (treatAsFaceDown) return CARD_BACK_IMAGE;
            return card.card_faces[currentFace].image_url;
        }
    }

    if (treatAsFaceDown) return CARD_BACK_IMAGE;
    if (!baseImage) return null;
    if (baseImage.includes("/back/") && !card.is_double_faced) return null;

    return baseImage;
}

export function preloadCardImages(cards) {
    if (!cards || !Array.isArray(cards)) return;
    cards.forEach(card => {
        const imageUrl = getSafeImageUrl(card);
        if (imageUrl) {
            const img = new Image();
            img.src = imageUrl;
        }
    });
}

// ===== SEARCH INDEX =====
export function buildSearchIndex(card) {
    if (!card) return '';

    const fragments = [];
    const push = (value) => {
        if (value) fragments.push(String(value).toLowerCase());
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
            if (!face) return;
            push(face.name);
            push(face.type_line || face.typeLine);
            push(face.oracle_text || face.text);
            if (Array.isArray(face.keywords)) {
                push(face.keywords.join(' '));
            }
        });
    }

    return fragments.join(' ').replace(/\s+/g, ' ').trim();
}

// ===== POWER/TOUGHNESS =====
export function computeEffectivePowerToughness(card) {
    if (!card) return null;

    const normalize = (value) => {
        if (value === undefined || value === null) return null;
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

    if (!displayPowerText || !displayToughnessText) return null;

    const hasModification = (overridePowerRaw !== null && overridePowerRaw !== basePowerRaw) ||
        (overrideToughnessRaw !== null && overrideToughnessRaw !== baseToughnessRaw);

    return {
        basePowerText: basePowerRaw,
        baseToughnessText: baseToughnessRaw,
        displayPowerText,
        displayToughnessText,
        hasModification
    };
}

// ===== CUSTOM TYPES/KEYWORDS =====
export function getCustomKeywords(cardData) {
    if (!cardData) return [];
    const source = cardData.custom_keywords || cardData.customKeywords;
    if (!Array.isArray(source)) return [];
    return source.map(keyword => String(keyword).trim()).filter(keyword => keyword.length > 0);
}

export function getCustomTypes(cardData) {
    if (!cardData) return [];
    const source = cardData.custom_types || cardData.customTypes;
    if (!Array.isArray(source)) return [];
    return source.map(type => String(type).trim().toLowerCase()).filter(type => type.length > 0);
}

// ===== COUNTER HELPERS =====
const COUNTER_ICONS = {
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

const COUNTER_CLASSES = {
    'loyalty': 'counter-loyalty',
    '+1/+1': 'counter-plus',
    '-1/-1': 'counter-minus',
    'charge': 'counter-charge',
    'poison': 'counter-poison'
};

export function getCounterIcon(counterType) {
    if (!counterType) return null;
    if (COUNTER_ICONS[counterType]) return COUNTER_ICONS[counterType];
    const normalized = counterType.toLowerCase();
    return COUNTER_ICONS[normalized] || null;
}

export function getCounterClass(counterType) {
    return COUNTER_CLASSES[counterType] || 'counter-generic';
}

// ===== VISUAL STATE COMPUTATION =====
export function computeCardVisualState(card, _zone = 'unknown', isOpponent = false) {
    const isTapped = Boolean(card?.tapped);
    const isTargeted = Boolean(card?.targeted);
    const isAttacking = Boolean(card?.attacking);
    const isBlocking = Boolean(card?.blocking);
    
    const gameState = getGameState();
    const inCombatPhase = ['attack', 'block', 'damage'].includes((gameState?.phase || '').toLowerCase());
    const combatState = gameState?.combat_state || {};
    const pendingBlockers = combatState && typeof combatState.pending_blockers === 'object' ? combatState.pending_blockers : {};
    const combatStep = combatState?.step || null;
    const frontendCombatMode = typeof GameCombat !== 'undefined' ? GameCombat.combatMode : null;
    const isDeclaringAttackers = combatStep === 'declare_attackers' || frontendCombatMode === 'declaring_attackers';
    const isPendingBlocker = Object.prototype.hasOwnProperty.call(pendingBlockers, card?.unique_id);

    const suppressTappedVisual = inCombatPhase && isTapped && (isAttacking || isBlocking || isPendingBlocker) && isDeclaringAttackers;

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
        transforms.push(`translateY(${translateY}px)`);
        if (isTapped && !suppressTappedVisual) transforms.push('rotate(90deg)');
        if (transforms.length) transformValue = transforms.join(' ');
    }

    return {
        classes,
        data: { isTapped, isTargeted, isAttacking, isBlocking },
        transformValue,
        styleText: transformValue ? `transform: ${transformValue};` : ''
    };
}

// ===== PRIMARY CARD TYPE RESOLUTION =====
export function resolvePrimaryCardType(card) {
    if (!card) return { typeLine: '', primaryCardType: '' };

    const customTypes = getCustomTypes(card);

    if (isFaceDownCard(card)) {
        const typeLine = customTypes.length ? customTypes.join(' ').toLowerCase() : 'creature';
        let primaryCardType = 'creature';
        if (customTypes.length) {
            const priorityOrder = ['creature', 'land', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery'];
            const normalizedTypes = customTypes.map(type => type.toLowerCase());
            const prioritized = priorityOrder.find(type => normalizedTypes.includes(type));
            primaryCardType = prioritized || customTypes[0];
        }
        return { typeLine, primaryCardType };
    }

    const typePieces = [];
    const pushType = (value) => {
        if (value) typePieces.push(String(value));
    };

    pushType(card.card_type);
    pushType(card.cardType);
    pushType(card.type_line);
    pushType(card.typeLine);
    if (Array.isArray(card.types)) card.types.forEach(pushType);
    if (Array.isArray(card.subtypes)) card.subtypes.forEach(pushType);
    if (Array.isArray(card.supertypes)) card.supertypes.forEach(pushType);
    if (Array.isArray(card.card_faces)) {
        card.card_faces.forEach(face => {
            pushType(face?.type_line);
            pushType(face?.typeLine);
            if (Array.isArray(face?.types)) face.types.forEach(pushType);
            if (Array.isArray(face?.subtypes)) face.subtypes.forEach(pushType);
        });
    }
    if (customTypes.length) customTypes.forEach(pushType);

    const typeLine = typePieces.join(' ').toLowerCase();
    let primaryCardType = '';

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

    return { typeLine, primaryCardType };
}

// ===== HTML GENERATION HELPERS =====
export function generateCountersHtml(card) {
    if (!card?.counters || Object.keys(card.counters).length === 0) return '';

    let countersHtml = '<div class="card-counters">';
    const counterTypes = Object.keys(card.counters).sort((a, b) => {
        if (a === 'loyalty') return -1;
        if (b === 'loyalty') return 1;
        return a.localeCompare(b);
    });

    for (const counterType of counterTypes) {
        const count = card.counters[counterType];
        if (count > 0) {
            const counterClass = getCounterClass(counterType);
            if (counterType === '+1/+1') {
                countersHtml += `<div class="counter ${counterClass}" title="${count} ${counterType} counter(s)"><span class="counter-value">+${count}/+${count}</span></div>`;
            } else if (counterType === '-1/-1') {
                countersHtml += `<div class="counter ${counterClass}" title="${count} ${counterType} counter(s)"><span class="counter-value">-${count}/-${count}</span></div>`;
            } else {
                const counterIcon = getCounterIcon(counterType);
                const iconMarkup = counterIcon
                    ? `<span class="counter-icon">${counterIcon}</span>`
                    : `<span class="counter-icon counter-icon-text">${counterType}</span>`;
                countersHtml += `<div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">${iconMarkup}<span class="counter-value">${count}</span></div>`;
            }
        }
    }

    countersHtml += '</div>';
    return countersHtml;
}

export function generatePowerToughnessOverlay(card) {
    if (isFaceDownCard(card)) {
        return `<div class="card-pt-overlay" data-pt-base="2/2" data-pt-value="2/2"><span class="card-pt-value">2</span>/<span class="card-pt-value">2</span></div>`;
    }

    const stats = computeEffectivePowerToughness(card);
    if (!stats) return '';

    const powerText = escapeHtml(stats.displayPowerText);
    const toughnessText = escapeHtml(stats.displayToughnessText);
    const basePowerText = stats.basePowerText ? escapeHtml(stats.basePowerText) : '';
    const baseToughnessText = stats.baseToughnessText ? escapeHtml(stats.baseToughnessText) : '';
    const dataBase = basePowerText || baseToughnessText ? `${basePowerText}/${baseToughnessText}` : '';
    const dataValue = `${powerText}/${toughnessText}`;
    const overlayClass = stats.hasModification ? 'card-pt-overlay card-pt-overlay-modified' : 'card-pt-overlay';

    return `<div class="${overlayClass}" data-pt-base="${dataBase}" data-pt-value="${dataValue}"><span class="card-pt-value">${powerText}</span>/<span class="card-pt-value">${toughnessText}</span></div>`;
}

export function generateKeywordOverlay(card) {
    const keywords = getCustomKeywords(card);
    if (!keywords.length) return '';

    const maxVisible = 3;
    const visible = keywords.slice(0, maxVisible).map(escapeHtml);
    const extraCount = keywords.length - visible.length;
    const suffix = extraCount > 0 ? ` +${extraCount}` : '';

    return `<div class="card-keyword-overlay" title="${escapeHtml(keywords.join(', '))}">${visible.join(' • ')}${suffix}</div>`;
}

export function generateTypeOverlay(card) {
    const types = getCustomTypes(card);
    if (!types.length) return '';

    const displayTypes = types.map(type => {
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        return escapeHtml(label);
    });

    return `<div class="card-type-overlay" title="Custom types: ${escapeHtml(displayTypes.join(', '))}">${displayTypes.join(' • ')}</div>`;
}

export function generateCommanderOverlay(card) {
    if (!card) return '';
    const isCommander = card.is_commander || card.isCommander;
    if (!isCommander) return '';
    return `<div class="card-commander-overlay" title="Commander"><i class="ms ms-commander"></i></div>`;
}

export function generateCardOverlayStack(card) {
    const keywordOverlay = generateKeywordOverlay(card);
    const typeOverlay = generateTypeOverlay(card);
    if (!keywordOverlay && !typeOverlay) return '';
    return `<div class="card-overlay-stack">${keywordOverlay}${typeOverlay}</div>`;
}

// ===== ATTACHMENT HELPERS =====
export function getAttachmentsFromState(hostUniqueId) {
    const state = getGameState();
    const players = Array.isArray(state?.players) ? state.players : [];

    const collector = (cards, hostId, acc = []) => {
        const normalizeOrder = (value) => {
            const parsed = parseInt(String(value), 10);
            return Number.isFinite(parsed) ? parsed : null;
        };

        const list = cards
            .filter((c) => (c?.attached_to || c?.attachedTo) === hostId)
            .sort((a, b) => {
                const orderA = normalizeOrder(a?.attachment_order ?? a?.attachmentOrder);
                const orderB = normalizeOrder(b?.attachment_order ?? b?.attachmentOrder);
                if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
                return 0;
            });

        list.forEach((card) => {
            acc.push(card);
            collector(cards, card?.unique_id || card?.uniqueId || '', acc);
        });
        return acc;
    };

    for (const player of players) {
        const battlefield = Array.isArray(player?.battlefield) ? player.battlefield : [];
        const attachments = collector(battlefield, hostUniqueId, []);
        if (attachments.length) return attachments;
    }
    return [];
}

// Export escapeHtml and getCurrentViewerSeat for external use
export { escapeHtml, getCurrentViewerSeat };
