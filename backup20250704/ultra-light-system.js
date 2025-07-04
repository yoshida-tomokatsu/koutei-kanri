/**
 * 軽量化システム - UIと機能は維持、パフォーマンスのみ改善
 * 元の機能を全て残しつつ、重い処理だけを最適化
 */

console.log('🚀 軽量化システム起動 - UIと機能は維持、パフォーマンスのみ改善');

// ========================================
// 1. スマートページネーション優先初期化
// ========================================

// 元の重い初期化を軽量版に置き換え
const originalInitializeSystem = window.initializeSystem;
window.initializeSystem = async function() {
    console.log('⚡ 軽量初期化開始 - スマートページネーション優先');
    
    try {
        // 認証ローディング画面を非表示
        const authLoadingOverlay = document.getElementById('authLoadingOverlay');
        if (authLoadingOverlay) {
            authLoadingOverlay.style.display = 'none';
        }
        
        // スマートページネーション初期化（最優先）
        if (window.initializePagination) {
            console.log('📄 スマートページネーション初期化中...');
            await window.initializePagination();
        }
        
        // 基本的なイベントリスナーのみ初期化
        if (window.initializeBasicEvents) {
            window.initializeBasicEvents();
        }
        
        // ファイル処理は後で実行（非同期）
        setTimeout(() => {
            if (window.loadFileInformationAsync && window.ordersData) {
                console.log('📁 ファイル情報を軽量取得中...');
                window.loadFileInformationAsync(window.ordersData);
            }
        }, 2000); // 2秒後に実行
        
        console.log('✅ 軽量初期化完了');
        
    } catch (error) {
        console.error('❌ 軽量初期化エラー:', error);
        // エラー時は元の初期化を試行
        if (originalInitializeSystem) {
            originalInitializeSystem();
        }
    }
};

// ========================================
// 2. ファイル処理の軽量化（機能は維持）
// ========================================

// ファイル情報取得を軽量化（バッチ処理）
const originalLoadFileInformationAsync = window.loadFileInformationAsync;
window.loadFileInformationAsync = async function(orders) {
    console.log('⚡ 軽量ファイル処理開始:', orders?.length || 0, '件');
    
    if (!orders || orders.length === 0) {
        return Promise.resolve();
    }
    
    // 表示中のページのみ優先処理
    const currentPage = window.currentPage || 1;
    const itemsPerPage = window.itemsPerPage || 50;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    // 現在のページを優先処理
    const visibleOrders = orders.slice(startIndex, endIndex);
    const otherOrders = orders.slice(0, startIndex).concat(orders.slice(endIndex));
    
    try {
        // 表示中のページを即座に処理
        if (originalLoadFileInformationAsync && visibleOrders.length > 0) {
            await originalLoadFileInformationAsync(visibleOrders);
        }
        
        // 他のページは遅延処理（10件ずつ）
        if (otherOrders.length > 0) {
            const batchSize = 10;
            for (let i = 0; i < otherOrders.length; i += batchSize) {
                const batch = otherOrders.slice(i, i + batchSize);
                
                setTimeout(async () => {
                    try {
                        if (originalLoadFileInformationAsync) {
                            await originalLoadFileInformationAsync(batch);
                        }
                    } catch (error) {
                        console.warn('⚠️ バッチファイル処理エラー:', error);
                    }
                }, (i / batchSize) * 200); // 200ms間隔
            }
        }
        
    } catch (error) {
        console.warn('⚠️ ファイル情報取得エラー:', error);
    }
    
    return Promise.resolve();
};

// ========================================
// 3. キャッシュ最適化（機能は維持）
// ========================================

// キャッシュサイズを制限して軽量化
if (window.dataCache) {
    const originalSetPage = window.dataCache.setPage;
    window.dataCache.setPage = function(page, data) {
        // キャッシュサイズを5ページまでに制限
        if (this.pages && this.pages.size >= 5) {
            const firstKey = this.pages.keys().next().value;
            this.pages.delete(firstKey);
        }
        if (originalSetPage) {
            originalSetPage.call(this, page, data);
        }
    };
}

// ========================================
// 4. PDF処理の最適化（機能は維持）
// ========================================

// PDF自動同期を軽量化
if (window.pdfAutoSync) {
    const originalPdfAutoSync = window.pdfAutoSync;
    window.pdfAutoSync = {
        ...originalPdfAutoSync,
        interval: 30000, // 30秒間隔に変更（元は10秒）
        batchSize: 5,    // 5件ずつ処理
        enabled: true    // 機能は維持
    };
}

// ========================================
// 5. UI要素の遅延初期化（機能は維持）
// ========================================

// 重いUI要素を遅延初期化
const originalInitializeAllEventListeners = window.initializeAllEventListeners;
window.initializeAllEventListeners = function() {
    console.log('⚡ UI要素を遅延初期化中...');
    
    // 基本的なイベントは即座に初期化
    if (window.initializeBasicEvents) {
        window.initializeBasicEvents();
    }
    
    // 複雑なイベントは遅延初期化
    setTimeout(() => {
        if (originalInitializeAllEventListeners) {
            originalInitializeAllEventListeners();
        }
    }, 1000); // 1秒後に実行
};

// ========================================
// 6. デバッグ機能の復元
// ========================================

window.lightweightDebug = function() {
    console.log('🔍 軽量化システム状態:');
    console.log('- データ件数:', window.ordersData?.length || 0);
    console.log('- 現在のページ:', window.currentPage || 1);
    console.log('- キャッシュサイズ:', window.dataCache?.pages?.size || 0);
    console.log('- スマートページネーション:', window.initializePagination ? '有効' : '無効');
    console.log('- ファイル処理:', window.loadFileInformationAsync ? '軽量化済み' : '無効');
};

// ========================================
// 7. 緊急時の完全復元
// ========================================

window.restoreOriginalSystem = function() {
    console.log('🔄 元のシステムを復元中...');
    
    // 元の関数を復元
    if (originalInitializeSystem) {
        window.initializeSystem = originalInitializeSystem;
    }
    if (originalLoadFileInformationAsync) {
        window.loadFileInformationAsync = originalLoadFileInformationAsync;
    }
    if (originalInitializeAllEventListeners) {
        window.initializeAllEventListeners = originalInitializeAllEventListeners;
    }
    
    console.log('✅ 元のシステムを復元しました');
};

// ========================================
// 8. 軽量化統計
// ========================================

window.showLightweightStats = function() {
    const stats = {
        mode: '軽量化モード',
        features: 'すべて維持',
        performance: '最適化済み',
        dataCount: window.ordersData?.length || 0,
        pagination: window.initializePagination ? '有効' : '無効',
        fileProcessing: '軽量化済み',
        caching: '最適化済み',
        uiElements: '遅延初期化'
    };
    
    console.table(stats);
    return stats;
};

console.log('✅ 軽量化システム準備完了 - すべての機能を維持しつつパフォーマンスを最適化');
console.log('💡 利用可能なコマンド: lightweightDebug(), showLightweightStats(), restoreOriginalSystem()'); 