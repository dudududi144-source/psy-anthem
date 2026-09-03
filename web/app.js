// PSY ANTHEM - web/app.js  (Hyperstage UI v3.6)
// Presentation layer over the WHAT engine (engine.mjs) and HOW synth (synth.js).
import { createAnthemEngine, AnthemIntent, EnergyCurve } from './engine.mjs';
import { PsySynthBrowser, midiToFreq } from './synth.js';
import { PRESETS, PRESET_CATEGORIES, DEFAULT_VOICE_PRESETS } from './presets.js';
import { createStateStore } from './state.js';

console.info('[PSY ANTHEM] Hyperstage v3.6 loaded - app.js module OK');

// ---------- shell state store + global error boundaries ----------
export const appState = createStateStore({ status: 'ready', error: null, playing: false });
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    appState.set({ error: ev && ev.message ? String(ev.message) : 'unknown error' });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev && ev.reason;
    appState.set({ error: reason && reason.message ? String(reason.message) : String(reason || 'unknown error') });
  });
}

// ---------- constants ----------
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const VOICE_COLORS = ['#ff2ec4','#2ee6ff','#a06bff','#ffb02e'];
const VOICE_NAMES = ['Lead','Harmony','Counter','Bass'];
const MODES = ['minor','major','dorian','phrygian','lydian','mixolydian','harmonicMinor','melodicMinor','hungarianMinor','doubleHarmonicMajor'];
const MIDI_PROGRAMS = [0,80,24,33];
const MIDI_DIVISION = 480;
const INTENTS = [
  { id: AnthemIntent.EUPHORIC_TRANCE, icon: '✨', name: 'Euphoric', desc: 'uplifting leads, bright arcs' },
  { id: AnthemIntent.PROGRESSIVE,     icon: '🌊', name: 'Progressive', desc: 'deep rolling groove' },
  { id: AnthemIntent.DARK_PSY,        icon: '🌑', name: 'Dark Psy', desc: 'twisted, nocturnal, fast' },
  { id: AnthemIntent.EMOTIONAL_BREAKDOWN, icon: '💔', name: 'Emotional', desc: 'melodic breakdown core' },
  { id: AnthemIntent.FOREST,          icon: '🌲', name: 'Forest', desc: 'organic, earthy textures' },
  { id: AnthemIntent.FULL_ON,         icon: '🔥', name: 'Full-On', desc: 'driving peak energy' },
  { id: AnthemIntent.EMOTIONAL_LEAD,  icon: '🎻', name: 'Emotional Lead', desc: 'singing lead lines' },
];
const CURVES = [
  { id: EnergyCurve.FLAT,       name: 'Flat',       d: 'M2 12 L38 12' },
  { id: EnergyCurve.ARC,        name: 'Arc',        d: 'M2 16 Q20 2 38 16' },
  { id: EnergyCurve.BUILD_DROP, name: 'Build→Drop', d: 'M2 17 L26 6 L26 16 L38 12' },
  { id: EnergyCurve.WAVE,       name: 'Wave',       d: 'M2 12 C8 4 14 18 20 10 C26 3 32 17 38 9' },
  { id: EnergyCurve.CUSTOM,     name: 'Custom',     d: 'M2 14 C10 4 16 16 24 7 S36 12 38 6' },
];
const CUSTOM_CURVE_DEFAULT = [{position:0,energy:0.25},{position:0.35,energy:0.85},{position:0.6,energy:0.45},{position:1,energy:0.9}];
const pitchName = (p) => NOTE_NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
const $ = (id) => document.getElementById(id);

// ---------- runtime state ----------
const history = [];
let historyIndex = -1;
let synth = null;
let isPlaying = false;
let playDurationSec = 0;
let playStartCtxTime = 0;
let progressRaf = 0;
let vizRaf = 0;

// ---------- SMF encoder (browser port of src/export/midi.ts) ----------
function varLen(value){ const s=[value&0x7f]; let v=value>>>7; while(v>0){s.push((v&0x7f)|0x80); v>>>=7;} return s.reverse(); }
function pushU32(a,v){ a.push((v>>>24)&0xff,(v>>>16)&0xff,(v>>>8)&0xff,v&0xff); }
function pushU16(a,v){ a.push((v>>>8)&0xff,v&0xff); }
export function midiFromOutput(out, bpm){
  const byChannel = new Map();
  for (const e of out.events){ if(e.type!=='note')continue; if(!byChannel.has(e.channel))byChannel.set(e.channel,[]); byChannel.get(e.channel).push(e); }
  const channels = Array.from(byChannel.keys()).sort((a,b)=>a-b);
  const tracks=[];
  for(const ch of channels){
    const evs=byChannel.get(ch); const items=[];
    if(ch===channels[0]){
      const uspq=Math.round(60000000/Math.max(1,bpm));
      items.push({tick:0,order:-2,bytes:[0xff,0x51,0x03,(uspq>>>16)&0xff,(uspq>>>8)&0xff,uspq&0xff]});
      items.push({tick:0,order:-1,bytes:[0xff,0x58,0x04,0x04,0x02,0x18,0x08]});
    }
    items.push({tick:0,order:0,bytes:[0xc0|(ch&0x0f), MIDI_PROGRAMS[ch]!==undefined?MIDI_PROGRAMS[ch]:0]});
    for(const e of evs){
      const on=Math.max(0,Math.round(e.timestamp*MIDI_DIVISION));
      const off=on+Math.max(1,Math.round(e.duration*MIDI_DIVISION));
      items.push({tick:off,order:0,bytes:[0x80|(ch&0x0f),e.data.pitch&0x7f,0]});
      items.push({tick:on,order:1,bytes:[0x90|(ch&0x0f),e.data.pitch&0x7f,e.data.velocity&0x7f]});
    }
    items.sort((a,b)=>a.tick-b.tick||a.order-b.order);
    const body=[]; let last=0;
    for(const it of items){ for(const b of varLen(it.tick-last))body.push(b); for(const b of it.bytes)body.push(b); last=it.tick; }
    for(const b of varLen(0))body.push(b); body.push(0xff,0x2f,0x00);
    const chunk=[0x4d,0x54,0x72,0x6b]; pushU32(chunk,body.length); for(const b of body)chunk.push(b);
    tracks.push(chunk);
  }
  const all=[0x4d,0x54,0x68,0x64]; pushU32(all,6); pushU16(all,1); pushU16(all,tracks.length); pushU16(all,MIDI_DIVISION);
  for(const t of tracks) for(const b of t) all.push(b);
  return Uint8Array.from(all);
}
function downloadBlob(bytes, filename, mime){
  const blob=new Blob([bytes],{type:mime}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

// ---------- on-page debug strip (visible diagnostics) ----------
const dbgState={audio:'—',last:'boot'};
function dbg(msg){
  dbgState.last=msg;
  const el=$('debugStrip');
  if(el) el.textContent='Hyperstage v3.6 · audio: '+dbgState.audio+' · last: '+msg;
}

// ---------- toast / status ----------
let toastTimer=0;
function toast(msg, kind){
  const t=$('toast'); if(!t)return;
  t.textContent=msg; t.className='toast show '+(kind||'info');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{t.className='toast';},4200);
}
appState.subscribe((state)=>{
  const led=$('statusLed'); const txt=$('statusText');
  if(txt) txt.textContent = state.status;
  if(led) led.className='led '+(state.status==='playing'?'led-play':state.status==='error'?'led-err':'led-ready');
});

// ---------- raw beep: hardware/path bisection test ----------
function rawBeep(s){
  const t=s.ctx.currentTime;
  const o=s.ctx.createOscillator(); const g=s.ctx.createGain();
  o.type='sine'; o.frequency.value=660;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.5,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
  o.connect(g); g.connect(s.ctx.destination);
  o.start(t); o.stop(t+0.65);
}

// ---------- synth ----------
function ensureSynth(){
  if(synth) return synth;
  synth = new PsySynthBrowser(new (window.AudioContext||window.webkitAudioContext)(), { PRESETS, defaults: DEFAULT_VOICE_PRESETS });
  synth.onFinish = ()=>{ setPlaying(false); };
  applyMacros(); applyTrackVolumes();
  if(synth.ctx && synth.ctx.state==='suspended'){
    synth.ctx.resume().catch(()=>{ /* needs a user gesture - will retry on PLAY */ });
  }
  dbgState.audio=synth.ctx?String(synth.ctx.state):'—';
  dbg('synth created · ctx='+dbgState.audio);
  return synth;
}
function applyMacros(){
  if(!synth) return;
  synth.setMasterCutoff(parseFloat($('masterCutoff').value));
  synth.setReverbSend(parseFloat($('reverbSend').value)/100);
  synth.setDelaySend(parseFloat($('delaySend').value)/100);
  synth.setMasterDrive(parseFloat($('masterDrive').value)/100);
}
function applyTrackVolumes(){
  if(!synth) return;
  for(let ch=0; ch<4; ch++){ const el=$('trackVol'+ch); if(el) synth.setTrackVolume(ch, parseFloat(el.value)/100); }
}

// ---------- controls <-> config ----------
function buildBasicSelects(){
  const intent=$('intent'); intent.innerHTML='';
  for(const it of INTENTS){ const o=document.createElement('option'); o.value=it.id; o.textContent=it.icon+' '+it.name; intent.appendChild(o); }
  const curve=$('curve'); curve.innerHTML='';
  for(const c of CURVES){ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; curve.appendChild(o); }
  const root=$('root'); root.innerHTML='';
  for(let i=0;i<12;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=NOTE_NAMES[i]; root.appendChild(o); }
  const mode=$('mode'); mode.innerHTML='';
  for(const m of MODES){ const o=document.createElement('option'); o.value=m; o.textContent=m; mode.appendChild(o); }
  const density=$('density'); density.innerHTML='';
  for(const d of ['sparse','medium','dense']){ const o=document.createElement('option'); o.value=d; o.textContent=d; density.appendChild(o); }
  density.value='medium';
  const harmony=$('harmony'); harmony.innerHTML='';
  for(const h of ['simple','standard','complex']){ const o=document.createElement('option'); o.value=h; o.textContent=h; harmony.appendChild(o); }
  harmony.value='standard';
}
function readConfig(){
  const cfg={
    seed: parseInt($('seed').value,10)||0,
    intent: $('intent').value,
    scale:{ root: parseInt($('root').value,10)||0, mode: $('mode').value||'minor' },
    energyCurve: $('curve').value,
    targetRange:{ min:48, max:84 },
    voices: parseInt($('voices').value,10)||3,
    bars: parseInt($('bars').value,10)||16,
    bpm: 140,
  };
  const d=$('density').value; if(d) cfg.density=d;
  const h=$('harmony').value; if(h) cfg.harmonyComplexity=h;
  if($('loopMode').checked) cfg.loopMode=true;
  if($('callResponse').checked) cfg.callResponse=true;
  if(cfg.energyCurve===EnergyCurve.CUSTOM) cfg.customCurve=CUSTOM_CURVE_DEFAULT;
  return cfg;
}
function applyConfigToControls(cfg){
  $('seed').value=cfg.seed; $('intent').value=cfg.intent; $('curve').value=cfg.energyCurve;
  $('root').value=String(cfg.scale.root); $('mode').value=cfg.scale.mode;
  $('voices').value=String(cfg.voices); $('bars').value=String(cfg.bars);
  if(cfg.density) $('density').value=cfg.density;
  if(cfg.harmonyComplexity) $('harmony').value=cfg.harmonyComplexity;
  $('loopMode').checked=!!cfg.loopMode; $('callResponse').checked=!!cfg.callResponse;
}

// ---------- generation ----------
function generate(){
  appState.set({error:null, status:'generating'});
  const cfg=readConfig();
  let out=null;
  try { out=createAnthemEngine(cfg).generate(); }
  catch(e){ appState.set({error:'Config error: '+(e&&e.message?e.message:String(e)), status:'error'}); toast('Config error','error'); return; }
  if(!out){ appState.set({error:'Solver failed for this config. Try another seed.', status:'error'}); toast('Solver failed','error'); return; }
  history.push({config:cfg,out}); if(history.length>10)history.shift();
  historyIndex=history.length-1;
  renderCurrent();
  const meta=out.metadata||{};
  dbg('generated · '+out.events.length+' events · seed '+cfg.seed);
  console.info('[PSY ANTHEM] generated', out.events.length, 'events, seed', cfg.seed);
  toast('Anthem generated · seed '+cfg.seed+' · '+(meta.generationTimeMs||0)+'ms','ok');
  appState.set({status:'ready'});
}
function navigate(delta){
  const next=historyIndex+delta;
  if(next<0||next>=history.length) return;
  historyIndex=next; renderCurrent();
}
function currentEntry(){ return historyIndex>=0&&historyIndex<history.length?history[historyIndex]:null; }

function renderCurrent(){
  const entry=currentEntry(); if(!entry) return;
  stopPlayback();
  applyConfigToControls(entry.config);
  renderRoll(entry.out,entry.config);
  renderStats(entry.out,entry.config);
  renderPlayFrom(entry.config);
  renderInsights(entry.out);
  const meta=entry.out.metadata||{};
  $('trackTitle').textContent=(entry.config.intent||'')+' · seed '+meta.seed;
  $('trackMeta').textContent=(meta.bars||entry.config.bars)+' bars · '+(meta.voices||entry.config.voices)+' voices · '+(meta.generationTimeMs||0)+'ms';
  $('play').disabled=false;
  const q=meta.artisticQuality!==undefined?meta.artisticQuality:(meta.memorabilityScore!==undefined?meta.memorabilityScore:null);
  $('qualityBadge').textContent = q!==null? (q+'/100') : (meta.quality||'—');
  updateNavButtons();
}
function updateNavButtons(){
  $('prev').disabled = historyIndex<=0;
  $('next').disabled = historyIndex>=history.length-1;
  $('histLabel').textContent = history.length? (historyIndex+1)+'/'+history.length : '0/0';
}
function renderPlayFrom(cfg){
  const sel=$('playFrom'); const prev=parseInt(sel.value,10)||1; sel.innerHTML='';
  for(let b=1;b<=cfg.bars;b++){ const o=document.createElement('option'); o.value=String(b); o.textContent=String(b); sel.appendChild(o); }
  sel.value=String(Math.min(prev,cfg.bars));
}

function rr(g,x,y,w,h,r){
  if(typeof g.roundRect==='function'){ g.beginPath(); g.roundRect(x,y,w,h,r); return; }
  const q=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+q,y);
  g.arcTo(x+w,y,x+w,y+h,q);
  g.arcTo(x+w,y+h,x,y+h,q);
  g.arcTo(x,y+h,x,y,q);
  g.arcTo(x,y,x+w,y,q);
  g.closePath();
}

// ---------- piano roll ----------
function renderRoll(out, cfg){
  const cv=$('roll'); if(!cv) return;
  const dpr=window.devicePixelRatio||1;
  const rect=cv.getBoundingClientRect();
  cv.width=Math.floor(rect.width*dpr); cv.height=Math.floor(rect.height*dpr);
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  const W=rect.width,H=rect.height;
  g.clearRect(0,0,W,H);
  const bg=g.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#0b0f1e'); bg.addColorStop(1,'#070a14');
  g.fillStyle=bg; g.fillRect(0,0,W,H);
  const notes=out.events.filter(e=>e.type==='note');
  const beats=Math.max(1,cfg.bars*4);
  if(notes.length===0) return;
  let minP=127,maxP=0;
  for(const n of notes){ if(n.data.pitch<minP)minP=n.data.pitch; if(n.data.pitch>maxP)maxP=n.data.pitch; }
  minP=Math.max(0,minP-2); maxP=Math.min(127,maxP+2);
  const rows=maxP-minP+1, rowH=H/rows;
  g.strokeStyle='rgba(255,255,255,0.05)'; g.lineWidth=1;
  for(let b=0;b<=cfg.bars;b++){ const x=(b*4/beats)*W; g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke(); }
  for(const n of notes){
    const x=(n.timestamp/beats)*W;
    const w=Math.max(3,(n.duration/beats)*W-1.5);
    const y=H-(n.data.pitch-minP+1)*rowH+0.5;
    const h=Math.max(2.5,rowH-1.5);
    g.fillStyle=VOICE_COLORS[n.channel%4];
    g.globalAlpha=0.35+(n.data.velocity/127)*0.6;
    rr(g,x,y,w,h,2.5); g.fill();
    g.globalAlpha=1;
  }
}
function rollHit(mx,my,out,cfg){
  const cv=$('roll'); const rect=cv.getBoundingClientRect();
  const W=rect.width,H=rect.height; const beats=Math.max(1,cfg.bars*4);
  const notes=out.events.filter(e=>e.type==='note');
  let minP=127,maxP=0; for(const n of notes){ if(n.data.pitch<minP)minP=n.data.pitch; if(n.data.pitch>maxP)maxP=n.data.pitch; }
  minP=Math.max(0,minP-2); maxP=Math.min(127,maxP+2); const rows=maxP-minP+1,rowH=H/rows;
  for(let i=notes.length-1;i>=0;i--){
    const n=notes[i];
    const x=(n.timestamp/beats)*W, w=Math.max(3,(n.duration/beats)*W-1.5);
    const y=H-(n.data.pitch-minP+1)*rowH+0.5, h=Math.max(2.5,rowH-1.5);
    if(mx>=x&&mx<=x+w&&my>=y&&my<=y+h) return n;
  }
  return null;
}

// ---------- stats ----------
function renderStats(out,cfg){
  const meta=out.metadata||{};
  const items=[
    ['events',out.events.length],['bars',meta.bars||cfg.bars],['voices',meta.voices||cfg.voices],
    ['time',(meta.generationTimeMs||0)+'ms'],['memorability',meta.memorabilityScore!=null?meta.memorabilityScore+'/100':'—'],
    ['quality',meta.quality||'—'],
  ];
  $('stats').innerHTML=items.map((it)=>'<div class="stat"><span class="k">'+it[0]+'</span><span class="v">'+it[1]+'</span></div>').join('');
  $('infoPanel').innerHTML='<div class="info-line">intent <b>'+(meta.intent||'—')+'</b> · scale <b>'+(cfg.scale.mode||'—')+' '+NOTE_NAMES[((cfg.scale.root%12)+12)%12]+'</b>'+(cfg.density?' · density <b>'+cfg.density+'</b>':'')+(cfg.harmonyComplexity?' · harmony <b>'+cfg.harmonyComplexity+'</b>':'')+'</div>';
}
function renderInsights(out){
  const motif=$('motif');
  if(motif){
    motif.innerHTML='';
    const dna=out.motifDNA;
    if(dna&&dna.coreNotes){
      for(let i=0;i<dna.coreNotes.length;i++){
        const c=document.createElement('span');
        c.className='mchip';
        c.textContent=pitchName(dna.coreNotes[i])+' · '+(dna.coreRhythm[i]||0)+'b';
        motif.appendChild(c);
      }
    }
  }
  const chordsEl=$('chords');
  if(chordsEl){
    chordsEl.innerHTML='';
    const ha=out.harmonicAnalysis;
    if(ha&&ha.chords&&ha.chords.length){
      for(const c of ha.chords){
        const d=document.createElement('div');
        d.className='chord-seg';
        d.style.flexGrow=String(Math.max(0.5,c.durationBars||1));
        d.innerHTML='<span>'+NOTE_NAMES[((c.root%12)+12)%12]+'</span><em>'+c.quality+'</em>';
        chordsEl.appendChild(d);
      }
    }
  }
  const ab=$('artBreak');
  if(ab){
    ab.innerHTML='';
    const meta=out.metadata||{};
    const bd=meta.artisticBreakdown;
    if(bd){
      for(const k of Object.keys(bd)){
        const v=bd[k];
        const row=document.createElement('div');
        row.className='art-row';
        const w=Math.max(0,Math.min(100,v));
        row.innerHTML='<span class="art-k">'+k+'</span><div class="art-bar"><div class="art-fill" style="width:'+w+'%"></div></div><span class="art-v">'+v+'</span>';
        ab.appendChild(row);
      }
    }
  }
}

// ---------- transport ----------
function setPlaying(on){
  isPlaying=on;
  const statusNow=appState.get('status');
  if(on) appState.set({playing:true, status:'playing'});
  else if(statusNow==='playing') appState.set({playing:false, status:'ready'});
  else appState.set({playing:false});
  $('play').textContent=on?'⏹ STOP':'▶ PLAY';
  $('play').classList.toggle('playing',on);
  if(on) startProgressLoop(); else stopProgressLoop();
}
async function play(opts){
  const entry=currentEntry();
  if(!entry){ toast('Generate an anthem first','info'); return; }
  const s=ensureSynth();
  const restart=opts&&opts.restart;
  if(isPlaying && !restart){ stopPlayback(); return; }
  if(isPlaying){ stopPlayback(); }
  try{ if(s.ctx.state==='suspended') await s.ctx.resume(); }catch(e){ /* blocked */ }
  const fromBar=parseInt($('playFrom').value,10)||1;
  const fromBeat=(fromBar-1)*4;
  dbg('scheduling '+entry.out.events.length+' events…');
  await new Promise((res)=>setTimeout(res,0));
  try {
    const dur=await s.playEvents(entry.out.events, entry.config.bpm||140, fromBeat);
    if(s.ctx && s.ctx.state!=='running'){
      try{ await s.ctx.resume(); }catch(e2){ /* still blocked */ }
    }
    if(s.ctx && s.ctx.state!=='running'){
      appState.set({status:'error'});
      dbgState.audio=String(s.ctx.state);
      dbg('PLAY blocked · ctx='+s.ctx.state);
      toast('🔇 audio blocked by the browser — click 🔊 once, then PLAY again','error');
      console.warn('psy-anthem: AudioContext state is', s.ctx.state, '- autoplay policy blocked it');
      return;
    }
    playDurationSec=dur||0; playStartCtxTime=s._t0||s.ctx.currentTime;
    setPlaying(true);
    dbgState.audio=String(s.ctx.state);
    dbg('PLAY ok · '+entry.out.events.length+' events · '+Math.round(dur||0)+'s · ctx='+s.ctx.state);
    console.info('[PSY ANTHEM] PLAY scheduled', entry.out.events.length, 'events · ctx=', s.ctx.state);
    toast('▶ playing '+Math.round(dur||0)+'s ('+entry.out.events.length+' events)','ok');
  } catch(e){
    appState.set({error:'Playback failed: '+(e&&e.message?e.message:String(e))});
    toast('Playback failed','error');
  }
}
function stopPlayback(){ if(synth) synth.stop(); setPlaying(false); setProgress(0); }
function startProgressLoop(){
  stopProgressLoop();
  const step=()=>{
    if(!isPlaying) return;
    const el=performance.now();
    const ctxT=synth&&synth.ctx?synth.ctx.currentTime:0;
    const pos=Math.max(0,ctxT-playStartCtxTime);
    const frac=playDurationSec>0?Math.min(1,pos/playDurationSec):0;
    setProgress(frac);
    progressRaf=requestAnimationFrame(step);
  };
  progressRaf=requestAnimationFrame(step);
}
function stopProgressLoop(){ if(progressRaf)cancelAnimationFrame(progressRaf); progressRaf=0; }
function setProgress(frac){
  const bar=$('progressBar'); const fill=$('progressFill');
  if(bar) bar.value=String(Math.round(frac*1000)/10);
  if(fill) fill.style.width=(frac*100).toFixed(2)+'%';
  const cur=frac*playDurationSec;
  $('posLabel').textContent=fmtT(cur)+' / '+fmtT(playDurationSec);
}
function fmtT(s){ if(!isFinite(s))s=0; const m=Math.floor(s/60); const r=s-m*60; return m+':'+(r<10?'0':'')+r.toFixed(1); }
function seek(){
  const entry=currentEntry(); if(!entry) return;
  const frac=parseFloat($('progressBar').value)/100;
  const beat=frac*(entry.config.bars*4);
  const bar=Math.max(1,Math.floor(beat/4)+1);
  $('playFrom').value=String(bar);
  if(isPlaying) play({restart:true});
}

// ---------- visualizer ----------
function startViz(){
  if(vizRaf) return;
  const cv=$('viz'); if(!cv) return;
  const loop=()=>{
    vizRaf=requestAnimationFrame(loop);
    const dpr=window.devicePixelRatio||1; const rect=cv.getBoundingClientRect();
    cv.width=Math.floor(rect.width*dpr); cv.height=Math.floor(rect.height*dpr);
    const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
    const W=rect.width,H=rect.height; g.clearRect(0,0,W,H);
    const t=performance.now()/600;
    const bars=48;
    for(let i=0;i<bars;i++){
      const amp=isPlaying?(0.3+0.7*Math.abs(Math.sin(i*0.35+t)*Math.cos(i*0.13-t*0.7))):0.12;
      const h=amp*(H-8);
      const hue=(i/bars)*280+180;
      g.fillStyle='hsla('+hue+',90%,62%,0.85)';
      const x=(i/bars)*W; const bw=W/bars-2;
      rr(g,x,H-h,bw,h,2); g.fill();
    }
  };
  loop();
}

// ---------- export ----------
function midiFileName(cfg){ return 'psy-anthem-seed'+cfg.seed+'-'+cfg.intent+'.mid'; }
function doDownloadMidi(){ const e=currentEntry(); if(!e)return; downloadBlob(midiFromOutput(e.out,e.config.bpm||140), midiFileName(e.config),'audio/midi'); toast('MIDI exported','ok'); }
function doDownloadJson(){ const e=currentEntry(); if(!e)return; downloadBlob(new TextEncoder().encode(JSON.stringify(e.out,null,2)),'psy-anthem-seed'+e.config.seed+'.json','application/json'); toast('JSON exported','ok'); }
async function doDownloadWav(){
  const e=currentEntry(); if(!e)return; const s=ensureSynth();
  toast('Rendering WAV offline…','info');
  try{
    const bytes=await s.renderToWav(e.out.events,e.config.bpm||140,0);
    if(bytes){ downloadBlob(bytes,'psy-anthem-seed'+e.config.seed+'.wav','audio/wav'); toast('WAV exported','ok'); }
    else { toast('WAV render not supported here','error'); }
  }catch(err){ toast('WAV render failed','error'); }
}
async function copyConfig(){
  const e=currentEntry(); const cfg=e?e.config:readConfig();
  try{ await navigator.clipboard.writeText(JSON.stringify(cfg,null,2)); toast('Config copied','ok'); }
  catch(err){ toast('Copy blocked by browser','error'); }
}

// ---------- init ----------
function buildPresetSelects(){
  const cats={ lead:PRESET_CATEGORIES.lead, harmony:PRESET_CATEGORIES.harmony, counter:PRESET_CATEGORIES.counter, bass:PRESET_CATEGORIES.bass };
  const keys=['lead','harmony','counter','bass'];
  for(let ch=0; ch<4; ch++){
    const sel=$('preset-'+keys[ch]); if(!sel) continue;
    sel.innerHTML='';
    const list=cats[keys[ch]]||Object.keys(PRESETS);
    for(const id of list){ const o=document.createElement('option'); o.value=id; o.textContent=PRESETS[id]?PRESETS[id].name:id; sel.appendChild(o); }
    if(DEFAULT_VOICE_PRESETS[ch]) sel.value=DEFAULT_VOICE_PRESETS[ch];
    sel.addEventListener('change',()=>{ const s=ensureSynth(); const patch={}; patch[ch]=sel.value; s.setPresets(patch); });
  }
}
function init(){
  buildBasicSelects();
  buildPresetSelects();
  $('generate').addEventListener('click',generate);
  $('random').addEventListener('click',()=>{ $('seed').value=String(Math.floor(Math.random()*2147483647)); generate(); });
  $('play').addEventListener('click',play);
  $('stop').addEventListener('click',stopPlayback);
  $('testSound').addEventListener('click',async ()=>{
    const btn=$('testSound');
    rawBeep(s);
    const s=ensureSynth();
    try{ if(s.ctx.state==='suspended') await s.ctx.resume(); }catch(e){ /* blocked */ }
    try{ await s.testSound(); }catch(e){ /* ignore */ }
    const ok=s.ctx && s.ctx.state==='running';
    dbgState.audio=s.ctx?String(s.ctx.state):'—';
    dbg(ok?'TEST SOUND ok':'TEST SOUND blocked · ctx='+dbgState.audio);
    console.info('[PSY ANTHEM] test sound beep sent · ctx=', dbgState.audio);
    btn.textContent=ok?'🔊 OK':'🔇 blocked';
    toast(ok?'🔊 beep sent directly to your speakers — silent? check site mute / output device':'🔇 audio is blocked by the browser/environment',ok?'ok':'error');
    setTimeout(()=>{ btn.textContent='🔊'; },3000);
  });
  $('prev').addEventListener('click',()=>navigate(-1));
  $('next').addEventListener('click',()=>navigate(1));
  $('progressBar').addEventListener('change',seek);
  $('downloadMidi').addEventListener('click',doDownloadMidi);
  $('downloadJson').addEventListener('click',doDownloadJson);
  $('downloadWav').addEventListener('click',doDownloadWav);
  $('copyConfig').addEventListener('click',copyConfig);
  ['masterCutoff','reverbSend','delaySend','masterDrive'].forEach(id=>$(id).addEventListener('input',()=>{ ensureSynth(); applyMacros(); }));
  for(let ch=0;ch<4;ch++){ const el=$('trackVol'+ch); if(el) el.addEventListener('input',()=>{ ensureSynth(); applyTrackVolumes(); }); }
  const roll=$('roll');
  roll.addEventListener('click',(ev)=>{
    const entry=currentEntry(); if(!entry)return;
    const rect=roll.getBoundingClientRect();
    const n=rollHit(ev.clientX-rect.left,ev.clientY-rect.top,entry.out,entry.config);
    if(n){ const s=ensureSynth(); s.playNote(n.data.pitch,n.data.velocity); }
  });
  window.addEventListener('keydown',(ev)=>{
    const tag=ev.target&&ev.target.tagName;
    if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return;
    if(ev.code==='Space'){ ev.preventDefault(); play(); }
    else if(ev.key==='g'||ev.key==='G'){ generate(); }
  });
  window.addEventListener('resize',()=>{ const e=currentEntry(); if(e)renderRoll(e.out,e.config); });
  startViz();
  setStatusReady();
  try{
    generate();
    dbg('anthem ready · press ▶ PLAY');
  }catch(e){
    dbg('ready · press GENERATE then PLAY');
  }
}
function setStatusReady(){ appState.set({status:'ready'}); }
init();
