<?php
/**
 * 編集可能注文データ同期スクリプト
 * wp_wqorders（元データ）から wp_wqorders_editable（編集用）への同期処理
 */

// database-api.phpの接続関数を使用
require_once 'database-api.php';

// ログ出力関数
function syncLog($message, $level = 'INFO') {
    $timestamp = date('Y-m-d H:i:s');
    echo "[{$timestamp}] [{$level}] {$message}\n";
}

/**
 * 除外対象のフォームタイトルかどうかを判定
 */
function isExcludedFormTitle($formTitle) {
    if (empty($formTitle)) {
        return false;
    }
    
    $excludePatterns = [
        'サンプル請求',
        'お問い合わせ',
        'sample',
        'inquiry',
        'contact'
    ];
    
    $formTitleLower = mb_strtolower($formTitle);
    
    foreach ($excludePatterns as $pattern) {
        if (mb_strpos($formTitleLower, mb_strtolower($pattern)) !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * 増分同期処理（新規データのみ同期）
 */
function syncIncrementalData($pdo) {
    syncLog('増分同期処理を開始します');
    
    try {
        // 同期ログを開始
        $sync_id = startSyncLog($pdo, 'incremental');
        
        // 新規データを取得（編集用テーブルに存在しないもの）
        $sql = "
            SELECT o.* 
            FROM wp_wqorders o
            LEFT JOIN wp_wqorders_editable e ON o.id = e.original_id
            WHERE e.original_id IS NULL
            ORDER BY o.created DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $newRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $recordsAdded = 0;
        
        if (!empty($newRecords)) {
            syncLog('新規データ ' . count($newRecords) . '件を発見しました');
            
            // 新規データを編集用テーブルに挿入
            $insertSql = "
                INSERT INTO wp_wqorders_editable (
                    id, formTitle, customer, created, updated, status, content,
                    original_id, is_edited, last_sync_at, is_display_target
                ) VALUES (
                    :id, :formTitle, :customer, :created, :updated, :status, :content,
                    :original_id, FALSE, NOW(), :is_display_target
                )
            ";
            
            $insertStmt = $pdo->prepare($insertSql);
            
            foreach ($newRecords as $record) {
                try {
                    // 表示フラグを判定
                    $isDisplayTarget = !isExcludedFormTitle($record['formTitle']);
                    
                    $insertStmt->execute([
                        ':id' => $record['id'],
                        ':formTitle' => $record['formTitle'],
                        ':customer' => $record['customer'],
                        ':created' => $record['created'],
                        ':updated' => $record['updated'],
                        ':status' => $record['status'],
                        ':content' => $record['content'],
                        ':original_id' => $record['id'],
                        ':is_display_target' => $isDisplayTarget ? 1 : 0
                    ]);
                    $recordsAdded++;
                } catch (Exception $e) {
                    syncLog('レコード挿入エラー ID:' . $record['id'] . ' - ' . $e->getMessage(), 'ERROR');
                }
            }
        } else {
            syncLog('新規データはありませんでした');
        }
        
        // 同期ログを完了
        completeSyncLog($pdo, $sync_id, count($newRecords), $recordsAdded, 0, 0);
        
        syncLog("増分同期完了: {$recordsAdded}件追加");
        return $recordsAdded;
        
    } catch (Exception $e) {
        syncLog('増分同期エラー: ' . $e->getMessage(), 'ERROR');
        if (isset($sync_id)) {
            failSyncLog($pdo, $sync_id, $e->getMessage());
        }
        return false;
    }
}

/**
 * 完全同期処理（全データを再同期、編集済みは保護）
 */
function syncFullData($pdo) {
    syncLog('完全同期処理を開始します');
    
    try {
        // 同期ログを開始
        $sync_id = startSyncLog($pdo, 'full');
        
        // 元データを全取得
        $stmt = $pdo->prepare("SELECT * FROM wp_wqorders ORDER BY created DESC");
        $stmt->execute();
        $allRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $recordsProcessed = count($allRecords);
        $recordsAdded = 0;
        $recordsUpdated = 0;
        $recordsSkipped = 0;
        
        syncLog("元データ {$recordsProcessed}件を処理します");
        
        foreach ($allRecords as $record) {
            try {
                // 編集用テーブルに既存データがあるかチェック
                $checkStmt = $pdo->prepare("
                    SELECT id, is_edited FROM wp_wqorders_editable 
                    WHERE original_id = :original_id
                ");
                $checkStmt->execute([':original_id' => $record['id']]);
                $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$existing) {
                    // 表示フラグを判定（サンプル請求・お問い合わせは非表示）
                    $isDisplayTarget = !isExcludedFormTitle($record['formTitle']);
                    
                    // 新規挿入
                    $insertStmt = $pdo->prepare("
                        INSERT INTO wp_wqorders_editable (
                            id, formTitle, customer, created, updated, status, content,
                            original_id, is_edited, last_sync_at, is_display_target
                        ) VALUES (
                            :id, :formTitle, :customer, :created, :updated, :status, :content,
                            :original_id, FALSE, NOW(), :is_display_target
                        )
                    ");
                    
                    $insertStmt->execute([
                        ':id' => $record['id'],
                        ':formTitle' => $record['formTitle'],
                        ':customer' => $record['customer'],
                        ':created' => $record['created'],
                        ':updated' => $record['updated'],
                        ':status' => $record['status'],
                        ':content' => $record['content'],
                        ':original_id' => $record['id'],
                        ':is_display_target' => $isDisplayTarget ? 1 : 0
                    ]);
                    $recordsAdded++;
                    
                } elseif (!$existing['is_edited']) {
                    // 未編集データのみ更新
                    $updateStmt = $pdo->prepare("
                        UPDATE wp_wqorders_editable SET
                            formTitle = :formTitle,
                            customer = :customer,
                            created = :created,
                            updated = :updated,
                            status = :status,
                            content = :content,
                            last_sync_at = NOW()
                        WHERE original_id = :original_id AND is_edited = FALSE
                    ");
                    
                    $updateStmt->execute([
                        ':formTitle' => $record['formTitle'],
                        ':customer' => $record['customer'],
                        ':created' => $record['created'],
                        ':updated' => $record['updated'],
                        ':status' => $record['status'],
                        ':content' => $record['content'],
                        ':original_id' => $record['id']
                    ]);
                    $recordsUpdated++;
                    
                } else {
                    // 編集済みデータはスキップ
                    $recordsSkipped++;
                }
                
            } catch (Exception $e) {
                syncLog('レコード処理エラー ID:' . $record['id'] . ' - ' . $e->getMessage(), 'ERROR');
            }
        }
        
        // 同期ログを完了
        completeSyncLog($pdo, $sync_id, $recordsProcessed, $recordsAdded, $recordsUpdated, $recordsSkipped);
        
        syncLog("完全同期完了: 処理{$recordsProcessed}件, 追加{$recordsAdded}件, 更新{$recordsUpdated}件, スキップ{$recordsSkipped}件");
        return true;
        
    } catch (Exception $e) {
        syncLog('完全同期エラー: ' . $e->getMessage(), 'ERROR');
        if (isset($sync_id)) {
            failSyncLog($pdo, $sync_id, $e->getMessage());
        }
        return false;
    }
}

/**
 * 同期ログを開始
 */
function startSyncLog($pdo, $syncType) {
    $stmt = $pdo->prepare("
        INSERT INTO wp_wqorders_sync_log (sync_type, status) 
        VALUES (:sync_type, 'running')
    ");
    $stmt->execute([':sync_type' => $syncType]);
    return $pdo->lastInsertId();
}

/**
 * 同期ログを完了
 */
function completeSyncLog($pdo, $syncId, $processed, $added, $updated, $skipped) {
    $stmt = $pdo->prepare("
        UPDATE wp_wqorders_sync_log SET
            records_processed = :processed,
            records_added = :added,
            records_updated = :updated,
            records_skipped = :skipped,
            status = 'completed',
            sync_end_at = NOW()
        WHERE id = :sync_id
    ");
    $stmt->execute([
        ':processed' => $processed,
        ':added' => $added,
        ':updated' => $updated,
        ':skipped' => $skipped,
        ':sync_id' => $syncId
    ]);
}

/**
 * 同期ログを失敗状態に更新
 */
function failSyncLog($pdo, $syncId, $errorMessage) {
    $stmt = $pdo->prepare("
        UPDATE wp_wqorders_sync_log SET
            status = 'failed',
            error_message = :error_message,
            sync_end_at = NOW()
        WHERE id = :sync_id
    ");
    $stmt->execute([
        ':error_message' => $errorMessage,
        ':sync_id' => $syncId
    ]);
}

/**
 * 同期統計を表示
 */
function showSyncStats($pdo) {
    syncLog('=== 同期統計 ===');
    
    // テーブル件数
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM wp_wqorders");
    $originalCount = $stmt->fetch()['count'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM wp_wqorders_editable");
    $editableCount = $stmt->fetch()['count'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM wp_wqorders_editable WHERE is_edited = TRUE");
    $editedCount = $stmt->fetch()['count'];
    
    syncLog("元テーブル: {$originalCount}件");
    syncLog("編集用テーブル: {$editableCount}件");
    syncLog("編集済み: {$editedCount}件");
    
    // 最新同期ログ
    $stmt = $pdo->query("
        SELECT * FROM wp_wqorders_sync_log 
        ORDER BY created_at DESC LIMIT 5
    ");
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    syncLog('=== 最新同期ログ ===');
    foreach ($logs as $log) {
        $duration = '';
        if ($log['sync_end_at']) {
            $start = new DateTime($log['sync_start_at']);
            $end = new DateTime($log['sync_end_at']);
            $duration = ' (' . $start->diff($end)->format('%H:%I:%S') . ')';
        }
        
        syncLog(sprintf(
            "%s [%s] %s: 処理%d件, 追加%d件, 更新%d件, スキップ%d件%s",
            $log['sync_start_at'],
            $log['status'],
            $log['sync_type'],
            $log['records_processed'],
            $log['records_added'],
            $log['records_updated'], 
            $log['records_skipped'],
            $duration
        ));
    }
}

// メイン処理
if (php_sapi_name() === 'cli') {
    // コマンドライン実行
    $syncType = $argv[1] ?? 'incremental';
    
    try {
        $pdo = get_database_connection();
        syncLog('データベース接続成功');
        
        switch ($syncType) {
            case 'full':
                syncFullData($pdo);
                break;
            case 'incremental':
                syncIncrementalData($pdo);
                break;
            case 'stats':
                showSyncStats($pdo);
                break;
            default:
                syncLog('使用方法: php sync_editable_orders.php [full|incremental|stats]');
                exit(1);
        }
        
        showSyncStats($pdo);
        
    } catch (Exception $e) {
        syncLog('同期処理エラー: ' . $e->getMessage(), 'ERROR');
        exit(1);
    }
} else {
    // Web実行（簡易版）
    header('Content-Type: text/plain; charset=utf-8');
    
    try {
        $pdo = get_database_connection();
        $result = syncIncrementalData($pdo);
        
        if ($result !== false) {
            echo "同期完了: {$result}件追加\n";
            showSyncStats($pdo);
        } else {
            echo "同期エラーが発生しました\n";
        }
        
    } catch (Exception $e) {
        echo "エラー: " . $e->getMessage() . "\n";
    }
}
?> 