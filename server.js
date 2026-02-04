#!/usr/bin/env node

/**
 * CodeLab - Server
 * Handles execution logic and serves static files
 * Run with: node server.js
 */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

// Language configurations
const LANGUAGES = {
    javascript: { ext: '.js', command: (file) => `node ${file}`, timeout: 5000 },
    python: { ext: '.py', command: (file) => `python3 ${file}`, timeout: 5000 },
    java: { ext: '.java', command: (file) => `cd ${path.dirname(file)} && javac Main.java && java Main`, timeout: 10000, filename: 'Main.java' },
    cpp: { ext: '.cpp', command: (file) => `g++ ${file} -o ${file.replace('.cpp', '')} && ${file.replace('.cpp', '')}`, timeout: 10000 },
    csharp: { ext: '.cs', command: (file) => `mcs ${file} && mono ${file.replace('.cs', '.exe')}`, timeout: 10000 },
    php: { ext: '.php', command: (file) => `php ${file}`, timeout: 5000 },
    ruby: { ext: '.rb', command: (file) => `ruby ${file}`, timeout: 5000 },
    go: { ext: '.go', command: (file) => `go run ${file}`, timeout: 10000 },
    swift: { ext: '.swift', command: (file) => `swift ${file}`, timeout: 10000 },
    rust: { ext: '.rs', command: (file) => `rustc ${file} -o ${file.replace('.rs', '')} && ${file.replace('.rs', '')}`, timeout: 15000 }
};

// Execute code function
function executeCode(language, code, callback) {
    const langConfig = LANGUAGES[language];
    if (!langConfig) return callback({ success: false, error: `Unsupported language: ${language}` });

    const fileId = randomBytes(8).toString('hex');
    const filename = langConfig.filename || `code_${fileId}${langConfig.ext}`;
    const filepath = path.join(TEMP_DIR, filename);

    try {
        fs.writeFileSync(filepath, code);
        const command = langConfig.command(filepath);
        
        exec(command, { timeout: langConfig.timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            cleanupFiles(filepath, langConfig.ext);
            if (error) {
                if (error.killed) return callback({ success: false, error: 'Execution timeout exceeded', output: '', stderr: 'Process killed due to timeout' });
                return callback({ success: false, error: error.message, output: stdout, stderr: stderr });
            }
            callback({ success: true, output: stdout, stderr: stderr, error: null });
        });
    } catch (err) {
        cleanupFiles(filepath, langConfig.ext);
        callback({ success: false, error: err.message, output: '', stderr: '' });
    }
}

// Cleanup helper
function cleanupFiles(filepath, ext) {
    try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        const dir = path.dirname(filepath);
        if (ext === '.java') {
            const classFile = path.join(dir, `Main.class`);
            if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
        }
        if (['.cpp', '.rs'].includes(ext)) {
            const exeFile = filepath.replace(ext, '');
            if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
        }
        if (ext === '.cs') {
            const exeFile = filepath.replace('.cs', '.exe');
            if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
        }
    } catch (err) { console.error('Cleanup error:', err); }
}

// Static file server helper
const serveFile = (res, filePath, contentType) => {
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end(`Server Error: ${err.code}`);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
};

// HTTP Server
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Static File Serving
    if (req.method === 'GET') {
        if (req.url === '/') {
            serveFile(res, path.join(__dirname, 'index.html'), 'text/html');
        } else if (req.url === '/style.css') {
            serveFile(res, path.join(__dirname, 'style.css'), 'text/css');
        } else if (req.url === '/script.js') {
            serveFile(res, path.join(__dirname, 'script.js'), 'application/javascript');
        } else if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
        return;
    }

    // Execute endpoint
    if (req.method === 'POST' && req.url === '/execute') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { language, code } = JSON.parse(body);
                if (!language || !code) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Language and code are required' }));
                    return;
                }
                executeCode(language, code, (result) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                });
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }
    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

process.on('SIGINT', () => { console.log('\nShutting down...'); process.exit(); });
