<script>
    import { onDestroy, onMount } from 'svelte';
    import { createClassComponent } from 'svelte/legacy';
    import BattleChat from './BattleChat.svelte';

    const MAX_MESSAGES = 500;

    let messages = $state([]);
    let statusText = $state('');
    let sendDisabled = $state(false);
    let placeholderText = $state('Type your message...');
    let chatComponent = $state(null);
    let chatTarget = $state(null);

    const buildMessageId = () => `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const normalizeTimestamp = (value) => {
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
    };

    const normalizeMessage = ({
        id = null,
        sender = 'Unknown',
        message = '',
        timestamp = null,
        playerId = null,
        origin = 'remote',
        error = null
    } = {}) => ({
        id: id || buildMessageId(),
        sender: sender || 'Unknown',
        message: String(message || ''),
        timestamp: normalizeTimestamp(timestamp),
        playerId: playerId || null,
        origin,
        error: error || null
    });

    const resolveLocalSender = () => {
        const chatManager = typeof WebSocketManager !== 'undefined' ? WebSocketManager : null;
        const info = chatManager?.getLocalPlayerInfo?.();
        const id = info?.id || 'player1';
        const name = info?.name || 'Player';

        return { id, name };
    };

    const buildProps = () => ({
        panelIcon: '💬',
        panelTitle: 'Battle Chat',
        messages: Array.isArray(messages) ? [...messages] : [],
        placeholderText,
        sendButtonLabel: 'Send',
        sendDisabled,
        statusText,
        onSend: handleSend
    });

    const destroyComponent = () => {
        if (chatComponent && typeof chatComponent.$destroy === 'function') {
            try {
                chatComponent.$destroy();
            } catch (error) {
                console.error('[BattleChatManager] failed to destroy chat component', error);
            }
        }
        chatComponent = null;
        chatTarget = null;
    };

    const ensureComponent = () => {
        if (typeof document === 'undefined') {
            return null;
        }

        const container = document.getElementById('battle-chat-panel');
        if (!container) {
            destroyComponent();
            return null;
        }

        if (chatComponent && chatTarget === container) {
            return chatComponent;
        }

        destroyComponent();

        try {
            container.innerHTML = '';
            chatComponent = createClassComponent({
                component: BattleChat,
                target: container,
                props: buildProps()
            });
            chatTarget = container;
        } catch (error) {
            console.error('[BattleChatManager] failed to initialize battle chat component', error);
            chatComponent = null;
            chatTarget = null;
        }

        return chatComponent;
    };

    const render = () => {
        const component = ensureComponent();
        if (!component) {
            return;
        }
        try {
            component.$set(buildProps());
        } catch (error) {
            console.error('[BattleChatManager] failed to update chat component', error);
        }
    };

    const pushMessage = (entry, triggerRender = true) => {
        if (!entry) {
            return;
        }

        messages = [...messages, entry];
        if (messages.length > MAX_MESSAGES) {
            messages = messages.slice(-MAX_MESSAGES);
        }

        if (triggerRender) {
            render();
        }
    };

    const markMessageError = (messageId, errorText) => {
        if (!messageId) {
            return;
        }

        messages = messages.map((msg) =>
            msg.id === messageId
                ? { ...msg, error: errorText || 'Not delivered' }
                : msg
        );
        render();
    };

    const handleSend = (text) => {
        const trimmed = (text || '').trim();
        if (!trimmed) {
            return { success: false, error: 'empty_message' };
        }

        const senderInfo = resolveLocalSender();
        const timestamp = Date.now();
        const entry = normalizeMessage({
            sender: senderInfo.name,
            message: trimmed,
            timestamp,
            playerId: senderInfo.id,
            origin: 'local'
        });

        pushMessage(entry);

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
            markMessageError(entry.id, errorText);
            setStatus(errorText);
            return result || { success: false, error: errorText };
        }

        setStatus('');
        return result;
    };

    const loadChatLog = (entries = []) => {
        messages = [];
        if (Array.isArray(entries)) {
            entries.forEach((entry) => {
                if (!entry) {
                    return;
                }
                const normalized = normalizeMessage({
                    id: entry.id,
                    sender: entry.player || entry.sender,
                    message: entry.message,
                    timestamp: entry.timestamp,
                    playerId: entry.player_id || entry.player,
                    origin: 'history'
                });
                pushMessage(normalized, false);
            });
        }
        render();
    };

    const addMessage = (sender, message, options = {}) => {
        const normalized = normalizeMessage({
            sender,
            message,
            ...options
        });
        pushMessage(normalized);
    };

    const addSystemMessage = (message) => {
        if (!message) {
            return;
        }
        addMessage('System', message, { origin: 'system' });
    };

    const setStatus = (text = '') => {
        statusText = text || '';
        render();
    };

    const setSendDisabled = (isDisabled = false, text = '') => {
        sendDisabled = Boolean(isDisabled);
        statusText = text || statusText;
        render();
    };

    const api = {
        render,
        loadChatLog,
        addMessage,
        addSystemMessage,
        setStatus,
        setSendDisabled
    };

    if (typeof window !== 'undefined') {
        window.UIBattleChat = api;
    }

    onMount(() => {
        render();
    });

    onDestroy(() => {
        destroyComponent();
        if (typeof window !== 'undefined' && window.UIBattleChat === api) {
            delete window.UIBattleChat;
        }
    });
</script>
