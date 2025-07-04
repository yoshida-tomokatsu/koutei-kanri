<?php
/**
 * 工程管理システム - ログイン認証処理（データベース対応版）
 */

// セッション開始
session_start();

// エラーログ設定
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// ヘッダー設定
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// プリフライトリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// データベース設定
define('DB_HOST', 'localhost');
define('DB_NAME', 'factory0328_wp2');
define('DB_USER', 'factory0328_wp2');
define('DB_PASS', 'ctwjr3mmf5');
define('DB_CHARSET', 'utf8mb4');

// レスポンス送信関数
function send_response($success, $message, $data = []) {
    $response = array_merge([
        'success' => $success,
        'message' => $message,
        'timestamp' => date('c')
    ], $data);
    
    if (!$success) {
        http_response_code(400);
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// ログ関数
function log_auth($message, $data = null) {
    $log = '[' . date('Y-m-d H:i:s') . '] AUTH_DB: ' . $message;
    if ($data !== null) {
        $log .= ' | Data: ' . json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    error_log($log);
}

// データベース接続
function get_database_connection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        throw new Exception('データベース接続エラー: ' . $e->getMessage());
    }
}

// ユーザー情報を取得
function get_user_by_id($user_id) {
    try {
        $pdo = get_database_connection();
        
        $sql = "SELECT user_id, password_hash, name, email, role, permissions, is_active, last_login 
                FROM users 
                WHERE user_id = :user_id AND is_active = 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':user_id' => $user_id]);
        
        $user = $stmt->fetch();
        
        if ($user) {
            // 権限をJSON配列から配列に変換
            $user['permissions'] = json_decode($user['permissions'] ?? '[]', true);
        }
        
        return $user;
        
    } catch (Exception $e) {
        log_auth('ユーザー取得エラー', $e->getMessage());
        return false;
    }
}

// 最終ログイン時間を更新
function update_last_login($user_id) {
    try {
        $pdo = get_database_connection();
        
        $sql = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = :user_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':user_id' => $user_id]);
        
        // ログイン履歴を記録
        $sql = "INSERT INTO user_logs (user_id, action, ip_address, user_agent, details) 
                VALUES (:user_id, 'login', :ip_address, :user_agent, :details)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':user_id' => $user_id,
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            ':user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 500),
            ':details' => json_encode([
                'login_time' => date('Y-m-d H:i:s'),
                'session_id' => session_id()
            ], JSON_UNESCAPED_UNICODE)
        ]);
        
    } catch (Exception $e) {
        // ログ更新の失敗は処理を止めない
        log_auth('最終ログイン更新エラー', $e->getMessage());
    }
}

// セッション固定化攻撃対策
function regenerate_session() {
    session_regenerate_id(true);
}

// ログイン試行回数制限
function check_login_attempts($user_id) {
    $max_attempts = 5;
    $lockout_time = 15 * 60; // 15分
    
    if (!isset($_SESSION['login_attempts'])) {
        $_SESSION['login_attempts'] = [];
    }
    
    $attempts = $_SESSION['login_attempts'];
    $current_time = time();
    
    // 古い試行記録を削除
    foreach ($attempts as $id => $data) {
        if ($current_time - $data['last_attempt'] > $lockout_time) {
            unset($attempts[$id]);
        }
    }
    
    if (isset($attempts[$user_id])) {
        $user_attempts = $attempts[$user_id];
        
        // ロックアウト時間内で最大試行回数に達している場合
        if ($user_attempts['count'] >= $max_attempts && 
            ($current_time - $user_attempts['last_attempt']) < $lockout_time) {
            
            $remaining_time = $lockout_time - ($current_time - $user_attempts['last_attempt']);
            throw new Exception("ログイン試行回数が上限に達しました。{$remaining_time}秒後に再試行してください。");
        }
    }
    
    $_SESSION['login_attempts'] = $attempts;
    return true;
}

// ログイン試行回数を記録
function record_login_attempt($user_id, $success) {
    if (!isset($_SESSION['login_attempts'])) {
        $_SESSION['login_attempts'] = [];
    }
    
    if ($success) {
        // 成功時は記録をクリア
        unset($_SESSION['login_attempts'][$user_id]);
    } else {
        // 失敗時は記録を更新
        if (!isset($_SESSION['login_attempts'][$user_id])) {
            $_SESSION['login_attempts'][$user_id] = [
                'count' => 0,
                'last_attempt' => 0
            ];
        }
        
        $_SESSION['login_attempts'][$user_id]['count']++;
        $_SESSION['login_attempts'][$user_id]['last_attempt'] = time();
    }
}

try {
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    
    log_auth('認証リクエスト（DB版）', [
        'action' => $action,
        'method' => $_SERVER['REQUEST_METHOD'],
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 100)
    ]);
    
    switch ($action) {
        case 'login':
            handle_login();
            break;
            
        case 'logout':
            handle_logout();
            break;
            
        case 'check_session':
            handle_check_session();
            break;
            
        case 'get_user_info':
            handle_get_user_info();
            break;
            
        case 'test_db_connection':
            handle_test_db_connection();
            break;
            
        default:
            send_response(false, '無効なアクションです', [
                'available_actions' => ['login', 'logout', 'check_session', 'get_user_info', 'test_db_connection']
            ]);
    }
    
} catch (Exception $e) {
    log_auth('エラー', $e->getMessage());
    send_response(false, $e->getMessage());
}

/**
 * ログイン処理（データベース対応版）
 */
function handle_login() {
    $login_id = trim($_POST['loginId'] ?? '');
    $password = $_POST['password'] ?? '';
    $user_type = $_POST['userType'] ?? 'employee';
    
    log_auth('ログイン試行（DB版）', [
        'login_id' => $login_id,
        'user_type' => $user_type,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ]);
    
    // 入力検証
    if (empty($login_id) || empty($password)) {
        record_login_attempt($login_id, false);
        throw new Exception('ユーザーIDとパスワードを入力してください');
    }
    
    // ログイン試行回数チェック
    check_login_attempts($login_id);
    
    // データベースからユーザー情報を取得
    $user = get_user_by_id($login_id);
    
    if (!$user) {
        record_login_attempt($login_id, false);
        log_auth('ログイン失敗（DB版）', [
            'reason' => 'ユーザー不存在または無効',
            'login_id' => $login_id
        ]);
        throw new Exception('ユーザーIDまたはパスワードが正しくありません');
    }
    
    // パスワード検証
    if (!password_verify($password, $user['password_hash'])) {
        record_login_attempt($login_id, false);
        log_auth('ログイン失敗（DB版）', [
            'reason' => 'パスワード不一致',
            'login_id' => $login_id
        ]);
        throw new Exception('ユーザーIDまたはパスワードが正しくありません');
    }
    
    // ユーザータイプチェック
    if ($user_type === 'admin' && $user['role'] !== 'admin') {
        record_login_attempt($login_id, false);
        log_auth('ログイン失敗（DB版）', [
            'reason' => '権限不足',
            'login_id' => $login_id,
            'required_role' => 'admin',
            'user_role' => $user['role']
        ]);
        throw new Exception('管理者権限がありません');
    }
    
    // セッション固定化対策
    regenerate_session();
    
    // セッションにユーザー情報を保存
    $_SESSION['logged_in'] = true;
    $_SESSION['user_id'] = $user['user_id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['permissions'] = $user['permissions'];
    $_SESSION['login_time'] = time();
    $_SESSION['last_activity'] = time();
    $_SESSION['ip_address'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $_SESSION['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    // 最終ログイン時間を更新
    update_last_login($user['user_id']);
    
    // ログイン成功記録
    record_login_attempt($login_id, true);
    
    log_auth('ログイン成功（DB版）', [
        'user_id' => $user['user_id'],
        'user_name' => $user['name'],
        'role' => $user['role'],
        'session_id' => session_id()
    ]);
    
    send_response(true, "ようこそ、{$user['name']}さん", [
        'user' => [
            'id' => $user['user_id'],
            'name' => $user['name'],
            'role' => $user['role'],
            'permissions' => $user['permissions'],
            'email' => $user['email']
        ],
        'session_info' => [
            'login_time' => date('Y-m-d H:i:s', $_SESSION['login_time']),
            'session_id' => session_id()
        ]
    ]);
}

/**
 * ログアウト処理
 */
function handle_logout() {
    $user_id = $_SESSION['user_id'] ?? 'unknown';
    $user_name = $_SESSION['user_name'] ?? 'unknown';
    
    // ログアウトログを記録
    if (isset($_SESSION['user_id'])) {
        try {
            $pdo = get_database_connection();
            $sql = "INSERT INTO user_logs (user_id, action, ip_address, user_agent, details) 
                    VALUES (:user_id, 'logout', :ip_address, :user_agent, :details)";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':user_id' => $_SESSION['user_id'],
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                ':user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 500),
                ':details' => json_encode([
                    'logout_time' => date('Y-m-d H:i:s'),
                    'session_duration' => time() - ($_SESSION['login_time'] ?? time())
                ], JSON_UNESCAPED_UNICODE)
            ]);
        } catch (Exception $e) {
            log_auth('ログアウトログ記録エラー', $e->getMessage());
        }
    }
    
    log_auth('ログアウト（DB版）', [
        'user_id' => $user_id,
        'user_name' => $user_name,
        'session_duration' => isset($_SESSION['login_time']) ? (time() - $_SESSION['login_time']) : 0
    ]);
    
    // セッションを完全に破棄
    session_unset();
    session_destroy();
    
    // 新しいセッションを開始
    session_start();
    regenerate_session();
    
    send_response(true, 'ログアウトしました', [
        'redirect_url' => 'login.html'
    ]);
}

/**
 * セッション確認
 */
function handle_check_session() {
    $session_timeout = 8 * 60 * 60; // 8時間
    
    if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
        send_response(false, 'ログインが必要です', [
            'redirect_url' => 'login.html'
        ]);
    }
    
    // セッションタイムアウトチェック
    if (isset($_SESSION['last_activity']) && 
        (time() - $_SESSION['last_activity']) > $session_timeout) {
        
        session_unset();
        session_destroy();
        
        log_auth('セッションタイムアウト（DB版）', [
            'user_id' => $_SESSION['user_id'] ?? 'unknown',
            'last_activity' => date('Y-m-d H:i:s', $_SESSION['last_activity'])
        ]);
        
        send_response(false, 'セッションがタイムアウトしました。再度ログインしてください。', [
            'redirect_url' => 'login.html'
        ]);
    }
    
    // IPアドレス・ユーザーエージェントチェック（セキュリティ強化）
    $current_ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $current_ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    if (isset($_SESSION['ip_address']) && $_SESSION['ip_address'] !== $current_ip) {
        log_auth('IPアドレス不一致によるセッション無効化（DB版）', [
            'user_id' => $_SESSION['user_id'],
            'session_ip' => $_SESSION['ip_address'],
            'current_ip' => $current_ip
        ]);
        
        session_unset();
        session_destroy();
        
        send_response(false, 'セキュリティ上の理由によりセッションが無効化されました。', [
            'redirect_url' => 'login.html'
        ]);
    }
    
    // 最終アクティビティ時間を更新
    $_SESSION['last_activity'] = time();
    
    send_response(true, 'セッション有効', [
        'user' => [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'],
            'role' => $_SESSION['user_role'],
            'permissions' => $_SESSION['permissions']
        ],
        'session_info' => [
            'login_time' => date('Y-m-d H:i:s', $_SESSION['login_time']),
            'last_activity' => date('Y-m-d H:i:s', $_SESSION['last_activity']),
            'remaining_time' => $session_timeout - (time() - $_SESSION['last_activity'])
        ]
    ]);
}

/**
 * ユーザー情報取得
 */
function handle_get_user_info() {
    if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
        send_response(false, 'ログインが必要です');
    }
    
    // データベースから最新のユーザー情報を取得
    $user = get_user_by_id($_SESSION['user_id']);
    
    if (!$user) {
        // ユーザーが無効化された場合
        session_unset();
        session_destroy();
        send_response(false, 'ユーザーアカウントが無効化されています', [
            'redirect_url' => 'login.html'
        ]);
    }
    
    send_response(true, 'ユーザー情報取得成功', [
        'user' => [
            'id' => $user['user_id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'permissions' => $user['permissions'],
            'login_time' => date('Y-m-d H:i:s', $_SESSION['login_time']),
            'last_activity' => date('Y-m-d H:i:s', $_SESSION['last_activity']),
            'last_login' => $user['last_login']
        ]
    ]);
}

/**
 * データベース接続テスト
 */
function handle_test_db_connection() {
    try {
        $pdo = get_database_connection();
        
        // ユーザーテーブルの確認
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
        $count = $stmt->fetch();
        
        // アクティブユーザー数
        $stmt = $pdo->query("SELECT COUNT(*) as active_count FROM users WHERE is_active = 1");
        $active_count = $stmt->fetch();
        
        send_response(true, 'データベース接続成功', [
            'total_users' => $count['count'],
            'active_users' => $active_count['active_count'],
            'database' => DB_NAME,
            'host' => DB_HOST
        ]);
        
    } catch (Exception $e) {
        send_response(false, 'データベース接続テスト失敗: ' . $e->getMessage());
    }
}

log_auth('認証API処理完了（DB版）');
?>