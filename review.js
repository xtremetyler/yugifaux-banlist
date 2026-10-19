import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const STATUS = {
  banned:{label:"Banned",copies:0}, limeade:{label:"Limeade",copies:1},
  "semi-limeade":{label:"Semi-Limeade",copies:2}, unlimeade:{label:"Un-Limeade",copies:3},
};
const CONCERNS = {"too-powerful":"Too powerful","too-weak":"Too weak",unhealthy:"Unhealthy or frustrating","needs-discussion":"Needs discussion"};
const PAGE_SIZE = 60;
const config = window.YUGIFAUX_REVIEW_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const supabase = configured ? createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,detectSessionInUrl:true}}) : null;
const state = {cards:[],session:null,participant:null,participants:[],settings:null,nominations:[],reviewCards:[],ballots:[],query:"",status:"all",source:"all",view:"cards",visible:PAGE_SIZE};

const $ = selector => document.querySelector(selector);
const elements = {
  setup:$("#review-setup"),auth:$("#review-auth"),authTitle:$("#auth-title"),authCopy:$("#auth-copy"),profileLink:$("#my-profile-link"),signIn:$("#sign-in"),signOut:$("#sign-out"),
  participantStatus:$("#participant-status"),app:$("#review-app"),error:$("#review-error"),errorCopy:$("#review-error-copy"),
  nominationStatus:$("#nomination-status"),nominationDetail:$("#nomination-detail"),ballotStatus:$("#ballot-status"),ballotDetail:$("#ballot-detail"),
  myNominationCount:$("#my-nomination-count"),myBallotCount:$("#my-ballot-count"),ballotCardCount:$("#ballot-card-count"),
  search:$("#review-search"),status:$("#review-status-filter"),source:$("#review-source-filter"),grid:$("#review-card-grid"),resultCount:$("#review-result-count"),loadMore:$("#review-load-more"),
  ballotGrid:$("#ballot-grid"),ballotEmpty:$("#ballot-empty"),mine:$("#my-submissions"),adminTab:$("#admin-tab"),adminControls:$("#admin-controls"),adminParticipants:$("#admin-participants"),adminQueue:$("#admin-queue"),
  nominationDialog:$("#nomination-dialog"),nominationForm:$("#nomination-form"),nominationCard:$("#nomination-card"),nominationCardId:$("#nomination-card-id"),nominationConcern:$("#nomination-concern"),nominationSuggestion:$("#nomination-suggestion"),nominationExplanation:$("#nomination-explanation"),withdrawNomination:$("#withdraw-nomination"),
  ballotDialog:$("#ballot-dialog"),ballotForm:$("#ballot-form"),ballotCard:$("#ballot-card"),ballotCardId:$("#ballot-card-id"),ballotChoice:$("#ballot-choice"),ballotComment:$("#ballot-comment"),withdrawBallot:$("#withdraw-ballot"),toast:$("#review-toast"),
};

const escapeHtml = (value="") => String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[c]);
const myNominations = () => state.nominations.filter(item=>item.user_id===state.session?.user?.id);
const myBallots = () => state.ballots.filter(item=>item.user_id===state.session?.user?.id);
const cardById = id => state.cards.find(card=>String(card.id)===String(id));
const reviewCardIds = () => new Set(state.reviewCards.filter(item=>item.included).map(item=>String(item.card_id)));
const statusText = status => STATUS[status] ? `${STATUS[status].label} · ${STATUS[status].copies}` : "Status pending";

function toast(message) {
  elements.toast.textContent=message; elements.toast.hidden=false;
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>elements.toast.hidden=true,3600);
}
function showError(message) { elements.errorCopy.textContent=message; elements.error.hidden=false; }
function setBusy(button,busy,label="Saving…") { if (!button) return; if (busy) {button.dataset.label=button.textContent;button.textContent=label;} else button.textContent=button.dataset.label||button.textContent; button.disabled=busy; }

function cardImage(card) {
  return card?.imageUrl ? `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)} card artwork" loading="lazy" referrerpolicy="no-referrer">` : `<div class="review-card__placeholder">YF</div>`;
}
function bindImageFallbacks(root) {
  root.querySelectorAll("img").forEach(image=>image.addEventListener("error",()=>{const fallback=document.createElement("div");fallback.className="review-card__placeholder";fallback.textContent="YF";image.replaceWith(fallback);},{once:true}));
}
function cardSummary(card) {
  return `${cardImage(card)}<div><strong>${escapeHtml(card.name)}</strong><span>${escapeHtml(statusText(card.status))}${card.archetype?` · ${escapeHtml(card.archetype)}`:""}</span></div>`;
}
function cardMarkup(card,mode="nomination") {
  const nomination=myNominations().find(item=>String(item.card_id)===String(card.id));
  const ballot=myBallots().find(item=>String(item.card_id)===String(card.id));
  const adminCount=state.participant?.is_admin ? state.nominations.filter(item=>String(item.card_id)===String(card.id)).length : null;
  const disabled=mode==="nomination" ? !state.settings?.nomination_open : !state.settings?.ballot_open;
  const actionLabel=mode==="nomination" ? (nomination?"Edit nomination":"Nominate") : (ballot?"Edit vote":"Vote");
  const note=mode==="nomination" ? (nomination?"Your nomination is saved":adminCount?`${adminCount} nomination${adminCount===1?"":"s"}`:"Participant review") : (ballot?`Your vote: ${ballot.recommended_status==="abstain"?"Abstain":statusText(ballot.recommended_status)}`:"Official ballot card");
  return `<article class="review-card" data-status="${escapeHtml(card.status)}">
    <div class="review-card__image">${cardImage(card)}</div><div class="review-card__body">
      <div class="review-card__top"><span class="review-card__status">${escapeHtml(statusText(card.status))}</span><span class="review-card__status">#${escapeHtml(card.botCardId??card.id)}</span></div>
      <h3>${escapeHtml(card.name)}</h3><p class="review-card__meta">${escapeHtml([card.source==="official"?"Official":"Custom",card.archetype,card.cardType].filter(Boolean).join(" · "))}</p>
      <div class="review-card__actions"><small>${escapeHtml(note)}</small><button class="${mode==="nomination"?"review-secondary":"review-primary"}" type="button" data-${mode}-card="${escapeHtml(card.id)}" ${disabled?"disabled":""}>${escapeHtml(actionLabel)}</button></div>
    </div></article>`;
}

function visibleCards() {
  const terms=state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return state.cards.filter(card=>{
    if (state.status!=="all"&&card.status!==state.status) return false;
    const source=card.source==="official"?"official":"custom";
    if (state.source!=="all"&&source!==state.source) return false;
    const haystack=[card.name,card.archetype,card.text,card.cardType,card.contributor].filter(Boolean).join(" ").toLocaleLowerCase();
    return terms.every(term=>haystack.includes(term));
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderCards() {
  const cards=visibleCards(); const shown=cards.slice(0,state.visible);
  elements.resultCount.textContent=`${cards.length.toLocaleString()} matching card${cards.length===1?"":"s"}`;
  elements.grid.innerHTML=shown.map(card=>cardMarkup(card)).join("") || `<div class="review-empty"><h3>No matching cards</h3><p>Try another search or filter.</p></div>`;
  elements.loadMore.hidden=shown.length>=cards.length;
  elements.grid.querySelectorAll("[data-nomination-card]").forEach(button=>button.addEventListener("click",()=>openNomination(button.dataset.nominationCard)));
  bindImageFallbacks(elements.grid);
}
function renderBallot() {
  const ids=reviewCardIds(); const cards=state.cards.filter(card=>ids.has(String(card.id))).sort((a,b)=>a.name.localeCompare(b.name));
  elements.ballotCardCount.textContent=cards.length; elements.ballotEmpty.hidden=cards.length>0;
  elements.ballotGrid.innerHTML=cards.map(card=>cardMarkup(card,"ballot")).join("");
  elements.ballotGrid.querySelectorAll("[data-ballot-card]").forEach(button=>button.addEventListener("click",()=>openBallot(button.dataset.ballotCard)));
  bindImageFallbacks(elements.ballotGrid);
}
function renderMine() {
  const nominations=myNominations(),ballots=myBallots();
  const rows=(items,type)=>items.map(item=>{const card=cardById(item.card_id);const detail=type==="nomination"?`${CONCERNS[item.concern]} · suggests ${statusText(item.suggested_status)}`:`Recommends ${item.recommended_status==="abstain"?"Abstain":statusText(item.recommended_status)}`;return `<div class="submission-row"><div><strong>${escapeHtml(card?.name||`Card #${item.card_id}`)}</strong><span>${escapeHtml(detail)}</span></div><button class="review-secondary" type="button" data-${type}-card="${escapeHtml(item.card_id)}">Edit</button></div>`}).join("")||`<div class="review-empty"><p>No ${type==="nomination"?"nominations":"ballot votes"} submitted.</p></div>`;
  elements.mine.innerHTML=`<article class="submission-group"><h3>Nominations</h3><div class="submission-list">${rows(nominations,"nomination")}</div></article><article class="submission-group"><h3>Official ballot votes</h3><div class="submission-list">${rows(ballots,"ballot")}</div></article>`;
  elements.mine.querySelectorAll("[data-nomination-card]").forEach(button=>button.addEventListener("click",()=>openNomination(button.dataset.nominationCard)));
  elements.mine.querySelectorAll("[data-ballot-card]").forEach(button=>button.addEventListener("click",()=>openBallot(button.dataset.ballotCard)));
}
function aggregateNominations() {
  const map=new Map();
  for (const nomination of state.nominations) { const id=String(nomination.card_id);const entry=map.get(id)||{card:cardById(id),items:[],statuses:{}};entry.items.push(nomination);entry.statuses[nomination.suggested_status]=(entry.statuses[nomination.suggested_status]||0)+1;map.set(id,entry); }
  return [...map.values()].sort((a,b)=>b.items.length-a.items.length||(a.card?.name||"").localeCompare(b.card?.name||""));
}
function renderAdmin() {
  if (!state.participant?.is_admin) return;
  const controls=[["Nominations",state.settings.nomination_open,"nomination_open","Participants can nominate and edit cards."],["Official ballot",state.settings.ballot_open,"ballot_open","Participants can vote on included review cards."]];
  elements.adminControls.innerHTML=controls.map(([name,open,key,copy])=>`<article class="admin-control"><div><h3>${name}: ${open?"Open":"Closed"}</h3><p>${copy}</p></div><button class="${open?"review-danger":"review-primary"}" type="button" data-setting="${key}" data-value="${open?"false":"true"}">${open?"Close":"Open"}</button></article>`).join("");
  elements.adminControls.querySelectorAll("[data-setting]").forEach(button=>button.addEventListener("click",()=>updateSetting(button.dataset.setting,button.dataset.value==="true",button)));
  elements.adminParticipants.innerHTML=`<h3>Participant access</h3><p>Approve verified league members and pause voting access for inactive participants.</p><div class="participant-list">${state.participants.map(participant=>`<div class="participant-row"><div><strong>${escapeHtml(participant.display_name)}</strong><span>${participant.approved?(participant.active?"Approved · Active":"Approved · Inactive"):"Waiting for approval"}${participant.is_admin?" · League Admin":""}</span></div><div class="participant-row__actions"><button class="${participant.approved?"review-danger":"review-primary"}" type="button" data-participant="${participant.user_id}" data-field="approved" data-value="${!participant.approved}">${participant.approved?"Revoke":"Approve"}</button>${participant.approved?`<button class="review-secondary" type="button" data-participant="${participant.user_id}" data-field="active" data-value="${!participant.active}">Mark ${participant.active?"inactive":"active"}</button>`:""}</div></div>`).join("")}</div>`;
  elements.adminParticipants.querySelectorAll("[data-participant]").forEach(button=>button.addEventListener("click",()=>updateParticipant(button.dataset.participant,button.dataset.field,button.dataset.value==="true",button)));
  const official=reviewCardIds(); const aggregates=aggregateNominations();
  elements.adminQueue.innerHTML=aggregates.map(entry=>{const card=entry.card;const votes=state.ballots.filter(item=>String(item.card_id)===String(card?.id));const voteCounts=votes.reduce((counts,vote)=>(counts[vote.recommended_status]=(counts[vote.recommended_status]||0)+1,counts),{});const nominationCounts=Object.entries(entry.statuses).map(([status,count])=>`<span>Nominate ${escapeHtml(statusText(status))}: ${count}</span>`).join("");const ballotCounts=Object.entries(voteCounts).map(([status,count])=>`<span>Vote ${escapeHtml(status==="abstain"?"Abstain":statusText(status))}: ${count}</span>`).join("");const included=official.has(String(card?.id));const ready=entry.items.length>=state.settings.nomination_threshold;const notes=[...entry.items.map(item=>item.explanation),...votes.map(item=>item.comment)].filter(Boolean).join(" · ");return `<article class="admin-card"><div><h3>${escapeHtml(card?.name||"Unknown card")} · ${entry.items.length} nomination${entry.items.length===1?"":"s"} · ${votes.length} vote${votes.length===1?"":"s"}${ready?" · Review threshold met":""}</h3><p>${escapeHtml(notes||"No written explanations or ballot comments.")}</p><div class="admin-card__counts">${nominationCounts}${ballotCounts}</div></div><div class="admin-card__actions"><button class="${included?"review-danger":"review-primary"}" type="button" data-review-toggle="${escapeHtml(card?.id)}" data-included="${included}">${included?"Remove from ballot":"Add to ballot"}</button></div></article>`}).join("")||`<div class="review-empty"><h3>No nominations yet</h3><p>The participant queue will appear here.</p></div>`;
  elements.adminQueue.querySelectorAll("[data-review-toggle]").forEach(button=>button.addEventListener("click",()=>toggleReviewCard(button.dataset.reviewToggle,button.dataset.included==="true",button)));
}
function render() {
  const nominations=myNominations(),ballots=myBallots();
  elements.nominationStatus.textContent=state.settings?.nomination_open?"Open":"Closed"; elements.nominationDetail.textContent=state.settings?.nomination_open?`${state.settings.nomination_threshold} unique nominations suggests formal review`:"Existing nominations are preserved";
  elements.ballotStatus.textContent=state.settings?.ballot_open?"Open":"Closed"; elements.ballotDetail.textContent=state.settings?.ballot_open?"Voting is open on official review cards":"Votes cannot currently be changed";
  elements.myNominationCount.textContent=nominations.length; elements.myBallotCount.textContent=ballots.length;
  renderCards();renderBallot();renderMine();renderAdmin();
}

function openNomination(cardId) {
  const card=cardById(cardId); if (!card) return;
  const existing=myNominations().find(item=>String(item.card_id)===String(cardId));
  elements.nominationCard.innerHTML=cardSummary(card);elements.nominationCardId.value=card.id;elements.nominationConcern.value=existing?.concern||"";elements.nominationSuggestion.value=existing?.suggested_status||card.status||"semi-limeade";elements.nominationExplanation.value=existing?.explanation||"";elements.withdrawNomination.hidden=!existing;elements.nominationDialog.showModal();bindImageFallbacks(elements.nominationCard);
}
function openBallot(cardId) {
  const card=cardById(cardId); if (!card) return;
  const existing=myBallots().find(item=>String(item.card_id)===String(cardId));
  elements.ballotCard.innerHTML=cardSummary(card);elements.ballotCardId.value=card.id;elements.ballotChoice.value=existing?.recommended_status||"";elements.ballotComment.value=existing?.comment||"";elements.withdrawBallot.hidden=!existing;elements.ballotDialog.showModal();bindImageFallbacks(elements.ballotCard);
}

async function saveNomination(event) {
  event.preventDefault();const button=elements.nominationForm.querySelector('[type="submit"]');setBusy(button,true);
  const row={card_id:Number(elements.nominationCardId.value),user_id:state.session.user.id,concern:elements.nominationConcern.value,suggested_status:elements.nominationSuggestion.value,explanation:elements.nominationExplanation.value.trim(),updated_at:new Date().toISOString()};
  const {error}=await supabase.from("card_nominations").upsert(row,{onConflict:"user_id,card_id"});setBusy(button,false);if(error)return toast(error.message);elements.nominationDialog.close();toast("Nomination saved.");await loadReviewData();
}
async function saveBallot(event) {
  event.preventDefault();const button=elements.ballotForm.querySelector('[type="submit"]');setBusy(button,true);
  const row={card_id:Number(elements.ballotCardId.value),user_id:state.session.user.id,recommended_status:elements.ballotChoice.value,comment:elements.ballotComment.value.trim(),updated_at:new Date().toISOString()};
  const {error}=await supabase.from("card_ballots").upsert(row,{onConflict:"user_id,card_id"});setBusy(button,false);if(error)return toast(error.message);elements.ballotDialog.close();toast("Ballot vote saved.");await loadReviewData();
}
async function withdraw(table,cardId,dialog,label) {
  const {error}=await supabase.from(table).delete().eq("user_id",state.session.user.id).eq("card_id",Number(cardId));if(error)return toast(error.message);dialog.close();toast(`${label} withdrawn.`);await loadReviewData();
}
async function updateSetting(key,value,button) {setBusy(button,true);const {error}=await supabase.from("review_settings").update({[key]:value,updated_at:new Date().toISOString()}).eq("id",1);setBusy(button,false);if(error)return toast(error.message);toast(`${key==="nomination_open"?"Nominations":"Official ballot"} ${value?"opened":"closed"}.`);await loadReviewData();}
async function updateParticipant(userId,field,value,button) {setBusy(button,true);const updates={[field]:value,updated_at:new Date().toISOString()};if(field==="approved"&&!value)updates.active=false;const {error}=await supabase.from("review_participants").update(updates).eq("user_id",userId);setBusy(button,false);if(error)return toast(error.message);toast("Participant access updated.");await loadReviewData();}
async function toggleReviewCard(cardId,included,button) {setBusy(button,true);const {error}=await supabase.from("review_cards").upsert({card_id:Number(cardId),included:!included,added_by:state.session.user.id,updated_at:new Date().toISOString()});setBusy(button,false);if(error)return toast(error.message);toast(included?"Card removed from the official ballot.":"Card added to the official ballot.");await loadReviewData();}

async function loadCards() { const response=await fetch("data/banlist.json",{cache:"no-store"});if(!response.ok)throw new Error(`Card list returned HTTP ${response.status}.`);const data=await response.json();state.cards=Array.isArray(data.cards)?data.cards:[]; }
async function loadReviewData() {
  const [{data:settings,error:settingsError},{data:nominations,error:nominationsError},{data:reviewCards,error:reviewError},{data:ballots,error:ballotsError},{data:participants,error:participantsError}]=await Promise.all([
    supabase.from("review_settings").select("*").eq("id",1).single(),supabase.from("card_nominations").select("*").order("updated_at",{ascending:false}),supabase.from("review_cards").select("*").order("created_at"),supabase.from("card_ballots").select("*").order("updated_at",{ascending:false}),supabase.from("review_participants").select("*").order("display_name"),
  ]);
  const error=settingsError||nominationsError||reviewError||ballotsError||participantsError;if(error)throw error;state.settings=settings;state.nominations=nominations||[];state.reviewCards=reviewCards||[];state.ballots=ballots||[];state.participants=participants||[];render();
}
async function applySession(session) {
  state.session=session;elements.signIn.hidden=Boolean(session);elements.signOut.hidden=!session;
  if(!session){elements.authTitle.textContent="Sign in to participate";elements.authCopy.textContent="Discord sign-in verifies one vote per participant. No votes are posted to Discord.";elements.profileLink.hidden=true;elements.participantStatus.hidden=true;elements.app.hidden=true;return;}
  elements.authTitle.textContent=session.user.user_metadata?.full_name||session.user.user_metadata?.name||"Signed in";elements.authCopy.textContent="Your votes are private from other participants and visible to League Admins.";
  const {data:participant,error}=await supabase.from("review_participants").select("*").eq("user_id",session.user.id).maybeSingle();
  if(error)throw error;state.participant=participant;
  if(!participant){elements.participantStatus.innerHTML="<div><h2>Finishing your participant record</h2><p>Sign out and sign back in once. If this continues, ask a League Admin to check your review access.</p></div>";elements.participantStatus.hidden=false;elements.app.hidden=true;return;}
  const {data:profile,error:profileError}=await supabase.from("league_profiles").select("profile_name,active").eq("discord_id",participant.discord_id).maybeSingle();
  if(profileError)console.warn("League profile link is not available yet.",profileError.message);
  elements.profileLink.hidden=!profile;
  if(profile){elements.profileLink.href=`profiles.html?player=${encodeURIComponent(profile.profile_name)}`;elements.authCopy.textContent=`Linked automatically to the ${profile.profile_name} league profile through Discord.`;}
  if(!participant.approved){elements.participantStatus.innerHTML="<div><p class=\"eyebrow\">Approval pending</p><h2>Your Discord identity is connected</h2><p>A League Admin must approve your participant record before you can nominate or vote.</p></div>";elements.participantStatus.hidden=false;elements.app.hidden=true;return;}
  if(!participant.active){elements.participantStatus.innerHTML="<div><p class=\"eyebrow\">Participant inactive</p><h2>Voting access is paused</h2><p>Your submissions are preserved, but inactive participants cannot nominate or vote.</p></div>";elements.participantStatus.hidden=false;elements.app.hidden=true;return;}
  elements.participantStatus.hidden=true;elements.app.hidden=false;elements.adminTab.hidden=!participant.is_admin;await loadReviewData();
}

function bindEvents() {
  elements.signIn.addEventListener("click",async()=>{const redirectTo=new URL("review.html",window.location.href).href;const {error}=await supabase.auth.signInWithOAuth({provider:"discord",options:{redirectTo}});if(error)toast(error.message);});
  elements.signOut.addEventListener("click",async()=>{await supabase.auth.signOut();await applySession(null);});
  elements.search.addEventListener("input",()=>{state.query=elements.search.value;state.visible=PAGE_SIZE;renderCards();});
  elements.status.addEventListener("change",()=>{state.status=elements.status.value;state.visible=PAGE_SIZE;renderCards();});
  elements.source.addEventListener("change",()=>{state.source=elements.source.value;state.visible=PAGE_SIZE;renderCards();});
  elements.loadMore.addEventListener("click",()=>{state.visible+=PAGE_SIZE;renderCards();});
  document.querySelectorAll("[data-review-view]").forEach(button=>button.addEventListener("click",()=>{state.view=button.dataset.reviewView;document.querySelectorAll("[data-review-view]").forEach(item=>item.setAttribute("aria-selected",String(item===button)));document.querySelectorAll("[data-view-panel]").forEach(panel=>panel.hidden=panel.dataset.viewPanel!==state.view);}));
  document.querySelectorAll("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>button.closest("dialog").close()));
  elements.nominationForm.addEventListener("submit",saveNomination);elements.ballotForm.addEventListener("submit",saveBallot);
  elements.withdrawNomination.addEventListener("click",()=>withdraw("card_nominations",elements.nominationCardId.value,elements.nominationDialog,"Nomination"));
  elements.withdrawBallot.addEventListener("click",()=>withdraw("card_ballots",elements.ballotCardId.value,elements.ballotDialog,"Vote"));
}

async function init() {
  try {await loadCards();if(!configured){elements.setup.hidden=false;elements.signIn.disabled=true;elements.authCopy.textContent="The secure voting database has not been connected yet.";return;}bindEvents();const {data:{session}}=await supabase.auth.getSession();await applySession(session);supabase.auth.onAuthStateChange((event,nextSession)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(()=>applySession(nextSession).catch(error=>showError(error.message)),0);});}
  catch(error){console.error(error);showError(error.message||"The review system could not be loaded.");}
}
init();
