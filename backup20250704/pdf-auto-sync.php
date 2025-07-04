<?php
/**
 * PDF自動同期システム - 画面更新時の差分チェック・同期
 * original-scarf.com から kiryu-factory.com への自動PDF同期
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

// エラーログ設定
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// 設定
define('SOURCE_PATH', __DIR__ . '/../../../original-scarf.com/public_html/wp-content/aforms-pdf');
define('TARGET_PATH', __DIR__ . '/aforms-pdf');
define('LOG_FILE', __DIR__ . '/pdf-auto-sync.log');
define('SYNC_STATUS_FILE', __DIR__ . '/sync-status.json');
define('MAX_EXECUTION_TIME', 300); // 5分（大量データ処理対応）
define('CHECK_INTERVAL', 300); // 5分間隔でチェック
define('DEBUG_MODE', false);

// 実行時間制限を設定
set_time_limit(MAX_EXECUTION_TIME);

/**
 * ログ記録関数
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
 * 同期状態の読み込み
 */
function loadSyncStatus() {
    if (file_exists(SYNC_STATUS_FILE)) {
        $content = file_get_contents(SYNC_STATUS_FILE);
        return json_decode($content, true) ?: [];
    }
    return [
        'last_check' => 0,
        'last_sync' => 0,
        'file_checksums' => [],
        'total_files' => 0,
        'total_size' => 0
    ];
}

/**
 * 同期状態の保存
 */
function saveSyncStatus($status) {
    file_put_contents(SYNC_STATUS_FILE, json_encode($status, JSON_PRETTY_PRINT));
}

/**
 * ディレクトリ作成（再帰的）
 */
function createDirectoryRecursive($path) {
    if (!is_dir($path)) {
        if (!mkdir($path, 0755, true)) {
            writeLog("ディレクトリ作成失敗: $path", 'ERROR');
            return false;
        }
        writeLog("ディレクトリ作成: $path", 'INFO');
    }
    return true;
}

/**
 * 軽量な差分チェック（ファイルサイズと更新日時のみ）
 */
function quickDifferenceCheck() {
    $currentTime = time();
    $status = loadSyncStatus();
    
    // チェック間隔の確認
    if ($currentTime - $status['last_check'] < CHECK_INTERVAL) {
        return [
            'needs_sync' => false,
            'message' => 'チェック間隔内のため、同期をスキップ',
            'next_check' => $status['last_check'] + CHECK_INTERVAL
        ];
    }
    
    // ソースパスの存在確認
    if (!is_dir(SOURCE_PATH)) {
        writeLog("ソースパスが見つかりません: " . SOURCE_PATH, 'ERROR');
        return [
            'needs_sync' => false,
            'error' => 'ソースパスが見つかりません'
        ];
    }
    
    $changes = [];
    $newChecksums = [];
    $hasChanges = false;
    
    // ソースディレクトリを再帰的にスキャン
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(SOURCE_PATH, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $relativePath = str_replace(SOURCE_PATH, '', $file->getPathname());
            $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
            
            // ファイル情報を取得
            $fileSize = $file->getSize();
            $fileTime = $file->getMTime();
            $checksum = $fileSize . '|' . $fileTime;
            
            $newChecksums[$relativePath] = $checksum;
            
            // 前回のチェックサムと比較
            if (!isset($status['file_checksums'][$relativePath]) || 
                $status['file_checksums'][$relativePath] !== $checksum) {
                
                $changes[] = [
                    'path' => $relativePath,
                    'action' => isset($status['file_checksums'][$relativePath]) ? 'modified' : 'new',
                    'size' => $fileSize,
                    'time' => $fileTime
                ];
                $hasChanges = true;
            }
        }
    }
    
    // 削除されたファイルをチェック
    foreach ($status['file_checksums'] as $path => $checksum) {
        if (!isset($newChecksums[$path])) {
            $changes[] = [
                'path' => $path,
                'action' => 'deleted'
            ];
            $hasChanges = true;
        }
    }
    
    // 状態を更新
    $status['last_check'] = $currentTime;
    $status['file_checksums'] = $newChecksums;
    $status['total_files'] = count($newChecksums);
    saveSyncStatus($status);
    
    return [
        'needs_sync' => $hasChanges,
        'changes' => $changes,
        'total_files' => count($newChecksums),
        'changed_files' => count($changes)
    ];
}

/**
 * 差分ファイルの同期実行
 */
function syncChangedFiles($changes) {
    if (!createDirectoryRecursive(TARGET_PATH)) {
        return [
            'success' => false,
            'message' => 'ターゲットディレクトリの作成に失敗しました'
        ];
    }
    
    $stats = [
        'copied' => 0,
        'updated' => 0,
        'deleted' => 0,
        'errors' => 0,
        'total_size' => 0
    ];
    
    $results = [];
    
    foreach ($changes as $change) {
        $sourcePath = SOURCE_PATH . '/' . $change['path'];
        $targetPath = TARGET_PATH . '/' . $change['path'];
        
        try {
            switch ($change['action']) {
                case 'new':
                case 'modified':
                    // ディレクトリを作成
                    $targetDir = dirname($targetPath);
                    if (!createDirectoryRecursive($targetDir)) {
                        $stats['errors']++;
                        continue 2;
                    }
                    
                    // ファイルをコピー
                    if (copy($sourcePath, $targetPath)) {
                        // 更新日時を保持
                        touch($targetPath, $change['time']);
                        
                        $stats[$change['action'] === 'new' ? 'copied' : 'updated']++;
                        $stats['total_size'] += $change['size'];
                        
                        $results[] = [
                            'path' => $change['path'],
                            'action' => $change['action'],
                            'success' => true,
                            'size' => $change['size']
                        ];
                        
                        writeLog("ファイル同期成功: {$change['path']} ({$change['action']})", 'INFO');
                    } else {
                        $stats['errors']++;
                        $results[] = [
                            'path' => $change['path'],
                            'action' => $change['action'],
                            'success' => false,
                            'error' => 'コピー失敗'
                        ];
                        writeLog("ファイル同期失敗: {$change['path']}", 'ERROR');
                    }
                    break;
                    
                case 'deleted':
                    // ターゲットファイルを削除
                    if (file_exists($targetPath)) {
                        if (unlink($targetPath)) {
                            $stats['deleted']++;
                            $results[] = [
                                'path' => $change['path'],
                                'action' => 'deleted',
                                'success' => true
                            ];
                            writeLog("ファイル削除成功: {$change['path']}", 'INFO');
                        } else {
                            $stats['errors']++;
                            $results[] = [
                                'path' => $change['path'],
                                'action' => 'deleted',
                                'success' => false,
                                'error' => '削除失敗'
                            ];
                            writeLog("ファイル削除失敗: {$change['path']}", 'ERROR');
                        }
                    }
                    break;
            }
        } catch (Exception $e) {
            $stats['errors']++;
            $results[] = [
                'path' => $change['path'],
                'action' => $change['action'],
                'success' => false,
                'error' => $e->getMessage()
            ];
            writeLog("ファイル同期エラー: {$change['path']} - " . $e->getMessage(), 'ERROR');
        }
    }
    
    // 同期状態を更新
    $status = loadSyncStatus();
    $status['last_sync'] = time();
    saveSyncStatus($status);
    
    return [
        'success' => $stats['errors'] === 0,
        'stats' => $stats,
        'results' => $results,
        'message' => $stats['errors'] === 0 ? 
            '差分同期が完了しました' : 
            "差分同期中に{$stats['errors']}件のエラーが発生しました"
    ];
}

/**
 * 自動同期チェック実行
 */
function executeAutoSync() {
    writeLog("自動同期チェック開始", 'INFO');
    
    // 差分チェック
    $checkResult = quickDifferenceCheck();
    
    if (isset($checkResult['error'])) {
        return [
            'success' => false,
            'message' => $checkResult['error']
        ];
    }
    
    if (!$checkResult['needs_sync']) {
        return [
            'success' => true,
            'message' => '変更なし - 同期は不要です',
            'check_result' => $checkResult
        ];
    }
    
    writeLog("変更を検出: {$checkResult['changed_files']}ファイル", 'INFO');
    
    // 差分同期実行
    $syncResult = syncChangedFiles($checkResult['changes']);
    
    writeLog("自動同期完了", 'INFO');
    
    return [
        'success' => $syncResult['success'],
        'message' => $syncResult['message'],
        'check_result' => $checkResult,
        'sync_result' => $syncResult
    ];
}

/**
 * 同期状態の取得
 */
function getSyncInfo() {
    $status = loadSyncStatus();
    $currentTime = time();
    
    return [
        'success' => true,
        'status' => [
            'last_check' => $status['last_check'],
            'last_sync' => $status['last_sync'],
            'total_files' => $status['total_files'],
            'total_size' => $status['total_size'],
            'time_since_check' => $currentTime - $status['last_check'],
            'time_since_sync' => $currentTime - $status['last_sync'],
            'next_check_in' => max(0, CHECK_INTERVAL - ($currentTime - $status['last_check'])),
            'source_path' => SOURCE_PATH,
            'target_path' => TARGET_PATH,
            'source_exists' => is_dir(SOURCE_PATH),
            'target_exists' => is_dir(TARGET_PATH)
        ]
    ];
}

// メイン処理
$action = $_GET['action'] ?? 'auto_sync';

try {
    switch ($action) {
        case 'auto_sync':
            $result = executeAutoSync();
            sendJsonResponse($result);
            break;
            
        case 'check':
            $result = quickDifferenceCheck();
            sendJsonResponse(['success' => true, 'check_result' => $result]);
            break;
            
        case 'info':
            $result = getSyncInfo();
            sendJsonResponse($result);
            break;
            
        case 'force_sync':
            // 強制同期（チェック間隔を無視）
            $status = loadSyncStatus();
            $status['last_check'] = 0;
            saveSyncStatus($status);
            
            $result = executeAutoSync();
            sendJsonResponse($result);
            break;
            
        default:
            sendJsonResponse([
                'success' => false,
                'message' => '不正なアクション'
            ], 400);
    }
} catch (Exception $e) {
    writeLog("予期しないエラー: " . $e->getMessage(), 'ERROR');
    sendJsonResponse([
        'success' => false,
        'message' => 'サーバーエラーが発生しました',
        'error' => $e->getMessage()
    ], 500);
}
?> 