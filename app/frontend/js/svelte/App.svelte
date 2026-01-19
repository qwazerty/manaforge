<script>
    import { onMount, onDestroy } from 'svelte';
    import { router, setupLinkInterception } from '@lib/router';

    // Page components
    import HomePage from './HomePage.svelte';
    import GameLobby from './GameLobby.svelte';
    import GameRoomSetup from './GameRoomSetup.svelte';
    import GameInterface from './GameInterface.svelte';
    import DeckLibrary from './DeckLibrary.svelte';
    import DeckManager from './DeckManager.svelte';
    import DraftLobby from './DraftLobby.svelte';
    import DraftRoom from './DraftRoom.svelte';
    import FormatStats from './FormatStats.svelte';
    import ReplayLobby from './ReplayLobby.svelte';
    import ReplayRoom from './ReplayRoom.svelte';
    import AuthPage from './AuthPage.svelte';
    import ErrorPage from './ErrorPage.svelte';

    // Layout components
    import AppHeader from './layout/AppHeader.svelte';
    import AppFooter from './layout/AppFooter.svelte';

    // Route definitions
    const routes = [
        '/',
        '/game',
        '/game/:gameId',
        '/game/:gameId/play',
        '/decks',
        '/decks/builder',
        '/draft',
        '/draft/:roomId',
        '/formats',
        '/replay',
        '/replay/:gameId',
        '/auth'
    ];

    let currentRoute = $state(null);
    let routeParams = $state({});
    let queryParams = $state(new URLSearchParams());
    let unsubscribe = null;
    let isInitialized = $state(false);

    // Determine which component to render based on route
    const currentPage = $derived.by(() => {
        if (!currentRoute) return { component: ErrorPage, props: { code: 404, message: 'Page not found' } };

        const path = currentRoute.route.path;

        switch (path) {
            case '/':
                return { component: HomePage, props: {} };
            
            case '/game':
                return { component: GameLobby, props: {} };
            
            case '/game/:gameId':
                return { 
                    component: GameRoomSetup, 
                    props: { 
                        gameId: routeParams.gameId,
                        playerRole: queryParams.get('player') || null,
                        playerName: queryParams.get('player_name') || null
                    }
                };
            
            case '/game/:gameId/play':
                return { 
                    component: GameInterface, 
                    props: { gameId: routeParams.gameId }
                };
            
            case '/decks':
                return { component: DeckLibrary, props: {} };
            
            case '/decks/builder':
                return { component: DeckManager, props: {} };
            
            case '/draft':
                return { component: DraftLobby, props: {} };
            
            case '/draft/:roomId':
                return { 
                    component: DraftRoom, 
                    props: { roomId: routeParams.roomId }
                };
            
            case '/formats':
                return { component: FormatStats, props: {} };
            
            case '/replay':
                return { component: ReplayLobby, props: {} };
            
            case '/replay/:gameId':
                return { 
                    component: ReplayRoom, 
                    props: { gameId: routeParams.gameId }
                };
            
            case '/auth':
                return { 
                    component: AuthPage, 
                    props: { initialTab: queryParams.get('tab') || 'login' }
                };
            
            default:
                return { component: ErrorPage, props: { code: 404, message: 'Page not found' } };
        }
    });

    // Check if we should show the layout (header/footer)
    const showLayout = $derived.by(() => true);

    onMount(() => {
        try {
            console.log('[ManaForge] App mounting...');
            // Register routes first
            router.register(routes);

            // Setup link interception for SPA navigation
            setupLinkInterception();

            // Get initial route before subscribing
            const initialPath = router.getCurrentPath();
            console.log('[ManaForge] Initial path:', initialPath);

            const initialMatch = router.match(initialPath);
            console.log('[ManaForge] Initial match:', initialMatch);

            // Set initial state
            currentRoute = initialMatch;
            routeParams = initialMatch?.params || {};
            queryParams = router.getQueryParams();
            isInitialized = true;

            // Subscribe to future route changes
            unsubscribe = router.subscribe((match) => {
                currentRoute = match;
                routeParams = match?.params || {};
                queryParams = router.getQueryParams();
            });

            router.init();
        } catch (error) {
            console.error('[ManaForge] Critical App initialization error:', error);
            // Force initialization to show error state if possible
            isInitialized = true;
        }
    });

    onDestroy(() => {
        if (unsubscribe) {
            unsubscribe();
        }
    });
</script>

<div class="min-h-screen bg-arena-bg text-arena-text font-ui">
    {#if !isInitialized}
        <!-- Initial loading state -->
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gold-500 border-t-transparent"></div>
                <p class="mt-4 text-arena-text-muted">Loading ManaForge...</p>
            </div>
        </div>
    {:else}
        {#if showLayout()}
            <AppHeader />
        {/if}

        <main class={showLayout() ? 'min-h-screen' : ''}>
            {#key currentRoute?.route?.path + JSON.stringify(routeParams)}
                {@const page = currentPage()}
                {@const Page = page.component}
                <Page {...page.props} />
            {/key}
        </main>

        {#if showLayout()}
            <AppFooter />
        {/if}
    {/if}
</div>
