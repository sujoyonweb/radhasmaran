// js/storage.js
const STATE_KEY = 'radhasmaran_state';
const HISTORY_KEY = 'radhasmaran_history';
const PREFS_KEY = 'radhasmaran_prefs';

export function saveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function loadState() {
    const data = localStorage.getItem(STATE_KEY);
    return data ? JSON.parse(data) : null;
}

export function savePrefs(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadPrefs() {
    const data = localStorage.getItem(PREFS_KEY);
    const defaults = { 
        sound: true, 
        hapticsTap: true,   
        hapticsMala: true,  
        keepAwake: true,
        naamTarget: 11664, 
        mantraTarget: 1296, 
        naamSankalpa: 10000000, 
        mantraSankalpa: 125000,
        customNaam: "राधा",             
        customMantra: "राधावल्लभ श्रीहरिवंश" 
    };
    return data ? { ...defaults, ...JSON.parse(data) } : defaults;
}

export function getHistory() {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : {};
}

export function checkDailyReset(state) {
    const today = new Date().toDateString();
    
    if (state.lastActiveDate !== today) {
        const history = getHistory();
        history[state.lastActiveDate] = { naam: { ...state.data.naam }, mantra: { ...state.data.mantra } };
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

        ['naam', 'mantra'].forEach(mode => {
            state.data[mode].total = 0;
            state.data[mode].current = 0;
            state.data[mode].malas = 0;
        });

        state.lastActiveDate = today;
        saveState(state);
    }
    return state;
}

// --- DATA BACKUP LOGIC ---
export function exportDataBackup() {
    const backup = { 
        state: loadState(), 
        history: getHistory(), 
        prefs: loadPrefs(),
        exportDate: new Date().toISOString() 
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const a = document.createElement('a');
    a.href = dataStr;

    // Build the dynamic timestamp (YYYY-MM-DD_HH-MM in 24h format)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    a.download = `radhasmaran_backup_${yyyy}-${mm}-${dd}_${hh}-${min}.json`;
    
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// THE FIX: Date-Aware Mathematical Merging
export function importDataBackup(jsonData) {
    try {
        const parsed = JSON.parse(jsonData);
        if (!parsed.state) return false;

        // 1. Merge Preferences
        if (parsed.prefs) {
            const currentPrefs = loadPrefs();
            savePrefs({ ...currentPrefs, ...parsed.prefs });
        }

        // 2. Deep Merge History (Takes the highest count for any given day)
        if (parsed.history) {
            const localHistory = getHistory();
            const mergedHistory = { ...localHistory };

            for (const date in parsed.history) {
                if (!mergedHistory[date]) {
                    mergedHistory[date] = parsed.history[date];
                } else {
                    ['naam', 'mantra'].forEach(mode => {
                        if (parsed.history[date][mode]) {
                            mergedHistory[date][mode].malas = Math.max(mergedHistory[date][mode].malas || 0, parsed.history[date][mode].malas || 0);
                            mergedHistory[date][mode].total = Math.max(mergedHistory[date][mode].total || 0, parsed.history[date][mode].total || 0);
                        }
                    });
                }
            }
            localStorage.setItem(HISTORY_KEY, JSON.stringify(mergedHistory));
        }

        // 3. Deep Merge Current State (Date-Aware)
        const localState = loadState() || parsed.state; 
        localState.likhitaTotal = Math.max(localState.likhitaTotal || 0, parsed.state.likhitaTotal || 0);

        const parsedDate = new Date(parsed.state.lastActiveDate).getTime();
        const localDate = new Date(localState.lastActiveDate).getTime();

        if (parsed.state.lastActiveDate === localState.lastActiveDate) {
            // SCENARIO A: Both devices are on the exact same day. Merge current counts using Math.max.
            ['naam', 'mantra'].forEach(mode => {
                localState.data[mode].malas = Math.max(localState.data[mode].malas, parsed.state.data[mode].malas);
                localState.data[mode].total = Math.max(localState.data[mode].total, parsed.state.data[mode].total);
                localState.data[mode].current = Math.max(localState.data[mode].current, parsed.state.data[mode].current);
            });
        } else if (parsedDate > localDate) {
            // SCENARIO B: The imported file is from a FUTURE date relative to the phone.
            // Push the phone's old state into history, and adopt the imported active state.
            const history = getHistory(); 
            history[localState.lastActiveDate] = { naam: { ...localState.data.naam }, mantra: { ...localState.data.mantra } };
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

            localState.lastActiveDate = parsed.state.lastActiveDate;
            localState.data = parsed.state.data;
        } else if (parsedDate < localDate) {
            // SCENARIO C: The imported file is from an OLDER date. 
            // Keep the phone's current active state intact, but push the file's state into history safely.
            const history = getHistory(); 
            if (!history[parsed.state.lastActiveDate]) {
                history[parsed.state.lastActiveDate] = { naam: { ...parsed.state.data.naam }, mantra: { ...parsed.state.data.mantra } };
            } else {
                ['naam', 'mantra'].forEach(mode => {
                    history[parsed.state.lastActiveDate][mode].malas = Math.max(history[parsed.state.lastActiveDate][mode].malas || 0, parsed.state.data[mode].malas || 0);
                    history[parsed.state.lastActiveDate][mode].total = Math.max(history[parsed.state.lastActiveDate][mode].total || 0, parsed.state.data[mode].total || 0);
                });
            }
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        }

        saveState(localState);
        return true;
    } catch (e) {
        console.error("Backup parse failed", e);
        return false;
    }
}

export function factoryReset() {
    localStorage.clear();
    window.location.reload();
}