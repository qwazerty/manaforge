<script>
    const LOCAL_STORAGE_KEY = 'replay_data';

    let gameId = $state('');
    let status = $state({ type: '', message: '' });
    let fileInputEl = $state(null);

    const hasStatus = $derived(() => Boolean(status.message));

    function navigateToReplay() {
        resetStatus();
        const trimmed = gameId.trim();
        if (!trimmed) {
            status = { type: 'error', message: 'Enter a game ID.' };
            return;
        }
        window.location.href = `/replay/${encodeURIComponent(trimmed)}`;
    }

    function triggerFileSelect() {
        resetStatus();
        if (fileInputEl) {
            fileInputEl.value = '';
            fileInputEl.click();
        }
    }

    function handleFileChange(event) {
        resetStatus();
        const file = event?.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => processFileContents(e?.target?.result);
        reader.onerror = () => {
            status = { type: 'error', message: 'Unable to read the file.' };
        };
        reader.readAsText(file);
    }

    function processFileContents(text) {
        try {
            const data = JSON.parse(text || '{}');
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
            status = { type: 'success', message: 'Replay loaded, redirecting...' };
            window.location.href = '/replay/local';
        } catch (error) {
            console.error('[ReplayLobby] invalid JSON', error);
            status = { type: 'error', message: 'The selected file is not valid JSON.' };
        }
    }

    function resetStatus() {
        status = { type: '', message: '' };
    }
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    <div class="text-center mb-12">
        <h1 class="text-4xl font-magic text-arena-accent mb-4">Game Replays</h1>
        <p class="text-arena-text-dim text-lg">Watch past games or analyze your gameplay.</p>
    </div>

    {#if hasStatus}
        <div class={`arena-card border ${status.type === 'error' ? 'border-red-500/40 text-red-100' : 'border-green-500/40 text-green-100'} bg-arena-surface mb-6 px-4 py-3 rounded-lg text-sm`}>
            {status.message}
        </div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="arena-card p-8 rounded-xl text-center">
            <div class="text-4xl mb-4">🔍</div>
            <h2 class="text-2xl font-bold text-arena-text-primary mb-4">Load by Game ID</h2>
            <p class="text-arena-text-dim mb-6">Enter the ID of a recently played game.</p>

            <div class="flex gap-2">
                <input
                    type="text"
                    placeholder="Game ID..."
                    value={gameId}
                    oninput={(event) => (gameId = event.target.value)}
                    onkeydown={(event) => {
                        if (event.key === 'Enter') navigateToReplay();
                    }}
                    class="flex-1 bg-arena-bg-dark border border-arena-border rounded-lg px-4 py-2 text-arena-text-primary focus:outline-none focus:border-arena-accent"
                />
                <button class="arena-button px-6 py-2 rounded-lg font-bold" onclick={navigateToReplay}>
                    Watch
                </button>
            </div>
        </div>

        <div class="arena-card p-8 rounded-xl text-center">
            <div class="text-4xl mb-4">📂</div>
            <h2 class="text-2xl font-bold text-arena-text-primary mb-4">Upload Replay File</h2>
            <p class="text-arena-text-dim mb-6">Load a saved replay JSON file.</p>

            <input
                bind:this={fileInputEl}
                type="file"
                accept=".json,application/json"
                class="hidden"
                onchange={handleFileChange}
            />
            <button class="arena-button px-6 py-2 rounded-lg font-bold w-full" onclick={triggerFileSelect}>
                Select File
            </button>
        </div>
    </div>
</div>
