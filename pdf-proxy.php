<?php
/**
 * PDF プロキシAPI
 * WordPress認証が必要なPDFファイルを取得してクライアントに中継
 * 
 * 使用方法: pdf-proxy.php?order=1308
 */

// CORS設定
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// OPTIONSリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// エラーレポートを一時的に無効化（本番環境用）
error_reporting(E_ERROR | E_PARSE);

/**
 * ログ関数
 */
function writeLog($message, $level = 'INFO') {
    // ログ出力を完全に無効化
    return;
}

/**
 * JSON レスポンス送信
 */
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * PDF プロキシメイン処理
 */
function handlePdfProxy() {
    // 注文番号の取得と検証
    $orderNumber = $_GET['order'] ?? '';
    
    if (empty($orderNumber)) {
        writeLog("エラー: 注文番号が指定されていません");
        sendJsonResponse([
            'success' => false,
            'message' => '注文番号が指定されていません'
        ], 400);
    }
    
    // 注文番号の形式チェック（セキュリティ対策）
    if (!preg_match('/^\d+$/', $orderNumber)) {
        writeLog("エラー: 無効な注文番号形式: $orderNumber");
        sendJsonResponse([
            'success' => false,
            'message' => '無効な注文番号形式です'
        ], 400);
    }
    
    writeLog("PDF取得開始: 注文番号 $orderNumber");
    
    // WordPress PDF URL
    $pdfUrl = "https://original-scarf.com/aforms-admin-pdf/$orderNumber";
    
    // 複数の認証方法を試行
    $methods = [
        'wordpress_login',
        'cookie_auth',
        'basic_auth',
        'user_agent_spoof'
    ];
    
    foreach ($methods as $method) {
        writeLog("認証方法試行: $method");
        
        $result = fetchPdfWithMethod($pdfUrl, $method);
        
        if ($result['success']) {
            writeLog("認証成功: $method で PDF取得完了");
            
            // PDF を直接出力
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="quote_' . $orderNumber . '.pdf"');
            header('Content-Length: ' . strlen($result['data']));
            header('Cache-Control: private, max-age=0, no-cache');
            header('Pragma: no-cache');
            
            echo $result['data'];
            exit;
        }
        
        writeLog("認証失敗: $method - " . $result['message']);
    }
    
    // 全ての方法が失敗した場合
    writeLog("全認証方法失敗: 注文番号 $orderNumber");
    
    // 認証エラー用のHTMLページを返す
    header('Content-Type: text/html; charset=utf-8');
    echo generateAuthRequiredPage($orderNumber, $pdfUrl);
    exit;
}

/**
 * 指定された認証方法でPDFを取得
 */
function fetchPdfWithMethod($pdfUrl, $method) {
    $ch = curl_init();
    
    // 基本設定
    curl_setopt_array($ch, [
        CURLOPT_URL => $pdfUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]);
    
    // 認証方法別の設定
    switch ($method) {
        case 'wordpress_login':
            // WordPressへの自動ログイン
            $loginResult = performWordPressLogin($ch);
            if (!$loginResult['success']) {
                curl_close($ch);
                return $loginResult;
            }
            break;
            
        case 'basic_auth':
            // 基本認証（必要に応じて認証情報を設定）
            // curl_setopt($ch, CURLOPT_USERPWD, "username:password");
            break;
            
        case 'cookie_auth':
            // WordPressセッション情報を試行
            curl_setopt($ch, CURLOPT_COOKIEJAR, '/tmp/wordpress_cookies.txt');
            curl_setopt($ch, CURLOPT_COOKIEFILE, '/tmp/wordpress_cookies.txt');
            break;
            
        case 'user_agent_spoof':
            // より詳細なユーザーエージェント
            curl_setopt($ch, CURLOPT_USERAGENT, 
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language: ja,en-US;q=0.7,en;q=0.3',
                'Accept-Encoding: gzip, deflate, br',
                'Connection: keep-alive',
                'Upgrade-Insecure-Requests: 1',
            ]);
            break;
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    if ($response === false) {
        return [
            'success' => false,
            'message' => 'cURL エラー: ' . $error
        ];
    }
    
    if ($httpCode !== 200) {
        return [
            'success' => false,
            'message' => "HTTP エラー: $httpCode"
        ];
    }
    
    // Content-Type をチェック（PDFかどうか）
    if (strpos($contentType, 'application/pdf') !== false) {
        return [
            'success' => true,
            'data' => $response,
            'content_type' => $contentType
        ];
    }
    
    // HTMLページが返された場合（ログインページなど）
    if (strpos($contentType, 'text/html') !== false) {
        return [
            'success' => false,
            'message' => 'HTML ページが返されました（認証が必要）'
        ];
    }
    
    return [
        'success' => false,
        'message' => '不明なコンテンツタイプ: ' . $contentType
    ];
}

/**
 * 認証が必要な場合のHTMLページ生成
 */
function generateAuthRequiredPage($orderNumber, $pdfUrl) {
    return <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WordPress認証が必要 - 見積書 $orderNumber</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', Roboto, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .auth-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .auth-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        .auth-title {
            color: #333;
            margin-bottom: 15px;
            font-size: 24px;
            font-weight: 600;
        }
        .auth-message {
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .auth-steps {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: left;
        }
        .auth-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .auth-btn {
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        .auth-btn-primary {
            background: #007bff;
            color: white;
        }
        .auth-btn-primary:hover {
            background: #0056b3;
            transform: translateY(-1px);
        }
        .auth-btn-secondary {
            background: #28a745;
            color: white;
        }
        .auth-btn-secondary:hover {
            background: #1e7e34;
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="auth-icon">🔐</div>
        <h1 class="auth-title">WordPress認証が必要です</h1>
        <p class="auth-message">
            見積書 $orderNumber を表示するには、<br>
            <strong>original-scarf.com</strong> のWordPressにログインしてください。
        </p>
        
        <div class="auth-steps">
            <strong>📋 手順:</strong>
            <ol style="margin: 10px 0 0 20px; color: #6c757d;">
                <li>WordPressにログインする</li>
                <li>ログイン後、PDFに直接アクセスする</li>
                <li>または、メインシステムから再度アクセスする</li>
            </ol>
        </div>
        
        <div class="auth-buttons">
            <a href="https://original-scarf.com/wp-admin/" target="_blank" class="auth-btn auth-btn-primary">
                🔑 WordPressログイン
            </a>
            <a href="$pdfUrl" target="_blank" class="auth-btn auth-btn-secondary">
                📄 PDF直接アクセス
            </a>
        </div>
        
        <p style="font-size: 12px; color: #999; margin-top: 20px;">
            ※ 同じブラウザでログインしていればPDFにアクセスできます
        </p>
    </div>
</body>
</html>
HTML;
}

/**
 * WordPress自動ログイン設定
 * ※ 実際の認証情報は環境に応じて設定してください
 */
define('WP_LOGIN_URL', 'https://original-scarf.com/wp-login.php');
define('WP_USERNAME', ''); // ※ 実際のユーザー名を設定
define('WP_PASSWORD', ''); // ※ 実際のパスワードを設定

/**
 * WordPressへの自動ログイン実行
 */
function performWordPressLogin($ch) {
    // 認証情報が設定されていない場合はスキップ
    if (empty(WP_USERNAME) || empty(WP_PASSWORD)) {
        writeLog("WordPress認証情報が設定されていません");
        return ['success' => false, 'message' => '認証情報が設定されていません'];
    }
    
    writeLog("WordPress自動ログイン開始");
    
    // Cookie用の一時ファイル
    $cookieFile = sys_get_temp_dir() . '/wp_auth_cookies_' . session_id() . '.txt';
    
    // まずログインページを取得してnonceを取得
    curl_setopt_array($ch, [
        CURLOPT_URL => WP_LOGIN_URL,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]);
    
    $loginPage = curl_exec($ch);
    if ($loginPage === false) {
        writeLog("ログインページの取得に失敗: " . curl_error($ch));
        return ['success' => false, 'message' => 'ログインページ取得失敗'];
    }
    
    // ログイン実行
    $postData = [
        'log' => WP_USERNAME,
        'pwd' => WP_PASSWORD,
        'wp-submit' => 'ログイン',
        'redirect_to' => 'https://original-scarf.com/wp-admin/',
        'testcookie' => '1'
    ];
    
    curl_setopt_array($ch, [
        CURLOPT_URL => WP_LOGIN_URL,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($postData),
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/x-www-form-urlencoded',
            'Referer: ' . WP_LOGIN_URL
        ]
    ]);
    
    $loginResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($loginResponse === false) {
        writeLog("ログイン実行に失敗: " . curl_error($ch));
        return ['success' => false, 'message' => 'ログイン実行失敗'];
    }
    
    // ログイン成功の判定（リダイレクト先またはHTTPコードで判定）
    $finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    
    if (strpos($finalUrl, 'wp-admin') !== false || $httpCode === 200) {
        writeLog("WordPress自動ログイン成功");
        
        // Cookie情報をセット（PDFアクセス時に使用）
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
        
        return ['success' => true, 'message' => 'ログイン成功'];
    } else {
        writeLog("WordPress自動ログイン失敗 - 最終URL: $finalUrl, HTTP Code: $httpCode");
        return ['success' => false, 'message' => 'ログイン認証失敗'];
    }
}

/**
 * PDF専用設定ファイルを作成（認証情報を安全に管理）
 */
function createAuthConfigIfNotExists() {
    $configFile = __DIR__ . '/wp-auth-config.php';
    
    if (!file_exists($configFile)) {
        $configContent = <<<PHP
<?php
/**
 * WordPress認証設定ファイル
 * ※ このファイルは重要な認証情報を含むため、適切なアクセス制限を設定してください
 */

// WordPress認証情報（実際の値を設定してください）
define('WP_AUTH_USERNAME', ''); // WordPressのユーザー名
define('WP_AUTH_PASSWORD', ''); // WordPressのパスワード

// セキュリティ設定
define('WP_AUTH_ENABLED', false); // 認証を有効にする場合はtrueに変更

?>
PHP;
        
        file_put_contents($configFile, $configContent);
        chmod($configFile, 0600); // ファイルの権限を制限
        
        writeLog("認証設定ファイルを作成しました: $configFile");
    }
}

// メイン処理実行
try {
    // 認証設定ファイルの確認・作成
    createAuthConfigIfNotExists();
    
    // 認証設定を読み込み
    $authConfigFile = __DIR__ . '/wp-auth-config.php';
    if (file_exists($authConfigFile)) {
        include_once $authConfigFile;
        
        // 設定ファイルから認証情報を更新
        if (defined('WP_AUTH_ENABLED') && WP_AUTH_ENABLED && defined('WP_AUTH_USERNAME') && defined('WP_AUTH_PASSWORD')) {
            // 既存の定数を上書きする場合の処理
            if (!defined('WP_USERNAME')) {
                define('WP_USERNAME', WP_AUTH_USERNAME);
            }
            if (!defined('WP_PASSWORD')) {
                define('WP_PASSWORD', WP_AUTH_PASSWORD);
            }
        }
    }
    
    handlePdfProxy();
} catch (Exception $e) {
    writeLog("予期しないエラー: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'サーバーエラーが発生しました'
    ], 500);
}
?> 