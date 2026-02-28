// js/stats.js
import { getHistory, loadPrefs } from './storage.js';
import { state } from './state.js';

let statMode = 'naam'; 
let statMetric = 'malas'; 

const el = {};

export function initStats() {
    el.btnNaam = document.getElementById('btnStatNaam');
    el.btnMantra = document.getElementById('btnStatMantra');
    el.btnMalas = document.getElementById('btnMetricMalas');
    el.btnCount = document.getElementById('btnMetricCount');
    
    el.valTotalMalas = document.getElementById('textStatsTotalMalas');
    el.valTotalCount = document.getElementById('textStatsTotalCount');
    el.valStreak = document.getElementById('textStatsCurrentStreak');
    el.valBestStreak = document.getElementById('textStatsBestStreak');
    
    el.weekMeta = document.getElementById('textWeekTotal');
    el.chartWeekly = document.getElementById('chartWeekly');
    
    // Both lists mapped here
    el.listMonthly = document.getElementById('listMonthly');
    el.listYearly = document.getElementById('listYearly'); 

    el.btnNaam.addEventListener('click', () => { statMode = 'naam'; renderStats(); });
    el.btnMantra.addEventListener('click', () => { statMode = 'mantra'; renderStats(); });
    el.btnMalas.addEventListener('click', () => { statMetric = 'malas'; renderStats(); });
    el.btnCount.addEventListener('click', () => { statMetric = 'total'; renderStats(); }); 
}

export function renderStats() {
    // 1. UI Toggles
    el.btnNaam.classList.toggle('active', statMode === 'naam');
    el.btnMantra.classList.toggle('active', statMode === 'mantra');
    el.btnMalas.classList.toggle('active', statMetric === 'malas');
    el.btnCount.classList.toggle('active', statMetric === 'total'); 

    // THE UPGRADE: Make the slider glide inside insights
    document.getElementById('insightsPillToggle').classList.toggle('is-mantra', statMode === 'mantra');
    
    // 2. Data Aggregation
    const history = getHistory() || {};
    const today = new Date().toDateString();
    const combinedData = { ...history, [today]: { naam: { ...state.data.naam }, mantra: { ...state.data.mantra } } };
    const dates = Object.keys(combinedData).sort((a, b) => new Date(a) - new Date(b));
    
    const now = new Date();
    const earliestDate = dates.length > 0 ? new Date(dates[0]) : now;

    let totalMalas = 0, totalCount = 0, currentStreak = 0, bestStreak = 0, tempStreak = 0;

    // 3. Lifetime Logic
    dates.forEach(d => {
        const dayData = combinedData[d][statMode];
        if (!dayData) return;
        totalMalas += dayData.malas || 0;
        totalCount += dayData.total || 0;

        if (dayData.total > 0) {
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
            tempStreak = 0;
        }
    });

    for (let i = dates.length - 1; i >= 0; i--) {
        if (combinedData[dates[i]][statMode] && combinedData[dates[i]][statMode].total > 0) currentStreak++;
        else break;
    }

    el.valTotalMalas.textContent = totalMalas.toLocaleString();
    el.valTotalCount.textContent = totalCount.toLocaleString();
    el.valStreak.innerHTML = `${currentStreak} <span class="emoji-icon">🔥</span>`;
    el.valBestStreak.textContent = bestStreak.toLocaleString();

    // --- NEW: SANKALPA TRACKER MATH ---
    const currentPrefs = loadPrefs();
    const sankalpaTarget = statMode === 'naam' ? currentPrefs.naamSankalpa : currentPrefs.mantraSankalpa;
    
    const sankalpaPercent = Math.min((totalCount / sankalpaTarget) * 100, 100); 

    document.getElementById('textSankalpaCurrent').textContent = totalCount.toLocaleString();
    document.getElementById('textSankalpaTargetDisplay').textContent = sankalpaTarget.toLocaleString();
    
    // Safety check: if they have 0 counts, show 0.000%, otherwise show to 3 decimals
    document.getElementById('textSankalpaPercent').textContent = totalCount === 0 ? "0.000%" : `${sankalpaPercent.toFixed(3)}%`; 
    document.getElementById('fillSankalpa').style.width = `${sankalpaPercent}%`;
    // ----------------------------------

    // --- NEW: LIKHITA TOTAL TRACKER ---
    const likhitaEl = document.getElementById('statLikhitaTotal');
    if (likhitaEl) {
        likhitaEl.textContent = (state.likhitaTotal || 0).toLocaleString();
    }

    // 4. 7-Day Chart
    let weekTotal = 0, maxVal = 0, chartHTML = '';
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dayStr = d.toDateString();
        const val = (combinedData[dayStr] && combinedData[dayStr][statMode]) ? combinedData[dayStr][statMode][statMetric] || 0 : 0;
        weekTotal += val;
        if (val > maxVal) maxVal = val;
        
        const height = val > 0 ? `max(4%, ${(val/maxVal)*100}%)` : '0%';
        chartHTML += `
            <div class="bar-group ${i===0 ? 'active' : ''}">
                <div class="bar-track"><div class="bar-fill" style="height: ${height}"></div></div>
                <span class="bar-label">${['S','M','T','W','T','F','S'][d.getDay()]}</span>
            </div>`;
    }
    el.weekMeta.textContent = `${weekTotal.toLocaleString()} ${statMetric === 'malas' ? 'Malas' : 'Counts'}`;
    el.chartWeekly.innerHTML = chartHTML;

    // ----------------------------------------------------
    // 5. MONTHLY DISTRIBUTION (Rolling 12 Months)
    // ----------------------------------------------------
    const monthlyTotals = {};
    const monthKeys = []; // Keeps exact newest-to-oldest order
    let maxMonth = 0;
    
    // Walk backward from Current Month down to Earliest Month (Cap at 12)
    let tempDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const earliestMonthDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    
    let monthCount = 0;
    while (tempDate >= earliestMonthDate && monthCount < 12) {
        const mYear = tempDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        monthKeys.push(mYear);
        monthlyTotals[mYear] = 0; // Seed with zero
        tempDate.setMonth(tempDate.getMonth() - 1);
        monthCount++;
    }

    // Fill in the real data
    dates.forEach(d => {
        const mYear = new Date(d).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (monthlyTotals[mYear] !== undefined) {
            const val = (combinedData[d] && combinedData[d][statMode]) ? combinedData[d][statMode][statMetric] || 0 : 0;
            monthlyTotals[mYear] += val;
        }
    });

    Object.values(monthlyTotals).forEach(val => { if (val > maxMonth) maxMonth = val; });

    let monthHTML = '';
    monthKeys.forEach(m => {
        const widthPct = maxMonth === 0 ? 0 : (monthlyTotals[m] / maxMonth) * 100;
        monthHTML += `
            <div class="h-row">
                <div class="h-row-header"><span class="h-label">${m.split(' ')[0]}</span><span class="h-value">${monthlyTotals[m].toLocaleString()}</span></div>
                <div class="h-track"><div class="h-fill" style="width: ${widthPct}%"></div></div>
            </div>`;
    });
    el.listMonthly.innerHTML = monthHTML;

    // ----------------------------------------------------
    // 6. YEARLY DISTRIBUTION
    // ----------------------------------------------------
    const yearlyTotals = {};
    let maxYear = 0;
    
    const currentYear = now.getFullYear();
    const startYear = earliestDate.getFullYear();
    
    // Seed all years from now down to the start year
    for (let y = currentYear; y >= startYear; y--) {
        yearlyTotals[y.toString()] = 0;
    }
    
    // Fill in the real data
    dates.forEach(d => {
        const yStr = new Date(d).getFullYear().toString();
        if (yearlyTotals[yStr] !== undefined) {
            const val = (combinedData[d] && combinedData[d][statMode]) ? combinedData[d][statMode][statMetric] || 0 : 0;
            yearlyTotals[yStr] += val;
        }
    });
    
    Object.values(yearlyTotals).forEach(val => { if (val > maxYear) maxYear = val; });

    let yearHTML = '';
    // Sort years newest to oldest (e.g., 2026, 2025...)
    Object.keys(yearlyTotals).sort((a,b) => b - a).forEach(y => {
        const widthPct = maxYear === 0 ? 0 : (yearlyTotals[y] / maxYear) * 100;
        yearHTML += `
            <div class="h-row">
                <div class="h-row-header"><span class="h-label">${y}</span><span class="h-value">${yearlyTotals[y].toLocaleString()}</span></div>
                <div class="h-track"><div class="h-fill" style="width: ${widthPct}%"></div></div>
            </div>`;
    });
    el.listYearly.innerHTML = yearHTML;

    // ----------------------------------------------------
    // 7. MINIMALIST DAILY LOGBOOK
    // ----------------------------------------------------
    let logHTML = '';
    let logCount = 0;
    
    // Sort dates from Newest to Oldest for the logbook view
    const sortedDatesDesc = [...dates].sort((a, b) => new Date(b) - new Date(a));

    sortedDatesDesc.forEach(d => {
        // Stop after 30 active days to keep the app blazing fast
        if (logCount >= 30) return; 

        const dayData = combinedData[d][statMode];
        
        // Only render a row if they actually chanted that day
        if (dayData && dayData[statMetric] > 0) {
            const dateObj = new Date(d);
            // Formats to "Feb 27, 2026"
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            logHTML += `
                <div class="settings-row" style="padding: 12px 0; border-bottom: 1px solid var(--border-input);">
                    <span style="font-family: var(--font-mono); font-size: 14px; color: var(--text-muted);">${dateStr}</span>
                    <span style="font-family: var(--font-mono); font-size: 16px; font-weight: 600; color: var(--text-main);">${dayData[statMetric].toLocaleString()}</span>
                </div>`;
            logCount++;
        }
    });

    if (logCount === 0) {
        logHTML = `<div class="text-dim" style="text-align: center; padding: 20px 0; font-size: 13px;">No history recorded yet.</div>`;
    }

    document.getElementById('listDailyLog').innerHTML = logHTML;
}