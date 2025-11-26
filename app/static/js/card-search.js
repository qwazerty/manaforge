(function () {
    const host = document.createElement('div');
    host.id = 'card-search-root';
    document.body.appendChild(host);

    let component = null;
    let submitHandler = null;

    function mountComponent() {
        if (!document.body.contains(host)) {
            document.body.appendChild(host);
        }

        if (component && typeof component.$destroy === 'function') {
            component.$destroy();
            component = null;
        }

        if (typeof CardSearchModalComponent === 'undefined') {
            console.error('[card-search] CardSearchModalComponent is not available');
            return null;
        }

        const mount = typeof CardSearchModalComponent.mount === 'function'
            ? CardSearchModalComponent.mount
            : null;

        if (!mount) {
            console.error('[card-search] Unable to mount CardSearchModalComponent');
            return null;
        }

        component = mount(CardSearchModalComponent.default, {
            target: host,
            props: {
                open: false,
                targetZone: 'hand',
                submitHandler,
                onClose: () => {
                    // Keep external state in sync when the modal closes itself
                    api._open = false;
                }
            }
        });

        return component;
    }

    const api = {
        _open: false,

        show(targetZone = 'hand') {
            const instance = mountComponent();
            if (!instance) {
                return;
            }
            this._open = true;
            instance.$set({
                open: true,
                targetZone,
                submitHandler
            });
        },

        hide() {
            if (!component) {
                return;
            }
            this._open = false;
            component.$set({ open: false });
        },

        setSubmitHandler(handler) {
            submitHandler = typeof handler === 'function' ? handler : null;
            if (component) {
                component.$set({ submitHandler });
            }
        }
    };

    window.CardSearchModal = api;
    window.showCardSearch = (targetZone = 'hand') => api.show(targetZone);
    window.hideCardSearch = () => api.hide();
})();
