<script>
    import {
        actionHistoryEntries,
        buildActionHistoryTurnKey,
        formatActionHistoryTime,
        formatActionHistoryTurnLabel,
        getActionHistoryPreviewHandlers
    } from './stores/actionHistoryStore.js';

    let {
        panelIcon = '📜',
        panelTitle = 'Action History'
    } = $props();

    let entries = $state([]);
    const previewHandlers = getActionHistoryPreviewHandlers();

    $effect(() => {
        const unsubscribe = actionHistoryEntries.subscribe((value) => {
            entries = Array.isArray(value) ? value : [];
        });
        return () => unsubscribe();
    });

    const formatTime = (timestamp) => formatActionHistoryTime(timestamp);
    const buildTurnKey = (entry) => buildActionHistoryTurnKey(entry);
    const formatTurnLabel = (entry) => formatActionHistoryTurnLabel(entry);

    const getSegments = (list) => {
        if (!Array.isArray(list) || list.length === 0) {
            return [];
        }

        // Entries are stored chronologically, reverse to show newest at bottom
        const normalized = [...list].reverse();

        const result = [];
        let lastTurnKey = null;
        let turnSeparatorIndex = 0;

        for (let i = 0; i < normalized.length; i++) {
            const entry = normalized[i];
            if (!entry) continue;

            const turnKey = buildTurnKey(entry);
            if (turnKey && turnKey !== lastTurnKey) {
                result.push({
                    type: 'turn',
                    id: `turn-${turnSeparatorIndex++}`,
                    label: formatTurnLabel(entry)
                });
                lastTurnKey = turnKey;
            }

            result.push({
                type: 'entry',
                id: entry._signature || `entry-${i}`,
                entry
            });
        }

        return result;
    };

    const triggerPreviewShow = (event, cardItem, fallback) => {
        previewHandlers?.show?.(
            event,
            cardItem?.cardInfo || null,
            fallback || cardItem?.displayName || '',
            event?.currentTarget || null
        );
    };

    const triggerPreviewMove = (event) => {
        previewHandlers?.move?.(event);
    };

    const triggerPreviewHide = () => {
        previewHandlers?.hide?.();
    };

    const shouldShowDetailLabel = (detail) => {
        if (!detail || !detail.label || detail.hideLabel === true) {
            return false;
        }
        const hasAssignments =
            Array.isArray(detail.assignmentList) &&
            detail.assignmentList.length > 0;
        const hasCardList =
            Array.isArray(detail.cardList) &&
            detail.cardList.length > 0;
        const hasSingleCard = detail.cardInfo && !hasAssignments && !hasCardList;
        if (hasAssignments || hasCardList) {
            return false;
        }
        if (hasSingleCard && detail.label.toLowerCase() === 'card') {
            return false;
        }
        return true;
    };

    const hasAssignmentTargets = (assignment) => {
        const hasTargets =
            Array.isArray(assignment?.targets) && assignment.targets.length > 0;
        const hasFallbacks =
            Array.isArray(assignment?.targetFallbacks) &&
            assignment.targetFallbacks.length > 0;
        return hasTargets || hasFallbacks;
    };

    const normalizedEntries = () => (Array.isArray(entries) ? entries : []);
    const segments = () => getSegments(normalizedEntries());
    const hasEntries = () => segments().some((segment) => segment.type === 'entry');
</script>

<div class="arena-card rounded-lg p-4 flex flex-col h-[34rem]">
    <div class="flex items-center gap-2 pb-3 border-b border-arena-accent/30">
        <span class="text-lg">{panelIcon}</span>
        <h3 class="font-magic font-semibold text-arena-accent">{panelTitle}</h3>
    </div>
    <div id="action-history" class="action-history-list mt-3">
        {#if hasEntries()}
            {#each segments() as segment (segment.id)}
                {#if segment.type === 'turn'}
                    <div class="action-history-turn-separator">
                        <span class="action-history-turn-text">{segment.label}</span>
                    </div>
                {:else}
                    <div class="action-history-entry">
                        <div class="action-history-header">
                            <span class="action-history-player">{segment.entry.player}</span>
                            <span class="action-history-time">
                                {formatTime(segment.entry.timestamp)}
                            </span>
                            <span class={`action-history-status ${segment.entry.success ? 'success' : 'failure'}`}>
                                {segment.entry.success ? 'Success' : 'Failed'}
                            </span>
                        </div>
                        <div class="action-history-action">
                            {segment.entry.displayAction || segment.entry.action}
                        </div>

                        {#if Array.isArray(segment.entry.details) && segment.entry.details.length > 0}
                            {#each segment.entry.details as detail, detailIndex (detailIndex)}
                                {#if detail}
                                    <div class="action-history-detail">
                                        {#if shouldShowDetailLabel(detail)}
                                            <span style="font-weight: 600;">
                                                {detail.label}:&nbsp;
                                            </span>
                                        {/if}

                                        {#if Array.isArray(detail.assignmentList) && detail.assignmentList.length > 0}
                                            <div class="action-history-card-assignments">
                                                {#each detail.assignmentList as assignment, assignmentIndex (assignmentIndex)}
                                                    {#if assignmentIndex > 0}
                                                        <span class="action-history-card-separator"> | </span>
                                                    {/if}
                                                    <span class="action-history-card-assignment">
                                                        <span class="action-history-card-assignment-source">
                                                            {#if assignment.source}
                                                                <button
                                                                    type="button"
                                                                    class="action-history-card-link"
                                                                    onmouseenter={(event) => triggerPreviewShow(event, assignment.source)}
                                                                    onfocus={(event) => triggerPreviewShow(event, assignment.source)}
                                                                    onmousemove={triggerPreviewMove}
                                                                    onmouseleave={triggerPreviewHide}
                                                                    onblur={triggerPreviewHide}>
                                                                    {assignment.source.displayName}
                                                                </button>
                                                            {:else if assignment.sourceFallback}
                                                                <span class="action-history-card-assignment-source-text">
                                                                    {assignment.sourceFallback}
                                                                </span>
                                                            {/if}
                                                        </span>
                                                        {#if hasAssignmentTargets(assignment)}
                                                            <span class="action-history-card-assignment-arrow">→</span>
                                                            <span class="action-history-card-assignment-targets">
                                                                {#if Array.isArray(assignment.targets)}
                                                                    {#each assignment.targets as target, targetIndex (targetIndex)}
                                                                        {#if target}
                                                                            {#if targetIndex > 0}
                                                                                <span class="action-history-card-separator"> / </span>
                                                                            {/if}
                                                                            <button
                                                                                type="button"
                                                                                class="action-history-card-link"
                                                                                onmouseenter={(event) => triggerPreviewShow(event, target)}
                                                                                onfocus={(event) => triggerPreviewShow(event, target)}
                                                                                onmousemove={triggerPreviewMove}
                                                                                onmouseleave={triggerPreviewHide}
                                                                                onblur={triggerPreviewHide}>
                                                                                {target.displayName}
                                                                            </button>
                                                                        {/if}
                                                                    {/each}
                                                                {/if}
                                                                {#if Array.isArray(assignment.targetFallbacks) && assignment.targetFallbacks.length > 0}
                                                                    <span class="action-history-card-assignment-targets-text">
                                                                        {assignment.targetFallbacks.join(', ')}
                                                                    </span>
                                                                {/if}
                                                            </span>
                                                        {/if}
                                                    </span>
                                                {/each}
                                            </div>
                                        {:else if Array.isArray(detail.cardList) && detail.cardList.length > 0}
                                            <div class="action-history-card-list">
                                                {#each detail.cardList as cardItem, cardIndex (cardIndex)}
                                                    {#if cardIndex > 0}
                                                        <span class="action-history-card-separator"> | </span>
                                                    {/if}
                                                    {#if cardItem}
                                                        <button
                                                            type="button"
                                                            class="action-history-card-link"
                                                            onmouseenter={(event) => triggerPreviewShow(event, cardItem)}
                                                            onfocus={(event) => triggerPreviewShow(event, cardItem)}
                                                            onmousemove={triggerPreviewMove}
                                                            onmouseleave={triggerPreviewHide}
                                                            onblur={triggerPreviewHide}>
                                                            {cardItem.displayName || `Card ${cardIndex + 1}`}
                                                        </button>
                                                    {/if}
                                                {/each}
                                            </div>
                                            {#if Array.isArray(detail.extraValues) && detail.extraValues.length > 0}
                                                <span class="action-history-detail-extra">
                                                    {detail.extraValues.join(', ')}
                                                </span>
                                            {/if}
                                        {:else if detail.cardInfo}
                                            <button
                                                type="button"
                                                class="action-history-card-link"
                                                onmouseenter={(event) => triggerPreviewShow(event, { cardInfo: detail.cardInfo, displayName: detail.cardInfo.name || detail.value })}
                                                onfocus={(event) => triggerPreviewShow(event, { cardInfo: detail.cardInfo, displayName: detail.cardInfo.name || detail.value })}
                                                onmousemove={triggerPreviewMove}
                                                onmouseleave={triggerPreviewHide}
                                                onblur={triggerPreviewHide}>
                                                {detail.cardInfo.name || detail.value || 'Card'}
                                            </button>
                                        {:else}
                                            <span>{detail.value}</span>
                                        {/if}
                                    </div>
                                {/if}
                            {/each}
                        {/if}
                    </div>
                {/if}
            {/each}
        {:else}
            <div data-placeholder="true" class="action-history-empty text-center">
                <span class="block text-sm text-arena-text-dim">No actions yet</span>
            </div>
        {/if}
    </div>
</div>
