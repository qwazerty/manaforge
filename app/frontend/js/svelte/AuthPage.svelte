<script>
    import { onMount } from 'svelte';

    let { initialTab = 'login' } = $props();

    let activeTab = $state(initialTab);
    let isLoading = $state(false);
    let statusMessage = $state({ text: '', type: '' });

    // Login form state
    let loginEmail = $state('');
    let loginPassword = $state('');

    // Signup form state
    let signupUsername = $state('');
    let signupEmail = $state('');
    let signupPassword = $state('');
    let signupConfirmPassword = $state('');

    function switchTab(tab) {
        activeTab = tab;
        statusMessage = { text: '', type: '' };
    }

    async function handleLogin(event) {
        event.preventDefault();
        isLoading = true;
        statusMessage = { text: '', type: '' };

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: loginEmail, 
                    password: loginPassword 
                })
            });

            if (response.ok) {
                statusMessage = { text: 'Login successful! Redirecting...', type: 'success' };
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                const data = await response.json();
                statusMessage = { text: data.detail || 'Login failed', type: 'error' };
            }
        } catch (error) {
            statusMessage = { text: 'Network error. Please try again.', type: 'error' };
        } finally {
            isLoading = false;
        }
    }

    async function handleSignup(event) {
        event.preventDefault();
        
        if (signupPassword !== signupConfirmPassword) {
            statusMessage = { text: 'Passwords do not match', type: 'error' };
            return;
        }

        isLoading = true;
        statusMessage = { text: '', type: '' };

        try {
            const response = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: signupUsername,
                    email: signupEmail, 
                    password: signupPassword 
                })
            });

            if (response.ok) {
                statusMessage = { text: 'Account created! You can now log in.', type: 'success' };
                activeTab = 'login';
                loginEmail = signupEmail;
            } else {
                const data = await response.json();
                statusMessage = { text: data.detail || 'Signup failed', type: 'error' };
            }
        } catch (error) {
            statusMessage = { text: 'Network error. Please try again.', type: 'error' };
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        // Check URL for tab parameter
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'signup' || tabParam === 'login') {
            activeTab = tabParam;
        }
    });
</script>

<div class="min-h-screen flex items-center justify-center py-12 px-4">
    <div class="max-w-md w-full space-y-8">
        <!-- Logo/Title -->
        <div class="text-center">
            <h1 class="text-4xl font-bold text-gold-400 mb-2">
                <a href="/" class="hover:text-gold-300 transition-colors">ManaForge</a>
            </h1>
            <p class="text-arena-text-muted">Enter the battlefield</p>
        </div>

        <!-- Tab Switcher -->
        <div class="flex rounded-lg bg-arena-card p-1 gap-1">
            <button
                class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors {activeTab === 'login' 
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' 
                    : 'text-arena-text-muted hover:text-arena-text'}"
                onclick={() => switchTab('login')}
            >
                Login
            </button>
            <button
                class="flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors {activeTab === 'signup' 
                    ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30' 
                    : 'text-arena-text-muted hover:text-arena-text'}"
                onclick={() => switchTab('signup')}
            >
                Sign Up
            </button>
        </div>

        <!-- Status Message -->
        {#if statusMessage.text}
            <div class="p-3 rounded-lg text-sm {statusMessage.type === 'error' 
                ? 'bg-red-900/50 border border-red-500/30 text-red-300' 
                : 'bg-green-900/50 border border-green-500/30 text-green-300'}">
                {statusMessage.text}
            </div>
        {/if}

        <!-- Login Form -->
        {#if activeTab === 'login'}
            <form class="space-y-4" onsubmit={handleLogin}>
                <div>
                    <label for="login-email" class="block text-sm font-medium text-arena-text mb-1">
                        Email
                    </label>
                    <input
                        id="login-email"
                        type="email"
                        required
                        bind:value={loginEmail}
                        class="w-full px-4 py-2 rounded-lg bg-arena-input border border-arena-border focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-arena-text placeholder-arena-text-muted"
                        placeholder="planeswalker@example.com"
                    />
                </div>

                <div>
                    <label for="login-password" class="block text-sm font-medium text-arena-text mb-1">
                        Password
                    </label>
                    <input
                        id="login-password"
                        type="password"
                        required
                        bind:value={loginPassword}
                        class="w-full px-4 py-2 rounded-lg bg-arena-input border border-arena-border focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-arena-text"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    class="w-full py-3 px-4 rounded-lg bg-gold-500 hover:bg-gold-400 text-arena-bg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        {/if}

        <!-- Signup Form -->
        {#if activeTab === 'signup'}
            <form class="space-y-4" onsubmit={handleSignup}>
                <div>
                    <label for="signup-username" class="block text-sm font-medium text-arena-text mb-1">
                        Username
                    </label>
                    <input
                        id="signup-username"
                        type="text"
                        required
                        bind:value={signupUsername}
                        class="w-full px-4 py-2 rounded-lg bg-arena-input border border-arena-border focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-arena-text placeholder-arena-text-muted"
                        placeholder="YourPlaneswalkerName"
                    />
                </div>

                <div>
                    <label for="signup-email" class="block text-sm font-medium text-arena-text mb-1">
                        Email
                    </label>
                    <input
                        id="signup-email"
                        type="email"
                        required
                        bind:value={signupEmail}
                        class="w-full px-4 py-2 rounded-lg bg-arena-input border border-arena-border focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-arena-text placeholder-arena-text-muted"
                        placeholder="planeswalker@example.com"
                    />
                </div>

                <div>
                    <label for="signup-password" class="block text-sm font-medium text-arena-text mb-1">
                        Password
                    </label>
                    <input
                        id="signup-password"
                        type="password"
                        required
                        bind:value={signupPassword}
                        class="w-full px-4 py-2 rounded-lg bg-arena-input border border-arena-border focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-arena-text"
                        placeholder="••••••••"
                    />
                </div>

                <div>
                    <label for="signup-confirm" class="block text-sm font-medium text-arena-text mb-1">
                        Confirm Password
                    </label>
                    <input
                        id="signup-confirm"
                        type="password"
                        required
                        bind:value={signupConfirmPassword}
                        class="w-full px-4 py-2 rounded-lg bg-arena-input border border-arena-border focus:border-gold-500 focus:ring-1 focus:ring-gold-500 text-arena-text"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    class="w-full py-3 px-4 rounded-lg bg-gold-500 hover:bg-gold-400 text-arena-bg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Creating account...' : 'Create Account'}
                </button>
            </form>
        {/if}

        <!-- Footer -->
        <div class="text-center text-sm text-arena-text-muted">
            <a href="/" class="hover:text-gold-400 transition-colors">
                ← Back to ManaForge
            </a>
        </div>
    </div>
</div>
