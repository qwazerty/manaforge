/* Arena Core JavaScript - WebSocket, Notifications, and Game Logic */

// Global variables
let ws = null;
let gameId = null;

// Navigation link styling
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.className += ' px-3 py-2 rounded-md text-sm font-medium text-arena-text hover:text-arena-accent hover:bg-arena-surface-light transition-all duration-200';
        
        // Highlight active page
        if (link.href === window.location.href) {
            link.className += ' text-arena-accent bg-arena-surface-light';
        }
    });
});

function connectWebSocket(id) {
    if (ws) {
        ws.close();
    }
    
    gameId = id;
    ws = new WebSocket(`ws://localhost:8000/ws/game/${gameId}`);
    
    ws.onopen = function(event) {
        console.log('🔮 Connected to game:', gameId);
        showNotification('Connected to game', 'success');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
    
    ws.onclose = function(event) {
        console.log('🔌 WebSocket closed');
        showNotification('Disconnected from game', 'warning');
    };
    
    ws.onerror = function(error) {
        console.error('❌ WebSocket error:', error);
        showNotification('Connection error', 'error');
    };
}

function handleWebSocketMessage(data) {
    console.log('📨 Received:', data);
    
    if (data.type === 'game_update') {
        // Refresh game state with animation
        const gameArea = document.getElementById('game-area');
        if (gameArea) {
            htmx.trigger(gameArea, 'refresh');
        }
    } else if (data.type === 'chat') {
        addChatMessage(data.player, data.message);
    } else if (data.type === 'player_action') {
        showGameAction(data.player, data.action, data.card);
    }
}

function sendGameAction(action, cardId = null, extraData = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        const message = {
            type: 'game_action',
            action: action,
            card_id: cardId,
            player: 'player1', // For POC
            timestamp: Date.now(),
            ...extraData
        };
        
        ws.send(JSON.stringify(message));
        console.log('🎮 Sent action:', message);
    } else {
        showNotification('Not connected to game', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 px-6 py-3 rounded-lg shadow-arena z-50 animate-slide-up`;
    
    const colors = {
        'success': 'bg-arena-surface border border-green-500 text-green-400',
        'error': 'bg-arena-surface border border-red-500 text-red-400',
        'warning': 'bg-arena-surface border border-yellow-500 text-yellow-400',
        'info': 'bg-arena-surface border border-arena-accent text-arena-accent'
    };
    
    notification.className += ` ${colors[type] || colors.info}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showGameAction(player, action, card = null) {
    const message = card ? 
        `${player} ${action} ${card.name}` : 
        `${player} ${action}`;
    
    showNotification(message, 'info');
}

// Enhanced card interactions
function playCard(cardId) {
    sendGameAction('play_card', cardId);
    
    // Visual feedback
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    if (cardElement) {
        cardElement.style.transform = 'scale(1.05)';
        cardElement.style.boxShadow = '0 0 20px rgba(201, 170, 113, 0.6)';
        
        setTimeout(() => {
            cardElement.style.transform = '';
            cardElement.style.boxShadow = '';
        }, 300);
    }
}

// HTMX Extensions
document.addEventListener('htmx:afterRequest', function(event) {
    // Content updated without animation
    if (event.detail.target) {
        // Removed automatic fade-in animation
    }
});

// Add loading states
document.addEventListener('htmx:beforeRequest', function(event) {
    const target = event.detail.target;
    if (target) {
        target.style.opacity = '0.7';
    }
});

document.addEventListener('htmx:afterRequest', function(event) {
    const target = event.detail.target;
    if (target) {
        target.style.opacity = '1';
    }
});

// Chat functionality
function addChatMessage(player, message) {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-2';
        messageDiv.innerHTML = `<strong>${player}:</strong> ${message}`;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}
