// ============================================================
// ZYOIN AI CHATBOT
// Paste into Webflow: Site Settings → Custom Code → Footer Code
//
// Requires in Head Code (window.ZYOIN_CONFIG):
//   claude:  'YOUR_ANTHROPIC_API_KEY'
//   sheets:  'YOUR_APPS_SCRIPT_URL'
//   slack:   'YOUR_SLACK_WEBHOOK_URL'
// ============================================================
(function(){

// Claude API key is stored securely in Apps Script — not needed in browser
var SHEETS     = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.sheets) || '';
var SLACK      = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.slack)  || '';

// ── ZYOIN KNOWLEDGE BASE ─────────────────────────────────────
var SYSTEM_PROMPT = `You are Zara, Zyoin Group's friendly AI hiring assistant. You help companies find and hire exceptional talent.

ABOUT ZYOIN GROUP:
Zyoin Group is an AI-augmented recruitment company based in India with global operations. We specialize in connecting businesses with top-tier talent quickly and precisely.

OUR SERVICES:
1. Permanent Hiring — End-to-end recruitment for full-time roles across all levels
2. Leadership Hiring — C-suite, VP, Director level executive search
3. Global Hiring — International talent acquisition across US, UK, Europe, APAC
4. RPO (Recruitment Process Outsourcing) — We become your recruitment team
5. Contract Hiring — Flexible workforce solutions, short and long term
6. Managed Recruitment Service — Fully managed hiring campaigns
7. Talent Intelligence — Market mapping, competitor analysis, salary benchmarking
8. Hire Meetups — Exclusive hiring events connecting companies with pre-screened talent
9. Payroll Processing — End-to-end payroll management
10. HR Outsourcing — Complete HR function outsourcing

WHY ZYOIN:
- AI-augmented recruitment process for faster, better matches
- Average time-to-hire 40% faster than industry standard
- 95%+ candidate retention rate at 6 months
- Pan-India coverage + global reach
- Dedicated account managers
- No placement, no fee model for permanent hiring

YOUR ROLE:
- Answer questions about Zyoin's services warmly and confidently
- Help visitors understand which service fits their need
- Collect contact details naturally in conversation (name, email, company, phone)
- When you have their email or phone, tell them a Zyoin expert will reach out within 24 hours
- Keep responses concise — 2-4 sentences max unless they ask for details
- Never make up information not listed above
- If asked about pricing, say it depends on scope and a consultant will provide a custom quote
- Always be helpful, professional but warm — not robotic

LEAD CAPTURE RULES:
- After 2-3 messages, naturally ask for their name and company
- After showing interest, ask for email or phone to connect them with an expert
- When you collect email/phone, include this EXACT marker in your response: [LEAD_CAPTURED]
- Format collected data as: [DATA: name="X" email="X" phone="X" company="X" need="X"]

Example: "Great! I'll have our team reach out to you shortly. [LEAD_CAPTURED][DATA: name="Rahul" email="rahul@tcs.com" phone="" company="TCS" need="leadership hiring"]"`;

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

  var payload = JSON.stringify({
    timestamp:   new Date().toISOString(),
    name:        leadData.name,
    email:       leadData.email,
    phone:       leadData.phone,
    company:     leadData.company,
    need:        leadData.need,
    source:      'Zyoin Chatbot',
    slackUrl:    SLACK,
    currentPage: window.location.pathname,
  });

  try{
    var x = new XMLHttpRequest();
    x.open('POST', SHEETS, true);
    x.setRequestHeader('Content-Type','text/plain;charset=UTF-8');
    x.send(payload);
  }catch(e){}
}

// ── CALL CLAUDE VIA APPS SCRIPT PROXY ───────────────────────
// API key never exposed in browser — all calls go through Apps Script
function askClaude(userMessage, onChunk, onDone){
  messages.push({ role:'user', content: userMessage });

  var body = JSON.stringify({
    action:  'chat',
    message: userMessage,
    history: messages.slice(0, -1), // send history without current message
    system:  SYSTEM_PROMPT,
    page:    window.location.pathname,
  });

  var x = new XMLHttpRequest();
  x.open('POST', SHEETS, true);
  x.setRequestHeader('Content-Type','text/plain;charset=UTF-8');
  x.onload = function(){
    try{
      var data = JSON.parse(x.responseText);
      var reply = data.reply || "I'm sorry, I couldn't process that. Please try again.";

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
    }catch(e){
      onDone("I'm having trouble connecting. Please try again or email hello@zyoin.com");
    }
  };
  x.onerror = function(){
    onDone("Connection issue. Please try again or email hello@zyoin.com");
  };
  x.send(body);
}

// ── CSS ───────────────────────────────────────────────────────
function injectCSS(){
  if(document.getElementById('zchat-css')) return;
  var s = document.createElement('style');
  s.id  = 'zchat-css';
  s.textContent = [
    '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap");',

    // Launcher button
    '#zchat-btn{position:fixed;bottom:28px;right:28px;z-index:99996;width:56px;height:56px;background:#ff7200;border:none;border-radius:50%;cursor:pointer;box-shadow:0 4px 20px rgba(255,114,0,0.45);transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center;}',
    '#zchat-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(255,114,0,0.6);}',
    '#zchat-btn svg{transition:transform .3s;}',
    '#zchat-btn.open svg.ico-chat{display:none;}',
    '#zchat-btn.open svg.ico-close{display:block!important;}',
    '#zchat-pulse{position:fixed;bottom:28px;right:28px;z-index:99995;width:56px;height:56px;border-radius:50%;background:rgba(255,114,0,0.3);animation:zcPulse 2s ease-out infinite;}',
    '@keyframes zcPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.7);opacity:0}}',

    // Badge
    '#zchat-badge{position:fixed;bottom:76px;right:24px;z-index:99997;background:#fff;border-radius:12px;padding:10px 14px;box-shadow:0 4px 20px rgba(0,0,0,0.15);font-family:"Plus Jakarta Sans",sans-serif;font-size:12.5px;font-weight:500;color:#333;max-width:200px;line-height:1.4;cursor:pointer;transition:opacity .3s,transform .3s;}',
    '#zchat-badge::after{content:"";position:absolute;bottom:-6px;right:20px;width:12px;height:12px;background:#fff;transform:rotate(45deg);box-shadow:2px 2px 4px rgba(0,0,0,0.06);}',

    // Window
    '#zchat-win{position:fixed;bottom:96px;right:28px;z-index:99996;width:360px;height:520px;background:#0f0f14;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;transform:scale(.95) translateY(20px);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .25s ease;font-family:"Plus Jakarta Sans",sans-serif;}',
    '#zchat-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}',

    // Header
    '#zchat-head{background:#181820;padding:16px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,0.06);}',
    '#zchat-avatar{width:38px;height:38px;background:linear-gradient(135deg,#ff7200,#ff9500);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}',
    '#zchat-head-info{}',
    '#zchat-head-name{font-size:13.5px;font-weight:700;color:#fff;line-height:1.2;}',
    '#zchat-head-status{font-size:11px;color:#4ade80;display:flex;align-items:center;gap:5px;}',
    '#zchat-status-dot{width:6px;height:6px;background:#4ade80;border-radius:50%;animation:zcPls 2s infinite;}',
    '@keyframes zcPls{0%,100%{opacity:1}50%{opacity:.3}}',
    '#zchat-close{margin-left:auto;background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:18px;line-height:1;padding:4px;}',
    '#zchat-close:hover{color:#fff;}',

    // Messages
    '#zchat-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;}',
    '#zchat-msgs::-webkit-scrollbar{width:3px;}',
    '#zchat-msgs::-webkit-scrollbar-track{background:transparent;}',
    '#zchat-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:10px;}',

    // Message bubbles
    '.zcm{max-width:82%;display:flex;flex-direction:column;gap:3px;}',
    '.zcm.bot{align-self:flex-start;}',
    '.zcm.user{align-self:flex-end;}',
    '.zcm-bubble{padding:10px 14px;border-radius:14px;font-size:12.5px;line-height:1.6;font-weight:400;}',
    '.zcm.bot .zcm-bubble{background:#1e1e2a;color:#e8e8e8;border-bottom-left-radius:4px;}',
    '.zcm.user .zcm-bubble{background:#ff7200;color:#fff;border-bottom-right-radius:4px;}',
    '.zcm-time{font-size:10px;color:rgba(255,255,255,0.25);padding:0 4px;}',
    '.zcm.user .zcm-time{text-align:right;}',

    // Typing indicator
    '#zchat-typing{align-self:flex-start;background:#1e1e2a;border-radius:14px;border-bottom-left-radius:4px;padding:12px 16px;display:none;gap:5px;align-items:center;}',
    '#zchat-typing.show{display:flex;}',
    '.zt-dot{width:6px;height:6px;background:rgba(255,255,255,0.4);border-radius:50%;animation:zcBounce .9s infinite;}',
    '.zt-dot:nth-child(2){animation-delay:.15s;}',
    '.zt-dot:nth-child(3){animation-delay:.3s;}',
    '@keyframes zcBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}',

    // Quick replies
    '#zchat-quick{padding:0 16px 10px;display:flex;flex-wrap:wrap;gap:6px;}',
    '.zcq{background:transparent;border:1px solid rgba(255,114,0,0.4);color:#ff9500;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:"Plus Jakarta Sans",sans-serif;transition:background .15s,color .15s;}',
    '.zcq:hover{background:#ff7200;color:#fff;border-color:#ff7200;}',

    // Input
    '#zchat-input-wrap{padding:12px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:10px;align-items:flex-end;}',
    '#zchat-input{flex:1;background:#1e1e2a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;color:#e8e8e8;font-size:12.5px;font-family:"Plus Jakarta Sans",sans-serif;resize:none;outline:none;max-height:80px;line-height:1.5;transition:border-color .2s;}',
    '#zchat-input::placeholder{color:rgba(255,255,255,0.25);}',
    '#zchat-input:focus{border-color:rgba(255,114,0,0.4);}',
    '#zchat-send{width:36px;height:36px;min-width:36px;background:#ff7200;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .1s;}',
    '#zchat-send:hover{background:#e86800;transform:scale(1.05);}',
    '#zchat-send:disabled{background:#333;cursor:not-allowed;transform:none;}',

    // Mobile
    '@media(max-width:480px){#zchat-win{width:calc(100vw - 24px);right:12px;bottom:80px;height:70vh;}#zchat-btn{bottom:16px;right:16px;}#zchat-pulse{bottom:16px;right:16px;}#zchat-badge{right:12px;bottom:68px;}}',
  ].join('');
  document.head.appendChild(s);
}

// ── BUILD UI ──────────────────────────────────────────────────
function buildChatbot(){
  injectCSS();

  // Pulse ring
  var pulse = document.createElement('div');
  pulse.id = 'zchat-pulse';
  document.body.appendChild(pulse);

  // Badge teaser
  var badge = document.createElement('div');
  badge.id = 'zchat-badge';
  badge.innerHTML = '👋 Hi! Looking to hire? I can help.';
  badge.onclick = function(){ openChat(); badge.style.display='none'; };
  document.body.appendChild(badge);
  setTimeout(function(){ badge.style.opacity='0'; badge.style.transform='translateY(8px)'; badge.style.display='none'; }, 6000);

  // Launcher button
  var btn = document.createElement('button');
  btn.id = 'zchat-btn';
  btn.innerHTML = [
    '<svg class="ico-chat" width="24" height="24" viewBox="0 0 24 24" fill="none">',
    '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    '</svg>',
    '<svg class="ico-close" width="20" height="20" viewBox="0 0 24 24" fill="none" style="display:none">',
    '<path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
    '</svg>',
  ].join('');
  btn.onclick = function(){ isOpen ? closeChat() : openChat(); };
  document.body.appendChild(btn);

  // Chat window
  var win = document.createElement('div');
  win.id = 'zchat-win';
  win.innerHTML = [
    '<div id="zchat-head">',
      '<div id="zchat-avatar">⚡</div>',
      '<div id="zchat-head-info">',
        '<div id="zchat-head-name">Zara · Zyoin AI</div>',
        '<div id="zchat-head-status"><span id="zchat-status-dot"></span>Online · replies instantly</div>',
      '</div>',
      '<button id="zchat-close">✕</button>',
    '</div>',
    '<div id="zchat-msgs">',
      '<div id="zchat-typing"><div class="zt-dot"></div><div class="zt-dot"></div><div class="zt-dot"></div></div>',
    '</div>',
    '<div id="zchat-quick"></div>',
    '<div id="zchat-input-wrap">',
      '<textarea id="zchat-input" rows="1" placeholder="Ask me anything about hiring..."></textarea>',
      '<button id="zchat-send">',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      '</button>',
    '</div>',
  ].join('');
  document.body.appendChild(win);

  document.getElementById('zchat-close').onclick = closeChat;

  var input = document.getElementById('zchat-input');
  var sendBtn = document.getElementById('zchat-send');

  input.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', function(){
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });
  sendBtn.onclick = sendMessage;

  // Show greeting after open
  setTimeout(function(){ addBotMessage("Hi there! 👋 I'm Zara, Zyoin's AI hiring assistant. Whether you're looking to hire top talent, explore our services, or just have questions — I'm here to help. What brings you to Zyoin today?"); showQuickReplies(['Permanent Hiring', 'Leadership Hiring', 'Global Hiring', 'RPO Solutions', 'All Services']); }, 300);
}

function openChat(){
  isOpen = true;
  document.getElementById('zchat-win').classList.add('open');
  document.getElementById('zchat-btn').classList.add('open');
  document.getElementById('zchat-pulse').style.display = 'none';
  document.getElementById('zchat-input').focus();
}

function closeChat(){
  isOpen = false;
  document.getElementById('zchat-win').classList.remove('open');
  document.getElementById('zchat-btn').classList.remove('open');
}

function getTime(){
  var d = new Date();
  var h = d.getHours(), m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

function addBotMessage(text){
  var msgs = document.getElementById('zchat-msgs');
  var typing = document.getElementById('zchat-typing');

  var div = document.createElement('div');
  div.className = 'zcm bot';
  div.innerHTML = '<div class="zcm-bubble">' + text.replace(/\n/g,'<br>') + '</div><div class="zcm-time">' + getTime() + '</div>';
  msgs.insertBefore(div, typing);
  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text){
  var msgs = document.getElementById('zchat-msgs');
  var typing = document.getElementById('zchat-typing');
  var div = document.createElement('div');
  div.className = 'zcm user';
  div.innerHTML = '<div class="zcm-bubble">' + text + '</div><div class="zcm-time">' + getTime() + '</div>';
  msgs.insertBefore(div, typing);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping(){
  var t = document.getElementById('zchat-typing');
  t.classList.add('show');
  var msgs = document.getElementById('zchat-msgs');
  msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping(){
  document.getElementById('zchat-typing').classList.remove('show');
}

function showQuickReplies(options){
  var qr = document.getElementById('zchat-quick');
  qr.innerHTML = '';
  options.forEach(function(opt){
    var b = document.createElement('button');
    b.className = 'zcq';
    b.textContent = opt;
    b.onclick = function(){
      qr.innerHTML = '';
      processMessage(opt);
    };
    qr.appendChild(b);
  });
}

function sendMessage(){
  var input = document.getElementById('zchat-input');
  var text = input.value.trim();
  if(!text || isTyping) return;
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('zchat-quick').innerHTML = '';
  processMessage(text);
}

function processMessage(text){
  addUserMessage(text);
  isTyping = true;
  document.getElementById('zchat-send').disabled = true;
  showTyping();

  askClaude(text, null, function(reply){
    hideTyping();
    isTyping = false;
    document.getElementById('zchat-send').disabled = false;
    addBotMessage(reply);
  });
}

// ── INIT ──────────────────────────────────────────────────────
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', buildChatbot);
} else {
  buildChatbot();
}

})();
