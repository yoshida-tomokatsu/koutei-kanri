<?php
// APIテスト用ファイル
define('SYSTEM_ACCESS_ALLOWED', true);
require_once 'config.php';

echo "<h2>API動作テスト</h2>";

// 1. データベース接続テスト
echo "<h3>1. データベース接続テスト</h3>";
try {
    $pdo = getSecureDBConnection();
    echo "✅ データベース接続成功<br>";
    
    // テーブル存在確認
    $check_table = $pdo->query("SHOW TABLES LIKE 'wp_wqorders_editable'");
    if ($check_table && $check_table->rowCount() > 0) {
        echo "✅ wp_wqorders_editableテーブル存在確認<br>";
        
        // レコード数確認
        $count_sql = "SELECT COUNT(*) as total FROM wp_wqorders_editable WHERE is_display_target = 1";
        $count_stmt = $pdo->prepare($count_sql);
        $count_stmt->execute();
        $total = $count_stmt->fetch(PDO::FETCH_ASSOC)['total'];
        echo "✅ 表示対象レコード数: {$total}件<br>";
    } else {
        echo "❌ wp_wqorders_editableテーブルが存在しません<br>";
    }
    
} catch (Exception $e) {
    echo "❌ データベース接続エラー: " . $e->getMessage() . "<br>";
}

// 2. API直接テスト
echo "<h3>2. API直接テスト</h3>";

// get_orders_count APIテスト
echo "<h4>get_orders_count APIテスト</h4>";
$url = "https://kiryu-factory.com/koutei/editable-orders-api.php?action=get_orders_count";
$response = file_get_contents($url);
echo "レスポンス: " . htmlspecialchars($response) . "<br>";

// get_editable_orders APIテスト
echo "<h4>get_editable_orders APIテスト</h4>";
$url = "https://kiryu-factory.com/koutei/editable-orders-api.php?action=get_editable_orders&page=1&limit=5";
$response = file_get_contents($url);
echo "レスポンス: " . htmlspecialchars($response) . "<br>";

echo "<h3>テスト完了</h3>";
?> 