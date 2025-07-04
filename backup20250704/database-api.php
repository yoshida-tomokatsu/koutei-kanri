<?php
/**
 * データベースAPI - 工程管理システム用（AForms対応修正版）
 */

// エラーログ設定
error_reporting(0);  // エラー出力を完全に無効化
ini_set('display_errors', 0);  // エラー表示を無効化
ini_set('log_errors', 0);  // ログ出力も無効化

// ヘッダー設定
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// プリフライトリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// データベース設定（環境に合わせて変更してください）
define('DB_HOST', 'localhost');
define('DB_NAME', 'factory0328_wp2');  // 元のデータベース名に戻す
define('DB_USER', 'factory0328_wp2');  // 元のユーザー名に戻す
define('DB_PASS', 'ctwjr3mmf5');       // 元のパスワードに戻す
define('DB_CHARSET', 'utf8mb4');

// レスポンス送信関数
function send_response($success, $message, $data = []) {
    // 出力バッファをクリア
    if (ob_get_level()) {
        ob_clean();
    }
    
    $response = array_merge([
        'success' => $success,
        'message' => $message,
        'timestamp' => date('c'),
        'api_version' => '2.1.0-aforms-fixed'
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
        // 他のファイルからincludeされた場合はエラーを投げる
        if ($_SERVER['REQUEST_METHOD'] === 'INCLUDE_ONLY') {
            throw $e;
        }
        send_response(false, 'データベース接続に失敗しました: ' . $e->getMessage());
        return null;
    }
}

// メイン処理（他のファイルからincludeされた場合はスキップ）
if ($_SERVER['REQUEST_METHOD'] !== 'INCLUDE_ONLY') {
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
                
            case 'test_aforms_extraction':
                handle_test_aforms_extraction();
                break;
                
            default:
                send_response(false, '無効なアクションです', [
                    'available_actions' => ['get_orders', 'update_order', 'test_connection', 'get_orders_count', 'debug_data', 'fix_data', 'test_aforms_extraction']
                ]);
        }
        
    } catch (Exception $e) {
        send_response(false, 'システムエラー: ' . $e->getMessage());
    }
}

/**
 * 注文データを取得
 */
function handle_get_orders() {
    $pdo = get_database_connection();
    
    try {
        $limit = (int)($_GET['limit'] ?? 999999999);  // 実質無制限
        $page = max(1, (int)($_GET['page'] ?? 1));
        
        // 除外するformTitleを定義
        $excluded_forms = ['サンプル請求', 'お問い合わせ'];
        $excluded_placeholders = implode(',', array_fill(0, count($excluded_forms), '?'));
        
        // limitが大きすぎる場合は制限なしで全件取得
        if ($limit >= 999999999) {
            $sql = "SELECT * FROM wp_wqorders WHERE id IS NOT NULL AND formTitle NOT IN ($excluded_placeholders) ORDER BY id DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($excluded_forms);
        } else {
            $offset = ($page - 1) * $limit;
            $sql = "SELECT * FROM wp_wqorders WHERE id IS NOT NULL AND formTitle NOT IN ($excluded_placeholders) ORDER BY id DESC LIMIT ? OFFSET ?";
            $stmt = $pdo->prepare($sql);
            $params = array_merge($excluded_forms, [$limit, $offset]);
            $stmt->execute($params);
        }
        
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
                'has_more' => false  // 全件取得なのでfalse
            ]
        ];
        
        if (!empty($conversion_errors)) {
            $response_data['conversion_errors'] = $conversion_errors;
        }
        
        send_response(true, '注文データを取得しました', $response_data);
        
    } catch (PDOException $e) {
        send_response(false, 'データ取得に失敗しました: ' . $e->getMessage());
    } catch (Exception $e) {
        send_response(false, 'システムエラー: ' . $e->getMessage());
    }
}

/**
 * AFormsデータ抽出テスト
 */
function handle_test_aforms_extraction() {
    $pdo = get_database_connection();
    
    try {
        $limit = (int)($_GET['limit'] ?? 999999999);  // 実質無制限
        
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT :limit");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        
        $test_results = [];
        foreach ($rows as $row) {
            $customer_info = extract_customer_info_aforms($row['content']);
            $test_results[] = [
                'id' => $row['id'],
                'raw_customer' => $row['customer'],
                'formTitle' => $row['formTitle'],
                'extracted_customer' => $customer_info['customer'],
                'extracted_company' => $customer_info['company'],
                'extracted_email' => $customer_info['email'],
                'extracted_phone' => $customer_info['phone'],
                'extracted_address' => $customer_info['address'],
                'content_preview' => substr($row['content'] ?? '', 0, 300)
            ];
        }
        
        send_response(true, 'AForms抽出テスト完了', [
            'test_results' => $test_results,
            'count' => count($test_results)
        ]);
        
    } catch (Exception $e) {
        send_response(false, 'AForms抽出テストエラー: ' . $e->getMessage());
    }
}

/**
 * デバッグデータを取得
 */
function handle_debug_data() {
    $pdo = get_database_connection();
    
    try {
        $limit = (int)($_GET['limit'] ?? 999999999);  // 実質無制限
        
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
            
            $customer_info = extract_customer_info_aforms($row['content']);
            
            $debug_info[] = [
                'id' => $row['id'],
                'customer' => $row['customer'],
                'formTitle' => $row['formTitle'],
                'created' => $row['created'],
                'content_is_json' => is_array($content_data),
                'content_error' => $content_error,
                'content_keys' => is_array($content_data) ? array_keys($content_data) : null,
                'attrs_count' => (is_array($content_data) && isset($content_data['attrs'])) ? count($content_data['attrs']) : 0,
                'extracted_customer' => $customer_info['customer'],
                'extracted_company' => $customer_info['company'],
                'extracted_email' => $customer_info['email'],
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
    // 出力バッファをクリア（HTMLエラーを防ぐ）
    if (ob_get_level()) {
        ob_clean();
    }
    
    try {
        $pdo = get_database_connection();
        if (!$pdo) {
            throw new Exception('データベース接続に失敗しました');
        }
        
        // 除外するformTitleを定義
        $excluded_forms = ['サンプル請求', 'お問い合わせ'];
        $excluded_placeholders = implode(',', array_fill(0, count($excluded_forms), '?'));
        
        $sql = "SELECT COUNT(*) as count FROM wp_wqorders WHERE formTitle NOT IN ($excluded_placeholders)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($excluded_forms);
        
        if (!$stmt) {
            throw new Exception('SQLクエリの実行に失敗しました');
        }
        
        $count_result = $stmt->fetch();
        if (!$count_result) {
            throw new Exception('クエリ結果の取得に失敗しました');
        }
        
        send_response(true, '総件数取得成功', [
            'total_records' => (int)$count_result['count']  // キー名を統一
        ]);
        
    } catch (PDOException $e) {
        send_response(false, 'データベースエラー: ' . $e->getMessage());
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
        
        // 顧客情報を抽出（AForms対応版を使用）
        $customer_info = extract_customer_info_aforms($row['content']);
        
        // 顧客名の決定
        $customer_name = '';
        if (!empty($customer_info['customer'])) {
            $customer_name = $customer_info['customer'];
        } elseif (!empty($row['customer'])) {
            $customer_name = $row['customer'];
        } else {
            $customer_name = '顧客_' . $row['id'];
        }
        
        // created日付をフォーマット（日付と時間を含む）
        $created_date = '';
        $created_time = '';
        if (!empty($row['created'])) {
            if (is_numeric($row['created'])) {
                $timestamp = (int)$row['created'];
                if ($timestamp > 0) {
                    $created_date = date('Y/m/d', $timestamp);
                    $created_time = date('H:i', $timestamp);
                }
            } else {
                $timestamp = strtotime($row['created']);
                if ($timestamp !== false) {
                    $created_date = date('Y/m/d', $timestamp);
                    $created_time = date('H:i', $timestamp);
                }
            }
        }
        
        if (empty($created_date)) {
            $created_date = date('Y/m/d');
            $created_time = date('H:i');
        }
        
        // カテゴリを判定
        $category = determine_category($row['formTitle'], $customer_info);
        
        // お届け希望日を抽出
        $delivery_hope_date = extract_delivery_hope_date($row['content']);
        
        // 実際の備考欄データを取得（フォームの備考欄のみ、お届け希望日は除外）
        $actual_remarks = extract_actual_remarks($row['content']);
        
        // 制作事例掲載許可を取得
        $publication_permission = extract_publication_permission($row['content']);
        
        // 顧客詳細情報を別途保存
        $customer_details = [
            'email' => $customer_info['email'] ?? '',
            'phone' => $customer_info['phone'] ?? '',
            'address' => $customer_info['address'] ?? '',
            'furigana' => $customer_info['furigana'] ?? ''
        ];
        
        // 注文データの構造に変換
        $order = [
            "注文ID" => "#" . str_pad($row['id'], 4, '0', STR_PAD_LEFT),
            "顧客名" => $customer_name,
            "会社名" => $customer_info['company'] ?? '',
            "注文日" => $created_date,
            "注文時間" => $created_time,
            "納品日" => $delivery_hope_date, // お届け希望日を納品日に設定
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
            "備考" => $actual_remarks,
            "制作事例掲載許可" => $publication_permission,
            "顧客詳細" => $customer_details,
            // データベース用の追加情報
            "_db_id" => $row['id'],
            "_form_id" => $row['formId'] ?? null,
            "_total" => $row['total'] ?? null,
            "_aforms_extracted" => true,  // AForms抽出済みフラグ
            "_has_remarks" => !empty($actual_remarks)  // 備考ありフラグ
        ];
        
        return $order;
        
    } catch (Exception $e) {
        throw new Exception('データ変換エラー: ' . $e->getMessage());
    }
}

/**
 * AForms形式のattrsから顧客情報を抽出する改良版関数
 */
function extract_customer_info_aforms($content_json) {
    $customer_info = [
        'customer' => '',
        'company' => '',
        'email' => '',
        'phone' => '',
        'address' => '',
        'furigana' => ''
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
            foreach ($content['attrs'] as $attr) {
                if (!isset($attr['name']) || !isset($attr['value'])) {
                    continue;
                }
                
                $name = trim($attr['name']);
                $value = trim($attr['value']);
                
                if (empty($value)) {
                    continue;
                }
                
                // AForms特有のフィールド名に完全対応
                // 顧客名の抽出（完全一致優先、その後正規表現）
                if ($name === 'お名前' || $name === '氏名' || $name === 'name') {
                    $customer_info['customer'] = $value;
                } elseif (empty($customer_info['customer']) && preg_match('/名前|氏名|お名前|name/i', $name)) {
                    $customer_info['customer'] = $value;
                }
                
                // フリガナの抽出
                elseif ($name === 'フリガナ' || $name === 'ふりがな' || $name === 'furigana') {
                    $customer_info['furigana'] = $value;
                } elseif (empty($customer_info['furigana']) && preg_match('/フリガナ|ふりがな|カナ|furigana/i', $name)) {
                    $customer_info['furigana'] = $value;
                }
                
                // 会社名の抽出（完全一致優先）
                elseif ($name === '会社名・団体名' || $name === '会社名' || $name === '団体名' || $name === 'company') {
                    $customer_info['company'] = $value;
                } elseif (empty($customer_info['company']) && preg_match('/会社|団体|企業|法人|company|organization/i', $name)) {
                    $customer_info['company'] = $value;
                }
                
                // メールアドレスの抽出（完全一致優先）
                elseif ($name === 'メールアドレス' || $name === 'email' || $name === 'mail') {
                    $customer_info['email'] = $value;
                } elseif (empty($customer_info['email']) && preg_match('/メール|email|mail|e-mail/i', $name)) {
                    $customer_info['email'] = $value;
                }
                
                // 電話番号の抽出（完全一致優先）
                elseif ($name === '電話番号' || $name === 'tel' || $name === 'phone') {
                    $customer_info['phone'] = $value;
                } elseif (empty($customer_info['phone']) && preg_match('/電話|tel|phone|TEL/i', $name)) {
                    $customer_info['phone'] = $value;
                }
                
                // 住所の抽出（完全一致優先）
                elseif ($name === '住所' || $name === 'address') {
                    $customer_info['address'] = $value;
                } elseif (empty($customer_info['address']) && preg_match('/住所|address|所在地/i', $name)) {
                    $customer_info['address'] = $value;
                }
            }
        }
        
        // 他の形式での情報も確認（従来の形式との互換性）
        if (isset($content['customer']) && empty($customer_info['customer'])) {
            $customer_info['customer'] = trim($content['customer']);
        }
        
        if (isset($content['company']) && empty($customer_info['company'])) {
            $customer_info['company'] = trim($content['company']);
        }
        
        if (isset($content['email']) && empty($customer_info['email'])) {
            $customer_info['email'] = trim($content['email']);
        }
        
    } catch (Exception $e) {
        // JSONパースエラーの場合はそのまま返す
        error_log('AForms抽出エラー: ' . $e->getMessage() . ' | Content: ' . substr($content_json, 0, 200));
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
 * 制作事例掲載許可を抽出
 */
function extract_publication_permission($content_json) {
    if (empty($content_json)) {
        return 'しない'; // デフォルト値
    }
    
    try {
        $content = json_decode($content_json, true);
        if (!is_array($content) || !isset($content['attrs']) || !is_array($content['attrs'])) {
            return 'しない';
        }
        
        foreach ($content['attrs'] as $attr) {
            if (!isset($attr['name']) || !isset($attr['value'])) {
                continue;
            }
            
            $name = trim($attr['name']);
            $value = trim($attr['value']);
            
            // 制作事例掲載許可フィールドを検索
            if ($name === '制作事例掲載許可') {
                // 旧形式の値を新形式に変換
                if ($value === '掲載を許可しない') {
                    return 'しない';
                } elseif ($value === '掲載を許可する') {
                    return 'する';
                }
                return $value;
            }
        }
        
    } catch (Exception $e) {
        error_log('制作事例掲載許可抽出エラー: ' . $e->getMessage());
    }
    
    return 'しない'; // デフォルト値
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
 * 従来のextract_customer_info関数（後方互換性のため）
 */
function extract_customer_info($content_json) {
    return extract_customer_info_aforms($content_json);
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
        $sql = "SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT 999999999";  // 実質無制限
        $stmt = $pdo->query($sql);
        $samples = $stmt->fetchAll();
        
        // 解析テスト（AForms対応版）
        $parse_tests = [];
        foreach ($samples as $sample) {
            $customer_info = extract_customer_info_aforms($sample['content']);
            $parse_tests[] = [
                'id' => $sample['id'],
                'raw_customer' => $sample['customer'] ?? null,
                'form_title' => $sample['formTitle'] ?? null,
                'extracted' => $customer_info,
                'content_preview' => substr($sample['content'] ?? '', 0, 100) . '...'
            ];
        }
        
        send_response(true, 'データベース接続成功（AForms対応版）', [
            'table_columns' => $columns,
            'record_count' => $count_result['count'],
            'database' => DB_NAME,
            'host' => DB_HOST,
            'parse_tests' => $parse_tests,
            'aforms_support' => true
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