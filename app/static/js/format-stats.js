document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.querySelector("#formats-table-body");
    const panelTitle = document.querySelector("#cards-panel-title");
    const panelSubtitle = document.querySelector("#cards-panel-subtitle");
    const searchForm = document.querySelector("#cards-search-form");
    const searchInput = document.querySelector("#cards-search");
    const searchButton = searchForm?.querySelector("button[type='submit']");
    const filterSelect = document.querySelector("#cards-filter");
    const listContainer = document.querySelector("#cards-list");
    const explorerSection = document.querySelector("#card-explorer");
    const paginationBar = document.querySelector("#cards-pagination");
    const prevButton = document.querySelector("#cards-prev");
    const nextButton = document.querySelector("#cards-next");
    const pageIndicator = document.querySelector("#cards-page-indicator");

    const statsDataEl = document.querySelector("#format-stats-data");
    let statsData = null;
    if (statsDataEl) {
        try {
            statsData = JSON.parse(statsDataEl.textContent);
        } catch (error) {
            console.error("Unable to parse stats data", error);
        }
    }

    const AVAILABILITY_METADATA = {
        missing: {
            title: "Missing cards",
            subtitle: (total) => `${total} paper card(s) still absent. Use the search box to filter the list.`,
            empty: "This format is fully available on Arena 🎉",
            emptySearch: "No missing card matches your query.",
        },
        arena: {
            title: "Arena-ready cards",
            subtitle: (total) => `${total} card(s) already playable on Magic Arena.`,
            empty: "No card in this format is currently playable on Arena.",
            emptySearch: "No Arena-ready card matches your query.",
        },
        paper: {
            title: "Paper-legal cards",
            subtitle: (total) => `${total} card(s) have at least one paper printing for this format.`,
            empty: "No paper printing recorded for this format yet.",
            emptySearch: "No paper-legal card matches your query.",
        },
        all: {
            title: "All legal cards",
            subtitle: (total) => `${total} legal card(s) in this format.`,
            empty: "No card matches this format just yet.",
            emptySearch: "No card matches your query.",
        },
    };

    const state = {
        format: null,
        formatLabel: null,
        page: 1,
        pageSize: 25,
        search: "",
        totalPages: 0,
        availability: "missing",
    };

    let activeRow = null;

    function setLoading(message = "Loading cards...") {
        listContainer.innerHTML = `<p class="text-sm text-arena-text-dim">${message}</p>`;
    }

    function setError(message) {
        listContainer.innerHTML = `<p class="text-sm text-rose-300">${message}</p>`;
    }

    function resetPanel() {
        panelTitle.textContent = "Select a format to explore cards";
        panelSubtitle.textContent = "Pick any format to see the cards that match your selected filter.";
        searchInput.value = "";
        searchInput.disabled = true;
        if (searchButton) {
            searchButton.disabled = true;
        }
        if (filterSelect) {
            filterSelect.disabled = true;
            filterSelect.value = state.availability;
        }
        if (paginationBar) {
            paginationBar.style.display = state.availability === "missing" ? "none" : "flex";
        }
        prevButton.disabled = true;
        nextButton.disabled = true;
        pageIndicator.textContent = "Page 0 / 0";
        listContainer.innerHTML = `<p class="text-sm text-arena-text-dim">No format selected.</p>`;
    }

    async function fetchCards() {
        if (!state.format) {
            resetPanel();
            return;
        }

        const params = new URLSearchParams({
            page: state.page.toString(),
            page_size: state.pageSize.toString(),
        });

        if (state.search) {
            params.append("search", state.search);
        }
        params.append("availability", state.availability);

        setLoading();

        try {
            const response = await fetch(`/api/v1/formats/${state.format}/cards?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Unable to load cards (status ${response.status})`);
            }
            const data = await response.json();
            state.page = data.page;
            state.totalPages = data.total_pages || 1;
            state.formatLabel = data.format_label;
            renderCards(data);
        } catch (error) {
            console.error(error);
            setError("Something went wrong while loading the cards.");
        }
    }

    function getAvailabilityMeta(key) {
        return AVAILABILITY_METADATA[key] || AVAILABILITY_METADATA.all;
    }

    function renderCards(payload) {
        const { results, total, page, total_pages } = payload;
        state.totalPages = total_pages || 1;
        const meta = getAvailabilityMeta(state.availability);
        panelTitle.textContent = `${meta.title} for ${state.formatLabel}`;
        panelSubtitle.textContent = meta.subtitle(total);
        searchInput.disabled = false;
        if (searchButton) {
            searchButton.disabled = false;
        }
        if (filterSelect) {
            filterSelect.disabled = false;
        }

        const showPagination = state.availability !== "missing";
        if (paginationBar) {
            paginationBar.style.display = showPagination ? "flex" : "none";
        }

        if (!results.length) {
            const emptyMessage = state.search ? (meta.emptySearch || meta.empty) : meta.empty;
            setError(emptyMessage);
            if (showPagination) {
                prevButton.disabled = page <= 1;
                nextButton.disabled = page >= total_pages;
                pageIndicator.textContent = `Page ${page} / ${total_pages}`;
            } else {
                prevButton.disabled = true;
                nextButton.disabled = true;
                pageIndicator.textContent = "Page 1 / 1";
            }
            return;
        }

        listContainer.innerHTML = "";
        if (state.availability === "missing") {
            renderGroupedMissingCards(results, payload.set_coverage);
        } else {
            results.forEach((card) => {
                listContainer.appendChild(createCardElement(card));
            });
            if (showPagination) {
                prevButton.disabled = page <= 1;
                nextButton.disabled = page >= total_pages;
                pageIndicator.textContent = `Page ${page} / ${total_pages}`;
            }
        }

        if (!showPagination) {
            prevButton.disabled = true;
            nextButton.disabled = true;
            pageIndicator.textContent = "Page 1 / 1";
        }
    }

    function createCardElement(card) {
        const wrapper = document.createElement("div");
        wrapper.className = "arena-surface border border-arena-accent/10 rounded-xl p-4";

        const header = document.createElement("div");
        header.className = "flex flex-col gap-2 md:flex-row md:items-start md:justify-between";

        const info = document.createElement("div");
        const nameEl = document.createElement("p");
        nameEl.className = "text-base font-semibold text-arena-text";
        nameEl.textContent = card.name;

        const typeEl = document.createElement("p");
        typeEl.className = "text-sm text-arena-text-dim";
        typeEl.textContent = card.type_line || "Unknown type";

        const metaEl = document.createElement("p");
        metaEl.className = "text-xs text-arena-text-dim";
        const setLabel = card.set_name || (card.set_code || "").toUpperCase();
        const releaseLabel = card.released_at || "Unknown date";
        metaEl.textContent = `${setLabel || "Unknown set"} • #${card.collector_number || "?"} • ${releaseLabel}`;

        info.appendChild(nameEl);
        info.appendChild(typeEl);
        info.appendChild(metaEl);

        const status = document.createElement("div");
        status.className = "text-right space-y-2";

        const badge = document.createElement("span");
        badge.className = "inline-block px-3 py-1 rounded-full text-xs font-semibold";
        if (card.missing_on_arena) {
            badge.classList.add("bg-amber-500/20", "text-amber-200");
            badge.textContent = "Missing on Arena";
        } else if (card.is_arena) {
            badge.classList.add("bg-emerald-500/20", "text-emerald-200");
            badge.textContent = "Available on Arena";
        } else {
            badge.classList.add("bg-slate-500/30", "text-slate-200");
            badge.textContent = "Paper only";
        }

        if (card.scryfall_uri) {
            const link = document.createElement("a");
            link.href = card.scryfall_uri;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "text-xs text-arena-accent underline block";
            link.textContent = "View on Scryfall";
            status.appendChild(link);
        }

        status.appendChild(badge);

        header.appendChild(info);
        header.appendChild(status);

        wrapper.appendChild(header);

        if (card.oracle_text) {
            const text = document.createElement("p");
            text.className = "text-sm text-arena-text mt-3 whitespace-pre-line";
            text.textContent = card.oracle_text;
            wrapper.appendChild(text);
        }

        return wrapper;
    }

    function renderGroupedMissingCards(cards, coverageData) {
        if (!cards.length) {
            return;
        }

        const coverageMap = {};
        (coverageData || []).forEach((entry) => {
            if (!entry || !entry.set_code) {
                return;
            }
            const key = (entry.set_code || "unknown").toLowerCase();
            coverageMap[key] = entry;
        });

        const groups = new Map();
        cards.forEach((card) => {
            const code = (card.set_code || "unknown").toLowerCase();
            const existing = groups.get(code) || {
                setCode: code,
                setName: card.set_name || (card.set_code || "Unknown set").toUpperCase() || "Unknown set",
                cards: [],
            };
            existing.cards.push(card);
            groups.set(code, existing);
        });

        const sortedGroups = Array.from(groups.values()).sort(
            (a, b) => b.cards.length - a.cards.length || a.setName.localeCompare(b.setName)
        );
        sortedGroups.forEach((group) => {
            const coverage = coverageMap[group.setCode] || {};
            const displayName = coverage.set_name || group.setName;
            const paperTotal = coverage.paper_total ?? group.cards.length;
            const paperAvailable = coverage.paper_available ?? 0;
            const missingCount = coverage.paper_missing ?? group.cards.length;
            let completion = coverage.paper_completion_percent;
            if (completion === undefined || completion === null || Number.isNaN(completion)) {
                completion = paperTotal ? Math.round((paperAvailable / paperTotal) * 1000) / 10 : 0;
            }
            completion = Math.min(100, Math.max(0, Number(completion) || 0));

            const details = document.createElement("details");
            details.className = "arena-surface border border-arena-accent/10 rounded-2xl overflow-hidden";

            const summary = document.createElement("summary");
            summary.className = "px-4 py-3 cursor-pointer space-y-2";
            summary.innerHTML = `
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <p class="text-base font-semibold text-arena-text">${displayName}</p>
                        <p class="text-xs text-arena-text-dim">${missingCount} missing card(s)</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-mono text-arena-accent">${completion}%</p>
                        <p class="text-2xs text-arena-text-dim">Completion</p>
                    </div>
                </div>
                <div class="w-full h-2 bg-arena-surface/60 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-400 transition-all duration-300" style="width: ${completion}%;"></div>
                </div>
                <p class="text-xs text-arena-text-dim">Arena-ready ${paperAvailable} / ${paperTotal}</p>
            `;
            details.appendChild(summary);

            const cardsContainer = document.createElement("div");
            cardsContainer.className = "space-y-3 px-4 pb-4";
            group.cards
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach((card) => {
                    cardsContainer.appendChild(createCardElement(card));
                });

            details.appendChild(cardsContainer);
            listContainer.appendChild(details);
        });
    }

    function initCharts() {
        if (typeof Chart === "undefined" || !statsData) {
            return;
        }

        const coverageCanvas = document.getElementById("coverage-chart");
        const missingCanvas = document.getElementById("missing-chart");

        if (coverageCanvas) {
            const available = statsData.paper_available_total || 0;
            const missing = statsData.paper_missing_total || 0;
            new Chart(coverageCanvas, {
                type: "doughnut",
                data: {
                    labels: ["Available cards", "Missing cards"],
                    datasets: [
                        {
                            data: [available, missing],
                            backgroundColor: ["#34d399", "#fbbf24"],
                            borderWidth: 0,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: "#cbd5f5",
                            },
                        },
                    },
                },
            });
        }

        if (missingCanvas && Array.isArray(statsData.paper_formats)) {
            const topFormats = [...statsData.paper_formats]
                .sort((a, b) => b.paper_missing_on_arena - a.paper_missing_on_arena)
                .slice(0, 8);
            const labels = topFormats.map((fmt) => fmt.label);
            const values = topFormats.map((fmt) => fmt.paper_missing_on_arena);
            new Chart(missingCanvas, {
                type: "bar",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Missing cards",
                            data: values,
                            backgroundColor: "#fbbf24",
                            borderWidth: 0,
                        },
                    ],
                },
                options: {
                    indexAxis: "y",
                    responsive: true,
                    scales: {
                        x: {
                            ticks: { color: "#cbd5f5" },
                            grid: { color: "rgba(203,213,245,0.1)" },
                        },
                        y: {
                            ticks: { color: "#cbd5f5" },
                            grid: { display: false },
                        },
                    },
                    plugins: {
                        legend: {
                            labels: { color: "#cbd5f5" },
                        },
                    },
                },
            });
        }
    }

    function onRowClick(event) {
        const row = event.target.closest("tr[data-format-code]");
        if (!row) {
            return;
        }

        if (activeRow) {
            activeRow.classList.remove("bg-arena-surface/40");
        }

        activeRow = row;
        activeRow.classList.add("bg-arena-surface/40");

        state.format = row.dataset.formatCode;
        state.page = 1;
        state.search = "";
        searchInput.value = "";
        fetchCards();
        if (explorerSection) {
            explorerSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    if (tableBody) {
        tableBody.addEventListener("click", onRowClick);
    }

    if (searchForm) {
        searchForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!state.format) {
                return;
            }
            state.search = searchInput.value.trim();
            state.page = 1;
            fetchCards();
        });
    }

    filterSelect?.addEventListener("change", () => {
        state.availability = filterSelect.value;
        if (state.format) {
            state.page = 1;
            fetchCards();
        }
    });

    prevButton?.addEventListener("click", () => {
        if (state.page <= 1) {
            return;
        }
        state.page -= 1;
        fetchCards();
    });

    nextButton?.addEventListener("click", () => {
        if (state.page >= state.totalPages) {
            return;
        }
        state.page += 1;
        fetchCards();
    });

    resetPanel();
    initCharts();
});
