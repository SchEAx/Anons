const textEl = document.getElementById('announcementText');
const voiceSelect = document.getElementById('voiceSelect');
const rateRange = document.getElementById('rateRange');
const pitchRange = document.getElementById('pitchRange');
const rateValue = document.getElementById('rateValue');
const pitchValue = document.getElementById('pitchValue');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const savedList = document.getElementById('savedList');
const statusEl = document.getElementById('status');

const STORAGE_KEY = 'garage_anons_programi_kayitlar_v1';
let voices = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message || '';
  statusEl.style.color = isError ? '#fb7185' : '#38bdf8';
}

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function setSaved(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  const trVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('tr'));
  const list = trVoices.length ? trVoices : voices;

  voiceSelect.innerHTML = '';
  if (!list.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Varsayılan ses';
    voiceSelect.appendChild(opt);
    return;
  }

  list.forEach((voice, index) => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})`;
    if ((voice.lang || '').toLowerCase().startsWith('tr') && index === 0) opt.selected = true;
    voiceSelect.appendChild(opt);
  });
}

function selectedVoice() {
  const selectedName = voiceSelect.value;
  return voices.find(v => v.name === selectedName) || voices.find(v => (v.lang || '').toLowerCase().startsWith('tr')) || null;
}

function speak(text) {
  const message = (text || '').trim();
  if (!message) {
    setStatus('Knk önce anons metni yazalım :)', true);
    return;
  }
  if (!('speechSynthesis' in window)) {
    setStatus('Bu tarayıcı sesli okuma desteklemiyor.', true);
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'tr-TR';
  utterance.rate = Number(rateRange.value);
  utterance.pitch = Number(pitchRange.value);
  const voice = selectedVoice();
  if (voice) utterance.voice = voice;

  utterance.onstart = () => setStatus('Anons okunuyor...');
  utterance.onend = () => setStatus('Anons tamamlandı.');
  utterance.onerror = () => setStatus('Seslendirme sırasında hata oluştu.', true);
  window.speechSynthesis.speak(utterance);
}

function saveCurrent() {
  const text = textEl.value.trim();
  if (!text) {
    setStatus('Kaydetmek için önce metin yazalım knk.', true);
    return;
  }
  const items = getSaved();
  const exists = items.some(item => item.text.toLowerCase() === text.toLowerCase());
  if (exists) {
    setStatus('Bu anons zaten kayıtlı.', true);
    return;
  }
  items.unshift({ id: Date.now(), text, createdAt: new Date().toISOString() });
  setSaved(items);
  renderSaved();
  setStatus('Anons kaydedildi.');
}

function deleteItem(id) {
  const items = getSaved().filter(item => item.id !== id);
  setSaved(items);
  renderSaved();
  setStatus('Anons silindi.');
}

function editItem(id) {
  const item = getSaved().find(item => item.id === id);
  if (!item) return;
  textEl.value = item.text;
  textEl.focus();
  setStatus('Anons metne aktarıldı, düzenleyip tekrar kaydedebilirsin.');
}

function renderSaved() {
  const items = getSaved();
  savedList.innerHTML = '';

  if (!items.length) {
    savedList.innerHTML = '<div class="empty">Henüz kayıtlı anons yok.</div>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'saved-item';

    const text = document.createElement('div');
    text.className = 'saved-text';
    text.textContent = item.text;

    const actions = document.createElement('div');
    actions.className = 'saved-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'primary';
    playBtn.textContent = 'Oku';
    playBtn.onclick = () => speak(item.text);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Düzenle';
    editBtn.onclick = () => editItem(item.id);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Sil';
    delBtn.onclick = () => deleteItem(item.id);

    actions.append(playBtn, editBtn, delBtn);
    row.append(text, actions);
    savedList.appendChild(row);
  });
}

speakBtn.addEventListener('click', () => speak(textEl.value));
saveBtn.addEventListener('click', saveCurrent);
stopBtn.addEventListener('click', () => {
  window.speechSynthesis.cancel();
  setStatus('Anons durduruldu.');
});
clearBtn.addEventListener('click', () => {
  if (!getSaved().length) return;
  if (confirm('Tüm kayıtlı anonslar silinsin mi?')) {
    setSaved([]);
    renderSaved();
    setStatus('Tüm anonslar silindi.');
  }
});

rateRange.addEventListener('input', () => rateValue.textContent = Number(rateRange.value).toFixed(1));
pitchRange.addEventListener('input', () => pitchValue.textContent = Number(pitchRange.value).toFixed(1));

loadVoices();
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}
renderSaved();
