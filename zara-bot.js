(function(){

// Configuration
var SHEETS     = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.sheets) || '';
var SLACK      = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.slack)  || '';

// ── ZYOIN KNOWLEDGE BASE ─────────────────────────────────────
var SYSTEM_PROMPT = `You are Zara, Zyoin Group's friendly AI hiring assistant. You help companies find and hire exceptional talent.

ABOUT ZYOIN GROUP:
Zyoin Group is an AI-augmented recruitment company based in India with global operations. We specialize in connecting businesses with top-tier talent quickly and precisely.

OUR SERVICES:
1. Permanent Hiring, 2. Leadership Hiring, 3. Global Hiring, 4. RPO, 5. Contract Hiring, 6. Managed Recruitment, 7. Talent Intelligence, 8. Hire Meetups, 9. Payroll, 10. HR Outsourcing.

YOUR ROLE:
- Collect contact details naturally (name, email, company, phone).
- When you collect email/phone, include this EXACT marker: [LEAD_CAPTURED]
- Format collected data as: [DATA: name="X" email="X" phone="X" company="X" need="X"]
- Keep responses concise. Professional but warm.`;

// ── STATE ─────────────────────────────────────────────────────
var messages = [];
var leadData = { name:'', email:'', phone:'', company:'', need:'' };
var leadSent = false;
var isOpen   = false;
var isTyping = false;

// ── SEND LEAD TO SHEET + SLACK ────────────────────────────────
function sendLead(){
  if(leadSent || !leadData.email) return;
  leadSent = true;

  var payload = {
    timestamp:   new Date().toISOString(),
    name:        leadData.name,
    email:       leadData.email,
    phone:       leadData.phone,
    company:     leadData.company,
    need:        leadData.need,
    source:      'Zyoin Chatbot',
    slackUrl:    SLACK,
    currentPage: window.location.pathname,
  };

  fetch(SHEETS, {
    method: 'POST',
    mode: 'no-cors', // Bypass CORS for lead logging
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  }).catch(e => console.log("Lead log noted"));
}

// ── FIXED COMMUNICATION LOGIC (CORS FIX) ───────────────────────
async function askClaude(userMessage, onDone) {
  messages.push({ role:'user', content: userMessage });

  var payload = {
    action:  'chat',
    message: userMessage,
    history: messages.slice(0, -1),
    system:  SYSTEM_PROMPT,
    page:    window.location.pathname
  };

  try {
    // We send as text/plain to Google Apps Script to avoid CORS pre-flight blocks
    const response = await fetch(SHEETS, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const reply = data.reply || "I'm sorry, I couldn't process that. Please try again.";

    // Parse lead data if captured
    var leadMatch = reply.match(/\[DATA:\s*([^\]]+)\]/);
    if(leadMatch){
      var pairs = leadMatch[1].match(/(\w+)="([^"]*)"/g) || [];
      pairs.forEach(function(p){
        var m = p.match(/(\w+)="([^"]*)"/);
        if(m && leadData.hasOwnProperty(m[1])) leadData[m[1]] = m[2];
      });
    }

    var displayReply = reply
      .replace(/\[LEAD_CAPTURED\]/g,'')
      .replace(/\[DATA:[^\]]*\]/g,'')
      .trim();

    messages.push({ role:'assistant', content: displayReply });
    onDone(displayReply);

    if(reply.indexOf('[LEAD_CAPTURED]') > -1) sendLead();

  } catch (e) {
    console.error("Zara Error:", e);
    // UPDATED EMAIL TO info@zyoin.com
    onDone("Connection issue. Please try again or email info@zyoin.com");
  }
}

// ── UI LOGIC (REST OF YOUR ORIGINAL CODE) ──────────────────────
function injectCSS(){
  if(document.getElementById('zchat-css')) return;
  var s = document.createElement('style');
  s.id  = 'zchat-css';
  s.textContent = [
    '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap");',
    '#zchat-btn{position:fixed;bottom:28px;right:28px;z-index:99996;width:56px;height:56px;background:#ff7200;border:none;border-radius:50%;cursor:pointer;box-shadow:0 4px 20px rgba(255,114,0,0.45);transition:transform .2s;display:flex;align-items:center;justify-content:center;}',
    '#zchat-btn:hover{transform:scale(1.08);}',
    '#zchat-win{position:fixed;bottom:96px;right:28px;z-index:99996;width:360px;height:520px;background:#0f0f14;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;transform:scale(.95) translateY(20px);opacity:0;pointer-events:none;transition:all .3s ease;font-family:"Plus Jakarta Sans",sans-serif;}',
    '#zchat-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',
    '#zchat-head{background:#181820;padding:16px 18px;display:flex;align-items:center;gap:12px;color:#fff;}',
    '#zchat-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}',
    '.zcm-bubble{padding:10px 14px;border-radius:14px;font-size:12.5px;line-height:1.6;}',
    '.zcm.bot .zcm-bubble{background:#1e1e2a;color:#e8e8e8;}',
    '.zcm.user .zcm-bubble{background:#ff7200;color:#fff;align-self:flex-end;}',
    '#zchat-input-wrap{padding:12px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:10px;}',
    '#zchat-input{flex:1;background:#1e1e2a;border:none;border-radius:12px;padding:10px;color:#fff;outline:none;resize:none;}',
    '#zchat-send{background:#ff7200;border:none;border-radius:10px;padding:8px;cursor:pointer;}',
    '#zchat-typing{padding:10px;color:#666;font-size:11px;display:none;}'
  ].join('');
  document.head.appendChild(s);
}

function buildChatbot(){
  injectCSS();
  
  var btn = document.createElement('button');
  btn.id = 'zchat-btn';
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#fff" stroke-width="2"/></svg>';
  btn.onclick = function(){ isOpen ? closeChat() : openChat(); };
  document.body.appendChild(btn);

  var win = document.createElement('div');
  win.id = 'zchat-win';
  win.innerHTML = [
    '<div id="zchat-head"><strong>Zara · Zyoin AI</strong><button id="zchat-close" style="margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;">✕</button></div>',
    '<div id="zchat-msgs"><div id="zchat-typing">Zara is typing...</div></div>',
    '<div id="zchat-input-wrap"><textarea id="zchat-input" placeholder="Ask me anything..."></textarea><button id="zchat-send"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div>'
  ].join('');
  document.body.appendChild(win);

  document.getElementById('zchat-close').onclick = closeChat;
  document.getElementById('zchat-send').onclick = sendMessage;
  document.getElementById('zchat-input').onkeydown = function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }};

  addBotMessage("Hi there! 👋 I'm Zara, Zyoin's AI hiring assistant. How can I help you today?");
}

function openChat(){ isOpen=true; document.getElementById('zchat-win').classList.add('open'); }
function closeChat(){ isOpen=false; document.getElementById('zchat-win').classList.remove('open'); }

function addBotMessage(text){
  var msgs = document.getElementById('zchat-msgs');
  var div = document.createElement('div');
  div.className = 'zcm bot';
  div.innerHTML = '<div class="zcm-bubble">' + text + '</div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text){
  var msgs = document.getElementById('zchat-msgs');
  var div = document.createElement('div');
  div.className = 'zcm user';
  div.innerHTML = '<div class="zcm-bubble">' + text + '</div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function sendMessage(){
  var input = document.getElementById('zchat-input');
  var text = input.value.trim();
  if(!text || isTyping) return;
  input.value = '';
  addUserMessage(text);
  
  isTyping = true;
  document.getElementById('zchat-typing').style.display = 'block';

  askClaude(text, function(reply){
    isTyping = false;
    document.getElementById('zchat-typing').style.display = 'none';
    addBotMessage(reply);
  });
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildChatbot);
else buildChatbot();

})();
