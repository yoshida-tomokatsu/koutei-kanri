/**
 * パフォーマンス最適化ヘルパー
 * システムの軽量化とレスポンシブ性向上
 */

/**
 * 軽量モードでのファイル処理無効化
 */
let lightweightMode = true; // デフォルトで軽量モード

/**
 * 軽量モードの切り替え
 */
function toggleLightweightMode() {
    lightweightMode = !lightweightMode;
    console.log(`🚀 軽量モード: ${lightweightMode ? 'ON' : 'OFF'}`);
    
    if (lightweightMode) {
        // ファイル処理を停止
        stopFileProcessing();
        console.log('📁 ファイル処理を停止しました（軽量化）');
    } else {
        // ファイル処理を再開
        startFileProcessing();
        console.log('📁 ファイル処理を再開しました');
    }
    
    return lightweightMode;
}

/**
 * ファイル処理を停止
 */
function stopFileProcessing() {
    // ファイル取得関数を無効化
    if (window.loadFileInformationAsync) {
        window.originalLoadFileInformationAsync = window.loadFileInformationAsync;
        window.loadFileInformationAsync = async function() {
            console.log('📁 ファイル処理スキップ（軽量モード）');
            return Promise.resolve();
        };
    }
    
    // ファイル表示更新を無効化
    if (window.updateAllFileDisplays) {
        window.originalUpdateAllFileDisplays = window.updateAllFileDisplays;
        window.updateAllFileDisplays = function() {
            console.log('📁 ファイル表示更新スキップ（軽量モード）');
        };
    }
}

/**
 * ファイル処理を再開
 */
function startFileProcessing() {
    // ファイル取得関数を復元
    if (window.originalLoadFileInformationAsync) {
        window.loadFileInformationAsync = window.originalLoadFileInformationAsync;
        delete window.originalLoadFileInformationAsync;
    }
    
    // ファイル表示更新を復元
    if (window.originalUpdateAllFileDisplays) {
        window.updateAllFileDisplays = window.originalUpdateAllFileDisplays;
        delete window.originalUpdateAllFileDisplays;
    }
}

/**
 * 軽量データ取得（ファイル情報なし）
 */
async function loadDataLightweight() {
    console.log('🚀 軽量データ取得開始...');
    
    try {
        const timestamp = Date.now();
        const response = await fetch(`editable-orders-api.php?action=get_orders&limit=999&page=1&_t=${timestamp}`);
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data.orders) {
                console.log('✅ 軽量データ取得完了:', result.data.orders.length, '件');
                
                // グローバルデータを更新
                window.ordersData = result.data.orders;
                window.filteredOrders = result.data.orders;
                
                // テーブルのみ更新（ファイル処理なし）
                if (window.buildOrdersTable) {
                    window.buildOrdersTable();
                }
                if (window.buildSimpleTable) {
                    window.buildSimpleTable();
                }
                
                return result.data.orders;
            }
        }
        
        console.error('❌ 軽量データ取得失敗');
        return [];
        
    } catch (error) {
        console.error('❌ 軽量データ取得エラー:', error);
        return [];
    }
}

/**
 * デバウンス機能付きファイル処理
 */
let fileProcessingTimer = null;

function scheduleFileProcessing() {
    if (!lightweightMode) {
        // 軽量モードでない場合のみ実行
        if (fileProcessingTimer) {
            clearTimeout(fileProcessingTimer);
        }
        
        fileProcessingTimer = setTimeout(async () => {
            console.log('📁 遅延ファイル処理開始...');
            if (window.originalLoadFileInformationAsync && window.ordersData) {
                try {
                    await window.originalLoadFileInformationAsync(window.ordersData);
                    console.log('✅ 遅延ファイル処理完了');
                } catch (error) {
                    console.warn('⚠️ 遅延ファイル処理エラー:', error);
                }
            }
        }, 3000); // 3秒後に実行
    }
}

/**
 * システムパフォーマンス監視
 */
function monitorPerformance() {
    const startTime = performance.now();
    
    return {
        end: () => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`⏱️ 処理時間: ${duration.toFixed(2)}ms`);
            return duration;
        }
    };
}

// 初期化時に軽量モードを有効化
if (lightweightMode) {
    stopFileProcessing();
    console.log('🚀 軽量モード初期化完了');
}

// グローバルに公開
window.toggleLightweightMode = toggleLightweightMode;
window.loadDataLightweight = loadDataLightweight;
window.scheduleFileProcessing = scheduleFileProcessing;
window.monitorPerformance = monitorPerformance;
window.lightweightMode = lightweightMode;

console.log('🚀 パフォーマンス最適化ヘルパー初期化完了'); 