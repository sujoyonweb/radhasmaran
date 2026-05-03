import { state, incrementCount, setActiveMode, loadState as syncState, getRingProgressPercentage } from './state.js';
import { saveState, loadState, checkDailyReset } from './storage.js';
import { initUI, prefs } from './ui.js';
import { initStats } from './stats.js';

const ui = {};
let wakeLock = null;

// --- 1. THE DIVINE AUDIO ENGINE (Web Audio API) ---
// Initialize audio context (only activates after first user interaction)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playDivineBell() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;

    // Master volume - soft, serene, and not overpowering
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.4, t);
    masterGain.connect(audioCtx.destination);

    // Synthesis Recipe: A 432Hz Fundamental with inharmonic overtones 
    // to simulate the rich, metallic ring of a brass temple bell.
    const frequencies = [432, 864, 1170.72, 1658.88, 2211.84]; 
    const gains = [1, 0.5, 0.4, 0.2, 0.1]; // Deeper tones are louder
    const decayTimes = [3.5, 2.5, 2.0, 1.5, 1.0]; // High tones fade faster

    frequencies.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        // The Envelope: Soft strike, long echoing fade
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(gains[i], t + 0.02); // The strike
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + decayTimes[i]); // The resonance fade

        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(t);
        osc.stop(t + decayTimes[i]);
    });
}

// --------------------------------------------------------
// 1. THE KEEP AWAKE & TIME ENGINE
// --------------------------------------------------------
async function manageWakeLock() {
    if (prefs.keepAwake && document.visibilityState === 'visible') {
        try {
            if ('wakeLock' in navigator && wakeLock === null) {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        } catch (err) { console.log('WakeLock error:', err); }
    } else {
        if (wakeLock !== null) {
            await wakeLock.release();
            wakeLock = null;
        }
    }
}

// BUG FIX 1: The "Midnight Rollover" Check
// If the user unlocks their phone and a new day has started, reset the UI instantly
document.addEventListener('visibilitychange', () => {
    manageWakeLock();
    if (document.visibilityState === 'visible') {
        const today = new Date().toDateString();
        if (state.lastActiveDate !== today) {
            checkDailyReset(state);
            updateScreen();
        }
    }
});

window.addEventListener('prefsUpdated', manageWakeLock); 
window.addEventListener('prefsUpdated', updateScreen);

// --------------------------------------------------------
// 2. INITIALIZATION
// --------------------------------------------------------
function init() {
    const saved = loadState();
    if (saved) syncState(saved);
    checkDailyReset(state);

    // Initialize Modals & Stats
    initUI();
    initStats();
    
    // Start Screen Lock
    manageWakeLock(); 

    // Cache DOM Elements
    ui.tapZone = document.getElementById('viewCounter');
    ui.headerPillToggle = document.getElementById('headerPillToggle');
    ui.btnNaam = document.getElementById('btnToggleNaam');
    ui.btnMantra = document.getElementById('btnToggleMantra');
    ui.btnEnterImmersive = document.getElementById('btnEnterImmersive');
    ui.btnExitImmersive = document.getElementById('btnExitImmersive');
    ui.countTotal = document.getElementById('textTotalCount');
    ui.countCurrent = document.getElementById('textCurrentMala');
    
    ui.progressContainer = document.querySelector('.progress-container');
    ui.ringFill = document.getElementById('ringFill');
    
    ui.statMala = document.getElementById('textMalaToday');
    ui.statTotal = document.getElementById('textDailyTotal');
    ui.statTarget = document.getElementById('textDailyTarget');
    ui.textCalligraphy = document.getElementById('textCalligraphy');

    ui.btnOpenLikhita = document.getElementById('btnOpenLikhita');
    ui.likhitaCanvas = document.getElementById('likhitaCanvas');

    // Likhita Canvas Setup
    ui.ctx = ui.likhitaCanvas.getContext('2d');
    
    const resizeCanvas = () => {
        const rect = ui.likhitaCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set actual internal bitmap resolution
        ui.likhitaCanvas.width = rect.width * dpr;
        ui.likhitaCanvas.height = rect.height * dpr;

        // REMOVED ctx.scale() to prevent Desktop DPI drifting bugs
        // Instead, we manually scale the pen thickness
        ui.ctx.strokeStyle = '#27AE60'; 
        ui.ctx.lineWidth = 6 * dpr; 
        ui.ctx.lineCap = 'round';
        ui.ctx.lineJoin = 'round';
        ui.ctx.shadowBlur = 12 * dpr;
        ui.ctx.shadowColor = '#27AE60';
    };
    window.addEventListener('resize', resizeCanvas);
    
    // We must call this AFTER the modal opens so it measures the correct size
    ui.btnOpenLikhita.addEventListener('click', () => {
        setTimeout(resizeCanvas, 50); 
    });


    // Attach Events and Paint Screen
    setupEventListeners();
    updateScreen();
}

// --------------------------------------------------------
// 3. UI RENDERER
// --------------------------------------------------------
function updateScreen() {
    // Hide Quill icon if in Mantra mode
    if (state.activeMode === 'mantra') {
        ui.btnOpenLikhita.style.opacity = '0';
        ui.btnOpenLikhita.style.pointerEvents = 'none';
        document.body.classList.remove('is-likhita'); // Safety reset
    } else {
        ui.btnOpenLikhita.style.opacity = '1';
        ui.btnOpenLikhita.style.pointerEvents = 'auto';
    }

    const data = state.data[state.activeMode];
    
    ui.countTotal.textContent = data.total;
    ui.countCurrent.textContent = data.current;
    ui.statTotal.textContent = data.total;

    //Big Text on screen
    ui.textCalligraphy.textContent = state.activeMode === 'naam' ? prefs.customNaam : prefs.customMantra;
    
    // Pull dynamic Targets from Preferences
    const currentTarget = state.activeMode === 'naam' ? prefs.naamTarget : prefs.mantraTarget;
    ui.statTarget.textContent = currentTarget;

    // Calculate glowing ring fill
    const offset = 722 - (getRingProgressPercentage() / 100) * 722;
    ui.ringFill.style.strokeDashoffset = offset;

    // Sync the Tabs
    ui.btnNaam.classList.toggle('active', state.activeMode === 'naam');
    ui.btnMantra.classList.toggle('active', state.activeMode === 'mantra');
    if (ui.headerPillToggle) {
        ui.headerPillToggle.classList.toggle('is-mantra', state.activeMode === 'mantra');
    }

    // --- CONTEXTUAL UI SWAP ---
    // Smoothly shifts the bottom stats bar to show Lifetime Likhita
    const statLeftLabel = document.querySelector('.stat-block:not(.align-right) .stat-label');
    const statRightBlock = document.querySelector('.stat-block.align-right');
    const statDivider = document.querySelector('.stat-divider');

    if (statRightBlock) statRightBlock.style.transition = 'opacity 0.3s ease';
    if (statDivider) statDivider.style.transition = 'opacity 0.3s ease';

    if (document.body.classList.contains('is-likhita')) {
        ui.statMala.textContent = (state.likhitaTotal || 0).toLocaleString();
        if (statLeftLabel) statLeftLabel.textContent = 'lifetime likhita';
        if (statRightBlock) statRightBlock.style.opacity = '0';
        if (statDivider) statDivider.style.opacity = '0';
    } else {
        ui.statMala.textContent = data.malas;
        if (statLeftLabel) statLeftLabel.textContent = 'malas today';
        if (statRightBlock) statRightBlock.style.opacity = '1';
        if (statDivider) statDivider.style.opacity = '1';
    }
}

// --------------------------------------------------------
// 4. THE EVENT LISTENERS (Gestures & Keyboard)
// --------------------------------------------------------
function setupEventListeners() {
    
    // THE MAIN COUNTER CLICK
    ui.tapZone.addEventListener('click', () => {
        // Safety: Check if midnight passed *while* they were looking at the screen!
        const today = new Date().toDateString();
        if (state.lastActiveDate !== today) {
            checkDailyReset(state);
        }

        const result = incrementCount();
        saveState(state);
        updateScreen();

        // Ultra-crisp "Apple Trackpad" style haptics (SPLIT ENGINE UPGRADE)
        if (window.navigator.vibrate) {
            if (result.malaCompleted && prefs.hapticsMala) {
                // The long, celebratory vibration when 108 is reached
                window.navigator.vibrate([100, 50, 100, 50, 100]);
            } else if (!result.malaCompleted && prefs.hapticsTap) {
                // The tiny, single tick for a normal tap
                window.navigator.vibrate(10);
            }
        }
        
        // --- NEW: THE MALA COMPLETION EVENTS ---
        if (result.malaCompleted) {
            // 1. Play the Divine Bell (if Sound Effects toggle is ON)
            if (prefs.sound) playDivineBell();

            // 2. Trigger the Visual Burst
            ui.progressContainer.classList.add('mala-burst');
            setTimeout(() => ui.progressContainer.classList.remove('mala-burst'), 600);
        }
    });

    // LIKHITA JAPA TOGGLE
    let isLikhitaActive = false;
    ui.btnOpenLikhita.addEventListener('click', (e) => {
        e.stopPropagation(); // Stop the click from counting a mala
        isLikhitaActive = !isLikhitaActive;
        document.body.classList.toggle('is-likhita', isLikhitaActive);
        
        // Swap icon: Quill (write) <-> Target (tap)
        if (isLikhitaActive) {
            ui.btnOpenLikhita.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>`;
        } else {
            ui.btnOpenLikhita.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>`;
        }
        
        updateScreen(); // Instantly triggers the bottom UI Swap!
    });

    // --------------------------------------------------------
    // LIKHITA JAPA: TOUCH & MOUSE MATH TIMING ENGINE
    // --------------------------------------------------------
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let likhitaTimeout = null;
    let wipeTimeout = null; // NEW: Tracks the hidden canvas wipe

    // Safety: Prevent canvas clicks from triggering the main counter
    ui.likhitaCanvas.addEventListener('click', (e) => e.stopPropagation());

    // UNIVERSAL MATH: Bulletproof coordinate mapping for ANY screen width
    const getDrawPos = (e) => {
        const rect = ui.likhitaCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const scaleX = ui.likhitaCanvas.width / rect.width;
        const scaleY = ui.likhitaCanvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        if (!document.body.classList.contains('is-likhita')) return;
        if (e.type === 'touchstart') e.preventDefault(); 
        isDrawing = true;
        
        // THE FIX: Aggressively cancel BOTH the dissolve and the hidden wipe!
        clearTimeout(likhitaTimeout); 
        clearTimeout(wipeTimeout); 
        
        // Instantly make canvas solid again if it was fading
        ui.likhitaCanvas.style.transition = 'none';
        ui.likhitaCanvas.style.opacity = '1';

        const pos = getDrawPos(e);
        lastX = pos.x;
        lastY = pos.y;
        
        ui.ctx.beginPath();
        ui.ctx.moveTo(lastX, lastY);
        ui.ctx.lineTo(lastX, lastY); 
        ui.ctx.stroke();
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.type === 'touchmove') e.preventDefault();
        const pos = getDrawPos(e);
        
        ui.ctx.beginPath();
        ui.ctx.moveTo(lastX, lastY);
        ui.ctx.lineTo(pos.x, pos.y);
        ui.ctx.stroke();
        
        lastX = pos.x;
        lastY = pos.y;
    };

    const stopDrawing = (e) => {
        if (!isDrawing) return;
        if (e.type === 'touchend') e.preventDefault();
        isDrawing = false;
        
        likhitaTimeout = setTimeout(commitLikhitaCount, 1200);
    };

    // Attach TOUCH Events (Mobile)
    ui.likhitaCanvas.addEventListener('touchstart', startDrawing, { passive: false });
    ui.likhitaCanvas.addEventListener('touchmove', draw, { passive: false });
    ui.likhitaCanvas.addEventListener('touchend', stopDrawing, { passive: false });

    // Attach MOUSE Events (Desktop/Laptop)
    ui.likhitaCanvas.addEventListener('mousedown', startDrawing);
    ui.likhitaCanvas.addEventListener('mousemove', draw);
    ui.likhitaCanvas.addEventListener('mouseup', stopDrawing);
    ui.likhitaCanvas.addEventListener('mouseleave', stopDrawing); 
    
    function commitLikhitaCount() {
        // 1. Start the visual fade immediately
        ui.likhitaCanvas.style.transition = 'opacity 0.6s ease-out';
        ui.likhitaCanvas.style.opacity = '0';

        // 2. Put the COUNT and the WIPE inside the final killable timer
        wipeTimeout = setTimeout(() => {
            
            // Only give them the point once the ink has fully disappeared
            state.likhitaTotal = (state.likhitaTotal || 0) + 1;
            saveState(state);
            updateScreen(); 

            // Trigger the haptic tick
            if (window.navigator.vibrate && prefs.hapticsTap) {
                window.navigator.vibrate(10); 
            }

            // Wipe the invisible canvas clean
            ui.ctx.clearRect(0, 0, ui.likhitaCanvas.width, ui.likhitaCanvas.height);
            
        }, 600); // Wait 600ms for the fade to finish before doing the math
    }

    // THE VERTICAL ROLL SEQUENCER (Tab switching animation)
    const switchModeAnimated = (newMode) => {
        if (state.activeMode === newMode) return; 
        
        ui.tapZone.classList.add('slide-v-container', 'slide-v-out');

        setTimeout(() => {
            setActiveMode(newMode);
            saveState(state);
            updateScreen();
            
            ui.tapZone.classList.remove('slide-v-out');
            ui.tapZone.classList.add('slide-v-in');
            void ui.tapZone.offsetWidth; 
            
            ui.tapZone.style.transition = 'opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
            ui.tapZone.classList.remove('slide-v-in');
            
            setTimeout(() => { ui.tapZone.style.transition = ''; }, 200);
        }, 150); 
    };

    ui.btnNaam.addEventListener('click', (e) => { e.stopPropagation(); switchModeAnimated('naam'); });
    ui.btnMantra.addEventListener('click', (e) => { e.stopPropagation(); switchModeAnimated('mantra'); });

    // OFFLINE DATA INJECTION
    window.addEventListener('injectOfflineData', (e) => {
        const { mode, count } = e.detail; 
        // 'count' is now the raw number the user typed in (e.g., 150)
        
        const currentData = state.data[mode];
        
        // 1. Add the raw number to your total and current circle progress
        currentData.total += count;
        currentData.current += count;
        
        // 2. Automatically convert into Malas if it crosses 108
        const additionalMalas = Math.floor(currentData.current / 108);
        currentData.malas += additionalMalas;
        
        // 3. Keep the remainder for the glowing circle (e.g., 150 % 108 = 42)
        currentData.current = currentData.current % 108; 
        
        saveState(state);
        updateScreen();
        
        if (prefs.haptics && window.navigator.vibrate) window.navigator.vibrate([50, 50, 50]);
    });

    // IMMERSIVE MODE LOGIC
    const toggleImmersive = async (enter) => {
        if (enter) {
            document.body.classList.add('is-immersive');
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (err) { console.log('Fullscreen failed:', err); }
        } else {
            document.body.classList.remove('is-immersive');
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                }
            } catch (err) { console.log('Exit fullscreen failed:', err); }
        }
    };

    ui.btnEnterImmersive.addEventListener('click', (e) => { e.stopPropagation(); toggleImmersive(true); });
    ui.btnExitImmersive.addEventListener('click', (e) => { e.stopPropagation(); toggleImmersive(false); });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) document.body.classList.remove('is-immersive');
    });

    // ADVANCED KEYBOARD SUPPORT (Immersive Mode + Piano Method)
    document.addEventListener('keydown', (e) => {
        // BUG FIX 2: Prevent "Machine-Gun" counting if user holds the key down
        if (e.repeat) return; 

        // Safety 1: Don't trigger if typing in Settings
        if (e.target.tagName.toLowerCase() === 'input') return;

        // Safety 2: 'F' toggles Immersive Mode
        if (e.key.toLowerCase() === 'f') {
            const isCurrentlyImmersive = document.body.classList.contains('is-immersive');
            toggleImmersive(!isCurrentlyImmersive);
            return; 
        }

        // Safety 3: Hardware Blocklist (Protects the Spacebar!)
        const blockedKeys = [
            ' ', 'Spacebar', 'Enter', 'Escape', 'Tab', 
            'Backspace', 'Delete', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'
        ];

        // If safe, count the tap!
        if (!blockedKeys.includes(e.key)) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
            ui.tapZone.click(); 
        }
    });
}

// Start the app!
document.addEventListener('DOMContentLoaded', init);