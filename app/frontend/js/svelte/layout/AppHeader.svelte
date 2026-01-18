<script>
    import { navigate } from '@lib/router';

    const navLinks = [
        { href: '/', label: 'Home', icon: '🏠' },
        { href: '/game', label: 'Play', icon: '⚔️' },
        { href: '/draft', label: 'Limited', icon: '📜' },
        { href: '/decks', label: 'Decks', icon: '🪄' },
        { href: '/replay', label: 'Replay', icon: '📼' },
        { href: '/formats', label: 'Formats', icon: '📊' }
    ];

    let mobileMenuOpen = $state(false);

    function toggleMobileMenu() {
        mobileMenuOpen = !mobileMenuOpen;
    }

    function handleNavClick(event, link) {
        if (link.external) return; // Let external links proceed normally
        
        event.preventDefault();
        mobileMenuOpen = false;
        navigate(link.href);
    }
</script>

<nav class="arena-surface border-b border-arena-accent/20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-12">
            <!-- Logo -->
            <div class="flex items-center space-x-4">
                <a 
                    href="/" 
                    class="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                    onclick={(e) => handleNavClick(e, { href: '/' })}
                >
                    <div class="w-10 h-10 bg-accent-gradient rounded-lg flex items-center justify-center shadow-arena">
                        <span class="text-2xl">⚔️</span>
                    </div>
                    <div>
                        <h1 class="font-magic text-xl font-bold text-arena-accent">ManaForge</h1>
                        <p class="text-xs text-arena-text-dim">The Gathering</p>
                    </div>
                </a>
            </div>
            
            <!-- Navigation Links (Desktop) -->
            <div class="hidden md:flex items-center space-x-6">
                {#each navLinks as link}
                    <a 
                        href={link.href} 
                        class="nav-link"
                        onclick={(e) => handleNavClick(e, link)}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                    >
                        <span class="mr-2">{link.icon}</span>{link.label}
                    </a>
                {/each}
            </div>

            <!-- Mobile Menu Button -->
            <button
                class="md:hidden p-2 text-arena-text hover:text-arena-accent transition-colors"
                onclick={toggleMobileMenu}
                aria-label="Toggle menu"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {#if mobileMenuOpen}
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    {:else}
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    {/if}
                </svg>
            </button>
            
            <!-- User Actions (Desktop) -->
            <div class="hidden md:flex items-center space-x-4">
                <a 
                    href="/auth" 
                    class="arena-button px-4 py-2 rounded-lg font-semibold text-sm hover:-translate-y-0.5 transition-transform"
                    onclick={(e) => handleNavClick(e, { href: '/auth' })}
                >
                    <span class="mr-2">🔐</span>Guest
                </a>
            </div>
        </div>

        <!-- Mobile Menu -->
        {#if mobileMenuOpen}
            <div class="md:hidden py-4 border-t border-arena-accent/20">
                <div class="flex flex-col space-y-2">
                    {#each navLinks as link}
                        <a 
                            href={link.href} 
                            class="nav-link py-2 px-4 rounded-lg hover:bg-arena-card"
                            onclick={(e) => handleNavClick(e, link)}
                            target={link.external ? '_blank' : undefined}
                        >
                            <span class="mr-2">{link.icon}</span>{link.label}
                        </a>
                    {/each}
                    <a 
                        href="/auth" 
                        class="arena-button py-2 px-4 rounded-lg font-semibold text-sm text-center mt-2"
                        onclick={(e) => handleNavClick(e, { href: '/auth' })}
                    >
                        <span class="mr-2">🔐</span>Guest
                    </a>
                </div>
            </div>
        {/if}
    </div>
</nav>
