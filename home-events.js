(()=>{
  const section=document.querySelector("#home-events");
  if(!section)return;
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  const format=date=>new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(date);
  fetch(`data/banlist.json?v=${Date.now()}`,{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error();return response.json();}).then(payload=>{
    const events=(Array.isArray(payload.events)?payload.events:[]).filter(event=>event.status!=="cancelled"&&new Date(event.endAt).getTime()>=Date.now()).sort((a,b)=>new Date(a.startAt)-new Date(b.startAt));
    const event=events[0];if(!event)return;
    section.innerHTML=`<div class="shell home-event"><div class="home-event__art">${event.imageUrl?`<img src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.name)} event artwork">`:""}</div><div class="home-event__copy"><p class="eyebrow">Next league event</p><h2>${escapeHtml(event.name)}</h2><div class="home-event__meta"><span>${escapeHtml(format(new Date(event.startAt)))}</span><span>${escapeHtml(event.location)}</span></div><p>${escapeHtml(event.description)}</p><div class="home-event__actions"><a class="primary-action" href="${escapeHtml(event.discordUrl)}" target="_blank" rel="noopener">Open in Discord</a><a class="secondary-action" href="events.html">View event calendar</a></div></div></div>`;
    section.hidden=false;
  }).catch(()=>{});
})();
