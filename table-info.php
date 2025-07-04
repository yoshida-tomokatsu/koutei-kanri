<?php
// 設定ファイルの読み込み
require_once 'config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = getSecureDBConnection();
    
    echo "=== wp_wqorders テーブル構造 ===\n";
    $stmt = $pdo->query("DESCRIBE wp_wqorders");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($columns as $column) {
        echo sprintf("%-20s %-20s %-10s %s\n", 
            $column['Field'], 
            $column['Type'], 
            $column['Null'], 
            $column['Default']
        );
    }
    
    echo "\n=== ID 1313 のデータ ===\n";
    $stmt = $pdo->query("SELECT * FROM wp_wqorders WHERE id = 1313");
    $data = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($data) {
        foreach ($data as $key => $value) {
            echo sprintf("%-20s: %s\n", $key, is_string($value) ? substr($value, 0, 100) : $value);
        }
    } else {
        echo "ID 1313 が見つかりません\n";
    }
    
} catch (Exception $e) {
    echo "エラー: " . $e->getMessage() . "\n";
}
?> 