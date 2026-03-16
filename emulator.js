// --- Core Elements ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
let currentRomName = "";
let romMemory = null;
let emulatorState = 'IDLE';

// --- 1. Initialize the Real GBA Engine (IodineGBA) ---
const Iodine = new IodineGBA();

// Connect the engine to your canvas
Iodine.attachCanvas(canvas);

// Set default audio/video settings
Iodine.enableAudio();
Iodine.setSpeed(1.0);

// --- 2. IndexedDB (Save/Load Games) ---
let db;
const request = indexedDB.open("GBA_Storage", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("roms")) db.createObjectStore("roms", { keyPath: "id" });
};
request.onsuccess = (e) => { db = e.target.result; loadLibrary(); };

function saveRomToDB(fileName, data) {
    const transaction = db.transaction(["roms"], "readwrite");
    transaction.objectStore("roms").put({ id: fileName, data: data, name: fileName });
    loadLibrary();
}

function loadLibrary() {
    const list = document.getElementById('library-list');
    if(!list) return;
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
            btn.onclick = () => loadGameFromMemory(g.data, g.name);
            list.appendChild(btn);
        });
    };
}

// --- 3. Controls (Mapping your inputs to Iodine) ---
const keyMap = {
    'ArrowUp': 0, 'ArrowDown': 1, 'ArrowLeft': 2, 'ArrowRight': 3,
    'x': 4, 'z': 5, 'Enter': 7, 'Shift': 6, 's': 8, 'a': 9 // 8=R, 9=L
};

window.addEventListener('keydown', (e) => { if(keyMap[e.key] !== undefined) Iodine.keyDown(keyMap[e.key]); });
window.addEventListener('keyup', (e) => { if(keyMap[e.key] !== undefined) Iodine.keyUp(keyMap[e.key]); });

// Touch controls bridge
document.querySelectorAll('.t-btn').forEach(btn => {
    const key = btn.dataset.key;
    const iodineKey = { 'Up':0, 'Down':1, 'Left':2, 'Right':3, 'A':4, 'B':5 }[key];
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); Iodine.keyDown(iodineKey); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); Iodine.keyUp(iodineKey); });
});

// --- 4. Loading Flow ---
const menuPanel = document.getElementById('menu-panel');
document.getElementById('menu-btn').onclick = () => menuPanel.classList.toggle('open');
document.getElementById('btn-load').onclick = () => document.getElementById('romLoader').click();

document.getElementById('romLoader').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        saveRomToDB(file.name, data);
        loadGameFromMemory(data, file.name);
    };
    reader.readAsArrayBuffer(file);
    menuPanel.classList.remove('open');
};

function loadGameFromMemory(data, name) {
    romMemory = data; 
    currentRomName = name; 
    emulatorState = 'LOADED';
    document.getElementById('play-overlay').classList.add('active');
    document.getElementById('modal-library').classList.remove('active');
}

// --- 5. The "Press Play" Trigger ---
document.getElementById('btn-start-game').onclick = () => {
    document.getElementById('play-overlay').classList.remove('active');
    
    // Pass the ROM data to the real engine
    Iodine.loadROM(romMemory);
    Iodine.play(); 
    
    emulatorState = 'RUNNING';
};

// --- 6. Visual UI Loop (Only for Idle/Boot states) ---
function uiLoop() {
    if (emulatorState === 'IDLE' || emulatorState === 'LOADED') {
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#121218' : '#eef2f5';
        ctx.fillRect(0, 0, 240, 160);
        ctx.fillStyle = '#8b9bb4'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(emulatorState === 'IDLE' ? 'INSERT CARTRIDGE' : 'CARTRIDGE READY', 120, 85);
    }
    
    if (emulatorState !== 'RUNNING') requestAnimationFrame(uiLoop);
}
uiLoop();

// Theme toggles
document.getElementById('toggle-dark-mode').onchange = (e) => {
    document.body.classList.toggle('dark-mode', e.target.checked);
};
document.getElementById('toggle-mobile-ui').onchange = (e) => {
    document.getElementById('touch-controls').classList.toggle('active', e.target.checked);
};
