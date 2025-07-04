<?php
/**
 * DB書き込み確認用テスト
 */

// 設定ファイルの読み込み
require_once 'config.php';

// デバッグ用エラー表示
error_reporting(E_ALL);
ini_set('display_errors', 1);

function get_database_connection() {
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
        return $pdo;
    } catch (PDOException $e) {
        die('データベース接続エラー: ' . $e->getMessage());
    }
}

// テスト用のIDを指定（実際に存在するIDを使用）
$test_id = $_GET['id'] ?? 1;

echo "<h2>DB書き込み確認テスト - ID: {$test_id}</h2>";

try {
    $pdo = get_database_connection();
    
    // 1. 編集用テーブルの現在の状態を確認
    echo "<h3>1. 編集用テーブルの現在の状態</h3>";
    $stmt = $pdo->prepare("SELECT id, formTitle, customer, is_edited, edited_at, edited_by FROM wp_wqorders_editable WHERE id = ?");
    $stmt->execute([$test_id]);
    $current = $stmt->fetch();
    
    if ($current) {
        echo "<pre>";
        print_r($current);
        echo "</pre>";
    } else {
        echo "<p>❌ ID {$test_id} が見つかりません</p>";
        exit;
    }
    
    // 2. テスト用の編集を実行
    echo "<h3>2. テスト編集を実行</h3>";
    $test_value = "TEST_" . date('Y-m-d H:i:s');
    
    $update_sql = "UPDATE wp_wqorders_editable SET 
                   formTitle = ?, 
                   is_edited = TRUE, 
                   edited_at = NOW(), 
                   edited_by = 'test_user'
                   WHERE id = ?";
    
    $stmt = $pdo->prepare($update_sql);
    $result = $stmt->execute([$test_value, $test_id]);
    
    echo "<p>更新SQL実行結果: " . ($result ? "✅ 成功" : "❌ 失敗") . "</p>";
    echo "<p>影響行数: " . $stmt->rowCount() . "</p>";
    
    // 3. 更新後の状態を確認
    echo "<h3>3. 更新後の状態</h3>";
    $stmt = $pdo->prepare("SELECT id, formTitle, customer, is_edited, edited_at, edited_by FROM wp_wqorders_editable WHERE id = ?");
    $stmt->execute([$test_id]);
    $updated = $stmt->fetch();
    
    if ($updated) {
        echo "<pre>";
        print_r($updated);
        echo "</pre>";
        
        // 変更確認
        if ($updated['formTitle'] === $test_value) {
            echo "<p>✅ 書き込み成功！データが正しく更新されました</p>";
        } else {
            echo "<p>❌ 書き込み失敗！データが更新されていません</p>";
        }
    }
    
    // 4. 最近の編集履歴を確認
    echo "<h3>4. 最近の編集履歴（上位10件）</h3>";
    $stmt = $pdo->query("SELECT id, formTitle, is_edited, edited_at, edited_by FROM wp_wqorders_editable WHERE is_edited = TRUE ORDER BY edited_at DESC LIMIT 10");
    $recent_edits = $stmt->fetchAll();
    
    if ($recent_edits) {
        echo "<table border='1' style='border-collapse: collapse;'>";
        echo "<tr><th>ID</th><th>タイトル</th><th>編集日時</th><th>編集者</th></tr>";
        foreach ($recent_edits as $edit) {
            echo "<tr>";
            echo "<td>{$edit['id']}</td>";
            echo "<td>" . htmlspecialchars($edit['formTitle']) . "</td>";
            echo "<td>{$edit['edited_at']}</td>";
            echo "<td>{$edit['edited_by']}</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p>編集履歴がありません</p>";
    }
    
    // 5. テーブル統計
    echo "<h3>5. テーブル統計</h3>";
    $stmt = $pdo->query("SELECT 
                         COUNT(*) as total_records,
                         COUNT(CASE WHEN is_edited = TRUE THEN 1 END) as edited_records,
                         MAX(edited_at) as last_edit_time
                         FROM wp_wqorders_editable");
    $stats = $stmt->fetch();
    
    echo "<ul>";
    echo "<li>総レコード数: {$stats['total_records']}</li>";
    echo "<li>編集済みレコード数: {$stats['edited_records']}</li>";
    echo "<li>最終編集時刻: {$stats['last_edit_time']}</li>";
    echo "</ul>";
    
} catch (Exception $e) {
    echo "<p>❌ エラー: " . $e->getMessage() . "</p>";
}

echo "<hr>";
echo "<p><a href='?id=" . ($test_id + 1) . "'>次のID({$test_id + 1})をテスト</a></p>";
echo "<p><a href='index.html'>メイン画面に戻る</a></p>";
?> 