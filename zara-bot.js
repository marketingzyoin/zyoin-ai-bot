(function(){

// Configuration from Webflow Head
const SHEETS = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.sheets) || '';
const SLACK  = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.slack)  || '';

// ── ZYOIN KNOWLEDGE BASE ─────────────────────────────────────
const SYSTEM_PROMPT = `You are Zara, Zyoin Group's friendly AI hiring assistant. You help companies find and hire exceptional talent.
ABOUT ZYOIN: AI-augmented recruitment company in India. Services: Permanent/Leadership Hiring, RPO, Global Hiring, Contract staffing.
ROLE: Answer questions concisely. Naturally collect Name, Email, Company, and Phone.
FORMAT: When you have lead info, append [LEAD_CAPTURED][DATA: name="X" email="X" phone="X" company="X" need="X"] to the end of your message.`;

// ── STATE ─────────────────────────────────────────────────────
let messages = [];
let leadData = { name:'', email:'', phone:'', company:'', need:'' };
let leadSent = false;
let isOpen   = false;
let isTyping = false;

// ── SEND LEAD TO SHEET + SLACK ────────────────────────────────
async function sendLead() {
  if(leadSent || !leadData.email) return;
  leadSent = true;

  const payload = {
    action: 'lead',
    timestamp: new Date().toISOString(),
    ...leadData,
    source: 'Zyoin Chatbot',
    slackUrl: SLACK,
    currentPage: window.location.pathname,
  };

  try {
    await fetch(SHEETS, {
      method: 'POST',
      mode: 'no-cors', // Lead logging doesn't need a response
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch(e) { console.error("Lead Error:", e); }
}

// ── API CALL TO CLAUDE (VIA GOOGLE SCRIPT) ────────────────────
async function askClaude(userMessage, onDone) {
  messages.push({ role: 'user', content: userMessage });

  const payload = {
    action: 'chat',
    message: userMessage,
    history: messages.slice(0, -1),
    system: SYSTEM_PROMPT
  };

  try {
    // FIXED: Use fetch to handle Google Script redirect & CORS
    const response = await fetch(SHEETS, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const reply = data.reply || "I'm sorry, I'm having trouble thinking. Please try again.";

    // Parse lead data
    const leadMatch = reply.match(/\[DATA:\s*([^\]]+)\]/);
    if(leadMatch){
      const pairs = leadMatch[1].match(/(\w+)="([^"]*)"/g) || [];
      pairs.forEach(p => {
        const m = p.match(/(\w+)="([^"]*)"/);
        if(m && leadData.hasOwnProperty(m[1])) leadData[m[1]] = m[2];
      });
    }

    const displayReply = reply.replace(/\[LEAD_CAPTURED\]/g,'').replace(/\[DATA:[^\]]*\]/g,'').trim();
    messages.push({ role: 'assistant', content: displayReply });

    if(reply.indexOf('[LEAD_CAPTURED]') > -1) sendLead();
    onDone(displayReply);

  } catch (e) {
    console.error("Zara Connection Error:", e);
    onDone("Connection issue. Please try again or email info@zyoin.com");
  }
}

// ── UI INJECTION ─────────────────────────────────────────────
function injectCSS() {
  if(document.getElementById('zchat-css')) return;
  const s = document.createElement('style');
  s.id = 'zchat-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
    #zchat-btn { position:fixed; bottom:25px; right:25px; z-index:9999; width:60px; height:60px; background:#ff7200; border-radius:50%; border:none; cursor:pointer; box-shadow:0 5px 15px rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center; transition:0.3s; }
    #zchat-win { position:fixed; bottom:100px; right:25px; z-index:9999; width:360px; height:500px; background:#0f0f14; border-radius:15px; box-shadow:0 10px 40px rgba(0,0,0,0.4); display:none; flex-direction:column; overflow:hidden; font-family:'Plus Jakarta Sans', sans-serif; }
    #zchat-win.open { display:flex; }
    #zchat-head { background:#181820; padding:15px; color:#fff; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; }
    #zchat-msgs { flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:10px; color:#e0e0e0; font-size:13px; }
    .zmsg { padding:10px 14px; border-radius:12px; max-width:85%; line-height:1.5; }
    .zbot { background:#1e1e2a; align-self:flex-start; border-bottom-left-radius:2px; }
    .zuser { background:#ff7200; color:#fff; align-self:flex-end; border-bottom-right-radius:2px; }
    #zchat-input-area { padding:10px; background:#181820; display:flex; gap:8px; border-top:1px solid #222; }
    #zchat-input { flex:1; background:#0f0f14; border:1px solid #333; color:#fff; padding:8px 12px; border-radius:8px; outline:none; resize:none; font-size:13px; }
    #zchat-send { background:#ff7200; border:none; border-radius:8px; color:#fff; padding:0 12px; cursor:pointer; }
    #zchat-typing { font-size:11px; color:#666; display:none; }
  `;
  document.head.appendChild(s);
}

function buildUI() {
  injectCSS();
  const btn = document.createElement('button');
  btn.id = 'zchat-btn';
  btn.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
  btn.onclick = () => { isOpen = !isOpen; document.getElementById('zchat-win').classList.toggle('open', isOpen); };
  document.body.appendChild(btn);

  const win = document.createElement('div');
  win.id = 'zchat-win';
  win.innerHTML = `
    <div id="zchat-head"><strong>Zara · Zyoin AI</strong><span style="cursor:pointer" onclick="document.getElementById('zchat-win').classList.remove('open')">✕</span></div>
    <div id="zchat-msgs"><div class="zmsg zbot">Hi! I'm Zara. How can I help you with your hiring today?</div><div id="zchat-typing">Zara is thinking...</div></div>
    <div id="zchat-input-area"><textarea id="zchat-input" rows="1" placeholder="Type a message..."></textarea><button id="zchat-send">Send</button></div>
  `;
  document.body.appendChild(win);

  const input = document.getElementById('zchat-input');
  const send = document.getElementById('zchat-send');

  const handleSend = () => {
    const text = input.value.trim();
    if(!text || isTyping) return;
    input.value = '';
    addMsg(text, 'zuser');
    isTyping = true;
    document.getElementById('zchat-typing').style.display = 'block';
    askClaude(text, (reply) => {
      isTyping = false;
      document.getElementById('zchat-typing').style.display = 'none';
      addMsg(reply, 'zbot');
    });
  };

  send.onclick = handleSend;
  input.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
}

function addMsg(text, cls) {
  const m = document.getElementById('zchat-msgs');
  const d = document.createElement('div');
  d.className = `zmsg ${cls}`;
  d.innerText = text;
  m.insertBefore(d, document.getElementById('zchat-typing'));
  m.scrollTop = m.scrollHeight;
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
else buildUI();

})();
