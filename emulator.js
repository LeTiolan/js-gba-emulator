/**
 * =========================================================
 * QUARTZ GBA - CORE LOGIC (emulator.js)
 * =========================================================
 */
/* =========================================================
   DIAGNOSTIC OVERRIDE: ON-SCREEN CONSOLE
   ========================================================= */
window.addEventListener('unhandledrejection', function(event) {
    const errorLog = document.createElement('div');
    errorLog.style.cssText = 'position:fixed; bottom:0; left:0; width:100vw; background:#8b0000; color:#fff; z-index:999999; padding:20px; font-family:"Courier New", monospace; font-size:2vw; font-weight:bold; box-sizing:border-box; word-wrap: break-word;';
    errorLog.innerText = `PROMISE REJECTION (ASYNC FATAL):\n${event.reason}`;
    document.body.appendChild(errorLog);
});
/* =========================================================
   SECTION 1: DOM BINDINGS & UI NAVIGATION
   ========================================================= */

// 1.1 - DOM Element Selection (Unified)
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
    dummyLoader: document.getElementById('dummy-loader'),
    romLoader: document.getElementById('rom-loader'),
    
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

// 1.2 - Main Menu Toggle & Master Engine Start
DOM.menuBtn.onclick = function() {
    DOM.menuPanel.classList.toggle('open');
};

DOM.btnStartGame.onclick = function() {
    if (!pendingRomFile) {
        alert("Please load a game first!");
        return;
    }

    // 1. UI Cleanup
    if (DOM.playOverlay) DOM.playOverlay.style.display = 'none';
    DOM.playOverlay.classList.remove('active');
    
    // 2. Fullscreen Request
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }

    // 3. Show Quartz Progress Bar
    const loader = document.getElementById('engine-loader');
    if (loader) {
        loader.style.display = 'flex';
        loader.style.opacity = '1';
    }
    
  // 4. Initialize Hardware
    GBA_Engine.init();
    
    // 5. Only link if the core is actually ready, otherwise let the System Loader handle it
    if (window.isCoreLoaded && typeof CoreBridge !== 'undefined') {
        CoreBridge.linkEngine();
    } else {
        console.log("[System] Core not ready yet. System Loader will auto-bridge on completion.");
    }
};

// 1.3 - Modal Management
function openModal(modal) {
    if (DOM.menuPanel) DOM.menuPanel.classList.remove('open');
    if (modal) modal.classList.add('active');
}

function closeModal(modal) {
    if (modal) modal.classList.remove('active');
}

// Bind Modal Triggers
if (DOM.btnLibrary) DOM.btnLibrary.addEventListener('click', () => openModal(DOM.modalLibrary));
if (DOM.btnKeybinds) DOM.btnKeybinds.addEventListener('click', () => openModal(DOM.modalInputs));
if (DOM.btnCheats) DOM.btnCheats.addEventListener('click', () => openModal(DOM.modalCheats));

// Bind Modal Close Buttons
if (DOM.btnCloseLibrary) DOM.btnCloseLibrary.addEventListener('click', () => closeModal(DOM.modalLibrary));
if (DOM.btnCloseKeys) DOM.btnCloseKeys.addEventListener('click', () => closeModal(DOM.modalInputs));
if (DOM.btnCloseCheats) DOM.btnCloseCheats.addEventListener('click', () => closeModal(DOM.modalCheats));

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
                // BLOCKER: Prevent clicking if the engine is still loading
                if (!window.isCoreLoaded) {
                    alert("System is still igniting! Please wait.");
                    return;
                }
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
/* =========================================================
   SECTION 3: THE INPUT MANAGER (KEYBOARD & TOUCH)
   ========================================================= */

// 3.1 - Default Key Bindings
// Maps GBA buttons to physical keyboard keys
let keyMap = {
    'Up': 'ArrowUp',
    'Down': 'ArrowDown',
    'Left': 'ArrowLeft',
    'Right': 'ArrowRight',
    'A': 'KeyX',
    'B': 'KeyZ',
    'L': 'KeyA',
    'R': 'KeyS',
    'Start': 'Enter',
    'Select': 'ShiftRight'
};

// State tracker to know what is currently being pressed
const inputState = {
    'Up': false, 'Down': false, 'Left': false, 'Right': false,
    'A': false, 'B': false, 'L': false, 'R': false,
    'Start': false, 'Select': false
};

// 3.2 - Visual Feedback for Touch Controls
// This function lights up the on-screen buttons when pressed (via touch OR keyboard)
function toggleVisualButton(gbaKey, isPressed) {
    // Find the touch button element that corresponds to this GBA key
    const btnElement = document.querySelector(`.t-btn[data-key="${gbaKey}"]`);
    if (btnElement) {
        if (isPressed) {
            btnElement.style.background = '#fff';
            btnElement.style.color = '#000';
            btnElement.style.transform = 'scale(0.95)';
        } else {
            btnElement.style.background = ''; // Revert to CSS default
            btnElement.style.color = '';
            btnElement.style.transform = '';
        }
    }
}

// 3.3 - Keyboard Event Listeners
document.addEventListener('keydown', (e) => {
    // Prevent default scrolling when using arrow keys
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].indexOf(e.code) > -1) {
        e.preventDefault();
    }

    // Check if the pressed key matches anything in our keyMap
    for (const [gbaKey, physicalKey] of Object.entries(keyMap)) {
        if (e.code === physicalKey && !inputState[gbaKey]) {
            inputState[gbaKey] = true;
            toggleVisualButton(gbaKey, true);
            console.log(`[Input] ${gbaKey} Pressed`);
            // Emulation engine hook will go here later
        }
    }
});

document.addEventListener('keyup', (e) => {
    for (const [gbaKey, physicalKey] of Object.entries(keyMap)) {
        if (e.code === physicalKey) {
            inputState[gbaKey] = false;
            toggleVisualButton(gbaKey, false);
            console.log(`[Input] ${gbaKey} Released`);
            // Emulation engine hook will go here later
        }
    }
});

// 3.4 - Touch Event Listeners (Mobile Controller)
const touchButtons = document.querySelectorAll('.t-btn');

touchButtons.forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent accidental zooming/scrolling
        const gbaKey = btn.getAttribute('data-key');
        if (!inputState[gbaKey]) {
            inputState[gbaKey] = true;
            toggleVisualButton(gbaKey, true);
            
            // Trigger tiny haptic vibration if the device supports it
            if (navigator.vibrate) navigator.vibrate(10); 
            
            console.log(`[Touch] ${gbaKey} Pressed`);
            // Emulation engine hook will go here later
        }
    });

    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        const gbaKey = btn.getAttribute('data-key');
        inputState[gbaKey] = false;
        toggleVisualButton(gbaKey, false);
        console.log(`[Touch] ${gbaKey} Released`);
        // Emulation engine hook will go here later
    });
});

// 3.5 - Key Mapping Modal UI Generation
const keyListContainer = document.getElementById('key-list');
let isWaitingForBind = false;
let keyToBind = null;

function renderKeyMapUI() {
    keyListContainer.innerHTML = ''; // Clear previous list
    
    for (const [gbaKey, physicalKey] of Object.entries(keyMap)) {
        const row = document.createElement('div');
        row.className = 'menu-item toggle-row';
        row.style.cursor = 'default';
        
        const label = document.createElement('span');
        label.textContent = gbaKey;
        label.style.fontWeight = 'bold';
        
        const bindBtn = document.createElement('button');
        bindBtn.className = 'primary-btn';
        bindBtn.textContent = physicalKey;
        bindBtn.style.flex = '0 0 150px'; // Keep button widths uniform
        
        // Listen for user trying to rebind this key
        bindBtn.addEventListener('click', () => {
            if (isWaitingForBind) return; // Prevent multiple simultaneous binds
            
            isWaitingForBind = true;
            keyToBind = gbaKey;
            bindBtn.textContent = 'Press a key...';
            bindBtn.style.background = 'var(--danger)';
            
            // One-time listener for the next key pressed
            const binder = (e) => {
                e.preventDefault();
                keyMap[keyToBind] = e.code; // Update the map with the new physical key
                
                isWaitingForBind = false;
                keyToBind = null;
                document.removeEventListener('keydown', binder);
                
                renderKeyMapUI(); // Re-render the list to show the new key
            };
            
            document.addEventListener('keydown', binder);
        });
        
        row.appendChild(label);
        row.appendChild(bindBtn);
        keyListContainer.appendChild(row);
    }
}

// 3.6 - Input Settings Resets & Triggers
document.getElementById('btn-reset-keys').addEventListener('click', () => {
    // Hard reset back to default
    keyMap = {
        'Up': 'ArrowUp', 'Down': 'ArrowDown', 'Left': 'ArrowLeft', 'Right': 'ArrowRight',
        'A': 'KeyX', 'B': 'KeyZ', 'L': 'KeyA', 'R': 'KeyS',
        'Start': 'Enter', 'Select': 'ShiftRight'
    };
    renderKeyMapUI();
});

// Render the UI once on boot so it's ready when the modal opens
renderKeyMapUI();
/* =========================================================
   SECTION 4: ENGINE WRAPPER & CORE BOOT SEQUENCE
   ========================================================= */

// 4.1 - The Engine State Manager
const GBA_Engine = {
    isRunning: false,
    audioContext: null,
    animationFrameId: null,
    core: null, // This will eventually hold our WASM/JS CPU core
    
    // 4.2 - Initialize Audio & Video Systems
    init: function() {
        console.log("[Engine] Initializing Hardware Subsystems...");
        
        // Boot Web Audio API (Must happen after user clicks 'PRESS PLAY')
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            console.log(`[Engine] AudioContext booted. Sample Rate: ${this.audioContext.sampleRate}Hz`);
        } catch (e) {
            console.error("[Engine] Web Audio API not supported in this browser.", e);
        }

        // Setup Canvas Context (Preparing for WebGL or 2D rendering)
        const canvas = document.getElementById('screen');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            console.log("[Engine] WebGL Hardware Acceleration Active.");
            // WebGL setup logic will expand here in the Video module
        } else {
            console.log("[Engine] WebGL unavailable. Falling back to 2D Canvas.");
            this.ctx = canvas.getContext('2d');
        }
    },

    // 4.3 - Load the Binary ROM
    loadRom: function(file) {
        console.log(`[Engine] Reading binary payload: ${file.name}`);
        
        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const romBuffer = new Uint8Array(e.target.result);
                    console.log(`[Engine] ROM loaded into memory. Size: ${romBuffer.length} bytes`);
                  if (!window.EmulatorCore || !CoreBridge.isCoreLoaded) {
        // Instead of an alert, we update the UI text
        document.getElementById('engine-status').innerText = "WAITING FOR ENGINE...";
        return;
    }

                    // 1. Inject the ROM into the virtual file system
                    window.EmulatorCore.FS.writeFile('/game.gba', romBuffer);
                    
                    // 2. Prepare the Canvas
                    const canvas = document.getElementById('screen');
                    if (canvas) {
                        canvas.style.display = "block";
                        canvas.focus(); // Forces keyboard inputs to go to the game
                    } else {
                        alert("HTML ERROR: I cannot find the <canvas id='screen'> tag!");
                    }

                    // 3. Hide the menus (Using your actual DOM IDs)
                    const menuIDs = ['play-overlay', 'menu-panel', 'theme-fade-overlay'];
                    menuIDs.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.display = "none";
                    });
                    
                    // Fallback just in case you use a different wrapper class
                    const backupMenu = document.querySelector('.qz-container') || document.querySelector('main');
                    if (backupMenu) backupMenu.style.display = "none";

                    // 4. BOOT THE ENGINE (Replaces your empty 'this.start()')
                    window.EmulatorCore.callMain(['/game.gba']);
                    
                } catch (innerErr) {
                    // This will pop up on your screen if the emulator crashes
                    alert("BOOT CRASH: " + innerErr.message);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (outerErr) {
            // This will pop up if the browser fails to read the file
            alert("FILE LOAD CRASH: " + outerErr.message);
        }
    },

    // 4.4 - The 60FPS Main Loop
    start: function() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log("[Engine] Boot sequence complete. Executing CPU clock.");

        // Resume audio context if browser suspended it
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Hide the Quartz OS "INSERT CARTRIDGE" text, prepare for video output
        document.getElementById('screen').style.background = '#000';

        let lastTime = performance.now();
        
        const loop = (currentTime) => {
            if (!this.isRunning) return;

            // Calculate Delta Time to lock at 60 FPS (approx 16.6ms per frame)
            const deltaTime = currentTime - lastTime;
            
            if (deltaTime >= 16.6) {
                // 1. Poll Inputs: Feed our inputState object into the CPU
                // this.core.setInputs(inputState);
                
                // 2. Step CPU: Tell the core to run one frame's worth of cycles
                // this.core.stepFrame();
                
                // 3. Render Video: Pull the frame buffer and paint it to canvas
                // this.renderFrame();
                
                lastTime = currentTime;
            }

            this.animationFrameId = requestAnimationFrame(loop);
        };

        this.animationFrameId = requestAnimationFrame(loop);
    },

    pause: function() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.audioContext) {
            this.audioContext.suspend();
        }
        console.log("[Engine] Emulation paused.");
    }
};

/* =========================================================
   SECTION 5: THE VIDEO RENDERING PIPELINE
   ========================================================= */

const VideoCore = {
    canvas: document.getElementById('screen'),
    ctx: null,
    width: 240, // Native GBA horizontal resolution
    height: 160, // Native GBA vertical resolution
    imageData: null,

    // 5.1 - Initialize the Canvas Subsystem
    init: function() {
        // We use alpha: false to optimize performance since GBA has no transparent screen background
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        // Create a blank image buffer exactly the size of a GBA screen
        this.imageData = this.ctx.createImageData(this.width, this.height);
        console.log("[Video] 2D Rendering Pipeline initialized.");
        
        // Apply the default UI filter on boot
        const currentFilter = document.getElementById('select-video-filter').value;
        this.updateFilter(currentFilter);
    },

    // 5.2 - The Render Call (Fired by the Engine Loop)
    drawFrame: function(pixelBuffer) {
        if (!this.ctx) return;
        
        // pixelBuffer is a highly optimized Uint8ClampedArray of RGBA values handed over by the WASM core
        this.imageData.data.set(pixelBuffer);
        this.ctx.putImageData(this.imageData, 0, 0);
    },

    // 5.3 - Dynamic CSS Shaders
    updateFilter: function(filterType) {
        switch(filterType) {
            case 'nearest':
                // Sharp, integer-scaled squares. Perfect for retro games.
                this.canvas.style.imageRendering = 'pixelated';
                this.canvas.style.filter = 'none';
                break;
            case 'bilinear':
                // Smooths out the harsh edges
                this.canvas.style.imageRendering = 'auto';
                this.canvas.style.filter = 'blur(0.5px)';
                break;
            case 'lcd':
                // Sharp pixels but with a slight color shift/contrast tweak to mimic the unlit GBA screen
                this.canvas.style.imageRendering = 'pixelated';
                this.canvas.style.filter = 'contrast(1.1) brightness(0.9) sepia(0.2) hue-rotate(-10deg)';
                break;
        }
        console.log(`[Video] Filter mapped to: ${filterType}`);
    }
};

// 5.4 - Hook up the Video Filter Dropdown
document.getElementById('select-video-filter').addEventListener('change', (e) => {
    VideoCore.updateFilter(e.target.value);
});

// Boot the video pipeline when the script loads
VideoCore.init();
/* =========================================================
   SECTION 6: SAVE STATES & MEMORY MANAGEMENT
   ========================================================= */

const MemoryManager = {
    // 6.1 - Save / Load State (Instant Freeze-Frame)
    saveState: function() {
        if (!GBA_Engine.isRunning) {
            alert("You must be running a game to save a state!");
            return;
        }
        console.log(`[Memory] Saving state for ${pendingRomFile.name}...`);
        
        // This is where we will pull the RAM buffer from the WASM Core
        // const stateData = GBA_Engine.core.saveState();
        // saveToIndexedDB(stateData);
        
        DOM.menuPanel.classList.remove('open');
        alert("State Saved! (Engine hook pending)");
    },

    loadState: function() {
        if (!GBA_Engine.isRunning) {
            alert("You must be running a game to load a state!");
            return;
        }
        console.log(`[Memory] Loading state for ${pendingRomFile.name}...`);
        
        // This is where we will push the RAM buffer back into the WASM Core
        // const stateData = loadFromIndexedDB();
        // GBA_Engine.core.loadState(stateData);
        
        DOM.menuPanel.classList.remove('open');
        alert("State Loaded! (Engine hook pending)");
    },

    // 6.2 - Exporting In-Game Battery Saves (.sav)
    exportSav: function() {
        if (!pendingRomFile) {
            alert("Load a cartridge first to export its .sav data!");
            return;
        }
        console.log("[Memory] Exporting .sav file...");
        
        // Dummy export logic to test the download pipeline
        // Later, this will extract the actual SRAM array from the emulator core
        const dummySav = new Blob(["DUMMY_SAVE_DATA"], { type: "application/octet-stream" });
        const url = URL.createObjectURL(dummySav);
        
        const a = document.createElement('a');
        a.href = url;
        // Name the save file exactly after the ROM file
        a.download = pendingRomFile.name.replace('.gba', '.sav'); 
        a.click();
        
        URL.revokeObjectURL(url);
    },

    // 6.3 - Importing In-Game Battery Saves (.sav)
    importSav: function() {
        if (!pendingRomFile) {
            alert("Load a cartridge first before importing a .sav file!");
            return;
        }
        
        // Generate a hidden file input on the fly to grab the .sav file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sav';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            console.log(`[Memory] Importing save data from ${file.name}...`);
            
            // This will push the file data directly into the emulator's SRAM
            // GBA_Engine.core.loadSRAM(file);
            
            DOM.menuPanel.classList.remove('open');
            alert(`Successfully imported ${file.name}! (Engine hook pending)`);
        };
        
        input.click(); // Trigger the file browser
    }
};

// 6.4 - Bind the Memory Manager to the UI Buttons
document.getElementById('btn-save-state').addEventListener('click', () => MemoryManager.saveState());
document.getElementById('btn-load-state').addEventListener('click', () => MemoryManager.loadState());
document.getElementById('btn-export-sav').addEventListener('click', () => MemoryManager.exportSav());
document.getElementById('btn-import-sav').addEventListener('click', () => MemoryManager.importSav());
/* =========================================================
   SECTION 7: THE mGBA CORE INTEGRATION (STABLE PIXEL)
   ========================================================= */

const CoreBridge = {
    isCoreLoaded: false,

    // 7.1 - Build the True Pixel Loading Screen
    injectCore: function() {
        const loader = document.createElement('div');
        loader.id = 'quartz-loader';
        
        // Solid black background, hard retro scanlines
        loader.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
            background: #000000 linear-gradient(to bottom, transparent 50%, rgba(20,20,20,0.8) 50%); 
            background-size: 100% 4px; z-index: 9999; display: flex; justify-content: center; 
            align-items: center; flex-direction: column; color: #f4f4f4; 
            transition: opacity 0.8s ease;
        `;
        
        const style = document.createElement('style');
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
            
            #quartz-loader * { font-family: 'VT323', monospace; text-transform: uppercase; }
            
            .qz-title-container { display: flex; align-items: baseline; margin-bottom: 2vh; }
            .qz-title { font-size: 8vw; letter-spacing: 0.5vw; text-shadow: 4px 4px 0px #333; margin: 0; line-height: 1; }
            
            /* Geometric Pulsing Squares */
            .qz-dots { display: flex; gap: 1vw; margin-left: 2vw; }
            .qz-dot { width: 1.5vw; height: 1.5vw; background-color: #f4f4f4; opacity: 0; animation: pulseSquare 1.5s infinite step-end; box-shadow: 2px 2px 0px #333; }
            .qz-dot:nth-child(1) { animation-delay: 0s; }
            .qz-dot:nth-child(2) { animation-delay: 0.5s; }
            .qz-dot:nth-child(3) { animation-delay: 1s; }
            @keyframes pulseSquare { 0%, 100% { opacity: 0; } 50% { opacity: 1; } }
            
            .qz-bar-wrapper { width: 80vw; height: 4vw; background: #111; border: 0.4vw solid #555; position: relative; margin-bottom: 2vh; box-shadow: 0.5vw 0.5vw 0px #222; }
            .qz-bar { width: 0%; height: 100%; background: #f4f4f4; transition: width 0.1s linear; }
            
            .qz-data-row { width: 80vw; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4vh; }
            .qz-pct { font-size: 6vw; letter-spacing: 0.2vw; color: #f4f4f4; text-shadow: 3px 3px 0px #333; line-height: 1; }
            .qz-eta { font-size: 3vw; letter-spacing: 0.1vw; color: #aaa; text-align: right; margin-top: 1.5vw; }
            
            .qz-status-box { display: flex; align-items: center; gap: 2vw; background: #111; border: 0.2vw solid #444; padding: 1vw 2vw; box-shadow: 0.4vw 0.4vw 0px #222; }
            .qz-status { font-size: 2.5vw; letter-spacing: 0.2vw; color: #ccc; }
            
            .qz-btn { margin-top: 5vh; padding: 1.5vw 4vw; border: 0.3vw solid #f4f4f4; background: #000; color: #f4f4f4; font-size: 4vw; letter-spacing: 0.5vw; cursor: pointer; transition: all 0.1s step-end; box-shadow: 0.5vw 0.5vw 0px #333; }
            .qz-btn:hover { background: #f4f4f4; color: #000; box-shadow: 0.5vw 0.5vw 0px #888; }
        `;
        document.head.appendChild(style);

    loader.innerHTML = `
            <div class="qz-title-container">
                <div id="qz-text" class="qz-title">SYSTEM LOADING</div>
                <div id="qz-dots-container" class="qz-dots">
                    <div class="qz-dot"></div>
                    <div class="qz-dot"></div>
                    <div class="qz-dot"></div>
                </div>
            </div>
            <div class="qz-bar-wrapper"><div id="qz-bar" class="qz-bar"></div></div>
            <div class="qz-data-row">
                <div id="qz-pct" class="qz-pct">0%</div>
                <div id="qz-eta" class="qz-eta">ETA: CALCULATING...</div>
            </div>
            <div class="qz-status-box" id="qz-status-box">
                <div id="qz-status" class="qz-status">ESTABLISHING CONNECTION...</div>
            </div>
            <div id="qz-action"></div>
        `;
        document.body.appendChild(loader);
  
      // Pre-fetch the binary to bypass GitHub's MIME-type restrictions
        fetch('https://letiolan.github.io/Quartz-GBA/core.wasm')
            .then(res => {
                if (!res.ok) throw new Error("WASM binary not found");
                return res.arrayBuffer();
            })
            .then(buffer => {
                // Store the binary in a local memory URL
                window.wasmBlobUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/wasm' }));
                return fetch('core.js');
            })
            .then(response => {
                if (!response.ok) throw new Error("Engine script not found");
                return response.text();
            })
          .then(code => {
                // 1. Progress: Engine Downloaded
                const bar = document.getElementById('qz-bar');
                const pct = document.getElementById('qz-pct');
                const status = document.getElementById('qz-status');
                
                if (status) status.innerText = "CORE DECRYPTED. IGNITING...";
                if (bar) bar.style.width = "90%";
                if (pct) pct.innerText = "90%";

                // 2. Clean the code for Chromebook/Worker compatibility
                let safeCode = code.replace(/import\.meta\.url/g, "'https://letiolan.github.io/Quartz-GBA/core.js'");
                safeCode = safeCode.replace(/export\s+default.*/g, '');
                safeCode = safeCode.replace(/export\s+\{.*\};?/g, '');

                // 3. Setup the WASM pointer
                const moduleSetup = `var Module = { 'noExitRuntime': true, 'arguments': [], 'locateFile': function(p) { if(p.endsWith('.wasm')) return "${window.wasmBlobUrl}"; return 'https://letiolan.github.io/Quartz-GBA/' + p; } };\n`;
                
                const finalEngineCode = moduleSetup + "\n" + safeCode;

                // 4. Create the memory blob
                if (window.coreBlobUrl) URL.revokeObjectURL(window.coreBlobUrl);
                window.coreBlobUrl = URL.createObjectURL(new Blob([finalEngineCode], { type: 'text/javascript' }));
                
                // 5. Inject and Ignite
                setTimeout(() => {
                    const script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.textContent = finalEngineCode + "\nwindow.mGBA = mGBA; window.isCoreLoaded = true;";
                    document.body.appendChild(script);

                    // Final UI Update
                    if (bar) bar.style.width = "100%";
                    if (pct) pct.innerText = "100%";
                    if (status) status.innerText = "SYSTEM READY";

                    // START THE ENGINE
                    this.linkEngine(); 
               }, 500);
            })
            .catch(err => {
                console.error("Core loading failed:", err);
                const applyFaultUI = () => {
                    const textEl = document.getElementById('qz-text');
                    const barEl = document.getElementById('qz-bar');
                    const statusEl = document.getElementById('qz-status');
                    if (textEl) textEl.innerHTML = "SYSTEM FAULT";
                    if (barEl) barEl.style.background = "#ff3333";
                    if (statusEl) {
                        statusEl.innerText = "CORE MISSING";
                        statusEl.style.color = "#ff3333";
                    }
                };
                applyFaultUI();
                setTimeout(applyFaultUI, 100);
            });
    },
   
   // 7.2 - Legacy Silencer (Handled by 7.1)
    waitForEngine: function(loader) {
        console.log("[System] Engine sync handled by InjectCore.");
    },

linkEngine: function() {
        // 1. Initial check for mGBA
        if (!window.mGBA) {
            console.log("[System] mGBA missing, retrying link...");
            setTimeout(() => this.linkEngine(), 200);
            return;
        }

        // --- NEW SAFETY LANDMARK: CANVAS CHECK ---
        const canvas = document.getElementById('screen');
        if (!canvas || canvas.clientWidth === 0) {
            console.log("[System] Canvas not rendered yet, retrying...");
            setTimeout(() => this.linkEngine(), 100);
            return;
        }
        // -----------------------------------------
        
        console.log("[System] Attempting to ignite mGBA WASM Core...");

        // 2. The Safety Buffer: Wrap the ignition in a timeout
        setTimeout(() => {
            window.mGBA({
                canvas: document.getElementById('screen'),
                mainScriptUrlOrBlob: window.coreBlobUrl, 
                locateFile: function(path) {
                    if (path.endsWith('.wasm')) return window.wasmBlobUrl;
                    return 'https://letiolan.github.io/Quartz-GBA/' + path;
                }
            }).then(function(Module) {
                window.EmulatorCore = Module;
                window.isCoreLoaded = true;

                if (typeof pendingRomFile !== 'undefined' && pendingRomFile) {
                    console.log("[System] Ignition Success. Loading ROM...");
                    GBA_Engine.loadRom(pendingRomFile);
                }

              // Target the True Pixel Loader
                const qzLoader = document.getElementById('quartz-loader');
                if (qzLoader) {
                    qzLoader.style.opacity = '0';
                    setTimeout(() => { qzLoader.style.display = 'none'; }, 800);
                }

            }).catch(function(err) {
                alert("ENGINE LINK ERROR: " + err.message);
                console.error("Critical Engine Failure:", err);
            });
        }, 200); 
    }
};

// Start the Quartz system process
CoreBridge.injectCore();
