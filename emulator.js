// --- UI Elements ---
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const menuBtn = document.getElementById('menu-btn');
const menuPanel = document.getElementById('menu-panel');
const btnLoad = document.getElementById('btn-load');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnKeybinds = document.getElementById('btn-keybinds');
const romLoader = document.getElementById('romLoader');

// --- UI Logic ---

// Toggle Menu Open/Close
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent the click from immediately closing it
    menuPanel.classList.toggle('open');
});

// Click anywhere outside the menu to close it
document.addEventListener('click', (e) => {
    if (!menuPanel.contains(e.target) && menuPanel.classList.contains('open')) {
        menuPanel.classList.remove('open');
    }
});

// Fullscreen API Handling
btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn(`Error enabling fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
    menuPanel.classList.remove('open'); // Close menu after clicking
});

// Keybinds Button Placeholder
btnKeybinds.addEventListener('click', () => {
    alert("Keybind menu coming next!\n\nDefault will be mapped as:\nArrows = D-Pad\nZ = B button\nX = A button\nEnter = Start\nShift = Select");
    menuPanel.classList.remove('open');
});

// When "Load Game" is clicked, trigger the hidden file input
btnLoad.addEventListener('click', () => {
    romLoader.click();
    menuPanel.classList.remove('open');
});


// --- Emulation Core Logic ---

let romMemory = null;

romLoader.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        romMemory = new Uint8Array(arrayBuffer);
        
        console.log(`ROM loaded! Size: ${romMemory.length} bytes`);
        startEmulation();
    };
    reader.readAsArrayBuffer(file);
});

function startEmulation() {
    console.log("System booting...");
    // Future CPU loop goes here
}
