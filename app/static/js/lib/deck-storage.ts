
const STORAGE_KEY = 'manaforge:deck-manager:saves';

export interface Deck {
    id: string;
    name: string;
    format?: string;
    updatedAt: string;
    state: any; // You might want to define a more specific type for the deck state
}

function readAll(): Deck[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return [];
    } catch (error) {
        console.warn('Unable to read deck library', error);
        return [];
    }
}

function writeAll(decks: Deck[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
    } catch (error) {
        console.warn('Unable to persist deck library', error);
    }
}

export function deepClone<T>(value: T): T {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        console.warn('Unable to clone deck library data', error);
        return value;
    }
}

export const DeckStorage = {
    list(): Deck[] {
        return readAll()
            .map((deck) => ({
                ...deck,
                state: deck.state ? deepClone(deck.state) : {}
            }));
    },

    get(id: string): Deck | null {
        if (!id) return null;
        const decks = readAll();
        const found = decks.find((deck) => deck.id === id);
        return found
            ? {
                ...found,
                state: found.state ? deepClone(found.state) : {}
            }
            : null;
    },

    save(deck: Deck): Deck {
        if (!deck || !deck.id) {
            throw new Error('Deck must have an id to be saved');
        }
        const decks = readAll();
        const payload = {
            ...deck,
            updatedAt: deck.updatedAt || new Date().toISOString(),
            state: deck.state ? deepClone(deck.state) : {}
        };
        const existingIndex = decks.findIndex((item) => item.id === deck.id);
        if (existingIndex >= 0) {
            decks[existingIndex] = payload;
        } else {
            decks.push(payload);
        }
        writeAll(decks);
        return payload;
    },

    remove(id: string) {
        if (!id) return;
        const decks = readAll();
        const next = decks.filter((deck) => deck.id !== id);
        if (next.length !== decks.length) {
            writeAll(next);
        }
    },

    duplicate(id: string, overrides: Partial<Deck> = {}): Deck | null {
        const source = this.get(id);
        if (!source) return null;
        const clone: Deck = {
            ...source,
            id: this.generateId(),
            name: overrides.name || `${source.name} Copy`,
            updatedAt: new Date().toISOString(),
            state: source.state ? deepClone(source.state) : {}
        };
        return this.save(clone);
    },

    generateId(): string {
        return `deck_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }
};
