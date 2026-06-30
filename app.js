const $ = (id) => document.getElementById(id);
const KEY = 'anonsPanelPro_v2';

const defaultState = {
  saved: [], favorites: [], queue: [], history: [], settings: { theme: 'light', voiceURI: '', rate: 1, pitch: 1, volume: 1, chime: true }
};
let state = loadState();
let voices = [];
let autoTimer = null;
let isQueuePlaying = false;

const samples = [
  { category:'Müşteri', text:'Sayın müşterimiz, aracınız teslim alanında hazırdır. Lütfen danışmaya başvurunuz.' },
  { category:'Müşteri', text:'Plakası 07 ABC 123 olan aracın sahibi danışmaya beklenmektedir.' },
  { category:'Servis', text:'Servis personeli montaj alanına lütfen.' },
  { category:'Depo', text:'Depo personeli ürün teslim alanına lütfen.' },
  { category:'Personel', text:'Kasa personeli danışmaya lütfen.' },
  { category:'Acil', text:'Yetkili personel acil olarak giriş kapısına lütfen.' },
  { category:'Kampanya', text:'Sayın müşterilerimiz, kampanyalı ürünlerimiz hakkında bilgi almak için danışmaya başvurabilirsiniz.' },
  { category:'Genel', text:'Sayın müşterilerimiz, ilginiz için teşekkür eder, iyi günler dileriz.' }
];
const chips = [
  'Plakası [PLAKA] olan aracın sahibi danışmaya beklenmektedir.',
  'Sayın müşterimiz, aracınız hazırdır. Lütfen danışmaya geliniz.',
  'Depo personeli giriş kapısına gelebilir.',
  'Kasa personeli danışmaya gelebilir.',
  'Servis personeli montaj alanına gelebilir.'
];

function loadState(){
  try { return { ...defaultState, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return structuredClone(defaultState); }
}
function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function nowTR(){ return new Date().toLocaleString('tr-TR'); }
function escapeHtml(str=''){ return str.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function getText(){ return $('announcementText').value.trim(); }

function init(){
  applySettings(); bindEvents(); renderChips(); renderAll(); loadVoices();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = loadVoices;
}
function applySettings(){
  document.body.classList.toggle('dark', state.settings.theme === 'dark');
  $('rate').value = state.settings.rate; $('pitch').value = state.settings.pitch; $('volume').value = state.settings.volume;
  $('chimeBefore').checked = state.settings.chime;
  updateRangeLabels();
}
function bindEvents(){
  $('themeBtn').onclick = () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; saveState(); applySettings(); };
  $('fullscreenBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  $('speakBtn').onclick = () => speakCurrent(); $('pauseBtn').onclick = () => speechSynthesis.pause(); $('resumeBtn').onclick = () => speechSynthesis.resume(); $('stopBtn').onclick = stopSpeech;
  $('saveBtn').onclick = saveAnnouncement; $('queueBtn').onclick = () => addQueue(getText()); $('favoriteBtn').onclick = () => addFavorite(getText()); $('clearTextBtn').onclick = () => $('announcementText').value = '';
  $('seedBtn').onclick = seedSamples; $('playQueueBtn').onclick = playQueue; $('clearQueueBtn').onclick = () => { state.queue=[]; saveState(); renderQueue(); };
  $('startAutoBtn').onclick = startAuto; $('stopAutoBtn').onclick = stopAuto; $('clearHistoryBtn').onclick = () => { state.history=[]; saveState(); renderHistory(); };
  $('searchSaved').oninput = renderSaved; $('filterCategory').onchange = renderSaved;
  ['rate','pitch','volume'].forEach(id => $(id).oninput = () => { state.settings[id] = Number($(id).value); saveState(); updateRangeLabels(); });
  $('chimeBefore').onchange = () => { state.settings.chime = $('chimeBefore').checked; saveState(); };
  $('voiceSelect').onchange = () => { state.settings.voiceURI = $('voiceSelect').value; saveState(); };
  $('exportBtn').onclick = exportData; $('importInput').onchange = importData;
}
function updateRangeLabels(){ $('rateValue').textContent=(+$('rate').value).toFixed(2); $('pitchValue').textContent=(+$('pitch').value).toFixed(2); $('volumeValue').textContent=(+$('volume').value).toFixed(2); }

function loadVoices(){
  if (!('speechSynthesis' in window)) { $('voiceStatus').textContent='Bu tarayıcı seslendirme desteklemiyor'; return; }
  voices = speechSynthesis.getVoices().sort((a,b)=> (b.lang.startsWith('tr') - a.lang.startsWith('tr')) || a.name.localeCompare(b.name));
  const sel = $('voiceSelect'); sel.innerHTML = '';
  voices.forEach(v => {
    const opt=document.createElement('option'); opt.value=v.voiceURI; opt.textContent=`${v.name} (${v.lang})${v.default?' - Varsayılan':''}`; sel.appendChild(opt);
  });
  const trVoice = voices.find(v => v.lang.toLowerCase().startsWith('tr'));
  if (!state.settings.voiceURI && trVoice) state.settings.voiceURI = trVoice.voiceURI;
  if (state.settings.voiceURI) sel.value = state.settings.voiceURI;
  $('voiceStatus').textContent = voices.length ? `${voices.length} ses bulundu` : 'Ses bulunamadı';
}
function selectedVoice(){ return voices.find(v => v.voiceURI === $('voiceSelect').value) || voices.find(v => v.lang.toLowerCase().startsWith('tr')) || voices[0]; }
function chime(){
  if (!$('chimeBefore').checked) return Promise.resolve();
  return new Promise(resolve => {
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const play = (freq, start) => { const o=ctx.createOscillator(); const g=ctx.createGain(); o.frequency.value=freq; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001, ctx.currentTime+start); g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime+start+.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+start+.35); o.start(ctx.currentTime+start); o.stop(ctx.currentTime+start+.38); };
      play(880,0); play(660,.42); setTimeout(resolve, 900);
    } catch { resolve(); }
  });
}
function speak(text, opts={}){
  return new Promise(async (resolve,reject)=>{
    if (!text) return reject('Metin boş');
    if (!('speechSynthesis' in window)) return reject('Desteklenmiyor');
    speechSynthesis.cancel();
    if (opts.chime !== false) await chime();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang='tr-TR'; utter.voice=selectedVoice(); utter.rate=Number($('rate').value); utter.pitch=Number($('pitch').value); utter.volume=Number($('volume').value);
    utter.onend=resolve; utter.onerror=resolve;
    speechSynthesis.speak(utter);
  });
}
async function speakWithRepeat(text, count=1, delay=0){
  for(let i=0;i<count;i++){ await speak(text); if(i<count-1) await wait(delay*1000); }
  addHistory(text);
}
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function stopSpeech(){ isQueuePlaying=false; speechSynthesis.cancel(); }
function speakCurrent(){
  const text=getText(); if(!text) return alert('Önce anons metni yaz knk.');
  speakWithRepeat(text, Number($('repeatCount').value)||1, Number($('repeatDelay').value)||0);
}

function saveAnnouncement(){
  const text=getText(); if(!text) return alert('Kaydetmek için metin yaz knk.');
  state.saved.unshift({ id:uid(), text, category:$('categorySelect').value, createdAt:nowTR() }); saveState(); renderAll();
}
function addQueue(text){ if(!text) return alert('Sıraya eklemek için metin yaz knk.'); state.queue.push({id:uid(),text,createdAt:nowTR()}); saveState(); renderQueue(); }
function addFavorite(text){ if(!text) return alert('Favoriye eklemek için metin yaz knk.'); state.favorites.unshift({id:uid(),text,createdAt:nowTR()}); saveState(); renderFavorites(); }
function addHistory(text){ state.history.unshift({id:uid(), text, createdAt:nowTR()}); state.history = state.history.slice(0,50); saveState(); renderHistory(); }
async function playQueue(){
  if(!state.queue.length) return alert('Sırada anons yok knk.'); isQueuePlaying=true;
  for(const q of [...state.queue]){ if(!isQueuePlaying) break; markPlaying(q.id); await speak(q.text); addHistory(q.text); await wait(700); }
  isQueuePlaying=false; markPlaying(null);
}
function markPlaying(id){ document.querySelectorAll('.item').forEach(el=>el.classList.toggle('playing', el.dataset.id===id)); }

function seedSamples(){ samples.forEach(s=>state.saved.unshift({id:uid(),...s,createdAt:nowTR()})); saveState(); renderAll(); }
function startAuto(){
  const text=$('autoText').value.trim(); const mins=Number($('autoMinutes').value)||30; const rep=Number($('autoRepeat').value)||1;
  if(!text) return alert('Otomatik anons metni yaz knk.'); stopAuto(); $('autoStatus').textContent=`Açık - ${mins} dk`;
  autoTimer=setInterval(()=>speakWithRepeat(text, rep, 2), mins*60*1000); speakWithRepeat(text, rep, 2);
}
function stopAuto(){ if(autoTimer) clearInterval(autoTimer); autoTimer=null; $('autoStatus').textContent='Kapalı'; }

function renderChips(){ $('quickTemplates').innerHTML = chips.map(c=>`<button class="chip" data-chip="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join(''); document.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{$('announcementText').value=b.dataset.chip;}); }
function renderAll(){ renderCategories(); renderSaved(); renderQueue(); renderFavorites(); renderHistory(); }
function renderCategories(){ const cats=['all',...new Set([...state.saved.map(x=>x.category),...samples.map(x=>x.category)])]; $('filterCategory').innerHTML = cats.map(c=>`<option value="${c}">${c==='all'?'Tüm kategoriler':c}</option>`).join(''); }
function renderSaved(){
  const q=$('searchSaved').value.toLowerCase(); const cat=$('filterCategory').value;
  const arr=state.saved.filter(x=>(cat==='all'||x.category===cat) && x.text.toLowerCase().includes(q));
  $('savedList').innerHTML = arr.length? arr.map(itemHtmlSaved).join('') : '<div class="empty">Kayıtlı anons yok.</div>'; bindItemButtons();
}
function itemHtmlSaved(x){ return `<div class="item" data-id="${x.id}"><div class="itemText">${escapeHtml(x.text)}</div><div class="itemMeta">${escapeHtml(x.category||'Genel')} • ${x.createdAt}</div><div class="itemActions"><button data-act="play" data-text="${escapeHtml(x.text)}">Oku</button><button data-act="edit" data-text="${escapeHtml(x.text)}">Düzenle</button><button data-act="queue" data-text="${escapeHtml(x.text)}">Sıraya</button><button data-act="fav" data-text="${escapeHtml(x.text)}">Favori</button><button class="danger" data-act="delSaved" data-id="${x.id}">Sil</button></div></div>`; }
function renderQueue(){ $('queueCount').textContent=`${state.queue.length} anons`; $('queueList').innerHTML=state.queue.length?state.queue.map(x=>`<div class="item" data-id="${x.id}"><div class="itemText">${escapeHtml(x.text)}</div><div class="itemMeta">${x.createdAt}</div><div class="itemActions"><button data-act="play" data-text="${escapeHtml(x.text)}">Oku</button><button class="danger" data-act="delQueue" data-id="${x.id}">Çıkar</button></div></div>`).join(''):'<div class="empty">Sıra boş.</div>'; bindItemButtons(); }
function renderFavorites(){ $('favoriteList').innerHTML=state.favorites.length?state.favorites.map(x=>`<div class="item"><div class="itemText">${escapeHtml(x.text)}</div><div class="itemMeta">${x.createdAt}</div><div class="itemActions"><button data-act="play" data-text="${escapeHtml(x.text)}">Oku</button><button data-act="edit" data-text="${escapeHtml(x.text)}">Düzenle</button><button data-act="queue" data-text="${escapeHtml(x.text)}">Sıraya</button><button class="danger" data-act="delFav" data-id="${x.id}">Sil</button></div></div>`).join(''):'<div class="empty">Favori yok.</div>'; bindItemButtons(); }
function renderHistory(){ $('historyList').innerHTML=state.history.length?state.history.map(x=>`<div class="item"><div class="itemText">${escapeHtml(x.text)}</div><div class="itemMeta">${x.createdAt}</div><div class="itemActions"><button data-act="play" data-text="${escapeHtml(x.text)}">Tekrar oku</button><button data-act="queue" data-text="${escapeHtml(x.text)}">Sıraya</button></div></div>`).join(''):'<div class="empty">Geçmiş boş.</div>'; bindItemButtons(); }
function bindItemButtons(){
  document.querySelectorAll('[data-act]').forEach(btn=>btn.onclick=()=>{
    const act=btn.dataset.act, text=btn.dataset.text, id=btn.dataset.id;
    if(act==='play') speakWithRepeat(text,1,0); if(act==='edit') { $('announcementText').value=text; window.scrollTo({top:0,behavior:'smooth'}); }
    if(act==='queue') addQueue(text); if(act==='fav') addFavorite(text);
    if(act==='delSaved'){ state.saved=state.saved.filter(x=>x.id!==id); saveState(); renderAll(); }
    if(act==='delQueue'){ state.queue=state.queue.filter(x=>x.id!==id); saveState(); renderQueue(); }
    if(act==='delFav'){ state.favorites=state.favorites.filter(x=>x.id!==id); saveState(); renderFavorites(); }
  });
}

function exportData(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='anons-paneli-yedek.json'; a.click(); URL.revokeObjectURL(a.href); }
function importData(e){ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ state={...defaultState,...JSON.parse(reader.result)}; saveState(); applySettings(); renderAll(); alert('Yedek yüklendi knk.'); }catch{ alert('Yedek dosyası okunamadı.'); } }; reader.readAsText(file); }

init();
