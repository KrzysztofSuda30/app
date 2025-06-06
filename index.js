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
// Endpoint do zmiany hasła użytkownika
app.put('/change-password', async (req, res) => {
    const { login, oldPassword, newPassword } = req.body;

    if (!login || !oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Login, stare hasło i nowe hasło są wymagane' });
    }

    try {
        // Sprawdź, czy użytkownik istnieje i hasło się zgadza
        const checkQuery = 'SELECT haslo FROM punkty WHERE login = $1';
        const { rows } = await pool.query(checkQuery, [login]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Użytkownik nie istnieje' });
        }

        if (rows[0].haslo !== oldPassword) {
            return res.status(401).json({ error: 'Nieprawidłowe stare hasło' });
        }

        // Zmień hasło
        const updateQuery = 'UPDATE punkty SET haslo = $1 WHERE login = $2';
        await pool.query(updateQuery, [newPassword, login]);

        res.json({ message: 'Hasło zostało zmienione pomyślnie' });
    } catch (err) {
        console.error('Błąd przy zmianie hasła:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});

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
app.get('/all/logins', async (req, res) => {
    try {
        const query = 'SELECT login, haslo FROM punkty';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Błąd podczas pobierania loginów i haseł:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
app.get('/logins/military', async (req, res) => {
    try {
        const query = 'SELECT login, wojskowy FROM punkty';
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Błąd podczas pobierania loginów i informacji wojskowej:', err);
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

app.put('/increase-points', async (req, res) => {
    const { login } = req.body;

    if (!login) {
        return res.status(400).json({ error: 'Login jest wymagany' });
    }

    try {
        // Sprawdzamy, czy gracz istnieje
        const checkQuery = 'SELECT login FROM punkty WHERE login = $1';
        const { rows: existingPlayer } = await pool.query(checkQuery, [login]);

        if (existingPlayer.length > 0) {
            // Jeśli gracz istnieje, zwiększamy punkty o 1
            const updateQuery = 'UPDATE punkty SET points = points + 1 WHERE login = $1 RETURNING login, points';
            const { rows } = await pool.query(updateQuery, [login]);
            res.json({ message: `Punkty gracza ${login} zostały zwiększone o 1`, player: rows[0] });
        } else {
            // Gracz nie istnieje — zwracamy błąd
            res.status(404).json({ error: `Gracz ${login} nie istnieje w bazie danych` });
        }
    } catch (err) {
        console.error('Błąd podczas aktualizacji punktów:', err);
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
// Endpoint do dodania zdjęcia (login, lokacja, gatunek, obraz, data)
app.post('/upload-image', upload.single('image'), async (req, res) => {
    const { login, lokacja, gatunek, data } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;

    if (!login || !lokacja || !gatunek || !imageBuffer) {
        return res.status(400).json({ error: 'Login, lokacja, gatunek oraz obraz są wymagane' });
    }

    try {
        // Użyj daty z żądania lub aktualnej daty serwera
        const dateToUse = data ? new Date(data) : new Date();

        const insertQuery = `
            INSERT INTO zdjecia (login, lokacja, gatunek, obraz, data1) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING login, lokacja, gatunek, data1
        `;
        const { rows } = await pool.query(insertQuery, [
            login,
            lokacja,
            gatunek,
            imageBuffer,
            dateToUse
        ]);

        res.json({
            message: `Zdjęcie gracza ${login} zostało dodane`,
            image: rows[0]
        });
    } catch (err) {
        console.error('Błąd podczas dodawania zdjęcia:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
// nowe

app.get('/images/by-login/asc', async (req, res) => {
    const { login } = req.query;

    if (!login) {
        return res.status(400).json({ error: 'Login jest wymagany' });
    }

    try {
        const query = `
            SELECT login, lokacja, gatunek, ENCODE(obraz, 'base64') AS obraz_base64, data1 
            FROM zdjecia 
            WHERE login = $1 
            ORDER BY data1 ASC
        `;
        const { rows } = await pool.query(query, [login]);
        res.json(rows.map(row => ({
            login: row.login,
            lokacja: row.lokacja,
            gatunek: row.gatunek,
            data: row.data1,
            obraz: `data:image/jpeg;base64,${row.obraz_base64}`
        })));
    } catch (err) {
        console.error('Błąd przy pobieraniu zdjęć (rosnąco):', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
app.get('/images/by-login/desc', async (req, res) => {
    const { login } = req.query;

    if (!login) {
        return res.status(400).json({ error: 'Login jest wymagany' });
    }

    try {
        const query = `
            SELECT login, lokacja, gatunek, ENCODE(obraz, 'base64') AS obraz_base64, data1 
            FROM zdjecia 
            WHERE login = $1 
            ORDER BY data1 DESC
        `;
        const { rows } = await pool.query(query, [login]);
        res.json(rows.map(row => ({
            login: row.login,
            lokacja: row.lokacja,
            gatunek: row.gatunek,
            data: row.data1,
            obraz: `data:image/jpeg;base64,${row.obraz_base64}`
        })));
    } catch (err) {
        console.error('Błąd przy pobieraniu zdjęć (malejąco):', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
app.get('/images/by-species', async (req, res) => {
    const { gatunek, login } = req.query;

    if (!gatunek || !login) {
        return res.status(400).json({ error: 'Gatunek i login są wymagane' });
    }

    try {
        const query = `
            SELECT login, lokacja, gatunek, ENCODE(obraz, 'base64') AS obraz_base64, data1 
            FROM zdjecia 
            WHERE gatunek = $1 AND login = $2
            ORDER BY data1 DESC
        `;
        const { rows } = await pool.query(query, [gatunek, login]);
        res.json(rows.map(row => ({
            login: row.login,
            lokacja: row.lokacja,
            gatunek: row.gatunek,
            data: row.data1,
            obraz: `data:image/jpeg;base64,${row.obraz_base64}`
        })));
    } catch (err) {
        console.error('Błąd przy pobieraniu zdjęć po gatunku i loginie:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});
// GET /species/by-count?login=krzysiek
app.get('/species/by-count', async (req, res) => {
    const { login } = req.query;

    if (!login) {
        return res.status(400).json({ error: 'Login jest wymagany' });
    }

    try {
        const query = `
            SELECT z.login, z.lokacja, z.gatunek, z.data1, ENCODE(z.obraz, 'base64') AS obraz_base64, liczby.liczba_zdjec
            FROM zdjecia z
            JOIN (
                SELECT gatunek, COUNT(*) AS liczba_zdjec
                FROM zdjecia
                WHERE login = $1
                GROUP BY gatunek
            ) AS liczby ON z.gatunek = liczby.gatunek
            WHERE z.login = $1
            ORDER BY liczby.liczba_zdjec DESC, z.gatunek, z.data1 DESC
        `;

        const { rows } = await pool.query(query, [login]);

        const result = rows.map(row => ({
            login: row.login,
            lokacja: row.lokacja,
            gatunek: row.gatunek,
            data: row.data1,
            liczba_zdjec: row.liczba_zdjec,
            obraz: `data:image/jpeg;base64,${row.obraz_base64}`
        }));

        res.json(result);
    } catch (err) {
        console.error('Błąd przy pobieraniu pełnych danych gatunków:', err);
        res.status(500).json({ error: 'Błąd serwera' });
    }
});


app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
