const API_URL = 'https://jsonplaceholder.typicode.com';

const els = {
    posts: document.getElementById('posts'),
    status: document.getElementById('status'),
    error: document.getElementById('error'),
    errorMsg: document.getElementById('errorMsg'),
    retryBtn: document.getElementById('retryBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    loadingText: document.getElementById('loadingText'),
    form: document.getElementById('postForm'),
    title: document.getElementById('title'),
    body: document.getElementById('body'),
    author: document.getElementById('author'),
    search: document.getElementById('search'),
    tmpl: document.getElementById('postCardTmpl')
};

let state = {
    posts: [],         // fetched posts
    localPosts: [],    // client-side posts
    usersById: {}      // for author names
};

function setStatus(text) {
    els.status.textContent = text || '';
}

function showError(message) {
    els.errorMsg.textContent = message || '';
    els.error.classList.remove('hidden');
}

function hideError() {
    els.error.classList.add('hidden');
    els.errorMsg.textContent = '';
}

function clearPosts() {
    els.posts.innerHTML = '';
}

function createSkeletons(count = 6) {
    clearPosts();
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'card skeleton';
        div.style.height = (130 + Math.round(Math.random() * 80)) + 'px';
        els.posts.appendChild(div);
    }
    els.posts.setAttribute('aria-busy', 'true');
    els.loadingText.classList.remove('hidden');
}

function endLoading() {
    els.posts.setAttribute('aria-busy', 'false');
    els.loadingText.classList.add('hidden');
}

function text(node, value) {
    node.textContent = value;
}

function saveLocal() {
    localStorage.setItem('sb.localPosts', JSON.stringify(state.localPosts));
}

function loadLocal() {
    try {
        const raw = localStorage.getItem('sb.localPosts');
        state.localPosts = raw ? JSON.parse(raw) : [];
    } catch (e) {
        state.localPosts = [];
    }
}

function renderOne(post, { source = 'api' } = {}) {
    const frag = els.tmpl.content.cloneNode(true);
    const article = frag.querySelector('.card');
    const titleEl = frag.querySelector('.card-title');
    const bodyEl = frag.querySelector('.card-body');
    const authorEl = frag.querySelector('.author');
    const sourceEl = frag.querySelector('.badge.source');
    const rmBtn = frag.querySelector('.remove-btn');

    text(titleEl, post.title);
    text(bodyEl, post.body);

    let authorName = 'Anonymous';
    if (source === 'api') {
        authorName = state.usersById[post.userId]?.name || `User #${post.userId ?? '—'}`;
    } else {
        authorName = post.author?.trim() || 'You';
    }
    text(authorEl, `by ${authorName}`);

    sourceEl.classList.toggle('local', source === 'local');
    text(sourceEl, source === 'local' ? 'client-side' : 'api');

    if (source !== 'local') {
        rmBtn.style.display = 'none';
    } else {
        rmBtn.addEventListener('click', () => {
            const idx = state.localPosts.findIndex(p => p.id === post.id);
            if (idx !== -1) { state.localPosts.splice(idx, 1); saveLocal(); }
            article.remove();
            setStatus('Removed a client-side post.');
        });
    }

    els.posts.appendChild(frag);
}

function renderAll() {
    clearPosts();
    [...state.localPosts].sort((a, b) => b.id - a.id).forEach(p => renderOne(p, { source: 'local' }));
    state.posts.forEach(p => renderOne(p, { source: 'api' }));
}

async function fetchUsers() {
    const res = await fetch(`${API_URL}/users`);
    if (!res.ok) throw new Error(`Users HTTP ${res.status}`);
    const users = await res.json();
    const map = {};
    users.forEach(u => map[u.id] = u);
    state.usersById = map;
}

async function fetchPosts(limit = 12) {
    const res = await fetch(`${API_URL}/posts?_limit=${encodeURIComponent(limit)}`);
    if (!res.ok) throw new Error(`Posts HTTP ${res.status}`);
    return await res.json();
}

async function loadData() {
    hideError();
    createSkeletons(8);
    setStatus('Fetching posts…');

    try {
        const [_, posts] = await Promise.all([fetchUsers(), fetchPosts(12)]);
        state.posts = posts;
        endLoading();
        renderAll();
        setStatus(`Loaded ${posts.length} posts from API.`);
    } catch (err) {
        console.error(err);
        endLoading();
        showError(err.message || 'Unknown error');
        setStatus('');
    }
}

els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.title.value.trim();
    const body = els.body.value.trim();
    const author = els.author.value.trim();

    if (!title || !body) {
        setStatus('Please fill in the required fields.');
        if (!title) els.title.focus();
        return;
    }

    const newPost = {
        id: Date.now(),
        title,
        body,
        author
    };

    state.localPosts.push(newPost);
    saveLocal();

    const before = els.posts.firstElementChild;
    const frag = els.tmpl.content.cloneNode(true);
    const titleEl = frag.querySelector('.card-title');
    const bodyEl = frag.querySelector('.card-body');
    const authorEl = frag.querySelector('.author');
    const sourceEl = frag.querySelector('.badge.source');
    const rmBtn = frag.querySelector('.remove-btn');

    text(titleEl, newPost.title);
    text(bodyEl, newPost.body);
    text(authorEl, `by ${newPost.author?.trim() || 'You'}`);
    sourceEl.classList.add('local');
    text(sourceEl, 'client-side');

    rmBtn.addEventListener('click', () => {
        const idx = state.localPosts.findIndex(p => p.id === newPost.id);
        if (idx !== -1) { state.localPosts.splice(idx, 1); saveLocal(); }
        // find parent card to remove
        rmBtn.closest('.card').remove();
        setStatus('Removed a client-side post.');
    });

    els.posts.insertBefore(frag, before);

    els.form.reset();
    els.title.focus();
    setStatus('Added a new client-side post.');
});

els.search.addEventListener('input', () => {
    const q = els.search.value.trim().toLowerCase();
    const cards = els.posts.querySelectorAll('.card');
    cards.forEach(card => {
        const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
        card.style.display = title.includes(q) ? '' : 'none';
    });
});

els.retryBtn.addEventListener('click', loadData);
els.refreshBtn.addEventListener('click', loadData);

loadLocal();
loadData();
