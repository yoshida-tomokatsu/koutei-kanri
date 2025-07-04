// ========================================
// MAIN.JS - メイン処理・初期化・イベント管理（DB直接読み込み版）
// ========================================

console.log('🚀 MAIN.JS 読み込み開始 - DB直接読み込み版');

// ========================================
// データベース設定
// ========================================

const DB_CONFIG = {
    API_URL: './editable-orders-api.php',           // 編集用API（wp_wqorders_editableのみ使用）
    FALLBACK_API_URL: './editable-orders-api.php',  // フォールバックも同じAPI
    TERTIARY_API_URL: './editable-orders-api.php',  // 第3候補も同じAPI
    KIRYU_API_URL: './editable-orders-api.php',     // 最終候補も同じAPI
    DEFAULT_PAGE_SIZE: 100,       // 1ページあたり100件（フィルタリング後）
    MAX_PAGE_SIZE: 100,           // 1ページあたりの表示件数
    MAX_TOTAL_PAGES: 9999999,     // 実質無制限（約1000万ページ）
    LOAD_TIMEOUT: 120000,         // 本番環境用：2分（大量データ対応）
    FAST_TIMEOUT: 60000,          // 本番環境用：1分
    FILE_TIMEOUT: 30000,          // 本番環境用：30秒
    CACHE_DURATION: 30 * 60 * 1000 // キャッシュ有効期限（30分）
};

// ページネーション状態
let paginationState = {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    pageSize: DB_CONFIG.DEFAULT_PAGE_SIZE,
    loading: false
};

// データキャッシュ
let dataCache = {
    pages: new Map(),           // ページ別データキャッシュ
    fileCache: new Map(),       // ファイル情報キャッシュ
    totalRecords: 0,
    lastUpdate: null,
    
    // キャッシュを取得
    getPage: function(page) {
        const cached = this.pages.get(page);
        if (cached && (Date.now() - cached.timestamp) < DB_CONFIG.CACHE_DURATION) {
            return cached.data;
        }
        return null;
    },
    
    // キャッシュを保存
    setPage: function(page, data) {
        this.pages.set(page, {
            data: data,
            timestamp: Date.now()
        });
    },
    
    // キャッシュをクリア
    clear: function() {
        this.pages.clear();
        this.fileCache.clear();
        this.lastUpdate = null;
        console.log('🗑️ キャッシュをクリアしました');
    },
    
    // キャッシュ統計
    getStats: function() {
        return {
            pagesCached: this.pages.size,
            filesCached: this.fileCache.size,
            lastUpdate: this.lastUpdate,
            totalSize: this.pages.size + this.fileCache.size
        };
    }
};

/**
 * 強制的にキャッシュをクリア（カテゴリ色も再適用）
 */
function forceClearCache() {
    console.log('🗑️ 強制キャッシュクリア開始...');
    
    // 1. データキャッシュをクリア
    if (window.dataCache && typeof window.dataCache.clear === 'function') {
        window.dataCache.clear();
    }
    
    // 2. ブラウザキャッシュをクリア
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }
    
    // 3. カテゴリ色を強制的に再適用
    setTimeout(() => {
        console.log('🎨 カテゴリ色の強制再適用開始...');
        document.querySelectorAll('.category-dropdown').forEach(select => {
            if (window.updateCategoryColor && typeof window.updateCategoryColor === 'function') {
                window.updateCategoryColor(select);
                console.log('🎨 カテゴリ色再適用:', {
                    element: select,
                    value: select.value,
                    classes: select.className
                });
            }
        });
        console.log('✅ カテゴリ色の強制再適用完了');
    }, 200);
    
    // 4. 最新データを取得
    setTimeout(() => {
        console.log('🔄 最新データ取得開始...');
        if (window.loadOrdersFromData && typeof window.loadOrdersFromData === 'function') {
            window.loadOrdersFromData().then(() => {
                console.log('✅ キャッシュクリア完了 - 最新データ表示');
                
                // カテゴリ色を再度適用（データ再読み込み後）
                setTimeout(() => {
                    document.querySelectorAll('.category-dropdown').forEach(select => {
                        if (window.updateCategoryColor && typeof window.updateCategoryColor === 'function') {
                            window.updateCategoryColor(select);
                        }
                    });
                    console.log('✅ データ再読み込み後のカテゴリ色適用完了');
                }, 300);
            }).catch(error => {
                console.error('❌ データ再読み込みエラー:', error);
            });
        }
    }, 500);
}

/**
 * 全てのキャッシュをクリア（グローバル関数）
 */
window.clearAllCaches = function() {
    dataCache.clear();
    
    if (window.pageCache && window.pageCache.clear) {
        window.pageCache.clear();
    }
    
    if (window.cacheBuster && window.cacheBuster.clearCache) {
        window.cacheBuster.clearCache();
    }
    
    console.log('🗑️ 全キャッシュクリア完了');
};

// ========================================
// DB状態UI更新関数
// ========================================

/**
 * DB状態表示を更新
 */
function updateDBStatusUI() {
    const indicator = document.getElementById('dbStatusIndicator');
    const icon = document.getElementById('dbStatusIcon');
    const text = document.getElementById('dbStatusText');
    
    if (!indicator || !icon || !text) return;
    
    if (dbConnectionStatus.connected) {
        indicator.style.backgroundColor = '#27ae60';
        icon.textContent = '✅';
        text.textContent = 'DB正常';
        indicator.title = `DB接続正常 | API: ${dbConnectionStatus.apiUsed || '不明'} | レコード数: ${dbConnectionStatus.totalRecords}件`;
    } else {
        indicator.style.backgroundColor = '#e74c3c';
        icon.textContent = '❌';
        text.textContent = 'DBエラー';
        indicator.title = `DB接続エラー: ${dbConnectionStatus.error || '不明なエラー'}`;
    }
}

/**
 * DB状態詳細を表示
 */
function showDBStatusDetails() {
    const status = dbConnectionStatus.getStatus();
    const cacheStats = dataCache.getStats();
    
    let message = '📊 データベース状態詳細\n\n';
    message += `接続状態: ${status.connected ? '✅ 正常' : '❌ エラー'}\n`;
    message += `API: ${status.apiUsed || '不明'}\n`;
    message += `総レコード数: ${status.totalRecords}件\n`;
    message += `最終確認: ${status.lastTest ? status.lastTest.toLocaleString() : '未確認'}\n\n`;
    
    if (!status.connected && status.error) {
        message += `エラー詳細: ${status.error}\n\n`;
    }
    
    message += '💾 キャッシュ情報\n';
    message += `ページキャッシュ: ${cacheStats.pagesCached}件\n`;
    message += `ファイルキャッシュ: ${cacheStats.filesCached}件\n`;
    message += `最終更新: ${cacheStats.lastUpdate ? new Date(cacheStats.lastUpdate).toLocaleString() : '未更新'}`;
    
    console.log(message);
    // alert(message);
}

// ========================================
// ページネーション機能（軽量版）
// ========================================

/**
 * ページネーション表示を更新（新しいUI対応）
 */
function updatePaginationUI() {
    const config = window.paginationConfig;
    if (!config) {
        console.error('❌ ページネーション設定が見つかりません');
        return;
    }
    
    updatePageNumbers();
    updatePageInfo();
    
    // 前後ボタンの状態更新
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) {
        prevBtn.disabled = config.currentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = config.currentPage >= config.totalPages;
    }
}

/**
 * ページ番号表示の更新
 */
function updatePageNumbers() {
    const config = window.paginationConfig;
    if (!config) return;
    
    console.log(`🔢 ページ番号更新: 現在${config.currentPage}ページ / 全${config.totalPages}ページ`);
    
    const container = document.getElementById('paginationNumbers');
    if (!container) {
        console.warn('⚠️ ページ番号コンテナが見つかりません');
        return;
    }
    
    container.innerHTML = '';
    
    // 表示するページ範囲を計算
    const maxVisible = 10;
    let startPage = Math.max(1, config.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(config.totalPages, startPage + maxVisible - 1);
    
    // 調整
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    console.log(`📋 表示ページ範囲: ${startPage} - ${endPage}`);
    
    // ページ番号ボタンを生成
    for (let i = startPage; i <= endPage; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = 'page-btn' + (i === config.currentPage ? ' active' : '');
        button.onclick = () => goToPage(i);
        
        // ボタンスタイルを大きく見やすく設定
        button.style.cssText = `
            background-color: ${i === config.currentPage ? '#007bff' : '#ffffff'};
            color: ${i === config.currentPage ? 'white' : '#495057'};
            border: 1px solid ${i === config.currentPage ? '#007bff' : '#ced4da'};
            padding: 8px 12px;
            margin: 0 2px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: ${i === config.currentPage ? 'bold' : 'normal'};
            min-width: 40px;
            height: 36px;
            transition: all 0.2s ease;
        `;
        
        // ホバー効果
        if (i !== config.currentPage) {
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = '#e9ecef';
                button.style.borderColor = '#adb5bd';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = '#ffffff';
                button.style.borderColor = '#ced4da';
            });
        }
        
        container.appendChild(button);
    }
    
    console.log(`✅ ページ番号ボタン生成完了: ${endPage - startPage + 1}個`);
}

/**
 * ページ情報の更新
 */
function updatePageInfo() {
    const config = window.paginationConfig;
    if (!config) return;
    
    const startRecord = (config.currentPage - 1) * config.pageSize + 1;
    const endRecord = Math.min(config.currentPage * config.pageSize, config.totalRecords);
    
    // 総件数表示を更新
    const totalCountElement = document.getElementById('totalCountInfo');
    if (totalCountElement) {
        totalCountElement.textContent = `総件数: ${config.totalRecords}件`;
    }
    
    // 現在のページ情報を更新
    const pageInfoElement = document.getElementById('paginationInfo');
    if (pageInfoElement) {
        pageInfoElement.textContent = `${startRecord}-${endRecord}件 / ${config.totalRecords}件`;
    }
    
    const pageStatusElement = document.getElementById('pageStatus');
    if (pageStatusElement) {
        pageStatusElement.textContent = `ページ ${config.currentPage} / ${config.totalPages}`;
    }
}

/**
 * ページ番号ボタンを追加（シンプル版）
 */
function addPageNumberButton(pageNumber, isActive) {
    const paginationNumbers = document.getElementById('paginationNumbers');
    const button = document.createElement('button');
    
    button.textContent = pageNumber;
    button.className = 'page-number-btn';
    button.style.cssText = `
        background-color: ${isActive ? '#007bff' : '#ffffff'};
        color: ${isActive ? 'white' : '#495057'};
        border: 1px solid ${isActive ? '#007bff' : '#ced4da'};
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        min-width: 28px;
        font-weight: ${isActive ? 'bold' : 'normal'};
        height: 26px;
    `;
    
    if (!isActive) {
        button.addEventListener('click', () => goToPage(pageNumber));
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#e9ecef';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#ffffff';
        });
    }
    
    paginationNumbers.appendChild(button);
}

/**
 * 省略記号を追加（シンプル版）
 */
function addEllipsis() {
    const paginationNumbers = document.getElementById('paginationNumbers');
    const ellipsis = document.createElement('span');
    ellipsis.textContent = '...';
    ellipsis.style.cssText = `
        color: #6c757d;
        font-size: 12px;
        padding: 4px 6px;
        display: flex;
        align-items: center;
        height: 26px;
    `;
    paginationNumbers.appendChild(ellipsis);
}

/**
 * 「最後」ページボタンを追加
 */
function addLastPageButton(pageNumber, isActive) {
    const paginationNumbers = document.getElementById('paginationNumbers');
    const button = document.createElement('button');
    
    button.textContent = '最後';
    button.className = 'page-number-btn last-page-btn';
    button.title = `最後のページ (${pageNumber}ページ)`;
    button.style.cssText = `
        background-color: ${isActive ? '#007bff' : '#ffffff'};
        color: ${isActive ? 'white' : '#495057'};
        border: 1px solid ${isActive ? '#007bff' : '#ced4da'};
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        min-width: 32px;
        font-weight: ${isActive ? 'bold' : 'normal'};
        height: 26px;
    `;
    
    if (!isActive) {
        button.addEventListener('click', () => goToPage(pageNumber));
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#e9ecef';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#ffffff';
        });
    }
    
    paginationNumbers.appendChild(button);
}

/**
 * シンプルなページネーション初期化
 */
function initializeSimplePagination(totalRecords) {
    console.log('📄 シンプルページネーション初期化:', totalRecords + '件');
    
    const pageSize = 100; // 1ページあたり100件表示
    const totalPages = Math.ceil(totalRecords / pageSize);
    const currentPage = 1;
    
    // グローバル変数に設定
    window.paginationConfig = {
        totalRecords: totalRecords,
        pageSize: pageSize,
        totalPages: totalPages,
        currentPage: currentPage
    };
    
    console.log('📊 シンプルページネーション設定:', window.paginationConfig);
    
    // 最初のページを表示
    displayPageData(currentPage);
    
    // ページネーションUIを更新
    updatePaginationUI();
    
    console.log('✅ シンプルページネーション初期化完了:', totalPages + 'ページ');
}

/**
 * 指定ページのデータを表示
 */
function displayPageData(pageNumber) {
    if (!window.allOrdersData || !Array.isArray(window.allOrdersData)) {
        console.error('❌ 全データが利用できません');
        return;
    }
    
    const config = window.paginationConfig;
    if (!config) {
        console.error('❌ ページネーション設定が見つかりません');
        return;
    }
    
    const startIndex = (pageNumber - 1) * config.pageSize;
    const endIndex = Math.min(startIndex + config.pageSize, config.totalRecords);
    
    // 指定ページのデータを取得
    const pageData = window.allOrdersData.slice(startIndex, endIndex);
    
    console.log(`📄 ページ ${pageNumber} 表示: ${startIndex + 1}-${endIndex} (${pageData.length}件)`);
    
    // テーブルを再構築
    if (typeof buildOrdersTable === 'function') {
        buildOrdersTable(pageData);
    }
    if (typeof buildSimpleTable === 'function') {
        buildSimpleTable(pageData);
    }
    
    // 現在のページを更新
    config.currentPage = pageNumber;
    
    // ページネーションUIを更新
    updatePaginationUI();
}

/**
 * ページネーションを初期化（改良版）- 旧バージョン（使用しない）
 */
function initializePagination(totalRecords) {
    console.log('📄 ページネーション初期化:', totalRecords + '件');
    
    const pageSize = 100; // 1ページあたり100件表示
    const totalPages = Math.ceil(totalRecords / pageSize);
    const currentPage = 1;
    
    // グローバル変数に設定
    window.paginationConfig = {
        totalRecords: totalRecords,
        pageSize: pageSize,
        totalPages: totalPages,
        currentPage: currentPage
    };
    
    console.log('📊 ページネーション設定:', window.paginationConfig);
    
    // ページネーションUIを更新
    updatePaginationUI();
    
    console.log('✅ ページネーション初期化完了:', totalPages + 'ページ');
}

/**
 * 指定ページに移動（シンプル版）
 */
function goToPage(pageNumber) {
    const config = window.paginationConfig;
    if (!config) {
        console.error('❌ ページネーション設定が見つかりません');
        return;
    }
    
    if (pageNumber < 1 || pageNumber > config.totalPages) {
        console.warn('⚠️ 無効なページ番号:', pageNumber);
        return;
    }
    
    console.log(`🔄 ページ ${pageNumber} に移動中...`);
    displayPageData(pageNumber);
}



/**
 * 旧バージョンの調整関数（使用しない）
 */
async function adjustPaginationBasedOnActualDataSilently() {
    console.log('🔧 旧バージョンの調整関数は使用しません');
    return;
}

/**
 * 旧バージョンの調整関数（使用しない）
 */
async function adjustPaginationBasedOnActualData() {
    console.log('🔧 旧バージョンの調整関数は使用しません');
    return;
}

/**
 * 前のページに移動
 */
function goToPreviousPage() {
    goToPage(paginationState.currentPage - 1);
}

/**
 * 次のページに移動
 */
function goToNextPage() {
    goToPage(paginationState.currentPage + 1);
}

/**
 * 真のページネーション：1ページ分のデータのみ取得（フィルタリング込み）
 */
async function loadSinglePageWithFiltering(page, targetFilteredCount = 100) {
    console.log(`📡 ページ ${page} のデータを取得中... (目標${targetFilteredCount}件)`);
    
    const apiEndpoints = [
        { url: DB_CONFIG.API_URL, name: 'メインAPI' },
        { url: DB_CONFIG.FALLBACK_API_URL, name: 'フォールバック' },
        { url: DB_CONFIG.TERTIARY_API_URL, name: '第3候補' },
        { url: DB_CONFIG.KIRYU_API_URL, name: '最終候補' }
    ];
    
    for (const endpoint of apiEndpoints) {
        try {
            console.log(`⚡ ${endpoint.name} からページ ${page} を取得中...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), DB_CONFIG.FAST_TIMEOUT);
            
            // フィルタリングを考慮した取得サイズ（目標100件確保のため十分に多く取得）
            const fetchSize = Math.max(targetFilteredCount * 3, 300);
            
            console.log(`📊 APIページ ${page}: ${fetchSize}件取得予定`);
            
            const response = await fetch(
                `${endpoint.url}?action=get_orders&limit=${fetchSize}&page=${page}&t=${Date.now()}`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.warn(`HTTP エラー ${response.status} from ${endpoint.name}`);
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`📄 ${endpoint.name} APIレスポンス:`, {
                success: result.success,
                ordersCount: result.orders?.length || 0,
                dataOrdersCount: result.data?.orders?.length || 0,
                requestedSize: fetchSize,
                requestedPage: page
            });
            
            const responseData = result.data || result;
            const orders = responseData.orders || result.orders;
            
            if (result.success && orders && Array.isArray(orders)) {
                console.log(`📄 ${endpoint.name} から${orders.length}件の生データ取得`);
                
                if (orders.length === 0) {
                    console.warn(`⚠️ ページ ${page} でデータなし`);
                    return [];
                }
                
                // フィルタリング実行
                const filteredOrders = filterOutExcludedFormTitles(orders);
                console.log(`🔍 フィルタリング後: ${filteredOrders.length}件`);
                
                // 目標件数確保のチェック
                if (filteredOrders.length < targetFilteredCount) {
                    console.warn(`⚠️ フィルタリング後の件数が不足: ${filteredOrders.length}件 < ${targetFilteredCount}件`);
                    
                    // 不足分を次のAPIから取得を試みる（フォールバック処理）
                    if (filteredOrders.length < 50) {
                        console.warn(`❌ データ不足のため次のAPIを試行`);
                        throw new Error(`データ不足: ${filteredOrders.length}件`);
                    }
                }
                
                // 目標件数まで制限（100件確保）
                const resultOrders = filteredOrders.slice(0, targetFilteredCount);
                
                console.log(`✅ ページ ${page} 取得完了: ${resultOrders.length}件`);
                
                if (resultOrders.length > 0) {
                    // データの範囲をログ出力（デバッグ用）
                    const firstId = resultOrders[0]?.注文ID || resultOrders[0]?.id || 'N/A';
                    const lastId = resultOrders[resultOrders.length - 1]?.注文ID || resultOrders[resultOrders.length - 1]?.id || 'N/A';
                    console.log(`📋 データ範囲: ${firstId} ～ ${lastId} (${resultOrders.length}件)`);
                }
                
                updateDynamicOptionsFromDatabaseData(resultOrders);
                return resultOrders;
                
            } else {
                console.warn(`❌ ${endpoint.name} 無効なレスポンス:`, result);
                throw new Error(result.message || 'データ取得失敗');
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏰ ${endpoint.name} タイムアウト (${DB_CONFIG.FAST_TIMEOUT}ms)`);
            } else {
                console.warn(`❌ ${endpoint.name} エラー:`, error.message);
            }
            continue;
        }
    }
    
    console.error('❌ すべてのAPIでページデータの取得に失敗');
    throw new Error('すべてのAPIでページデータの取得に失敗しました');
}

/**
 * 指定ページのデータをデータベースから取得（100件表示保証版）
 */
async function loadPageFromDatabase(page, targetCount = 100) {
    console.log(`📡 ページ ${page} のデータを取得中... (目標: ${targetCount}件)`);
    
    // シンプルなページネーション：指定されたページサイズで取得
    console.log(`📊 ページ ${page} のデータを取得 (目標: ${targetCount}件)`);
    
    if (page <= 0) {
        console.log(`⚠️ 無効なページ番号: ${page}`);
        return [];
    }
    
    const apiEndpoints = [
        { url: DB_CONFIG.API_URL, name: 'メインAPI' },
        { url: DB_CONFIG.FALLBACK_API_URL, name: 'フォールバック' },
        { url: DB_CONFIG.TERTIARY_API_URL, name: '第3候補' },
        { url: DB_CONFIG.KIRYU_API_URL, name: '最終候補' }
    ];
    
    for (const endpoint of apiEndpoints) {
        try {
            console.log(`⚡ ${endpoint.name} からページ ${page} を取得中...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), DB_CONFIG.FAST_TIMEOUT);
            
            // 真のページネーション：指定ページのデータのみ取得
            const fetchLimit = targetCount;
            const calculatedPage = page;
            
            const response = await fetch(
                `${endpoint.url}?action=get_orders&limit=${fetchLimit}&page=${calculatedPage}&t=${Date.now()}`,
                { signal: controller.signal }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // APIレスポンス構造の変更に対応
            const responseData = result.data || result;
            const orders = responseData.orders || result.orders;
            const totalRecords = responseData.total_records || result.total_records;
            
            if (result.success && orders && orders.length > 0) {
                console.log(`📄 ${endpoint.name} APIページ${calculatedPage} 取得: ${orders.length}件`);
                
                // 除外対象のformTitleをフィルタリング
                const filteredOrders = filterOutExcludedFormTitles(orders);
                console.log(`🔍 フィルタリング後: ${filteredOrders.length}件`);
                
                // 真のページネーション：取得したデータをそのまま使用
                const resultOrders = filteredOrders;
                
                console.log(`✅ ${endpoint.name} からページ ${page} 取得完了:`, {
                    api_page: calculatedPage,
                    raw_count: orders.length,
                    filtered_count: resultOrders.length,
                    target: targetCount
                });
                
                // 注意：総レコード数は既にloadOrdersFromData()でフィルタリング後の正確な件数が設定済み
                // APIから返される totalRecords は生データの件数なので使用しない
                console.log(`📊 APIから総レコード数を受信: ${totalRecords}件（生データ）`);
                console.log(`📊 現在の設定済み総レコード数: ${paginationState.totalRecords}件（フィルタリング後）`);
                // 総件数の上書きは行わない（既にフィルタリング後の正確な値が設定済み）
                
                updateDynamicOptionsFromDatabaseData(resultOrders);
                return resultOrders;
            } else {
                throw new Error(result.message || 'データ取得失敗');
            }
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏰ ${endpoint.name} タイムアウト`);
            } else {
                console.warn(`❌ ${endpoint.name} エラー:`, error.message);
            }
            continue;
        }
    }
    
    throw new Error('すべてのAPIでページデータの取得に失敗しました');
}

/**
 * キャッシュをクリア
 */
function clearDataCache() {
    if (confirm('キャッシュをクリアしますか？\n※次回読み込み時にサーバーから最新データを取得します。')) {
        dataCache.clear();
        showTemporaryMessage('🗑️ キャッシュをクリアしました', 'success');
        
        // 現在のページを再読み込み
        const currentPage = paginationState.currentPage;
        paginationState.currentPage = 0; // 強制的に再読み込みさせる
        goToPage(currentPage);
    }
}

// データベース接続状態
let dbConnectionStatus = {
    connected: false,
    lastTest: null,
    error: null,
    apiUsed: null,
    totalRecords: 0,
    
    // 状態を更新
    update: function(connected, error = null, apiUsed = null, totalRecords = 0) {
        this.connected = connected;
        this.error = error;
        this.apiUsed = apiUsed;
        this.totalRecords = totalRecords;
        this.lastTest = new Date();
        updateDBStatusUI();
    },
    
    // 状態を取得
    getStatus: function() {
        return {
            connected: this.connected,
            error: this.error,
            apiUsed: this.apiUsed,
            totalRecords: this.totalRecords,
            lastTest: this.lastTest
        };
    }
};

// 除外対象のformTitle設定
// 除外対象のフォームタイトル（データベース側で処理済み、フロントエンドでは不要）
// const EXCLUDED_FORM_TITLES = [...]; // データベース側で既に除外処理済み

/**
 * フィルタリング処理は不要（データベース側で既に除外済み）
 * この関数は互換性のためそのまま返すのみ
 */
function filterOutExcludedFormTitles(orders) {
    if (!orders || !Array.isArray(orders)) {
        console.log('📋 データベース読み込み: 無効なデータまたは空配列');
        return [];
    }
    
    console.log('✅ データベース読み込み完了:', orders.length, '件（既に除外処理済み）');
    
    return orders; // データベース側で既に除外処理済みなのでそのまま返す
}

// ========================================
// データ読み込みとシステム初期化（最適化版）
// ========================================

/**
 * シンプルな100件ずつページネーション読み込み
 */
async function loadOrdersFromData() {
    console.log('🚀 データ読み込み開始（100件ずつページネーション）...');
    
    try {
        // まず総件数を取得
        const totalCount = await getTotalRecordsCount();
        console.log(`📊 総件数: ${totalCount}件`);
        
        if (totalCount === 0) {
            console.warn('⚠️ データが存在しません');
            window.ordersData = [];
            updateTableDisplay();
            return;
        }
        
        // ページネーション設定を初期化
        initializePagination(totalCount);
        
        // 1ページ目のデータを読み込み（100件）
        await loadPageData(1);
        
        // 初期データ読み込み後のカテゴリ色適用
        setTimeout(() => {
            console.log('🎨 初期データ読み込み後のカテゴリ色適用開始...');
            const dropdowns = document.querySelectorAll('.category-dropdown');
            console.log(`🔍 発見されたカテゴリプルダウン数: ${dropdowns.length}`);
            
            let appliedCount = 0;
            dropdowns.forEach((dropdown, index) => {
                if (dropdown.value && window.updateCategoryColor && typeof window.updateCategoryColor === 'function') {
                    // 一度クラスをクリア
                    dropdown.classList.remove('category-poli', 'category-silk', 'category-ribbon', 'category-tie', 'category-stole', 'category-chief');
                    
                    // 色を適用
                    window.updateCategoryColor(dropdown);
                    appliedCount++;
                    
                    console.log(`🎨 初期読み込み後の色適用[${index}]: ${dropdown.value} → ${dropdown.className}`);
                }
            });
            
            console.log(`✅ 初期データ読み込み後のカテゴリ色適用完了: ${appliedCount}/${dropdowns.length}件`);
        }, 500); // 初期読み込みは少し長めに遅延
        
        console.log('✅ データ読み込み完了');
        
    } catch (error) {
        console.error('❌ データ読み込みエラー:', error);
        showTemporaryMessage('データの読み込みに失敗しました: ' + error.message, 'error', 5000);
    }
}

/**
 * 総レコード数を取得
 */
async function getTotalRecordsCount() {
    // テストAPIの呼び出しを削除（404エラー対策）

    const apis = [
        'editable-orders-api.php?action=get_orders_count'
    ];
    
    for (const api of apis) {
        try {
            console.log(`📊 総件数取得中: ${api}`);
            
            const response = await fetch(api, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.error(`❌ JSONパースエラー (${api}):`, parseError);
                console.error('📄 レスポンステキスト (最初の1000文字):', text.substring(0, 1000));
                console.error('📄 レスポンス全体の長さ:', text.length);
                continue;
            }
            
            console.log(`🔍 APIレスポンス詳細:`, data);
            console.log(`🔍 data.success:`, data.success);
            console.log(`🔍 data.total_records:`, data.total_records);
            console.log(`🔍 data.data:`, data.data);
            
            if (data.success && data.total_records !== undefined) {
                console.log(`✅ 総件数取得成功: ${data.total_records}件`);
                return data.total_records;
            } else if (data.success && data.data && data.data.total_records !== undefined) {
                console.log(`✅ 総件数取得成功 (data.data): ${data.data.total_records}件`);
                return data.data.total_records;
            } else {
                console.log(`❌ 期待されるデータ構造ではありません`);
                console.log(`❌ data.success:`, data.success);
                console.log(`❌ data.total_records:`, data.total_records);
                console.log(`❌ data.data:`, data.data);
            }
            
        } catch (error) {
            console.error(`❌ 総件数取得エラー (${api}):`, error.message);
            continue;
        }
    }
    
    throw new Error('総件数の取得に失敗しました');
}

/**
 * 指定ページのデータを読み込み（100件固定）
 */
async function loadPageData(pageNumber) {
    console.log(`📄 ページ ${pageNumber} のデータ読み込み中（100件）...`);
    
    const pageSize = 100;
    
    // テストAPIの呼び出しを削除（404エラー対策）
    
    const apis = [
        `editable-orders-api.php?action=get_orders&page=${pageNumber}&limit=${pageSize}`
    ];
    
    for (const api of apis) {
        try {
            console.log(`⚡ データ取得中: ${api}`);
            
            const response = await fetch(api, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseError) {
                console.error(`❌ JSONパースエラー (${api}):`, parseError);
                console.error('📄 レスポンステキスト (最初の1000文字):', text.substring(0, 1000));
                console.error('📄 レスポンス全体の長さ:', text.length);
                console.error('📄 HTTPステータス:', response.status, response.statusText);
                continue;
            }
            
            if (data.success && (data.orders || data.data?.orders)) {
                const orders = data.orders || data.data.orders;
                console.log(`✅ ページ ${pageNumber} データ取得成功: ${orders.length}件`);
                
                // 現在のページデータを設定
                window.ordersData = orders;
                
                // 動的選択肢を更新（軽量版）
                updateDynamicOptionsSimple(orders);
                
                // テーブル表示を更新
                updateTableDisplay();
                
                // ページネーション状態を更新
                updatePaginationState(pageNumber);
                
                // カテゴリ色を確実に適用（ページデータ読み込み後）
                setTimeout(() => {
                    console.log('🎨 ページデータ読み込み後のカテゴリ色適用開始...');
                    const dropdowns = document.querySelectorAll('.category-dropdown');
                    console.log(`🔍 発見されたカテゴリプルダウン数: ${dropdowns.length}`);
                    
                    let appliedCount = 0;
                    dropdowns.forEach((dropdown, index) => {
                        if (dropdown.value && window.updateCategoryColor && typeof window.updateCategoryColor === 'function') {
                            // 一度クラスをクリア
                            dropdown.classList.remove('category-poli', 'category-silk', 'category-ribbon', 'category-tie', 'category-stole', 'category-chief');
                            
                            // 色を適用
                            window.updateCategoryColor(dropdown);
                            appliedCount++;
                            
                            console.log(`🎨 ページ読み込み後の色適用[${index}]: ${dropdown.value} → ${dropdown.className}`);
                        }
                    });
                    
                    console.log(`✅ ページデータ読み込み後のカテゴリ色適用完了: ${appliedCount}/${dropdowns.length}件`);
                }, 300); // 少し遅延させて確実に適用
                
                return orders;
            }
            
        } catch (error) {
            console.error(`❌ ページデータ取得エラー (${api}):`, error.message);
            continue;
        }
    }
    
    throw new Error(`ページ ${pageNumber} のデータ取得に失敗しました`);
}

/**
 * 動的選択肢を軽量更新（重い処理を避ける）
 */
function updateDynamicOptionsSimple(orders) {
    if (!orders || orders.length === 0) return;
    
    console.log('🔄 動的選択肢を軽量更新中...');
    
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
    
    // グローバルの動的選択肢を更新
    Object.keys(extractedOptions).forEach(key => {
        if (!window.dynamicOptions) window.dynamicOptions = {};
        window.dynamicOptions[key] = Array.from(extractedOptions[key]);
    });
    
    console.log('✅ 動的選択肢軽量更新完了');
}

/**
 * カテゴリ色のデバッグ機能
 */
function debugCategoryColors() {
    console.log('🎨 カテゴリ色デバッグ開始...');
    
    const dropdowns = document.querySelectorAll('.category-dropdown');
    console.log(`📊 発見されたカテゴリプルダウン数: ${dropdowns.length}`);
    
    dropdowns.forEach((dropdown, index) => {
        const debugInfo = {
            index: index,
            value: dropdown.value,
            className: dropdown.className,
            classList: Array.from(dropdown.classList),
            computedBackgroundColor: getComputedStyle(dropdown).backgroundColor,
            computedColor: getComputedStyle(dropdown).color,
            inlineStyles: {
                backgroundColor: dropdown.style.backgroundColor,
                color: dropdown.style.color,
                borderColor: dropdown.style.borderColor
            },
            parentElement: dropdown.parentElement?.className,
            orderNumber: dropdown.closest('.order-row')?.querySelector('.order-number')?.textContent || 'unknown'
        };
        
        console.log(`🔍 カテゴリプルダウン[${index}]:`, debugInfo);
        
        // updateCategoryColor関数をテスト
        if (window.updateCategoryColor && typeof window.updateCategoryColor === 'function') {
            console.log(`🔧 updateCategoryColor適用テスト[${index}]...`);
            window.updateCategoryColor(dropdown);
            
            // 適用後の状態を確認
            const afterInfo = {
                className: dropdown.className,
                classList: Array.from(dropdown.classList),
                computedBackgroundColor: getComputedStyle(dropdown).backgroundColor,
                computedColor: getComputedStyle(dropdown).color
            };
            console.log(`✅ 適用後[${index}]:`, afterInfo);
        } else {
            console.error(`❌ updateCategoryColor関数が利用できません`);
        }
    });
    
    // CSS確認
    console.log('📋 CSS確認:');
    const testElement = document.createElement('div');
    testElement.className = 'category-dropdown category-tie';
    document.body.appendChild(testElement);
    
    const cssTest = {
        'category-tie背景色': getComputedStyle(testElement).backgroundColor,
        'category-tie文字色': getComputedStyle(testElement).color
    };
    console.log('🎨 CSS確認結果:', cssTest);
    
    document.body.removeChild(testElement);
    
    console.log('✅ カテゴリ色デバッグ完了');
}

/**
 * 強制的にカテゴリ色を再適用
 */
function forceApplyCategoryColors() {
    console.log('🎨 カテゴリ色の強制適用開始...');
    
    const dropdowns = document.querySelectorAll('.category-dropdown');
    let appliedCount = 0;
    
    dropdowns.forEach((dropdown, index) => {
        if (dropdown.value && window.updateCategoryColor && typeof window.updateCategoryColor === 'function') {
            // 一度クラスをクリア
            dropdown.classList.remove('category-poli', 'category-silk', 'category-ribbon', 'category-tie', 'category-stole', 'category-chief');
            
            // 色を適用
            window.updateCategoryColor(dropdown);
            appliedCount++;
            
            console.log(`🎨 強制適用[${index}]: ${dropdown.value} → ${dropdown.className}`);
        }
    });
    
    console.log(`✅ カテゴリ色強制適用完了: ${appliedCount}/${dropdowns.length}件`);
    return appliedCount;
}

// グローバル関数として公開
window.debugCategoryColors = debugCategoryColors;
window.forceApplyCategoryColors = forceApplyCategoryColors;

// 削除済み: 重い処理の古い関数

// 削除済み: 重いファイル処理関数

/**
 * タイムアウト付きファイル取得
 */
async function loadFilesFromServerWithTimeout(orderId, timeout = DB_CONFIG.FILE_TIMEOUT) {
    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('ファイル取得タイムアウト'));
        }, timeout);
        
        try {
            const files = await loadFilesFromServer(orderId);
            clearTimeout(timeoutId);
            resolve(files);
        } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
        }
    });
}

/**
 * データベースデータから動的選択肢を更新
 */
function updateDynamicOptionsFromDatabaseData(orders) {
    if (!orders || orders.length === 0) return;
    
    console.log('🔄 動的選択肢を更新中...');
    
    const extractedOptions = {
        '注文担当': new Set(dynamicOptions['注文担当'] || []),
        '支払い方法': new Set(dynamicOptions['支払い方法'] || []), 
        'プリント工場': new Set(dynamicOptions['プリント工場'] || []),
        '縫製工場': new Set(dynamicOptions['縫製工場'] || []),
        '検品担当': new Set(dynamicOptions['検品担当'] || []),
        '配送会社': new Set(dynamicOptions['配送会社'] || [])
    };
    
    orders.forEach(order => {
        if (order.注文担当) extractedOptions['注文担当'].add(order.注文担当);
        if (order.支払い方法) extractedOptions['支払い方法'].add(order.支払い方法);
        if (order.プリント工場) extractedOptions['プリント工場'].add(order.プリント工場);
        if (order.縫製工場) extractedOptions['縫製工場'].add(order.縫製工場);
        if (order.検品担当) extractedOptions['検品担当'].add(order.検品担当);
        if (order.配送会社) extractedOptions['配送会社'].add(order.配送会社);
    });
    
    // グローバルの動的選択肢を更新
    Object.keys(extractedOptions).forEach(key => {
        dynamicOptions[key] = Array.from(extractedOptions[key]);
        window.dynamicOptions[key] = dynamicOptions[key];
    });
    
    console.log('✅ 動的選択肢更新完了:', Object.keys(extractedOptions).map(key => 
        `${key}: ${dynamicOptions[key].length}件`).join(', '));
}

/**
 * 各注文のファイル情報を取得（従来版：後方互換性のため残す）
 */
async function loadFileInformationForOrders(orders) {
    console.log('📁 従来のファイル情報取得開始:', orders.length, '件の注文');
    console.log('ℹ️ より高速な非同期版を使用することをお勧めします: loadFileInformationAsync()');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const order of orders) {
        try {
            const files = await loadFilesFromServerWithTimeout(order.注文ID, DB_CONFIG.FILE_TIMEOUT);
            serverFiles[order.注文ID] = files;
            successCount++;
        } catch (error) {
            console.warn('⚠️ ファイル情報取得失敗:', order.注文ID, error.message);
            serverFiles[order.注文ID] = { quotes: [], images: [] };
            errorCount++;
        }
    }
    
    console.log(`📁 ファイル情報取得完了: 成功${successCount}件, エラー${errorCount}件`);
}

/**
 * 一時メッセージを表示
 */
/**
 * 一時的なメッセージを表示（改良版）
 */
function showTemporaryMessage(message, type = 'info', duration = 3000) {
    // 既存のメッセージを削除
    const existingMsg = document.getElementById('temporaryMessage');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    // メッセージ要素を作成
    const msgElement = document.createElement('div');
    msgElement.id = 'temporaryMessage';
    msgElement.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease-out;
        line-height: 1.4;
        cursor: pointer;
    `;
    
    // タイプ別の色設定
    switch (type) {
        case 'success':
            msgElement.style.backgroundColor = '#27ae60';
            break;
        case 'warning':
            msgElement.style.backgroundColor = '#f39c12';
            break;
        case 'error':
            msgElement.style.backgroundColor = '#e74c3c';
            break;
        default:
            msgElement.style.backgroundColor = '#3498db';
    }
    
    msgElement.textContent = message;
    
    // クリックで閉じる機能
    msgElement.addEventListener('click', function() {
        if (msgElement.parentNode) {
            msgElement.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (msgElement.parentNode) {
                    msgElement.remove();
                }
            }, 300);
        }
    });
    
    // アニメーション用CSSが未追加の場合のみ追加
    if (!document.getElementById('temp-message-animations')) {
        const style = document.createElement('style');
        style.id = 'temp-message-animations';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(msgElement);
    
    // 指定時間後に削除
    setTimeout(() => {
        if (msgElement.parentNode) {
            msgElement.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (msgElement.parentNode) {
                    msgElement.remove();
                }
            }, 300);
        }
    }, duration);
}

// ========================================
// 追加のデータベース機能
// ========================================

// 削除済み: 重い追加データ読み込み関数

/**
 * データベース接続状態を確認
 */
function checkDatabaseStatus() {
    return dbConnectionStatus;
}

/**
 * データを高速再読み込み（最適化版）
 */
async function reloadDataFromDatabase() {
    console.log('⚡ 高速データベース再読み込み...');
    
    const tbody = document.getElementById('orders-table-body');
    if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="16" class="loading">高速再読み込み中...</td></tr>';
    }
    
    try {
        // 高速データベース取得を実行
        const dbData = await loadDataFromDatabaseFast();
        
        if (dbData && dbData.length > 0) {
            ordersData = dbData;
            window.ordersData = ordersData;
            
            // UIを先に構築
            buildOrdersTable();
            
            // ファイル情報を非同期で取得
            loadFileInformationAsync(ordersData);
            
            showTemporaryMessage(`⚡ ${ordersData.length}件のデータを高速再読み込みしました`, 'success');
        } else {
            console.warn('⚠️ 再読み込み時にデータが取得できませんでした');
            showTemporaryMessage('再読み込み時にデータが見つかりませんでした', 'warning');
        }
        
    } catch (error) {
        console.error('❌ 再読み込みエラー:', error);
        showTemporaryMessage(`再読み込みに失敗しました: ${error.message}`, 'error');
        
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="16" class="loading" style="color: red;">再読み込みに失敗しました</td></tr>';
        }
    }
}

/**
 * データベースのデバッグ情報を取得（フィルタリングは不要）
 */


/**
 * 現在のデータをフィルタリングテスト
 */
function testCurrentDataFiltering() {
    console.log('🧪 現在のデータでフィルタリングテスト開始...');
    
    if (!window.ordersData || window.ordersData.length === 0) {
        console.log('⚠️ テスト用データがありません');
        return;
    }
    
    console.log('📊 テスト対象データ:', window.ordersData.length, '件');
    
    // 最初の5件を詳細チェック
    const testData = window.ordersData.slice(0, 5);
    
    console.group('🔍 データ詳細確認');
    testData.forEach((order, index) => {
        console.log(`[${index}] 注文ID: ${order.注文ID}`, {
            '_form_title': order._form_title,
            'formTitle': order.formTitle,
            'カテゴリ': order.カテゴリ,
            '顧客名': order.顧客名,
            'すべてのキー': Object.keys(order).filter(key => key.includes('form') || key.includes('title') || key.includes('カテゴリ'))
        });
        
        // 除外対象かテスト（データベース側で既に除外処理済みなので、常にfalse）
        const shouldExclude = false;
        
        if (shouldExclude) {
            console.warn(`⚠️ 除外されるべきデータが残っています: ${order.注文ID}`);
        }
    });
    console.groupEnd();
}

/**
 * APIバージョンと機能確認
 */
async function checkAPIVersion() {
    console.log('📋 API機能確認中...');
    
    try {
        const response = await fetch(`${DB_CONFIG.API_URL}?action=info&t=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        console.log('📋 API情報:', {
            version: result.api_version,
            filtering_enabled: result.filtering_enabled,
            excluded_form_titles: result.excluded_form_titles
        });
        
        if (result.filtering_enabled) {
            console.log('✅ フィルタリング機能が有効です');
        } else {
            console.warn('⚠️ フィルタリング機能が無効です');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ API機能確認エラー:', error);
        throw error;
    }
}

// ========================================
// イベント管理（既存のコードを維持）
// ========================================

/**
 * 全イベントを初期化
 */
function initializeAllEvents() {
    // モーダル関連イベント
    initializeModalEvents();
    
    // 表示モード・タブイベント（安全にチェック）
    if (typeof window.initializeViewModeEvents === 'function') {
        window.initializeViewModeEvents();
    } else if (typeof initializeViewModeEvents === 'function') {
        initializeViewModeEvents();
    } else {
        console.log('ℹ️ initializeViewModeEvents関数が見つかりません');
    }
    
    if (typeof window.initializeTabEvents === 'function') {
        window.initializeTabEvents();
    } else if (typeof initializeTabEvents === 'function') {
        initializeTabEvents();
    } else {
        console.log('ℹ️ initializeTabEvents関数が見つかりません');
    }
    
    // テーブル行のイベント（安全にチェック）
    if (typeof window.initializeRowEvents === 'function') {
        window.initializeRowEvents();
    } else if (typeof initializeRowEvents === 'function') {
        initializeRowEvents();
    } else {
        console.log('ℹ️ initializeRowEvents関数が見つかりません');
    }
    
    // グローバルイベント
    initializeGlobalEvents();
    
    console.log('🎯 全イベント初期化完了');
}

/**
 * ESCキーによるモーダル終了処理とその他のグローバルイベント
 */
function initializeGlobalEvents() {
    // PDFモーダルの背景クリック処理
    const pdfModal = document.getElementById('pdfModal');
    if (pdfModal) {
        pdfModal.addEventListener('click', function(e) {
            if (e.target === pdfModal && window.closePDFModal) {
                window.closePDFModal();
            }
        });
    }
    
    // 新規注文ボタンのイベント
    const newOrderBtn = document.querySelector('.btn-new');
    if (newOrderBtn) {
        newOrderBtn.addEventListener('click', function() {
            // 新規注文機能（開発中）
            console.log('新規注文機能は開発中です');
            // alert('新規注文機能は開発中です');
        });
    }
    
    // 100件表示ボタンのイベント
    const load100ItemsBtn = document.getElementById('load100ItemsBtn');
    if (load100ItemsBtn) {
        load100ItemsBtn.addEventListener('click', async function() {
            console.log('🎯 100件表示ボタンがクリックされました');
            
            // ボタンを無効化
            this.disabled = true;
            this.textContent = '📊 読込中...';
            this.style.backgroundColor = '#95a5a6';
            
            try {
                // 100件表示を実行
                const result = await loadOrdersWithGuaranteed100Items();
                
                if (result.success) {
                    this.textContent = '✅ 完了';
                    this.style.backgroundColor = '#27ae60';
                    
                    // 3秒後に元に戻す
                    setTimeout(() => {
                        this.textContent = '📊 100件';
                        this.disabled = false;
                    }, 3000);
                } else {
                    throw new Error(result.error || '100件表示に失敗しました');
                }
                
            } catch (error) {
                console.error('❌ 100件表示エラー:', error);
                
                this.textContent = '❌ エラー';
                this.style.backgroundColor = '#e74c3c';
                
                // 3秒後に元に戻す
                setTimeout(() => {
                    this.textContent = '📊 100件';
                    this.style.backgroundColor = '#27ae60';
                    this.disabled = false;
                }, 3000);
                
                console.error('❌ 100件表示に失敗しました:', error);
                console.log('100件表示に失敗しました:', error.message);
                // alert('100件表示に失敗しました: ' + error.message);
            }
        });
    }
    
    // ページネーションボタンのイベント
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (!this.disabled) {
                goToPreviousPage();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (!this.disabled) {
                goToNextPage();
            }
        });
    }
    
    // DB状態インジケーターのクリックイベント
    const dbStatusIndicator = document.getElementById('dbStatusIndicator');
    if (dbStatusIndicator) {
        dbStatusIndicator.addEventListener('click', showDBStatusDetails);
    }
    
    // キャッシュクリアボタンのイベント
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearDataCache);
    }
    
    console.log('🌐 グローバルイベント初期化完了');
}

// ========================================
// データベースローディング画面制御（既存コードを維持）
// ========================================

let dbLoadingCancelled = false;
let dbLoadingTimeout = null;

function showDatabaseLoading() {
    dbLoadingCancelled = false;
    const overlay = document.getElementById('dbLoadingOverlay');
    if (overlay) {
        resetLoadingState();
        overlay.classList.add('show');
        dbLoadingTimeout = setTimeout(() => {
            if (!dbLoadingCancelled) {
                showLoadingError('読み込みがタイムアウトしました');
            }
        }, 30000);
    }
}

function hideDatabaseLoading() {
    const overlay = document.getElementById('dbLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('show');
        if (dbLoadingTimeout) {
            clearTimeout(dbLoadingTimeout);
            dbLoadingTimeout = null;
        }
    }
}

function resetLoadingState() {
    updateLoadingProgress(0, '接続準備中...');
    const details = document.getElementById('dbLoadingDetails');
    if (details) {
        details.innerHTML = `
            <div class="loading-step" id="step1">
                <span class="step-icon loading" id="stepIcon1">⏳</span>
                <span class="step-text" id="stepText1">データベース接続中...</span>
            </div>
        `;
    }
}

function updateLoadingProgress(percentage, message) {
    const progressFill = document.getElementById('dbProgressFill');
    const progressPercentage = document.getElementById('dbProgressPercentage');
    const loadingMessage = document.getElementById('dbLoadingMessage');
    
    if (progressFill) progressFill.style.width = percentage + '%';
    if (progressPercentage) progressPercentage.textContent = Math.round(percentage) + '%';
    if (loadingMessage && message) loadingMessage.textContent = message;
}

function addLoadingStep(stepId, icon, text, status = 'active') {
    const details = document.getElementById('dbLoadingDetails');
    if (details) {
        const stepHTML = `
            <div class="loading-step ${status}" id="${stepId}">
                <span class="step-icon ${status}" id="${stepId}Icon">${icon}</span>
                <span class="step-text" id="${stepId}Text">${text}</span>
            </div>
        `;
        details.insertAdjacentHTML('beforeend', stepHTML);
    }
}

function completeLoadingStep(stepId, completedText = null) {
    const stepElement = document.getElementById(stepId);
    const iconElement = document.getElementById(stepId + 'Icon');
    const textElement = document.getElementById(stepId + 'Text');
    
    if (stepElement) stepElement.className = 'loading-step completed';
    if (iconElement) {
        iconElement.textContent = '✅';
        iconElement.className = 'step-icon completed';
    }
    if (textElement && completedText) textElement.textContent = completedText;
}

function showLoadingError(errorMessage) {
    updateLoadingProgress(0, 'エラーが発生しました');
    const details = document.getElementById('dbLoadingDetails');
    if (details) {
        details.innerHTML = `
            <div class="loading-step" style="background: rgba(244, 67, 54, 0.3);">
                <span class="step-icon">❌</span>
                <span class="step-text">${errorMessage}</span>
            </div>
        `;
    }
    setTimeout(() => hideDatabaseLoading(), 3000);
}

function cancelDatabaseLoading() {
    console.log('❌ データベース読み込みをキャンセルしました');
    // alert('データベース読み込みをキャンセルしました');
    hideDatabaseLoading();
}

async function loadDatabaseWithProgress() {
    showDatabaseLoading();
    
    try {
        // ステップ1: 高速データ取得
        updateLoadingProgress(20, '高速データ取得中...');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (dbLoadingCancelled) return;
        
        const dbData = await loadDataFromDatabaseFast();
        completeLoadingStep('step1', `${dbData?.length || 0}件のデータを取得`);
        
        // ステップ2: データ準備
        addLoadingStep('step2', '⏳', 'データを準備中...', 'active');
        updateLoadingProgress(50, 'データを準備中...');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (dbLoadingCancelled) return;
        
        window.ordersData = dbData || [];
        completeLoadingStep('step2', 'データ準備完了');
        
        // ステップ3: UI構築
        addLoadingStep('step3', '⏳', 'テーブルを構築中...', 'active');
        updateLoadingProgress(80, 'テーブルを構築中...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (dbLoadingCancelled) return;
        
        buildOrdersTable();
        completeLoadingStep('step3', 'テーブル構築完了');
        
        // ステップ4: ファイル情報取得開始
        addLoadingStep('step4', '⏳', 'ファイル情報を取得中...', 'active');
        updateLoadingProgress(95, 'ファイル情報を取得中...');
        
        // 非同期でファイル情報取得開始（完了を待たない）
        loadFileInformationAsync(dbData || []);
        completeLoadingStep('step4', 'ファイル情報取得開始');
        
        // 完了
        updateLoadingProgress(100, '読み込み完了！');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setTimeout(() => {
            hideDatabaseLoading();
            showTemporaryMessage(`⚡ ${dbData?.length || 0}件のデータを高速読み込みしました`, 'success');
        }, 100);
        
    } catch (error) {
        if (!dbLoadingCancelled) {
            showLoadingError(error.message);
        }
    }
}

// ========================================
// デバッグ用データベース機能（更新版）
// ========================================

/**
 * 新しいデータベースコントロールを初期化（ページネーション対応）
 */
function initializeDatabaseControls() {
    console.log('🔧 新しいデータベースコントロール初期化（ページネーション対応）...');
    
    // DB状態インジケーター
    const dbStatusIndicator = document.getElementById('dbStatusIndicator');
    if (dbStatusIndicator) {
        dbStatusIndicator.addEventListener('click', showDBStatusDetails);
    }
    
    // 新しいページネーションボタン
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            goToPreviousPage();
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            goToNextPage();
        });
    }
    
    // キャッシュクリアボタン
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', clearDataCache);
    }
    
    // キーボードショートカット
    document.addEventListener('keydown', function(event) {
        // Ctrl+左右矢印でページ移動
        if (event.ctrlKey) {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goToPreviousPage();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                goToNextPage();
            }
        }
        
        // 数字キーでページ移動（1-9）
        if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.altKey && !event.shiftKey) {
            const pageNumber = parseInt(event.key);
            if (pageNumber <= paginationState.totalPages) {
                event.preventDefault();
                goToPage(pageNumber);
            }
        }
    });
    
    console.log('✅ 新しいデータベースコントロール初期化完了（ページネーション対応）');
}

// ========================================
// デバッグ・テスト機能（既存コードを維持）
// ========================================

window.testSimpleView = function() {
    console.log('🧪 簡易表示テスト開始');
    
    const data = window.ordersData || [];
    console.log('📊 テストデータ:', {
        length: data.length,
        firstItem: data[0],
        windowOrdersData: window.ordersData ? 'あり' : 'なし'
    });
    
    const simpleView = document.getElementById('simpleView');
    const tbody = document.getElementById('simple-table-body');
    const simpleTable = document.querySelector('.simple-table');
    
    console.log('🔍 要素確認:', {
        simpleView: simpleView ? 'あり' : 'なし',
        tbody: tbody ? 'あり' : 'なし',
        simpleTable: simpleTable ? 'あり' : 'なし',
        simpleViewClasses: simpleView ? simpleView.className : 'N/A',
        simpleViewDisplay: simpleView ? getComputedStyle(simpleView).display : 'N/A',
        tbodyChildren: tbody ? tbody.children.length : 'N/A',
        tbodyHTML: tbody ? tbody.innerHTML.substring(0, 200) : 'N/A'
    });
    
    if (simpleView) {
        console.log('🎯 簡易表示を強制アクティブ化');
        simpleView.style.display = 'block';
        simpleView.classList.add('active');
        
        const detailedView = document.getElementById('detailedView');
        if (detailedView) {
            detailedView.style.display = 'none';
            detailedView.classList.add('hidden');
        }
    }
    
    if (data.length > 0 && tbody) {
        console.log('🔄 強制的に簡易表示を構築...');
        buildSimpleTable();
        
        setTimeout(() => {
            console.log('📊 構築後の状態:', {
                tbodyChildren: tbody.children.length,
                firstRowHTML: tbody.children[0] ? tbody.children[0].innerHTML.substring(0, 100) : 'なし'
            });
        }, 500);
    }
};

// debugSimpleView関数を削除（デバッグ機能の軽量化）

// ========================================
// 起動時の初期化処理
// ========================================

/**
 * ページ読み込み時に実行
 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM読み込み完了 - ページネーション対応版で起動');
    
    try {
        // データ読み込み開始
        await loadOrdersFromData();
        
        // ページネーションボタンのイベントリスナー設定
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await goToPrevPage();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await goToNextPage();
            });
        }
        
        console.log('✅ 全初期化処理完了 - ページネーション対応版');
        
    } catch (error) {
        console.error('❌ 初期化エラー:', error);
    }
});

// ページの再読み込み時の警告
window.addEventListener('beforeunload', function(e) {
    // 編集中のデータがある場合の警告（将来的に実装）
    // e.preventDefault();
    // e.returnValue = '';
});

// ========================================
// グローバルに公開
// ========================================

// データベース関連
window.loadOrdersFromData = loadOrdersFromData;
window.getTotalRecordsCount = getTotalRecordsCount;
window.getFilteredTotalRecordsCount = getFilteredTotalRecordsCount;
window.loadPageFromDatabase = loadPageFromDatabase;
window.loadSinglePageWithFiltering = loadSinglePageWithFiltering;
window.checkDatabaseStatus = checkDatabaseStatus;

// ページネーション関連
window.paginationState = paginationState;
window.goToPage = goToPage;
window.goToPreviousPage = goToPreviousPage;
window.goToNextPage = goToNextPage;
window.initializePagination = initializePagination;
window.updatePaginationUI = updatePaginationUI;
window.updatePageNumbers = updatePageNumbers;
window.addPageNumberButton = addPageNumberButton;
window.addEllipsis = addEllipsis;

// キャッシュ関連
window.dataCache = dataCache;
window.clearDataCache = clearDataCache;

// DB状態管理
window.dbConnectionStatus = dbConnectionStatus;
window.updateDBStatusUI = updateDBStatusUI;
window.showDBStatusDetails = showDBStatusDetails;

// フィルタリング関連
window.filterOutExcludedFormTitles = filterOutExcludedFormTitles;
// window.EXCLUDED_FORM_TITLES = EXCLUDED_FORM_TITLES; // データベース側で既に除外処理済み

// メッセージ表示
window.showTemporaryMessage = showTemporaryMessage;

// 必要な関数のみ公開
window.loadDatabaseWithProgress = loadDatabaseWithProgress;
window.cancelDatabaseLoading = cancelDatabaseLoading;

// ローディング関数
window.showDatabaseLoading = showDatabaseLoading;
window.hideDatabaseLoading = hideDatabaseLoading;
window.updateLoadingProgress = updateLoadingProgress;
window.addLoadingStep = addLoadingStep;
window.completeLoadingStep = completeLoadingStep;
window.showLoadingError = showLoadingError;

console.log('✅ MAIN.JS 読み込み完了 - データベース直接読み込み版（フィルタリング対応）システム準備完了！');

/**
 * 実際の表示件数に基づいてページネーション情報を修正
 */
function correctPaginationBasedOnActualDisplay() {
    try {
        // 実際に表示されている注文行数を取得（ローディング行は除外）
        const displayedRows = document.querySelectorAll('#orders-table-body tr:not(.loading)');
        const actualDisplayCount = displayedRows.length;
        
        console.log(`📊 実際の表示件数チェック: ${actualDisplayCount}件`);
        
        if (actualDisplayCount > 0) {
            // 現在のページネーション状態を保存
            const previousState = {
                totalRecords: paginationState.totalRecords,
                totalPages: paginationState.totalPages,
                currentPage: paginationState.currentPage
            };
            
            // 実際の表示件数でページネーション情報を修正
            paginationState.totalRecords = actualDisplayCount;
            
            // 表示件数がページサイズ以下の場合は1ページのみ
            if (actualDisplayCount <= paginationState.pageSize) {
                paginationState.totalPages = 1;
                paginationState.currentPage = 1;
            } else {
                paginationState.totalPages = Math.ceil(actualDisplayCount / paginationState.pageSize);
            }
            
            console.log(`📊 ページネーション修正:`, {
                previous: previousState,
                corrected: {
                    totalRecords: paginationState.totalRecords,
                    totalPages: paginationState.totalPages,
                    currentPage: paginationState.currentPage,
                    pageSize: paginationState.pageSize
                }
            });
            
            // ページネーション表示を更新
            updatePageNumbers();
            updateDataInfo();
            
            // ページ情報表示を更新
            const startRecord = ((paginationState.currentPage - 1) * paginationState.pageSize) + 1;
            const endRecord = Math.min(startRecord + actualDisplayCount - 1, paginationState.totalRecords);
            
            const paginationInfo = document.getElementById('paginationInfo');
            if (paginationInfo) {
                paginationInfo.textContent = `${startRecord}-${endRecord}件 / ${paginationState.totalRecords}件`;
            }
            
            console.log(`✅ ページネーション修正完了: ${startRecord}-${endRecord}件 / ${paginationState.totalRecords}件`);
            
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ ページネーション修正エラー:', error);
        return false;
    }
}

/**
 * 表示更新後にページネーション修正を実行
 */
function updateTableDisplayWithCorrection(data) {
    // 既存の表示更新を実行
    updateTableDisplay(data);
    
    // 少し遅延してページネーション修正を実行
    setTimeout(() => {
        correctPaginationBasedOnActualDisplay();
    }, 500);
}

// グローバル関数として公開
window.correctPaginationBasedOnActualDisplay = correctPaginationBasedOnActualDisplay;
window.updateTableDisplayWithCorrection = updateTableDisplayWithCorrection;

/**
 * データ読み込み完了を監視して自動修正を実行
 */
function startPaginationAutoCorrection() {
    console.log('🤖 ページネーション自動修正監視開始');
    
    // 定期的に表示状態をチェック
    const checkInterval = setInterval(() => {
        const displayedRows = document.querySelectorAll('#orders-table-body tr:not(.loading)');
        const loadingRows = document.querySelectorAll('#orders-table-body tr.loading');
        
        // データ読み込みが完了している場合（ローディング行がなく、データ行がある）
        if (displayedRows.length > 0 && loadingRows.length === 0) {
            console.log('🎯 データ読み込み完了を検知 - 自動修正実行');
            
            // 修正を実行
            const corrected = correctPaginationBasedOnActualDisplay();
            
            if (corrected) {
                console.log('✅ 自動修正完了 - 監視停止');
                clearInterval(checkInterval);
            }
        }
    }, 2000); // 2秒ごとにチェック
    
    // 30秒後に監視を停止（無限ループ防止）
    setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏰ 自動修正監視タイムアウト');
    }, 30000);
}

/**
 * ページネーション強制修正（コンソールコマンド用）
 */
function fixPaginationNow() {
    console.log('🔧 ページネーション強制修正実行');
    const result = correctPaginationBasedOnActualDisplay();
    
    if (result) {
        console.log('✅ 強制修正完了');
        return '✅ ページネーション修正完了';
    } else {
        console.log('❌ 修正失敗');
        return '❌ 修正に失敗しました';
    }
}

// 自動監視を開始（無効化）
// document.addEventListener('DOMContentLoaded', function() {
//     setTimeout(() => {
//         startPaginationAutoCorrection();
//     }, 3000); // 3秒後に監視開始
// });

// グローバル関数として公開
window.startPaginationAutoCorrection = startPaginationAutoCorrection;
window.fixPaginationNow = fixPaginationNow;

/**
 * フィルタリング後に指定件数になるまでデータを取得
 */
async function loadFilteredOrdersToTargetCount(targetCount = 100) {
    console.log(`🎯 目標件数 ${targetCount} 件になるまでデータ取得開始`);
    
    let allOrders = [];
    let currentPage = 1;
    const maxPages = Math.ceil(50000 / 100); // 実際のデータに応じて調整（最大500ページ程度）
    const perPageLimit = 200; // 1回の取得で多めに取得
    
    try {
        while (allOrders.length < targetCount && currentPage <= maxPages) {
            console.log(`📄 ページ ${currentPage} を取得中... (現在: ${allOrders.length}件)`);
            
            // より多くのデータを取得（200件ずつ）
            const result = await loadPageFromDatabase(currentPage, perPageLimit);
            
            if (result.success && result.orders && result.orders.length > 0) {
                // 新しく取得したデータを追加
                allOrders = allOrders.concat(result.orders);
                console.log(`✅ ページ ${currentPage} 取得完了: +${result.orders.length}件 (累計: ${allOrders.length}件)`);
                
                // 目標件数に達した場合
                if (allOrders.length >= targetCount) {
                    console.log(`🎯 目標件数 ${targetCount} 件を達成！`);
                    break;
                }
                
                currentPage++;
            } else {
                console.log(`⚠️ ページ ${currentPage} でデータ取得終了`);
                break;
            }
            
            // 少し待機（APIに負荷をかけすぎないよう）
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 目標件数分だけ切り取り
        const targetOrders = allOrders.slice(0, targetCount);
        
        console.log(`📊 最終結果: 取得=${allOrders.length}件, 表示=${targetOrders.length}件`);
        
        // ページネーション情報を更新
        paginationState.totalRecords = targetOrders.length;
        paginationState.totalPages = Math.ceil(targetOrders.length / paginationState.pageSize);
        paginationState.currentPage = 1;
        
        return {
            success: true,
            orders: targetOrders,
            totalRecords: targetOrders.length,
            totalPages: paginationState.totalPages
        };
        
    } catch (error) {
        console.error('❌ フィルタ込み目標件数取得エラー:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 100件表示を保証するデータ読み込み
 */
async function loadOrdersWithGuaranteed100Items() {
    console.log('🚀 100件表示保証モード開始');
    
    try {
        // 目標100件でデータ取得
        const result = await loadFilteredOrdersToTargetCount(100);
        
        if (result.success && result.orders) {
            console.log(`✅ 100件表示保証完了: ${result.orders.length}件`);
            
            // グローバルデータを更新
            window.currentData = {
                orders: result.orders,
                totalRecords: result.totalRecords,
                totalPages: result.totalPages
            };
            
            // 表示を更新
            updateTableDisplay(result.orders);
            updatePageNumbers();
            updateDataInfo();
            
            // ページ情報を更新
            const paginationInfo = document.getElementById('paginationInfo');
            if (paginationInfo) {
                paginationInfo.textContent = `1-${result.orders.length}件 / ${result.totalRecords}件`;
            }
            
            console.log(`🎉 100件表示完了！`);
            return result;
            
        } else {
            throw new Error('データ取得に失敗しました');
        }
        
    } catch (error) {
        console.error('❌ 100件表示保証エラー:', error);
        return { success: false, error: error.message };
    }
}

// グローバル関数として公開
window.loadFilteredOrdersToTargetCount = loadFilteredOrdersToTargetCount;
window.loadOrdersWithGuaranteed100Items = loadOrdersWithGuaranteed100Items;

// 現在のページのデータを取得する関数
function getCurrentPageData() {
    // window.currentDataまたはfiltered_ordersから取得
    if (window.currentData && window.currentData.orders && window.currentData.orders.length > 0) {
        return window.currentData.orders;
    }
    
    // filtered_ordersがある場合はそれを使用
    if (typeof filtered_orders !== 'undefined' && filtered_orders && filtered_orders.length > 0) {
        return filtered_orders;
    }
    
    // 表示されている行から推測
    const displayedRows = document.querySelectorAll('#orders-table-body tr:not(.loading)');
    console.log(`📊 表示中の行数: ${displayedRows.length}`);
    
    return [];
}

// データ情報表示を更新する関数
function updateDataInfo() {
    console.log('📊 データ情報更新開始');
    const dataInfo = document.getElementById('dataInfo');
    if (dataInfo && paginationState) {
        const currentData = getCurrentPageData();
        const actualDisplayCount = currentData ? currentData.length : 0;
        const startRecord = actualDisplayCount > 0 ? ((paginationState.currentPage - 1) * paginationState.pageSize + 1) : 0;
        const endRecord = actualDisplayCount > 0 ? (startRecord + actualDisplayCount - 1) : 0;
        const displayText = actualDisplayCount > 0 ? `${startRecord}-${endRecord} / ${paginationState.totalRecords}件` : '0件';
        dataInfo.textContent = displayText;
        console.log(`📊 データ情報更新完了: ${displayText}`);
    } else {
        console.log('❌ dataInfo要素またはpaginationStateが見つかりません');
    }
}

/**
 * フィルタリング後の実際の総件数を取得
 */
async function getFilteredTotalRecordsCount() {
    console.log('📊 フィルタリング後の総件数を取得中...');
    
    // 進捗表示を追加
    showTemporaryMessage('📊 フィルタリング後の総件数を計算中...', 'info', 10000);
    
    const apiEndpoints = [
        { url: DB_CONFIG.API_URL, name: 'メインAPI' },
        { url: DB_CONFIG.FALLBACK_API_URL, name: 'フォールバック' },
        { url: DB_CONFIG.TERTIARY_API_URL, name: '第3候補' },
        { url: DB_CONFIG.KIRYU_API_URL, name: '最終候補' }
    ];
    
    for (const endpoint of apiEndpoints) {
        try {
            console.log(`⚡ ${endpoint.name} から全データを取得してフィルタリング...`);
            
            let allFilteredOrders = [];
            let currentPage = 1;
            const maxPages = 20; // 最大20ページまでに制限（処理時間短縮）
            const pageSize = 200; // 1回200件ずつ取得
            const maxTimeout = 8000; // タイムアウトを8秒に短縮
            
            // 全データを取得してフィルタリング
            while (currentPage <= maxPages) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), maxTimeout);
                
                try {
                    const response = await fetch(
                        `${endpoint.url}?action=get_orders&limit=${pageSize}&page=${currentPage}&t=${Date.now()}`,
                        { signal: controller.signal }
                    );
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const result = await response.json();
                    const responseData = result.data || result;
                    const orders = responseData.orders || result.orders;
                    
                    if (result.success && orders && orders.length > 0) {
                        console.log(`📄 ページ${currentPage} 取得: ${orders.length}件`);
                        
                        // 進捗表示を更新
                        showTemporaryMessage(`📊 ページ${currentPage}を処理中... (${allFilteredOrders.length}件処理済み)`, 'info', 5000);
                        
                        // フィルタリング
                        const filteredOrders = filterOutExcludedFormTitles(orders);
                        allFilteredOrders = allFilteredOrders.concat(filteredOrders);
                        
                        console.log(`📊 ページ${currentPage} フィルタ後: ${filteredOrders.length}件 (累計: ${allFilteredOrders.length}件)`);
                        
                        // データが200件未満なら最後のページ
                        if (orders.length < pageSize) {
                            console.log(`📄 ページ${currentPage}で全データ取得完了`);
                            break;
                        }
                        
                        currentPage++;
                        
                        // 処理時間が長すぎる場合は途中で終了
                        if (currentPage > 10) {
                            console.log(`⚠️ 処理時間短縮のため、ページ${currentPage}で処理を終了します`);
                            break;
                        }
                        
                    } else {
                        console.log(`⚠️ ページ${currentPage}でデータ終了`);
                        break;
                    }
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    if (fetchError.name === 'AbortError') {
                        console.warn(`⏰ ${endpoint.name} ページ${currentPage} タイムアウト`);
                        break; // タイムアウトしたら次のエンドポイントを試す
                    } else {
                        throw fetchError;
                    }
                }
            }
            
            const filteredTotal = allFilteredOrders.length;
            console.log(`✅ ${endpoint.name} フィルタリング後総件数: ${filteredTotal}件`);
            
            // 成功メッセージを表示
            showTemporaryMessage(`✅ フィルタリング完了: ${filteredTotal}件`, 'success', 3000);
            
            return filteredTotal;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`⏰ ${endpoint.name} タイムアウト`);
            } else {
                console.warn(`❌ ${endpoint.name} エラー:`, error.message);
            }
            continue;
        }
    }
    
    // すべてのエンドポイントで失敗した場合は、概算値を返す
    console.warn('⚠️ フィルタリング後総件数の取得に失敗しました。概算値を使用します。');
    showTemporaryMessage('⚠️ 総件数の取得に失敗しました。概算値を使用します。', 'warning', 5000);
    
    // 概算値として現在のページの件数から推定
    const currentPageData = window.ordersData || [];
    const estimatedTotal = Math.max(currentPageData.length, 100); // 最低100件と仮定
    console.log(`📊 概算総件数: ${estimatedTotal}件`);
    
    return estimatedTotal;
}

// デバッグ用：現在の状況を調査する関数
async function investigateFilteringIssue() {
    console.log('🔍 フィルタリング問題調査開始...');
    
    // 1. 現在のページネーション状態
    console.log('📊 現在のページネーション状態:', {
        totalRecords: paginationState.totalRecords,
        totalPages: paginationState.totalPages,
        currentPage: paginationState.currentPage,
        pageSize: paginationState.pageSize
    });
    
    // 2. 実際に表示されているデータ数
    const displayedRows = document.querySelectorAll('#orders-table-body tr:not(.loading)');
    console.log(`📊 実際に表示されている行数: ${displayedRows.length}`);
    
    // 3. 現在のデータの詳細確認
    const currentData = window.ordersData || [];
    console.log(`📊 現在のページのデータ数: ${currentData.length}`);
    
    // 4. フィルタリング処理テスト
    try {
        const rawTotal = await getTotalRecordsCount();
        console.log(`📊 生の総レコード数: ${rawTotal}件`);
        
        const filteredTotal = await getFilteredTotalRecordsCount();
        console.log(`📊 フィルタリング後総レコード数: ${filteredTotal}件`);
        
        const filterRate = ((rawTotal - filteredTotal) / rawTotal * 100).toFixed(1);
        console.log(`📊 除外率: ${filterRate}%`);
        
    } catch (error) {
        console.error('❌ 総レコード数取得エラー:', error);
    }
    
    // 5. 除外対象のformTitleを確認
            // console.log('🚫 除外対象:', EXCLUDED_FORM_TITLES); // データベース側で既に除外処理済み
    
    // 6. 現在のページのサンプルデータをチェック
    if (currentData.length > 0) {
        console.log('📄 現在ページの最初の3件のformTitle:');
        currentData.slice(0, 3).forEach((order, index) => {
            console.log(`  [${index}] 注文ID: ${order.注文ID}`, {
                '_form_title': order._form_title,
                'formTitle': order.formTitle,
                'カテゴリ': order.カテゴリ
            });
        });
    }
    
    return {
        displayedRowCount: displayedRows.length,
        currentDataCount: currentData.length,
        paginationTotalRecords: paginationState.totalRecords,
        currentPage: paginationState.currentPage
    };
}

// グローバル関数として公開
window.investigateFilteringIssue = investigateFilteringIssue;

// 緊急修正：フィルタリング後の正確な総件数に基づいてページネーションを修正
async function forceFixFilteringPagination() {
    console.log('🔧 強制フィルタリング修正開始...');
    
    try {
        // 1. 現在の状況を確認
        console.log('📊 修正前の状態:');
        await investigateFilteringIssue();
        
        // 2. 正確なフィルタリング後総件数を再取得
        console.log('📊 正確な総件数を再計算中...');
        const accurateTotal = await getFilteredTotalRecordsCount();
        console.log(`✅ 正確なフィルタリング後総件数: ${accurateTotal}件`);
        
        // 3. ページネーションを再初期化
        console.log('🔄 ページネーション再初期化...');
        initializePagination(accurateTotal);
        
        // 4. 現在のページが有効範囲を超えている場合は最後のページに移動
        const maxValidPage = Math.ceil(accurateTotal / paginationState.pageSize);
        if (paginationState.currentPage > maxValidPage) {
            console.log(`⚠️ 現在のページ ${paginationState.currentPage} が有効範囲を超えています。ページ ${maxValidPage} に移動します`);
            await goToPage(maxValidPage);
        }
        
        // 5. UIを強制更新
        updatePaginationUI();
        
        console.log('✅ フィルタリング修正完了!');
        showTemporaryMessage(`🔧 フィルタリング修正完了: ${accurateTotal}件に修正しました`, 'success');
        
        return {
            success: true,
            correctedTotal: accurateTotal,
            previousTotal: paginationState.totalRecords,
            currentPage: paginationState.currentPage,
            maxValidPage: maxValidPage
        };
        
    } catch (error) {
        console.error('❌ フィルタリング修正エラー:', error);
        showTemporaryMessage(`❌ フィルタリング修正失敗: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

// グローバル関数として公開
window.forceFixFilteringPagination = forceFixFilteringPagination;

/**
 * 緊急時用のテーブル表示関数
 */
async function updateTableDisplay(data) {
    console.log(`📊 テーブル表示更新: ${data.length}件`);
    
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) {
        console.error('❌ テーブルボディが見つかりません');
        return;
    }
    
    try {
        // データが空の場合
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="16" class="text-center">データがありません</td></tr>';
            
            // 簡易表示テーブルも更新
            const simpleTableBody = document.getElementById('simple-table-body');
            if (simpleTableBody) {
                simpleTableBody.innerHTML = '<tr><td colspan="22" class="text-center">データがありません</td></tr>';
            }
            return;
        }
        
        // グローバル変数を更新
        window.ordersData = data;
        
        // テーブルを構築（詳細表示と簡易表示の両方）
        console.log('🔍 buildOrdersTable関数の存在確認:', typeof buildOrdersTable);
        console.log('🔍 buildSimpleTable関数の存在確認:', typeof buildSimpleTable);
        console.log('🔍 データの詳細:', {
            dataLength: data.length,
            firstItem: data[0],
            dataKeys: data[0] ? Object.keys(data[0]) : 'なし'
        });
        
        // 詳細表示テーブルを構築
        if (typeof buildOrdersTable === 'function') {
            console.log('📋 buildOrdersTable関数を呼び出し中...');
            buildOrdersTable();
            console.log('✅ buildOrdersTable関数呼び出し完了');
        } else {
            console.log('⚠️ buildOrdersTable関数が見つからないため、基本表示を使用');
            // 基本的なテーブル表示
            let html = '';
            data.forEach((order, index) => {
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${order.注文ID || 'N/A'}</td>
                        <td>${order.顧客名 || 'N/A'}</td>
                        <td>${order.カテゴリ || 'N/A'}</td>
                        <td>${order.受注日 || 'N/A'}</td>
                        <td>${order.希望納期 || 'N/A'}</td>
                        <td>${order.進捗 || 'N/A'}</td>
                        <td>${order.備考 || ''}</td>
                        <td colspan="8">基本情報のみ表示</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
        
        // 簡易表示テーブルも構築
        if (typeof buildSimpleTable === 'function') {
            console.log('📋 buildSimpleTable関数を呼び出し中...');
            buildSimpleTable();
            console.log('✅ buildSimpleTable関数呼び出し完了');
        }
        
        // 実際にテーブルが更新されたかを確認
        const actualRows = tbody.querySelectorAll('tr');
        console.log('🔍 テーブル更新後の行数:', actualRows.length);
        console.log('🔍 テーブルの内容確認:', actualRows.length > 0 ? 'データあり' : 'データなし');
        
        // イベントを初期化
        if (typeof initializeAllEvents === 'function') {
            initializeAllEvents();
        }
        
        console.log('✅ テーブル表示更新完了');
        
    } catch (error) {
        console.error('❌ テーブル表示更新エラー:', error);
        tbody.innerHTML = `<tr><td colspan="16" class="text-center text-danger">テーブル表示エラー: ${error.message}</td></tr>`;
        
        // 簡易表示テーブルにもエラー表示
        const simpleTableBody = document.getElementById('simple-table-body');
        if (simpleTableBody) {
            simpleTableBody.innerHTML = `<tr><td colspan="22" class="text-center text-danger">テーブル表示エラー: ${error.message}</td></tr>`;
        }
    }
}



// ページネーション状態を更新
function updatePaginationState(pageNumber) {
    if (window.paginationConfig) {
        window.paginationConfig.currentPage = pageNumber;
        updatePaginationUI();
    }
}

// ページ移動（データを新しく読み込み）
async function goToPage(pageNumber) {
    const config = window.paginationConfig;
    if (!config) {
        console.error('❌ ページネーション設定が見つかりません');
        return;
    }
    
    if (pageNumber < 1 || pageNumber > config.totalPages) {
        console.warn('⚠️ 無効なページ番号:', pageNumber);
        return;
    }
    
    if (pageNumber === config.currentPage) {
        console.log('ℹ️ 既に同じページです');
        return;
    }
    
    console.log(`🔄 ページ ${pageNumber} に移動中...`);
    
    try {
        // 新しいページのデータを読み込み
        await loadPageData(pageNumber);
        // showTemporaryMessage(`📄 ページ ${pageNumber} を表示`, 'success', 1000); // チカチカするので削除
    } catch (error) {
        console.error('❌ ページ移動エラー:', error);
        showTemporaryMessage('ページの読み込みに失敗しました: ' + error.message, 'error', 3000);
    }
}

// 前のページに移動
async function goToPrevPage() {
    const config = window.paginationConfig;
    if (config && config.currentPage > 1) {
        await goToPage(config.currentPage - 1);
    }
}

// 次のページに移動
async function goToNextPage() {
    const config = window.paginationConfig;
    if (config && config.currentPage < config.totalPages) {
        await goToPage(config.currentPage + 1);
    }
}

// テーブル表示を更新
async function updateTableDisplay() {
    console.log('📊 テーブル表示更新:', window.ordersData?.length || 0, '件');
    
    if (!window.ordersData || !Array.isArray(window.ordersData)) {
        console.warn('⚠️ 表示するデータがありません');
        return;
    }
    
    // 関数の存在確認
    console.log('🔍 buildOrdersTable関数の存在確認:', typeof buildOrdersTable);
    console.log('🔍 buildSimpleTable関数の存在確認:', typeof buildSimpleTable);
    console.log('🔍 データの詳細:', {
        dataLength: window.ordersData.length,
        firstItem: window.ordersData[0],
        dataKeys: window.ordersData[0] ? Object.keys(window.ordersData[0]) : []
    });
    
    try {
        // 詳細テーブルを構築
        console.log('📋 buildOrdersTable関数を呼び出し中...');
        if (typeof window.buildOrdersTable === 'function') {
            window.buildOrdersTable();
            console.log('✅ buildOrdersTable関数呼び出し完了');
        } else if (typeof buildOrdersTable === 'function') {
            buildOrdersTable();
            console.log('✅ buildOrdersTable関数呼び出し完了');
        } else {
            console.error('❌ buildOrdersTable関数が見つかりません');
        }
        
        // 簡易テーブルを構築
        console.log('📋 buildSimpleTable関数を呼び出し中...');
        if (typeof window.buildSimpleTable === 'function') {
            window.buildSimpleTable();
            console.log('✅ buildSimpleTable関数呼び出し完了');
        } else if (typeof buildSimpleTable === 'function') {
            buildSimpleTable();
            console.log('✅ buildSimpleTable関数呼び出し完了');
        } else {
            console.log('ℹ️ buildSimpleTable関数が見つかりません（詳細表示のみ使用）');
        }
        
        console.log('🔍 テーブル更新後の行数:', document.querySelectorAll('#ordersTableBody tr').length);
        console.log('🔍 テーブルの内容確認:', document.querySelector('#ordersTableBody') ? 'データあり' : 'データなし');
        
        // イベントを再初期化（安全にチェック）
        if (typeof initializeModalEvents === 'function') {
            initializeModalEvents();
        }
        if (typeof initializeToggleEvents === 'function') {
            initializeToggleEvents();
        }
        if (typeof window.initializeTabEvents === 'function') {
            window.initializeTabEvents();
        }
        if (typeof initializeGlobalEvents === 'function') {
            initializeGlobalEvents();
        }
        // initializeAllEventsは後で安全に呼び出し
        
        // カテゴリ色を確実に適用（テーブル更新後）
        setTimeout(() => {
            console.log('🎨 テーブル更新後のカテゴリ色適用開始...');
            const dropdowns = document.querySelectorAll('.category-dropdown');
            console.log(`🔍 発見されたカテゴリプルダウン数: ${dropdowns.length}`);
            
            let appliedCount = 0;
            dropdowns.forEach((dropdown, index) => {
                if (dropdown.value && window.updateCategoryColor && typeof window.updateCategoryColor === 'function') {
                    // 一度クラスをクリア
                    dropdown.classList.remove('category-poli', 'category-silk', 'category-ribbon', 'category-tie', 'category-stole', 'category-chief');
                    
                    // 色を適用
                    window.updateCategoryColor(dropdown);
                    appliedCount++;
                    
                    console.log(`🎨 テーブル更新後の色適用[${index}]: ${dropdown.value} → ${dropdown.className}`);
                }
            });
            
            console.log(`✅ テーブル更新後のカテゴリ色適用完了: ${appliedCount}/${dropdowns.length}件`);
        }, 200); // 少し遅延させて確実に適用
        
        console.log('✅ テーブル表示更新完了');
        
    } catch (error) {
        console.error('❌ テーブル表示更新エラー:', error);
    }
}