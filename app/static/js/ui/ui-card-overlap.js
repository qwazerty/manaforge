/**
 * ManaForge Card Overlap Manager
 * Dynamically adjusts card overlap based on the number of cards in zones
 */

class UICardOverlap {
    /**
     * Calculate optimal overlap based on card count
     */
    static calculateOverlap(cardCount) {
        let baseOverlap = -20; // Default base overlap

        if (cardCount <= 6) {
            baseOverlap = -20; // Base overlap
        } else if (cardCount <= 10) {
            baseOverlap = -30; // Increased overlap
        } else if (cardCount <= 15) {
            baseOverlap = -40; // High overlap
        } else {
            baseOverlap = -50; // Maximum overlap
        }
        
        if (window.innerWidth <= 768) {
            return baseOverlap - 10; // More aggressive on mobile
        } else if (window.innerWidth <= 1200) {
            return baseOverlap - 5; // Slightly more on tablet
        }
        
        return baseOverlap;
    }

    /**
     * Apply dynamic overlap to a zone container
     */
    static applyOverlapToZone(container) {
        if (!container) return;

        const cards = container.children;
        const cardCount = cards.length;
        
        if (cardCount <= 1) return; // No overlap needed for single card

        const overlap = this.calculateOverlap(cardCount);

        // Detect zone type to apply different rules
        const isLandsZone = container.closest('.lands-zone');
        const isOpponentZone = container.closest('.opponent-zone');

        // Lands zones: always flex-start
        // Other zones: center if ≤10 cards, flex-start if >10 cards
        if (isLandsZone) {
            container.style.justifyContent = 'flex-start';
        } else if (isOpponentZone) {
            container.style.justifyContent = 'center';
        } else if (cardCount >= 10) {
            container.style.justifyContent = 'flex-start';
        } else {
            container.style.justifyContent = 'center';
        }

        // Apply overlap to all cards except the first one
        for (let i = 1; i < cards.length; i++) {
            const card = cards[i];
            card.style.marginLeft = `${overlap}px`;
        }

        // Note: First card margin is now handled by CSS :first-child selector

        // Update data attribute for CSS reference
        container.setAttribute('data-dynamic-overlap', overlap);
        container.setAttribute('data-card-count', cardCount);
        container.setAttribute('data-zone-type', isLandsZone ? 'lands' : 'other');
    }

    /**
     * Apply overlap to all zone containers on the page
     */
    static applyOverlapToAllZones() {
        // Target all zone containers that might have cards
        const selectors = [
            '.creatures-zone-content',
            '.support-zone-content',
            '.lands-zone-content', 
            '.hand-zone-content',
            '.opponent-hand-zone',
            '.reveal-card-list',
        ];

        selectors.forEach(selector => {
            const containers = document.querySelectorAll(selector);
            containers.forEach(container => {
                this.applyOverlapToZone(container);
            });
        });
    }

    /**
     * Initialize overlap management with automatic updates
     */
    static initialize() {
        // Apply overlap on initial load
        this.applyOverlapToAllZones();

        // Apply overlap when DOM changes (new cards added/removed)
        if (window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                
                mutations.forEach((mutation) => {
                    // Check if nodes were added or removed in relevant containers
                    if (mutation.type === 'childList') {
                        const target = mutation.target;
                        if (target.classList.contains('zone-content') ||
                            target.classList.contains('justify-center') ||
                            target.classList.contains('overflow-x-auto')) {
                            shouldUpdate = true;
                        }
                    }
                });

                if (shouldUpdate) {
                    // Debounce updates to avoid too frequent recalculations
                    clearTimeout(this.updateTimeout);
                    this.updateTimeout = setTimeout(() => {
                        this.applyOverlapToAllZones();
                    }, 100);
                }
            });

            // Observe the game board for changes
            const gameBoard = document.getElementById('game-board');
            if (gameBoard) {
                observer.observe(gameBoard, {
                    childList: true,
                    subtree: true
                });
            }
        }

        // Reapply overlap on window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.applyOverlapToAllZones();
            }, 250);
        });

        console.log('UICardOverlap initialized');
    }

    /**
     * Manually refresh overlap for all zones (useful after game state updates)
     */
    static refresh() {
        this.applyOverlapToAllZones();
    }

    /**
     * Get current overlap value for a zone
     */
    static getZoneOverlap(container) {
        if (!container) return 0;
        return parseInt(container.getAttribute('data-dynamic-overlap')) || 0;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        UICardOverlap.initialize();
    });
} else {
    UICardOverlap.initialize();
}

window.UICardOverlap = UICardOverlap;
