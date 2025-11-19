/**
 * ManaForge Game Chat Module
 * Handles chat messaging helpers and WebSocket dispatch.
 */
const GameChat = {
    /**
     * Send a chat message through the active WebSocket connection.
     */
    sendMessage(messageText, options = {}) {
        const trimmed = (messageText || '').trim();
        if (!trimmed) {
            return { success: false, error: 'empty_message' };
        }

        if (
            !window.GameCore ||
            typeof window.GameCore.getSelectedPlayer !== 'function'
        ) {
            console.error('GameCore not available, cannot send chat message');
            return { success: false, error: 'game_not_ready' };
        }

        const senderInfo = this.getLocalPlayerInfo();
        const playerName = options.playerName || senderInfo.name;
        const timestamp = typeof options.timestamp === 'number'
            ? options.timestamp
            : Date.now();

        if (!window.websocket || window.websocket.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not connected, chat message not sent');
            if (
                window.GameUI &&
                typeof window.GameUI.logMessage === 'function'
            ) {
                window.GameUI.logMessage(
                    'Chat not available (WebSocket disconnected)',
                    'warning'
                );
            }
            return { success: false, error: 'WebSocket disconnected' };
        }

        window.websocket.send(JSON.stringify({
            type: 'chat',
            player: playerName,
            message: trimmed,
            timestamp
        }));

        return { success: true };
    },

    /**
     * Resolve the current local player's info.
     */
    getLocalPlayerInfo() {
        const playerKey = window.GameCore && typeof window.GameCore.getSelectedPlayer === 'function'
            ? window.GameCore.getSelectedPlayer()
            : 'player1';
        const playerName = this._resolveSenderName(playerKey);
        return {
            id: playerKey,
            name: playerName
        };
    },

    _resolveSenderName(playerKey) {
        if (!playerKey) {
            return 'Unknown';
        }

        if (
            window.GameCore &&
            typeof window.GameCore.getPlayerDisplayName === 'function'
        ) {
            const resolved = window.GameCore.getPlayerDisplayName(playerKey);
            if (resolved) {
                return resolved;
            }
        }

        return this._formatSeatFallback(playerKey);
    },

    _formatSeatFallback(playerKey) {
        if (!playerKey) {
            return 'Unknown';
        }

        if (playerKey === 'spectator') {
            return 'Spectator';
        }

        const match = String(playerKey)
            .toLowerCase()
            .match(/player\s*(\d+)/);
        if (match) {
            return `Player ${match[1]}`;
        }

        return String(playerKey);
    }
};

window.GameChat = GameChat;
