const dashboardElements={updated:document.querySelector("#dashboard-updated"),active:document.querySelector("#stat-active"),matches:document.querySelector("#stat-matches"),waiting:document.querySelector("#stat-waiting"),cards:document.querySelector("#stat-cards"),standings:document.querySelector("#standings-table"),results:document.querySelector("#recent-results"),watch:document.querySelector("#retirement-watch"),latest:document.querySelector("#latest-cards"),error:document.querySelector("#dashboard-error")};
const statusLabels={banned:"Banned",limeade:"Limeade","semi-limeade":"Semi-Limeade",unlimeade:"Un-Limeade",voting:"Voting pending"};
const escapeHtml=(value="")=>String(value).replace(/[&<>'"]/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.valueOf())?"Date unavailable":new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(date);};
const empty=message=>`<p class="league-empty">${escapeHtml(message)}</p>`;

function renderStandings(rows){
  dashboardElements.standings.innerHTML=rows.length?`<div class="standing standing--header"><span>#</span><span>Player</span><span>Record</span><span>Points</span></div>${rows.map((row,index)=>`<div class="standing"><b>${index+1}</b><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.archetypeName||"No active archetype")}</small></span><span><strong>${row.matchWins}-${row.matchLosses}</strong><small>${row.gamesWon}-${row.gamesLost}${row.gamesDrawn?`-${row.gamesDrawn}`:""} games</small></span><strong class="standing__points">${row.balance}<small>${row.lifetimePoints} earned</small></strong></div>`).join("")}`:empty("Standings will appear after the updated bot publishes league data.");
}
function renderResults(matches){
  dashboardElements.results.innerHTML=matches.length?matches.map(match=>{const reporterWon=match.reporterGames>match.opponentGames;return `<article class="result-card"><div><span>${dateLabel(match.confirmedAt)}</span><b>Match #${match.id}</b></div><p class="${reporterWon?"is-winner":""}"><strong>${escapeHtml(match.reporter)}</strong><small>${escapeHtml(match.reporterArchetype||"Archetype unavailable")}</small><b>${match.reporterGames}</b></p><p class="${reporterWon?"":"is-winner"}"><strong>${escapeHtml(match.opponent)}</strong><small>${escapeHtml(match.opponentArchetype||"Archetype unavailable")}</small><b>${match.opponentGames}</b></p></article>`;}).join(""):empty("Confirmed match results will appear here.");
}
function renderRetirementWatch(archetypes){
  const sorted=[...archetypes].sort((a,b)=>Number(b.retirementRequired)-Number(a.retirementRequired)||b.retirementsSeen-a.retirementsSeen).slice(0,8);
  dashboardElements.watch.innerHTML=sorted.length?sorted.map(entry=>{const progress=Math.min(100,entry.retirementsSeen/entry.retirementThreshold*100);return `<a class="watch-card${entry.retirementRequired?" is-required":""}" href="archetypes.html#archetype-${entry.id}"><div><span>${entry.retirementRequired?"Retirement required":entry.status==="revived"?"Revived":"Active"}</span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.creator)} · ${entry.totalClauses} clauses</small></div><b>${entry.retirementsSeen}<small>/${entry.retirementThreshold}</small></b><i><u style="width:${progress}%"></u></i></a>`;}).join(""):empty("Active archetype progress will appear after the updated bot is deployed.");
}
function renderLatest(cards){
  const latest=[...cards].sort((a,b)=>new Date(b.changedAt||b.addedAt)-new Date(a.changedAt||a.addedAt)).slice(0,6);
  dashboardElements.latest.innerHTML=latest.length?latest.map(card=>`<a class="latest-card" href="banlist.html"><span>${card.imageUrl?`<img src="${escapeHtml(card.imageUrl)}" alt="" loading="lazy" />`:"YF"}</span><div><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(statusLabels[card.status]||card.status)} · ${dateLabel(card.changedAt||card.addedAt)}</small></div></a>`).join(""):empty("No Limeade cards are available yet.");
}
async function loadDashboard(){
  try{
    const response=await fetch(`data/banlist.json?v=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();const active=Array.isArray(payload.activeArchetypes)?payload.activeArchetypes:[];const dashboard=payload.dashboard||{};const cards=Array.isArray(payload.cards)?payload.cards:[];
    dashboardElements.updated.textContent=payload.updatedAt?`Updated ${new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(payload.updatedAt))}`:"League data loaded";
    dashboardElements.active.textContent=active.length;dashboardElements.matches.textContent=Number(dashboard.confirmedMatchCount||0);dashboardElements.waiting.textContent=active.filter(entry=>entry.retirementRequired).length;dashboardElements.cards.textContent=cards.length;
    renderStandings(Array.isArray(dashboard.standings)?dashboard.standings:[]);renderResults(Array.isArray(dashboard.recentMatches)?dashboard.recentMatches:[]);renderRetirementWatch(active);renderLatest(cards);
  }catch(error){console.error(error);dashboardElements.error.hidden=false;dashboardElements.updated.textContent="Dashboard unavailable";}
}
loadDashboard();

