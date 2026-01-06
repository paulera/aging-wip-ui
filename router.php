<?php
// Router for PHP built-in server

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve existing files with correct MIME types
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    $path = __DIR__ . $uri;
    
    // Set correct MIME type
    if (preg_match('/\.js$/', $uri)) {
        header('Content-Type: application/javascript; charset=UTF-8');
        readfile($path);
        exit;
    } elseif (preg_match('/\.css$/', $uri)) {
        header('Content-Type: text/css; charset=UTF-8');
        readfile($path);
        exit;
    }
    
    return false; // Let PHP serve other files
}

// Route API endpoints
if ($uri === '/api/chart-data') {
    require __DIR__ . '/api/chart-data.php';
    exit;
}

if ($uri === '/api/health') {
    require __DIR__ . '/api/health.php';
    exit;
}

// Everything else serves index.html (SPA routing)
require __DIR__ . '/dist/index.html';
