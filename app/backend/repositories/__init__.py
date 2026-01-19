"""
Repositories for persistent data storage.
"""

from app.backend.repositories.game_repository import (
    GameStateRepository,
    GameSetupRepository,
    ReplayRepository,
    ActionHistoryRepository,
    ChatRepository,
    game_state_repo,
    game_setup_repo,
    replay_repo,
    action_history_repo,
    chat_repo,
)

from app.backend.repositories.dict_proxies import (
    GameStatesProxy,
    GameSetupsProxy,
    DraftRoomsProxy,
    ReplaysProxy,
    PendingDecksProxy,
    CubePoolsProxy,
    CubePoolCursorsProxy,
    CubeCardCacheProxy,
)

__all__ = [
    # Repository classes
    "GameStateRepository",
    "GameSetupRepository",
    "ReplayRepository",
    "ActionHistoryRepository",
    "ChatRepository",
    # Repository singletons
    "game_state_repo",
    "game_setup_repo",
    "replay_repo",
    "action_history_repo",
    "chat_repo",
    # Dict-like proxies
    "GameStatesProxy",
    "GameSetupsProxy",
    "DraftRoomsProxy",
    "ReplaysProxy",
    "PendingDecksProxy",
    "CubePoolsProxy",
    "CubePoolCursorsProxy",
    "CubeCardCacheProxy",
]
