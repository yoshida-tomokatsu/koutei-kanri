/**
 * スマートページネーション - プロ仕様
 * 必要な分だけ読み込み、ユーザー体験を最適化
 */

console.log('📄 スマートページネーション初期化開始');

// 設定
const PAGINATION_CONFIG = {
    ITEMS_PER_PAGE: 50,        // 1ページ50件（適度なサイズ）
    PRELOAD_PAGES: 1,          // 前後1ページを先読み
    CACHE_PAGES: 5,            // 最大5ページをキャッシュ
    LOAD_TIMEOUT: 5000         // 5秒タイムアウト
};

// ページキャッシュ（LRU方式）
class PageCache {
    constructor(maxSize = PAGINATION_CONFIG.CACHE_PAGES) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    get(page) {
        if (this.cache.has(page)) {
            // LRU: アクセスしたものを最新に
            const value = this.cache.get(page);
            this.cache.delete(page);
            this.cache.set(page, value);
            return value;
        }
        return null;
    }
    
    set(page, data) {
        // 容量オーバー時は最古を削除
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            console.log(`🗑️ ページキャッシュ削除: ${firstKey}`);
        }
        
        this.cache.set(page, {
            data: data,
            timestamp: Date.now()
        });
        console.log(`💾 ページキャッシュ保存: ${page} (${data.length}件)`);
    }
    
    clear() {
        this.cache.clear();
        console.log('🗑️ ページキャッシュ全削除');
    }
    
    getStats() {
        return {
            size: this.cache.size,
            pages: Array.from(this.cache.keys())
        };
    }
}

// グローバルインスタンス
const pageCache = new PageCache();
let currentPage = 1;
let totalPages = 1;
let isLoading = false;

/**
 * 指定ページのデータを取得（キャッシュ優先）
 */
async function loadPage(page, showLoading = true) {
    if (isLoading) {
        console.log('⏳ 読み込み中のためスキップ:', page);
        return null;
    }
    
    // キャッシュチェック
    const cached = pageCache.get(page);
    if (cached) {
        console.log(`⚡ キャッシュヒット: ページ${page} (${cached.data.length}件)`);
        return cached.data;
    }
    
    // サーバーから取得
    isLoading = true;
    if (showLoading) {
        showPageLoading(page);
    }
    
    try {
        console.log(`📡 サーバー取得開始: ページ${page}`);
        const startTime = performance.now();
        
        const response = await fetch(`editable-orders-api.php?action=get_orders&page=${page}&limit=${PAGINATION_CONFIG.ITEMS_PER_PAGE}&_t=${Date.now()}`, {
            signal: AbortSignal.timeout(PAGINATION_CONFIG.LOAD_TIMEOUT)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        const loadTime = performance.now() - startTime;
        
        if (result.success && result.data && result.data.orders) {
            const orders = result.data.orders;
            console.log(`✅ ページ${page}取得完了: ${orders.length}件 (${loadTime.toFixed(0)}ms)`);
            
            // キャッシュに保存
            pageCache.set(page, orders);
            
            // ページ情報更新
            if (result.data.pagination) {
                totalPages = result.data.pagination.total_pages || Math.ceil(result.data.pagination.total / PAGINATION_CONFIG.ITEMS_PER_PAGE);
            }
            
            return orders;
        } else {
            throw new Error('データ取得失敗');
        }
        
    } catch (error) {
        console.error(`❌ ページ${page}取得エラー:`, error.message);
        return [];
    } finally {
        isLoading = false;
        if (showLoading) {
            hidePageLoading();
        }
    }
}

/**
 * 指定ページを表示
 */
async function showPage(page) {
    if (page < 1) page = 1;
    if (page > totalPages && totalPages > 0) page = totalPages;
    
    console.log(`📄 ページ${page}表示開始`);
    currentPage = page;
    
    // メインデータ取得
    const orders = await loadPage(page, true);
    
    if (orders && orders.length > 0) {
        // グローバル変数更新（現在ページのみ）
        window.ordersData = orders;
        window.filteredOrders = orders;
        
        // テーブル更新
        if (window.buildOrdersTable) {
            window.buildOrdersTable();
        }
        
        // ページネーションUI更新
        updatePaginationUI();
        
        // 先読み（非同期）
        preloadAdjacentPages(page);
        
        console.log(`✅ ページ${page}表示完了: ${orders.length}件`);
    } else {
        console.warn(`⚠️ ページ${page}にデータがありません`);
    }
}

/**
 * 隣接ページの先読み
 */
async function preloadAdjacentPages(currentPage) {
    const preloadPages = [];
    
    // 前後のページを先読み対象に
    for (let i = 1; i <= PAGINATION_CONFIG.PRELOAD_PAGES; i++) {
        if (currentPage - i >= 1) preloadPages.push(currentPage - i);
        if (currentPage + i <= totalPages) preloadPages.push(currentPage + i);
    }
    
    // 非同期で先読み
    preloadPages.forEach(page => {
        if (!pageCache.get(page)) {
            setTimeout(() => {
                console.log(`🔄 先読み: ページ${page}`);
                loadPage(page, false);
            }, 500 * (Math.abs(page - currentPage))); // 距離に応じて遅延
        }
    });
}

/**
 * ページネーションUI更新
 */
function updatePaginationUI() {
    // ページ番号表示
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `${currentPage} / ${totalPages}`;
    }
    
    // 総件数表示の更新
    const totalCountInfo = document.getElementById('totalCountInfo');
    if (totalCountInfo) {
        const cacheStats = pageCache.getStats();
        totalCountInfo.textContent = `総件数: ${totalPages * PAGINATION_CONFIG.ITEMS_PER_PAGE}件 (キャッシュ: ${cacheStats.size}ページ)`;
    }
    
    // ページ番号ボタン更新
    const pageNumbers = document.getElementById('pageNumbers');
    if (pageNumbers) {
        pageNumbers.innerHTML = '';
        
        // 表示範囲計算（現在ページ±2）
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);
        
        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = i === currentPage ? 'page-btn active' : 'page-btn';
            btn.onclick = () => showPage(i);
            pageNumbers.appendChild(btn);
        }
    }
    
    // 前後ボタンの状態
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

/**
 * ローディング表示
 */
function showPageLoading(page) {
    const loadingDiv = document.getElementById('pageLoading') || createLoadingDiv();
    loadingDiv.textContent = `ページ${page}読み込み中...`;
    loadingDiv.style.display = 'block';
}

function hidePageLoading() {
    const loadingDiv = document.getElementById('pageLoading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

function createLoadingDiv() {
    const div = document.createElement('div');
    div.id = 'pageLoading';
    div.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 9999;
        display: none;
    `;
    document.body.appendChild(div);
    return div;
}

/**
 * 初期化
 */
async function initializePagination() {
    console.log('📄 ページネーション初期化');
    
    // 最初のページを読み込み
    await showPage(1);
    
    // ページネーションイベント設定
    setupPaginationEvents();
    
    console.log('✅ ページネーション初期化完了');
}

/**
 * イベント設定
 */
function setupPaginationEvents() {
    // 前ページボタン
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentPage > 1) showPage(currentPage - 1);
        };
    }
    
    // 次ページボタン
    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentPage < totalPages) showPage(currentPage + 1);
        };
    }
}

// グローバル関数として公開
window.showPage = showPage;
window.loadPage = loadPage;
window.initializePagination = initializePagination;
window.pageCache = pageCache;

// デバッグ用
window.getPaginationStats = () => {
    return {
        currentPage,
        totalPages,
        cacheStats: pageCache.getStats(),
        config: PAGINATION_CONFIG
    };
};

console.log('📄 スマートページネーション準備完了'); 