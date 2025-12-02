/**
 * ManaForge Game Cards Store
 * Svelte store for card state management
 */
import { writable, get } from 'svelte/store';

export const CARD_BACK_IMAGE = '/static/images/card-back.jpg';

// ===== STORES =====
export const draggedCardElement = writable(null);
export const lastContextPosition = writable(null);
export const attachmentSelection = writable(null);
export const attachmentTargets = writable([]);

// ===== ACCESSORS =====
export function getDraggedCardElement() {
    return get(draggedCardElement);
}

export function setDraggedCardElement(element) {
    draggedCardElement.set(element);
}

export function getLastContextPosition() {
    return get(lastContextPosition);
}

export function setLastContextPosition(pos) {
    lastContextPosition.set(pos);
}

export function getAttachmentSelection() {
    return get(attachmentSelection);
}

export function setAttachmentSelection(selection) {
    attachmentSelection.set(selection);
}

export function getAttachmentTargets() {
    return get(attachmentTargets);
}

export function setAttachmentTargets(targets) {
    attachmentTargets.set(targets);
}

export function clearAttachmentTargets() {
    attachmentTargets.set([]);
}
