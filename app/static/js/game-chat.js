
// Chat functionality
function sendChatMessage(event) {
    console.log('📝 sendChatMessage called');
    event.preventDefault(); // Empêche le submit du formulaire
    
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    console.log('📝 Message input:', message);
    
    if (!message) {
        console.log('❌ Empty message, aborting');
        return;
    }
    
    // Obtenir le nom du joueur actuel
    const currentPlayer = window.GameCore ? window.GameCore.getSelectedPlayer() : 'player1';
    const playerName = currentPlayer === 'spectator' ? 'Spectator' : 'Player ' + currentPlayer.slice(-1);
    
    console.log('👤 Player name:', playerName);
    
    // Ajouter immédiatement le message à l'interface (optimistic update)
    if (window.GameUI && window.GameUI.addChatMessage) {
        console.log('🎯 Calling GameUI.addChatMessage');
        window.GameUI.addChatMessage(playerName, message);
    } else {
        console.error('❌ GameUI.addChatMessage not available');
    }
    
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
        if (window.GameUI && window.GameUI.showNotification) {
            window.GameUI.showNotification('Chat not available (WebSocket disconnected)', 'warning');
        }
    }
    
    // Vider le champ de saisie
    input.value = '';
    console.log('✅ Message sent, input cleared');
}