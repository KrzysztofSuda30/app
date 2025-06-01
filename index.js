require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');  // Dodajemy multer do obsługi plików

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Konfiguracja połączenia z bazą danych PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Konfiguracja multer do obsługi przesyłania plików
const storage = multer.memoryStorage();  // Pliki będą przechowywane w pamięci
const upload = multer({ storage: storage });

// Endpoint do pobrania TOP 3 graczy
app.get('/top3', async (req, res) => {
    try {
        const query = 'SELECT login, points FROM punkty ORDER BY points DESC LIMIT 3';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Błąd podczas pobierania danych:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Endpoint do pobrania wszystkich graczy, posortowanych alfabetycznie
app.get('/all/alphabetical', async (req, res) => {
    try {
        const query = 'SELECT login, points FROM punkty ORDER BY login ASC';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Błąd podczas pobierania danych:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Endpoint do pobrania wszystkich graczy, posortowanych po liczbie punktów (od najwyższego)
app.get('/all/points', async (req, res) => {
    try {
        const query = 'SELECT login, points FROM punkty ORDER BY points DESC';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Błąd podczas pobierania danych:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

// Endpoint do zwiększenia punktów gracza o 1 lub dodania nowego gracza
app.put('/increase-points', async (req, res) => {
    const { login } = req.body;

    if (!login) {
        return res.status(400).json({ error: 'Login jest wymagany' });
    }

    try {
        // Najpierw sprawdzamy, czy gracz istnieje
        const checkQuery = 'SELECT login FROM punkty WHERE login = $1';
        const { rows: existingPlayer } = await pool.query(checkQuery, [login]);

        if (existingPlayer.length > 0) {
            // Jeśli gracz istnieje, zwiększamy punkty o 1
            const updateQuery = 'UPDATE punkty SET points = points + 1 WHERE login = $1 RETURNING login, points';
            const { rows } = await pool.query(updateQuery, [login]);
            res.json({ message: `Punkty gracza ${login} zostały zwiększone o 1`, player: rows[0] });
        } else {
            // Jeśli gracz nie istnieje, dodajemy go z 1 punktem
            const insertQuery = 'INSERT INTO punkty (login, points) VALUES ($1, 1) RETURNING login, points';
            const { rows } = await pool.query(insertQuery, [login]);
            res.json({ message: `Gracz ${login} został dodany z 1 punktem`, player: rows[0] });
        }
    } catch (err) {
        console.error('Błąd podczas aktualizacji danych:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
app.post('/add-player', async (req, res) => {
    const { login, haslo } = req.body;

    if (!login || !haslo) {
        return res.status(400).json({ error: 'Login i hasło są wymagane' });
    }

    try {
        const insertQuery = 'INSERT INTO punkty (login, points, wojskowy, haslo) VALUES ($1, 0, 0, $2) RETURNING login, points, wojskowy';
        const { rows } = await pool.query(insertQuery, [login, haslo]);
        res.json({
            message: `Gracz ${login} został dodany`,
            player: rows[0]
        });
    } catch (err) {
        if (err.code === '23505') { // unikalność loginu
            res.status(409).json({ error: 'Gracz o podanym loginie już istnieje' });
        } else {
            console.error('Błąd podczas dodawania gracza:', err);
            res.status(500).json({ error: 'Błąd serwera' });
        }
    }
});
// Endpoint do pobrania zdjęć posortowanych po gatunku
app.get('/images-by-species', async (req, res) => {
    try {
        const query = 'SELECT login, lokacja, gatunek, ENCODE(obraz, \'base64\') AS obraz_base64 FROM zdjecia ORDER BY gatunek ASC';
        const { rows } = await pool.query(query);
        res.json(rows.map(row => ({
            login: row.login,
            lokacja: row.lokacja,
            gatunek: row.gatunek,
            obraz: `data:image/jpeg;base64,${row.obraz_base64}`
        })));
    } catch (err) {
        console.error('Błąd podczas pobierania zdjęć:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
// Endpoint do dodania zdjęcia (login, lokacja, gatunek, obraz)
app.post('/upload-image', upload.single('image'), async (req, res) => {
    const { login, lokacja, gatunek } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    if (!login || !lokacja || !gatunek || !imageBuffer) {
        return res.status(400).json({ error: 'Login, lokacja, gatunek oraz obraz są wymagane' });
    }

    try {
        // Zapytanie do bazy danych w celu dodania zdjęcia
        const insertQuery = 'INSERT INTO zdjecia (login, lokacja, gatunek, obraz) VALUES ($1, $2, $3, $4) RETURNING login, lokacja, gatunek, obraz';
        const { rows } = await pool.query(insertQuery, [login, lokacja, gatunek, imageBuffer]);

        res.json({
            message: `Zdjęcie gracza ${login} zostało dodane`,
            image: rows[0]
        });
    } catch (err) {
        console.error('Błąd podczas dodawania zdjęcia:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
