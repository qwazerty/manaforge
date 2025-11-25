<script lang="ts">
    import { tick } from 'svelte';

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
        props.onConfirm?.({ decisions: [...decisions] });
        notifyClose();
    }

    function addOneMoreCard() {
        props.onAddOneMore?.({ actionType });
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
                                <div class="decision-card-actions mt-2 space-y-2">
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
