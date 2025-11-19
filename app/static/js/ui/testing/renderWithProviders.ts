import { render } from '@testing-library/svelte';
import type { ComponentProps, ComponentType } from 'svelte';
import type { RenderOptions, RenderResult } from '@testing-library/svelte';

export type ProviderRenderOptions<T extends ComponentType> = RenderOptions<ComponentProps<T>> & {
    withProviders?: (() => void)[];
};

export function renderWithProviders<T extends ComponentType>(
    Component: T,
    options?: ProviderRenderOptions<T>
): RenderResult<ComponentProps<T>> {
    options?.withProviders?.forEach((provider) => {
        provider();
    });

    return render(Component, options);
}
