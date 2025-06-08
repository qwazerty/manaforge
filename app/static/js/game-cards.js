/**
 * ManaForge Game Cards Module
 * Functions for card rendering and management
 */

// ===== CARD RENDERING AND FUNCTIONALITY =====
function getSafeImageUrl(card) {
    if (!card || !card.image_url) return null;
    // Avoid problematic URLs like card backs
    if (card.image_url.includes("/back/")) return null;
    return card.image_url;
}

function debugCardImage(cardName, imageUrl, context) {
    console.log(`🃏 [${context}] Card: ${cardName}`);
    console.log(`Image URL: ${imageUrl || 'none'}`);
    console.log(`Valid: ${!!imageUrl}`);
}

function preloadCardImages(cards) {
    if (!cards || !Array.isArray(cards)) return;
    
    cards.forEach(card => {
        const imageUrl = getSafeImageUrl(card);
        if (imageUrl) {
            const img = new Image();
            img.src = imageUrl;
        }
    });
}

function renderCardWithLoadingState(card, cardClass = 'card-mini', showTooltip = true, zone = 'unknown') {
    const cardId = card.id || card.name;
    const cardName = card.name || 'Unknown';
    // Validate image URL - avoid problematic URLs
    const imageUrl = getSafeImageUrl(card);
    
    // Check if card is tapped
    const isTapped = card.tapped || false;
    const tappedClass = isTapped ? ' tapped' : '';
    
    // Escape values for safe JavaScript injection
    const escapedCardId = GameUtils.escapeJavaScript(cardId);
    const escapedCardName = GameUtils.escapeJavaScript(cardName);
    const escapedImageUrl = GameUtils.escapeJavaScript(imageUrl || '');
    
    return `
        <div class="${cardClass}${tappedClass}" 
             data-card-id="${cardId}"
             data-card-name="${escapedCardName}"
             data-card-image="${escapedImageUrl}"
             data-card-zone="${zone}"
             data-card-tapped="${isTapped}"
             data-card-data='${JSON.stringify(card).replace(/'/g, "&#39;")}'
             ${showTooltip ? `onclick="GameCards.showCardPreview('${escapedCardId}', '${escapedCardName}', '${escapedImageUrl}', event)"` : ''}
             oncontextmenu="GameCards.showCardContextMenu(event, this); return false;">
            ${imageUrl ? `
                <div class="relative">
                    <img src="${imageUrl}" 
                         alt="${cardName}" 
                         style="opacity: 0; transition: opacity 0.3s ease;"
                         onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="card-fallback" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                        <span style="font-size: 14px;">🃏</span>
                    </div>
                </div>
            ` : `
                <div class="card-fallback">
                    <span style="font-size: 14px;">🃏</span>
                </div>
            `}
            ${isTapped ? '<div class="card-tapped-indicator">T</div>' : ''}
        </div>
    `;
}

function showCardPreview(cardId, cardName, imageUrl, event = null) {
    // For now, just log the card details
    console.log(`📋 Card Preview: ${cardName} (ID: ${cardId})`);
    if (imageUrl) {
        console.log(`🖼️ Image: ${imageUrl}`);
    }
    
    // Remove any existing preview
    const existingPreview = document.getElementById('card-preview-modal');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create preview modal
    const preview = document.createElement('div');
    preview.id = 'card-preview-modal';
    preview.className = 'card-preview-modal show';
    preview.onclick = (e) => {
        if (e.target === preview) {
            preview.remove();
        }
    };

    // Add card image and details
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
    
    // If we have event coordinates, position near mouse, otherwise center
    if (event && event.clientX && event.clientY) {
        const previewRect = preview.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Position to the right and slightly below mouse cursor
        let x = event.clientX + 20;
        let y = event.clientY + 20;
        
        // Adjust if would go off screen
        if (x + previewRect.width > viewportWidth) {
            x = event.clientX - previewRect.width - 20; // Show to the left instead
        }
        if (y + previewRect.height > viewportHeight) {
            y = event.clientY - previewRect.height - 20; // Show above instead
        }
        
        // Ensure it doesn't go off edges
        x = Math.max(10, Math.min(x, viewportWidth - previewRect.width - 10));
        y = Math.max(10, Math.min(y, viewportHeight - previewRect.height - 10));
        
        preview.style.position = 'fixed';
        preview.style.left = `${x}px`;
        preview.style.top = `${y}px`;
        preview.style.transform = 'none'; // Override the centering transform
    }
}

function showCardContextMenu(event, cardElement) {
    event.preventDefault();
    
    // Get card data
    const cardId = cardElement.getAttribute('data-card-id');
    const cardName = cardElement.getAttribute('data-card-name');
    const cardImage = cardElement.getAttribute('data-card-image');
    const cardZone = cardElement.getAttribute('data-card-zone') || 'unknown';
    const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
    
    // Debug logging to help troubleshoot zone issues
    console.log(`🃏 Context menu for: ${cardName} (Zone: ${cardZone}, Tapped: ${isTapped})`);
    
    // Get card data from the data attribute if available
    let cardData;
    try {
        const cardDataAttr = cardElement.getAttribute('data-card-data');
        if (cardDataAttr) {
            cardData = JSON.parse(cardDataAttr);
        }
    } catch (error) {
        console.error('Error parsing card data:', error);
    }
    
    // Remove existing context menu
    const existingMenu = document.getElementById('card-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'card-context-menu';
    menu.className = 'card-context-menu';
    
    // Add content first to get accurate dimensions
    menu.style.visibility = 'hidden';
    menu.style.position = 'fixed';
    document.body.appendChild(menu);
    
    // Prepare HTML for card image and actions
    let menuHTML = '';
    
    // Add card image preview on the left
    if (cardImage) {
        menuHTML += `
        <div class="card-context-image">
            <img src="${cardImage}" alt="${cardName}" />
        </div>`;
    }
    
    // Add actions panel on the right
    menuHTML += `
        <div class="card-context-actions">
            <div class="card-context-header">
                <h3>${cardName}</h3>
            </div>
            <div class="card-context-menu-divider"></div>
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameCards.showCardPreview('${cardId}', '${cardName}', '${cardImage}')">
                <span class="icon">🔍</span> View Full Size
            </div>
            <div class="card-context-menu-divider"></div>`;
    
    // Add zone-specific actions
    if (cardZone === 'hand') {
        menuHTML += `
        <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.playCardFromHand('${cardId}')">
            <span class="icon">▶️</span> Play Card
        </div>`;
    }
    
    if (cardZone === 'battlefield' || cardZone === 'permanents' || cardZone === 'land') {
        const tapAction = isTapped ? 'Untap' : 'Tap';
        const tapIcon = isTapped ? '⤴️' : '🔄';
        menuHTML += `
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.tapCard('${cardId}')">
                <span class="icon">${tapIcon}</span> ${tapAction}
            </div>`;
    }
    
    if (cardZone === 'stack') {
        // Get stack index for stack-specific actions
        const stackIndex = cardElement.getAttribute('data-stack-index');
        
        menuHTML += `
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.resolveStackSpell('${cardId}', '${stackIndex}')">
                <span class="icon">✅</span> Resolve
            </div>
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.counterStackSpell('${cardId}', '${stackIndex}')">
                <span class="icon">❌</span> Counter
            </div>
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.copyStackSpell('${cardId}', '${stackIndex}')">
                <span class="icon">📄</span> Copy
            </div>`;
    }
    
    // Common actions for all zones (except stack)
    if (cardZone !== 'stack') {
        menuHTML += `
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToGraveyard('${cardId}', '${cardZone}')">
                <span class="icon">⚰️</span> Send to Graveyard
            </div>
            <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToExile('${cardId}', '${cardZone}')">
                <span class="icon">✨</span> Send to Exile
            </div>`;
        
        // Return to hand (only if not already in hand)
        if (cardZone !== 'hand') {
            menuHTML += `
                <div class="card-context-menu-item" onclick="GameCards.closeContextMenu(); GameActions.sendToHand('${cardId}', '${cardZone}')">
                    <span class="icon">👋</span> Return to Hand
                </div>`;
        }
    }
    
    // Close the actions container
    menuHTML += `</div>`;
    
    // Set the menu HTML
    menu.innerHTML = menuHTML;
    
    // Calculate optimal position based on mouse position and menu dimensions
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Initial position to the right of the mouse cursor
    let x = event.clientX + 10; // Small offset from cursor
    let y = event.clientY;
    
    // Adjust horizontal position if menu would go off right edge
    if (x + menuRect.width > viewportWidth) {
        x = event.clientX - menuRect.width - 10; // Position to the left of cursor
    }
    
    // Adjust vertical position if menu would go off bottom edge
    if (y + menuRect.height > viewportHeight) {
        y = viewportHeight - menuRect.height - 10; // 10px margin from edge
    }
    
    // Ensure menu doesn't go off left or top edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    // Apply final position and make visible
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.visibility = 'visible';
    
    // Close menu when clicking elsewhere
    document.addEventListener('click', GameCards.closeContextMenu);
}

function closeContextMenu() {
    const menu = document.getElementById('card-context-menu');
    if (menu) {
        menu.remove();
    }
    document.removeEventListener('click', GameCards.closeContextMenu);
}

// Export cards module functionality
window.GameCards = {
    getSafeImageUrl,
    debugCardImage,
    preloadCardImages,
    renderCardWithLoadingState,
    showCardPreview,
    showCardContextMenu,
    closeContextMenu
};
