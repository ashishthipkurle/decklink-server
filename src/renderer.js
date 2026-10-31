import QRCode from 'qrcode';

// Pure-JS offline QRCode generator shim compatible with the user's qrcode-generator template API
window.qrcode = function(typeNumber, errorCorrectionLevel) {
  return {
    _data: '',
    addData(data) { this._data = data; },
    make() {
      this._qr = QRCode.create(this._data, {
        errorCorrectionLevel: errorCorrectionLevel || 'M'
      });
    },
    getModuleCount() {
      return this._qr ? this._qr.modules.size : 0;
    },
    isDark(y, x) {
      return this._qr ? Boolean(this._qr.modules.get(x, y)) : false;
    }
  };
};

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const API = window.deckLink || {
  state: {
    port: 8765,
    token: 'decklink-usb-auto',
    autoStart: false,
    adapters: [
      { n: 'Wi-Fi', ip: '127.0.0.1', rec: 1 }
    ],
    devices: []
  },
  openDeck(url) {
    if (window.decklinkApi && window.decklinkApi.openDeckBrowser) {
      window.decklinkApi.openDeckBrowser(url);
    }
  },
  setAutoStart(v) {
    if (window.decklinkApi && window.decklinkApi.setAutoStart) {
      window.decklinkApi.setAutoStart(v);
    }
  },
  runTest(name) {
    if (window.decklinkApi && window.decklinkApi.testAction) {
      let action = 'media';
      let payload = {};
      if (name === 'Play / Pause') {
        action = 'media';
        payload = { action: 'playpause' };
      } else if (name === 'Mute Audio') {
        action = 'media';
        payload = { action: 'mute' };
      } else if (name === 'Vol +') {
        action = 'media';
        payload = { action: 'volup' };
      } else if (name === 'Vol -') {
        action = 'media';
        payload = { action: 'voldown' };
      } else if (name === 'Win+Shift+S') {
        action = 'hotkey';
        payload = { modifiers: ['win', 'shift'], key: 's' };
      }
      window.decklinkApi.testAction(action, payload);
    }
  }
};

const S = API.state;
let sel = 0, show = false;
const svg = (p, fill) => `<svg viewBox="0 0 24 24"${fill ? ' style="fill:currentColor;stroke:none"' : ''}><path d="${p}"/></svg>`;

function log(msg, t) {
  const T = $('term');
  if (!T) return;
  const d = document.createElement('div');
  d.className = 'ln ' + (t || 'okc');
  d.innerHTML = `<time>[${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}]</time>${esc(msg)}`;
  T.appendChild(d);
  while (T.children.length > 200) T.firstChild.remove();
  T.scrollTop = T.scrollHeight;
}

function url() {
  const currentIp = (S.adapters && S.adapters[sel]) ? S.adapters[sel].ip : 'localhost';
  return `http://${currentIp}:${S.port}/?token=${encodeURIComponent(S.token)}`;
}

function qr() {
  const el = $('qrsvg');
  if (!el) return;
  const currentIp = (S.adapters && S.adapters[sel]) ? S.adapters[sel].ip : 'localhost';
  $('qurl').textContent = `${currentIp}:${S.port}`;
  if (!window.qrcode) { el.innerHTML = ''; return; }
  try {
    const q = window.qrcode(0, 'M');
    q.addData(url());
    q.make();
    const n = q.getModuleCount();
    let r = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (q.isDark(y, x)) {
          r += `<rect x="${x}" y="${y}" width=".94" height=".94" rx=".18"/>`;
        }
      }
    }
    el.setAttribute('viewBox', `0 0 ${n} ${n}`);
    el.innerHTML = `<g fill="#2b2a55">${r}</g>`;
    el.classList.remove('swap');
    void el.getBoundingClientRect();
    el.classList.add('swap');
  } catch (err) {
    console.error('QR generation error:', err);
  }
}

function nets() {
  const netsEl = $('nets');
  if (!netsEl) return;
  if (!S.adapters || S.adapters.length === 0) {
    netsEl.innerHTML = `<div class="net on"><div class="nt"><span>Localhost</span></div><div class="nip">127.0.0.1</div></div>`;
    return;
  }
  netsEl.innerHTML = S.adapters.map((a, i) =>
    `<div class="net${i === sel ? ' on' : ''}" data-i="${i}" role="button" tabindex="0" aria-pressed="${i === sel}">
      <div class="nt">
        <span>${esc(a.n)}</span>
        ${a.rec ? '<em class="tag g">Recommended</em>' : a.virt ? '<em class="tag">Virtual</em>' : ''}
      </div>
      <div class="nip">${esc(a.ip)}</div>
      <button class="btn ghost sm" data-copy="${esc(a.ip)}">Copy</button>
    </div>`
  ).join('');
}

function pick(i) {
  if (i === sel) return;
  sel = i;
  nets();
  qr();
  log('QR now points to ' + S.adapters[sel].ip, 'sys');
}

const PHONE = 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2';

function devs() {
  const dc = $('dc');
  const devsEl = $('devs');
  if (!dc || !devsEl) return;
  const list = S.devices || [];
  dc.textContent = list.length + ' connected';
  devsEl.innerHTML = list.length
    ? list.map(d =>
        `<div class="dev">
          <span class="dico">${svg(PHONE)}</span>
          <span class="dip">${esc(d.ip)}</span>
          <span class="dst">
            <span><i></i>Active</span>
            <small data-ping>${d.ping || 8} ms</small>
          </span>
        </div>`
      ).join('')
    : '<div class="empty">No devices yet. Scan the QR code to connect.</div>';
}

const EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
      EYEX = EYE + 'M4 4l16 16';

function tok() {
  $('tok').textContent = show ? S.token : '\u2022'.repeat(Math.max(8, S.token.length));
  $('eyep').setAttribute('d', show ? EYEX : EYE);
  $('eye').setAttribute('aria-pressed', show);
  $('eye').setAttribute('aria-label', show ? 'Hide token' : 'Show token');
}

const TESTS = [
  ['Play / Pause', 'M8 5v14l11-7z', 1, ['#ffe5ee', '#d6336c']],
  ['Mute Audio', 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6', 0, ['#ece8ff', '#6a4cf0']],
  ['Vol +', 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11', 0, ['#e1efff', '#2a7bd6']],
  ['Vol -', 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6', 0, ['#ffeedd', '#d9792b']],
  ['Win+Shift+S', 'M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13', 0, ['#e0f5ea', '#1f9d6b']]
];

$('tests').innerHTML = TESTS.map(t =>
  `<button class="tile" data-n="${esc(t[0])}" style="--a:${t[3][0]};--b:${t[3][1]}">${svg(t[1], t[2])}<span>${esc(t[0])}</span></button>`
).join('');

$('tests').onclick = e => {
  const t = e.target.closest('.tile');
  if (!t) return;
  t.classList.remove('hit');
  void t.offsetWidth;
  t.classList.add('hit');
  if (API.runTest) API.runTest(t.dataset.n);
  log('Test executed: ' + t.dataset.n, 'cmd');
};

async function copy(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch (__) {}
    t.remove();
  }
  const o = btn.dataset.o || btn.textContent;
  btn.dataset.o = o;
  btn.classList.add('ok');
  btn.textContent = 'Copied';
  clearTimeout(btn.h);
  btn.h = setTimeout(() => {
    btn.classList.remove('ok');
    btn.textContent = o;
  }, 1400);
  log('Copied ' + label, 'sys');
}

document.addEventListener('click', e => {
  const c = e.target.closest('[data-copy]');
  if (c) {
    copy(c.dataset.copy, c, c.dataset.copy);
    return;
  }
  const n = e.target.closest('.net');
  if (n) pick(+n.dataset.i);
});

document.addEventListener('keydown', e => {
  const n = e.target.closest && e.target.closest('.net');
  if (n && (e.key === 'Enter' || e.key === ' ') && e.target === n) {
    e.preventDefault();
    pick(+n.dataset.i);
  }
});

$('ctok').onclick = () => copy(S.token, $('ctok'), 'auth token');
$('eye').onclick = () => { show = !show; tok(); };
$('open').onclick = () => {
  if (API.openDeck) API.openDeck(url());
  log('Opening deck in PC browser', 'okc');
};
$('auto').checked = !!S.autoStart;
$('auto').onchange = e => {
  if (API.setAutoStart) API.setAutoStart(e.target.checked);
  log('Start with Windows: ' + (e.target.checked ? 'on' : 'off'), 'sys');
};
$('clr').onclick = () => {
  $('term').innerHTML = '';
  log('Log cleared', 'sys');
};
$('port').textContent = ':' + S.port;

let t0 = Date.now();
const p2 = n => String(n).padStart(2, '0');
setInterval(() => {
  const s = (Date.now() - t0) / 1000 | 0;
  const upEl = $('up');
  if (upEl) upEl.textContent = `Uptime ${p2(s / 3600 | 0)}:${p2(s / 60 % 60 | 0)}:${p2(s % 60)}`;
}, 1000);

// Ping flutter simulator for connected devices
setInterval(() => {
  if (S.devices && S.devices.length) {
    S.devices.forEach(d => d.ping = Math.max(4, Math.round((d.ping || 10) + Math.random() * 6 - 3)));
    document.querySelectorAll('[data-ping]').forEach((el, i) => {
      if (S.devices[i]) el.textContent = S.devices[i].ping + ' ms';
    });
  }
}, 2500);

// Initialize initial UI
nets();
qr();
devs();
tok();
log('Server initialized. Waiting for commands from DeckLink app\u2026', 'sys');

// Connect to Electron Main Process IPC
async function initLiveServer() {
  if (window.decklinkApi && window.decklinkApi.getServerInfo) {
    try {
      const live = await window.decklinkApi.getServerInfo();
      if (live) {
        if (live.port) {
          S.port = live.port;
          $('port').textContent = ':' + S.port;
        }
        if (live.token) S.token = live.token;
        if (typeof live.autoStart === 'boolean') {
          S.autoStart = live.autoStart;
          $('auto').checked = !!S.autoStart;
        }
        if (Array.isArray(live.adapters) && live.adapters.length > 0) {
          S.adapters = live.adapters;
          sel = 0;
        }
        if (Array.isArray(live.devices)) {
          S.devices = live.devices;
        }
        nets();
        qr();
        devs();
        tok();
        S.devices.forEach(d => log('Device connected: ' + d.ip, 'okc'));
      }
    } catch (e) {
      log('Error reading server info: ' + e.message, 'sys');
    }

    window.decklinkApi.onServerEvent(evt => {
      const { type, data } = evt;
      if (type === 'client-connected') {
        const cleanIp = (data.ip || '').replace(/^::ffff:/, '');
        const exists = S.devices.find(d => d.ip === cleanIp);
        if (!exists) {
          S.devices.push({ ip: cleanIp, ping: Math.floor(Math.random() * 8) + 6 });
        }
        devs();
        log('Device connected: ' + cleanIp, 'okc');
      } else if (type === 'client-disconnected') {
        const cleanIp = (data.ip || '').replace(/^::ffff:/, '');
        S.devices = S.devices.filter(d => d.ip !== cleanIp);
        devs();
        log('Device disconnected: ' + cleanIp, 'sys');
      } else if (type === 'command-executed') {
        const pStr = data.payload ? ' ' + JSON.stringify(data.payload) : '';
        log(`Command [${(data.action || '').toUpperCase()}]:${pStr}`, 'cmd');
      }
    });
  }
}

initLiveServer();
