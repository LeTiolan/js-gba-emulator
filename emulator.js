// --- Initialize Engine ---
const Iodine = new IodineGBA();
const canvas = document.getElementById('screen');
Iodine.attachCanvas(canvas);
Iodine.enableAudio();

let romMemory = null;
let currentRomName = "";

// --- IndexedDB Storage ---
let db;
const request = indexedDB.open("Quartz_GBA_DB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore("roms", { keyPath: "name" });
};
request.onsuccess = (e) => { db = e.target.result; updateLibraryList(); };

// --- UI Controls ---
const menuPanel = document.getElementById('menu-panel');
const playOverlay = document.getElementById('play-overlay');

document.getElementById('menu-btn').onclick = () => menuPanel.classList.toggle('open');

// Dark Mode
document.getElementById('toggle-dark-mode').onchange = (e) => {
    const fade = document.getElementById('theme-fade-overlay');
    fade.style.opacity = '1';
    setTimeout(() => {
        document.body.classList.toggle('dark-mode', e.target.checked);
        fade.style.opacity = '0';
    }, 400);
};

// Mobile UI
document.getElementById('toggle-mobile-ui').onchange = (e) => {
    document.getElementById('touch-controls').classList.toggle('active', e.target.checked);
};

// Modals
document.getElementById('btn-library').onclick = () => {
    document.getElementById('modal-library').classList.add('active');
    menuPanel.classList.remove('open');
};
document.getElementById('btn-close-library').onclick = () => {
    document.getElementById('modal-library').classList.remove('active');
};

// --- File Loading ---
document.getElementById('btn-load').onclick = () => document.getElementById('romLoader').click();

document.getElementById('romLoader').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        saveRom(file.name, data);
        prepareGame(data, file.name);
    };
    reader.readAsArrayBuffer(file);
    menuPanel.classList.remove('open');
};

function saveRom(name, data) {
    const tx = db.transaction("roms", "readwrite");
    tx.objectStore("roms").put({ name: name, data: data });
    updateLibraryList();
}

function updateLibraryList() {
    const list = document.getElementById('library-list');
    const tx = db.transaction("roms", "readonly");
    tx.objectStore("roms").getAll().onsuccess = (e) => {
        list.innerHTML = '';
        e.target.result.forEach(rom => {
            const btn = document.createElement('button');
            btn.className = 'menu-item';
            btn.innerText = `🎮 ${rom.name}`;
            btn.onclick = () => prepareGame(rom.data, rom.name);
            list.appendChild(btn);
        });
    };
}

function prepareGame(data, name) {
    romMemory = data;
    currentRomName = name;
    document.getElementById('modal-library').classList.remove('active');
    playOverlay.classList.add('active');
}

// --- The "PRESS PLAY" Logic ---
document.getElementById('btn-start-game').onclick = () => {
    if (!romMemory) return;
    playOverlay.classList.remove('active');
    
    // Core Engine Commands
    Iodine.loadROM(romMemory);
    Iodine.play(); 
    
    console.log("Playing:", currentRomName);
};

// --- Input Mapping ---
const keyMap = {
    'ArrowUp': 0, 'ArrowDown': 1, 'ArrowLeft': 2, 'ArrowRight': 3,
    'x': 4, 'z': 5, 'Enter': 7, 'Shift': 6, 's': 8, 'a': 9
};

window.addEventListener('keydown', (e) => { if(keyMap[e.key] !== undefined) Iodine.keyDown(keyMap[e.key]); });
window.addEventListener('keyup', (e) => { if(keyMap[e.key] !== undefined) Iodine.keyUp(keyMap[e.key]); });

// Touch bridge
document.querySelectorAll('.t-btn').forEach(btn => {
    const k = btn.dataset.key;
    const ik = { 'Up':0, 'Down':1, 'Left':2, 'Right':3, 'A':4, 'B':5 }[k];
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); Iodine.keyDown(ik); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); Iodine.keyUp(ik); });
});

// Initial screen draw
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#f0f2f5';
ctx.fillRect(0,0,240,160);
