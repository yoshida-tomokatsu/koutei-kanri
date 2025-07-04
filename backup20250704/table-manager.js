// ========================================
// TABLE-MANAGER.JS - テーブル表示・切り替え・フィルタリング
// ========================================

console.log('📊 TABLE-MANAGER.JS 読み込み開始');

// デバッグフラグを削除（軽量化）

// ========================================
// グローバル変数
// ========================================

let currentTab = 'all';
let currentViewMode = 'detailed'; // 'detailed' or 'simple'

// グローバルに公開
window.currentTab = currentTab;
window.currentViewMode = currentViewMode;

// ========================================
// 表示モード切り替え機能
// ========================================

/**
 * 表示モードを切り替える
 */
function switchViewMode(mode) {
    console.log('🔄 表示モード切り替え:', mode);
    
    currentViewMode = mode;
    window.currentViewMode = mode;
    
    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-mode') === mode) {
            btn.classList.add('active');
        }
    });
    
    // 表示を切り替え
    const detailedView = document.getElementById('detailedView');
    const simpleView = document.getElementById('simpleView');
    
    if (mode === 'detailed') {
        // 詳細表示
        if (detailedView) {
            detailedView.style.display = 'block';
            detailedView.classList.remove('hidden');
        }
        if (simpleView) {
            simpleView.style.display = 'none';
            simpleView.classList.remove('active');
        }
        console.log('✅ 詳細表示に切り替えました');
    } else {
        // 簡易表示
        if (detailedView) {
            detailedView.style.display = 'none';
            detailedView.classList.add('hidden');
        }
        if (simpleView) {
            simpleView.style.display = 'block';
            simpleView.classList.add('active');
        }
        console.log('🔄 簡易表示に切り替え中...');
        
        // 簡易表示用データを構築
        setTimeout(() => {
            buildSimpleTable();
        }, 100);
    }
    
    // 編集モードボタンの表示制御
    if (window.updateEditModeVisibility) {
        window.updateEditModeVisibility();
    }
}

// ========================================
// 詳細表示テーブル構築
// ========================================

/**
 * 詳細表示テーブルを構築
 */
function buildOrdersTable() {
    console.log('🏗️ 詳細テーブル構築開始');
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) {
        console.error('❌ テーブルボディが見つかりません');
        return;
    }
    
    // データの確認
    const data = window.ordersData || ordersData || [];
    console.log('📊 詳細表示用データ:', {
        dataLength: data.length,
        dataSource: window.ordersData ? 'window.ordersData' : ordersData ? 'ordersData' : 'なし',
        firstItem: data[0] ? Object.keys(data[0]) : 'なし'
    });
    
    if (data.length === 0) {
        console.warn('⚠️ 詳細表示用データがありません');
        tbody.innerHTML = '<tr><td colspan="16" class="loading">データがありません</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';

    try {
        data.forEach((order, index) => {
            try {
                console.log(`🔄 詳細行作成中 [${index}]:`, order.注文ID || `#${index + 1}`);
                const row = createOrderRow(order, index);
                if (row) {
                    tbody.appendChild(row);
                } else {
                    console.error(`❌ 詳細行作成失敗 [${index}]: rowがnull`);
                }
            } catch (error) {
                console.error(`❌ 詳細行作成エラー [${index}]:`, error);
                
                // エラー行を作成
                const errorRow = document.createElement('tr');
                errorRow.innerHTML = `<td colspan="16" style="color: red; text-align: center;">行 ${index + 1} でエラー: ${error.message}</td>`;
                tbody.appendChild(errorRow);
            }
        });

        console.log('✅ 詳細テーブル構築完了:', data.length, '件');
        
        // イベントを初期化
        initializeRowEvents();
        
    } catch (error) {
        console.error('❌ 詳細テーブル構築で重大エラー:', error);
        tbody.innerHTML = `<tr><td colspan="16" class="loading" style="color: red;">テーブル構築エラー: ${error.message}</td></tr>`;
    }
}

/**
 * 詳細表示の注文行を作成
 */
function createOrderRow(order, index) {
    try {
        console.log(`🔧 createOrderRow開始 [${index}]:`, {
            orderId: order.注文ID,
            customerName: order.顧客名,
            category: order.カテゴリ,
            hasRemarks: order._has_remarks,
            keys: Object.keys(order).slice(0, 10) // 最初の10個のキーのみ表示
        });
        
        const orderId = order.注文ID || `#${index + 1}`;
        
        const row = document.createElement('tr');
        row.className = 'order-row';
        row.setAttribute('data-order-id', sanitizeIdForHtml(orderId));
        
        // 行番号を計算（ページネーション対応）
        const paginationConfig = window.paginationConfig || { currentPage: 1, pageSize: 100 };
        const rowNumber = (paginationConfig.currentPage - 1) * paginationConfig.pageSize + index + 1;
        
        row.innerHTML = `
            <td class="row-number" style="text-align: center; font-weight: bold; font-size: 14px; background-color: #f8f9fa; vertical-align: middle;">
                ${rowNumber}
            </td>
            <td class="order-info">
                <div class="order-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: nowrap;">
                    <span class="order-number" style="font-size: 15px; font-weight: bold; color: #2c3e50; white-space: nowrap; flex-shrink: 0;">注文ID：${orderId}</span>
                    <span style="color: #7f8c8d; flex-shrink: 0;">｜</span>
                    <select class="category-dropdown ${getCategoryClass(normalizeCategory(order.カテゴリ, order))}" style="
                        font-size: 14px; 
                        flex: 1; 
                        min-width: 0; 
                        font-weight: bold; 
                        padding: 4px 8px; 
                        border-radius: 4px;
                        border: none;
                        appearance: none;
                        -webkit-appearance: none;
                        -moz-appearance: none;
                        cursor: default;
                        pointer-events: none;
                    ">
                        <option value="ポリエステル スカーフ" ${normalizeCategory(order.カテゴリ, order) === 'ポリエステル スカーフ' ? 'selected' : ''}>ポリエステル スカーフ</option>
                        <option value="シルク スカーフ" ${normalizeCategory(order.カテゴリ, order) === 'シルク スカーフ' ? 'selected' : ''}>シルク スカーフ</option>
                        <option value="リボン スカーフ" ${normalizeCategory(order.カテゴリ, order) === 'リボン スカーフ' ? 'selected' : ''}>リボン スカーフ</option>
                        <option value="スカーフタイ" ${normalizeCategory(order.カテゴリ, order) === 'スカーフタイ' ? 'selected' : ''}>スカーフタイ</option>
                        <option value="ストール" ${normalizeCategory(order.カテゴリ, order) === 'ストール' ? 'selected' : ''}>ストール</option>
                        <option value="ポケットチーフ" ${normalizeCategory(order.カテゴリ, order) === 'ポケットチーフ' ? 'selected' : ''}>ポケットチーフ</option>
                    </select>
                </div>
                <div class="order-date" style="font-size: 13px; color: #333; margin-bottom: 6px;">注文日時：${order.注文日 || ''} ${order.注文時間 || ''}</div>
                <div class="update-date" style="font-size: 13px; color: #666; margin-bottom: 6px;">更新日時：${order.更新日時 || '未実装'}</div>
                <div class="client-name" style="font-size: 13px; color: #333; margin-bottom: 6px; font-weight: normal;">
                    注文者：<input type="text" class="text-input customer-name-input" value="${order.顧客名 || ''}" style="font-size: 13px; width: calc(100% - 70px); margin-left: 5px; box-sizing: border-box; display: none;" />
                    <span class="edit-read-only" style="display: inline; margin-left: 5px; font-weight: normal; background: none; border: none; padding: 0;">${order.顧客名 || ''}</span>
                </div>
                <div class="company-name" style="font-size: 13px; color: #333; margin-bottom: 6px; font-weight: normal;">
                    会社名：<input type="text" class="text-input company-name-input" value="${order.会社名 || ''}" style="font-size: 13px; width: calc(100% - 70px); margin-left: 5px; box-sizing: border-box; display: none;" />
                    <span class="edit-read-only" style="display: inline; margin-left: 5px; font-weight: normal; background: none; border: none; padding: 0;">${order.会社名 || ''}</span>
                </div>
                <div class="delivery-date" style="font-size: 13px; color: #333; margin-bottom: 6px;">
                    納品日：<input type="text" class="text-input" value="${order.納品日 || ''}" style="font-size: 13px; width: calc(100% - 70px); margin-left: 5px; box-sizing: border-box; color: red; font-weight: bold; display: none;" />
                    <span class="edit-read-only" style="display: inline; margin-left: 5px; color: red; font-weight: bold;">${order.納品日 || ''}</span>
                </div>
                <div class="publication-permission" style="font-size: 13px; color: #333; margin-bottom: 6px; font-weight: normal;">
                    制作事例掲載許可：<select class="publication-permission-select" style="font-size: 13px; margin-left: 5px; display: none;">
                        <option value="しない" ${(order.制作事例掲載許可 === 'しない' || order.制作事例掲載許可 === '掲載を許可しない' || !order.制作事例掲載許可) ? 'selected' : ''}>しない</option>
                        <option value="する" ${(order.制作事例掲載許可 === 'する' || order.制作事例掲載許可 === '掲載を許可する') ? 'selected' : ''}>する</option>
                    </select>
                    <span class="edit-read-only" style="display: inline; margin-left: 5px; font-weight: normal; background: none; border: none; padding: 0;">${(order.制作事例掲載許可 === 'する' || order.制作事例掲載許可 === '掲載を許可する') ? 'する' : 'しない'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                    <div class="status-badge">計算中</div>
                    ${order._has_remarks ? '<span class="remarks-badge" onclick="scrollToRemarks(this)" style="cursor: pointer; background: #e74c3c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;" title="備考列にジャンプ">備考あり</span>' : ''}
                    <button class="edit-btn" onclick="toggleRowEditMode('${sanitizeIdForHtml(orderId)}')" style="
                        background-color: #6c757d !important;
                        color: white !important;
                        border: 1px solid #000 !important;
                        padding: 4px 8px !important;
                        border-radius: 4px !important;
                        font-size: 12px !important;
                        font-weight: bold !important;
                        cursor: pointer !important;
                        display: inline-block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        min-width: 50px !important;
                        text-align: center !important;
                    ">編集</button>
                </div>
            </td>
            <td class="doc-buttons">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button class="doc-btn quote-btn" data-action="pdf" data-type="見積書" data-order="${orderId}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        見積
                    </button>
                    <button class="upload-btn" onclick="showUploadModal('${orderId}', 'quotes')">📎 ファイル選択</button>
                    <div class="file-info quote-info">ファイルなし</div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button class="doc-btn image-btn" data-action="pdf" data-type="商品画像" data-order="${orderId}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        画像
                    </button>
                    <button class="upload-btn" onclick="showUploadModal('${orderId}', 'images')">📎 ファイル選択</button>
                    <div class="file-info image-info">ファイルなし</div>
                </div>
            </td>
            <td class="process-info">
                <select class="person-select">
                    ${createSelectOptions('注文担当', order.注文担当)}
                </select>
            </td>
            <td class="process-info">
                <input type="date" class="date-input" value="${order.イメージ送付日 || ''}" />
            </td>
            <td class="process-info">
                <select class="payment-select">
                    ${createSelectOptions('支払い方法', order.支払い方法)}
                </select>
            </td>
            <td class="process-info">
                <input type="date" class="date-input" value="${order.支払い完了日 || ''}" />
            </td>
            <td class="process-info">
                <input type="date" class="date-input" value="${order.プリント依頼日 || ''}" />
            </td>
            <td class="process-info">
                <select class="factory-select">
                    ${createSelectOptions('プリント工場', order.プリント工場)}
                </select>
            </td>
            <td class="process-info">
                <input type="date" class="date-input" value="${order.プリント納期 || ''}" />
            </td>
            <td class="process-info">
                <input type="date" class="date-input" value="${order.縫製依頼日 || ''}" />
            </td>
            <td class="process-info">
                <select class="factory-select">
                    ${createSelectOptions('縫製工場', order.縫製工場)}
                </select>
            </td>
            <td class="process-info">
                <input type="date" class="date-input" value="${order.縫製納期 || ''}" />
            </td>
            <td class="process-info">
                <select class="person-select">
                    ${createSelectOptions('検品担当', order.検品担当)}
                </select>
            </td>
            <td class="process-info">
                <div style="display: flex; flex-direction: column;">
                    <input type="date" class="date-input" value="${order.発送日 || ''}" />
                    <select class="shipping-select" style="margin-top: 4px;">
                        ${createSelectOptions('配送会社', order.配送会社)}
                    </select>
                </div>
            </td>
            <td class="remarks">
                <div class="remarks-container">
                    <textarea class="remarks-text" style="width: 100%; height: 180px; min-height: 60px; max-height: 600px; resize: vertical; overflow-y: auto;">${order.備考 || ''}</textarea>
                    <button class="auto-expand-btn" title="文字量に合わせて自動拡張">◢</button>
                </div>
            </td>
        `;

        // ステータスとカテゴリ色を直接設定（簡素化）
        setTimeout(() => {
            try {
                // ステータスを計算
                const status = calculateOrderStatus(order);
                
                // ステータス要素を直接更新
                const statusElement = row.querySelector('.status-badge');
                if (statusElement) {
                    statusElement.textContent = status.text;
                    statusElement.className = `status-badge ${status.class}`;
                }
                
                // カテゴリプルダウンの色を初期化
                const categoryDropdown = row.querySelector('.category-dropdown');
                if (categoryDropdown) {
                    // まず初期値を設定
                    const categoryValue = normalizeCategory(order.カテゴリ, order);
                    categoryDropdown.value = categoryValue;
                    
                    // カテゴリ色を適用
                    updateCategoryColor(categoryDropdown);
                    
                    console.log('🎨 カテゴリ色初期化:', {
                        orderId: orderId,
                        category: categoryValue,
                        dropdownValue: categoryDropdown.value,
                        classes: categoryDropdown.className
                    });
                }
            } catch (error) {
                // エラーは静かに処理
                console.error('❌ 初期化エラー:', error);
            }
        }, 100); // 少し長めに遅らせて確実に実行



        console.log(`✅ createOrderRow完了 [${index}]:`, orderId);
        return row;
        
    } catch (error) {
        console.error(`❌ createOrderRow エラー [${index}]:`, error);
        console.error('エラー詳細:', {
            order: order,
            index: index,
            error: error.message,
            stack: error.stack
        });
        throw error; // エラーを再スローして上位で処理
    }
}

// ========================================
// 簡易表示テーブル構築
// ========================================

/**
 * 簡易表示テーブルを構築
 */
function buildSimpleTable() {
    console.log('🏗️ 簡易表示テーブル構築開始');
    
    const tbody = document.getElementById('simple-table-body');
    if (!tbody) {
        console.error('❌ simple-table-body が見つかりません');
        return;
    }
    
    const data = window.ordersData || ordersData || [];
    console.log('📊 使用するデータ:', data.length, '件');
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="21" class="loading">データがありません</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    
    try {
        data.forEach((order, index) => {
            const row = createSimpleOrderRow(order, index);
            if (row) {
                tbody.appendChild(row);
            }
        });
        
        console.log('✅ 簡易表示テーブル構築完了:', data.length, '件');
        
        // フィルタを適用
        if (window.filterOrders) {
            setTimeout(() => {
                window.filterOrders();
            }, 100);
        }
        
    } catch (error) {
        console.error('❌ 簡易表示テーブル構築エラー:', error);
        tbody.innerHTML = '<tr><td colspan="21" class="loading" style="color: red;">テーブル構築エラー: ' + error.message + '</td></tr>';
    }
}

/**
 * 簡易表示の注文行を作成
 */
function createSimpleOrderRow(order, index) {
    try {
        const row = document.createElement('tr');
        row.className = 'simple-row order-row';
        
        const orderId = order.注文ID || `#${index + 1}`;
        
        // ステータスを計算
        const status = calculateOrderStatus(order);
        
        // カテゴリのクラス名を決定（formTitleも考慮）
        const categoryClass = getCategoryClass(order.カテゴリ, order);
        
        // 行番号を計算（ページネーション対応）
        const paginationConfig = window.paginationConfig || { currentPage: 1, pageSize: 100 };
        const rowNumber = (paginationConfig.currentPage - 1) * paginationConfig.pageSize + index + 1;
        
        row.innerHTML = `
            <td style="text-align: center; font-weight: bold; font-size: 14px; background-color: #f8f9fa;">${rowNumber}</td>
            <td><span class="simple-status ${status.class}">${status.text}</span></td>
            <td><span class="simple-category ${categoryClass}">${normalizeCategory(order.カテゴリ, order) || ''}</span></td>
            <td style="display: flex; align-items: center; gap: 8px;">
                <span class="simple-order-id">${orderId}</span>
                ${order._has_remarks ? '<span class="remarks-badge" onclick="scrollToRemarks(this)" style="cursor: pointer;" title="備考列にジャンプ">備考あり</span>' : ''}
            </td>
            <td>注文者：${order.顧客名 || ''}</td>
            <td>会社名：${order.会社名 || ''}</td>
            <td>${order.注文日 || ''} ${order.注文時間 || ''}</td>
            <td>${order.納品日 || ''}</td>
            <td>${order.注文担当 || ''}</td>
            <td>${order.イメージ送付日 || ''}</td>
            <td>${order.支払い方法 || ''}</td>
            <td>${order.支払い完了日 || ''}</td>
            <td>${order.プリント依頼日 || ''}</td>
            <td>${order.プリント工場 || ''}</td>
            <td>${order.プリント納期 || ''}</td>
            <td>${order.縫製依頼日 || ''}</td>
            <td>${order.縫製工場 || ''}</td>
            <td>${order.縫製納期 || ''}</td>
            <td>${order.検品担当 || ''}</td>
            <td>${order.発送日 || ''}</td>
            <td>${order.配送会社 || ''}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${order.備考 || ''}">${order.備考 || ''}</td>
        `;
        
        return row;
        
    } catch (error) {
        console.error(`❌ 行作成エラー [${index}]:`, error);
        
        const errorRow = document.createElement('tr');
        errorRow.className = 'simple-row order-row';
        errorRow.innerHTML = `
            <td colspan="22" style="color: red; text-align: center;">
                行 ${index + 1} の作成でエラーが発生しました: ${error.message}
            </td>
        `;
        return errorRow;
    }
}

// ========================================
// 共通機能
// ========================================

/**
 * 動的選択肢を生成
 */
function createSelectOptions(type, selectedValue = '') {
    let options = '<option value="">選択してください</option>';
    
    const optionsList = dynamicOptions[type] || [];
    optionsList.forEach(option => {
        const selected = selectedValue === option ? 'selected' : '';
        options += `<option value="${option}" ${selected}>${option}</option>`;
    });
    
    options += `<option value="__ADD_NEW__">+ 新規追加</option>`;
    return options;
}

/**
 * 注文のステータスを計算
 */
function calculateOrderStatus(order) {
    const shippingDate = order.発送日;
    const sewingOrderDate = order.縫製依頼日;
    const sewingFactory = order.縫製工場;
    const sewingDeadline = order.縫製納期;
    const printOrderDate = order.プリント依頼日;
    const printFactory = order.プリント工場;
    const printDeadline = order.プリント納期;
    const paymentMethod = order.支払い方法;
    const paymentCompleted = order.支払い完了日;
    const imageSent = order.イメージ送付日;
    
    if (shippingDate) {
        return { text: '完了', class: 'status-completed' };
    } else if (sewingOrderDate && sewingFactory && sewingDeadline) {
        return { text: '検品・発送待ち', class: 'status-active' };
    } else if (printOrderDate && printFactory && printDeadline) {
        return { text: '縫製待ち', class: 'status-active' };
    } else if (paymentMethod && paymentCompleted) {
        return { text: 'プリント待ち', class: 'status-active' };
    } else if (imageSent) {
        return { text: '支払い待ち', class: 'status-pending' };
    } else {
        return { text: '注文対応待ち', class: 'status-pending' };
    }
}

/**
 * カテゴリ名を正規化（お見積もり→適切な商品種別に変換）
 */
function normalizeCategory(category, order = null) {
    // formTitleからカテゴリを判定する場合
    if (order && (order._form_title || order.formTitle)) {
        const formTitle = order._form_title || order.formTitle;
        if (formTitle === 'オリジナルスカーフお見積もり') {
            return 'ポリエステル スカーフ';
        }
    }
    
    // カテゴリ名から判定
    if (category === 'お見積もり' || 
        category === 'お見積り' || 
        category === 'オリジナルスカーフお見積もり') {
        return 'ポリエステル スカーフ';
    }
    
    return category;
}

/**
 * カテゴリのCSSクラス名を取得
 */
function getCategoryClass(category, order = null) {
    // まずカテゴリを正規化（formTitleも考慮）
    const normalizedCategory = normalizeCategory(category, order);
    
    switch (normalizedCategory) {
        case 'ポリエステル スカーフ':
            return 'category-poli';
        case 'シルク スカーフ':
            return 'category-silk';
        case 'リボン スカーフ':
            return 'category-ribbon';
        case 'スカーフタイ':
            return 'category-tie';
        case 'ストール':
            return 'category-stole';
        case 'ポケットチーフ':
            return 'category-chief';
        default:
            return '';
    }
}

/**
 * 注文IDをHTML要素のIDとして安全に使用できる形式に変換
 */
function sanitizeIdForHtml(orderId) {
    try {
        // 注文IDのみを抽出（スペースや特殊文字の前まで）
        if (typeof orderId !== 'string') {
            orderId = String(orderId || '');
        }
        
        // 「備考あり」などの追加テキストを除去し、基本の注文IDのみを抽出
        let baseOrderId = orderId.split(' ')[0].trim();
        
        // 空文字列の場合はデフォルト値を設定
        if (!baseOrderId) {
            baseOrderId = 'unknown';
        }
        
        // #記号を確実に削除（複数の#も対応）
        let safeId = baseOrderId.replace(/^#+/, '').replace(/[^a-zA-Z0-9\-_]/g, '_');
        
        // 連続するアンダースコアを単一に
        safeId = safeId.replace(/_{2,}/g, '_');
        
        // 先頭末尾のアンダースコアを削除
        safeId = safeId.replace(/^_+|_+$/g, '');
        
        // 空文字列の場合はデフォルト値を設定
        if (!safeId) {
            safeId = 'unknown_id';
        }
        
        // 先頭が数字の場合は'id_'を追加（CSSセレクタの仕様に準拠）
        if (safeId.match(/^[0-9]/)) {
            safeId = 'id_' + safeId;
        }
        
        // 先頭が英字でない場合は'id_'を追加
        if (!safeId.match(/^[a-zA-Z]/)) {
            safeId = 'id_' + safeId;
        }
        
        // 長さを制限
        safeId = safeId.substring(0, 50);
        
        // 最終チェック：有効なIDパターンか確認
        if (!safeId.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
            console.warn('⚠️ 生成されたIDが無効、フォールバック使用:', safeId, 'from:', orderId);
            return 'fallback_id_' + Math.random().toString(36).substring(2, 8);
        }
        
        return safeId;
        
    } catch (error) {
        console.error('❌ ID生成エラー:', error, 'orderId:', orderId);
        return 'error_id_' + Math.random().toString(36).substring(2, 8);
    }
}

// ファイル表示更新のデバウンス管理
const fileDisplayUpdateQueue = new Map();
const fileDisplayDebounceTime = 100; // 100ms

/**
 * ファイル表示を更新（デバウンス機能付き）
 */
function updateFileDisplay(orderId, fileType) {
    const updateKey = `${orderId}_${fileType}`;
    
    // 既存のタイマーをクリア
    if (fileDisplayUpdateQueue.has(updateKey)) {
        clearTimeout(fileDisplayUpdateQueue.get(updateKey));
    }
    
    // デバウンスタイマーを設定
    const timerId = setTimeout(() => {
        performFileDisplayUpdate(orderId, fileType);
        fileDisplayUpdateQueue.delete(updateKey);
    }, fileDisplayDebounceTime);
    
    fileDisplayUpdateQueue.set(updateKey, timerId);
}

/**
 * 実際のファイル表示更新処理
 */
function performFileDisplayUpdate(orderId, fileType) {
    if (!orderId || !fileType) {
        return false;
    }
    
    // 基本の注文IDを取得（備考などの追加テキストを除去）
    const baseOrderId = orderId.split(' ')[0].trim();
    const safeOrderId = sanitizeIdForHtml(baseOrderId);
    const btnId = fileType === 'quotes' ? `quote-btn-${safeOrderId}` : `image-btn-${safeOrderId}`;
    const infoId = fileType === 'quotes' ? `quote-info-${safeOrderId}` : `image-info-${safeOrderId}`;
    
    const btn = document.getElementById(btnId);
    const info = document.getElementById(infoId);
    
    if (!btn || !info) {
        return false;
    }
    
    // サーバーファイル情報を確認（基本の注文IDを使用）
    const serverFiles = window.serverFiles || {};
    const files = serverFiles[baseOrderId]?.[fileType] || [];
    
    // 表示テキストを決定
    let newText = '';
    if (files.length === 0) {
        newText = 'ファイルなし';
    } else if (files.length === 1) {
        newText = '1件のファイル';
    } else {
        newText = `${files.length}件のファイル<span class="multiple-indicator">複数</span>`;
    }
    
    // ボタンクラスを更新（ファイルがある場合は緑色にする）
    if (files.length > 0) {
        btn.classList.add('has-file');
        btn.classList.remove('active');
        btn.style.backgroundColor = '#28a745';
        btn.style.borderColor = '#1e7e34';
        btn.style.color = 'white';
    } else {
        btn.classList.remove('has-file');
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
        btn.style.color = '';
    }
    
    // HTMLを更新
    info.innerHTML = newText;
    
    return true;
}

// ========================================
// フィルタリング機能
// ========================================

/**
 * 注文をフィルタリング
 */
function filterOrders() {
    console.log('🔍 注文フィルタリング実行');
    
    if (currentViewMode === 'simple') {
        filterSimpleOrders();
        return;
    }
    
    // 詳細表示の場合
    const rows = document.querySelectorAll('.order-row');
    let visibleCount = 0;
    
    rows.forEach(row => {
        let shouldShow = true;
        
        // カテゴリフィルタ
        if (currentFilters.category) {
            const categorySelect = row.querySelector('.category-dropdown');
            if (!categorySelect || categorySelect.value !== currentFilters.category) {
                shouldShow = false;
            }
        }
        
        // 注文担当フィルタ
        if (currentFilters.orderPerson) {
            const orderPersonSelect = row.children[2]?.querySelector('.person-select');
            if (!orderPersonSelect || orderPersonSelect.value !== currentFilters.orderPerson) {
                shouldShow = false;
            }
        }
        
        // 支払い方法フィルタ
        if (currentFilters.payment) {
            const paymentSelect = row.children[4]?.querySelector('.payment-select');
            if (!paymentSelect || paymentSelect.value !== currentFilters.payment) {
                shouldShow = false;
            }
        }
        
        // プリント工場フィルタ
        if (currentFilters.printFactory) {
            const printFactorySelect = row.children[7]?.querySelector('.factory-select');
            if (!printFactorySelect || printFactorySelect.value !== currentFilters.printFactory) {
                shouldShow = false;
            }
        }
        
        // 縫製工場フィルタ
        if (currentFilters.sewingFactory) {
            const sewingFactorySelect = row.children[10]?.querySelector('.factory-select');
            if (!sewingFactorySelect || sewingFactorySelect.value !== currentFilters.sewingFactory) {
                shouldShow = false;
            }
        }
        
        // 検品担当フィルタ
        if (currentFilters.inspectionPerson) {
            const inspectionPersonSelect = row.children[12]?.querySelector('.person-select');
            if (!inspectionPersonSelect || inspectionPersonSelect.value !== currentFilters.inspectionPerson) {
                shouldShow = false;
            }
        }
        
        // 配送会社フィルタ
        if (currentFilters.shipping) {
            const shippingSelect = row.children[13]?.querySelector('.shipping-select');
            if (!shippingSelect || shippingSelect.value !== currentFilters.shipping) {
                shouldShow = false;
            }
        }
        
        // 現在のタブフィルタも考慮
        if (shouldShow && currentTab !== 'all') {
            // 詳細表示の場合は .status-badge を使用
            if (!row.classList.contains('simple-row')) {
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge && statusBadge.textContent) {
                const statusText = statusBadge.textContent;
                if (currentTab === 'in-progress' && statusText === '完了') {
                    shouldShow = false;
                } else if (currentTab === 'completed' && statusText !== '完了') {
                    shouldShow = false;
                    }
                }
            } else {
                // 簡易表示の場合は .simple-status を使用
                const simpleStatus = row.querySelector('.simple-status');
                if (simpleStatus && simpleStatus.textContent) {
                    const statusText = simpleStatus.textContent;
                    if (currentTab === 'in-progress' && statusText === '完了') {
                        shouldShow = false;
                    } else if (currentTab === 'completed' && statusText !== '完了') {
                        shouldShow = false;
                    }
                }
            }
        }
        
        // 表示/非表示を設定
        if (shouldShow) {
            row.classList.remove('hidden');
            visibleCount++;
        } else {
            row.classList.add('hidden');
        }
    });
    
    console.log(`フィルタリング結果: ${visibleCount}件表示`);
}

/**
 * 簡易表示でのフィルタリング
 */
function filterSimpleOrders() {
    console.log('🔍 簡易表示フィルタリング実行');
    
    const filters = window.currentFilters || {};
    const currentTabValue = window.currentTab || 'all';
    
    const rows = document.querySelectorAll('.simple-row');
    let visibleCount = 0;
    
    rows.forEach(row => {
        let shouldShow = true;
        const cells = row.querySelectorAll('td');
        
        // カテゴリフィルタ（商品種別は列1）
        if (filters.category) {
            const categoryCell = cells[1];
            if (!categoryCell || !categoryCell.textContent || !categoryCell.textContent.includes(filters.category)) {
                shouldShow = false;
            }
        }
        
        // 注文担当フィルタ（注文担当は列7）
        if (filters.orderPerson) {
            const orderPersonCell = cells[7];
            if (!orderPersonCell || !orderPersonCell.textContent || orderPersonCell.textContent.trim() !== filters.orderPerson) {
                shouldShow = false;
            }
        }
        
        // 支払い方法フィルタ（支払い方法は列9）
        if (filters.payment) {
            const paymentCell = cells[9];
            if (!paymentCell || !paymentCell.textContent || paymentCell.textContent.trim() !== filters.payment) {
                shouldShow = false;
            }
        }
        
        // プリント工場フィルタ（プリント工場は列12）
        if (filters.printFactory) {
            const printFactoryCell = cells[12];
            if (!printFactoryCell || !printFactoryCell.textContent || printFactoryCell.textContent.trim() !== filters.printFactory) {
                shouldShow = false;
            }
        }
        
        // 縫製工場フィルタ（縫製工場は列15）
        if (filters.sewingFactory) {
            const sewingFactoryCell = cells[15];
            if (!sewingFactoryCell || !sewingFactoryCell.textContent || sewingFactoryCell.textContent.trim() !== filters.sewingFactory) {
                shouldShow = false;
            }
        }
        
        // 検品担当フィルタ（検品担当は列17）
        if (filters.inspectionPerson) {
            const inspectionPersonCell = cells[17];
            if (!inspectionPersonCell || !inspectionPersonCell.textContent || inspectionPersonCell.textContent.trim() !== filters.inspectionPerson) {
                shouldShow = false;
            }
        }
        
        // 配送会社フィルタ（配送会社は列19）
        if (filters.shipping) {
            const shippingCell = cells[19];
            if (!shippingCell || !shippingCell.textContent || shippingCell.textContent.trim() !== filters.shipping) {
                shouldShow = false;
            }
        }
        
        // 現在のタブフィルタも考慮（ステータスは列0）
        if (shouldShow && currentTabValue !== 'all') {
            const statusCell = cells[0];
            if (statusCell && statusCell.textContent) {
                const statusText = statusCell.textContent.trim();
                if (currentTabValue === 'in-progress' && statusText === '完了') {
                    shouldShow = false;
                } else if (currentTabValue === 'completed' && statusText !== '完了') {
                    shouldShow = false;
                }
            }
        }
        
        // 表示/非表示を設定
        if (shouldShow) {
            row.classList.remove('hidden');
            visibleCount++;
        } else {
            row.classList.add('hidden');
        }
    });
    
    console.log(`簡易表示フィルタリング結果: ${visibleCount}件表示`);
}

/**
 * 小さなタブの切り替え機能
 */
function switchTabCompact(tab) {
    console.log('🔖 タブ切り替え（コンパクト）:', tab);
    
    currentTab = tab;
    window.currentTab = tab;
    
    // タブボタンのアクティブ状態を更新
    document.querySelectorAll('.tab-button-compact').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tab) {
            btn.classList.add('active');
        }
    });
    
    // フィルタを再実行
    filterOrders();
}

// ========================================
// イベント管理
// ========================================

/**
 * 表示モード切り替えイベントを初期化
 */
function initializeViewModeEvents() {
    document.querySelectorAll('.view-mode-btn').forEach(button => {
        button.addEventListener('click', function() {
            const mode = this.getAttribute('data-mode');
            switchViewMode(mode);
        });
    });
    
    console.log('✅ 表示モード切り替えイベント初期化完了');
}

/**
 * タブイベントを初期化
 */
function initializeTabEvents() {
    document.querySelectorAll('.tab-button-compact').forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTabCompact(tab);
        });
    });
    
    console.log('✅ タブイベント初期化完了');
}

/**
 * 行のイベント初期化
 */
function initializeRowEvents() {
    // 詳細表示のみの機能のため、詳細表示時のみ実行
    if (currentViewMode !== 'detailed') return;
    
    // 日付変更時のイベントリスナー
    document.querySelectorAll('.date-input').forEach(input => {
        input.addEventListener('change', function() {
            const row = this.closest('.order-row');
            updateOrderStatus(row);
        });
    });
    
    // 選択項目変更時のイベントリスナー
    document.querySelectorAll('.person-select, .payment-select, .factory-select, .shipping-select').forEach(select => {
        select.addEventListener('change', function() {
            if (this.value === '__ADD_NEW__') {
                let type;
                if (this.classList.contains('person-select')) {
                    const cellIndex = Array.from(this.closest('tr').children).indexOf(this.closest('td'));
                    type = cellIndex === 2 ? '注文担当' : '検品担当';
                } else if (this.classList.contains('payment-select')) {
                    type = '支払い方法';
                } else if (this.classList.contains('factory-select')) {
                    const cellIndex = Array.from(this.closest('tr').children).indexOf(this.closest('td'));
                    type = cellIndex === 7 ? 'プリント工場' : '縫製工場';
                } else if (this.classList.contains('shipping-select')) {
                    type = '配送会社';
                }
                
                if (type) {
                    addNewOption(type, this);
                }
                return;
            }
            
            const row = this.closest('.order-row');
            updateOrderStatus(row);
            
            if (this.classList.contains('person-select')) {
                const cellIndex = Array.from(this.closest('tr').children).indexOf(this.closest('td'));
                if (cellIndex === 2) {
                    updateDateFieldState(row);
                }
            }
        });
    });
    
    // カテゴリプルダウンの変更イベント
    document.querySelectorAll('.category-dropdown').forEach(select => {
        select.addEventListener('change', function() {
            const row = this.closest('.order-row');
            updateOrderStatus(row);
            updateCategoryColor(this);
        });
        
        // 初期化時の色設定（確実に適用）
        setTimeout(() => {
            updateCategoryColor(select);
            console.log('🎨 イベント初期化時のカテゴリ色設定:', {
                element: select,
                value: select.value,
                classes: select.className
            });
        }, 50);
    });
    
    // PDFボタンのイベントリスナー
    document.querySelectorAll('.doc-btn[data-action="pdf"]').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const type = this.getAttribute('data-type');
            const orderId = this.getAttribute('data-order');
            if (window.showPDF) {
                window.showPDF(type, orderId);
            }
        });
    });
    
    // 備考欄の設定（文字溢れ検知機能付き）
    document.querySelectorAll('.remarks-text').forEach(textarea => {
        // 基本設定
        textarea.style.height = '180px';
        textarea.style.minHeight = '60px';
        textarea.style.maxHeight = '600px';
        textarea.style.resize = 'vertical';
        textarea.style.overflowY = 'auto';
        
        // 文字溢れ検知機能
        const checkOverflow = () => {
            const isOverflowing = textarea.scrollHeight > textarea.clientHeight;
            const remarksCell = textarea.closest('.remarks');
            const autoExpandBtn = textarea.parentNode.querySelector('.auto-expand-btn');
            
            if (isOverflowing) {
                remarksCell.classList.add('has-overflow');
                textarea.title = '文字が溢れています。📏ボタンで自動拡張するか、手動でリサイズしてください。';
                if (autoExpandBtn) {
                    autoExpandBtn.style.display = 'block';
                    autoExpandBtn.classList.add('pulsing');
                }
            } else {
                remarksCell.classList.remove('has-overflow');
                textarea.title = '';
                if (autoExpandBtn) {
                    autoExpandBtn.classList.remove('pulsing');
                    // 文字がない場合はボタンを薄く表示
                    if (!textarea.value.trim()) {
                        autoExpandBtn.style.opacity = '0.3';
                    } else {
                        autoExpandBtn.style.opacity = '0.7';
                    }
                }
            }
        };
        
        // 元のサイズを記録
        let defaultHeight = 180;
        let isExpanded = false;
        
        // 自動拡張/復元機能（トグル）
        const toggleExpand = () => {
            if (!isExpanded) {
                // 拡張モード：文字量に合わせて拡張
                const originalHeight = textarea.style.height;
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                textarea.style.height = originalHeight;
                
                // 最小180px、最大600pxの範囲で設定
                const targetHeight = Math.max(180, Math.min(600, scrollHeight + 10));
                
                // スムーズなアニメーション
                textarea.style.transition = 'height 0.3s ease';
                textarea.style.height = targetHeight + 'px';
                
                isExpanded = true;
                
                // ボタンの表示を変更
                const autoExpandBtn = textarea.parentNode.querySelector('.auto-expand-btn');
                if (autoExpandBtn) {
                    autoExpandBtn.textContent = '◣';
                    autoExpandBtn.title = 'デフォルトサイズに戻す';
                    autoExpandBtn.style.background = 'linear-gradient(135deg, #27ae60 0%, #1e8449 100%)';
                }
                
            } else {
                // 復元モード：デフォルトサイズに戻す
                textarea.style.transition = 'height 0.3s ease';
                textarea.style.height = defaultHeight + 'px';
                
                isExpanded = false;
                
                // ボタンの表示を変更
                const autoExpandBtn = textarea.parentNode.querySelector('.auto-expand-btn');
                if (autoExpandBtn) {
                    autoExpandBtn.textContent = '◢';
                    autoExpandBtn.title = '文字量に合わせて自動拡張';
                    autoExpandBtn.style.background = 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)';
                }
            }
            
            // アニメーション後にtransitionを削除
            setTimeout(() => {
                textarea.style.transition = '';
                checkOverflow();
            }, 300);
        };
        
        // 初期チェック
        setTimeout(checkOverflow, 100);
        
        // 内容変更時とリサイズ時にチェック
        textarea.addEventListener('input', checkOverflow);
        textarea.addEventListener('scroll', checkOverflow);
        
        // ResizeObserverでリサイズを監視
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(checkOverflow);
            resizeObserver.observe(textarea);
        }
        
        // 自動拡張ボタンのイベント
        const autoExpandBtn = textarea.parentNode.querySelector('.auto-expand-btn');
        if (autoExpandBtn) {
            autoExpandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleExpand();
                
                // ボタンのフィードバック
                autoExpandBtn.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    autoExpandBtn.style.transform = '';
                }, 150);
            });
        }
    });
    
    // 初期化時に全ての行の状態を設定
    document.querySelectorAll('.order-row').forEach(row => {
        updateDateFieldState(row);
        updateOrderStatus(row);
        
        // ファイル表示更新は一時的に無効化（パフォーマンス改善）
        // const orderIdElement = row.querySelector('.order-number');
        // if (orderIdElement) {
        //     const orderId = orderIdElement.textContent.replace('注文ID：', '').trim();
        //     console.log('🔄 ファイル表示初期化:', orderId);
        //     
        //     // ファイル表示を1回だけ更新（パフォーマンス改善）
        //     setTimeout(() => {
        //         updateFileDisplay(orderId, 'quotes');
        //         updateFileDisplay(orderId, 'images');
        //     }, 100);
        // }
    });
}

// ========================================
// ステータス管理（詳細表示用）
// ========================================

/**
 * ステータス自動更新機能
 */
function updateOrderStatus(row) {
    // 簡易表示テーブルの場合はスキップ（編集不可のため）
    if (row.classList.contains('simple-row')) {
        return;
    }
    
    const statusBadge = row.querySelector('.status-badge');
    const dateInputs = row.querySelectorAll('.date-input');
    const selects = row.querySelectorAll('select');
    
    // statusBadge要素が存在しない場合はエラーを回避
    if (!statusBadge) {
        console.warn('⚠️ ステータスバッジ要素が見つかりません:', row);
        return;
    }
    
    // 各工程の情報を取得
    const imageSent = dateInputs[1] ? dateInputs[1].value.trim() : '';
    const paymentCompleted = dateInputs[2] ? dateInputs[2].value.trim() : '';
    const printOrderDate = dateInputs[3] ? dateInputs[3].value.trim() : '';
    const printDeadline = dateInputs[4] ? dateInputs[4].value.trim() : '';
    const sewingOrderDate = dateInputs[5] ? dateInputs[5].value.trim() : '';
    const sewingDeadline = dateInputs[6] ? dateInputs[6].value.trim() : '';
    const shippingDate = dateInputs[7] ? dateInputs[7].value.trim() : '';
    
    const paymentMethod = selects[2] ? selects[2].value.trim() : '';
    const printFactory = selects[3] ? selects[3].value.trim() : '';
    const sewingFactory = selects[5] ? selects[5].value.trim() : '';
    
    let newStatus = '';
    let statusClass = '';
    
    if (shippingDate) {
        newStatus = '完了';
        statusClass = 'status-completed';
    } else if (sewingOrderDate && sewingFactory && sewingDeadline) {
        newStatus = '検品・発送待ち';
        statusClass = 'status-active';
    } else if (printOrderDate && printFactory && printDeadline) {
        newStatus = '縫製待ち';
        statusClass = 'status-active';
    } else if (paymentMethod && paymentCompleted) {
        newStatus = 'プリント待ち';
        statusClass = 'status-active';
    } else if (imageSent) {
        newStatus = '支払い待ち';
        statusClass = 'status-pending';
    } else {
        newStatus = '注文対応待ち';
        statusClass = 'status-pending';
    }
    
    statusBadge.textContent = newStatus;
    statusBadge.className = `status-badge ${statusClass}`;
    
    // フィルタと連携
    const hasActiveFilters = Object.values(window.currentFilters || {}).some(filter => filter !== '');
    if (hasActiveFilters || currentTab !== 'all') {
        setTimeout(() => filterOrders(), 100);
    }
}

/**
 * 注文担当による日付フィールドの制御
 */
function updateDateFieldState(row) {
    const personSelect = row.querySelector('.person-select');
    const imageDateCell = row.children[3];
    const imageDateInput = imageDateCell ? imageDateCell.querySelector('.date-input') : null;
    
    if (personSelect && imageDateInput) {
        if (personSelect.value === '' || personSelect.value === '選択してください') {
            imageDateInput.disabled = true;
            imageDateInput.value = '';
            imageDateInput.style.backgroundColor = '#f5f5f5';
            imageDateInput.style.color = '#999';
        } else {
            imageDateInput.disabled = false;
            imageDateInput.style.backgroundColor = '';
            imageDateInput.style.color = '';
        }
        updateOrderStatus(row);
    }
}

/**
 * カテゴリプルダウンの背景色切り替え
 */
function updateCategoryColor(select) {
    // 古いカテゴリクラスを削除
    select.classList.remove('category-poli', 'category-silk', 'category-ribbon', 'category-tie', 'category-stole', 'category-chief');
    
    // インラインスタイルは削除せず、CSSクラスで制御（重要：読み取り専用モードのスタイルを保持）
    
    const categoryValue = select.value;
    let categoryClass = '';
    
    switch (categoryValue) {
        case 'ポリエステル スカーフ':
            categoryClass = 'category-poli';
            break;
        case 'シルク スカーフ':
            categoryClass = 'category-silk';
            break;
        case 'リボン スカーフ':
            categoryClass = 'category-ribbon';
            break;
        case 'スカーフタイ':
            categoryClass = 'category-tie';
            break;
        case 'ストール':
            categoryClass = 'category-stole';
            break;
        case 'ポケットチーフ':
            categoryClass = 'category-chief';
            break;
    }
    
    // カテゴリクラスを追加
    if (categoryClass) {
        select.classList.add(categoryClass);
        console.log('🎨 カテゴリ色設定:', {
            orderId: select.closest('.order-row')?.querySelector('.order-number')?.textContent || 'unknown',
            category: categoryValue,
            class: categoryClass,
            element: select
        });
    }
}

/**
 * 新しい選択肢を追加
 */
function addNewOption(type, selectElement) {
    const newOption = prompt(`新しい${type}を入力してください：`);
    
    if (newOption && newOption.trim() && !dynamicOptions[type].includes(newOption.trim())) {
        dynamicOptions[type].push(newOption.trim());
        updateAllSelectsOfType(type);
        selectElement.value = newOption.trim();
        
        const row = selectElement.closest('.order-row');
        updateOrderStatus(row);
        
        if (selectElement.classList.contains('person-select')) {
            updateDateFieldState(row);
        }
    } else if (dynamicOptions[type].includes(newOption?.trim())) {
        console.warn('その選択肢は既に存在します:', newOption);
        // alert('その選択肢は既に存在します。');
        selectElement.value = '';
    } else {
        selectElement.value = '';
    }
}

/**
 * 特定タイプの全セレクトボックスを更新
 */
function updateAllSelectsOfType(type) {
    let selector;
    if (type === '注文担当') {
        selector = '.order-row td:nth-child(3) .person-select';
    } else if (type === 'プリント工場') {
        selector = '.order-row td:nth-child(8) .factory-select';
    } else if (type === '縫製工場') {
        selector = '.order-row td:nth-child(11) .factory-select';  
    } else if (type === '検品担当') {
        selector = '.order-row td:nth-child(13) .person-select';
    } else {
        const classMap = {
            '支払い方法': '.payment-select',
            '配送会社': '.shipping-select'
        };
        selector = classMap[type];
    }
    
    if (selector) {
        document.querySelectorAll(selector).forEach(select => {
            const currentValue = select.value;
            const newOptions = createSelectOptions(type, currentValue);
            select.innerHTML = newOptions;
        });
    }
}

/**
 * 備考ありアイコンをクリックした時に備考列へスクロール
 */
function scrollToRemarks(element) {
    try {
        // ページ全体のスクロールを防止
        event.preventDefault();
        event.stopPropagation();
        
        console.log('📋 備考列への水平スクロール開始');
        
        // クリックされた行を特定
        const row = element.closest('tr');
        if (!row) {
            console.warn('⚠️ 行を特定できません');
            return;
        }
        
        // 現在の表示モードに応じて備考列を特定
        let remarksCell = null;
        
        if (window.currentViewMode === 'detailed') {
            // 詳細表示の場合：最後の列が備考列
            const cells = row.querySelectorAll('td');
            remarksCell = cells[cells.length - 1]; // 最後の列
        } else {
            // 簡易表示の場合：22列目が備考列
            const cells = row.querySelectorAll('td');
            remarksCell = cells[21]; // 0から数えて21番目（22列目）
        }
        
        if (remarksCell) {
            // テーブルコンテナを特定
            let tableContainer;
            
            if (window.currentViewMode === 'detailed') {
                tableContainer = document.querySelector('.process-table');
            } else {
                tableContainer = document.querySelector('.simple-table-container');
            }
            
            // フォールバック：両方試す
            if (!tableContainer) {
                tableContainer = document.querySelector('.process-table') || document.querySelector('.simple-table-container');
            }
            
            console.log('📊 検出されたコンテナ:', {
                'viewMode': window.currentViewMode,
                'container': tableContainer?.className,
                'scrollable': tableContainer?.style.overflowX
            });
            
            if (tableContainer) {
                // 現在のスクロール位置を保存
                const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                // 備考列が見えているかチェック
                const cellRect = remarksCell.getBoundingClientRect();
                const containerRect = tableContainer.getBoundingClientRect();
                
                const cellLeftEdge = cellRect.left;
                const cellRightEdge = cellRect.right;
                const containerLeftEdge = containerRect.left;
                const containerRightEdge = containerRect.right;
                
                console.log('📊 スクロール計算:', {
                    '備考列左端': cellLeftEdge,
                    '備考列右端': cellRightEdge,
                    'コンテナ左端': containerLeftEdge,
                    'コンテナ右端': containerRightEdge,
                    '現在のスクロール位置': tableContainer.scrollLeft
                });
                
                let targetScrollLeft = tableContainer.scrollLeft;
                let needsScroll = false;
                
                // 備考列が左側に隠れている場合（最も一般的なケース）
                if (cellLeftEdge < containerLeftEdge) {
                    // 備考列の左端が見えるまでスクロール
                    const scrollNeeded = containerLeftEdge - cellLeftEdge + 20; // 20px余裕
                    targetScrollLeft = tableContainer.scrollLeft - scrollNeeded;
                    needsScroll = true;
                    console.log('📊 左側に隠れている - スクロール必要:', { scrollNeeded, targetScrollLeft });
                }
                // 備考列が右側にはみ出している場合
                else if (cellRightEdge > containerRightEdge) {
                    // 備考列の右端が見えるまでスクロール
                    const scrollNeeded = cellRightEdge - containerRightEdge + 20; // 20px余裕
                    targetScrollLeft = tableContainer.scrollLeft + scrollNeeded;
                    needsScroll = true;
                    console.log('📊 右側にはみ出している - スクロール必要:', { scrollNeeded, targetScrollLeft });
                }
                // 既に備考列が見えている場合はスクロールしない
                else {
                    console.log('📊 備考列は既に見えています - スクロール不要');
                }
                
                // スクロールが不要な場合は早期リターン
                if (!needsScroll) {
                    console.log('✅ スクロール不要のため処理終了');
                    return;
                }
                
                // 水平方向のみスクロール
                tableContainer.scrollTo({
                    left: Math.max(0, targetScrollLeft),
                    top: tableContainer.scrollTop, // 垂直位置は現在のまま
                    behavior: 'smooth'
                });
                
                // ページ全体のスクロール位置を元に戻す
                setTimeout(() => {
                    window.scrollTo(0, currentScrollTop);
                }, 10);
            }
            
            // 備考列を一時的にハイライト
            remarksCell.style.backgroundColor = '#ffffcc';
            remarksCell.style.border = '2px solid #ffc107';
            
            setTimeout(() => {
                remarksCell.style.backgroundColor = '';
                remarksCell.style.border = '';
            }, 2000);
            
            console.log('✅ 備考列への水平スクロール完了');
        } else {
            console.warn('⚠️ 備考列を見つけられません');
        }
        
    } catch (error) {
        console.error('❌ 備考列スクロールエラー:', error);
    }
}

// ========================================
// グローバル公開
// ========================================

// 表示モード
window.switchViewMode = switchViewMode;
window.buildSimpleTable = buildSimpleTable;

// テーブル構築
window.buildOrdersTable = buildOrdersTable;
window.updateFileDisplay = updateFileDisplay;

// フィルタリング
window.filterOrders = filterOrders;
window.filterSimpleOrders = filterSimpleOrders;

// タブ
window.switchTabCompact = switchTabCompact;

// イベント初期化
window.initializeViewModeEvents = initializeViewModeEvents;
window.initializeTabEvents = initializeTabEvents;
window.initializeRowEvents = initializeRowEvents;

// スクロール関数をグローバルに公開
window.scrollToRemarks = scrollToRemarks;

// ========================================
// 個別行編集モード機能
// ========================================

/**
 * 個別の行の編集モードを切り替える
 */
function toggleRowEditMode(orderId) {
    
    // 行要素を検索（data-order-id属性で）
    let row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    
    // data-order-id属性がない場合は、行内の注文IDテキストで検索
    if (!row) {
        const allRows = document.querySelectorAll('.order-row');
        for (const orderRow of allRows) {
            const orderIdElement = orderRow.querySelector('.order-number');
            if (orderIdElement && orderIdElement.textContent.includes(orderId)) {
                row = orderRow;
                break;
            }
        }
    }
    
    if (!row) {
        return;
    }
    
    const editBtn = row.querySelector('.edit-btn');
    if (!editBtn) {
        return;
    }
    
    const isCurrentlyEditing = editBtn.textContent.includes('保存');
    
    if (isCurrentlyEditing) {
        // 保存処理
        saveRowData(orderId, row);
        setRowEditMode(row, false);
        editBtn.textContent = '編集';
        editBtn.style.backgroundColor = '#6c757d';
    } else {
        // 編集モードに切り替え
        setRowEditMode(row, true);
        editBtn.textContent = '保存';
        editBtn.style.backgroundColor = '#28a745';
    }
}

/**
 * 行の編集モードを設定
 */
function setRowEditMode(row, isEdit) {
    
    try {
        // 注文情報列（.order-info）の入力欄のみを制御
        const orderInfoCell = row.querySelector('.order-info');
        if (orderInfoCell) {
            // カテゴリプルダウンの編集モード制御
            const categoryDropdown = orderInfoCell.querySelector('.category-dropdown');
            if (categoryDropdown) {
                if (isEdit) {
                    // 編集モード：プルダウンとして機能
                    categoryDropdown.style.appearance = 'auto';
                    categoryDropdown.style.webkitAppearance = 'auto';
                    categoryDropdown.style.mozAppearance = 'auto';
                    categoryDropdown.style.cursor = 'pointer';
                    categoryDropdown.style.pointerEvents = 'auto';
                    categoryDropdown.style.border = '1px solid #ccc';
                    categoryDropdown.disabled = false;
                    // カテゴリ色を再適用
                    updateCategoryColor(categoryDropdown);
                } else {
                    // 読み取り専用モード：矢印を非表示にして色だけ表示
                    categoryDropdown.style.appearance = 'none';
                    categoryDropdown.style.webkitAppearance = 'none';
                    categoryDropdown.style.mozAppearance = 'none';
                    categoryDropdown.style.cursor = 'default';
                    categoryDropdown.style.pointerEvents = 'none';
                    categoryDropdown.style.border = 'none';
                    // disabledにしない（色が薄くなるため）
                    categoryDropdown.disabled = false;
                    // カテゴリ色を再適用
                    updateCategoryColor(categoryDropdown);
                }
            }
            
            // その他の入力欄の制御
            const inputs = orderInfoCell.querySelectorAll('input, textarea');
            const selects = orderInfoCell.querySelectorAll('select:not(.category-dropdown)');
            
            // 入力欄とその他のセレクトボックスの制御
            [...inputs, ...selects].forEach((element, index) => {
                // 編集ボタンは除外
                if (element.classList.contains('edit-btn')) {
                    return;
                }
                
                if (isEdit) {
                    element.style.display = '';
                    element.disabled = false;
                } else {
                    element.style.display = 'none';
                    element.disabled = true;
                }
            });
            
            // 注文情報列の読み取り専用表示要素の制御
            const readOnlyElements = orderInfoCell.querySelectorAll('.edit-read-only');
            
            readOnlyElements.forEach(element => {
                element.style.display = isEdit ? 'none' : 'inline';
            });
        }
        
        // 編集ボタンは常に表示
        const editBtns = row.querySelectorAll('.edit-btn');
        editBtns.forEach(btn => {
            btn.style.display = 'block';
            btn.style.visibility = 'visible';
            btn.style.opacity = '1';
        });
        
    } catch (error) {
        console.error('❌ 行編集モード設定エラー:', error);
    }
}

/**
 * 行データを保存
 */
function saveRowData(orderId, row) {
    try {
        
        // 各入力欄の値を取得
        const data = {
            orderId: orderId,
            category: row.querySelector('.category-dropdown')?.value || '',
            customerName: row.querySelector('.customer-name-input')?.value || '',
            companyName: row.querySelector('.company-name-input')?.value || '',
            deliveryDate: row.querySelector('.delivery-date .text-input')?.value || '',
            publicationPermission: row.querySelector('.publication-permission-select')?.value || 'しない',
        };
        
        // 読み取り専用表示を更新
        updateReadOnlyDisplays(row, data);
        
        // 統一された保存処理を実行
        saveOrderDataUnified(data);
        
    } catch (error) {
        console.error('❌ 行データ保存エラー:', error);
        // alert('保存中にエラーが発生しました: ' + error.message);
    }
}

/**
 * 統一された注文データ保存処理
 */
async function saveOrderDataUnified(data) {
    try {
        console.log('💾 統一保存処理開始:', data);
        
        // 各フィールドを個別に保存
        const fieldsToSave = [
            { name: 'formTitle', value: data.category },
            { name: 'customer', value: data.customerName },
            { name: 'company_name', value: data.companyName },
            { name: '納品日', value: data.deliveryDate },
            { name: '制作事例掲載許可', value: data.publicationPermission }
        ];
        
        let saveCount = 0;
        let errorCount = 0;
        
        for (const field of fieldsToSave) {
            if (field.value) { // 値がある場合のみ保存
                try {
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
                            order_id: data.orderId,
                            field_name: field.name,
                            field_value: field.value,
                            edited_by: 'user'
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        saveCount++;
                        console.log(`✅ フィールド保存成功: ${field.name} = ${field.value}`);
                    } else {
                        errorCount++;
                        console.error(`❌ フィールド保存失敗: ${field.name} - ${result.message}`);
                    }
                    
                } catch (error) {
                    errorCount++;
                    console.error(`💥 フィールド保存エラー: ${field.name} -`, error);
                }
            }
        }
        
        console.log(`📊 保存結果: 成功 ${saveCount}件, 失敗 ${errorCount}件`);
        
        // 保存後にキャッシュをクリアして最新データを取得
        if (saveCount > 0) {
            await clearCacheAndReloadUnified();
        }
        
    } catch (error) {
        console.error('❌ 統一保存処理エラー:', error);
    }
}

/**
 * キャッシュクリア・再読み込み（統一版）
 */
async function clearCacheAndReloadUnified() {
    try {
        console.log('🗑️ キャッシュクリア・再読み込み中...');
        
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
 * 読み取り専用表示を更新
 */
function updateReadOnlyDisplays(row, data) {
    try {
        // カテゴリプルダウンの色を更新
        const categoryDropdown = row.querySelector('.category-dropdown');
        if (categoryDropdown && data.category) {
            // 古いカテゴリクラスを削除
            categoryDropdown.classList.remove('category-poli', 'category-silk', 'category-ribbon', 'category-tie', 'category-stole', 'category-chief');
            // 新しいカテゴリクラスを追加
            const categoryClass = getCategoryClass(data.category);
            if (categoryClass) {
                categoryDropdown.classList.add(categoryClass);
            }
        }
        
        // 顧客名の読み取り専用表示を更新
        const customerReadOnly = row.querySelector('.client-name .edit-read-only');
        if (customerReadOnly) {
            customerReadOnly.textContent = data.customerName || '';
        }
        
        // 会社名の読み取り専用表示を更新
        const companyReadOnly = row.querySelector('.company-name .edit-read-only');
        if (companyReadOnly) {
            companyReadOnly.textContent = data.companyName || '';
        }
        
        // 納品日の読み取り専用表示を更新
        const deliveryReadOnly = row.querySelector('.delivery-date .edit-read-only');
        if (deliveryReadOnly) {
            deliveryReadOnly.textContent = data.deliveryDate || '';
        }
        
        // 制作事例掲載許可の読み取り専用表示を更新
        const permissionReadOnly = row.querySelector('.publication-permission .edit-read-only');
        if (permissionReadOnly) {
            permissionReadOnly.textContent = data.publicationPermission || 'しない';
        }
        
    } catch (error) {
        console.error('❌ 読み取り専用表示更新エラー:', error);
    }
}

/**
 * 編集モードの初期化（各行を読み取り専用で初期化）
 */
function initializeEditMode() {
    // 少し待ってから初期化（DOM要素が確実に生成された後）
    setTimeout(() => {
        try {
            const rows = document.querySelectorAll('.order-row');
            
            if (rows.length === 0) {
                return;
            }
            
            rows.forEach((row) => {
                try {
                    // 読み取り専用モードで初期化
                    setRowEditMode(row, false);
                } catch (error) {
                    console.error('❌ 行初期化エラー:', error);
                }
            });
            
        } catch (error) {
            console.error('❌ 編集モード初期化エラー:', error);
        }
    }, 100); // 100ms待機
}

// 個別行編集モード関連関数をグローバルに公開
window.toggleRowEditMode = toggleRowEditMode;
window.initializeEditMode = initializeEditMode;



console.log('✅ TABLE-MANAGER.JS 読み込み完了');