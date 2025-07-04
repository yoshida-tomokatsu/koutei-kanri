<?php
/**
 * 動的バージョン番号生成
 * ファイルのキャッシュを無効化するため
 */

// セキュリティ：直接アクセスを防ぐ
if (!defined('ABSPATH')) {
    define('ABSPATH', dirname(__FILE__) . '/');
}

/**
 * 現在の時刻を基にバージョン番号を生成
 */
function generate_version() {
    return date('YmdHis');
}

/**
 * ファイルの最終更新時刻を基にバージョン番号を生成
 */
function generate_file_version($filepath) {
    if (file_exists($filepath)) {
        return filemtime($filepath);
    }
    return generate_version();
}

/**
 * 複数のファイルの最新更新時刻を基にバージョン番号を生成
 */
function generate_combined_version($filepaths) {
    $latest_time = 0;
    
    foreach ($filepaths as $filepath) {
        if (file_exists($filepath)) {
            $file_time = filemtime($filepath);
            if ($file_time > $latest_time) {
                $latest_time = $file_time;
            }
        }
    }
    
    return $latest_time > 0 ? $latest_time : generate_version();
}

/**
 * JavaScriptファイル用のバージョン番号を生成
 */
function get_js_version() {
    $js_files = [
        'core.js',
        'auth.js',
        'ui-modals.js',
        'table-manager.js',
        'order-save-manager.js',
        'file-system.js',
        'simple-pdf-viewer.js',
        'detail-search.js',
        'pdf-auto-sync.js',
        'debug-sync.js',
        'main.js'
    ];
    
    return generate_combined_version($js_files);
}

/**
 * CSSファイル用のバージョン番号を生成
 */
function get_css_version() {
    $css_files = [
        'styles.css'
    ];
    
    return generate_combined_version($css_files);
}

/**
 * 個別ファイル用のバージョン番号を生成
 */
function get_file_version($filename) {
    return generate_file_version($filename);
}

// 直接アクセスされた場合はJSONでバージョン情報を返す
if (basename($_SERVER['PHP_SELF']) === 'version.php') {
    header('Content-Type: application/json');
    echo json_encode([
        'js_version' => get_js_version(),
        'css_version' => get_css_version(),
        'timestamp' => generate_version()
    ]);
}
?> 