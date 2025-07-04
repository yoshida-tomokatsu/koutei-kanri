/**
 * 注文データ自動保存管理
 * フィールドの変更を検知して自動保存する
 */

// 保存待ちのタイマー管理
const saveTimers = new Map();
const SAVE_DELAY = 1000; // 1秒後に保存

/**
 * 注文データの自動保存機能を初期化
 */
function initializeAutoSave() {
    console.log('🔄 自動保存機能を初期化中...');
    
    // 詳細表示のフィールドに変更監視を追加
    addChangeListenersToDetailedView();
    
    console.log('✅ 自動保存機能初期化完了');
}

/**
 * 詳細表示のフィールドに変更監視を追加
 */
function addChangeListenersToDetailedView() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;
    
    // 入力フィールドの変更を監視
    tbody.addEventListener('input', handleFieldChange);
    tbody.addEventListener('change', handleFieldChange);
}

/**
 * フィールド変更の処理
 */
function handleFieldChange(event) {
    const target = event.target;
    
    // 保存対象のフィールドかチェック
    if (!isSaveableField(target)) {
        return;
    }
    
    // 注文IDとフィールド名を取得
    const orderInfo = getOrderInfoFromElement(target);
    if (!orderInfo) {
        console.warn('注文情報を取得できませんでした:', target);
        return;
    }
    
    const { orderId, fieldName, fieldValue } = orderInfo;
    
    console.log('📝 フィールド変更検知:', { orderId, fieldName, fieldValue });
    
    // 既存のタイマーをクリア
    const timerKey = `${orderId}_${fieldName}`;
    if (saveTimers.has(timerKey)) {
        clearTimeout(saveTimers.get(timerKey));
    }
    
    // 新しいタイマーを設定（遅延保存）
    const timer = setTimeout(() => {
        saveFieldUpdate(orderId, fieldName, fieldValue);
        saveTimers.delete(timerKey);
    }, SAVE_DELAY);
    
    saveTimers.set(timerKey, timer);
}

/**
 * 保存対象のフィールドかチェック
 */
function isSaveableField(element) {
    const saveableClasses = [
        'text-input',
        'date-input',
        'category-dropdown',
        'customer-name-input',
        'company-name-input',
        'person-select',
        'payment-select',
        'factory-select',
        'shipping-select',
        'remarks-text',
        'publication-permission-select'
    ];
    
    return saveableClasses.some(className => element.classList.contains(className));
}

/**
 * 要素から注文情報を取得
 */
function getOrderInfoFromElement(element) {
    try {
        // 最も近い行要素を取得
        const row = element.closest('tr.order-row');
        if (!row) return null;
        
        // 注文IDを取得
        const orderIdElement = row.querySelector('.order-number');
        if (!orderIdElement) return null;
        
        const orderIdText = orderIdElement.textContent;
        const orderIdMatch = orderIdText.match(/#(\d+)/);
        if (!orderIdMatch) return null;
        
        const orderId = parseInt(orderIdMatch[1]);
        
        // フィールド名を特定
        const fieldName = getFieldNameFromElement(element);
        if (!fieldName) return null;
        
        // フィールド値を取得
        const fieldValue = getFieldValue(element);
        
        return {
            orderId,
            fieldName,
            fieldValue
        };
        
    } catch (error) {
        console.error('注文情報取得エラー:', error);
        return null;
    }
}

/**
 * 要素からフィールド名を特定
 */
function getFieldNameFromElement(element) {
    // クラス名とフィールド名のマッピング
    const fieldMapping = {
        'text-input': '納品日',
        'category-dropdown': 'カテゴリ',
        'customer-name-input': '顧客名',
        'company-name-input': '会社名',
        'person-select': null, // 動的に判定
        'payment-select': '支払い方法',
        'factory-select': null, // 動的に判定
        'shipping-select': '配送会社',
        'remarks-text': '備考',
        'publication-permission-select': '制作事例掲載許可'
    };
    
    // 日付入力フィールドの場合
    if (element.classList.contains('date-input')) {
        return getDateFieldName(element);
    }
    
    // セレクトボックスの場合
    if (element.tagName === 'SELECT') {
        return getSelectFieldName(element);
    }
    
    // その他のフィールド
    for (const [className, fieldName] of Object.entries(fieldMapping)) {
        if (element.classList.contains(className)) {
            return fieldName;
        }
    }
    
    return null;
}

/**
 * 日付フィールドの名前を特定
 */
function getDateFieldName(element) {
    const cell = element.closest('td');
    if (!cell) return null;
    
    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    
    // セルの位置からフィールド名を判定
    const dateFieldMap = {
        4: 'イメージ送付日',
        6: '支払い完了日',
        7: 'プリント依頼日',
        9: 'プリント納期',
        10: '縫製依頼日',
        12: '縫製納期',
        14: '発送日'
    };
    
    return dateFieldMap[cellIndex] || null;
}

/**
 * セレクトフィールドの名前を特定
 */
function getSelectFieldName(element) {
    const cell = element.closest('td');
    if (!cell) return null;
    
    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    
    // セルの位置からフィールド名を判定
    const selectFieldMap = {
        3: '注文担当',
        5: '支払い方法',
        8: 'プリント工場',
        11: '縫製工場',
        13: '検品担当',
        14: '配送会社' // 発送日と同じセル内
    };
    
    return selectFieldMap[cellIndex] || null;
}

/**
 * フィールドの値を取得
 */
function getFieldValue(element) {
    if (element.tagName === 'SELECT') {
        return element.value;
    } else if (element.tagName === 'TEXTAREA') {
        return element.value;
    } else if (element.tagName === 'INPUT') {
        return element.value;
    }
    return '';
}

/**
 * フィールド更新を保存
 */
async function saveFieldUpdate(orderId, fieldName, fieldValue) {
    try {
        console.log('💾 保存中:', { orderId, fieldName, fieldValue });
        
        // wp_wqorders_editableテーブルに保存するAPIを使用
        const response = await fetch('editable-orders-api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: JSON.stringify({
                action: 'update_field',
                order_id: orderId,
                field_name: fieldName,
                field_value: fieldValue,
                edited_by: 'user'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ 保存完了:', { orderId, fieldName, fieldValue });
            showSaveIndicator(orderId, fieldName, true);
            
            // キャッシュをクリアして最新データを取得
            await clearCacheAndReload();
            
        } else {
            console.error('❌ 保存失敗:', result.message);
            showSaveIndicator(orderId, fieldName, false);
        }
        
    } catch (error) {
        console.error('💥 保存エラー:', error);
        showSaveIndicator(orderId, fieldName, false);
    }
}

/**
 * 保存状態の表示
 */
function showSaveIndicator(orderId, fieldName, success) {
    // 簡単な保存状態表示（コンソールログのみ）
    // 必要に応じてUI上に保存状態を表示する機能を追加可能
    const status = success ? '✅ 保存済み' : '❌ 保存失敗';
    console.log(`${status}: 注文#${orderId} - ${fieldName}`);
}

/**
 * キャッシュをクリアして最新データを再読み込み
 */
async function clearCacheAndReload() {
    try {
        console.log('🗑️ キャッシュクリア中...');
        
        // 各種キャッシュをクリア
        if (window.dataCache && window.dataCache.clear) {
            window.dataCache.clear();
        }
        
        if (window.pageCache && window.pageCache.clear) {
            window.pageCache.clear();
        }
        
        if (window.clearAllCaches) {
            window.clearAllCaches();
        }
        
        // 強制的にデータを再読み込み
        const timestamp = Date.now();
        const response = await fetch(`editable-orders-api.php?action=get_orders&limit=999&page=1&_force=${timestamp}&_nocache=${Math.random()}`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data.orders) {
                console.log('✅ 最新データ取得完了:', result.data.orders.length, '件');
                
                // グローバルデータを更新
                window.ordersData = result.data.orders;
                window.filteredOrders = result.data.orders;
                
                // テーブルを再構築
                if (window.buildOrdersTable) {
                    window.buildOrdersTable();
                }
                if (window.buildSimpleTable) {
                    window.buildSimpleTable();
                }
                
                console.log('🔄 画面更新完了');
            }
        }
        
    } catch (error) {
        console.error('❌ キャッシュクリア・再読み込みエラー:', error);
    }
}

/**
 * データ読み込みを新しいAPIに切り替え（フォールバック機能付き）
 */
function loadOrdersWithUpdates() {
    console.log('🔄 更新データ適用済み注文を読み込み中...');
    
    fetch('order-updates-api-direct.php?action=get_all_updates')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(text => {
            // HTMLエラーページが返された場合をチェック
            if (text.trim().startsWith('<')) {
                console.warn('⚠️ HTMLレスポンスを検出、従来のAPIにフォールバック');
                return fallbackToOriginalAPI();
            }
            
            const result = JSON.parse(text);
            
            if (result.success) {
                console.log('✅ 更新データ適用済み注文読み込み完了:', result.data.length, '件');
                
                // グローバル変数に保存
                window.ordersData = result.data;
                window.originalOrdersData = [...result.data];
                
                // テーブルを再構築
                buildOrdersTable();
                buildSimpleTable();
                
                // 自動保存機能を初期化
                initializeAutoSave();
                
            } else {
                console.error('❌ データ読み込み失敗:', result.message);
                console.log('🔄 従来のAPIにフォールバック');
                return fallbackToOriginalAPI();
            }
        })
        .catch(error => {
            console.error('💥 新APIエラー:', error.message);
            console.log('🔄 従来のAPIにフォールバック');
            return fallbackToOriginalAPI();
        });
}

/**
 * 従来のAPIにフォールバック
 */
function fallbackToOriginalAPI() {
    console.log('📡 従来のデータベースAPIを使用...');
    
    // main.jsのloadDataFromDatabase関数を使用
    if (window.loadDataFromDatabase) {
        return window.loadDataFromDatabase()
            .then(data => {
                if (data && data.length > 0) {
                    console.log('✅ 従来API読み込み完了:', data.length, '件');
                    window.ordersData = data;
                    window.originalOrdersData = [...data];
                    
                    buildOrdersTable();
                    buildSimpleTable();
                    
                    // 自動保存は無効（更新データテーブルが無いため）
                    console.log('⚠️ 自動保存機能は無効（更新データテーブル未作成）');
                } else {
                    throw new Error('従来APIからもデータを取得できませんでした');
                }
            });
    } else {
        console.error('❌ データ読み込み機能が利用できません。ページを再読み込みしてください。');
    }
}

// 初期化時に新しいデータ読み込み方式を使用
if (typeof window !== 'undefined') {
    // 既存のloadOrdersData関数を置き換え
    window.loadOrdersWithUpdates = loadOrdersWithUpdates;
    
    console.log('📦 注文データ自動保存管理モジュール読み込み完了');
} 