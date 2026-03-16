// Grab the canvas to draw to
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

// The ROM will be loaded into this Typed Array
let romMemory = null;

// Handle the user uploading a .gba file
document.getElementById('romLoader').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Read the file as raw binary data into a Uint8Array
        const arrayBuffer = e.target.result;
        romMemory = new Uint8Array(arrayBuffer);
        
        console.log(`ROM loaded successfully. Size: ${romMemory.length} bytes`);
        startEmulation();
    };
    reader.readAsArrayBuffer(file);
});

function startEmulation() {
    console.log("Starting emulation loop...");
    // This is where the CPU fetch/decode/execute loop will go
    // requestAnimationFrame(emulationLoop);
}
