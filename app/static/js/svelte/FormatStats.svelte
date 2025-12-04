<script>
    import { onMount } from 'svelte';

    const AVAILABILITY_METADATA = {
        missing: {
            title: 'Missing cards',
            subtitle: (total) => `${total} paper card(s) still absent. Use the search box to filter the list.`,
            empty: 'This format is fully available on Arena 🎉',
            emptySearch: 'No missing card matches your query.',
            progressLabel: ({ coverage }) => {
                const available = coverage.paper_available ?? 0;
                const total = coverage.paper_total ?? 0;
                return `Arena-ready ${available} / ${total}`;
            }
        },
        arena: {
            title: 'Arena-ready cards',
            subtitle: (total) => `${total} card(s) already playable on Magic Arena.`,
            empty: 'No card in this format is currently playable on Arena.',
            emptySearch: 'No Arena-ready card matches your query.',
            progressLabel: ({ coverage }) => {
                const available = coverage.paper_available ?? 0;
                const total = coverage.paper_total ?? 0;
                return `Arena-ready ${available} / ${total}`;
            }
        },
        paper: {
            title: 'Paper-legal cards',
            subtitle: (total) => `${total} card(s) have at least one paper printing for this format.`,
            empty: 'No paper printing recorded for this format yet.',
            emptySearch: 'No paper-legal card matches your query.',
            progressLabel: ({ coverage, group }) => {
                const total = coverage.paper_total ?? group.cards.length;
                return `Paper-legal ${total}`;
            }
        }
    };

    const props = $props();

    let stats = $state(props.stats || {});
    let selectedFormat = $state('');
    let selectedFormatLabel = $state('');
    let availability = $state('missing');
    let searchQuery = $state('');
    let page = $state(1);
    let totalPages = $state(0);
    let cardsTotal = $state(0);
    let cards = $state([]);
    let setCoverage = $state([]);
    let isLoading = $state(false);
    let errorMessage = $state('');
    let explorerSection;
    let coverageCanvas;
    let missingCanvas;
    let chartsReady = $state(false);
    let chartCleanup = null;

    const formats = $derived.by(() => (Array.isArray(stats?.all_formats) ? stats.all_formats : []));
    const availabilityMeta = $derived.by(() => AVAILABILITY_METADATA[availability] || AVAILABILITY_METADATA.missing);
    const showPagination = $derived.by(() => !['missing', 'arena', 'paper'].includes(availability));
    const hasSelection = $derived.by(() => Boolean(selectedFormat));
    const pageLabel = $derived.by(() =>
        !showPagination ? 'Page 1 / 1' : `Page ${Math.max(page, 1)} / ${Math.max(totalPages || 1, 1)}`
    );
    const panelTitle = $derived.by(() =>
        selectedFormatLabel ? `${availabilityMeta.title} for ${selectedFormatLabel}` : 'Select a format to explore cards'
    );
    const panelSubtitle = $derived.by(() => {
        if (!selectedFormatLabel) {
            return 'Pick any format to see the cards that match your selected filter.';
        }
        const total = cardsTotal ?? 0;
        try {
            return availabilityMeta.subtitle ? availabilityMeta.subtitle(total) : '';
        } catch (error) {
            console.error('[FormatStats] unable to compute subtitle', error);
            return '';
        }
    });
    const emptyMessage = $derived.by(() =>
        !selectedFormat ? 'No format selected.' : searchQuery ? availabilityMeta.emptySearch || availabilityMeta.empty : availabilityMeta.empty
    );
    const groupedSets = $derived.by(() => {
        if (!cards?.length) return [];
        const coverageMap = buildCoverageMap(setCoverage);
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const groups = new Map();

        for (const card of cards) {
            if (!card) continue;
            const setCode = (card.set_code || 'unknown').toLowerCase();
            const existing = groups.get(setCode) || {
                setCode,
                setName: card.set_name || (card.set_code || 'Unknown set').toUpperCase(),
                cards: []
            };
            existing.cards.push(card);
            groups.set(setCode, existing);
        }

        return Array.from(groups.values())
            .sort((a, b) => b.cards.length - a.cards.length || a.setName.localeCompare(b.setName))
            .map((group) => {
                const coverage = coverageMap.get(group.setCode) || {};
                const total = coverage.paper_total ?? group.cards.length;
                const availableCount = coverage.paper_available ?? 0;
                let completion = coverage.paper_completion_percent;
                if (completion === undefined || completion === null || Number.isNaN(Number(completion))) {
                    completion = total ? Math.round((availableCount / total) * 1000) / 10 : 0;
                }
                completion = Math.min(100, Math.max(0, Number(completion) || 0));
                return {
                    ...group,
                    coverage,
                    completion,
                    progressLabel: getProgressLabel(availabilityMeta, coverage, group)
                };
            });
    });

    $effect(() => {
        if (props.stats) {
            stats = props.stats;
        }
    });

    onMount(() => {
        const timer = setInterval(() => {
            if (!chartsReady) {
                initCharts();
            } else {
                clearInterval(timer);
            }
        }, 120);

        initCharts();

        return () => {
            clearInterval(timer);
            if (typeof chartCleanup === 'function') {
                chartCleanup();
            }
        };
    });

    function formatNumber(value) {
        if (value === null || value === undefined) return '—';
        if (Number.isNaN(Number(value))) return '—';
        try {
            return Number(value).toLocaleString();
        } catch {
            return String(value);
        }
    }

    function formatPercent(value) {
        if (value === null || value === undefined) return '—';
        if (Number.isNaN(Number(value))) return '—';
        return `${value}%`;
    }

    function buildCoverageMap(entries) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const map = new Map();
        (entries || []).forEach((entry) => {
            if (!entry || !entry.set_code) return;
            map.set(String(entry.set_code).toLowerCase(), entry);
        });
        return map;
    }

    function getProgressLabel(meta, coverage, group) {
        const fn = meta?.progressLabel;
        if (typeof fn === 'function') {
            try {
                const label = fn({ coverage, group });
                if (label) return label;
            } catch (error) {
                console.error('[FormatStats] unable to compute progress label', error);
            }
        }
        const availableCount = coverage.paper_available ?? 0;
        const total = coverage.paper_total ?? group.cards.length;
        return `Arena-ready ${availableCount} / ${total}`;
    }

    function selectFormat(code, label) {
        if (!code) return;
        selectedFormat = code;
        selectedFormatLabel = label || code.toUpperCase();
        page = 1;
        totalPages = 0;
        searchQuery = '';
        cards = [];
        setCoverage = [];
        cardsTotal = 0;
        errorMessage = '';
        fetchCards();
        explorerSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function fetchCards() {
        if (!selectedFormat) {
            cards = [];
            setCoverage = [];
            totalPages = 0;
            cardsTotal = 0;
            return;
        }

        isLoading = true;
        errorMessage = '';

        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: '25',
            availability
        });

        if (searchQuery.trim()) {
            params.set('search', searchQuery.trim());
        }

        try {
            const response = await fetch(`/api/v1/formats/${encodeURIComponent(selectedFormat)}/cards?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Unable to load cards (status ${response.status})`);
            }
            const data = await response.json();
            page = data.page ?? 1;
            totalPages = data.total_pages ?? 1;
            selectedFormatLabel = data.format_label || selectedFormatLabel || selectedFormat.toUpperCase();
            cards = Array.isArray(data.results) ? data.results : [];
            setCoverage = Array.isArray(data.set_coverage) ? data.set_coverage : [];
            cardsTotal = Number(data.total) || 0;
        } catch (error) {
            console.error('[FormatStats] failed to fetch cards', error);
            errorMessage = 'Something went wrong while loading the cards.';
            cards = [];
            setCoverage = [];
            totalPages = 0;
            cardsTotal = 0;
        } finally {
            isLoading = false;
        }
    }

    function handleSearch(event) {
        event?.preventDefault();
        if (!selectedFormat) return;
        page = 1;
        fetchCards();
    }

    function handleAvailabilityChange(event) {
        availability = event?.target?.value || 'missing';
        if (selectedFormat) {
            page = 1;
            fetchCards();
        }
    }

    function goPrevious() {
        if (!showPagination || page <= 1) return;
        page -= 1;
        fetchCards();
    }

    function goNext() {
        if (!showPagination || page >= totalPages) return;
        page += 1;
        fetchCards();
    }

    function initCharts() {
        if (chartsReady) return;
        if (typeof Chart === 'undefined') return;
        if (!coverageCanvas || !missingCanvas) return;

        const available = stats?.paper_available_total || 0;
        const missing = stats?.paper_missing_total || 0;

        const coverageChart = new Chart(coverageCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Available cards', 'Missing cards'],
                datasets: [
                    {
                        data: [available, missing],
                        backgroundColor: ['#34d399', '#fbbf24'],
                        borderWidth: 0
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#cbd5f5'
                        }
                    }
                }
            }
        });

        const formats = Array.isArray(stats?.paper_formats) ? [...stats.paper_formats] : [];
        const topFormats = formats.sort((a, b) => (b.paper_missing_on_arena || 0) - (a.paper_missing_on_arena || 0)).slice(0, 8);
        const labels = topFormats.map((fmt) => fmt.label);
        const values = topFormats.map((fmt) => fmt.paper_missing_on_arena);

        const missingChart = new Chart(missingCanvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Missing cards',
                        data: values,
                        backgroundColor: '#fbbf24',
                        borderWidth: 0
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                scales: {
                    x: {
                        ticks: { color: '#cbd5f5' },
                        grid: { color: 'rgba(203,213,245,0.1)' }
                    },
                    y: {
                        ticks: { color: '#cbd5f5' },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5f5' }
                    }
                }
            }
        });

        chartsReady = true;
        chartCleanup = () => {
            coverageChart?.destroy();
            missingChart?.destroy();
        };
    }

    const availabilityOptions = [
        { value: 'missing', label: 'Missing on Arena' },
        { value: 'arena', label: 'Available on Arena' },
        { value: 'paper', label: 'Paper-legal cards' }
    ];
</script>

<div class="py-12 px-4">
    <div class="max-w-6xl mx-auto space-y-10">
        <div class="text-center space-y-4 animate-fade-in">
            <p class="text-sm uppercase tracking-[0.35em] text-arena-muted">ManaForge Insights</p>
            <h1 class="font-magic text-4xl md:text-5xl text-arena-accent">Card counts & Arena coverage</h1>
            <p class="text-lg text-arena-text-dim max-w-2xl mx-auto">
                Data extracted from <span class="font-semibold text-arena-accent">{stats?.dataset_name}</span>,
                updated {stats?.dataset_updated_at_display || '—'}. Compare each format at a glance and spot which paper cards
                are still missing on Magic Arena.
            </p>
        </div>

        <section>
            <div class="grid md:grid-cols-3 gap-6">
                <div class="arena-card rounded-2xl p-6">
                    <p class="text-sm text-arena-text-dim">Paper formats</p>
                    <p class="text-4xl font-bold text-arena-accent mt-2">{formatNumber(stats?.paper_formats_count)}</p>
                    <p class="text-sm text-arena-text-dim mt-3">Formats with at least one legal physical printing.</p>
                </div>
                <div class="arena-card rounded-2xl p-6">
                    <p class="text-sm text-arena-text-dim">Total cards</p>
                    <p class="text-4xl font-bold text-arena-accent mt-2">{formatNumber(stats?.total_cards)}</p>
                    <p class="text-sm text-arena-text-dim mt-3">Total number of cards contained in this Scryfall snapshot.</p>
                </div>
                <div class="arena-card rounded-2xl p-6">
                    <p class="text-sm text-arena-text-dim">Average Arena coverage</p>
                    <p class="text-4xl font-bold text-arena-accent mt-2">{formatPercent(stats?.paper_average_coverage)}</p>
                    <p class="text-sm text-arena-text-dim mt-3">Average share of paper cards already playable on Magic Arena.</p>
                </div>
            </div>
        </section>

        <section class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="font-magic text-2xl text-arena-accent">Format overview</h2>
                <p class="text-sm text-arena-text-dim">Sorted by number of legal cards.</p>
            </div>
            <div class="arena-card rounded-2xl overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-arena-accent/10">
                        <thead class="bg-arena-surface/40 text-xs uppercase tracking-widest text-arena-text-dim">
                            <tr>
                                <th class="px-4 py-3 text-left">Format</th>
                                <th class="px-4 py-3 text-right">Legal cards</th>
                                <th class="px-4 py-3 text-right">Paper cards</th>
                                <th class="px-4 py-3 text-right">Arena cards</th>
                                <th class="px-4 py-3 text-right">Paper coverage</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-arena-accent/10 text-sm">
                            {#if !formats.length}
                                <tr>
                                    <td class="px-4 py-3 text-arena-text-dim" colspan="5">
                                        No format data available.
                                    </td>
                                </tr>
                            {:else}
                                {#each formats as fmt (fmt.code)}
                                    <tr
                                        class={`hover:bg-arena-surface/30 transition cursor-pointer ${selectedFormat === fmt.code ? 'bg-arena-surface/40' : ''}`}
                                        onclick={() => selectFormat(fmt.code, fmt.label)}
                                        data-format-code={fmt.code}
                                    >
                                        <td class="px-4 py-3">
                                            <div class="font-semibold text-arena-text">{fmt.label}</div>
                                            {#if fmt.is_paper_format}
                                                <p class="text-xs text-emerald-300/80 mt-0.5">Paper format</p>
                                            {:else}
                                                <p class="text-xs text-sky-300/80 mt-0.5">Digital format</p>
                                            {/if}
                                        </td>
                                        <td class="px-4 py-3 text-right font-mono">{formatNumber(fmt.total_cards)}</td>
                                        <td class="px-4 py-3 text-right font-mono">{formatNumber(fmt.paper_cards)}</td>
                                        <td class="px-4 py-3 text-right font-mono">{formatNumber(fmt.arena_cards)}</td>
                                        <td class="px-4 py-3 text-right font-mono">
                                            {#if fmt.paper_coverage_percent !== null && fmt.paper_coverage_percent !== undefined}
                                                {fmt.paper_coverage_percent}%
                                            {:else}
                                                —
                                            {/if}
                                        </td>
                                    </tr>
                                {/each}
                            {/if}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <section class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="font-magic text-2xl text-arena-accent">Visualizations</h2>
                <p class="text-sm text-arena-text-dim">
                    {formatNumber(stats?.paper_missing_total)} paper cards are still missing from Magic Arena.
                </p>
            </div>
            <div class="grid gap-6 md:grid-cols-2">
                <div class="arena-card rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <p class="text-sm uppercase tracking-widest text-arena-text-dim">Global coverage</p>
                            <h3 class="font-magic text-xl text-arena-accent">Paper cards on Arena</h3>
                        </div>
                        <p class="text-sm text-arena-text-dim">
                            {formatNumber(stats?.paper_available_total)} of {formatNumber(stats?.paper_cards_total)}
                        </p>
                    </div>
                    <canvas bind:this={coverageCanvas} height="220"></canvas>
                </div>
                <div class="arena-card rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <p class="text-sm uppercase tracking-widest text-arena-text-dim">Behind schedule</p>
                            <h3 class="font-magic text-xl text-arena-accent">Top missing cards by format</h3>
                        </div>
                        <p class="text-sm text-arena-text-dim">Top 8 paper formats</p>
                    </div>
                    <canvas bind:this={missingCanvas} height="220"></canvas>
                </div>
            </div>
        </section>

        <section class="space-y-4" bind:this={explorerSection}>
            <div class="arena-card rounded-2xl p-6 space-y-4">
                <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p class="text-sm uppercase tracking-widest text-arena-text-dim">Card explorer</p>
                        <h2 class="font-magic text-2xl text-arena-accent mt-2">{panelTitle}</h2>
                        <p class="text-sm text-arena-text-dim mt-1">{panelSubtitle}</p>
                    </div>
                    <form class="flex gap-3 w-full md:w-auto" onsubmit={handleSearch}>
                        <select
                            class="rounded-lg bg-arena-surface border border-arena-accent/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-arena-accent/40"
                            value={availability}
                            onchange={handleAvailabilityChange}
                            disabled={!hasSelection || isLoading}
                        >
                            {#each availabilityOptions as option (option.value)}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                        <input
                            class="flex-1 md:w-64 rounded-lg bg-arena-surface border border-arena-accent/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-arena-accent/40"
                            placeholder="Search a card..."
                            value={searchQuery}
                            oninput={(event) => (searchQuery = event.target.value)}
                            disabled={!hasSelection || isLoading}
                        />
                        <button
                            type="submit"
                            class="arena-button px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                            disabled={!hasSelection || isLoading}
                        >
                            🔍 Search
                        </button>
                    </form>
                </div>

                {#if !hasSelection}
                    <p class="text-sm text-arena-text-dim">{emptyMessage}</p>
                {:else if errorMessage}
                    <p class="text-sm text-rose-300">{errorMessage}</p>
                {:else if isLoading}
                    <p class="text-sm text-arena-text-dim">Loading cards...</p>
                {:else if !cards.length}
                    <p class="text-sm text-arena-text-dim">{emptyMessage}</p>
                {:else}
                    <div class="space-y-4">
                        {#each groupedSets as group (group.setCode)}
                            <details class="arena-surface border border-arena-accent/10 rounded-2xl overflow-hidden">
                                <summary class="px-4 py-3 cursor-pointer space-y-2">
                                    <div class="flex items-center justify-between gap-4">
                                        <div>
                                            <p class="text-base font-semibold text-arena-text">{group.coverage?.set_name || group.setName}</p>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-sm font-mono text-arena-accent">{group.completion}%</p>
                                            <p class="text-2xs text-arena-text-dim">Arena Completion</p>
                                        </div>
                                    </div>
                                    <div class="w-full h-2 bg-arena-surface/60 rounded-full overflow-hidden">
                                        <div class="h-full bg-emerald-400 transition-all duration-300" style={`width: ${group.completion}%`}></div>
                                    </div>
                                    <p class="text-xs text-arena-text-dim">{group.progressLabel}</p>
                                </summary>

                                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4 pb-4">
                                    {#each group.cards.sort((a, b) => (a?.name || '').localeCompare(b?.name || '')) as card (card.id || card.scryfall_id || `${card.name}-${card.set_code}`)}
                                        <a
                                            class="group relative block rounded-2xl overflow-hidden ring-1 ring-arena-accent/20 bg-black/60 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arena-accent hover:-translate-y-1"
                                            href={card.scryfall_uri || '#'}
                                            target={card.scryfall_uri ? '_blank' : undefined}
                                            rel={card.scryfall_uri ? 'noopener noreferrer' : undefined}
                                            aria-label={card.name ? `Voir ${card.name} sur Scryfall` : 'Voir la carte sur Scryfall'}
                                        >
                                            <div class="relative w-full bg-arena-surface/40" style="aspect-ratio: 2 / 3">
                                                {#if card.image_uri}
                                                    <img
                                                        src={card.image_uri}
                                                        alt={card.name ? `${card.name} card art` : 'Card art'}
                                                        loading="lazy"
                                                        class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                                    />
                                                {:else}
                                                    <div class="w-full h-full flex items-center justify-center text-center px-3 text-xs text-arena-text-dim bg-arena-surface/70">
                                                        {card.name || 'Image unavailable'}
                                                    </div>
                                                {/if}

                                                <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>

                                                <span class="absolute bottom-2 left-2 text-[0.65rem] font-semibold uppercase tracking-wide px-2 py-1 rounded-full text-white bg-black/70">
                                                    {#if card.missing_on_arena}
                                                        Missing
                                                    {:else if card.is_arena}
                                                        Arena
                                                    {:else if card.is_paper}
                                                        Paper
                                                    {:else}
                                                        Digital
                                                    {/if}
                                                </span>
                                            </div>
                                        </a>
                                    {/each}
                                </div>
                            </details>
                        {/each}
                    </div>
                {/if}

                {#if showPagination}
                    <div class="mt-4 flex items-center justify-between">
                        <button class="arena-button px-4 py-2 rounded-lg text-sm disabled:opacity-50" onclick={goPrevious} disabled={page <= 1}>
                            ← Previous
                        </button>
                        <p class="text-sm text-arena-text-dim">{pageLabel}</p>
                        <button class="arena-button px-4 py-2 rounded-lg text-sm disabled:opacity-50" onclick={goNext} disabled={page >= totalPages}>
                            Next →
                        </button>
                    </div>
                {:else}
                    <div class="mt-4 flex items-center justify-between text-sm text-arena-text-dim">
                        <span></span>
                        <p>{pageLabel}</p>
                        <span></span>
                    </div>
                {/if}

                <p class="text-xs text-arena-text-dim mt-2">
                    Use the filter to switch between missing, Arena-ready, or paper-legal cards for the selected format.
                </p>
            </div>
        </section>
    </div>
</div>
