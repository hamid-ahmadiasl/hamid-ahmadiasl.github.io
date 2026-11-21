/* Hamid Ahmadi Asl — site assistant
   Floating chat widget with optional Cloudflare Worker backend
   (AI answers + Telegram handoff). Safe to load on every page. */

/**
 * Paste your Cloudflare Worker URL here after you deploy it, with no trailing slash.
 * Example: 'https://hamid-site-chat.your-account.workers.dev'
 * Leave empty until then — the widget will show a friendly email fallback.
 */
const WORKER_URL = 'https://hamid-site-assistant.ha-ahmadiasl.workers.dev';

const EMAIL = 'hmd.ahmadiasl@gmail.com';
const STORAGE_ID = 'ha-chat-visitor-id';
const STORAGE_SESSION = 'ha-chat-session-visitor-id';
const STORAGE_LOG = 'ha-chat-history';
const STORAGE_SEEN = 'ha-chat-last-seen';
const STORAGE_CONV = 'ha-chat-conversation-id';
const STORAGE_PREV = 'ha-chat-previous-visitors';
const STORAGE_PROFILE = 'ha-chat-profile';
const POLL_OPEN_MS = 5000;
const POLL_PENDING_MS = 30000;
const MAX_LOCAL = 80;
const ACCEPT_UPLOAD = '.pdf,.doc,.docx,.odt,.txt,.rtf,.png,.jpg,.jpeg,.xlsx,.csv,.zip';

const I18N = {
  en: {
    greeting:
      "Hi — I can answer questions about Hamid’s research, publications, experience and background, using only what’s on this site. If you’d like to reach him personally, tap Ask Hamid directly. You can also request a meeting or send him a document.",
    research: 'Research interests',
    researchPrompt: "What are Hamid’s research interests?",
    publications: 'Publications',
    publicationsPrompt: 'What has Hamid published recently?',
    experience: 'Experience',
    experiencePrompt: 'Can you summarise Hamid’s professional experience?',
    ask: 'Ask Hamid directly',
    meeting: '📅 Request a meeting',
    attach: '📎',
    attachTitle: 'Send a document to Hamid (CV, form…)',
    attachNote: 'Optional note for Hamid',
    attachSend: 'Send file',
    attachCancel: 'Cancel',
    attachPicked: 'Selected',
    title: "Hamid's Intelligent Assistant",
    subtitle: 'Ask me anything, or message Hamid directly',
    openChat: "Open Hamid's Intelligent Assistant",
    closeChat: 'Close chat',
    newChat: '🗑️ New chat',
    newChatAria: 'Start a new chat',
    hamidReplied: '💬 Hamid replied:',
    placeholder: 'Ask a question…',
    placeholderAsk: 'Write a message for Hamid…',
    placeholderMeeting: 'Answer here, or type skip / cancel…',
    yourMessage: 'Your message',
    send: 'Send',
    askNote:
      'Your message will be sent to Hamid on Telegram. He’ll reply in this window. A name and email are optional, so he can reach you — a phone number is never asked for.',
    name: 'Name',
    email: 'Email',
    optional: 'Optional',
    askHint: 'You’re now writing directly to Hamid. Tell him what you’d like to ask — he’ll reply in this chat. Follow-ups stay with him until you leave this mode.',
    askReceipt: 'Your message was sent to Hamid. You can keep writing here — his reply will appear in this chat.',
    fallback: 'The assistant isn’t connected at the moment. You can email Hamid at ' + EMAIL + '.',
    skip: 'Skip',
    cancel: 'Cancel',
    you: 'You',
    hamid: 'Hamid',
    note: 'Note',
    assistant: 'AI Assistant',
    typing: 'AI Assistant is typing',
  },
  fa: {
    greeting:
      'سلام — می‌توانم درباره پژوهش، مقالات، تجربه و پیش‌زمینه حمید، فقط بر اساس همین سایت، جواب بدهم. برای پیام مستقیم، «پیام مستقیم به حمید» را بزنید. می‌توانید درخواست جلسه بدهید یا سندی برایش بفرستید.',
    research: 'زمینه‌های پژوهش',
    researchPrompt: 'زمینه‌های پژوهش حمید چیست؟',
    publications: 'مقالات',
    publicationsPrompt: 'حمید اخیراً چه مقالاتی منتشر کرده است؟',
    experience: 'تجربه کاری',
    experiencePrompt: 'می‌توانی تجربه حرفه‌ای حمید را خلاصه کنی؟',
    ask: 'پیام مستقیم به حمید',
    meeting: '📅 درخواست جلسه',
    attach: '📎',
    attachTitle: 'ارسال سند برای حمید (رزومه، فرم و…)',
    attachNote: 'یادداشت اختیاری برای حمید',
    attachSend: 'ارسال فایل',
    attachCancel: 'لغو',
    attachPicked: 'انتخاب شد',
    title: 'دستیار هوشمند حمید',
    subtitle: 'هر سوالی دارید بپرسید یا مستقیم به حمید پیام دهید',
    openChat: 'باز کردن دستیار هوشمند حمید',
    closeChat: 'بستن گفتگو',
    newChat: '🗑️ گفتگوی تازه',
    newChatAria: 'شروع گفتگوی تازه',
    hamidReplied: '💬 حمید پاسخ داد:',
    placeholder: 'سؤال خود را بنویسید…',
    placeholderAsk: 'پیامی برای حمید بنویسید…',
    placeholderMeeting: 'اینجا پاسخ دهید، یا skip / لغو بنویسید…',
    yourMessage: 'پیام شما',
    send: 'ارسال',
    askNote:
      'پیام شما از طریق تلگرام برای حمید فرستاده می‌شود و جوابش همین‌جا می‌آید. نام و ایمیل اختیاری است تا بتواند با شما تماس بگیرد — شماره تلفن هرگز پرسیده نمی‌شود.',
    name: 'نام',
    email: 'ایمیل',
    optional: 'اختیاری',
    askHint: 'اکنون مستقیماً برای حمید می‌نویسید. سؤال‌تان را بگویید — پاسخ او همین‌جا می‌آید. پیام‌های بعدی هم برای او می‌ماند تا از این حالت خارج شوید.',
    askReceipt: 'پیام‌تان برای حمید ارسال شد. می‌توانید همین‌جا ادامه دهید — پاسخ او در این گفتگو ظاهر می‌شود.',
    fallback: 'دستیار فعلاً وصل نیست. می‌توانید به حمید ایمیل بزنید: ' + EMAIL,
    skip: 'رد کردن',
    cancel: 'لغو',
    you: 'شما',
    hamid: 'حمید',
    note: 'یادداشت',
    assistant: 'دستیار هوشمند',
    typing: 'دستیار هوشمند در حال نوشتن است',
  },
  it: {
    greeting:
      'Ciao — posso rispondere a domande su ricerca, pubblicazioni, esperienza e percorso di Hamid, usando solo ciò che è su questo sito. Per scrivergli di persona, tocca Chiedi direttamente a Hamid. Puoi anche richiedere un incontro o inviargli un documento.',
    research: 'Interessi di ricerca',
    researchPrompt: 'Quali sono gli interessi di ricerca di Hamid?',
    publications: 'Pubblicazioni',
    publicationsPrompt: 'Cosa ha pubblicato di recente Hamid?',
    experience: 'Esperienza',
    experiencePrompt: 'Puoi riassumere l’esperienza professionale di Hamid?',
    ask: 'Chiedi direttamente a Hamid',
    meeting: '📅 Richiedi un incontro',
    attach: '📎',
    attachTitle: 'Invia un documento a Hamid (CV, modulo…)',
    attachNote: 'Nota facoltativa per Hamid',
    attachSend: 'Invia file',
    attachCancel: 'Annulla',
    attachPicked: 'Selezionato',
    title: 'Assistente intelligente di Hamid',
    subtitle: 'Chiedimi qualsiasi cosa o scrivi direttamente a Hamid',
    openChat: 'Apri Assistente intelligente di Hamid',
    closeChat: 'Chiudi la chat',
    newChat: '🗑️ Nuova chat',
    newChatAria: 'Inizia una nuova chat',
    hamidReplied: '💬 Hamid ha risposto:',
    placeholder: 'Fai una domanda…',
    placeholderAsk: 'Scrivi un messaggio per Hamid…',
    placeholderMeeting: 'Rispondi qui, oppure scrivi skip / cancel…',
    yourMessage: 'Il tuo messaggio',
    send: 'Invia',
    askNote:
      'Il messaggio sarà inviato a Hamid su Telegram. Ti risponderà in questa finestra. Nome e email sono facoltativi, così può raggiungerti — un numero di telefono non viene mai chiesto.',
    name: 'Nome',
    email: 'Email',
    optional: 'Facoltativo',
    askHint: 'Stai scrivendo direttamente a Hamid. Digli cosa vorresti chiedergli — ti risponderà in questa chat. I messaggi successivi restano per lui finché non esci da questa modalità.',
    askReceipt: 'Il messaggio è stato inviato a Hamid. Puoi continuare a scrivere qui — la sua risposta apparirà in questa chat.',
    fallback: 'L’assistente non è collegato in questo momento. Puoi scrivere a Hamid: ' + EMAIL + '.',
    skip: 'Salta',
    cancel: 'Annulla',
    you: 'Tu',
    hamid: 'Hamid',
    note: 'Nota',
    assistant: 'Assistente IA',
    typing: 'Assistente IA sta scrivendo',
  },
};

function detectUiLang() {
  try {
    const html = String(document.documentElement.lang || '').toLowerCase();
    const nav = String(navigator.language || navigator.userLanguage || '').toLowerCase();
    const pick = [html, nav].find((s) => s.startsWith('fa') || s.startsWith('it') || s.startsWith('en'));
    if (pick?.startsWith('fa')) return 'fa';
    if (pick?.startsWith('it')) return 'it';
  } catch {
    /* ignore */
  }
  return 'en';
}

const LANG = detectUiLang();
const T = I18N[LANG] || I18N.en;

const $ = (s, c = document) => c.querySelector(s);

function workerBase() {
  const override = typeof window !== 'undefined' && window.__CHAT_WORKER_URL__;
  const raw = (override || WORKER_URL || '').trim().replace(/\/+$/, '');
  return raw;
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function isVisitorId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
}

function readPrevVisitors() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_PREV) || '[]');
    return Array.isArray(list) ? list.filter((row) => row && isVisitorId(row.id)) : [];
  } catch {
    return [];
  }
}

function writePrevVisitors(list) {
  try {
    localStorage.setItem(STORAGE_PREV, JSON.stringify((list || []).slice(0, 10)));
  } catch {
    /* ignore */
  }
}

function archiveVisitor(id, seenTs) {
  if (!isVisitorId(id)) return;
  const lastSeenAt = Number(seenTs) || lastSeen() || Date.now();
  const next = [{ id, lastSeen: lastSeenAt }, ...readPrevVisitors().filter((row) => row.id !== id)];
  writePrevVisitors(next);
}

function clearStaleProfile() {
  try {
    localStorage.removeItem(STORAGE_LOG);
    localStorage.removeItem(STORAGE_PROFILE);
    localStorage.removeItem('ha-chat-name');
    localStorage.removeItem('ha-chat-email');
    localStorage.removeItem('ha-chat-phone');
    localStorage.removeItem('ha-chat-meeting');
    sessionStorage.removeItem(STORAGE_LOG);
  } catch {
    /* ignore */
  }
}

function beginSession({ archiveOld = true } = {}) {
  let previous = null;
  try {
    previous = sessionStorage.getItem(STORAGE_SESSION) || localStorage.getItem(STORAGE_ID);
  } catch {
    previous = null;
  }
  if (archiveOld && previous && previous !== state.visitorId) archiveVisitor(previous, lastSeen());
  else if (archiveOld && state.visitorId) archiveVisitor(state.visitorId, lastSeen());
  else if (archiveOld && previous) archiveVisitor(previous, lastSeen());
  const id = uuid();
  state.visitorId = id;
  state.newSession = true;
  state.conversationId = null;
  try {
    sessionStorage.setItem(STORAGE_SESSION, id);
    sessionStorage.removeItem(STORAGE_LOG);
    localStorage.removeItem(STORAGE_ID);
    clearStaleProfile();
  } catch {
    /* ignore */
  }
  rotateConversationId();
  return id;
}

function visitorId() {
  if (state.visitorId && isVisitorId(state.visitorId)) return state.visitorId;
  try {
    if (!isReloadNavigation()) {
      const sid = sessionStorage.getItem(STORAGE_SESSION);
      if (isVisitorId(sid)) {
        state.visitorId = sid;
        return sid;
      }
    }
  } catch {
    /* ignore */
  }
  return beginSession({ archiveOld: true });
}

function sessionPayload() {
  const payload = {
    visitorId: visitorId(),
    conversationId: conversationId(),
    newSession: !!state.newSession,
    page: currentPage(),
  };
  try {
    if (typeof window.haVisitContext === 'function') {
      const ctx = window.haVisitContext();
      if (ctx && typeof ctx === 'object') payload.context = ctx;
    }
  } catch {
    /* ignore */
  }
  return payload;
}

function isReloadNavigation() {
  try {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    return !!(nav && nav.type === 'reload');
  } catch {
    return false;
  }
}

function conversationId() {
  try {
    let id = sessionStorage.getItem(STORAGE_CONV);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(STORAGE_CONV, id);
    }
    return id;
  } catch {
    if (!state.conversationId) state.conversationId = uuid();
    return state.conversationId;
  }
}

function rotateConversationId() {
  const id = uuid();
  try {
    sessionStorage.setItem(STORAGE_CONV, id);
  } catch {
    /* ignore */
  }
  state.conversationId = id;
  return id;
}

function clearLocalHistory() {
  try {
    sessionStorage.removeItem(STORAGE_LOG);
    localStorage.removeItem(STORAGE_LOG);
  } catch {
    /* ignore */
  }
}

function loadLocal() {
  // visitorId() already starts a new session on reload / new visit.
  visitorId();
  if (isReloadNavigation()) {
    clearLocalHistory();
    return [];
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_LOG);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveLocal(messages) {
  try {
    sessionStorage.setItem(STORAGE_LOG, JSON.stringify(messages.slice(-MAX_LOCAL)));
  } catch {
    /* private mode / quota */
  }
}

function lastSeen() {
  try {
    return Number(localStorage.getItem(STORAGE_SEEN) || 0) || 0;
  } catch {
    return 0;
  }
}

function setLastSeen(ts) {
  try {
    localStorage.setItem(STORAGE_SEEN, String(ts));
  } catch {
    /* ignore */
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRich(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1<em>$2</em>');
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  html = html.replace(
    /(&lt;mailto:)?([^\s@<]+@[^\s@<]+\.[^\s@<]+)/g,
    '<a href="mailto:$2">$2</a>',
  );
  return html.replace(/\n/g, '<br>');
}

function roleLabel(role) {
  if (role === 'hamid') return T.hamid;
  if (role === 'user') return T.you;
  if (role === 'system') return T.note;
  return T.assistant;
}

function currentPage() {
  try {
    return location.href;
  } catch {
    return 'https://hamid-ahmadiasl.github.io/';
  }
}

const SPARKLE_SVG = '<svg class="chat-sparkle" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2.1 13.85 9.15 21 12 13.85 14.85 12 21.9 10.15 14.85 3 12l7.15-2.85L12 2.1Z"/><path fill="currentColor" d="M18.15 3.35 19 5.55 21.2 6.4 19 7.25 18.15 9.45 17.3 7.25 15.1 6.4 17.3 5.55 18.15 3.35Z"/><path fill="currentColor" d="M6.35 15.15 6.95 16.65 8.45 17.25 6.95 17.85 6.35 19.35 5.75 17.85 4.25 17.25 5.75 16.65 6.35 15.15Z"/></svg>';

/* ---------- widget ---------- */

let state = {
  ready: false,
  open: false,
  askMode: false,
  meetingMode: false,
  sending: false,
  messages: [],
  pollTimer: null,
  lastTs: 0,
  pendingFile: null,
  flowPlaceholder: '',
  flowOptions: null,
  sessionFresh: true,
  conversationId: null,
  visitorId: null,
  newSession: false,
};

function chips() {
  return [
    { label: T.research, prompt: T.researchPrompt },
    { label: T.publications, prompt: T.publicationsPrompt },
    { label: T.experience, prompt: T.experiencePrompt },
    { label: T.ask, ask: true },
    { label: T.meeting, meeting: true },
  ];
}

function build() {
  if (state.ready) return;
  const root = document.createElement('div');
  root.className = 'chat-root';
  if (LANG === 'fa') root.setAttribute('lang', 'fa');
  root.innerHTML = `
    <button type="button" class="chat-launch" id="chatLaunch" aria-label="${escapeHtml(T.openChat)}" aria-expanded="false" aria-controls="chatPanel">
      <span class="chat-launch__icon" aria-hidden="true">
        ${SPARKLE_SVG}
        <svg class="chat-launch__close" viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M6.4 5.3 5.3 6.4 10.9 12l-5.6 5.6 1.1 1.1L12 13.1l5.6 5.6 1.1-1.1L13.1 12l5.6-5.6-1.1-1.1L12 10.9 6.4 5.3Z"/></svg>
      </span>
      <span class="chat-launch__dot" id="chatDot" hidden></span>
    </button>
    <section class="chat-panel" id="chatPanel" role="dialog" aria-labelledby="chatTitle" aria-modal="true" hidden>
      <header class="chat-panel__head">
        <div class="chat-panel__who">
          <span class="chat-panel__avatar" aria-hidden="true">${SPARKLE_SVG}</span>
          <div>
            <h2 id="chatTitle">${escapeHtml(T.title)}</h2>
            <p class="chat-panel__sub">${escapeHtml(T.subtitle)}</p>
          </div>
        </div>
        <div class="chat-panel__actions">
          <button type="button" class="chat-panel__new" id="chatNew" title="${escapeHtml(T.newChat)}" aria-label="${escapeHtml(T.newChatAria)}">${escapeHtml(T.newChat)}</button>
          <button type="button" class="chat-panel__x" id="chatClose" aria-label="${escapeHtml(T.closeChat)}">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.4 5.3 5.3 6.4 10.9 12l-5.6 5.6 1.1 1.1L12 13.1l5.6 5.6 1.1-1.1L13.1 12l5.6-5.6-1.1-1.1L12 10.9 6.4 5.3Z"/></svg>
          </button>
        </div>
      </header>
      <div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="chat-chips" id="chatChips"></div>
      <form class="chat-askmeta" id="chatAskMeta" hidden>
        <p class="chat-askmeta__note">${escapeHtml(T.askNote)}</p>
        <div class="chat-askmeta__fields">
          <label>${escapeHtml(T.name)} <input type="text" id="chatName" name="name" autocomplete="name" maxlength="80" placeholder="${escapeHtml(T.optional)}"></label>
          <label>${escapeHtml(T.email)} <input type="email" id="chatEmail" name="email" autocomplete="email" maxlength="120" placeholder="${escapeHtml(T.optional)}"></label>
        </div>
      </form>
      <div class="chat-attachbar" id="chatAttachBar" hidden>
        <p class="chat-attachbar__file" id="chatAttachName"></p>
        <input type="text" id="chatAttachNote" maxlength="400" placeholder="${escapeHtml(T.attachNote)}">
        <div class="chat-attachbar__actions">
          <button type="button" class="chat-chip chat-chip--ask" id="chatAttachSend">${escapeHtml(T.attachSend)}</button>
          <button type="button" class="chat-chip" id="chatAttachCancel">${escapeHtml(T.attachCancel)}</button>
        </div>
      </div>
      <div class="chat-quick" id="chatQuick" hidden></div>
      <form class="chat-compose" id="chatForm">
        <label class="visually-hidden" for="chatInput">${escapeHtml(T.yourMessage)}</label>
        <button type="button" class="chat-attach" id="chatAttach" title="${escapeHtml(T.attachTitle)}" aria-label="${escapeHtml(T.attachTitle)}">${escapeHtml(T.attach)}</button>
        <input type="file" id="chatFile" accept="${ACCEPT_UPLOAD}" hidden>
        <textarea id="chatInput" rows="1" maxlength="1500" placeholder="${escapeHtml(T.placeholder)}" required></textarea>
        <button type="submit" class="chat-send" id="chatSend" aria-label="${escapeHtml(T.send)}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3.4 12 20 3.5 14.8 20.5l-3.3-6.2-6.2-3.3L20 3.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/></svg>
        </button>
      </form>
    </section>
  `;
  document.body.appendChild(root);

  chips().forEach((chip) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-chip' + (chip.ask ? ' chat-chip--ask' : chip.meeting ? ' chat-chip--meeting' : '');
    btn.textContent = chip.label;
    btn.addEventListener('click', () => {
      if (chip.ask) enterAskMode(true);
      else if (chip.meeting) startMeeting();
      else {
        leaveModesForChat();
        sendChat(chip.prompt);
      }
    });
    $('#chatChips', root).appendChild(btn);
  });

  $('#chatLaunch', root).addEventListener('click', () => toggle());
  $('#chatClose', root).addEventListener('click', () => toggle(false));
  $('#chatNew', root).addEventListener('click', () => startNewChat());
  $('#chatForm', root).addEventListener('submit', onSubmit);
  $('#chatAttach', root).addEventListener('click', () => $('#chatFile', root)?.click());
  $('#chatFile', root).addEventListener('change', onFilePicked);
  $('#chatAttachSend', root).addEventListener('click', sendUpload);
  $('#chatAttachCancel', root).addEventListener('click', clearAttach);
  const input = $('#chatInput', root);
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#chatForm', root).requestSubmit();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.open) toggle(false);
  });

  state.ready = true;
  const cached = loadLocal();
  if (cached.length) {
    state.messages = cached;
    state.sessionFresh = false;
    rerender();
    syncLastTs();
  } else {
    startFreshWelcome({ keepLastTs: true });
  }
}

function welcomeMessage() {
  return {
    id: 'greeting-' + Date.now(),
    role: 'assistant',
    text: T.greeting,
    ts: Date.now(),
    source: 'greeting',
  };
}

function startFreshWelcome({ keepLastTs = false } = {}) {
  state.messages = [welcomeMessage()];
  state.sessionFresh = true;
  state.askMode = false;
  state.meetingMode = false;
  state.flowOptions = null;
  state.flowPlaceholder = '';
  saveLocal(state.messages);
  // A new session has no server history of its own. Do not reuse lastSeen from
  // an older visitor id, or the widget would skip genuine new replies.
  state.lastTs = 0;
  rerender();
  syncComposer();
}

function startNewChat() {
  beginSession({ archiveOld: true });
  clearLocalHistory();
  leaveModesForChat();
  startFreshWelcome({ keepLastTs: false });
}

function autosize() {
  const el = $('#chatInput');
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function syncLastTs() {
  state.lastTs = state.messages.reduce((m, x) => Math.max(m, Number(x.ts) || 0), 0);
}

function updateDot() {
  const dot = $('#chatDot');
  if (!dot) return;
  const unseen = state.messages.some((m) => m.role === 'hamid' && Number(m.ts) > lastSeen());
  dot.hidden = !unseen;
}

function markSeen() {
  const hamid = state.messages.filter((m) => m.role === 'hamid');
  if (hamid.length) setLastSeen(hamid.reduce((m, x) => Math.max(m, Number(x.ts) || 0), 0));
  updateDot();
}

function bubbleEl(msg) {
  const wrap = document.createElement('article');
  wrap.className = `chat-bubble chat-bubble--${msg.role}`;
  wrap.dataset.id = msg.id || '';
  const who = document.createElement('p');
  who.className = 'chat-bubble__who';
  who.textContent = roleLabel(msg.role);
  const body = document.createElement('div');
  body.className = 'chat-bubble__text';
  body.setAttribute('dir', 'auto');
  body.innerHTML = renderRich(msg.text);
  wrap.append(who, body);
  return wrap;
}

function rerender() {
  const log = $('#chatLog');
  if (!log) return;
  log.replaceChildren();
  state.messages.forEach((m) => log.appendChild(bubbleEl(m)));
  log.scrollTop = log.scrollHeight;
  updateDot();
}

function appendMsg(msg, persist = true) {
  if (msg.id && state.messages.some((m) => m.id === msg.id)) return;
  state.messages.push(msg);
  if (Number(msg.ts) > state.lastTs) state.lastTs = Number(msg.ts);
  const log = $('#chatLog');
  if (log) {
    log.appendChild(bubbleEl(msg));
    log.scrollTop = log.scrollHeight;
  }
  if (persist) saveLocal(state.messages);
  updateDot();
}

function mergeRemote(list) {
  let added = 0;
  for (const m of list || []) {
    if (!m || !m.text) continue;
    if (m.id && state.messages.some((x) => x.id === m.id)) continue;
    if (state.messages.some((x) => x.role === m.role && x.text === m.text && x.ts === m.ts)) continue;
    if (state.sessionFresh) {
      if (m.role !== 'hamid') {
        if (Number(m.ts) > state.lastTs) state.lastTs = Number(m.ts);
        continue;
      }
      const text = m.text.startsWith(T.hamidReplied) ? m.text : `${T.hamidReplied} ${m.text}`;
      appendMsg({ ...m, text, source: m.source || 'hamid-missed' }, false);
    } else {
      appendMsg(m, false);
    }
    added += 1;
  }
  if (added) saveLocal(state.messages);
  return added;
}

function showTyping(on) {
  const log = $('#chatLog');
  if (!log) return;
  let el = log.querySelector('.chat-typing');
  if (!on) {
    el?.remove();
    return;
  }
  if (el) return;
  el = document.createElement('div');
  el.className = 'chat-typing';
  el.setAttribute('aria-label', T.typing);
  el.innerHTML = '<span></span><span></span><span></span>';
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

function focusables() {
  const panel = $('#chatPanel');
  if (!panel) return [];
  return [...panel.querySelectorAll('button, [href], input, textarea, select')].filter(
    (el) => !el.disabled && el.offsetParent !== null && !el.hidden,
  );
}

function trapTab(e) {
  if (!state.open || e.key !== 'Tab') return;
  const list = focusables();
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function toggle(force) {
  build();
  const open = typeof force === 'boolean' ? force : !state.open;
  state.open = open;
  const panel = $('#chatPanel');
  const launch = $('#chatLaunch');
  panel.hidden = !open;
  launch.setAttribute('aria-expanded', String(open));
  launch.classList.toggle('is-open', open);
  document.documentElement.classList.toggle('chat-open', open);
  if (open) {
    markSeen();
    requestAnimationFrame(() => {
      const log = $('#chatLog');
      if (log) log.scrollTop = log.scrollHeight;
      $('#chatInput')?.focus();
    });
    document.addEventListener('keydown', trapTab);
    schedulePoll();
    pollOnce();
  } else {
    document.removeEventListener('keydown', trapTab);
    launch.focus();
    schedulePoll();
  }
}

function syncComposer() {
  const input = $('#chatInput');
  if (input) {
    if (state.meetingMode && state.flowPlaceholder) input.placeholder = state.flowPlaceholder;
    else input.placeholder = state.meetingMode ? T.placeholderMeeting : state.askMode ? T.placeholderAsk : T.placeholder;
    input.focus();
  }
  const chipsEl = $('#chatChips');
  chipsEl?.classList.toggle('is-ask', state.askMode);
  chipsEl?.classList.toggle('is-meeting', state.meetingMode);
  const meta = $('#chatAskMeta');
  if (meta) meta.hidden = !state.askMode;
  const hasQuick = Array.isArray(state.flowOptions) && state.flowOptions.length > 0;
  const skip = $('#chatMeetingSkip');
  const cancel = $('#chatMeetingCancel');
  if (skip) skip.hidden = !state.meetingMode || hasQuick;
  if (cancel) cancel.hidden = !state.meetingMode || hasQuick;
}

function applyFlowUi(data) {
  if (!data) return;
  const source = data.message?.source || '';
  const ended = source === 'meeting-submitted' || source === 'meeting-cancel';
  const hasOptions = Array.isArray(data.options);
  const hasPlaceholder = typeof data.placeholder === 'string';
  if (!hasOptions && !hasPlaceholder && !ended) return;
  if (ended || (hasOptions && data.options.length === 0 && hasPlaceholder && data.placeholder === '')) {
    state.flowOptions = null;
    state.flowPlaceholder = '';
    renderQuickReplies();
    if (state.meetingMode) enterMeetingMode(false);
    else syncComposer();
    return;
  }
  if (hasOptions) state.flowOptions = data.options;
  if (hasPlaceholder) state.flowPlaceholder = data.placeholder;
  if ((state.flowOptions && state.flowOptions.length) || state.flowPlaceholder) {
    if (!state.meetingMode) enterMeetingMode(true);
    else {
      renderQuickReplies();
      syncComposer();
    }
  } else {
    renderQuickReplies();
    syncComposer();
  }
}

function renderQuickReplies() {
  const el = $('#chatQuick');
  if (!el) return;
  const opts = state.flowOptions || [];
  el.replaceChildren();
  el.hidden = opts.length === 0;
  opts.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-chip chat-chip--quick';
    btn.textContent = opt.label || opt.value;
    btn.addEventListener('click', () => {
      const value = opt.value || opt.label || '';
      sendMeeting(value, value);
    });
    el.appendChild(btn);
  });
}

function leaveModesForChat() {
  state.askMode = false;
  state.meetingMode = false;
  syncComposer();
}

function enterAskMode(on = true) {
  const starting = on && !state.askMode;
  state.askMode = on;
  if (on) state.meetingMode = false;
  syncComposer();
  if (starting) {
    appendMsg({
      id: 'ask-hint-' + Date.now(),
      role: 'system',
      text: T.askHint,
      ts: Date.now(),
      source: 'hint',
    });
  }
}

function enterMeetingMode(on = true) {
  state.meetingMode = on;
  if (on) state.askMode = false;
  else {
    state.flowOptions = null;
    state.flowPlaceholder = '';
  }
  ensureMeetingActions();
  renderQuickReplies();
  syncComposer();
}

function ensureMeetingActions() {
  const chipsEl = $('#chatChips');
  if (!chipsEl || $('#chatMeetingSkip')) return;
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.id = 'chatMeetingSkip';
  skip.className = 'chat-chip chat-chip--meeting';
  skip.textContent = T.skip;
  skip.hidden = true;
  skip.addEventListener('click', () => sendMeeting('skip', 'skip'));
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.id = 'chatMeetingCancel';
  cancel.className = 'chat-chip';
  cancel.textContent = T.cancel;
  cancel.hidden = true;
  cancel.addEventListener('click', () => sendMeeting('cancel', 'cancel'));
  chipsEl.append(skip, cancel);
}

function offerHandoff() {
  const log = $('#chatLog');
  if (!log) return;
  log.querySelector('.chat-handoff')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'chat-handoff';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chat-chip chat-chip--ask';
  btn.textContent = T.ask;
  btn.addEventListener('click', () => {
    const lastUser = [...state.messages].reverse().find((m) => m.role === 'user' && m.source !== 'ask');
    enterAskMode(true);
    if (lastUser) {
      const input = $('#chatInput');
      if (input && !input.value.trim()) {
        input.value = lastUser.text;
        autosize();
      }
    }
  });
  const meet = document.createElement('button');
  meet.type = 'button';
  meet.className = 'chat-chip chat-chip--meeting';
  meet.textContent = T.meeting;
  meet.addEventListener('click', () => startMeeting());
  wrap.append(btn, meet);
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}

function onSubmit(e) {
  e.preventDefault();
  const input = $('#chatInput');
  const text = (input?.value || '').trim();
  if (!text || state.sending) return;
  input.value = '';
  autosize();
  if (state.meetingMode) sendMeeting(text, 'answer');
  else if (state.askMode) sendAsk(text);
  else sendChat(text);
}

async function api(path, opts = {}) {
  const base = workerBase();
  if (!base) {
    const err = new Error('offline');
    err.code = 'offline';
    throw err;
  }
  const headers = opts.headers || (opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined);
  const res = await fetch(base + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? (opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body)) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (['/chat', '/ask', '/meeting', '/upload', '/contact'].some((p) => path === p || path.startsWith(p + '?'))) state.newSession = false;
  return data;
}

function emailFallback(extra) {
  appendMsg({
    id: 'fb-' + Date.now(),
    role: 'system',
    text: (extra ? extra + ' ' : '') + T.fallback,
    ts: Date.now(),
    source: 'fallback',
  });
}

async function sendChat(text) {
  state.sessionFresh = false;
  build();
  if (state.sending) return;
  state.sending = true;
  $('#chatSend')?.setAttribute('disabled', 'true');
  appendMsg({
    id: uuid(),
    role: 'user',
    text,
    ts: Date.now(),
    source: 'chat',
  });
  showTyping(true);
  try {
    const data = await api('/chat', {
      method: 'POST',
      body: { ...sessionPayload(), message: text },
    });
    showTyping(false);
    if (data.message) appendMsg(data.message);
    else if (data.reply) {
      appendMsg({ id: uuid(), role: 'assistant', text: data.reply, ts: Date.now(), source: 'ai' });
    }
    applyFlowUi(data);
    if (data.suggestHandoff) offerHandoff();
  } catch (err) {
    showTyping(false);
    if (err.code === 'offline' || err.status === 502 || err.status === 0) emailFallback();
    else {
      appendMsg({
        id: 'err-' + Date.now(),
        role: 'system',
        text: err.message || T.fallback,
        ts: Date.now(),
        source: 'error',
      });
    }
  } finally {
    state.sending = false;
    $('#chatSend')?.removeAttribute('disabled');
  }
}

async function sendAsk(text) {
  state.sessionFresh = false;
  build();
  if (state.sending) return;
  state.sending = true;
  $('#chatSend')?.setAttribute('disabled', 'true');
  appendMsg({
    id: uuid(),
    role: 'user',
    text,
    ts: Date.now(),
    source: 'ask',
  });
  try {
    const data = await api('/ask', {
      method: 'POST',
      body: {
        ...sessionPayload(),
        message: text,
        name: ($('#chatName')?.value || '').trim(),
        email: ($('#chatEmail')?.value || '').trim(),
      },
    });
    if (data.message) appendMsg(data.message);
    else {
      appendMsg({
        id: uuid(),
        role: 'system',
        text: T.askReceipt,
        ts: Date.now(),
        source: 'ask-receipt',
      });
    }
    // Stay in handoff mode so follow-up messages still go to Hamid via /ask.
    enterAskMode(true);
  } catch (err) {
    if (err.code === 'offline' || err.status === 503 || err.status === 502) emailFallback();
    else {
      appendMsg({
        id: 'err-' + Date.now(),
        role: 'system',
        text: err.message || T.fallback,
        ts: Date.now(),
        source: 'error',
      });
    }
  } finally {
    state.sending = false;
    $('#chatSend')?.removeAttribute('disabled');
  }
}

async function startMeeting() {
  enterMeetingMode(true);
  await sendMeeting('', 'start', { pushUser: false });
}

async function sendMeeting(text, action, opts = {}) {
  state.sessionFresh = false;
  build();
  if (state.sending) return;
  state.sending = true;
  $('#chatSend')?.setAttribute('disabled', 'true');
  if (opts.pushUser !== false && text) {
    appendMsg({
      id: uuid(),
      role: 'user',
      text,
      ts: Date.now(),
      source: 'meeting',
    });
  }
  showTyping(true);
  try {
    const data = await api('/meeting', {
      method: 'POST',
      body: {
        ...sessionPayload(),
        action,
        message: text,
        lang: LANG,
        name: ($('#chatName')?.value || '').trim(),
        email: ($('#chatEmail')?.value || '').trim(),
      },
    });
    showTyping(false);
    if (data.message) appendMsg(data.message);
    else if (data.reply) {
      appendMsg({ id: uuid(), role: 'assistant', text: data.reply, ts: Date.now(), source: 'meeting-reply' });
    }
    const source = data.message?.source || '';
    if (source === 'meeting-submitted' || source === 'meeting-cancel') {
      applyFlowUi({ ...data, options: data.options || [], placeholder: data.placeholder || '' });
    } else {
      enterMeetingMode(true);
      applyFlowUi(data);
    }
  } catch (err) {
    showTyping(false);
    if (err.code === 'offline' || err.status === 502 || err.status === 503) emailFallback();
    else {
      appendMsg({
        id: 'err-' + Date.now(),
        role: 'system',
        text: err.message || T.fallback,
        ts: Date.now(),
        source: 'error',
      });
    }
  } finally {
    state.sending = false;
    $('#chatSend')?.removeAttribute('disabled');
  }
}

function onFilePicked(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  state.pendingFile = file;
  const bar = $('#chatAttachBar');
  const name = $('#chatAttachName');
  if (name) name.textContent = `${T.attachPicked}: ${file.name}`;
  if (bar) bar.hidden = false;
  $('#chatAttachNote')?.focus();
}

function clearAttach() {
  state.pendingFile = null;
  const bar = $('#chatAttachBar');
  if (bar) bar.hidden = true;
  const note = $('#chatAttachNote');
  if (note) note.value = '';
}

async function sendUpload() {
  state.sessionFresh = false;
  const file = state.pendingFile;
  if (!file || state.sending) return;
  build();
  state.sending = true;
  $('#chatSend')?.setAttribute('disabled', 'true');
  const note = ($('#chatAttachNote')?.value || '').trim();
  appendMsg({
    id: uuid(),
    role: 'user',
    text: `📎 ${file.name}${note ? ` — ${note}` : ''}`,
    ts: Date.now(),
    source: 'upload',
  });
  showTyping(true);
  try {
    const form = new FormData();
    form.append('visitorId', visitorId());
    form.append('conversationId', conversationId());
    form.append('newSession', state.newSession ? 'true' : 'false');
    try {
      const ctx = typeof window.haVisitContext === 'function' ? window.haVisitContext() : null;
      if (ctx) form.append('context', JSON.stringify(ctx));
    } catch {
      /* ignore */
    }
    form.append('file', file, file.name);
    if (note) form.append('note', note);
    form.append('page', currentPage());
    form.append('lang', LANG);
    const data = await api('/upload', { method: 'POST', body: form });
    showTyping(false);
    if (data.message) appendMsg(data.message);
    else if (data.reply) {
      appendMsg({ id: uuid(), role: 'assistant', text: data.reply, ts: Date.now(), source: 'upload-receipt' });
    }
    clearAttach();
  } catch (err) {
    showTyping(false);
    if (err.code === 'offline' || err.status === 503 || err.status === 502) emailFallback(err.message);
    else {
      appendMsg({
        id: 'err-' + Date.now(),
        role: 'system',
        text: err.message || T.fallback,
        ts: Date.now(),
        source: 'error',
      });
    }
  } finally {
    state.sending = false;
    $('#chatSend')?.removeAttribute('disabled');
  }
}

let lastPrevPoll = 0;

async function pollPreviousReplies() {
  const now = Date.now();
  if (now - lastPrevPoll < 30000) return 0;
  lastPrevPoll = now;
  const prev = readPrevVisitors();
  if (!prev.length) return 0;
  let added = 0;
  const updated = [];
  for (const row of prev) {
    try {
      const res = await api(`/messages?visitorId=${encodeURIComponent(row.id)}&since=${Number(row.lastSeen) || 0}`);
      const hamid = (res.messages || []).filter((m) => m && m.role === 'hamid' && m.text);
      let maxTs = Number(row.lastSeen) || 0;
      for (const m of hamid) {
        const text = String(m.text).startsWith(T.hamidReplied) ? m.text : `${T.hamidReplied} ${m.text}`;
        appendMsg({ ...m, text, source: m.source || 'hamid-missed' }, false);
        added += 1;
        if (Number(m.ts) > maxTs) maxTs = Number(m.ts);
      }
      updated.push({ id: row.id, lastSeen: maxTs });
    } catch {
      updated.push(row);
    }
  }
  writePrevVisitors(updated);
  if (added) saveLocal(state.messages);
  return added;
}

async function pollOnce() {
  if (!workerBase()) return;
  try {
    const since = state.lastTs || 0;
    const data = await api(`/messages?visitorId=${encodeURIComponent(visitorId())}&since=${since}`);
    let added = mergeRemote(data.messages);
    added += await pollPreviousReplies();
    if (added && state.open) markSeen();
    updateDot();
  } catch {
    /* silent — polling should not spam the UI */
  }
}

function hasPendingAsk() {
  const msgs = state.messages;
  const lastAsk = [...msgs].reverse().find((m) => m.role === 'user' && (m.source === 'ask' || m.source === 'meeting' || m.source === 'upload'));
  if (!lastAsk) return false;
  return !msgs.some((m) => m.role === 'hamid' && Number(m.ts) > Number(lastAsk.ts));
}

function schedulePoll() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
  if (!workerBase()) return;
  const ms = state.open ? POLL_OPEN_MS : hasPendingAsk() || state.askMode ? POLL_PENDING_MS : 0;
  if (!ms) return;
  state.pollTimer = setInterval(pollOnce, ms);
}

function init() {
  build();
  updateDot();
  pollOnce().then(schedulePoll);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
