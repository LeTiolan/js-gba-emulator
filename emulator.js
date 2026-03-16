// --- Core Elements & State ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
let emulatorState = 'IDLE'; 
let bootProgress = 0;
let currentRomName = "";
let romMemory = null;

// --- IndexedDB Setup ---
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

// --- Inputs ---
let inputState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };
const keyMap = { 'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'x': 'A', 'z': 'B', 'Enter': 'Start', 'Shift': 'Select' };

window.addEventListener('keydown', (e) => { if(keyMap[e.key]) inputState[keyMap[e.key]] = 1; });
window.addEventListener('keyup', (e) => { if(keyMap[e.key]) inputState[keyMap[e.key]] = 0; });

document.querySelectorAll('.t-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); inputState[btn.dataset.key] = 1; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); inputState[btn.dataset.key] = 0; });
});

// --- UI Logic ---
const menuPanel = document.getElementById('menu-panel');
document.getElementById('menu-btn').onclick = () => menuPanel.classList.toggle('open');

document.getElementById('toggle-dark-mode').onchange = (e) => {
    const fade = document.getElementById('theme-fade-overlay');
    fade.style.opacity = '1';
    setTimeout(() => {
        document.body.classList.toggle('dark-mode', e.target.checked);
        fade.style.opacity = '0';
    }, 400);
};

document.getElementById('toggle-mobile-ui').onchange = (e) => {
    document.getElementById('touch-controls').classList.toggle('active', e.target.checked);
};

// Modals
document.getElementById('btn-keybinds').onclick = () => { document.getElementById('modal-inputs').classList.add('active'); menuPanel.classList.remove('open'); };
document.getElementById('btn-close-keys').onclick = () => document.getElementById('modal-inputs').classList.remove('active');
document.getElementById('btn-library').onclick = () => { document.getElementById('modal-library').classList.add('active'); menuPanel.classList.remove('open'); };
document.getElementById('btn-close-library').onclick = () => document.getElementById('modal-library').classList.remove('active');

// --- Loading Flow ---
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
    document.getElementById('modal-library').classList.remove('active');
    document.getElementById('play-overlay').classList.add('active');
}

document.getElementById('btn-start-game').onclick = () => {
    document.getElementById('play-overlay').classList.remove('active');
    emulatorState = 'BOOTING'; 
    bootProgress = 0;
};

// --- Rendering ---
function renderLoop() {
    if (emulatorState === 'IDLE' || emulatorState === 'LOADED') {
        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#121218' : '#eef2f5';
        ctx.fillRect(0, 0, 240, 160);
        ctx.fillStyle = '#8b9bb4'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(emulatorState === 'IDLE' ? 'INSERT CARTRIDGE' : 'READY TO PLAY', 120, 85);
    } 
    else if (emulatorState === 'BOOTING') {
        bootProgress += 0.02;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 240, 160);
        ctx.fillStyle = '#2d2d3a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('QUARTZ OS', 120, 85);
        if (bootProgress >= 1.5) { emulatorState = 'RUNNING'; startEmulatorCore(); return; }
    }
    if (emulatorState !== 'RUNNING') requestAnimationFrame(renderLoop);
}
renderLoop();

function startEmulatorCore() {
    console.log("Core Started");
    setInterval(() => {
        // This is the "Black Screen" code. 
        // To play real games, you would replace this block with a GBA engine (like IodineGBA).
        ctx.fillStyle = '#050505'; 
        ctx.fillRect(0, 0, 240, 160);
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px monospace';
        ctx.fillText(`RUNNING: ${currentRomName}`, 120, 70);
        ctx.fillText(`ENGINE STATUS: PLACEHOLDER`, 120, 90);
    }, 1000 / 60);
}
