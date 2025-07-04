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
define('UPLOAD_DIR', 'uploads');
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

// ディレクトリ作成
function ensure_directory($path) {
    if (!is_dir($path)) {
        if (!mkdir($path, 0755, true)) {
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
            
        default:
            send_response(false, '無効なアクションです', [
                'available_actions' => ['upload', 'list', 'download', 'delete', 'reorder', 'pdf_test']
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
    $order_dir = UPLOAD_DIR . '/' . $orderId;
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
    
    $order_dir = UPLOAD_DIR . '/' . $orderId;
    $files = [];
    
    if (is_dir($order_dir)) {
        $file_list = scandir($order_dir);
        
        foreach ($file_list as $filename) {
            if ($filename === '.' || $filename === '..' || strpos($filename, 'order_') === 0) {
                continue;
            }
            
            $file_path = $order_dir . '/' . $filename;
            $parts = explode('_', $filename, 3);
            
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
    }
    
    debug_log('FILE_LIST', [
        'orderId' => $orderId,
        'fileCount' => count($files)
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
    
    $file_path = UPLOAD_DIR . '/' . $orderId . '/' . $filename;
    
    if (!file_exists($file_path)) {
        http_response_code(404);
        throw new Exception('ファイルが見つかりません');
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
    
    $file_path = UPLOAD_DIR . '/' . $orderId . '/' . $filename;
    
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
    
    $file_path = UPLOAD_DIR . '/' . $orderId . '/' . $filename;
    
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
    $order_dir = UPLOAD_DIR . '/' . $orderId;
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
?>