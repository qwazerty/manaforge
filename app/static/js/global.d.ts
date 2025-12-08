/**
 * Global type declarations for legacy game interface
 * These globals are injected by the server and used by legacy scripts
 */

declare global {
    interface Window {
        GameCards?: {
            isFaceDownCard?(card: any): boolean;
            getCounterIcon?(counterType: string): string | null;
        };
        GameCore?: {
            getSelectedPlayer?(): string | null;
            getPlayerDisplayName?(playerId: string): string | null;
        };
        GameActions?: {
            drawCard?(): void;
            modifyLife?(playerId: string, value: number): void;
        };
        UIZonesManager?: {
            showZoneModal?(zone: string): void;
            showOpponentZoneModal?(zone: string): void;
            openCustomLifeInput?(playerId: string, callback: (value: number) => void): void;
        };
        UIUtils?: {
            generateEmptyZoneContent?(icon: string, label: string): string;
        };
        UIRenderersTemplates?: {
            _makePopupDraggable?(): void;
            _applyPopupSearch?(): void;
            _positionRevealPopup?(): void;
        };
        UIHorizontalScroll?: {
            attachWheelListener?(): void;
        };
    }
}

export {};
