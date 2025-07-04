// 表示モード切り替え機能

let currentViewMode = 'detailed'; // 'detailed' or 'simple'

// グローバルに公開
window.currentViewMode = currentViewMode;

/**
 * 表示モードを切り替える
 */
function switchViewMode(mode) {
    console.log('🔄 表示モード切り替え:', mode);
    
    currentViewMode = mode;
    window.currentViewMode = mode; // グローバルにも設定
    
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
    
    console.log('🔍 要素確認:', {
        detailedView: detailedView ? 'あり' : 'なし',
        simpleView: simpleView ? 'あり' : 'なし'
    });
    
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
            
            // 確実に表示されているか再確認
            setTimeout(() => {
                if (simpleView) {
                    const computedStyle = getComputedStyle(simpleView);
                    console.log('📊 最終確認:', {
                        display: computedStyle.display,
                        visibility: computedStyle.visibility,
                        height: computedStyle.height,
                        className: simpleView.className
                    });
                }
            }, 200);
        }, 100);
    }
}

/**
 * 簡易表示テーブルを構築
 */
function buildSimpleTable() {
    console.log('🏗️ 簡易表示テーブル構築開始');
    
    // テーブル要素の確認
    const tbody = document.getElementById('simple-table-body');
    if (!tbody) {
        console.error('❌ simple-table-body が見つかりません');
        return;
    }
    console.log('✅ simple-table-body 要素見つかりました');
    
    // グローバルなordersDataを確認
    const data = window.ordersData || ordersData || [];
    console.log('📊 使用するデータ:', {
        dataLength: data.length,
        sampleData: data[0] || 'データなし',
        windowOrdersData: window.ordersData ? '存在' : '不在',
        localOrdersData: typeof ordersData !== 'undefined' ? '存在' : '不在'
    });
    
    if (data.length === 0) {
        console.warn('⚠️ ordersDataが空です');
        tbody.innerHTML = '<tr><td colspan="21" class="loading">データがありません</td></tr>';
        return;
    }
    
    // テーブルをクリア
    tbody.innerHTML = '';
    console.log('🧹 テーブルをクリアしました');
    
    try {
        // 各行を作成
        data.forEach((order, index) => {
            console.log(`🔄 行 ${index + 1} を作成中:`, order.注文ID || `#${index + 1}`);
            const row = createSimpleOrderRow(order, index);
            if (row) {
                tbody.appendChild(row);
                console.log(`✅ 行 ${index + 1} を追加しました - HTML:`, row.innerHTML.substring(0, 100) + '...');
            } else {
                console.error(`❌ 行 ${index + 1} の作成に失敗`);
            }
        });
        
        console.log('✅ 全行の追加完了');
        
        // テーブルの状態確認
        const addedRows = tbody.querySelectorAll('tr');
        console.log('📋 追加された行数:', addedRows.length);
        console.log('📋 tbody.innerHTML長さ:', tbody.innerHTML.length);
        console.log('📋 tbody.innerHTML先頭100文字:', tbody.innerHTML.substring(0, 100));
        
        // テーブル可視性の確認
        const simpleView = document.getElementById('simpleView');
        const simpleTable = document.querySelector('.simple-table');
        
        console.log('👀 表示状態確認:', {
            simpleViewDisplay: simpleView ? getComputedStyle(simpleView).display : 'N/A',
            simpleViewClass: simpleView ? simpleView.className : 'N/A',
            tableExists: simpleTable ? 'あり' : 'なし',
            tbodyParent: tbody.parentElement ? tbody.parentElement.tagName : 'N/A'
        });
        
        // フィルタを適用
        if (window.filterOrders) {
            setTimeout(() => {
                console.log('🔍 フィルタを適用中...');
                window.filterOrders();
            }, 100);
        }

        console.log('✅ 簡易表示テーブル構築完了:', data.length, '件');
        
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
        console.log(`🔧 行作成中 [${index}]:`, order);
        
        const row = document.createElement('tr');
        row.className = 'simple-row order-row';
        
        const orderId = order.注文ID || `#${index + 1}`;
        
        // ステータスを計算
        const status = calculateOrderStatus(order);
        console.log(`📊 ステータス計算 [${orderId}]:`, status);
        
        // カテゴリのクラス名を決定
        const categoryClass = getCategoryClass(order.カテゴリ);
        console.log(`🏷️ カテゴリクラス [${orderId}]:`, categoryClass);
        
        const htmlContent = `
            <td><span class="simple-status ${status.class}">${status.text}</span></td>
            <td><span class="simple-category ${categoryClass}">${order.カテゴリ || ''}</span></td>
            <td><span class="simple-order-id">${orderId}</span></td>
            <td>${order.顧客名 || ''}</td>
            <td>${order.会社名 || ''}</td>
            <td>${order.注文日 || ''}</td>
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
        
        row.innerHTML = htmlContent;
        console.log(`✅ 行HTML生成完了 [${orderId}]`);
        
        return row;
        
    } catch (error) {
        console.error(`❌ 行作成エラー [${index}]:`, error, order);
        
        // エラー時のフォールバック行を作成
        const errorRow = document.createElement('tr');
        errorRow.className = 'simple-row order-row';
        errorRow.innerHTML = `
            <td colspan="21" style="color: red; text-align: center;">
                行 ${index + 1} の作成でエラーが発生しました: ${error.message}
            </td>
        `;
        return errorRow;
    }
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
 * カテゴリのCSSクラス名を取得
 */
function getCategoryClass(category) {
    switch (category) {
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
 * 簡易表示でのフィルタリング
 */
function filterSimpleOrders() {
    const currentViewMode = getCurrentViewMode();
    if (currentViewMode !== 'simple') return;
    
    console.log('簡易表示フィルタリング実行');
    
    // グローバルなcurrentFiltersを取得
    const filters = window.currentFilters || {};
    const currentTab = window.currentTab || 'all';
    
    const rows = document.querySelectorAll('.simple-row');
    let visibleCount = 0;
    
    rows.forEach(row => {
        let shouldShow = true;
        const cells = row.querySelectorAll('td');
        
        // 新しい列順序に基づいてインデックスを調整：
        // 0:ステータス, 1:商品種別, 2:注文ID, 3:お名前, 4:会社名, 5:注文日, 6:納品日, 7:注文担当, 8:イメージ送付, 9:支払い方法, 10:支払い完了, 11:プリント依頼, 12:プリント工場, 13:プリント納期, 14:縫製依頼, 15:縫製工場, 16:縫製納期, 17:検品担当, 18:発送日, 19:配送会社, 20:備考
        
        // カテゴリフィルタ（商品種別は列1）
        if (filters.category) {
            const categoryCell = cells[1];
            if (!categoryCell || !categoryCell.textContent.includes(filters.category)) {
                shouldShow = false;
            }
        }
        
        // 注文担当フィルタ（注文担当は列7）
        if (filters.orderPerson) {
            const orderPersonCell = cells[7];
            if (!orderPersonCell || orderPersonCell.textContent.trim() !== filters.orderPerson) {
                shouldShow = false;
            }
        }
        
        // 支払い方法フィルタ（支払い方法は列9）
        if (filters.payment) {
            const paymentCell = cells[9];
            if (!paymentCell || paymentCell.textContent.trim() !== filters.payment) {
                shouldShow = false;
            }
        }
        
        // プリント工場フィルタ（プリント工場は列12）
        if (filters.printFactory) {
            const printFactoryCell = cells[12];
            if (!printFactoryCell || printFactoryCell.textContent.trim() !== filters.printFactory) {
                shouldShow = false;
            }
        }
        
        // 縫製工場フィルタ（縫製工場は列15）
        if (filters.sewingFactory) {
            const sewingFactoryCell = cells[15];
            if (!sewingFactoryCell || sewingFactoryCell.textContent.trim() !== filters.sewingFactory) {
                shouldShow = false;
            }
        }
        
        // 検品担当フィルタ（検品担当は列17）
        if (filters.inspectionPerson) {
            const inspectionPersonCell = cells[17];
            if (!inspectionPersonCell || inspectionPersonCell.textContent.trim() !== filters.inspectionPerson) {
                shouldShow = false;
            }
        }
        
        // 配送会社フィルタ（配送会社は列19）
        if (filters.shipping) {
            const shippingCell = cells[19];
            if (!shippingCell || shippingCell.textContent.trim() !== filters.shipping) {
                shouldShow = false;
            }
        }
        
        // 現在のタブフィルタも考慮（ステータスは列0）
        if (shouldShow && currentTab !== 'all') {
            const statusCell = cells[0];
            if (statusCell) {
                const statusText = statusCell.textContent.trim();
                if (currentTab === 'in-progress' && statusText === '完了') {
                    shouldShow = false;
                } else if (currentTab === 'completed' && statusText !== '完了') {
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
 * デバッグ用：簡易表示のテスト
 */
window.testSimpleView = function() {
    console.log('🧪 簡易表示テスト開始');
    
    // データの確認
    const data = window.ordersData || [];
    console.log('📊 テストデータ:', {
        length: data.length,
        firstItem: data[0],
        windowOrdersData: window.ordersData ? 'あり' : 'なし'
    });
    
    // テーブル要素の確認
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

// グローバルに即座に公開
window.testSimpleView = window.testSimpleView;

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeViewModeEvents();
    console.log('✅ 表示モード切り替え機能が初期化されました');
});

// グローバルに公開
window.switchViewMode = switchViewMode;
window.buildSimpleTable = buildSimpleTable;
window.filterSimpleOrders = filterSimpleOrders;

// デバッグ用のダイレクトテスト関数
window.debugSimpleView = function() {
    console.log('🔧 デバッグ：簡易表示を強制表示');
    
    const simpleView = document.getElementById('simpleView');
    const detailedView = document.getElementById('detailedView');
    
    if (simpleView && detailedView) {
        // 強制的に表示切り替え
        detailedView.style.display = 'none';
        simpleView.style.display = 'block';
        simpleView.style.visibility = 'visible';
        simpleView.style.height = 'auto';
        simpleView.style.minHeight = '400px';
        
        console.log('🔧 簡易表示を強制表示しました');
        
        // データがあれば構築
        if (window.ordersData && window.ordersData.length > 0) {
            setTimeout(() => {
                buildSimpleTable();
            }, 100);
        }
    } else {
        console.error('❌ 簡易表示要素が見つかりません');
    }
};

console.log('✅ 表示モード切り替えファイル読み込み完了');