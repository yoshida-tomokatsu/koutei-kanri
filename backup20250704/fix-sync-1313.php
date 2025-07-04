<?php
/**
 * ID 1313同期修正スクリプト
 */

// 設定ファイルの読み込み
require_once 'config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = getSecureDBConnection();
    
    echo "=== ID 1313同期修正処理 ===\n";
    
    // 1. 元テーブルでID 1313を確認
    echo "1. 元テーブル確認中...\n";
    $stmt = $pdo->prepare("SELECT * FROM wp_wqorders WHERE id = 1313");
    $stmt->execute();
    $original = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$original) {
        echo "❌ ID 1313が元テーブル(wp_wqorders)に存在しません\n";
        exit;
    }
    
    echo "✅ 元テーブルにID 1313が存在します\n";
    echo "   formTitle: " . ($original['formTitle'] ?? 'NULL') . "\n";
    echo "   customer: " . ($original['customer'] ?? 'NULL') . "\n";
    echo "   created: " . ($original['created'] ?? 'NULL') . "\n";
    
    // 2. 編集用テーブルでID 1313を確認
    echo "\n2. 編集用テーブル確認中...\n";
    $stmt = $pdo->prepare("SELECT * FROM wp_wqorders_editable WHERE id = 1313 OR original_id = 1313");
    $stmt->execute();
    $editable = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($editable) {
        echo "✅ 編集用テーブルにID 1313が既に存在します\n";
        echo "   id: " . $editable['id'] . "\n";
        echo "   original_id: " . $editable['original_id'] . "\n";
        echo "   is_display_target: " . $editable['is_display_target'] . "\n";
        
        // 表示フラグを更新
        if ($editable['is_display_target'] == 0) {
            echo "\n3. 表示フラグを更新中...\n";
            $update_stmt = $pdo->prepare("UPDATE wp_wqorders_editable SET is_display_target = 1 WHERE id = 1313");
            $update_stmt->execute();
            echo "✅ 表示フラグを1に更新しました\n";
        }
        exit;
    }
    
    echo "❌ 編集用テーブルにID 1313が存在しません\n";
    
    // 3. 手動で挿入
    echo "\n3. 手動挿入を実行中...\n";
    
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
        $original['created'] ?? date('Y-m-d H:i:s'),
        $original['content'] ?? '',
        $original['id']
    ]);
    
    if ($success) {
        echo "✅ ID 1313の挿入に成功しました\n";
        
        // 確認
        $stmt = $pdo->prepare("SELECT id, formTitle, customer, is_display_target FROM wp_wqorders_editable WHERE id = 1313");
        $stmt->execute();
        $inserted = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($inserted) {
            echo "✅ 挿入確認完了:\n";
            echo "   id: " . $inserted['id'] . "\n";
            echo "   formTitle: " . $inserted['formTitle'] . "\n";
            echo "   customer: " . $inserted['customer'] . "\n";
            echo "   is_display_target: " . $inserted['is_display_target'] . "\n";
        }
    } else {
        echo "❌ ID 1313の挿入に失敗しました\n";
        $errorInfo = $insert_stmt->errorInfo();
        echo "エラー: " . $errorInfo[2] . "\n";
    }
    
} catch (Exception $e) {
    echo "❌ エラー: " . $e->getMessage() . "\n";
}
?> 