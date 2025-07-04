<?php
/**
 * kiryu-factory.com AForms完全対応版データベースAPI
 * attrsから正しく顧客情報を抽出（完全一致優先＋正規表現フォールバック）
 */

// エラー出力を完全に抑制
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 0);

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// データベース設定
$db_config = [
    'host' => 'localhost',
    'dbname' => 'factory0328_wp2',
    'username' => 'factory0328_wp2',
    'password' => 'ctwjr3mmf5',
    'charset' => 'utf8mb4',
    'options' => [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 15,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]
];

function log_debug($message, $data = null) {
    $log = '[' . date('Y-m-d H:i:s') . '] KIRYU_AFORMS: ' . $message;
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
        'api_version' => '2.1.0-aforms-complete',
        'aforms_support' => 'full'
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
            
            $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], $db_config['options']);
            
            log_debug('データベース接続成功（AForms完全対応版）');
            
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
            send_json(true, 'kiryu-factory.com AForms完全対応版API動作中', [
                'version' => '2.1.0-aforms-complete',
                'total_records' => get_total_records(),
                'features' => [
                    'AForms完全対応',
                    '完全一致優先抽出',
                    '正規表現フォールバック',
                    'フォーム種別判定',
                    'デバッグ機能強化'
                ],
                'supported_aforms_fields' => [
                    'お名前',
                    '会社名・団体名',
                    'メールアドレス',
                    '電話番号',
                    '住所'
                ]
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
            
        case 'test_aforms_specific':
            handle_test_aforms_specific();
            break;
            
        default:
            send_json(false, "無効なアクション: $action", [
                'available_actions' => ['info', 'test_connection', 'get_orders', 'get_orders_count', 'raw_data', 'parse_sample', 'test_aforms_specific']
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
        
        // AForms抽出テスト用サンプル取得
        $stmt = $pdo->query("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT 1");
        $latest = $stmt->fetch();
        
        $aforms_test_result = null;
        if ($latest && !empty($latest['content'])) {
            $customer_info = extract_customer_info_aforms_complete($latest['content']);
            $aforms_test_result = [
                'record_id' => $latest['id'],
                'form_title' => $latest['formTitle'],
                'raw_customer' => $latest['customer'],
                'has_attrs' => strpos($latest['content'], '"attrs"') !== false,
                'extracted_customer' => $customer_info['customer'],
                'extracted_company' => $customer_info['company'],
                'extracted_email' => $customer_info['email'],
                'extracted_phone' => $customer_info['phone'],
                'extracted_address' => $customer_info['address'],
                'extraction_successful' => !empty($customer_info['customer']) || !empty($customer_info['company']) || !empty($customer_info['email'])
            ];
        }
        
        send_json(true, 'データベース接続テスト成功（AForms完全対応版）', [
            'connection_status' => 'success',
            'table_exists' => true,
            'table_info' => [
                'total_records' => $total_records,
                'latest_record_id' => $latest['id'] ?? null,
                'aforms_extraction_test' => $aforms_test_result
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
            $customer_info = extract_customer_info_aforms_complete($row['content']);
            $parse_examples[] = [
                'id' => $row['id'],
                'formTitle' => $row['formTitle'],
                'raw_customer' => $row['customer'],
                'has_attrs' => strpos($row['content'] ?? '', '"attrs"') !== false,
                'parsed_customer' => $customer_info['customer'],
                'parsed_company' => $customer_info['company'],
                'parsed_email' => $customer_info['email'],
                'parsed_phone' => $customer_info['phone'],
                'parsed_address' => $customer_info['address'],
                'extraction_method' => $customer_info['_extraction_method'] ?? 'unknown',
                'content_sample' => substr($row['content'], 0, 200) . '...'
            ];
        }
        
        send_json(true, 'AForms完全対応パース例取得成功', [
            'parse_examples' => $parse_examples,
            'count' => count($parse_examples)
        ]);
        
    } catch (Exception $e) {
        send_json(false, 'パース例取得エラー: ' . $e->getMessage());
    }
}

/**
 * AForms特化テスト機能
 */
function handle_test_aforms_specific() {
    try {
        $pdo = get_db_connection();
        
        $limit = min((int)($_GET['limit'] ?? 10), 20);
        
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders WHERE content LIKE '%attrs%' ORDER BY id DESC LIMIT :limit");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $rows = $stmt->fetchAll();
        
        $aforms_specific_tests = [];
        foreach ($rows as $row) {
            $customer_info = extract_customer_info_aforms_complete($row['content']);
            
            // attrs詳細解析
            $attrs_analysis = analyze_attrs_structure($row['content']);
            
            $aforms_specific_tests[] = [
                'id' => $row['id'],
                'formTitle' => $row['formTitle'],
                'raw_customer' => $row['customer'],
                'attrs_count' => $attrs_analysis['count'],
                'attrs_fields' => $attrs_analysis['field_names'],
                'target_fields_found' => $attrs_analysis['target_fields'],
                'extracted_customer' => $customer_info['customer'],
                'extracted_company' => $customer_info['company'],
                'extracted_email' => $customer_info['email'],
                'extracted_phone' => $customer_info['phone'],
                'extracted_address' => $customer_info['address'],
                'extraction_method' => $customer_info['_extraction_method'] ?? 'unknown',
                'extraction_details' => $customer_info['_extraction_details'] ?? []
            ];
        }
        
        send_json(true, 'AForms特化テスト完了', [
            'aforms_specific_tests' => $aforms_specific_tests,
            'count' => count($aforms_specific_tests),
            'total_attrs_records' => count($rows)
        ]);
        
    } catch (Exception $e) {
        send_json(false, 'AForms特化テストエラー: ' . $e->getMessage());
    }
}

/**
 * attrs構造分析
 */
function analyze_attrs_structure($content_json) {
    $analysis = [
        'count' => 0,
        'field_names' => [],
        'target_fields' => []
    ];
    
    if (empty($content_json)) {
        return $analysis;
    }
    
    try {
        $content = json_decode($content_json, true);
        if (is_array($content) && isset($content['attrs']) && is_array($content['attrs'])) {
            $analysis['count'] = count($content['attrs']);
            
            $target_patterns = [
                'customer' => ['お名前', '氏名', 'name', '名前'],
                'company' => ['会社名・団体名', '会社名', '団体名', 'company'],
                'email' => ['メールアドレス', 'email', 'mail'],
                'phone' => ['電話番号', 'tel', 'phone'],
                'address' => ['住所', 'address']
            ];
            
            foreach ($content['attrs'] as $attr) {
                if (isset($attr['name'])) {
                    $field_name = trim($attr['name']);
                    $analysis['field_names'][] = $field_name;
                    
                    // ターゲットフィールドチェック
                    foreach ($target_patterns as $type => $patterns) {
                        foreach ($patterns as $pattern) {
                            if (strcasecmp($field_name, $pattern) === 0) {
                                $analysis['target_fields'][] = [
                                    'type' => $type,
                                    'field_name' => $field_name,
                                    'value' => $attr['value'] ?? ''
                                ];
                                break 2;
                            }
                        }
                    }
                }
            }
        }
    } catch (Exception $e) {
        // JSONパースエラー
    }
    
    return $analysis;
}

function handle_get_orders() {
    try {
        $pdo = get_db_connection();
        
        $limit = max(1, (int)($_GET['limit'] ?? 1000));  // 実質無制限（min制限を撤廃）
        $page = max(1, (int)($_GET['page'] ?? 1));
        $offset = ($page - 1) * $limit;
        
        log_debug('注文データ取得開始（AForms完全対応版）', [
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
        
        // データ変換（AForms完全対応版）
        $orders = [];
        $aforms_extraction_stats = [
            'total_processed' => 0,
            'successful_extractions' => 0,
            'attrs_found' => 0,
            'customer_extracted' => 0,
            'company_extracted' => 0,
            'email_extracted' => 0
        ];
        
        foreach ($rows as $row) {
            try {
                $order = convert_db_row_to_order_aforms_complete($row);
                if ($order && !empty($order['注文ID'])) {
                    $orders[] = $order;
                    
                    // 統計更新
                    $aforms_extraction_stats['total_processed']++;
                    if (!empty($order['_aforms_extracted'])) {
                        $aforms_extraction_stats['successful_extractions']++;
                    }
                    if (!empty($order['_aforms_attrs_found'])) {
                        $aforms_extraction_stats['attrs_found']++;
                    }
                    if (!empty($order['顧客名']) && $order['顧客名'] !== '顧客_' . $row['id']) {
                        $aforms_extraction_stats['customer_extracted']++;
                    }
                    if (!empty($order['会社名'])) {
                        $aforms_extraction_stats['company_extracted']++;
                    }
                    if (strpos($order['備考'] ?? '', 'Email:') !== false) {
                        $aforms_extraction_stats['email_extracted']++;
                    }
                }
            } catch (Exception $e) {
                log_debug('行変換エラー', [
                    'row_id' => $row['id'] ?? 'unknown',
                    'error' => $e->getMessage()
                ]);
                // エラーでも処理を続行
            }
        }
        
        log_debug('AForms完全対応版変換後のデータ', [
            'orders' => count($orders),
            'first_order' => $orders[0]['注文ID'] ?? null,
            'first_customer' => $orders[0]['顧客名'] ?? null,
            'extraction_stats' => $aforms_extraction_stats
        ]);
        
        if (empty($orders)) {
            send_json(false, '有効な注文データが見つかりませんでした', [
                'raw_rows_count' => count($rows),
                'sample_raw_data' => array_slice($rows, 0, 2)
            ]);
        } else {
            send_json(true, 'AForms完全対応版データ取得成功', [
                'orders' => $orders,
                'count' => count($orders),
                'aforms_extraction_stats' => $aforms_extraction_stats,
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
 * AForms形式のattrsから顧客情報を抽出する完全対応版関数
 */
function extract_customer_info_aforms_complete($content_json) {
    $customer_info = [
        'customer' => '',
        'company' => '',
        'email' => '',
        'phone' => '',
        'address' => '',
        'furigana' => '',
        '_extraction_method' => 'none',
        '_extraction_details' => []
    ];
    
    if (empty($content_json)) {
        return $customer_info;
    }
    
    try {
        $content = json_decode($content_json, true);
        if (!is_array($content)) {
            return $customer_info;
        }
        
        // attrsが存在する場合（AForms形式）
        if (isset($content['attrs']) && is_array($content['attrs'])) {
            $customer_info['_extraction_method'] = 'aforms_attrs';
            
            foreach ($content['attrs'] as $attr) {
                if (!isset($attr['name']) || !isset($attr['value'])) {
                    continue;
                }
                
                $name = trim($attr['name']);
                $value = trim($attr['value']);
                
                if (empty($value)) {
                    continue;
                }
                
                // AForms特有のフィールド名に完全対応（完全一致を最優先）
                
                // 顧客名の抽出
                if ($name === 'お名前') {
                    $customer_info['customer'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'customer', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === '氏名' && empty($customer_info['customer'])) {
                    $customer_info['customer'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'customer', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'name' && empty($customer_info['customer'])) {
                    $customer_info['customer'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'customer', 'method' => 'exact_match', 'field_name' => $name];
                } elseif (empty($customer_info['customer']) && preg_match('/名前|氏名|お名前|name/i', $name)) {
                    $customer_info['customer'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'customer', 'method' => 'regex_fallback', 'field_name' => $name];
                }
                
                // フリガナの抽出
                elseif ($name === 'フリガナ') {
                    $customer_info['furigana'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'furigana', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'ふりがな' && empty($customer_info['furigana'])) {
                    $customer_info['furigana'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'furigana', 'method' => 'exact_match', 'field_name' => $name];
                } elseif (empty($customer_info['furigana']) && preg_match('/フリガナ|ふりがな|カナ|furigana/i', $name)) {
                    $customer_info['furigana'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'furigana', 'method' => 'regex_fallback', 'field_name' => $name];
                }
                
                // 会社名の抽出
                elseif ($name === '会社名・団体名') {
                    $customer_info['company'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'company', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === '会社名' && empty($customer_info['company'])) {
                    $customer_info['company'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'company', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === '団体名' && empty($customer_info['company'])) {
                    $customer_info['company'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'company', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'company' && empty($customer_info['company'])) {
                    $customer_info['company'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'company', 'method' => 'exact_match', 'field_name' => $name];
                } elseif (empty($customer_info['company']) && preg_match('/会社|団体|企業|法人|company|organization/i', $name)) {
                    $customer_info['company'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'company', 'method' => 'regex_fallback', 'field_name' => $name];
                }
                
                // メールアドレスの抽出
                elseif ($name === 'メールアドレス') {
                    $customer_info['email'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'email', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'email' && empty($customer_info['email'])) {
                    $customer_info['email'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'email', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'mail' && empty($customer_info['email'])) {
                    $customer_info['email'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'email', 'method' => 'exact_match', 'field_name' => $name];
                } elseif (empty($customer_info['email']) && preg_match('/メール|email|mail|e-mail/i', $name)) {
                    $customer_info['email'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'email', 'method' => 'regex_fallback', 'field_name' => $name];
                }
                
                // 電話番号の抽出
                elseif ($name === '電話番号') {
                    $customer_info['phone'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'phone', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'tel' && empty($customer_info['phone'])) {
                    $customer_info['phone'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'phone', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'phone' && empty($customer_info['phone'])) {
                    $customer_info['phone'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'phone', 'method' => 'exact_match', 'field_name' => $name];
                } elseif (empty($customer_info['phone']) && preg_match('/電話|tel|phone|TEL/i', $name)) {
                    $customer_info['phone'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'phone', 'method' => 'regex_fallback', 'field_name' => $name];
                }
                
                // 住所の抽出
                elseif ($name === '住所') {
                    $customer_info['address'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'address', 'method' => 'exact_match', 'field_name' => $name];
                } elseif ($name === 'address' && empty($customer_info['address'])) {
                    $customer_info['address'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'address', 'method' => 'exact_match', 'field_name' => $name];
                } elseif (empty($customer_info['address']) && preg_match('/住所|address|所在地/i', $name)) {
                    $customer_info['address'] = $value;
                    $customer_info['_extraction_details'][] = ['field' => 'address', 'method' => 'regex_fallback', 'field_name' => $name];
                }
            }
        }
        
        // 従来形式での情報も確認（フォールバック）
        if (isset($content['customer']) && empty($customer_info['customer'])) {
            $customer_info['customer'] = trim($content['customer']);
            $customer_info['_extraction_method'] = 'legacy_content';
            $customer_info['_extraction_details'][] = ['field' => 'customer', 'method' => 'legacy_content', 'field_name' => 'customer'];
        }
        
        if (isset($content['company']) && empty($customer_info['company'])) {
            $customer_info['company'] = trim($content['company']);
            if ($customer_info['_extraction_method'] === 'none') {
                $customer_info['_extraction_method'] = 'legacy_content';
            }
            $customer_info['_extraction_details'][] = ['field' => 'company', 'method' => 'legacy_content', 'field_name' => 'company'];
        }
        
        if (isset($content['email']) && empty($customer_info['email'])) {
            $customer_info['email'] = trim($content['email']);
            if ($customer_info['_extraction_method'] === 'none') {
                $customer_info['_extraction_method'] = 'legacy_content';
            }
            $customer_info['_extraction_details'][] = ['field' => 'email', 'method' => 'legacy_content', 'field_name' => 'email'];
        }
        
    } catch (Exception $e) {
        // JSONパースエラーの場合はそのまま返す
        error_log('AForms完全対応抽出エラー: ' . $e->getMessage() . ' | Content: ' . substr($content_json, 0, 200));
        $customer_info['_extraction_method'] = 'error';
        $customer_info['_extraction_details'][] = ['error' => $e->getMessage()];
    }
    
    return $customer_info;
}

/**
 * お届け希望日を抽出
 */
function extract_delivery_hope_date($content_json) {
    if (empty($content_json)) {
        return '';
    }
    
    try {
        $content = json_decode($content_json, true);
        if (!is_array($content)) {
            return '';
        }
        
        // attrsが存在する場合（AForms形式）
        if (isset($content['attrs']) && is_array($content['attrs'])) {
            foreach ($content['attrs'] as $attr) {
                if (!isset($attr['name']) || !isset($attr['value'])) {
                    continue;
                }
                
                $name = trim($attr['name']);
                $value = trim($attr['value']);
                
                if (empty($value)) {
                    continue;
                }
                
                // お届け希望日関連のフィールド名をチェック
                if (preg_match('/お届け希望|納期希望|配送希望|delivery.*hope|delivery.*date|希望.*日|納品.*希望/i', $name)) {
                    // お客様の入力内容をそのまま返す（自動変換しない）
                    return $value;
                }
            }
        }
        
        // 従来形式での希望日も確認
        if (isset($content['delivery_hope']) && !empty($content['delivery_hope'])) {
            return trim($content['delivery_hope']);
        }
        
        if (isset($content['delivery_date']) && !empty($content['delivery_date'])) {
            return trim($content['delivery_date']);
        }
        
    } catch (Exception $e) {
        error_log('お届け希望日抽出エラー: ' . $e->getMessage());
    }
    
    return '';
}

/**
 * 実際の備考欄データを抽出（お届け希望日以外）
 */
function extract_actual_remarks($content_json) {
    if (empty($content_json)) {
        return '';
    }
    
    try {
        $content = json_decode($content_json, true);
        if (!is_array($content)) {
            return '';
        }
        
        // attrsが存在する場合（AForms形式）
        if (isset($content['attrs']) && is_array($content['attrs'])) {
            foreach ($content['attrs'] as $attr) {
                if (!isset($attr['name']) || !isset($attr['value'])) {
                    continue;
                }
                
                $name = trim($attr['name']);
                $value = trim($attr['value']);
                
                if (empty($value)) {
                    continue;
                }
                
                // お届け希望日関連は除外
                if (preg_match('/お届け希望|納期希望|配送希望|delivery.*hope|delivery.*date|希望.*日|納品.*希望/i', $name)) {
                    continue;
                }
                
                // 備考欄関連のフィールド名をチェック
                if ($name === '備考' || $name === 'remarks' || $name === 'その他' || 
                    $name === 'コメント' || $name === 'comment' || $name === 'メモ' ||
                    preg_match('/備考|remarks|その他|コメント|comment|メモ|要望(?!.*日)/i', $name)) {
                    return $value;
                }
            }
        }
        
        // 従来形式での備考も確認
        if (isset($content['remarks']) && !empty($content['remarks'])) {
            return trim($content['remarks']);
        }
        
        if (isset($content['comment']) && !empty($content['comment'])) {
            return trim($content['comment']);
        }
        
    } catch (Exception $e) {
        error_log('備考抽出エラー: ' . $e->getMessage());
    }
    
    return '';
}

/**
 * 様々な日付形式をパースしてYYYY-MM-DD形式に変換
 */
function parse_date_string($date_string) {
    if (empty($date_string)) {
        return '';
    }
    
    $date_string = trim($date_string);
    
    // 既にYYYY-MM-DD形式の場合
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_string)) {
        return $date_string;
    }
    
    // 様々な日付形式をパース
    $patterns = [
        '/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})[日]?/',  // 2024/12/25, 2024-12-25, 2024年12月25日
        '/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/',          // 12/25/2024, 12-25-2024
        '/(\d{1,2})[\/\-](\d{1,2})/',                       // 12/25 (今年として扱う)
        '/(\d{1,2})月(\d{1,2})日/',                          // 12月25日
    ];
    
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $date_string, $matches)) {
            if (count($matches) == 4) {
                if (strlen($matches[1]) == 4) {
                    // YYYY/MM/DD形式
                    $year = $matches[1];
                    $month = str_pad($matches[2], 2, '0', STR_PAD_LEFT);
                    $day = str_pad($matches[3], 2, '0', STR_PAD_LEFT);
                } else {
                    // MM/DD/YYYY形式
                    $year = $matches[3];
                    $month = str_pad($matches[1], 2, '0', STR_PAD_LEFT);
                    $day = str_pad($matches[2], 2, '0', STR_PAD_LEFT);
                }
            } else if (count($matches) == 3) {
                // MM/DD形式（今年として扱う）
                $year = date('Y');
                $month = str_pad($matches[1], 2, '0', STR_PAD_LEFT);
                $day = str_pad($matches[2], 2, '0', STR_PAD_LEFT);
            }
            
            // 日付の妥当性をチェック
            if (checkdate($month, $day, $year)) {
                return sprintf('%04d-%02d-%02d', $year, $month, $day);
            }
        }
    }
    
    // パースできない場合は空文字を返す
    return '';
}

/**
 * データベース行を注文データに変換するAForms完全対応版関数
 */
function convert_db_row_to_order_aforms_complete($row) {
    try {
        if (empty($row['id'])) {
            throw new Exception('IDが空です');
        }
        
        // AForms完全対応の顧客情報抽出
        $customer_info = extract_customer_info_aforms_complete($row['content']);
        
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
        
        // 顧客名の決定（AForms抽出を最優先）
        $customer_name = '';
        if (!empty($customer_info['customer'])) {
            $customer_name = $customer_info['customer'];
        } elseif (!empty($row['customer'])) {
            $customer_name = $row['customer'];
        } else {
            $customer_name = '顧客_' . $row['id'];
        }
        
        // お届け希望日を抽出
        $delivery_hope_date = extract_delivery_hope_date($row['content']);
        
        // 実際の備考欄データを取得（フォームの備考欄のみ、お届け希望日は除外）
        $actual_remarks = extract_actual_remarks($row['content']);
        
        // 顧客詳細情報を別途保存
        $customer_details = [
            'email' => $customer_info['email'] ?? '',
            'phone' => $customer_info['phone'] ?? '',
            'address' => $customer_info['address'] ?? '',
            'furigana' => $customer_info['furigana'] ?? ''
        ];
        
        return [
            "注文ID" => "#" . str_pad($row['id'], 4, '0', STR_PAD_LEFT),
            "顧客名" => $customer_name,
            "会社名" => $customer_info['company'] ?? '',
            "注文日" => $created_date,
            "納品日" => $delivery_hope_date, // お届け希望日を納品日に設定
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
            "備考" => $actual_remarks,
            "顧客詳細" => $customer_details,
            // デバッグ・検証用の追加情報
            "_db_id" => $row['id'],
            "_original_customer" => $row['customer'] ?? null,
            "_form_title" => $row['formTitle'] ?? null,
            "_aforms_extracted" => $customer_info['_extraction_method'] === 'aforms_attrs',
            "_aforms_attrs_found" => strpos($row['content'] ?? '', '"attrs"') !== false,
            "_extraction_method" => $customer_info['_extraction_method'],
            "_extraction_details" => $customer_info['_extraction_details'],
            "_has_remarks" => !empty($actual_remarks)  // 備考ありフラグ
        ];
        
    } catch (Exception $e) {
        log_debug('データ変換エラー詳細（AForms完全対応版）', [
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
    return 'ポリエステル スカーフ';
}

log_debug('kiryu-factory AForms完全対応版API処理完了');
?>