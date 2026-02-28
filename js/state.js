// js/state.js

const MALA_LIMIT = 108;

export const state = {
    activeMode: 'naam', 
    lastActiveDate: new Date().toDateString(),
    likhitaTotal: 0, // NEW: Safe, dedicated lifetime tracker for Writing Mode
    data: {
        naam: { total: 0, current: 0, malas: 0, target: 1080 },
        mantra: { total: 0, current: 0, malas: 0, target: 108 }
    }
};

export function incrementCount() {
    const activeData = state.data[state.activeMode];
    
    activeData.total += 1;
    activeData.current += 1;

    if (activeData.current === MALA_LIMIT) {
        activeData.current = 0; 
        activeData.malas += 1;
        return { ...activeData, malaCompleted: true };
    }
    return { ...activeData, malaCompleted: false };
}

export function setActiveMode(mode) {
    if (mode === 'naam' || mode === 'mantra') {
        state.activeMode = mode;
    }
}

export function getRingProgressPercentage() {
    const currentCount = state.data[state.activeMode].current;
    return (currentCount / MALA_LIMIT) * 100;
}

export function loadState(savedState) {
    if (savedState && savedState.data) {
        state.data = savedState.data;
        state.activeMode = savedState.activeMode || 'naam';
        state.lastActiveDate = savedState.lastActiveDate || new Date().toDateString();
        state.likhitaTotal = savedState.likhitaTotal || 0; // NEW: Safely loads existing writing count
    }
}