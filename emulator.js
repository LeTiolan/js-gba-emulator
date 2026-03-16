// --- Core Elements ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const menuBtn = document.getElementById('menu-btn');
const menuPanel = document.getElementById('menu-panel');
const romLoader = document.getElementById('romLoader');

// --- Input Management (Keyboard, Gamepad, Touch) ---
let keyMap = {
    'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Left': 'ArrowLeft', 'Right': 'ArrowRight',
    'A': 'x', 'B': 'z', 'Start': 'Enter', 'Select': 'Shift'
};
let inputState = { Up: 0, Down: 0, Left: 0, Right: 0, A: 0, B: 0, Start: 0, Select: 0 };

// Listen for Keyboard
window.addEventListener('keydown', (e) => handleKey(e.key, 1));
window.addEventListener('keyup', (e) => handleKey(e.key, 0));

function handleKey(key, isPressed) {
    for (const [gbaBtn, mappedKey] of Object.entries(keyMap)) {
        if (key.toLowerCase() === mappedKey.toLowerCase()) {
            inputState[gbaBtn] = isPressed;
        }
    }
}

// Check for Gamepad (Polled during emulation loop)
function pollGamepad() {
    const gamepads = navigator.getGamepads();
    if (!gamepads[0]) return;
    const gp = gamepads[0];
    // Simple mapping: A=Btn0, B=Btn1, Dpad=Axes
    inputState['A'] = gp.buttons[0].pressed ? 1 : 0;
    inputState['B'] = gp.buttons[1].pressed ? 1 : 0;
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

        // Click to rebind
        document.getElementById(`map-${gbaBtn}`).addEventListener('click', function() {
            if (listeningForKey) document.getElementById(`map-${listeningForKey}`).classList.remove('listening');
            listeningForKey = gbaBtn;
            this.innerText = "Press Key...";
            this.classList.add('listening');
        });
    }
}

// Capture new keybind
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

menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menuPanel.classList.toggle('open'); });
document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
    menuPanel.classList.remove('open');
});
document.getElementById('btn-load').addEventListener('click', () => { romLoader.click(); menuPanel.classList.remove('open'); });


// --- Canvas Idle Animation ---
let emulationRunning = false;

function drawIdleScreen() {
    if (emulationRunning) return; // Stop animation if game is loaded
    
    // Clear screen to GBA dark grey
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 240, 160);

    // Pulsing Text Logic
    const time = Date.now() / 500;
    const alpha = (Math.sin(time) + 1) / 2 * 0.8 + 0.2; // Pulses between 0.2 and 1.0

    ctx.fillStyle = `rgba(122, 122, 255, ${alpha})`;
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('NO CARTRIDGE INSERTED', 120, 80);
    
    // Draw GBA aspect ratio borders
    ctx.strokeStyle = '#333';
    ctx.strokeRect(10, 10, 220, 140);

    requestAnimationFrame(drawIdleScreen);
}
// Start idle animation immediately on page load
drawIdleScreen();


// --- Rom Loading ---
let romMemory = null;

romLoader.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        romMemory = new Uint8Array(e.target.result);
        emulationRunning = true; // Stops the idle screen
        
        console.log(`ROM Loaded: ${romMemory.length} bytes`);
        startEmulation();
    };
    reader.readAsArrayBuffer(file);
});

function startEmulation() {
    // Clear screen for game boot
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 240, 160);
    ctx.fillStyle = '#fff';
    ctx.fillText('BOOTING...', 120, 80);
    
    // CPU Loop will go here
}
