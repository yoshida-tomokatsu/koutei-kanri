<?php
/**
 * 注文データ更新管理API
 * 元のデータベースは変更せず、更新データのみを別テーブルで管理
 */

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// database-api.phpの関数を使用（メイン処理をスキップ）
$original_method = $_SERVER['REQUEST_METHOD']; // 元のメソッドを保存
$_SERVER['REQUEST_METHOD'] = 'INCLUDE_ONLY'; // database-api.phpのメイン処理をスキップ
require_once 'database-api.php';
$_SERVER['REQUEST_METHOD'] = $original_method; // 元のメソッドを復元

// ログ完全無効化（本番環境用）
define('ENABLE_ALL_LOGS', false);

// 空のログ関数（何も出力しない）
function debugLog($message) { /* 無効 */ }
function infoLog($message) { /* 無効 */ }
function errorLog($message) { /* 無効 */ }

// リクエストの処理
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($action === 'get_orders') {
                handle_get_orders_with_updates();
            } elseif ($action === 'get_orders_count') {
                handle_get_orders_count();
            } else {
                send_response(false, '無効なアクションです');
            }
            break;
            
        case 'POST':
            if ($action === 'update_field') {
                handle_update_field();
            } else {
                send_response(false, '無効なアクションです');
            }
            break;
            
        default:
            send_response(false, 'サポートされていないHTTPメソッドです');
    }
} catch (Exception $e) {
    errorLog('Order Updates API Error: ' . $e->getMessage());
    send_response(false, 'サーバーエラーが発生しました: ' . $e->getMessage());
}

/**
 * 更新データを適用した注文一覧を取得
 */
function handle_get_orders_with_updates() {
    try {
        // ページネーションパラメータを取得
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
        $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
        
        // limitの上限を設定（安全のため）
        // $limit = min($limit, 999999999);  // 実質無制限（コメントアウトで制限撤廃）
        $limit = max($limit, 1);
        
        // pageの下限を設定
        $page = max($page, 1);
        
        // OFFSETを計算
        $offset = ($page - 1) * $limit;
        
        $pdo = get_database_connection();
        
        // まず総レコード数を取得（デバッグ強化）
        $count_sql = "SELECT COUNT(*) as total FROM wp_wqorders";
        $count_stmt = $pdo->prepare($count_sql);
        $count_stmt->execute();
        $count_result = $count_stmt->fetch(PDO::FETCH_ASSOC);
        $total_records = intval($count_result['total']);
        
        // デバッグ出力（コンソールでも確認可能）
        debugLog("総レコード数クエリ結果: " . json_encode($count_result));
        debugLog("変換後総レコード数: " . $total_records);
        
        // ページネーション対応でデータを取得
        $sql = "SELECT * FROM wp_wqorders ORDER BY id ASC LIMIT :limit OFFSET :offset";
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // デバッグログ
        infoLog("API取得: 総レコード数={$total_records}, ページ={$page}, リミット={$limit}, 取得件数=" . count($rows));
        
        // 各注文を変換し、更新データを適用
        $orders = [];
        foreach ($rows as $row) {
            try {
                $order = convert_db_row_to_order($row);
                
                // 更新データを適用
                $order = apply_order_updates($order);
                
                $orders[] = $order;
            } catch (Exception $e) {
                errorLog('注文変換エラー ID:' . ($row['id'] ?? 'unknown') . ' - ' . $e->getMessage());
                continue;
            }
        }
        
        // ページネーション情報を含むレスポンス
        $response_data = [
            'orders' => $orders,
            'total_records' => $total_records,
            'current_page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total_records / $limit),
            'has_next_page' => ($page * $limit) < $total_records,
            'has_prev_page' => $page > 1
        ];
        
        send_response(true, "注文データを取得しました (ページ {$page}/{$response_data['total_pages']}, {$total_records}件中" . count($orders) . "件)", $response_data);
        
    } catch (Exception $e) {
        errorLog('注文取得エラー: ' . $e->getMessage());
        send_response(false, 'データ取得に失敗しました: ' . $e->getMessage());
    }
}

/**
 * 総レコード数のみを取得
 */
function handle_get_orders_count() {
    try {
        $pdo = get_database_connection();
        
        // 総レコード数を取得
        $count_sql = "SELECT COUNT(*) as total FROM wp_wqorders";
        $count_stmt = $pdo->prepare($count_sql);
        $count_stmt->execute();
        $count_result = $count_stmt->fetch(PDO::FETCH_ASSOC);
        $total_records = intval($count_result['total']);
        
        $response_data = [
            'total_records' => $total_records,
            'table_info' => [
                'source_table' => 'wp_wqorders',
                'is_editable' => false
            ]
        ];
        
        send_response(true, "総レコード数を取得しました: {$total_records}件", $response_data);
        
    } catch (Exception $e) {
        errorLog('総レコード数取得エラー: ' . $e->getMessage());
        send_response(false, '総レコード数の取得に失敗しました: ' . $e->getMessage());
    }
}

/**
 * 注文データに更新情報を適用
 */
function apply_order_updates($order) {
    try {
        $pdo = get_database_connection();
        $order_id = $order['_db_id'] ?? null;
        
        if (!$order_id) {
            return $order;
        }
        
        // この注文の更新データを取得
        $sql = "SELECT field_name, field_value FROM wp_order_updates WHERE order_id = :order_id";
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':order_id', $order_id, PDO::PARAM_INT);
        $stmt->execute();
        $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // 更新データを適用
        foreach ($updates as $update) {
            $field_name = $update['field_name'];
            $field_value = $update['field_value'];
            
            // フィールド名をマッピング
            if (isset($order[$field_name])) {
                $order[$field_name] = $field_value;
                // 更新済みフラグを追加
                $order['_updated_fields'][$field_name] = true;
            }
        }
        
        return $order;
        
            } catch (Exception $e) {
            errorLog('更新データ適用エラー: ' . $e->getMessage());
        return $order;
    }
}

/**
 * フィールドの更新処理
 */
function handle_update_field() {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        send_response(false, '無効なデータです');
        return;
    }
    
    $order_id = $data['order_id'] ?? null;
    $field_name = $data['field_name'] ?? null;
    $field_value = $data['field_value'] ?? '';
    
    if (!$order_id || !$field_name) {
        send_response(false, '注文IDとフィールド名は必須です');
        return;
    }
    
    try {
        $pdo = get_database_connection();
        
        // 更新データを保存（UPSERT）
        $sql = "INSERT INTO wp_order_updates (order_id, field_name, field_value) 
                VALUES (:order_id, :field_name, :field_value)
                ON DUPLICATE KEY UPDATE 
                field_value = VALUES(field_value), 
                updated_at = CURRENT_TIMESTAMP";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindParam(':order_id', $order_id, PDO::PARAM_INT);
        $stmt->bindParam(':field_name', $field_name, PDO::PARAM_STR);
        $stmt->bindParam(':field_value', $field_value, PDO::PARAM_STR);
        
        if ($stmt->execute()) {
            send_response(true, 'フィールドを更新しました', [
                'order_id' => $order_id,
                'field_name' => $field_name,
                'field_value' => $field_value
            ]);
        } else {
            send_response(false, 'データベース更新に失敗しました');
        }
        
    } catch (Exception $e) {
        errorLog('フィールド更新エラー: ' . $e->getMessage());
        send_response(false, 'フィールド更新に失敗しました: ' . $e->getMessage());
    }
}

// send_response()関数はdatabase-api.phpで定義済み

?> 