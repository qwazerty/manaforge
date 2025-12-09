<script>
    import { onMount, onDestroy } from 'svelte';

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

    let observer = $state(null);

    const isScrollableZone = (element) => {
        const scrollableClasses = [
            'creatures-zone-content',
            'support-zone-content',
            'lands-zone-content',
            'hand-zone-content',
            'zone-content',
            'reveal-card-list'
        ];

        return (
            scrollableClasses.some((className) => element.classList?.contains(className)) ||
            (element.classList?.contains('overflow-x-auto') && !element.classList?.contains('overflow-y-auto'))
        );
    };

    const calculateScrollAmount = (event) => {
        const baseScrollAmount = 100;
        if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
            return event.deltaY * 0.8;
        }
        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
            return event.deltaY * 20;
        }
        if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
            return event.deltaY * baseScrollAmount * 3;
        }
        return event.deltaY > 0 ? baseScrollAmount : -baseScrollAmount;
    };

    const addScrollFeedback = (element) => {
        element.classList.add('scrolling-active');
        setTimeout(() => {
            element.classList.remove('scrolling-active');
        }, 150);
    };

    const attachWheelListener = (element) => {
        if (!element || element.dataset.horizontalScrollEnabled === 'true') {
            return;
        }

        element.addEventListener(
            'wheel',
            (event) => {
                if (element.scrollWidth <= element.clientWidth) {
                    return;
                }
                event.preventDefault();
                const scrollAmount = calculateScrollAmount(event);
                element.scrollBy({ left: scrollAmount, behavior: 'auto' });
                addScrollFeedback(element);
            },
            { passive: false }
        );

        element.dataset.horizontalScrollEnabled = 'true';
    };

    const attachScrollListeners = () => {
        horizontalZoneSelectors.forEach((selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element) => attachWheelListener(element));
        });
    };

    const setupMutationObserver = () => {
        observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    const element = /** @type {Element} */ (node);
                    if (isScrollableZone(element)) {
                        attachWheelListener(element);
                    }
                    const nested = element.querySelectorAll?.(
                        '.creatures-zone-content, .support-zone-content, .lands-zone-content, .hand-zone-content, .reveal-card-list, .zone-content, .zone-cards-slider, .zone-cards-grid, .overflow-x-auto'
                    );
                    nested?.forEach((zone) => attachWheelListener(zone));
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    };

    const refresh = () => {
        document.querySelectorAll('[data-horizontal-scroll-enabled="true"]').forEach((element) => {
            delete element.dataset.horizontalScrollEnabled;
        });
        attachScrollListeners();
    };

    onMount(() => {
        attachScrollListeners();
        setupMutationObserver();

        window.UIHorizontalScroll = {
            attachWheelListener,
            refresh
        };

        return () => {
            observer?.disconnect();
        };
    });

    onDestroy(() => {
        observer?.disconnect();
    });
</script>
