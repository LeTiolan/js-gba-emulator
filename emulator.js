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
/* =========================================================
   SECTION 2: INDEXEDDB STORAGE & GAME LIBRARY
   ========================================================= */

const DB_NAME = 'QuartzGBA_DB';
const DB_VERSION = 1;
const STORE_ROMS = 'roms';

let dbInstance = null;

// 2.1 - Initialize Local Database
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_ROMS)) {
                // We use the file name as the unique key
                db.createObjectStore(STORE_ROMS, { keyPath: 'name' });
            }
        };
        
        request.onsuccess = (e) => {
            dbInstance = e.target.result;
            console.log("[System] IndexedDB Initialized.");
            refreshLibraryUI(); // Render the library immediately on boot
            resolve(dbInstance);
        };
        
        request.onerror = (e) => {
            console.error("[System] IndexedDB Error:", e.target.error);
            reject(e.target.error);
        };
    });
}

// 2.2 - Save Uploaded ROM to Database
function saveRomToDB(file) {
    if (!dbInstance) return;
    const transaction = dbInstance.transaction([STORE_ROMS], 'readwrite');
    const store = transaction.objectStore(STORE_ROMS);
    
    // Package the raw file data with a timestamp
    const romRecord = {
        name: file.name,
        data: file,
        added: Date.now()
    };
    
    store.put(romRecord);
    
    transaction.oncomplete = () => {
        console.log(`[Library] ${file.name} saved to local storage.`);
        refreshLibraryUI();
    };
}

// 2.3 - Render the Library UI
function refreshLibraryUI() {
    if (!dbInstance) return;
    const listContainer = document.getElementById('library-list');
    listContainer.innerHTML = ''; // Clear current list

    const transaction = dbInstance.transaction([STORE_ROMS], 'readonly');
    const store = transaction.objectStore(STORE_ROMS);
    const request = store.getAll();

    request.onsuccess = (e) => {
        const roms = e.target.result;
        
        // Empty state fallback
        if (roms.length === 0) {
            listContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No games found. Load a cartridge to add it to your collection!</p>';
            return;
        }

        // Sort library so the newest added games are at the top
        roms.sort((a, b) => b.added - a.added);

        // Generate the Buttons
        roms.forEach(rom => {
            const btn = document.createElement('button');
            btn.className = 'menu-item';
            btn.style.width = '100%'; 
            
            // Remove the ".gba" extension for a cleaner UI display
            const cleanName = rom.name.replace(/\.[^/.]+$/, "");
            btn.textContent = `🕹️ ${cleanName}`;
            
            // 2.4 - Clicking a game in the library
            btn.addEventListener('click', () => {
                // Hook into the pendingRomFile variable from Section 1
                pendingRomFile = rom.data; 
                console.log(`[Library] Selected ${rom.name} from database.`);
                
                // Close the library modal natively
                closeModal(DOM.modalLibrary);
                
                // Trigger the "PRESS PLAY" sequence
                DOM.playOverlay.classList.add('active');
            });
            
            listContainer.appendChild(btn);
        });
    };
}

// 2.5 - Hook into Section 1's File Upload
// When the user uploads a file using "Load Cartridge", we intercept it and save it.
DOM.dummyLoader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        saveRomToDB(file);
    }
});

// Boot the database when the script loads
initDB();
