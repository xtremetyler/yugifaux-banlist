const profileState={players:[],active:[],retired:[],matches:[],achievements:[],achievementAwards:[],lifetimeAchievements:[],lifetimeAchievementAwards:[],query:"",seasonName:"Current season",loaded:false,myProfileName:null,avatarUrl:null};
const profileElements={updated:document.querySelector("#profiles-updated"),total:document.querySelector("#profiles-total"),search:document.querySelector("#profiles-search"),grid:document.querySelector("#profiles-grid"),detail:document.querySelector("#profile-detail"),account:document.querySelector("#profile-account-status"),error:document.querySelector("#profiles-error")};
const destinationLabels={ephtear:"Ephtear",duelhalla:"Duelhalla","limb-faux":"Limb-Faux"};
const destinationImages={ephtear:"assets/retirement-ephtear.png",duelhalla:"assets/retirement-duelhalla.png","limb-faux":"assets/retirement-limbfaux.png"};
const defaultAchievements=[
  ["opening-act","Opening Act","Complete your first confirmed match of the season."],["league-regular","League Regular","Complete 15 confirmed matches in the season."],["iron-duelist","Iron Duelist","Complete 50 confirmed matches in the season."],["first-blood","First Blood","Win your first match of the season."],["proven-duelist","Proven Duelist","Win 15 matches in the season."],["clean-sweep","Clean Sweep","Win a match 2–0."],["on-a-roll","On a Roll","Win 3 consecutive matches."],["bounce-back","Bounce Back","Win a match after at least 4 consecutive match losses."],["making-the-rounds","Making the Rounds","Duel against every other active duelist."],["equal-opportunity-duelist","Equal Opportunity Duelist","Win at least 1 match against every other active duelist."],["run-it-back","Run It Back","Win against a player who beat you earlier in the same season."],["last-stand","Last Stand","Win 3 matches with the same archetype while beginning each match at or above its Ephtear retirement threshold."],["leaving-a-legacy","Leaving a Legacy","Retire 3 archetypes to Ephtear or Duelhalla during the season."],["end-of-a-reign","End of a Reign","Win the decisive match that sends an opponent's archetype to Ephtear."],["ascension","Ascension","Retire an active archetype to Duelhalla."],
].map(([id,name,description])=>({id,name,description,reward:4,imageUrl:`assets/achievements/${id}.png${id==="opening-act"?"?v=2":""}`}));
const defaultLifetimeAchievements=[
  {id:"money-bags",name:"Money Bags",description:"Purchase the permanent Money Bags achievement from the Point Shop.",reward:10,imageUrl:"assets/achievements/money-bags.png"},
  {id:"season-1-platinum",name:"Season 1 Platinum",description:"Played at least one match during YugiFAUX Season 1. A permanent Founder achievement.",reward:4,imageUrl:"assets/achievements/season-1-platinum.png"},
];
const escapeHtml=(value="")=>String(value).replace(/[&<>'"]/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
const safeReplayUrl=value=>{try{const url=new URL(value);return url.protocol==="https:"&&["duelingbook.com","www.duelingbook.com"].includes(url.hostname.toLowerCase())&&["/replay","/replay.php"].includes(url.pathname.replace(/\/$/,""))?url.href:null;}catch{return null;}};
const safeImageUrl=value=>{try{const url=new URL(value,location.href);return ["http:","https:"].includes(url.protocol)?url.href:null;}catch{return null;}};
const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.valueOf())?"Date unavailable":new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(date);};
const profileUrl=name=>`profiles.html?player=${encodeURIComponent(name)}`;
const params=new URLSearchParams(location.search);
const mineRequested=params.get("mine")==="1";

function renderRoster(){
  const query=profileState.query.trim().toLowerCase();
  const players=profileState.players.filter(player=>!query||`${player.name} ${player.archetypeName||""}`.toLowerCase().includes(query));
  profileElements.grid.innerHTML=players.length?players.map(player=>{const rank=profileState.players.findIndex(item=>item.name===player.name)+1;return `<a class="player-card" href="${profileUrl(player.name)}"><span class="player-card__rank">${rank}</span><div><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.archetypeName||"No active archetype")}</small></div><span><b>${player.matchWins}-${player.matchLosses}</b><small>matches</small></span><span><b>${player.balance}</b><small>points</small></span></a>`;}).join(""):'<p class="league-empty">No players match that search.</p>';
}

function resultRow(match,playerName){
  const isReporter=match.reporter===playerName;const ownScore=isReporter?match.reporterGames:match.opponentGames;const otherScore=isReporter?match.opponentGames:match.reporterGames;const opponent=isReporter?match.opponent:match.reporter;const opponentArchetype=isReporter?match.opponentArchetype:match.reporterArchetype;const result=ownScore>otherScore?"Win":ownScore<otherScore?"Loss":"Draw";const replay=safeReplayUrl(match.replayUrl);
  return `<article class="profile-match" data-result="${result.toLowerCase()}"><span>${result}</span><div><strong>vs. ${escapeHtml(opponent)}</strong><small>${escapeHtml(opponentArchetype||"Archetype unavailable")} · ${dateLabel(match.confirmedAt)}${replay?` · <a href="${escapeHtml(replay)}" target="_blank" rel="noopener noreferrer">Watch replay ↗</a>`:""}</small></div><b>${ownScore}-${otherScore}</b></article>`;
}

function achievementCollection(catalog,awards,playerName,eyebrow,title){
  const earned=new Map(awards.filter(award=>award.player===playerName).map(award=>[award.achievementId,award]));
  return `<section class="profile-section profile-achievements"><div class="panel-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h3>${escapeHtml(title)}</h3></div><span>${earned.size}/${catalog.length} earned</span></div><div class="achievement-grid">${catalog.map(achievement=>{const award=earned.get(achievement.id);return `<article class="achievement-card${award?" is-earned":" is-locked"}" title="${escapeHtml(achievement.description)}"><img src="${escapeHtml(achievement.imageUrl)}" alt="" /><div><strong>${escapeHtml(achievement.name)}</strong><small>${award?`Earned ${dateLabel(award.earnedAt)}`:`Locked · ${escapeHtml(achievement.description)}`}</small><b>+${achievement.reward} points</b></div></article>`;}).join("")}</div></section>`;
}

function achievementGallery(playerName){
  return `${achievementCollection(profileState.lifetimeAchievements,profileState.lifetimeAchievementAwards,playerName,"Permanent collection","Lifetime achievements")}${achievementCollection(profileState.achievements,profileState.achievementAwards,playerName,`${profileState.seasonName} collection`,"Season achievements")}`;
}

function cardCollection(archetypes){
  const collections=archetypes.filter(entry=>Array.isArray(entry.cards)&&entry.cards.length);
  const total=collections.reduce((sum,entry)=>sum+entry.cards.length,0);
  if(!total)return `<section class="profile-section"><div class="panel-heading"><div><p class="eyebrow">Card legacy</p><h3>Created cards</h3></div><span>0 cards</span></div><p class="league-empty">No card history is available for this player yet.</p></section>`;
  return `<section class="profile-section profile-card-history"><div class="panel-heading"><div><p class="eyebrow">Card legacy</p><h3>Every archetype card</h3></div><span>${total} card${total===1?"":"s"} across ${collections.length} archetype${collections.length===1?"":"s"}</span></div><div class="profile-card-collections">${collections.map((entry,index)=>{
    const active=entry.status==="active"||entry.status==="revived";const destination=active?(entry.status==="revived"?"Revived · Active":"Active"):destinationLabels[entry.destination]||"Retired";
    return `<details class="profile-card-collection" ${index===0?"open":""}><summary><span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(destination)}${entry.retiredAt?` · ${dateLabel(entry.retiredAt)}`:""}</small></span><b>${entry.cards.length} cards</b></summary><div class="profile-history-grid">${entry.cards.map(card=>{const image=safeImageUrl(card.imageUrl);const dbId=Number(card.duelingbookId);return `<article class="profile-history-card">${image?`<img src="${escapeHtml(image)}" alt="${escapeHtml(card.name)} card artwork" loading="lazy" referrerpolicy="no-referrer" />`:`<span class="profile-history-card__placeholder">YF</span>`}<div><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml([card.cardType,card.status?card.status.replaceAll("-"," "):null].filter(Boolean).join(" · ")||"Card details unavailable")}</small>${Number.isSafeInteger(dbId)&&dbId>0?`<a href="https://www.duelingbook.com/card?id=${dbId}" target="_blank" rel="noopener noreferrer">DuelingBook #${dbId} ↗</a>`:""}</div></article>`;}).join("")}</div></details>`;
  }).join("")}</div></section>`;
}

function retiredArchetypeRow(entry){
  const image=destinationImages[entry.destination];
  const art=image?`<img src="${escapeHtml(image)}" alt="" />`:`<span class="profile-legacy-placeholder">${escapeHtml(entry.name.trim().slice(0,2).toUpperCase())}</span>`;
  return `<a href="archive.html">${art}<div><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(destinationLabels[entry.destination]||"Retired")} · ${dateLabel(entry.retiredAt)} · ${entry.cards?.length||0} cards</small></div></a>`;
}

function renderProfile(player){
  if(!player){profileElements.detail.hidden=true;return;}
  const rank=profileState.players.findIndex(item=>item.name===player.name)+1;
  const active=profileState.active.find(entry=>entry.id===player.archetypeId)||profileState.active.find(entry=>entry.creator===player.name);
  const retired=profileState.retired.filter(entry=>entry.creator===player.name).sort((a,b)=>new Date(b.retiredAt||0)-new Date(a.retiredAt||0));
  const matches=profileState.matches.filter(match=>match.reporter===player.name||match.opponent===player.name);
  const archetypes=[...(active?[active]:[]),...retired];
  const isMine=profileState.myProfileName===player.name;
  const avatar=isMine?safeImageUrl(profileState.avatarUrl):null;
  profileElements.detail.hidden=false;
  profileElements.detail.innerHTML=`<div class="profile-identity"><div class="profile-monogram">${avatar?`<img src="${escapeHtml(avatar)}" alt="${escapeHtml(player.name)} Discord avatar" />`:escapeHtml(player.name.trim().slice(0,2).toUpperCase())}</div><div><a href="profiles.html">← All players</a><p class="eyebrow">${isMine?"My league profile":`League rank #${rank}`}</p><h2>${escapeHtml(player.name)}</h2><span>${escapeHtml(active?.name||"No active archetype")} · ${archetypes.length} archetype${archetypes.length===1?"":"s"} recorded</span></div></div><div class="profile-statline"><article><span>Balance</span><strong>${player.balance}</strong><small>Current spendable points</small></article><article><span>Lifetime points</span><strong>${player.lifetimePoints??"—"}</strong><small>All recorded points earned</small></article><article><span>Match record</span><strong>${player.matchWins}-${player.matchLosses}</strong><small>${escapeHtml(profileState.seasonName)} confirmed matches</small></article><article><span>Game record</span><strong>${player.gamesWon}-${player.gamesLost}${player.gamesDrawn?`-${player.gamesDrawn}`:""}</strong><small>${escapeHtml(profileState.seasonName)} games</small></article><article><span>SLACS</span><strong>${Number.isFinite(Number(player.slacs))?Number(player.slacs).toFixed(3):"—"}</strong><small>Season ranking score</small></article></div>${active?`<section class="profile-section"><div class="panel-heading"><div><p class="eyebrow">Current campaign</p><h3>Active archetype</h3></div><a href="archetypes.html#archetype-${active.id}">Open full archetype →</a></div><a class="profile-active" href="archetypes.html#archetype-${active.id}">${active.featuredImageUrl?`<img src="${escapeHtml(active.featuredImageUrl)}" alt="" />`:""}<div><span>${active.status==="revived"?"Revived":"Active"}</span><strong>${escapeHtml(active.name)}</strong><small>${active.registeredCardCount} cards · ${active.totalClauses} clauses · ${active.retirementsSeen}/${active.retirementThreshold} Ephtear retirements caused</small></div></a></section>`:""}${achievementGallery(player.name)}<div class="profile-columns"><section class="profile-section"><div class="panel-heading"><div><p class="eyebrow">Permanent history</p><h3>Previous archetypes</h3></div><a href="archive.html">Archive →</a></div><div class="profile-legacies">${retired.length?retired.map(retiredArchetypeRow).join(""):'<p class="league-empty">No retired archetypes recorded.</p>'}</div></section><section class="profile-section"><div class="panel-heading"><div><p class="eyebrow">Duel record</p><h3>Confirmed matches</h3></div><span>${matches.length} recorded</span></div><div class="profile-matches">${matches.length?matches.map(match=>resultRow(match,player.name)).join(""):`<p class="league-empty">No confirmed ${escapeHtml(profileState.seasonName)} matches recorded.</p>`}</div></section></div>${cardCollection(archetypes)}`;
  profileElements.detail.querySelectorAll(".profile-history-card img").forEach(image=>image.addEventListener("error",()=>{const placeholder=document.createElement("span");placeholder.className="profile-history-card__placeholder";placeholder.textContent="YF";image.replaceWith(placeholder);},{once:true}));
  profileElements.detail.scrollIntoView({behavior:"smooth",block:"start"});
}

function showAccountStatus(title,copy){
  profileElements.account.hidden=false;
  profileElements.account.innerHTML=`<div><p class="eyebrow">Discord profile link</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div>`;
}

function openNamedProfile(name){
  if(!profileState.loaded)return false;
  const player=profileState.players.find(item=>item.name===name);
  if(player){profileElements.account.hidden=true;renderProfile(player);return true;}
  showAccountStatus("Profile data is still syncing",`Your Discord account is linked to ${name}, but that player is not present in the latest public league export yet.`);return false;
}

window.addEventListener("yugifaux:profile",event=>{
  const {session,profileName,error}=event.detail||{};
  profileState.myProfileName=profileName||null;
  profileState.avatarUrl=session?.user?.user_metadata?.avatar_url||session?.user?.user_metadata?.picture||null;
  if(!mineRequested){const selected=params.get("player");if(selected&&selected===profileName&&profileState.loaded)renderProfile(profileState.players.find(player=>player.name===selected));return;}
  if(error){showAccountStatus("Could not load your profile",error);return;}
  if(!session){showAccountStatus("Log in to open your profile","Use the Login button in the navigation. Discord securely identifies which league profile belongs to you.");return;}
  if(!profileName){showAccountStatus("No league profile is linked yet","The bot has not synchronized a player profile for this Discord account. Ask a League Admin to refresh the website data.");return;}
  if(openNamedProfile(profileName))history.replaceState(null,"",`profiles.html?player=${encodeURIComponent(profileName)}&mine=1`);
});

profileElements.search.addEventListener("input",()=>{profileState.query=profileElements.search.value;renderRoster();});

async function loadProfiles(){
  try{
    if(mineRequested)showAccountStatus("Finding your league profile…","Checking the Discord account connected to this browser.");
    const response=await fetch(`data/banlist.json?v=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json();
    profileState.players=Array.isArray(payload.dashboard?.standings)?payload.dashboard.standings:[];profileState.active=Array.isArray(payload.activeArchetypes)?payload.activeArchetypes:[];profileState.retired=Array.isArray(payload.archetypes)?payload.archetypes:[];profileState.matches=Array.isArray(payload.dashboard?.matchHistory)?payload.dashboard.matchHistory:Array.isArray(payload.dashboard?.recentMatches)?payload.dashboard.recentMatches:[];
    const catalog=Array.isArray(payload.achievements?.catalog)&&payload.achievements.catalog.length?payload.achievements.catalog:defaultAchievements;profileState.achievements=catalog.map(item=>item.id==="opening-act"?{...item,imageUrl:"assets/achievements/opening-act.png?v=2"}:item);profileState.achievementAwards=Array.isArray(payload.achievements?.awards)?payload.achievements.awards:[];profileState.lifetimeAchievements=Array.isArray(payload.achievements?.lifetimeCatalog)&&payload.achievements.lifetimeCatalog.length?payload.achievements.lifetimeCatalog:defaultLifetimeAchievements;profileState.lifetimeAchievementAwards=Array.isArray(payload.achievements?.lifetimeAwards)?payload.achievements.lifetimeAwards:[];profileState.seasonName=payload.dashboard?.seasonName||payload.achievements?.seasonName||"Current season";profileState.loaded=true;
    profileElements.updated.textContent=payload.updatedAt?`Updated ${new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(payload.updatedAt))}`:"Player records loaded";profileElements.total.textContent=`${profileState.players.length} player${profileState.players.length===1?"":"s"}`;renderRoster();
    const selected=params.get("player")||(mineRequested?localStorage.getItem("yugifaux-profile-name"):null);if(selected)openNamedProfile(selected);
  }catch(error){console.error(error);profileElements.error.hidden=false;profileElements.updated.textContent="Player profiles unavailable";}
}
loadProfiles();
