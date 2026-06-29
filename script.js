const METHODS = {
  linear:   { n: 2, degree: 1, label: 'Linear',    example: [[2,4],[6,12]] },
  kuadratik:{ n: 3, degree: 2, label: 'Kuadratik', example: [[1,1],[2,4],[3,9]] },
  kubik:    { n: 4, degree: 3, label: 'Kubik',     example: [[0,0],[1,1],[2,8],[3,27]] }
};

let currentMethod = 'linear';
let chart = null;
let lastResult = null; // { yPred }

const coordList = document.getElementById('coord-list');
const tabs = document.getElementById('tabs');
const targetXInput = document.getElementById('target-x');
const errorMsg = document.getElementById('error-msg');
const resultValueEl = document.getElementById('result-value');
const equationTextEl = document.getElementById('equation-text');
const metaMethodEl = document.getElementById('meta-method');
const metaDegreeEl = document.getElementById('meta-degree');

function buildCoordRows(method){
  const cfg = METHODS[method];
  coordList.innerHTML = '';
  for(let i = 0; i < cfg.n; i++){
    const row = document.createElement('div');
    row.className = 'coord-row';
    row.innerHTML = `
      <div class="coord-idx">${i}</div>
      <div class="field">
        <label>X${i}</label>
        <input type="number" step="any" class="coord-x" data-i="${i}" placeholder="x${i}">
      </div>
      <div class="field">
        <label>Y${i}</label>
        <input type="number" step="any" class="coord-y" data-i="${i}" placeholder="y${i}">
      </div>
    `;
    coordList.appendChild(row);
  }
}

function setMethod(method){
  currentMethod = method;
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.method === method);
  });
  buildCoordRows(method);
  metaMethodEl.textContent = METHODS[method].label;
  metaDegreeEl.textContent = METHODS[method].degree;
  clearResultUI();
  clearError();
}

tabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if(!tab) return;
  setMethod(tab.dataset.method);
});

function clearError(){
  errorMsg.textContent = '';
  document.querySelectorAll('input').forEach(i => i.classList.remove('invalid'));
}

function clearResultUI(){
  resultValueEl.textContent = '—';
  resultValueEl.classList.add('empty');
  equationTextEl.textContent = 'Belum ada perhitungan';
  equationTextEl.classList.add('empty');
  lastResult = null;
  renderChart([], null, null, METHODS[currentMethod].degree);
}

document.getElementById('btn-contoh').addEventListener('click', () => {
  const ex = METHODS[currentMethod].example;
  document.querySelectorAll('.coord-x').forEach((inp, idx) => inp.value = ex[idx][0]);
  document.querySelectorAll('.coord-y').forEach((inp, idx) => inp.value = ex[idx][1]);
  const midX = ex[Math.floor(ex.length/2) - (ex.length % 2 === 0 ? 0 : 0)];
  // Pick a sensible target between two known points
  const targets = { linear: 4, kuadratik: 1.5, kubik: 1.5 };
  targetXInput.value = targets[currentMethod];
  clearError();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  document.querySelectorAll('.coord-x, .coord-y').forEach(inp => inp.value = '');
  targetXInput.value = '';
  clearError();
  clearResultUI();
});

document.getElementById('btn-copy').addEventListener('click', () => {
  if(!lastResult) return;
  navigator.clipboard?.writeText(String(lastResult.yPred));
  const btn = document.getElementById('btn-copy');
  const old = btn.textContent;
  btn.textContent = 'Tersalin!';
  setTimeout(() => btn.textContent = old, 1200);
});

/* ---------- Gaussian Elimination on Vandermonde matrix ---------- */
function gaussianElimination(Ain, bin){
  const n = bin.length;
  const A = Ain.map(row => row.slice());
  const b = bin.slice();
  for(let i = 0; i < n; i++) A[i].push(b[i]);

  for(let i = 0; i < n; i++){
    let maxEl = Math.abs(A[i][i]), maxRow = i;
    for(let k = i + 1; k < n; k++){
      if(Math.abs(A[k][i]) > maxEl){ maxEl = Math.abs(A[k][i]); maxRow = k; }
    }
    if(maxRow !== i){ [A[i], A[maxRow]] = [A[maxRow], A[i]]; }
    if(Math.abs(A[i][i]) < 1e-12) continue; // singular-ish, handled by caller via duplicate check
    for(let k = i + 1; k < n; k++){
      const c = -A[k][i] / A[i][i];
      for(let j = i; j <= n; j++){
        A[k][j] += c * A[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for(let i = n - 1; i >= 0; i--){
    let sum = A[i][n];
    for(let k = i + 1; k < n; k++) sum -= A[i][k] * x[k];
    x[i] = A[i][i] !== 0 ? sum / A[i][i] : 0;
  }
  return x;
}

function buildVandermonde(points, degree){
  const A = points.map(([x]) => {
    const row = [];
    for(let p = 0; p <= degree; p++) row.push(Math.pow(x, p));
    return row;
  });
  const b = points.map(([, y]) => y);
  return { A, b };
}

function evalPoly(coeffs, x){
  let y = 0;
  for(let p = 0; p < coeffs.length; p++) y += coeffs[p] * Math.pow(x, p);
  return y;
}

function fmtNum(v, decimals = 4){
  let r = Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
  if(Object.is(r, -0)) r = 0;
  return r;
}

function buildEquationString(coeffs){
  const degree = coeffs.length - 1;
  const parts = [];
  for(let p = degree; p >= 0; p--){
    let c = fmtNum(coeffs[p], 4);
    if(Math.abs(c) < 1e-9 && degree > 0) continue;
    const sign = c < 0 ? '-' : (parts.length ? '+' : '');
    const abs = Math.abs(c);
    let term;
    if(p === 0) term = `${abs}`;
    else if(p === 1) term = `${abs}x`;
    else term = `${abs}x^${p}`;
    parts.push(`${sign}${parts.length ? ' ' : ''}${term}`);
  }
  if(parts.length === 0) parts.push('0');
  return 'y = ' + parts.join(' ');
}

function renderEquationAnimated(str){
  // split on spaces but keep sign tokens with following term; simplest: animate by character-chunks of terms
  const tokens = str.replace('y = ', '').split(/\s+/);
  equationTextEl.classList.remove('empty');
  equationTextEl.innerHTML = '<span class="term-in" style="animation-delay:0s">y =</span> ';
  let delay = 0.08;
  tokens.forEach(tok => {
    const span = document.createElement('span');
    span.className = 'term-in';
    span.style.animationDelay = delay + 's';
    span.textContent = tok + ' ';
    equationTextEl.appendChild(span);
    delay += 0.08;
  });
}

/* ---------- Validation ---------- */
function validateAndCollect(){
  clearError();
  const xInputs = Array.from(document.querySelectorAll('.coord-x'));
  const yInputs = Array.from(document.querySelectorAll('.coord-y'));
  let hasEmpty = false;
  const points = [];
  const xs = [];

  xInputs.forEach((xi, idx) => {
    const yi = yInputs[idx];
    if(xi.value === '' || yi.value === ''){
      hasEmpty = true;
      if(xi.value === '') xi.classList.add('invalid');
      if(yi.value === '') yi.classList.add('invalid');
    } else {
      points.push([parseFloat(xi.value), parseFloat(yi.value)]);
      xs.push(parseFloat(xi.value));
    }
  });

  if(targetXInput.value === ''){
    hasEmpty = true;
    targetXInput.classList.add('invalid');
  }

  if(hasEmpty){
    errorMsg.textContent = 'Ada kolom yang masih kosong. Lengkapi semua titik dan nilai target.';
    return null;
  }

  const seen = new Set();
  let hasDup = false;
  xInputs.forEach(xi => {
    const v = xi.value;
    if(seen.has(v)){ hasDup = true; xi.classList.add('invalid'); }
    seen.add(v);
  });
  if(hasDup){
    errorMsg.textContent = 'Nilai X tidak boleh berulang antar titik data.';
    return null;
  }

  return { points, targetX: parseFloat(targetXInput.value) };
}

/* ---------- Main compute ---------- */
document.getElementById('btn-hitung').addEventListener('click', () => {
  const data = validateAndCollect();
  if(!data) return;

  const { points, targetX } = data;
  const degree = METHODS[currentMethod].degree;
  const { A, b } = buildVandermonde(points, degree);
  const coeffs = gaussianElimination(A, b);
  const yPred = evalPoly(coeffs, targetX);

  lastResult = { yPred: fmtNum(yPred, 4) };
  resultValueEl.textContent = fmtNum(yPred, 4);
  resultValueEl.classList.remove('empty');

  const eqStr = buildEquationString(coeffs);
  renderEquationAnimated(eqStr);

  renderChart(points, coeffs, { x: targetX, y: yPred }, degree);
});

/* ---------- Chart ---------- */
function renderChart(points, coeffs, predPoint, degree){
  const ctx = document.getElementById('chart').getContext('2d');

  let curveData = [];
  let dataPoints = points.map(([x, y]) => ({ x, y }));

  if(coeffs && points.length){
    const xs = points.map(p => p[0]);
    const minX = Math.min(...xs, predPoint ? predPoint.x : Infinity);
    const maxX = Math.max(...xs, predPoint ? predPoint.x : -Infinity);
    const pad = (maxX - minX) * 0.15 || 1;
    const lo = minX - pad, hi = maxX + pad;
    const steps = 80;
    for(let s = 0; s <= steps; s++){
      const x = lo + (hi - lo) * (s / steps);
      curveData.push({ x, y: evalPoly(coeffs, x) });
    }
  }

  const datasets = [
    {
      label: 'Titik Data',
      data: dataPoints,
      backgroundColor: '#FFB454',
      borderColor: '#FFB454',
      pointRadius: 6,
      pointHoverRadius: 7,
      showLine: false,
      type: 'scatter'
    },
    {
      label: 'Kurva Polinomial',
      data: curveData,
      borderColor: '#4FEFC4',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
      type: 'line',
      fill: false
    }
  ];

  if(predPoint){
    datasets.push({
      label: 'Titik Prediksi',
      data: [{ x: predPoint.x, y: predPoint.y }],
      backgroundColor: '#4FEFC4',
      borderColor: '#0A0F17',
      borderWidth: 2,
      pointRadius: 8,
      pointHoverRadius: 9,
      showLine: false,
      type: 'scatter'
    });
  }

  const config = {
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'linear',
          grid: { color: '#161E29' },
          ticks: { color: '#7C8997', font: { family: 'IBM Plex Mono', size: 11 } },
          title: { display: true, text: 'X', color: '#4D5763', font: { family: 'IBM Plex Mono', size: 11 } }
        },
        y: {
          grid: { color: '#161E29' },
          ticks: { color: '#7C8997', font: { family: 'IBM Plex Mono', size: 11 } },
          title: { display: true, text: 'Y', color: '#4D5763', font: { family: 'IBM Plex Mono', size: 11 } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0C1119',
          borderColor: '#1D2733',
          borderWidth: 1,
          titleFont: { family: 'IBM Plex Mono', size: 11 },
          bodyFont: { family: 'IBM Plex Mono', size: 12 },
          callbacks: {
            label: (item) => `(${fmtNum(item.parsed.x,3)}, ${fmtNum(item.parsed.y,3)})`
          }
        }
      }
    }
  };

  if(chart) chart.destroy();
  chart = new Chart(ctx, config);
}

/* ---------- Init ---------- */
setMethod('linear');
renderChart([], null, null, 1);
