// Importam modulele necesare
const express = require('express');
const bodyParser = require('body-parser');
const Influx = require('influx');

// Initializam aplicatia Express
const app = express();

// Parsam cererile JSON din body
app.use(bodyParser.json());

// Servim fisierele statice (HTML, CSS, JS)
app.use(express.static(__dirname));

// Conectare la baza de date InfluxDB locala
const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'zgomot', // numele bazei de date
  schema: [
    {
      measurement: 'evenimente_zgomot', // numele tabelului
      fields: {
        intensitate: Influx.FieldType.FLOAT,
        data_zi: Influx.FieldType.STRING,
        ora_exacta: Influx.FieldType.STRING
      },
      tags: ['sursa'] // eticheta pentru sursa zgomotului
    }
  ]
});

// Verificam daca baza de date exista. Daca nu exista o cream
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

// Endpoint API care primeste evenimente de zgomot de la client
app.post('/api/noise-event', (req, res) => {
  const { timestamp, status, valoare } = req.body;

  // Scriem datele primite in baza de date
  influx.writePoints([
    {
      measurement: 'evenimente_zgomot',
      tags: { sursa: 'browser_microfon' },
      fields: {
        intensitate: parseFloat(valoare) || 1,
        data_zi: new Date(timestamp).toISOString().slice(0, 10), // ex: 2025-06-04
        ora_exacta: new Date(timestamp).toLocaleTimeString('ro-RO', { hour12: false }) // ex: 14:03:22
      },
      timestamp: new Date(timestamp)
    }
  ])
  .then(() => {
    console.log(`[Zgomot] ${timestamp} | ${status} | dB: ${valoare}`);
    res.sendStatus(200); // raspuns OK
  })
  .catch(err => {
    console.error("Eroare la scrierea in InfluxDB:", err);
    res.sendStatus(500); // raspuns cu eroare
  });
});

// Pornim serverul pe portul 3000
app.listen(3000, () => {
  console.log('Server pornit pe http://localhost:3000');
});
