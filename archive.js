const archiveState={archetypes:[],query:"",selected:null};
const archiveLabels={ephtear:"Ephtear",duelhalla:"Duelhalla","limb-faux":"Limb-Faux"};
const archiveElements={
  search:document.querySelector("#archive-search"),updated:document.querySelector("#archive-updated"),total:document.querySelector("#archive-total"),
  error:document.querySelector("#archive-error"),dialog:document.querySelector("#archive-dialog"),dialogContent:document.querySelector("#archive-dialog-content"),
  grids:{ephtear:document.querySelector("#ephtear-grid"),duelhalla:document.querySelector("#duelhalla-grid"),"limb-faux":document.querySelector("#limbfaux-grid")},
  counts:{ephtear:document.querySelector("#ephtear-count"),duelhalla:document.querySelector("#duelhalla-count"),"limb-faux":document.querySelector("#limbfaux-count")},
};

function escapeHtml(value="") { return String(value).replace(/[&<>'"]/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]); }
function dateLabel(value) { const normalized=/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value}T00:00:00`:value; const date=new Date(normalized); return Number.isNaN(date.valueOf())?"Date unavailable":new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(date); }
function cardTypeLine(card) { return [card.attribute,card.cardType,card.monsterType,card.abilities?.join(" · ")].filter(Boolean).join(" · ") || card.cardType || "Card details unavailable"; }
function cardStats(card) { return [card.levelRankLink,card.atk!==undefined?`ATK ${card.atk}`:"",card.def!==undefined?`DEF ${card.def}`:""].filter(Boolean).join(" · "); }
function statusLabel(status) { return ({banned:"Banned · 0",limeade:"Limeade · 1","semi-limeade":"Semi-Limeade · 2",unlimeade:"Un-Limeade · 3",voting:"Voting pending"})[status] || status; }

function renderArchive() {
  const query=archiveState.query.trim().toLowerCase();
  for (const destination of Object.keys(archiveElements.grids)) {
    const entries=archiveState.archetypes.filter(entry=>entry.destination===destination && (!query || `${entry.name} ${entry.creator}`.toLowerCase().includes(query)));
    archiveElements.counts[destination].textContent=String(entries.length);
    archiveElements.grids[destination].innerHTML=entries.length?entries.map(entry=>`
      <button class="archive-entry" style="--archive-color:${destination==="ephtear"?"#ef5a45":destination==="duelhalla"?"#e2b84a":"#9a64e8"}" type="button" data-archetype-id="${entry.id}">
        <span class="archive-entry__tags"><span class="archive-tag">${escapeHtml(archiveLabels[destination])}</span>${entry.cardListComplete?"":'<span class="archive-tag archive-tag--incomplete">Card list incomplete</span>'}</span>
        <h3>${escapeHtml(entry.name)}</h3>
        <p>Created by ${escapeHtml(entry.creator)}</p>
        <p>${dateLabel(entry.retiredAt)} · ${entry.cards.length} linked card${entry.cards.length===1?"":"s"}</p>
      </button>`).join(""):'<p class="archive-empty">No matching archetypes in this section.</p>';
  }
}

function archetypeDialog(entry) {
  const color=entry.destination==="ephtear"?"#ef5a45":entry.destination==="duelhalla"?"#e2b84a":"#9a64e8";
  return `<div class="archive-dialog__body" style="--archive-color:${color}">
    <div class="archive-dialog__topline"><span class="archive-tag">${escapeHtml(archiveLabels[entry.destination])}</span>${entry.historySource==="historical"?'<span class="archive-tag">Historical record</span>':""}${entry.cardListComplete?"":'<span class="archive-tag archive-tag--incomplete">Card list incomplete</span>'}</div>
    <h2>${escapeHtml(entry.name)}</h2><p class="archive-dialog__creator">Created by ${escapeHtml(entry.creator)}</p>
    <div class="archive-facts"><div><span>Retired</span><strong>${dateLabel(entry.retiredAt)}</strong></div><div><span>Destination</span><strong>${escapeHtml(archiveLabels[entry.destination])}</strong></div><div><span>Final added clauses</span><strong>${entry.finalAddedClauses||"Unknown"}</strong></div></div>
    ${entry.notes?`<p class="archive-note">${escapeHtml(entry.notes)}</p>`:""}
    <div class="archive-cards-heading"><h3>Cards in this archetype</h3><span>${entry.cards.length} linked</span></div>
    <div class="archive-card-grid">${entry.cards.length?entry.cards.map(card=>`<button class="archive-card" type="button" data-card-id="${card.id}">${card.imageUrl?`<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)} artwork" loading="lazy" />`:'<span class="archive-card__placeholder">YF</span>'}<div><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(statusLabel(card.status))}</span></div></button>`).join(""):'<p class="archive-empty">No cards have been attached yet. This historical record can still remain in the archive.</p>'}</div>
  </div>`;
}

function cardDialog(card) {
  const details=[
    ["Card type",card.cardType],["Monster type",card.monsterType],["Attribute",card.attribute],["Level / Rank / Link",card.levelRankLink],
    ["ATK",card.atk],["DEF",card.def],["Ability",card.abilities?.join(", ")],["Spell / Trap type",card.spellTrapType],
    ["Pendulum scale",card.pendulumScale],["Link markers",card.linkMarkers?.join(", ")],["Effect clauses",card.clauses],
  ].filter(([,value])=>value!==undefined&&value!==null&&value!=="");
  return `<div class="archive-card-detail"><div>${card.imageUrl?`<img class="archive-card-detail__art" src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)} artwork" />`:'<div class="archive-card__placeholder">YF</div>'}</div><div>
    <button class="archive-back" type="button">← Back to archetype</button><h2>${escapeHtml(card.name)}</h2>
    <p class="archive-card-detail__line">${escapeHtml(statusLabel(card.status))}</p><p class="archive-card-detail__line">${escapeHtml(cardTypeLine(card))}</p>${cardStats(card)?`<p class="archive-card-detail__line">${escapeHtml(cardStats(card))}</p>`:""}
    ${details.length?`<dl class="detail-grid">${details.map(([label,value])=>`<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`:""}
    ${card.pendulumEffect?`<div class="archive-card-detail__text"><strong>Pendulum effect</strong><br>${escapeHtml(card.pendulumEffect)}</div>`:""}
    <div class="archive-card-detail__text">${escapeHtml(card.text||"No card text is currently available.")}</div>
  </div></div>`;
}

function openArchetype(id) {
  const entry=archiveState.archetypes.find(item=>item.id===id); if(!entry)return;
  archiveState.selected=entry; archiveElements.dialogContent.innerHTML=archetypeDialog(entry); archiveElements.dialog.showModal();
}

document.addEventListener("click",event=>{
  const entryButton=event.target.closest("[data-archetype-id]"); if(entryButton) openArchetype(Number(entryButton.dataset.archetypeId));
  const cardButton=event.target.closest("[data-card-id]"); if(cardButton&&archiveState.selected){const card=archiveState.selected.cards.find(item=>item.id===Number(cardButton.dataset.cardId));if(card)archiveElements.dialogContent.innerHTML=cardDialog(card);}
  if(event.target.closest(".archive-back")&&archiveState.selected)archiveElements.dialogContent.innerHTML=archetypeDialog(archiveState.selected);
});
archiveElements.dialog.querySelector(".dialog-close").addEventListener("click",()=>archiveElements.dialog.close());
archiveElements.dialog.addEventListener("click",event=>{if(event.target===archiveElements.dialog)archiveElements.dialog.close();});
archiveElements.search.addEventListener("input",()=>{archiveState.query=archiveElements.search.value;renderArchive();});

async function loadArchive(){
  try{
    const response=await fetch(`data/banlist.json?v=${Date.now()}`,{cache:"no-store"}); if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json(); archiveState.archetypes=Array.isArray(payload.archetypes)?payload.archetypes:[];
    archiveElements.updated.textContent=payload.updatedAt?`Updated ${new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(payload.updatedAt))}`:"Archive loaded";
    archiveElements.total.textContent=`${archiveState.archetypes.length} archetype${archiveState.archetypes.length===1?"":"s"}`; renderArchive();
  }catch(error){console.error(error);archiveElements.error.hidden=false;archiveElements.search.hidden=true;archiveElements.updated.textContent="Archive unavailable";}
}
loadArchive();

