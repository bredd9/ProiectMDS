// Selectăm elementele din HTML: canvasul pentru spectogramă și butoanele de control
const canvas = document.getElementById("spectrogram");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// Variabile globale pentru contextul audio și analiza sunetului
let audioCtx, analyser, dataArray, source;
let animationId = null;

let noiseChart;
const chartCanvas = document.getElementById("noiseChart");

// Inițializează graficul cu Chart.js
function initChart() {
  noiseChart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Nivel Zgomot (dB)',
        data: [],
        borderWidth: 2,
        borderColor: 'rgba(0, 255, 255, 1)',
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        tension: 0.2
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 100
        }
      }
    }
  });
}

// Încarcă ultimele 50 de valori la pornire
async function loadInitialChartData() {
  const res = await fetch('/api/noise-history');
  const data = await res.json();

  const labels = data.map(p => new Date(p.time).toLocaleTimeString());
  const values = data.map(p => parseFloat(p.intensitate.toFixed(2)));

  noiseChart.data.labels = labels;
  noiseChart.data.datasets[0].data = values;
  noiseChart.update();
}

// Adaugă un punct nou în grafic (live)
function addToChart(dB) {
  const time = new Date().toLocaleTimeString();
  noiseChart.data.labels.push(time);
  noiseChart.data.datasets[0].data.push(dB);

  // Păstrăm doar ultimele 50 de puncte
  if (noiseChart.data.labels.length > 50) {
    noiseChart.data.labels.shift();
    noiseChart.data.datasets[0].data.shift();
  }

  noiseChart.update();
}

// Când utilizatorul apasă pe Start
startBtn.onclick = async () => {
  // Obține acces la microfonul utilizatorului
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Creează contextul audio
  audioCtx = new AudioContext();

  // Creează o sursă audio din fluxul microfonului
  source = audioCtx.createMediaStreamSource(stream);

  // Creează un analizor FFT pentru frecvențe
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048; // mai mare = mai multă precizie spectrală

  const bufferLength = analyser.frequencyBinCount; // numărul de bin-uri de frecvență
  dataArray = new Uint8Array(bufferLength); // buffer unde stocăm datele de amplitudine

  source.connect(analyser); // conectăm microfonul la analizor

  // Dezactivăm Start și activăm Stop
  startBtn.disabled = true;
  stopBtn.disabled = false;

  // Începem desenarea spectogramei
  drawSpectrogram(bufferLength);
  initChart();
  loadInitialChartData();

};

// Oprirea capturii audio
stopBtn.onclick = () => {
  // Oprirea animației dacă rulează
  if (animationId) cancelAnimationFrame(animationId);

  // Oprirea contextului audio (dacă nu e deja închis)
  if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();

  // Curățarea canvasului
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Reactivăm butonul Start
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

// Funcția de desenare a spectogramei
function drawSpectrogram(bufferLength) {
  // Salvăm ID-ul animației pentru oprire ulterioară
  animationId = requestAnimationFrame(() => drawSpectrogram(bufferLength));

  // Obținem datele de frecvență din analizor
  analyser.getByteFrequencyData(dataArray);

  // Mutăm imaginea cu 1 pixel la stânga pentru efect de scroll
  const imageData = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
  ctx.putImageData(imageData, 0, 0);
  ctx.clearRect(canvas.width - 1, 0, 1, canvas.height); // ștergem ultima coloană

  // Desenăm noua coloană pe marginea din dreapta
  for (let y = 0; y < canvas.height; y++) {
    const index = Math.floor(y * dataArray.length / canvas.height); // mapăm y pe frecvență
    const value = dataArray[index]; // amplitudinea frecvenței respective
    const percent = value / 255; // procent din maxim
    const hue = 300 - (percent * 300); // culoare între roz și albastru
    const lightness = 50 + (percent * 10); // luminozitate
    ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
    ctx.fillRect(canvas.width - 1, canvas.height - y, 1, 1); // pixel vertical
  }

  // Verificăm dacă este zgomot
  detectNoise(dataArray);
}

// Detectarea automată a zgomotului
function detectNoise(freqData) {
  // Verificăm dacă funcția este apelată
  console.log("detectNoise() a fost apelată");

  // Afișăm datele brute – amplitudinea frecvențelor
  console.log("Primul set de valori:", freqData.slice(0, 10));

  // Setăm un prag scăzut pentru testare (temporar)
  const threshold = 40;

  // Verificăm câte bin-uri depășesc pragul
  const noisyBins = freqData.filter(v => v > threshold);
  console.log(`noisyBins.length = ${noisyBins.length} din ${freqData.length}`);

  // Condiția de declanșare zgomot
  if (noisyBins.length > freqData.length * 0.25) {
    const rms = Math.sqrt(freqData.reduce((sum, v) => sum + v * v, 0) / freqData.length);
    const dB = 20 * Math.log10(rms);
    console.log(`Zgomot detectat! Intensitate: ${dB.toFixed(2)} dB`);
    addToChart(dB);
    fetch("/api/noise-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        status: "zgomot_detectat",
        valoare: parseFloat(dB.toFixed(2))
      })
    });
  }
}

