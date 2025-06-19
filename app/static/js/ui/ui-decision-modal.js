/**
 * ManaForge Decision Modal Module
 * Handles the modal for resolving Scry and Surveil actions.
 */

class DecisionModal {
    static modalElement = null;
    static decisions = [];
    static cards = [];
    static actionType = '';

    static initialize() {
        // The modal will be created on-demand
        console.log('Decision Modal initialized');
    }

    static show(actionType, cards) {
        // If the backend sends an empty list of cards, it means the action is over.
        if (!cards || cards.length === 0) {
            this.close();
            return;
        }

        this.actionType = actionType;
        this.cards = [...cards];
        
        // If the modal is not already open, create it.
        if (!this.modalElement) {
            this.decisions = []; // Reset decisions only when opening for the first time
            this.createModalElement();
            document.body.appendChild(this.modalElement);
            // Animate modal appearance
            setTimeout(() => {
                this.modalElement.classList.add('active');
            }, 10);
        }

        this.renderCards();
    }

    static close() {
        if (this.modalElement) {
            this.modalElement.classList.remove('active');
            setTimeout(() => {
                if (this.modalElement && this.modalElement.parentNode) {
                    this.modalElement.parentNode.removeChild(this.modalElement);
                }
                this.modalElement = null;
            }, 300);
        }
    }

    static createModalElement() {
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'zone-modal'; // Re-use existing class
        this.modalElement.innerHTML = `
            <div class="zone-modal-content">
                <div class="zone-modal-header">
                    <h2 class="zone-modal-title">${this.actionType.charAt(0).toUpperCase() + this.actionType.slice(1)}</h2>
                    <button class="zone-modal-close">&times;</button>
                </div>
                <p class="text-gray-400 text-center mb-4">Choose a destination for each card.</p>
                <div class="zone-cards-grid decision-cards-grid"></div>
                <div class="text-center mt-6">
                    <button id="decision-modal-add-one" class="btn btn-secondary bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded">
                        ${this.actionType === 'scry' ? 'Scry 1 more' : 'Surveil 1 more'}
                    </button>
                </div>
            </div>
        `;

        this.modalElement.querySelector('.zone-modal-close').addEventListener('click', () => this.cancel());
        this.modalElement.querySelector('#decision-modal-add-one').addEventListener('click', () => this.addOneMore());
    }

    static renderCards() {
        const cardsContainer = this.modalElement.querySelector('.decision-cards-grid');
        cardsContainer.innerHTML = '';

        this.cards.forEach(card => {
            // Don't render cards for which a decision has already been made
            if (this.decisions.some(d => d.card_id === card.id)) {
                return;
            }

            const cardEl = document.createElement('div');
            cardEl.className = 'zone-card-item';
            cardEl.dataset.cardId = card.id;

            const cardImage = `<img src="${card.image_url || '/static/images/card-back.jpg'}" alt="${card.name}" class="w-full rounded-lg mb-2">`;
            
            const scryButtons = `
                <div class="decision-buttons">
                    <button class="btn btn-secondary w-full bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded" data-destination="top">Top</button>
                    <button class="btn btn-secondary w-full bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded" data-destination="bottom">Bottom</button>
                </div>`;
            
            const surveilButtons = `
                <div class="decision-buttons">
                    <button class="btn btn-secondary btn-sm w-full mb-1 bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded" data-destination="top">Top</button>
                    <button class="btn btn-danger btn-sm w-full bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded" data-destination="graveyard">Graveyard</button>
                </div>`;

            cardEl.innerHTML = `
                ${cardImage}
                <div class="zone-card-name">${card.name}</div>
                <div class="decision-card-actions mt-2">
                    ${this.actionType === 'scry' ? scryButtons : surveilButtons}
                </div>
            `;

            cardEl.querySelectorAll('.decision-buttons button').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const destination = e.target.dataset.destination;
                    this.makeDecision(card.id, destination, cardEl);
                });
            });

            cardsContainer.appendChild(cardEl);
        });
    }

    static makeDecision(cardId, destination, cardElement) {
        const existingDecision = this.decisions.find(d => d.card_id === cardId);
        if (!existingDecision) {
            this.decisions.push({ card_id: cardId, destination: destination });
        }

        // Remove the card from view
        cardElement.remove();

        // Check if all cards from the initial set have been decided
        const remainingCards = this.modalElement.querySelector('.decision-cards-grid').children.length;
        if (remainingCards === 0) {
            this.confirmDecisions();
        }
    }

    static confirmDecisions() {
        if (this.decisions.length > 0) {
            if (window.GameActions && window.GameActions.performGameAction) {
                window.GameActions.performGameAction('resolve_temporary_zone', { decisions: this.decisions });
                UINotifications.showNotification(`Resolving ${this.actionType}...`, 'info');
            } else {
                console.error('GameActions not available to resolve temporary zone.');
                UINotifications.showNotification('Action could not be performed.', 'error');
            }
        }
        this.close();
        this.decisions = []; // Clear decisions after confirming
    }

    static addOneMore() {
        // This action needs to be implemented on the backend.
        // It should add a card to the player's temporary zone and trigger a state update.
        if (window.GameActions && window.GameActions.performGameAction) {
            // The action_type for the endpoint is 'add_to_temporary_zone'.
            // The actual keyword (scry/surveil) is passed in the payload as 'action_name'.
            window.GameActions.performGameAction('add_to_temporary_zone', { action_name: this.actionType, count: 1 });
        } else {
            console.error('GameActions not available for add_to_temporary_zone.');
            UINotifications.showNotification('Action could not be performed.', 'error');
        }
    }
    
    static cancel() {
        // If user closes the modal, we need to resolve with default actions.
        // Let's assume putting all remaining cards to the bottom is the default.
        const remainingCardElements = this.modalElement.querySelectorAll('.zone-card-item');
        remainingCardElements.forEach(cardEl => {
            const cardId = cardEl.dataset.cardId;
            if (!this.decisions.some(d => d.card_id === cardId)) {
                this.decisions.push({ card_id: cardId, destination: 'bottom' });
            }
        });
        this.confirmDecisions();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        DecisionModal.initialize();
    });
} else {
    DecisionModal.initialize();
}

window.DecisionModal = DecisionModal;
