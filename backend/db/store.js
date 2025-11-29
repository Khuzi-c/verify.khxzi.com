const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

// Initialize DB if not exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ requests: [], codes: {} }, null, 2));
}

function readDB() {
    try {
        const data = fs.readFileSync(DB_PATH);
        return JSON.parse(data);
    } catch (error) {
        return { requests: [], codes: {} };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
    getRequests: () => readDB().requests || [],
    getRequest: (id) => (readDB().requests || []).find(r => r.id === id),
    createRequest: (request) => {
        const db = readDB();
        if (!db.requests) db.requests = [];
        db.requests.push(request);
        writeDB(db);
        return request;
    },
    updateRequest: (id, updates) => {
        const db = readDB();
        if (!db.requests) db.requests = [];
        const index = db.requests.findIndex(r => r.id === id);
        if (index !== -1) {
            db.requests[index] = { ...db.requests[index], ...updates, updatedAt: new Date().toISOString() };
            writeDB(db);
            return db.requests[index];
        }
        return null;
    },
    // Verification Codes
    saveCode: (userId, codeData) => {
        const db = readDB();
        if (!db.codes) db.codes = {};
        db.codes[userId] = codeData;
        writeDB(db);
    },
    getCode: (userId) => {
        const db = readDB();
        return db.codes ? db.codes[userId] : null;
    },
    deleteCode: (userId) => {
        const db = readDB();
        if (db.codes && db.codes[userId]) {
            delete db.codes[userId];
            writeDB(db);
        }
    }
};
