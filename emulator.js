// --- Core Elements ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const menuBtn = document.getElementById('menu-btn');
const menuPanel = document.getElementById('menu-panel');
const romLoader = document.getElementById('romLoader');

// --- Input Management ---
let keyMap = {
    'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Left': 'ArrowLeft', 'Right': 'ArrowRight',
    'A': 'x', 'B': 'z', 'Start': 'Enter', 'Select': 'Shift'
};
let inputState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };

window.addEventListener('keydown', (e) => handleKey(e.key, 1));
window.addEventListener('keyup', (e) => handleKey(e.key, 0));

function handleKey(key, isPressed) {
    for (const [gbaBtn, mappedKey] of Object.entries(keyMap)) {
        if (key.toLowerCase() === mappedKey.toLowerCase()) {
            inputState[gbaBtn] = isPressed;
        }
    }
}

function pollGamepad() {
    const gamepads = navigator.getGamepads();
    if (!gamepads[0]) return;
    const gp = gamepads[0];
    inputState['A'] = gp.buttons[0]?.pressed ? 1 : 0;
    inputState['B'] = gp.buttons[1]?.pressed ? 1 : 0;
    inputState['Left'] = gp.axes[0] < -0.5 ? 1 : 0;
    inputState['Right'] = gp.axes[0] > 0.5 ? 1 : 0;
}

// --- Keybind UI Logic ---
const modal = document.getElementById('modal-overlay');
const keyList = document.getElementById('key-list');
let listeningForKey = null;

document.getElementById('btn-keybinds').addEventListener('click', () => {
    menuPanel.classList.remove('open');
    renderKeybinds();
    modal.classList.add('active');
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.classList.remove('active');
    listeningForKey = null;
});

function renderKeybinds() {
    keyList.innerHTML = '';
    for (const [gbaBtn, mappedKey] of Object.entries(keyMap)) {
        const row = document.createElement('div');
        row.className = 'key-row';
        row.innerHTML = `<span>${gbaBtn}</span> <button class="key-btn" id="map-${gbaBtn}">${mappedKey}</button>`;
        keyList.appendChild(row);

        document.getElementById(`map-${gbaBtn}`).addEventListener('click', function() {
            if (listeningForKey) document.getElementById(`map-${listeningForKey}`).classList.remove('listening');
            listeningForKey = gbaBtn;
            this.innerText = "Press Key...";
            this.classList.add('listening');
        });
    }
}

window.addEventListener('keydown', (e) => {
    if (listeningForKey) {
        keyMap[listeningForKey] = e.key;
        listeningForKey = null;
        renderKeybinds();
    }
});

// --- UI Toggles ---
document.getElementById('btn-touch').addEventListener('click', () => {
    document.getElementById('touch-controls').classList.toggle('active');
    menuPanel.classList.remove('open');
});

menuBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    menuPanel.classList.toggle('open'); 
});

document.addEventListener('click', (e) => {
    if (!menuPanel.contains(e.target) && menuPanel.classList.contains('open') && e.target !== menuBtn) {
        menuPanel.classList.remove('open');
    }
});

document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    menuPanel.classList.remove('open');
});
document.getElementById('btn-load').addEventListener('click', () => { 
    romLoader.click(); 
    menuPanel.classList.remove('open'); 
});


// --- Rom Loading ---
let romMemory = null;

romLoader.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        romMemory = new Uint8Array(e.target.result);
        console.log(`ROM Loaded: ${romMemory.length} bytes`);
        
        // Trigger the visual boot sequence!
        emulatorState = 'BOOTING'; 
        bootProgress = 0; 
    };
    reader.readAsArrayBuffer(file);
});


// --- Screen Rendering & Boot Sequence ---
let emulatorState = 'IDLE'; // States: 'IDLE', 'BOOTING', 'RUNNING'
let bootProgress = 0;

function renderLoop() {
    pollGamepad(); // Constantly check for controller input

    if (emulatorState === 'IDLE') {
        const time = Date.now() / 1000;
        
        // Soft, bright gradient for the quartz look
        let gradient = ctx.createLinearGradient(0, 0, 240, 160);
        gradient.addColorStop(0, `#eef2f5`);
        gradient.addColorStop(1, `#d9e2ec`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 240, 160);

        const alpha = (Math.sin(time * 3) + 1) / 2 * 0.5 + 0.3;
        ctx.fillStyle = `rgba(139, 155, 180, ${alpha})`; // Soft accent color
        ctx.font = 'bold 12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('INSERT CARTRIDGE', 120, 85);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, 224, 144);
    } 
    
    else if (emulatorState === 'BOOTING') {
        bootProgress += 0.015; 
        
        if (bootProgress < 1.0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 240, 160);
            
            ctx.fillStyle = '#2d2d3a';
            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            
            let yPos = Math.min(85, -20 + (bootProgress * 100) * 1.5);
            ctx.fillText('QUARTZ OS', 120, yPos);
            
        } else if (bootProgress < 2.0) {
            let fadeAlpha = bootProgress - 1.0;
            ctx.fillStyle = `rgba(45, 45, 58, ${fadeAlpha})`; // Fade to dark slate
            ctx.fillRect(0, 0, 240, 160);
            
        } else {
            emulatorState = 'RUNNING';
            console.log("Boot sequence complete.");
            startEmulatorCore();
            return;
        }
    }

    if (emulatorState !== 'RUNNING') {
        requestAnimationFrame(renderLoop);
    }
}
renderLoop();


// --- The Game Core Placeholder ---
function startEmulatorCore() {
    setInterval(() => {
        // Draw dark slate background
        ctx.fillStyle = '#2d2d3a';
        ctx.fillRect(0, 0, 240, 160);
        
        // Gentle static to indicate activity
        for(let i = 0; i < 300; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
            ctx.fillRect(Math.random() * 240, Math.random() * 160, 2, 2);
        }
        
        ctx.fillStyle = '#8b9bb4'; // Accent color
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CPU CORE ACTIVE...', 120, 80);
    }, 1000 / 60); 
}
