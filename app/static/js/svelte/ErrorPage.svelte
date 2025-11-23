<script>
    import { onMount, onDestroy } from 'svelte';

    let redirectTimer;
    let sparkleInterval;
    let iconEl = null;

    const manaSymbols = ['W', 'U', 'B', 'R', 'G'];

    const props = $props();

    const message = $derived(props?.message || 'A magical disturbance has occurred in the planeswalker realm.');

    function startRedirectTimer() {
        redirectTimer = setTimeout(() => {
            window.location.href = '/';
        }, 32000);
    }

    function cancelRedirect() {
        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
        }
    }

    function handleEscape(event) {
        if (event.key === 'Escape') {
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    }

    function initSparkle(icon) {
        if (!icon) return;
        sparkleInterval = setInterval(() => {
            icon.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.5)';
            setTimeout(() => {
                icon.style.boxShadow = '';
            }, 500);
        }, 2000);
    }

    function handleButtonEnter(event) {
        event.currentTarget.style.transform = 'scale(1.05)';
    }

    function handleButtonLeave(event) {
        event.currentTarget.style.transform = '';
    }

    function handleButtonClick(event) {
        const target = event.currentTarget;
        target.style.transform = 'scale(0.95)';
        setTimeout(() => (target.style.transform = ''), 100);
    }

    onMount(() => {
        startRedirectTimer();
        document.addEventListener('click', cancelRedirect);
        document.addEventListener('keypress', cancelRedirect);
        document.addEventListener('scroll', cancelRedirect);
        document.addEventListener('keydown', handleEscape);
        initSparkle(iconEl);

        return () => {
            cancelRedirect();
            document.removeEventListener('click', cancelRedirect);
            document.removeEventListener('keypress', cancelRedirect);
            document.removeEventListener('scroll', cancelRedirect);
            document.removeEventListener('keydown', handleEscape);
            if (sparkleInterval) {
                clearInterval(sparkleInterval);
            }
        };
    });

    onDestroy(() => {
        cancelRedirect();
        if (sparkleInterval) {
            clearInterval(sparkleInterval);
        }
    });
</script>

<div class="min-h-screen flex items-center justify-center px-4">
    <div class="max-w-2xl w-full text-center">
        <div class="arena-card rounded-xl p-12 animate-fade-in">
            <div class="mb-8">
                <div
                    class="w-24 h-24 bg-red-500/20 border-2 border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse"
                    bind:this={iconEl}
                >
                    <span class="text-4xl">⚡</span>
                </div>
                <h1 class="font-magic text-3xl font-bold text-red-400 mb-4">
                    Spell Disrupted!
                </h1>
                <p class="text-arena-text-dim text-lg leading-relaxed">
                    {message}
                </p>
            </div>

            <div class="space-y-4 mb-8">
                <a
                    href="/"
                    class="inline-flex items-center bg-arena-surface-light hover:bg-arena-surface border border-arena-accent/30 hover:border-arena-accent text-arena-text hover:text-arena-accent px-6 py-3 rounded-lg font-semibold transition-all duration-300"
                    on:mouseenter={handleButtonEnter}
                    on:mouseleave={handleButtonLeave}
                    on:click={handleButtonClick}
                >
                    <span class="mr-2">🏠</span>Home Plane
                </a>
            </div>

            <div class="arena-surface rounded-lg p-6 border border-arena-accent/20">
                <h3 class="font-magic text-lg font-semibold text-arena-accent mb-4">
                    <span class="mr-2">🔮</span>Restoration Rituals
                </h3>
                <div class="text-arena-text-dim text-sm space-y-2">
                    <p class="mb-3">If the magical energies remain disrupted, try these incantations:</p>
                    <div class="grid md:grid-cols-3 gap-4 text-left">
                        <div class="flex items-start">
                            <span class="mr-2 text-arena-accent">•</span>
                            <span>Refresh the enchanted interface</span>
                        </div>
                        <div class="flex items-start">
                            <span class="mr-2 text-arena-accent">•</span>
                            <span>Forge a new battlefield</span>
                        </div>
                        <div class="flex items-start">
                            <span class="mr-2 text-arena-accent">•</span>
                            <span>Strengthen your mana connection</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex justify-center items-center space-x-2 mt-8 opacity-60">
                {#each manaSymbols as symbol, index}
                    <span
                        class={`mana-symbol mana-${symbol.toLowerCase()} animate-float`}
                        style={`animation-delay: ${index * 200}ms`}
                        on:mouseenter={(event) => {
                            event.currentTarget.style.transform = 'scale(1.2) rotate(10deg)';
                            event.currentTarget.style.transition = 'transform 0.3s ease';
                        }}
                        on:mouseleave={(event) => (event.currentTarget.style.transform = '')}
                    >
                        {symbol}
                    </span>
                {/each}
            </div>
        </div>
    </div>
</div>
