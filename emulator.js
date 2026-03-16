// --- Core Elements & State ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
let emulatorState = 'IDLE'; 
let bootProgress = 0;
let currentRomName = "";

// --- IndexedDB Setup ---
let db;
const request = indexedDB.open("GBA_Storage", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("roms")) db.createObjectStore("roms", { keyPath: "id" });
    if (!db.objectStoreNames.contains("saves")) db.createObjectStore("saves", { keyPath: "id" });
};
request.onsuccess = (e) => { db = e.target.result; loadLibrary(); };

function saveRomToDB(fileName, data) {
    const transaction = db.transaction(["roms"], "readwrite");
    transaction.objectStore("roms").put({ id: fileName, data: data, name: fileName });
    loadLibrary();
}

function loadLibrary() {
    const list = document.getElementById('library-list');
    const transaction = db.transaction(["roms"], "readonly");
    const req = transaction.objectStore("roms").getAll();
    req.onsuccess = (e) => {
        const games = e.target.result;
        if (games.length === 0) { list.innerHTML = "No games saved yet."; return; }
        list.innerHTML = '';
        games.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'menu-item'; btn.style.width = '100%';
            btn.innerText = `🎮 ${g.name}`;
            btn.onclick = () => loadGameFromMemory(g.data, g.name);
            list.appendChild(btn);
        });
    };
}

// --- Inputs & Keybinds ---
const defaultKeyMap = { 'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Left': 'ArrowLeft', 'Right': 'ArrowRight', 'A': 'x', 'B': 'z', 'Start': 'Enter', 'Select': 'Shift' };
const defaultPadMap = { 'Up': 12, 'Down': 13, 'Left': 14, 'Right': 15, 'A': 0, 'B': 1, 'Start': 9, 'Select': 8 };

let keyMap = { ...defaultKeyMap };
let padMap = { ...defaultPadMap };
let inputState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };

window.addEventListener('keydown', (e) => handleKey(e.key, 1));
window.addEventListener('keyup', (e) => handleKey(e.key, 0));

function handleKey(key, isPressed) {
    for (const [btn, mappedKey] of Object.entries(keyMap)) {
        if (key.toLowerCase() === mappedKey.toLowerCase()) inputState[btn] = isPressed;
    }
}

function pollGamepad() {
    const gps = navigator.getGamepads();
    if (!gps[0]) return;
    const gp = gps[0];
    for (const [btn, padBtnIdx] of Object.entries(padMap)) {
        if (gp.buttons[padBtnIdx]) {
            inputState[btn] = gp.buttons[padBtnIdx].pressed ? 1 : 0;
        }
    }
}

// --- Touch Controls Sync ---
document.querySelectorAll('.t-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); inputState[btn.dataset.key] = 1; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); inputState[btn.dataset.key] = 0; });
});

// --- UI & Toggles ---
const menuBtn = document.getElementById('menu-btn');
const menuPanel = document.getElementById('menu-panel');
menuBtn.onclick = (e) => { e.stopPropagation(); menuPanel.classList.toggle('open'); };

// Dark Mode Toggle Switch
document.getElementById('toggle-dark-mode').addEventListener('change', (e) => {
    if (e.target.checked) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
});

// Mobile UI Toggle Switch
document.getElementById('toggle-mobile-ui').addEventListener('change', (e) => {
    if (e.target.checked) document.getElementById('touch-controls').classList.add('active');
    else document.getElementById('touch-controls').classList.remove('active');
});

// Modals
document.getElementById('btn-keybinds').onclick = () => { buildKeyUI(); document.getElementById('modal-inputs').classList.add('active'); menuPanel.classList.remove('open'); };
document.getElementById('btn-close-keys').onclick = () => document.getElementById('modal-inputs').classList.remove('active');
document.getElementById('btn-library').onclick = () => { document.getElementById('modal-library').classList.add('active'); menuPanel.classList.remove('open'); };
document.getElementById('btn-close-library').onclick = () => document.getElementById('modal-library').classList.remove('active');
document.getElementById('btn-reset-keys').onclick = () => { keyMap = { ...defaultKeyMap }; padMap = { ...defaultPadMap }; buildKeyUI(); };

let listeningBtn = null; let listeningType = null;
function buildKeyUI() {
    const kList = document.getElementById('key-list'); kList.innerHTML = '';
    const pList = document.getElementById('pad-list'); pList.innerHTML = '';
    
    for (const btn of Object.keys(keyMap)) {
        kList.innerHTML += `<div class="key-row"><span>${btn}</span> <button class="key-btn" id="km-${btn}">${keyMap[btn]}</button></div>`;
        pList.innerHTML += `<div class="key-row"><span>${btn}</span> <button class="key-btn" id="pm-${btn}">Btn ${padMap[btn]}</button></div>`;
    }
    
    for (const btn of Object.keys(keyMap)) {
        document.getElementById(`km-${btn}`).onclick = function() { listeningBtn = btn; listeningType = 'key'; this.innerText = "..."; };
        document.getElementById(`pm-${btn}`).onclick = function() { listeningBtn = btn; listeningType = 'pad'; this.innerText = "..."; };
    }
}

window.addEventListener('keydown', (e) => {
    if (listeningBtn && listeningType === 'key') { keyMap[listeningBtn] = e.key; listeningBtn = null; buildKeyUI(); }
});

setInterval(() => {
    if (listeningBtn && listeningType === 'pad') {
        const gps = navigator.getGamepads();
        if (gps[0]) {
            gps[0].buttons.forEach((b, idx) => {
                if (b.pressed) { padMap[listeningBtn] = idx; listeningBtn = null; buildKeyUI(); }
            });
        }
    }
}, 50);

// --- ROM Loading & Play Flow ---
document.getElementById('btn-load').onclick = () => { document.getElementById('romLoader').click(); menuPanel.classList.remove('open'); };

document.getElementById('romLoader').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        saveRomToDB(file.name, data);
        loadGameFromMemory(data, file.name);
    };
    reader.readAsArrayBuffer(file);
});

function loadGameFromMemory(data, name) {
    romMemory = data; currentRomName = name; emulatorState = 'LOADED';
    document.getElementById('modal-library').classList.remove('active');
    document.getElementById('play-overlay').classList.add('active');
}

document.getElementById('btn-start-game').onclick = () => {
    document.documentElement.requestFullscreen().catch(e => console.log("Fullscreen blocked"));
    document.getElementById('play-overlay').classList.remove('active');
    emulatorState = 'BOOTING'; bootProgress = 0;
};

// --- Screen Rendering ---
function renderLoop() {
    pollGamepad();

    if (emulatorState === 'IDLE' || emulatorState === 'LOADED') {
        const time = Date.now() / 1000;
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#121218' : '#eef2f5';
        ctx.fillRect(0, 0, 240, 160);

        if (emulatorState === 'IDLE') {
            const alpha = (Math.sin(time * 3) + 1) / 2 * 0.5 + 0.3;
            ctx.fillStyle = `rgba(139, 155, 180, ${alpha})`;
            ctx.font = 'bold 12px "Segoe UI"'; ctx.textAlign = 'center';
            ctx.fillText('INSERT CARTRIDGE', 120, 85);
        }
    } 
    else if (emulatorState === 'BOOTING') {
        bootProgress += 0.015; 
        if (bootProgress < 1.0) {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 240, 160);
            ctx.fillStyle = '#2d2d3a'; ctx.font = 'bold 20px "Segoe UI"'; ctx.textAlign = 'center';
            ctx.fillText('QUARTZ OS', 120, Math.min(85, -20 + (bootProgress * 100) * 1.5));
        } else if (bootProgress < 2.0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${bootProgress - 1.0})`; ctx.fillRect(0, 0, 240, 160);
        } else {
            emulatorState = 'RUNNING'; startEmulatorCore(); return;
        }
    }

    if (emulatorState !== 'RUNNING') requestAnimationFrame(renderLoop);
}
renderLoop();

function startEmulatorCore() {
    setInterval(() => {
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 240, 160);
        ctx.fillStyle = '#8b9bb4'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`PLAYING: ${currentRomName.substring(0,10)}...`, 120, 80);
    }, 1000 / 60); 
}
