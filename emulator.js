// --- Core Elements & State ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
let emulatorState = 'IDLE'; 
let bootProgress = 0;
let currentRomName = "";
let romMemory = null;

// Initialize actual GBA Engine
const Iodine = new IodineGBA();
Iodine.attachCanvas(canvas);
Iodine.enableAudio();

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

// --- Inputs & Keybinds (Gamepad code removed) ---
const defaultKeyMap = { 'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Left': 'ArrowLeft', 'Right': 'ArrowRight', 'A': 'x', 'B': 'z', 'Start': 'Enter', 'Select': 'Shift' };
let keyMap = { ...defaultKeyMap };
let inputState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };

// Map your button names to Iodine's expected key codes
const iodineMap = { 'Up': 0, 'Down': 1, 'Left': 2, 'Right': 3, 'A': 4, 'B': 5, 'Select': 6, 'Start': 7 };

window.addEventListener('keydown', (e) => handleKey(e.key, 1));
window.addEventListener('keyup', (e) => handleKey(e.key, 0));

function handleKey(key, isPressed) {
    for (const [btn, mappedKey] of Object.entries(keyMap)) {
        if (key.toLowerCase() === mappedKey.toLowerCase()) {
            inputState[btn] = isPressed;
            if (iodineMap[btn] !== undefined) {
                if (isPressed) Iodine.keyDown(iodineMap[btn]);
                else Iodine.keyUp(iodineMap[btn]);
            }
        }
    }
}

// --- Touch Controls Sync ---
document.querySelectorAll('.t-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        inputState[btn.dataset.key] = 1; 
        if (iodineMap[btn.dataset.key] !== undefined) Iodine.keyDown(iodineMap[btn.dataset.key]);
    });
    btn.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        inputState[btn.dataset.key] = 0; 
        if (iodineMap[btn.dataset.key] !== undefined) Iodine.keyUp(iodineMap[btn.dataset.key]);
    });
});

// --- UI & Modals ---
const menuPanel = document.getElementById('menu-panel');

document.getElementById('btn-keybinds').onclick = () => { buildKeyUI(); document.getElementById('modal-inputs').classList.add('active'); menuPanel.classList.remove('open'); };
document.getElementById('btn-close-keys').onclick = () => document.getElementById('modal-inputs').classList.remove('active');
document.getElementById('btn-library').onclick = () => { document.getElementById('modal-library').classList.add('active'); menuPanel.classList.remove('open'); };
document.getElementById('btn-close-library').onclick = () => document.getElementById('modal-library').classList.remove('active');

const btnResetKeys = document.getElementById('btn-reset-keys');
if (btnResetKeys) {
    btnResetKeys.onclick = () => { keyMap = { ...defaultKeyMap }; buildKeyUI(); };
}

let listeningBtn = null; 
let listeningType = null;

function buildKeyUI() {
    const kList = document.getElementById('key-list'); 
    if (!kList) return;
    kList.innerHTML = '';
    
    for (const btn of Object.keys(keyMap)) {
        kList.innerHTML += `<div class="key-row" style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
            <span>${btn}</span> 
            <button class="key-btn" id="km-${btn}" style="padding:6px 12px; cursor:pointer; border-radius:6px; background:var(--glass); border:1px solid var(--border);">${keyMap[btn]}</button>
        </div>`;
    }
    
    for (const btn of Object.keys(keyMap)) {
        document.getElementById(`km-${btn}`).onclick = function() { 
            listeningBtn = btn; 
            listeningType = 'key'; 
            this.innerText = "..."; 
        };
    }
}

window.addEventListener('keydown', (e) => {
    if (listeningBtn && listeningType === 'key') { 
        keyMap[listeningBtn] = e.key; 
        listeningBtn = null; 
        buildKeyUI(); 
    }
});

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
    console.log("Core Started");
    Iodine.loadROM(romMemory);
    Iodine.play();
}
