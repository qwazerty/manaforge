/**
 * Simple SPA Router for ManaForge
 * Handles client-side navigation without a full framework
 */

export interface Route {
    path: string;
    pattern: RegExp;
    paramNames: string[];
}

export interface RouteMatch {
    route: Route;
    params: Record<string, string>;
}

/**
 * Convert a path pattern like "/game/:gameId" to a RegExp
 * and extract parameter names
 */
function pathToRegex(path: string): Route {
    const paramNames: string[] = [];
    const pattern = path
        .replace(/\//g, '\\/')
        .replace(/:([^/]+)/g, (_, paramName) => {
            paramNames.push(paramName);
            return '([^/]+)';
        });
    return {
        path,
        pattern: new RegExp(`^${pattern}$`),
        paramNames
    };
}

function normalizePath(path: string): string {
    if (!path) return '/';
    let cleanPath = path.split('?')[0].split('#')[0];
    if (cleanPath === '/index.html' || cleanPath === '/static/index.html') {
        return '/';
    }
    if (cleanPath.endsWith('/index.html')) {
        cleanPath = cleanPath.slice(0, -'/index.html'.length) || '/';
    }
    return cleanPath || '/';
}

export class Router {
    private routes: Route[] = [];
    private currentPath: string = '';
    private listeners: Set<(match: RouteMatch | null) => void> = new Set();

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('popstate', () => this.handleNavigation());
        }
    }

    /**
     * Register routes from path patterns
     */
    register(paths: string[]): void {
        this.routes = paths.map(pathToRegex);
    }

    /**
     * Match a path against registered routes
     */
    match(path: string): RouteMatch | null {
        const cleanPath = normalizePath(path);
        
        for (const route of this.routes) {
            const match = cleanPath.match(route.pattern);
            if (match) {
                const params: Record<string, string> = {};
                route.paramNames.forEach((name, index) => {
                    params[name] = match[index + 1];
                });
                return { route, params };
            }
        }
        return null;
    }

    /**
     * Navigate to a new path
     */
    navigate(path: string, replace = false): void {
        if (path === this.currentPath) return;
        
        if (replace) {
            window.history.replaceState({}, '', path);
        } else {
            window.history.pushState({}, '', path);
        }
        this.handleNavigation();
    }

    /**
     * Handle navigation events
     */
    private handleNavigation(): void {
        this.currentPath = window.location.pathname;
        const match = this.match(this.currentPath);
        this.listeners.forEach(listener => listener(match));
    }

    /**
     * Subscribe to route changes
     */
    subscribe(listener: (match: RouteMatch | null) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Get current path
     */
    getCurrentPath(): string {
        return typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/';
    }

    /**
     * Get query parameters
     */
    getQueryParams(): URLSearchParams {
        return typeof window !== 'undefined' 
            ? new URLSearchParams(window.location.search) 
            : new URLSearchParams();
    }

    /**
     * Initialize and trigger initial route
     */
    init(): void {
        this.handleNavigation();
    }
}

// Singleton router instance
export const router = new Router();

/**
 * Intercept anchor clicks for SPA navigation
 */
export function setupLinkInterception(): void {
    if (typeof document === 'undefined') return;
    
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const anchor = target.closest('a');
        
        if (!anchor) return;
        
        // Skip if modifier keys are pressed
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        
        // Skip if target is external or has download attribute
        const href = anchor.getAttribute('href');
        if (!href) return;
        if (anchor.hasAttribute('download')) return;
        if (anchor.getAttribute('target') === '_blank') return;
        if (href.startsWith('http://') || href.startsWith('https://')) {
            // Check if it's the same origin
            try {
                const url = new URL(href);
                if (url.origin !== window.location.origin) return;
            } catch {
                return;
            }
        }
        if (href.startsWith('#')) return;
        if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
        
        // Skip if explicitly marked to bypass router
        if (anchor.hasAttribute('data-no-router')) return;
        
        // Prevent default and use router
        event.preventDefault();
        router.navigate(href);
    });
}

/**
 * Navigate programmatically (convenience export)
 */
export function navigate(path: string, replace = false): void {
    router.navigate(path, replace);
}
