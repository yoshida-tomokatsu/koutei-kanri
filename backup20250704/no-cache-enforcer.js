/**
 * No-Cache強制実行システム
 * 全てのAPIリクエストにno-cacheヘッダーを自動追加
 */

// 元のfetch関数を保存
const originalFetch = window.fetch;

// fetch関数をオーバーライド（データベースAPIのみ対象）
window.fetch = function(url, options = {}) {
    // データベースAPIのみno-cacheを適用
    const isDatabaseAPI = url.includes('editable-orders-api.php');
    
    if (isDatabaseAPI) {
        // タイムスタンプを追加してキャッシュを無効化
        const timestamp = Date.now();
        const separator = url.includes('?') ? '&' : '?';
        const noCacheUrl = `${url}${separator}_t=${timestamp}&_nocache=${Math.random()}`;
        
        // no-cacheヘッダーを強制追加
        const noCacheOptions = {
            ...options,
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'If-Modified-Since': 'Mon, 26 Jul 1997 05:00:00 GMT',
                'If-None-Match': '*',
                ...options.headers
            }
        };
        
        console.log('🚫 No-Cache強制実行（DB API）:', noCacheUrl);
        
        // 元のfetch関数を呼び出し
        return originalFetch.call(this, noCacheUrl, noCacheOptions);
    } else {
        // ファイルAPIなど他のAPIは通常通り
        return originalFetch.call(this, url, options);
    }
};

// データ取得関数をno-cache強制版に変更
window.loadOrdersNoCache = async function() {
    console.log('📡 No-Cache強制データ取得開始...');
    
    const timestamp = Date.now();
    const response = await fetch(`editable-orders-api.php?action=get_orders&limit=999&page=1&_force=${timestamp}`);
    
    if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.orders) {
            console.log('✅ No-Cache強制取得完了:', result.data.orders.length, '件');
            
            // グローバルデータを即座に更新
            window.ordersData = result.data.orders;
            window.filteredOrders = result.data.orders;
            
            // 画面を即座に更新
            if (window.buildOrdersTable) {
                window.buildOrdersTable();
            }
            if (window.buildSimpleTable) {
                window.buildSimpleTable();
            }
            
            return result.data.orders;
        }
    }
    
    console.error('❌ No-Cache強制取得失敗');
    return [];
};

// ページリロード時にno-cacheを強制実行
window.addEventListener('beforeunload', function() {
    // 全キャッシュをクリア
    if (window.clearAllCaches) {
        window.clearAllCaches();
    }
});

// ページ読み込み時にno-cacheを強制実行
window.addEventListener('load', function() {
    console.log('🚫 No-Cache強制実行システム初期化完了');
    
    // 初期データ読み込み時もno-cacheを強制
    setTimeout(() => {
        if (window.loadOrdersNoCache) {
            window.loadOrdersNoCache();
        }
    }, 1000);
});

console.log('🚫 No-Cache強制実行システム読み込み完了'); 