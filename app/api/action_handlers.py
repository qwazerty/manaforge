"""
Action handlers for game actions.
"""

from typing import Dict, Any, Optional
from fastapi import HTTPException

from app.models.game import GameState
from app.api.decorators import action_registry


@action_registry.register("pass_phase")
async def handle_pass_phase(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle pass phase action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("change_phase", required_fields=["phase"])
async def handle_change_phase(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle direct phase change."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for change_phase"
        )

    new_phase = request.get("phase")
    if not new_phase:
        raise HTTPException(
            status_code=400, detail="phase is required for change_phase"
        )
    return {
        "additional_data": {"phase": new_phase},
        "broadcast_data": {"phase": new_phase},
    }


@action_registry.register("shuffle_library")
async def handle_shuffle_library(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle shuffle library action."""
    return {
        "broadcast_data": {}
    }


@action_registry.register("draw_card")
async def handle_draw_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle draw card action."""
    return {
        "broadcast_data": {}
    }


@action_registry.register("play_card", required_fields=["card_id", "unique_id"])
async def handle_play_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle play card action from hand."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for play_card"
        )
    
    card_id = request.get("card_id")
    unique_id = request.get("unique_id")
    
    return {
        "card_id": card_id,
        "additional_data": {"unique_id": unique_id},
        "broadcast_data": {"card": card_id, "unique_id": unique_id}
    }

@action_registry.register("play_card_from_library", required_fields=["card_id", "unique_id"])
async def handle_play_card_from_library(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle play card action from library."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for play_card_from_library"
        )
    
    card_id = request.get("card_id")
    unique_id = request.get("unique_id")
    
    return {
        "card_id": card_id,
        "additional_data": {"unique_id": unique_id},
        "broadcast_data": {"card": card_id, "unique_id": unique_id}
    }


@action_registry.register("tap_card", required_fields=["card_id", "unique_id"])
async def handle_tap_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle tap/untap card action."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for tap_card"
        )
    
    card_id = request.get("card_id")
    unique_id = request.get("unique_id")
    tapped = request.get("tapped")
    
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id is required")
    
    return {
        "card_id": card_id,
        "additional_data": {
            "unique_id": unique_id,
            "tapped": tapped
        } if tapped is not None else {"unique_id": unique_id},
        "broadcast_data": {
            "card": card_id,
            "unique_id": unique_id,
            "tapped": tapped
        }
    }


@action_registry.register("untap_all")
async def handle_untap_all(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle untap all permanents action."""
    return {
        "broadcast_data": {}
    }


@action_registry.register("modify_life", required_fields=["target_player", "amount"])
async def handle_modify_life(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle modify life action."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for modify_life"
        )
    
    target_player = request.get("target_player")
    amount = request.get("amount")
    
    if target_player is None:
        raise HTTPException(status_code=400, detail="target_player is required")
    if amount is None:
        raise HTTPException(status_code=400, detail="amount is required")
    
    return {
        "additional_data": {
            "target_player": target_player,
            "amount": amount
        },
        "broadcast_data": {"target": target_player, "amount": amount}
    }

@action_registry.register("adjust_commander_tax", required_fields=["amount"])
async def handle_adjust_commander_tax(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle commander tax adjustments."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for adjust_commander_tax"
        )

    amount = request.get("amount")
    target_player = request.get("target_player")

    if amount is None:
        raise HTTPException(status_code=400, detail="amount is required")

    return {
        "additional_data": {
            "amount": amount,
            "target_player": target_player
        },
        "broadcast_data": {
            "target": target_player,
            "amount": amount
        }
    }


@action_registry.register("resolve_stack")
async def handle_resolve_stack(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle resolve stack action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("resolve_all_stack")
async def handle_resolve_all_stack(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle resolve all stack action - resolves all spells on the stack."""
    return {
        "broadcast_data": {}
    }


@action_registry.register("pass_priority")
async def handle_pass_priority(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle pass priority action."""
    return {
        "broadcast_data": {}
    }


@action_registry.register("resolve_stack_spell")
async def handle_resolve_stack_spell(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle resolve stack spell action."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for resolve_stack_spell"
        )
    
    card_id = request.get("card_id")
    stack_index = request.get("stack_index", 0)
    
    return {
        "card_id": card_id,
        "additional_data": {"stack_index": stack_index},
        "broadcast_data": {"card": card_id, "stack_index": stack_index}
    }


@action_registry.register("counter_stack_spell")
async def handle_counter_stack_spell(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle counter stack spell action."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for counter_stack_spell"
        )
    
    card_id = request.get("card_id")
    stack_index = request.get("stack_index", 0)
    
    return {
        "card_id": card_id,
        "additional_data": {"stack_index": stack_index},
        "broadcast_data": {"card": card_id, "stack_index": stack_index}
    }


@action_registry.register("copy_stack_spell")
async def handle_copy_stack_spell(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle copy stack spell action."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for copy_stack_spell"
        )
    
    card_id = request.get("card_id")
    stack_index = request.get("stack_index", 0)
    
    return {
        "card_id": card_id,
        "additional_data": {"stack_index": stack_index},
        "broadcast_data": {"card": card_id, "stack_index": stack_index}
    }


@action_registry.register("mulligan")
async def handle_mulligan(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle mulligan action."""
    return {
        "broadcast_data": {}
    }


@action_registry.register("scry", required_fields=["amount"])
async def handle_scry(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle scry action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for scry")
    
    amount = request.get("amount")
    
    return {
        "additional_data": {"amount": amount},
        "broadcast_data": {"amount": amount}
    }


@action_registry.register("surveil", required_fields=["amount"])
async def handle_surveil(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle surveil action."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for surveil"
        )
    
    amount = request.get("amount")
    
    return {
        "additional_data": {"amount": amount},
        "broadcast_data": {"amount": amount}
    }


@action_registry.register("resolve_temporary_zone", required_fields=["decisions"])
async def handle_resolve_temporary_zone(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle resolving player decisions for scry/surveil."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for resolving temporary zone"
        )
    
    decisions = request.get("decisions")
    
    return {
        "additional_data": {"decisions": decisions},
        "broadcast_data": {"decisions": decisions}
    }


@action_registry.register(
    "add_to_temporary_zone", required_fields=["action_name", "count"]
)
async def handle_add_to_temporary_zone(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle adding more cards to the temporary zone for scry/surveil."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for this action"
        )

    action_name = request.get("action_name")
    count = request.get("count", 1)

    if action_name not in ["scry", "surveil"]:
        raise HTTPException(
            status_code=400, detail="Invalid action_name for add_to_temporary_zone"
        )

    # This handler transforms the action into a scry or surveil action.
    # The router will use the new action_type to call the game engine.
    return {
        "action_type": action_name,
        "additional_data": {"amount": count},
        "broadcast_data": {"action_type": action_name, "count": count}
    }


@action_registry.register(
    "move_card",
    required_fields=["card_id", "source_zone", "target_zone", "unique_id"]
)
async def handle_move_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle moving a card from one zone to another."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for move_card"
        )

    card_id = request.get("card_id")
    source_zone = request.get("source_zone")
    target_zone = request.get("target_zone")
    unique_id = request.get("unique_id")

    deck_position = request.get("deck_position")
    position_index = request.get("position_index")

    additional_data = {
        "source_zone": source_zone,
        "target_zone": target_zone,
        "unique_id": unique_id,
    }
    broadcast_data = {
        "card": card_id,
        "source_zone": source_zone,
        "target_zone": target_zone,
        "unique_id": unique_id,
    }

    if deck_position is not None:
        additional_data["deck_position"] = deck_position
        broadcast_data["deck_position"] = deck_position

    if position_index is not None:
        additional_data["position_index"] = position_index
        broadcast_data["position_index"] = position_index

    return {
        "card_id": card_id,
        "additional_data": additional_data,
        "broadcast_data": broadcast_data,
    }


@action_registry.register(
    "duplicate_card",
    required_fields=["card_id", "unique_id"]
)
async def handle_duplicate_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle duplicating a battlefield card."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for duplicate_card"
        )

    card_id = request.get("card_id")
    unique_id = request.get("unique_id")
    source_zone = request.get("source_zone", "battlefield")

    return {
        "card_id": card_id,
        "additional_data": {
            "unique_id": unique_id,
            "source_zone": source_zone,
        },
        "broadcast_data": {
            "card": card_id,
            "unique_id": unique_id,
            "source_zone": source_zone,
            "duplicate": True
        }
    }


@action_registry.register(
    "target_card", required_fields=["unique_id", "card_id", "targeted"]
)
async def handle_target_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle targeting or untargeting a card."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for target_card"
        )

    unique_id = request.get("unique_id")
    card_id = request.get("card_id")
    targeted = request.get("targeted")

    return {
        "card_id": card_id,
        "additional_data": {
            "unique_id": unique_id,
            "targeted": targeted,
        },
        "broadcast_data": {
            "unique_id": unique_id,
            "card_id": card_id,
            "targeted": targeted,
        },
    }

@action_registry.register(
    "flip_card", required_fields=["unique_id", "card_id"]
)
async def handle_flip_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle flipping a double-faced card."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for flip_card"
        )

    unique_id = request.get("unique_id")
    card_id = request.get("card_id")

    return {
        "card_id": card_id,
        "additional_data": {
            "unique_id": unique_id,
        },
        "broadcast_data": {
            "unique_id": unique_id,
            "card_id": card_id,
        },
    }

@action_registry.register(
    "add_counter", required_fields=["unique_id", "card_id", "counter_type"]
)
async def handle_add_counter(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle adding counters to a card."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for add_counter"
        )

    unique_id = request.get("unique_id")
    card_id = request.get("card_id")
    counter_type = request.get("counter_type")
    amount = request.get("amount", 1)

    return {
        "card_id": card_id,
        "additional_data": {
            "unique_id": unique_id,
            "counter_type": counter_type,
            "amount": amount,
        },
        "broadcast_data": {
            "unique_id": unique_id,
            "card_id": card_id,
            "counter_type": counter_type,
            "amount": amount,
        },
    }

@action_registry.register(
    "set_power_toughness",
    required_fields=["unique_id"]
)
async def handle_set_power_toughness(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle overriding a creature's power and toughness."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for set_power_toughness"
        )

    unique_id = request.get("unique_id")
    if not unique_id:
        raise HTTPException(
            status_code=400, detail="unique_id is required for set_power_toughness"
        )

    power = request.get("power")
    toughness = request.get("toughness")

    additional_data: Dict[str, Any] = {"unique_id": unique_id}
    broadcast_data: Dict[str, Any] = {"unique_id": unique_id}

    if power is not None:
        additional_data["power"] = power
        broadcast_data["power"] = power

    if toughness is not None:
        additional_data["toughness"] = toughness
        broadcast_data["toughness"] = toughness

    return {
        "additional_data": additional_data,
        "broadcast_data": broadcast_data,
    }

@action_registry.register(
    "remove_counter", required_fields=["unique_id", "card_id", "counter_type"]
)
async def handle_remove_counter(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle removing counters from a card."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for remove_counter"
        )

    unique_id = request.get("unique_id")
    card_id = request.get("card_id")
    counter_type = request.get("counter_type")
    amount = request.get("amount", 1)

    return {
        "card_id": card_id,
        "additional_data": {
            "unique_id": unique_id,
            "counter_type": counter_type,
            "amount": amount,
        },
        "broadcast_data": {
            "unique_id": unique_id,
            "card_id": card_id,
            "counter_type": counter_type,
            "amount": amount,
        },
    }

@action_registry.register(
    "set_counter", required_fields=["unique_id", "card_id", "counter_type", "amount"]
)
async def handle_set_counter(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle setting counters on a card to a specific amount."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for set_counter"
        )

    unique_id = request.get("unique_id")
    card_id = request.get("card_id")
    counter_type = request.get("counter_type")
    amount = request.get("amount", 0)

    return {
        "card_id": card_id,
        "additional_data": {
            "unique_id": unique_id,
            "counter_type": counter_type,
            "amount": amount,
        },
        "broadcast_data": {
            "unique_id": unique_id,
            "card_id": card_id,
            "counter_type": counter_type,
            "amount": amount,
        },
    }

@action_registry.register(
    "search_and_add_card", required_fields=["card_name", "target_zone"]
)
async def handle_search_and_add_card(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle searching for a card and adding it to the specified zone."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for search_and_add_card"
        )

    card_name = request.get("card_name")
    target_zone = request.get("target_zone")
    is_token = request.get("is_token", False)
    
    if target_zone not in ["hand", "battlefield", "graveyard", "exile", "library"]:
        raise HTTPException(
            status_code=400, detail="Invalid target zone"
        )

    return {
        "additional_data": {
            "card_name": card_name,
            "target_zone": target_zone,
            "is_token": is_token,
        },
        "broadcast_data": {
            "card_name": card_name,
            "target_zone": target_zone,
            "is_token": is_token,
        },
    }

@action_registry.register("create_token", required_fields=["scryfall_id"])
async def handle_create_token(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle creating a token creature."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for create_token"
        )

    scryfall_id = request.get("scryfall_id")

    return {
        "additional_data": {
            "scryfall_id": scryfall_id,
        },
        "broadcast_data": {
            "scryfall_id": scryfall_id,
        },
    }

@action_registry.register("declare_attackers", required_fields=["attacking_creatures"])
async def handle_declare_attackers(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle declaring attacking creatures."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for declare_attackers"
        )

    attacking_creatures = request.get("attacking_creatures", [])
    if not isinstance(attacking_creatures, list):
        raise HTTPException(
            status_code=400, detail="attacking_creatures must be a list"
        )

    return {
        "additional_data": {
            "attacking_creatures": attacking_creatures,
        },
        "broadcast_data": {
            "attacking_creatures": attacking_creatures,
        },
    }

@action_registry.register("declare_blockers", required_fields=["blocking_assignments"])
async def handle_declare_blockers(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle declaring blocking creatures."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for declare_blockers"
        )

    blocking_assignments = request.get("blocking_assignments", {})
    if not isinstance(blocking_assignments, dict):
        raise HTTPException(
            status_code=400, detail="blocking_assignments must be a dictionary"
        )

    return {
        "additional_data": {
            "blocking_assignments": blocking_assignments,
        },
        "broadcast_data": {
            "blocking_assignments": blocking_assignments,
        },
    }


@action_registry.register("preview_attackers", required_fields=["attacking_creatures"])
async def handle_preview_attackers(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle previewing attacking creatures prior to confirmation."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for preview_attackers"
        )

    attacking_creatures = request.get("attacking_creatures", [])
    if not isinstance(attacking_creatures, list):
        raise HTTPException(
            status_code=400, detail="attacking_creatures must be a list"
        )

    return {
        "additional_data": {
            "attacking_creatures": attacking_creatures,
        },
        "broadcast_data": {
            "attacking_creatures": attacking_creatures,
        },
    }


@action_registry.register("preview_blockers", required_fields=["blocking_assignments"])
async def handle_preview_blockers(
    game_id: str, request: Optional[Dict], current_state: GameState
) -> Dict[str, Any]:
    """Handle previewing blocking assignments prior to confirmation."""
    if not request:
        raise HTTPException(
            status_code=400, detail="Request body required for preview_blockers"
        )

    blocking_assignments = request.get("blocking_assignments", {})
    if not isinstance(blocking_assignments, dict):
        raise HTTPException(
            status_code=400, detail="blocking_assignments must be a dictionary"
        )

    return {
        "additional_data": {
            "blocking_assignments": blocking_assignments,
        },
        "broadcast_data": {
            "blocking_assignments": blocking_assignments,
        },
    }
