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


// --- Screen Rendering & Boot Sequence ---
let emulatorState = 'IDLE'; // States: 'IDLE', 'BOOTING', 'RUNNING'
let bootProgress = 0;

function renderLoop() {
    // 1. THE IDLE SCREEN
    if (emulatorState === 'IDLE') {
        const time = Date.now() / 1000;
        
        // Create a shifting, colorful gradient background
        let gradient = ctx.createLinearGradient(0, 0, 240, 160);
        gradient.addColorStop(0, `hsl(${(time * 40) % 360}, 60%, 20%)`);
        gradient.addColorStop(1, `hsl(${((time * 40) + 180) % 360}, 60%, 10%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 240, 160);

        // Draw pulsing text
        const alpha = (Math.sin(time * 3) + 1) / 2 * 0.7 + 0.3; // Pulses opacity
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 14px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AWAITING CARTRIDGE', 120, 85);
        
        // Draw a sleek border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, 220, 140);
    } 
    
    // 2. THE BOOT ANIMATION
    else if (emulatorState === 'BOOTING') {
        bootProgress += 0.015; // Controls the speed of the animation
        
        if (bootProgress < 1.0) {
            // White screen flash
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 240, 160);
            
            // Logo dropping down from the top
            ctx.fillStyle = '#222';
            ctx.font = 'bold 24px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            
            // Math to make it drop and stop at the center (y = 85)
            let yPos = Math.min(85, -20 + (bootProgress * 100) * 1.5);
            ctx.fillText('SYSTEM BOOT', 120, yPos);
            
        } else if (bootProgress < 2.0) {
            // Smooth fade to black
            let fadeAlpha = bootProgress - 1.0;
            ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
            ctx.fillRect(0, 0, 240, 160);
            
        } else {
            // Animation finished! Hand over to the actual emulator.
            emulatorState = 'RUNNING';
            console.log("Boot sequence complete. Handing over to CPU...");
            startEmulatorCore();
            return; // Exit this specific loop
        }
    }

    // Keep the animation looping at 60FPS unless the game is running
    if (emulatorState !== 'RUNNING') {
        requestAnimationFrame(renderLoop);
    }
}

// Start the visuals immediately on page load
renderLoop();


// --- Rom Loading Logic ---
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


// --- The Actual Game Core ---
function startEmulatorCore() {
    // For now, since we haven't written the CPU, we will just draw 
    // some cool static "Matrix" rain or noise to show it successfully transitioned.
    setInterval(() => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 240, 160);
        
        for(let i = 0; i < 400; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#444';
            ctx.fillRect(Math.random() * 240, Math.random() * 160, 2, 2);
        }
        
        ctx.fillStyle = '#0f0'; // Hacker green
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CPU CORE ACTIVE...', 120, 80);
    }, 1000 / 60); // 60 FPS
}
