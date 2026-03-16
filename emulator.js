/**
 * =========================================================
 * QUARTZ GBA - CORE LOGIC (emulator.js)
 * =========================================================
 */

/* =========================================================
   SECTION 1: DOM BINDINGS & UI NAVIGATION
   ========================================================= */

// 1.1 - DOM Element Selection
const DOM = {
    // Menu & Overlays
    menuBtn: document.getElementById('menu-btn'),
    menuPanel: document.getElementById('menu-panel'),
    themeOverlay: document.getElementById('theme-fade-overlay'),
    playOverlay: document.getElementById('play-overlay'),
    
    // Core Buttons
    btnLoad: document.getElementById('btn-load'),
    btnStartGame: document.getElementById('btn-start-game'),
    
    // File Inputs (Dual-Loader)
    dummyLoader: document.getElementById('dummyLoader'),
    romLoader: document.getElementById('romLoader'),
    
    // Modals
    modalLibrary: document.getElementById('modal-library'),
    modalInputs: document.getElementById('modal-inputs'),
    modalCheats: document.getElementById('modal-cheats'),
    
    // Modal Triggers
    btnLibrary: document.getElementById('btn-library'),
    btnKeybinds: document.getElementById('btn-keybinds'),
    btnCheats: document.getElementById('btn-cheats'),
    
    // Modal Close Buttons
    btnCloseLibrary: document.getElementById('btn-close-library'),
    btnCloseKeys: document.getElementById('btn-close-keys'),
    btnCloseCheats: document.getElementById('btn-close-cheats'),
    
    // Toggles
    toggleDarkMode: document.getElementById('toggle-dark-mode'),
    toggleMobileUI: document.getElementById('toggle-mobile-ui'),
    touchControls: document.getElementById('touch-controls')
};

// 1.2 - Main Menu Toggle Logic
DOM.menuBtn.addEventListener('click', () => {
    DOM.menuPanel.classList.toggle('open');
});

// Close menu if clicking outside of it
document.addEventListener('click', (e) => {
    if (!DOM.menuPanel.contains(e.target) && e.target !== DOM.menuBtn) {
        DOM.menuPanel.classList.remove('open');
    }
});

// 1.3 - Modal Management
function openModal(modal) {
    DOM.menuPanel.classList.remove('open'); // Close menu when opening modal
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// Bind Modal Opens
DOM.btnLibrary.addEventListener('click', () => openModal(DOM.modalLibrary));
DOM.btnKeybinds.addEventListener('click', () => openModal(DOM.modalInputs));
DOM.btnCheats.addEventListener('click', () => openModal(DOM.modalCheats));

// Bind Modal Closes
DOM.btnCloseLibrary.addEventListener('click', () => closeModal(DOM.modalLibrary));
DOM.btnCloseKeys.addEventListener('click', () => closeModal(DOM.modalInputs));
DOM.btnCloseCheats.addEventListener('click', () => closeModal(DOM.modalCheats));

// 1.4 - System Toggles (Dark Mode & Mobile UI)
DOM.toggleDarkMode.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
});

DOM.toggleMobileUI.addEventListener('change', (e) => {
    if (e.target.checked) {
        DOM.touchControls.classList.add('active');
    } else {
        DOM.touchControls.classList.remove('active');
    }
});

// 1.5 - The Dual-Loader Flow (Autoplay Bypass)
// Step A: User clicks the visible load button, which triggers the hidden dummy input.
DOM.btnLoad.addEventListener('click', () => {
    DOM.menuPanel.classList.remove('open');
    DOM.dummyLoader.click();
});

// Step B: User selects a file. We catch it, but DO NOT start the emulator yet.
// Instead, we show the "PRESS PLAY" overlay to get a valid user interaction.
let pendingRomFile = null;

DOM.dummyLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    pendingRomFile = file;
    console.log(`[System] File staged: ${file.name}. Waiting for user interaction to satisfy Audio API.`);
    
    // Show the Press Play overlay
    DOM.playOverlay.classList.add('active');
});

// Step C: User clicks "PRESS PLAY". We hide the overlay, trigger full screen, 
// and hand the file over to the emulation engine (to be built in later sections).
DOM.btnStartGame.addEventListener('click', () => {
    DOM.playOverlay.classList.remove('active');
    
    // Attempt to lock screen to landscape and go fullscreen (Mobile/Desktop QoL)
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => console.log("Fullscreen blocked:", err));
    }
    
    console.log(`[System] Play button clicked! Handing ${pendingRomFile.name} to the Engine...`);
    
    // Note: The actual DataTransfer to the emulator engine will go here in Section 4.
});
