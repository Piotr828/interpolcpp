let maxrow = 0;

function addrow() {
  const container = document.getElementById('table');

  const newDiv = document.createElement('div');
  newDiv.className = 'line';
  newDiv.id = `line${maxrow}`;

  newDiv.innerHTML = `
    <input type="date" id="date${maxrow}" placeholder="data" />
    <input type="number" id="mass${maxrow}" placeholder="waga" />
    <input type="number" id="energy${maxrow}" placeholder="kalorie" />
  `;

  container.appendChild(newDiv);

  const clickHandler = () => {
    addrow();
    newDiv.removeEventListener('click', clickHandler);
  };
  newDiv.addEventListener('click', clickHandler);
  newDiv._clickHandler = clickHandler;

  maxrow++;
}

document.addEventListener('keydown', function(event) {
  const tag = event.target.tagName.toLowerCase();

  if (tag !== 'input' && event.key === 'Backspace' && maxrow > 1) {
    const prevDate = document.getElementById(`date${maxrow - 1}`);
    const prevMass = document.getElementById(`mass${maxrow - 1}`);
    const prevEnergy = document.getElementById(`energy${maxrow - 1}`);

    if (prevDate && !prevDate.value && prevMass && !prevMass.value && prevEnergy && !prevEnergy.value) {
      const prevLine = document.getElementById(`line${maxrow - 1}`);
      if (prevLine) prevLine.remove();
      maxrow--;

      // Przywróć event listener do nowego ostatniego wiersza
      const currentLine = document.getElementById(`line${maxrow - 1}`);
      if (currentLine) {
        if (currentLine._clickHandler) {
          currentLine.removeEventListener('click', currentLine._clickHandler);
        }
        const clickHandler = () => {
          addrow();
          currentLine.removeEventListener('click', clickHandler);
        };
        currentLine.addEventListener('click', clickHandler);
        currentLine._clickHandler = clickHandler;
      }
    }
  }
});

function stats() {
  const logs = [];

  for (let i = 0; i < maxrow; i++) {
    const dateStr = document.getElementById(`date${i}`).value;
    const massVal = document.getElementById(`mass${i}`).value;
    const energyVal = document.getElementById(`energy${i}`).value;

    if (!dateStr || !massVal || !energyVal) continue;

    logs.push([dateStr, parseFloat(massVal), parseFloat(energyVal)]);
  }

  return logs;
}

function parseDateToIndex(dateStr, baseDate) {
  const d = new Date(dateStr);
  return Math.floor((d - baseDate) / (1000 * 60 * 60 * 24));
}

function linearInterpolate(y0, y1, x0, x1, x) {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

function interpolateB(bKnown, idxKnown, n) {
  const b = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i <= idxKnown[0]) {
      b[i] = bKnown[0];
    } else if (i >= idxKnown[idxKnown.length - 1]) {
      b[i] = bKnown[bKnown.length - 1];
    } else {
      for (let j = 1; j < idxKnown.length; j++) {
        if (i <= idxKnown[j]) {
          const i0 = idxKnown[j - 1];
          const i1 = idxKnown[j];
          const v0 = bKnown[j - 1];
          const v1 = bKnown[j];
          b[i] = linearInterpolate(v0, v1, i0, i1, i);
          break;
        }
      }
    }
  }
  return b;
}

function findPQ(arr) {
  if (arr.length < 2) throw new Error("Minimum 2 data points required");

  const baseDate = new Date(arr[0][0]);
  const points = arr.map(([dateStr, b, c]) => ({
    idx: parseDateToIndex(dateStr, baseDate),
    b,
    c,
  })).sort((a,b) => a.idx - b.idx);

  const minIdx = points[0].idx;
  const maxIdx = points[points.length - 1].idx;
  const n = maxIdx - minIdx + 1;

  if (n < 2) throw new Error("Range of dates too small for interpolation");

  const bFull = new Array(n).fill(null);
  const cFull = new Array(n).fill(null);

  points.forEach(({ idx, b, c }) => {
    bFull[idx - minIdx] = b;
    cFull[idx - minIdx] = c;
  });

  for (let i = 0; i < n; i++) {
    if (cFull[i] === null) {
      let left = i - 1;
      while (left >= 0 && cFull[left] === null) left--;
      let right = i + 1;
      while (right < n && cFull[right] === null) right++;

      if (left >= 0 && right < n) {
        cFull[i] = linearInterpolate(cFull[left], cFull[right], left, right, i);
      } else if (left >= 0) {
        cFull[i] = cFull[left];
      } else if (right < n) {
        cFull[i] = cFull[right];
      } else {
        cFull[i] = 0;
      }
    }
  }

  const idxKnownB = [];
  const bKnownVals = [];
  for (let i = 0; i < n; i++) {
    if (bFull[i] !== null) {
      idxKnownB.push(i);
      bKnownVals.push(bFull[i]);
    }
  }
  const bInterp = interpolateB(bKnownVals, idxKnownB, n);

  const d = [];
  for (let i = 0; i < n - 1; i++) {
    d.push(bInterp[i + 1] - bInterp[i]);
  }

  const cVec = cFull.slice(0, n - 1);

  const m = d.length;
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (let i = 0; i < m; i++) {
    sumX += d[i];
    sumY += cVec[i];
    sumXX += d[i] * d[i];
    sumXY += d[i] * cVec[i];
  }

  const denom = m * sumXX - sumX * sumX;
  if (denom === 0) throw new Error("Brak rozrzutu danych, nie można policzyć p i q");

  const q = (m * sumXY - sumX * sumY) / denom;
  const p = (sumY - q * sumX) / m;

  return { p, q };
}

// Na start dodaj pierwszy wiersz:
addrow();
