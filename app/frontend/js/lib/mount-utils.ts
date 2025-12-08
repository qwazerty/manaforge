/**
 * ManaForge Component Mount Utilities
 * Centralized utilities for mounting Svelte 5 components
 */
import { mount, type Component } from 'svelte';

export interface MountConfig {
    /** Target element ID */
    targetId: string;
    /** Svelte component to mount */
    component: Component;
    /** Optional: JSON script element ID for props */
    propsScriptId?: string;
    /** Optional: data attribute name on target element for props (e.g., 'room' for data-room) */
    propsDataAttr?: string;
    /** Optional: single data attribute to extract as a named prop */
    propFromDataAttr?: { attrName: string; propName: string };
    /** Optional: create element if not found */
    createIfMissing?: boolean;
    /** Optional: parent for created element */
    createParent?: HTMLElement;
    /** Module name for logging */
    moduleName?: string;
}

/**
 * Parse props from a JSON script element
 */
const parsePropsFromScript = (scriptId: string, moduleName: string): Record<string, unknown> => {
    const dataEl = document.getElementById(scriptId);
    if (!dataEl?.textContent) return {};
    try {
        return JSON.parse(dataEl.textContent);
    } catch (error) {
        console.error(`[${moduleName}] unable to parse props from #${scriptId}`, error);
        return {};
    }
};

/**
 * Parse props from a data attribute (JSON)
 */
const parsePropsFromDataAttr = (
    element: HTMLElement,
    attrName: string,
    moduleName: string
): Record<string, unknown> => {
    const value = element.dataset?.[attrName];
    if (!value) return {};
    try {
        return JSON.parse(value);
    } catch (error) {
        console.error(`[${moduleName}] unable to parse data-${attrName}`, error);
        return {};
    }
};

/**
 * Mount a component with the given configuration
 */
export const mountComponent = (config: MountConfig): boolean => {
    const moduleName = config.moduleName || config.targetId;

    let target = document.getElementById(config.targetId);

    if (!target && config.createIfMissing) {
        target = document.createElement('div');
        target.id = config.targetId;
        const parent = config.createParent || document.body;
        parent.appendChild(target);
    }

    if (!target) return false;

    let props: Record<string, unknown> = {};

    // Parse props from JSON script element
    if (config.propsScriptId) {
        props = { ...props, ...parsePropsFromScript(config.propsScriptId, moduleName) };
    }

    // Parse props from data attribute (full JSON object)
    if (config.propsDataAttr) {
        const parsed = parsePropsFromDataAttr(target, config.propsDataAttr, moduleName);
        props[config.propsDataAttr] = parsed;
    }

    // Extract single prop from data attribute
    if (config.propFromDataAttr) {
        const { attrName, propName } = config.propFromDataAttr;
        const value = target.dataset?.[attrName];
        if (value) {
            // Try to parse as JSON first, fallback to string
            try {
                props[propName] = JSON.parse(value);
            } catch {
                props[propName] = value;
            }
        }
    }

    try {
        mount(config.component, { target, props });
        return true;
    } catch (error) {
        console.error(`[${moduleName}] failed to mount`, error);
        return false;
    }
};

/**
 * Mount multiple components on DOM ready
 */
export const mountOnReady = (configs: MountConfig[]): void => {
    const doMount = () => {
        for (const config of configs) {
            mountComponent(config);
        }
    };

    if (typeof document === 'undefined') return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', doMount);
    } else {
        doMount();
    }
};
