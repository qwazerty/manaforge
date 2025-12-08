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

// Arrow targeting stores
export const arrowSelection = writable(null);  // { uniqueId, cardId } - source card for arrow
export const arrowTargets = writable([]);  // List of targetable card elements
export const targetingArrows = writable([]);  // Array of { sourceId, targetId } pairs

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

// ===== ARROW TARGETING ACCESSORS =====
export function getArrowSelection() {
    return get(arrowSelection);
}

export function setArrowSelection(selection) {
    arrowSelection.set(selection);
}

export function getArrowTargets() {
    return get(arrowTargets);
}

export function setArrowTargets(targets) {
    arrowTargets.set(targets);
}

export function clearArrowTargets() {
    arrowTargets.set([]);
}

export function getTargetingArrows() {
    return get(targetingArrows);
}

export function setTargetingArrows(arrows) {
    targetingArrows.set(arrows);
}

export function addTargetingArrow(sourceId, targetId) {
    targetingArrows.update(arrows => [...arrows, { sourceId, targetId }]);
}

export function removeTargetingArrow(sourceId, targetId = null) {
    targetingArrows.update(arrows => {
        if (targetId) {
            return arrows.filter(a => !(a.sourceId === sourceId && a.targetId === targetId));
        }
        // Remove all arrows from this source
        return arrows.filter(a => a.sourceId !== sourceId);
    });
}

export function removeAllArrowsFromCard(uniqueId) {
    targetingArrows.update(arrows => 
        arrows.filter(a => a.sourceId !== uniqueId && a.targetId !== uniqueId)
    );
}

export function clearAllTargetingArrows() {
    targetingArrows.set([]);
}
