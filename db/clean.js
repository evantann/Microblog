const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

// Placeholder for the database file name
const dbFileName = './db/database.db';

async function cleanDB() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    await db.exec(`
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS posts;
    `);

    await db.close();
}

cleanDB().catch(err => {
    console.error('Error cleaning database:', err);
});