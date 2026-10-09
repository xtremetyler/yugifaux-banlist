const DATA_URL="data/banlist.json";
const CENTRAL_ZONE="America/Chicago";
let events=[];
let visibleMonth=new Date();

const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const centralParts=date=>Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:CENTRAL_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
const dateKey=date=>{const part=centralParts(date);return `${part.year}-${part.month}-${part.day}`;};
const eventTime=date=>new Intl.DateTimeFormat("en-US",{timeZone:CENTRAL_ZONE,weekday:"long",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(date);
const shortMonth=date=>new Intl.DateTimeFormat("en-US",{timeZone:CENTRAL_ZONE,month:"short"}).format(date);

function renderCalendar(){
  const year=visibleMonth.getFullYear(),month=visibleMonth.getMonth();
  $("#calendar-heading").textContent=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"}).format(new Date(year,month,1));
  const first=new Date(year,month,1),gridStart=new Date(year,month,1-first.getDay());
  const todayKey=dateKey(new Date());
  const cells=[];
  for(let index=0;index<42;index++){
    const day=new Date(gridStart);day.setDate(gridStart.getDate()+index);
    const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`;
    const matches=events.filter(event=>dateKey(new Date(event.startAt))===key);
    const links=matches.slice(0,3).map(event=>`<a class="calendar-event" href="${escapeHtml(event.discordUrl)}" target="_blank" rel="noopener" title="${escapeHtml(event.name)}">${escapeHtml(event.name)}</a>`).join("");
    cells.push(`<article class="calendar-day${day.getMonth()!==month?" calendar-day--outside":""}${key===todayKey?" calendar-day--today":""}"><span class="calendar-day__number">${day.getDate()}</span>${links}${matches.length>3?`<span class="calendar-more">+${matches.length-3} more</span>`:""}</article>`);
  }
  $("#event-calendar").innerHTML=cells.join("");
}

function renderUpcoming(){
  const now=Date.now();
  const upcoming=events.filter(event=>new Date(event.endAt).getTime()>=now).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
  if(!upcoming.length){$("#upcoming-events").innerHTML='<div class="event-empty"><h3>No events scheduled yet</h3><p>When the league schedules its next event, it will appear here automatically.</p></div>';return;}
  $("#upcoming-events").innerHTML=upcoming.map(event=>{
    const start=new Date(event.startAt),parts=centralParts(start);
    return `<article class="event-card"><div class="event-card__art">${event.imageUrl?`<img src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.name)} event artwork" loading="lazy">`:""}<span class="event-card__date"><span>${escapeHtml(shortMonth(start))}</span><b>${Number(parts.day)}</b></span></div><div class="event-card__body"><h3>${escapeHtml(event.name)}</h3><div class="event-card__meta"><span>◷ ${escapeHtml(eventTime(start))}</span><span>⌖ ${escapeHtml(event.location)}</span></div><p>${escapeHtml(event.description)}</p><a class="event-card__link" href="${escapeHtml(event.discordUrl)}" target="_blank" rel="noopener">Open Discord event →</a></div></article>`;
  }).join("");
}

async function loadEvents(){
  try{
    const response=await fetch(`${DATA_URL}?v=${Date.now()}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    events=(Array.isArray(payload.events)?payload.events:[]).filter(event=>event.status!=="cancelled"&&event.startAt&&event.endAt);
    const next=events.find(event=>new Date(event.endAt).getTime()>=Date.now());
    if(next){const part=centralParts(new Date(next.startAt));visibleMonth=new Date(Number(part.year),Number(part.month)-1,1);}
    $("#events-updated").textContent=`${events.length} scheduled event${events.length===1?"":"s"} · Times shown in Central Time`;
    renderCalendar();renderUpcoming();
  }catch(error){console.error(error);$("#events-error").hidden=false;$("#events-updated").textContent="Event schedule unavailable";renderCalendar();renderUpcoming();}
}

$("#calendar-prev").addEventListener("click",()=>{visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()-1,1);renderCalendar();});
$("#calendar-next").addEventListener("click",()=>{visibleMonth=new Date(visibleMonth.getFullYear(),visibleMonth.getMonth()+1,1);renderCalendar();});
$("#calendar-today").addEventListener("click",()=>{visibleMonth=new Date();renderCalendar();});
loadEvents();
