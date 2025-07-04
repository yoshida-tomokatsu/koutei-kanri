<?php
/**
 * 編集可能注文データAPI
 * wp_wqorders_editable（編集用テーブル）を使用したAPI
 */

// エラー出力を有効化（デバッグ用）
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/editable-api-errors.log');

// SYSTEM_ACCESS_ALLOWED定数を定義
define('SYSTEM_ACCESS_ALLOWED', true);

// 設定ファイルの読み込み
require_once 'config.php';

// セキュリティヘッダーの設定
setSecurityHeaders();

// database-api.phpのsend_response関数を定義
function send_response($success, $message, $data = []) {
    // 出力バッファをクリア
    if (ob_get_level()) {
        ob_clean();
    }
    
    $response = [
        'success' => $success,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

// convert_db_row_to_order関数の定義
function convert_db_row_to_order($row) {
    // contentフィールドをJSONとして解析
    $content = json_decode($row['content'], true) ?? [];
    
    // 基本的な注文情報
    $order = [
        'id' => (int)$row['id'],
        'orderId' => (int)$row['id'],
        'formTitle' => $row['formTitle'] ?? '',
        'customer' => $row['customer'] ?? '',
        'created' => $row['created'] ?? '',
        'content' => $content  // 元のcontentも保持
    ];
    
    // content内のattrsからフィールドを抽出
    if (isset($content['attrs']) && is_array($content['attrs'])) {
        foreach ($content['attrs'] as $attr) {
            if (isset($attr['name']) && isset($attr['value'])) {
                $order[$attr['name']] = $attr['value'];
            }
        }
    }
    
    // 表示用のフィールドマッピング（後方互換性のため）
    $order['顧客名'] = $order['顧客名'] ?? $order['customerName'] ?? $order['お名前'] ?? $row['customer'] ?? '';
    $order['会社名'] = $order['会社名'] ?? $order['companyName'] ?? $order['会社名・団体名'] ?? '';
    $order['納品日'] = $order['納品日'] ?? $order['deliveryDate'] ?? $order['お届け希望日'] ?? '';
    $order['カテゴリ'] = $order['カテゴリ'] ?? $order['category'] ?? '';
    $order['制作事例掲載許可'] = $order['制作事例掲載許可'] ?? $order['publicationPermission'] ?? 'しない';
    
    // 注文日時の処理
    if (!empty($row['created'])) {
        $timestamp = is_numeric($row['created']) ? (int)$row['created'] : strtotime($row['created']);
        if ($timestamp > 0) {
            $order['注文日'] = date('Y/m/d', $timestamp);
            $order['注文時間'] = date('H:i', $timestamp);
        }
    }
    
    // 注文IDの正規化
    $order['注文ID'] = '#' . str_pad($row['id'], 4, '0', STR_PAD_LEFT);
    
    return $order;
}

// database-api.phpの代わりに独自の関数を使用
function get_database_connection() {
    return getSecureDBConnection();
}

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ログ有効化（デバッグ用）
define('ENABLE_ALL_LOGS', true);

// デバッグ用ログ関数
function debugLog($message) { 
    error_log('[DEBUG] ' . $message);
    // JSONレスポンスに影響しないようにログファイルのみに出力
}
function infoLog($message) { 
    if (ENABLE_ALL_LOGS) error_log("[INFO] " . $message); 
}
function errorLog($message) { 
    if (ENABLE_ALL_LOGS) error_log("[ERROR] " . $message); 
}

// リクエスト処理
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// POSTリクエストの場合、リクエストボディからactionを取得
if ($method === 'POST') {
    $post_data = json_decode(file_get_contents('php://input'), true);
    if (isset($post_data['action'])) {
        $action = $post_data['action'];
    }
}

try {
    switch ($method) {
        case 'GET':
            if ($action === 'get_orders' || $action === 'get_editable_orders') {
                handle_get_editable_orders();
            } elseif ($action === 'get_orders_count') {
                handle_get_orders_count();
            } elseif ($action === 'sync_status') {
                handle_sync_status();
            } elseif ($action === 'debug_test') {
                handle_debug_test();
            } else {
                send_response(false, '無効なアクションです');
            }
            break;
            
        case 'POST':
            if ($action === 'update_field') {
                handle_update_editable_field();
            } elseif ($action === 'update_content') {
                handle_update_content();
            } elseif ($action === 'sync_data') {
                handle_sync_data();
            } elseif ($action === 'direct_sync_1313') {
                handle_direct_sync_1313();
            } elseif ($action === 'fix_sync_1313') {
                handle_fix_sync_1313();
            } elseif ($action === 'copy_full_table') {
                handle_copy_full_table();
            } elseif ($action === 'debug_check_order') {
                handle_debug_check_order();
            } else {
                send_response(false, '無効なアクションです');
            }
            break;
            
        default:
            send_response(false, 'サポートされていないHTTPメソッドです');
    }
} catch (Exception $e) {
    errorLog('Editable Orders API Error: ' . $e->getMessage());
    send_response(false, 'サーバーエラーが発生しました: ' . $e->getMessage());
}

/**
 * 編集可能な注文一覧を取得
 */
function handle_get_editable_orders() {
    try {
        $limit = max(1, min(1000, (int)($_GET['limit'] ?? 100)));  // 1-1000件の範囲で制限
        $page = max(1, (int)($_GET['page'] ?? 1));
        
        debugLog("編集可能注文取得開始: limit={$limit}, page={$page}");
        
        $pdo = get_database_connection();
        debugLog("データベース接続成功");
        
        // データベース接続確認
        if (!$pdo) {
            throw new Exception('データベース接続がnullです');
        }
        
        // 総レコード数を取得（表示対象のみ）
        $count_sql = "SELECT COUNT(*) as total FROM wp_wqorders_editable WHERE is_display_target = 1";
        debugLog("総レコード数取得SQL: " . $count_sql);
        $count_stmt = $pdo->prepare($count_sql);
        $count_stmt->execute();
        $total_records = intval($count_stmt->fetch(PDO::FETCH_ASSOC)['total']);
        debugLog("総レコード数: " . $total_records);
        
        // ページネーション計算
        $offset = ($page - 1) * $limit;
        $total_pages = ceil($total_records / $limit);
        
        debugLog("ページネーション設定: offset={$offset}, total_pages={$total_pages}");
        
        // 編集用テーブルからデータを取得（表示対象のみ、ページネーション適用）
        $sql = "
            SELECT 
                id, formTitle, customer, created, content,
                original_id, is_edited, last_sync_at, edited_at, edited_by, is_display_target
            FROM wp_wqorders_editable 
            WHERE is_display_target = 1
            ORDER BY id DESC 
            LIMIT :limit OFFSET :offset
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        debugLog("取得されたレコード数: " . count($rows));
        
        // 各注文を変換
        $orders = [];
        foreach ($rows as $row) {
            try {
                $order = convert_db_row_to_order($row);
                
                // 編集情報を追加
                $order['_editable_info'] = [
                    'original_id' => $row['original_id'],
                    'is_edited' => (bool)$row['is_edited'],
                    'last_sync_at' => $row['last_sync_at'],
                    'edited_at' => $row['edited_at'],
                    'edited_by' => $row['edited_by']
                ];
                
                $orders[] = $order;
            } catch (Exception $e) {
                errorLog('注文変換エラー ID:' . ($row['id'] ?? 'unknown') . ' - ' . $e->getMessage());
                continue;
            }
        }
        
        // レスポンスデータ（スマートページネーション対応）
        $response_data = [
            'orders' => $orders,
            'pagination' => [
                'total' => $total_records,
                'current_page' => $page,
                'per_page' => $limit,
                'total_pages' => $total_pages,
                'has_next_page' => $page < $total_pages,
                'has_prev_page' => $page > 1,
                'offset' => $offset,
                'records_in_page' => count($orders)
            ],
            'table_info' => [
                'source_table' => 'wp_wqorders_editable',
                'is_editable' => true,
                'filter_applied' => 'is_display_target = 1'
            ]
        ];
        
        send_response(true, "編集可能注文データを取得しました (ページ {$page}/{$total_pages}, {$total_records}件中" . count($orders) . "件)", $response_data);
        
    } catch (Exception $e) {
        errorLog('編集可能注文取得エラー: ' . $e->getMessage());
        errorLog('エラー詳細: ' . $e->getTraceAsString());
        send_response(false, 'データ取得に失敗しました: ' . $e->getMessage());
    }
}

/**
 * 総レコード数のみを取得
 */
function handle_get_orders_count() {
    // 出力バッファをクリア（HTMLエラーを防ぐ）
    if (ob_get_level()) {
        ob_clean();
    }
    
    try {
        debugLog("総レコード数取得開始");
        
        $pdo = get_database_connection();
        if (!$pdo) {
            throw new Exception('データベース接続に失敗しました');
        }
        
        debugLog("データベース接続成功");
        
        // 総レコード数を取得（表示対象のみ）
        $count_sql = "SELECT COUNT(*) as total FROM wp_wqorders_editable WHERE is_display_target = 1";
        debugLog("総レコード数取得SQL: " . $count_sql);
        
        $count_stmt = $pdo->prepare($count_sql);
        if (!$count_stmt) {
            throw new Exception('SQLクエリの準備に失敗しました');
        }
        
        $count_stmt->execute();
        $result = $count_stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            throw new Exception('クエリ結果の取得に失敗しました');
        }
        
        $total_records = intval($result['total']);
        debugLog("総レコード数: " . $total_records);
        
        $response_data = [
            'total_records' => $total_records,
            'table_info' => [
                'source_table' => 'wp_wqorders_editable',
                'is_editable' => true,
                'filter_applied' => 'is_display_target = 1'
            ]
        ];
        
        send_response(true, "総レコード数を取得しました: {$total_records}件", $response_data);
        
    } catch (PDOException $e) {
        errorLog('PDOエラー: ' . $e->getMessage());
        send_response(false, 'データベースエラー: ' . $e->getMessage());
    } catch (Exception $e) {
        errorLog('総レコード数取得エラー: ' . $e->getMessage());
        send_response(false, '総レコード数の取得に失敗しました: ' . $e->getMessage());
    }
}

/**
 * 編集可能テーブルのフィールドを更新
 */
function handle_update_editable_field() {
    // 出力バッファをクリア
    if (ob_get_level()) {
        ob_clean();
    }
    
    debugLog("=== handle_update_editable_field 開始 ===");
    
    // POSTデータの取得
    $raw_input = file_get_contents('php://input');
    debugLog("Raw input: " . $raw_input);
    
    $input = json_decode($raw_input, true);
    debugLog("Decoded input: " . print_r($input, true));
    
    $order_id = $input['order_id'] ?? null;
    $field_name = $input['field_name'] ?? null;
    $field_value = $input['field_value'] ?? null;
    $edited_by = $input['edited_by'] ?? 'system';
    
    debugLog("フィールド更新開始: order_id={$order_id}, field_name={$field_name}, field_value={$field_value}");
    
    if (!$order_id || !$field_name) {
        send_response(false, '必要なパラメータが不足しています');
        return;
    }
    
    try {
        debugLog("データベース接続開始");
        $pdo = get_database_connection();
        
        if (!$pdo) {
            debugLog("データベース接続失敗: PDOが null");
            send_response(false, 'データベース接続に失敗しました');
            return;
        }
        
        debugLog("データベース接続成功");
        
        // テーブルが存在するかチェック
        $check_table = $pdo->query("SHOW TABLES LIKE 'wp_wqorders_editable'");
        if (!$check_table || $check_table->rowCount() == 0) {
            debugLog("テーブル wp_wqorders_editable が存在しません");
            send_response(false, 'エラー: 編集テーブルが存在しません');
            return;
        }
        
        debugLog("テーブル確認成功");
        
        // 現在のデータを取得してJSONフィールド名を確認
        $sql = "SELECT content FROM wp_wqorders_editable WHERE id = :order_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':order_id' => $order_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            send_response(false, '指定された注文が見つかりません');
            return;
        }
        
        // JSONを解析してフィールド名を確認
        $content = json_decode($row['content'], true) ?? [];
        debugLog("現在のcontentデータ: " . print_r($content, true));
        
        // attrsフィールドの確認
        if (isset($content['attrs']) && is_array($content['attrs'])) {
            debugLog("attrsフィールドの内容:");
            foreach ($content['attrs'] as $index => $attr) {
                debugLog("  [{$index}] name: " . ($attr['name'] ?? 'null') . ", value: " . ($attr['value'] ?? 'null'));
            }
        }
        
        // 直接更新可能なフィールド
        $direct_fields = ['formTitle', 'customer', 'status'];
        
        if (in_array($field_name, $direct_fields)) {
            // 直接更新可能なフィールド
            $sql = "
                UPDATE wp_wqorders_editable SET 
                    {$field_name} = :field_value,
                    is_edited = TRUE,
                    edited_at = NOW(),
                    edited_by = :edited_by
                WHERE id = :order_id
            ";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':field_value' => $field_value,
                ':edited_by' => $edited_by,
                ':order_id' => $order_id
            ]);
            
        } else {
            // contentフィールド内のJSONを更新
            
            // フィールドを更新（attrs配列内を検索）
            $field_updated = false;
            if (isset($content['attrs']) && is_array($content['attrs'])) {
                foreach ($content['attrs'] as &$attr) {
                    if (isset($attr['name']) && $attr['name'] === $field_name) {
                        debugLog("フィールド '{$field_name}' を更新: {$attr['value']} -> {$field_value}");
                        $attr['value'] = $field_value;
                        $field_updated = true;
                        break;
                    }
                }
            }
            
            // attrsに存在しない場合は新規追加
            if (!$field_updated) {
                debugLog("フィールド '{$field_name}' が存在しないため新規追加");
                if (!isset($content['attrs'])) {
                    $content['attrs'] = [];
                }
                $content['attrs'][] = [
                    'name' => $field_name,
                    'value' => $field_value
                ];
                $field_updated = true;
            }
            
            // 更新されたJSONを保存
            $update_sql = "
                UPDATE wp_wqorders_editable SET 
                    content = :content,
                    is_edited = TRUE,
                    edited_at = NOW(),
                    edited_by = :edited_by
                WHERE id = :order_id
            ";
            
            $stmt = $pdo->prepare($update_sql);
            $stmt->execute([
                ':content' => json_encode($content, JSON_UNESCAPED_UNICODE),
                ':edited_by' => $edited_by,
                ':order_id' => $order_id
            ]);
            
            debugLog("JSONフィールド更新完了");
        }
        
        if ($stmt->rowCount() > 0) {
            debugLog("フィールド更新成功: order_id={$order_id}, field_name={$field_name}");
            send_response(true, 'フィールドを更新しました', [
                'order_id' => $order_id,
                'field_name' => $field_name,
                'field_value' => $field_value,
                'edited_by' => $edited_by,
                'edited_at' => date('Y-m-d H:i:s')
            ]);
        } else {
            // デバッグ用：なぜ更新できなかったかを詳しく調査
            debugLog("更新失敗 - 詳細調査開始: order_id={$order_id}, field_name={$field_name}");
            
            // レコードが存在するかチェック
            $check_sql = "SELECT id, original_id, is_edited FROM wp_wqorders_editable WHERE id = :order_id";
            $check_stmt = $pdo->prepare($check_sql);
            $check_stmt->execute([':order_id' => $order_id]);
            $existing_record = $check_stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existing_record) {
                debugLog("レコード存在確認: " . print_r($existing_record, true));
                send_response(false, '更新は実行されましたが、変更がありませんでした', [
                    'existing_record' => $existing_record,
                    'attempted_update' => [
                        'order_id' => $order_id,
                        'field_name' => $field_name,
                        'field_value' => $field_value
                    ]
                ]);
            } else {
                debugLog("レコードが存在しません: order_id={$order_id}");
                send_response(false, '更新対象のレコードが見つかりません');
            }
        }
        
    } catch (Exception $e) {
        errorLog('フィールド更新エラー: ' . $e->getMessage());
        send_response(false, 'フィールド更新に失敗しました: ' . $e->getMessage());
    }
}

/**
 * contentフィールドを直接更新
 */
function handle_update_content() {
    try {
        $post_data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($post_data['order_id']) || !isset($post_data['content'])) {
            send_response(false, 'order_idとcontentが必要です');
            return;
        }
        
        $order_id = (int)$post_data['order_id'];
        $content_data = $post_data['content'];
        $edited_by = $post_data['edited_by'] ?? 'system';
        
        debugLog("contentフィールド更新開始: order_id={$order_id}");
        
        $pdo = get_database_connection();
        if (!$pdo) {
            send_response(false, 'データベース接続に失敗しました');
            return;
        }
        
        // 現在のcontentを取得
        $sql = "SELECT content FROM wp_wqorders_editable WHERE id = :order_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':order_id' => $order_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            send_response(false, '指定された注文が見つかりません');
            return;
        }
        
        // 送信されたcontentで完全に置き換え
        $updated_content = json_encode($content_data, JSON_UNESCAPED_UNICODE);
        
        debugLog("更新前のcontent: " . substr($row['content'], 0, 200) . "...");
        debugLog("更新後のcontent: " . substr($updated_content, 0, 200) . "...");
        
        $update_sql = "
            UPDATE wp_wqorders_editable SET 
                content = :content,
                is_edited = TRUE,
                edited_at = NOW(),
                edited_by = :edited_by
            WHERE id = :order_id
        ";
        
        $stmt = $pdo->prepare($update_sql);
        $result = $stmt->execute([
            ':content' => $updated_content,
            ':edited_by' => $edited_by,
            ':order_id' => $order_id
        ]);
        
        if ($result) {
            // 変更が実際に行われたかチェック
            $affected_rows = $stmt->rowCount();
            debugLog("contentフィールド更新成功: order_id={$order_id}, affected_rows={$affected_rows}");
            
            // 更新後のデータを確認
            $verify_sql = "SELECT content FROM wp_wqorders_editable WHERE id = :order_id";
            $verify_stmt = $pdo->prepare($verify_sql);
            $verify_stmt->execute([':order_id' => $order_id]);
            $verify_row = $verify_stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($verify_row) {
                debugLog("更新後のcontent確認: " . substr($verify_row['content'], 0, 200) . "...");
                send_response(true, 'contentフィールドを更新しました', [
                    'affected_rows' => $affected_rows,
                    'updated_content_preview' => substr($verify_row['content'], 0, 200)
                ]);
            } else {
                debugLog("更新後のデータ確認に失敗: order_id={$order_id}");
                send_response(false, '更新後のデータ確認に失敗しました');
            }
        } else {
            debugLog("contentフィールド更新失敗: order_id={$order_id}");
            send_response(false, 'contentフィールドの更新に失敗しました');
        }
        
    } catch (Exception $e) {
        errorLog('contentフィールド更新エラー: ' . $e->getMessage());
        send_response(false, 'contentフィールド更新エラー: ' . $e->getMessage());
    }
}

/**
 * 特定の注文IDのデータを確認（デバッグ用）
 */
function handle_debug_check_order() {
    try {
        $post_data = json_decode(file_get_contents('php://input'), true);
        $order_id = (int)($post_data['order_id'] ?? 0);
        
        if (!$order_id) {
            send_response(false, 'order_idが必要です');
            return;
        }
        
        $pdo = get_database_connection();
        
        // 編集用テーブルから確認
        $sql = "SELECT * FROM wp_wqorders_editable WHERE id = :order_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':order_id' => $order_id]);
        $editable_row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // 元テーブルから確認
        $sql = "SELECT * FROM wp_wqorders WHERE id = :order_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':order_id' => $order_id]);
        $original_row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $response_data = [
            'order_id' => $order_id,
            'editable_exists' => !empty($editable_row),
            'original_exists' => !empty($original_row),
            'editable_data' => $editable_row,
            'original_data' => $original_row,
            'editable_content_preview' => $editable_row ? substr($editable_row['content'] ?? '', 0, 200) : null,
            'original_content_preview' => $original_row ? substr($original_row['content'] ?? '', 0, 200) : null
        ];
        
        send_response(true, 'データ確認完了', $response_data);
        
    } catch (Exception $e) {
        send_response(false, 'データ確認エラー: ' . $e->getMessage());
    }
}

/**
 * 同期状態を取得
 */
function handle_sync_status() {
    try {
        $pdo = get_database_connection();
        
        // テーブル統計
        $stats = [];
        
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM wp_wqorders");
        $stats['original_count'] = $stmt->fetch()['count'];
        
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM wp_wqorders_editable");
        $stats['editable_count'] = $stmt->fetch()['count'];
        
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM wp_wqorders_editable WHERE is_edited = TRUE");
        $stats['edited_count'] = $stmt->fetch()['count'];
        
        // 最新同期ログ
        $stmt = $pdo->query("
            SELECT * FROM wp_wqorders_sync_log 
            ORDER BY created_at DESC LIMIT 1
        ");
        $latest_sync = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // 同期が必要かチェック
        $needs_sync = $stats['original_count'] > $stats['editable_count'];
        
        $response_data = [
            'stats' => $stats,
            'latest_sync' => $latest_sync,
            'needs_sync' => $needs_sync,
            'sync_difference' => $stats['original_count'] - $stats['editable_count']
        ];
        
        send_response(true, '同期状態を取得しました', $response_data);
        
    } catch (Exception $e) {
        errorLog('同期状態取得エラー: ' . $e->getMessage());
        send_response(false, '同期状態の取得に失敗しました: ' . $e->getMessage());
    }
}

/**
 * データ同期を実行
 */
function handle_sync_data() {
    try {
        $pdo = get_database_connection();
        
        // 新規データを取得（編集用テーブルに存在しないもの）
        $sql = "
            SELECT o.* 
            FROM wp_wqorders o
            LEFT JOIN wp_wqorders_editable e ON o.id = e.original_id
            WHERE e.original_id IS NULL
            ORDER BY o.created DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $newRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $recordsAdded = 0;
        
        if (!empty($newRecords)) {
            debugLog('新規データ ' . count($newRecords) . '件を発見しました');
            
            // 新規データを編集用テーブルに挿入
            $insertSql = "
                INSERT INTO wp_wqorders_editable (
                    id, formTitle, customer, created, content,
                    original_id, is_edited, last_sync_at, is_display_target
                ) VALUES (
                    :id, :formTitle, :customer, :created, :content,
                    :original_id, FALSE, NOW(), :is_display_target
                )
            ";
            
            $insertStmt = $pdo->prepare($insertSql);
            
            foreach ($newRecords as $record) {
                try {
                    // 表示フラグを判定（サンプル請求・お問い合わせは非表示）
                    $isDisplayTarget = !isExcludedFormTitle($record['formTitle']);
                    
                    $insertStmt->execute([
                        ':id' => $record['id'],
                        ':formTitle' => $record['formTitle'] ?? '',
                        ':customer' => $record['customer'] ?? '',
                        ':created' => $record['created'] ?? date('Y-m-d H:i:s'),
                        ':content' => $record['content'] ?? '',
                        ':original_id' => $record['id'],
                        ':is_display_target' => $isDisplayTarget ? 1 : 0
                    ]);
                    $recordsAdded++;
                    debugLog('レコード挿入成功 ID:' . $record['id']);
                } catch (Exception $e) {
                    errorLog('レコード挿入エラー ID:' . $record['id'] . ' - ' . $e->getMessage());
                }
            }
        } else {
            debugLog('新規データはありませんでした');
        }
        
        send_response(true, "同期完了: {$recordsAdded}件追加", [
            'records_added' => $recordsAdded,
            'sync_type' => 'incremental',
            'sync_time' => date('Y-m-d H:i:s'),
            'total_checked' => count($newRecords)
        ]);
        
    } catch (Exception $e) {
        errorLog('データ同期エラー: ' . $e->getMessage());
        send_response(false, 'データ同期に失敗しました: ' . $e->getMessage());
    }
}

/**
 * 除外対象のフォームタイトルかどうかを判定
 */
function isExcludedFormTitle($formTitle) {
    if (empty($formTitle)) {
        return false;
    }
    
    $excludePatterns = [
        'サンプル請求',
        'お問い合わせ',
        'sample',
        'inquiry',
        'contact'
    ];
    
    $formTitleLower = mb_strtolower($formTitle);
    
    foreach ($excludePatterns as $pattern) {
        if (mb_strpos($formTitleLower, mb_strtolower($pattern)) !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * デバッグ用のテストエンドポイント
 */
function handle_debug_test() {
    try {
        $start_time = microtime(true);
        
        $pdo = get_database_connection();
        $db_connect_time = microtime(true);
        
        // テーブル存在確認
        $table_check = $pdo->query("SHOW TABLES LIKE 'wp_wqorders_editable'")->rowCount();
        $table_check_time = microtime(true);
        
        // テーブルが存在しない場合は作成
        if ($table_check == 0) {
            $create_table_sql = "
                CREATE TABLE wp_wqorders_editable (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    formTitle VARCHAR(255) DEFAULT '',
                    customer VARCHAR(255) DEFAULT '',
                    created DATETIME DEFAULT CURRENT_TIMESTAMP,
                    content LONGTEXT,
                    original_id INT,
                    is_edited BOOLEAN DEFAULT FALSE,
                    last_sync_at DATETIME,
                    edited_at DATETIME,
                    edited_by VARCHAR(100) DEFAULT 'system',
                    is_display_target BOOLEAN DEFAULT TRUE,
                    INDEX idx_original_id (original_id),
                    INDEX idx_is_display_target (is_display_target),
                    INDEX idx_is_edited (is_edited)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ";
            
            $pdo->exec($create_table_sql);
            $table_check = 1; // テーブル作成成功
        }
        
        // 総レコード数確認
        $total_stmt = $pdo->query("SELECT COUNT(*) as total FROM wp_wqorders_editable");
        $total_records = $total_stmt->fetch()['total'];
        $total_count_time = microtime(true);
        
        // データが存在しない場合は初期同期を実行
        if ($total_records == 0) {
            // wp_wqordersテーブルからデータを同期
            $sync_sql = "
                INSERT INTO wp_wqorders_editable 
                (id, formTitle, customer, created, content, original_id, is_display_target)
                SELECT 
                    id, formTitle, customer, created, content, id, 1
                FROM wp_wqorders
                ORDER BY id ASC
            ";
            
            $pdo->exec($sync_sql);
            
            // 同期後のレコード数を再取得
            $total_stmt = $pdo->query("SELECT COUNT(*) as total FROM wp_wqorders_editable");
            $total_records = $total_stmt->fetch()['total'];
        }
        
        // 表示対象レコード数確認
        $display_stmt = $pdo->query("SELECT COUNT(*) as total FROM wp_wqorders_editable WHERE is_display_target = 1");
        $display_records = $display_stmt->fetch()['total'];
        $display_count_time = microtime(true);
        
        // 特定の注文ID範囲を確認（1310-1320）
        $range_stmt = $pdo->query("
            SELECT id, formTitle, customer, is_display_target 
            FROM wp_wqorders_editable 
            WHERE id BETWEEN 1310 AND 1320 
            ORDER BY id ASC
        ");
        $range_data = $range_stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 最大IDと最小IDを確認
        $minmax_stmt = $pdo->query("SELECT MIN(id) as min_id, MAX(id) as max_id FROM wp_wqorders_editable");
        $minmax_data = $minmax_stmt->fetch();
        
        // サンプルデータ取得（5件）
        $sample_stmt = $pdo->query("SELECT id, formTitle, customer, is_display_target FROM wp_wqorders_editable ORDER BY id ASC LIMIT 5");
        $sample_data = $sample_stmt->fetchAll(PDO::FETCH_ASSOC);
        $sample_time = microtime(true);
        
        $end_time = microtime(true);
        
        $response_data = [
            'timing' => [
                'total_time' => round(($end_time - $start_time) * 1000, 2) . 'ms',
                'db_connect_time' => round(($db_connect_time - $start_time) * 1000, 2) . 'ms',
                'table_check_time' => round(($table_check_time - $db_connect_time) * 1000, 2) . 'ms',
                'total_count_time' => round(($total_count_time - $table_check_time) * 1000, 2) . 'ms',
                'display_count_time' => round(($display_count_time - $total_count_time) * 1000, 2) . 'ms',
                'sample_time' => round(($sample_time - $display_count_time) * 1000, 2) . 'ms'
            ],
            'database_info' => [
                'table_exists' => $table_check > 0,
                'total_records' => $total_records,
                'display_target_records' => $display_records,
                'sample_data_count' => count($sample_data),
                'id_range' => $minmax_data,
                'range_1310_1320_count' => count($range_data)
            ],
            'sample_data' => $sample_data,
            'range_data_1310_1320' => $range_data,
            'server_info' => [
                'php_version' => PHP_VERSION,
                'memory_usage' => memory_get_usage(true),
                'peak_memory' => memory_get_peak_usage(true)
            ]
        ];
        
        send_response(true, "デバッグテスト完了", $response_data);
        
    } catch (Exception $e) {
        errorLog('デバッグテストエラー: ' . $e->getMessage());
        send_response(false, 'デバッグテストに失敗しました: ' . $e->getMessage());
    }
}

/**
 * ID 1313の直接同期を実行
 */
function handle_direct_sync_1313() {
    try {
        $pdo = get_database_connection();
        
        // 1. 編集用テーブルでID 1313を確認
        $check_stmt = $pdo->prepare("SELECT COUNT(*) as count FROM wp_wqorders_editable WHERE id = 1313");
        $check_stmt->execute();
        $exists = $check_stmt->fetch()['count'] > 0;
        
        if ($exists) {
            send_response(true, "ID 1313は既に存在します", [
                'action' => 'no_sync_needed',
                'target_id' => 1313,
                'exists' => true
            ]);
            return;
        }
        
        // 2. 元テーブルからID 1313を取得
        $source_stmt = $pdo->prepare("SELECT * FROM wp_wqorders WHERE id = 1313");
        $source_stmt->execute();
        $source_data = $source_stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$source_data) {
            send_response(false, "ID 1313が元テーブル(wp_wqorders)に存在しません", [
                'action' => 'source_not_found',
                'target_id' => 1313
            ]);
            return;
        }
        
        // 3. 編集用テーブルに挿入（存在するカラムのみ使用）
        $insert_sql = "
            INSERT INTO wp_wqorders_editable 
            (id, formTitle, customer, created, content, original_id, is_edited, last_sync_at, is_display_target)
            VALUES 
            (:id, :formTitle, :customer, :created, :content, :original_id, FALSE, NOW(), :is_display_target)
        ";
        
        $insert_stmt = $pdo->prepare($insert_sql);
        
        // 表示フラグを判定
        $isDisplayTarget = !isExcludedFormTitle($source_data['formTitle']);
        
        $insert_success = $insert_stmt->execute([
            ':id' => $source_data['id'],
            ':formTitle' => $source_data['formTitle'] ?? '',
            ':customer' => $source_data['customer'] ?? '',
            ':created' => $source_data['created'] ?? date('Y-m-d H:i:s'),
            ':content' => $source_data['content'] ?? '',
            ':original_id' => $source_data['id'],
            ':is_display_target' => $isDisplayTarget ? 1 : 0
        ]);
        
        if ($insert_success) {
            // 4. 挿入後確認
            $verify_stmt = $pdo->prepare("SELECT id, formTitle, customer, is_display_target FROM wp_wqorders_editable WHERE id = 1313");
            $verify_stmt->execute();
            $inserted_data = $verify_stmt->fetch(PDO::FETCH_ASSOC);
            
            send_response(true, "ID 1313の同期が完了しました", [
                'action' => 'sync_completed',
                'target_id' => 1313,
                'source_data' => [
                    'id' => $source_data['id'],
                    'formTitle' => $source_data['formTitle'],
                    'customer' => $source_data['customer']
                ],
                'inserted_data' => $inserted_data,
                'is_display_target' => $isDisplayTarget
            ]);
        } else {
            send_response(false, "ID 1313の挿入に失敗しました", [
                'action' => 'insert_failed',
                'target_id' => 1313
            ]);
        }
        
    } catch (Exception $e) {
        errorLog('ID 1313直接同期エラー: ' . $e->getMessage());
        send_response(false, 'ID 1313の同期に失敗しました: ' . $e->getMessage(), [
            'action' => 'sync_error',
            'target_id' => 1313,
            'error' => $e->getMessage()
        ]);
    }
}

/**
 * ID 1313同期問題を修正
 */
function handle_fix_sync_1313() {
    try {
        $pdo = get_database_connection();
        
        $log = [];
        
        // 1. 元テーブルでID 1313を確認
        $log[] = "1. 元テーブル確認中...";
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders WHERE id = 1313");
        $stmt->execute();
        $original = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$original) {
            send_response(false, "ID 1313が元テーブル(wp_wqorders)に存在しません", ['log' => $log]);
            return;
        }
        
        $log[] = "✅ 元テーブルにID 1313が存在します";
        $log[] = "   formTitle: " . ($original['formTitle'] ?? 'NULL');
        $log[] = "   customer: " . ($original['customer'] ?? 'NULL');
        $log[] = "   created: " . ($original['created'] ?? 'NULL');
        
        // 2. 編集用テーブルでID 1313を確認
        $log[] = "2. 編集用テーブル確認中...";
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders_editable WHERE id = 1313 OR original_id = 1313");
        $stmt->execute();
        $editable = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($editable) {
            $log[] = "✅ 編集用テーブルにID 1313が既に存在します";
            $log[] = "   id: " . $editable['id'];
            $log[] = "   original_id: " . $editable['original_id'];
            $log[] = "   is_display_target: " . $editable['is_display_target'];
            
            // 表示フラグを更新
            if ($editable['is_display_target'] == 0) {
                $log[] = "3. 表示フラグを更新中...";
                $update_stmt = $pdo->prepare("UPDATE wp_wqorders_editable SET is_display_target = 1 WHERE id = 1313");
                $update_stmt->execute();
                $log[] = "✅ 表示フラグを1に更新しました";
            }
            
            send_response(true, "ID 1313は既に存在します（表示フラグ更新済み）", [
                'log' => $log,
                'existing_data' => $editable
            ]);
            return;
        }
        
        $log[] = "❌ 編集用テーブルにID 1313が存在しません";
        
        // 3. 手動で挿入
        $log[] = "3. 手動挿入を実行中...";
        
        // createdフィールドの処理（UNIXタイムスタンプの場合）
        $created_value = $original['created'];
        if (is_numeric($created_value)) {
            // UNIXタイムスタンプの場合は日時に変換
            $created_value = date('Y-m-d H:i:s', $created_value);
        }
        
        // 使用可能なカラムのみで挿入
        $insert_sql = "
            INSERT INTO wp_wqorders_editable 
            (id, formTitle, customer, created, content, original_id, is_edited, last_sync_at, is_display_target)
            VALUES 
            (?, ?, ?, ?, ?, ?, FALSE, NOW(), 1)
        ";
        
        $insert_stmt = $pdo->prepare($insert_sql);
        $success = $insert_stmt->execute([
            $original['id'],
            $original['formTitle'] ?? '',
            $original['customer'] ?? '',
            $created_value,
            $original['content'] ?? '',
            $original['id']
        ]);
        
        if ($success) {
            $log[] = "✅ ID 1313の挿入に成功しました";
            
            // 確認
            $stmt = $pdo->prepare("SELECT id, formTitle, customer, is_display_target FROM wp_wqorders_editable WHERE id = 1313");
            $stmt->execute();
            $inserted = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($inserted) {
                $log[] = "✅ 挿入確認完了:";
                $log[] = "   id: " . $inserted['id'];
                $log[] = "   formTitle: " . $inserted['formTitle'];
                $log[] = "   customer: " . $inserted['customer'];
                $log[] = "   is_display_target: " . $inserted['is_display_target'];
                
                send_response(true, "ID 1313の同期修正が完了しました", [
                    'log' => $log,
                    'original_data' => $original,
                    'inserted_data' => $inserted
                ]);
            } else {
                $log[] = "❌ 挿入後の確認に失敗しました";
                send_response(false, "挿入後の確認に失敗", ['log' => $log]);
            }
        } else {
            $errorInfo = $insert_stmt->errorInfo();
            $log[] = "❌ ID 1313の挿入に失敗しました";
            $log[] = "エラー: " . $errorInfo[2];
            
            send_response(false, "ID 1313の挿入に失敗", [
                'log' => $log,
                'error' => $errorInfo[2]
            ]);
        }
        
    } catch (Exception $e) {
        send_response(false, 'ID 1313同期修正エラー: ' . $e->getMessage(), [
            'error' => $e->getMessage()
        ]);
    }
}
?> 