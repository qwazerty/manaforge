<script>
    import { onMount } from 'svelte';

    /**
     * ManaForge Card Preview Modal
     * Displays a larger card preview on hover with keyword descriptions
     * Migrated from game-cards.js hover preview system
     */

    const CARD_BACK_IMAGE = '/static/images/card-back.jpg';

    // Reactive state
    let isOpen = $state(false);
    let cardData = $state(null);
    let imageUrl = $state('');
    let cardName = $state('');
    let position = $state({ x: 0, y: 0 });
    let isCentered = $state(false);

    // Internal tracking
    let previewElement = $state(null);
    let hoveredCardElement = null;
    let contextMenuOpen = false;
    let hoverInitialized = false;

    // Keyword descriptions database
    const keywordDescriptions = {
        "adapt":{"name":"Adapt","description":"If this creature has no +1/+1 counters on it, put N +1/+1 counters on it."},
        "islandwalk":{"name":"Islandwalk","description":"This creature can't be blocked as long as defending player controls an Island."},
        "mountainwalk":{"name":"Mountainwalk","description":"This creature can't be blocked as long as defending player controls a Mountain."},
        "plainswalk":{"name":"Plainswalk","description":"This creature can't be blocked as long as defending player controls a Plains."},
        "swampwalk":{"name":"Swampwalk","description":"This creature can't be blocked as long as defending player controls a Swamp."},
        "forestwalk":{"name":"Forestwalk","description":"This creature can't be blocked as long as defending player controls a Forest."},
        "affinity":{"name":"Affinity","description":"This spell costs {1} less to cast for each [quality] you control."},
        "afflict":{"name":"Afflict","description":"Whenever this creature becomes blocked, defending player loses N life."},
        "afterlife":{"name":"Afterlife","description":"When this creature dies, create N 1/1 white and black Spirit creature tokens with flying."},
        "aftermath":{"name":"Aftermath","description":"You may cast this half of the split card only from your graveyard; then exile it."},
        "alliance":{"name":"Alliance","description":"Triggers whenever another creature enters the battlefield under your control."},
        "amass":{"name":"Amass","description":"Put N +1/+1 counters on an Army you control. If you don't control one, create a 0/0 black Army creature token first."},
        "annihilator":{"name":"Annihilator","description":"Whenever this creature attacks, defending player sacrifices N permanents."},
        "backup":{"name":"Backup","description":"When this creature enters, put a +1/+1 counter on target creature. If it's another creature, it gains the listed abilities until end of turn."},
        "bargain":{"name":"Bargain","description":"As you cast this spell, you may sacrifice an artifact, enchantment, or token for an additional effect."},
        "battalion":{"name":"Battalion","description":"Triggers when this and at least two other creatures attack."},
        "battle cry":{"name":"Battle cry","description":"Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn."},
        "bestow":{"name":"Bestow","description":"You may cast this card as an Aura with enchant creature for its bestow cost; if the creature leaves, it stops being an Aura."},
        "blitz":{"name":"Blitz","description":"You may cast this creature for its blitz cost. It gains haste and \"When this creature dies, draw a card.\" Sacrifice it at the beginning of the next end step."},
        "cascade":{"name":"Cascade","description":"When you cast this spell, exile cards from the top of your library until you exile a nonland card with lesser mana value. You may cast it without paying its mana cost; put the exiled cards on the bottom in a random order."},
        "changeling":{"name":"Changeling","description":"This card is every creature type."},
        "connive":{"name":"Connive","description":"Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature."},
        "convoke":{"name":"Convoke","description":"Your creatures can help cast this spell. Each creature you tap while casting it pays for {1} or one mana of that creature's color."},
        "crew":{"name":"Crew","description":"Crew N: Tap any number of creatures you control with total power N or more: This Vehicle becomes an artifact creature until end of turn."},
        "dash":{"name":"Dash","description":"You may cast this spell for its dash cost. If you do, it gains haste and it's returned to its owner's hand at the beginning of the next end step."},
        "deathtouch":{"name":"Deathtouch","description":"Any amount of damage this creature deals to a creature is enough to destroy it."},
        "defender":{"name":"Defender","description":"This creature can't attack."},
        "delve":{"name":"Delve","description":"Each card you exile from your graveyard while casting this spell pays for {1}."},
        "disturb":{"name":"Disturb","description":"You may cast this card transformed from your graveyard for its disturb cost. If it would be put into a graveyard from anywhere, exile it instead."},
        "double strike":{"name":"Double strike","description":"This creature deals both first-strike and regular combat damage."},
        "embalm":{"name":"Embalm","description":"Exile this creature card from your graveyard: Create a token copy except it's white and a Zombie; activate only as a sorcery."},
        "emerge":{"name":"Emerge","description":"You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana value."},
        "encore":{"name":"Encore","description":"Exile this card from your graveyard for its encore cost: For each opponent, create a token copy that attacks that player this turn if able; sacrifice the tokens at end of combat."},
        "equip":{"name":"Equip","description":"Equip [cost]: Attach this Equipment to target creature you control. Activate only as a sorcery."},
        "escape":{"name":"Escape","description":"You may cast this card from your graveyard by paying its escape cost and exiling other cards from your graveyard."},
        "evoke":{"name":"Evoke","description":"You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters the battlefield."},
        "evolve":{"name":"Evolve","description":"Whenever a creature enters the battlefield under your control with greater power or toughness, put a +1/+1 counter on this creature."},
        "exalted":{"name":"Exalted","description":"Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn."},
        "exploit":{"name":"Exploit","description":"When this creature enters the battlefield, you may sacrifice a creature. If you do, you get the listed effect."},
        "explore":{"name":"Explore","description":"Reveal the top card of your library. If it's a land, put it into your hand; otherwise put a +1/+1 counter on this creature, then you may put that card into your graveyard."},
        "extort":{"name":"Extort","description":"Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life."},
        "fabricate":{"name":"Fabricate","description":"When this creature enters, put N +1/+1 counters on it or create N 1/1 colorless Servo artifact creature tokens."},
        "fear":{"name":"Fear","description":"This creature can be blocked only by artifact creatures and/or black creatures."},
        "first strike":{"name":"First strike","description":"This creature deals combat damage before creatures without first strike."},
        "flash":{"name":"Flash","description":"You may cast this spell any time you could cast an instant."},
        "flashback":{"name":"Flashback","description":"You may cast this card from your graveyard for its flashback cost; then exile it."},
        "flying":{"name":"Flying","description":"Creatures with flying can only be blocked by creatures with flying or reach."},
        "foretell":{"name":"Foretell","description":"During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost."},
        "haste":{"name":"Haste","description":"This creature can attack and activate abilities with {T} or {Q} as soon as it comes under your control."},
        "hexproof":{"name":"Hexproof","description":"This permanent can't be the target of spells or abilities your opponents control."},
        "indestructible":{"name":"Indestructible","description":"Effects that say \"destroy\" don't destroy this permanent, and lethal damage doesn't destroy it."},
        "infect":{"name":"Infect","description":"This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters."},
        "investigate":{"name":"Investigate","description":"Create a Clue token with \"{2}, Sacrifice this artifact: Draw a card.\""},
        "kicker":{"name":"Kicker","description":"You may pay an additional cost as you cast this spell for an extra effect."},
        "landfall":{"name":"Landfall","description":"Triggers when a land enters under your control."},
        "lifelink":{"name":"Lifelink","description":"Damage dealt by this creature also causes you to gain that much life."},
        "madness":{"name":"Madness","description":"If you discard this card, discard it into exile. You may cast it for its madness cost."},
        "menace":{"name":"Menace","description":"This creature can't be blocked except by two or more creatures."},
        "mentor":{"name":"Mentor","description":"Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power."},
        "mill":{"name":"Mill","description":"Put the top N cards of a library into its owner's graveyard."},
        "morph":{"name":"Morph","description":"You may cast this card face down as a 2/2 for {3}. Turn it face up any time for its morph cost."},
        "mutate":{"name":"Mutate","description":"If you cast this spell for its mutate cost, put it over or under target non-Human creature you own; they become one creature with the top card's characteristics and all abilities of both."},
        "ninjutsu":{"name":"Ninjutsu","description":"{cost}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking."},
        "partner":{"name":"Partner","description":"You can have two commanders if both have partner."},
        "persist":{"name":"Persist","description":"When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter."},
        "plot":{"name":"Plot","description":"You may pay the plot cost and exile this card from your hand as a sorcery. Cast it on a later turn without paying its mana cost."},
        "populate":{"name":"Populate","description":"Create a token that's a copy of a creature token you control."},
        "proliferate":{"name":"Proliferate","description":"Choose any number of permanents and/or players with counters; give each another counter of a kind already there."},
        "protection":{"name":"Protection","description":"Protection from [quality]: It can't be targeted, dealt damage, enchanted/equipped, or blocked by anything with that quality."},
        "prowess":{"name":"Prowess","description":"Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn."},
        "raid":{"name":"Raid","description":"Bonus if you attacked with a creature this turn."},
        "reach":{"name":"Reach","description":"This creature can block creatures with flying."},
        "rebound":{"name":"Rebound","description":"If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, cast it from exile without paying its mana cost."},
        "scry":{"name":"Scry","description":"Scry N: Look at the top N cards of your library; put any number on the bottom and the rest on top in any order."},
        "shroud":{"name":"Shroud","description":"This permanent can't be the target of any spells or abilities."},
        "skulk":{"name":"Skulk","description":"This creature can't be blocked by creatures with greater power."},
        "storm":{"name":"Storm","description":"When you cast this spell, copy it for each spell cast before it this turn; you may choose new targets."},
        "surveil":{"name":"Surveil","description":"Surveil N: Look at the top N cards of your library; you may put any number into your graveyard and the rest back on top in any order."},
        "suspend":{"name":"Suspend","description":"Rather than cast this card from your hand, you may pay its suspend cost and exile it with N time counters; cast it when the last is removed."},
        "toxic":{"name":"Toxic","description":"Players dealt combat damage by this creature also get N poison counters."},
        "trample":{"name":"Trample","description":"Excess combat damage this creature deals to a blocker is dealt to the defending player, planeswalker, or battle."},
        "transform":{"name":"Transform","description":"Turn a double-faced card to its other face if instructed to transform."},
        "undying":{"name":"Undying","description":"When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter."},
        "unearth":{"name":"Unearth","description":"Return this card from your graveyard to the battlefield. It gains haste. Exile it at the next end step or if it would leave the battlefield."},
        "vigilance":{"name":"Vigilance","description":"Attacking doesn't cause this creature to tap."},
        "ward":{"name":"Ward","description":"Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost."},
        "wither":{"name":"Wither","description":"This creature deals damage to creatures in the form of -1/-1 counters."},
    };

    // Computed values
    const keywords = $derived(extractKeywordsFromCard(cardData));
    const hasKeywords = $derived(keywords && keywords.length > 0);

    // ===== HELPER FUNCTIONS =====
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function extractKeywordsFromCard(card) {
        if (!card) return [];

        const keywordSet = new Set();
        const gatherKeywords = (collection) => {
            if (!Array.isArray(collection)) return;
            collection.forEach(keyword => {
                if (keyword) {
                    keywordSet.add(String(keyword).toLowerCase());
                }
            });
        };

        gatherKeywords(card.keywords);
        gatherKeywords(card.custom_keywords || card.customKeywords);

        const textFragments = [];
        const pushText = (value) => {
            if (value) textFragments.push(String(value));
        };

        pushText(card.oracle_text || card.text);
        pushText(card.type_line || card.typeLine);

        if (Array.isArray(card.card_faces)) {
            card.card_faces.forEach(face => {
                gatherKeywords(face?.keywords);
                pushText(face?.oracle_text || face?.text);
            });
        }

        const fullText = textFragments.join('\n');
        const normalizedText = fullText.toLowerCase();
        const found = [];
        const seen = new Set();

        const buildRegex = (keyword) => {
            const escaped = String(keyword)
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');
            return new RegExp(`\\b${escaped}\\b`, 'i');
        };

        Object.entries(keywordDescriptions).forEach(([key, info]) => {
            if (seen.has(key)) return;

            const names = [info.name, key];
            let matched = names.some(name => keywordSet.has(String(name).toLowerCase()));

            if (!matched && normalizedText) {
                matched = names.some(name => buildRegex(name).test(fullText));
            }

            if (matched) {
                const keywordInfo = { ...info };

                // Dynamic ward cost description
                if (key === 'ward') {
                    const match = fullText.match(/Ward\s*(?:—|-)?\s*({[^}]+}|[^\n]+)/i);
                    if (match) {
                        const rawCost = (match[1] || match[0] || '').replace(/Ward/i, '').replace(/—|-/g, '').trim();
                        const wardCost = rawCost.length ? rawCost : 'cost';
                        keywordInfo.description = `Ward — ${wardCost} (Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.)`;
                    }
                }

                // Dynamic equip cost description
                if (key === 'equip') {
                    const match = fullText.match(/Equip\s*({[^}]+})/i);
                    if (match) {
                        keywordInfo.description = `Equip ${match[1]} — Attach this Equipment to target creature you control. Activate only as a sorcery.`;
                    }
                }

                found.push(keywordInfo);
                names.forEach(name => seen.add(String(name).toLowerCase()));
                seen.add(key);
            }
        });

        // Add custom keywords not in our database
        keywordSet.forEach(keyword => {
            const normalized = String(keyword).toLowerCase();
            if (seen.has(normalized)) return;

            const displayName = String(keyword)
                .split(/\s+/)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');

            found.push({
                name: displayName,
                description: `Description for ${displayName} is not yet available.`
            });
            seen.add(normalized);
        });

        return found;
    }

    function findCardDataInDom(cardId, cardNameValue) {
        const nodes = Array.from(document.querySelectorAll('[data-card-data]'));
        const parse = (raw) => {
            if (!raw) return null;
            try {
                return JSON.parse(
                    raw.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                );
            } catch {
                return null;
            }
        };

        if (cardId) {
            const byId = nodes.find(el => el.getAttribute('data-card-id') === cardId);
            if (byId) {
                const data = parse(byId.getAttribute('data-card-data'));
                if (data) return data;
            }
        }

        if (cardNameValue) {
            const byName = nodes.find(el => el.getAttribute('data-card-name') === cardNameValue);
            if (byName) {
                const data = parse(byName.getAttribute('data-card-data'));
                if (data) return data;
            }
        }

        return null;
    }

    // ===== PUBLIC API =====
    function show(cardId, cardNameValue, cardImage, event = null, cardDataParam = null) {
        const resolvedCardData = cardDataParam || findCardDataInDom(cardId, cardNameValue);
        
        cardData = resolvedCardData;
        cardName = cardNameValue || 'Unknown';
        imageUrl = cardImage || '';
        
        const hasPointerPosition = event && typeof event.clientX === 'number' && typeof event.clientY === 'number';
        if (hasPointerPosition) {
            isCentered = false;
            position = { x: event.clientX, y: event.clientY };
        } else {
            isCentered = true;
            position = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }

        isOpen = true;
    }

    function hide() {
        isOpen = false;
        cardData = null;
        hoveredCardElement = null;
    }

    function updatePosition(event) {
        if (!isOpen || !previewElement || isCentered) return;
        
        const rect = previewElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = event.clientX + 150;
        let y = event.clientY - 50;

        if (x + rect.width > viewportWidth) {
            x = event.clientX - rect.width - 150;
        }
        if (y + rect.height > viewportHeight) {
            y = event.clientY - rect.height + 50;
        }

        x = Math.max(10, Math.min(x, viewportWidth - rect.width - 10));
        y = Math.max(10, Math.min(y, viewportHeight - rect.height - 10));

        position = { x, y };
    }

    function setContextMenuOpen(open) {
        contextMenuOpen = open;
    }

    // ===== HOVER HANDLING =====
    function handleMouseOver(event) {
        if (contextMenuOpen) return;

        const cardElement = event.target.closest('[data-card-id]');
        if (!cardElement) return;

        const related = event.relatedTarget;
        if (related && cardElement.contains(related)) return;

        hoveredCardElement = cardElement;
        openHoverPreview(cardElement, event);
    }

    function handleMouseOut(event) {
        const cardElement = event.target.closest('[data-card-id]');
        if (!cardElement) return;

        const related = event.relatedTarget;
        if (related && cardElement.contains(related)) return;

        if (hoveredCardElement === cardElement) {
            hoveredCardElement = null;
        }

        if (isOpen) {
            hide();
        }
    }

    function handleMouseMove(event) {
        if (contextMenuOpen) return;

        const cardElement = event.target.closest('[data-card-id]');
        
        // Check if the hovered card still exists in the DOM
        if (hoveredCardElement && !document.contains(hoveredCardElement)) {
            hoveredCardElement = null;
            if (isOpen) hide();
            return;
        }

        if (isOpen && !isCentered) {
            updatePosition(event);
        } else if (!isOpen && cardElement && cardElement === hoveredCardElement) {
            openHoverPreview(cardElement, event);
        }
    }

    function openHoverPreview(cardElement, pointerEvent) {
        if (!cardElement || contextMenuOpen) return;
        if (isOpen && hoveredCardElement === cardElement) return;

        const cardId = cardElement.getAttribute('data-card-id');
        const cardNameAttr = cardElement.getAttribute('data-card-name');
        const cardImage = cardElement.getAttribute('data-card-image');
        const rawData = cardElement.getAttribute('data-card-data') || null;
        let parsedData = null;

        if (rawData) {
            try {
                parsedData = JSON.parse(
                    rawData.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                );
            } catch {
                // ignore parse error
            }
        }

        const positionEvent = pointerEvent && typeof pointerEvent.clientX === 'number'
            ? pointerEvent
            : buildCardCenterEvent(cardElement);

        show(cardId, cardNameAttr, cardImage, positionEvent, parsedData);
    }

    function buildCardCenterEvent(cardElement) {
        if (!cardElement) {
            return { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
        }
        const rect = cardElement.getBoundingClientRect();
        return {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        };
    }

    // ===== CLICK/KEY HANDLERS =====
    function handleClick() {
        hide();
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            hide();
        }
    }

    // ===== INITIALIZATION =====
    function initializeHoverPreview() {
        if (hoverInitialized) return;

        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
        document.addEventListener('mousemove', handleMouseMove, true);

        hoverInitialized = true;
    }

    function cleanupHoverPreview() {
        document.removeEventListener('mouseover', handleMouseOver, true);
        document.removeEventListener('mouseout', handleMouseOut, true);
        document.removeEventListener('mousemove', handleMouseMove, true);
        hoverInitialized = false;
    }

    // Computed style for positioning
    const previewStyle = $derived(() => {
        if (isCentered) {
            return `left: 50%; top: 50%; transform: translate(-50%, -50%);`;
        }
        return `left: ${position.x}px; top: ${position.y}px; transform: none;`;
    });

    // Export API
    const CardPreviewModalAPI = {
        show,
        hide,
        updatePosition,
        setContextMenuOpen,
        isOpen: () => isOpen
    };

    if (typeof window !== 'undefined') {
        window.CardPreviewModal = CardPreviewModalAPI;
    }

    onMount(() => {
        initializeHoverPreview();

        return () => {
            cleanupHoverPreview();
        };
    });
</script>

<svelte:window 
    onclick={handleClick} 
    onkeydown={handleKeydown} 
/>

{#if isOpen}
    <div
        id="card-preview-modal"
        class="card-preview-modal show"
        class:card-preview-modal-centered={isCentered}
        style={previewStyle()}
        bind:this={previewElement}
        role="dialog"
        aria-modal="false"
        aria-label={`Card Preview: ${cardName}`}
    >
        <div class="card-preview-content">
            {#if imageUrl}
                <img 
                    src={imageUrl} 
                    alt={escapeHtml(cardName)} 
                    class="card-preview-image" 
                />
            {:else}
                <div class="card-preview-fallback">
                    <div class="card-name">{escapeHtml(cardName)}</div>
                </div>
            {/if}
            <div class="card-preview-details">
                <h3>{escapeHtml(cardName)}</h3>
                {#if hasKeywords}
                    <div class="card-keyword-section">
                        <div class="card-keyword-list">
                            {#each keywords as keyword (keyword.name)}
                                <div class="card-keyword-entry">
                                    <div class="card-keyword-name">{keyword.name}</div>
                                    <div class="card-keyword-description">{keyword.description}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
