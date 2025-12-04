<script>
    let {
        panelIcon = '💬',
        panelTitle = 'Battle Chat',
        messages = [],
        placeholderText = 'Type your message...',
        sendButtonLabel = 'Send',
        sendDisabled = false,
        statusText = '',
        onSend = null
    } = $props();

    let inputValue = $state('');
    let chatMessagesElement = null;
    let previousMessageCount = 0;

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const text = (inputValue || '').trim();
        if (!text || typeof onSend !== 'function') {
            if (!text) {
                inputValue = '';
            }
            return;
        }
        inputValue = '';
        try {
            const result = onSend(text);
            if (result && typeof result.then === 'function') {
                result.catch(() => {});
            }
        } catch (error) {
            console.error('BattleChat onSend handler failed', error);
        }
    };

    $effect(() => {
        if (!Array.isArray(messages)) {
            previousMessageCount = 0;
            return;
        }

        if (
            chatMessagesElement &&
            messages.length !== previousMessageCount
        ) {
            chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
            previousMessageCount = messages.length;
        }
    });

    const normalizedMessages = () => (Array.isArray(messages) ? messages : []);
    const hasMessages = () => normalizedMessages().length > 0;
    const hasStatus = () => typeof statusText === 'string' && statusText.trim().length > 0;
</script>

<div class="arena-card rounded-lg p-4 flex flex-col h-[26rem] overflow-hidden" id="battle-chat-panel-card">
    <div class="flex items-center gap-2 pb-3 border-b border-arena-accent/30">
        <span class="text-xl">{panelIcon}</span>
        <h3 class="font-magic font-semibold text-arena-accent">{panelTitle}</h3>
    </div>

    <div class="flex flex-col flex-1 gap-3 pt-3 min-h-0 overflow-hidden">
        <div
            class="flex-1 overflow-y-auto space-y-2 text-sm pr-1"
            bind:this={chatMessagesElement}
        >
            {#if hasMessages()}
                {#each normalizedMessages() as message (message.id)}
                    <div
                        class={`chat-message-entry rounded px-2 py-1 ${
                            message.origin === 'local'
                                ? 'bg-arena-surface/70'
                                : 'bg-arena-surface/40'
                        }`}
                    >
                        <div class="flex items-start gap-3 text-[0.75rem]">
                            <div class="flex-1 min-w-0 text-arena-text text-sm leading-snug">
                                <span class="font-semibold text-arena-accent">
                                    {message.sender || 'Unknown'}
                                </span>
                                &nbsp;
                                <span class="whitespace-pre-line break-words">
                                    {message.message}
                                </span>
                            </div>
                            {#if message.timestamp}
                                <span class="text-arena-text-dim text-[0.7rem] shrink-0">
                                    {formatTime(message.timestamp)}
                                </span>
                            {/if}
                        </div>
                        {#if message.error}
                            <div class="text-xs text-red-400 mt-1">
                                {message.error}
                            </div>
                        {/if}
                    </div>
                {/each}
            {:else}
                <div class="text-arena-text-dim text-center py-6">
                    <span class="text-2xl block mb-2">⚔️</span>
                    <p>Battle chat ready</p>
                </div>
            {/if}
        </div>

        <form onsubmit={handleSubmit} class="flex items-center border-t border-arena-accent/30 gap-2 pt-3">
            <input
                type="text"
                placeholder={placeholderText}
                class="flex-1 bg-arena-surface border border-arena-accent/30 rounded px-3 py-2 text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:outline-none"
                bind:value={inputValue}
                disabled={sendDisabled}
            />
            <button
                type="submit"
                class="bg-arena-accent hover:bg-arena-accent-dark text-black text-sm px-4 py-2 rounded font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                disabled={sendDisabled}
            >
                {sendButtonLabel}
            </button>
        </form>

        {#if hasStatus()}
            <div class="text-xs text-yellow-300">
                {statusText}
            </div>
        {/if}
    </div>
</div>
