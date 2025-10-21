// Simple Notes — app.js
// Requirements covered:
// 1) localStorage/sessionStorage persistence (each note stored as a unique item)
// 2) Functions for add, edit, delete (with parameters & returns)
// 3) DOM manipulation to render/update the notes list

// ---------- DOM ----------
const els = {
    form: document.getElementById('noteForm'),
    title: document.getElementById('title'),
    body: document.getElementById('body'),
    notes: document.getElementById('notes'),
    status: document.getElementById('status'),
    storeSelect: document.getElementById('storeSelect'),
    search: document.getElementById('search'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    newDemoBtn: document.getElementById('newDemoBtn'),
};

// ---------- Storage config ----------
const STORAGE_PREFIX = 'sn:note:';            // each note saved as sn:note:<id>
const STORE_PREF_KEY = 'sn:storeType';        // remembers user's choice
let storeType = localStorage.getItem(STORE_PREF_KEY) || 'local'; // 'local' | 'session'

// API to pick the current storage backend
function getStore() {
    return storeType === 'session' ? window.sessionStorage : window.localStorage;
}

// ---------- Utility ----------
function genId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
function setStatus(msg) { els.status.textContent = msg || ''; }
function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
}

// ---------- Core data functions (Requirement 2) ----------
// Each note is stored as its own item: key "sn:note:<id>" -> JSON string

function saveNote(note) {
    // returns the saved note (with updated timestamp)
    note.updatedAt = Date.now();
    getStore().setItem(STORAGE_PREFIX + note.id, JSON.stringify(note));
    return note;
}

function loadNote(id) {
    const raw = getStore().getItem(STORAGE_PREFIX + id);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

function addNote({ title, body }) {
    const note = {
        id: genId(),
        title: title || 'Untitled',
        body: body || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    return saveNote(note);
}

function updateNote(id, fields) {
    const note = loadNote(id);
    if (!note) throw new Error('Note not found');
    Object.assign(note, fields);
    return saveNote(note);
}

function deleteNote(id) {
    getStore().removeItem(STORAGE_PREFIX + id);
}

function listNotes() {
    const s = getStore();
    const notes = [];
    for (let i = 0; i < s.length; i++) {
        const key = s.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
            const note = loadNote(key.slice(STORAGE_PREFIX.length));
            if (note) notes.push(note);
        }
    }
    // recent first
    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---------- DOM rendering (Requirement 3) ----------
function clearNotesUI() { els.notes.innerHTML = ''; }

function createNoteCard(note) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = note.id;

    // header
    const head = document.createElement('div');
    head.className = 'card-head';

    const titleEl = document.createElement('h3');
    titleEl.className = 'card-title';
    titleEl.textContent = note.title;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = `Updated ${fmtDate(note.updatedAt)}`;

    head.appendChild(titleEl);
    head.appendChild(meta);

    // body
    const bodyEl = document.createElement('p');
    bodyEl.className = 'card-body';
    bodyEl.textContent = note.body;

    // actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn ghost small';
    editBtn.textContent = 'Edit';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn small';
    saveBtn.textContent = 'Save';
    saveBtn.style.display = 'none';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn ghost small';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.display = 'none';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn danger small';
    delBtn.textContent = 'Delete';

    actions.appendChild(editBtn);
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(delBtn);

    // assemble
    card.appendChild(head);
    card.appendChild(bodyEl);
    card.appendChild(actions);

    // ----- edit mode helpers -----
    let original = null;

    function enterEdit() {
        original = { title: titleEl.textContent, body: bodyEl.textContent };
        titleEl.contentEditable = 'true';
        bodyEl.contentEditable = 'true';
        titleEl.classList.add('editable');
        bodyEl.classList.add('editable');
        titleEl.focus();

        editBtn.style.display = 'none';
        saveBtn.style.display = '';
        cancelBtn.style.display = '';
    }

    function exitEdit() {
        titleEl.contentEditable = 'false';
        bodyEl.contentEditable = 'false';
        titleEl.classList.remove('editable');
        bodyEl.classList.remove('editable');

        editBtn.style.display = '';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    }

    editBtn.addEventListener('click', enterEdit);

    cancelBtn.addEventListener('click', () => {
        // revert UI
        titleEl.textContent = original.title;
        bodyEl.textContent = original.body;
        exitEdit();
        setStatus('Edit cancelled.');
    });

    saveBtn.addEventListener('click', () => {
        const id = card.dataset.id;
        const newTitle = titleEl.textContent.trim() || 'Untitled';
        const newBody = bodyEl.textContent.trim();

        try {
            const updated = updateNote(id, { title: newTitle, body: newBody });
            meta.textContent = `Updated ${fmtDate(updated.updatedAt)}`;
            exitEdit();
            // Move card to top (sorted by updatedAt)
            card.remove();
            const first = els.notes.firstElementChild;
            els.notes.insertBefore(createNoteCard(updated), first);
            setStatus('Note saved.');
        } catch (err) {
            setStatus(err.message);
        }
    });

    delBtn.addEventListener('click', () => {
        const id = card.dataset.id;
        const ok = confirm('Delete this note?');
        if (!ok) return;
        deleteNote(id);
        card.remove();
        setStatus('Note deleted.');
    });

    return card;
}

function renderNotes(notes) {
    clearNotesUI();
    const frag = document.createDocumentFragment();
    notes.forEach(n => frag.appendChild(createNoteCard(n)));
    els.notes.appendChild(frag);
}

// ---------- Search/filter ----------
els.search.addEventListener('input', () => {
    const q = els.search.value.trim().toLowerCase();
    const cards = els.notes.querySelectorAll('.card');
    cards.forEach(card => {
        const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
        card.style.display = title.includes(q) ? '' : 'none';
    });
});

// ---------- Form handling ----------
els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = els.title.value.trim();
    const body = els.body.value.trim();
    if (!title && !body) {
        setStatus('Please add a title or body.');
        els.title.focus();
        return;
    }

    const note = addNote({ title, body });
    const first = els.notes.firstElementChild;
    els.notes.insertBefore(createNoteCard(note), first);
    els.form.reset();
    els.title.focus();
    setStatus('Note added.');
});

// ---------- Storage selection ----------
function applyStoreTypeUI() {
    els.storeSelect.value = storeType;
    setStatus(`Using ${storeType === 'local' ? 'localStorage' : 'sessionStorage'}.`);
}

els.storeSelect.addEventListener('change', () => {
    storeType = els.storeSelect.value === 'session' ? 'session' : 'local';
    // remember choice in localStorage (prefs), not in session
    localStorage.setItem(STORE_PREF_KEY, storeType);
    // reload notes from the selected storage
    renderNotes(listNotes());
    applyStoreTypeUI();
});

// ---------- Clear all (current storage only) ----------
els.clearAllBtn.addEventListener('click', () => {
    const s = getStore();
    const ok = confirm(`Delete all notes from ${storeType}Storage?`);
    if (!ok) return;

    // remove only our keys
    const toRemove = [];
    for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach(k => s.removeItem(k));
    renderNotes([]);
    setStatus('All notes cleared.');
});

// ---------- Demo note ----------
els.newDemoBtn.addEventListener('click', () => {
    const note = addNote({
        title: 'Demo note',
        body: 'This note shows add/edit/delete and storage persistence.',
    });
    els.notes.insertBefore(createNoteCard(note), els.notes.firstElementChild);
    setStatus('Demo note added.');
});

// ---------- Init ----------
(function init() {
    // Set stored preference for storage type
    applyStoreTypeUI();
    // Render existing notes
    renderNotes(listNotes());
})();
