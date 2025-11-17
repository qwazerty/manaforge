/**
 * ManaForge Battle Chat UI Module
 * Hydrates the chat sidebar with the BattleChat Svelte component.
 */

class UIBattleChat {
    static MAX_MESSAGES = 500;
    static messages = [];
    static _component = null;
    static _target = null;
    static _statusText = '';
    static _sendDisabled = false;
    static _placeholderText = 'Type your message...';

    static init() {
        if (typeof document === 'undefined') {
            return;
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    static render() {
        this._render();
    }

    static loadChatLog(entries = []) {
        this.messages = [];
        if (Array.isArray(entries)) {
            entries.forEach((entry) => {
                if (!entry) {
                    return;
                }
                const normalized = this._normalizeMessage({
                    id: entry.id,
                    sender: entry.player || entry.sender,
                    message: entry.message,
                    timestamp: entry.timestamp,
                    playerId: entry.player_id || entry.player,
                    origin: 'history'
                });
                this._pushMessage(normalized, false);
            });
        }
        this._render();
    }

    static addMessage(sender, message, options = {}) {
        const normalized = this._normalizeMessage({
            sender,
            message,
            ...options
        });
        this._pushMessage(normalized);
    }

    static addSystemMessage(message) {
        if (!message) {
            return;
        }
        this.addMessage('System', message, { origin: 'system' });
    }

    static setStatus(text = '') {
        this._statusText = text || '';
        this._render();
    }

    static setSendDisabled(isDisabled = false, text = '') {
        this._sendDisabled = Boolean(isDisabled);
        this._statusText = text || this._statusText;
        this._render();
    }

    static _render() {
        const component = this._ensureComponent();
        if (!component) {
            return;
        }
        try {
            component.$set(this._buildProps());
        } catch (error) {
            console.error('Failed to update battle chat component', error);
        }
    }

    static _buildProps() {
        return {
            panelIcon: '💬',
            panelTitle: 'Battle Chat',
            messages: Array.isArray(this.messages) ? [...this.messages] : [],
            placeholderText: this._placeholderText,
            sendButtonLabel: 'Send',
            sendDisabled: this._sendDisabled,
            statusText: this._statusText,
            onSend: (text) => this._handleSend(text)
        };
    }

    static _handleSend(text) {
        const trimmed = (text || '').trim();
        if (!trimmed) {
            return { success: false, error: 'empty_message' };
        }

        const senderInfo = this._resolveLocalSender();
        const timestamp = Date.now();
        const entry = this._normalizeMessage({
            sender: senderInfo.name,
            message: trimmed,
            timestamp,
            playerId: senderInfo.id,
            origin: 'local'
        });
        this._pushMessage(entry);

        if (
            typeof GameChat !== 'undefined' &&
            GameChat &&
            typeof GameChat.sendMessage === 'function'
        ) {
            const result = GameChat.sendMessage(trimmed, {
                playerName: entry.sender,
                playerId: entry.playerId,
                timestamp: entry.timestamp
            });
            if (!result || result.success !== true) {
                const errorText = result?.error || 'Chat not available';
                this._markMessageError(entry.id, errorText);
                this.setStatus(errorText);
                return result || { success: false, error: errorText };
            }
            this.setStatus('');
            return result;
        }

        const fallbackText = 'Chat not available';
        this._markMessageError(entry.id, fallbackText);
        this.setStatus(fallbackText);
        return { success: false, error: fallbackText };
    }

    static _resolveLocalSender() {
        if (
            typeof GameChat !== 'undefined' &&
            GameChat &&
            typeof GameChat.getLocalPlayerInfo === 'function'
        ) {
            const info = GameChat.getLocalPlayerInfo();
            if (info) {
                return info;
            }
        }

        const fallbackId = typeof GameCore !== 'undefined' &&
            GameCore &&
            typeof GameCore.getSelectedPlayer === 'function'
            ? GameCore.getSelectedPlayer()
            : 'player1';

        let fallbackName = fallbackId || 'Player';
        if (
            typeof GameChat !== 'undefined' &&
            GameChat &&
            typeof GameChat._formatSeatFallback === 'function'
        ) {
            fallbackName = GameChat._formatSeatFallback(fallbackId);
        }

        return {
            id: fallbackId,
            name: fallbackName || 'Player'
        };
    }

    static _ensureComponent() {
        if (typeof document === 'undefined') {
            return null;
        }
        if (typeof BattleChatComponent === 'undefined') {
            const container = document.getElementById('battle-chat-panel');
            if (container && !container.dataset.chatFallbackRendered) {
                container.innerHTML = `
                    <div class="arena-card rounded-lg p-4 text-center text-sm">
                        Unable to load chat panel
                    </div>
                `;
                container.dataset.chatFallbackRendered = 'true';
            }
            return null;
        }

        const container = document.getElementById('battle-chat-panel');
        if (!container) {
            this._destroyComponent();
            return null;
        }

        if (this._component && this._target === container) {
            return this._component;
        }

        this._destroyComponent();
        try {
            container.innerHTML = '';
            this._component = new BattleChatComponent.default({
                target: container,
                props: this._buildProps()
            });
            this._target = container;
        } catch (error) {
            console.error('Failed to initialize battle chat component', error);
            this._component = null;
            this._target = null;
        }

        return this._component;
    }

    static _destroyComponent() {
        if (this._component) {
            try {
                this._component.$destroy();
            } catch (error) {
                console.error('Failed to destroy battle chat component', error);
            }
        }
        this._component = null;
        this._target = null;
    }

    static _pushMessage(entry, triggerRender = true) {
        if (!entry) {
            return;
        }
        this.messages.push(entry);
        if (this.messages.length > this.MAX_MESSAGES) {
            this.messages.shift();
        }
        if (triggerRender) {
            this._render();
        }
    }

    static _normalizeMessage({
        id = null,
        sender = 'Unknown',
        message = '',
        timestamp = null,
        playerId = null,
        origin = 'remote',
        error = null
    } = {}) {
        return {
            id: id || this._buildMessageId(),
            sender: sender || 'Unknown',
            message: String(message || ''),
            timestamp: this._normalizeTimestamp(timestamp),
            playerId: playerId || null,
            origin,
            error: error || null
        };
    }

    static _markMessageError(messageId, errorText) {
        if (!messageId) {
            return;
        }
        const target = this.messages.find((msg) => msg.id === messageId);
        if (target) {
            target.error = errorText || 'Not delivered';
            this._render();
        }
    }

    static _buildMessageId() {
        return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    static _normalizeTimestamp(value) {
        if (typeof value === 'string') {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
                value = parsed;
            }
        }

        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            if (value < 1e12) {
                return Math.round(value * 1000);
            }
            return Math.round(value);
        }
        return Date.now();
    }
}

window.UIBattleChat = UIBattleChat;
UIBattleChat.init();
