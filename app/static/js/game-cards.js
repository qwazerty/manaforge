/**
 * ManaForge Game Cards Module
 * Functions for card rendering and management
 */
const GameCards = {
    draggedCardElement: null,
    keywordDescriptions: {
        'flying': {
            name: 'Flying',
            description: 'Creatures with flying can only be blocked by creatures with flying or reach.'
        },
        'first strike': {
            name: 'First strike',
            description: 'This creature deals combat damage before creatures without first strike.'
        },
        'double strike': {
            name: 'Double strike',
            description: 'This creature deals both first-strike and regular combat damage.'
        },
        'deathtouch': {
            name: 'Deathtouch',
            description: 'Any amount of damage this creature deals to a creature is enough to destroy it.'
        },
        'lifelink': {
            name: 'Lifelink',
            description: 'Damage dealt by this creature also causes you to gain that much life.'
        },
        'vigilance': {
            name: 'Vigilance',
            description: 'Attacking doesn’t cause this creature to tap.'
        },
        'menace': {
            name: 'Menace',
            description: 'This creature can’t be blocked except by two or more creatures.'
        },
        'reach': {
            name: 'Reach',
            description: 'This creature can block creatures with flying.'
        },
        'trample': {
            name: 'Trample',
            description: 'Excess combat damage this creature deals to a blocker is dealt to the defending player or planeswalker.'
        },
        'haste': {
            name: 'Haste',
            description: 'This creature can attack and tap as soon as it comes under your control.'
        },
        'hexproof': {
            name: 'Hexproof',
            description: 'This permanent can’t be the target of spells or abilities your opponents control.'
        },
        'indestructible': {
            name: 'Indestructible',
            description: 'Effects that say “destroy” don’t destroy this permanent. It also can’t be destroyed by lethal damage.'
        },
        'ward': {
            name: 'Ward',
            description: 'Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.',
        },
        'prowess': {
            name: 'Prowess',
            description: 'Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.'
        },
        'flash': {
            name: 'Flash',
            description: 'You may cast this spell any time you could cast an instant.',
        },
        'defender': {
            name: 'Defender',
            description: 'This creature can’t attack.'
        },
        'scry': {
            name: 'Scry',
            description: 'Look at the top card(s) of your library. You may put any number of them on the bottom of your library and the rest back on top in any order.',
        },
        'surveil': {
            name: 'Surveil',
            description: 'Look at the top card(s) of your library. You may put any number of them into your graveyard and the rest back on top in any order.'
        },
        'cascade': {
            name: 'Cascade',
            description: 'When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost.'
        },
        'cycling': {
            name: 'Cycling',
            description: 'Pay the cycling cost, discard this card: Draw a card.'
        },
        'equip': {
            name: 'Equip',
            description: 'Equip only as a sorcery. Attach this Equipment to target creature you control.',
        }
    },
    getSafeImageUrl: function(card) {
        if (!card || !card.image_url) return null;
        
        // Pour les cartes double faces, permettre les images de face arrière
        if (card.is_double_faced && card.card_faces && card.card_faces.length > 1) {
            const currentFace = card.current_face || 0;
            if (currentFace < card.card_faces.length && card.card_faces[currentFace].image_url) {
                return card.card_faces[currentFace].image_url;
            }
        }
        
        // Pour les cartes simples, éviter les images "/back/" (dos de cartes génériques)
        if (card.image_url.includes("/back/") && !card.is_double_faced) return null;
        return card.image_url;
    },

    debugCardImage: function(cardName, imageUrl, context) {
        console.log(`🃏 [${context}] Card: ${cardName}`);
        console.log(`Image URL: ${imageUrl || 'none'}`);
        console.log(`Valid: ${!!imageUrl}`);
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

    renderCardWithLoadingState: function(card, cardClass = 'card-mini', showTooltip = true, zone = 'unknown', isOpponent = false, index = 0, playerId = null) {
        const cardId = card.id || card.name;
        const cardName = card.name || 'Unknown';
        const imageUrl = this.getSafeImageUrl(card);
        const isTapped = card.tapped || false;
        const isTargeted = card.targeted || false;
        const tappedClass = isTapped ? ' tapped' : '';
        const targetedClass = isTargeted ? ' targeted' : '';
        const uniqueCardId = card.unique_id;
        const escapedCardId = GameUtils.escapeJavaScript(cardId);
        const escapedCardName = GameUtils.escapeJavaScript(cardName);
        const escapedImageUrl = GameUtils.escapeJavaScript(imageUrl || '');
        const escapedUniqueId = GameUtils.escapeJavaScript(uniqueCardId);

        let onClickAction = '';
        if (zone === 'creatures' || zone === 'support' || zone === 'permanents' || zone === 'lands' || zone === 'battlefield') {
            onClickAction = `onclick="GameActions.tapCard('${escapedCardId}', '${escapedUniqueId}'); event.stopPropagation();"`;
        } else if (zone === 'hand') {
            onClickAction = `onclick="GameActions.playCardFromHand('${escapedCardId}', '${escapedUniqueId}'); event.stopPropagation();"`;
        }

        const escapedZone = GameUtils.escapeJavaScript(zone || '');
        const enableDrop =
            zone === 'battlefield' ||
            zone === 'lands' ||
            zone === 'creatures' ||
            zone === 'support' ||
            zone === 'permanents';
        const dropAttributes = enableDrop
            ? `ondragover="UIZonesManager.handleZoneDragOver(event)" ondragleave="UIZonesManager.handleZoneDragLeave(event)" ondrop="UIZonesManager.handleZoneDrop(event, '${escapedZone}')"`
            : '';

        // Generate counters display
        const countersHtml = this.generateCountersHtml(card);

        return `
            <div class="${cardClass}${tappedClass}${targetedClass}" 
                data-card-id="${escapedCardId}"
                data-card-unique-id="${escapedUniqueId}"
                data-card-name="${escapedCardName}"
                data-card-image="${escapedImageUrl}"
                data-card-zone="${zone}"
                data-card-tapped="${isTapped}"
                data-card-targeted="${isTargeted}"
                data-card-data='${JSON.stringify(card).replace(/'/g, "&#39;")}'
                data-is-opponent="${isOpponent}"
                draggable="true"
                ondragstart="GameCards.handleDragStart(event, this)"
                ${dropAttributes}
                ${onClickAction}
                ondragend="GameCards.handleDragEnd(event, this)"
                oncontextmenu="GameCards.showCardContextMenu(event, this); return false;">
                ${imageUrl ? `
                    <div class="relative">
                        <img src="${imageUrl}" 
                             alt="${cardName}" 
                             style="opacity: 0; transition: opacity 0.3s ease;"
                             onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="card-fallback" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none;">
                        </div>
                        ${countersHtml}
                    </div>
                ` : `
                    <div class="card-fallback">
                        ${countersHtml}
                    </div>
                `}
            </div>
        `;
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
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            <span class="counter-icon">${counterIcon}</span>
                            <span class="counter-value">${count}</span>
                        </div>
                    `;
                }
            }
        }
        
        countersHtml += '</div>';
        return countersHtml;
    },

    getCounterIcon: function(counterType) {
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
        return icons[counterType] || '🔢';
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

    findCardData: function(cardId, cardName) {
        const nodes = Array.from(document.querySelectorAll('[data-card-data]'));
        const parse = (raw) => {
            if (!raw) return null;
            try {
                return JSON.parse(
                    raw
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                );
            } catch (error) {
                console.warn('Failed to parse card data attribute', error);
                return null;
            }
        };

        if (cardId) {
            const byId = nodes.find(el => el.getAttribute('data-card-id') === cardId);
            if (byId) {
                const data = parse(byId.getAttribute('data-card-data'));
                if (data) return data;
            }
        }

        if (cardName) {
            const byName = nodes.find(el => el.getAttribute('data-card-name') === cardName);
            if (byName) {
                const data = parse(byName.getAttribute('data-card-data'));
                if (data) return data;
            }
        }

        return null;
    },

    renderKeywordDetails: function(cardData) {
        const keywords = this.extractKeywordsFromCard(cardData);
        if (!keywords.length) {
            return ``;
        }

        const list = keywords.map(info => `
            <div class="card-keyword-entry">
                <div class="card-keyword-name">${info.name}</div>
                <div class="card-keyword-description">${info.description}</div>
            </div>
        `).join('');

        return `
            <div class="card-keyword-section">
                <div class="card-keyword-list">
                    ${list}
                </div>
            </div>
        `;
    },

    extractKeywordsFromCard: function(cardData) {
        if (!cardData) {
            return [];
        }

        const keywordSet = new Set();
        const gatherKeywords = (collection) => {
            if (!Array.isArray(collection)) return;
            collection.forEach(keyword => {
                if (keyword) {
                    keywordSet.add(String(keyword).toLowerCase());
                }
            });
        };

        gatherKeywords(cardData.keywords);

        const textFragments = [];
        const pushText = (value) => {
            if (value) {
                textFragments.push(String(value));
            }
        };

        pushText(cardData.oracle_text || cardData.text);
        pushText(cardData.type_line || cardData.typeLine);

        if (Array.isArray(cardData.card_faces)) {
            cardData.card_faces.forEach(face => {
                gatherKeywords(face?.keywords);
                pushText(face?.oracle_text || face?.text);
            });
        }

        const fullText = textFragments.join('\n');
        const normalizedText = fullText.toLowerCase();
        const found = [];
        const seen = new Set();

        const buildRegex = (keyword) => {
            const escaped = String(keyword)
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');
            return new RegExp(`\\b${escaped}\\b`, 'i');
        };

        Object.entries(this.keywordDescriptions).forEach(([key, info]) => {
            if (seen.has(key)) {
                return;
            }

            const names = [info.name, key].concat(info.aliases || []);
            let matched = names.some(name => keywordSet.has(String(name).toLowerCase()));

            if (!matched && normalizedText) {
                if (info.patterns && info.patterns.length) {
                    matched = info.patterns.some(pattern => {
                        try {
                            return new RegExp(pattern, 'i').test(fullText);
                        } catch (error) {
                            return false;
                        }
                    });
                } else {
                    matched = names.some(name => buildRegex(name).test(fullText));
                }
            }

            if (matched) {
                const keywordInfo = { ...info };

                if (key === 'ward') {
                    const match = fullText.match(/Ward\s*(?:—|-)?\s*({[^}]+}|[^\n]+)/i);
                    if (match) {
                        const rawCost = (match[1] || match[0] || '').replace(/Ward/i, '').replace(/—|-/g, '').trim();
                        const wardCost = rawCost.length ? rawCost : 'cost';
                        keywordInfo.description = `Ward — ${wardCost} (Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.)`;
                    }
                }

                if (key === 'equip') {
                    const match = fullText.match(/Equip\s*({[^}]+})/i);
                    if (match) {
                        keywordInfo.description = `Equip ${match[1]} — Attach this Equipment to target creature you control. Activate only as a sorcery.`;
                    }
                }

                found.push(keywordInfo);
                seen.add(key);
            }
        });

        return found;
    },

    showCardPreview: function(cardId, cardName, imageUrl, event = null, cardData = null) {
        console.log(`📋 Card Preview: ${cardName} (ID: ${cardId})`);
        if (imageUrl) {
            console.log(`🖼️ Image: ${imageUrl}`);
        }

        const existingPreview = document.getElementById('card-preview-modal');
        if (existingPreview) {
            existingPreview.remove();
            this.removeCardPreviewListeners();
        }

        const preview = document.createElement('div');
        preview.id = 'card-preview-modal';
        preview.className = 'card-preview-modal show';

        const resolvedCardData = cardData || this.findCardData(cardId, cardName);
        const keywordDetails = this.renderKeywordDetails(resolvedCardData);

        preview.innerHTML = `
            <div class="card-preview-content">
                ${imageUrl ? `
                    <img src="${imageUrl}" alt="${cardName}" class="card-preview-image" />
                ` : `
                    <div class="card-preview-fallback">
                        <div class="card-name">${cardName}</div>
                    </div>
                `}
                <div class="card-preview-details">
                    <h3>${cardName}</h3>
                    ${keywordDetails}
                </div>
            </div>
        `;

        document.body.appendChild(preview);
        this.addCardPreviewListeners();

        if (event && event.clientX && event.clientY) {
            const previewRect = preview.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            let x = event.clientX + 20;
            let y = event.clientY + 20;

            if (x + previewRect.width > viewportWidth) {
                x = event.clientX - previewRect.width - 20;
            }
            if (y + previewRect.height > viewportHeight) {
                y = event.clientY - previewRect.height - 20;
            }

            x = Math.max(10, Math.min(x, viewportWidth - previewRect.width - 10));
            y = Math.max(10, Math.min(y, viewportHeight - previewRect.height - 10));

            preview.style.position = 'fixed';
            preview.style.left = `${x}px`;
            preview.style.top = `${y}px`;
            preview.style.transform = 'none';
        }
    },

    showCardContextMenu: function(event, cardElement) {
        event.preventDefault();

        const cardId = cardElement.getAttribute('data-card-id');
        const cardName = cardElement.getAttribute('data-card-name');
        const cardImage = cardElement.getAttribute('data-card-image');
        const cardZone = cardElement.getAttribute('data-card-zone') || 'unknown';
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id') || '';
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const isOpponent = cardElement.getAttribute('data-is-opponent') === 'true';
        const isTargeted = cardElement.classList.contains('targeted');
        const escapedCardId = GameUtils.escapeJavaScript(cardId || '');
        const escapedCardName = GameUtils.escapeJavaScript(cardName || '');
        const escapedCardImage = GameUtils.escapeJavaScript(cardImage || '');
        const escapedCardZone = GameUtils.escapeJavaScript(cardZone || '');
        const escapedUniqueCardId = GameUtils.escapeJavaScript(uniqueCardId || '');

        console.log(`🃏 Context menu for: ${cardName} (Zone: ${cardZone}, Tapped: ${isTapped}, UniqueID: ${uniqueCardId}, Opponent: ${isOpponent})`);

        const existingMenu = document.getElementById('card-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.id = 'card-context-menu';
        menu.className = 'card-context-menu';
        menu.style.visibility = 'hidden';
        menu.style.position = 'fixed';
        document.body.appendChild(menu);

        let menuHTML = '';
        if (cardImage) {
            menuHTML += `<div class="card-context-image"><img src="${escapedCardImage}" alt="${escapedCardName}" /></div>`;
        }

        menuHTML += `<div class="card-context-actions">
            <div class="card-context-header"><h3>${escapedCardName}</h3></div>
            <div class="card-context-menu-divider"></div>
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameCards.showCardPreview('${escapedCardId}', '${escapedCardName}', '${escapedCardImage}')"><span class="icon">🔍</span> View Full Size</div>
            <div class="card-context-menu-divider"></div>`;
        
        const targetAction = isTargeted ? 'Untarget' : 'Target';
        const targetIcon = isTargeted ? '❌' : '🎯';
        menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameCards.toggleCardTarget('${escapedUniqueCardId}')"><span class="icon">${targetIcon}</span> ${targetAction}</div>`;

        // Check if this is a double-faced card by looking at the card data
        const cardData = JSON.parse(cardElement.getAttribute('data-card-data') || '{}');
        const isDoubleFaced = cardData.is_double_faced && cardData.card_faces && cardData.card_faces.length > 1;
        
        if (isDoubleFaced && !isOpponent) {
            const currentFace = cardData.current_face || 0;
            const faceText = currentFace === 0 ? 'Back' : 'Front';
            menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameCards.flipCard('${escapedCardId}', '${escapedUniqueCardId}')"><span class="icon">🔄</span> Flip to ${faceText}</div>`;
        }

        if (!isOpponent) {
            if (cardZone === 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.playCardFromHand('${escapedCardId}')"><span class="icon">▶️</span> Play Card</div>`;
            } else if (cardZone === 'deck') {
                menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.performGameAction('play_card_from_library', { unique_id: '${escapedUniqueCardId}' }); UIZonesManager.closeZoneModal('deck');"><span class="icon">⚔️</span> Put on Battlefield</div>`;
            }

            if (cardZone === 'battlefield' || cardZone === 'permanents' || cardZone === 'lands' || cardZone === 'creatures' || cardZone === 'support') {
                const tapAction = isTapped ? 'Untap' : 'Tap';
                const tapIcon = isTapped ? '⤴️' : '🔄';
                menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.tapCard('${escapedCardId}', '${escapedUniqueCardId}')"><span class="icon">${tapIcon}</span> ${tapAction}</div>`;
                
                // Add counter management options
                if (cardData.counters && Object.keys(cardData.counters).length > 0) {
                    menuHTML += `<div class="card-context-menu-divider"></div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameCards.showCounterModal('${escapedUniqueCardId}', '${escapedCardId}')"><span class="icon">🔢</span> Manage Counters</div>`;
                } else {
                    menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameCards.showAddCounterModal('${escapedUniqueCardId}', '${escapedCardId}')"><span class="icon">➕</span> Add Counter</div>`;
                }
            }

            menuHTML += `
                <div class="card-context-menu-divider"></div>
                <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToGraveyard('${escapedCardId}', '${escapedCardZone}', '${escapedUniqueCardId}')"><span class="icon">⚰️</span> Send to Graveyard</div>
                <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToExile('${escapedCardId}', '${escapedCardZone}', '${escapedUniqueCardId}')"><span class="icon">✨</span> Send to Exile</div>`;

            if (cardZone !== 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.moveCard('${escapedCardId}', '${escapedCardZone}', 'hand', '${escapedUniqueCardId}')"><span class="icon">👋</span> Return to Hand</div>`;
            }
        }

        menuHTML += `</div>`;
        menu.innerHTML = menuHTML;

        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let x = event.clientX + 10;
        let y = event.clientY;

        if (x + menuRect.width > viewportWidth) {
            x = event.clientX - menuRect.width - 10;
        }
        if (y + menuRect.height > viewportHeight) {
            y = viewportHeight - menuRect.height - 10;
        }

        x = Math.max(10, x);
        y = Math.max(10, y);

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.visibility = 'visible';

        document.addEventListener('click', this.closeContextMenu.bind(this));
    },

    toggleCardTarget: function(uniqueCardId) {
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

            const cardName = cardElement.getAttribute('data-card-name');
            const actionText = isTargeted ? 'targeted' : 'untargeted';
            GameUI.showNotification(`${cardName} ${actionText}`, 'info');
        }
    },

    closeContextMenu: function() {
        const menu = document.getElementById('card-context-menu');
        if (menu) {
            menu.remove();
        }
        document.removeEventListener('click', this.closeContextMenu);
    },

    handleCardPreviewClick: function(event) {
        const preview = document.getElementById('card-preview-modal');
        if (preview) {
            preview.remove();
            this.removeCardPreviewListeners();
        }
    },

    handleCardPreviewKeydown: function(event) {
        if (event.key === 'Escape') {
            const preview = document.getElementById('card-preview-modal');
            if (preview) {
                preview.remove();
                this.removeCardPreviewListeners();
            }
        }
    },

    // Ajout des propriétés pour stocker les références liées
    _boundHandleCardPreviewClick: null,
    _boundHandleCardPreviewKeydown: null,

    addCardPreviewListeners: function() {
        // Utiliser des références liées persistantes
        if (!this._boundHandleCardPreviewClick) {
            this._boundHandleCardPreviewClick = this.handleCardPreviewClick.bind(this);
        }
        if (!this._boundHandleCardPreviewKeydown) {
            this._boundHandleCardPreviewKeydown = this.handleCardPreviewKeydown.bind(this);
        }
        setTimeout(() => {
            document.addEventListener('click', this._boundHandleCardPreviewClick);
            document.addEventListener('keydown', this._boundHandleCardPreviewKeydown);
        }, 100);
    },

    removeCardPreviewListeners: function() {
        if (this._boundHandleCardPreviewClick) {
            document.removeEventListener('click', this._boundHandleCardPreviewClick);
        }
        if (this._boundHandleCardPreviewKeydown) {
            document.removeEventListener('keydown', this._boundHandleCardPreviewKeydown);
        }
    },

    flipCard: function(cardId, uniqueCardId) {
        GameActions.performGameAction('flip_card', {
            card_id: cardId,
            unique_id: uniqueCardId
        });

        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const cardName = cardElement.getAttribute('data-card-name');
            GameUI.showNotification(`${cardName} flipped`, 'info');
            
            // Attendre un peu pour que le serveur traite l'action, puis rafraîchir l'affichage
            setTimeout(() => {
                // Déclencher un rafraîchissement des données de jeu pour mettre à jour l'interface
                if (window.gameWebSocket && window.gameWebSocket.readyState === WebSocket.OPEN) {
                    // Le WebSocket se chargera automatiquement de rafraîchir l'interface
                    console.log('Card flip processed, interface will update via WebSocket');
                } else {
                    // Fallback: rafraîchir manuellement si pas de WebSocket
                    window.location.reload();
                }
            }, 500);
        }
    },

    handleDragStart: function(event, cardElement) {
        const cardId = cardElement.getAttribute('data-card-id');
        const cardZone = cardElement.getAttribute('data-card-zone');
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id');
        event.dataTransfer.setData('text/plain', JSON.stringify({
            cardId,
            cardZone,
            uniqueCardId
        }));
        // Optionally: add visual feedback
        cardElement.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        GameCards.draggedCardElement = cardElement;
    },

    handleDragEnd: function(event, cardElement) {
        if (!cardElement) return;
        
        cardElement.classList.remove('dragging');
        cardElement.style.removeProperty('opacity');
        cardElement.style.removeProperty('pointer-events');
        if (GameCards.draggedCardElement === cardElement) {
            GameCards.draggedCardElement = null;
        }
    },

    showCounterModal: function(uniqueCardId, cardId) {
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (!cardElement) return;

        const cardData = JSON.parse(cardElement.getAttribute('data-card-data') || '{}');
        const cardName = cardData.name || 'Unknown Card';

        // Remove any existing counter modal
        const existingModal = document.getElementById('counter-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'counter-modal';
        modal.className = 'counter-modal';
        modal.innerHTML = `
            <div class="counter-modal-content">
                <div class="counter-modal-header">
                    <h3>${cardName} - Manage Counters</h3>
                    <button class="counter-modal-close" onclick="GameCards.closeCounterModal()">&times;</button>
                </div>
                <div class="counter-modal-body">
                    ${this.generateCounterControls(cardData, uniqueCardId, cardId)}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
    },

    showAddCounterModal: function(uniqueCardId, cardId) {
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (!cardElement) return;

        const cardData = JSON.parse(cardElement.getAttribute('data-card-data') || '{}');
        const cardName = cardData.name || 'Unknown Card';

        // Remove any existing counter modal
        const existingModal = document.getElementById('counter-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'counter-modal';
        modal.className = 'counter-modal';
        modal.innerHTML = `
            <div class="counter-modal-content">
                <div class="counter-modal-header">
                    <h3>${cardName} - Add Counter</h3>
                    <button class="counter-modal-close" onclick="GameCards.closeCounterModal()">&times;</button>
                </div>
                <div class="counter-modal-body">
                    <div class="add-counter-form">
                        <label for="counter-type-select">Counter Type:</label>
                        <select id="counter-type-select">
                            <option value="+1/+1">+1/+1</option>
                            <option value="-1/-1">-1/-1</option>
                            <option value="loyalty">Loyalty</option>
                            <option value="charge">Charge</option>
                            <option value="poison">Poison</option>
                            <option value="energy">Energy</option>
                            <option value="experience">Experience</option>
                            <option value="treasure">Treasure</option>
                            <option value="food">Food</option>
                            <option value="clue">Clue</option>
                            <option value="blood">Blood</option>
                            <option value="oil">Oil</option>
                        </select>
                        <label for="counter-amount-input">Amount:</label>
                        <input type="number" id="counter-amount-input" value="1" min="1" max="20">
                        <button onclick="GameCards.addCounterFromModal('${uniqueCardId}', '${cardId}')">Add Counter</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
    },

    generateCounterControls: function(cardData, uniqueCardId, cardId) {
        if (!cardData.counters || Object.keys(cardData.counters).length === 0) {
            return '<p>No counters on this card.</p>';
        }

        let html = '<div class="counter-controls">';
        
        for (const [counterType, count] of Object.entries(cardData.counters)) {
            if (count > 0) {
                const counterIcon = this.getCounterIcon(counterType);
                html += `
                    <div class="counter-control-row">
                        <span class="counter-icon">${counterIcon}</span>
                        <span class="counter-type">${counterType}</span>
                        <div class="counter-controls-buttons">
                            <button onclick="GameCards.modifyCounter('${uniqueCardId}', '${cardId}', '${counterType}', -1)">-</button>
                            <span class="counter-amount">${count}</span>
                            <button onclick="GameCards.modifyCounter('${uniqueCardId}', '${cardId}', '${counterType}', 1)">+</button>
                            <button class="remove-counter-btn" onclick="GameCards.removeAllCounters('${uniqueCardId}', '${cardId}', '${counterType}')">Remove All</button>
                        </div>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        html += `<button class="add-new-counter-btn" onclick="GameCards.showAddCounterModal('${uniqueCardId}', '${cardId}')">Add New Counter Type</button>`;
        
        return html;
    },

    addCounterFromModal: function(uniqueCardId, cardId) {
        const counterType = document.getElementById('counter-type-select').value;
        const amount = parseInt(document.getElementById('counter-amount-input').value) || 1;
        
        GameActions.performGameAction('add_counter', {
            unique_id: uniqueCardId,
            card_id: cardId,
            counter_type: counterType,
            amount: amount
        });

        this.closeCounterModal();
        GameUI.showNotification(`Added ${amount} ${counterType} counter(s)`, 'success');
    },

    modifyCounter: function(uniqueCardId, cardId, counterType, change) {
        if (change > 0) {
            GameActions.performGameAction('add_counter', {
                unique_id: uniqueCardId,
                card_id: cardId,
                counter_type: counterType,
                amount: change
            });
        } else {
            GameActions.performGameAction('remove_counter', {
                unique_id: uniqueCardId,
                card_id: cardId,
                counter_type: counterType,
                amount: Math.abs(change)
            });
        }

        // Refresh the modal content
        setTimeout(() => {
            const modal = document.getElementById('counter-modal');
            if (modal) {
                this.showCounterModal(uniqueCardId, cardId);
            }
        }, 100);
    },

    removeAllCounters: function(uniqueCardId, cardId, counterType) {
        GameActions.performGameAction('set_counter', {
            unique_id: uniqueCardId,
            card_id: cardId,
            counter_type: counterType,
            amount: 0
        });

        this.closeCounterModal();
        GameUI.showNotification(`Removed all ${counterType} counters`, 'info');
    },

    closeCounterModal: function() {
        const modal = document.getElementById('counter-modal');
        if (modal) {
            modal.remove();
        }
    }
};

window.GameCards = GameCards;
