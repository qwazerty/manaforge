/**
 * ManaForge UI Horizontal Scroll Module
 * Enables mouse wheel scrolling on horizontal scrollable zones
 */

class UIHorizontalScroll {
    /**
     * Initialize horizontal scroll functionality for all zones
     */
    static init() {
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.attachScrollListeners();
            });
        } else {
            this.attachScrollListeners();
        }
    }

    /**
     * Attach wheel event listeners to all horizontal scrollable zones
     */
    static attachScrollListeners() {
        // Define selectors for horizontal scrollable zones
        const horizontalZoneSelectors = [
            '.creatures-zone-content',
            '.support-zone-content',
            '.lands-zone-content', 
            '.hand-zone-content',
            '.reveal-card-list',
            '.zone-content',
            '.battlefield-zone .flex.overflow-x-auto',
            '.opponent-hand .flex.overflow-x-auto',
            '.zone-cards-slider',
            '.zone-cards-grid',
            '.overflow-x-auto'
        ];

        // Attach listeners to existing elements
        horizontalZoneSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                this.attachWheelListener(element);
            });
        });

        // Set up mutation observer to handle dynamically added zones
        this.setupMutationObserver();
    }

    /**
     * Attach wheel event listener to a specific element
     * @param {HTMLElement} element - The element to attach the listener to
     */
    static attachWheelListener(element) {
        // Avoid duplicate listeners
        if (element.dataset.horizontalScrollEnabled === 'true') {
            return;
        }

        element.addEventListener('wheel', (e) => {
            // Only handle horizontal scrolling if element actually has horizontal overflow
            if (element.scrollWidth <= element.clientWidth) {
                return;
            }

            // Prevent default vertical scrolling
            e.preventDefault();

            // Calculate scroll amount based on wheel delta
            const scrollAmount = this.calculateScrollAmount(e);
            
            // Apply horizontal scroll
            element.scrollBy({
                left: scrollAmount,
                behavior: 'auto'
            });

            // Add visual feedback
            this.addScrollFeedback(element);
        }, { passive: false });

        // Mark as enabled to avoid duplicate listeners
        element.dataset.horizontalScrollEnabled = 'true';
    }

    /**
     * Calculate scroll amount based on wheel event
     * @param {WheelEvent} e - The wheel event
     * @returns {number} - Scroll amount in pixels
     */
    static calculateScrollAmount(e) {
        // Base scroll amount (adjust as needed)
        const baseScrollAmount = 100;
        
        // Handle different wheel delta modes
        let scrollAmount = 0;
        
        if (e.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
            // Pixel mode - use deltaY directly but scale it for horizontal
            scrollAmount = e.deltaY * 0.8;
        } else if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            // Line mode - multiply by line height
            scrollAmount = e.deltaY * 20;
        } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
            // Page mode - multiply by page size
            scrollAmount = e.deltaY * baseScrollAmount * 3;
        } else {
            // Fallback
            scrollAmount = e.deltaY > 0 ? baseScrollAmount : -baseScrollAmount;
        }

        return scrollAmount;
    }

    /**
     * Add visual feedback when scrolling
     * @param {HTMLElement} element - The scrolled element
     */
    static addScrollFeedback(element) {
        // Add temporary highlight to show scroll activity
        element.classList.add('scrolling-active');
        
        // Remove highlight after animation
        setTimeout(() => {
            element.classList.remove('scrolling-active');
        }, 150);
    }

    /**
     * Setup mutation observer to handle dynamically added zones
     */
    static setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node itself is a scrollable zone
                        if (this.isHorizontalScrollableZone(node)) {
                            this.attachWheelListener(node);
                        }
                        
                        // Check for scrollable zones within the added node
                        const scrollableZones = node.querySelectorAll && node.querySelectorAll('.creatures-zone-content, .support-zone-content, .lands-zone-content, .hand-zone-content, .reveal-card-list, .zone-content, .zone-cards-slider, .zone-cards-grid, .overflow-x-auto');
                        if (scrollableZones) {
                            scrollableZones.forEach(zone => {
                                this.attachWheelListener(zone);
                            });
                        }
                    }
                });
            });
        });

        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Check if an element is a horizontal scrollable zone
     * @param {HTMLElement} element - Element to check
     * @returns {boolean} - True if it's a horizontal scrollable zone
     */
    static isHorizontalScrollableZone(element) {
        const scrollableClasses = [
            'creatures-zone-content',
            'support-zone-content',
            'lands-zone-content',
            'hand-zone-content', 
            'zone-content',
            'reveal-card-list'
        ];
        
        return scrollableClasses.some(className => 
            element.classList && element.classList.contains(className)
        ) || (
            element.classList && 
            element.classList.contains('overflow-x-auto') &&
            !element.classList.contains('overflow-y-auto')
        );
    }

    /**
     * Manually refresh listeners (useful after major DOM updates)
     */
    static refresh() {
        // Remove existing markers
        document.querySelectorAll('[data-horizontal-scroll-enabled="true"]').forEach(element => {
            delete element.dataset.horizontalScrollEnabled;
        });
        
        // Reattach listeners
        this.attachScrollListeners();
    }
}

// Auto-initialize when script loads
UIHorizontalScroll.init();

// Make available globally
window.UIHorizontalScroll = UIHorizontalScroll;
