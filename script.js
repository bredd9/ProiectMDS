// Selectăm elementele din HTML: canvasul pentru spectogramă și butoanele de control
const canvas = document.getElementById("spectrogram");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// Variabile globale pentru contextul audio și analiza sunetului
let audioCtx, analyser, dataArray, source;
let animationId = null;


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
  analyser.fftSize = 4096; // mai mare = mai multă precizie spectrală

  const bufferLength = analyser.frequencyBinCount; // numărul de bin-uri de frecvență
  dataArray = new Uint8Array(bufferLength); // buffer unde stocăm datele de amplitudine

  source.connect(analyser); // conectăm microfonul la analizor

  // Dezactivăm Start și activăm Stop
  startBtn.disabled = true;
  stopBtn.disabled = false;

  document.getElementById("alertaZgomot").style.display = "none";

  // Începem desenarea spectogramei
  drawSpectrogram(bufferLength);

};

// Oprirea capturii audio
stopBtn.onclick = () => {
  if (animationId) cancelAnimationFrame(animationId);
  if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;

  // Resetăm contorul la 0 dB
  const counter = document.getElementById("dbCounter");
  if (counter) counter.textContent = "Nivel curent: 0 dB";

  // Ascundem alerta (dacă era activă)
  const alerta = document.getElementById("alertaZgomot");
  if (alerta) alerta.style.display = "none";
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
    const index = Math.floor(Math.pow(y / canvas.height, 2.5) * dataArray.length); // mapăm y pe frecvență
    const value = dataArray[index]; // amplitudinea frecvenței respective
    const percent = value / 255; // procent din maxim
    const hue = percent * 280; // de la albastru → roșu 
    const lightness = 50 + (percent * 10); // luminozitate
    ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
    ctx.fillRect(canvas.width - 1, canvas.height - y, 1, 1); // pixel vertical
  }

  // Verificăm dacă este zgomot
  detectNoise(dataArray);
}

function detectNoise(freqData) {
  const threshold = 90;
  const noisyBins = freqData.filter(v => v > threshold);

  const rms = Math.sqrt(freqData.reduce((sum, v) => sum + v * v, 0) / freqData.length);
  const dB = 20 * Math.log10(rms);

  // Actualizare contor dB
  const counter = document.getElementById("dbCounter");
  if (counter) {
    counter.textContent = `Nivel curent: ${dB.toFixed(2)} dB`;
  }

  // Afișare alertă și acțiuni automate dacă dB ≥ 40
  const alerta = document.getElementById("alertaZgomot");
  if (dB >= 42) {
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

    // Oprire automată (simulează apăsarea pe Stop)
    stopSpectrogram();
  } else {
    alerta.style.display = "none";
  }
}

function stopSpectrogram() {
  if (animationId) cancelAnimationFrame(animationId);
  if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;

  const counter = document.getElementById("dbCounter");
  if (counter) counter.textContent = "Nivel curent: 0 dB";

}


