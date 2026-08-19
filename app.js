const STATUS = {
  banned: { label: "Banned", copies: 0, order: 0 },
  limeade: { label: "Limeade", copies: 1, order: 1 },
  "semi-limeade": { label: "Semi-Limeade", copies: 2, order: 2 },
  unlimeade: { label: "Un-Limeade", copies: 3, order: 3 },
  voting: { label: "Voting Pending", copies: null, order: 4 },
};

const state = { cards: [], query: "", status: "all", source: "all", sort: "name" };

const elements = {
  summary: document.querySelector("#summary"),
  grid: document.querySelector("#card-grid"),
  empty: document.querySelector("#empty-state"),
  error: document.querySelector("#error-state"),
  count: document.querySelector("#result-count"),
  total: document.querySelector("#card-total"),
  updated: document.querySelector("#last-updated"),
  search: document.querySelector("#search"),
  status: document.querySelector("#status-filter"),
  source: document.querySelector("#source-filter"),
  sort: document.querySelector("#sort"),
  clear: document.querySelector("#clear-filters"),
  dialog: document.querySelector("#card-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
})[character]);

function normalizeSource(card) {
  return card.source === "official" ? "official" : "custom";
}

function statusText(status) {
  const entry = STATUS[status] ?? STATUS.voting;
  return entry.copies === null ? entry.label : `${entry.label} · ${entry.copies}`;
}

function imageMarkup(card, className) {
  if (!card.imageUrl) return `<div class="ban-card__placeholder">YF</div>`;
  return `<img class="${className}" src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)} card artwork" loading="lazy" referrerpolicy="no-referrer" />`;
}

function typeText(card) {
  return [card.attribute, card.cardType, card.monsterType || card.spellTrapType].filter(Boolean).join(" · ") || "Card details unavailable";
}

function renderSummary() {
  const statuses = ["banned", "limeade", "semi-limeade", "unlimeade"];
  elements.summary.innerHTML = statuses.map(status => {
    const config = STATUS[status];
    const count = state.cards.filter(card => card.status === status).length;
    return `<button class="summary-card" data-status="${status}" data-filter-status="${status}" type="button">
      <span class="summary-card__label">${config.label}</span>
      <span class="summary-card__count">${count}</span>
      <span class="summary-card__copies">${config.copies} ${config.copies === 1 ? "copy" : "copies"} legal</span>
    </button>`;
  }).join("");

  elements.summary.querySelectorAll("[data-filter-status]").forEach(button => {
    button.addEventListener("click", () => {
      state.status = button.dataset.filterStatus;
      elements.status.value = state.status;
      renderCards();
      elements.grid.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function getVisibleCards() {
  const query = state.query.trim().toLocaleLowerCase();
  const result = state.cards.filter(card => {
    if (state.status !== "all" && card.status !== state.status) return false;
    if (state.source !== "all" && normalizeSource(card) !== state.source) return false;
    if (!query) return true;
    return [card.name, card.text, card.archetype, card.cardType, card.monsterType, card.spellTrapType]
      .filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(query));
  });

  return result.sort((a, b) => {
    if (state.sort === "newest") return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
    if (state.sort === "status") {
      const statusDifference = (STATUS[a.status]?.order ?? 99) - (STATUS[b.status]?.order ?? 99);
      return statusDifference || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
}

function renderCards() {
  const cards = getVisibleCards();
  elements.count.textContent = `${cards.length} ${cards.length === 1 ? "card" : "cards"} shown`;
  elements.empty.hidden = cards.length !== 0;
  elements.grid.hidden = cards.length === 0;
  elements.grid.innerHTML = cards.map(card => `<article class="ban-card" data-status="${escapeHtml(card.status)}" data-card-id="${escapeHtml(card.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(card.name)} details">
    ${imageMarkup(card, "ban-card__art")}
    <div class="ban-card__body">
      <span class="ban-card__status">${escapeHtml(statusText(card.status))}</span>
      <h2>${escapeHtml(card.name)}</h2>
      <p class="ban-card__type">${escapeHtml(typeText(card))}</p>
      <p class="ban-card__meta">${normalizeSource(card) === "official" ? "Official card" : `Custom card${card.clauses != null ? ` · ${card.clauses} clauses` : ""}`}</p>
    </div>
  </article>`).join("");

  elements.grid.querySelectorAll("[data-card-id]").forEach(node => {
    const open = () => showCard(state.cards.find(card => String(card.id) === node.dataset.cardId));
    node.addEventListener("click", open);
    node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

function showCard(card) {
  if (!card) return;
  const links = [
    card.duelingbookId ? `<a href="https://www.duelingbook.com/card?id=${encodeURIComponent(card.duelingbookId)}" target="_blank" rel="noreferrer">View on Duelingbook</a>` : "",
    card.officialUrl ? `<a href="${escapeHtml(card.officialUrl)}" target="_blank" rel="noreferrer">Official card page</a>` : "",
  ].filter(Boolean).join("");

  elements.dialogContent.innerHTML = `<article class="dialog-card" data-status="${escapeHtml(card.status)}">
    <div>${imageMarkup(card, "dialog-card__art")}</div>
    <div>
      <span class="dialog-card__status">${escapeHtml(statusText(card.status))}</span>
      <h2>${escapeHtml(card.name)}</h2>
      <p class="dialog-card__line">${escapeHtml(typeText(card))}</p>
      ${card.archetype ? `<p class="dialog-card__line"><strong>Archetype:</strong> ${escapeHtml(card.archetype)}</p>` : ""}
      ${card.clauses != null ? `<p class="dialog-card__line"><strong>Effect clauses:</strong> ${escapeHtml(card.clauses)}</p>` : ""}
      ${card.contributor ? `<p class="dialog-card__line"><strong>Added by:</strong> ${escapeHtml(card.contributor)}</p>` : ""}
      <div class="dialog-card__text">${escapeHtml(card.text || "No card text is currently available.")}</div>
      ${links ? `<div class="dialog-card__links">${links}</div>` : ""}
    </div>
  </article>`;
  elements.dialog.showModal();
}

function resetFilters() {
  Object.assign(state, { query: "", status: "all", source: "all", sort: "name" });
  elements.search.value = "";
  elements.status.value = "all";
  elements.source.value = "all";
  elements.sort.value = "name";
  renderCards();
}

async function loadData() {
  try {
    const response = await fetch(`data/banlist.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.cards = Array.isArray(payload.cards) ? payload.cards : [];
    elements.total.textContent = `${state.cards.length} ${state.cards.length === 1 ? "card" : "cards"}`;
    elements.updated.textContent = payload.updatedAt
      ? `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.updatedAt))}`
      : "Update time unavailable";
    renderSummary();
    renderCards();
  } catch (error) {
    console.error("Could not load banlist", error);
    elements.error.hidden = false;
    elements.grid.hidden = true;
    elements.count.textContent = "List unavailable";
    elements.updated.textContent = "Update unavailable";
  }
}

elements.search.addEventListener("input", event => { state.query = event.target.value; renderCards(); });
elements.status.addEventListener("change", event => { state.status = event.target.value; renderCards(); });
elements.source.addEventListener("change", event => { state.source = event.target.value; renderCards(); });
elements.sort.addEventListener("change", event => { state.sort = event.target.value; renderCards(); });
elements.clear.addEventListener("click", resetFilters);
elements.dialog.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => { if (event.target === elements.dialog) elements.dialog.close(); });

loadData();
