const STATUS = {
  limeade: { label: "Limeade", copies: 1 },
  "semi-limeade": { label: "Semi-Limeade", copies: 2 },
  unlimeade: { label: "Un-Limeade", copies: 3 },
};

const COLLECTION_KEY = "yugifaux-draft-night-collection-v1";
const state = { cards: [], packs: [] };
const elements = {
  open: document.querySelector("#open-pack"),
  reset: document.querySelector("#reset-draft"),
  stage: document.querySelector("#pack-stage"),
  picks: document.querySelector("#draft-picks"),
  poolStatus: document.querySelector("#draft-pool-status"),
  packCount: document.querySelector("#pack-count"),
  pullTotal: document.querySelector("#pull-total"),
  message: document.querySelector("#draft-message"),
  error: document.querySelector("#draft-error"),
  dialog: document.querySelector("#draft-card-dialog"),
  dialogContent: document.querySelector("#draft-dialog-content"),
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
})[character]);

function randomIndex(max) {
  if (max < 2) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const value = new Uint32Array(1);
  do crypto.getRandomValues(value); while (value[0] >= limit);
  return value[0] % max;
}

function shuffled(cards) {
  const result = [...cards];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
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

function typeText(card) {
  return [card.attribute, card.cardType, card.monsterType || card.spellTrapType, ...(card.abilities || [])]
    .filter(Boolean).join(" · ") || "Card details unavailable";
}

function statusText(card) {
  const status = STATUS[card.status];
  return status ? `${status.label} · ${status.copies}` : "Legal status unavailable";
}

function cardImage(card, className) {
  if (!card.imageUrl) return `<div class="draft-card-placeholder">YF</div>`;
  return `<img class="${className}" src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)} card artwork" loading="lazy" referrerpolicy="no-referrer" />`;
}

function packCard(card, index) {
  return `<button class="draft-card" type="button" data-card-id="${escapeHtml(card.id)}" data-frame="${frameCategory(card)}" style="--reveal-delay:${index * 110}ms">
    <span class="draft-card__back"><span>YF</span><small>Draft Night</small></span>
    <span class="draft-card__front">
      <span class="draft-card__image">${cardImage(card, "draft-card__art")}</span>
      <span class="draft-card__copy">
        <strong>${escapeHtml(card.name)}</strong>
        <small>${escapeHtml(statusText(card))}</small>
        <small>${escapeHtml(card.cardType || "Unknown card type")}</small>
      </span>
    </span>
  </button>`;
}

function bindCards(root) {
  root.querySelectorAll("[data-card-id]").forEach(button => button.addEventListener("click", () => {
    const card = state.cards.find(item => String(item.id) === String(button.dataset.cardId));
    showCard(card);
  }));
  root.querySelectorAll("img").forEach(image => image.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.className = "draft-card-placeholder";
    fallback.textContent = "YF";
    image.replaceWith(fallback);
  }, { once: true }));
}

function saveCollection() {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(state.packs.map(pack => pack.map(card => card.id))));
}

function restoreCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLECTION_KEY) || "[]");
    if (!Array.isArray(saved)) return;
    state.packs = saved.map(pack => Array.isArray(pack)
      ? pack.map(id => state.cards.find(card => String(card.id) === String(id))).filter(Boolean) : []).filter(pack => pack.length);
  } catch { state.packs = []; }
}

function renderCollection() {
  const pulls = state.packs.flat();
  elements.packCount.textContent = `${state.packs.length} ${state.packs.length === 1 ? "pack" : "packs"} opened`;
  elements.pullTotal.textContent = `${pulls.length} ${pulls.length === 1 ? "card" : "cards"}`;
  if (!pulls.length) {
    elements.picks.innerHTML = '<p class="draft-picks-empty">Cards from every pack you open will be collected here.</p>';
    return;
  }
  const counts = new Map();
  pulls.forEach(card => counts.set(String(card.id), { card, count: (counts.get(String(card.id))?.count || 0) + 1 }));
  elements.picks.innerHTML = [...counts.values()].sort((a, b) => a.card.name.localeCompare(b.card.name)).map(({ card, count }) =>
    `<button class="draft-pick" type="button" data-card-id="${escapeHtml(card.id)}" data-frame="${frameCategory(card)}">
      ${cardImage(card, "draft-pick__art")}
      <span><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.cardType || "Unknown card type")}</small></span>
      <b aria-label="${count} copies">×${count}</b>
    </button>`).join("");
  bindCards(elements.picks);
}

function openPack() {
  if (state.cards.length < 5) return;
  elements.open.disabled = true;
  const pack = shuffled(state.cards).slice(0, 5);
  state.packs.push(pack);
  saveCollection();
  elements.stage.classList.remove("is-open", "is-ripping");
  elements.stage.innerHTML = `<div class="pack-rip" aria-label="Opening YugiFaux Draft Night booster pack">
    <div class="pack-rip__glow"></div>
    <img class="pack-rip__whole" src="assets/draft-pack.jpg?v=2" alt="" />
    <div class="pack-rip__half pack-rip__half--top"><img src="assets/draft-pack.jpg?v=2" alt="" /></div>
    <div class="pack-rip__half pack-rip__half--bottom"><img src="assets/draft-pack.jpg?v=2" alt="" /></div>
    <span class="pack-rip__tear" aria-hidden="true"></span>
  </div>`;
  void elements.stage.offsetWidth;
  elements.stage.classList.add("is-ripping");
  elements.message.textContent = `Ripping pack ${state.packs.length}…`;
  renderCollection();
  window.setTimeout(() => {
    elements.stage.classList.remove("is-ripping");
    elements.stage.innerHTML = pack.map(packCard).join("");
    bindCards(elements.stage);
    void elements.stage.offsetWidth;
    requestAnimationFrame(() => elements.stage.classList.add("is-open"));
    elements.message.textContent = `Pack ${state.packs.length} opened — five cards added to your draft pool.`;
  }, 1050);
  window.setTimeout(() => { elements.open.disabled = false; elements.open.focus(); }, 1950);
}

function resetDraft() {
  if (!state.packs.length || window.confirm("Clear every pack opened in this browser session?")) {
    state.packs = [];
    localStorage.removeItem(COLLECTION_KEY);
    elements.stage.classList.remove("is-open");
    elements.stage.innerHTML = '<div class="pack-empty"><img src="assets/draft-pack.jpg?v=2" alt="YugiFaux Draft Night booster pack" /><h2>Your next pack is waiting</h2><p>Select “Rip a pack” to reveal five cards.</p></div>';
    elements.message.textContent = "Draft reset. Your next pack is ready.";
    renderCollection();
  }
}

function detailRows(card) {
  const rows = [
    ["Card type", card.cardType], ["Monster type", card.monsterType], ["Spell/Trap type", card.spellTrapType],
    ["Attribute", card.attribute], ["Level / Rank / Link", card.levelRankLink], ["ATK", card.atk], ["DEF", card.def],
    ["Pendulum Scale", card.pendulumScale], ["Link Markers", card.linkMarkers?.join(", ")], ["Effect clauses", card.clauses],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  return rows.map(([label, value]) => `<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
}

function showCard(card) {
  if (!card) return;
  elements.dialogContent.innerHTML = `<article class="dialog-card" data-status="${escapeHtml(card.status)}">
    <div>${cardImage(card, "dialog-card__art")}</div>
    <div><span class="dialog-card__status">${escapeHtml(statusText(card))}</span><h2>${escapeHtml(card.name)}</h2>
      <p class="dialog-card__line">${escapeHtml(typeText(card))}</p><dl class="detail-grid">${detailRows(card)}</dl>
      ${card.pendulumEffect ? `<section class="card-text-section"><h3>Pendulum Effect</h3><div class="dialog-card__text">${escapeHtml(card.pendulumEffect)}</div></section>` : ""}
      <section class="card-text-section"><h3>Effect / Card Text</h3><div class="dialog-card__text">${escapeHtml(card.text || "No card text is currently available.")}</div></section>
    </div></article>`;
  bindCards(elements.dialogContent);
  elements.dialog.showModal();
}

async function loadDraftPool() {
  try {
    const response = await fetch(`data/banlist.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.cards = (Array.isArray(payload.cards) ? payload.cards : []).filter(card => STATUS[card.status]);
    if (state.cards.length < 5) throw new Error("The legal draft pool contains fewer than five cards.");
    restoreCollection();
    elements.poolStatus.textContent = `${state.cards.length} legal cards in the draft pool`;
    elements.open.disabled = false;
    if (state.packs.length) {
      const latest = state.packs.at(-1);
      elements.stage.innerHTML = latest.map(packCard).join("");
      elements.stage.classList.add("is-open");
      bindCards(elements.stage);
    }
    renderCollection();
  } catch (error) {
    console.error("Could not load Draft Night", error);
    elements.error.hidden = false;
    elements.poolStatus.textContent = "Draft pool unavailable";
    elements.stage.hidden = true;
  }
}

elements.open.addEventListener("click", openPack);
elements.reset.addEventListener("click", resetDraft);
elements.dialog.querySelector(".dialog-close").addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", event => { if (event.target === elements.dialog) elements.dialog.close(); });
loadDraftPool();

