// Importăm modulele necesare
const express = require('express');
const bodyParser = require('body-parser');
const Influx = require('influx');

// Inițializăm aplicația Express
const app = express();

// Parsăm JSON din request body
app.use(bodyParser.json());

// Servim fișierele statice (HTML, CSS, JS)
app.use(express.static(__dirname));

// Conectare la InfluxDB local
const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'zgomot', // numele bazei de date
  schema: [
  {
    measurement: 'evenimente_zgomot',
    fields: {
      intensitate: Influx.FieldType.FLOAT,
      data_zi: Influx.FieldType.STRING,
      ora_exacta: Influx.FieldType.STRING
    },
    tags: ['sursa']
  }
]

});

// Verificăm dacă baza de date există și o creăm dacă nu
influx.getDatabaseNames()
  .then(names => {
    if (!names.includes('zgomot')) {
      return influx.createDatabase('zgomot');
    }
  })
  .then(() => {
    console.log("Conectat la InfluxDB (baza 'zgomot')");
  })
  .catch(err => {
    console.error("Eroare la conectarea cu InfluxDB:", err);
  });

// API endpoint care primește evenimentele de zgomot de la client (browser)
app.post('/api/noise-event', (req, res) => {
  const { timestamp, status, valoare } = req.body;

  // Scriem un nou punct în InfluxDB
 influx.writePoints([
  {
    measurement: 'evenimente_zgomot',
    tags: { sursa: 'browser_microfon' },
    fields: {
  intensitate: parseFloat(valoare) || 1,
  data_zi: new Date(timestamp).toISOString().slice(0, 10),
  ora_exacta: new Date(timestamp).toLocaleTimeString('ro-RO', { hour12: false })
},

    timestamp: new Date(timestamp)
  }
])


  .then(() => {
    console.log(`[Zgomot] ${timestamp} | ${status} | dB: ${valoare}`);
    res.sendStatus(200); // răspuns OK
  })
  .catch(err => {
    console.error("Eroare la scrierea în InfluxDB:", err);
    res.sendStatus(500); // răspuns cu eroare
  });
});

// Returnează ultimele 50 de înregistrări din InfluxDB
app.get('/api/noise-history', async (req, res) => {
  try {
    const result = await influx.query(`
      SELECT "intensitate" FROM "evenimente_zgomot"
      ORDER BY time DESC
      LIMIT 50
    `);
    res.json(result.reverse()); // inversăm pentru ordine cronologică
  } catch (err) {
    console.error("Eroare la interogare InfluxDB:", err);
    res.sendStatus(500);
  }
});


// Pornim serverul pe portul 3000
app.listen(3000, () => {
  console.log('Server pornit pe http://localhost:3000');
});
