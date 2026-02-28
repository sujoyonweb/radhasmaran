// js/ui.js
import { initStats, renderStats } from './stats.js';
import { exportDataBackup, importDataBackup, factoryReset, loadPrefs, savePrefs } from './storage.js';

export const prefs = loadPrefs();

export function initUI() {
    initStats();

    // --------------------------------------------------------
    // 1. CACHE ALL DOM ELEMENTS (Performance optimization)
    // --------------------------------------------------------
    const els = {
        inputNaamSankalpa: document.getElementById('inputNaamSankalpa'),
        inputMantraSankalpa: document.getElementById('inputMantraSankalpa'),

        menuBtn: document.getElementById('btnOpenMenu'),
        btnStatsShortcut: document.getElementById('btnStatsShortcut'), 
        
        btnInsights: document.getElementById('btnShowInsights'),
        insightsOverlay: document.getElementById('insightsOverlay'),
        insightsSheet: document.getElementById('insightsSheet'),
        btnHideInsights: document.getElementById('btnHideInsights'),
        
        settingsOverlay: document.getElementById('settingsOverlay'),
        settingsSheet: document.getElementById('settingsSheet'),
        btnHideSettings: document.getElementById('btnHideSettings'),

        toggleSound: document.getElementById('toggleSoundUI'),
        toggleHapticsTap: document.getElementById('toggleHapticsTapUI'),   // UPDATED
        toggleHapticsMala: document.getElementById('toggleHapticsMalaUI'), // UPDATED
        toggleAwake: document.getElementById('toggleAwakeUI'),
        
        inputNaamTarget: document.getElementById('inputNaamTarget'),
        inputMantraTarget: document.getElementById('inputMantraTarget'),

        btnOpenOfflineLog: document.getElementById('btnOpenOfflineLog'),
        offlineLogOverlay: document.getElementById('offlineLogOverlay'),
        btnCancelOffline: document.getElementById('btnCancelOffline'),
        btnSaveOffline: document.getElementById('btnSaveOffline'),
        offlinePillToggle: document.getElementById('offlinePillToggle'),
        btnOfflineNaam: document.getElementById('btnOfflineNaam'),
        btnOfflineMantra: document.getElementById('btnOfflineMantra'),
        inputOfflineMalas: document.getElementById('inputOfflineMalas'),
        
        btnTriggerReset: document.getElementById('btnTriggerReset'),
        resetOverlay: document.getElementById('resetOverlay'),
        btnCancelReset: document.getElementById('btnCancelReset'),
        btnConfirmReset: document.getElementById('btnConfirmReset')
    };

    // --------------------------------------------------------
    // 2. HELPER FUNCTIONS
    // --------------------------------------------------------
    const toggleSheet = (overlay, sheet, show) => {
        overlay.classList.toggle('active', show);
        if(sheet) sheet.classList.toggle('active', show);
    };

    // --------------------------------------------------------
    // 3. GLITCH-FREE SWIPE-TO-CLOSE PHYSICS ENGINE
    // --------------------------------------------------------
    const setupSwipeToClose = (sheet, overlay) => {
        let startY = 0;
        let currentY = 0;
        const scrollArea = sheet.querySelector('.scroll-container'); 

        sheet.addEventListener('touchstart', (e) => {
            // Ignore swipe if the user is scrolling down the list inside the menu
            if (scrollArea && scrollArea.scrollTop > 0) return; 
            
            startY = e.touches[0].clientY;
            currentY = startY;
            sheet.style.transition = 'none'; // Lock CSS so it sticks to the finger perfectly
        }, { passive: true });

        sheet.addEventListener('touchmove', (e) => {
            if (startY === 0) return; 
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            // Only allow dragging downwards
            if (deltaY > 0) {
                sheet.style.transform = `translateY(${deltaY}px)`;
            }
        }, { passive: true });

        sheet.addEventListener('touchend', () => {
            if (startY === 0) return;
            const deltaY = currentY - startY;
            startY = 0; // Reset for next time

            // THE FIX: Instantly hand control back to CSS to prevent animation lag
            sheet.style.transition = ''; 
            sheet.style.transform = ''; 

            if (deltaY > 120) { 
                // If pulled down far enough, close it naturally using CSS class removal
                toggleSheet(overlay, sheet, false);
            }
        });
    };

    // Apply the physics engine to your bottom sheets
    setupSwipeToClose(els.settingsSheet, els.settingsOverlay);
    setupSwipeToClose(els.insightsSheet, els.insightsOverlay);

    // --------------------------------------------------------
    // 4. MENU OPEN & CLOSE LOGIC
    // --------------------------------------------------------
    els.menuBtn.onclick = () => {
        els.inputNaamSankalpa.value = prefs.naamSankalpa;
        els.inputMantraSankalpa.value = prefs.mantraSankalpa;
        // Sync toggles and inputs with saved preferences when opening
        els.toggleSound.classList.toggle('active', prefs.sound);
        els.toggleHapticsTap.classList.toggle('active', prefs.hapticsTap);   // UPDATED
        els.toggleHapticsMala.classList.toggle('active', prefs.hapticsMala); // UPDATED
        els.toggleAwake.classList.toggle('active', prefs.keepAwake); 
        els.inputNaamTarget.value = prefs.naamTarget;
        els.inputMantraTarget.value = prefs.mantraTarget;
        
        toggleSheet(els.settingsOverlay, els.settingsSheet, true);
    };
    
    els.btnHideSettings.onclick = () => toggleSheet(els.settingsOverlay, els.settingsSheet, false);
    
    // Close overlays if clicking the dark background outside the menu
    const closeOverlays = (e) => {
        if(e.target === els.settingsOverlay) toggleSheet(els.settingsOverlay, els.settingsSheet, false);
        if(e.target === els.insightsOverlay) toggleSheet(els.insightsOverlay, els.insightsSheet, false);
    };
    els.settingsOverlay.addEventListener('click', closeOverlays);
    els.insightsOverlay.addEventListener('click', closeOverlays);

    // --------------------------------------------------------
    // 5. INSIGHTS LOGIC
    // --------------------------------------------------------
    const openInsights = () => {
        toggleSheet(els.settingsOverlay, els.settingsSheet, false); // Close settings if open
        renderStats(); // Refresh data
        toggleSheet(els.insightsOverlay, els.insightsSheet, true);
    };
    
    els.btnInsights.onclick = openInsights;
    els.btnStatsShortcut.onclick = openInsights; 
    els.btnHideInsights.onclick = () => toggleSheet(els.insightsOverlay, els.insightsSheet, false);

    // --------------------------------------------------------
    // 6. TOGGLE SWITCHES SAVER
    // --------------------------------------------------------
    const handleToggle = (el, key) => {
        prefs[key] = !prefs[key];
        el.classList.toggle('active', prefs[key]);
        savePrefs(prefs);
    };
    
    els.toggleSound.parentElement.onclick = () => handleToggle(els.toggleSound, 'sound');
    els.toggleHapticsTap.parentElement.onclick = () => handleToggle(els.toggleHapticsTap, 'hapticsTap');   // UPDATED
    els.toggleHapticsMala.parentElement.onclick = () => handleToggle(els.toggleHapticsMala, 'hapticsMala'); // UPDATED
    els.toggleAwake.parentElement.onclick = () => {
        handleToggle(els.toggleAwake, 'keepAwake');
        window.dispatchEvent(new Event('prefsUpdated')); 
    };

    // --------------------------------------------------------
    // 7. CUSTOM TARGET SAVER
    // --------------------------------------------------------
    const handleTargetInput = (el, key) => {
        el.onchange = (e) => {
            const val = parseInt(e.target.value);
            // Smart fallbacks to prevent breaking the app if user types letters
            const fallback = key === 'naamTarget' ? 11664 : 1296; 
            
            // If the value is valid and > 0, save it. Otherwise, use the fallback.
            prefs[key] = (val && val > 0) ? val : fallback; 
            el.value = prefs[key]; 
            
            savePrefs(prefs);
            // Tell app.js to instantly update the UI circle and text
            window.dispatchEvent(new Event('prefsUpdated')); 
        };
    };
    handleTargetInput(els.inputNaamTarget, 'naamTarget');
    handleTargetInput(els.inputMantraTarget, 'mantraTarget');
    handleTargetInput(els.inputNaamSankalpa, 'naamSankalpa');
    handleTargetInput(els.inputMantraSankalpa, 'mantraSankalpa');

    // --------------------------------------------------------
    // 7.5 CUSTOM TEXT SELECTOR LOGIC
    // --------------------------------------------------------
    const inputCustomNaam = document.getElementById('inputCustomNaam');
    const inputCustomMantra = document.getElementById('inputCustomMantra');
    const chipsNaam = document.querySelectorAll('#chipsNaam .preset-chip');
    const chipsMantra = document.querySelectorAll('#chipsMantra .preset-chip');

    // THE UPGRADE: Checks for data-value first, falls back to textContent
    const updateChips = (chips, value) => {
        chips.forEach(c => {
            const chipValue = c.dataset.value || c.textContent.trim();
            c.classList.toggle('active', chipValue === value);
        });
    };

    els.menuBtn.addEventListener('click', () => {
        inputCustomNaam.value = prefs.customNaam;
        inputCustomMantra.value = prefs.customMantra;
        updateChips(chipsNaam, prefs.customNaam);
        updateChips(chipsMantra, prefs.customMantra);
    });

    const handleTextInput = (el, key, chips) => {
        el.addEventListener('input', (e) => {
            prefs[key] = e.target.value;
            savePrefs(prefs);
            updateChips(chips, e.target.value);
            window.dispatchEvent(new Event('prefsUpdated'));
        });
    };
    handleTextInput(inputCustomNaam, 'customNaam', chipsNaam);
    handleTextInput(inputCustomMantra, 'customMantra', chipsMantra);

    // THE UPGRADE: Extracts the hidden data-value payload on click
    const setupChips = (chips, key, inputEl) => {
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const text = chip.dataset.value || chip.textContent.trim();
                prefs[key] = text;
                inputEl.value = text;
                savePrefs(prefs);
                updateChips(chips, text);
                window.dispatchEvent(new Event('prefsUpdated'));
            });
        });
    };
    setupChips(chipsNaam, 'customNaam', inputCustomNaam);
    setupChips(chipsMantra, 'customMantra', inputCustomMantra);

    // --------------------------------------------------------
    // 8. OFFLINE LOGGING LOGIC
    // --------------------------------------------------------
    let offlineMode = 'naam';

    els.btnOpenOfflineLog.onclick = () => {
        toggleSheet(els.settingsOverlay, els.settingsSheet, false);
        els.inputOfflineMalas.value = ''; // clear previous input
        els.offlineLogOverlay.classList.add('active');
    };

    els.btnCancelOffline.onclick = () => els.offlineLogOverlay.classList.remove('active');

    const setOfflineMode = (mode) => {
        offlineMode = mode;
        els.btnOfflineNaam.classList.toggle('active', mode === 'naam');
        els.btnOfflineMantra.classList.toggle('active', mode === 'mantra');
        els.offlinePillToggle.classList.toggle('is-mantra', mode === 'mantra');
    };
    els.btnOfflineNaam.onclick = () => setOfflineMode('naam');
    els.btnOfflineMantra.onclick = () => setOfflineMode('mantra');

    els.btnSaveOffline.onclick = () => {
        const malas = parseInt(els.inputOfflineMalas.value) || 0;
        if (malas > 0) {
            // Broadcast the data to app.js to safely add it to the state
            window.dispatchEvent(new CustomEvent('injectOfflineData', { detail: { mode: offlineMode, count: malas } }));
        }
        els.offlineLogOverlay.classList.remove('active');
    };

    // --------------------------------------------------------
    // 9. BACKUP & FACTORY RESET
    // --------------------------------------------------------
    document.getElementById('btnExportData').onclick = exportDataBackup;
    const fileImport = document.getElementById('fileImport');
    document.getElementById('btnImportData').onclick = () => fileImport.click();
    fileImport.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (importDataBackup(event.target.result)) window.location.reload();
            else alert("Invalid backup file.");
        };
        reader.readAsText(file);
    };

    els.btnTriggerReset.onclick = () => {
        // Fix: Close settings sheet first, then open reset warning
        toggleSheet(els.settingsOverlay, els.settingsSheet, false);
        els.resetOverlay.classList.add('active');
    };
    els.btnCancelReset.onclick = () => els.resetOverlay.classList.remove('active');
    els.btnConfirmReset.onclick = factoryReset;

    // --------------------------------------------------------
    // 10. DESKTOP ESCAPE KEY SUPPORT
    // --------------------------------------------------------
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Instantly dismiss any open menu or modal
            toggleSheet(els.settingsOverlay, els.settingsSheet, false);
            toggleSheet(els.insightsOverlay, els.insightsSheet, false);
            els.resetOverlay.classList.remove('active');
            els.offlineLogOverlay.classList.remove('active');
        }
    });

} //End of InitUI function.