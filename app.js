const STATUS = {
  banned: { label: "Banned", copies: 0, order: 0 },
  limeade: { label: "Limeade", copies: 1, order: 1 },
  "semi-limeade": { label: "Semi-Limeade", copies: 2, order: 2 },
  unlimeade: { label: "Un-Limeade", copies: 3, order: 3 },
  voting: { label: "Voting Pending", copies: null, order: 4 },
};

const state = { cards: [], query: "", status: "all", source: "all", cardType: "all", attribute: "all",
  monsterType: "all", ability: "all", sort: "name", view: "all", favorites: new Set() };

const FAVORITES_KEY = "yugifaux-banlist-favorites";
const RECENT_DAYS = 14;

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
  cardType: document.querySelector("#card-type-filter"),
  attribute: document.querySelector("#attribute-filter"),
  monsterType: document.querySelector("#monster-type-filter"),
  ability: document.querySelector("#ability-filter"),
  sort: document.querySelector("#sort"),
  clear: document.querySelector("#clear-filters"),
  favoriteCount: document.querySelector("#favorite-count"),
  dialog: document.querySelector("#card-dialog"),
  dialogContent: document.querySelector("#dialog-content"),
};

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    state.favorites = new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch { state.favorites = new Set(); }
}

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  elements.favoriteCount.textContent = state.favorites.size;
}

function isRecent(card) {
  const changed = new Date(card.changedAt || card.addedAt || 0).getTime();
  return Number.isFinite(changed) && changed >= Date.now() - RECENT_DAYS * 86400000;
}

function favoriteButton(card, className = "favorite-button") {
  const saved = state.favorites.has(String(card.id));
  return `<button class="${className}" type="button" data-favorite-id="${escapeHtml(card.id)}" aria-pressed="${saved}" aria-label="${saved ? "Remove from" : "Add to"} favorites">${saved ? "★" : "☆"}</button>`;
}

function toggleFavorite(cardId) {
  const id = String(cardId);
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  saveFavorites();
  renderCards();
}

function bindFavoriteButtons(root) {
  root.querySelectorAll("[data-favorite-id]").forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    toggleFavorite(button.dataset.favoriteId);
    if (root === elements.dialogContent) showCard(state.cards.find(card => String(card.id) === String(button.dataset.favoriteId)));
  }));
}

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

function enableImageFallbacks(root) {
  root.querySelectorAll("img").forEach(image => image.addEventListener("error", () => {
    const placeholder = document.createElement("div");
    placeholder.className = "ban-card__placeholder";
    placeholder.textContent = "YF";
    placeholder.setAttribute("aria-label", "Card artwork unavailable");
    image.replaceWith(placeholder);
  }, { once: true }));
}

function typeText(card) {
  return [card.attribute, card.cardType, card.monsterType || card.spellTrapType, ...(card.abilities || [])]
    .filter(Boolean).join(" · ") || "Card details unavailable";
}

function frameCategory(card) {
  const type = String(card.cardType || "").toLowerCase();
  if (type.includes("spell")) return "spell";
  if (type.includes("trap")) return "trap";
  if (type.includes("ritual")) return "ritual";
  if (type.includes("fusion")) return "fusion";
  if (type.includes("synchro")) return "synchro";
  if (type.includes("xyz")) return "xyz";
  if (type.includes("link")) return "link";
  if (type.includes("normal")) return "normal";
  return "effect";
}

function matchesCardType(card, selected) {
  if (selected === "all") return true;
  if (selected === "pendulum") return card.pendulumScale !== undefined && card.pendulumScale !== null;
  return frameCategory(card) === selected;
}

function populateSelect(select, values, label) {
  const current = select.value;
  select.innerHTML = `<option value="all">All ${label}</option>` + values
    .map(value => `<option value="${escapeHtml(value.toLocaleLowerCase())}">${escapeHtml(value)}</option>`).join("");
  select.value = [...select.options].some(option => option.value === current) ? current : "all";
}

function populateDynamicFilters() {
  const unique = key => [...new Set(state.cards.flatMap(card => {
    const value = card[key];
    return Array.isArray(value) ? value : value ? [value] : [];
  }).map(String).map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  populateSelect(elements.attribute, unique("attribute"), "Attributes");
  populateSelect(elements.monsterType, unique("monsterType"), "monster types");
  populateSelect(elements.ability, unique("abilities"), "abilities");
}

function statText(card) {
  return [card.levelRankLink, card.atk != null ? `ATK ${card.atk}` : "", card.def != null ? `DEF ${card.def}` : ""]
    .filter(Boolean).join(" · ");
}

function detailRows(card) {
  const rows = [
    ["Card type", card.cardType],
    ["Spell/Trap type", card.spellTrapType],
    ["Monster type", card.monsterType],
    ["Ability", card.abilities?.join(" / ")],
    ["Attribute", card.attribute],
    ["Level / Rank / Link", card.levelRankLink],
    ["ATK", card.atk],
    ["DEF", card.def],
    ["Pendulum Scale", card.pendulumScale],
    ["Link Markers", card.linkMarkers?.join(", ")],
    ["Archetype", card.archetype],
    ["Effect clauses", card.clauses],
    ["Added by", card.contributor],
    ["Duelingbook ID", card.duelingbookId],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  return rows.map(([label, value]) => `<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
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
    if (state.view === "recent" && !isRecent(card)) return false;
    if (state.view === "favorites" && !state.favorites.has(String(card.id))) return false;
    if (state.status !== "all" && card.status !== state.status) return false;
    if (state.source !== "all" && normalizeSource(card) !== state.source) return false;
    if (!matchesCardType(card, state.cardType)) return false;
    if (state.attribute !== "all" && String(card.attribute || "").toLocaleLowerCase() !== state.attribute) return false;
    if (state.monsterType !== "all" && String(card.monsterType || "").toLocaleLowerCase() !== state.monsterType) return false;
    if (state.ability !== "all" && !(card.abilities || []).some(value => String(value).toLocaleLowerCase() === state.ability)) return false;
    if (!query) return true;
    return [card.name, card.text, card.pendulumEffect, card.archetype, card.cardType, card.monsterType,
      card.spellTrapType, ...(card.abilities || []), ...(card.linkMarkers || [])]
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
  elements.grid.innerHTML = cards.map(card => `<article class="ban-card" data-status="${escapeHtml(card.status)}" data-frame="${frameCategory(card)}" data-card-id="${escapeHtml(card.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(card.name)} details">
    ${imageMarkup(card, "ban-card__art")}
    <div class="ban-card__body">
      ${favoriteButton(card)}
      <span class="ban-card__status">${escapeHtml(statusText(card.status))}</span>
      ${isRecent(card) ? `<span class="recent-badge">Recently changed</span>` : ""}
      <span class="ban-card__frame"><i aria-hidden="true"></i>${escapeHtml(card.cardType || "Unknown card type")}</span>
      <h2>${escapeHtml(card.name)}</h2>
      <p class="ban-card__type">${escapeHtml(typeText(card))}</p>
      ${statText(card) ? `<p class="ban-card__stats">${escapeHtml(statText(card))}</p>` : ""}
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
  enableImageFallbacks(elements.grid);
  bindFavoriteButtons(elements.grid);
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
      ${favoriteButton(card, "dialog-favorite-button")}
      <span class="dialog-card__status">${escapeHtml(statusText(card.status))}</span>
      <h2>${escapeHtml(card.name)}</h2>
      <dl class="detail-grid">${detailRows(card)}</dl>
      ${card.pendulumEffect ? `<section class="card-text-section"><h3>Pendulum Effect</h3><div class="dialog-card__text">${escapeHtml(card.pendulumEffect)}</div></section>` : ""}
      <section class="card-text-section"><h3>${card.cardType?.includes("Normal Monster") ? "Card Text" : "Effect / Card Text"}</h3><div class="dialog-card__text">${escapeHtml(card.text || "No card text is currently available.")}</div></section>
      ${links ? `<div class="dialog-card__links">${links}</div>` : ""}
    </div>
  </article>`;
  enableImageFallbacks(elements.dialogContent);
  bindFavoriteButtons(elements.dialogContent);
  if (!elements.dialog.open) elements.dialog.showModal();
}

function resetFilters() {
  Object.assign(state, { query: "", status: "all", source: "all", cardType: "all", attribute: "all",
    monsterType: "all", ability: "all", sort: "name", view: "all" });
  elements.search.value = "";
  elements.status.value = "all";
  elements.source.value = "all";
  elements.cardType.value = "all";
  elements.attribute.value = "all";
  elements.monsterType.value = "all";
  elements.ability.value = "all";
  elements.sort.value = "name";
  updateViewTabs();
  renderCards();
}

function updateViewTabs() {
  document.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === state.view)));
}

async function loadData() {
  try {
    const response = await fetch(`data/banlist.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.cards = Array.isArray(payload.cards) ? payload.cards : [];
    loadFavorites();
    saveFavorites();
    elements.total.textContent = `${state.cards.length} ${state.cards.length === 1 ? "card" : "cards"}`;
    elements.updated.textContent = payload.updatedAt
      ? `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.updatedAt))}`
      : "Update time unavailable";
    populateDynamicFilters();
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
elements.cardType.addEventListener("change", event => { state.cardType = event.target.value; renderCards(); });
elements.attribute.addEventListener("change", event => { state.attribute = event.target.value; renderCards(); });
elements.monsterType.addEventListener("change", event => { state.monsterType = event.target.value; renderCards(); });
elements.ability.addEventListener("change", event => { state.ability = event.target.value; renderCards(); });
elements.sort.addEventListener("change", event => { state.sort = event.target.value; renderCards(); });
elements.clear.addEventListener("click", resetFilters);
document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
  state.view = button.dataset.view;
  updateViewTabs();
  renderCards();
}));
elements.dialog.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => { if (event.target === elements.dialog) elements.dialog.close(); });

loadData();
