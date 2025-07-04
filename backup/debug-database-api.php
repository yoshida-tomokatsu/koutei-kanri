<?php
/**
 * デバッグ用データベースAPI（改良版）
 * 安全性とエラーハンドリングを強化
 */

// エラー報告設定
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// 実行時間制限
set_time_limit(30);

// メモリ制限
ini_set('memory_limit', '128M');

// ヘッダー設定
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// プリフライトリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// ===== データベース設定（ここを変更してください） =====
$db_config = [
    'host' => 'localhost',
    'dbname' => 'factory0328_wp2',    // あなたのデータベース名
    'username' => 'factory0328_wp2',  // あなたのユーザー名
    'password' => 'ctwjr3mmf5',       // あなたのパスワード
    'charset' => 'utf8mb4',
    'options' => [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 10,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]
];
// ================================================

// ログ関数
function log_debug($message, $data = null) {
    $timestamp = date('Y-m-d H:i:s');
    $log = "[$timestamp] DEBUG: $message";
    if ($data !== null) {
        $log .= ' | Data: ' . json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    error_log($log);
}

// レスポンス関数
function send_json($success, $message, $data = []) {
    // セキュリティヘッダー
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    
    $response = [
        'success' => $success,
        'message' => $message,
        'timestamp' => date('c'),
        'server_time' => time(),
        'debug_info' => [
            'php_version' => phpversion(),
            'memory_usage' => round(memory_get_usage(true) / 1024 / 1024, 2) . 'MB',
            'execution_time' => round((microtime(true) - $_SERVER['REQUEST_TIME_FLOAT']) * 1000, 2) . 'ms'
        ]
    ];
    
    // データをマージ
    if (!empty($data)) {
        $response = array_merge($response, $data);
    }
    
    // HTTPステータスコードを設定
    if (!$success) {
        http_response_code(400);
    }
    
    // JSON出力
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// 入力サニタイズ
function sanitize_input($input, $type = 'string') {
    switch ($type) {
        case 'int':
            return (int) filter_var($input, FILTER_SANITIZE_NUMBER_INT);
        case 'string':
        default:
            return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
}

// ログ開始
log_debug('API呼び出し開始', [
    'method' => $_SERVER['REQUEST_METHOD'],
    'query' => $_GET,
    'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 100)
]);

try {
    // アクション取得
    $action = sanitize_input($_GET['action'] ?? $_POST['action'] ?? 'info');
    
    log_debug('実行アクション', $action);
    
    // アクション処理
    switch ($action) {
        case 'info':
            handle_info();
            break;
            
        case 'test_connection':
            handle_test_connection();
            break;
            
        case 'get_orders':
            handle_get_orders();
            break;
            
        case 'get_orders_count':
            handle_get_orders_count();
            break;
            
        default:
            send_json(false, "無効なアクション: $action", [
                'available_actions' => ['info', 'test_connection', 'get_orders', 'get_orders_count']
            ]);
    }
    
} catch (Exception $e) {
    log_debug('例外発生', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    send_json(false, 'サーバーエラー: ' . $e->getMessage());
} catch (Error $e) {
    log_debug('致命的エラー', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    send_json(false, 'PHP致命的エラー: ' . $e->getMessage());
}

/**
 * システム情報を返す
 */
function handle_info() {
    log_debug('システム情報要求');
    
    send_json(true, 'デバッグAPIが正常に動作しています', [
        'api_version' => '1.1.0-debug',
        'system_info' => [
            'php_version' => phpversion(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
            'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'unknown',
            'script_name' => $_SERVER['SCRIPT_NAME'] ?? 'unknown',
            'current_time' => date('Y-m-d H:i:s'),
            'timezone' => date_default_timezone_get()
        ],
        'php_extensions' => [
            'pdo' => extension_loaded('pdo'),
            'pdo_mysql' => extension_loaded('pdo_mysql'),
            'mysqli' => extension_loaded('mysqli'),
            'json' => extension_loaded('json'),
            'curl' => extension_loaded('curl'),
            'mbstring' => extension_loaded('mbstring')
        ],
        'php_settings' => [
            'max_execution_time' => ini_get('max_execution_time'),
            'memory_limit' => ini_get('memory_limit'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size')
        ]
    ]);
}

/**
 * データベース接続テスト
 */
function handle_test_connection() {
    global $db_config;
    
    log_debug('データベース接続テスト開始');
    
    try {
        // 必要な拡張機能チェック
        if (!extension_loaded('pdo')) {
            throw new Exception('PDO拡張機能が利用できません');
        }
        
        if (!extension_loaded('pdo_mysql')) {
            throw new Exception('PDO MySQL拡張機能が利用できません');
        }
        
        // DSN作成
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            $db_config['host'],
            $db_config['dbname'],
            $db_config['charset']
        );
        
        log_debug('データベース接続試行', [
            'host' => $db_config['host'],
            'database' => $db_config['dbname']
        ]);
        
        // 接続試行
        $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], $db_config['options']);
        
        log_debug('データベース接続成功');
        
        // テーブル存在確認
        $stmt = $pdo->prepare("SHOW TABLES LIKE 'wp_wqorders'");
        $stmt->execute();
        $table_exists = $stmt->rowCount() > 0;
        
        $result = [
            'connection_status' => 'success',
            'database' => $db_config['dbname'],
            'host' => $db_config['host'],
            'table_exists' => $table_exists
        ];
        
        if ($table_exists) {
            // テーブル情報取得
            try {
                // テーブル構造
                $stmt = $pdo->prepare("DESCRIBE wp_wqorders");
                $stmt->execute();
                $columns = $stmt->fetchAll();
                
                // レコード数
                $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM wp_wqorders");
                $stmt->execute();
                $count_result = $stmt->fetch();
                $total_records = $count_result['total'];
                
                // 最新レコード
                $stmt = $pdo->prepare("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT 1");
                $stmt->execute();
                $latest_record = $stmt->fetch();
                
                $result['table_info'] = [
                    'columns' => array_map(function($col) {
                        return [
                            'field' => $col['Field'],
                            'type' => $col['Type'],
                            'null' => $col['Null'],
                            'key' => $col['Key'],
                            'default' => $col['Default']
                        ];
                    }, $columns),
                    'total_records' => $total_records,
                    'latest_record_id' => $latest_record['id'] ?? null,
                    'latest_record_date' => $latest_record['created'] ?? null
                ];
                
                log_debug('テーブル情報取得成功', [
                    'columns' => count($columns),
                    'records' => $total_records
                ]);
                
            } catch (Exception $e) {
                log_debug('テーブル情報取得エラー', $e->getMessage());
                $result['table_info_error'] = $e->getMessage();
            }
        }
        
        send_json(true, 'データベース接続テスト成功', $result);
        
    } catch (PDOException $e) {
        log_debug('PDO接続エラー', [
            'message' => $e->getMessage(),
            'code' => $e->getCode()
        ]);
        
        send_json(false, 'データベース接続エラー', [
            'error_type' => 'PDOException',
            'error_message' => $e->getMessage(),
            'error_code' => $e->getCode()
        ]);
        
    } catch (Exception $e) {
        log_debug('一般接続エラー', $e->getMessage());
        send_json(false, '接続テストエラー: ' . $e->getMessage());
    }
}

/**
 * 注文データを取得
 */
function handle_get_orders() {
    log_debug('注文データ取得開始');
    
    // パラメータ取得
    $limit = sanitize_input($_GET['limit'] ?? 20, 'int');
    $page = sanitize_input($_GET['page'] ?? 1, 'int');
    
    // 制限値チェック
    $limit = max(1, min($limit, 100)); // 1-100の範囲
    $page = max(1, $page);
    $offset = ($page - 1) * $limit;
    
    log_debug('取得パラメータ', [
        'limit' => $limit,
        'page' => $page,
        'offset' => $offset
    ]);
    
    try {
        $pdo = get_db_connection();
        
        // 制限付きでデータを取得
        $sql = "SELECT * FROM wp_wqorders ORDER BY created DESC LIMIT :limit OFFSET :offset";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $rows = $stmt->fetchAll();
        
        log_debug('データ取得完了', count($rows) . '件');
        
        // データ変換
        $orders = [];
        foreach ($rows as $row) {
            $orders[] = convert_db_row_to_order($row);
        }
        
        // ページネーション情報
        $has_more = count($rows) === $limit;
        
        send_json(true, 'データ取得成功', [
            'orders' => $orders,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total_in_page' => count($orders),
                'has_more' => $has_more
            ]
        ]);
        
    } catch (Exception $e) {
        log_debug('データ取得エラー', $e->getMessage());
        send_json(false, 'データ取得エラー: ' . $e->getMessage());
    }
}

/**
 * 総件数を取得
 */
function handle_get_orders_count() {
    log_debug('総件数取得開始');
    
    try {
        $pdo = get_db_connection();
        
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM wp_wqorders");
        $stmt->execute();
        $result = $stmt->fetch();
        
        $total_count = $result['total'];
        
        log_debug('総件数取得完了', $total_count);
        
        send_json(true, '総件数取得成功', [
            'total_count' => $total_count
        ]);
        
    } catch (Exception $e) {
        log_debug('総件数取得エラー', $e->getMessage());
        send_json(false, '総件数取得エラー: ' . $e->getMessage());
    }
}

/**
 * データベース行を注文データに変換
 */
function convert_db_row_to_order($row) {
    try {
        // contentフィールドのJSONをパース
        $content = [];
        if (!empty($row['content'])) {
            $decoded = json_decode($row['content'], true);
            if (is_array($decoded)) {
                $content = $decoded;
            }
        }
        
        // 作成日をフォーマット
        $created_date = '';
        if (!empty($row['created'])) {
            $timestamp = is_numeric($row['created']) ? (int)$row['created'] : strtotime($row['created']);
            if ($timestamp > 0) {
                $created_date = date('Y/m/d', $timestamp);
            }
        }
        
        // 注文データの構造に変換
        return [
            "注文ID" => "#" . str_pad($row['id'], 4, '0', STR_PAD_LEFT),
            "顧客名" => $row['customer'] ?? '',
            "会社名" => $content['company'] ?? '',
            "注文日" => $created_date,
            "納品日" => format_date_for_input($content['delivery_date'] ?? ''),
            "カテゴリ" => determine_category($row['formTitle'] ?? '', $content),
            "注文担当" => $content['order_person'] ?? '',
            "イメージ送付日" => format_date_for_input($content['image_sent_date'] ?? ''),
            "支払い方法" => $content['payment_method'] ?? '',
            "支払い完了日" => format_date_for_input($content['payment_completed_date'] ?? ''),
            "プリント依頼日" => format_date_for_input($content['print_order_date'] ?? ''),
            "プリント工場" => $content['print_factory'] ?? '',
            "プリント納期" => format_date_for_input($content['print_deadline'] ?? ''),
            "縫製依頼日" => format_date_for_input($content['sewing_order_date'] ?? ''),
            "縫製工場" => $content['sewing_factory'] ?? '',
            "縫製納期" => format_date_for_input($content['sewing_deadline'] ?? ''),
            "検品担当" => $content['inspection_person'] ?? '',
            "発送日" => format_date_for_input($content['shipping_date'] ?? ''),
            "配送会社" => $content['shipping_company'] ?? '',
            "備考" => $content['remarks'] ?? '',
            // データベース用の追加情報（デバッグ用）
            "_db_id" => $row['id'],
            "_form_id" => $row['formId'] ?? null,
            "_total" => $row['total'] ?? null
        ];
        
    } catch (Exception $e) {
        log_debug('データ変換エラー', [
            'row_id' => $row['id'] ?? 'unknown',
            'error' => $e->getMessage()
        ]);
        
        // エラー時のフォールバック
        return [
            "注文ID" => "#" . str_pad($row['id'] ?? 0, 4, '0', STR_PAD_LEFT),
            "顧客名" => $row['customer'] ?? '',
            "カテゴリ" => 'ポリエステル スカーフ',
            "注文日" => date('Y/m/d'),
            "_error" => "データ変換エラー: " . $e->getMessage()
        ];
    }
}

/**
 * カテゴリを判定
 */
function determine_category($formTitle, $content) {
    $title = strtolower($formTitle);
    
    if (strpos($title, 'シルク') !== false || strpos($title, 'silk') !== false) {
        return 'シルク スカーフ';
    } elseif (strpos($title, 'ポリエステル') !== false || strpos($title, 'polyester') !== false) {
        return 'ポリエステル スカーフ';
    } elseif (strpos($title, 'リボン') !== false || strpos($title, 'ribbon') !== false) {
        return 'リボン スカーフ';
    } elseif (strpos($title, 'タイ') !== false || strpos($title, 'tie') !== false) {
        return 'スカーフタイ';
    } elseif (strpos($title, 'ストール') !== false || strpos($title, 'stole') !== false) {
        return 'ストール';
    } elseif (strpos($title, 'ポケット') !== false || strpos($title, 'pocket') !== false) {
        return 'ポケットチーフ';
    }
    
    return $content['category'] ?? 'ポリエステル スカーフ';
}

/**
 * 日付をinput[type="date"]用にフォーマット
 */
function format_date_for_input($dateString) {
    if (empty($dateString)) return '';
    
    // タイムスタンプの場合
    if (is_numeric($dateString)) {
        $timestamp = (int)$dateString;
        if ($timestamp > 0) {
            return date('Y-m-d', $timestamp);
        }
    }
    
    // 日付文字列の場合
    $timestamp = strtotime($dateString);
    if ($timestamp !== false && $timestamp > 0) {
        return date('Y-m-d', $timestamp);
    }
    
    return '';
}

/**
 * データベース接続を取得（シングルトン）
 */
function get_db_connection() {
    global $db_config;
    static $pdo = null;
    
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            $db_config['host'],
            $db_config['dbname'],
            $db_config['charset']
        );
        
        $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], $db_config['options']);
        log_debug('新しいデータベース接続を作成');
    }
    
    return $pdo;
}

log_debug('API処理完了');
?>