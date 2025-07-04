<?php
/**
 * データベースAPI - 工程管理システム用（修正版）
 */

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

// データベース設定（環境に合わせて変更してください）
define('DB_HOST', 'localhost');
define('DB_NAME', 'factory0328_wp2');  // データベース名を変更
define('DB_USER', 'factory0328_wp2');  // ユーザー名を変更
define('DB_PASS', 'ctwjr3mmf5');  // パスワードを変更
define('DB_CHARSET', 'utf8mb4');

// レスポンス送信関数
function send_response($success, $message, $data = []) {
    $response = array_merge([
        'success' => $success,
        'message' => $message,
        'timestamp' => date('c'),
        'api_version' => '2.0.0-fixed'
    ], $data);
    
    if (!$success) {
        http_response_code(400);
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
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

// メイン処理
try {
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    switch ($action) {
        case 'get_orders':
            handle_get_orders();
            break;
            
        case 'update_order':
            handle_update_order();
            break;
            
        case 'test_connection':
            handle_test_connection();
            break;
            
        case 'get_orders_count':
            handle_get_orders_count();
            break;
            
        case 'debug_data':
            handle_debug_data();
            break;
            
        case 'fix_data':
            handle_fix_data();
            break;
            
        default:
            send_response(false, '無効なアクションです', [
                'available_actions' => ['get_orders', 'update_order', 'test_connection', 'get_orders_count', 'debug_data', 'fix_data']
            ]);
    }
    
} catch (Exception $e) {
    send_response(false, 'システムエラー: ' . $e->getMessage());
}

/**
 * 注文データを取得
 */
function handle_get_orders() {
    $pdo = get_database_connection();
    
    try {
        $limit = max(1, min((int)($_GET['limit'] ?? 20), 50));
        $page = max(1, (int)($_GET['page'] ?? 1));
        $offset = ($page - 1) * $limit;
        
        // wp_wqordersテーブルからデータを取得
        $sql = "SELECT * FROM wp_wqorders WHERE id IS NOT NULL ORDER BY id DESC LIMIT :limit OFFSET :offset";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        
        if (empty($rows)) {
            send_response(true, 'データは存在しません', [
                'orders' => [],
                'count' => 0
            ]);
            return;
        }
        
        // データを工程管理システム用のフォーマットに変換
        $orders = [];
        $conversion_errors = [];
        
        foreach ($rows as $row) {
            try {
                $order = convert_db_row_to_order($row);
                if ($order) {
                    $orders[] = $order;
                }
            } catch (Exception $e) {
                $conversion_errors[] = [
                    'row_id' => $row['id'] ?? 'unknown',
                    'error' => $e->getMessage()
                ];
                
                // エラーでも基本的な注文データを作成
                $orders[] = create_fallback_order($row);
            }
        }
        
        $response_data = [
            'orders' => $orders,
            'count' => count($orders),
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total_in_page' => count($orders),
                'has_more' => count($rows) === $limit
            ]
        ];
        
        if (!empty($conversion_errors)) {
            $response_data['conversion_errors'] = $conversion_errors;
        }
        
        send_response(true, '注文データを取得しました', $response_data);
        
    } catch (PDOException $e) {
        send_response(false, 'データ取得に失敗しました: ' . $e->getMessage());
    }
}

/**
 * デバッグデータを取得
 */
function handle_debug_data() {
    $pdo = get_database_connection();
    
    try {
        $limit = min((int)($_GET['limit'] ?? 5), 10);
        
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT :limit");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        
        $debug_info = [];
        foreach ($rows as $row) {
            $content_data = null;
            $content_error = null;
            
            try {
                $content_data = json_decode($row['content'], true);
            } catch (Exception $e) {
                $content_error = $e->getMessage();
            }
            
            $debug_info[] = [
                'id' => $row['id'],
                'customer' => $row['customer'],
                'formTitle' => $row['formTitle'],
                'created' => $row['created'],
                'content_is_json' => is_array($content_data),
                'content_error' => $content_error,
                'content_keys' => is_array($content_data) ? array_keys($content_data) : null,
                'attrs_count' => (is_array($content_data) && isset($content_data['attrs'])) ? count($content_data['attrs']) : 0,
                'content_preview' => substr($row['content'] ?? '', 0, 200)
            ];
        }
        
        send_response(true, 'デバッグデータ取得成功', [
            'debug_info' => $debug_info,
            'count' => count($debug_info)
        ]);
        
    } catch (Exception $e) {
        send_response(false, 'デバッグデータ取得エラー: ' . $e->getMessage());
    }
}

/**
 * データ修正
 */
function handle_fix_data() {
    $pdo = get_database_connection();
    
    try {
        // 問題のあるデータを特定
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM wp_wqorders WHERE content IS NULL OR content = ''");
        $null_content = $stmt->fetch();
        
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM wp_wqorders WHERE customer IS NULL OR customer = ''");
        $null_customer = $stmt->fetch();
        
        // 修正実行
        $fixes_applied = 0;
        
        // 空の顧客名を持つレコードに仮の名前を設定
        $stmt = $pdo->prepare("UPDATE wp_wqorders SET customer = CONCAT('顧客_', id) WHERE (customer IS NULL OR customer = '') AND id IS NOT NULL");
        $result = $stmt->execute();
        if ($result) {
            $fixes_applied += $stmt->rowCount();
        }
        
        send_response(true, 'データ修正完了', [
            'statistics' => [
                'null_content_records' => $null_content['total'],
                'null_customer_records' => $null_customer['total'],
                'fixes_applied' => $fixes_applied
            ]
        ]);
        
    } catch (Exception $e) {
        send_response(false, 'データ修正エラー: ' . $e->getMessage());
    }
}

/**
 * 総件数を取得
 */
function handle_get_orders_count() {
    $pdo = get_database_connection();
    
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM wp_wqorders");
        $count_result = $stmt->fetch();
        
        send_response(true, '総件数取得成功', [
            'total_count' => (int)$count_result['count']
        ]);
        
    } catch (Exception $e) {
        send_response(false, '総件数取得エラー: ' . $e->getMessage());
    }
}

/**
 * データベース行を注文データに変換
 */
function convert_db_row_to_order($row) {
    try {
        if (empty($row['id'])) {
            throw new Exception('IDが空です');
        }
        
        // 顧客情報を抽出
        $customer_info = extract_customer_info($row['content']);
        
        // 顧客名の決定
        $customer_name = '';
        if (!empty($customer_info['customer'])) {
            $customer_name = $customer_info['customer'];
        } elseif (!empty($row['customer'])) {
            $customer_name = $row['customer'];
        } else {
            $customer_name = '顧客_' . $row['id'];
        }
        
        // created日付をフォーマット
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
        
        if (empty($created_date)) {
            $created_date = date('Y/m/d');
        }
        
        // カテゴリを判定
        $category = determine_category($row['formTitle'], $customer_info);
        
        // 備考作成
        $remarks_parts = [];
        if (!empty($customer_info['email'])) {
            $remarks_parts[] = "Email: " . $customer_info['email'];
        }
        if (!empty($customer_info['phone'])) {
            $remarks_parts[] = "TEL: " . $customer_info['phone'];
        }
        if (!empty($customer_info['address'])) {
            $remarks_parts[] = "住所: " . $customer_info['address'];
        }
        
        // 注文データの構造に変換
        $order = [
            "注文ID" => "#" . str_pad($row['id'], 4, '0', STR_PAD_LEFT),
            "顧客名" => $customer_name,
            "会社名" => $customer_info['company'] ?? '',
            "注文日" => $created_date,
            "納品日" => '',
            "カテゴリ" => $category,
            "注文担当" => '',
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
            "備考" => implode(" | ", $remarks_parts),
            // データベース用の追加情報
            "_db_id" => $row['id'],
            "_form_id" => $row['formId'] ?? null,
            "_total" => $row['total'] ?? null
        ];
        
        return $order;
        
    } catch (Exception $e) {
        throw new Exception('データ変換エラー: ' . $e->getMessage());
    }
}

/**
 * attrsから顧客情報を抽出
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
            
            $name = trim($attr['name']);
            $value = trim($attr['value']);
            
            if (empty($value)) {
                continue;
            }
            
            // 顧客名の抽出（複数パターン対応）
            if (preg_match('/名前|氏名|お名前|name/i', $name) && empty($customer_info['customer'])) {
                $customer_info['customer'] = $value;
            }
            // 会社名の抽出
            elseif (preg_match('/会社|団体|企業|法人|company|organization/i', $name) && empty($customer_info['company'])) {
                $customer_info['company'] = $value;
            }
            // メールアドレスの抽出
            elseif (preg_match('/メール|email|mail|e-mail/i', $name) && empty($customer_info['email'])) {
                $customer_info['email'] = $value;
            }
            // 電話番号の抽出
            elseif (preg_match('/電話|tel|phone|TEL/i', $name) && empty($customer_info['phone'])) {
                $customer_info['phone'] = $value;
            }
            // 住所の抽出
            elseif (preg_match('/住所|address|所在地/i', $name) && empty($customer_info['address'])) {
                $customer_info['address'] = $value;
            }
        }
        
        // 他の形式での情報も確認
        if (isset($content['customer']) && empty($customer_info['customer'])) {
            $customer_info['customer'] = trim($content['customer']);
        }
        
        if (isset($content['company']) && empty($customer_info['company'])) {
            $customer_info['company'] = trim($content['company']);
        }
        
    } catch (Exception $e) {
        // JSONパースエラーの場合はそのまま返す
    }
    
    return $customer_info;
}

/**
 * エラー時のフォールバック注文データ作成
 */
function create_fallback_order($row) {
    return [
        "注文ID" => "#" . str_pad($row['id'] ?? 0, 4, '0', STR_PAD_LEFT),
        "顧客名" => $row['customer'] ?? ('顧客_' . ($row['id'] ?? 'Unknown')),
        "会社名" => '',
        "注文日" => date('Y/m/d'),
        "納品日" => '',
        "カテゴリ" => 'その他',
        "注文担当" => '',
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
        "備考" => 'データ変換エラーのため基本情報のみ表示',
        "_db_id" => $row['id'] ?? null,
        "_error" => true
    ];
}

/**
 * カテゴリを判定
 */
function determine_category($formTitle, $content) {
    $title = strtolower($formTitle ?? '');
    
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
    } elseif (strpos($title, 'お問い合わせ') !== false || strpos($title, 'contact') !== false) {
        return 'お問い合わせ';
    } elseif (strpos($title, 'サンプル') !== false || strpos($title, 'sample') !== false) {
        return 'サンプル請求';
    } elseif (strpos($title, '見積') !== false || strpos($title, 'estimate') !== false) {
        return 'お見積もり';
    }
    
    return $content['category'] ?? 'その他';
}

/**
 * 接続テスト
 */
function handle_test_connection() {
    try {
        $pdo = get_database_connection();
        
        // テーブル構造を確認
        $sql = "DESCRIBE wp_wqorders";
        $stmt = $pdo->query($sql);
        $columns = $stmt->fetchAll();
        
        // レコード数を確認
        $sql = "SELECT COUNT(*) as count FROM wp_wqorders";
        $stmt = $pdo->query($sql);
        $count_result = $stmt->fetch();
        
        // サンプルデータ確認
        $sql = "SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT 3";
        $stmt = $pdo->query($sql);
        $samples = $stmt->fetchAll();
        
        // 解析テスト
        $parse_tests = [];
        foreach ($samples as $sample) {
            $customer_info = extract_customer_info($sample['content']);
            $parse_tests[] = [
                'id' => $sample['id'],
                'raw_customer' => $sample['customer'] ?? null,
                'form_title' => $sample['formTitle'] ?? null,
                'extracted' => $customer_info,
                'content_preview' => substr($sample['content'] ?? '', 0, 100) . '...'
            ];
        }
        
        send_response(true, 'データベース接続成功', [
            'table_columns' => $columns,
            'record_count' => $count_result['count'],
            'database' => DB_NAME,
            'host' => DB_HOST,
            'parse_tests' => $parse_tests
        ]);
        
    } catch (Exception $e) {
        send_response(false, '接続テスト失敗: ' . $e->getMessage());
    }
}

/**
 * 注文データを更新
 */
function handle_update_order() {
    $order_data = json_decode(file_get_contents('php://input'), true);
    if (!$order_data) {
        send_response(false, '無効なデータです');
    }
    
    $pdo = get_database_connection();
    
    try {
        // データベース用のデータに変換
        $db_id = $order_data['_db_id'] ?? null;
        if (!$db_id) {
            send_response(false, 'データベースIDが見つかりません');
        }
        
        // contentフィールド用のデータを準備
        $content = [
            'company' => $order_data['会社名'] ?? '',
            'delivery_date' => $order_data['納品日'] ?? '',
            'order_person' => $order_data['注文担当'] ?? '',
            'image_sent_date' => $order_data['イメージ送付日'] ?? '',
            'payment_method' => $order_data['支払い方法'] ?? '',
            'payment_completed_date' => $order_data['支払い完了日'] ?? '',
            'print_order_date' => $order_data['プリント依頼日'] ?? '',
            'print_factory' => $order_data['プリント工場'] ?? '',
            'print_deadline' => $order_data['プリント納期'] ?? '',
            'sewing_order_date' => $order_data['縫製依頼日'] ?? '',
            'sewing_factory' => $order_data['縫製工場'] ?? '',
            'sewing_deadline' => $order_data['縫製納期'] ?? '',
            'inspection_person' => $order_data['検品担当'] ?? '',
            'shipping_date' => $order_data['発送日'] ?? '',
            'shipping_company' => $order_data['配送会社'] ?? '',
            'remarks' => $order_data['備考'] ?? '',
            'category' => $order_data['カテゴリ'] ?? ''
        ];
        
        // データベースを更新
        $sql = "UPDATE wp_wqorders SET 
                customer = :customer,
                content = :content
                WHERE id = :id";
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([
            ':customer' => $order_data['顧客名'] ?? '',
            ':content' => json_encode($content, JSON_UNESCAPED_UNICODE),
            ':id' => $db_id
        ]);
        
        if ($result) {
            send_response(true, 'データを更新しました');
        } else {
            send_response(false, 'データの更新に失敗しました');
        }
        
    } catch (PDOException $e) {
        send_response(false, 'データベース更新エラー: ' . $e->getMessage());
    }
}
?>