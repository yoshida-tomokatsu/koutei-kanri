<?php
/**
 * PDF表示API - 同期されたPDFファイルの表示
 * 注文IDに対応するPDFファイルを検索・表示
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

// ログ制御設定
define('ENABLE_DEBUG_LOGS', false); // 本番環境では false
define('ENABLE_INFO_LOGS', false);  // 本番環境では false
define('AFORMS_PDF_PATH', __DIR__ . '/aforms-pdf');
define('LOG_FILE', __DIR__ . '/logs/pdf-viewer.log');

/**
 * ログ記録
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
 * PDFファイルを直接送信
 */
function sendPDFFile($filePath, $filename) {
    if (!file_exists($filePath)) {
        http_response_code(404);
        echo "PDFファイルが見つかりません";
        exit;
    }
    
    // PDFヘッダーを設定
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: public, max-age=3600');
    
    // ファイルを出力
    readfile($filePath);
    exit;
}

/**
 * 注文番号からフォルダ名を判定
 */
function mapOrderNumberToFolderName($orderNumber) {
    $number = intval($orderNumber);
    
    // 実際のフォルダ構造に基づくマッピング
    if ($number >= 483 && $number <= 999) {
        return '01-000';  // 00483.pdf ～ 00999.pdf
    } elseif ($number >= 1001 && $number <= 1999) {
        return '01-001';  // 01001.pdf ～ 01999.pdf
    } elseif ($number >= 2000 && $number <= 2999) {
        return '01-002';  // 02000.pdf ～ 02999.pdf (推測)
    } elseif ($number >= 3000 && $number <= 3999) {
        return '01-003';  // 03000.pdf ～ 03999.pdf (推測)
    } elseif ($number >= 4000 && $number <= 4999) {
        return '01-004';  // 04000.pdf ～ 04999.pdf (推測)
    }
    
    // フォールバック: 動的にフォルダを検索
    return findFolderForOrderNumber($number);
}

/**
 * 動的フォルダ検索（注文番号に基づいてファイルを探す）
 */
function findFolderForOrderNumber($orderNumber) {
    $possibleFilenames = [
        sprintf('%05d.pdf', $orderNumber),  // 01303.pdf
        sprintf('%04d.pdf', $orderNumber),  // 1303.pdf  
        sprintf('%03d.pdf', $orderNumber),  // 303.pdf
    ];
    
    if (is_dir(AFORMS_PDF_PATH)) {
        $folders = scandir(AFORMS_PDF_PATH);
        foreach ($folders as $folder) {
            if (preg_match('/^01-\d+$/', $folder)) {
                $folderPath = AFORMS_PDF_PATH . '/' . $folder;
                if (is_dir($folderPath)) {
                    foreach ($possibleFilenames as $filename) {
                        if (file_exists($folderPath . '/' . $filename)) {
                            writeLog("PDFファイル発見: {$folder}/{$filename} (注文番号: {$orderNumber})", 'INFO');
                            return $folder;
                        }
                    }
                }
            }
        }
    }
    
    // デフォルト（見つからない場合は最新のフォルダを推測）
    writeLog("注文番号 {$orderNumber} のフォルダが見つかりません - デフォルトを使用", 'WARNING');
    return '01-001'; // 最も可能性の高いデフォルト
}

/**
 * 複数フォルダから指定注文番号のPDFファイルを検索
 */
function searchPDFInAllFolders($orderNumber) {
    $pdfFiles = [];
    $normalizedOrderNumber = ltrim($orderNumber, '0') ?: '0';
    
    if (!is_dir(AFORMS_PDF_PATH)) {
        return $pdfFiles;
    }
    
    $folders = scandir(AFORMS_PDF_PATH);
    foreach ($folders as $folder) {
        if (!preg_match('/^01-\d+$/', $folder)) {
            continue;
        }
        
        $folderPath = AFORMS_PDF_PATH . '/' . $folder;
        if (!is_dir($folderPath)) {
            continue;
        }
        
        $files = scandir($folderPath);
        foreach ($files as $file) {
            if ($file === '.' || $file === '..') continue;
            
            $filePath = $folderPath . '/' . $file;
            if (is_file($filePath) && pathinfo($file, PATHINFO_EXTENSION) === 'pdf') {
                // ファイル名から注文番号を抽出 (00XXX.pdf形式)
                if (preg_match('/^(\d+)\.pdf$/', $file, $matches)) {
                    $fileOrderNumber = $matches[1];
                    $normalizedFileNumber = ltrim($fileOrderNumber, '0') ?: '0';
                    
                    // 注文番号が一致するかチェック
                    if ($normalizedFileNumber === $normalizedOrderNumber || 
                        $fileOrderNumber === $orderNumber ||
                        $fileOrderNumber === str_pad($orderNumber, 5, '0', STR_PAD_LEFT)) {
                        
                        $pdfFiles[] = [
                            'name' => $file,
                            'filename' => $file, // file-system.js との互換性のため
                            'originalName' => "見積書_" . $orderNumber . ".pdf",
                            'size' => filesize($filePath),
                            'lastModified' => filemtime($filePath),
                            'type' => 'application/pdf',
                            'url' => "pdf-viewer-api.php?action=view&folder=" . urlencode($folder) . "&file=" . urlencode($file),
                            'orderNumber' => $normalizedFileNumber,
                            'path' => 'aforms-pdf/' . $folder . '/' . $file,
                            'folder' => $folder
                        ];
                        
                        writeLog("PDFファイル発見: {$folder}/{$file} (注文番号: {$normalizedFileNumber})", 'INFO');
                    }
                }
            }
        }
    }
    
    return $pdfFiles;
}

try {
    $action = $_GET['action'] ?? 'list';
    $orderId = $_GET['order_id'] ?? '';
    
    writeLog("PDF Viewer API - Action: $action, Order ID: $orderId", 'INFO');
    
    switch ($action) {
        case 'list':
            // 注文IDに対応するPDFファイル一覧を取得
            if (empty($orderId)) {
                sendJsonResponse(['error' => '注文IDが指定されていません'], 400);
            }
            
            $orderNumber = str_replace('#', '', trim($orderId));
            
            // 全フォルダから該当するPDFファイルを検索
            $pdfFiles = searchPDFInAllFolders($orderNumber);
            
            if (empty($pdfFiles)) {
                writeLog("注文ID $orderId に対応するPDFファイルが見つかりません", 'WARNING');
                sendJsonResponse([
                    'quotes' => [],
                    'images' => [],
                    'message' => 'PDFファイルが見つかりません',
                    'searchPath' => AFORMS_PDF_PATH,
                    'orderNumber' => $orderNumber
                ]);
            } else {
                writeLog("注文ID $orderId のPDFファイル " . count($pdfFiles) . "件を発見", 'INFO');
                sendJsonResponse([
                    'quotes' => $pdfFiles,
                    'images' => [],
                    'message' => count($pdfFiles) . '件のPDFファイルが見つかりました'
                ]);
            }
            break;
            
        case 'view':
            // PDFファイルを表示
            $filename = $_GET['file'] ?? '';
            $folder = $_GET['folder'] ?? '';
            
            if (empty($filename)) {
                http_response_code(400);
                echo "ファイル名が指定されていません";
                exit;
            }
            
            // セキュリティチェック（ディレクトリトラバーサル対策）
            $filename = basename($filename);
            
            // フォルダが指定されている場合はそれを使用、そうでなければ自動判定
            if (!empty($folder)) {
                $folder = basename($folder); // セキュリティチェック
                if (!preg_match('/^01-\d+$/', $folder)) {
                    http_response_code(400);
                    echo "無効なフォルダ名です";
                    exit;
                }
                $filePath = AFORMS_PDF_PATH . '/' . $folder . '/' . $filename;
            } else {
                // 従来の方法（後方互換性のため）
                // ファイル名から注文番号を推測してフォルダを判定
                if (preg_match('/^(\d+)\.pdf$/', $filename, $matches)) {
                    $orderNumber = intval($matches[1]);
                    $detectedFolder = mapOrderNumberToFolderName($orderNumber);
                    $filePath = AFORMS_PDF_PATH . '/' . $detectedFolder . '/' . $filename;
                } else {
                    // 全フォルダから検索
                    $found = false;
                    if (is_dir(AFORMS_PDF_PATH)) {
                        $folders = scandir(AFORMS_PDF_PATH);
                        foreach ($folders as $testFolder) {
                            if (preg_match('/^01-\d+$/', $testFolder)) {
                                $testPath = AFORMS_PDF_PATH . '/' . $testFolder . '/' . $filename;
                                if (file_exists($testPath)) {
                                    $filePath = $testPath;
                                    $found = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!$found) {
                        writeLog("PDFファイル不存在（全フォルダ検索）: $filename", 'ERROR');
                        http_response_code(404);
                        echo "PDFファイルが見つかりません: $filename";
                        exit;
                    }
                }
            }
            
            if (!file_exists($filePath)) {
                writeLog("PDFファイル不存在: $filePath", 'ERROR');
                http_response_code(404);
                echo "PDFファイルが見つかりません: $filename";
                exit;
            }
            
            writeLog("PDFファイル表示: $filePath", 'INFO');
            sendPDFFile($filePath, $filename);
            break;
            
        case 'search':
            // 全PDFファイルの検索
            $allPdfs = [];
            
            if (is_dir(AFORMS_PDF_PATH)) {
                $folders = scandir(AFORMS_PDF_PATH);
                
                foreach ($folders as $folder) {
                    if (!preg_match('/^01-\d+$/', $folder)) {
                        continue;
                    }
                    
                    $folderPath = AFORMS_PDF_PATH . '/' . $folder;
                    if (!is_dir($folderPath)) {
                        continue;
                    }
                    
                    $files = scandir($folderPath);
                    foreach ($files as $file) {
                        if ($file === '.' || $file === '..') continue;
                        
                        $filePath = $folderPath . '/' . $file;
                        if (is_file($filePath) && pathinfo($file, PATHINFO_EXTENSION) === 'pdf') {
                            $orderNumber = '';
                            
                            // ファイル名から注文番号を抽出
                            if (preg_match('/^(\d+)\.pdf$/', $file, $matches)) {
                                $orderNumber = ltrim($matches[1], '0') ?: '0';
                            } elseif (preg_match('/quotes_\d+_(\d+)\.pdf/', $file, $matches)) {
                                $orderNumber = $matches[1];
                            }
                            
                            $allPdfs[] = [
                                'name' => $file,
                                'size' => filesize($filePath),
                                'lastModified' => filemtime($filePath),
                                'orderNumber' => $orderNumber,
                                'folder' => $folder,
                                'url' => "pdf-viewer-api.php?action=view&folder=" . urlencode($folder) . "&file=" . urlencode($file),
                                'path' => 'aforms-pdf/' . $folder . '/' . $file
                            ];
                        }
                    }
                }
            }
            
            sendJsonResponse([
                'files' => $allPdfs,
                'total' => count($allPdfs),
                'path' => AFORMS_PDF_PATH
            ]);
            break;
            
        case 'status':
            // PDF同期状況の確認
            $status = [
                'aforms_pdf_path' => AFORMS_PDF_PATH,
                'path_exists' => is_dir(AFORMS_PDF_PATH),
                'path_readable' => is_readable(AFORMS_PDF_PATH),
                'total_files' => 0,
                'pdf_files' => 0,
                'folders' => [],
                'sample_files' => []
            ];
            
            if (is_dir(AFORMS_PDF_PATH)) {
                $folders = scandir(AFORMS_PDF_PATH);
                $totalFiles = 0;
                $totalPdfFiles = 0;
                
                foreach ($folders as $folder) {
                    if (!preg_match('/^01-\d+$/', $folder)) {
                        continue;
                    }
                    
                    $folderPath = AFORMS_PDF_PATH . '/' . $folder;
                    if (!is_dir($folderPath)) {
                        continue;
                    }
                    
                    $files = scandir($folderPath);
                    $folderFileCount = count($files) - 2; // . と .. を除く
                    $folderPdfCount = 0;
                    $sampleFiles = [];
                    
                    foreach ($files as $file) {
                        if ($file === '.' || $file === '..') continue;
                        
                        $filePath = $folderPath . '/' . $file;
                        if (is_file($filePath) && pathinfo($file, PATHINFO_EXTENSION) === 'pdf') {
                            $folderPdfCount++;
                            $totalPdfFiles++;
                            
                            if (count($sampleFiles) < 3) {
                                $sampleFiles[] = [
                                    'name' => $file,
                                    'size' => filesize($filePath),
                                    'modified' => date('Y-m-d H:i:s', filemtime($filePath))
                                ];
                            }
                        }
                    }
                    
                    $totalFiles += $folderFileCount;
                    
                    $status['folders'][] = [
                        'name' => $folder,
                        'path' => $folderPath,
                        'total_files' => $folderFileCount,
                        'pdf_files' => $folderPdfCount,
                        'sample_files' => $sampleFiles
                    ];
                }
                
                $status['total_files'] = $totalFiles;
                $status['pdf_files'] = $totalPdfFiles;
                
                // 全体のサンプルファイルを生成
                foreach ($status['folders'] as $folderInfo) {
                    foreach ($folderInfo['sample_files'] as $sampleFile) {
                        if (count($status['sample_files']) < 5) {
                            $status['sample_files'][] = array_merge($sampleFile, [
                                'folder' => $folderInfo['name']
                            ]);
                        }
                    }
                }
            }
            
            sendJsonResponse($status);
            break;
            
        default:
            sendJsonResponse(['error' => '無効なアクション'], 400);
    }
    
} catch (Exception $e) {
    writeLog("PDF Viewer API エラー: " . $e->getMessage(), 'ERROR');
    sendJsonResponse(['error' => 'サーバーエラーが発生しました: ' . $e->getMessage()], 500);
}
?> 