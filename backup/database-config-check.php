<?php
/**
 * データベース設定確認ツール
 */

// エラー表示を有効化
error_reporting(E_ALL);
ini_set('display_errors', 1);

// ヘッダー設定
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// kiryu-factory.com のデータベース設定（実際の値に変更してください）
$db_config = [
    'host' => 'localhost',                // または mysql.kiryu-factory.com など
    'dbname' => 'factory0328_wp2',       // 実際のデータベース名
    'username' => 'factory0328_wp2',     // 実際のユーザー名  
    'password' => 'ctwjr3mmf5',          // 実際のパスワード
    'charset' => 'utf8mb4'
];

try {
    echo "<h2>データベース接続テスト</h2>";
    
    // 1. PHP拡張機能チェック
    echo "<h3>1. PHP拡張機能チェック</h3>";
    echo "PDO: " . (extension_loaded('pdo') ? '✅ 利用可能' : '❌ 利用不可') . "<br>";
    echo "PDO MySQL: " . (extension_loaded('pdo_mysql') ? '✅ 利用可能' : '❌ 利用不可') . "<br>";
    
    if (!extension_loaded('pdo_mysql')) {
        throw new Exception('PDO MySQL拡張機能が利用できません');
    }
    
    // 2. データベース接続テスト
    echo "<h3>2. データベース接続テスト</h3>";
    echo "ホスト: " . htmlspecialchars($db_config['host']) . "<br>";
    echo "データベース: " . htmlspecialchars($db_config['dbname']) . "<br>";
    echo "ユーザー: " . htmlspecialchars($db_config['username']) . "<br>";
    
    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $db_config['host'],
        $db_config['dbname'],
        $db_config['charset']
    );
    
    $pdo = new PDO($dsn, $db_config['username'], $db_config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 10
    ]);
    
    echo "✅ データベース接続成功<br>";
    
    // 3. テーブル存在確認
    echo "<h3>3. テーブル確認</h3>";
    $stmt = $pdo->prepare("SHOW TABLES LIKE 'wp_wqorders'");
    $stmt->execute();
    $tableExists = $stmt->rowCount() > 0;
    
    echo "wp_wqordersテーブル: " . ($tableExists ? '✅ 存在' : '❌ 存在しない') . "<br>";
    
    if (!$tableExists) {
        // 全テーブルを確認
        echo "<h4>存在するテーブル一覧:</h4>";
        $stmt = $pdo->query("SHOW TABLES");
        $tables = $stmt->fetchAll();
        
        if (empty($tables)) {
            echo "❌ テーブルが見つかりません<br>";
        } else {
            foreach ($tables as $table) {
                $tableName = array_values($table)[0];
                echo "- " . htmlspecialchars($tableName) . "<br>";
            }
        }
        throw new Exception('wp_wqordersテーブルが見つかりません');
    }
    
    // 4. データ件数確認
    echo "<h3>4. データ確認</h3>";
    $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM wp_wqorders");
    $stmt->execute();
    $result = $stmt->fetch();
    $totalRecords = $result['total'];
    
    echo "総レコード数: " . $totalRecords . "件<br>";
    
    if ($totalRecords == 0) {
        echo "⚠️ データが登録されていません<br>";
    }
    
    // 5. サンプルデータ確認
    if ($totalRecords > 0) {
        echo "<h3>5. サンプルデータ</h3>";
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders ORDER BY id DESC LIMIT 3");
        $stmt->execute();
        $samples = $stmt->fetchAll();
        
        echo "<table border='1' style='border-collapse: collapse; width: 100%;'>";
        echo "<tr><th>ID</th><th>Customer</th><th>FormTitle</th><th>Created</th><th>Content (先頭100文字)</th></tr>";
        
        foreach ($samples as $sample) {
            $contentPreview = mb_substr($sample['content'] ?? '', 0, 100) . '...';
            echo "<tr>";
            echo "<td>" . htmlspecialchars($sample['id'] ?? '') . "</td>";
            echo "<td>" . htmlspecialchars($sample['customer'] ?? '') . "</td>";
            echo "<td>" . htmlspecialchars($sample['formTitle'] ?? '') . "</td>";
            echo "<td>" . htmlspecialchars($sample['created'] ?? '') . "</td>";
            echo "<td>" . htmlspecialchars($contentPreview) . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    }
    
    echo "<h3>✅ 診断完了</h3>";
    echo "<p>すべてのチェックが正常に完了しました。</p>";
    
} catch (Exception $e) {
    echo "<h3>❌ エラー発生</h3>";
    echo "<p style='color: red;'>エラー: " . htmlspecialchars($e->getMessage()) . "</p>";
    
    // エラーの場合の対処法を表示
    echo "<h3>🔧 対処法</h3>";
    echo "<ul>";
    echo "<li>データベース名、ユーザー名、パスワードが正しいか確認してください</li>";
    echo "<li>データベースサーバーが起動しているか確認してください</li>";
    echo "<li>wp_wqordersテーブルが存在するか確認してください</li>";
    echo "<li>ユーザーにテーブルへのアクセス権限があるか確認してください</li>";
    echo "</ul>";
}
?>