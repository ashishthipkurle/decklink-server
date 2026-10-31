// Renderer script for DeckLink Server PC Companion

document.addEventListener('DOMContentLoaded', async () => {
  const ipListEl = document.getElementById('ip-list');
  const serverPortEl = document.getElementById('server-port');
  const clientCountEl = document.getElementById('client-count');
  const clientListEl = document.getElementById('client-list');
  const logTerminalEl = document.getElementById('log-terminal');
  const testFeedbackEl = document.getElementById('test-feedback');
  const authTokenEl = document.getElementById('auth-token');
  const copyTokenBtn = document.getElementById('copy-token-btn');
  const clearLogBtn = document.getElementById('clear-log-btn');

  function appendLog(text, type = 'system') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${text}`;
    logTerminalEl.appendChild(entry);
    logTerminalEl.scrollTop = logTerminalEl.scrollHeight;
  }

  function setFeedback(msg, isSuccess = true) {
    testFeedbackEl.textContent = msg;
    testFeedbackEl.style.color = isSuccess ? '#10b981' : '#f56565';
    setTimeout(() => {
      if (testFeedbackEl.textContent === msg) {
        testFeedbackEl.textContent = '';
      }
    }, 2500);
  }

  // Load server info via IPC
  if (window.decklinkApi && window.decklinkApi.getServerInfo) {
    try {
      const info = await window.decklinkApi.getServerInfo();
      serverPortEl.textContent = info.port;
      authTokenEl.textContent = info.token;

      // Render IPs
      if (info.ips && info.ips.length > 0) {
        ipListEl.innerHTML = '';
        info.ips.forEach(net => {
          const card = document.createElement('div');
          card.className = 'ip-card';
          card.innerHTML = `
            <div>
              <div class="ip-name">${net.interface}</div>
              <div class="ip-addr">${net.address}</div>
            </div>
            <span class="copy-badge">Click to copy</span>
          `;
          card.addEventListener('click', () => {
            navigator.clipboard.writeText(net.address);
            setFeedback(`Copied ${net.address} to clipboard!`);
          });
          ipListEl.appendChild(card);
        });
      } else {
        ipListEl.innerHTML = `<div class="ip-card">127.0.0.1 (Localhost / USB ADB)</div>`;
      }

      // Update connected clients
      updateClientList(info.clients || []);
    } catch (err) {
      appendLog('Error loading server info: ' + err.message, 'error');
    }

    // Listen to real-time events
    window.decklinkApi.onServerEvent((event) => {
      const { type, data } = event;
      if (type === 'client-connected') {
        appendLog(`Device connected: ${data.ip}`, 'command');
        clientCountEl.textContent = `${data.activeCount} Connected`;
        refreshClients();
      } else if (type === 'client-disconnected') {
        appendLog(`Device disconnected: ${data.ip}`, 'system');
        clientCountEl.textContent = `${data.activeCount} Connected`;
        refreshClients();
      } else if (type === 'command-executed') {
        const payloadStr = data.payload ? JSON.stringify(data.payload) : '';
        appendLog(`Command [${data.action.toUpperCase()}]: ${payloadStr} (status: ${data.status})`, 'command');
      }
    });
  }

  async function refreshClients() {
    if (window.decklinkApi) {
      const info = await window.decklinkApi.getServerInfo();
      updateClientList(info.clients || []);
    }
  }

  function updateClientList(clients) {
    clientCountEl.textContent = `${clients.length} Connected`;
    if (!clients || clients.length === 0) {
      clientListEl.innerHTML = `<div class="empty-state">No devices currently connected. Open DeckLink on your phone to connect!</div>`;
      return;
    }

    clientListEl.innerHTML = '';
    clients.forEach(c => {
      const item = document.createElement('div');
      item.className = 'client-item';
      const cleanIp = (c.ip || '').replace(/^::ffff:/, '');
      item.innerHTML = `
        <span class="client-item-ip">📱 ${cleanIp}</span>
        <span class="client-item-time">Active</span>
      `;
      clientListEl.appendChild(item);
    });
  }

  // Copy token
  copyTokenBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(authTokenEl.textContent);
    setFeedback('Token copied to clipboard!');
  });

  // Clear log
  clearLogBtn.addEventListener('click', () => {
    logTerminalEl.innerHTML = '';
  });

  // Diagnostic tests
  async function runTest(action, payload) {
    if (!window.decklinkApi) return;
    try {
      const res = await window.decklinkApi.testAction(action, payload);
      setFeedback(`Executed: ${action} (${res.status})`);
      appendLog(`[TEST] Executed ${action}: ${res.status}`, 'command');
    } catch (e) {
      setFeedback('Test failed: ' + e.message, false);
      appendLog(`[TEST ERROR] ${e.message}`, 'error');
    }
  }

  document.getElementById('btn-test-media').addEventListener('click', () => {
    runTest('media', { action: 'playPause' });
  });

  document.getElementById('btn-test-mute').addEventListener('click', () => {
    runTest('media', { action: 'mute' });
  });

  document.getElementById('btn-test-volup').addEventListener('click', () => {
    runTest('media', { action: 'volUp' });
  });

  document.getElementById('btn-test-voldown').addEventListener('click', () => {
    runTest('media', { action: 'volDown' });
  });

  document.getElementById('btn-test-hotkey').addEventListener('click', () => {
    runTest('hotkey', { modifiers: ['win', 'shift'], key: 's' });
  });
});
