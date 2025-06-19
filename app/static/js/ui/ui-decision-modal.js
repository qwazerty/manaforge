/**
 * ManaForge Decision Modal Module
 * Handles the modal for resolving Scry and Surveil actions.
 */

class DecisionModal {
    static modalElement = null;
    static decisions = [];
    static actionType = '';

    static initialize() {
        // The modal will be created on-demand
        console.log('Decision Modal initialized');
    }

    static show(actionType, cards) {
        this.actionType = actionType;
        this.cards = [...cards];
        this.decisions = [];

        if (this.modalElement) {
            this.close();
        }

        this.createModalElement();
        document.body.appendChild(this.modalElement);

        this.renderCards();

        // Animate modal appearance
        setTimeout(() => {
            this.modalElement.classList.add('active');
        }, 10);
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
                    <h2 class="zone-modal-title">${this.actionType === 'scry' ? 'Scry' : 'Surveil'}</h2>
                    <button class="zone-modal-close">&times;</button>
                </div>
                <p class="text-gray-400 text-center mb-4">Choose a destination for each card.</p>
                <div class="zone-cards-grid decision-cards-grid"></div>
                <div class="text-center mt-6">
                    <button id="decision-modal-confirm" class="btn btn-primary bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded" disabled>Confirm Decisions</button>
                </div>
            </div>
        `;

        this.modalElement.querySelector('.zone-modal-close').addEventListener('click', () => this.close());
        this.modalElement.querySelector('#decision-modal-confirm').addEventListener('click', () => this.confirmDecisions());
    }

    static renderCards() {
        const cardsContainer = this.modalElement.querySelector('.decision-cards-grid');
        cardsContainer.innerHTML = '';

        this.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'zone-card-item'; // Combine classes
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
                    e.stopPropagation(); // Prevent modal from closing if clicked inside
                    const destination = e.target.dataset.destination;
                    this.makeDecision(card.id, destination, cardEl);
                });
            });

            cardsContainer.appendChild(cardEl);
        });
    }

    static makeDecision(cardId, destination, cardElement) {
        const existingDecision = this.decisions.find(d => d.card_id === cardId);
        if (existingDecision) {
            existingDecision.destination = destination;
        } else {
            this.decisions.push({ card_id: cardId, destination: destination });
        }

        // Visual feedback
        cardElement.style.borderColor = '#7289da';
        cardElement.style.boxShadow = '0 0 15px rgba(114, 137, 218, 0.5)';
        
        cardElement.querySelectorAll('.decision-buttons button').forEach(btn => {
            btn.classList.remove('bg-green-500', 'text-white');
        });
        const selectedButton = cardElement.querySelector(`[data-destination="${destination}"]`);
        selectedButton.classList.add('bg-green-500', 'text-white');

        if (this.decisions.length === this.cards.length) {
            this.modalElement.querySelector('#decision-modal-confirm').disabled = false;
        }
    }

    static confirmDecisions() {
        if (this.decisions.length !== this.cards.length) {
            UINotifications.showNotification('You must make a decision for all cards.', 'warning');
            return;
        }

        if (window.GameActions && window.GameActions.performGameAction) {
            window.GameActions.performGameAction('resolve_temporary_zone', { decisions: this.decisions });
            UINotifications.showNotification(`Resolving ${this.actionType}...`, 'info');
        } else {
            console.error('GameActions not available to resolve temporary zone.');
            UINotifications.showNotification('Action could not be performed.', 'error');
        }

        this.close();
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
