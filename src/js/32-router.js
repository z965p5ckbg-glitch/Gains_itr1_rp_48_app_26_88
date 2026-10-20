
// ═══════════════════════════════════════════════════════════════════
// VIEW ROUTER + HISTORY
//
// The nav bar (Today / History / Progress / PRs) was previously cosmetic.
// We now route between views. Today keeps its existing render path entirely
// untouched: routing simply toggles a body class that hides Today's #hdr +
// #scroll and shows #histView. Progress/PRs remain stubs for now.
//
// currentView: 'today' | 'history' | 'progress' | 'prs'
// History has internal sub-state (hiMode + hiDetailId) managed within the
// module, so the router only needs to know the top-level view.
// ═══════════════════════════════════════════════════════════════════
let currentView='today';

function routeTo(view){
  currentView=view;
  const app=document.getElementById('app');
  // Body class drives which view's chrome is visible (see CSS).
  app.classList.remove('view-today','view-history','view-progress','view-prs');
  app.classList.add('view-'+view);
  // Sync nav active states
  const order=['today','history','progress','prs'];
  document.querySelectorAll('#nav .ni').forEach((ni,i)=>{
    ni.classList.toggle('active',order[i]===view);
  });
  if(view==='today'){
    // Returning to Today: only refresh if the logged day has gone stale (past
    // the TTL). A recent summary stays; an in-progress day is never touched.
    try{ wsMaybeResetStaleDay(); renderTabs(); renderHeader(); renderAll(false); }catch(_){}
  } else if(view==='history'){
    hiRender();
  } else if(view==='progress'){
    if(!window.__wsProgKeepDetail) wsProgExId=null;
    window.__wsProgKeepDetail=false;
    wsProgRender();
  } else if(view==='prs'){
    wsPRRender();
  }
}

// Wire the nav. Order in DOM is Today, History, Progress, PRs.
(function bindNav(){
  const items=document.querySelectorAll('#nav .ni');
  const order=['today','history','progress','prs'];
  items.forEach((ni,i)=>{
    ni.onclick=()=>routeTo(order[i]);
  });
})();
