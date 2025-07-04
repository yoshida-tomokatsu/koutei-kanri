<?php
/**
 * 注文更新データ管理API（直接データベース接続版）
 */

// データベース設定
$host = 'mysql3104.db.sakura.ne.jp';
$dbname = 'kiryu-factory_koutei';
$username = 'kiryu-factory';
$password = 'koutei2024';

// CORS対応
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// OPTIONSリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // PDO接続
    $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
    ]);
    
    // アクション取得
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    
    switch ($action) {
        case 'save_update':
            // 更新データを保存
            $order_id = $_POST['order_id'] ?? 0;
            $field_name = $_POST['field_name'] ?? '';
            $field_value = $_POST['field_value'] ?? '';
            
            if ($order_id && $field_name) {
                $sql = "INSERT INTO wp_order_updates (order_id, field_name, field_value) 
                        VALUES (:order_id, :field_name, :field_value) 
                        ON DUPLICATE KEY UPDATE 
                        field_value = VALUES(field_value), 
                        updated_at = CURRENT_TIMESTAMP";
                
                $stmt = $pdo->prepare($sql);
                $result = $stmt->execute([
                    ':order_id' => $order_id,
                    ':field_name' => $field_name,
                    ':field_value' => $field_value
                ]);
                
                echo json_encode([
                    'success' => $result,
                    'message' => $result ? '更新データを保存しました' : '保存に失敗しました',
                    'data' => [
                        'order_id' => $order_id,
                        'field_name' => $field_name,
                        'field_value' => $field_value
                    ]
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => '必要なパラメータが不足しています'
                ]);
            }
            break;
            
        case 'get_updates':
            // 更新データを取得
            $order_id = $_GET['order_id'] ?? 0;
            
            if ($order_id) {
                $sql = "SELECT field_name, field_value, updated_at 
                        FROM wp_order_updates 
                        WHERE order_id = :order_id";
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':order_id' => $order_id]);
                $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // フィールド名をキーとした連想配列に変換
                $result = [];
                foreach ($updates as $update) {
                    $result[$update['field_name']] = [
                        'value' => $update['field_value'],
                        'updated_at' => $update['updated_at']
                    ];
                }
                
                echo json_encode([
                    'success' => true,
                    'message' => '更新データを取得しました',
                    'data' => $result
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'order_idが指定されていません'
                ]);
            }
            break;
            
        case 'get_all_updates':
            // 全ての更新データを取得
            $sql = "SELECT order_id, field_name, field_value, updated_at 
                    FROM wp_order_updates 
                    ORDER BY order_id, field_name";
            
            $stmt = $pdo->query($sql);
            $updates = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // 注文IDごとにグループ化
            $result = [];
            foreach ($updates as $update) {
                $order_id = $update['order_id'];
                if (!isset($result[$order_id])) {
                    $result[$order_id] = [];
                }
                $result[$order_id][$update['field_name']] = [
                    'value' => $update['field_value'],
                    'updated_at' => $update['updated_at']
                ];
            }
            
            echo json_encode([
                'success' => true,
                'message' => '全ての更新データを取得しました',
                'data' => $result
            ]);
            break;
            
        case 'test':
            // 接続テスト
            echo json_encode([
                'success' => true,
                'message' => 'order-updates-api-direct.php 接続成功',
                'timestamp' => date('Y-m-d H:i:s'),
                'actions' => ['save_update', 'get_updates', 'get_all_updates', 'test']
            ]);
            break;
            
        default:
            echo json_encode([
                'success' => false,
                'message' => '無効なアクションです',
                'available_actions' => ['save_update', 'get_updates', 'get_all_updates', 'test']
            ]);
            break;
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'データベースエラー: ' . $e->getMessage()
    ]);
}
?> 