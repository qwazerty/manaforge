<script>
    import { onMount } from 'svelte';

    const MANA_SYMBOLS = ['W', 'U', 'B', 'R', 'G'];

    const featureCards = [
        {
            icon: '⚡',
            title: 'Real-time Battles',
            description: 'Experience smooth, responsive gameplay with instant card interactions and live opponent updates.'
        },
        {
            icon: '📋',
            title: 'Deck Import',
            description: 'Import your favorite decks from text lists and jump straight into battle with your custom strategies.'
        },
        {
            icon: '👥',
            title: 'Planeswalker Community',
            description: 'Connect with fellow planeswalkers, share strategies, and compete in tournaments.'
        }
    ];

    const quickActions = [
        { href: '/game', label: 'Play', icon: '🎮' },
        { href: '/draft', label: 'Limited', icon: '📦' }
    ];

    function handleAnchorClick(event, targetId) {
        event.preventDefault();
        const selector = targetId.startsWith('#') ? targetId : `#${targetId}`;
        const target = document.querySelector(selector);
        target?.scrollIntoView({ behavior: 'smooth' });
    }

    onMount(() => {
        const criticalPages = ['/game', '/cards'];
        criticalPages.forEach((page) => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = page;
            document.head.appendChild(link);
        });
    });
</script>

<div class="relative overflow-hidden">
    <div class="absolute inset-0 bg-arena-gradient opacity-90"></div>

    <div class="relative z-10 py-16 px-4">
        <div class="max-w-6xl mx-auto text-center">
            <div class="animate-fade-in mb-8">
                <h1 class="font-magic text-5xl md:text-7xl font-bold text-arena-accent mb-4 animate-glow">
                    🔮 Welcome to ManaForge
                </h1>
                <p class="text-xl md:text-2xl text-arena-text mb-6 font-light">
                    Magic The Gathering web-based arena for duels and drafts
                </p>
                <div class="flex justify-center items-center space-x-2 text-arena-text-dim">
                    {#each MANA_SYMBOLS as symbol, index (symbol)}
                        <i
                            class={`ms ms-${symbol.toLowerCase()} ms-cost ms-2x animate-float`}
                            style={`animation-delay: ${index * 200}ms`}
                        ></i>
                    {/each}
                </div>
            </div>

            <div class="max-w-2xl mx-auto animate-slide-up">
                <div class="arena-card rounded-xl p-8 group transform transition-transform duration-200 hover:-translate-y-1">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-accent-gradient rounded-full flex items-center justify-center mx-auto mb-6 shadow-arena">
                            <span class="text-3xl">⚔️</span>
                        </div>
                        <h2 class="font-magic text-2xl font-bold text-arena-accent mb-4">Enter the Arena</h2>
                        {#each quickActions as action, i (action.href)}
                            <a
                                href={action.href}
                                class={`arena-button w-full py-3 px-6 rounded-lg font-semibold text-lg transition-all duration-300 inline-block text-center${i > 0 ? ' mt-4' : ''}`}
                            >
                                <span class="mr-2">{action.icon}</span>{action.label}
                            </a>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="py-16 px-4" id="features-section">
    <div class="max-w-6xl mx-auto">
        <h2 class="font-magic text-3xl font-bold text-center text-arena-accent mb-12">
            Forge Your Legend
        </h2>

        <div class="grid md:grid-cols-3 gap-8">
            {#each featureCards as feature (feature.title)}
                <div class="text-center p-6 arena-card rounded-xl transition-transform duration-200 transform hover:-translate-y-1">
                    <div class="w-12 h-12 bg-accent-gradient rounded-lg flex items-center justify-center mx-auto mb-4 shadow-arena">
                        <span class="text-xl">{feature.icon}</span>
                    </div>
                    <h3 class="font-magic text-xl font-semibold text-arena-accent mb-2">{feature.title}</h3>
                    <p class="text-arena-text-dim">{feature.description}</p>
                    <button
                        class="mt-4 text-sm text-arena-accent hover:text-white transition"
                        onclick={(event) => handleAnchorClick(event, '#features-section')}
                        aria-label="Scroll to features"
                        type="button"
                    >
                        Learn more ↴
                    </button>
                </div>
            {/each}
        </div>
    </div>
</div>
