(function bootstrapUIRenderersTemplates() {
    if (typeof UIRenderersTemplatesComponent === 'undefined' || typeof UIRenderersTemplatesComponent.mount !== 'function') {
        console.error('[UIRenderersTemplates] component bundle is missing');
        return;
    }

    const target = document.body;
    if (!target) {
        return;
    }

    try {
        UIRenderersTemplatesComponent.mount(UIRenderersTemplatesComponent.default, {
            target
        });
    } catch (error) {
        console.error('[UIRenderersTemplates] failed to initialize', error);
    }
})();
