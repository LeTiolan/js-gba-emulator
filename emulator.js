// --- Core Elements & State ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const Iodine = new IodineGBA();

let emulatorState = 'IDLE'; 
let bootProgress = 0;
let currentRomName = "";
let romMemory = null;

// Connect Iodine to your canvas and audio
Iodine.attachCanvas(canvas);
Iodine.enableAudio();

// --- IndexedDB Setup (FULL RESTORE) ---
let db;
const request = indexedDB.open("GBA_Storage", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("roms")) db.createObjectStore("roms", { keyPath: "id" });
    if (!db.objectStoreNames.contains("saves")) db.createObjectStore("saves", { keyPath: "id" });
};
request.onsuccess = (e) => { 
    db = e.target.result; 
    loadLibrary(); 
};

function saveRomToDB(fileName, data) {
    const transaction = db.transaction(["roms"], "readwrite");
    transaction.objectStore("roms").put({ id: fileName, data: data, name: fileName });
    loadLibrary();
}

function loadLibrary() {
    const list = document.getElementById('library-list');
    if (!list) return;
    const transaction = db.transaction(["roms"], "readonly");
    const req = transaction.objectStore("roms").getAll();
    req.onsuccess = (e) => {
        const games = e.target.result;
        if (games.length === 0) { list.innerHTML = "No games saved yet."; return; }
        list.innerHTML = '';
        games.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'menu-item';
            btn.innerText = `🎮 ${g.name}`;
            btn.onclick = () => prepareGame(g.data, g.name);
            list.appendChild(btn);
        });
    };
}

// --- Keybinds System (FULL RESTORE) ---
let keyMap = { 
    'ArrowUp': 0, 'ArrowDown': 1, 'ArrowLeft': 2, 'ArrowRight': 3, 
    'x': 4, 'z': 5, 'Enter': 7, 'Shift': 6 
};

function updateKeyList() {
    const list = document.getElementById('key-list');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(keyMap).forEach(key => {
        const div = document.createElement('div');
        div.className = 'menu-item toggle-row';
        div.innerHTML = `<span>${key}</span> <span style="color:var(--accent)">${getGbaLabel(keyMap[key])}</span>`;
        list.appendChild(div);
    });
}

function getGbaLabel(id) {
    return ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "SELECT", "START", "R", "L"][id] || "KEY";
}

window.addEventListener('keydown', (e) => { 
    if (keyMap[e.key] !== undefined) Iodine.keyDown(keyMap[e.key]); 
});
window.addEventListener('keyup', (e) => { 
    if (keyMap[e.key] !== undefined) Iodine.keyUp(keyMap[e.key]); 
});

// --- UI Logic (FULL RESTORE) ---
const menuPanel = document.getElementById('menu-panel');
const playOverlay = document.getElementById('play-overlay');

document.getElementById('menu-btn').onclick = () => menuPanel.classList.toggle('open');

// File Loading Logic
document.getElementById('btn-load').onclick = () => document.getElementById('romLoader').click();
document.getElementById('romLoader').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        saveRomToDB(file.name, data);
        prepareGame(data, file.name);
    };
    reader.readAsArrayBuffer(file);
    menuPanel.classList.remove('open');
};

function prepareGame(data, name) {
    romMemory = data;
    currentRomName = name;
    emulatorState = 'LOADED';
    document.getElementById('modal-library').classList.remove('active');
    playOverlay.classList.add('active');
}

// Press Play Logic
document.getElementById('btn-start-game').onclick = () => {
    playOverlay.classList.remove('active');
    emulatorState = 'BOOTING';
    bootProgress = 0;
};

// Modal Handling
document.getElementById('btn-library').onclick = () => {
    document.getElementById('modal-library').classList.add('active');
    menuPanel.classList.remove('open');
};
document.getElementById('btn-close-library').onclick = () => document.getElementById('modal-library').classList.remove('active');

document.getElementById('btn-keybinds').onclick = () => {
    updateKeyList();
    document.getElementById('modal-inputs').classList.add('active');
    menuPanel.classList.remove('open');
};
document.getElementById('btn-close-keys').onclick = () => document.getElementById('modal-inputs').classList.remove('active');

// Settings Toggles
document.getElementById('toggle-dark-mode').onchange = (e) => {
    document.body.classList.toggle('dark-mode', e.target.checked);
};
document.getElementById('toggle-mobile-ui').onchange = (e) => {
    document.getElementById('touch-controls').classList.toggle('active', e.target.checked);
};

// Touch Controls Implementation
document.querySelectorAll('.t-btn').forEach(btn => {
    const key = btn.dataset.key;
    const ik = { 'Up':0, 'Down':1, 'Left':2, 'Right':3, 'A':4, 'B':5 }[key];
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); Iodine.keyDown(ik); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); Iodine.keyUp(ik); });
});

// --- Animation & Rendering Loop (FULL RESTORE) ---
function renderLoop() {
    const time = Date.now() / 1000;
    
    if (emulatorState === 'IDLE' || emulatorState === 'LOADED') {
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#121218' : '#eef2f5';
        ctx.fillRect(0, 0, 240, 160);

        const alpha = (Math.sin(time * 3) + 1) / 2 * 0.5 + 0.3;
        ctx.fillStyle = `rgba(139, 155, 180, ${alpha})`;
        ctx.font = 'bold 12px "Segoe UI"'; ctx.textAlign = 'center';
        ctx.fillText(emulatorState === 'IDLE' ? 'INSERT CARTRIDGE' : 'CARTRIDGE READY', 120, 85);
    } 
    else if (emulatorState === 'BOOTING') {
        bootProgress += 0.015; 
        if (bootProgress < 1.0) {
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 240, 160);
            ctx.fillStyle = '#2d2d3a'; ctx.font = 'bold 20px "Segoe UI"'; ctx.textAlign = 'center';
            ctx.fillText('QUARTZ OS', 120, 85);
        } else if (bootProgress < 2.0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${bootProgress - 1.0})`; 
            ctx.fillRect(0, 0, 240, 160);
        } else {
            // Engine Initialization
            emulatorState = 'RUNNING';
            Iodine.loadROM(romMemory);
            Iodine.play();
            return; // Stop UI loop, Iodine takes over
        }
    }

    if (emulatorState !== 'RUNNING') requestAnimationFrame(renderLoop);
}

renderLoop();
