/**
 * 詳細検索機能
 */

// 詳細検索の設定
let searchOptions = {};
let originalOrdersData = [];

// 詳細検索モーダルを開く
function openDetailSearchModal() {
    document.getElementById('detailSearchModal').style.display = 'block';
    populateSearchOptions();
}

// 詳細検索モーダルを閉じる
function closeDetailSearchModal() {
    document.getElementById('detailSearchModal').style.display = 'none';
}

// 検索オプションを初期化
function populateSearchOptions() {
    if (!window.ordersData || window.ordersData.length === 0) {
        return;
    }

    const data = window.ordersData;
    
    // 各項目のユニークな値を取得
    const uniqueValues = {
        orderHandler: new Set(),
        paymentMethod: new Set(),
        printFactory: new Set(),
        sewingFactory: new Set(),
        qualityChecker: new Set(),
        shippingCompany: new Set()
    };

    data.forEach(order => {
        // contentからattrsを取得
        let attrs = {};
        if (order.content) {
            try {
                const content = JSON.parse(order.content);
                attrs = content.attrs || {};
            } catch (e) {
                // JSON解析に失敗した場合は空のオブジェクト
            }
        }

        // 各項目の値を追加（空文字でない場合のみ）
        if (attrs.注文担当) uniqueValues.orderHandler.add(attrs.注文担当);
        if (attrs.支払方法) uniqueValues.paymentMethod.add(attrs.支払方法);
        if (attrs.プリント工場) uniqueValues.printFactory.add(attrs.プリント工場);
        if (attrs.縫製工場) uniqueValues.sewingFactory.add(attrs.縫製工場);
        if (attrs.検品担当) uniqueValues.qualityChecker.add(attrs.検品担当);
        if (attrs.配送会社) uniqueValues.shippingCompany.add(attrs.配送会社);
    });

    // セレクトボックスにオプションを追加
    populateSelectOptions('searchOrderHandler', Array.from(uniqueValues.orderHandler).sort());
    populateSelectOptions('searchPaymentMethod', Array.from(uniqueValues.paymentMethod).sort());
    populateSelectOptions('searchPrintFactory', Array.from(uniqueValues.printFactory).sort());
    populateSelectOptions('searchSewingFactory', Array.from(uniqueValues.sewingFactory).sort());
    populateSelectOptions('searchQualityChecker', Array.from(uniqueValues.qualityChecker).sort());
    populateSelectOptions('searchShippingCompany', Array.from(uniqueValues.shippingCompany).sort());
}

// セレクトボックスにオプションを追加する関数
function populateSelectOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // 既存のオプション（「すべて」以外）を削除
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }

    // 新しいオプションを追加
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

// 詳細検索をクリア
function clearDetailSearch() {
    // すべてのセレクトボックスを「すべて」に
    document.getElementById('searchOrderHandler').value = '';
    document.getElementById('searchPaymentMethod').value = '';
    document.getElementById('searchPrintFactory').value = '';
    document.getElementById('searchSewingFactory').value = '';
    document.getElementById('searchQualityChecker').value = '';
    document.getElementById('searchShippingCompany').value = '';
    document.getElementById('searchPublicationPermission').value = '';
    
    // 日付フィールドをクリア
    document.getElementById('searchOrderDate').value = '';
    document.getElementById('searchShippingDate').value = '';
    
    // テキストフィールドをクリア
    document.getElementById('searchCustomer').value = '';
    document.getElementById('searchCompany').value = '';
}

// 詳細検索を実行
function executeDetailSearch() {
    const criteria = {
        orderHandler: document.getElementById('searchOrderHandler').value,
        paymentMethod: document.getElementById('searchPaymentMethod').value,
        printFactory: document.getElementById('searchPrintFactory').value,
        sewingFactory: document.getElementById('searchSewingFactory').value,
        qualityChecker: document.getElementById('searchQualityChecker').value,
        shippingCompany: document.getElementById('searchShippingCompany').value,
        orderDate: document.getElementById('searchOrderDate').value,
        shippingDate: document.getElementById('searchShippingDate').value,
        customer: document.getElementById('searchCustomer').value.toLowerCase(),
        company: document.getElementById('searchCompany').value.toLowerCase(),
        publicationPermission: document.getElementById('searchPublicationPermission').value
    };

    // 検索条件が何も設定されていない場合
    const hasAnyCriteria = Object.values(criteria).some(value => value && value.trim() !== '');
    
    if (!hasAnyCriteria) {
        // すべてのデータを表示
        applyDetailSearch(window.ordersData);
        closeDetailSearchModal();
        return;
    }

    // 検索実行
    const filteredData = window.ordersData.filter(order => {
        // contentからattrsを取得
        let attrs = {};
        if (order.content) {
            try {
                const content = JSON.parse(order.content);
                attrs = content.attrs || {};
            } catch (e) {
                // JSON解析に失敗した場合は空のオブジェクト
            }
        }

        // プルダウン検索
        if (criteria.orderHandler && attrs.注文担当 !== criteria.orderHandler) return false;
        if (criteria.paymentMethod && attrs.支払方法 !== criteria.paymentMethod) return false;
        if (criteria.printFactory && attrs.プリント工場 !== criteria.printFactory) return false;
        if (criteria.sewingFactory && attrs.縫製工場 !== criteria.sewingFactory) return false;
        if (criteria.qualityChecker && attrs.検品担当 !== criteria.qualityChecker) return false;
        if (criteria.shippingCompany && attrs.配送会社 !== criteria.shippingCompany) return false;

        // 日付検索
        if (criteria.orderDate && order.注文日) {
            const orderDate = order.注文日.split(' ')[0]; // 時間部分を除去
            if (orderDate !== criteria.orderDate) return false;
        }
        
        if (criteria.shippingDate && attrs.発送日) {
            if (attrs.発送日 !== criteria.shippingDate) return false;
        }

        // テキスト検索（部分一致）
        if (criteria.customer && order.顧客名) {
            if (!order.顧客名.toLowerCase().includes(criteria.customer)) return false;
        }
        
        if (criteria.company && order.会社名) {
            if (!order.会社名.toLowerCase().includes(criteria.company)) return false;
        }

        // 制作事例掲載許可
        if (criteria.publicationPermission) {
            const permission = attrs.制作事例掲載許可 || 'しない';
            if (permission !== criteria.publicationPermission) return false;
        }

        return true;
    });

    applyDetailSearch(filteredData);
    closeDetailSearchModal();
}

// 検索結果を適用
function applyDetailSearch(filteredData) {
    // グローバルなデータを一時的に更新
    const originalData = window.ordersData;
    window.ordersData = filteredData;
    
    // ページネーションをリセット
    window.paginationState.currentPage = 1;
    window.paginationState.totalCount = filteredData.length;
    
    // テーブルを再描画
    if (window.renderOrdersTable) {
        window.renderOrdersTable();
    }
    
    // ページネーションを更新
    if (window.updatePagination) {
        window.updatePagination();
    }
    
    // 検索結果の件数を表示
    const resultMessage = filteredData.length === originalData.length 
        ? `全ての注文を表示中 (${filteredData.length}件)`
        : `検索結果: ${filteredData.length}件 / 全体: ${originalData.length}件`;
    
    // 結果メッセージを表示
    showSearchResultMessage(resultMessage);
}

// 検索結果メッセージを表示
function showSearchResultMessage(message) {
    // 既存のメッセージを削除
    const existingMessage = document.getElementById('searchResultMessage');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 新しいメッセージを作成
    const messageDiv = document.createElement('div');
    messageDiv.id = 'searchResultMessage';
    messageDiv.style.cssText = `
        background: #e8f4fd;
        color: #2c3e50;
        padding: 10px 15px;
        margin: 10px 0;
        border-left: 4px solid #3498db;
        border-radius: 4px;
        font-weight: bold;
    `;
    messageDiv.textContent = message;
    
    // テーブルの前に挿入
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.insertBefore(messageDiv, tableContainer.firstChild);
    }
}

// イベントリスナーはmain.jsのinitializeDetailSearchEvents()で設定されます 