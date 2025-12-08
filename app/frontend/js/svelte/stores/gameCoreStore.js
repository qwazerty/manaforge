import { get, writable } from 'svelte/store';

const gameState = writable(null);
const selectedPlayer = writable('player1');
const gameId = writable(null);
const isPageVisible = writable(true);

const getGameStateSnapshot = () => get(gameState);
const getSelectedPlayerSnapshot = () => get(selectedPlayer);
const getGameIdSnapshot = () => get(gameId);
const getPageVisibleSnapshot = () => get(isPageVisible);

const setGameState = (value) => gameState.set(value);
const setSelectedPlayer = (value) => selectedPlayer.set(value);
const setGameId = (value) => gameId.set(value);
const setPageVisible = (value) => isPageVisible.set(Boolean(value));

export {
    gameState,
    selectedPlayer,
    gameId,
    isPageVisible,
    getGameStateSnapshot,
    getSelectedPlayerSnapshot,
    getGameIdSnapshot,
    getPageVisibleSnapshot,
    setGameState,
    setSelectedPlayer,
    setGameId,
    setPageVisible
};
