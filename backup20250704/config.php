<?php
/**
 * 工程管理システム - セキュア設定ファイル
 * 作成日: 2025年1月7日
 * 用途: データベース接続とセキュリティ設定の統一管理
 */

// 直接アクセスを防止
if (!defined('SYSTEM_ACCESS_ALLOWED')) {
    http_response_code(403);
    exit('Direct access is not allowed.');
}

// セキュリティヘッダーの設定
function setSecurityHeaders() {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    
    // HTTPSが有効な場合のみHSTSヘッダーを設定
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

// データベース設定
define('DB_CONFIG', [
    'host' => 'localhost',
    'database' => 'factory0328_wp2',
    'username' => 'factory0328_wp2',
    'password' => 'ctwjr3mmf5',
    'charset' => 'utf8mb4',
    'options' => [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]
]);

// セッション設定
function initSecureSession() {
    // セッション設定の強化
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) ? 1 : 0);
    ini_set('session.cookie_samesite', 'Strict');
    
    // セッション名の変更（デフォルトのPHPSESSIDを変更）
    session_name('KOUTEI_SESSION');
    
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

// データベース接続を取得する関数
function getSecureDBConnection() {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $config = DB_CONFIG;
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                $config['host'],
                $config['database'],
                $config['charset']
            );
            
            $pdo = new PDO($dsn, $config['username'], $config['password'], $config['options']);
        } catch (PDOException $e) {
            error_log('Database connection error: ' . $e->getMessage());
            throw new Exception('データベース接続に失敗しました。');
        }
    }
    
    return $pdo;
}

// 入力データのサニタイズ
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8');
}

// CSRFトークンの生成と検証
function generateCSRFToken() {
    if (session_status() === PHP_SESSION_NONE) {
        initSecureSession();
    }
    
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    
    return $_SESSION['csrf_token'];
}

function verifyCSRFToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        initSecureSession();
    }
    
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

// 環境変数
define('SYSTEM_VERSION', '1.0.0');
define('SYSTEM_NAME', '工程管理システム');
define('DEBUG_MODE', false); // 本番環境では必ずfalse

// エラーレポートの設定
if (DEBUG_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// ログファイルの設定
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/system_error.log');

// タイムゾーンの設定
date_default_timezone_set('Asia/Tokyo');
?> 