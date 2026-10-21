import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config=window.YUGIFAUX_REVIEW_CONFIG||{};
const nav=document.querySelector(".site-nav");
if(nav){
  const link=document.createElement("a");
  link.className="site-auth-link";
  link.href="profiles.html?mine=1";
  link.textContent="Login";
  link.setAttribute("aria-label","Log in with Discord");
  nav.append(link);

  const announce=detail=>window.dispatchEvent(new CustomEvent("yugifaux:profile",{detail}));
  if(!config.supabaseUrl||!config.supabaseAnonKey){
    link.textContent="Login unavailable";
    link.setAttribute("aria-disabled","true");
    announce({session:null,profileName:null,error:"Discord login is not configured."});
  }else{
    const supabase=createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,detectSessionInUrl:true}});
    async function applySession(session){
      if(!session){
        localStorage.removeItem("yugifaux-profile-name");
        link.textContent="Login";
        link.href="profiles.html?mine=1";
        link.setAttribute("aria-label","Log in with Discord");
        announce({session:null,profileName:null});
        return;
      }
      link.textContent="Finding profile…";
      const {data:participant,error:participantError}=await supabase.from("review_participants").select("discord_id").eq("user_id",session.user.id).maybeSingle();
      if(participantError)throw participantError;
      const {data:profile,error:profileError}=participant?.discord_id
        ? await supabase.from("league_profiles").select("profile_name,active").eq("discord_id",participant.discord_id).maybeSingle()
        : {data:null,error:null};
      if(profileError)throw profileError;
      const profileName=profile?.profile_name||null;
      if(profileName)localStorage.setItem("yugifaux-profile-name",profileName);
      else localStorage.removeItem("yugifaux-profile-name");
      link.textContent="My Profile";
      link.href=profileName?`profiles.html?player=${encodeURIComponent(profileName)}&mine=1`:"profiles.html?mine=1";
      link.setAttribute("aria-label",profileName?`Open ${profileName}'s profile`:"Open my player profile");
      announce({session,profileName,active:profile?.active??null});
    }
    link.addEventListener("click",async event=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(session)return;
      event.preventDefault();
      const redirectTo=new URL("profiles.html?mine=1",window.location.href).href;
      const {error}=await supabase.auth.signInWithOAuth({provider:"discord",options:{redirectTo}});
      if(error){link.textContent="Login failed";announce({session:null,profileName:null,error:error.message});}
    });
    const {data:{session}}=await supabase.auth.getSession();
    await applySession(session).catch(error=>{
      console.error("Could not resolve the signed-in league profile.",error);
      link.textContent=session?"My Profile":"Login";
      announce({session,profileName:null,error:error.message});
    });
    supabase.auth.onAuthStateChange((event,nextSession)=>{
      if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED")setTimeout(()=>applySession(nextSession).catch(error=>announce({session:nextSession,profileName:null,error:error.message})),0);
    });
  }
}
