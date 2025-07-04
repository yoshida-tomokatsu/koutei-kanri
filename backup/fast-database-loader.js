// 修正版データベースローダー（fast-database-loader.js上書き）

const FIXED_CONFIG = {
    API_URL: './database-api.php',  // 既存のファイルを使用
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 50,
    LOAD_TIMEOUT: 15000
};

// ページネーション管理
let paginationState = {
    currentPage: 1,
    pageSize: FIXED_CONFIG.DEFAULT_PAGE_SIZE,
    totalCount: 0,
    hasMore: true,
    isLoading: false
};

// キャッシュ管理
let dataCache = {
    pages: new Map(),
    metadata: null,
    lastUpdate: null,
    
    isValid() {
        if (!this.lastUpdate) return false;
        return (Date.now() - this.lastUpdate) < (5 * 60 * 1000); // 5分
    },
    
    getPage(page) {
        return this.pages.get(page);
    },
    
    setPage(page, data) {
        this.pages.set(page, data);
        this.lastUpdate = Date.now();
    },
    
    clear() {
        this.pages.clear();
        this.metadata = null;
        this.lastUpdate = null;
    }
};

/**
 * タイムアウト付きfetch
 */
async function fetchWithTimeout(url, options = {}, timeout = FIXED_CONFIG.LOAD_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('リクエストがタイムアウトしました');
        }
        throw error;
    }
}

/**
 * データベース接続テスト
 */
async function testDatabase() {
    try {
        const response = await fetchWithTimeout(
            `${FIXED_CONFIG.API_URL}?action=test_connection&t=${Date.now()}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        throw error;
    }
}

/**
 * デバッグデータを取得
 */
async function getDebugData(limit = 5) {
    try {
        const response = await fetchWithTimeout(
            `${FIXED_CONFIG.API_URL}?action=debug_data&limit=${limit}&t=${Date.now()}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        throw error;
    }
}

/**
 * データ修正を実行
 */
async function fixData() {
    try {
        const response = await fetchWithTimeout(
            `${FIXED_CONFIG.API_URL}?action=fix_data&t=${Date.now()}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        throw error;
    }
}

/**
 * 指定ページのデータを取得
 */
async function loadOrdersPage(page = 1, pageSize = FIXED_CONFIG.DEFAULT_PAGE_SIZE, useCache = true) {
    // キャッシュチェック
    if (useCache && dataCache.isValid()) {
        const cachedData = dataCache.getPage(page);
        if (cachedData) {
            return {
                orders: cachedData,
                pagination: {
                    current_page: page,
                    per_page: pageSize,
                    total_in_page: cachedData.length,
                    has_more: cachedData.length === pageSize
                }
            };
        }
    }
    
    try {
        paginationState.isLoading = true;
        updateLoadingUI(true);
        
        const url = `${FIXED_CONFIG.API_URL}?action=get_orders&page=${page}&limit=${pageSize}&t=${Date.now()}`;
        
        const response = await fetchWithTimeout(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // キャッシュに保存
            dataCache.setPage(page, result.orders);
            
            // ページネーション状態を更新
            paginationState.currentPage = page;
            paginationState.pageSize = pageSize;
            paginationState.hasMore = result.pagination.has_more;
            
            return result;
        } else {
            throw new Error(result.message || 'データ取得に失敗しました');
        }
        
    } catch (error) {
        throw error;
    } finally {
        paginationState.isLoading = false;
        updateLoadingUI(false);
    }
}

/**
 * 総件数を取得
 */
async function getTotalCount() {
    try {
        const response = await fetchWithTimeout(
            `${FIXED_CONFIG.API_URL}?action=get_orders_count&t=${Date.now()}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            paginationState.totalCount = result.total_count;
            return result.total_count;
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        return 0;
    }
}

/**
 * データベースから注文データを取得（メイン関数）
 */
async function loadOrdersFromFastDatabase(page = 1, pageSize = FIXED_CONFIG.DEFAULT_PAGE_SIZE) {
    try {
        const result = await loadOrdersPage(page, pageSize);
        
        // 動的選択肢を更新
        if (result.orders && result.orders.length > 0) {
            updateDynamicOptionsFromData(result.orders);
        }
        
        return result.orders;
        
    } catch (error) {
        // フォールバック
        if (typeof SAMPLE_ORDERS !== 'undefined') {
            return SAMPLE_ORDERS.slice(0, pageSize);
        }
        
        throw error;
    }
}

/**
 * 次のページを読み込み
 */
async function loadNextPage() {
    if (paginationState.isLoading || !paginationState.hasMore) {
        return [];
    }
    
    try {
        const nextPage = paginationState.currentPage + 1;
        const result = await loadOrdersPage(nextPage, paginationState.pageSize);
        
        const newOrders = result.orders;
        
        // グローバルordersDataに追加
        if (typeof ordersData !== 'undefined') {
            ordersData.push(...newOrders);
            window.ordersData = ordersData;
        }
        
        return newOrders;
        
    } catch (error) {
        throw error;
    }
}

/**
 * 動的選択肢を更新
 */
function updateDynamicOptionsFromData(orders) {
    if (!orders || orders.length === 0 || typeof dynamicOptions === 'undefined') return;
    
    const extractedOptions = {
        '注文担当': new Set(),
        '支払い方法': new Set(), 
        'プリント工場': new Set(),
        '縫製工場': new Set(),
        '検品担当': new Set(),
        '配送会社': new Set()
    };
    
    orders.forEach(order => {
        if (order.注文担当) extractedOptions['注文担当'].add(order.注文担当);
        if (order.支払い方法) extractedOptions['支払い方法'].add(order.支払い方法);
        if (order.プリント工場) extractedOptions['プリント工場'].add(order.プリント工場);
        if (order.縫製工場) extractedOptions['縫製工場'].add(order.縫製工場);
        if (order.検品担当) extractedOptions['検品担当'].add(order.検品担当);
        if (order.配送会社) extractedOptions['配送会社'].add(order.配送会社);
    });
    
    Object.keys(extractedOptions).forEach(key => {
        const newOptions = Array.from(extractedOptions[key]);
        if (newOptions.length > 0) {
            const existingOptions = new Set(dynamicOptions[key] || []);
            newOptions.forEach(option => existingOptions.add(option));
            dynamicOptions[key] = Array.from(existingOptions);
        }
    });
}

/**
 * ローディングUI更新
 */
function updateLoadingUI(isLoading) {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    if (loadMoreBtn) {
        loadMoreBtn.disabled = isLoading;
        loadMoreBtn.textContent = isLoading ? '読み込み中...' : 'さらに読み込む';
    }
    
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
    
    const tbody = document.getElementById('orders-table-body');
    if (tbody && isLoading && tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="loading">データを読み込み中...</td></tr>';
    }
}

/**
 * ページネーションコントロールを追加
 */
function addPaginationControls() {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const existingPagination = document.getElementById('pagination-controls');
    if (existingPagination) {
        existingPagination.remove();
    }
    
    const paginationHTML = `
        <div id="pagination-controls" style="
            padding: 20px;
            text-align: center;
            background: white;
            border-radius: 8px;
            margin-top: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
            <div style="margin-bottom: 15px; color: #666; font-size: 14px;">
                <span id="pagination-info">データを読み込み中...</span>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                <button id="loadMoreBtn" class="btn-new" style="background: #3498db;">
                    さらに読み込む
                </button>
                <button id="refreshBtn" class="btn-new" style="background: #27ae60;">
                    🔄 最新データ
                </button>
                <select id="pageSizeSelect" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #ddd;">
                    <option value="10" selected>10件/ページ</option>
                    <option value="20">20件/ページ</option>
                    <option value="30">30件/ページ</option>
                    <option value="50">50件/ページ</option>
                </select>
            </div>
            <div id="loadingIndicator" style="
                margin-top: 10px;
                display: none;
                color: #3498db;
                font-size: 14px;
            ">
                📡 データを読み込み中...
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', paginationHTML);
    
    // イベントリスナーを追加
    document.getElementById('loadMoreBtn').addEventListener('click', async () => {
        try {
            const newOrders = await loadNextPage();
            if (newOrders.length > 0) {
                buildOrdersTable();
                updatePaginationInfo();
            } else {
                alert('これ以上のデータはありません');
            }
        } catch (error) {
            alert('データ読み込みエラー: ' + error.message);
        }
    });
    
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        try {
            dataCache.clear();
            paginationState.currentPage = 1;
            const orders = await loadOrdersFromFastDatabase(1, paginationState.pageSize);
            
            if (typeof ordersData !== 'undefined') {
                ordersData = orders;
                window.ordersData = orders;
                buildOrdersTable();
                updatePaginationInfo();
            }
            
            alert('データを更新しました');
        } catch (error) {
            alert('データ更新エラー: ' + error.message);
        }
    });
    
    document.getElementById('pageSizeSelect').addEventListener('change', async (e) => {
        const newPageSize = parseInt(e.target.value);
        try {
            paginationState.pageSize = newPageSize;
            paginationState.currentPage = 1;
            dataCache.clear();
            
            const orders = await loadOrdersFromFastDatabase(1, newPageSize);
            
            if (typeof ordersData !== 'undefined') {
                ordersData = orders;
                window.ordersData = orders;
                buildOrdersTable();
                updatePaginationInfo();
            }
        } catch (error) {
            alert('ページサイズ変更エラー: ' + error.message);
        }
    });
}

/**
 * ページネーション情報を更新
 */
function updatePaginationInfo() {
    const infoElement = document.getElementById('pagination-info');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (infoElement) {
        const currentDataCount = typeof ordersData !== 'undefined' ? ordersData.length : 0;
        let infoText = `現在表示: ${currentDataCount}件`;
        
        if (paginationState.totalCount > 0) {
            infoText += ` / 総件数: ${paginationState.totalCount}件`;
        }
        
        infoElement.textContent = infoText;
    }
    
    if (loadMoreBtn) {
        loadMoreBtn.style.display = paginationState.hasMore ? 'inline-block' : 'none';
    }
}

/**
 * 包括的なデータベーステスト
 */
async function comprehensiveDatabaseTest() {
    const results = {
        connection: null,
        debug_data: null,
        sample_data: null,
        total_count: 0,
        errors: []
    };
    
    try {
        // 1. 接続テスト
        results.connection = await testDatabase();
        
        // 2. デバッグデータ取得
        results.debug_data = await getDebugData(3);
        
        // 3. 実際のデータ取得テスト
        results.sample_data = await loadOrdersFromFastDatabase(1, 5);
        
        // 4. 総件数取得
        results.total_count = await getTotalCount();
        
        return results;
        
    } catch (error) {
        results.errors.push(error.message);
        return results;
    }
}

/**
 * 修正版DBコントロールをヘッダーに追加
 */
function addFixedDBControls() {
    const headerControls = document.querySelector('.debug-controls');
    if (!headerControls) return;
    
    // 既存のボタンを修正版に置き換え
    headerControls.innerHTML = `
        <button class="btn-new" id="dbTestBtn" style="background-color: #27ae60;">🔧 DB接続テスト</button>
        <button class="btn-new" id="dbLoadBtn" style="background-color: #f39c12;">📊 DBデータ読み込み</button>
        <button class="btn-new" id="dbDebugBtn" style="background-color: #9b59b6;">🧪 診断</button>
        <button class="btn-new" id="dbFixBtn" style="background-color: #e74c3c;">🔧 データ修正</button>
    `;
    
    // イベントリスナーを追加
    document.getElementById('dbTestBtn').addEventListener('click', async function() {
        this.disabled = true;
        this.textContent = '🔄 テスト中...';
        
        try {
            const result = await testDatabase();
            alert('データベース接続テスト成功!\n' + 
                  `レコード数: ${result.record_count}件\n` +
                  `パース例: ${result.parse_tests?.length || 0}件`);
        } catch (error) {
            alert('接続テスト失敗:\n' + error.message);
        } finally {
            this.disabled = false;
            this.textContent = '🔧 DB接続テスト';
        }
    });
    
    document.getElementById('dbLoadBtn').addEventListener('click', async function() {
        this.disabled = true;
        this.textContent = '🔄 読み込み中...';
        
        try {
            const orders = await loadOrdersFromFastDatabase(1, 10);
            
            if (typeof ordersData !== 'undefined') {
                ordersData = orders;
                window.ordersData = orders;
                buildOrdersTable();
                
                // ページネーションコントロールを追加
                addPaginationControls();
                updatePaginationInfo();
            }
            
            alert(`データベースから${orders.length}件のデータを読み込みました`);
        } catch (error) {
            alert('データ読み込み失敗:\n' + error.message);
        } finally {
            this.disabled = false;
            this.textContent = '📊 DBデータ読み込み';
        }
    });
    
    document.getElementById('dbDebugBtn').addEventListener('click', async function() {
        this.disabled = true;
        this.textContent = '🔄 診断中...';
        
        try {
            const results = await comprehensiveDatabaseTest();
            
            let message = '=== データベース診断結果 ===\n\n';
            
            if (results.connection) {
                message += `✅ 接続: 成功\n`;
                message += `   レコード数: ${results.connection.record_count || 0}件\n\n`;
            }
            
            if (results.debug_data) {
                message += `🔍 デバッグデータ: ${results.debug_data.count}件取得\n\n`;
            }
            
            if (results.sample_data) {
                message += `📊 サンプル取得: ${results.sample_data.length}件\n\n`;
            }
            
            message += `📈 総件数: ${results.total_count}件\n`;
            
            if (results.errors.length > 0) {
                message += `\n❌ エラー:\n${results.errors.join('\n')}`;
            }
            
            alert(message);
            
        } catch (error) {
            alert('診断失敗:\n' + error.message);
        } finally {
            this.disabled = false;
            this.textContent = '🧪 診断';
        }
    });
    
    document.getElementById('dbFixBtn').addEventListener('click', async function() {
        if (!confirm('データ修正を実行しますか？\n（空の顧客名に自動で名前を設定します）')) {
            return;
        }
        
        this.disabled = true;
        this.textContent = '🔄 修正中...';
        
        try {
            const result = await fixData();
            alert(`データ修正完了!\n` +
                  `修正件数: ${result.statistics?.fixes_applied || 0}件\n` +
                  `空コンテンツ: ${result.statistics?.null_content_records || 0}件\n` +
                  `空顧客名: ${result.statistics?.null_customer_records || 0}件`);
        } catch (error) {
            alert('データ修正失敗:\n' + error.message);
        } finally {
            this.disabled = false;
            this.textContent = '🔧 データ修正';
        }
    });
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        addFixedDBControls();
    }, 1000);
});

// グローバルに公開
window.loadOrdersFromFastDatabase = loadOrdersFromFastDatabase;
window.testDatabase = testDatabase;
window.comprehensiveDatabaseTest = comprehensiveDatabaseTest;
window.loadNextPage = loadNextPage;

console.log('✅ 修正版データベースローダー読み込み完了');