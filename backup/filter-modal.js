// 絞り込みモーダル機能

// 現在のフィルタ設定
let currentFilters = {
    category: '',
    orderPerson: '',
    payment: '',
    printFactory: '',
    sewingFactory: '',
    inspectionPerson: '',
    shipping: ''
};

// グローバルに公開
window.currentFilters = currentFilters;

// 表示モードを取得（view-mode.jsから）
function getCurrentViewMode() {
    return window.currentViewMode || 'detailed';
}

/**
 * 絞り込みモーダルを表示
 */
function showFilterModal() {
    console.log('絞り込みモーダル表示');
    
    // 動的選択肢を更新
    updateFilterOptions();
    
    // 現在のフィルタ値を設定
    document.getElementById('filterCategory').value = currentFilters.category;
    document.getElementById('filterOrderPerson').value = currentFilters.orderPerson;
    document.getElementById('filterPayment').value = currentFilters.payment;
    document.getElementById('filterPrintFactory').value = currentFilters.printFactory;
    document.getElementById('filterSewingFactory').value = currentFilters.sewingFactory;
    document.getElementById('filterInspectionPerson').value = currentFilters.inspectionPerson;
    document.getElementById('filterShipping').value = currentFilters.shipping;
    
    document.getElementById('filterModal').style.display = 'flex';
}

/**
 * 絞り込みモーダルを閉じる
 */
function closeFilterModal() {
    console.log('絞り込みモーダル閉じる');
    document.getElementById('filterModal').style.display = 'none';
}

/**
 * フィルタの選択肢を更新
 */
function updateFilterOptions() {
    // 注文担当
    const orderPersonSelect = document.getElementById('filterOrderPerson');
    orderPersonSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['注文担当'].forEach(person => {
        const option = document.createElement('option');
        option.value = person;
        option.textContent = person;
        orderPersonSelect.appendChild(option);
    });
    
    // 支払い方法
    const paymentSelect = document.getElementById('filterPayment');
    paymentSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['支払い方法'].forEach(payment => {
        const option = document.createElement('option');
        option.value = payment;
        option.textContent = payment;
        paymentSelect.appendChild(option);
    });
    
    // プリント工場
    const printFactorySelect = document.getElementById('filterPrintFactory');
    printFactorySelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['プリント工場'].forEach(factory => {
        const option = document.createElement('option');
        option.value = factory;
        option.textContent = factory;
        printFactorySelect.appendChild(option);
    });
    
    // 縫製工場
    const sewingFactorySelect = document.getElementById('filterSewingFactory');
    sewingFactorySelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['縫製工場'].forEach(factory => {
        const option = document.createElement('option');
        option.value = factory;
        option.textContent = factory;
        sewingFactorySelect.appendChild(option);
    });
    
    // 検品担当
    const inspectionPersonSelect = document.getElementById('filterInspectionPerson');
    inspectionPersonSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['検品担当'].forEach(person => {
        const option = document.createElement('option');
        option.value = person;
        option.textContent = person;
        inspectionPersonSelect.appendChild(option);
    });
    
    // 配送会社
    const shippingSelect = document.getElementById('filterShipping');
    shippingSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['配送会社'].forEach(shipping => {
        const option = document.createElement('option');
        option.value = shipping;
        option.textContent = shipping;
        shippingSelect.appendChild(option);
    });
}

/**
 * フィルタを適用
 */
function applyFilters() {
    console.log('フィルタ適用開始');
    
    // フィルタ値を取得
    currentFilters = {
        category: document.getElementById('filterCategory').value,
        orderPerson: document.getElementById('filterOrderPerson').value,
        payment: document.getElementById('filterPayment').value,
        printFactory: document.getElementById('filterPrintFactory').value,
        sewingFactory: document.getElementById('filterSewingFactory').value,
        inspectionPerson: document.getElementById('filterInspectionPerson').value,
        shipping: document.getElementById('filterShipping').value
    };
    
    // グローバルにも設定
    window.currentFilters = currentFilters;
    
    console.log('適用するフィルタ:', currentFilters);
    
    // フィルタを実行
    filterOrders();
    
    // アクティブフィルタ表示を更新
    updateActiveFiltersDisplay();
    
    // モーダルを閉じる
    closeFilterModal();
}

/**
 * フィルタをクリア
 */
function clearFilters() {
    console.log('フィルタクリア');
    
    // フィルタをリセット
    currentFilters = {
        category: '',
        orderPerson: '',
        payment: '',
        printFactory: '',
        sewingFactory: '',
        inspectionPerson: '',
        shipping: ''
    };
    
    // グローバルにも設定
    window.currentFilters = currentFilters;
    
    // フォームをリセット
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterOrderPerson').value = '';
    document.getElementById('filterPayment').value = '';
    document.getElementById('filterPrintFactory').value = '';
    document.getElementById('filterSewingFactory').value = '';
    document.getElementById('filterInspectionPerson').value = '';
    document.getElementById('filterShipping').value = '';
    
    // フィルタを実行
    filterOrders();
    
    // アクティブフィルタ表示を更新（ボタンの状態も更新される）
    updateActiveFiltersDisplay();
}

/**
 * 注文をフィルタリング
 */
function filterOrders() {
    console.log('注文フィルタリング実行');
    
    const currentViewMode = getCurrentViewMode();
    
    if (currentViewMode === 'simple') {
        // 簡易表示の場合
        if (window.filterSimpleOrders) {
            window.filterSimpleOrders();
        }
        return;
    }
    
    // 詳細表示の場合（既存のロジック）
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
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                const statusText = statusBadge.textContent;
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
    
    console.log(`フィルタリング結果: ${visibleCount}件表示`);
}

/**
 * アクティブフィルタの表示を更新
 */
function updateActiveFiltersDisplay() {
    const activeFiltersContainer = document.getElementById('activeFiltersHorizontal');
    const filterDisplayArea = document.getElementById('filterDisplayArea');
    const filterBtn = document.querySelector('.btn-filter');
    const container = document.querySelector('.container');
    
    activeFiltersContainer.innerHTML = '';
    
    const filterLabels = {
        category: '商品種別',
        orderPerson: '注文担当',
        payment: '支払い方法',
        printFactory: 'プリント工場',
        sewingFactory: '縫製工場',
        inspectionPerson: '検品担当',
        shipping: '配送会社'
    };
    
    let hasActiveFilters = false;
    
    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key]) {
            hasActiveFilters = true;
            const filterTag = document.createElement('div');
            filterTag.className = 'filter-tag';
            filterTag.innerHTML = `
                ${filterLabels[key]}: ${currentFilters[key]}
                <button class="remove-filter" onclick="removeFilter('${key}')">&times;</button>
            `;
            activeFiltersContainer.appendChild(filterTag);
        }
    });
    
    // フィルタ表示エリアの表示/非表示
    if (hasActiveFilters) {
        filterDisplayArea.style.display = 'block';
        container.classList.add('with-filter');
        filterBtn.classList.add('filtering');
        filterBtn.innerHTML = '🔍 絞り込み中';
    } else {
        filterDisplayArea.style.display = 'none';
        container.classList.remove('with-filter');
        filterBtn.classList.remove('filtering');
        filterBtn.innerHTML = '🔍 絞り込み';
    }
}

/**
 * 個別フィルタを削除
 */
function removeFilter(filterKey) {
    console.log('フィルタ削除:', filterKey);
    
    currentFilters[filterKey] = '';
    window.currentFilters = currentFilters; // グローバルにも設定
    
    filterOrders();
    updateActiveFiltersDisplay(); // ボタンの状態も更新される
}

/**
 * 小さなタブの切り替え機能
 */
function switchTabCompact(tab) {
    console.log('タブ切り替え（コンパクト）:', tab);
    
    currentTab = tab;
    window.currentTab = tab; // グローバルにも設定
    
    // タブボタンのアクティブ状態を更新
    document.querySelectorAll('.tab-button-compact').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tab) {
            btn.classList.add('active');
        }
    });
    
    // フィルタを再実行（タブフィルタも考慮）
    filterOrders();
}

/**
 * 小さなタブイベントを初期化
 */
function initializeCompactTabEvents() {
    document.querySelectorAll('.tab-button-compact').forEach(button => {
        button.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTabCompact(tab);
        });
    });
}

/**
 * フィルタモーダルのイベント初期化
 */
function initializeFilterModalEvents() {
    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const filterModal = document.getElementById('filterModal');
            if (filterModal && filterModal.style.display === 'flex') {
                closeFilterModal();
            }
        }
    });
    
    // モーダル背景クリックで閉じる
    const filterModal = document.getElementById('filterModal');
    if (filterModal) {
        filterModal.addEventListener('click', function(e) {
            if (e.target === filterModal) {
                closeFilterModal();
            }
        });
    }
    
    console.log('フィルタモーダルイベント初期化完了');
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeCompactTabEvents();
    initializeFilterModalEvents();
    // 初期状態で絞り込みボタンの表示を設定
    updateActiveFiltersDisplay();
});

console.log('絞り込みモーダルファイル読み込み完了');