/**
 * QUARTZ GBA - EMULATOR CORE & UI BRIDGE
 * Version: 2.1.0 (Confirmed Touch Overlay & Library Build)
 * Size: Full Expanded Source
 */

// --- 1. CORE INITIALIZATION & STATE ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

// Engine Instance
const Iodine = new IodineGBA();
Iodine.attachCanvas(canvas);
Iodine.enableAudio();

// Application State
let emulatorState = 'IDLE'; 
let bootProgress = 0;
let currentRomName = "";
let romMemory = null;

// UI Elements References
const menuPanel = document.getElementById('menu-panel');
const playOverlay = document.getElementById('play-overlay');
const dummyLoader = document.getElementById('dummyLoader');
const realLoader = document.getElementById('romLoader');
const libraryList = document.getElementById('library-list');
const keyList = document.getElementById('key-list');

// --- 2. INDEXEDDB SYSTEM (ROM & SAVE MANAGEMENT) ---
let db;
const request = indexedDB.open("GBA_Storage", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    // Create ROM store
    if (!db.objectStoreNames.contains("roms")) {
        db.createObjectStore("roms", { keyPath: "id" });
    }
    // Create Save store
    if (!db.objectStoreNames.contains("saves")) {
        db.createObjectStore("saves", { keyPath: "id" });
    }
    console.log("Quartz DB: Object stores initialized.");
};

request.onsuccess = (e) => { 
    db = e.target.result; 
    console.log("Quartz DB: Connection established.");
    loadLibrary(); 
};

function saveRomToDB(fileName, data) {
    const transaction = db.transaction(["roms"], "readwrite");
    const store = transaction.objectStore("roms");
    store.put({ id: fileName, data: data, name: fileName });
    
    transaction.oncomplete = () => {
        console.log(`Quartz DB: "${fileName}" saved successfully.`);
        loadLibrary();
    };
}

function loadLibrary() {
    if (!libraryList) return;
    
    const transaction = db.transaction(["roms"], "readonly");
    const store = transaction.objectStore("roms");
    const req = store.getAll();

    req.onsuccess = (e) => {
        const games = e.target.result;
        if (games.length === 0) {
            libraryList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); opacity:0.6;">Your library is empty. Load a GBA file to begin.</div>';
            return;
        }

        libraryList.innerHTML = '';
        games.forEach(game => {
            const btn = document.createElement('button');
            btn.className = 'menu-item';
            btn.innerHTML = `<span>🎮</span> ${game.name}`;
            btn.onclick = () => {
                console.log(`Quartz Engine: Selecting ${game.name} from library.`);
                prepareGame(game.data, game.name);
                document.getElementById('modal-library').classList.remove('active');
            };
            libraryList.appendChild(btn);
        });
    };
}

// --- 3. INPUT SYSTEM (KEYS & TOUCH OVERLAY) ---

// Iodine Key Mapping (UP, DOWN, LEFT, RIGHT, A, B, SELECT, START, R, L)
const keyMap = { 
    'ArrowUp': 0, 'ArrowDown': 1, 'ArrowLeft': 2, 'ArrowRight': 3, 
    'x': 4, 'z': 5, 'Enter': 7, 'Shift': 6, 's': 8, 'a': 9
};

window.addEventListener('keydown', (e) => { 
    if (keyMap[e.key] !== undefined) {
        Iodine.keyDown(keyMap[e.key]); 
        // Prevent scrolling with arrows
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => { 
    if (keyMap[e.key] !== undefined) Iodine.keyUp(keyMap[e.key]); 
});

// Touch Overlay Logic (Confirmed Working)
document.querySelectorAll('.t-btn').forEach(btn => {
    const key = btn.dataset.key;
    // Map data-key attribute to Iodine indices
    const gbaKeyIndex = { 'Up': 0, 'Down': 1, 'Left': 2, 'Right': 3, 'A': 4, 'B': 5 }[key];
    
    btn.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        if (gbaKeyIndex !== undefined) Iodine.keyDown(gbaKeyIndex); 
    });
    
    btn.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        if (gbaKeyIndex !== undefined) Iodine.keyUp(gbaKeyIndex); 
    });
});

// --- 4. DUAL-LOADER HAND-OFF & UI LOGIC ---

// Menu Toggle
document.getElementById('menu-btn').onclick = () => menuPanel.classList.toggle('open');

// Hand-off logic from dummyLoader (Visual UI) to realLoader (Emulator Input)
dummyLoader.addEventListener('change', () => {
    if (!dummyLoader.files.length) return;
    
    const file = dummyLoader.files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        console.log(`Quartz OS: Cartridge "${file.name}" detected.`);
        
        // Save to Database for Library
        saveRomToDB(file.name, data);
        
        // Ready for Play
        prepareGame(data, file.name);
        
        // Sync to realLoader to maintain engine compatibility
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        realLoader.files = dataTransfer.files;
    };
    reader.readAsArrayBuffer(file);
    menuPanel.classList.remove('open');
});

function prepareGame(data, name) {
    romMemory = data;
    currentRomName = name;
    emulatorState = 'LOADED';
    playOverlay.classList.add('active');
}

// Play Button Handshake
document.getElementById('btn-start-game').onclick = () => {
    playOverlay.classList.remove('active');
    emulatorState = 'BOOTING';
    bootProgress = 0;
};

// Modal Controls
document.getElementById('btn-library').onclick = () => {
    document.getElementById('modal-library').classList.add('active');
    menuPanel.classList.remove('open');
};
document.getElementById('btn-close-library').onclick = () => {
    document.getElementById('modal-library').classList.remove('active');
};

document.getElementById('btn-keybinds').onclick = () => {
    populateKeyList();
    document.getElementById('modal-inputs').classList.add('active');
    menuPanel.classList.remove('open');
};
document.getElementById('btn-close-keys').onclick = () => {
    document.getElementById('modal-inputs').classList.remove('active');
};

function populateKeyList() {
    if (!keyList) return;
    keyList.innerHTML = '';
    const labels = ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "SELECT", "START", "R", "L"];
    
    Object.keys(keyMap).forEach(key => {
        const row = document.createElement('div');
        row.className = 'menu-item toggle-row';
        row.style.background = 'rgba(0,0,0,0.03)';
        row.innerHTML = `<span>Keyboard: <b>${key}</b></span> <span style="color:var(--accent)">GBA: ${labels[keyMap[key]]}</span>`;
        keyList.appendChild(row);
    });
}

// User Preference Toggles
document.getElementById('toggle-dark-mode').onchange = (e) => {
    document.body.classList.toggle('dark-mode', e.target.checked);
};

document.getElementById('toggle-mobile-ui').onchange = (e) => {
    document.getElementById('touch-controls').classList.toggle('active', e.target.checked);
};

// --- 5. QUARTZ OS ANIMATION & RENDER LOOP ---

function renderLoop() {
    const time = Date.now() / 1000;
    
    // THEME CHECK: Ensure canvas stays clean while idle
    const isDark = document.body.classList.contains('dark-mode');
    
    if (emulatorState === 'IDLE' || emulatorState === 'LOADED') {
        ctx.fillStyle = isDark ? '#0d0d12' : '#f0f2f5';
        ctx.fillRect(0, 0, 240, 160);

        // Pulsing UI Feedback
        const alpha = (Math.sin(time * 3) + 1) / 2 * 0.4 + 0.2;
        ctx.fillStyle = isDark ? `rgba(122, 122, 255, ${alpha})` : `rgba(139, 155, 180, ${alpha})`;
        ctx.font = '800 11px "Segoe UI"'; 
        ctx.textAlign = 'center';
        
        const statusText = (emulatorState === 'IDLE') ? 'INSERT CARTRIDGE' : 'CARTRIDGE READY';
        ctx.fillText(statusText, 120, 85);
    } 
    else if (emulatorState === 'BOOTING') {
        bootProgress += 0.012; // Speed of Quartz OS boot
        
        if (bootProgress < 1.0) {
            // White Screen Phase
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(0, 0, 240, 160);
            
            // Quartz OS Sliding Text Logic (Confirmed Math)
            ctx.fillStyle = '#111118'; 
            ctx.font = '800 18px "Segoe UI"'; 
            ctx.textAlign = 'center';
            const slideY = Math.min(85, -20 + (bootProgress * 100) * 1.5);
            ctx.fillText('QUARTZ OS', 120, slideY);
        } 
        else if (bootProgress < 2.0) {
            // Cinematic Fade-to-Black
            const fadeAlpha = Math.min(1, bootProgress - 1.0);
            ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`; 
            ctx.fillRect(0, 0, 240, 160);
        } 
        else {
            // ENGINE START
            console.log("Quartz Engine: Boot sequence complete. Launching IodineGBA.");
            emulatorState = 'RUNNING';
            
            try {
                Iodine.loadROM(romMemory);
                Iodine.play();
            } catch (err) {
                console.error("Quartz Engine Error: Failed to load ROM memory.", err);
                emulatorState = 'IDLE';
                alert("Critical: ROM loading failed.");
            }
            return; // Exit UI loop as Iodine takes control of canvas
        }
    }

    // Keep the UI loop running if not in emulator mode
    if (emulatorState !== 'RUNNING') {
        requestAnimationFrame(renderLoop);
    }
}

// Initialize Application Loop
console.log("Quartz GBA: System Ready.");
renderLoop();
