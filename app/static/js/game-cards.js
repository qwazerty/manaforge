/**
 * ManaForge Game Cards Module
 * Functions for card rendering and management
 */
const GameCards = {
    getSafeImageUrl: function(card) {
        if (!card || !card.image_url) return null;
        if (card.image_url.includes("/back/")) return null;
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
        const tappedClass = isTapped ? ' tapped' : '';
        const playerPrefix = playerId !== null ? `p${playerId}` : 'unknown';
        const uniqueCardId = `${playerPrefix}-${zone}-${index}`;
        const escapedCardId = GameUtils.escapeJavaScript(cardId);
        const escapedCardName = GameUtils.escapeJavaScript(cardName);
        const escapedImageUrl = GameUtils.escapeJavaScript(imageUrl || '');
        const escapedUniqueId = GameUtils.escapeJavaScript(uniqueCardId);

        let onClickAction = '';
        if (zone === 'permanents' || zone === 'lands') {
            onClickAction = `onclick="GameActions.tapCard('${escapedCardId}', '${escapedUniqueId}'); event.stopPropagation();"`;
        } else if (zone === 'hand') {
            onClickAction = `onclick="GameActions.playCardFromHand('${escapedCardId}', ${index}); event.stopPropagation();"`;
        }

        return `
            <div class="${cardClass}${tappedClass}" 
                data-card-id="${escapedCardId}"
                data-card-unique-id="${escapedUniqueId}"
                data-card-name="${escapedCardName}"
                data-card-image="${escapedImageUrl}"
                data-card-zone="${zone}"
                data-card-tapped="${isTapped}"
                data-card-data='${JSON.stringify(card).replace(/'/g, "&#39;")}'
                data-is-opponent="${isOpponent}"
                draggable="true"
                ondragstart="GameCards.handleDragStart(event, this)"
                ${onClickAction}
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
                    </div>
                ` : `
                    <div class="card-fallback">
                    </div>
                `}
            </div>
        `;
    },

    showCardPreview: function(cardId, cardName, imageUrl, event = null) {
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
            menuHTML += `<div class="card-context-image"><img src="${cardImage}" alt="${cardName}" /></div>`;
        }

        menuHTML += `<div class="card-context-actions">
            <div class="card-context-header"><h3>${cardName}</h3></div>
            <div class="card-context-menu-divider"></div>
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameCards.showCardPreview('${cardId}', '${cardName}', '${cardImage}')"><span class="icon">🔍</span> View Full Size</div>
            <div class="card-context-menu-divider"></div>`;

        if (!isOpponent) {
            if (cardZone === 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.playCardFromHand('${cardId}')"><span class="icon">▶️</span> Play Card</div>`;
            }

            if (cardZone === 'battlefield' || cardZone === 'permanents' || cardZone === 'lands') {
                const tapAction = isTapped ? 'Untap' : 'Tap';
                const tapIcon = isTapped ? '⤴️' : '🔄';
                menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.tapCard('${cardId}', '${uniqueCardId}')"><span class="icon">${tapIcon}</span> ${tapAction}</div>`;
            }

            menuHTML += `
                <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToGraveyard('${cardId}', '${cardZone}', '${uniqueCardId}')"><span class="icon">⚰️</span> Send to Graveyard</div>
                <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToExile('${cardId}', '${cardZone}', '${uniqueCardId}')"><span class="icon">✨</span> Send to Exile</div>`;

            if (cardZone !== 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToHand('${cardId}', '${cardZone}', '${uniqueCardId}')"><span class="icon">👋</span> Return to Hand</div>`;
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
    }
};

window.GameCards = GameCards;
