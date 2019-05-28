#!/usr/bin/env node

const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');


http.createServer(handler).listen(7000);
console.log('http://localhost:7000/');


function handler(req, res) {

    if (inspectUrl.containsFilePath(req.url)) {

        if (inspectUrl.fileTypeIsSupported(req.url)) {

            return fileContent(inspectUrl.toServerPath(req.url), req, res);

        } else {

            return notFound(req, res);
        }

    } else {

        fs.stat(inspectUrl.toServerPathIndexFile(req.url), (err, stats) => {

            if (!err && stats.isFile()) {

                return redirect(inspectUrl.toIndexFileUrl(req.url), req, res);

            } else {

                return dirContent(inspectUrl.toServerPath(req.url), req, res);
            }
        });
    }
}

const inspectUrl = {
    getFileExtension: (u) => path.extname(url.parse(u).pathname),
    hasFileExtension: (u) => inspectUrl.getFileExtension(u).length > 0,
    containsFilePath: (u) => inspectUrl.hasFileExtension(u),
    fileTypeIsSupported: (u) => inspectUrl.hasFileExtension(u) &&
        fileExtensionContentTypeMap.hasOwnProperty(inspectUrl.getFileExtension(u)),
    toServerPath: (u) => path.join(process.cwd(), url.parse(u).pathname),
    toServerPathIndexFile: (u) => path.join(process.cwd(), url.parse(u).pathname, 'index.html'),
    toIndexFileUrl: (u) => url.parse(u).pathname.endsWith('/') ? url.parse(u).pathname + 'index.html' : url.parse(u).pathname + '/index.html'
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

const contentTypeForFilePath = (filePath) => fileExtensionContentTypeMap[path.extname(filePath)];

function dirContent(dirPath, req, res) {

    fs.readdir(dirPath, (err, items) => {

        if (err) {
            return notFound(req, res);
        }

        let dirUrl = url.parse(req.url).pathname;
        if (!dirUrl.endsWith('/')) {
            return redirect(dirUrl + '/', req, res);
        }

        let body = [];

        for (let i = 0; i < items.length; i++) {
            body.push('<a href="' + dirUrl + items[i] + '">');
            body.push(items[i]);
            body.push('</a>');
            body.push('<br />');
            body.push('\n');
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(body.join(''), 'utf-8');
        logRequest(req, res, dirPath);
    });
}

function fileContent(filePath, req, res) {

    fs.readFile(filePath, (err, data) => {

        if (err) {
            return notFound(req, res);
        }

        res.writeHead(200, { 'Content-Type': contentTypeForFilePath(filePath) });
        res.end(data, 'utf-8');
        logRequest(req, res, filePath);
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