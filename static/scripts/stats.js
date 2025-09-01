// Utilities for statistics
function computeBasicStats(values) {
    const data = values.slice().sort((a, b) => a - b);
    const n = data.length;
    if (n === 0) return { count: 0 };
    const sum = data.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;
    const median = n % 2 === 1 ? data[(n - 1) / 2] : (data[n / 2 - 1] + data[n / 2]) / 2;
    const variance = data.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);
    const q1 = quantile(data, 0.25);
    const q3 = quantile(data, 0.75);
    const iqr = q3 - q1;
    return { count: n, sum, mean, median, stddev, min: data[0], max: data[n - 1], q1, q3, iqr };
}

function quantile(sortedValues, q) {
    const pos = (sortedValues.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedValues[base + 1] !== undefined) {
        return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
    } else {
        return sortedValues[base];
    }
}

// Kernel density estimation utilities
function gaussianKernel(u) {
    const invSqrt2Pi = 1 / Math.sqrt(2 * Math.PI);
    return invSqrt2Pi * Math.exp(-0.5 * u * u);
}

function silvermanBandwidth(values) {
    // Silverman's rule of thumb: 0.9 * min(sd, IQR/1.34) * n^{-1/5}
    const n = values.length;
    if (n < 2) return 1;
    const stats = computeBasicStats(values);
    const sigma = stats.stddev || 1;
    const iqr = stats.iqr || 1;
    const scale = Math.min(sigma, iqr / 1.34) || sigma || 1;
    return 0.9 * scale * Math.pow(n, -1/5);
}

function computeKDE(values, xMin, xMax, points, bandwidthFactor) {
    if (!values.length) return { x: [], y: [] };
    const n = values.length;
    const bw = Math.max(1e-6, silvermanBandwidth(values) * (bandwidthFactor || 1));
    const step = (xMax - xMin) / (points - 1);
    const x = Array.from({ length: points }, (_, i) => xMin + i * step);
    const y = x.map(xi => {
        let sum = 0;
        for (let v of values) {
            sum += gaussianKernel((xi - v) / bw);
        }
        return sum / (n * bw);
    });
    return { x, y };
}

function secondsToMinutes(seconds) {
    return Math.round(seconds / 60);
}

function dedupeByTime(entries) {
    const seen = new Set();
    const result = [];
    for (const e of entries) {
        const key = e.time_seconds;
        if (key > 0 && !seen.has(key)) {
            result.push(e);
            seen.add(key);
        }
    }
    return result;
}

function createCard(methodName) {
    const wrapper = document.createElement('section');
    wrapper.className = 'method-card';
    wrapper.innerHTML = `
        <div class="card-header">
            <h2>${methodName}</h2>
        </div>
        <div class="grid">
            <div class="tile attempts-chart">
                <div class="chart-header">
                    <h3>Attempts <span class="mode attempts">KDE</span><span class="p-badge" style="margin-left:8px;"></span></h3>
                    <div class="chart-switch" data-kind="attempts">
                        <button data-dir="prev">◀</button>
                        <button data-dir="next">▶</button>
                    </div>
                </div>
                <canvas></canvas>
            </div>
            <div class="tile time-chart">
                <div class="chart-header">
                    <h3>Time <span class="mode time">KDE</span></h3>
                    <div class="chart-switch" data-kind="time">
                        <button data-dir="prev">◀</button>
                        <button data-dir="next">▶</button>
                    </div>
                </div>
                <canvas></canvas>
            </div>
            <div class="tile attempts-stats">
                <h3>Attempts Stats</h3>
                <div class="stats attempts"></div>
            </div>
            <div class="tile time-stats">
                <h3>Time Stats</h3>
                <div class="stats time"></div>
            </div>
            <div class="tile span-2 table-tile">
                <div class="tile-header">
                    <h3>Data</h3>
                    <button class="download-table">Download</button>
                </div>
                <div class="table-container"></div>
            </div>
        </div>
    `;
    return wrapper;
}

function renderStats(container, stats) {
    if (!stats || !stats.count) {
        container.innerHTML = '<div class="no-data">No data</div>';
        return;
    }
    const fmt = v => (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : '—';
    const fmtInt = v => (typeof v === 'number' && isFinite(v)) ? v : '—';
    container.innerHTML = `
        <ul>
            <li><strong>Count:</strong> ${fmtInt(stats.count)}</li>
            <li><strong>Mean:</strong> ${fmt(stats.mean)}</li>
            <li><strong>Median:</strong> ${fmt(stats.median)}</li>
            <li><strong>Std Dev:</strong> ${fmt(stats.stddev)}</li>
            <li><strong>Min:</strong> ${fmtInt(stats.min)}</li>
            <li><strong>Max:</strong> ${fmtInt(stats.max)}</li>
            <li><strong>Q1:</strong> ${fmt(stats.q1)}</li>
            <li><strong>Q3:</strong> ${fmt(stats.q3)}</li>
            <li><strong>IQR:</strong> ${fmt(stats.iqr)}</li>
        </ul>
    `;
}

function detectOutliers(values, iqrMult) {
    if (!values.length) return { low: [], high: [] };
    const sorted = values.slice().sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowFence = q1 - iqrMult * iqr;
    const highFence = q3 + iqrMult * iqr;
    const low = sorted.filter(v => v < lowFence);
    const high = sorted.filter(v => v > highFence);
    return { low, high, fences: { lowFence, highFence } };
}

function color(idx) {
    const palette = [
        '#4e79a7','#59a14f','#9c755f','#f28e2c','#edc948',
        '#e15759','#b07aa1','#76b7b2','#ff9da7','#af7aa1'
    ];
    return palette[idx % palette.length];
}

function buildChartsForMethod(methodName, entries, bandwidthFactor, iqrMult, dedupeTime, includeProcessing) {
    let filtered = entries.filter(e => (includeProcessing || e.caught) && (!e.shinyLocked));
    // Discard zeros for each dimension when computing that metric
    const attemptsValues = filtered.map(e => e.attempts).filter(v => v > 0);
    const timeEntries = dedupeTime ? dedupeByTime(filtered) : filtered;
    const timeValuesMin = timeEntries.map(e => secondsToMinutes(e.time_seconds)).filter(v => v > 0);

    const attemptsStats = computeBasicStats(attemptsValues);
    const timeStats = computeBasicStats(timeValuesMin);

    const attemptsOutliers = detectOutliers(attemptsValues, iqrMult);
    const timeOutliers = detectOutliers(timeValuesMin, iqrMult);

    // KDE ranges
    const attMin = attemptsValues.length ? Math.min(...attemptsValues) : 0;
    const attMax = attemptsValues.length ? Math.max(...attemptsValues) : 1;
    const timeMin = timeValuesMin.length ? Math.min(...timeValuesMin) : 0;
    const timeMax = timeValuesMin.length ? Math.max(...timeValuesMin) : 1;
    const attemptsKDE = computeKDE(attemptsValues, attMin, attMax, 100, bandwidthFactor);
    const timeKDE = computeKDE(timeValuesMin, timeMin, timeMax, 100, bandwidthFactor);

    // Geometric estimation based on attempts
    function estimateGeometricP(values) {
        if (!values || values.length === 0) return null;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        if (!isFinite(mean) || mean <= 0) return null;
        const p = 1 / mean;
        return Math.max(Math.min(p, 1), 1e-6);
    }

    function geometricSeries(p, kMax) {
        const x = [];
        const y = [];
        for (let k = 1; k <= kMax; k++) {
            x.push(k);
            y.push(Math.pow(1 - p, k - 1) * p);
        }
        return { x, y };
    }

    const card = createCard(methodName);
    const attemptsChartTile = card.querySelector('.tile.attempts-chart');
    const timeChartTile = card.querySelector('.tile.time-chart');
    const attemptsStatsTile = card.querySelector('.tile.attempts-stats');
    const timeStatsTile = card.querySelector('.tile.time-stats');
    const attemptsStatsEl = card.querySelector('.stats.attempts');
    const timeStatsEl = card.querySelector('.stats.time');
    const attemptsModeLabel = card.querySelector('.mode.attempts');
    const timeModeLabel = card.querySelector('.mode.time');
    const pBadge = card.querySelector('.p-badge');

    const attemptsHasData = attemptsValues.length >= 3;
    const timeHasData = timeValuesMin.length >= 3;

    if (!attemptsHasData) {
        attemptsChartTile.remove();
        attemptsStatsTile.remove();
    } else {
        renderStats(attemptsStatsEl, attemptsStats);
    }
    if (!timeHasData) {
        timeChartTile.remove();
        timeStatsTile.remove();
    } else {
        renderStats(timeStatsEl, timeStats);
    }

    // Chart renderers with mode switching
    let attemptsChart = null;
    let timeChart = null;
    const attemptsModes = ['KDE', 'CDF'];
    const timeModes = ['KDE', 'Exponential CDF'];
    let attemptsModeIdx = 0;
    let timeModeIdx = 0;

    const pHat = attemptsHasData ? estimateGeometricP(attemptsValues) : null;
    if (pBadge && pHat) {
        pBadge.textContent = `p̂≈${pHat.toFixed(4)}`;
        pBadge.title = 'Estimated success probability (1 / mean attempts)';
    }

    function renderAttemptsChart() {
        if (!attemptsHasData) return;
        if (attemptsChart) {
            attemptsChart.destroy();
            attemptsChart = null;
        }
        const ctx = attemptsChartTile.querySelector('canvas').getContext('2d');
        const mode = attemptsModes[attemptsModeIdx];
        attemptsModeLabel.textContent = mode;
        if (mode === 'KDE') {
            attemptsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Attempts density',
                        data: attemptsKDE.x.map((xi, i) => ({ x: xi, y: attemptsKDE.y[i] })),
                        borderColor: color(0),
                        backgroundColor: 'transparent',
                        pointRadius: 0,
                        tension: 0.25,
                        parsing: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 8, right: 8, top: 6, bottom: 22 } },
                    scales: {
                        x: { type: 'linear', title: { display: true, text: 'Attempts' } },
                        y: { title: { display: true, text: 'Density' } }
                    }
                }
            });
        } else {
            // Geometric CDF: F(k) = 1 - (1 - p)^k for k >= 1
            const kMax = Math.max(20, Math.min(Math.ceil((attemptsStats.mean || 1) * 5), Math.max(...attemptsValues)));
            const geom = pHat ? geometricSeries(pHat, kMax) : { x: [], y: [] };
            const cdfXY = geom.x.map((k, i) => ({ x: k, y: geom.y.slice(0, i + 1).reduce((a, b) => a + b, 0) }));
            attemptsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Geometric CDF',
                        data: cdfXY,
                        borderColor: color(3),
                        backgroundColor: 'transparent',
                        pointRadius: 0,
                        showLine: true,
                        tension: 0.15,
                        parsing: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 8, right: 8, top: 6, bottom: 22 } },
                    scales: {
                        x: { type: 'linear', title: { display: true, text: 'Attempts' } },
                        y: { title: { display: true, text: 'CDF' }, min: 0, max: 1 }
                    }
                }
            });
        }
    }

    function renderTimeChart() {
        if (!timeHasData) return;
        if (timeChart) {
            timeChart.destroy();
            timeChart = null;
        }
        const ctx = timeChartTile.querySelector('canvas').getContext('2d');
        const mode = timeModes[timeModeIdx];
        timeModeLabel.textContent = mode;
        if (mode === 'KDE') {
            timeChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Minutes density',
                        data: timeKDE.x.map((xi, i) => ({ x: xi, y: timeKDE.y[i] })),
                        borderColor: color(1),
                        backgroundColor: 'transparent',
                        pointRadius: 0,
                        tension: 0.25,
                        parsing: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 8, right: 8, top: 6, bottom: 22 } },
                    scales: {
                        x: { type: 'linear', title: { display: true, text: 'Minutes' } },
                        y: { title: { display: true, text: 'Density' } }
                    }
                }
            });
        } else {
            // Exponential CDF with λ̂ = 1 / mean(minutes)
            const meanMinutes = timeValuesMin.reduce((a, b) => a + b, 0) / timeValuesMin.length;
            const lambdaHat = meanMinutes > 0 ? 1 / meanMinutes : null;
            const xMax = timeMax || (meanMinutes * 5) || 10;
            const points = 120;
            const step = xMax / points;
            const xy = [];
            if (lambdaHat) {
                for (let i = 0; i <= points; i++) {
                    const t = i * step;
                    const F = 1 - Math.exp(-lambdaHat * t);
                    xy.push({ x: t, y: F });
                }
            }
            timeChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Exponential CDF',
                        data: xy,
                        borderColor: color(4),
                        backgroundColor: 'transparent',
                        pointRadius: 0,
                        showLine: true,
                        tension: 0.15,
                        parsing: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { left: 8, right: 8, top: 6, bottom: 22 } },
                    scales: {
                        x: { type: 'linear', title: { display: true, text: 'Minutes' } },
                        y: { title: { display: true, text: 'CDF' }, min: 0, max: 1 }
                    }
                }
            });
        }
    }

    // Initial charts
    renderAttemptsChart();
    renderTimeChart();

    // Switch handlers
    const switches = card.querySelectorAll('.chart-switch button');
    switches.forEach(btn => {
        btn.addEventListener('click', () => {
            const dir = btn.getAttribute('data-dir');
            const kind = btn.parentElement.getAttribute('data-kind');
            if (kind === 'attempts' && attemptsHasData) {
                attemptsModeIdx = (attemptsModeIdx + (dir === 'next' ? 1 : -1) + attemptsModes.length) % attemptsModes.length;
                renderAttemptsChart();
            }
            if (kind === 'time' && timeHasData) {
                timeModeIdx = (timeModeIdx + (dir === 'next' ? 1 : -1) + timeModes.length) % timeModes.length;
                renderTimeChart();
            }
        });
    });

    // Outlier badges
    if (attemptsHasData) {
        const attemptsBadge = document.createElement('div');
        attemptsBadge.className = 'badge';
        attemptsBadge.textContent = `Attempts outliers: low=${attemptsOutliers.low.length}, high=${attemptsOutliers.high.length}`;
        attemptsStatsEl.appendChild(attemptsBadge);
    }

    if (timeHasData) {
        const timeBadge = document.createElement('div');
        timeBadge.className = 'badge';
        timeBadge.textContent = `Time outliers: low=${timeOutliers.low.length}, high=${timeOutliers.high.length}`;
        timeStatsEl.appendChild(timeBadge);
    }

    // Table of entries (include attempts-only or time-only; dedupe on time without dropping attempts-only)
    const tableContainer = card.querySelector('.table-tile .table-container');
    const baseForTable = (() => {
        if (!dedupeTime) return filtered;
        const dedupedTime = dedupeByTime(filtered);
        const attemptsOnly = filtered.filter(e => (e.time_seconds <= 0) && (e.attempts > 0));
        return dedupedTime.concat(attemptsOnly);
    })();

    const rows = baseForTable
        .filter(e => (e.attempts > 0) || (e.time_seconds > 0))
        .map(e => ({
            identifier: e.identifier,
            attempts: e.attempts > 0 ? e.attempts : 'N/A',
            time: e.time_seconds > 0 ? secondsToHMS(e.time_seconds) : 'N/A'
        }))
        .sort((a, b) => a.identifier.localeCompare(b.identifier));

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>
                    <div class="th-flex">
                        <span>Pokémon</span>
                        <div class="sort-controls">
                            <button data-sort="name" data-dir="asc">▲</button>
                            <button data-sort="name" data-dir="desc">▼</button>
                        </div>
                    </div>
                </th>
                <th>
                    <div class="th-flex">
                        <span>Attempts</span>
                        <div class="sort-controls">
                            <button data-sort="attempts" data-dir="asc">▲</button>
                            <button data-sort="attempts" data-dir="desc">▼</button>
                        </div>
                    </div>
                </th>
                <th>
                    <div class="th-flex">
                        <span>Time</span>
                        <div class="sort-controls">
                            <button data-sort="time" data-dir="asc">▲</button>
                            <button data-sort="time" data-dir="desc">▼</button>
                        </div>
                    </div>
                </th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    tableContainer.appendChild(table);

    const tbody = table.querySelector('tbody');
    const renderRows = (list) => {
        tbody.innerHTML = list.map(r => `<tr><td>${capitalizeName(r.identifier)}</td><td>${r.attempts}</td><td>${r.time}</td></tr>`).join('');
    };
    renderRows(rows);

    const sortButtons = table.querySelectorAll('.sort-controls button');
    sortButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-sort');
            const dir = btn.getAttribute('data-dir');
            const sorted = rows.slice().sort((a, b) => {
                let va, vb;
                if (key === 'name') {
                    va = a.identifier;
                    vb = b.identifier;
                    return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                }
                if (key === 'attempts') {
                    va = (a.attempts === 'N/A') ? (dir === 'asc' ? Infinity : -Infinity) : a.attempts;
                    vb = (b.attempts === 'N/A') ? (dir === 'asc' ? Infinity : -Infinity) : b.attempts;
                    return (dir === 'asc' ? va - vb : vb - va);
                }
                if (key === 'time') {
                    const toSec = t => (t === 'N/A') ? (dir === 'asc' ? Infinity : -Infinity) : hmsToSeconds(t);
                    va = toSec(a.time);
                    vb = toSec(b.time);
                    return (dir === 'asc' ? va - vb : vb - va);
                }
                return 0;
            });
            renderRows(sorted);
        });
    });

    // Footer: average time per attempt
    const footer = document.createElement('div');
    footer.className = 'table-footer';
    const totalAttempts = filtered.reduce((acc, e) => acc + (e.attempts > 0 ? e.attempts : 0), 0);
    const totalTimeSec = filtered.reduce((acc, e) => acc + (e.time_seconds > 0 ? e.time_seconds : 0), 0);
    let avgSecPerAttempt = 0;
    if (totalAttempts > 0 && totalTimeSec > 0) {
        avgSecPerAttempt = totalTimeSec / totalAttempts;
    }
    footer.textContent = `Average time per attempt: ${avgSecPerAttempt ? secondsToHMS(avgSecPerAttempt) : '—'}`;
    tableContainer.appendChild(footer);

    // Download button
    const downloadBtn = card.querySelector('.table-tile .download-table');
    downloadBtn.addEventListener('click', () => {
        const csv = buildCSV(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = methodName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        a.href = url;
        a.download = `${safeName}_table.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    return card;
}

function renderAll() {
    const bandwidthFactor = Math.max(0.01, parseFloat(document.getElementById('bandwidth-factor').value || '1.0'));
    const iqrMult = Math.max(0, parseFloat(document.getElementById('iqr-mult').value || '1.5'));
    const dedupeTime = document.getElementById('dedupe-time').checked;
    const includeProcessing = document.getElementById('include-processing').checked;

    const container = document.getElementById('methods');
    container.innerHTML = '';

    const entriesByMethod = window.__METHOD_ENTRIES__ || {};
    const excluded = new Set(['Randomly Found', 'Event/Guarantee']);
    const methodNames = Object.keys(entriesByMethod)
        .filter(name => !excluded.has(name))
        .sort((a,b) => a.localeCompare(b));

    for (const methodName of methodNames) {
        const entries = entriesByMethod[methodName] || [];
        const hasAny = entries.some(e => e.attempts > 0 || e.time_seconds > 0);
        if (!hasAny) continue; // discard methods with no usable data
        const card = buildChartsForMethod(methodName, entries, bandwidthFactor, iqrMult, dedupeTime, includeProcessing);
        container.appendChild(card);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ['bandwidth-factor','iqr-mult','dedupe-time','include-processing'].forEach(id => {
        document.getElementById(id).addEventListener('change', renderAll);
    });
    renderAll();
});

function secondsToHMS(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) * 1.0 / 60);
    const sec = s % 60;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ss = String(sec).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function capitalizeName(name) {
    if (!name) return '';
    return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
}

function hmsToSeconds(hms) {
    if (!hms || typeof hms !== 'string') return 0;
    const parts = hms.split(':');
    if (parts.length !== 3) return 0;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseInt(parts[2], 10) || 0;
    return h * 3600 + m * 60 + s;
}

function buildCSV(rows) {
    const escape = (v) => {
        const s = String(v ?? '');
        if (/[",\n]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    const header = ['Pokemon','Attempts','Time'];
    const lines = [header.join(',')];
    for (const r of rows) {
        lines.push([capitalizeName(r.identifier), r.attempts, r.time].map(escape).join(','));
    }
    return lines.join('\n');
}


