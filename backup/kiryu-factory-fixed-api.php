<?php
/**
 * kiryu-factory.com 改良版データベースAPI
 * attrsから正しく顧客情報を抽出
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// kiryu-factory.com のデータベース設定
$db_config = [
    'host' => 'localhost',
    'dbname' => 'factory0328_wp2',
    'username' => 'factory0328_wp2',
    'password' => 'ctwjr3mmf5',
    'charset' => 'utf8mb4'
];

function log_debug($message, $data = null) {
    $log = '[' . date('Y-m-d H:i:s') . '] API_v2: ' . $message;
    if ($data !== null) {
        $log .= ': ' . json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    error_log($log);
}

function send_json($success, $message, $data = []) {
    $response = [
        'success' => $success,
        'message' => $message,
        'timestamp' => date('c'),
        'api_version' => '2.0.0-improved'
    ];
    
    if (!empty($data)) {
        $response = array_merge($response, $data);
    }
    
    if (!$success) {
        http_response_code(400);
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

function get_db_connection() {
    global $db_config;
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=%s',
                $db_config['host'],
                $db_config['dbname'],
                $db_config['charset']
            );
            
            $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 10
            ]);
            
            log_debug('データベース接続成功');
            
        } catch (PDOException $e) {
            log_debug('データベース接続エラー', $e->getMessage());
            throw new Exception('データベース接続エラー: ' . $e->getMessage());
        }
    }
    
    return $pdo;
}

try {
    $action = $_GET['action'] ?? $_POST['action'] ?? 'info';
    
    log_debug('API呼び出し', [
        'action' => $action,
        'method' => $_SERVER['REQUEST_METHOD']
    ]);
    
    switch ($action) {
        case 'info':
            send_json(true, 'kiryu-factory.com 改良版API動作中', [
                'version' => '2.0.0-improved',
                'total_records' => get_total_records(),
                'features' => ['顧客名抽出', '会社名抽出', 'フォーム種別判定']
            ]);
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
            
        case 'raw_data':
            handle_raw_data();
            break;
            
        case 'parse_sample':
            handle_parse_sample();
            break;
            
        default:
            send_json(false, "無効なアクション: $action", [
                'available_actions' => ['info', 'test_connection', 'get_orders', 'get_orders_count', 'raw_data', 'parse_sample']
            ]);
    }
    
} catch (Exception $e) {
    log_debug('API例外', $e->getMessage());
    send_json(false, 'APIエラー: ' . $e->getMessage());
}

function get_total_records() {
    try {
        $pdo = get_db_connection();
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM wp_wqorders");
        $result = $stmt->fetch();
        return (int)$result['total'];
    } catch (Exception $e) {
        return 0;
    }
}

function handle_test_connection() {
    try {
        $pdo = get_db_connection();
        
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM wp_wqorders");
        $count = $stmt->fetch();
        $total_records = (int)$count['total'];
        
        // 解析テスト用サンプル取得
        $stmt = $pdo->query("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT 1");
        $latest = $stmt->fetch();
        
        $parsed_customer = '';
        $parsed_company = '';
        if ($latest && !empty($latest['content'])) {
            $customer_info = extract_customer_info($latest['content']);
            $parsed_customer = $customer_info['customer'];
            $parsed_company = $customer_info['company'];
        }
        
        send_json(true, 'データベース接続テスト成功（改良版）', [
            'connection_status' => 'success',
            'table_exists' => true,
            'table_info' => [
                'total_records' => $total_records,
                'latest_record_id' => $latest['id'] ?? null,
                'latest_customer_raw' => $latest['customer'] ?? null,
                'latest_customer_parsed' => $parsed_customer,
                'latest_company_parsed' => $parsed_company
            ]
        ]);
        
    } catch (Exception $e) {
        send_json(false, 'データベーステストエラー: ' . $e->getMessage());
    }
}

function handle_get_orders_count() {
    try {
        $total = get_total_records();
        send_json(true, '総件数取得成功', [
            'total_count' => $total
        ]);
    } catch (Exception $e) {
        send_json(false, '総件数取得エラー: ' . $e->getMessage());
    }
}

function handle_raw_data() {
    try {
        $pdo = get_db_connection();
        
        $limit = min((int)($_GET['limit'] ?? 5), 10);
        
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT :limit");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $rows = $stmt->fetchAll();
        
        send_json(true, '生データ取得成功', [
            'raw_data' => $rows,
            'count' => count($rows)
        ]);
        
    } catch (Exception $e) {
        send_json(false, '生データ取得エラー: ' . $e->getMessage());
    }
}

function handle_parse_sample() {
    try {
        $pdo = get_db_connection();
        
        $limit = min((int)($_GET['limit'] ?? 3), 5);
        
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT :limit");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $rows = $stmt->fetchAll();
        
        $parse_examples = [];
        foreach ($rows as $row) {
            $customer_info = extract_customer_info($row['content']);
            $parse_examples[] = [
                'id' => $row['id'],
                'formTitle' => $row['formTitle'],
                'raw_customer' => $row['customer'],
                'parsed_customer' => $customer_info['customer'],
                'parsed_company' => $customer_info['company'],
                'parsed_email' => $customer_info['email'],
                'parsed_phone' => $customer_info['phone'],
                'parsed_address' => $customer_info['address'],
                'content_sample' => substr($row['content'], 0, 200) . '...'
            ];
        }
        
        send_json(true, 'パース例取得成功', [
            'parse_examples' => $parse_examples,
            'count' => count($parse_examples)
        ]);
        
    } catch (Exception $e) {
        send_json(false, 'パース例取得エラー: ' . $e->getMessage());
    }
}

function handle_get_orders() {
    try {
        $pdo = get_db_connection();
        
        $limit = max(1, min((int)($_GET['limit'] ?? 20), 50));
        $page = max(1, (int)($_GET['page'] ?? 1));
        $offset = ($page - 1) * $limit;
        
        log_debug('注文データ取得開始（改良版）', [
            'limit' => $limit,
            'page' => $page,
            'offset' => $offset
        ]);
        
        // データ取得（NULLチェック強化）
        $sql = "SELECT * FROM wp_wqorders 
                WHERE id IS NOT NULL 
                ORDER BY id DESC 
                LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $rows = $stmt->fetchAll();
        
        log_debug('データベースから取得', [
            'rows' => count($rows),
            'first_row_id' => $rows[0]['id'] ?? null
        ]);
        
        // データ変換（改良版）
        $orders = [];
        foreach ($rows as $row) {
            try {
                $order = convert_db_row_to_order_improved($row);
                if ($order && !empty($order['注文ID'])) {
                    $orders[] = $order;
                }
            } catch (Exception $e) {
                log_debug('行変換エラー', [
                    'row_id' => $row['id'] ?? 'unknown',
                    'error' => $e->getMessage()
                ]);
                // エラーでも処理を続行
            }
        }
        
        log_debug('変換後のデータ（改良版）', [
            'orders' => count($orders),
            'first_order' => $orders[0]['注文ID'] ?? null,
            'first_customer' => $orders[0]['顧客名'] ?? null
        ]);
        
        if (empty($orders)) {
            send_json(false, '有効な注文データが見つかりませんでした', [
                'raw_rows_count' => count($rows),
                'sample_raw_data' => array_slice($rows, 0, 2)
            ]);
        } else {
            send_json(true, 'データ取得成功（改良版）', [
                'orders' => $orders,
                'count' => count($orders),
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $limit,
                    'total_in_page' => count($orders),
                    'has_more' => count($rows) === $limit
                ]
            ]);
        }
        
    } catch (Exception $e) {
        log_debug('注文データ取得エラー', $e->getMessage());
        send_json(false, 'データ取得エラー: ' . $e->getMessage());
    }
}

/**
 * attrsから顧客情報を抽出する改良版関数
 */
function extract_customer_info($content_json) {
    $customer_info = [
        'customer' => '',
        'company' => '',
        'email' => '',
        'phone' => '',
        'address' => ''
    ];
    
    if (empty($content_json)) {
        return $customer_info;
    }
    
    try {
        $content = json_decode($content_json, true);
        if (!is_array($content) || !isset($content['attrs']) || !is_array($content['attrs'])) {
            return $customer_info;
        }
        
        foreach ($content['attrs'] as $attr) {
            if (!isset($attr['name']) || !isset($attr['value'])) {
                continue;
            }
            
            $name = $attr['name'];
            $value = trim($attr['value']);
            
            if (empty($value)) {
                continue;
            }
            
            // 顧客名の抽出
            if ($name === 'お名前' || $name === '氏名' || $name === 'name') {
                $customer_info['customer'] = $value;
            }
            // 会社名の抽出
            elseif (strpos($name, '会社') !== false || strpos($name, '団体') !== false || $name === 'company') {
                $customer_info['company'] = $value;
            }
            // メールアドレスの抽出
            elseif (strpos($name, 'メール') !== false || strpos($name, 'email') !== false) {
                $customer_info['email'] = $value;
            }
            // 電話番号の抽出
            elseif (strpos($name, '電話') !== false || strpos($name, 'tel') !== false || strpos($name, 'phone') !== false) {
                $customer_info['phone'] = $value;
            }
            // 住所の抽出
            elseif (strpos($name, '住所') !== false || strpos($name, 'address') !== false) {
                $customer_info['address'] = $value;
            }
        }
        
    } catch (Exception $e) {
        log_debug('顧客情報抽出エラー', $e->getMessage());
    }
    
    return $customer_info;
}

/**
 * データベース行を注文データに変換する改良版関数
 */
function convert_db_row_to_order_improved($row) {
    try {
        if (empty($row['id'])) {
            throw new Exception('IDが空です');
        }
        
        // 顧客情報を抽出
        $customer_info = extract_customer_info($row['content']);
        
        // フォーム種別から商品カテゴリを判定
        $category = determine_category_improved($row['formTitle'], $customer_info);
        
        // 作成日をフォーマット
        $created_date = '';
        if (!empty($row['created'])) {
            if (is_numeric($row['created'])) {
                $timestamp = (int)$row['created'];
                if ($timestamp > 0) {
                    $created_date = date('Y/m/d', $timestamp);
                }
            } else {
                $timestamp = strtotime($row['created']);
                if ($timestamp !== false) {
                    $created_date = date('Y/m/d', $timestamp);
                }
            }
        }
        
        // 顧客名の決定（抽出した名前がない場合のフォールバック）
        $customer_name = $customer_info['customer'];
        if (empty($customer_name)) {
            $customer_name = !empty($row['customer']) ? $row['customer'] : 'お問い合わせ';
        }
        
        return [
            "注文ID" => "#" . str_pad($row['id'], 4, '0', STR_PAD_LEFT),
            "顧客名" => $customer_name,
            "会社名" => $customer_info['company'],
            "注文日" => $created_date,
            "納品日" => '', // フォームデータなので通常は空
            "カテゴリ" => $category,
            "注文担当" => '', // フォームデータなので通常は空
            "イメージ送付日" => '',
            "支払い方法" => '',
            "支払い完了日" => '',
            "プリント依頼日" => '',
            "プリント工場" => '',
            "プリント納期" => '',
            "縫製依頼日" => '',
            "縫製工場" => '',
            "縫製納期" => '',
            "検品担当" => '',
            "発送日" => '',
            "配送会社" => '',
            "備考" => $customer_info['email'] ? "Email: {$customer_info['email']}" : '',
            // デバッグ用
            "_db_id" => $row['id'],
            "_original_customer" => $row['customer'] ?? null,
            "_form_title" => $row['formTitle'] ?? null,
            "_parsed_phone" => $customer_info['phone'],
            "_parsed_address" => $customer_info['address']
        ];
        
    } catch (Exception $e) {
        log_debug('データ変換エラー詳細（改良版）', [
            'row_id' => $row['id'] ?? 'unknown',
            'error' => $e->getMessage()
        ]);
        throw $e;
    }
}

/**
 * フォーム種別から商品カテゴリを判定する改良版
 */
function determine_category_improved($formTitle, $customer_info) {
    $title = strtolower($formTitle);
    
    // フォームタイトルから判定
    if (strpos($title, 'シルク') !== false || strpos($title, 'silk') !== false) {
        return 'シルク スカーフ';
    } elseif (strpos($title, 'ストール') !== false || strpos($title, 'stole') !== false) {
        return 'ストール';
    } elseif (strpos($title, 'タイ') !== false || strpos($title, 'tie') !== false) {
        return 'スカーフタイ';
    } elseif (strpos($title, 'ポケット') !== false || strpos($title, 'pocket') !== false) {
        return 'ポケットチーフ';
    } elseif (strpos($title, 'リボン') !== false || strpos($title, 'ribbon') !== false) {
        return 'リボン スカーフ';
    } elseif (strpos($title, 'スカーフ') !== false || strpos($title, 'scarf') !== false) {
        return 'ポリエステル スカーフ';
    }
    
    // お問い合わせの場合
    if (strpos($title, 'お問い合わせ') !== false || strpos($title, 'contact') !== false) {
        return 'お問い合わせ';
    }
    
    // サンプル請求の場合
    if (strpos($title, 'サンプル') !== false || strpos($title, 'sample') !== false) {
        return 'サンプル請求';
    }
    
    // 見積もりの場合
    if (strpos($title, '見積') !== false || strpos($title, 'estimate') !== false) {
        return 'お見積もり';
    }
    
    // デフォルト
    return 'その他';
}

log_debug('kiryu-factory 改良版API処理完了');
?>