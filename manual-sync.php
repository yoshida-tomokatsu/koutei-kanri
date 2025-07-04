<?php
/**
 * 手動同期スクリプト - ID 1313を含む不足データを同期
 */

// 設定ファイルの読み込み
require_once 'config.php';

// セキュリティヘッダーの設定
setSecurityHeaders();

// JSONレスポンス用のヘッダー
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getSecureDBConnection();
    echo json_encode(['status' => 'connected', 'message' => 'データベース接続成功']) . "\n";
    
    // 1. 元テーブルでID 1313を確認
    $stmt = $pdo->prepare("SELECT id, formTitle, customer, created FROM wp_wqorders WHERE id = 1313");
    $stmt->execute();
    $original_data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$original_data) {
        echo json_encode(['status' => 'error', 'message' => 'ID 1313は wp_wqorders テーブルに存在しません']) . "\n";
        exit;
    }
    
    echo json_encode(['status' => 'found_original', 'data' => $original_data]) . "\n";
    
    // 2. 編集用テーブルでID 1313を確認
    $stmt = $pdo->prepare("SELECT id, original_id FROM wp_wqorders_editable WHERE id = 1313 OR original_id = 1313");
    $stmt->execute();
    $editable_data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($editable_data) {
        echo json_encode(['status' => 'already_exists', 'message' => 'ID 1313は既に編集用テーブルに存在します', 'data' => $editable_data]) . "\n";
        exit;
    }
    
    // 3. 不足データを検索
    $stmt = $pdo->prepare("
        SELECT o.* 
        FROM wp_wqorders o
        LEFT JOIN wp_wqorders_editable e ON o.id = e.original_id
        WHERE e.original_id IS NULL
        ORDER BY o.id ASC
        LIMIT 10
    ");
    $stmt->execute();
    $missing_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['status' => 'missing_found', 'count' => count($missing_data), 'sample' => array_slice($missing_data, 0, 3)]) . "\n";
    
    // 4. 個別に同期を実行
    $synced_count = 0;
    foreach ($missing_data as $record) {
        try {
            $insert_stmt = $pdo->prepare("
                INSERT INTO wp_wqorders_editable 
                (id, formTitle, customer, created, updated, status, content, original_id, is_edited, last_sync_at, is_display_target)
                SELECT id, formTitle, customer, created, updated, status, content, id, FALSE, NOW(), 1
                FROM wp_wqorders 
                WHERE id = :id
            ");
            $insert_stmt->execute([':id' => $record['id']]);
            $synced_count++;
            
            if ($record['id'] == 1313) {
                echo json_encode(['status' => 'synced_1313', 'message' => 'ID 1313を同期しました']) . "\n";
            }
        } catch (Exception $e) {
            echo json_encode(['status' => 'sync_error', 'id' => $record['id'], 'error' => $e->getMessage()]) . "\n";
        }
    }
    
    echo json_encode(['status' => 'completed', 'synced_count' => $synced_count, 'total_missing' => count($missing_data)]) . "\n";
    
    // 5. 最終確認
    $stmt = $pdo->prepare("SELECT id, formTitle, customer, original_id FROM wp_wqorders_editable WHERE id = 1313 OR original_id = 1313");
    $stmt->execute();
    $final_check = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($final_check) {
        echo json_encode(['status' => 'final_success', 'message' => 'ID 1313が編集用テーブルに存在します', 'data' => $final_check]) . "\n";
    } else {
        echo json_encode(['status' => 'final_error', 'message' => 'ID 1313が依然として見つかりません']) . "\n";
    }
    
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]) . "\n";
}
?> 