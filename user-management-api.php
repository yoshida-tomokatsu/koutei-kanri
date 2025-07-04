<?php
/**
 * ユーザー管理API - 工程管理システム
 * 管理者専用のユーザー管理機能
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
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
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
        'timestamp' => date('c'),
        'api_version' => '1.0.0'
    ], $data);
    
    if (!$success) {
        http_response_code(400);
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// ログ関数
function log_user_action($message, $data = null) {
    $log = '[' . date('Y-m-d H:i:s') . '] USER_MGMT: ' . $message;
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
        send_response(false, 'データベース接続に失敗しました: ' . $e->getMessage());
    }
}

// 管理者権限チェック
function check_admin_permission() {
    if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
        send_response(false, 'ログインが必要です');
    }
    
    if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
        send_response(false, '管理者権限が必要です');
    }
    
    // セッションタイムアウトチェック
    $session_timeout = 8 * 60 * 60; // 8時間
    if (isset($_SESSION['last_activity']) && 
        (time() - $_SESSION['last_activity']) > $session_timeout) {
        session_unset();
        session_destroy();
        send_response(false, 'セッションがタイムアウトしました');
    }
    
    $_SESSION['last_activity'] = time();
}

// 入力検証
function validate_user_input($data, $required_fields = []) {
    $errors = [];
    
    // 必須フィールドチェック
    foreach ($required_fields as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $errors[] = "{$field}は必須です";
        }
    }
    
    // ユーザーIDの形式チェック
    if (isset($data['user_id'])) {
        $user_id = trim($data['user_id']);
        if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $user_id)) {
            $errors[] = 'ユーザーIDは3-20文字の英数字とアンダースコアのみ使用可能です';
        }
    }
    
    // メールアドレスの形式チェック
    if (isset($data['email']) && !empty(trim($data['email']))) {
        if (!filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'メールアドレスの形式が正しくありません';
        }
    }
    
    // パスワードの強度チェック
    if (isset($data['password']) && !empty(trim($data['password']))) {
        $password = trim($data['password']);
        if (strlen($password) < 6) {
            $errors[] = 'パスワードは6文字以上で設定してください';
        }
    }
    
    // 名前の長さチェック
    if (isset($data['name'])) {
        $name = trim($data['name']);
        if (strlen($name) > 100) {
            $errors[] = '名前は100文字以内で入力してください';
        }
    }
    
    return $errors;
}

// ユーザーログの記録
function log_user_management_action($action, $target_user_id, $details = null) {
    try {
        $pdo = get_database_connection();
        
        $sql = "INSERT INTO user_logs (user_id, action, ip_address, user_agent, details) 
                VALUES (:user_id, :action, :ip_address, :user_agent, :details)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':user_id' => $_SESSION['user_id'],
            ':action' => $action,
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            ':user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 500),
            ':details' => json_encode([
                'target_user_id' => $target_user_id,
                'additional_info' => $details
            ], JSON_UNESCAPED_UNICODE)
        ]);
        
    } catch (Exception $e) {
        // ログ記録の失敗は処理を止めない
        error_log('ユーザーログ記録エラー: ' . $e->getMessage());
    }
}

try {
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    
    log_user_action('API呼び出し', [
        'action' => $action,
        'method' => $_SERVER['REQUEST_METHOD'],
        'user_id' => $_SESSION['user_id'] ?? 'anonymous',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ]);
    
    // 管理者権限チェック（情報取得以外）
    if ($action !== 'get_current_user') {
        check_admin_permission();
    }
    
    switch ($action) {
        case 'get_users':
            handle_get_users();
            break;
            
        case 'add_user':
            handle_add_user();
            break;
            
        case 'update_user':
            handle_update_user();
            break;
            
        case 'delete_user':
            handle_delete_user();
            break;
            
        case 'reset_password':
            handle_reset_password();
            break;
            
        case 'toggle_user_status':
            handle_toggle_user_status();
            break;
            
        case 'get_permissions':
            handle_get_permissions();
            break;
            
        case 'get_user_logs':
            handle_get_user_logs();
            break;
            
        case 'get_current_user':
            handle_get_current_user();
            break;
            
        default:
            send_response(false, '無効なアクションです', [
                'available_actions' => [
                    'get_users', 'add_user', 'update_user', 'delete_user', 
                    'reset_password', 'toggle_user_status', 'get_permissions', 
                    'get_user_logs', 'get_current_user'
                ]
            ]);
    }
    
} catch (Exception $e) {
    log_user_action('エラー', $e->getMessage());
    send_response(false, 'システムエラー: ' . $e->getMessage());
}

/**
 * ユーザー一覧取得
 */
function handle_get_users() {
    try {
        $pdo = get_database_connection();
        
        $sql = "SELECT id, user_id, name, email, role, permissions, is_active, 
                       last_login, created_at, updated_at, created_by, notes
                FROM users 
                ORDER BY created_at DESC";
        
        $stmt = $pdo->query($sql);
        $users = $stmt->fetchAll();
        
        // パスワードハッシュを除外して送信
        foreach ($users as &$user) {
            $user['permissions'] = json_decode($user['permissions'] ?? '[]', true);
            $user['last_login_formatted'] = $user['last_login'] ? 
                date('Y-m-d H:i:s', strtotime($user['last_login'])) : 'なし';
            $user['created_at_formatted'] = date('Y-m-d H:i:s', strtotime($user['created_at']));
        }
        
        send_response(true, 'ユーザー一覧取得成功', [
            'users' => $users,
            'count' => count($users)
        ]);
        
    } catch (Exception $e) {
        send_response(false, 'ユーザー一覧取得エラー: ' . $e->getMessage());
    }
}

/**
 * ユーザー追加
 */
function handle_add_user() {
    try {
        $data = [
            'user_id' => $_POST['user_id'] ?? '',
            'name' => $_POST['name'] ?? '',
            'email' => $_POST['email'] ?? '',
            'password' => $_POST['password'] ?? '',
            'role' => $_POST['role'] ?? 'employee',
            'permissions' => $_POST['permissions'] ?? '[]',
            'notes' => $_POST['notes'] ?? ''
        ];
        
        // 入力検証
        $errors = validate_user_input($data, ['user_id', 'name', 'password']);
        if (!empty($errors)) {
            send_response(false, '入力エラー', ['errors' => $errors]);
        }
        
        $pdo = get_database_connection();
        
        // ユーザーID重複チェック
        $stmt = $pdo->prepare("SELECT id FROM users WHERE user_id = :user_id");
        $stmt->execute([':user_id' => trim($data['user_id'])]);
        if ($stmt->fetch()) {
            send_response(false, 'このユーザーIDは既に使用されています');
        }
        
        // パスワードハッシュ化
        $password_hash = password_hash(trim($data['password']), PASSWORD_DEFAULT);
        
        // 権限の検証
        $permissions = json_decode($data['permissions'], true);
        if (!is_array($permissions)) {
            $permissions = ['view'];
        }
        
        $sql = "INSERT INTO users (user_id, password_hash, name, email, role, permissions, created_by, notes) 
                VALUES (:user_id, :password_hash, :name, :email, :role, :permissions, :created_by, :notes)";
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([
            ':user_id' => trim($data['user_id']),
            ':password_hash' => $password_hash,
            ':name' => trim($data['name']),
            ':email' => trim($data['email']) ?: null,
            ':role' => $data['role'],
            ':permissions' => json_encode($permissions),
            ':created_by' => $_SESSION['user_id'],
            ':notes' => trim($data['notes']) ?: null
        ]);
        
        if ($result) {
            log_user_management_action('user_added', $data['user_id'], [
                'name' => $data['name'],
                'role' => $data['role']
            ]);
            
            send_response(true, 'ユーザーを追加しました', [
                'user_id' => $data['user_id']
            ]);
        } else {
            send_response(false, 'ユーザーの追加に失敗しました');
        }
        
    } catch (PDOException $e) {
        send_response(false, 'データベースエラー: ' . $e->getMessage());
    }
}

/**
 * ユーザー更新
 */
function handle_update_user() {
    try {
        $user_id = $_POST['user_id'] ?? '';
        $data = [
            'name' => $_POST['name'] ?? '',
            'email' => $_POST['email'] ?? '',
            'role' => $_POST['role'] ?? 'employee',
            'permissions' => $_POST['permissions'] ?? '[]',
            'notes' => $_POST['notes'] ?? ''
        ];
        
        if (empty($user_id)) {
            send_response(false, 'ユーザーIDが必要です');
        }
        
        // 入力検証
        $errors = validate_user_input($data, ['name']);
        if (!empty($errors)) {
            send_response(false, '入力エラー', ['errors' => $errors]);
        }
        
        $pdo = get_database_connection();
        
        // ユーザー存在チェック
        $stmt = $pdo->prepare("SELECT id FROM users WHERE user_id = :user_id");
        $stmt->execute([':user_id' => $user_id]);
        if (!$stmt->fetch()) {
            send_response(false, 'ユーザーが見つかりません');
        }
        
        // 自分自身の管理者権限削除を防ぐ
        if ($user_id === $_SESSION['user_id'] && $data['role'] !== 'admin') {
            send_response(false, '自分自身の管理者権限を削除することはできません');
        }
        
        // 権限の検証
        $permissions = json_decode($data['permissions'], true);
        if (!is_array($permissions)) {
            $permissions = ['view'];
        }
        
        $sql = "UPDATE users 
                SET name = :name, email = :email, role = :role, 
                    permissions = :permissions, notes = :notes, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = :user_id";
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([
            ':name' => trim($data['name']),
            ':email' => trim($data['email']) ?: null,
            ':role' => $data['role'],
            ':permissions' => json_encode($permissions),
            ':notes' => trim($data['notes']) ?: null,
            ':user_id' => $user_id
        ]);
        
        if ($result) {
            log_user_management_action('user_updated', $user_id, $data);
            send_response(true, 'ユーザー情報を更新しました');
        } else {
            send_response(false, 'ユーザー情報の更新に失敗しました');
        }
        
    } catch (Exception $e) {
        send_response(false, 'ユーザー更新エラー: ' . $e->getMessage());
    }
}

/**
 * ユーザー削除
 */
function handle_delete_user() {
    try {
        $user_id = $_POST['user_id'] ?? '';
        
        if (empty($user_id)) {
            send_response(false, 'ユーザーIDが必要です');
        }
        
        // 自分自身の削除を防ぐ
        if ($user_id === $_SESSION['user_id']) {
            send_response(false, '自分自身を削除することはできません');
        }
        
        $pdo = get_database_connection();
        
        // ユーザー存在チェック
        $stmt = $pdo->prepare("SELECT name FROM users WHERE user_id = :user_id");
        $stmt->execute([':user_id' => $user_id]);
        $user = $stmt->fetch();
        
        if (!$user) {
            send_response(false, 'ユーザーが見つかりません');
        }
        
        // 論理削除（is_active = 0）または物理削除
        $delete_type = $_POST['delete_type'] ?? 'deactivate';
        
        if ($delete_type === 'permanent') {
            $sql = "DELETE FROM users WHERE user_id = :user_id";
        } else {
            $sql = "UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = :user_id";
        }
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([':user_id' => $user_id]);
        
        if ($result) {
            $action = $delete_type === 'permanent' ? 'user_deleted_permanent' : 'user_deactivated';
            log_user_management_action($action, $user_id, ['name' => $user['name']]);
            
            $message = $delete_type === 'permanent' ? 
                'ユーザーを完全に削除しました' : 'ユーザーを無効化しました';
            send_response(true, $message);
        } else {
            send_response(false, 'ユーザーの削除に失敗しました');
        }
        
    } catch (Exception $e) {
        send_response(false, 'ユーザー削除エラー: ' . $e->getMessage());
    }
}

/**
 * パスワードリセット
 */
function handle_reset_password() {
    try {
        $user_id = $_POST['user_id'] ?? '';
        $new_password = $_POST['new_password'] ?? '';
        
        if (empty($user_id) || empty($new_password)) {
            send_response(false, 'ユーザーIDと新しいパスワードが必要です');
        }
        
        // パスワード強度チェック
        if (strlen($new_password) < 6) {
            send_response(false, 'パスワードは6文字以上で設定してください');
        }
        
        $pdo = get_database_connection();
        
        $password_hash = password_hash($new_password, PASSWORD_DEFAULT);
        
        $sql = "UPDATE users SET password_hash = :password_hash, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = :user_id";
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([
            ':password_hash' => $password_hash,
            ':user_id' => $user_id
        ]);
        
        if ($result) {
            log_user_management_action('password_reset', $user_id);
            send_response(true, 'パスワードをリセットしました');
        } else {
            send_response(false, 'パスワードリセットに失敗しました');
        }
        
    } catch (Exception $e) {
        send_response(false, 'パスワードリセットエラー: ' . $e->getMessage());
    }
}

/**
 * ユーザー状態切り替え
 */
function handle_toggle_user_status() {
    try {
        $user_id = $_POST['user_id'] ?? '';
        
        if (empty($user_id)) {
            send_response(false, 'ユーザーIDが必要です');
        }
        
        if ($user_id === $_SESSION['user_id']) {
            send_response(false, '自分自身の状態は変更できません');
        }
        
        $pdo = get_database_connection();
        
        $sql = "UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = :user_id";
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([':user_id' => $user_id]);
        
        if ($result) {
            log_user_management_action('user_status_toggled', $user_id);
            send_response(true, 'ユーザー状態を変更しました');
        } else {
            send_response(false, 'ユーザー状態の変更に失敗しました');
        }
        
    } catch (Exception $e) {
        send_response(false, 'ユーザー状態変更エラー: ' . $e->getMessage());
    }
}

/**
 * 権限一覧取得
 */
function handle_get_permissions() {
    try {
        $pdo = get_database_connection();
        
        $sql = "SELECT permission_code, permission_name, description, category 
                FROM permissions 
                WHERE is_active = 1 
                ORDER BY category, permission_name";
        
        $stmt = $pdo->query($sql);
        $permissions = $stmt->fetchAll();
        
        send_response(true, '権限一覧取得成功', ['permissions' => $permissions]);
        
    } catch (Exception $e) {
        send_response(false, '権限一覧取得エラー: ' . $e->getMessage());
    }
}

/**
 * ユーザーログ取得
 */
function handle_get_user_logs() {
    try {
        $limit = min((int)($_GET['limit'] ?? 50), 100);
        $user_id_filter = $_GET['user_id'] ?? '';
        
        $pdo = get_database_connection();
        
        $where_clause = "";
        $params = [];
        
        if (!empty($user_id_filter)) {
            $where_clause = "WHERE user_id = :user_id";
            $params[':user_id'] = $user_id_filter;
        }
        
        $sql = "SELECT user_id, action, ip_address, details, created_at 
                FROM user_logs 
                {$where_clause}
                ORDER BY created_at DESC 
                LIMIT :limit";
        
        $stmt = $pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $logs = $stmt->fetchAll();
        
        foreach ($logs as &$log) {
            $log['details'] = json_decode($log['details'], true);
            $log['created_at_formatted'] = date('Y-m-d H:i:s', strtotime($log['created_at']));
        }
        
        send_response(true, 'ユーザーログ取得成功', [
            'logs' => $logs,
            'count' => count($logs)
        ]);
        
    } catch (Exception $e) {
        send_response(false, 'ユーザーログ取得エラー: ' . $e->getMessage());
    }
}

/**
 * 現在のユーザー情報取得
 */
function handle_get_current_user() {
    if (!isset($_SESSION['logged_in']) || !$_SESSION['logged_in']) {
        send_response(false, 'ログインが必要です');
    }
    
    send_response(true, '現在のユーザー情報', [
        'user' => [
            'user_id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'],
            'role' => $_SESSION['user_role'],
            'permissions' => $_SESSION['permissions'] ?? []
        ]
    ]);
}

log_user_action('API処理完了');
?>