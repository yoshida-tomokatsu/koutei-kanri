<?php
/**
 * PDF同期システム - original-scarf.com から kiryu-factory.com へのファイル同期
 */

// エラーログ設定
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// 設定
define('SOURCE_PATH', __DIR__ . '/../../../original-scarf.com/public_html/wp-content/aforms-pdf');
define('TARGET_PATH', __DIR__ . '/aforms-pdf');
define('LOG_FILE', __DIR__ . '/pdf-sync.log');
define('MAX_EXECUTION_TIME', 300); // 5分
define('DEBUG_MODE', true);

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
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
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
 * ファイル同期実行
 */
function syncPDFFiles() {
    writeLog("PDF同期開始", 'INFO');
    
    // ソースパスの存在確認
    if (!is_dir(SOURCE_PATH)) {
        writeLog("ソースパスが見つかりません: " . SOURCE_PATH, 'ERROR');
        return [
            'success' => false,
            'message' => 'ソースパスが見つかりません',
            'source_path' => SOURCE_PATH
        ];
    }
    
    // ターゲットディレクトリの作成
    if (!createDirectoryRecursive(TARGET_PATH)) {
        return [
            'success' => false,
            'message' => 'ターゲットディレクトリの作成に失敗しました'
        ];
    }
    
    $stats = [
        'copied_files' => 0,
        'updated_files' => 0,
        'skipped_files' => 0,
        'errors' => 0,
        'total_size' => 0
    ];
    
    $copiedFiles = [];
    $errors = [];
    
    // 再帰的にファイルを同期
    $result = syncDirectoryRecursive(SOURCE_PATH, TARGET_PATH, $stats, $copiedFiles, $errors);
    
    writeLog("PDF同期完了 - コピー: {$stats['copied_files']}, 更新: {$stats['updated_files']}, スキップ: {$stats['skipped_files']}, エラー: {$stats['errors']}", 'INFO');
    
    return [
        'success' => $result,
        'message' => $result ? 'PDF同期が完了しました' : 'PDF同期中にエラーが発生しました',
        'stats' => $stats,
        'copied_files' => $copiedFiles,
        'errors' => $errors,
        'source_path' => SOURCE_PATH,
        'target_path' => TARGET_PATH
    ];
}

/**
 * ディレクトリ再帰同期
 */
function syncDirectoryRecursive($sourcePath, $targetPath, &$stats, &$copiedFiles, &$errors) {
    $success = true;
    
    // ソースディレクトリを開く
    if (!($handle = opendir($sourcePath))) {
        writeLog("ディレクトリを開けません: $sourcePath", 'ERROR');
        $errors[] = "ディレクトリを開けません: $sourcePath";
        $stats['errors']++;
        return false;
    }
    
    while (false !== ($item = readdir($handle))) {
        // . と .. をスキップ
        if ($item === '.' || $item === '..') {
            continue;
        }
        
        $sourceItem = $sourcePath . '/' . $item;
        $targetItem = $targetPath . '/' . $item;
        
        if (is_dir($sourceItem)) {
            // ディレクトリの場合
            if (!createDirectoryRecursive($targetItem)) {
                $success = false;
                continue;
            }
            
            // 再帰的に同期
            if (!syncDirectoryRecursive($sourceItem, $targetItem, $stats, $copiedFiles, $errors)) {
                $success = false;
            }
            
        } elseif (is_file($sourceItem)) {
            // ファイルの場合
            $result = syncFile($sourceItem, $targetItem, $stats, $copiedFiles, $errors);
            if (!$result) {
                $success = false;
            }
        }
    }
    
    closedir($handle);
    return $success;
}

/**
 * 単一ファイル同期
 */
function syncFile($sourceFile, $targetFile, &$stats, &$copiedFiles, &$errors) {
    try {
        $sourceTime = filemtime($sourceFile);
        $sourceSize = filesize($sourceFile);
        
        // ターゲットファイルの存在確認
        if (file_exists($targetFile)) {
            $targetTime = filemtime($targetFile);
            $targetSize = filesize($targetFile);
            
            // ファイルが同じかチェック（更新日時とサイズ）
            if ($sourceTime <= $targetTime && $sourceSize === $targetSize) {
                $stats['skipped_files']++;
                return true; // スキップ
            }
        }
        
        // ファイルをコピー
        if (copy($sourceFile, $targetFile)) {
            // 更新日時を保持
            touch($targetFile, $sourceTime);
            
            $stats['total_size'] += $sourceSize;
            $relativePath = str_replace(TARGET_PATH, '', $targetFile);
            
            if (file_exists($targetFile) && filemtime($targetFile) < $sourceTime) {
                $stats['updated_files']++;
                $copiedFiles[] = [
                    'path' => $relativePath,
                    'action' => 'updated',
                    'size' => $sourceSize
                ];
            } else {
                $stats['copied_files']++;
                $copiedFiles[] = [
                    'path' => $relativePath,
                    'action' => 'copied',
                    'size' => $sourceSize
                ];
            }
            
            writeLog("ファイル同期: $relativePath (" . formatBytes($sourceSize) . ")", 'INFO');
            return true;
        } else {
            $error = "ファイルコピー失敗: $sourceFile → $targetFile";
            writeLog($error, 'ERROR');
            $errors[] = $error;
            $stats['errors']++;
            return false;
        }
        
    } catch (Exception $e) {
        $error = "ファイル同期エラー: " . $e->getMessage();
        writeLog($error, 'ERROR');
        $errors[] = $error;
        $stats['errors']++;
        return false;
    }
}

/**
 * バイト数をフォーマット
 */
function formatBytes($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    
    $bytes /= pow(1024, $pow);
    
    return round($bytes, 2) . ' ' . $units[$pow];
}

/**
 * 同期状態確認
 */
function checkSyncStatus() {
    $status = [
        'source_path' => SOURCE_PATH,
        'target_path' => TARGET_PATH,
        'source_exists' => is_dir(SOURCE_PATH),
        'target_exists' => is_dir(TARGET_PATH),
        'last_sync' => null,
        'source_info' => null,
        'target_info' => null
    ];
    
    // 最終同期時刻を取得
    if (file_exists(LOG_FILE)) {
        $status['last_sync'] = date('Y-m-d H:i:s', filemtime(LOG_FILE));
    }
    
    // ソース情報
    if ($status['source_exists']) {
        $status['source_info'] = getDirectoryInfo(SOURCE_PATH);
    }
    
    // ターゲット情報
    if ($status['target_exists']) {
        $status['target_info'] = getDirectoryInfo(TARGET_PATH);
    }
    
    return $status;
}

/**
 * ディレクトリ情報取得
 */
function getDirectoryInfo($path) {
    $info = [
        'total_files' => 0,
        'total_size' => 0,
        'pdf_files' => 0,
        'last_modified' => 0
    ];
    
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS)
    );
    
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $info['total_files']++;
            $info['total_size'] += $file->getSize();
            $info['last_modified'] = max($info['last_modified'], $file->getMTime());
            
            if (strtolower($file->getExtension()) === 'pdf') {
                $info['pdf_files']++;
            }
        }
    }
    
    return $info;
}

/**
 * クリーンアップ（古いファイルの削除）
 */
function cleanupOldFiles() {
    writeLog("クリーンアップ開始", 'INFO');
    
    $deletedFiles = 0;
    $deletedSize = 0;
    
    if (!is_dir(TARGET_PATH)) {
        return [
            'success' => true,
            'message' => 'ターゲットディレクトリが存在しません',
            'deleted_files' => 0
        ];
    }
    
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(TARGET_PATH, RecursiveDirectoryIterator::SKIP_DOTS)
    );
    
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $relativePath = str_replace(TARGET_PATH, '', $file->getPathname());
            $sourcePath = SOURCE_PATH . $relativePath;
            
            // ソースファイルが存在しない場合は削除
            if (!file_exists($sourcePath)) {
                $size = $file->getSize();
                if (unlink($file->getPathname())) {
                    $deletedFiles++;
                    $deletedSize += $size;
                    writeLog("ファイル削除: $relativePath", 'INFO');
                }
            }
        }
    }
    
    writeLog("クリーンアップ完了 - 削除ファイル数: $deletedFiles", 'INFO');
    
    return [
        'success' => true,
        'message' => 'クリーンアップが完了しました',
        'deleted_files' => $deletedFiles,
        'deleted_size' => $deletedSize
    ];
}

// メイン処理
$action = $_GET['action'] ?? 'sync';

switch ($action) {
    case 'sync':
        $result = syncPDFFiles();
        sendJsonResponse($result);
        break;
        
    case 'status':
        $result = checkSyncStatus();
        sendJsonResponse(['success' => true, 'status' => $result]);
        break;
        
    case 'cleanup':
        $result = cleanupOldFiles();
        sendJsonResponse($result);
        break;
        
    case 'test':
        // テスト用：パス確認
        $result = [
            'success' => true,
            'message' => 'パス確認テスト',
            'paths' => [
                'source' => SOURCE_PATH,
                'target' => TARGET_PATH,
                'source_exists' => is_dir(SOURCE_PATH),
                'target_exists' => is_dir(TARGET_PATH),
                'current_dir' => getcwd(),
                'script_dir' => __DIR__
            ]
        ];
        sendJsonResponse($result);
        break;
        
    default:
        sendJsonResponse([
            'success' => false,
            'message' => '不正なアクション'
        ], 400);
}
?> 