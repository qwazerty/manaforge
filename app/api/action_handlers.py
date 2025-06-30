"""
Action handlers for game actions.
"""

from typing import Dict, Any, Optional
from fastapi import HTTPException

from app.models.game import GameState
from app.api.decorators import action_registry

@action_registry.register("pass_phase")
async def handle_pass_phase(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle pass phase action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("shuffle_library")
async def handle_shuffle_library(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle shuffle library action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("draw_card")
async def handle_draw_card(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle draw card action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("play_card", required_fields=["card_id", "card_name"])
async def handle_play_card(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle play card action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for play_card")
    
    card_name = request.get("card_name")
    card_id = request.get("card_id")
    
    return {
        "card_id": card_id or card_name,
        "additional_data": {"card_name": card_name} if card_name else {},
        "broadcast_data": {"card": card_name or card_id}
    }

@action_registry.register("tap_card", required_fields=["card_id"])
async def handle_tap_card(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle tap/untap card action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for tap_card")
    
    card_id = request.get("card_id")
    tapped = request.get("tapped")
    
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id is required")
    
    return {
        "card_id": card_id,
        "additional_data": {"tapped": tapped} if tapped is not None else {},
        "broadcast_data": {"card": card_id, "tapped": tapped}
    }

@action_registry.register("untap_all")
async def handle_untap_all(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle untap all permanents action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("modify_life", required_fields=["target_player", "amount"])
async def handle_modify_life(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle modify life action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for modify_life")
    
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

@action_registry.register("resolve_stack")
async def handle_resolve_stack(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle resolve stack action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("pass_priority")
async def handle_pass_priority(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle pass priority action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("resolve_stack_spell")
async def handle_resolve_stack_spell(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle resolve stack spell action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for resolve_stack_spell")
    
    card_id = request.get("card_id")
    stack_index = request.get("stack_index", 0)
    
    return {
        "card_id": card_id,
        "additional_data": {"stack_index": stack_index},
        "broadcast_data": {"card": card_id, "stack_index": stack_index}
    }

@action_registry.register("counter_stack_spell")
async def handle_counter_stack_spell(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle counter stack spell action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for counter_stack_spell")
    
    card_id = request.get("card_id")
    stack_index = request.get("stack_index", 0)
    
    return {
        "card_id": card_id,
        "additional_data": {"stack_index": stack_index},
        "broadcast_data": {"card": card_id, "stack_index": stack_index}
    }

@action_registry.register("copy_stack_spell")
async def handle_copy_stack_spell(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle copy stack spell action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for copy_stack_spell")
    
    card_id = request.get("card_id")
    stack_index = request.get("stack_index", 0)
    
    return {
        "card_id": card_id,
        "additional_data": {"stack_index": stack_index},
        "broadcast_data": {"card": card_id, "stack_index": stack_index}
    }

@action_registry.register("mulligan")
async def handle_mulligan(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle mulligan action."""
    return {
        "broadcast_data": {}
    }

@action_registry.register("scry", required_fields=["amount"])
async def handle_scry(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle scry action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for scry")
    
    amount = request.get("amount")
    
    return {
        "additional_data": {"amount": amount},
        "broadcast_data": {"amount": amount}
    }

@action_registry.register("surveil", required_fields=["amount"])
async def handle_surveil(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle surveil action."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for surveil")
    
    amount = request.get("amount")
    
    return {
        "additional_data": {"amount": amount},
        "broadcast_data": {"amount": amount}
    }

@action_registry.register("resolve_temporary_zone", required_fields=["decisions"])
async def handle_resolve_temporary_zone(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle resolving player decisions for scry/surveil."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for resolving temporary zone")
    
    decisions = request.get("decisions")
    
    return {
        "additional_data": {"decisions": decisions},
        "broadcast_data": {"decisions": decisions}
    }

@action_registry.register("add_to_temporary_zone", required_fields=["action_name", "count"])
async def handle_add_to_temporary_zone(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle adding more cards to the temporary zone for scry/surveil."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for this action")

    action_name = request.get("action_name")
    count = request.get("count", 1)

    if action_name not in ["scry", "surveil"]:
        raise HTTPException(status_code=400, detail="Invalid action_name for add_to_temporary_zone")

    # This handler transforms the action into a scry or surveil action.
    # The router will use the new action_type to call the game engine.
    return {
        "action_type": action_name,
        "additional_data": {"amount": count},
        "broadcast_data": {"action_type": action_name, "count": count}
    }

@action_registry.register("move_card", required_fields=["card_id", "source_zone", "target_zone"])
async def handle_move_card(game_id: str, request: Optional[Dict], current_state: GameState) -> Dict[str, Any]:
    """Handle moving a card from one zone to another."""
    if not request:
        raise HTTPException(status_code=400, detail="Request body required for move_card")

    card_id = request.get("card_id")
    source_zone = request.get("source_zone")
    target_zone = request.get("target_zone")
    unique_id = request.get("unique_id")

    if not all([card_id, source_zone, target_zone]):
        raise HTTPException(status_code=400, detail="card_id, source_zone, and target_zone are required")

    return {
        "card_id": card_id,
        "additional_data": {
            "source_zone": source_zone,
            "target_zone": target_zone,
            "unique_id": unique_id,
        },
        "broadcast_data": {
            "card": card_id,
            "source_zone": source_zone,
            "target_zone": target_zone,
            "unique_id": unique_id,
        },
    }
