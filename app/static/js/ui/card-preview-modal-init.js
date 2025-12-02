(function bootstrapCardPreviewModal() {
    if (typeof CardPreviewModalComponent === 'undefined' || typeof CardPreviewModalComponent.mount !== 'function') {
        console.error('[CardPreviewModal] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        CardPreviewModalComponent.mount(CardPreviewModalComponent.default, {
            target
        });
    } catch (error) {
        console.error('[CardPreviewModal] failed to initialize', error);
    }
})();
