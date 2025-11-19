<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';

    type DecisionDestination = 'top' | 'bottom' | 'graveyard';

    interface CardEntry {
        id: string;
        name: string;
        image_url?: string;
    }

    interface DecisionEntry {
        card_id: string;
        destination: DecisionDestination;
    }

    const props = $props<{
        open?: boolean;
        actionType?: 'scry' | 'surveil' | string;
        cards?: CardEntry[];
        onConfirm?: (detail: { decisions: DecisionEntry[] }) => void;
        onAddOneMore?: (detail: { actionType: string }) => void;
        onClose?: () => void;
    }>();

    const open = $derived(Boolean(props.open));
    const actionType = $derived(props.actionType ?? 'scry');
    const cards = $derived(props.cards ?? []);

    const dispatch = createEventDispatcher();

    let decisions = $state<DecisionEntry[]>([]);
    let isActive = $state(false);
    let lastCardSignature = $state('');

    const readableAction = (value: string) => {
        if (!value) {
            return '';
        }
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    const resolveButtonCopy = () => actionType === 'surveil' ? 'Surveil 1 more' : 'Scry 1 more';

    const cardSignature = (input: CardEntry[]) => input.map((card) => card?.id ?? '').join('|');

    const cardsChanged = $derived(cardSignature(cards));

    $effect(() => {
        if (open && cardsChanged !== lastCardSignature) {
            lastCardSignature = cardsChanged;
            decisions = [];
            activateModal();
        }
    });

    $effect(() => {
        if (!open) {
            isActive = false;
            decisions = [];
            lastCardSignature = '';
        }
    });

    async function activateModal() {
        await tick();
        isActive = true;
    }

    const remainingCards = () => {
        const decidedIds = new Set(decisions.map((entry) => entry.card_id));
        return cards.filter((card) => card && !decidedIds.has(card.id));
    };

    function selectDestination(cardId: string, destination: DecisionDestination) {
        if (!cardId || !destination) {
            return;
        }
        if (decisions.some((entry) => entry.card_id === cardId)) {
            return;
        }
        decisions = [...decisions, { card_id: cardId, destination }];

        if (decisions.length >= cards.length) {
            confirmDecisions();
        }
    }

    function confirmDecisions() {
        if (!decisions.length) {
            return;
        }
        const detail = { decisions: [...decisions] };
        props.onConfirm?.(detail);
        dispatch('confirm', detail);
        notifyClose();
    }

    function addOneMoreCard() {
        props.onAddOneMore?.({ actionType });
        dispatch('addOneMore', { actionType });
    }

    function closeWithDefaults() {
        if (!cards.length) {
            notifyClose();
            return;
        }
        const decidedIds = new Set(decisions.map((entry) => entry.card_id));
        const fallbackDestination: DecisionDestination = actionType === 'surveil' ? 'graveyard' : 'bottom';
        const fallbackDecisions = cards
            .filter((card) => card && !decidedIds.has(card.id))
            .map((card) => ({ card_id: card.id, destination: fallbackDestination }));

        if (fallbackDecisions.length) {
            decisions = [...decisions, ...fallbackDecisions];
        }

        if (decisions.length) {
            confirmDecisions();
            return;
        }
        notifyClose();
    }

    function notifyClose() {
        props.onClose?.();
        dispatch('close');
    }

    const buttonVariants: Record<string, Array<{ destination: DecisionDestination; label: string; accent?: 'danger' }>> = {
        scry: [
            { destination: 'top', label: 'Top' },
            { destination: 'bottom', label: 'Bottom' }
        ],
        surveil: [
            { destination: 'top', label: 'Top' },
            { destination: 'graveyard', label: 'Graveyard', accent: 'danger' }
        ]
    };

    const getButtons = () => buttonVariants[actionType] || buttonVariants.scry;
</script>

{#if open}
    <div class={`zone-modal${isActive ? ' active' : ''}`} role="dialog" aria-modal="true" aria-label={`${readableAction(actionType)} modal`}>
        <div class="zone-modal-content">
            <div class="zone-modal-header">
                <h2 class="zone-modal-title">{readableAction(actionType)}</h2>
                <button class="zone-modal-close" type="button" onclick={closeWithDefaults} aria-label="Close modal">
                    &times;
                </button>
            </div>

            <p class="text-gray-400 text-center mb-4">Choose a destination for each card.</p>

            <div class="zone-cards-container">
                {#if remainingCards().length === 0}
                    <div class="text-center text-arena-text-dim py-8">
                        All cards decided. Resolving...
                    </div>
                {:else}
                    <div class="zone-cards-slider">
                        {#each remainingCards() as card (card.id)}
                            <div class="zone-card-slider-item" data-card-id={card.id}>
                                <img src={card.image_url || '/static/images/card-back.jpg'} alt={card.name} class="card-mini" />
                                <div class="zone-card-name">{card.name}</div>
                                <div class="decision-card-actions mt-2">
                                    {#each getButtons() as button}
                                        <button
                                            type="button"
                                            class={`btn btn-secondary w-full bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded${button.accent === 'danger' ? ' text-red-200 border-red-500/50' : ''}`}
                                            onclick={() => selectDestination(card.id, button.destination)}>
                                            {button.label}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="text-center mt-6">
                <button
                    id="decision-modal-add-one"
                    class="btn btn-secondary bg-arena-surface hover:bg-arena-surface-light border text-arena-text p-2 rounded"
                    type="button"
                    onclick={addOneMoreCard}>
                    {resolveButtonCopy()}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .zone-modal {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.65);
        z-index: 60;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .zone-modal.active {
        opacity: 1;
    }

    .zone-modal-content {
        width: min(640px, 90vw);
        max-height: 88vh;
        overflow-y: auto;
        background: #0f172a;
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 0.75rem;
        padding: 1.75rem;
        box-shadow: 0 10px 35px rgba(15, 23, 42, 0.7);
        transform: translateY(12px);
        transition: transform 0.2s ease;
    }

    .zone-modal.active .zone-modal-content {
        transform: translateY(0);
    }

    .zone-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
    }

    .zone-modal-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #cbd5f5;
    }

    .zone-modal-close {
        border: none;
        background: transparent;
        color: #f87171;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
    }

    .zone-cards-slider {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 1rem;
    }

    .zone-card-slider-item {
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 0.5rem;
        padding: 0.75rem;
        text-align: center;
        background: rgba(15, 23, 42, 0.6);
    }

    .zone-card-name {
        font-size: 0.95rem;
        font-weight: 500;
        margin-top: 0.5rem;
        color: #f1f5f9;
    }

    .decision-card-actions button + button {
        margin-top: 0.5rem;
    }
</style>
