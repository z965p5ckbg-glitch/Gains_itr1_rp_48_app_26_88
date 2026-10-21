
;(function(){
  window.wsOpenData=function(){
    let el=document.getElementById('wsDataSheet');
    if(!el){ el=document.createElement('div'); el.id='wsDataSheet'; el.className='ws-data-wrap'; document.body.appendChild(el); }
    const st=wsBackupStats();
    const range=st.first?(st.first+' → '+st.last):'nothing logged yet';
    const _age=(typeof wsBackupAgeDays==='function')?wsBackupAgeDays():null;
    const _ageTxt=(_age===null)?'Never backed up':(_age===0?'Backed up today':('Last backup '+_age+(_age===1?' day':' days')+' ago'));
    const _stale=(_age===null&&st.sessions>0)||(_age!==null&&_age>=21);
    const _warn=(typeof _wsStorageFailed!=='undefined'&&_wsStorageFailed)
      ? '<div class="ws-data-alert">This device is refusing to save. Export a backup now — new sets are not being stored.</div>' : '';
    el.innerHTML='<div class="ws-data-scrim" onclick="wsCloseData()"></div>'+
      '<div class="ws-data-sheet">'+
        '<div class="ws-data-h">Your data</div>'+
        '<div class="ws-data-stat"><b>'+st.sessions+'</b> sessions · <b>'+st.sets+'</b> sets<br><span>'+range+'</span></div>'+
        _warn+
        '<div class="ws-data-age'+(_stale?' stale':'')+'">'+_ageTxt+'</div>'+
        '<div class="ws-data-note">Your log lives on this device only. Browsers can clear local data without warning — keep a backup file somewhere safe.</div>'+
        '<div class="ws-data-btn primary" onclick="wsBackupDownload()">Save backup file</div>'+
        '<div class="ws-data-btn" onclick="wsBackupShare()">Share backup…</div>'+
        '<div class="ws-data-btn" onclick="wsBackupCopy()">Copy backup text</div>'+
        '<div class="ws-data-sep">Restore</div>'+
        '<textarea id="wsRestoreIn" class="ws-data-ta" placeholder="Paste backup text here"></textarea>'+
        '<div class="ws-data-btn" onclick="wsDoRestore()">Restore from text</div>'+
        '<div class="ws-data-sep">Session effort</div>'+'<div class="ws-data-note">Sessions logged before effort tracking existed have no rating. You can fill them with an estimate based on how each session was structured — low-rep loaded work rates higher. Estimates are marked <b>est</b> everywhere they appear and never overwrite a real rating.</div>'+'<div class="ws-data-btn" onclick="wsDoSeedEffort()">Estimate effort for past sessions</div>'+'<div class="ws-data-btn" onclick="wsDoClearSeededEffort()">Remove estimated ratings</div>'+'<div class="ws-data-sep">Import from old app</div>'+'<div class="ws-data-note">Paste the JSON exported from the Lovable prototype. Only sets you actually ticked are imported; work done on the same day is merged into one session.</div>'+'<textarea id="wsLegacyIn" class="ws-data-ta" placeholder="Paste old-app export here"></textarea>'+'<div class="ws-data-btn" onclick="wsDoMergeLegacy()">Merge into my log</div>'+'<div class="ws-data-btn ws-data-btn-danger" onclick="wsDoImportLegacy()">Replace my log entirely</div>'+'<div class="ws-data-note">Merge keeps everything you have logged in Gains and adds the imported days alongside it. Running it twice is safe — days already imported are skipped, not duplicated. Replace deletes what is here first.</div>'+'<div class="ws-data-sep">Start fresh</div>'+
        '<div class="ws-data-note">Clears the built-in demo history so the app tracks only your own training. Your program, days and exercises stay.</div>'+
        '<div class="ws-data-btn danger" onclick="wsConfirmEmpty()">Clear log &amp; start empty</div>'+
        '<div class="ws-data-btn close" onclick="wsCloseData()">Close</div>'+
      '</div>';
    requestAnimationFrame(()=>el.classList.add('on'));
  };
  window.wsCloseData=function(){ const el=document.getElementById('wsDataSheet'); if(el) el.classList.remove('on'); };
  window.wsDoRestore=function(){
    const ta=document.getElementById('wsRestoreIn'); if(!ta) return;
    const txt=(ta.value||'').trim();
    if(!txt){ wsToastMsg('Paste a backup first'); return; }
    const st=wsBackupStats();
    if(st.sessions>0 && !confirm('Restoring replaces your current log ('+st.sessions+' sessions). Continue?')) return;
    const r=wsRestoreBackup(txt);
    wsToastMsg(r.msg);
    if(r.ok) wsCloseData();
  };
  window.wsDoSeedEffort=function(){
    const n=wsSeedEffort(7,9);
    wsToastMsg(n?('Estimated effort on '+n+' session'+(n===1?'':'s')):'Nothing to estimate — all sessions already rated');
    if(n) renderAll(false);
  };
  window.wsDoClearSeededEffort=function(){
    const n=wsClearSeededEffort();
    wsToastMsg(n?('Removed '+n+' estimated rating'+(n===1?'':'s')):'No estimated ratings to remove');
    if(n) renderAll(false);
  };
  window.wsDoMergeLegacy=function(){
    const ta=document.getElementById('wsLegacyIn'); if(!ta) return;
    const txt=(ta.value||'').trim();
    if(!txt){ wsToastMsg('Paste the old export first'); return; }
    const p=wsPlanLegacyMerge(txt);
    if(!p.ok){ wsToastMsg(p.msg); return; }
    if(!p.toAdd.length){
      wsToastMsg(p.dupes.length?'Already merged — nothing new to add':'Nothing to merge');
      return;
    }
    let note='Add '+p.toAdd.length+' imported day'+(p.toAdd.length===1?'':'s')+'?\n\n'
      +'Keeping all '+p.existingCount+' session'+(p.existingCount===1?'':'s')+' already logged here.';
    if(p.dupes.length) note+='\n'+p.dupes.length+' day(s) were already imported and will be skipped.';
    if(p.collisions.length){
      note+='\n\n'+p.collisions.length+' imported day(s) fall on a date you also trained here:\n'
        +p.collisions.slice(0,4).map(c=>'  '+c.day).join('\n')
        +(p.collisions.length>4?'\n  …':'')
        +'\nBoth are kept — review them in History afterwards.';
    }
    if(!confirm(note)) return;
    const r=wsApplyLegacyMerge(txt);
    wsToastMsg(r.msg);
    if(r.ok) wsCloseData();
  };
  window.wsDoImportLegacy=function(){
    const ta=document.getElementById('wsLegacyIn'); if(!ta) return;
    const txt=(ta.value||'').trim();
    if(!txt){ wsToastMsg('Paste the old export first'); return; }
    const pre=wsImportLegacy(txt);
    if(!pre.ok){ wsToastMsg(pre.msg); return; }
    const st=wsBackupStats();
    const s=pre.stats;
    let note='Import '+s.days+' training days ('+s.setsKept+' sets)?\n\n'
            +s.setsDropped+' planned-but-unticked sets will be left out.';
    if(s.mixedDays) note+='\n'+s.mixedDays+' days combine more than one plan day.';
    if(s.unmapped.length) note+='\nNot in the library: '+s.unmapped.slice(0,4).join(', ')+(s.unmapped.length>4?'…':'');
    if(st.sessions>0) note+='\n\nWARNING — this DELETES the '+st.sessions+' session(s) already logged here, including anything you logged in Gains itself. Use "Merge into my log" to keep them.';
    if(!confirm(note)) return;
    const r=wsApplyLegacyImport(txt);
    wsToastMsg(r.msg);
    if(r.ok) wsCloseData();
  };
  window.wsConfirmEmpty=function(){
    const st=wsBackupStats();
    if(st.sessions>0 && !confirm('Clear all '+st.sessions+' logged sessions? Save a backup first if you want to keep them.')) return;
    wsStartEmpty(); wsCloseData();
  };
})();

;(function(){
  window.wsOpenCoach=function(){
    let el=document.getElementById('wsCoachSheet');
    if(!el){ el=document.createElement('div'); el.id='wsCoachSheet'; el.className='ws-data-wrap'; document.body.appendChild(el); }
    let txt='';
    try{ txt=wsCoachBrief(); }catch(e){ txt='Could not build the brief: '+(e&&e.message||'unknown'); }
    const words=txt.split(/\s+/).length;
    el.innerHTML='<div class="ws-data-scrim" onclick="wsCloseCoach()"></div>'+
      '<div class="ws-data-sheet">'+
        '<div class="ws-data-h">Ask my coach</div>'+
        '<div class="ws-data-note">This is exactly what will be copied. Nothing is sent from the app &mdash; there is no account and no API key. Paste it into Claude, ChatGPT or anything else. Read it before you share it: it describes your training.</div>'+
        '<div class="ws-data-sep">Your question</div>'+
        '<textarea id="wsCoachAsk" class="ws-data-ta" placeholder="What do you want to ask?">'+hiEscape(wsBriefAsk())+'</textarea>'+
        '<div class="ws-data-btn" onclick="wsCoachRefresh()">Update brief with this question</div>'+
        '<div class="ws-data-sep">Brief preview &middot; '+words+' words</div>'+
        '<textarea id="wsCoachOut" class="ws-data-ta tall" spellcheck="false">'+hiEscape(txt)+'</textarea>'+
        '<div class="ws-data-btn primary" onclick="wsCoachCopy()">Copy brief</div>'+
        '<div class="ws-data-btn" onclick="wsCoachShare()">Share&hellip;</div>'+
        '<div class="ws-data-btn close" onclick="wsCloseCoach()">Close</div>'+
      '</div>';
    requestAnimationFrame(()=>el.classList.add('on'));
  };
  window.wsCloseCoach=function(){ const el=document.getElementById('wsCoachSheet'); if(el) el.classList.remove('on'); };
  window.wsCoachRefresh=function(){
    const a=document.getElementById('wsCoachAsk'); if(!a) return;
    const v=(a.value||'').trim();
    try{ if(typeof settings==='object'&&settings){ settings.coachAsk=v; if(typeof wsPersistFlush==='function') wsPersistFlush(); } }catch(_){}
    const o=document.getElementById('wsCoachOut');
    if(o){ try{ o.value=wsCoachBrief(v||null); wsToastMsg('Brief updated'); }catch(e){ wsToastMsg('Rebuild failed'); } }
  };
  window.wsCoachCopy=function(){
    const o=document.getElementById('wsCoachOut'); if(!o) return;
    const t=o.value||'';
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(()=>wsToastMsg('Brief copied')).catch(()=>wsToastMsg('Copy failed'));
    } else { try{ o.select(); document.execCommand('copy'); wsToastMsg('Brief copied'); }catch(_){ wsToastMsg('Copy unavailable'); } }
  };
  window.wsCoachShare=function(){
    const o=document.getElementById('wsCoachOut'); if(!o) return;
    try{ if(navigator.share){ navigator.share({title:'Training brief',text:o.value||''}).catch(()=>{}); return; } }catch(_){}
    wsCoachCopy();
  };
})();

;(function(){
  function esc(v){ return hiEscape(String(v==null?'':v)); }
  window.wsOpenProfile=function(){
    let el=document.getElementById('wsProfSheet');
    if(!el){ el=document.createElement('div'); el.id='wsProfSheet'; el.className='ws-data-wrap'; document.body.appendChild(el); }
    const p=wsProfile(), bw=wsBodyLatest(), a7=wsBodyAvg(7), log=wsBodyLog();
    const age=wsProfileAge();
    const rel=wsRelStrength(5);
    const recent=log.slice(-8).reverse().map(e=>'<div class="ws-fix-row"><div class="ws-fix-m"><div class="ws-fix-n">'+e.kg+' kg</div><div class="ws-fix-s">'+esc(e.d)+'</div></div></div>').join('');
    el.innerHTML='<div class="ws-data-scrim" onclick="wsCloseProfile()"></div>'+
      '<div class="ws-data-sheet">'+
        '<div class="ws-data-h">About me</div>'+
        '<div class="ws-data-note">All of this stays on this device. It is never uploaded. It appears in a Coach Brief only when you copy one, and you see that text first.</div>'+

        '<div class="ws-data-sep">Bodyweight</div>'+
        '<div class="ws-data-note">The one input that changes the numbers: it unlocks strength relative to your own weight. No goal weight, no BMI, no calorie maths &mdash; this app logs and reports, nothing more.</div>'+
        (bw?('<div class="ws-data-stat"><b>'+bw.kg+'</b> kg<br><span>logged '+esc(bw.d)+(a7!=null?' &middot; 7-day average '+a7+' kg':'')+'</span></div>'):'')+
        '<input type="number" step="0.1" inputmode="decimal" id="wsWtIn" class="ws-fix-date" placeholder="Weight in kg (e.g. 76)">'+
        '<input type="date" id="wsWtDate" class="ws-fix-date" value="'+(new Date()).toISOString().slice(0,10)+'">'+
        '<div class="ws-data-btn primary" onclick="wsSaveWeight()">Log weight</div>'+
        (recent?('<div class="ws-data-sep">Recent entries</div>'+recent):'')+
        (rel.length?('<div class="ws-data-sep">Relative strength</div>'+
          rel.map(r=>'<div class="ws-fix-row"><div class="ws-fix-m"><div class="ws-fix-n">'+esc(r.name)+'</div><div class="ws-fix-s">best '+r.best+' kg</div></div><div class="wspr-v" style="min-width:auto">'+r.ratio+'&times;</div></div>').join('')+
          '<div class="ws-data-note">Estimated 1RM divided by bodyweight. The 1RM is a formula estimate, not a tested max.</div>'):'')+

        '<div class="ws-data-sep">Context for the coach</div>'+
        '<div class="ws-data-note">Optional. Each field you fill makes an AI coach less likely to guess. Leave anything blank and the brief says so explicitly rather than inventing it.</div>'+
        '<input type="number" id="wsPfYear" class="ws-fix-date" placeholder="Birth year (e.g. 1988)" value="'+esc(p.birthYear||'')+'">'+
        (age?('<div class="ws-data-note" style="margin-top:-4px">That makes you '+age+'.</div>'):'')+
        '<select id="wsPfSex" class="ws-fix-date">'+
          ['<option value="">Sex (optional)</option>','<option value="m">Male</option>','<option value="f">Female</option>','<option value="na">Prefer not to say</option>']
            .map(o=>o.replace('value="'+(p.sex||'@@')+'"','value="'+(p.sex||'@@')+'" selected')).join('')+
        '</select>'+
        '<input type="number" id="wsPfHt" class="ws-fix-date" placeholder="Height in cm (optional)" value="'+esc(p.heightCm||'')+'">'+
        '<select id="wsPfTA" class="ws-fix-date">'+
          ['<option value="">Training experience (optional)</option>','<option value="new">New to lifting</option>','<option value="returning">Coming back after a break</option>','<option value="1-3y">1-3 years</option>','<option value="3y+">3+ years</option>']
            .map(o=>o.replace('value="'+(p.trainingAge||'@@')+'"','value="'+(p.trainingAge||'@@')+'" selected')).join('')+
        '</select>'+
        '<select id="wsPfGoal" class="ws-fix-date">'+
          ['<option value="">Main goal (optional)</option>','<option value="strength">Strength</option>','<option value="muscle">Muscle size</option>','<option value="metabolic">Conditioning / fat loss</option>','<option value="general">General health</option>']
            .map(o=>o.replace('value="'+(p.goal||'@@')+'"','value="'+(p.goal||'@@')+'" selected')).join('')+
        '</select>'+
        '<textarea id="wsPfEq" class="ws-data-ta" placeholder="Equipment you have (e.g. full gym, or dumbbells and a pull-up bar)">'+esc(p.equipment||'')+'</textarea>'+
        '<textarea id="wsPfLim" class="ws-data-ta" placeholder="Injuries, limits, movements to avoid">'+esc(p.limits||'')+'</textarea>'+
        '<div class="ws-data-btn primary" onclick="wsSaveProfile()">Save</div>'+
        '<div class="ws-data-btn close" onclick="wsCloseProfile()">Close</div>'+
      '</div>';
    requestAnimationFrame(()=>el.classList.add('on'));
  };
  window.wsCloseProfile=function(){ const el=document.getElementById('wsProfSheet'); if(el) el.classList.remove('on'); };
  window.wsSaveWeight=function(){
    const i=document.getElementById('wsWtIn'), d=document.getElementById('wsWtDate');
    if(!i) return;
    const r=wsLogWeight(i.value, d?d.value:null);
    wsToastMsg(r.msg);
    if(r.ok) wsOpenProfile();
  };
  window.wsSaveProfile=function(){
    const p=wsProfile();
    const g=id=>{ const e=document.getElementById(id); return e?String(e.value||'').trim():''; };
    const y=parseInt(g('wsPfYear'),10);
    if(g('wsPfYear') && (!y||y<1900||y>new Date().getFullYear())){ wsToastMsg('Check the birth year'); return; }
    p.birthYear = y||undefined;
    const h=parseInt(g('wsPfHt'),10);
    p.heightCm = (h&&h>60&&h<260)?h:undefined;
    p.sex=g('wsPfSex')||undefined;
    p.trainingAge=g('wsPfTA')||undefined;
    p.goal=g('wsPfGoal')||undefined;
    p.equipment=g('wsPfEq').slice(0,300)||undefined;
    p.limits=g('wsPfLim').slice(0,500)||undefined;
    p.updatedAt=Date.now();
    if(typeof wsPersistFlush==='function') wsPersistFlush();
    wsToastMsg('Saved');
    wsOpenProfile();
  };
})();
