/**
 * ManaForge Game Cards Module
 * Functions for card rendering and management
 */
const GameCards = {
    draggedCardElement: null,
    keywordDescriptions: {
        "flying":{"name":"Flying","description":"Creatures with flying can only be blocked by creatures with flying or reach."},
        "reach":{"name":"Reach","description":"This creature can block creatures with flying."},
        "menace":{"name":"Menace","description":"This creature can’t be blocked except by two or more creatures."},
        "trample":{"name":"Trample","description":"Excess combat damage this creature deals to a blocker is dealt to the defending player, planeswalker, or battle."},
        "first strike":{"name":"First strike","description":"This creature deals combat damage before creatures without first strike."},
        "double strike":{"name":"Double strike","description":"This creature deals both first-strike and regular combat damage."},
        "deathtouch":{"name":"Deathtouch","description":"Any amount of damage this creature deals to a creature is enough to destroy it."},
        "lifelink":{"name":"Lifelink","description":"Damage dealt by this creature also causes you to gain that much life."},
        "vigilance":{"name":"Vigilance","description":"Attacking doesn’t cause this creature to tap."},
        "haste":{"name":"Haste","description":"This creature can attack and activate abilities with {T} or {Q} as soon as it comes under your control."},
        "hexproof":{"name":"Hexproof","description":"This permanent can’t be the target of spells or abilities your opponents control."},
        "shroud":{"name":"Shroud","description":"This permanent can’t be the target of any spells or abilities."},
        "protection":{"name":"Protection","description":"Protection from [quality]: It can’t be targeted, dealt damage, enchanted/equipped, or blocked by anything with that quality."},
        "indestructible":{"name":"Indestructible","description":"Effects that say \"destroy\" don’t destroy this permanent, and lethal damage doesn’t destroy it."},
        "ward":{"name":"Ward","description":"Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays the ward cost."},
        "defender":{"name":"Defender","description":"This creature can’t attack."},
        "shadow":{"name":"Shadow","description":"This creature can block or be blocked only by creatures with shadow."},
        "intimidate":{"name":"Intimidate","description":"This creature can be blocked only by artifact creatures and/or creatures that share a color with it."},
        "fear":{"name":"Fear","description":"This creature can be blocked only by artifact creatures and/or black creatures."},
        "skulk":{"name":"Skulk","description":"This creature can’t be blocked by creatures with greater power."},
        "horsemanship":{"name":"Horsemanship","description":"This creature can be blocked only by creatures with horsemanship."},
        "flanking":{"name":"Flanking","description":"Whenever this creature becomes blocked by a creature without flanking, the blocking creature gets -1/-1 until end of turn."},
        "bushido":{"name":"Bushido","description":"Whenever this creature blocks or becomes blocked, it gets +N/+N until end of turn."},
        "rampage":{"name":"Rampage","description":"Whenever this creature becomes blocked, it gets +N/+N until end of turn for each creature beyond the first assigned to block it."},
        "flash":{"name":"Flash","description":"You may cast this spell any time you could cast an instant."},
        "split second":{"name":"Split second","description":"As long as this spell is on the stack, players can’t cast spells or activate abilities that aren’t mana abilities."},
        "kicker":{"name":"Kicker","description":"You may pay an additional cost as you cast this spell for an extra effect."},
        "multikicker":{"name":"Multikicker","description":"You may pay the kicker cost any number of times as you cast this spell; it gets additional effects per time kicked."},
        "buyback":{"name":"Buyback","description":"You may pay an additional cost; if you do, return this spell to your hand as it resolves."},
        "flashback":{"name":"Flashback","description":"You may cast this card from your graveyard for its flashback cost; then exile it."},
        "aftermath":{"name":"Aftermath","description":"You may cast this half of the split card only from your graveyard; then exile it."},
        "overload":{"name":"Overload","description":"You may cast this spell for its overload cost. If you do, replace each instance of \"target\" with \"each\"."},
        "replicate":{"name":"Replicate","description":"When you cast this spell, copy it for each time you paid its replicate cost; you may choose new targets."},
        "storm":{"name":"Storm","description":"When you cast this spell, copy it for each spell cast before it this turn; you may choose new targets."},
        "splice":{"name":"Splice onto Arcane","description":"As you cast an Arcane spell, you may reveal this card and pay its splice cost; add its text to that spell."},
        "madness":{"name":"Madness","description":"If you discard this card, discard it into exile. You may cast it for its madness cost."},
        "delve":{"name":"Delve","description":"Each card you exile from your graveyard while casting this spell pays for {1}."},
        "convoke":{"name":"Convoke","description":"Your creatures can help cast this spell. Each creature you tap while casting it pays for {1} or one mana of that creature’s color."},
        "improvise":{"name":"Improvise","description":"Your artifacts can help cast this spell. Each artifact you tap while casting it pays for {1}."},
        "affinity":{"name":"Affinity","description":"This spell costs {1} less to cast for each [quality] you control."},
        "foretell":{"name":"Foretell","description":"During your turn, you may pay {2} and exile this card from your hand face down. Cast it on a later turn for its foretell cost."},
        "cleave":{"name":"Cleave","description":"You may cast this spell for its cleave cost. If you do, remove the words in square brackets in its rules text."},
        "escape":{"name":"Escape","description":"You may cast this card from your graveyard by paying its escape cost and exiling other cards from your graveyard."},
        "mutate":{"name":"Mutate","description":"If you cast this spell for its mutate cost, put it over or under target non-Human creature you own; they become one creature with the top card’s characteristics and all abilities of both."},
        "prototype":{"name":"Prototype","description":"You may cast this artifact creature for its prototype cost with different color, power, and toughness."},
        "adventure":{"name":"Adventure","description":"You may cast the Adventure half first; later you may cast the creature from exile."},
        "bargain":{"name":"Bargain","description":"As you cast this spell, you may sacrifice an artifact, enchantment, or token for an additional effect."},
        "plot":{"name":"Plot","description":"You may pay the plot cost and exile this card from your hand as a sorcery. Cast it on a later turn without paying its mana cost."},
        "scry":{"name":"Scry","description":"Scry N: Look at the top N cards of your library; put any number on the bottom and the rest on top in any order."},
        "surveil":{"name":"Surveil","description":"Surveil N: Look at the top N cards of your library; you may put any number into your graveyard and the rest back on top in any order."},
        "cascade":{"name":"Cascade","description":"When you cast this spell, exile cards from the top of your library until you exile a nonland card with lesser mana value. You may cast it without paying its mana cost; put the exiled cards on the bottom in a random order."},
        "discover":{"name":"Discover","description":"Discover N: Exile cards from the top of your library until you exile a nonland card with mana value N or less. You may cast it without paying its mana cost or put it into your hand. Put the rest on the bottom in a random order."},
        "equip":{"name":"Equip","description":"Equip [cost]: Attach this Equipment to target creature you control. Activate only as a sorcery."},
        "reconfigure":{"name":"Reconfigure","description":"Attach or detach this Equipment Creature for its reconfigure cost; while attached it isn’t a creature."},
        "fortify":{"name":"Fortify","description":"Fortify [cost]: Attach this Fortification to target land you control. Activate only as a sorcery."},
        "crew":{"name":"Crew","description":"Crew N: Tap any number of creatures you control with total power N or more: This Vehicle becomes an artifact creature until end of turn."},
        "saddle":{"name":"Saddle","description":"Saddle N: Tap any number of other creatures you control with total power N or more: This Mount becomes a creature until end of turn."},
        "regenerate":{"name":"Regenerate","description":"The next time this permanent would be destroyed this turn, instead tap it, remove all damage from it, and remove it from combat."},
        "proliferate":{"name":"Proliferate","description":"Choose any number of permanents and/or players with counters; give each another counter of a kind already there."},
        "investigate":{"name":"Investigate","description":"Create a Clue token with \"{2}, Sacrifice this artifact: Draw a card.\""},
        "populate":{"name":"Populate","description":"Create a token that’s a copy of a creature token you control."},
        "amass":{"name":"Amass","description":"Put N +1/+1 counters on an Army you control. If you don’t control one, create a 0/0 black Army creature token first."},
        "incubate":{"name":"Incubate","description":"Create an Incubator token with N +1/+1 counters and \"{2}: Transform this artifact.\""},
        "venture into the dungeon":{"name":"Venture into the dungeon","description":"Move your marker into the next room of a dungeon and trigger its room ability."},
        "learn":{"name":"Learn","description":"You may reveal a Lesson card you own from outside the game and put it into your hand, or discard a card to draw a card."},
        "connive":{"name":"Connive","description":"Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature."},
        "explore":{"name":"Explore","description":"Reveal the top card of your library. If it’s a land, put it into your hand; otherwise put a +1/+1 counter on this creature, then you may put that card into your graveyard."},
        "monstrosity":{"name":"Monstrosity","description":"If this creature isn’t monstrous, put N +1/+1 counters on it and it becomes monstrous."},
        "fight":{"name":"Fight","description":"Each of two creatures deals damage equal to its power to the other."},
        "goad":{"name":"Goad","description":"Until your next turn, that creature attacks each combat if able and attacks a player other than you if able."},
        "mill":{"name":"Mill","description":"Put the top N cards of a library into its owner’s graveyard."},
        "transform":{"name":"Transform","description":"Turn a double-faced card to its other face if instructed to transform."},
        "craft":{"name":"Craft","description":"Craft with [materials]: Exile this and the required materials from the battlefield and/or graveyard to transform it, as a sorcery."},
        "persist":{"name":"Persist","description":"When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner’s control with a -1/-1 counter."},
        "undying":{"name":"Undying","description":"When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner’s control with a +1/+1 counter."},
        "renown":{"name":"Renown","description":"When this creature deals combat damage to a player, if it isn’t renowned, put N +1/+1 counters on it and it becomes renowned."},
        "evolve":{"name":"Evolve","description":"Whenever a creature enters the battlefield under your control with greater power or toughness, put a +1/+1 counter on this creature."},
        "graft":{"name":"Graft","description":"This creature enters with N +1/+1 counters. Whenever another creature enters, you may move a +1/+1 counter from this onto it."},
        "modular":{"name":"Modular","description":"This creature enters with N +1/+1 counters. When it dies, you may put its counters on target artifact creature."},
        "sunburst":{"name":"Sunburst","description":"This permanent enters with a +1/+1 counter or charge counter on it for each color of mana spent to cast it."},
        "fabricate":{"name":"Fabricate","description":"When this creature enters, put N +1/+1 counters on it or create N 1/1 colorless Servo artifact creature tokens."},
        "bolster":{"name":"Bolster","description":"Choose a creature you control with the least toughness among creatures you control. Put N +1/+1 counters on it."},
        "outlast":{"name":"Outlast","description":"{cost}, {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery."},
        "mentor":{"name":"Mentor","description":"Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power."},
        "training":{"name":"Training","description":"Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature."},
        "backup":{"name":"Backup","description":"When this creature enters, put a +1/+1 counter on target creature. If it’s another creature, it gains the listed abilities until end of turn."},
        "shield counter":{"name":"Shield counter","description":"If a permanent with a shield counter would be dealt damage or destroyed, remove a shield counter from it instead."},
        "infect":{"name":"Infect","description":"This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters."},
        "wither":{"name":"Wither","description":"This creature deals damage to creatures in the form of -1/-1 counters."},
        "toxic":{"name":"Toxic","description":"Players dealt combat damage by this creature also get N poison counters."},
        "poisonous":{"name":"Poisonous","description":"Whenever this creature deals combat damage to a player, that player gets N poison counters."},
        "morph":{"name":"Morph","description":"You may cast this card face down as a 2/2 for {3}. Turn it face up any time for its morph cost."},
        "megamorph":{"name":"Megamorph","description":"As morph, but when turned face up, put a +1/+1 counter on it."},
        "manifest":{"name":"Manifest","description":"Put the top card of your library onto the battlefield face down as a 2/2 creature. You may turn it face up if it’s a creature card."},
        "ninjutsu":{"name":"Ninjutsu","description":"{cost}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking."},
        "dash":{"name":"Dash","description":"You may cast this spell for its dash cost. If you do, it gains haste and it’s returned to its owner’s hand at the beginning of the next end step."},
        "embalm":{"name":"Embalm","description":"Exile this creature card from your graveyard: Create a token copy except it’s white and a Zombie; activate only as a sorcery."},
        "eternalize":{"name":"Eternalize","description":"Exile this creature card from your graveyard: Create a token that’s a copy except it’s 4/4 black Zombie; activate only as a sorcery."},
        "unearth":{"name":"Unearth","description":"Return this card from your graveyard to the battlefield. It gains haste. Exile it at the next end step or if it would leave the battlefield."},
        "encore":{"name":"Encore","description":"Exile this card from your graveyard for its encore cost: For each opponent, create a token copy that attacks that player this turn if able; sacrifice the tokens at end of combat."},
        "evoke":{"name":"Evoke","description":"You may cast this spell for its evoke cost. If you do, it’s sacrificed when it enters the battlefield."},
        "annihilator":{"name":"Annihilator","description":"Whenever this creature attacks, defending player sacrifices N permanents."},
        "devoid":{"name":"Devoid","description":"This card has no color."},
        "ingest":{"name":"Ingest","description":"Whenever this creature deals combat damage to a player, that player exiles the top card of their library."},
        "exalted":{"name":"Exalted","description":"Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn."},
        "myriad":{"name":"Myriad","description":"Whenever this creature attacks, for each opponent other than defending player, create a tapped and attacking token copy that’s attacking that opponent or a planeswalker they control; exile the tokens at end of combat."},
        "melee":{"name":"Melee","description":"Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat."},
        "dethrone":{"name":"Dethrone","description":"Whenever this creature attacks the player with the most life or tied for most life, put a +1/+1 counter on it."},
        "tribute":{"name":"Tribute","description":"As this creature enters, an opponent may put N +1/+1 counters on it. When it enters, if tribute wasn’t paid, a specified effect happens."},
        "devour":{"name":"Devour","description":"As this creature enters, you may sacrifice any number of creatures; it enters with N times that many +1/+1 counters."},
        "champion":{"name":"Champion","description":"When this enters, sacrifice it unless you exile another [quality] you control. When this leaves, return the exiled card to the battlefield."},
        "level up":{"name":"Level up","description":"{cost}: Put a level counter on this. Activate only as a sorcery. Abilities and power/toughness change at listed levels."},
        "hideaway":{"name":"Hideaway","description":"This enters tapped. When it does, look at the top N cards, exile one face down, then later you may play it for free if a condition is met."},
        "meld":{"name":"Meld","description":"Two specific cards you own may meld into one oversized back-face permanent when conditions are met."},
        "phasing":{"name":"Phasing","description":"This permanent regularly phases in or out. While phased out, it’s treated as though it doesn’t exist."},
        "vanishing":{"name":"Vanishing","description":"This permanent enters with N time counters. At the beginning of your upkeep, remove one. When you can’t, sacrifice it."},
        "fading":{"name":"Fading","description":"Enters with N fade counters. Remove one at each upkeep. When you can’t, sacrifice it."},
        "suspend":{"name":"Suspend","description":"Rather than cast this card from your hand, you may pay its suspend cost and exile it with N time counters; cast it when the last is removed."},
        "partner":{"name":"Partner","description":"You can have two commanders if both have partner."},
        "partner with":{"name":"Partner with","description":"When one enters, you may search your library for the named partner card and put it into your hand; those two can be your commanders."},
        "companion":{"name":"Companion","description":"If your starting deck meets this card’s restriction, you may choose it as your companion and cast it from outside the game once."},
        "assist":{"name":"Assist","description":"Another player may help pay up to {X} of this spell’s cost."},
        "undaunted":{"name":"Undaunted","description":"This spell costs {1} less to cast for each opponent."},
        "provoke":{"name":"Provoke","description":"Whenever this creature attacks, you may have target creature defending player controls untap and block it if able."},
        "bestow":{"name":"Bestow","description":"You may cast this card as an Aura with enchant creature for its bestow cost; if the creature leaves, it stops being an Aura."},
        "totem armor":{"name":"Totem armor","description":"If enchanted creature would be destroyed, instead remove all damage from it and destroy this Aura."},
        "riot":{"name":"Riot","description":"This creature enters with your choice of a +1/+1 counter or haste."},
        "spectacle":{"name":"Spectacle","description":"You may cast this spell for its spectacle cost if an opponent lost life this turn."},
        "surge":{"name":"Surge","description":"You may cast this spell for its surge cost if you or a teammate has cast another spell this turn."},
        "awaken":{"name":"Awaken","description":"If you cast this spell for its awaken cost, also put N +1/+1 counters on target land you control and it becomes a creature."},
        "escalate":{"name":"Escalate","description":"Pay the escalate cost for each additional mode you choose beyond the first."},
        "fuse":{"name":"Fuse","description":"You may cast both halves of this split card from your hand as a single spell."},
        "cipher":{"name":"Cipher","description":"Then you may exile this spell encoded on a creature you control. Whenever that creature deals combat damage to a player, you may cast a copy without paying its cost."},
        "conspire":{"name":"Conspire","description":"As you cast this spell, you may tap two untapped creatures you control that share a color with it. When you do, copy it."},
        "extort":{"name":"Extort","description":"Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain that much life."},
        "boast":{"name":"Boast","description":"Activate only if this creature attacked this turn and only once each turn."},
        "enlist":{"name":"Enlist","description":"As this creature attacks, you may tap a nonattacking creature you control. Add its power to this creature until end of turn."},
        "disturb":{"name":"Disturb","description":"You may cast this card transformed from your graveyard for its disturb cost. If it would be put into a graveyard from anywhere, exile it instead."},
        "daybound":{"name":"Daybound","description":"If it’s day, this face is active. If a player casts no spells during their own turn, it becomes night next turn."},
        "nightbound":{"name":"Nightbound","description":"If it’s night, this face is active. If a player casts two or more spells during their turn, it becomes day next turn."},
        "read ahead":{"name":"Read ahead","description":"As this Saga enters, choose a chapter to start on; previously skipped chapter abilities don’t trigger."},
        "blitz":{"name":"Blitz","description":"You may cast this creature for its blitz cost. It gains haste and \"When this creature dies, draw a card.\" Sacrifice it at the beginning of the next end step."},
        "casualty":{"name":"Casualty","description":"As you cast this spell, you may sacrifice a creature with power N or greater. When you do, copy this spell."},
        "decayed":{"name":"Decayed","description":"This creature can’t block. When it attacks, sacrifice it at end of combat."},
        "for mirrodin!":{"name":"For Mirrodin!","description":"When this Equipment enters, create a 2/2 Rebel and attach this to it."},
        "warp":{"name":"Warp","description":"You may cast this from your hand for its warp cost. If you do, it’s exiled at the beginning of the next end step; you may cast it from exile later."},
        "spree":{"name":"Spree","description":"As an additional cost to cast this spell, choose one or more modes and pay their associated costs."},
        "disguise":{"name":"Disguise","description":"You may cast this card face down as a 2/2 creature with ward {2} for {3}. Turn it face up any time for its disguise cost."},
        "cloak":{"name":"Cloak","description":"To cloak a card, put it onto the battlefield face down as a 2/2 creature with ward {2}."},
        "collect evidence":{"name":"Collect evidence","description":"Exile cards from your graveyard with total mana value N or more as a cost or instruction to get the listed bonus."},
        "freerunning":{"name":"Freerunning","description":"You may cast this spell for its freerunning cost if an Assassin or a commander you control dealt combat damage to a player this turn."},
        "exert":{"name":"Exert","description":"You may exert this as it attacks; if you do, it won’t untap during your next untap step and you get the listed bonus."},
        "exploit":{"name":"Exploit","description":"When this creature enters the battlefield, you may sacrifice a creature. If you do, you get the listed effect."},
        "jump-start":{"name":"Jump-start","description":"You may cast this spell from your graveyard by discarding a card in addition to paying its other costs."},
        "squad":{"name":"Squad","description":"As you cast this spell, you may pay its squad cost any number of times. When it enters, create that many token copies."},
        "battle cry":{"name":"Battle cry","description":"Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn."},
        "landwalk":{"name":"Landwalk","description":"This creature can’t be blocked as long as defending player controls a land of the stated type."},
        "changeling":{"name":"Changeling","description":"This card is every creature type."},
        "afflict":{"name":"Afflict","description":"Whenever this creature becomes blocked, defending player loses N life."},
        "afterlife":{"name":"Afterlife","description":"When this creature dies, create N 1/1 white and black Spirit creature tokens with flying."},
        "adapt":{"name":"Adapt","description":"If this creature has no +1/+1 counters on it, put N +1/+1 counters on it."},
        "emerge":{"name":"Emerge","description":"You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature’s mana value."},
        "entwine":{"name":"Entwine","description":"Choose one — If you pay the entwine cost, choose both instead."},
        "ravenous":{"name":"Ravenous","description":"This creature enters with X +1/+1 counters. If X is 5 or more, draw a card when it enters."},
        "rebound":{"name":"Rebound","description":"If you cast this spell from your hand, exile it as it resolves. At the beginning of your next upkeep, cast it from exile without paying its mana cost."},
        "retrace":{"name":"Retrace","description":"You may cast this card from your graveyard by discarding a land card in addition to paying its other costs."},
        "scavenge":{"name":"Scavenge","description":"Exile this creature card from your graveyard: Put a number of +1/+1 counters equal to its power on target creature. Activate only as a sorcery."},
        "soulbond":{"name":"Soulbond","description":"You may pair this creature with another unpaired creature when either enters. They remain paired as long as you control both and get the listed bonus."},
        "transfigure":{"name":"Transfigure","description":"{1}{B}{B}, Sacrifice this creature: Search your library for a creature card with the same mana value, put it onto the battlefield, then shuffle. Activate only as a sorcery."},
        "transmute":{"name":"Transmute","description":"{1}{B}{B}, Discard this card: Search your library for a card with the same mana value, reveal it, put it into your hand, then shuffle. Activate only as a sorcery."},
        "unleash":{"name":"Unleash","description":"You may have this creature enter the battlefield with a +1/+1 counter on it. It can’t block as long as it has a +1/+1 counter on it."},
        "dredge":{"name":"Dredge","description":"If you would draw a card, you may mill N cards instead. If you do, return this card from your graveyard to your hand."},
        "detain":{"name":"Detain","description":"Until your next turn, target creature can’t attack or block and its activated abilities can’t be activated."},
        "forecast":{"name":"Forecast","description":"During your upkeep, you may reveal this card from your hand and pay its forecast cost to get its effect."},
        "echo":{"name":"Echo","description":"At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost."},
        "recover":{"name":"Recover","description":"When a creature is put into your graveyard from the battlefield, you may pay the recover cost. If you do, return this card from your graveyard to your hand; otherwise exile this card."},
        "haunt":{"name":"Haunt","description":"When this dies or the spell resolves, exile it haunting target creature. When that creature dies, you get the listed effect."},
        "offering":{"name":"Offering","description":"You may cast this any time you could cast an instant by sacrificing a [type] and paying the difference in mana costs between this and the sacrificed [type]."},
        "living weapon":{"name":"Living weapon","description":"When this Equipment enters the battlefield, create a 0/0 black Germ creature token, then attach this to it."},
        "miracle":{"name":"Miracle","description":"You may cast this card for its miracle cost when you draw it if it’s the first card you drew this turn."},
        "landfall":{"name":"Landfall","description":"Triggers when a land enters under your control."},
        "raid":{"name":"Raid","description":"Bonus if you attacked with a creature this turn."},
        "revolt":{"name":"Revolt","description":"Bonus if a permanent you controlled left the battlefield this turn."},
        "delirium":{"name":"Delirium","description":"Checks for four or more card types in your graveyard."},
        "threshold":{"name":"Threshold","description":"Turns on at seven or more cards in your graveyard."},
        "metalcraft":{"name":"Metalcraft","description":"Turns on if you control three or more artifacts."},
        "domain":{"name":"Domain","description":"Scales with the number of basic land types among lands you control."},
        "constellation":{"name":"Constellation","description":"Triggers when an enchantment enters under your control."},
        "ferocious":{"name":"Ferocious","description":"Bonus if you control a creature with power 4 or greater."},
        "formidable":{"name":"Formidable","description":"Bonus if total power among creatures you control is 8 or greater."},
        "morbid":{"name":"Morbid","description":"Bonus if a creature died this turn."},
        "fateful hour":{"name":"Fateful hour","description":"Bonus while you have 5 or less life."},
        "heroic":{"name":"Heroic","description":"Triggers when you cast a spell that targets this creature."},
        "imprint":{"name":"Imprint","description":"Exiles a card to grant additional effects to this permanent."},
        "radiance":{"name":"Radiance","description":"Spreads effects to permanents that share a color with the target."},
        "kinship":{"name":"Kinship","description":"At upkeep, reveal the top card; if it shares a type with this, you get an effect."},
        "grandeur":{"name":"Grandeur","description":"Discard another copy of this legendary card for a special effect."},
        "undergrowth":{"name":"Undergrowth","description":"Scales with the number of creature cards in your graveyard."},
        "spell mastery":{"name":"Spell mastery","description":"Bonus if two or more instants and/or sorceries are in your graveyard."},
        "chroma":{"name":"Chroma","description":"Scales with the number of colored mana symbols among permanents or cards you control."},
        "battalion":{"name":"Battalion","description":"Triggers when this and at least two other creatures attack."},
        "converge":{"name":"Converge","description":"Scales with the number of colors of mana spent to cast the spell."},
        "will of the council":{"name":"Will of the council","description":"Players vote for outcomes; the vote result determines the effect."},
        "council's dilemma":{"name":"Council’s dilemma","description":"Each player votes; effects scale with the number of each vote."},
        "parley":{"name":"Parley","description":"Each player reveals the top card; effects scale on what’s revealed."},
        "tempting offer":{"name":"Tempting offer","description":"You get an effect; each opponent may copy it—if they do, you get it again."},
        "eminence":{"name":"Eminence","description":"Ability functions while this commander is in command zone and/or battlefield."},
        "lieutenant":{"name":"Lieutenant","description":"Bonus while you control your commander."},
        "join forces":{"name":"Join forces","description":"Each player may pay any amount of mana; effects scale with total paid."},
        "magecraft":{"name":"Magecraft","description":"Triggers when you cast or copy an instant or sorcery."},
        "pack tactics":{"name":"Pack tactics","description":"Triggers when your attackers have total power 6 or greater."},
        "coven":{"name":"Coven","description":"Bonus if you control three or more creatures with different powers."},
        "celebration":{"name":"Celebration","description":"Bonus if two or more nonland permanents entered under your control this turn."},
        "corrupted":{"name":"Corrupted","description":"Bonus if an opponent has three or more poison counters."},
        "descend":{"name":"Descend","description":"Abilities that care about the number of permanent cards in your graveyard (e.g., Descend 4/8, Fathomless Descent)."},
        "valiant":{"name":"Valiant","description":"Triggers the first time each turn a creature becomes the target of a spell or ability you control."},
        "alliance":{"name":"Alliance","description":"Triggers whenever another creature enters the battlefield under your control."},
        "cohort":{"name":"Cohort","description":"Tap this and another Ally you control: do the listed effect."},
        "rally":{"name":"Rally","description":"Triggers whenever an Ally enters the battlefield under your control."},
        "hellbent":{"name":"Hellbent","description":"Bonus if you have no cards in hand."}
    },
    getSafeImageUrl: function(card) {
        if (!card || !card.image_url) return null;
        
        // Pour les cartes double faces, permettre les images de face arrière
        if (card.is_double_faced && card.card_faces && card.card_faces.length > 1) {
            const currentFace = card.current_face || 0;
            if (currentFace < card.card_faces.length && card.card_faces[currentFace].image_url) {
                return card.card_faces[currentFace].image_url;
            }
        }
        
        // Pour les cartes simples, éviter les images "/back/" (dos de cartes génériques)
        if (card.image_url.includes("/back/") && !card.is_double_faced) return null;
        return card.image_url;
    },

    debugCardImage: function(cardName, imageUrl, context) {
        console.log(`🃏 [${context}] Card: ${cardName}`);
        console.log(`Image URL: ${imageUrl || 'none'}`);
        console.log(`Valid: ${!!imageUrl}`);
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

    renderCardWithLoadingState: function(card, cardClass = 'card-mini', showTooltip = true, zone = 'unknown', isOpponent = false, index = 0, playerId = null) {
        const cardId = card.id || card.name;
        const cardName = card.name || 'Unknown';
        const imageUrl = this.getSafeImageUrl(card);
        const isTapped = card.tapped || false;
        const isTargeted = card.targeted || false;
        const tappedClass = isTapped ? ' tapped' : '';
        const targetedClass = isTargeted ? ' targeted' : '';
        const uniqueCardId = card.unique_id;
        const dataCardId = GameUtils.escapeHtml(cardId || '');
        const dataCardName = GameUtils.escapeHtml(cardName || '');
        const dataImageUrl = GameUtils.escapeHtml(imageUrl || '');
        const dataUniqueId = GameUtils.escapeHtml(uniqueCardId || '');
        const dataZone = GameUtils.escapeHtml(zone || '');
        const searchIndex = GameUtils.escapeHtml(this.buildSearchIndex(card));
        const jsCardId = JSON.stringify(cardId || '');
        const jsUniqueCardId = JSON.stringify(uniqueCardId || '');
        const zoneAttr = (zone || '').replace(/'/g, "\\'");

        let onClickAction = '';
        if (zone === 'creatures' || zone === 'support' || zone === 'permanents' || zone === 'lands' || zone === 'battlefield') {
            onClickAction = `onclick='GameActions.tapCard(${jsCardId}, ${jsUniqueCardId}); event.stopPropagation();'`;
        } else if (zone === 'hand') {
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

        // Generate counters display
        const countersHtml = this.generateCountersHtml(card);
        const powerToughnessHtml = this.generatePowerToughnessOverlay(card);

        return `
            <div class="${cardClass}${tappedClass}${targetedClass}" 
                data-card-id="${dataCardId}"
                data-card-unique-id="${dataUniqueId}"
                data-card-name="${dataCardName}"
                data-card-image="${dataImageUrl}"
                data-card-zone="${dataZone}"
                data-card-tapped="${isTapped}"
                data-card-targeted="${isTargeted}"
                data-card-search="${searchIndex}"
                data-card-data='${JSON.stringify(card).replace(/'/g, "&#39;")}'
                data-is-opponent="${isOpponent}"
                draggable="true"
                ondragstart="GameCards.handleDragStart(event, this)"
                ${dropAttributes}
                ${onClickAction}
                ondragend="GameCards.handleDragEnd(event, this)"
                oncontextmenu="GameCards.showCardContextMenu(event, this); return false;">
                ${imageUrl ? `
                    <div class="relative">
                        <img src="${imageUrl}" 
                             alt="${cardName}" 
                             style="opacity: 0; transition: opacity 0.3s ease;"
                             onload="this.style.opacity=1; this.nextElementSibling.style.display='none';"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="card-fallback" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none;">
                        </div>
                        ${countersHtml}
                        ${powerToughnessHtml}
                    </div>
                ` : `
                    <div class="card-fallback relative">
                        ${countersHtml}
                        ${powerToughnessHtml}
                    </div>
                `}
            </div>
        `;
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
                    countersHtml += `
                        <div class="counter ${counterClass}" title="${count} ${counterType} counter(s)">
                            <span class="counter-icon">${counterIcon}</span>
                            <span class="counter-value">${count}</span>
                        </div>
                    `;
                }
            }
        }
        
        countersHtml += '</div>';
        return countersHtml;
    },

    getCounterIcon: function(counterType) {
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
        return icons[counterType] || '🔢';
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
        console.log(`📋 Card Preview: ${cardName} (ID: ${cardId})`);
        if (imageUrl) {
            console.log(`🖼️ Image: ${imageUrl}`);
        }

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

        if (event && event.clientX && event.clientY) {
            const previewRect = preview.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            let x = event.clientX + 20;
            let y = event.clientY + 20;

            if (x + previewRect.width > viewportWidth) {
                x = event.clientX - previewRect.width - 20;
            }
            if (y + previewRect.height > viewportHeight) {
                y = event.clientY - previewRect.height - 20;
            }

            x = Math.max(10, Math.min(x, viewportWidth - previewRect.width - 10));
            y = Math.max(10, Math.min(y, viewportHeight - previewRect.height - 10));

            preview.style.position = 'fixed';
            preview.style.left = `${x}px`;
            preview.style.top = `${y}px`;
            preview.style.transform = 'none';
        }
    },

    showCardContextMenu: function(event, cardElement) {
        event.preventDefault();

        const cardId = cardElement.getAttribute('data-card-id');
        const cardName = cardElement.getAttribute('data-card-name');
        const cardImage = cardElement.getAttribute('data-card-image');
        const cardZone = cardElement.getAttribute('data-card-zone') || 'unknown';
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id') || '';
        const isTapped = cardElement.getAttribute('data-card-tapped') === 'true';
        const isOpponent = cardElement.getAttribute('data-is-opponent') === 'true';
        const isTargeted = cardElement.classList.contains('targeted');

        const safeCardName = GameUtils.escapeHtml(cardName || 'Unknown');
        const safeCardImage = GameUtils.escapeHtml(cardImage || '');
        const jsCardId = JSON.stringify(cardId || '');
        const jsCardName = JSON.stringify(cardName || '');
        const jsCardImage = JSON.stringify(cardImage || '');
        const jsCardZone = JSON.stringify(cardZone || 'unknown');
        const jsUniqueCardId = JSON.stringify(uniqueCardId || '');

        console.log(`🃏 Context menu for: ${cardName} (Zone: ${cardZone}, Tapped: ${isTapped}, UniqueID: ${uniqueCardId}, Opponent: ${isOpponent})`);

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
            <div class="card-context-menu-divider"></div>
            <div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.showCardPreview(${jsCardId}, ${jsCardName}, ${jsCardImage})`)}"><span class="icon">🔍</span> View Full Size</div>
            <div class="card-context-menu-divider"></div>`;

        const targetAction = isTargeted ? 'Untarget' : 'Target';
        const targetIcon = isTargeted ? '❌' : '🎯';
        menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.toggleCardTarget(${jsUniqueCardId})`)}"><span class="icon">${targetIcon}</span> ${targetAction}</div>`;

        const cardData = JSON.parse(cardElement.getAttribute('data-card-data') || '{}');
        const isDoubleFaced = cardData.is_double_faced && cardData.card_faces && cardData.card_faces.length > 1;

        if (isDoubleFaced && !isOpponent) {
            const currentFace = cardData.current_face || 0;
            const faceText = currentFace === 0 ? 'Back' : 'Front';
            menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.flipCard(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">🔄</span> Flip to ${faceText}</div>`;
        }

        if (!isOpponent) {
            if (cardZone === 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.playCardFromHand(${jsCardId})`)}"><span class="icon">▶️</span> Play Card</div>`;
            } else if (cardZone === 'deck') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.performGameAction("play_card_from_library", { unique_id: ${jsUniqueCardId} }); UIZonesManager.closeZoneModal("deck");`)}"><span class="icon">⚔️</span> Put on Battlefield</div>`;
            }

            if (cardZone === 'battlefield' || cardZone === 'permanents' || cardZone === 'lands' || cardZone === 'creatures' || cardZone === 'support') {
                const tapAction = isTapped ? 'Untap' : 'Tap';
                const tapIcon = isTapped ? '⤴️' : '🔄';
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.tapCard(${jsCardId}, ${jsUniqueCardId})`)}"><span class="icon">${tapIcon}</span> ${tapAction}</div>`;

                const counterIcon = '🔢';
                menuHTML += `<div class="card-context-menu-divider"></div>`;
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameCards.showCounterModal(${jsUniqueCardId}, ${jsCardId})`)}"><span class="icon">${counterIcon}</span> Manage Counters</div>`;
            }

            menuHTML += `
                <div class="card-context-menu-divider"></div>
                <div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendToGraveyard(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">⚰️</span> Send to Graveyard</div>
                <div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.sendToExile(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">✨</span> Send to Exile</div>`;
            if (cardZone !== 'hand') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.moveCard(${jsCardId}, ${jsCardZone}, "hand", ${jsUniqueCardId})`)}"><span class="icon">👋</span> Return to Hand</div>`;
            }
            if (cardZone !== 'reveal') {
                menuHTML += `<div class="card-context-menu-item" onclick="${makeHandler(`GameCards.closeContextMenu(); GameActions.showInRevealZone(${jsCardId}, ${jsCardZone}, ${jsUniqueCardId})`)}"><span class="icon">👁️</span> Show in Reveal Zone</div>`;
            }
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

        document.addEventListener('click', this.closeContextMenu.bind(this));
    },

    toggleCardTarget: function(uniqueCardId) {
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

            const cardName = cardElement.getAttribute('data-card-name');
            const actionText = isTargeted ? 'targeted' : 'untargeted';
            GameUI.showNotification(`${cardName} ${actionText}`, 'info');
        }
    },

    closeContextMenu: function() {
        const menu = document.getElementById('card-context-menu');
        if (menu) {
            menu.remove();
        }
        document.removeEventListener('click', this.closeContextMenu);
    },

    handleCardPreviewClick: function(event) {
        const preview = document.getElementById('card-preview-modal');
        if (preview) {
            preview.remove();
            this.removeCardPreviewListeners();
        }
    },

    handleCardPreviewKeydown: function(event) {
        if (event.key === 'Escape') {
            const preview = document.getElementById('card-preview-modal');
            if (preview) {
                preview.remove();
                this.removeCardPreviewListeners();
            }
        }
    },

    // Ajout des propriétés pour stocker les références liées
    _boundHandleCardPreviewClick: null,
    _boundHandleCardPreviewKeydown: null,

    addCardPreviewListeners: function() {
        // Utiliser des références liées persistantes
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

    flipCard: function(cardId, uniqueCardId) {
        GameActions.performGameAction('flip_card', {
            card_id: cardId,
            unique_id: uniqueCardId
        });

        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (cardElement) {
            const cardName = cardElement.getAttribute('data-card-name');
            GameUI.showNotification(`${cardName} flipped`, 'info');
            
            // Attendre un peu pour que le serveur traite l'action, puis rafraîchir l'affichage
            setTimeout(() => {
                // Déclencher un rafraîchissement des données de jeu pour mettre à jour l'interface
                if (window.gameWebSocket && window.gameWebSocket.readyState === WebSocket.OPEN) {
                    // Le WebSocket se chargera automatiquement de rafraîchir l'interface
                    console.log('Card flip processed, interface will update via WebSocket');
                } else {
                    // Fallback: rafraîchir manuellement si pas de WebSocket
                    window.location.reload();
                }
            }, 500);
        }
    },

    handleDragStart: function(event, cardElement) {
        const cardId = cardElement.getAttribute('data-card-id');
        const cardZone = cardElement.getAttribute('data-card-zone');
        const uniqueCardId = cardElement.getAttribute('data-card-unique-id');
        event.dataTransfer.setData('text/plain', JSON.stringify({
            cardId,
            cardZone,
            uniqueCardId
        }));
        // Optionally: add visual feedback
        cardElement.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        GameCards.draggedCardElement = cardElement;
    },

    handleDragEnd: function(event, cardElement) {
        if (!cardElement) return;
        
        cardElement.classList.remove('dragging');
        cardElement.style.removeProperty('opacity');
        cardElement.style.removeProperty('pointer-events');
        if (GameCards.draggedCardElement === cardElement) {
            GameCards.draggedCardElement = null;
        }
    },

    showCounterModal: function(uniqueCardId, cardId) {
        const cardElement = document.querySelector(`[data-card-unique-id="${uniqueCardId}"]`);
        if (!cardElement) return;

        const cardData = JSON.parse(cardElement.getAttribute('data-card-data') || '{}');
        const cardName = cardData.name || 'Unknown Card';

        // Remove any existing counter modal
        const existingModal = document.getElementById('counter-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'counter-modal';
        modal.className = 'counter-modal';
        modal.innerHTML = `
            <div class="counter-modal-content">
                <div class="counter-modal-header">
                    <h3>${cardName} - Manage Counters</h3>
                    <button class="counter-modal-close" onclick="GameCards.closeCounterModal()">&times;</button>
                </div>
                <div class="counter-modal-body">
                    ${this.generateCounterControls(cardData, uniqueCardId, cardId)}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';
    },

    generateCounterControls: function(cardData, uniqueCardId, cardId) {
        const counters = cardData.counters || {};
        const counterEntries = Object.entries(counters).filter(([_, count]) => Number(count) > 0);

        let html = '';

        if (counterEntries.length) {
            html += '<div class="counter-controls">';
            counterEntries.forEach(([counterType, count]) => {
                const counterIcon = this.getCounterIcon(counterType);
                html += `
                    <div class="counter-control-row">
                        <span class="counter-icon">${counterIcon}</span>
                        <span class="counter-type">${counterType}</span>
                        <div class="counter-controls-buttons">
                            <button onclick="GameCards.modifyCounter('${uniqueCardId}', '${cardId}', '${counterType}', -1)">-</button>
                            <span class="counter-amount">${count}</span>
                            <button onclick="GameCards.modifyCounter('${uniqueCardId}', '${cardId}', '${counterType}', 1)">+</button>
                            <button class="remove-counter-btn" onclick="GameCards.removeAllCounters('${uniqueCardId}', '${cardId}', '${counterType}')">Remove All</button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<p class="counter-empty">No counters on this card.</p>';
        }

        html += `
            <div class="add-counter-form">
                <label for="counter-type-select-${uniqueCardId}">Counter Type:</label>
                <select id="counter-type-select-${uniqueCardId}">
                    <option value="+1/+1">+1/+1</option>
                    <option value="-1/-1">-1/-1</option>
                    <option value="loyalty">Loyalty</option>
                    <option value="charge">Charge</option>
                    <option value="poison">Poison</option>
                    <option value="energy">Energy</option>
                    <option value="experience">Experience</option>
                    <option value="treasure">Treasure</option>
                    <option value="food">Food</option>
                    <option value="clue">Clue</option>
                    <option value="blood">Blood</option>
                    <option value="oil">Oil</option>
                </select>
                <label for="counter-amount-input-${uniqueCardId}">Amount:</label>
                <input type="number" id="counter-amount-input-${uniqueCardId}" value="1" min="1" max="20">
                <button class="add-counter-btn" onclick="GameCards.addCounterFromModal('${uniqueCardId}', '${cardId}')">Add Counter</button>
            </div>
        `;
        html += this.generatePowerToughnessManager(cardData, uniqueCardId, cardId);

        return html;
    },

    addCounterFromModal: function(uniqueCardId, cardId) {
        const typeSelect = document.getElementById(`counter-type-select-${uniqueCardId}`);
        const amountInput = document.getElementById(`counter-amount-input-${uniqueCardId}`);

        if (!typeSelect || !amountInput) {
            return;
        }

        const counterType = typeSelect.value;
        const amount = parseInt(amountInput.value, 10) || 1;

        GameActions.performGameAction('add_counter', {
            unique_id: uniqueCardId,
            card_id: cardId,
            counter_type: counterType,
            amount: amount
        });

        GameUI.showNotification(`Added ${amount} ${counterType} counter(s)`, 'success');

        setTimeout(() => {
            this.showCounterModal(uniqueCardId, cardId);
        }, 150);
    },

    modifyCounter: function(uniqueCardId, cardId, counterType, change) {
        if (change > 0) {
            GameActions.performGameAction('add_counter', {
                unique_id: uniqueCardId,
                card_id: cardId,
                counter_type: counterType,
                amount: change
            });
        } else {
            GameActions.performGameAction('remove_counter', {
                unique_id: uniqueCardId,
                card_id: cardId,
                counter_type: counterType,
                amount: Math.abs(change)
            });
        }

        // Refresh the modal content
        setTimeout(() => {
            const modal = document.getElementById('counter-modal');
            if (modal) {
                this.showCounterModal(uniqueCardId, cardId);
            }
        }, 100);
    },

    removeAllCounters: function(uniqueCardId, cardId, counterType) {
        GameActions.performGameAction('set_counter', {
            unique_id: uniqueCardId,
            card_id: cardId,
            counter_type: counterType,
            amount: 0
        });

        this.closeCounterModal();
        GameUI.showNotification(`Removed all ${counterType} counters`, 'info');
    },

    generatePowerToughnessManager: function(cardData, uniqueCardId, cardId) {
        const stats = this.computeEffectivePowerToughness(cardData);
        const basePower = cardData.power !== undefined && cardData.power !== null
            ? String(cardData.power)
            : '';
        const baseToughness = cardData.toughness !== undefined && cardData.toughness !== null
            ? String(cardData.toughness)
            : '';

        const overridePower = cardData.current_power ?? cardData.currentPower ??
            cardData.power_override ?? cardData.powerOverride ?? '';
        const overrideToughness = cardData.current_toughness ?? cardData.currentToughness ??
            cardData.toughness_override ?? cardData.toughnessOverride ?? '';

        const hasBaseStat = Boolean(basePower || baseToughness);
        const hasOverride = Boolean(overridePower || overrideToughness);
        const typeLine = String(cardData.type_line || cardData.typeLine || '').toLowerCase();
        const isCreature = (typeof cardData.card_type === 'string' && cardData.card_type.toLowerCase().includes('creature'))
            || typeLine.includes('creature');

        if (!hasBaseStat && !hasOverride && !isCreature) {
            return '';
        }

        const currentPowerDisplay = stats ? stats.displayPowerText : (overridePower || basePower || '—');
        const currentToughnessDisplay = stats ? stats.displayToughnessText : (overrideToughness || baseToughness || '—');

        const escape = GameUtils.escapeHtml;
        const inputPowerValue = overridePower ? escape(String(overridePower)) : '';
        const inputToughnessValue = overrideToughness ? escape(String(overrideToughness)) : '';
        const baseDisplay = `${escape(basePower || '—')}/${escape(baseToughness || '—')}`;
        const currentDisplay = `${escape(String(currentPowerDisplay))}/${escape(String(currentToughnessDisplay))}`;

        return `
            <div class="pt-manager">
                <div class="pt-manager-header">
                    <span class="pt-manager-title">Power / Toughness Override</span>
                    <span class="pt-manager-base">Base: ${baseDisplay}</span>
                </div>
                <div class="pt-manager-inputs">
                    <label class="pt-manager-field">
                        <span>Power</span>
                        <input type="number" inputmode="numeric" pattern="^-?\\d*$" id="pt-power-input-${uniqueCardId}" value="${inputPowerValue}" placeholder="${escape(basePower || '')}">
                    </label>
                    <label class="pt-manager-field">
                        <span>Toughness</span>
                        <input type="number" inputmode="numeric" pattern="^-?\\d*$" id="pt-toughness-input-${uniqueCardId}" value="${inputToughnessValue}" placeholder="${escape(baseToughness || '')}">
                    </label>
                </div>
                <div class="pt-manager-footer">
                    <div class="pt-manager-actions">
                        <button class="pt-manager-apply" onclick="GameCards.applyPowerToughness('${uniqueCardId}', '${cardId}')">Apply</button>
                        <button class="pt-manager-reset" onclick="GameCards.resetPowerToughness('${uniqueCardId}', '${cardId}')">Reset</button>
                    </div>
                    <div class="pt-manager-current">Current: ${currentDisplay}</div>
                </div>
                <p class="pt-manager-hint">Only integer values are allowed. Leave a field blank to keep the base value.</p>
            </div>
        `;
    },

    applyPowerToughness: function(uniqueCardId, cardId) {
        const powerInput = document.getElementById(`pt-power-input-${uniqueCardId}`);
        const toughnessInput = document.getElementById(`pt-toughness-input-${uniqueCardId}`);

        if (!powerInput || !toughnessInput) {
            return;
        }

        const normalize = (input) => {
            if (!input) {
                return null;
            }
            const value = input.value.trim();
            if (!value) {
                return null;
            }
            if (!/^-?\d+$/.test(value)) {
                throw new Error('Power/Toughness values must be integers');
            }
            return parseInt(value, 10);
        };

        let payload;
        try {
            const normalizedPower = normalize(powerInput);
            const normalizedToughness = normalize(toughnessInput);

            payload = {
                unique_id: uniqueCardId,
                card_id: cardId,
                power: normalizedPower,
                toughness: normalizedToughness
            };
        } catch (error) {
            GameUI.showNotification(error.message, 'error');
            return;
        }

        GameActions.performGameAction('set_power_toughness', payload);
        GameUI.showNotification('Power/Toughness updated', 'success');

        setTimeout(() => {
            this.showCounterModal(uniqueCardId, cardId);
        }, 200);
    },

    resetPowerToughness: function(uniqueCardId, cardId) {
        GameActions.performGameAction('set_power_toughness', {
            unique_id: uniqueCardId,
            card_id: cardId,
            power: null,
            toughness: null
        });

        const powerInput = document.getElementById(`pt-power-input-${uniqueCardId}`);
        const toughnessInput = document.getElementById(`pt-toughness-input-${uniqueCardId}`);
        if (powerInput) powerInput.value = '';
        if (toughnessInput) toughnessInput.value = '';

        GameUI.showNotification('Power/Toughness reset to base values', 'info');

        setTimeout(() => {
            this.showCounterModal(uniqueCardId, cardId);
        }, 200);
    },

    closeCounterModal: function() {
        const modal = document.getElementById('counter-modal');
        if (modal) {
            modal.remove();
        }
    }
};

window.GameCards = GameCards;
