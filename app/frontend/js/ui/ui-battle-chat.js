/**
 * ManaForge Battle Chat UI Module
 * Hydrates the chat sidebar with the BattleChat Svelte component.
 * Uses Svelte 5 mount/unmount pattern for reactive updates.
 */

import { mount, unmount } from 'svelte';
import BattleChat from '@svelte/BattleChat.svelte';

class UIBattleChat {
    static MAX_MESSAGES = 500;
    static messages = [];
    static _component = null;
    static _target = null;
    static _statusText = '';
    static _sendDisabled = false;
    static _placeholderText = 'Type your message...';
    static _renderScheduled = false;

    static init() {
        if (typeof document === 'undefined') {
            return;
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._scheduleRender());
        } else {
            this._scheduleRender();
        }
    }

    static render() {
        this._scheduleRender();
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
        this._scheduleRender();
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
        this._scheduleRender();
    }

    static setSendDisabled(isDisabled = false, text = '') {
        this._sendDisabled = Boolean(isDisabled);
        this._statusText = text || this._statusText;
        this._scheduleRender();
    }

    /**
     * Schedule a render on the next animation frame to batch updates
     */
    static _scheduleRender() {
        if (this._renderScheduled) {
            return;
        }
        this._renderScheduled = true;
        
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                this._renderScheduled = false;
                this._doRender();
            });
        } else {
            setTimeout(() => {
                this._renderScheduled = false;
                this._doRender();
            }, 0);
        }
    }

    /**
     * Perform the actual render by remounting the component with new props
     */
    static _doRender() {
        if (typeof document === 'undefined') {
            return;
        }

        const container = document.getElementById('battle-chat-panel');
        if (!container) {
            this._destroyComponent();
            return;
        }

        // Unmount existing component and remount with new props
        // This is the Svelte 5 pattern for updating components
        this._destroyComponent();

        try {
            this._component = mount(BattleChat, {
                target: container,
                props: this._buildProps()
            });
            this._target = container;
        } catch (error) {
            console.error('Failed to mount battle chat component', error);
            this._component = null;
            this._target = null;
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

        const chatManager = typeof WebSocketManager !== 'undefined' ? WebSocketManager : null;
        const sendChat = chatManager?.sendChatMessage?.bind(chatManager);

        const result = typeof sendChat === 'function'
            ? sendChat(trimmed, {
                playerName: entry.sender,
                playerId: entry.playerId,
                timestamp: entry.timestamp
            })
            : { success: false, error: 'Chat not available' };

        if (!result || result.success !== true) {
            const errorText = result?.error || 'Chat not available';
            this._markMessageError(entry.id, errorText);
            this.setStatus(errorText);
            return result || { success: false, error: errorText };
        }

        this.setStatus('');
        return result;
    }

    static _resolveLocalSender() {
        const chatManager = typeof WebSocketManager !== 'undefined' ? WebSocketManager : null;
        const info = chatManager?.getLocalPlayerInfo?.();
        const id = info?.id || 'player1';
        const name = info?.name || 'Player';

        return { id, name };
    }

    static _destroyComponent() {
        if (this._component && this._target) {
            try {
                unmount(this._component);
            } catch {
                // Component may already be unmounted, ignore
            }
        }
        if (this._target) {
            this._target.innerHTML = '';
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
            this._scheduleRender();
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
            this._scheduleRender();
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
