// Selectam elementele din HTML: canvasul pentru spectograma si butoanele de control
const canvas = document.getElementById("spectrogram");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// Variabile globale pentru contextul audio si analiza sunetului
let audioCtx, analyser, dataArray, source;
let animationId = null;


// Cand utilizatorul apasa pe Start
startBtn.onclick = async () => {
  // Obtine acces la microfonul utilizatorului
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Creeaza contextul audio
  audioCtx = new AudioContext();

  // Creeaza o sursa audio din fluxul microfonului
  source = audioCtx.createMediaStreamSource(stream);

  // Creeaza un analizor FFT pentru frecvente
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096; // mai mare = mai multa precizie spectrala

  const bufferLength = analyser.frequencyBinCount; // numarul de bin-uri de frecventa
  dataArray = new Uint8Array(bufferLength); // buffer unde stocam datele de amplitudine

  source.connect(analyser); // conectam microfonul la analizor

  // Dezactivam Start si activam Stop
  startBtn.disabled = true;
  stopBtn.disabled = false;

  document.getElementById("alertaZgomot").style.display = "none";

  // Incepem desenarea spectogramei
  drawSpectrogram(bufferLength);

};

// Oprirea capturii audio
stopBtn.onclick = () => {
  if (animationId) cancelAnimationFrame(animationId);
  if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;

  // Resetam contorul la 0 dB
  const counter = document.getElementById("dbCounter");
  if (counter) counter.textContent = "Nivel curent: 0 dB";

  // Ascundem alerta (daca era activa)
  const alerta = document.getElementById("alertaZgomot");
  if (alerta) alerta.style.display = "none";
};


// Functia de desenare a spectogramei
function drawSpectrogram(bufferLength) {
  animationId = requestAnimationFrame(() => drawSpectrogram(bufferLength));
  analyser.getByteFrequencyData(dataArray);

  // Mutam tot canvasul 1 pixel la stanga pentru ca imaginea sa dea scroll
  const imageData = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
  ctx.putImageData(imageData, 0, 0);
  ctx.clearRect(canvas.width - 1, 0, 1, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    // Frecvente scalate logaritmic (pentru realism)
    const logIndex = Math.pow(y / canvas.height, 2.5) * dataArray.length;
    const index = Math.min(dataArray.length - 1, Math.floor(logIndex));
    const value = dataArray[index];

    // Mapam intensitatea (0-255) pe un gradient plasma-like (fara biblioteci externe)
    const color = getPlasmaColor(value / 255);
    ctx.fillStyle = color;
    ctx.fillRect(canvas.width - 1, canvas.height - y, 1, 1);
  }

  detectNoise(dataArray);
}

function getPlasmaColor(t) {
  // t ∈ [0, 1] – normalizat
  const r = Math.floor(255 * Math.max(0, Math.min(1.5 * t - 0.5, 1)));
  const g = Math.floor(255 * Math.max(0, Math.min(1.5 - Math.abs(2 * t - 1.5), 1)));
  const b = Math.floor(255 * Math.max(0, Math.min(2 - 1.5 * t, 1)));
  return `rgb(${r},${g},${b})`;
}


function detectNoise(freqData) {
  const threshold = 90;   //thresholdul de intensitate pentru care este considerat un zgomot
  const noisyBins = freqData.filter(v => v > threshold);

  const rms = Math.sqrt(freqData.reduce((sum, v) => sum + v * v, 0) / freqData.length);
  const dB = 20 * Math.log10(rms);  //calculam numarul de decibeli 

  // actualizare contor dB
  const counter = document.getElementById("dbCounter");
  if (counter) {
    counter.textContent = `Nivel curent: ${dB.toFixed(2)} dB`;
  }

  // Afisare alerta si actiuni automate daca dB depaseste numarul selectat
  const alerta = document.getElementById("alertaZgomot");
  if (dB >= 40) {
    alerta.style.display = "block";

    // Trimitere la server
    fetch("/api/noise-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        status: "zgomot_puternic_detectat",
        valoare: parseFloat(dB.toFixed(2))
      })
    });

    // Oprire automata (simuleaza apasarea pe Stop)
    stopSpectrogram();
  } else {
    alerta.style.display = "none";
  }
}

// Opreste animatia spectrogramei si curata totul
function stopSpectrogram() {
  // Daca animatia este activa, o anulam
  if (animationId) cancelAnimationFrame(animationId);

  // Inchidem contextul audio daca nu este deja inchis
  if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();

  // Stergem desenul de pe canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Reactivam butonul Start si dezactivam Stop
  startBtn.disabled = false;
  stopBtn.disabled = true;

  // Resetam afisajul pentru nivelul de dB la 0
  const counter = document.getElementById("dbCounter");
  if (counter) counter.textContent = "Nivel curent: 0 dB";
}



