<script>
    import { afterUpdate } from 'svelte';

    export let panelIcon = '💬';
    export let panelTitle = 'Battle Chat';
    export let messages = [];
    export let placeholderText = 'Type your message...';
    export let sendButtonLabel = 'Send';
    export let sendDisabled = false;
    export let statusText = '';
    export let onSend = null;

    let inputValue = '';
    let chatMessagesElement = null;
    let previousMessageCount = 0;

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

    const formatTime = (timestamp) => {
        if (!timestamp) {
            return '';
        }
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    afterUpdate(() => {
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

    $: hasMessages = Array.isArray(messages) && messages.length > 0;
    $: hasStatus = typeof statusText === 'string' && statusText.trim().length > 0;
</script>

<div class="arena-card rounded-lg p-4 flex flex-col h-[26rem]" id="battle-chat-panel-card">
    <div class="flex items-center gap-2 pb-3 border-b border-arena-accent/30">
        <span class="text-xl">{panelIcon}</span>
        <h3 class="font-magic font-semibold text-arena-accent">{panelTitle}</h3>
    </div>

    <div class="flex flex-col flex-1 gap-3 pt-3">
        <div
            class="flex-1 overflow-y-auto space-y-2 text-sm pr-1"
            bind:this={chatMessagesElement}
        >
            {#if hasMessages}
                {#each messages as message (message.id)}
                    <div
                        class={`chat-message-entry rounded border border-arena-accent/20 p-2 ${
                            message.origin === 'local'
                                ? 'bg-arena-surface/70'
                                : 'bg-arena-surface/40'
                        }`}
                    >
                        <div class="flex items-center justify-between text-[0.7rem] text-arena-text-dim mb-1">
                            <span class="font-semibold text-arena-accent">
                                {message.sender || 'Unknown'}
                            </span>
                            {#if message.timestamp}
                                <span>{formatTime(message.timestamp)}</span>
                            {/if}
                        </div>
                        <p class="text-arena-text break-words leading-snug whitespace-pre-line">
                            {message.message}
                        </p>
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

        <form on:submit|preventDefault={handleSubmit} class="flex flex-col gap-2">
            <input
                type="text"
                placeholder={placeholderText}
                class="flex-1 bg-arena-surface border border-arena-accent/30 rounded px-3 py-2 text-arena-text placeholder:text-arena-muted focus:border-arena-accent focus:outline-none"
                bind:value={inputValue}
                disabled={sendDisabled}
            />
            <button
                type="submit"
                class="bg-arena-accent hover:bg-arena-accent-dark text-black text-sm px-4 py-2 rounded font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={sendDisabled}
            >
                {sendButtonLabel}
            </button>
        </form>

        {#if hasStatus}
            <div class="text-xs text-yellow-300">
                {statusText}
            </div>
        {/if}
    </div>
</div>
