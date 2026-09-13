const STATUS={banned:{label:"Banned",copies:0},limeade:{label:"Limeade",copies:1},"semi-limeade":{label:"Semi-Limeade",copies:2},unlimeade:{label:"Un-Limeade",copies:3}};
const RIP_KEY="yugifaux-draft-night-collection-v1";
const DRAFT_KEY="yugifaux-pick-two-draft-v1";
const DRAFT_PENDING_KEY="yugifaux-pick-two-pending-v1";
const MODE_KEY="yugifaux-draft-night-mode-v1";
const state={cards:[],mode:"rips",ripPacks:[],draftRounds:[],pendingPack:null,selectedIds:new Set(),busy:false,ready:false};
const elements={
  modes:[...document.querySelectorAll("[data-draft-mode]")],open:document.querySelector("#open-pack"),confirm:document.querySelector("#confirm-picks"),reset:document.querySelector("#reset-draft"),stage:document.querySelector("#pack-stage"),picks:document.querySelector("#draft-picks"),poolStatus:document.querySelector("#draft-pool-status"),packCount:document.querySelector("#pack-count"),pullTotal:document.querySelector("#pull-total"),message:document.querySelector("#draft-message"),error:document.querySelector("#draft-error"),dialog:document.querySelector("#draft-card-dialog"),dialogContent:document.querySelector("#draft-dialog-content"),stationKicker:document.querySelector("#station-kicker"),stationTitle:document.querySelector("#pack-station-title"),stationDescription:document.querySelector("#pack-station-description"),collectionKicker:document.querySelector("#collection-kicker"),collectionTitle:document.querySelector("#collection-title"),
};

const escapeHtml=(value="")=>String(value).replace(/[&<>'"]/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[character]);

function randomFraction(){const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]/0x100000000;}
function archetypeKey(card){return String(card.archetype||"").trim().toLocaleLowerCase();}
function collectionCards(){return(state.mode==="draft"?state.draftRounds:state.ripPacks).flat();}

function draftPack(cards){
  const priorArchetypes=new Map();
  collectionCards().forEach(card=>{const key=archetypeKey(card);if(key)priorArchetypes.set(key,(priorArchetypes.get(key)||0)+1);});
  const available=[...cards];
  const pack=[];
  while(pack.length<5&&available.length){
    const weights=available.map(card=>1+Math.min(.35,(priorArchetypes.get(archetypeKey(card))||0)*.12));
    const totalWeight=weights.reduce((sum,weight)=>sum+weight,0);
    let roll=randomFraction()*totalWeight;
    let selectedIndex=weights.length-1;
    for(let index=0;index<weights.length;index+=1){roll-=weights[index];if(roll<0){selectedIndex=index;break;}}
    pack.push(available.splice(selectedIndex,1)[0]);
  }
  return pack;
}

function frameCategory(card){
  const type=String(card.cardType||"").toLowerCase();
  if(type.includes("spell"))return"spell";if(type.includes("trap"))return"trap";if(type.includes("ritual"))return"ritual";if(type.includes("fusion"))return"fusion";if(type.includes("synchro"))return"synchro";if(type.includes("xyz"))return"xyz";if(type.includes("link"))return"link";if(type.includes("normal"))return"normal";return"effect";
}
function typeText(card){return[card.attribute,card.cardType,card.monsterType||card.spellTrapType,...(card.abilities||[])].filter(Boolean).join(" · ")||"Card details unavailable";}
function statusText(card){const status=STATUS[card.status];return status?`${status.label} · ${status.copies}`:"Legal status unavailable";}
function cardImage(card,className){return card.imageUrl?`<img class="${className}" src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)} card artwork" loading="lazy" referrerpolicy="no-referrer" />`:'<div class="draft-card-placeholder">YF</div>';}
function cardById(id){return state.cards.find(card=>String(card.id)===String(id));}

function packCard(card,index){
  const selected=state.mode==="draft"&&state.selectedIds.has(String(card.id));
  const choosing=state.mode==="draft"&&state.pendingPack;
  const action=choosing?"Select card to keep":"View card details";
  return `<div class="draft-card-slot${selected?" is-selected":""}" data-pack-slot-id="${escapeHtml(card.id)}" style="--reveal-delay:${index*110}ms">
    <button class="draft-card" type="button" data-pack-card-id="${escapeHtml(card.id)}" data-frame="${frameCategory(card)}" aria-label="${action}: ${escapeHtml(card.name)}"${choosing?` aria-pressed="${selected}"`:""}>
      <span class="draft-card__back"><span>YF</span><small>Draft Night</small></span>
      <span class="draft-card__front"><span class="draft-card__image">${cardImage(card,"draft-card__art")}</span><span class="draft-card__copy"><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(statusText(card))}</small><small>${escapeHtml(card.cardType||"Unknown card type")}</small></span><span class="draft-card__selected-mark" aria-hidden="true">✓ Keep</span></span>
    </button>
    <button class="draft-card-details" type="button" data-card-details="${escapeHtml(card.id)}" aria-label="View details for ${escapeHtml(card.name)}">Details</button>
  </div>`;
}

function installImageFallbacks(root){
  root.querySelectorAll("img").forEach(image=>image.addEventListener("error",()=>{const fallback=document.createElement("span");fallback.className="draft-card-placeholder";fallback.textContent="YF";image.replaceWith(fallback);},{once:true}));
}
function bindPackCards(){
  elements.stage.querySelectorAll("[data-pack-card-id]").forEach(button=>button.addEventListener("click",()=>{const card=cardById(button.dataset.packCardId);if(state.mode==="draft"&&state.pendingPack)toggleDraftPick(card);else showCard(card);}));
  elements.stage.querySelectorAll("[data-card-details]").forEach(button=>button.addEventListener("click",()=>showCard(cardById(button.dataset.cardDetails))));
  installImageFallbacks(elements.stage);
}
function bindCollectionCards(){
  elements.picks.querySelectorAll("[data-card-id]").forEach(button=>button.addEventListener("click",()=>showCard(cardById(button.dataset.cardId))));
  installImageFallbacks(elements.picks);
}

function saveCollections(){
  localStorage.setItem(RIP_KEY,JSON.stringify(state.ripPacks.map(pack=>pack.map(card=>card.id))));
  localStorage.setItem(DRAFT_KEY,JSON.stringify(state.draftRounds.map(round=>round.map(card=>card.id))));
  if(state.pendingPack)localStorage.setItem(DRAFT_PENDING_KEY,JSON.stringify({pack:state.pendingPack.map(card=>card.id),selected:[...state.selectedIds]}));
  else localStorage.removeItem(DRAFT_PENDING_KEY);
  localStorage.setItem(MODE_KEY,state.mode);
}
function restoreCardGroups(key){
  try{const saved=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(saved))return[];return saved.map(group=>Array.isArray(group)?group.map(cardById).filter(Boolean):[]).filter(group=>group.length);}catch{return[];}
}
function restoreCollections(){
  state.ripPacks=restoreCardGroups(RIP_KEY);state.draftRounds=restoreCardGroups(DRAFT_KEY);state.mode=localStorage.getItem(MODE_KEY)==="draft"?"draft":"rips";
  try{
    const pending=JSON.parse(localStorage.getItem(DRAFT_PENDING_KEY)||"null");
    if(Array.isArray(pending?.pack)&&pending.pack.length===5){
      const restored=pending.pack.map(cardById).filter(Boolean);
      if(restored.length===5){state.pendingPack=restored;state.selectedIds=new Set((Array.isArray(pending.selected)?pending.selected:[]).map(String).filter(id=>restored.some(card=>String(card.id)===id)).slice(0,2));}
    }
  }catch{state.pendingPack=null;state.selectedIds.clear();}
}

function renderCollection(){
  const pulls=collectionCards();
  const rounds=state.mode==="draft"?state.draftRounds.length:state.ripPacks.length;
  elements.packCount.textContent=state.mode==="draft"?`${rounds} ${rounds===1?"round":"rounds"} completed`:`${rounds} ${rounds===1?"pack":"packs"} opened`;
  elements.pullTotal.textContent=`${pulls.length} ${pulls.length===1?"card":"cards"}`;
  if(!pulls.length){elements.picks.innerHTML=`<p class="draft-picks-empty">${state.mode==="draft"?"The two cards you keep each round will be collected here.":"Cards from every pack you open will be collected here."}</p>`;return;}
  const counts=new Map();
  pulls.forEach(card=>counts.set(String(card.id),{card,count:(counts.get(String(card.id))?.count||0)+1}));
  elements.picks.innerHTML=[...counts.values()].sort((a,b)=>a.card.name.localeCompare(b.card.name)).map(({card,count})=>`<button class="draft-pick" type="button" data-card-id="${escapeHtml(card.id)}" data-frame="${frameCategory(card)}">${cardImage(card,"draft-pick__art")}<span><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(card.cardType||"Unknown card type")}</small></span><b aria-label="${count} copies">×${count}</b></button>`).join("");
  bindCollectionCards();
}

function emptyStage(){
  const draftMode=state.mode==="draft";
  elements.stage.classList.remove("is-open","is-ripping","is-choosing","is-confirmed");
  elements.stage.innerHTML=`<div class="pack-empty"><img src="assets/draft-pack.jpg?v=2" alt="YugiFaux Draft Night booster pack" /><h2>${draftMode?"Your next draft round is waiting":"Your next pack is waiting"}</h2><p>${draftMode?"Open five cards, then select exactly two to keep.":"Select “Rip a pack” to reveal five cards."}</p></div>`;
  installImageFallbacks(elements.stage);
}
function renderPendingPack(animate=false){
  if(!state.pendingPack)return emptyStage();
  elements.stage.classList.remove("is-open","is-ripping","is-confirmed");
  elements.stage.classList.add("is-choosing");
  elements.stage.innerHTML=state.pendingPack.map(packCard).join("");bindPackCards();
  if(animate){void elements.stage.offsetWidth;requestAnimationFrame(()=>elements.stage.classList.add("is-open"));}else elements.stage.classList.add("is-open");
  updateDraftSelection();
}
function updateButtons(){
  const choosing=state.mode==="draft"&&Boolean(state.pendingPack);
  elements.open.hidden=choosing;elements.confirm.hidden=!choosing;
  if(state.busy)elements.confirm.hidden=true;
  elements.open.disabled=!state.ready||state.busy||choosing;
  elements.confirm.disabled=state.busy||state.selectedIds.size!==2;
  elements.modes.forEach(button=>{button.disabled=state.busy;});
}

function applyMode(){
  const draftMode=state.mode==="draft";
  elements.modes.forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.draftMode===state.mode)));
  elements.stationKicker.textContent=draftMode?"Draft table":"Pack station";
  elements.stationTitle.textContent=draftMode?"Open five. Keep two.":"Five cards. One rip.";
  elements.stationDescription.textContent=draftMode?"Reveal five different cards, including banned cards, then select exactly two and confirm them before opening the next round.":"Banned cards are included; voting-pending cards are excluded. Every card in a single pack is different.";
  elements.collectionKicker.textContent=draftMode?"Your selections":"Your pulls";
  elements.collectionTitle.textContent=draftMode?"Kept-card pool":"Draft pool";
  elements.open.textContent=draftMode?"Open draft round":"Rip a pack";
  elements.reset.textContent=draftMode?"Reset picks":"Reset pulls";
  elements.message.textContent=draftMode?(state.pendingPack?`Choose exactly two cards to keep — ${state.selectedIds.size}/2 selected.`:"Pick Two Draft mode: each five-card round adds only your two confirmed choices."):"Pack Rips mode: all five revealed cards are added to your pool.";
  if(draftMode&&state.pendingPack)renderPendingPack();
  else if(!draftMode&&state.ripPacks.length){elements.stage.classList.remove("is-ripping","is-choosing","is-confirmed");elements.stage.innerHTML=state.ripPacks.at(-1).map(packCard).join("");elements.stage.classList.add("is-open");bindPackCards();}
  else emptyStage();
  renderCollection();updateButtons();saveCollections();
}
function selectMode(mode){if(state.busy||!["rips","draft"].includes(mode)||mode===state.mode)return;state.mode=mode;applyMode();}

function showRipAnimation(roundNumber){
  elements.stage.classList.remove("is-open","is-ripping","is-choosing","is-confirmed");
  elements.stage.innerHTML=`<div class="pack-rip" aria-label="Opening YugiFaux Draft Night booster pack"><div class="pack-rip__glow"></div><img class="pack-rip__whole" src="assets/draft-pack.jpg?v=2" alt="" /><div class="pack-rip__half pack-rip__half--top"><img src="assets/draft-pack.jpg?v=2" alt="" /></div><div class="pack-rip__half pack-rip__half--bottom"><img src="assets/draft-pack.jpg?v=2" alt="" /></div><span class="pack-rip__tear" aria-hidden="true"></span></div>`;
  void elements.stage.offsetWidth;elements.stage.classList.add("is-ripping");
  elements.message.textContent=state.mode==="draft"?`Opening draft round ${roundNumber}…`:`Ripping pack ${roundNumber}…`;
}
function openPack(){
  if(!state.ready||state.busy||state.cards.length<5||(state.mode==="draft"&&state.pendingPack))return;
  state.busy=true;
  const openingMode=state.mode;
  const pack=draftPack(state.cards);
  const roundNumber=openingMode==="draft"?state.draftRounds.length+1:state.ripPacks.length+1;
  if(openingMode==="rips"){state.ripPacks.push(pack);saveCollections();renderCollection();}else{state.pendingPack=pack;state.selectedIds.clear();saveCollections();}
  updateButtons();showRipAnimation(roundNumber);
  window.setTimeout(()=>{
    elements.stage.classList.remove("is-ripping");elements.stage.classList.toggle("is-choosing",openingMode==="draft");elements.stage.innerHTML=pack.map(packCard).join("");bindPackCards();void elements.stage.offsetWidth;requestAnimationFrame(()=>elements.stage.classList.add("is-open"));
    elements.message.textContent=openingMode==="draft"?"Five cards revealed — select exactly two to keep. Use Details to read a card without selecting it.":`Pack ${roundNumber} opened — five cards added to your pool.`;
  },1050);
  window.setTimeout(()=>{state.busy=false;updateButtons();(openingMode==="draft"?elements.stage.querySelector("[data-pack-card-id]"):elements.open)?.focus();},1950);
}

function toggleDraftPick(card){
  if(!card||!state.pendingPack||state.busy)return;
  const id=String(card.id);
  if(state.selectedIds.has(id))state.selectedIds.delete(id);
  else if(state.selectedIds.size<2)state.selectedIds.add(id);
  else{elements.message.textContent="You can keep exactly two cards. Deselect one before choosing another.";return;}
  saveCollections();
  updateDraftSelection();
}
function updateDraftSelection(){
  elements.stage.querySelectorAll("[data-pack-slot-id]").forEach(slot=>{const selected=state.selectedIds.has(String(slot.dataset.packSlotId));slot.classList.toggle("is-selected",selected);slot.querySelector("[data-pack-card-id]")?.setAttribute("aria-pressed",String(selected));});
  const count=state.selectedIds.size;
  elements.message.textContent=count===2?"Two cards selected. Confirm them to add both to your kept-card pool.":`Choose exactly two cards to keep — ${count}/2 selected.`;
  updateButtons();
}
function confirmDraftPicks(){
  if(!state.pendingPack||state.selectedIds.size!==2||state.busy)return;
  const kept=state.pendingPack.filter(card=>state.selectedIds.has(String(card.id)));
  state.draftRounds.push(kept);state.pendingPack=null;state.selectedIds.clear();saveCollections();renderCollection();
  elements.stage.classList.remove("is-choosing");elements.stage.innerHTML=kept.map(packCard).join("");elements.stage.classList.add("is-open","is-confirmed");bindPackCards();
  elements.message.textContent=`Round ${state.draftRounds.length} complete — ${kept.map(card=>card.name).join(" and ")} joined your pool.`;updateButtons();elements.open.focus();
}
function resetDraft(){
  const hasProgress=state.mode==="draft"?state.draftRounds.length||state.pendingPack:state.ripPacks.length;
  const label=state.mode==="draft"?"every kept card and the current unconfirmed round":"every pack opened";
  if(hasProgress&&!window.confirm(`Clear ${label} in this browser?`))return;
  if(state.mode==="draft"){state.draftRounds=[];state.pendingPack=null;state.selectedIds.clear();localStorage.removeItem(DRAFT_KEY);localStorage.removeItem(DRAFT_PENDING_KEY);}else{state.ripPacks=[];localStorage.removeItem(RIP_KEY);}
  emptyStage();elements.message.textContent=state.mode==="draft"?"Draft picks reset. Your next round is ready.":"Pack pulls reset. Your next pack is ready.";renderCollection();updateButtons();
}

function detailRows(card){const rows=[["Card type",card.cardType],["Monster type",card.monsterType],["Spell/Trap type",card.spellTrapType],["Attribute",card.attribute],["Level / Rank / Link",card.levelRankLink],["ATK",card.atk],["DEF",card.def],["Pendulum Scale",card.pendulumScale],["Link Markers",card.linkMarkers?.join(", ")],["Effect clauses",card.clauses]].filter(([,value])=>value!==undefined&&value!==null&&value!=="");return rows.map(([label,value])=>`<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");}
function showCard(card){
  if(!card)return;
  elements.dialogContent.innerHTML=`<article class="dialog-card" data-status="${escapeHtml(card.status)}"><div>${cardImage(card,"dialog-card__art")}</div><div><span class="dialog-card__status">${escapeHtml(statusText(card))}</span><h2>${escapeHtml(card.name)}</h2><p class="dialog-card__line">${escapeHtml(typeText(card))}</p><dl class="detail-grid">${detailRows(card)}</dl>${card.pendulumEffect?`<section class="card-text-section"><h3>Pendulum Effect</h3><div class="dialog-card__text">${escapeHtml(card.pendulumEffect)}</div></section>`:""}<section class="card-text-section"><h3>Effect / Card Text</h3><div class="dialog-card__text">${escapeHtml(card.text||"No card text is currently available.")}</div></section></div></article>`;
  installImageFallbacks(elements.dialogContent);elements.dialog.showModal();
}

async function loadDraftPool(){
  try{const response=await fetch(`data/banlist.json?v=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();state.cards=(Array.isArray(payload.cards)?payload.cards:[]).filter(card=>STATUS[card.status]);if(state.cards.length<5)throw new Error("The available draft pool contains fewer than five cards.");restoreCollections();state.ready=true;elements.poolStatus.textContent=`${state.cards.length} cards available in the draft pool`;applyMode();}
  catch(error){console.error("Could not load Draft Night",error);elements.error.hidden=false;elements.poolStatus.textContent="Draft pool unavailable";elements.stage.hidden=true;}
}

elements.modes.forEach(button=>button.addEventListener("click",()=>selectMode(button.dataset.draftMode)));
elements.open.addEventListener("click",openPack);elements.confirm.addEventListener("click",confirmDraftPicks);elements.reset.addEventListener("click",resetDraft);
elements.dialog.querySelector(".dialog-close").addEventListener("click",()=>elements.dialog.close());elements.dialog.addEventListener("click",event=>{if(event.target===elements.dialog)elements.dialog.close();});
loadDraftPool();

