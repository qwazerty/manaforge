
/**
 * ManaForge Game Chat Module
 * Handles chat functionality
 */
const GameChat = {
    sendChatMessage: function(event) {
        console.log('📝 sendChatMessage called');
        event.preventDefault(); // Empêche le submit du formulaire

        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        console.log('📝 Message input:', message);

        if (!message) {
            console.log('❌ Empty message, aborting');
            return;
        }

        if (!window.GameCore || !window.GameUI) {
            console.error('❌ GameCore or GameUI not available');
            return;
        }

        // Obtenir le nom du joueur actuel
        const currentPlayer = window.GameCore.getSelectedPlayer();
        const playerName = currentPlayer === 'spectator' ? 'Spectator' : 'Player ' + currentPlayer.slice(-1);

        console.log('👤 Player name:', playerName);

        // Ajouter immédiatement le message à l'interface (optimistic update)
        window.GameUI.addChatMessage(playerName, message);

        // Envoyer via WebSocket
        if (window.websocket && window.websocket.readyState === WebSocket.OPEN) {
            console.log('📡 Sending via WebSocket');
            window.websocket.send(JSON.stringify({
                type: 'chat',
                player: playerName,
                message: message,
                timestamp: Date.now()
            }));
        } else {
            console.warn('WebSocket not connected, message not sent');
            window.GameUI.showNotification('Chat not available (WebSocket disconnected)', 'warning');
        }

        // Vider le champ de saisie
        input.value = '';
        console.log('✅ Message sent, input cleared');
    }
};

window.GameChat = GameChat;
