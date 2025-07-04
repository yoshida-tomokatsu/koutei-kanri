// メインスクリプト - 工程管理システム（修正版）

console.log('📄 メインスクリプト開始');

// グローバル変数
let currentTab = 'all';
let ordersData = [];
// serverFilesの初期化は core.js で一元管理（バックアップファイルのため無効化）
// let serverFiles = {}; // サーバーのファイル情報管理

// グローバルに公開
// window.serverFiles = serverFiles;
window.ordersData = ordersData;
window.currentTab = currentTab;

// 動的選択肢の管理
let dynamicOptions = { ...DYNAMIC_OPTIONS };

/**
 * データ読み込みとシステム初期化
 */
async function loadOrdersFromData() {
    console.log('📊 サンプルデータを読み込み中...');
    
    try {
        // サンプルデータをコピー
        ordersData = [...SAMPLE_ORDERS];
        window.ordersData = ordersData;
        console.log('✅ データ読み込み完了:', ordersData.length, '件');
        
        // 各注文のファイル情報をサーバーから取得（エラーハンドリング強化）
        for (const order of ordersData) {
            try {
                const files = await loadFilesFromServer(order.注文ID);
                serverFiles[order.注文ID] = files;
            } catch (error) {
                console.warn('⚠️ ファイル情報取得失敗:', order.注文ID, error.message);
                // ファイルがない場合はデフォルト値を設定
                serverFiles[order.注文ID] = { quotes: [], images: [] };
            }
        }
        
        buildOrdersTable();
        initializeEvents();
        
        console.log('✅ システム初期化完了');
    } catch (error) {
        console.error('❌ データ読み込みエラー:', error);
        const tbody = document.getElementById('orders-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="15" class="loading" style="color: red;">データの読み込みに失敗しました</td></tr>';
        }
    }
}

/**
 * テーブル行を構築
 */
function buildOrdersTable() {
    console.log('🏗️ テーブル構築開始');
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) {
        console.error('❌ テーブルボディが見つかりません');
        return;
    }
    
    tbody.innerHTML = '';

    ordersData.forEach((order, index) => {
        const row = createOrderRow(order, index);
        tbody.appendChild(row);
    });

    initializeRowEvents();
    console.log('✅ テーブル構築完了');
}

/**
 * 注文行を作成
 */
function createOrderRow(order, index) {
    const row = document.createElement('tr');
    row.className = 'order-row';
    
    const orderId = order.注文ID || `#${index + 1}`;
    
    row.innerHTML = `
        <td class="order-info">
            <div class="category-select">
                <select class="category-dropdown">
                    <option value="ポリエステル スカーフ" ${order.カテゴリ === 'ポリエステル スカーフ' ? 'selected' : ''}>ポリエステル スカーフ</option>
                    <option value="シルク スカーフ" ${order.カテゴリ === 'シルク スカーフ' ? 'selected' : ''}>シルク スカーフ</option>
                    <option value="リボン スカーフ" ${order.カテゴリ === 'リボン スカーフ' ? 'selected' : ''}>リボン スカーフ</option>
                    <option value="スカーフタイ" ${order.カテゴリ === 'スカーフタイ' ? 'selected' : ''}>スカーフタイ</option>
                    <option value="ストール" ${order.カテゴリ === 'ストール' ? 'selected' : ''}>ストール</option>
                    <option value="ポケットチーフ" ${order.カテゴリ === 'ポケットチーフ' ? 'selected' : ''}>ポケットチーフ</option>
                </select>
            </div>
            <div class="order-number">注文ID：${orderId}</div>
            <div class="client-name" style="font-size: 13px; color: #333;">${order.顧客名 || ''}</div>
            <div class="company-name" style="font-size: 13px; color: #333;">${order.会社名 || ''}</div>
            <div class="order-date" style="font-size: 13px; color: #333;">注文日：${order.注文日 || ''}</div>
            <div class="delivery-date" style="font-size: 13px; color: #333;">納品日：<input type="date" class="date-input" value="${order.納品日 || ''}" style="font-size: 14px; font-weight: bold; width: 130px;" /></div>
            <div class="status-badge status-pending">計算中</div>
        </td>
        <td class="doc-buttons">
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <button class="doc-btn" data-action="pdf" data-type="見積書" data-order="${orderId}" id="quote-btn-${orderId}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    見積
                </button>
                <button class="upload-btn" onclick="showUploadModal('${orderId}', 'quotes')">📎 ファイル選択</button>
                <div class="file-info" id="quote-info-${orderId}">ファイルなし</div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <button class="doc-btn" data-action="pdf" data-type="商品画像" data-order="${orderId}" id="image-btn-${orderId}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    画像
                </button>
                <button class="upload-btn" onclick="showUploadModal('${orderId}', 'images')">📎 ファイル選択</button>
                <div class="file-info" id="image-info-${orderId}">ファイルなし</div>
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
            <textarea class="remarks-text" style="width: 100%; resize: vertical;">${order.備考 || ''}</textarea>
        </td>
    `;

    return row;
}

/**
 * ファイル表示を更新（改良版）
 */
function updateFileDisplay(orderId, fileType) {
    if (DEBUG.LOG_UI_UPDATES) {
        console.log('🔄 ファイル表示更新:', orderId, fileType);
    }
    
    if (!orderId || !fileType) {
        console.error('❌ OrderIDまたはFileTypeが空です:', {orderId, fileType});
        return false;
    }
    
    const btnId = fileType === 'quotes' ? `quote-btn-${orderId}` : `image-btn-${orderId}`;
    const infoId = fileType === 'quotes' ? `quote-info-${orderId}` : `image-info-${orderId}`;
    
    const btn = document.getElementById(btnId);
    const info = document.getElementById(infoId);
    
    if (!btn || !info) {
        console.warn('⚠️ 表示更新用の要素が見つかりません:', btnId, infoId);
        return false;
    }
    
    // サーバーファイル情報を確認
    const files = serverFiles[orderId]?.[fileType] || [];
    
    // 表示テキストを決定
    let newText = '';
    if (files.length === 0) {
        newText = 'ファイルなし';
    } else if (files.length === 1) {
        newText = '1件のファイル';
    } else {
        newText = `${files.length}件のファイル<span class="multiple-indicator">複数</span>`;
    }
    
    // ボタンクラスを更新
    if (files.length > 0) {
        btn.classList.add('has-file');
        btn.classList.remove('active');
    } else {
        btn.classList.remove('has-file');
        btn.classList.remove('active');
    }
    
    // HTMLを更新
    info.innerHTML = newText;
    
    return true;
}

// グローバルに公開
window.updateFileDisplay = updateFileDisplay;

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
        alert('その選択肢は既に存在します。');
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
 * ステータス自動更新機能
 */
function updateOrderStatus(row) {
    const statusBadge = row.querySelector('.status-badge');
    const dateInputs = row.querySelectorAll('.date-input');
    const selects = row.querySelectorAll('select');
    
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
    if (window.filterOrders) {
        const hasActiveFilters = Object.values(window.currentFilters || {}).some(filter => filter !== '');
        if (hasActiveFilters || currentTab !== 'all') {
            setTimeout(() => window.filterOrders(), 100);
        }
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
 * 行のイベント初期化
 */
function initializeRowEvents() {
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
        
        // 初期化時の色設定
        updateCategoryColor(select);
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
    
    // 備考欄の高さ調整
    document.querySelectorAll('.remarks-text').forEach(textarea => {
        const adjustHeight = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(textarea.scrollHeight, 120) + 'px';
        };
        
        adjustHeight();
        textarea.addEventListener('input', adjustHeight);
    });
    
    // 初期化時に全ての行の状態を設定
    document.querySelectorAll('.order-row').forEach(row => {
        updateDateFieldState(row);
        updateOrderStatus(row);
        
        // ファイル表示を更新
        const orderIdElement = row.querySelector('.order-number');
        if (orderIdElement) {
            const orderId = orderIdElement.textContent.replace('注文ID：', '');
            updateFileDisplay(orderId, 'quotes');
            updateFileDisplay(orderId, 'images');
        }
    });
}

/**
 * カテゴリプルダウンの背景色切り替え
 */
function updateCategoryColor(select) {
    select.classList.remove('category-poli', 'category-silk', 'category-ribbon', 'category-tie', 'category-stole', 'category-chief');
    
    switch (select.value) {
        case 'ポリエステル スカーフ':
            select.classList.add('category-poli');
            break;
        case 'シルク スカーフ':
            select.classList.add('category-silk');
            break;
        case 'リボン スカーフ':
            select.classList.add('category-ribbon');
            break;
        case 'スカーフタイ':
            select.classList.add('category-tie');
            break;
        case 'ストール':
            select.classList.add('category-stole');
            break;
        case 'ポケットチーフ':
            select.classList.add('category-chief');
            break;
    }
}

/**
 * イベント初期化
 */
function initializeEvents() {
    initializeRowEvents();
    if (window.initializeUploadModalEvents) {
        window.initializeUploadModalEvents();
    }
    initializeGlobalEvents();
}

/**
 * ESCキーによるモーダル終了処理
 */
function initializeGlobalEvents() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // PDFモーダルが開いている場合
            const pdfModal = document.getElementById('pdfModal');
            if (pdfModal && pdfModal.style.display === 'flex') {
                if (window.closePDFModal) {
                    window.closePDFModal();
                }
                return;
            }
            
            // アップロードモーダルが開いている場合
            const uploadModal = document.getElementById('uploadModal');
            if (uploadModal && uploadModal.style.display === 'flex') {
                if (window.closeUploadModal) {
                    window.closeUploadModal();
                }
                return;
            }
            
            // 削除確認ダイアログが開いている場合
            const deleteConfirm = document.getElementById('deleteConfirm');
            if (deleteConfirm && deleteConfirm.style.display === 'flex') {
                if (window.cancelDelete) {
                    window.cancelDelete();
                }
            }
        }
    });
    
    // PDFモーダルの背景クリック処理
    const pdfModal = document.getElementById('pdfModal');
    if (pdfModal) {
        pdfModal.addEventListener('click', function(e) {
            if (e.target === pdfModal && window.closePDFModal) {
                window.closePDFModal();
            }
        });
    }
}

/**
 * ページ読み込み時に実行
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM読み込み完了');
    
    try {
        initializeGlobalEvents();
        loadOrdersFromData();
        console.log('✅ 全初期化処理完了');
    } catch (error) {
        console.error('❌ 初期化エラー:', error);
        const tbody = document.getElementById('orders-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="15" class="loading" style="color: red;">システムの初期化に失敗しました: ' + error.message + '</td></tr>';
        }
    }
});

// グローバルに公開（テスト用）
window.buildOrdersTable = buildOrdersTable;
window.loadOrdersFromData = loadOrdersFromData;

console.log('✅ メインスクリプト読み込み完了');