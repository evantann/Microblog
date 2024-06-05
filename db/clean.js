const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');

const dbFileName = './db/database.db';

async function cleanDB() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    await db.exec(`
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS posts;
    `);

    await db.close();
}

function emptyDirectory(directoryPath) {
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            console.error(`Error reading directory ${directoryPath}: ${err}`);
            return;
        }

        files.forEach((file) => {
            const filePath = path.join(directoryPath, file);
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting file ${filePath}: ${err}`);
                }
            });
        });
    });
}

const avatarsDir = path.join(__dirname, '..', 'public', 'avatars');
const videosDir = path.join(__dirname, '..', 'public', 'uploads', 'videos');

emptyDirectory(avatarsDir);
emptyDirectory(videosDir);

cleanDB().catch(err => {
    console.error('Error cleaning database:', err);
});