const STATUS={banned:{label:"Banned",copies:0},limeade:{label:"Limeade",copies:1},"semi-limeade":{label:"Semi-Limeade",copies:2},unlimeade:{label:"Un-Limeade",copies:3}};
const RIP_KEY="yugifaux-draft-night-collection-v1";
const DRAFT_KEY="yugifaux-pick-two-draft-v1";
const DRAFT_PENDING_KEY="yugifaux-pick-two-pending-v1";
const MODE_KEY="yugifaux-draft-night-mode-v1";
const ZONE_KEYS={rips:"yugifaux-draft-zones-rips-v1",draft:"yugifaux-draft-zones-pick-two-v1"};
const ZONE_LIMITS={main:60,side:15,extra:15};
const state={cards:[],mode:"rips",ripPacks:[],draftRounds:[],pendingPack:null,selectedIds:new Set(),zoneAssignments:{rips:{},draft:{}},draggedInstanceId:null,busy:false,ready:false};
const elements={
  modes:[...document.querySelectorAll("[data-draft-mode]")],open:document.querySelector("#open-pack"),confirm:document.querySelector("#confirm-picks"),export:document.querySelector("#export-draft"),reset:document.querySelector("#reset-draft"),stage:document.querySelector("#pack-stage"),picks:document.querySelector("#draft-picks"),poolStatus:document.querySelector("#draft-pool-status"),packCount:document.querySelector("#pack-count"),pullTotal:document.querySelector("#pull-total"),message:document.querySelector("#draft-message"),error:document.querySelector("#draft-error"),dialog:document.querySelector("#draft-card-dialog"),dialogContent:document.querySelector("#draft-dialog-content"),stationKicker:document.querySelector("#station-kicker"),stationTitle:document.querySelector("#pack-station-title"),stationDescription:document.querySelector("#pack-station-description"),collectionKicker:document.querySelector("#collection-kicker"),collectionTitle:document.querySelector("#collection-title"),mainCount:document.querySelector("#main-count"),sideCount:document.querySelector("#side-count"),extraCount:document.querySelector("#extra-count"),mainProgress:document.querySelector("#main-progress"),sideProgress:document.querySelector("#side-progress"),extraProgress:document.querySelector("#extra-progress"),
};

const escapeHtml=(value="")=>String(value).replace(/[&<>'"]/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[character]);

function randomFraction(){const value=new Uint32Array(1);crypto.getRandomValues(value);return value[0]/0x100000000;}
function archetypeKey(card){return String(card.archetype||"").trim().toLocaleLowerCase();}
function collectionCards(){return(state.mode==="draft"?state.draftRounds:state.ripPacks).flat();}
function collectionInstances(){
  const groups=state.mode==="draft"?state.draftRounds:state.ripPacks;
  return groups.flatMap((group,groupIndex)=>group.map((card,cardIndex)=>({key:`${state.mode}-${groupIndex}-${cardIndex}`,card})));
}

function isExtraDeckCard(card){return/(fusion|synchro|xyz|link) monster/i.test(String(card.cardType||""));}
function isExportable(card){
  if(!Number.isSafeInteger(Number(card.duelingbookId))||Number(card.duelingbookId)<1)return false;
  return card.source!=="official"||Boolean(String(card.passcode||"").replace(/\D/g,""));
}
function assignZones(cards){
  const zones={main:[],side:[],extra:[]};
  let extraCards=0;
  cards.forEach(card=>{
    if(!isExportable(card))return;
    if(isExtraDeckCard(card)){
      if(extraCards>=20)return;
      if(zones.extra.length<ZONE_LIMITS.extra){zones.extra.push(card);extraCards+=1;}
      else if(zones.side.length<ZONE_LIMITS.side){zones.side.push(card);extraCards+=1;}
    }else if(zones.main.length<ZONE_LIMITS.main)zones.main.push(card);
    else if(zones.side.length<ZONE_LIMITS.side)zones.side.push(card);
  });
  return zones;
}
function zoneSize(zones){return zones.main.length+zones.side.length+zones.extra.length;}
function canAddCard(card,cards){return isExportable(card)&&zoneSize(assignZones([...cards,card]))===zoneSize(assignZones(cards))+1;}
function allowedZones(card){return isExtraDeckCard(card)?["extra","side"]:["main","side"];}
function nextZone(card,zones){
  if(isExtraDeckCard(card)){
    const extraTotal=zones.extra.length+zones.side.filter(item=>isExtraDeckCard(item.card||item)).length;
    if(extraTotal>=20)return null;
    if(zones.extra.length<ZONE_LIMITS.extra)return"extra";
    if(zones.side.length<ZONE_LIMITS.side)return"side";
    return null;
  }
  if(zones.main.length<ZONE_LIMITS.main)return"main";
  if(zones.side.length<ZONE_LIMITS.side)return"side";
  return null;
}
function activeZoneInstances(){
  const zones={main:[],side:[],extra:[]};
  const saved=state.zoneAssignments[state.mode];
  collectionInstances().forEach(instance=>{
    const preferred=saved[instance.key];
    const zone=preferred&&allowedZones(instance.card).includes(preferred)&&zones[preferred].length<ZONE_LIMITS[preferred]?preferred:nextZone(instance.card,zones);
    if(zone){zones[zone].push(instance);saved[instance.key]=zone;}
  });
  return zones;
}
function activeZones(){const instances=activeZoneInstances();return{main:instances.main.map(item=>item.card),side:instances.side.map(item=>item.card),extra:instances.extra.map(item=>item.card)};}
function canCollectCard(card,additional=[]){
  const zones=activeZoneInstances();
  for(const extraCard of [...additional,card]){
    const zone=nextZone(extraCard,zones);
    if(!zone)return false;
    zones[zone].push({key:"pending",card:extraCard});
  }
  return true;
}
function deckComplete(zones=activeZones()){return zones.main.length===ZONE_LIMITS.main&&zones.side.length===ZONE_LIMITS.side&&zones.extra.length===ZONE_LIMITS.extra;}

function draftPack(cards){
  const priorArchetypes=new Map();
  const collected=collectionCards();
  collected.forEach(card=>{const key=archetypeKey(card);if(key)priorArchetypes.set(key,(priorArchetypes.get(key)||0)+1);});
  const available=[...cards];
  const pack=[];
  while(pack.length<5&&available.length){
    const eligible=available.map((card,index)=>({card,index})).filter(({card})=>state.mode==="rips"?canCollectCard(card,pack):canCollectCard(card));
    if(!eligible.length)break;
    const weights=eligible.map(({card})=>1+Math.min(.35,(priorArchetypes.get(archetypeKey(card))||0)*.12));
    const totalWeight=weights.reduce((sum,weight)=>sum+weight,0);
    let roll=randomFraction()*totalWeight;
    let selectedIndex=weights.length-1;
    for(let index=0;index<weights.length;index+=1){roll-=weights[index];if(roll<0){selectedIndex=index;break;}}
    const availableIndex=eligible[selectedIndex].index;
    const selected=available.splice(availableIndex,1)[0];
    pack.push(selected);
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
  elements.picks.querySelectorAll("[data-card-id]").forEach(button=>{
    button.addEventListener("click",()=>showCard(cardById(button.dataset.cardId)));
    button.addEventListener("dragstart",event=>{
      state.draggedInstanceId=button.dataset.instanceId;
      button.classList.add("is-dragging");
      event.dataTransfer.effectAllowed="move";
      event.dataTransfer.setData("text/plain",state.draggedInstanceId);
    });
    button.addEventListener("dragend",()=>{state.draggedInstanceId=null;button.classList.remove("is-dragging");clearDropTargets();});
    button.addEventListener("dragover",event=>{event.preventDefault();event.stopPropagation();button.classList.add("is-drop-target");event.dataTransfer.dropEffect="move";});
    button.addEventListener("dragleave",()=>button.classList.remove("is-drop-target"));
    button.addEventListener("drop",event=>{event.preventDefault();event.stopPropagation();moveOrSwap(event.dataTransfer.getData("text/plain")||state.draggedInstanceId,button.dataset.cardZone,button.dataset.instanceId);});
  });
  elements.picks.querySelectorAll("[data-deck-zone]").forEach(zone=>{
    zone.addEventListener("dragover",event=>{event.preventDefault();zone.classList.add("is-drop-target");event.dataTransfer.dropEffect="move";});
    zone.addEventListener("dragleave",event=>{if(!zone.contains(event.relatedTarget))zone.classList.remove("is-drop-target");});
    zone.addEventListener("drop",event=>{event.preventDefault();moveOrSwap(event.dataTransfer.getData("text/plain")||state.draggedInstanceId,zone.dataset.deckZone);});
  });
  installImageFallbacks(elements.picks);
}

function clearDropTargets(){elements.picks.querySelectorAll(".is-drop-target").forEach(element=>element.classList.remove("is-drop-target"));}
function locateInstance(instanceId,zones=activeZoneInstances()){
  for(const zone of ["main","side","extra"]){const instance=zones[zone].find(item=>item.key===instanceId);if(instance)return{zone,instance};}
  return null;
}
function moveOrSwap(instanceId,targetZone,targetInstanceId){
  clearDropTargets();
  const zones=activeZoneInstances();
  const source=locateInstance(instanceId,zones);
  if(!source||!ZONE_LIMITS[targetZone]||source.zone===targetZone)return;
  if(!allowedZones(source.instance.card).includes(targetZone)){
    elements.message.textContent=isExtraDeckCard(source.instance.card)?"Extra Deck monsters may move only between the Extra and Side Decks.":"Main Deck cards may move only between the Main and Side Decks.";
    return;
  }
  const assignments=state.zoneAssignments[state.mode];
  if(zones[targetZone].length<ZONE_LIMITS[targetZone])assignments[instanceId]=targetZone;
  else{
    const target=locateInstance(targetInstanceId,zones);
    if(!target||target.zone!==targetZone){elements.message.textContent=`${targetZone[0].toUpperCase()+targetZone.slice(1)} Deck is full. Drop onto a compatible card to swap them.`;return;}
    if(!allowedZones(target.instance.card).includes(source.zone)){elements.message.textContent="Those two cards cannot swap because one would enter an invalid deck zone.";return;}
    assignments[instanceId]=targetZone;assignments[targetInstanceId]=source.zone;
  }
  saveCollections();renderCollection();updateButtons();
  elements.message.textContent="Deck zones updated. Your custom layout is saved in this browser.";
}

function saveCollections(){
  localStorage.setItem(RIP_KEY,JSON.stringify(state.ripPacks.map(pack=>pack.map(card=>card.id))));
  localStorage.setItem(DRAFT_KEY,JSON.stringify(state.draftRounds.map(round=>round.map(card=>card.id))));
  if(state.pendingPack)localStorage.setItem(DRAFT_PENDING_KEY,JSON.stringify({pack:state.pendingPack.map(card=>card.id),selected:[...state.selectedIds]}));
  else localStorage.removeItem(DRAFT_PENDING_KEY);
  localStorage.setItem(MODE_KEY,state.mode);
  localStorage.setItem(ZONE_KEYS.rips,JSON.stringify(state.zoneAssignments.rips));
  localStorage.setItem(ZONE_KEYS.draft,JSON.stringify(state.zoneAssignments.draft));
}
function restoreCardGroups(key){
  try{const saved=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(saved))return[];return saved.map(group=>Array.isArray(group)?group.map(cardById).filter(Boolean):[]).filter(group=>group.length);}catch{return[];}
}
function restoreCollections(){
  state.ripPacks=restoreCardGroups(RIP_KEY);state.draftRounds=restoreCardGroups(DRAFT_KEY);state.mode=localStorage.getItem(MODE_KEY)==="draft"?"draft":"rips";
  for(const mode of ["rips","draft"]){try{const saved=JSON.parse(localStorage.getItem(ZONE_KEYS[mode])||"{}");state.zoneAssignments[mode]=saved&&typeof saved==="object"&&!Array.isArray(saved)?saved:{};}catch{state.zoneAssignments[mode]={};}}
  try{
    const pending=JSON.parse(localStorage.getItem(DRAFT_PENDING_KEY)||"null");
    if(Array.isArray(pending?.pack)&&pending.pack.length===5){
      const restored=pending.pack.map(cardById).filter(Boolean);
      if(restored.length===5){state.pendingPack=restored;state.selectedIds=new Set((Array.isArray(pending.selected)?pending.selected:[]).map(String).filter(id=>restored.some(card=>String(card.id)===id)).slice(0,2));}
    }
  }catch{state.pendingPack=null;state.selectedIds.clear();}
}

function renderZone(key,label,instances){
  const cards=instances.map(({card,key:instanceId})=>`<button class="draft-pick" type="button" draggable="true" data-instance-id="${escapeHtml(instanceId)}" data-card-id="${escapeHtml(card.id)}" data-card-zone="${key}" data-frame="${frameCategory(card)}" aria-label="${escapeHtml(card.name)} — drag to move or click for details" title="${escapeHtml(card.name)} · ${escapeHtml(card.cardType||"Unknown card type")}">${cardImage(card,"draft-pick__art")}<span class="draft-pick__name">${escapeHtml(card.name)}</span></button>`).join("");
  const emptySlots=Array.from({length:Math.max(0,ZONE_LIMITS[key]-instances.length)},()=>'<span class="draft-slot" aria-hidden="true"></span>').join("");
  return `<section class="draft-zone draft-zone--${key}" data-deck-zone="${key}"><div class="draft-zone__heading"><h3>${label}</h3><span>${instances.length}<small>/${ZONE_LIMITS[key]}</small></span></div><div class="draft-zone__cards">${cards}${emptySlots}</div></section>`;
}
function renderDeckProgress(zones){
  for(const key of ["main","side","extra"]){
    const count=zones[key].length;
    elements[`${key}Count`].textContent=`${count} / ${ZONE_LIMITS[key]}`;
    elements[`${key}Progress`].style.width=`${count/ZONE_LIMITS[key]*100}%`;
    document.querySelector(`[data-zone-progress="${key}"]`)?.classList.toggle("is-complete",count===ZONE_LIMITS[key]);
  }
}
function renderCollection(){
  const pulls=collectionCards();
  const zones=activeZoneInstances();
  const rounds=state.mode==="draft"?state.draftRounds.length:state.ripPacks.length;
  elements.packCount.textContent=state.mode==="draft"?`${rounds} ${rounds===1?"round":"rounds"} completed`:`${rounds} ${rounds===1?"pack":"packs"} opened`;
  elements.pullTotal.textContent=`${zoneSize(zones)} / 90 cards`;
  elements.picks.innerHTML=renderZone("main","Main Deck",zones.main)+renderZone("side","Side Deck",zones.side)+renderZone("extra","Extra Deck",zones.extra);
  renderDeckProgress(zones);
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
  elements.export.disabled=!deckComplete();
  elements.modes.forEach(button=>{button.disabled=state.busy;});
}

function applyMode(){
  const draftMode=state.mode==="draft";
  elements.modes.forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.draftMode===state.mode)));
  elements.stationKicker.textContent=draftMode?"Draft table":"Pack station";
  elements.stationTitle.textContent=draftMode?"Open five. Keep two.":"Five cards. One rip.";
  elements.stationDescription.textContent=draftMode?"Reveal five different cards, including banned cards, then select exactly two and confirm them before opening the next round.":"Banned cards are included; voting-pending cards are excluded. Every card in a single pack is different.";
  elements.collectionKicker.textContent=draftMode?"Your selections":"Your pulls";
  elements.collectionTitle.textContent=draftMode?"Kept draft deck":"Draft deck";
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
  if(deckComplete()){elements.message.textContent="Your 60-card Main Deck, 15-card Side Deck, and 15-card Extra Deck are complete. Export the XML when ready.";updateButtons();return;}
  const openingMode=state.mode;
  const pack=draftPack(state.cards);
  if(pack.length<5){elements.message.textContent="A complete five-card pack cannot be built from the remaining eligible card types. Your current draft is still saved.";updateButtons();return;}
  state.busy=true;
  const roundNumber=openingMode==="draft"?state.draftRounds.length+1:state.ripPacks.length+1;
  if(openingMode==="rips"){state.ripPacks.push(pack);saveCollections();renderCollection();}else{state.pendingPack=pack;state.selectedIds.clear();saveCollections();}
  updateButtons();showRipAnimation(roundNumber);
  window.setTimeout(()=>{
    elements.stage.classList.remove("is-ripping");elements.stage.classList.toggle("is-choosing",openingMode==="draft");elements.stage.innerHTML=pack.map(packCard).join("");bindPackCards();void elements.stage.offsetWidth;requestAnimationFrame(()=>elements.stage.classList.add("is-open"));
    elements.message.textContent=openingMode==="draft"?"Five cards revealed — select exactly two to keep. Use Details to read a card without selecting it.":deckComplete()?"Draft complete — all 90 deck slots are filled. Your DuelingBook XML is ready to export.":`Pack ${roundNumber} opened — five cards added to your deck.`;
  },1050);
  window.setTimeout(()=>{state.busy=false;updateButtons();(openingMode==="draft"?elements.stage.querySelector("[data-pack-card-id]"):elements.open)?.focus();},1950);
}

function toggleDraftPick(card){
  if(!card||!state.pendingPack||state.busy)return;
  const id=String(card.id);
  if(state.selectedIds.has(id))state.selectedIds.delete(id);
  else if(state.selectedIds.size<2){
    const alreadySelected=state.pendingPack.filter(item=>state.selectedIds.has(String(item.id)));
    if(!canCollectCard(card,alreadySelected)){elements.message.textContent="That card type no longer has an open Main, Side, or Extra Deck slot.";return;}
    state.selectedIds.add(id);
  }
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
  const complete=deckComplete();
  elements.message.textContent=complete?"Draft complete — all 90 deck slots are filled. Your DuelingBook XML is ready to export.":`Round ${state.draftRounds.length} complete — ${kept.map(card=>card.name).join(" and ")} joined your deck.`;updateButtons();elements.open.focus();
}
function resetDraft(){
  const hasProgress=state.mode==="draft"?state.draftRounds.length||state.pendingPack:state.ripPacks.length;
  const label=state.mode==="draft"?"every kept card and the current unconfirmed round":"every pack opened";
  if(hasProgress&&!window.confirm(`Clear ${label} in this browser?`))return;
  if(state.mode==="draft"){state.draftRounds=[];state.pendingPack=null;state.selectedIds.clear();state.zoneAssignments.draft={};localStorage.removeItem(DRAFT_KEY);localStorage.removeItem(DRAFT_PENDING_KEY);localStorage.removeItem(ZONE_KEYS.draft);}else{state.ripPacks=[];state.zoneAssignments.rips={};localStorage.removeItem(RIP_KEY);localStorage.removeItem(ZONE_KEYS.rips);}
  emptyStage();elements.message.textContent=state.mode==="draft"?"Draft picks reset. Your next round is ready.":"Pack pulls reset. Your next pack is ready.";renderCollection();updateButtons();
}

function xmlEscape(value=""){return String(value).replace(/[&<>'"]/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);}
function localDateStamp(){const today=new Date();return`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;}
function xmlCard(card){
  const digits=String(card.passcode||"").replace(/\D/g,"");
  const passcode=card.source==="official"&&digits?String(Number(digits)):"";
  return `  <card id="${xmlEscape(Number(card.duelingbookId))}" passcode="${xmlEscape(passcode)}">${xmlEscape(card.name)}</card>`;
}
function exportDraftXml(){
  const zones=activeZones();
  if(!deckComplete(zones)){elements.message.textContent="Fill all 60 Main, 15 Side, and 15 Extra Deck slots before exporting.";return;}
  const date=localDateStamp();
  const deckName=`Draft Night ${date}`;
  const section=(name,cards)=>` <${name}>\n${cards.map(xmlCard).join("\n")}\n </${name}>`;
  const xml=["<?xml version=\"1.0\" encoding=\"utf-8\" ?>",`<deck name="${xmlEscape(deckName)}">`,section("main",zones.main),section("side",zones.side),section("extra",zones.extra),"</deck>",""].join("\n");
  const url=URL.createObjectURL(new Blob([xml],{type:"application/xml;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download=`${deckName}.xml`;document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  elements.message.textContent=`Exported ${deckName}.xml with 60 Main, 15 Side, and 15 Extra Deck cards.`;
}

function detailRows(card){const rows=[["Card type",card.cardType],["Monster type",card.monsterType],["Spell/Trap type",card.spellTrapType],["Attribute",card.attribute],["Level / Rank / Link",card.levelRankLink],["ATK",card.atk],["DEF",card.def],["Pendulum Scale",card.pendulumScale],["Link Markers",card.linkMarkers?.join(", ")],["Effect clauses",card.clauses]].filter(([,value])=>value!==undefined&&value!==null&&value!=="");return rows.map(([label,value])=>`<div class="detail-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");}
function showCard(card){
  if(!card)return;
  elements.dialogContent.innerHTML=`<article class="dialog-card" data-status="${escapeHtml(card.status)}"><div>${cardImage(card,"dialog-card__art")}</div><div><span class="dialog-card__status">${escapeHtml(statusText(card))}</span><h2>${escapeHtml(card.name)}</h2><p class="dialog-card__line">${escapeHtml(typeText(card))}</p><dl class="detail-grid">${detailRows(card)}</dl>${card.pendulumEffect?`<section class="card-text-section"><h3>Pendulum Effect</h3><div class="dialog-card__text">${escapeHtml(card.pendulumEffect)}</div></section>`:""}<section class="card-text-section"><h3>Effect / Card Text</h3><div class="dialog-card__text">${escapeHtml(card.text||"No card text is currently available.")}</div></section></div></article>`;
  installImageFallbacks(elements.dialogContent);elements.dialog.showModal();
}

async function loadDraftPool(){
  try{const response=await fetch(`data/banlist.json?v=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();const eligible=(Array.isArray(payload.cards)?payload.cards:[]).filter(card=>STATUS[card.status]);state.cards=eligible.filter(isExportable);if(state.cards.length<5)throw new Error("The export-ready draft pool contains fewer than five cards.");restoreCollections();state.ready=true;const unavailable=eligible.length-state.cards.length;elements.poolStatus.textContent=`${state.cards.length} export-ready cards in the draft pool${unavailable?` · ${unavailable} awaiting IDs`:""}`;applyMode();}
  catch(error){console.error("Could not load Draft Night",error);elements.error.hidden=false;elements.poolStatus.textContent="Draft pool unavailable";elements.stage.hidden=true;}
}

elements.modes.forEach(button=>button.addEventListener("click",()=>selectMode(button.dataset.draftMode)));
elements.open.addEventListener("click",openPack);elements.confirm.addEventListener("click",confirmDraftPicks);elements.export.addEventListener("click",exportDraftXml);elements.reset.addEventListener("click",resetDraft);
elements.dialog.querySelector(".dialog-close").addEventListener("click",()=>elements.dialog.close());elements.dialog.addEventListener("click",event=>{if(event.target===elements.dialog)elements.dialog.close();});
loadDraftPool();

