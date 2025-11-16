/**
 * Zone Data Helper
 * Provides normalized data for UI zone renderers to consume.
 */
class ZoneData {
    static getSelectedPlayer() {
        return typeof GameCore !== 'undefined' && typeof GameCore.getSelectedPlayer === 'function'
            ? GameCore.getSelectedPlayer()
            : null;
    }

    static isSpectatorView() {
        return this.getSelectedPlayer() === 'spectator';
    }

    static getDeckZoneConfig(deck = [], isOpponent = false) {
        const deckArray = Array.isArray(deck) ? deck : [];
        const cardsRemaining = deckArray.length;
        const isSpectator = this.isSpectatorView();
        let onClick = null;
        let overlayText = '';

        if (isSpectator) {
            onClick = isOpponent
                ? () => UIZonesManager.showOpponentZoneModal('deck')
                : () => UIZonesManager.showZoneModal('deck');
            overlayText = 'View';
        } else if (!isOpponent) {
            onClick = () => GameActions.drawCard();
            overlayText = 'Draw';
        }

        const deckClass = isOpponent ? 'deck-cards-stack opponent-deck' : 'deck-cards-stack';
        const zoneIdentifier = isOpponent ? 'opponent_deck' : 'deck';

        return {
            cardsRemaining,
            overlayText,
            onClick,
            deckClass,
            zoneIdentifier
        };
    }

    static getGraveyardZoneConfig(graveyard = [], isOpponent = false) {
        const graveyardArray = Array.isArray(graveyard) ? graveyard : [];
        const cardsRemaining = graveyardArray.length;
        const zoneIdentifier = isOpponent ? 'opponent_graveyard' : 'graveyard';
        const clickHandler = isOpponent
            ? () => UIZonesManager.showOpponentZoneModal('graveyard')
            : () => UIZonesManager.showZoneModal('graveyard');

        return {
            cardsRemaining,
            graveyardArray,
            zoneIdentifier,
            clickHandler,
            overlayHtml: 'View<br>All'
        };
    }

    static getExileZoneConfig(exile = [], isOpponent = false) {
        const exileArray = Array.isArray(exile) ? exile : [];
        const cardsRemaining = exileArray.length;
        const zoneIdentifier = isOpponent ? 'opponent_exile' : 'exile';
        const clickHandler = isOpponent
            ? () => UIZonesManager.showOpponentZoneModal('exile')
            : () => UIZonesManager.showZoneModal('exile');
        const topCard = cardsRemaining > 0 ? exileArray[cardsRemaining - 1] : null;

        return {
            cardsRemaining,
            exileArray,
            zoneIdentifier,
            clickHandler,
            overlayHtml: 'View<br>All',
            topCard
        };
    }
}
