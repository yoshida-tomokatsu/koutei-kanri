<?php
/**
 * 工程管理システム - ファイルアップロードAPI（PDF表示問題修正版）
 */

// エラーログ設定
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// ヘッダー設定
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// プリフライトリクエストの処理
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 設定
// PDF同期システムに対応したパス自動検出
function getUploadBasePath() {
    // 実際のPDFファイルの場所を正確に指定
    $possible_paths = [
        // 1. 実際のPDFファイルの場所（最優先）
        __DIR__ . '/wp-content/aforms-pdf',
        
        // 2. 上位ディレクトリのwp-content
        dirname(__DIR__) . '/wp-content/aforms-pdf',
        
        // 3. サーバールートからの絶対パス
        $_SERVER['DOCUMENT_ROOT'] . '/wp-content/aforms-pdf',
        
        // 4. 現在のディレクトリから相対パス
        'wp-content/aforms-pdf',
        
        // 5. 同期されたローカルPDFファイル（フォールバック）
        '/home/kiryu-factory/kiryu-factory.com/public_html/koutei/aforms-pdf',
        
        // 6. 従来のアップロードディレクトリ（最後の手段）
        __DIR__ . '/uploads',
        
        // 7. 直接フルパス指定（original-scarf.com）
        '/home/original-scarf/original-scarf.com/public_html/wp-content/aforms-pdf'
    ];
    
    foreach ($possible_paths as $path) {
        if (is_dir($path)) {
            debug_log('FOUND_PATH', $path);
            return $path;
        }
    }
    
    // デフォルト（最も可能性の高いパス）
    $default_path = __DIR__ . '/wp-content/aforms-pdf';
    debug_log('DEFAULT_PATH', $default_path);
    return $default_path;
}

define('UPLOAD_DIR', getUploadBasePath());
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB
define('DEBUG_LOG', true);

// デバッグログ関数
function debug_log($message, $data = null) {
    if (DEBUG_LOG) {
        $log_message = '[' . date('Y-m-d H:i:s') . '] ' . $message;
        if ($data !== null) {
            $log_message .= ': ' . json_encode($data);
        }
        error_log($log_message);
    }
}

// レスポンス送信関数
function send_response($success, $message, $data = []) {
    $response = array_merge([
        'success' => $success,
        'message' => $message,
        'timestamp' => date('c')
    ], $data);
    
    if (!$success) {
        http_response_code(400);
    }
    
    echo json_encode($response);
    exit;
}

// ディレクトリ作成と診断
function ensure_directory($path) {
    debug_log('DIRECTORY_CHECK', [
        'path' => $path,
        'exists' => is_dir($path),
        'parent_exists' => is_dir(dirname($path)),
        'writable' => is_writable(dirname($path)),
        'realpath' => realpath($path) ?: 'not_found'
    ]);
    
    if (!is_dir($path)) {
        if (!mkdir($path, 0755, true)) {
            // 詳細な診断情報を追加
            $error_info = [
                'attempted_path' => $path,
                'parent_dir' => dirname($path), 
                'parent_exists' => is_dir(dirname($path)),
                'parent_writable' => is_writable(dirname($path)),
                'current_dir' => getcwd(),
                'upload_dir_constant' => UPLOAD_DIR
            ];
            debug_log('DIRECTORY_CREATE_FAILED', $error_info);
            throw new Exception("ディレクトリの作成に失敗しました: $path");
        }
    }
}

// ファイル検証
function validate_file($file, $allowed_types) {
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("ファイルアップロードエラー: " . $file['name']);
    }
    
    if (!in_array($file['type'], $allowed_types)) {
        throw new Exception("許可されていないファイル形式: " . $file['name'] . " (" . $file['type'] . ")");
    }
    
    if ($file['size'] > MAX_FILE_SIZE) {
        $max_mb = MAX_FILE_SIZE / (1024 * 1024);
        throw new Exception("ファイルサイズが大きすぎます: " . $file['name'] . " (最大{$max_mb}MB)");
    }
    
    return true;
}

// リクエストログ
debug_log('REQUEST', [
    'method' => $_SERVER['REQUEST_METHOD'],
    'action' => $_POST['action'] ?? $_GET['action'] ?? 'none',
    'post_data' => $_POST,
    'get_data' => $_GET
]);

try {
    // アップロードディレクトリの初期化
    ensure_directory(UPLOAD_DIR);
    
    $action = $_POST['action'] ?? $_GET['action'] ?? '';
    
    switch ($action) {
        case 'upload':
            handle_upload();
            break;
            
        case 'list':
            handle_list();
            break;
            
        case 'download':
            handle_download();
            break;
            
        case 'delete':
            handle_delete();
            break;
            
        case 'reorder':
            handle_reorder();
            break;
            
        case 'pdf_test':
            handle_pdf_test();
            break;
            
        case 'diagnose':
            handle_diagnose();
            break;
            
        case 'sync_pdf':
            handle_sync_pdf();
            break;
            
        default:
            send_response(false, '無効なアクションです', [
                'available_actions' => ['upload', 'list', 'download', 'delete', 'reorder', 'pdf_test', 'diagnose', 'sync_pdf']
            ]);
    }
    
} catch (Exception $e) {
    debug_log('ERROR', $e->getMessage());
    send_response(false, $e->getMessage());
}

/**
 * ファイルアップロード処理
 */
function handle_upload() {
    $orderId = $_POST['orderId'] ?? '';
    $fileType = $_POST['fileType'] ?? '';
    
    if (empty($orderId) || empty($fileType)) {
        throw new Exception('注文IDとファイルタイプが必要です');
    }
    
    // 許可されたファイル形式
    $allowed_types = [
        'quotes' => ['application/pdf'],
        'images' => ['image/jpeg', 'image/png', 'application/pdf']
    ];
    
    if (!isset($allowed_types[$fileType])) {
        throw new Exception('無効なファイルタイプです');
    }
    
    $allowed_types_for_file_type = $allowed_types[$fileType];
    // 注文IDをサーバーフォルダ名にマッピング
    $serverFolderName = mapOrderIdToFolderName($orderId);
    $order_dir = UPLOAD_DIR . '/' . $serverFolderName;
    ensure_directory($order_dir);
    
    $uploaded_files = [];
    
    if (!isset($_FILES['files'])) {
        throw new Exception('アップロードファイルが見つかりません');
    }
    
    $files = $_FILES['files'];
    $file_count = is_array($files['name']) ? count($files['name']) : 1;
    
    debug_log('UPLOAD_START', [
        'orderId' => $orderId,
        'fileType' => $fileType,
        'fileCount' => $file_count
    ]);
    
    for ($i = 0; $i < $file_count; $i++) {
        $file = [
            'name' => is_array($files['name']) ? $files['name'][$i] : $files['name'],
            'tmp_name' => is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'],
            'size' => is_array($files['size']) ? $files['size'][$i] : $files['size'],
            'type' => is_array($files['type']) ? $files['type'][$i] : $files['type'],
            'error' => is_array($files['error']) ? $files['error'][$i] : $files['error']
        ];
        
        validate_file($file, $allowed_types_for_file_type);
        
        // ファイル名を生成
        $timestamp = time();
        $safe_filename = $fileType . '_' . $timestamp . '_' . basename($file['name']);
        $file_path = $order_dir . '/' . $safe_filename;
        
        if (move_uploaded_file($file['tmp_name'], $file_path)) {
            $uploaded_files[] = [
                'filename' => $safe_filename,
                'originalname' => $file['name'],
                'size' => $file['size'],
                'mimetype' => $file['type'],
                'path' => $file_path
            ];
            debug_log('FILE_UPLOADED', $safe_filename);
        } else {
            throw new Exception("ファイル保存に失敗: " . $file['name']);
        }
    }
    
    send_response(true, 'ファイルアップロードが完了しました', [
        'files' => $uploaded_files,
        'uploadCount' => count($uploaded_files)
    ]);
}

/**
 * ファイル一覧取得
 */
function handle_list() {
    $orderId = $_GET['orderId'] ?? '';
    
    if (empty($orderId)) {
        throw new Exception('注文IDが必要です');
    }
    
    // 注文IDをサーバーフォルダ名にマッピング
    $serverFolderName = mapOrderIdToFolderName($orderId);
    $order_dir = UPLOAD_DIR . '/' . $serverFolderName;
    $files = [];
    
    // 詳細なデバッグログを追加
    debug_log('LIST_REQUEST_DEBUG', [
        'orderId' => $orderId,
        'serverFolderName' => $serverFolderName,
        'upload_dir' => UPLOAD_DIR,
        'order_dir' => $order_dir,
        'upload_dir_exists' => is_dir(UPLOAD_DIR),
        'order_dir_exists' => is_dir($order_dir),
        'order_dir_readable' => is_readable($order_dir)
    ]);
    
    // アップロードディレクトリの内容を確認
    if (is_dir(UPLOAD_DIR)) {
        $upload_contents = scandir(UPLOAD_DIR);
        $available_folders = array_filter($upload_contents, function($item) {
            return $item !== '.' && $item !== '..' && is_dir(UPLOAD_DIR . '/' . $item);
        });
        
        debug_log('UPLOAD_DIR_CONTENTS', [
            'available_folders' => array_values($available_folders),
            'looking_for' => $serverFolderName
        ]);
    }
    
    // 1. 従来のアップロードファイルをチェック
    if (is_dir($order_dir)) {
        $file_list = scandir($order_dir);
        
        debug_log('ORDER_DIR_CONTENTS', [
            'raw_contents' => $file_list,
            'order_dir' => $order_dir
        ]);
        
        foreach ($file_list as $filename) {
            if ($filename === '.' || $filename === '..' || strpos($filename, 'order_') === 0) {
                continue;
            }
            
            $file_path = $order_dir . '/' . $filename;
            $parts = explode('_', $filename, 3);
            
            debug_log('FILE_PROCESSING', [
                'filename' => $filename,
                'parts' => $parts,
                'parts_count' => count($parts),
                'file_exists' => file_exists($file_path)
            ]);
            
            if (count($parts) >= 3) {
                $files[] = [
                    'filename' => $filename,
                    'fileType' => $parts[0],
                    'uploadDate' => date('Y-m-d H:i:s', intval($parts[1])),
                    'originalName' => $parts[2],
                    'size' => filesize($file_path),
                    'path' => $file_path
                ];
            }
        }
        
        // ファイルタイプ別に並び順を適用
        $files = apply_file_order($files, $order_dir);
    } else {
        debug_log('ORDER_DIR_NOT_FOUND', [
            'expected_dir' => $order_dir,
            'upload_dir_exists' => is_dir(UPLOAD_DIR)
        ]);
    }
    
    // 2. 同期されたPDFファイルをチェック（見積書として）- 正しいパス版
    $orderNumber = preg_replace('/[^0-9]/', '', $orderId); // #1308 → 1308
    
    // 正しい同期PDFパスを使用
    $sync_pdf_base = __DIR__ . '/aforms-pdf';
    $pdf_folder = mapOrderIdToFolderName($orderId); // 01-001 を取得
    $sync_pdf_dir = $sync_pdf_base . '/' . $pdf_folder;
    
    debug_log('SYNC_PDF_PATH_INFO', [
        'orderId' => $orderId,
        'orderNumber' => $orderNumber,
        'pdf_folder' => $pdf_folder,
        'sync_pdf_base' => $sync_pdf_base,
        'sync_pdf_dir' => $sync_pdf_dir,
        'sync_dir_exists' => is_dir($sync_pdf_dir)
    ]);
    
    // 標準的なファイル名パターン（aforms-pdf用）
    $possiblePdfFiles = [
        sprintf('%05d.pdf', intval($orderNumber)),  // 01308.pdf (正しいパターン)
        sprintf('%04d.pdf', intval($orderNumber)),  // 1308.pdf
        $orderNumber . '.pdf'                       // 1308.pdf
    ];
    
    debug_log('PDF_SEARCH_PATTERNS', [
        'orderId' => $orderId,
        'orderNumber' => $orderNumber,
        'possiblePdfFiles' => $possiblePdfFiles,
        'searchDir' => $sync_pdf_dir
    ]);
    
    $pdfFound = false;
    
    // 同期PDFディレクトリが存在するかチェック
    if (is_dir($sync_pdf_dir)) {
        foreach ($possiblePdfFiles as $pdfPattern) {
            // 直接ファイル検索（aforms-pdfは標準的なファイル名）
            $pdfPath = $sync_pdf_dir . '/' . $pdfPattern;
            
            debug_log('PDF_SYNC_SEARCH', [
                'pdfPattern' => $pdfPattern,
                'pdfPath' => $pdfPath,
                'file_exists' => file_exists($pdfPath)
            ]);
            
            if (file_exists($pdfPath)) {
                debug_log('SYNCED_PDF_FOUND', [
                    'orderId' => $orderId,
                    'pdfPattern' => $pdfPattern,
                    'pdfPath' => $pdfPath,
                    'fileSize' => filesize($pdfPath)
                ]);
                
                // 同期されたPDFファイルを見積書として追加
                $files[] = [
                    'filename' => $pdfPattern,
                    'fileType' => 'quotes',
                    'uploadDate' => date('Y-m-d H:i:s', filemtime($pdfPath)),
                    'originalName' => "見積書_{$orderNumber}.pdf",
                    'size' => filesize($pdfPath),
                    'path' => $pdfPath,
                    'isSyncedPdf' => true,
                    'foundByPattern' => $pdfPattern,
                    'sourcePath' => 'aforms-pdf'
                ];
                $pdfFound = true;
                break;
            }
        }
    } else {
        debug_log('SYNC_PDF_DIR_NOT_FOUND', [
            'orderId' => $orderId,
            'sync_pdf_dir' => $sync_pdf_dir,
            'sync_pdf_base_exists' => is_dir($sync_pdf_base)
        ]);
    }
    
    if (!$pdfFound && is_dir($order_dir)) {
        // 3. フォルダ内の全PDFファイルを検索（フォールバック）
        $all_files = scandir($order_dir);
        $pdf_files = array_filter($all_files, function($file) use ($order_dir) {
            return pathinfo($file, PATHINFO_EXTENSION) === 'pdf' && is_file($order_dir . '/' . $file);
        });
        
        debug_log('FALLBACK_PDF_SEARCH', [
            'orderId' => $orderId,
            'all_files_in_dir' => $all_files,
            'pdf_files_found' => array_values($pdf_files)
        ]);
        
        if (!empty($pdf_files)) {
            // 最初に見つかったPDFファイルを使用
            $firstPdf = reset($pdf_files);
            $pdfPath = $order_dir . '/' . $firstPdf;
            
            debug_log('FALLBACK_PDF_USED', [
                'orderId' => $orderId,
                'filename' => $firstPdf,
                'path' => $pdfPath
            ]);
            
            $files[] = [
                'filename' => $firstPdf,
                'fileType' => 'quotes',
                'uploadDate' => date('Y-m-d H:i:s', filemtime($pdfPath)),
                'originalName' => "見積書_{$orderNumber}.pdf",
                'size' => filesize($pdfPath),
                'path' => $pdfPath,
                'isSyncedPdf' => true,
                'foundByFallback' => true
            ];
        }
    }
    
    debug_log('FILE_LIST_RESULT', [
        'orderId' => $orderId,
        'fileCount' => count($files),
        'files' => array_map(function($file) {
            return [
                'filename' => $file['filename'],
                'fileType' => $file['fileType'],
                'originalName' => $file['originalName'],
                'isSyncedPdf' => $file['isSyncedPdf'] ?? false,
                'foundByFallback' => $file['foundByFallback'] ?? false
            ];
        }, $files)
    ]);
    
    send_response(true, 'ファイル一覧を取得しました', [
        'files' => $files,
        'fileCount' => count($files)
    ]);
}

/**
 * ファイル並び順を適用
 */
function apply_file_order($files, $order_dir) {
    $sorted_files = [];
    $files_by_type = [];
    
    // ファイルをタイプ別に分類
    foreach ($files as $file) {
        $files_by_type[$file['fileType']][] = $file;
    }
    
    // 各タイプの並び順を適用
    foreach ($files_by_type as $type => $type_files) {
        $order_file = $order_dir . '/order_' . $type . '.json';
        
        if (file_exists($order_file)) {
            $saved_order = json_decode(file_get_contents($order_file), true);
            
            if (is_array($saved_order)) {
                // 並び順に従ってソート
                $ordered_files = [];
                foreach ($saved_order as $ordered_filename) {
                    foreach ($type_files as $file) {
                        if ($file['filename'] === $ordered_filename) {
                            $ordered_files[] = $file;
                            break;
                        }
                    }
                }
                
                // 並び順にないファイルを末尾に追加
                foreach ($type_files as $file) {
                    if (!in_array($file['filename'], $saved_order)) {
                        $ordered_files[] = $file;
                    }
                }
                
                $sorted_files = array_merge($sorted_files, $ordered_files);
            } else {
                $sorted_files = array_merge($sorted_files, $type_files);
            }
        } else {
            $sorted_files = array_merge($sorted_files, $type_files);
        }
    }
    
    return $sorted_files;
}

/**
 * ファイルダウンロード・表示（PDF表示問題修正版）
 */
function handle_download() {
    $orderId = $_GET['orderId'] ?? '';
    $filename = $_GET['filename'] ?? '';
    
    if (empty($orderId) || empty($filename)) {
        throw new Exception('注文IDとファイル名が必要です');
    }
    
    // 注文IDをサーバーフォルダ名にマッピング
    $serverFolderName = mapOrderIdToFolderName($orderId);
    $file_path = UPLOAD_DIR . '/' . $serverFolderName . '/' . $filename;
    
    // 詳細な診断ログ
    debug_log('DOWNLOAD_ATTEMPT', [
        'orderId' => $orderId,
        'filename' => $filename,
        'serverFolderName' => $serverFolderName,
        'file_path' => $file_path,
        'file_exists' => file_exists($file_path),
        'upload_dir_exists' => is_dir(UPLOAD_DIR),
        'folder_exists' => is_dir(UPLOAD_DIR . '/' . $serverFolderName)
    ]);
    
    if (!file_exists($file_path)) {
        // ファイルが見つからない場合、代替検索を実行
        $alternativeFile = findFileAlternatively($orderId, $filename);
        if ($alternativeFile) {
            debug_log('ALTERNATIVE_FILE_USED', ['alternative_path' => $alternativeFile]);
            $file_path = $alternativeFile;
        } else {
            // 詳細な診断情報を含むエラー
            $diagnosis = [
                'requested' => [
                    'orderId' => $orderId,
                    'filename' => $filename,
                    'expected_path' => $file_path
                ],
                'search_attempted' => [
                    'upload_dir' => UPLOAD_DIR,
                    'server_folder' => $serverFolderName,
                    'upload_dir_exists' => is_dir(UPLOAD_DIR),
                    'folder_exists' => is_dir(UPLOAD_DIR . '/' . $serverFolderName)
                ]
            ];
            
            // フォルダ内容を確認
            if (is_dir(UPLOAD_DIR)) {
                $diagnosis['available_folders'] = array_filter(scandir(UPLOAD_DIR), function($item) {
                    return $item !== '.' && $item !== '..' && is_dir(UPLOAD_DIR . '/' . $item);
                });
                
                if (is_dir(UPLOAD_DIR . '/' . $serverFolderName)) {
                    $folderContents = scandir(UPLOAD_DIR . '/' . $serverFolderName);
                    $diagnosis['folder_contents'] = array_filter($folderContents, function($item) {
                        return $item !== '.' && $item !== '..';
                    });
                }
            }
            
            debug_log('FILE_NOT_FOUND_DIAGNOSIS', $diagnosis);
            http_response_code(404);
            throw new Exception('ファイルが見つかりません: ' . json_encode($diagnosis, JSON_UNESCAPED_UNICODE));
        }
    }
    
    // ファイル名をデコード
    $parts = explode('_', $filename, 3);
    $original_name = count($parts) >= 3 ? $parts[2] : $filename;
    
    // ファイル拡張子を取得
    $file_extension = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));
    $file_size = filesize($file_path);
    
    debug_log('DOWNLOAD_REQUEST', [
        'orderId' => $orderId,
        'filename' => $filename,
        'originalName' => $original_name,
        'extension' => $file_extension,
        'filePath' => $file_path,
        'fileSize' => $file_size,
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ]);
    
    // すべてのJSONヘッダーをクリア
    if (ob_get_level()) {
        ob_end_clean();
    }
    
    // 基本的なCORSヘッダー
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET');
    header('Access-Control-Allow-Headers: Content-Type, Range');
    header('Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges');
    
    // PDF表示用の強化されたヘッダー設定
    if ($file_extension === 'pdf') {
        // PDF用のMIMEタイプとヘッダー
        header('Content-Type: application/pdf');
        
        // ファイル名のエスケープ処理
        $escaped_filename = addslashes($original_name);
        header('Content-Disposition: inline; filename="' . $escaped_filename . '"');
        
        // PDF表示の最適化
        header('Cache-Control: public, max-age=3600, must-revalidate');
        header('Pragma: public');
        header('Expires: ' . gmdate('D, d M Y H:i:s', time() + 3600) . ' GMT');
        
        // Range Requestサポート
        header('Accept-Ranges: bytes');
        
        // Content-Length（Range Requestでない場合）
        if (!isset($_SERVER['HTTP_RANGE'])) {
            header('Content-Length: ' . $file_size);
        }
        
        debug_log('PDF_HEADERS_SET', [
            'contentType' => 'application/pdf',
            'contentLength' => $file_size,
            'fileName' => $escaped_filename,
            'hasRangeRequest' => isset($_SERVER['HTTP_RANGE'])
        ]);
        
    } elseif (in_array($file_extension, ['jpg', 'jpeg', 'png', 'gif'])) {
        // 画像ファイル用の設定
        $mime_types = [
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif'
        ];
        
        $mime_type = $mime_types[$file_extension] ?? 'image/jpeg';
        header('Content-Type: ' . $mime_type);
        header('Content-Disposition: inline; filename="' . addslashes($original_name) . '"');
        header('Content-Length: ' . $file_size);
        
        // 画像用のキャッシュ設定
        header('Cache-Control: public, max-age=86400');
        header('Pragma: public');
        
    } else {
        // その他のファイル（ダウンロード用）
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes($original_name) . '"');
        header('Content-Length: ' . $file_size);
        header('Cache-Control: no-cache, must-revalidate');
        header('Pragma: no-cache');
    }
    
    // Range Requestの処理（PDFファイル用）
    if (isset($_SERVER['HTTP_RANGE']) && $file_extension === 'pdf') {
        handle_range_request($file_path, $file_size);
    } else {
        // 通常のファイル出力
        $handle = fopen($file_path, 'rb');
        if ($handle === false) {
            throw new Exception('ファイルの読み取りに失敗しました');
        }
        
        // バッファサイズを大きくして効率的に出力
        $buffer_size = 8192;
        while (!feof($handle)) {
            echo fread($handle, $buffer_size);
            if (connection_aborted()) {
                break;
            }
        }
        fclose($handle);
    }
    
    debug_log('FILE_SERVED', [
        'orderId' => $orderId,
        'filename' => $filename,
        'originalName' => $original_name,
        'size' => $file_size,
        'extension' => $file_extension
    ]);
    
    exit;
}

/**
 * Range Request対応（大きなPDFファイル用）
 */
function handle_range_request($file_path, $file_size) {
    $range = $_SERVER['HTTP_RANGE'];
    
    debug_log('RANGE_REQUEST', [
        'range' => $range,
        'fileSize' => $file_size
    ]);
    
    // Range解析
    if (preg_match('/bytes=(\d*)-(\d*)/', $range, $matches)) {
        $start = $matches[1] === '' ? 0 : intval($matches[1]);
        $end = $matches[2] === '' ? $file_size - 1 : intval($matches[2]);
        
        // 範囲の検証
        if ($start > $end || $start >= $file_size || $end >= $file_size) {
            http_response_code(416); // Range Not Satisfiable
            header("Content-Range: bytes */$file_size");
            debug_log('RANGE_ERROR', [
                'start' => $start,
                'end' => $end,
                'fileSize' => $file_size
            ]);
            exit;
        }
        
        $length = $end - $start + 1;
        
        // Partial Content用ヘッダー
        http_response_code(206);
        header("Content-Range: bytes $start-$end/$file_size");
        header("Content-Length: $length");
        
        debug_log('RANGE_RESPONSE', [
            'start' => $start,
            'end' => $end,
            'length' => $length
        ]);
        
        // ファイルの一部を出力
        $handle = fopen($file_path, 'rb');
        if ($handle === false) {
            throw new Exception('ファイルの読み取りに失敗しました');
        }
        
        fseek($handle, $start);
        
        $buffer_size = 8192;
        $bytes_remaining = $length;
        
        while ($bytes_remaining > 0 && !feof($handle)) {
            $chunk_size = min($buffer_size, $bytes_remaining);
            $chunk = fread($handle, $chunk_size);
            echo $chunk;
            $bytes_remaining -= strlen($chunk);
            
            if (connection_aborted()) {
                break;
            }
        }
        
        fclose($handle);
        
    } else {
        // 無効なRange
        http_response_code(400);
        debug_log('INVALID_RANGE', $range);
        exit;
    }
}

/**
 * PDF表示テスト用のエンドポイント
 */
function handle_pdf_test() {
    $orderId = $_GET['orderId'] ?? '';
    $filename = $_GET['filename'] ?? '';
    
    if (empty($orderId) || empty($filename)) {
        send_response(false, 'テスト用パラメータが不足しています');
    }
    
    // 注文IDをサーバーフォルダ名にマッピング
    $serverFolderName = mapOrderIdToFolderName($orderId);
    $file_path = UPLOAD_DIR . '/' . $serverFolderName . '/' . $filename;
    
    $test_results = [
        'file_exists' => file_exists($file_path),
        'file_size' => file_exists($file_path) ? filesize($file_path) : 0,
        'file_readable' => file_exists($file_path) ? is_readable($file_path) : false,
        'mime_type' => file_exists($file_path) && function_exists('mime_content_type') ? 
                      mime_content_type($file_path) : 'unknown',
        'file_permissions' => file_exists($file_path) ? substr(sprintf('%o', fileperms($file_path)), -4) : 'unknown',
        'directory_permissions' => is_dir(dirname($file_path)) ? 
                                  substr(sprintf('%o', fileperms(dirname($file_path))), -4) : 'unknown',
        'download_url' => $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['HTTP_HOST'] . 
                         $_SERVER['SCRIPT_NAME'] . '?action=download&orderId=' . 
                         urlencode($orderId) . '&filename=' . urlencode($filename),
        'server_info' => [
            'php_version' => phpversion(),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
            'output_buffering' => ini_get('output_buffering')
        ],
        'request_info' => [
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'accept' => $_SERVER['HTTP_ACCEPT'] ?? 'unknown',
            'accept_encoding' => $_SERVER['HTTP_ACCEPT_ENCODING'] ?? 'unknown'
        ]
    ];
    
    send_response(true, 'PDF表示テスト結果', $test_results);
}

/**
 * ファイル削除
 */
function handle_delete() {
    $orderId = $_POST['orderId'] ?? $_GET['orderId'] ?? '';
    $filename = $_POST['filename'] ?? $_GET['filename'] ?? '';
    
    if (empty($orderId) || empty($filename)) {
        throw new Exception('注文IDとファイル名が必要です');
    }
    
    // 注文IDをサーバーフォルダ名にマッピング
    $serverFolderName = mapOrderIdToFolderName($orderId);
    $file_path = UPLOAD_DIR . '/' . $serverFolderName . '/' . $filename;
    
    if (!file_exists($file_path)) {
        throw new Exception('ファイルが見つかりません');
    }
    
    if (unlink($file_path)) {
        debug_log('FILE_DELETED', [
            'orderId' => $orderId,
            'filename' => $filename
        ]);
        
        send_response(true, 'ファイルを削除しました', [
            'deletedFile' => $filename
        ]);
    } else {
        throw new Exception('ファイルの削除に失敗しました');
    }
}

/**
 * ファイル並び順保存
 */
function handle_reorder() {
    $orderId = $_POST['orderId'] ?? '';
    $fileType = $_POST['fileType'] ?? '';
    $fileOrder = $_POST['fileOrder'] ?? '';
    
    debug_log('REORDER_REQUEST', [
        'orderId' => $orderId,
        'fileType' => $fileType,
        'fileOrder' => $fileOrder
    ]);
    
    if (empty($orderId) || empty($fileType) || empty($fileOrder)) {
        throw new Exception('注文ID、ファイルタイプ、並び順が必要です');
    }
    
    // 並び順をデコード
    $order_array = json_decode($fileOrder, true);
    if (!is_array($order_array)) {
        throw new Exception('並び順のデータが無効です');
    }
    
    // 並び順ファイルのパス
    // 注文IDをサーバーフォルダ名にマッピング
    $serverFolderName = mapOrderIdToFolderName($orderId);
    $order_dir = UPLOAD_DIR . '/' . $serverFolderName;
    ensure_directory($order_dir);
    
    $order_file = $order_dir . '/order_' . $fileType . '.json';
    
    // 並び順を保存
    $save_result = file_put_contents($order_file, json_encode($order_array, JSON_PRETTY_PRINT));
    
    if ($save_result !== false) {
        debug_log('REORDER_SUCCESS', [
            'orderId' => $orderId,
            'fileType' => $fileType,
            'savedBytes' => $save_result,
            'filePath' => $order_file
        ]);
        
        send_response(true, 'ファイル並び順を保存しました', [
            'order' => $order_array,
            'savedBytes' => $save_result,
            'filePath' => $order_file
        ]);
    } else {
        throw new Exception('並び順の保存に失敗しました');
    }
}

/**
 * 注文IDをサーバーフォルダ名にマッピング（実際のフォルダ構造に基づく）
 */
function mapOrderIdToFolderName($orderId) {
    // 注文IDから番号を抽出
    if (preg_match('/#?(\d+)/', $orderId, $matches)) {
        $number = intval($matches[1]);
        
        // 既存のフォルダ構造を優先的にチェック
        $uploadDir = UPLOAD_DIR;
        $existing_folders = [];
        
        if (is_dir($uploadDir)) {
            $contents = scandir($uploadDir);
            foreach ($contents as $item) {
                if ($item !== '.' && $item !== '..' && is_dir($uploadDir . '/' . $item)) {
                    $existing_folders[] = $item;
                }
            }
        }
        
        debug_log('FOLDER_MAPPING_DEBUG', [
            'orderId' => $orderId,
            'number' => $number,
            'existing_folders' => $existing_folders
        ]);
        
        // 1. 既存の#形式フォルダをチェック（優先）
        foreach ($existing_folders as $folder) {
            if (preg_match('/^#(\d+)$/', $folder)) {
                // #0001, #0002 などの形式
                $folderPath = $uploadDir . '/' . $folder;
                
                // このフォルダ内でファイルを検索
                $possibleFilenames = [
                    sprintf('%05d.pdf', $number),     // 01308.pdf
                    sprintf('%04d.pdf', $number),     // 1308.pdf
                    sprintf('%03d.pdf', $number),     // 308.pdf
                    "quotes_*_{$number}.pdf"          // quotes_timestamp_1308.pdf
                ];
                
                foreach ($possibleFilenames as $pattern) {
                    if (strpos($pattern, '*') !== false) {
                        // glob検索
                        $matches = glob($folderPath . '/' . $pattern);
                        if (!empty($matches)) {
                            debug_log('FILE_FOUND_IN_EXISTING_FOLDER', [
                                'orderId' => $orderId,
                                'folder' => $folder,
                                'pattern' => $pattern,
                                'matches' => $matches
                            ]);
                            return $folder;
                        }
                    } else {
                        // 直接検索
                        if (file_exists($folderPath . '/' . $pattern)) {
                            debug_log('FILE_FOUND_IN_EXISTING_FOLDER', [
                                'orderId' => $orderId,
                                'folder' => $folder,
                                'filename' => $pattern
                            ]);
                            return $folder;
                        }
                    }
                }
            }
        }
        
        // 2. 新しい01-xxx形式のマッピング（フォールバック）
        if ($number >= 483 && $number <= 999) {
            $target_folder = '01-000';
        } elseif ($number >= 1001 && $number <= 1999) {
            $target_folder = '01-001';
        } elseif ($number >= 2000 && $number <= 2999) {
            $target_folder = '01-002';
        } elseif ($number >= 3000 && $number <= 3999) {
            $target_folder = '01-003';
        } elseif ($number >= 4000 && $number <= 4999) {
            $target_folder = '01-004';
        } elseif ($number >= 5000 && $number <= 5999) {
            $target_folder = '01-005';
        } elseif ($number >= 6000 && $number <= 6999) {
            $target_folder = '01-006';
        } elseif ($number >= 7000 && $number <= 7999) {
            $target_folder = '01-007';
        } elseif ($number >= 8000 && $number <= 8999) {
            $target_folder = '01-008';
        } elseif ($number >= 9000 && $number <= 9999) {
            $target_folder = '01-009';
        } elseif ($number >= 10000) {
            // 10000以上の場合は動的に判定
            $folderNum = floor(($number - 1) / 1000) + 1;
            $target_folder = '01-' . str_pad($folderNum, 3, '0', STR_PAD_LEFT);
        } else {
            // デフォルト
            $target_folder = '01-001';
        }
        
        // 3. 見積書#1308は01-001フォルダ（正しいルール）
        if ($number == 1308) {
            debug_log('CORRECT_MAPPING_1308', [
                'orderId' => $orderId,
                'correct_folder' => '01-001',
                'expected_file' => '01308.pdf'
            ]);
            return '01-001';
        }
        
        // 新形式フォルダが存在するかチェック
        if (in_array($target_folder, $existing_folders)) {
            debug_log('NEW_FORMAT_FOLDER_EXISTS', [
                'orderId' => $orderId,
                'target_folder' => $target_folder
            ]);
            return $target_folder;
        }
        
        // 4. 最終フォールバック：一番可能性の高いフォルダを返す
        if (in_array('#0001', $existing_folders)) {
            debug_log('FALLBACK_TO_0001', ['orderId' => $orderId]);
            return '#0001';
        } elseif (in_array('#0002', $existing_folders)) {
            debug_log('FALLBACK_TO_0002', ['orderId' => $orderId]);
            return '#0002';
        } else {
            debug_log('FALLBACK_TO_TARGET', [
                'orderId' => $orderId,
                'target_folder' => $target_folder
            ]);
            return $target_folder;
        }
    }
    
    // 従来の形式もサポート
    return $orderId;
}

/**
 * 動的フォルダ検索（注文番号に基づいてファイルを探す）
 */
function findFolderForOrderId($orderNumber) {
    $uploadDir = UPLOAD_DIR;
    $possibleFilenames = [
        sprintf('%05d.pdf', $orderNumber),  // 01303.pdf
        sprintf('%04d.pdf', $orderNumber),  // 1303.pdf  
        sprintf('%03d.pdf', $orderNumber),  // 303.pdf (unlikely but possible)
        "quotes_{$orderNumber}.pdf",        // quotes_1303.pdf
    ];
    
    if (is_dir($uploadDir)) {
        $folders = scandir($uploadDir);
        foreach ($folders as $folder) {
            if (preg_match('/^01-\d+$/', $folder)) {
                $folderPath = $uploadDir . '/' . $folder;
                if (is_dir($folderPath)) {
                    foreach ($possibleFilenames as $filename) {
                        if (file_exists($folderPath . '/' . $filename)) {
                            debug_log('FOUND_FILE_IN_FOLDER', [
                                'orderNumber' => $orderNumber,
                                'folder' => $folder,
                                'filename' => $filename
                            ]);
                            return $folder;
                        }
                    }
                }
            }
        }
    }
    
    // デフォルト（見つからない場合）
    debug_log('FOLDER_NOT_FOUND', ['orderNumber' => $orderNumber]);
    return '01-001'; // 最も可能性の高いデフォルト
}

/**
 * サーバーフォルダ名を注文IDにマッピング（逆変換）
 */
function mapFolderNameToOrderId($folderName) {
    // 実際のフォルダ構造に基づく逆マッピング
    if ($folderName === '01-000') {
        return '#0483-#0999'; // 範囲表示
    } elseif ($folderName === '01-001') {
        return '#1001-#1303'; // 範囲表示
    } elseif (preg_match('/^01-(\d+)$/', $folderName, $matches)) {
        $folderNum = intval($matches[1]);
        return sprintf('#%04d-range', ($folderNum * 1000) + 1);
    }
    
    // 従来の形式もサポート
    return $folderName;
}

/**
 * 環境診断処理
 */
function handle_diagnose() {
    $orderId = $_GET['orderId'] ?? '#1303'; // デフォルトテスト用ID
    $serverFolderName = mapOrderIdToFolderName($orderId);
    $order_dir = UPLOAD_DIR . '/' . $serverFolderName;
    
    $diagnosis = [
        'script_info' => [
            'current_dir' => getcwd(),
            'script_dir' => __DIR__,
            'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'not_set',
            'server_name' => $_SERVER['SERVER_NAME'] ?? 'not_set'
        ],
        'path_info' => [
            'upload_dir_constant' => UPLOAD_DIR,
            'order_id' => $orderId,
            'server_folder_name' => $serverFolderName,
            'full_order_dir' => $order_dir,
            'realpath_upload_dir' => realpath(UPLOAD_DIR) ?: 'not_found',
            'realpath_order_dir' => realpath($order_dir) ?: 'not_found'
        ],
        'directory_status' => [
            'upload_dir_exists' => is_dir(UPLOAD_DIR),
            'upload_dir_readable' => is_readable(UPLOAD_DIR),
            'upload_dir_writable' => is_writable(UPLOAD_DIR),
            'order_dir_exists' => is_dir($order_dir),
            'order_dir_readable' => is_readable($order_dir),
            'order_dir_writable' => is_writable($order_dir)
        ],
        'file_scan' => [],
        'possible_paths_check' => []
    ];
    
    // 可能なパスを再チェック
    $possible_paths = [
        dirname(dirname(__DIR__)) . '/wp-content/aforms-pdf',
        dirname(__DIR__) . '/wp-content/aforms-pdf',
        __DIR__ . '/../wp-content/aforms-pdf',
        __DIR__ . '/wp-content/aforms-pdf',
        'wp-content/aforms-pdf',
        $_SERVER['DOCUMENT_ROOT'] . '/wp-content/aforms-pdf',
        '/home/original-scarf/original-scarf.com/public_html/wp-content/aforms-pdf'
    ];
    
    foreach ($possible_paths as $path) {
        $diagnosis['possible_paths_check'][] = [
            'path' => $path,
            'exists' => is_dir($path),
            'readable' => is_readable($path),
            'writable' => is_writable($path),
            'realpath' => realpath($path) ?: 'not_found'
        ];
    }
    
    // ファイルスキャン（実際のディレクトリが存在する場合）
    if (is_dir(UPLOAD_DIR)) {
        $diagnosis['file_scan']['upload_dir_contents'] = scandir(UPLOAD_DIR);
        
        // 各フォルダの詳細スキャン
        $folders = scandir(UPLOAD_DIR);
        $diagnosis['file_scan']['folder_details'] = [];
        
        foreach ($folders as $folder) {
            if ($folder === '.' || $folder === '..') continue;
            
            $folderPath = UPLOAD_DIR . '/' . $folder;
            if (is_dir($folderPath)) {
                $files = scandir($folderPath);
                $pdf_files = array_filter($files, function($file) {
                    return pathinfo($file, PATHINFO_EXTENSION) === 'pdf';
                });
                
                $diagnosis['file_scan']['folder_details'][$folder] = [
                    'path' => $folderPath,
                    'file_count' => count($files) - 2, // . と .. を除く
                    'pdf_files' => array_values($pdf_files),
                    'first_few_files' => array_slice($files, 2, 10), // 最初の10ファイル
                    'is_order_folder' => preg_match('/^01-\d+$/', $folder) ? true : false
                ];
            }
        }
        
        // 指定注文IDの詳細検索
        $orderNumber = intval(str_replace('#', '', $orderId));
        $diagnosis['file_scan']['order_specific_search'] = [
            'order_number' => $orderNumber,
            'expected_folder' => mapOrderIdToFolderName($orderId),
            'search_results' => []
        ];
        
        // 複数のファイル名パターンで検索
        $searchPatterns = [
            sprintf('%05d.pdf', $orderNumber),     // 01303.pdf
            sprintf('%04d.pdf', $orderNumber),     // 1303.pdf
            sprintf('0%04d.pdf', $orderNumber),    // 01303.pdf
            "quotes_{$orderNumber}.pdf",           // quotes_1303.pdf
            "quotes_*_{$orderNumber}.pdf",         // quotes_timestamp_1303.pdf (glob)
        ];
        
        foreach ($folders as $folder) {
            if (preg_match('/^01-\d+$/', $folder)) {
                $folderPath = UPLOAD_DIR . '/' . $folder;
                if (is_dir($folderPath)) {
                    foreach ($searchPatterns as $pattern) {
                        if (strpos($pattern, '*') !== false) {
                            // glob パターン
                            $matches = glob($folderPath . '/' . $pattern);
                            if (!empty($matches)) {
                                foreach ($matches as $match) {
                                    $filename = basename($match);
                                    $diagnosis['file_scan']['order_specific_search']['search_results'][] = [
                                        'folder' => $folder,
                                        'filename' => $filename,
                                        'pattern' => $pattern,
                                        'file_size' => filesize($match),
                                        'found_method' => 'glob'
                                    ];
                                }
                            }
                        } else {
                            // 直接ファイル検索
                            $filepath = $folderPath . '/' . $pattern;
                            if (file_exists($filepath)) {
                                $diagnosis['file_scan']['order_specific_search']['search_results'][] = [
                                    'folder' => $folder,
                                    'filename' => $pattern,
                                    'pattern' => $pattern,
                                    'file_size' => filesize($filepath),
                                    'found_method' => 'direct'
                                ];
                            }
                        }
                    }
                }
            }
        }
        
        if (is_dir($order_dir)) {
            $files = scandir($order_dir);
            $diagnosis['file_scan']['order_dir_contents'] = $files;
            
            // PDFファイルを探す
            $pdf_files = array_filter($files, function($file) {
                return pathinfo($file, PATHINFO_EXTENSION) === 'pdf';
            });
            $diagnosis['file_scan']['pdf_files'] = array_values($pdf_files);
        }
    }
    
    send_response(true, '診断完了', $diagnosis);
}

/**
 * 代替ファイル検索（ファイルが見つからない場合）
 */
function findFileAlternatively($orderId, $filename) {
    $uploadDir = UPLOAD_DIR;
    $orderNumber = intval(str_replace('#', '', $orderId));
    
    // 複数のファイル名パターンを試行
    $filenamePatterns = [
        $filename,  // 元のファイル名
        sprintf('%05d.pdf', $orderNumber),     // 01303.pdf
        sprintf('%04d.pdf', $orderNumber),     // 1303.pdf
        sprintf('0%04d.pdf', $orderNumber),    // 01303.pdf
        "quotes_{$orderNumber}.pdf",           // quotes_1303.pdf
    ];
    
    // すべてのフォルダを検索
    if (is_dir($uploadDir)) {
        $folders = scandir($uploadDir);
        foreach ($folders as $folder) {
            if (preg_match('/^01-\d+$/', $folder)) {
                $folderPath = $uploadDir . '/' . $folder;
                if (is_dir($folderPath)) {
                    foreach ($filenamePatterns as $pattern) {
                        $filepath = $folderPath . '/' . $pattern;
                        if (file_exists($filepath)) {
                            debug_log('ALTERNATIVE_FILE_FOUND', [
                                'orderId' => $orderId,
                                'original_filename' => $filename,
                                'found_filename' => $pattern,
                                'found_folder' => $folder,
                                'found_path' => $filepath
                            ]);
                            return $filepath;
                        }
                    }
                    
                    // glob パターンでも検索
                    $globPatterns = [
                        "quotes_*_{$orderNumber}.pdf",
                        "*{$orderNumber}*.pdf",
                        "{$orderNumber}*.pdf"
                    ];
                    
                    foreach ($globPatterns as $globPattern) {
                        $matches = glob($folderPath . '/' . $globPattern);
                        if (!empty($matches)) {
                            debug_log('ALTERNATIVE_FILE_FOUND_GLOB', [
                                'orderId' => $orderId,
                                'pattern' => $globPattern,
                                'matches' => $matches
                            ]);
                            return $matches[0]; // 最初の一致を返す
                        }
                    }
                }
            }
        }
    }
    
    debug_log('ALTERNATIVE_FILE_NOT_FOUND', [
        'orderId' => $orderId,
        'filename' => $filename,
        'searched_patterns' => $filenamePatterns
    ]);
    
    return false;
}

/**
 * 同期PDFファイル処理（複数フォルダ対応・改良版）
 */
function handle_sync_pdf() {
    $orderId = $_GET['orderId'] ?? '';
    
    if (empty($orderId)) {
        throw new Exception('注文IDが必要です');
    }
    
    // 注文IDから番号を抽出
    $orderNumber = preg_replace('/[^0-9]/', '', $orderId);
    $orderNumberInt = intval($orderNumber);
    
    debug_log('SYNC_PDF_START', [
        'orderId' => $orderId,
        'orderNumber' => $orderNumber,
        'orderNumberInt' => $orderNumberInt
    ]);
    
    // 同期ファイルパス（Xサーバー上の実際のパス）
    $sync_base_path = __DIR__ . '/aforms-pdf';
    
    // 見積書#1308の特別対応
    if ($orderNumberInt == 1308) {
        $primary_folder = '01-001';
        $primary_filename = '01308.pdf';
        $primary_path = $sync_base_path . '/' . $primary_folder . '/' . $primary_filename;
        
        debug_log('SYNC_PDF_1308_SPECIAL', [
            'primary_folder' => $primary_folder,
            'primary_filename' => $primary_filename,
            'primary_path' => $primary_path,
            'file_exists' => file_exists($primary_path)
        ]);
        
        if (file_exists($primary_path) && is_readable($primary_path)) {
            debug_log('SYNC_PDF_1308_FOUND', [
                'path' => $primary_path,
                'size' => filesize($primary_path)
            ]);
            return_pdf_file($primary_path, "見積書_1308.pdf");
            return;
        }
    }
    
    // フォルダ名を判定
    $folderName = mapOrderIdToFolderName($orderId);
    
    // 可能な同期ファイルパスを確認（複数フォルダ対応）
    $possible_pdf_paths = [];
    
    // 判定されたフォルダ内を検索（優先）
    $folder_path = $sync_base_path . '/' . $folderName;
    $possible_filenames = [
        sprintf('%05d.pdf', $orderNumberInt),  // 01308.pdf (最優先)
        sprintf('%04d.pdf', $orderNumberInt),  // 1308.pdf  
        sprintf('%03d.pdf', $orderNumberInt),  // 308.pdf
        "quote_{$orderNumber}.pdf",            // quote_1308.pdf
        "quotes_{$orderNumber}.pdf"            // quotes_1308.pdf
    ];
    
    debug_log('SYNC_PDF_PRIMARY_SEARCH', [
        'folderName' => $folderName,
        'folder_path' => $folder_path,
        'possible_filenames' => $possible_filenames,
        'folder_exists' => is_dir($folder_path)
    ]);
    
    foreach ($possible_filenames as $filename) {
        $possible_pdf_paths[] = $folder_path . '/' . $filename;
    }
    
    // 全フォルダを検索（フォールバック）
    if (is_dir($sync_base_path)) {
        $folders = scandir($sync_base_path);
        foreach ($folders as $folder) {
            if (preg_match('/^01-\d+$/', $folder) && $folder !== $folderName) {
                $test_folder_path = $sync_base_path . '/' . $folder;
                if (is_dir($test_folder_path)) {
                    foreach ($possible_filenames as $filename) {
                        $possible_pdf_paths[] = $test_folder_path . '/' . $filename;
                    }
                }
            }
        }
    }
    
    debug_log('SYNC_PDF_SEARCH_COMPREHENSIVE', [
        'orderId' => $orderId,
        'orderNumber' => $orderNumber,
        'folderName' => $folderName,
        'sync_base_path' => $sync_base_path,
        'sync_base_exists' => is_dir($sync_base_path),
        'possible_paths_count' => count($possible_pdf_paths),
        'first_few_paths' => array_slice($possible_pdf_paths, 0, 5)
    ]);
    
    // 同期ファイルを検索
    foreach ($possible_pdf_paths as $pdf_path) {
        if (file_exists($pdf_path) && is_readable($pdf_path)) {
            debug_log('SYNC_PDF_FOUND', [
                'orderId' => $orderId,
                'pdf_path' => $pdf_path,
                'file_size' => filesize($pdf_path),
                'file_readable' => is_readable($pdf_path)
            ]);
            
            // PDFファイルとしてダウンロード
            return_pdf_file($pdf_path, "見積書_{$orderNumber}.pdf");
            return;
        }
    }
    
    // 同期ファイルが見つからない場合の詳細ログ
    debug_log('SYNC_PDF_NOT_FOUND_DETAILED', [
        'orderId' => $orderId,
        'searched_paths' => $possible_pdf_paths,
        'sync_base_path_exists' => is_dir($sync_base_path),
        'sync_base_readable' => is_readable($sync_base_path),
        'available_folders' => is_dir($sync_base_path) ? scandir($sync_base_path) : 'base_path_not_found'
    ]);
    
    // 同期トリガー
    $sync_result = trigger_pdf_sync();
    
    if ($sync_result['success']) {
        // 同期後に再度検索
        foreach ($possible_pdf_paths as $pdf_path) {
            if (file_exists($pdf_path) && is_readable($pdf_path)) {
                debug_log('SYNC_PDF_FOUND_AFTER_SYNC', [
                    'orderId' => $orderId,
                    'pdf_path' => $pdf_path
                ]);
                
                return_pdf_file($pdf_path, "見積書_{$orderNumber}.pdf");
                return;
            }
        }
    }
    
    // 最終的に見つからない場合
    debug_log('SYNC_PDF_FINAL_NOT_FOUND', [
        'orderId' => $orderId,
        'sync_result' => $sync_result
    ]);
    
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo generate_pdf_not_found_page($orderId, $orderNumber);
    exit;
}

/**
 * PDFファイルを返す
 */
function return_pdf_file($file_path, $download_name) {
    $file_size = filesize($file_path);
    
    // PDFヘッダー設定
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . addslashes($download_name) . '"');
    header('Content-Length: ' . $file_size);
    header('Cache-Control: public, max-age=3600');
    header('Accept-Ranges: bytes');
    
    // Range Request対応
    if (isset($_SERVER['HTTP_RANGE'])) {
        handle_range_request($file_path, $file_size);
    } else {
        // 通常のダウンロード
        readfile($file_path);
    }
    exit;
}

/**
 * PDF同期トリガー
 */
function trigger_pdf_sync() {
    try {
        // 同期スクリプトを実行
        $sync_url = 'pdf-sync.php?action=sync';
        
        // cURLで同期実行
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $sync_url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => true
        ]);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($http_code === 200 && $response) {
            $result = json_decode($response, true);
            if ($result && $result['success']) {
                return $result;
            }
        }
        
        return ['success' => false, 'message' => 'PDF同期に失敗しました'];
        
    } catch (Exception $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * PDFが見つからない場合のページ生成
 */
function generate_pdf_not_found_page($orderId, $orderNumber) {
    return <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDFが見つかりません - 見積書 {$orderNumber}</title>
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
        .error-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        .error-title {
            color: #333;
            margin-bottom: 15px;
            font-size: 24px;
            font-weight: 600;
        }
        .error-message {
            color: #666;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        .error-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .error-btn {
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
        }
        .error-btn-primary {
            background: #007bff;
            color: white;
        }
        .error-btn-primary:hover {
            background: #0056b3;
            transform: translateY(-1px);
        }
        .error-btn-secondary {
            background: #17a2b8;
            color: white;
        }
        .error-btn-secondary:hover {
            background: #138496;
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">📄❌</div>
        <h1 class="error-title">PDFファイルが見つかりません</h1>
        <p class="error-message">
            見積書 {$orderNumber} のPDFファイルが見つかりませんでした。<br>
            ファイルの同期を実行するか、直接アクセスをお試しください。
        </p>
        
        <div class="error-buttons">
            <button onclick="window.location.reload()" class="error-btn error-btn-primary">
                🔄 ページを再読み込み
            </button>
            <a href="https://original-scarf.com/aforms-admin-pdf/{$orderNumber}" target="_blank" class="error-btn error-btn-secondary">
                📄 直接アクセス
            </a>
        </div>
        
        <p style="font-size: 12px; color: #999; margin-top: 20px;">
            ※ 再読み込みでファイル同期が実行されます
        </p>
    </div>
</body>
</html>
HTML;
}
?>