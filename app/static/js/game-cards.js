/**
 * ManaForge Game Cards Module
 * Functions for card rendering and management
 */
const CARD_BACK_IMAGE = '/static/images/card-back.jpg';

const GameCards = {
    draggedCardElement: null,
    _hoverPreviewInitialized: false,
    _hoveredCardElement: null,
    _hoverPreviewPointerEvent: null,
    _hoverPreviewOpened: false,
    _contextMenuOpen: false,
    _boundHoverMouseOver: null,
    _boundHoverMouseOut: null,
    _boundHoverMouseMove: null,
    _lastContextPosition: null,
    _attachmentSelection: null,
    _attachmentTargets: [],
    _boundAttachmentClickHandler: null,
    _boundAttachmentKeydownHandler: null,
    _boundCloseAttachmentClick: null,
    _boundAttachmentMenuClose: null,
    _boundAttachmentMenuKeydown: null,
    keywordDescriptions: {
        "adapt":{"name":"Adapt","description":"If this creature has no +1/+1 counters on it, put N +1/+1 counters on it."},
        "islandwalk":{"name":"Islandwalk","description":"This creature can’t be blocked as long as defending player controls an Island."},
        "mountainwalk":{"name":"Mountainwalk","description":"This creature can’t be blocked as long as defending player controls a Mountain."},
        "plainswalk":{"name":"Plainswalk","description":"This creature can’t be blocked as long as defending player controls a Plains."},
        "swampwalk":{"name":"Swampwalk","description":"This creature can’t be blocked as long as defending player controls a Swamp."},
        "forestwalk":{"name":"F orestwalk","description":"This creature can’t be blocked as long as defending player controls a Forest."},
        "affinity":{"name":"Affinity","description":"This spell costs {1} less to cast for each [quality] you control."},
        "afflict":{"name":"Afflict","description":"Whenever this creature becomes blocked, defending player loses N life."},
        "afterlife":{"name":"Afterlife","description":"When this creature dies, create N 1/1 white and black Spirit creature tokens with flying."},
        "aftermath":{"name":"Aftermath","description":"You may cast this half of the split card only from your graveyard; then exile it."},
        "airbend":{"name":"Airbending","description":"Exile it. While it's exiled, its owner may cast it for {2} rather than its mana cost."},
        "alliance":{"name":"Alliance","description":"Triggers whenever another creature enters the battlefield under your control."},
        "amass":{"name":"Amass","description":"Put N +1/+1 counters on an Army you control. If you don’t control one, create a 0/0 black Army creature token first."},
        "annihilator":{"name":"Annihilator","description":"Whenever this creature attacks, defending player sacrifices N permanents."},
        "assist":{"name":"Assist","description":"Another player may help pay up to {X} of this spell’s cost."},
        "awaken":{"name":"Awaken","description":"If you cast this spell for its awaken cost, also put N +1/+1 counters on target land you control and it becomes a creature."},
        "backup":{"name":"Backup","description":"When this creature enters, put a +1/+1 counter on target creature. If it’s another creature, it gains the listed abilities until end of turn."},
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
        "companion":{"name":"Companion","description":"If your starting deck meets this card’s restriction, you may choose it as your companion and cast it from outside the game once."},
        "connive":{"name":"Connive","description":"Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature."},
        "conspire":{"name":"Conspire","description":"As you cast this spell, you may tap two untapped creatures you control that share a color with it. When you do, copy it."},
        "constellation":{"name":"Constellation","description":"Triggers when an enchantment enters under your control."},
        "converge":{"name":"Converge","description":"Scales with the number of colors of mana spent to cast the spell."},
        "convoke":{"name":"Convoke","description":"Your creatures can help cast this spell. Each creature you tap while casting it pays for {1} or one mana of that creature’s color."},
        "corrupted":{"name":"Corrupted","description":"Bonus if an opponent has three or more poison counters."},
        "council's dilemma":{"name":"Council’s dilemma","description":"Each player votes; effects scale with the number of each vote."},
        "coven":{"name":"Coven","description":"Bonus if you control three or more creatures with different powers."},
        "craft":{"name":"Craft","description":"Craft with [materials]: Exile this and the required materials from the battlefield and/or graveyard to transform it, as a sorcery."},
        "crew":{"name":"Crew","description":"Crew N: Tap any number of creatures you control with total power N or more: This Vehicle becomes an artifact creature until end of turn."},
        "dash":{"name":"Dash","description":"You may cast this spell for its dash cost. If you do, it gains haste and it’s returned to its owner’s hand at the beginning of the next end step."},
        "daybound":{"name":"Daybound","description":"If it’s day, this face is active. If a player casts no spells during their own turn, it becomes night next turn."},
        "deathtouch":{"name":"Deathtouch","description":"Any amount of damage this creature deals to a creature is enough to destroy it."},
        "decayed":{"name":"Decayed","description":"This creature can’t block. When it attacks, sacrifice it at end of combat."},
        "defender":{"name":"Defender","description":"This creature can’t attack."},
        "delirium":{"name":"Delirium","description":"Checks for four or more card types in your graveyard."},
        "delve":{"name":"Delve","description":"Each card you exile from your graveyard while casting this spell pays for {1}."},
        "descend":{"name":"Descend","description":"Abilities that care about the number of permanent cards in your graveyard (e.g., Descend 4/8, Fathomless Descent)."},
        "detain":{"name":"Detain","description":"Until your next turn, target creature can’t attack or block and its activated abilities can’t be activated."},
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
        "embalm":{"name":"Embalm","description":"Exile this creature card from your graveyard: Create a token copy except it’s white and a Zombie; activate only as a sorcery."},
        "emerge":{"name":"Emerge","description":"You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature’s mana value."},
        "eminence":{"name":"Eminence","description":"Ability functions while this commander is in command zone and/or battlefield."},
        "encore":{"name":"Encore","description":"Exile this card from your graveyard for its encore cost: For each opponent, create a token copy that attacks that player this turn if able; sacrifice the tokens at end of combat."},
        "enlist":{"name":"Enlist","description":"As this creature attacks, you may tap a nonattacking creature you control. Add its power to this creature until end of turn."},
        "entwine":{"name":"Entwine","description":"Choose one — If you pay the entwine cost, choose both instead."},
        "equip":{"name":"Equip","description":"Equip [cost]: Attach this Equipment to target creature you control. Activate only as a sorcery."},
        "escalate":{"name":"Escalate","description":"Pay the escalate cost for each additional mode you choose beyond the first."},
        "escape":{"name":"Escape","description":"You may cast this card from your graveyard by paying its escape cost and exiling other cards from your graveyard."},
        "eternalize":{"name":"Eternalize","description":"Exile this creature card from your graveyard: Create a token that’s a copy except it’s 4/4 black Zombie; activate only as a sorcery."},
        "evoke":{"name":"Evoke","description":"You may cast this spell for its evoke cost. If you do, it’s sacrificed when it enters the battlefield."},
        "evolve":{"name":"Evolve","description":"Whenever a creature enters the battlefield under your control with greater power or toughness, put a +1/+1 counter on this creature."},
        "exalted":{"name":"Exalted","description":"Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn."},
        "exert":{"name":"Exert","description":"You may exert this as it attacks; if you do, it won’t untap during your next untap step and you get the listed bonus."},
        "exhaust":{"name":"Exhaust","description":"Activate each exhaust ability only once."},
        "exploit":{"name":"Exploit","description":"When this creature enters the battlefield, you may sacrifice a creature. If you do, you get the listed effect."},
        "explore":{"name":"Explore","description":"Reveal the top card of your library. If it’s a land, put it into your hand; otherwise put a +1/+1 counter on this creature, then you may put that card into your graveyard."},
        "extort":{"name":"Extort","description":"Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life."},
        "fabricate":{"name":"Fabricate","description":"When this creature enters, put N +1/+1 counters on it or create N 1/1 colorless Servo artifact creature tokens."},
        "fading":{"name":"Fading","description":"Enters with N fade counters. Remove one at each upkeep. When you can’t, sacrifice it."},
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
        "hexproof":{"name":"Hexproof","description":"This permanent can’t be the target of spells or abilities your opponents control."},
        "hideaway":{"name":"Hideaway","description":"This enters tapped. When it does, look at the top N cards, exile one face down, then later you may play it for free if a condition is met."},
        "horsemanship":{"name":"Horsemanship","description":"This creature can be blocked only by creatures with horsemanship."},
        "imprint":{"name":"Imprint","description":"Exiles a card to grant additional effects to this permanent."},
        "improvise":{"name":"Improvise","description":"Your artifacts can help cast this spell. Each artifact you tap while casting it pays for {1}."},
        "incubate":{"name":"Incubate","description":"Create an Incubator token with N +1/+1 counters and \"{2}: Transform this artifact.\""},
        "indestructible":{"name":"Indestructible","description":"Effects that say \"destroy\" don’t destroy this permanent, and lethal damage doesn’t destroy it."},
        "infect":{"name":"Infect","description":"This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters."},
        "ingest":{"name":"Ingest","description":"Whenever this creature deals combat damage to a player, that player exiles the top card of their library."},
        "intimidate":{"name":"Intimidate","description":"This creature can be blocked only by artifact creatures and/or creatures that share a color with it."},
        "investigate":{"name":"Investigate","description":"Create a Clue token with \"{2}, Sacrifice this artifact: Draw a card.\""},
        "join forces":{"name":"Join forces","description":"Each player may pay any amount of mana; effects scale with total paid."},
        "jump-start":{"name":"Jump-start","description":"You may cast this spell from your graveyard by discarding a card in addition to paying its other costs."},
        "kicker":{"name":"Kicker","description":"You may pay an additional cost as you cast this spell for an extra effect."},
        "kinship":{"name":"Kinship","description":"At upkeep, reveal the top card; if it shares a type with this, you get an effect."},
        "landfall":{"name":"Landfall","description":"Triggers when a land enters under your control."},
        "landwalk":{"name":"Landwalk","description":"This creature can’t be blocked as long as defending player controls a land of the stated type."},
        "learn":{"name":"Learn","description":"You may reveal a Lesson card you own from outside the game and put it into your hand, or discard a card to draw a card."},
        "level up":{"name":"Level up","description":"{cost}: Put a level counter on this. Activate only as a sorcery. Abilities and power/toughness change at listed levels."},
        "lieutenant":{"name":"Lieutenant","description":"Bonus while you control your commander."},
        "lifelink":{"name":"Lifelink","description":"Damage dealt by this creature also causes you to gain that much life."},
        "living weapon":{"name":"Living weapon","description":"When this Equipment enters the battlefield, create a 0/0 black Germ creature token, then attach this to it."},
        "madness":{"name":"Madness","description":"If you discard this card, discard it into exile. You may cast it for its madness cost."},
        "magecraft":{"name":"Magecraft","description":"Triggers when you cast or copy an instant or sorcery."},
        "manifest":{"name":"Manifest","description":"Put the top card of your library onto the battlefield face down as a 2/2 creature. You may turn it face up if it’s a creature card."},
        "megamorph":{"name":"Megamorph","description":"As morph, but when turned face up, put a +1/+1 counter on it."},
        "meld":{"name":"Meld","description":"Two specific cards you own may meld into one oversized back-face permanent when conditions are met."},
        "melee":{"name":"Melee","description":"Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat."},
        "menace":{"name":"Menace","description":"This creature can’t be blocked except by two or more creatures."},
        "mentor":{"name":"Mentor","description":"Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power."},
        "metalcraft":{"name":"Metalcraft","description":"Turns on if you control three or more artifacts."},
        "mill":{"name":"Mill","description":"Put the top N cards of a library into its owner’s graveyard."},
        "miracle":{"name":"Miracle","description":"You may cast this card for its miracle cost when you draw it if it’s the first card you drew this turn."},
        "modular":{"name":"Modular","description":"This creature enters with N +1/+1 counters. When it dies, you may put its counters on target artifact creature."},
        "monstrosity":{"name":"Monstrosity","description":"If this creature isn’t monstrous, put N +1/+1 counters on it and it becomes monstrous."},
        "morbid":{"name":"Morbid","description":"Bonus if a creature died this turn."},
        "morph":{"name":"Morph","description":"You may cast this card face down as a 2/2 for {3}. Turn it face up any time for its morph cost."},
        "multikicker":{"name":"Multikicker","description":"You may pay the kicker cost any number of times as you cast this spell; it gets additional effects per time kicked."},
        "mutate":{"name":"Mutate","description":"If you cast this spell for its mutate cost, put it over or under target non-Human creature you own; they become one creature with the top card’s characteristics and all abilities of both."},
        "myriad":{"name":"Myriad","description":"Whenever this creature attacks, for each opponent other than defending player, create a tapped and attacking token copy that’s attacking that opponent or a planeswalker they control; exile the tokens at end of combat."},
        "nightbound":{"name":"Nightbound","description":"If it’s night, this face is active. If a player casts two or more spells during their turn, it becomes day next turn."},
        "ninjutsu":{"name":"Ninjutsu","description":"{cost}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking."},
        "offering":{"name":"Offering","description":"You may cast this any time you could cast an instant by sacrificing a [type] and paying the difference in mana costs between this and the sacrificed [type]."},
        "outlast":{"name":"Outlast","description":"{cost}, {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery."},
        "overload":{"name":"Overload","description":"You may cast this spell for its overload cost. If you do, replace each instance of \"target\" with \"each\"."},
        "pack tactics":{"name":"Pack tactics","description":"Triggers when your attackers have total power 6 or greater."},
        "parley":{"name":"Parley","description":"Each player reveals the top card; effects scale on what’s revealed."},
        "partner with":{"name":"Partner with","description":"When one enters, you may search your library for the named partner card and put it into your hand; those two can be your commanders."},
        "partner":{"name":"Partner","description":"You can have two commanders if both have partner."},
        "persist":{"name":"Persist","description":"When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner’s control with a -1/-1 counter."},
        "phasing":{"name":"Phasing","description":"This permanent regularly phases in or out. While phased out, it’s treated as though it doesn’t exist."},
        "plot":{"name":"Plot","description":"You may pay the plot cost and exile this card from your hand as a sorcery. Cast it on a later turn without paying its mana cost."},
        "poisonous":{"name":"Poisonous","description":"Whenever this creature deals combat damage to a player, that player gets N poison counters."},
        "populate":{"name":"Populate","description":"Create a token that’s a copy of a creature token you control."},
        "proliferate":{"name":"Proliferate","description":"Choose any number of permanents and/or players with counters; give each another counter of a kind already there."},
        "protection":{"name":"Protection","description":"Protection from [quality]: It can’t be targeted, dealt damage, enchanted/equipped, or blocked by anything with that quality."},
        "prototype":{"name":"Prototype","description":"You may cast this artifact creature for its prototype cost with different color, power, and toughness."},
        "provoke":{"name":"Provoke","description":"Whenever this creature attacks, you may have target creature defending player controls untap and block it if able."},
        "prowess":{"name":"Prowess","description":"Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn."},
        "radiance":{"name":"Radiance","description":"Spreads effects to permanents that share a color with the target."},
        "raid":{"name":"Raid","description":"Bonus if you attacked with a creature this turn."},
        "rally":{"name":"Rally","description":"Triggers whenever an Ally enters the battlefield under your control."},
        "rampage":{"name":"Rampage","description":"Whenever this creature becomes blocked, it gets +N/+N until end of turn for each creature beyond the first assigned to block it."},
        "ravenous":{"name":"Ravenous","description":"This creature enters with X +1/+1 counters. If X is 5 or more, draw a card when it enters."},
        "reach":{"name":"Reach","description":"This creature can block creatures with flying."},
        "read ahead":{"name":"Read ahead","description":"As this Saga enters, choose a chapter to start on; previously skipped chapter abilities don’t trigger."},
        "rebound":{"name":"Rebound","description":"If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, cast it from exile without paying its mana cost."},
        "reconfigure":{"name":"Reconfigure","description":"Attach or detach this Equipment Creature for its reconfigure cost; while attached it isn’t a creature."},
        "recover":{"name":"Recover","description":"When a creature is put into your graveyard from the battlefield, you may pay the recover cost. If you do, return this card from your graveyard to your hand; otherwise exile this card."},
        "regenerate":{"name":"Regenerate","description":"The next time this permanent would be destroyed this turn, instead tap it, remove all damage from it, and remove it from combat."},
        "renown":{"name":"Renown","description":"When this creature deals combat damage to a player, if it isn’t renowned, put N +1/+1 counters on it and it becomes renowned."},
        "replicate":{"name":"Replicate","description":"When you cast this spell, copy it for each time you paid its replicate cost; you may choose new targets."},
        "retrace":{"name":"Retrace","description":"You may cast this card from your graveyard by discarding a land card in addition to paying its other costs."},
        "revolt":{"name":"Revolt","description":"Bonus if a permanent you controlled left the battlefield this turn."},
        "riot":{"name":"Riot","description":"This creature enters with your choice of a +1/+1 counter or haste."},
        "saddle":{"name":"Saddle","description":"Saddle N: Tap any number of other creatures you control with total power N or more: This Mount becomes a creature until end of turn."},
        "scavenge":{"name":"Scavenge","description":"Exile this creature card from your graveyard: Put a number of +1/+1 counters equal to its power on target creature. Activate only as a sorcery."},
        "scry":{"name":"Scry","description":"Scry N: Look at the top N cards of your library; put any number on the bottom and the rest on top in any order."},
        "shadow":{"name":"Shadow","description":"This creature can block or be blocked only by creatures with shadow."},
        "shield counter":{"name":"Shield counter","description":"If a permanent with a shield counter would be dealt damage or destroyed, remove a shield counter from it instead."},
        "shroud":{"name":"Shroud","description":"This permanent can’t be the target of any spells or abilities."},
        "skulk":{"name":"Skulk","description":"This creature can’t be blocked by creatures with greater power."},
        "soulbond":{"name":"Soulbond","description":"You may pair this creature with another unpaired creature when either enters. They remain paired as long as you control both and get the listed bonus."},
        "spectacle":{"name":"Spectacle","description":"You may cast this spell for its spectacle cost if an opponent lost life this turn."},
        "spell mastery":{"name":"Spell mastery","description":"Bonus if two or more instants and/or sorceries are in your graveyard."},
        "splice":{"name":"Splice onto Arcane","description":"As you cast an Arcane spell, you may reveal this card and pay its splice cost; add its text to that spell."},
        "split second":{"name":"Split second","description":"As long as this spell is on the stack, players can’t cast spells or activate abilities that aren’t mana abilities."},
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
        "tribute":{"name":"Tribute","description":"As this creature enters, an opponent may put N +1/+1 counters on it. When it enters, if tribute wasn’t paid, a specified effect happens."},
        "undaunted":{"name":"Undaunted","description":"This spell costs {1} less to cast for each opponent."},
        "undergrowth":{"name":"Undergrowth","description":"Scales with the number of creature cards in your graveyard."},
        "undying":{"name":"Undying","description":"When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner’s control with a +1/+1 counter."},
        "unearth":{"name":"Unearth","description":"Return this card from your graveyard to the battlefield. It gains haste. Exile it at the next end step or if it would leave the battlefield."},
        "unleash":{"name":"Unleash","description":"You may have this creature enter the battlefield with a +1/+1 counter on it. It can’t block as long as it has a +1/+1 counter on it."},
        "valiant":{"name":"Valiant","description":"Triggers the first time each turn a creature becomes the target of a spell or ability you control."},
        "vanishing":{"name":"Vanishing","description":"This permanent enters with N time counters. At the beginning of your upkeep, remove one. When you can’t, sacrifice it."},
        "venture into the dungeon":{"name":"Venture into the dungeon","description":"Move your marker into the next room of a dungeon and trigger its room ability."},
        "vigilance":{"name":"Vigilance","description":"Attacking doesn’t cause this creature to tap."},
        "ward":{"name":"Ward","description":"Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost."},
        "warp":{"name":"Warp","description":"You may cast this from your hand for its warp cost. If you do, it’s exiled at the beginning of the next end step; you may cast it from exile later."},
        "waterbend":{"name":"Waterbending","description":"While paying a waterbend cost, you can tap your artifacts and creatures to help. Each one pays for {1}."},
        "will of the council":{"name":"Will of the council","description":"Players vote for outcomes; the vote result determines the effect."},
        "wither":{"name":"Wither","description":"This creature deals damage to creatures in the form of -1/-1 counters."},
    },
    getCurrentViewerSeat: function() {
        if (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function') {
            return GameCore.getSelectedPlayer();
        }
        return null;
    },
    canViewerSeeFaceDownCard: function(card, viewerId = null) {
        if (!card) {
            return false;
        }
        if (!this.isFaceDownCard(card)) {
            return true;
        }
        const resolvedViewer = viewerId || this.getCurrentViewerSeat();
        if (!resolvedViewer || resolvedViewer === 'spectator') {
            return false;
        }
        const ownerId = card.face_down_owner || card.face_down_owner_id || card.faceDownOwner || card.faceDownOwnerId;
        if (!ownerId) {
            return false;
        }
        return ownerId.toLowerCase() === String(resolvedViewer).toLowerCase();
    },
    _buildMaskedCardData: function(card, displayName = 'Face-down Card') {
        if (!card) {
            return null;
        }
        const masked = {
            ...card,
            name: displayName,
            oracle_text: '',
            text: '',
            type_line: 'Face-down Card',
            image_url: null,
            card_faces: []
        };
        return masked;
    },
    isFaceDownCard: function(card) {
        if (!card) return false;
        const name = (card.name || '').toLowerCase();
        const typeLine = (card.type_line || card.typeLine || '').toLowerCase();
        const setCode = (card.set || card.set_code || card.setCode || '').toLowerCase();
        const explicitFlag = card.face_down || card.is_face_down || card.faceDown;
        const manifestOrMorphToken = name === 'manifest' || name === 'morph' || (typeLine.includes('manifest') && card.is_token);
        const mentionsFaceDown = typeLine.includes('face-down') || typeLine.includes('face down');
        const isMueFaceDown = setCode === 'mue';
        return Boolean(explicitFlag || manifestOrMorphToken || mentionsFaceDown || isMueFaceDown);
    },

    /**
     * Check if a card is a creature (face-down cards are always creatures)
     */
    isCreatureCard: function(card) {
        if (!card) return false;
        if (this.isFaceDownCard(card)) return true;
        const typeLine = (card.type_line || card.typeLine || card.card_type || card.cardType || '').toLowerCase();
        if (typeLine.includes('creature')) return true;
        const customTypes = card.custom_types || card.customTypes;
        if (Array.isArray(customTypes) && customTypes.some(t => String(t).toLowerCase().includes('creature'))) return true;
        return false;
    },

    getSafeImageUrl: function(card, options = {}) {
        if (!card) return null;

        const viewerId = options.viewerId || this.getCurrentViewerSeat();
        const ignoreFaceDown = Boolean(options.ignoreFaceDown);
        const canRevealFaceDown = ignoreFaceDown || this.canViewerSeeFaceDownCard(card, viewerId);
        const treatAsFaceDown = this.isFaceDownCard(card) && !canRevealFaceDown;
        const baseImage = card.image_url || card.image;

        // Allow back-face images for double-faced cards
        if (card.is_double_faced && card.card_faces && card.card_faces.length > 1) {
            const currentFace = card.current_face || 0;
            if (currentFace < card.card_faces.length && card.card_faces[currentFace].image_url) {
                if (treatAsFaceDown) {
                    return CARD_BACK_IMAGE;
                }
                return card.card_faces[currentFace].image_url;
            }
        }

        if (treatAsFaceDown) {
            return CARD_BACK_IMAGE;
        }

        if (!baseImage) {
            return null;
        }

        // For single-faced cards, skip generic "/back/" images unless it's an intentional face-down card
        if (baseImage.includes("/back/") && !card.is_double_faced) {
            return null;
        }

        return baseImage;
    },


    preloadCardImages: function(cards) {
        if (!cards || !Array.isArray(cards)) return;
        cards.forEach(card => {
            const imageUrl = this.getSafeImageUrl(card);
            if (imageUrl) {
                const img = new Image();
                img.src = imageUrl;
            }
        });
    },

    buildSearchIndex: function(card) {
        if (!card) {
            return '';
        }

        const fragments = [];
        const push = (value) => {
            if (value) {
                fragments.push(String(value).toLowerCase());
            }
        };

        push(card.name);
        push(card.type_line || card.typeLine);
        push(card.oracle_text || card.text);

        if (Array.isArray(card.keywords) && card.keywords.length) {
            push(card.keywords.join(' '));
        }

        if (Array.isArray(card.subtypes) && card.subtypes.length) {
            push(card.subtypes.join(' '));
        }

        if (Array.isArray(card.card_faces)) {
            card.card_faces.forEach((face) => {
                if (!face) {
                    return;
                }
                push(face.name);
                push(face.type_line || face.typeLine);
                push(face.oracle_text || face.text);
                if (Array.isArray(face.keywords)) {
                    push(face.keywords.join(' '));
                }
            });
        }

        const combined = fragments.join(' ').replace(/\s+/g, ' ').trim();
        return combined;
    },

    computeEffectivePowerToughness: function(card) {
        if (!card) {
            return null;
        }

        const normalize = (value) => {
            if (value === undefined || value === null) {
                return null;
            }
            const text = String(value).trim();
            return text.length ? text : null;
        };

        const isNumeric = (text) => /^-?\d+$/.test(text);

        const basePowerRaw = normalize(card.power);
        const baseToughnessRaw = normalize(card.toughness);

        const overridePowerRaw = normalize(
            card.current_power ?? card.currentPower ??
            card.power_override ?? card.powerOverride ??
            card.effective_power ?? card.effectivePower ??
            card.display_power ?? card.displayPower ??
            card.modified_power ?? card.modifiedPower ?? null
        );

        const overrideToughnessRaw = normalize(
            card.current_toughness ?? card.currentToughness ??
            card.toughness_override ?? card.toughnessOverride ??
            card.effective_toughness ?? card.effectiveToughness ??
            card.display_toughness ?? card.displayToughness ??
            card.modified_toughness ?? card.modifiedToughness ?? null
        );

        const displayPowerText = overridePowerRaw && isNumeric(overridePowerRaw)
            ? overridePowerRaw
            : (basePowerRaw && isNumeric(basePowerRaw) ? basePowerRaw : null);

        const displayToughnessText = overrideToughnessRaw && isNumeric(overrideToughnessRaw)
            ? overrideToughnessRaw
            : (baseToughnessRaw && isNumeric(baseToughnessRaw) ? baseToughnessRaw : null);

        if (!displayPowerText || !displayToughnessText) {
            return null;
        }

        const hasModification = (overridePowerRaw !== null && overridePowerRaw !== basePowerRaw) ||
            (overrideToughnessRaw !== null && overrideToughnessRaw !== baseToughnessRaw);

        return {
            basePowerText: basePowerRaw,
            baseToughnessText: baseToughnessRaw,
            displayPowerText,
            displayToughnessText,
            hasModification
        };
    },

    generatePowerToughnessOverlay: function(card) {
        // For face-down cards hidden from the viewer, show 2/2 (standard Morph stats)
        if (this.isFaceDownCard(card)) {
            return `
            <div class="card-pt-overlay"
                data-pt-base="2/2"
                data-pt-value="2/2">
                <span class="card-pt-value">2</span>/<span class="card-pt-value">2</span>
            </div>
        `;
        }

        const stats = this.computeEffectivePowerToughness(card);
        if (!stats) {
            return '';
        }

        const powerText = GameUtils.escapeHtml(stats.displayPowerText);
        const toughnessText = GameUtils.escapeHtml(stats.displayToughnessText);
        const basePowerText = stats.basePowerText ? GameUtils.escapeHtml(stats.basePowerText) : '';
        const baseToughnessText = stats.baseToughnessText ? GameUtils.escapeHtml(stats.baseToughnessText) : '';
        const dataBase = basePowerText || baseToughnessText
            ? `${basePowerText}/${baseToughnessText}`
            : '';
        const dataValue = `${powerText}/${toughnessText}`;
        const overlayClass = stats.hasModification
            ? 'card-pt-overlay card-pt-overlay-modified'
            : 'card-pt-overlay';

        return `
            <div class="${overlayClass}"
                data-pt-base="${dataBase}"
                data-pt-value="${dataValue}">
                <span class="card-pt-value">${powerText}</span>/<span class="card-pt-value">${toughnessText}</span>
            </div>
        `;
    },

    _computeCardVisualState: function(card, zone = 'unknown', isOpponent = false) {
        const isTapped = Boolean(card?.tapped);
        const isTargeted = Boolean(card?.targeted);
        const isAttacking = Boolean(card?.attacking);
        const isBlocking = Boolean(card?.blocking);
        const gameState = (typeof GameCore !== 'undefined' && typeof GameCore.getGameState === 'function')
            ? GameCore.getGameState()
            : null;
        const inCombatPhase = ['attack', 'block', 'damage'].includes(
            (gameState?.phase || '').toLowerCase()
        );
        const combatState = gameState?.combat_state || {};
        const pendingBlockers = combatState && typeof combatState.pending_blockers === 'object'
            ? combatState.pending_blockers
            : {};
        const combatStep = combatState?.step || null;
        const frontendCombatMode = typeof GameCombat !== 'undefined' ? GameCombat.combatMode : null;
        const isDeclaringAttackers =
            combatStep === 'declare_attackers' || frontendCombatMode === 'declaring_attackers';
        const isPendingBlocker = Object.prototype.hasOwnProperty.call(
            pendingBlockers,
            card?.unique_id
        );

        const suppressTappedVisual =
            inCombatPhase &&
            isTapped &&
            (isAttacking || isBlocking || isPendingBlocker) &&
            isDeclaringAttackers;

        const classes = {
            tapped: isTapped && !suppressTappedVisual,
            combatTapped: inCombatPhase && isAttacking && isTapped,
            targeted: isTargeted,
            attacking: isAttacking,
            blocking: isBlocking
        };

        let transformValue = '';
        if (isAttacking) {
            const transforms = [];
            const translateY = isOpponent ? 20 : -20;
            if (translateY !== 0) {
                transforms.push(`translateY(${translateY}px)`);
            }
            if (isTapped && !suppressTappedVisual) {
                transforms.push('rotate(90deg)');
            }
            if (transforms.length) {
                transformValue = transforms.join(' ');
            }
        }

        return {
            classes,
            data: {
                isTapped,
                isTargeted,
                isAttacking,
                isBlocking
            },
            transformValue,
            styleText: transformValue ? `transform: ${transformValue};` : ''
        };
    },

    renderCardWithLoadingState: function(card, cardClass = 'card-mini', showTooltip = true, zone = 'unknown', isOpponent = false, index = 0, playerId = null, options = {}) {
        const cardId = card.id || card.name;
        const cardName = card.name || 'Unknown';
        const viewerSeat = this.getCurrentViewerSeat();
        const isFaceDown = this.isFaceDownCard(card);
        const maskForViewer = isFaceDown && !this.canViewerSeeFaceDownCard(card, viewerSeat);
        const displayCardLabel = isFaceDown ? 'Face-down Card' : cardName;
        const actualImageUrl = this.getSafeImageUrl(card, { ignoreFaceDown: true });
        const thumbnailImageUrl = isFaceDown ? CARD_BACK_IMAGE : actualImageUrl;
        const previewImageUrl = maskForViewer ? CARD_BACK_IMAGE : actualImageUrl;
        const cardDataForAttr = maskForViewer ? this._buildMaskedCardData(card, displayCardLabel) : card;
        const serializedCardData = JSON.stringify(cardDataForAttr).replace(/'/g, "&#39;");
        const visualState = this._computeCardVisualState(card, zone, isOpponent);
        const stateClasses = visualState.classes;
        const stateFlags = visualState.data;
        const combatTappedClass = stateClasses.combatTapped ? ' combat-tapped' : '';
        const tappedClass = stateClasses.tapped ? ' tapped' : '';
        const targetedClass = stateClasses.targeted ? ' targeted' : '';
        const attackingClass = stateClasses.attacking ? ' attacking-creature' : '';
        const blockingClass = stateClasses.blocking ? ' blocking-creature' : '';
        const uniqueCardId = card.unique_id;

        // Resolve card type - face-down cards are ONLY creatures
        const customTypes = this.getCustomTypes(card);
        let typeLine = '';
        let primaryCardType = '';

        if (this.isFaceDownCard(card)) {
            // Face-down = creature only (unless custom types override)
            typeLine = customTypes.length ? customTypes.join(' ').toLowerCase() : 'creature';
            primaryCardType = 'creature';
            if (customTypes.length) {
                const priorityOrder = ['creature', 'land', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery'];
                const normalizedTypes = customTypes.map(type => type.toLowerCase());
                const prioritized = priorityOrder.find(type => normalizedTypes.includes(type));
                primaryCardType = prioritized || customTypes[0];
            }
        } else {
            // Normal type resolution
            const typePieces = [];
            const pushType = (value) => {
                if (value) {
                    typePieces.push(String(value));
                }
            };
            pushType(card.card_type);
            pushType(card.cardType);
            pushType(card.type_line);
            pushType(card.typeLine);
            pushType(card.subtype);
            if (Array.isArray(card.types)) {
                card.types.forEach(pushType);
            }
            if (Array.isArray(card.subtypes)) {
                card.subtypes.forEach(pushType);
            }
            if (Array.isArray(card.supertypes)) {
                card.supertypes.forEach(pushType);
            }
            if (Array.isArray(card.card_faces)) {
                card.card_faces.forEach(face => {
                    pushType(face?.type_line);
                    pushType(face?.typeLine);
                    if (Array.isArray(face?.types)) {
                        face.types.forEach(pushType);
                    }
                    if (Array.isArray(face?.subtypes)) {
                        face.subtypes.forEach(pushType);
                    }
                });
            }
            if (customTypes.length) {
                customTypes.forEach(pushType);
            }
            typeLine = typePieces.join(' ').toLowerCase();

            if (customTypes.length) {
                const priorityOrder = ['creature', 'land', 'planeswalker', 'artifact', 'enchantment', 'instant', 'sorcery'];
                const normalizedTypes = customTypes.map(type => type.toLowerCase());
                const prioritized = priorityOrder.find(type => normalizedTypes.includes(type));
                primaryCardType = prioritized || customTypes[0];
            } else if (typeLine.includes('creature')) {
                primaryCardType = 'creature';
            } else if (typeLine.includes('land')) {
                primaryCardType = 'land';
            } else if (typeLine.includes('planeswalker')) {
                primaryCardType = 'planeswalker';
            } else if (typeLine.includes('artifact')) {
                primaryCardType = 'artifact';
            } else if (typeLine.includes('enchantment')) {
                primaryCardType = 'enchantment';
            } else if (typeLine.includes('instant')) {
                primaryCardType = 'instant';
            } else if (typeLine.includes('sorcery')) {
                primaryCardType = 'sorcery';
            }
        }

        const controllerId = card.controller_id || card.controllerId || card.owner_id || card.ownerId || '';
        const ownerId = card.owner_id || card.ownerId || '';

        const dataCardId = GameUtils.escapeHtml(cardId || '');
        const dataCardName = GameUtils.escapeHtml((!maskForViewer ? cardName : displayCardLabel) || '');
        const dataImageUrl = GameUtils.escapeHtml(previewImageUrl || '');
        const dataUniqueId = GameUtils.escapeHtml(uniqueCardId || '');
        const dataZone = GameUtils.escapeHtml(zone || '');
        const dataCardType = GameUtils.escapeHtml(primaryCardType || '');
        const dataCardOwner = GameUtils.escapeHtml(ownerId || '');
        const dataCardController = GameUtils.escapeHtml(controllerId || '');
        const attachmentHostId = card.attached_to || card.attachedTo || '';
        const parsedAttachmentOrder = (() => {
            const raw = card?.attachment_order ?? card?.attachmentOrder;
            if (Number.isFinite(raw)) {
                return raw;
            }
            const parsed = parseInt(raw, 10);
            return Number.isFinite(parsed) ? parsed : null;
        })();
        const dataAttachmentHost = GameUtils.escapeHtml(attachmentHostId || '');
        const dataAttachmentOrder = parsedAttachmentOrder !== null ? parsedAttachmentOrder : '';
        const searchIndex = GameUtils.escapeHtml(maskForViewer ? 'face-down card' : this.buildSearchIndex(card));
        const jsCardId = JSON.stringify(cardId || '');
        const jsUniqueCardId = JSON.stringify(uniqueCardId || '');
        const zoneAttr = (zone || '').replace(/'/g, "\\'");
        const selectedPlayer = (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function')
            ? GameCore.getSelectedPlayer()
            : null;
        const spectatorView = selectedPlayer === 'spectator';
        const hasReadOnlyOption = options && Object.prototype.hasOwnProperty.call(options, 'readOnly');
        const readOnly = hasReadOnlyOption ? Boolean(options.readOnly) : spectatorView;
        const allowInteractions = !readOnly;
        const disableContextMenu = Boolean(options && options.disableContextMenu);
        const disableDrag = Boolean(options && options.disableDrag);
        const allowDrag = allowInteractions && !disableDrag;

        let onClickAction = '';
        if (allowInteractions && (zone === 'creatures' || zone === 'support' || zone === 'permanents' || zone === 'lands' || zone === 'battlefield')) {
            onClickAction = `onclick='GameCards.handleCardClick(${jsCardId}, ${jsUniqueCardId}, "${zone}"); event.stopPropagation();'`;
        } else if (allowInteractions && zone === 'hand') {
            onClickAction = `onclick='GameActions.playCardFromHand(${jsCardId}, ${jsUniqueCardId}); event.stopPropagation();'`;
        }

        const enableDrop =
            zone === 'battlefield' ||
            zone === 'lands' ||
            zone === 'creatures' ||
            zone === 'support' ||
            zone === 'permanents';
        const dropAttributes = enableDrop
            ? `ondragover="UIZonesManager.handleZoneDragOver(event)" ondragleave="UIZonesManager.handleZoneDragLeave(event)" ondrop="UIZonesManager.handleZoneDrop(event, '${zoneAttr}')"`
            : '';
        const dropAttr = allowDrag ? dropAttributes : '';
        const dragStartAttr = allowDrag ? 'ondragstart="GameCards.handleDragStart(event, this)"' : '';
        const dragEndAttr = allowDrag ? 'ondragend="GameCards.handleDragEnd(event, this)"' : '';
        const allowCardContextMenu = allowInteractions && !disableContextMenu;
        const contextMenuAttr = allowCardContextMenu ? 'oncontextmenu="GameCards.showCardContextMenu(event, this); return false;"' : '';
        
        // Apply transform for attacking creatures, keeping rotation when tapped
        let combinedTransform = visualState.transformValue || '';
        if (options && options.offsetTransform) {
            combinedTransform = combinedTransform
                ? `${combinedTransform} ${options.offsetTransform}`
                : options.offsetTransform;
        }
        const styleParts = [];
        if (combinedTransform) {
            styleParts.push(`transform: ${combinedTransform};`);
        }
        if (options && options.inlineStyle) {
            styleParts.push(String(options.inlineStyle));
        }
        const inlineStyleText = styleParts.join(' ');

        // Generate counters display
        const countersHtml = this.generateCountersHtml(card);
        const powerToughnessHtml = this.generatePowerToughnessOverlay(card);
        const overlayStack = this.generateCardOverlayStack(card);

        return `
            <div class="${cardClass}${tappedClass}${combatTappedClass}${targetedClass}${attackingClass}${blockingClass}" 
                data-card-id="${dataCardId}"
                data-card-unique-id="${dataUniqueId}"
                data-card-name="${dataCardName}"
                data-card-image="${dataImageUrl}"
                data-card-zone="${dataZone}"
                data-card-type="${dataCardType}"
                data-card-owner="${dataCardOwner}"
                data-card-controller="${dataCardController}"
                data-attached-to="${dataAttachmentHost}"
                data-attachment-order="${dataAttachmentOrder}"
                data-card-tapped="${stateFlags.isTapped}"
                data-card-targeted="${stateFlags.isTargeted}"
                data-card-search="${searchIndex}"
                data-card-data='${serializedCardData}'
                data-is-opponent="${isOpponent}"
                data-readonly="${readOnly}"
                style="${inlineStyleText}"
                draggable="${allowDrag ? 'true' : 'false'}"
                ${dragStartAttr}
                ${dropAttr}
                ${onClickAction}
                ${dragEndAttr}
                ${contextMenuAttr}>
                ${thumbnailImageUrl ? `
                    <div class="relative">
                        <img src="${thumbnailImageUrl}" 
                             alt="${displayCardLabel}" 
                             style="opacity: 0; transition: opacity 0.3s ease;"
                             onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="card-fallback" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none;">
                        </div>
                        ${overlayStack}
                        ${countersHtml}
                        ${powerToughnessHtml}
                    </div>
                ` : `
                    <div class="card-fallback relative" aria-label="${displayCardLabel}">
                        ${overlayStack}
                        ${countersHtml}
                        ${powerToughnessHtml}
                    </div>
                `}
            </div>
        `;
    },

    renderCardWithAttachments: function(card, attachments = [], zone = 'battlefield', isOpponent = false, playerId = null) {
        const hostHtml = this.renderCardWithLoadingState(
            card,
            'card-battlefield',
            true,
            zone,
            isOpponent,
            null,
            playerId
        );
        const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
        const hostId = card?.unique_id || card?.uniqueId || '';
        const safeHostId = GameUtils.escapeHtml(hostId || '');
        const visibleAttachments = normalizedAttachments.slice(0, 4);
        const overflowCount = normalizedAttachments.length - visibleAttachments.length;
        const offsetStep = 15;
        const offsetPadding = normalizedAttachments.length
            ? (normalizedAttachments.length * offsetStep) + 20
            : 0;
        const groupStyle = offsetPadding
            ? `style="padding-bottom:${offsetPadding}px; padding-right:${offsetPadding}px;"`
            : '';
        const attachmentHtml = visibleAttachments.map((attachment, index) => {
            return this.renderCardWithLoadingState(
                attachment,
                UIConfig?.CSS_CLASSES?.card?.attachment || 'card-attachment',
                true,
                zone,
                isOpponent,
                index,
                playerId,
                { disableDrag: true }
            );
        }).join('');
        const overflowBadge = overflowCount > 0
            ? `<div class="card-attachment-overflow">+${overflowCount}</div>`
            : '';
        const attachmentsSection = normalizedAttachments.length
            ? `<div class="card-attachment-pile">
                    ${attachmentHtml}
                    ${overflowBadge}
               </div>`
            : '';

        return `
            <div class="card-attachment-group"
                 data-attachment-host="${safeHostId}"
                 data-attachment-count="${normalizedAttachments.length}"
                 ${groupStyle}>
                <div class="card-host">
                    ${hostHtml}
                </div>
                ${attachmentsSection}
            </div>
        `;
    },

    updateCardElementState: function(cardElement, cardData, zone = 'unknown', isOpponent = false) {
        if (!cardElement || !cardData) {
            return;
        }

        const visualState = this._computeCardVisualState(cardData, zone, isOpponent);
        const stateClasses = visualState.classes;
        const stateFlags = visualState.data;

        cardElement.classList.toggle('tapped', Boolean(stateClasses.tapped));
        cardElement.classList.toggle('combat-tapped', Boolean(stateClasses.combatTapped));
        cardElement.classList.toggle('targeted', Boolean(stateClasses.targeted));
        cardElement.classList.toggle('attacking-creature', Boolean(stateClasses.attacking));
        cardElement.classList.toggle('blocking-creature', Boolean(stateClasses.blocking));

        const viewerSeat = this.getCurrentViewerSeat();
        const maskForViewer = this.isFaceDownCard(cardData) && !this.canViewerSeeFaceDownCard(cardData, viewerSeat);
        const maskedData = maskForViewer ? this._buildMaskedCardData(cardData, 'Face-down Card') : cardData;
        const serializedData = JSON.stringify(maskedData).replace(/'/g, "&#39;");
        cardElement.setAttribute('data-card-data', serializedData);
        cardElement.setAttribute('data-card-tapped', stateFlags.isTapped ? 'true' : 'false');
        cardElement.setAttribute('data-card-targeted', stateFlags.isTargeted ? 'true' : 'false');

        if (visualState.transformValue) {
            cardElement.style.transform = visualState.transformValue;
        } else {
            cardElement.style.removeProperty('transform');
        }
    },

    generateCountersHtml: function(card) {
        if (!card.counters || Object.keys(card.counters).length === 0) {
            return '';
        }

        let countersHtml = '<div class="card-counters">';
        
        // Sort counters to show loyalty first for planeswalkers
        const counterTypes = Object.keys(card.counters).sort((a, b) => {
            if (a === 'loyalty') return -1;
            if (b === 'loyalty') return 1;
            return a.localeCompare(b);
        });

        for (const counterType of counterTypes) {
            const count = card.counters[counterType];
            if (count > 0) {
                const counterClass = this.getCounterClass(counterType);
                
                // Special handling for +1/+1 and -1/-1 counters
                if (counterType === '+1/+1') {
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            <span class="counter-value">+${count}/+${count}</span>
                        </div>
                    `;
                } else if (counterType === '-1/-1') {
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            <span class="counter-value">-${count}/-${count}</span>
                        </div>
                    `;
                } else {
                    // Default handling for other counter types
                    const counterIcon = this.getCounterIcon(counterType);
                    const iconMarkup = counterIcon
                        ? `<span class="counter-icon">${counterIcon}</span>`
                        : `<span class="counter-icon counter-icon-text">${counterType}</span>`;
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            ${iconMarkup}
                            <span class="counter-value">${count}</span>
                        </div>
                    `;
                }
            }
        }
        
        countersHtml += '</div>';
        return countersHtml;
    },

    getCustomKeywords: function(cardData) {
        if (!cardData) {
            return [];
        }

        const source = cardData.custom_keywords || cardData.customKeywords;
        if (!Array.isArray(source)) {
            return [];
        }

        return source
            .map(keyword => String(keyword).trim())
            .filter(keyword => keyword.length > 0);
    },

    getCustomTypes: function(cardData) {
        if (!cardData) {
            return [];
        }

        const source = cardData.custom_types || cardData.customTypes;
        if (!Array.isArray(source)) {
            return [];
        }

        return source
            .map(type => String(type).trim().toLowerCase())
            .filter(type => type.length > 0);
    },

    generateKeywordOverlay: function(card) {
        const keywords = this.getCustomKeywords(card);
        if (!keywords.length) {
            return '';
        }

        const escape = (typeof GameUtils !== 'undefined' && typeof GameUtils.escapeHtml === 'function')
            ? GameUtils.escapeHtml
            : (value) => value;
        const maxVisible = 3;
        const visible = keywords.slice(0, maxVisible).map(escape);
        const extraCount = keywords.length - visible.length;
        const suffix = extraCount > 0 ? ` +${extraCount}` : '';

        return `
            <div class="card-keyword-overlay" title="${escape(keywords.join(', '))}">
                ${visible.join(' • ')}${suffix}
            </div>
        `;
    },

    generateTypeOverlay: function(card) {
        const types = this.getCustomTypes(card);
        if (!types.length) {
            return '';
        }

        const escape = (typeof GameUtils !== 'undefined' && typeof GameUtils.escapeHtml === 'function')
            ? GameUtils.escapeHtml
            : (value) => value;
        const displayTypes = types.map(type => {
            const label = type.charAt(0).toUpperCase() + type.slice(1);
            return escape(label);
        });

        return `
            <div class="card-type-overlay" title="Custom types: ${escape(displayTypes.join(', '))}">
                ${displayTypes.join(' • ')}
            </div>
        `;
    },

    generateCardOverlayStack: function(card) {
        const keywordOverlay = this.generateKeywordOverlay(card);
        const typeOverlay = this.generateTypeOverlay(card);
        if (!keywordOverlay && !typeOverlay) {
            return '';
        }

        return `
            <div class="card-overlay-stack">
                ${keywordOverlay}
                ${typeOverlay}
            </div>
        `;
    },

    getCounterIcon: function(counterType) {
        if (!counterType) {
            return null;
        }

        const icons = {
            'loyalty': '🛡️',
            '+1/+1': '💪',
            '-1/-1': '💀',
            'charge': '⚡',
            'poison': '☠️',
            'energy': '⚡',
            'experience': '🎓',
            'treasure': '💰',
            'food': '🍖',
            'clue': '🔍',
            'blood': '🩸',
            'oil': '🛢️'
        };

        if (Object.prototype.hasOwnProperty.call(icons, counterType)) {
            return icons[counterType];
        }

        const normalized = typeof counterType === 'string'
            ? counterType.toLowerCase()
            : counterType;
        if (normalized && Object.prototype.hasOwnProperty.call(icons, normalized)) {
            return icons[normalized];
        }

        return null;
    },

    getCounterClass: function(counterType) {
        const classes = {
            'loyalty': 'counter-loyalty',
            '+1/+1': 'counter-plus',
            '-1/-1': 'counter-minus',
            'charge': 'counter-charge',
            'poison': 'counter-poison'
        };
        return classes[counterType] || 'counter-generic';
    },

    findCardData: function(cardId, cardName) {
        const nodes = Array.from(document.querySelectorAll('[data-card-data]'));
        const parse = (raw) => {
            if (!raw) return null;
            try {
                return JSON.parse(
                    raw
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                );
            } catch (error) {
                console.warn('Failed to parse card data attribute', error);
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

        if (cardName) {
            const byName = nodes.find(el => el.getAttribute('data-card-name') === cardName);
            if (byName) {
                const data = parse(byName.getAttribute('data-card-data'));
                if (data) return data;
            }
        }

        return null;
    },

    renderKeywordDetails: function(cardData) {
        const keywords = this.extractKeywordsFromCard(cardData);
        if (!keywords.length) {
            return ``;
        }

        const list = keywords.map(info => `
            <div class="card-keyword-entry">
                <div class="card-keyword-name">${info.name}</div>
                <div class="card-keyword-description">${info.description}</div>
            </div>
        `).join('');

        return `
            <div class="card-keyword-section">
                <div class="card-keyword-list">
                    ${list}
                </div>
            </div>
        `;
    },

    extractKeywordsFromCard: function(cardData) {
        if (!cardData) {
            return [];
        }

        const keywordSet = new Set();
        const gatherKeywords = (collection) => {
            if (!Array.isArray(collection)) return;
            collection.forEach(keyword => {
                if (keyword) {
                    keywordSet.add(String(keyword).toLowerCase());
                }
            });
        };

        gatherKeywords(cardData.keywords);
        gatherKeywords(cardData.custom_keywords || cardData.customKeywords);

        const textFragments = [];
        const pushText = (value) => {
            if (value) {
                textFragments.push(String(value));
            }
        };

        pushText(cardData.oracle_text || cardData.text);
        pushText(cardData.type_line || cardData.typeLine);

        if (Array.isArray(cardData.card_faces)) {
            cardData.card_faces.forEach(face => {
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

        Object.entries(this.keywordDescriptions).forEach(([key, info]) => {
            if (seen.has(key)) {
                return;
            }

            const names = [info.name, key].concat(info.aliases || []);
            let matched = names.some(name => keywordSet.has(String(name).toLowerCase()));

            if (!matched && normalizedText) {
                if (info.patterns && info.patterns.length) {
                    matched = info.patterns.some(pattern => {
                        try {
                            return new RegExp(pattern, 'i').test(fullText);
                        } catch (error) {
                            return false;
                        }
                    });
                } else {
                    matched = names.some(name => buildRegex(name).test(fullText));
                }
            }

            if (matched) {
                const keywordInfo = { ...info };

                if (key === 'ward') {
                    const match = fullText.match(/Ward\s*(?:—|-)?\s*({[^}]+}|[^\n]+)/i);
                    if (match) {
                        const rawCost = (match[1] || match[0] || '').replace(/Ward/i, '').replace(/—|-/g, '').trim();
                        const wardCost = rawCost.length ? rawCost : 'cost';
                        keywordInfo.description = `Ward — ${wardCost} (Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost.)`;
                    }
                }

                if (key === 'equip') {
                    const match = fullText.match(/Equip\s*({[^}]+})/i);
                    if (match) {
                        keywordInfo.description = `Equip ${match[1]} — Attach this Equipment to target creature you control. Activate only as a sorcery.`;
                    }
                }

                found.push(keywordInfo);
                const normalizedNames = names.map(name => String(name).toLowerCase());
                normalizedNames.forEach(name => seen.add(name));
                seen.add(key);
            }
        });

        keywordSet.forEach(keyword => {
            const normalized = String(keyword).toLowerCase();
            if (seen.has(normalized)) {
                return;
            }

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
    },

    showCardPreview: function(cardId, cardName, imageUrl, event = null, cardData = null) {
        const existingPreview = document.getElementById('card-preview-modal');
        if (existingPreview) {
            existingPreview.remove();
            this.removeCardPreviewListeners();
        }

        const preview = document.createElement('div');
        preview.id = 'card-preview-modal';
        preview.className = 'card-preview-modal show';

        const resolvedCardData = cardData || this.findCardData(cardId, cardName);
        const keywordDetails = this.renderKeywordDetails(resolvedCardData);
        const safeCardName = GameUtils.escapeHtml(cardName || 'Unknown');
        const safeImageUrl = GameUtils.escapeHtml(imageUrl || '');

        preview.innerHTML = `
            <div class="card-preview-content">
                ${imageUrl ? `
                    <img src="${safeImageUrl}" alt="${safeCardName}" class="card-preview-image" />
                ` : `
                    <div class="card-preview-fallback">
                        <div class="card-name">${safeCardName}</div>
                    </div>
                `}
                <div class="card-preview-details">
                    <h3>${safeCardName}</h3>
                    ${keywordDetails}
                </div>
            </div>
        `;

        document.body.appendChild(preview);
        this.addCardPreviewListeners();

        const hasPointerPosition = event && typeof event.clientX === 'number' && typeof event.clientY === 'number';
        if (hasPointerPosition) {
            preview.classList.remove('card-preview-modal-centered');
            this.positionCardPreview(preview, event);
        } else {
            preview.classList.add('card-preview-modal-centered');
        }
    },

    positionCardPreview: function(previewElement, event) {
        if (!previewElement || !event) {
            return;
        }

        const previewRect = previewElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = event.clientX + 150;
        let y = event.clientY - 50;

        if (x + previewRect.width > viewportWidth) {
            x = event.clientX - previewRect.width - 150;
        }
        if (y + previewRect.height > viewportHeight) {
            y = event.clientY - previewRect.height + 50;
        }

        x = Math.max(10, Math.min(x, viewportWidth - previewRect.width - 10));
        y = Math.max(10, Math.min(y, viewportHeight - previewRect.height - 10));

        previewElement.style.position = 'fixed';
        previewElement.style.left = `${x}px`;
        previewElement.style.top = `${y}px`;
        previewElement.style.transform = 'none';
    },

    showCardContextMenu: function(event, cardElement) {
        event.preventDefault();
        this._closeActiveCardPreview();
        this._hoveredCardElement = null;
        this._hoverPreviewPointerEvent = null;
        this._lastContextPosition = {
            x: event?.clientX || 0,
            y: event?.clientY || 0
        };
        this.cancelAttachmentSelection();

        const cardId = cardElement.getAttribute('data-card-id');
        const cardName = cardElement.getAttribute('data-card-name');
        const cardImage = cardElement.getAttribute('data-card-image');
        const cardZone = cardElement.getAttribute('data-card-zone') || 'unknown';
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id') || '';
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const isOpponent = cardElement.getAttribute('data-is-opponent') === 'true';
        const isTargeted = cardElement.classList.contains('targeted');
        const cardTypeAttr = (cardElement.getAttribute('data-card-type') || '').toLowerCase();
        const isSpellCard = cardTypeAttr === 'instant' || cardTypeAttr === 'sorcery';
        const attachedTo = cardElement.getAttribute('data-attached-to') || '';
        const hasAttachmentHost = Boolean(attachedTo && attachedTo.trim().length);
        const attachmentChildren = Array.from(document.querySelectorAll(`[data-attached-to="${uniqueCardId}"]`));
        const hasAttachments = attachmentChildren.length > 0;
        let normalizedZone = (cardZone || '').toLowerCase();
        if (normalizedZone.startsWith('opponent_')) {
            normalizedZone = normalizedZone.replace('opponent_', '');
        }
        const isBattlefieldZone = ['battlefield', 'permanents', 'lands', 'creatures', 'support'].includes(normalizedZone);
        const cardOwnerId = cardElement.getAttribute('data-card-owner') || '';
        const jsCardOwnerId = JSON.stringify(cardOwnerId || '');
        const selectedPlayer = (typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function')
            ? GameCore.getSelectedPlayer()
            : null;
        const isSpectator = selectedPlayer === 'spectator';
        const canControlZones = selectedPlayer === 'player1' || selectedPlayer === 'player2';
        const opponentPlayableZones = ['graveyard', 'exile', 'reveal', 'reveal_zone', 'look', 'look_zone'];
        const canPlayOpponentCard = canControlZones && !isSpectator && isOpponent && opponentPlayableZones.includes(normalizedZone);

        const safeCardName = GameUtils.escapeHtml(cardName || 'Unknown');
        const safeCardImage = GameUtils.escapeHtml(cardImage || '');
        const jsCardId = JSON.stringify(cardId || '');
        const jsCardName = JSON.stringify(cardName || '');
        const jsCardImage = JSON.stringify(cardImage || '');
        const jsCardZone = JSON.stringify(cardZone || 'unknown');
        const jsUniqueCardId = JSON.stringify(uniqueCardId || '');

        const existingMenu = document.getElementById('card-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.id = 'card-context-menu';
        menu.className = 'card-context-menu';
        menu.style.visibility = 'hidden';
        menu.style.position = 'fixed';
        document.body.appendChild(menu);

        const makeHandler = (code) => GameUtils.escapeHtml(code);

        let menuHTML = '';
        if (cardImage) {
            menuHTML += `<div class="card-context-image"><img src="${safeCardImage}" alt="${safeCardName}" /></div>`;
        }

        menuHTML += `<div class="card-context-actions">
            <div class="card-context-header"><h3>${safeCardName}</h3></div>
            <div class="card-context-menu-divider"></div>`;

        const targetAction = isTargeted ? 'Untarget' : 'Target';
        const targetIcon = isTargeted ? '❌' : '🎯';
        menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.toggleCardTarget(${jsUniqueCardId})`)}"><span class="icon">${targetIcon}</span> ${targetAction}</div>`;

        const cardData = JSON.parse(cardElement.getAttribute('data-card-data') || '{}');
        const isTokenCard = Boolean(cardData?.is_token);
        const isDoubleFaced = cardData.is_double_faced && cardData.card_faces && cardData.card_faces.length > 1;
        const isFaceDownCard = Boolean(cardData?.face_down || cardData?.is_face_down || cardData?.faceDown);
        const faceDownOwnerId = cardData?.face_down_owner || cardData?.face_down_owner_id || cardData?.faceDownOwner || cardData?.faceDownOwnerId;
        const isFaceDownOwner = isFaceDownCard && selectedPlayer && faceDownOwnerId && faceDownOwnerId.toLowerCase() === selectedPlayer.toLowerCase();

        if (isDoubleFaced && !isOpponent) {
            const currentFace = cardData.current_face || 0;
            const faceText = currentFace === 0 ? 'Back' : 'Front';
            menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.flipCard(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">🔄</span> Flip to ${faceText}</div>`;
        }

        if (!isOpponent) {
            if (cardZone === 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.playCardFromHand(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">▶️</span> Play Card</div>`;
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.playCardFromHand(${jsCardId}, ${jsUniqueCardId}, { faceDown: true })`)}"><span class="icon">🙈</span> Play Face Down</div>`;
            } else if (cardZone === 'deck') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.performGameAction("play_card_from_library", { unique_id: ${jsUniqueCardId} }); UIZonesManager.closeZoneModal("deck");`)}"><span class="icon">⚔️</span> Put on Battlefield</div>`;
            }

            if (isBattlefieldZone) {
                const tapAction = isTapped ? 'Untap' : 'Tap';
                const tapIcon = isTapped ? '⤴️' : '🔄';
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.tapCard(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">${tapIcon}</span> ${tapAction}</div>`;

                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.duplicateCard(${jsCardId}, ${jsUniqueCardId}, ${jsCardZone})`)}"><span class="icon">🪄</span> Duplicate</div>`;

                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.startAttachmentSelection(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">🧲</span> Attach to other card</div>`;
                if (hasAttachments) {
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.showAttachmentsModal(${jsUniqueCardId}, ${jsCardName})`)}"><span class="icon">👁️</span> Show attached cards</div>`;
                }
                if (hasAttachmentHost) {
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.detachCard(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">🔓</span> Detach</div>`;
                }

                const typeIcon = '🧬';
                const counterIcon = '🔢';
                const powerIcon = '💪';
                menuHTML += `<div class="card-context-menu-divider"></div>`;
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.showTypePopover(${jsUniqueCardId}, ${jsCardId})`)}"><span class="icon">${typeIcon}</span> Add Type</div>`;
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.showCounterPopover(${jsUniqueCardId}, ${jsCardId})`)}"><span class="icon">${counterIcon}</span> Add Counter</div>`;
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.showPowerToughnessPopover(${jsUniqueCardId}, ${jsCardId})`)}"><span class="icon">${powerIcon}</span> Override Power/Toughness</div>`;
            }

            if (isFaceDownCard && isFaceDownOwner && cardZone !== 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.revealFaceDownCard(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">👁️</span> Reveal Card</div>`;
            }

            menuHTML += `<div class="card-context-menu-divider"></div>`;
            if (cardZone !== 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.moveCard(${jsCardId}, ${jsCardZone}, "hand", ${jsUniqueCardId})`)}"><span class="icon">👋</span> Send to Hand</div>`;
            }
            const battlefieldZones = ['reveal', 'reveal_zone', 'look', 'look_zone'];
            if (battlefieldZones.includes(cardZone) && !isTokenCard) {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendToBattlefield(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">⚔️</span> Send to Battlefield</div>`;
            }
            if (isTokenCard) {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.deleteToken(${jsUniqueCardId}, ${jsCardName})`)}"><span class="icon">🗑️</span> Delete Token</div>`;
            } else {
                menuHTML += `
                    <div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendToGraveyard(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">⚰️</span> Send to Graveyard</div>
                    <div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendToExile(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">✨</span> Send to Exile</div>
                    <div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendToTopLibrary(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">⬆️</span> Send to Top Library</div>
                    <div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendToBottomLibrary(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">⬇️</span> Send to Bottom Library</div>`;
            }
            if (cardZone !== 'reveal') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.showInRevealZone(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">👁️</span> Show in Reveal Zone</div>`;
            }
            
            // Bulk actions for specific zones
            if (cardZone === 'hand') {
                menuHTML += `<div class="card-context-menu-divider"></div>`;
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.moveAllHandToReveal()`)}"><span class="icon">👁️</span> Show all Hand in Reveal Zone</div>`;
            }
            if (cardZone === 'reveal' || cardZone === 'reveal_zone') {
                // Count cards in reveal zone
                const gameState = typeof GameCore !== 'undefined' ? GameCore.getGameState() : null;
                const selectedPlayer = typeof GameCore !== 'undefined' ? GameCore.getSelectedPlayer() : null;
                let revealCardCount = 0;
                if (gameState && gameState.players && selectedPlayer && selectedPlayer !== 'spectator') {
                    const playerIndex = selectedPlayer === 'player2' ? 1 : 0;
                    const player = gameState.players[playerIndex];
                    revealCardCount = Array.isArray(player?.reveal_zone) ? player.reveal_zone.length : 0;
                }
                
                if (revealCardCount >= 2) {
                    menuHTML += `<div class="card-context-menu-divider"></div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToHand("reveal")`)}"><span class="icon">👋</span> Send all to Hand</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToBattlefield("reveal")`)}"><span class="icon">⚔️</span> Send all to Battlefield</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToGraveyard("reveal")`)}"><span class="icon">⚰️</span> Send all to Graveyard</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToExile("reveal")`)}"><span class="icon">✨</span> Send all to Exile</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToTopLibrary("reveal")`)}"><span class="icon">🔀</span> Send all to Top Library (random)</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToBottomLibrary("reveal")`)}"><span class="icon">🔀</span> Send all to Bottom Library (random)</div>`;
                }
            }
            if (cardZone === 'look' || cardZone === 'look_zone') {
                // Count cards in look zone
                const gameState = typeof GameCore !== 'undefined' ? GameCore.getGameState() : null;
                const selectedPlayer = typeof GameCore !== 'undefined' ? GameCore.getSelectedPlayer() : null;
                let lookCardCount = 0;
                if (gameState && gameState.players && selectedPlayer && selectedPlayer !== 'spectator') {
                    const playerIndex = selectedPlayer === 'player2' ? 1 : 0;
                    const player = gameState.players[playerIndex];
                    lookCardCount = Array.isArray(player?.look_zone) ? player.look_zone.length : 0;
                }
                
                if (lookCardCount >= 2) {
                    menuHTML += `<div class="card-context-menu-divider"></div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToHand("look")`)}"><span class="icon">👋</span> Send all to Hand</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToGraveyard("look")`)}"><span class="icon">⚰️</span> Send all to Graveyard</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToExile("look")`)}"><span class="icon">✨</span> Send all to Exile</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToTopLibrary("look")`)}"><span class="icon">🔀</span> Send all to Top Library (random)</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToBottomLibrary("look")`)}"><span class="icon">🔀</span> Send all to Bottom Library (random)</div>`;
                    menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendAllZoneToBattlefield("look")`)}"><span class="icon">⚔️</span> Send all to Battlefield</div>`;
                }
            }
        }

        if (canPlayOpponentCard) {
            const zoneLabels = {
                graveyard: 'Graveyard',
                exile: 'Exile',
                reveal: 'Reveal',
                reveal_zone: 'Reveal'
            };
            const zoneLabel = zoneLabels[normalizedZone] || 'Zone';
            menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.playOpponentCardFromZone(${jsCardId}, ${jsUniqueCardId}, ${jsCardZone}, ${jsCardOwnerId})`)}"><span class="icon">🪄</span> Play from ${zoneLabel}</div>`;
        }

        menuHTML += `</div>`;
        menu.innerHTML = menuHTML;

        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let x = event.clientX + 10;
        let y = event.clientY;

        if (x + menuRect.width > viewportWidth) {
            x = event.clientX - menuRect.width - 10;
        }
        if (y + menuRect.height > viewportHeight) {
            y = viewportHeight - menuRect.height - 10;
        }

        x = Math.max(10, x);
        y = Math.max(10, y);

        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.visibility = 'visible';
        this._contextMenuOpen = true;

        if (!this._boundCloseContextMenu) {
            this._boundCloseContextMenu = this.closeContextMenu.bind(this);
        }
        document.addEventListener('click', this._boundCloseContextMenu);
    },

    toggleCardTarget: function(uniqueCardId) {
        // Close hover preview when toggling target
        this._closeActiveCardPreview();
        
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const isTargeted = cardElement.classList.toggle('targeted');
            cardElement.setAttribute('data-card-targeted', isTargeted.toString());
            const cardId = cardElement.getAttribute('data-card-id');
            
            GameActions.performGameAction('target_card', {
                unique_id: uniqueCardId,
                card_id: cardId,
                targeted: isTargeted
            });
        }
    },

    closeContextMenu: function() {
        const menu = document.getElementById('card-context-menu');
        if (menu) {
            menu.remove();
        }
        if (this._boundCloseContextMenu) {
            document.removeEventListener('click', this._boundCloseContextMenu);
        }
        this._contextMenuOpen = false;
    },

    handleCardPreviewClick: function(event) {
        this._closeActiveCardPreview();
    },

    handleCardPreviewKeydown: function(event) {
        if (event.key === 'Escape') {
            this._closeActiveCardPreview();
        }
    },

    _closeActiveCardPreview: function() {
        const preview = document.getElementById('card-preview-modal');
        if (preview) {
            preview.remove();
        }
        this.removeCardPreviewListeners();
        this._hoverPreviewOpened = false;
        this._hoverPreviewPointerEvent = null;
    },

    _getAttachmentsFromState: function(hostUniqueId) {
        if (
            typeof GameCore === 'undefined' ||
            typeof GameCore.getGameState !== 'function'
        ) {
            return [];
        }
        const state = GameCore.getGameState();
        const players = Array.isArray(state?.players) ? state.players : [];
        const collector = (cards, hostId, acc = []) => {
            const normalizeOrder = (value) => {
                const parsed = parseInt(value, 10);
                return Number.isFinite(parsed) ? parsed : null;
            };
            const list = cards
                .filter((c) => (c?.attached_to || c?.attachedTo) === hostId)
                .sort((a, b) => {
                    const orderA = normalizeOrder(a?.attachment_order ?? a?.attachmentOrder);
                    const orderB = normalizeOrder(b?.attachment_order ?? b?.attachmentOrder);
                    if (orderA !== null && orderB !== null && orderA !== orderB) {
                        return orderA - orderB;
                    }
                    return 0;
                });
            list.forEach((card) => {
                acc.push(card);
                collector(cards, card?.unique_id || card?.uniqueId, acc);
            });
            return acc;
        };
        for (const player of players) {
            const battlefield = Array.isArray(player?.battlefield) ? player.battlefield : [];
            const attachments = collector(battlefield, hostUniqueId, []);
            if (attachments.length) {
                return attachments;
            }
        }
        return [];
    },

    showAttachmentsModal: function(hostUniqueId, hostName = 'Attached Cards') {
        if (!hostUniqueId) {
            return;
        }

        const attachmentsFromState = this._getAttachmentsFromState(hostUniqueId);
        const domAttachments = Array.from(document.querySelectorAll(`[data-attached-to="${hostUniqueId}"]`));
        const attachments = attachmentsFromState.length
            ? attachmentsFromState
            : domAttachments.map((el) => {
                try {
                    const parsed = JSON.parse(el.getAttribute('data-card-data') || '{}');
                    const zoneAttr = el.getAttribute('data-card-zone') || 'battlefield';
                    return {
                        ...parsed,
                        card_zone: parsed.card_zone || zoneAttr,
                        zone: parsed.zone || zoneAttr,
                        name: parsed.name || el.getAttribute('data-card-name') || parsed.id || 'Card'
                    };
                } catch (_err) {
                    return null;
                }
            }).filter(Boolean);
        if (!attachments.length) {
            return;
        }

        // Remove any existing attachment modal
        this.closeAttachmentsModal();

        const modal = document.createElement('div');
        modal.id = 'attachment-popup';
        modal.className = 'stack-popup attachment-popup';
        modal.dataset.appear = 'visible';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Attached Cards');

        const countLabel = attachments.length;
        const itemsHtml = attachments.map((cardData, index) => {
            const zone = cardData?.zone || cardData?.card_zone || 'battlefield';
            const ownerId = cardData?.owner_id || cardData?.ownerId || '';
            const controllerId = cardData?.controller_id || cardData?.controllerId || ownerId;
            const cardId = cardData?.id || cardData?.card_id || cardData?.name || '';
            const uniqueId = cardData?.unique_id || cardData?.uniqueId || '';
            const cardName = cardData?.name || 'Card';
            const imageUrl = (typeof GameCards.getSafeImageUrl === 'function')
                ? GameCards.getSafeImageUrl(cardData)
                : (cardData?.image_url || cardData?.image || '');
            const safeName = GameUtils.escapeHtml(cardName);
            const safeImage = GameUtils.escapeHtml(imageUrl || '');
            const serialized = GameUtils.escapeHtml(JSON.stringify(cardData));

            return `
                <div class="stack-spell"
                     data-card-id="${GameUtils.escapeHtml(cardId)}"
                     data-card-unique-id="${GameUtils.escapeHtml(uniqueId)}"
                     data-card-name="${safeName}"
                     data-card-image="${safeImage}"
                     data-card-zone="${GameUtils.escapeHtml(zone)}"
                     data-card-owner="${GameUtils.escapeHtml(ownerId)}"
                     data-card-controller="${GameUtils.escapeHtml(controllerId)}"
                     data-card-data='${serialized}'
                     draggable="true"
                     ondragstart="GameCards.handleDragStart(event, this)"
                     ondragend="GameCards.handleDragEnd(event, this)"
                     oncontextmenu="GameCards.handleAttachmentModalContextMenu(event, this); return false;">
                    <div class="stack-card-container">
                        ${safeImage
                            ? `<img src="${safeImage}" alt="${safeName}" class="stack-card-image" />`
                            : `<div class="stack-card-fallback"></div>`}
                    </div>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="stack-popup-header" data-draggable-handle>
                <div class="stack-popup-title">
                    <span class="stack-popup-icon">📎</span>
                    <span class="stack-popup-label">${GameUtils.escapeHtml(hostName)}</span>
                    <span class="stack-popup-count">${countLabel}</span>
                </div>
                <button class="counter-modal-close" onclick="GameCards.closeAttachmentsModal()" aria-label="Close attachments">&times;</button>
            </div>
            <div class="stack-popup-body">
                <div class="stack-container">
                    <div class="stack-content" role="list" aria-label="Attached Cards">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const clampPosition = (left, top) => {
            const padding = 12;
            const rect = modal.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width - padding;
            const maxY = window.innerHeight - rect.height - padding;
            const clampedLeft = Math.min(Math.max(left, padding), Math.max(maxX, padding));
            const clampedTop = Math.min(Math.max(top, padding), Math.max(maxY, padding));
            modal.style.left = `${clampedLeft}px`;
            modal.style.top = `${clampedTop}px`;
        };

        const pointer = this._lastContextPosition;
        const modalRect = modal.getBoundingClientRect();
        const fallbackLeft = Math.max(16, window.innerWidth - (modalRect.width || 360) - 32);
        const fallbackTop = Math.max(24, (window.innerHeight - (modalRect.height || 240)) / 2);
        const initialLeft = pointer ? pointer.x + 12 : fallbackLeft;
        const initialTop = pointer ? pointer.y + 12 : fallbackTop;
        clampPosition(initialLeft, initialTop);

        const dragHandle = modal.querySelector('[data-draggable-handle]');
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onMouseDown = (event) => {
            dragging = true;
            modal.classList.add('stack-popup-dragging');
            offsetX = event.clientX - modal.getBoundingClientRect().left;
            offsetY = event.clientY - modal.getBoundingClientRect().top;
            event.preventDefault();
        };

        const onMouseMove = (event) => {
            if (!dragging) return;
            clampPosition(event.clientX - offsetX, event.clientY - offsetY);
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            modal.classList.remove('stack-popup-dragging');
        };

        if (dragHandle) {
            dragHandle.addEventListener('mousedown', onMouseDown);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        modal._attachmentDragCleanup = () => {
            if (dragHandle) dragHandle.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        if (!this._boundCloseAttachmentClick) {
            this._boundCloseAttachmentClick = (event) => {
                if (event.target === modal) {
                    this.closeAttachmentsModal();
                }
            };
        }
        modal.addEventListener('click', this._boundCloseAttachmentClick);
    },

    handleAttachmentModalContextMenu: function(event, element = null) {
        event.preventDefault();
        event.stopPropagation();
        const cardElement = element || event.currentTarget || event.target.closest('[data-card-unique-id]');
        if (!cardElement) {
            return false;
        }

        const cardId = cardElement.getAttribute('data-card-id');
        const uniqueId = cardElement.getAttribute('data-card-unique-id');
        if (!cardId || !uniqueId) {
            return false;
        }

        this.closeAttachmentContextMenu();

        const menu = document.createElement('div');
        menu.id = 'attachment-context-menu';
        menu.className = 'card-context-menu';

        const detachItem = document.createElement('div');
        detachItem.className = 'card-context-menu-item';
        detachItem.innerHTML = '<span class="icon">🔓</span> Detach';
        detachItem.onclick = () => {
            if (typeof GameActions !== 'undefined' && typeof GameActions.detachCard === 'function') {
                GameActions.detachCard(cardId, uniqueId);
            }
            this.closeAttachmentContextMenu();
            this.closeAttachmentsModal();
        };

        menu.appendChild(detachItem);

        const pointerX = event.clientX || 0;
        const pointerY = event.clientY || 0;
        menu.style.left = `${pointerX}px`;
        menu.style.top = `${pointerY}px`;

        document.body.appendChild(menu);
        this._lastContextPosition = { x: pointerX, y: pointerY };

        if (!this._boundAttachmentMenuClose) {
            this._boundAttachmentMenuClose = (evt) => {
                if (!menu.contains(evt.target)) {
                    this.closeAttachmentContextMenu();
                }
            };
        }

        if (!this._boundAttachmentMenuKeydown) {
            this._boundAttachmentMenuKeydown = (evt) => {
                if (evt.key === 'Escape') {
                    this.closeAttachmentContextMenu();
                }
            };
        }

        document.addEventListener('click', this._boundAttachmentMenuClose, true);
        document.addEventListener('keydown', this._boundAttachmentMenuKeydown);

        return false;
    },

    closeAttachmentContextMenu: function() {
        const existing = document.getElementById('attachment-context-menu');
        if (existing) {
            existing.remove();
        }
        if (this._boundAttachmentMenuClose) {
            document.removeEventListener('click', this._boundAttachmentMenuClose, true);
        }
        if (this._boundAttachmentMenuKeydown) {
            document.removeEventListener('keydown', this._boundAttachmentMenuKeydown);
        }
    },

    closeAttachmentsModal: function() {
        const modal = document.getElementById('attachment-popup');
        if (modal) {
            if (this._boundCloseAttachmentClick) {
                modal.removeEventListener('click', this._boundCloseAttachmentClick);
            }
            if (typeof modal._attachmentDragCleanup === 'function') {
                modal._attachmentDragCleanup();
            }
            modal.remove();
        }
        this.closeAttachmentContextMenu();
        this._closeActiveCardPreview();
    },

    // Add properties to store bound references
    _boundHandleCardPreviewClick: null,
    _boundHandleCardPreviewKeydown: null,
    _boundCloseContextMenu: null,

    addCardPreviewListeners: function() {
        // Use persistent bound references
        if (!this._boundHandleCardPreviewClick) {
            this._boundHandleCardPreviewClick = this.handleCardPreviewClick.bind(this);
        }
        if (!this._boundHandleCardPreviewKeydown) {
            this._boundHandleCardPreviewKeydown = this.handleCardPreviewKeydown.bind(this);
        }
        setTimeout(() => {
            document.addEventListener('click', this._boundHandleCardPreviewClick);
            document.addEventListener('keydown', this._boundHandleCardPreviewKeydown);
        }, 100);
    },

    removeCardPreviewListeners: function() {
        if (this._boundHandleCardPreviewClick) {
            document.removeEventListener('click', this._boundHandleCardPreviewClick);
        }
        if (this._boundHandleCardPreviewKeydown) {
            document.removeEventListener('keydown', this._boundHandleCardPreviewKeydown);
        }
    },

    startAttachmentSelection: function(cardId, uniqueCardId) {
        this._closeActiveCardPreview();
        this.closeContextMenu();
        this.cancelAttachmentSelection();

        const sourceElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        const sourceOwner = sourceElement ? sourceElement.getAttribute('data-card-owner') : null;

        const candidates = Array.from(
            document.querySelectorAll('.battlefield-zone [data-card-unique-id]')
        ).filter((el) => {
            const uid = el.getAttribute('data-card-unique-id');
            return uid && uid !== uniqueCardId;
        });

        if (!candidates.length) {
            console.warn('[GameCards] No valid attachment targets found.');
            return;
        }

        this._attachmentSelection = {
            cardId,
            uniqueId: uniqueCardId,
            owner: sourceOwner
        };
        this._attachmentTargets = candidates;
        candidates.forEach((el) => el.classList.add('attachment-targetable'));

        if (!this._boundAttachmentClickHandler) {
            this._boundAttachmentClickHandler = this.handleAttachmentTargetClick.bind(this);
        }
        if (!this._boundAttachmentKeydownHandler) {
            this._boundAttachmentKeydownHandler = this.handleAttachmentKeydown.bind(this);
        }

        document.addEventListener('click', this._boundAttachmentClickHandler, true);
        document.addEventListener('keydown', this._boundAttachmentKeydownHandler);
    },

    handleAttachmentTargetClick: function(event) {
        if (!this._attachmentSelection) {
            return;
        }

        const targetElement = event.target.closest('[data-card-unique-id]');
        if (!targetElement) {
            this.cancelAttachmentSelection();
            return;
        }

        const targetUniqueId = targetElement.getAttribute('data-card-unique-id');
        if (!targetUniqueId || targetUniqueId === this._attachmentSelection.uniqueId) {
            this.cancelAttachmentSelection();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (typeof GameActions !== 'undefined' && typeof GameActions.attachCard === 'function') {
            const targetCardId = targetElement.getAttribute('data-card-id');
            GameActions.attachCard(
                this._attachmentSelection.cardId,
                this._attachmentSelection.uniqueId,
                targetCardId,
                targetUniqueId
            );
        }

        this.cancelAttachmentSelection();
    },

    handleAttachmentKeydown: function(event) {
        if (event.key === 'Escape') {
            this.cancelAttachmentSelection();
        }
    },

    cancelAttachmentSelection: function() {
        if (this._attachmentTargets && this._attachmentTargets.length) {
            this._attachmentTargets.forEach((el) => el.classList.remove('attachment-targetable'));
        }
        this._attachmentTargets = [];
        this._attachmentSelection = null;

        if (this._boundAttachmentClickHandler) {
            document.removeEventListener('click', this._boundAttachmentClickHandler, true);
        }
        if (this._boundAttachmentKeydownHandler) {
            document.removeEventListener('keydown', this._boundAttachmentKeydownHandler);
        }
    },

    initializeHoverPreview: function() {
        if (this._hoverPreviewInitialized) {
            return;
        }

        this._boundHoverMouseOver = this.handleHoverMouseOver.bind(this);
        this._boundHoverMouseOut = this.handleHoverMouseOut.bind(this);
        this._boundHoverMouseMove = this.handleHoverMouseMove.bind(this);

        document.addEventListener('mouseover', this._boundHoverMouseOver, true);
        document.addEventListener('mouseout', this._boundHoverMouseOut, true);
        document.addEventListener('mousemove', this._boundHoverMouseMove, true);

        this._hoverPreviewInitialized = true;
    },

    handleHoverMouseOver: function(event) {
        if (this._contextMenuOpen) {
            return;
        }

        const cardElement = event.target.closest('[data-card-id]');
        if (!cardElement) {
            return;
        }

        const related = event.relatedTarget;
        if (related && cardElement.contains(related)) {
            return;
        }

        this._hoveredCardElement = cardElement;
        this._hoverPreviewPointerEvent = event;

        this.openHoverPreview(cardElement, event);
    },

    handleHoverMouseOut: function(event) {
        const cardElement = event.target.closest('[data-card-id]');
        if (!cardElement) {
            return;
        }

        const related = event.relatedTarget;
        if (related && cardElement.contains(related)) {
            return;
        }

        if (this._hoveredCardElement === cardElement) {
            this._hoveredCardElement = null;
            this._hoverPreviewPointerEvent = null;
        }

        if (this._hoverPreviewOpened) {
            this.closeHoverPreview();
        }
    },

    handleHoverMouseMove: function(event) {
        if (this._contextMenuOpen) {
            return;
        }

        const cardElement = event.target.closest('[data-card-id]');
        if (cardElement) {
            this._hoverPreviewPointerEvent = event;
        }

        // Check if the hovered card still exists in the DOM
        if (this._hoveredCardElement && !document.contains(this._hoveredCardElement)) {
            this._hoveredCardElement = null;
            this._hoverPreviewPointerEvent = null;
            if (this._hoverPreviewOpened) {
                this.closeHoverPreview();
            }
            return;
        }

        const preview = document.getElementById('card-preview-modal');
        if (this._hoverPreviewOpened && preview && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            this.positionCardPreview(preview, event);
        } else if (!this._hoverPreviewOpened && cardElement && cardElement === this._hoveredCardElement) {
            this.openHoverPreview(cardElement, event);
        }
    },

    openHoverPreview: function(cardElement, pointerEvent) {
        if (!cardElement || this._contextMenuOpen) {
            return;
        }

        if (this._hoverPreviewOpened && this._hoveredCardElement === cardElement) {
            return;
        }

        const cardId = cardElement.getAttribute('data-card-id');
        const cardName = cardElement.getAttribute('data-card-name');
        const cardImage = cardElement.getAttribute('data-card-image');
        const rawData = cardElement.getAttribute('data-card-data') || null;
        let cardData = null;

        if (rawData) {
            try {
                cardData = JSON.parse(
                    rawData
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                );
            } catch (error) {
                console.warn('Unable to parse card data attribute for preview', error);
            }
        }

        const positionEvent = pointerEvent && typeof pointerEvent.clientX === 'number' && typeof pointerEvent.clientY === 'number'
            ? pointerEvent
            : this.buildCardCenterEvent(cardElement);

        this.showCardPreview(cardId, cardName, cardImage, positionEvent, cardData);
        this._hoverPreviewOpened = true;
        this._hoverPreviewPointerEvent = positionEvent;
    },

    closeHoverPreview: function() {
        if (!this._hoverPreviewOpened) {
            return;
        }

        this._closeActiveCardPreview();
    },

    buildCardCenterEvent: function(cardElement) {
        if (!cardElement) {
            return { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
        }

        const rect = cardElement.getBoundingClientRect();
        return {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        };
    },

    flipCard: function(cardId, uniqueCardId) {
        // Close hover preview when flipping a card
        this._closeActiveCardPreview();
        
        GameActions.performGameAction('flip_card', {
            card_id: cardId,
            unique_id: uniqueCardId
        });

        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const socket = window.websocket;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.warn('Card flip processed without active WebSocket; UI may require manual sync.');
            }
        }
    },

    handleDragStart: function(event, cardElement) {
        this._closeActiveCardPreview();

        const cardId = cardElement.getAttribute('data-card-id');
        const cardZone = cardElement.getAttribute('data-card-zone');
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id');
        const cardOwnerId = cardElement.getAttribute('data-card-owner');
        event.dataTransfer.setData('text/plain', JSON.stringify({
            cardId,
            cardZone,
            uniqueCardId,
            cardOwnerId
        }));
        // Optionally: add visual feedback
        const dragHandle = cardElement.closest('.card-attachment-group') || cardElement;
        dragHandle.classList.add('dragging');
        if (dragHandle !== cardElement) {
            cardElement.classList.add('dragging');
        }
        event.dataTransfer.effectAllowed = 'move';
        GameCards.draggedCardElement = dragHandle;
    },

    /**
     * Handle card click - check combat mode first, then default to tap/untap
     */
    handleCardClick: function(cardId, uniqueCardId, zone) {
        // Check if we're in combat mode and this is a creature
        if (typeof GameCombat !== 'undefined') {
            if (GameCombat.combatMode === 'declaring_attackers' && zone === 'creatures') {
                GameCombat.toggleAttacker(uniqueCardId);
                return;
            }
            
            if (GameCombat.combatMode === 'declaring_blockers' && zone === 'creatures') {
                GameCombat.toggleBlocker(uniqueCardId);
                return;
            }
        }
        
        // Default behavior: tap/untap the card
        GameActions.tapCard(cardId, uniqueCardId);
    },

    handleDragEnd: function(event, cardElement) {
        if (!cardElement) return;
        
        cardElement.classList.remove('dragging');
        const dragHandle = cardElement.closest('.card-attachment-group') || cardElement;
        if (dragHandle && dragHandle !== cardElement) {
            dragHandle.classList.remove('dragging');
        }
        cardElement.style.removeProperty('opacity');
        cardElement.style.removeProperty('pointer-events');
        if (GameCards.draggedCardElement === cardElement || GameCards.draggedCardElement === dragHandle) {
            GameCards.draggedCardElement = null;
        }
    },

    showTypePopover: function(uniqueCardId, cardId) {
        this._closeActiveCardPreview();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openTypePopover === 'function') {
            UICardManager.openTypePopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Type popover is unavailable.');
        }
    },

    showCounterPopover: function(uniqueCardId, cardId) {
        this._closeActiveCardPreview();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openCounterPopover === 'function') {
            UICardManager.openCounterPopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Counter popover is unavailable.');
        }
    },

    showPowerToughnessPopover: function(uniqueCardId, cardId) {
        this._closeActiveCardPreview();
        const anchor = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.openPowerPopover === 'function') {
            UICardManager.openPowerPopover(uniqueCardId, cardId, anchor);
        } else {
            console.warn('[GameCards] Power/Toughness popover is unavailable.');
        }
    },

    // Backward compatibility shim
    showCounterModal: function(uniqueCardId, cardId) {
        this.showCounterPopover(uniqueCardId, cardId);
    },

    closeCounterModal: function() {
        if (typeof UICardManager !== 'undefined' && typeof UICardManager.closeAll === 'function') {
            UICardManager.closeAll();
        }
    }
};

GameCards.initializeHoverPreview();
window.GameCards = GameCards;
