#!/usr/bin/env node

const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const crypto = require('crypto');

let sockets = [];
let watchedFiles = [];

const server = http.createServer(handler).listen(7000);
console.log('http://localhost:7000/');

server.on('upgrade', function (req, socket) {

    if (req.headers['upgrade'] !== 'websocket') {
        return socket.end('HTTP/1.1 400 Bad Request');
    }

    const acceptKey = req.headers['sec-websocket-key'];
    const hash = generateAcceptValue(acceptKey);
    const responseHeaders = [
        'HTTP/1.1 101 Web Socket Protocol Handshake',
        'Upgrade: WebSocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${hash}`
    ];
    
    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
    sockets.push(socket);
});

function generateAcceptValue(acceptKey) {
    return crypto
        .createHash('sha1')
        .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
        .digest('base64');
}

function handler(req, res) {

    if (urlHelper.containsFilePath(req.url)) {

        if (urlHelper.fileTypeIsSupported(req.url)) {

            return fileContent(urlHelper.toServerPath(req.url), req, res);

        } else {

            return notFound(req, res);
        }

    } else {

        fs.stat(urlHelper.toServerPathIndexFile(req.url), (err, stats) => {

            if (!err && stats.isFile()) {

                return redirect(urlHelper.toIndexFileUrl(req.url), req, res);

            } else {

                return dirContent(urlHelper.toServerPath(req.url), req, res);
            }
        });
    }
}

const urlHelper = {

    getFileExtension: u => path.extname(url.parse(u).pathname),

    hasFileExtension: u => urlHelper.getFileExtension(u).length > 0,

    containsFilePath: u => urlHelper.hasFileExtension(u),

    fileTypeIsSupported: u => urlHelper.hasFileExtension(u) &&
        fileExtensionContentTypeMap.hasOwnProperty(urlHelper.getFileExtension(u)),

    toServerPath: u => {
        if (url.parse(u).pathname.includes('_kludd')) {
            return path.join(__dirname, url.parse(u).pathname);
        } else {
            return path.join(process.cwd(), url.parse(u).pathname);
        }
    },

    toServerPathIndexFile: u => path.join(process.cwd(), url.parse(u).pathname, 'index.html'),

    toIndexFileUrl: u => url.parse(u).pathname.endsWith('/') ?
        url.parse(u).pathname + 'index.html' :
        url.parse(u).pathname + '/index.html'
}

const fileExtensionContentTypeMap = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
}

const contentTypeForFilePath = filePath => fileExtensionContentTypeMap[path.extname(filePath)];

function dirContent(dirPath, req, res) {

    fs.readdir(dirPath, (err, files) => {

        if (err) {
            return notFound(req, res);
        }

        let dirUrl = url.parse(req.url).pathname;

        if (!dirUrl.endsWith('/')) {
            return redirect(dirUrl + '/', req, res);
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

        res.write(`<!doctype html><html><head><title>${dirUrl}</title></head><body>`);
        res.write('<style>a { display: inline-block; padding: 4px; margin: 4px; } body { font-family: sans-serif; }</style>');
        files.forEach(file => res.write(`<a href="${dirUrl}${file}">${file}</a>`));
        res.end('</body></html>');

        logRequest(req, res, dirPath);
    });
}

function fileContent(filePath, req, res) {

    fs.readFile(filePath, (err, data) => {

        if (err) {
            return notFound(req, res);
        }

        res.writeHead(200, { 'Content-Type': contentTypeForFilePath(filePath) });
        res.write(data);
        res.end();
        logRequest(req, res, filePath);

        if (!watchedFiles.includes(filePath)) {

            watchedFiles.push(filePath);
            fs.watch(filePath, () => {

                let s = sockets.pop();
                if (s) {
                    s.end();
                    sockets = [];
                }
            });
        }
    });
}

function serverError(req, res) {
    res.writeHead(500);
    res.end('Server error');
    logRequest(req, res);
}

function redirect(to, req, res) {
    res.writeHead(302, { Location: to });
    res.end();
    logRequest(req, res);
}

function notFound(req, res) {
    res.writeHead(404);
    res.end('Not found');
    logRequest(req, res);
}

function logRequest(req, res, serverPath) {
    console.log(req.method + ' ' + req.url);
    if (serverPath) {
        console.log('=> ' + serverPath);
    } else {
        console.log(res.statusCode);
    }
    console.log();
}