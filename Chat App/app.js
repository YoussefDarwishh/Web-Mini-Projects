// ---- Config ----
const WS_URL = 'wss://echo.websocket.events'; // Public echo server (no auth)

// ---- DOM ----
const els = {
    feed: document.getElementById('feed'),
    form: document.getElementById('chatForm'),
    input: document.getElementById('message'),
    connectBtn: document.getElementById('connectBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    error: document.getElementById('error'),
    errorMsg: document.getElementById('errorMsg'),
};

// ---- State ----
let socket = null;
let reconnecting = false;

// ---- Utilities (parameters + return values) ----
function setStatus(connected) {
    els.statusDot.classList.toggle('online', connected);
    els.statusDot.classList.toggle('offline', !connected);
    els.statusText.textContent = connected ? 'Connected' : 'Disconnected';
    els.connectBtn.disabled = connected;
    els.disconnectBtn.disabled = !connected;
}

function showError(msg) {
    els.errorMsg.textContent = msg || 'Unknown error';
    els.error.classList.remove('hidden');
}
function hideError() { els.error.classList.add('hidden'); els.errorMsg.textContent = ''; }

function now() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage({ author, text, isYou = false }) {
    // Create message DOM
    const wrap = document.createElement('div');
    const meta = document.createElement('div');
    const bubble = document.createElement('div');

    wrap.className = 'wrap';
    meta.className = 'meta';
    bubble.className = 'msg' + (isYou ? ' you' : '');

    // Meta
    const who = document.createElement('span');
    who.className = 'author';
    who.textContent = author;

    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = now();

    meta.appendChild(who);
    meta.appendChild(t);

    // Text (defensive: avoid injecting HTML)
    bubble.textContent = text;

    // Assemble
    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    els.feed.appendChild(wrap);

    // Auto-scroll
    els.feed.scrollTop = els.feed.scrollHeight;
}

// Promise that resolves when WebSocket fires "open"
function waitForOpen(ws) {
    return new Promise((resolve, reject) => {
        const onOpen = () => { cleanup(); resolve(ws); };
        const onError = (e) => { cleanup(); reject(new Error('WebSocket error while connecting.')); };
        const onClose = () => { cleanup(); reject(new Error('WebSocket closed before opening.')); };
        function cleanup() {
            ws.removeEventListener('open', onOpen);
            ws.removeEventListener('error', onError);
            ws.removeEventListener('close', onClose);
        }
        ws.addEventListener('open', onOpen);
        ws.addEventListener('error', onError);
        ws.addEventListener('close', onClose);
    });
}

// Send text over ws (returns a Promise to show async usage)
function sendText(ws, text) {
    return new Promise((resolve, reject) => {
        try {
            ws.send(text);
            resolve(true);
        } catch (err) {
            reject(err);
        }
    });
}

// ---- Core async flows ----
async function connectWS() {
    // If already connected, return existing socket
    if (socket && socket.readyState === WebSocket.OPEN) return socket;

    hideError();
    try {
        socket = new WebSocket(WS_URL);
        await waitForOpen(socket);                // <-- async/await + promise
        wireSocketEvents(socket);                 // listen to messages/close
        setStatus(true);

        // The echo server sends a hello "connected" message on first connect
        appendMessage({ author: 'Server', text: 'Connected to echo server.' });
        return socket;
    } catch (err) {
        setStatus(false);
        showError(err.message);
        throw err;
    }
}

function wireSocketEvents(ws) {
    ws.addEventListener('message', (event) => {
        // echo server can send pings or string payloads
        const text = typeof event.data === 'string' ? event.data : '[binary]';
        appendMessage({ author: 'Server', text });
    });

    ws.addEventListener('close', () => {
        setStatus(false);
        if (!reconnecting) {
            appendMessage({ author: 'System', text: 'Connection closed.' });
        }
    });

    ws.addEventListener('error', () => {
        showError('WebSocket error occurred.');
    });
}

// Optional: a gentle auto-reconnect demo (promise + async/await)
async function attemptReconnect(maxRetries = 3) {
    reconnecting = true;
    let delay = 600;
    for (let i = 0; i < maxRetries; i++) {
        appendMessage({ author: 'System', text: `Reconnecting… (try ${i + 1}/${maxRetries})` });
        try {
            await new Promise(r => setTimeout(r, delay));
            await connectWS();
            reconnecting = false;
            appendMessage({ author: 'System', text: 'Reconnected ✅' });
            return true;
        } catch {
            delay *= 1.6; // backoff
        }
    }
    reconnecting = false;
    showError('Could not reconnect. Check your internet or try again later.');
    return false;
}

// ---- UI Handlers ----
els.connectBtn.addEventListener('click', async () => {
    try { await connectWS(); } catch (_) { }
});

els.disconnectBtn.addEventListener('click', () => {
    hideError();
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Client disconnect');
    }
});

els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const text = (els.input.value || '').trim();
    if (!text) return;

    appendMessage({ author: 'You', text, isYou: true });
    els.input.value = '';

    try {
        const ws = await connectWS();     // ensure connection (async/await)
        await sendText(ws, text);         // send asynchronously (promise)
    } catch (err) {
        showError('Failed to send: ' + err.message);
        // Attempt a reconnect in background (optional UX)
        if (!reconnecting) attemptReconnect();
    }
});

// ---- Start: try connecting immediately ----
(async () => {
    try { await connectWS(); } catch (_) { }
})();
