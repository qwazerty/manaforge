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

    // Keyword descriptions database - complete MTG keyword reference
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
        "airbend":{"name":"Airbending","description":"Exile it. While it's exiled, its owner may cast it for {2} rather than its mana cost."},
        "alliance":{"name":"Alliance","description":"Triggers whenever another creature enters the battlefield under your control."},
        "amass":{"name":"Amass","description":"Put N +1/+1 counters on an Army you control. If you don't control one, create a 0/0 black Army creature token first."},
        "annihilator":{"name":"Annihilator","description":"Whenever this creature attacks, defending player sacrifices N permanents."},
        "assist":{"name":"Assist","description":"Another player may help pay up to {X} of this spell's cost."},
        "awaken":{"name":"Awaken","description":"If you cast this spell for its awaken cost, also put N +1/+1 counters on target land you control and it becomes a creature."},
        "backup":{"name":"Backup","description":"When this creature enters, put a +1/+1 counter on target creature. If it's another creature, it gains the listed abilities until end of turn."},
        "bargain":{"name":"Bargain","description":"As you cast this spell, you may sacrifice an artifact, enchantment, or token for an additional effect."},
        "battalion":{"name":"Battalion","description":"Triggers when this and at least two other creatures attack."},
        "battle cry":{"name":"Battle cry","description":"Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn."},
        "bestow":{"name":"Bestow","description":"You may cast this card as an Aura with enchant creature for its bestow cost; if the creature leaves, it stops being an Aura."},
        "blitz":{"name":"Blitz","description":"You may cast this creature for its blitz cost. It gains haste and \"When this creature dies, draw a card.\" Sacrifice it at the beginning of the next end step."},
        "boast":{"name":"Boast","description":"Activate only if this creature attacked this turn and only once each turn."},
        "bolster":{"name":"Bolster","description":"Choose a creature you control with the least toughness among creatures you control. Put N +1/+1 counters on it."},
        "bushido":{"name":"Bushido","description":"Whenever this creature blocks or becomes blocked, it gets +N/+N until end of turn."},
        "buyback":{"name":"Buyback","description":"You may pay an additional cost; if you do, return this spell to your hand as it resolves."},
        "cascade":{"name":"Cascade","description":"When you cast this spell, exile cards from the top of your library until you exile a nonland card with lesser mana value. You may cast it without paying its mana cost; put the exiled cards on the bottom in a random order."},
        "casualty":{"name":"Casualty","description":"As you cast this spell, you may sacrifice a creature with power N or greater. When you do, copy this spell."},
        "celebration":{"name":"Celebration","description":"Bonus if two or more nonland permanents entered under your control this turn."},
        "champion":{"name":"Champion","description":"When this enters, sacrifice it unless you exile another [quality] you control. When this leaves, return the exiled card to the battlefield."},
        "changeling":{"name":"Changeling","description":"This card is every creature type."},
        "chroma":{"name":"Chroma","description":"Scales with the number of colored mana symbols among permanents or cards you control."},
        "cipher":{"name":"Cipher","description":"Then you may exile this spell encoded on a creature you control. Whenever that creature deals combat damage to a player, you may cast a copy without paying its cost."},
        "cleave":{"name":"Cleave","description":"You may cast this spell for its cleave cost. If you do, remove the words in square brackets in its rules text."},
        "cloak":{"name":"Cloak","description":"To cloak a card, put it onto the battlefield face down as a 2/2 creature with ward {2}."},
        "cohort":{"name":"Cohort","description":"Tap this and another Ally you control: do the listed effect."},
        "collect evidence":{"name":"Collect evidence","description":"Exile cards from your graveyard with total mana value N or more as a cost or instruction to get the listed bonus."},
        "companion":{"name":"Companion","description":"If your starting deck meets this card's restriction, you may choose it as your companion and cast it from outside the game once."},
        "connive":{"name":"Connive","description":"Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature."},
        "conspire":{"name":"Conspire","description":"As you cast this spell, you may tap two untapped creatures you control that share a color with it. When you do, copy it."},
        "constellation":{"name":"Constellation","description":"Triggers when an enchantment enters under your control."},
        "converge":{"name":"Converge","description":"Scales with the number of colors of mana spent to cast the spell."},
        "convoke":{"name":"Convoke","description":"Your creatures can help cast this spell. Each creature you tap while casting it pays for {1} or one mana of that creature's color."},
        "corrupted":{"name":"Corrupted","description":"Bonus if an opponent has three or more poison counters."},
        "council's dilemma":{"name":"Council's dilemma","description":"Each player votes; effects scale with the number of each vote."},
        "coven":{"name":"Coven","description":"Bonus if you control three or more creatures with different powers."},
        "craft":{"name":"Craft","description":"Craft with [materials]: Exile this and the required materials from the battlefield and/or graveyard to transform it, as a sorcery."},
        "crew":{"name":"Crew","description":"Crew N: Tap any number of creatures you control with total power N or more: This Vehicle becomes an artifact creature until end of turn."},
        "dash":{"name":"Dash","description":"You may cast this spell for its dash cost. If you do, it gains haste and it's returned to its owner's hand at the beginning of the next end step."},
        "daybound":{"name":"Daybound","description":"If it's day, this face is active. If a player casts no spells during their own turn, it becomes night next turn."},
        "deathtouch":{"name":"Deathtouch","description":"Any amount of damage this creature deals to a creature is enough to destroy it."},
        "decayed":{"name":"Decayed","description":"This creature can't block. When it attacks, sacrifice it at end of combat."},
        "defender":{"name":"Defender","description":"This creature can't attack."},
        "delirium":{"name":"Delirium","description":"Checks for four or more card types in your graveyard."},
        "delve":{"name":"Delve","description":"Each card you exile from your graveyard while casting this spell pays for {1}."},
        "descend":{"name":"Descend","description":"Abilities that care about the number of permanent cards in your graveyard (e.g., Descend 4/8, Fathomless Descent)."},
        "detain":{"name":"Detain","description":"Until your next turn, target creature can't attack or block and its activated abilities can't be activated."},
        "dethrone":{"name":"Dethrone","description":"Whenever this creature attacks the player with the most life or tied for most life, put a +1/+1 counter on it."},
        "devoid":{"name":"Devoid","description":"This card has no color."},
        "devour":{"name":"Devour","description":"As this creature enters, you may sacrifice any number of creatures; it enters with N times that many +1/+1 counters."},
        "discover":{"name":"Discover","description":"Discover N: Exile cards from the top of your library until you exile a nonland card with mana value N or less. You may cast it without paying its mana cost or put it into your hand. Put the rest on the bottom in a random order."},
        "disguise":{"name":"Disguise","description":"You may cast this card face down as a 2/2 creature with ward {2} for {3}. Turn it face up any time for its disguise cost."},
        "disturb":{"name":"Disturb","description":"You may cast this card transformed from your graveyard for its disturb cost. If it would be put into a graveyard from anywhere, exile it instead."},
        "domain":{"name":"Domain","description":"Scales with the number of basic land types among lands you control."},
        "double strike":{"name":"Double strike","description":"This creature deals both first-strike and regular combat damage."},
        "dredge":{"name":"Dredge","description":"If you would draw a card, you may mill N cards instead. If you do, return this card from your graveyard to your hand."},
        "earthbend":{"name":"Earthbending","description":"Target land you control becomes a 0/0 creature with haste that's still a land. Put X +1/+1 counters on it. When it dies or is exiled, return it to the battlefield tapped."},
        "echo":{"name":"Echo","description":"At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost."},
        "embalm":{"name":"Embalm","description":"Exile this creature card from your graveyard: Create a token copy except it's white and a Zombie; activate only as a sorcery."},
        "emerge":{"name":"Emerge","description":"You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana value."},
        "eminence":{"name":"Eminence","description":"Ability functions while this commander is in command zone and/or battlefield."},
        "encore":{"name":"Encore","description":"Exile this card from your graveyard for its encore cost: For each opponent, create a token copy that attacks that player this turn if able; sacrifice the tokens at end of combat."},
        "enlist":{"name":"Enlist","description":"As this creature attacks, you may tap a nonattacking creature you control. Add its power to this creature until end of turn."},
        "entwine":{"name":"Entwine","description":"Choose one — If you pay the entwine cost, choose both instead."},
        "equip":{"name":"Equip","description":"Equip [cost]: Attach this Equipment to target creature you control. Activate only as a sorcery."},
        "escalate":{"name":"Escalate","description":"Pay the escalate cost for each additional mode you choose beyond the first."},
        "escape":{"name":"Escape","description":"You may cast this card from your graveyard by paying its escape cost and exiling other cards from your graveyard."},
        "eternalize":{"name":"Eternalize","description":"Exile this creature card from your graveyard: Create a token that's a copy except it's 4/4 black Zombie; activate only as a sorcery."},
        "evoke":{"name":"Evoke","description":"You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters the battlefield."},
        "evolve":{"name":"Evolve","description":"Whenever a creature enters the battlefield under your control with greater power or toughness, put a +1/+1 counter on this creature."},
        "exalted":{"name":"Exalted","description":"Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn."},
        "exert":{"name":"Exert","description":"You may exert this as it attacks; if you do, it won't untap during your next untap step and you get the listed bonus."},
        "exhaust":{"name":"Exhaust","description":"Activate each exhaust ability only once."},
        "exploit":{"name":"Exploit","description":"When this creature enters the battlefield, you may sacrifice a creature. If you do, you get the listed effect."},
        "explore":{"name":"Explore","description":"Reveal the top card of your library. If it's a land, put it into your hand; otherwise put a +1/+1 counter on this creature, then you may put that card into your graveyard."},
        "extort":{"name":"Extort","description":"Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life."},
        "fabricate":{"name":"Fabricate","description":"When this creature enters, put N +1/+1 counters on it or create N 1/1 colorless Servo artifact creature tokens."},
        "fading":{"name":"Fading","description":"Enters with N fade counters. Remove one at each upkeep. When you can't, sacrifice it."},
        "fateful hour":{"name":"Fateful hour","description":"Bonus while you have 5 or less life."},
        "fear":{"name":"Fear","description":"This creature can be blocked only by artifact creatures and/or black creatures."},
        "ferocious":{"name":"Ferocious","description":"Bonus if you control a creature with power 4 or greater."},
        "fight":{"name":"Fight","description":"Each of two creatures deals damage equal to its power to the other."},
        "firebend":{"name":"Firebending","description":"Whenever this creature attacks, add X {R}. This mana lasts until end of combat."},
        "first strike":{"name":"First strike","description":"This creature deals combat damage before creatures without first strike."},
        "flanking":{"name":"Flanking","description":"Whenever this creature becomes blocked by a creature without flanking, the blocking creature gets -1/-1 until end of turn."},
        "flash":{"name":"Flash","description":"You may cast this spell any time you could cast an instant."},
        "flashback":{"name":"Flashback","description":"You may cast this card from your graveyard for its flashback cost; then exile it."},
        "flying":{"name":"Flying","description":"Creatures with flying can only be blocked by creatures with flying or reach."},
        "for mirrodin!":{"name":"For Mirrodin!","description":"When this Equipment enters, create a 2/2 Rebel and attach this to it."},
        "forecast":{"name":"Forecast","description":"During your upkeep, you may reveal this card from your hand and pay its forecast cost to get its effect."},
        "foretell":{"name":"Foretell","description":"During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost."},
        "formidable":{"name":"Formidable","description":"Bonus if total power among creatures you control is 8 or greater."},
        "fortify":{"name":"Fortify","description":"Fortify [cost]: Attach this Fortification to target land you control. Activate only as a sorcery."},
        "freerunning":{"name":"Freerunning","description":"You may cast this spell for its freerunning cost if an Assassin or a commander you control dealt combat damage to a player this turn."},
        "fuse":{"name":"Fuse","description":"You may cast both halves of this split card from your hand as a single spell."},
        "goad":{"name":"Goad","description":"Until your next turn, that creature attacks each combat if able and attacks a player other than you if able."},
        "graft":{"name":"Graft","description":"This creature enters with N +1/+1 counters. Whenever another creature enters, you may move a +1/+1 counter from this onto it."},
        "grandeur":{"name":"Grandeur","description":"Discard another copy of this legendary card for a special effect."},
        "haste":{"name":"Haste","description":"This creature can attack and activate abilities with {T} or {Q} as soon as it comes under your control."},
        "haunt":{"name":"Haunt","description":"When this dies or the spell resolves, exile it haunting target creature. When that creature dies, you get the listed effect."},
        "hellbent":{"name":"Hellbent","description":"Bonus if you have no cards in hand."},
        "heroic":{"name":"Heroic","description":"Triggers when you cast a spell that targets this creature."},
        "hexproof":{"name":"Hexproof","description":"This permanent can't be the target of spells or abilities your opponents control."},
        "hideaway":{"name":"Hideaway","description":"This enters tapped. When it does, look at the top N cards, exile one face down, then later you may play it for free if a condition is met."},
        "horsemanship":{"name":"Horsemanship","description":"This creature can be blocked only by creatures with horsemanship."},
        "imprint":{"name":"Imprint","description":"Exiles a card to grant additional effects to this permanent."},
        "improvise":{"name":"Improvise","description":"Your artifacts can help cast this spell. Each artifact you tap while casting it pays for {1}."},
        "incubate":{"name":"Incubate","description":"Create an Incubator token with N +1/+1 counters and \"{2}: Transform this artifact.\""},
        "indestructible":{"name":"Indestructible","description":"Effects that say \"destroy\" don't destroy this permanent, and lethal damage doesn't destroy it."},
        "infect":{"name":"Infect","description":"This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters."},
        "ingest":{"name":"Ingest","description":"Whenever this creature deals combat damage to a player, that player exiles the top card of their library."},
        "intimidate":{"name":"Intimidate","description":"This creature can be blocked only by artifact creatures and/or creatures that share a color with it."},
        "investigate":{"name":"Investigate","description":"Create a Clue token with \"{2}, Sacrifice this artifact: Draw a card.\""},
        "join forces":{"name":"Join forces","description":"Each player may pay any amount of mana; effects scale with total paid."},
        "jump-start":{"name":"Jump-start","description":"You may cast this spell from your graveyard by discarding a card in addition to paying its other costs."},
        "kicker":{"name":"Kicker","description":"You may pay an additional cost as you cast this spell for an extra effect."},
        "kinship":{"name":"Kinship","description":"At upkeep, reveal the top card; if it shares a type with this, you get an effect."},
        "landfall":{"name":"Landfall","description":"Triggers when a land enters under your control."},
        "landwalk":{"name":"Landwalk","description":"This creature can't be blocked as long as defending player controls a land of the stated type."},
        "learn":{"name":"Learn","description":"You may reveal a Lesson card you own from outside the game and put it into your hand, or discard a card to draw a card."},
        "level up":{"name":"Level up","description":"{cost}: Put a level counter on this. Activate only as a sorcery. Abilities and power/toughness change at listed levels."},
        "lieutenant":{"name":"Lieutenant","description":"Bonus while you control your commander."},
        "lifelink":{"name":"Lifelink","description":"Damage dealt by this creature also causes you to gain that much life."},
        "living weapon":{"name":"Living weapon","description":"When this Equipment enters the battlefield, create a 0/0 black Germ creature token, then attach this to it."},
        "madness":{"name":"Madness","description":"If you discard this card, discard it into exile. You may cast it for its madness cost."},
        "magecraft":{"name":"Magecraft","description":"Triggers when you cast or copy an instant or sorcery."},
        "manifest":{"name":"Manifest","description":"Put the top card of your library onto the battlefield face down as a 2/2 creature. You may turn it face up if it's a creature card."},
        "megamorph":{"name":"Megamorph","description":"As morph, but when turned face up, put a +1/+1 counter on it."},
        "meld":{"name":"Meld","description":"Two specific cards you own may meld into one oversized back-face permanent when conditions are met."},
        "melee":{"name":"Melee","description":"Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat."},
        "menace":{"name":"Menace","description":"This creature can't be blocked except by two or more creatures."},
        "mentor":{"name":"Mentor","description":"Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power."},
        "metalcraft":{"name":"Metalcraft","description":"Turns on if you control three or more artifacts."},
        "mill":{"name":"Mill","description":"Put the top N cards of a library into its owner's graveyard."},
        "miracle":{"name":"Miracle","description":"You may cast this card for its miracle cost when you draw it if it's the first card you drew this turn."},
        "modular":{"name":"Modular","description":"This creature enters with N +1/+1 counters. When it dies, you may put its counters on target artifact creature."},
        "monstrosity":{"name":"Monstrosity","description":"If this creature isn't monstrous, put N +1/+1 counters on it and it becomes monstrous."},
        "morbid":{"name":"Morbid","description":"Bonus if a creature died this turn."},
        "morph":{"name":"Morph","description":"You may cast this card face down as a 2/2 for {3}. Turn it face up any time for its morph cost."},
        "multikicker":{"name":"Multikicker","description":"You may pay the kicker cost any number of times as you cast this spell; it gets additional effects per time kicked."},
        "mutate":{"name":"Mutate","description":"If you cast this spell for its mutate cost, put it over or under target non-Human creature you own; they become one creature with the top card's characteristics and all abilities of both."},
        "myriad":{"name":"Myriad","description":"Whenever this creature attacks, for each opponent other than defending player, create a tapped and attacking token copy that's attacking that opponent or a planeswalker they control; exile the tokens at end of combat."},
        "nightbound":{"name":"Nightbound","description":"If it's night, this face is active. If a player casts two or more spells during their turn, it becomes day next turn."},
        "ninjutsu":{"name":"Ninjutsu","description":"{cost}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking."},
        "offering":{"name":"Offering","description":"You may cast this any time you could cast an instant by sacrificing a [type] and paying the difference in mana costs between this and the sacrificed [type]."},
        "outlast":{"name":"Outlast","description":"{cost}, {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery."},
        "overload":{"name":"Overload","description":"You may cast this spell for its overload cost. If you do, replace each instance of \"target\" with \"each\"."},
        "pack tactics":{"name":"Pack tactics","description":"Triggers when your attackers have total power 6 or greater."},
        "parley":{"name":"Parley","description":"Each player reveals the top card; effects scale on what's revealed."},
        "partner with":{"name":"Partner with","description":"When one enters, you may search your library for the named partner card and put it into your hand; those two can be your commanders."},
        "partner":{"name":"Partner","description":"You can have two commanders if both have partner."},
        "persist":{"name":"Persist","description":"When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter."},
        "phasing":{"name":"Phasing","description":"This permanent regularly phases in or out. While phased out, it's treated as though it doesn't exist."},
        "plot":{"name":"Plot","description":"You may pay the plot cost and exile this card from your hand as a sorcery. Cast it on a later turn without paying its mana cost."},
        "poisonous":{"name":"Poisonous","description":"Whenever this creature deals combat damage to a player, that player gets N poison counters."},
        "populate":{"name":"Populate","description":"Create a token that's a copy of a creature token you control."},
        "proliferate":{"name":"Proliferate","description":"Choose any number of permanents and/or players with counters; give each another counter of a kind already there."},
        "protection":{"name":"Protection","description":"Protection from [quality]: It can't be targeted, dealt damage, enchanted/equipped, or blocked by anything with that quality."},
        "prototype":{"name":"Prototype","description":"You may cast this artifact creature for its prototype cost with different color, power, and toughness."},
        "provoke":{"name":"Provoke","description":"Whenever this creature attacks, you may have target creature defending player controls untap and block it if able."},
        "prowess":{"name":"Prowess","description":"Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn."},
        "radiance":{"name":"Radiance","description":"Spreads effects to permanents that share a color with the target."},
        "raid":{"name":"Raid","description":"Bonus if you attacked with a creature this turn."},
        "rally":{"name":"Rally","description":"Triggers whenever an Ally enters the battlefield under your control."},
        "rampage":{"name":"Rampage","description":"Whenever this creature becomes blocked, it gets +N/+N until end of turn for each creature beyond the first assigned to block it."},
        "ravenous":{"name":"Ravenous","description":"This creature enters with X +1/+1 counters. If X is 5 or more, draw a card when it enters."},
        "reach":{"name":"Reach","description":"This creature can block creatures with flying."},
        "read ahead":{"name":"Read ahead","description":"As this Saga enters, choose a chapter to start on; previously skipped chapter abilities don't trigger."},
        "rebound":{"name":"Rebound","description":"If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, cast it from exile without paying its mana cost."},
        "reconfigure":{"name":"Reconfigure","description":"Attach or detach this Equipment Creature for its reconfigure cost; while attached it isn't a creature."},
        "recover":{"name":"Recover","description":"When a creature is put into your graveyard from the battlefield, you may pay the recover cost. If you do, return this card from your graveyard to your hand; otherwise exile this card."},
        "regenerate":{"name":"Regenerate","description":"The next time this permanent would be destroyed this turn, instead tap it, remove all damage from it, and remove it from combat."},
        "renown":{"name":"Renown","description":"When this creature deals combat damage to a player, if it isn't renowned, put N +1/+1 counters on it and it becomes renowned."},
        "replicate":{"name":"Replicate","description":"When you cast this spell, copy it for each time you paid its replicate cost; you may choose new targets."},
        "retrace":{"name":"Retrace","description":"You may cast this card from your graveyard by discarding a land card in addition to paying its other costs."},
        "revolt":{"name":"Revolt","description":"Bonus if a permanent you controlled left the battlefield this turn."},
        "riot":{"name":"Riot","description":"This creature enters with your choice of a +1/+1 counter or haste."},
        "saddle":{"name":"Saddle","description":"Saddle N: Tap any number of other creatures you control with total power N or more: This Mount becomes a creature until end of turn."},
        "scavenge":{"name":"Scavenge","description":"Exile this creature card from your graveyard: Put a number of +1/+1 counters equal to its power on target creature. Activate only as a sorcery."},
        "scry":{"name":"Scry","description":"Scry N: Look at the top N cards of your library; put any number on the bottom and the rest on top in any order."},
        "shadow":{"name":"Shadow","description":"This creature can block or be blocked only by creatures with shadow."},
        "shield counter":{"name":"Shield counter","description":"If a permanent with a shield counter would be dealt damage or destroyed, remove a shield counter from it instead."},
        "shroud":{"name":"Shroud","description":"This permanent can't be the target of any spells or abilities."},
        "skulk":{"name":"Skulk","description":"This creature can't be blocked by creatures with greater power."},
        "soulbond":{"name":"Soulbond","description":"You may pair this creature with another unpaired creature when either enters. They remain paired as long as you control both and get the listed bonus."},
        "spectacle":{"name":"Spectacle","description":"You may cast this spell for its spectacle cost if an opponent lost life this turn."},
        "spell mastery":{"name":"Spell mastery","description":"Bonus if two or more instants and/or sorceries are in your graveyard."},
        "splice":{"name":"Splice onto Arcane","description":"As you cast an Arcane spell, you may reveal this card and pay its splice cost; add its text to that spell."},
        "split second":{"name":"Split second","description":"As long as this spell is on the stack, players can't cast spells or activate abilities that aren't mana abilities."},
        "spree":{"name":"Spree","description":"As an additional cost to cast this spell, choose one or more modes and pay their associated costs."},
        "squad":{"name":"Squad","description":"As you cast this spell, you may pay its squad cost any number of times. When it enters, create that many token copies."},
        "storm":{"name":"Storm","description":"When you cast this spell, copy it for each spell cast before it this turn; you may choose new targets."},
        "sunburst":{"name":"Sunburst","description":"This permanent enters with a +1/+1 counter or charge counter on it for each color of mana spent to cast it."},
        "surge":{"name":"Surge","description":"You may cast this spell for its surge cost if you or a teammate has cast another spell this turn."},
        "surveil":{"name":"Surveil","description":"Surveil N: Look at the top N cards of your library; you may put any number into your graveyard and the rest back on top in any order."},
        "suspend":{"name":"Suspend","description":"Rather than cast this card from your hand, you may pay its suspend cost and exile it with N time counters; cast it when the last is removed."},
        "tempting offer":{"name":"Tempting offer","description":"You get an effect; each opponent may copy it—if they do, you get it again."},
        "threshold":{"name":"Threshold","description":"Turns on at seven or more cards in your graveyard."},
        "totem armor":{"name":"Totem armor","description":"If enchanted creature would be destroyed, instead remove all damage from it and destroy this Aura."},
        "toxic":{"name":"Toxic","description":"Players dealt combat damage by this creature also get N poison counters."},
        "training":{"name":"Training","description":"Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature."},
        "trample":{"name":"Trample","description":"Excess combat damage this creature deals to a blocker is dealt to the defending player, planeswalker, or battle."},
        "transfigure":{"name":"Transfigure","description":"{1}{B}{B}, Sacrifice this creature: Search your library for a creature card with the same mana value, put it onto the battlefield, then shuffle. Activate only as a sorcery."},
        "transform":{"name":"Transform","description":"Turn a double-faced card to its other face if instructed to transform."},
        "transmute":{"name":"Transmute","description":"{1}{B}{B}, Discard this card: Search your library for a card with the same mana value, reveal it, put it into your hand, then shuffle. Activate only as a sorcery."},
        "tribute":{"name":"Tribute","description":"As this creature enters, an opponent may put N +1/+1 counters on it. When it enters, if tribute wasn't paid, a specified effect happens."},
        "undaunted":{"name":"Undaunted","description":"This spell costs {1} less to cast for each opponent."},
        "undergrowth":{"name":"Undergrowth","description":"Scales with the number of creature cards in your graveyard."},
        "undying":{"name":"Undying","description":"When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter."},
        "unearth":{"name":"Unearth","description":"Return this card from your graveyard to the battlefield. It gains haste. Exile it at the next end step or if it would leave the battlefield."},
        "unleash":{"name":"Unleash","description":"You may have this creature enter the battlefield with a +1/+1 counter on it. It can't block as long as it has a +1/+1 counter on it."},
        "valiant":{"name":"Valiant","description":"Triggers the first time each turn a creature becomes the target of a spell or ability you control."},
        "vanishing":{"name":"Vanishing","description":"This permanent enters with N time counters. At the beginning of your upkeep, remove one. When you can't, sacrifice it."},
        "venture into the dungeon":{"name":"Venture into the dungeon","description":"Move your marker into the next room of a dungeon and trigger its room ability."},
        "vigilance":{"name":"Vigilance","description":"Attacking doesn't cause this creature to tap."},
        "ward":{"name":"Ward","description":"Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost."},
        "warp":{"name":"Warp","description":"You may cast this from your hand for its warp cost. If you do, it's exiled at the beginning of the next end step; you may cast it from exile later."},
        "waterbend":{"name":"Waterbending","description":"While paying a waterbend cost, you can tap your artifacts and creatures to help. Each one pays for {1}."},
        "will of the council":{"name":"Will of the council","description":"Players vote for outcomes; the vote result determines the effect."},
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
