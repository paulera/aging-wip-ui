<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Parse JSON body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Required fields
$required = ['jiraUrl', 'jiraUser', 'jiraApiToken', 'jql', 'jqlSLE', 'sleWindow'];
foreach ($required as $field) {
    if (empty($data[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

// Build CLI command
$cliPath = __DIR__ . '/../cli/get-jira-issues.js';
if (!file_exists($cliPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'CLI tool not found']);
    exit;
}

// Escape arguments for command line
$jql = escapeshellarg($data['jql']);
$jqlSLE = escapeshellarg($data['jqlSLE']);
$sleWindow = escapeshellarg($data['sleWindow']);
$columnsOrder = isset($data['columnsOrder']) && !empty($data['columnsOrder']) ? escapeshellarg($data['columnsOrder']) : '';
$maxDays = isset($data['maxDays']) ? escapeshellarg($data['maxDays']) : '';

// Build command with environment variables for credentials
$env = [
    'JIRA_URL=' . escapeshellarg($data['jiraUrl']),
    'JIRA_USER=' . escapeshellarg($data['jiraUser']),
    'JIRA_API_TOKEN=' . escapeshellarg($data['jiraApiToken'])
];

$cmd = implode(' ', $env) . ' node ' . escapeshellarg($cliPath) . ' -j ' . $jql . ' -s ' . $jqlSLE . ' -w ' . $sleWindow;

if ($columnsOrder) {
    $cmd .= ' -o ' . $columnsOrder;
}
if ($maxDays) {
    $cmd .= ' -m ' . $maxDays;
}

$cmd .= ' 2>&1';

// Execute command
$output = [];
$returnCode = 0;
exec($cmd, $output, $returnCode);

if ($returnCode !== 0) {
    http_response_code(500);
    echo json_encode([
        'error' => 'CLI execution failed',
        'details' => implode("\n", $output),
        'code' => $returnCode,
        'command' => $cmd
    ]);
    exit;
}

// Return JSON output from CLI
$jsonOutput = implode("\n", $output);
$result = json_decode($jsonOutput, true);

if (!$result) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid JSON from CLI',
        'output' => $jsonOutput
    ]);
    exit;
}

echo json_encode($result);
