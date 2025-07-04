/**
 * 軽量システム - プロ仕様
 * 全ての重い処理を削除し、最低限の機能のみで高速動作を実現
 */

// 重い処理を全て無効化
console.log('🚀 軽量システム初期化開始');

// 1. ファイル処理を完全停止
if (window.loadFileInformationAsync) {
    window.loadFileInformationAsync = async function() {
        console.log('📁 ファイル処理完全停止');
        return Promise.resolve();
    };
}

if (window.updateAllFileDisplays) {
    window.updateAllFileDisplays = function() {
        console.log('📁 ファイル表示更新停止');
    };
}

// 2. 全キャッシュシステムを無効化
if (window.dataCache) {
    window.dataCache.getPage = function() { return null; };
    window.dataCache.setPage = function() {};
}

if (window.databaseCache) {
    window.databaseCache.isValid = function() { return false; };
    window.databaseCache.get = function() { return null; };
    window.databaseCache.set = function() {};
}

// 3. 軽量データ取得関数
window.loadOrdersSimple = async function() {
    console.log('⚡ 軽量データ取得');
    
    try {
        const response = await fetch('editable-orders-api.php?action=get_orders&limit=999&page=1&_simple=1');
        const result = await response.json();
        
        if (result.success && result.data.orders) {
            window.ordersData = result.data.orders;
            window.filteredOrders = result.data.orders;
            
            // テーブルのみ更新
            if (window.buildOrdersTable) {
                window.buildOrdersTable();
            }
            
            console.log('✅ 軽量データ取得完了:', result.data.orders.length, '件');
            return result.data.orders;
        }
    } catch (error) {
        console.error('❌ 軽量データ取得エラー:', error);
    }
    
    return [];
};

// 4. 軽量保存処理
window.saveOrderSimple = async function(orderData) {
    console.log('💾 軽量保存開始');
    
    try {
        const response = await fetch('editable-orders-api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_order',
                order_id: orderData.orderId,
                category: orderData.category,
                customer_name: orderData.customerName,
                company_name: orderData.companyName,
                delivery_date: orderData.deliveryDate,
                publication_permission: orderData.publicationPermission
            })
        });
        
        if (response.ok) {
            console.log('✅ 軽量保存完了');
            
            // 該当行のみ即座更新
            updateRowOnly(orderData.orderId, orderData);
            
            return { success: true };
        }
    } catch (error) {
        console.error('❌ 軽量保存エラー:', error);
    }
    
    return { success: false };
};

// 5. 行のみ更新（重い処理なし）
function updateRowOnly(orderId, orderData) {
    const normalizedId = String(orderId).replace(/[^0-9]/g, '');
    const row = document.querySelector(`[data-order-id="id_${normalizedId}"]`);
    
    if (row) {
        // カテゴリ更新
        const categorySelect = row.querySelector('select[name="category"]');
        if (categorySelect && orderData.category) {
            categorySelect.value = orderData.category;
        }
        
        // 顧客名更新
        const customerInput = row.querySelector('input[name="customer_name"]');
        if (customerInput && orderData.customerName) {
            customerInput.value = orderData.customerName;
        }
        
        // 会社名更新
        const companyInput = row.querySelector('input[name="company_name"]');
        if (companyInput && orderData.companyName) {
            companyInput.value = orderData.companyName;
        }
        
        // 納品日更新
        const deliveryInput = row.querySelector('input[name="delivery_date"]');
        if (deliveryInput && orderData.deliveryDate) {
            deliveryInput.value = orderData.deliveryDate;
        }
        
        // 編集ボタンを戻す
        const editBtn = row.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.textContent = '編集';
            editBtn.style.backgroundColor = '#6c757d';
        }
        
        console.log('✅ 行更新完了:', orderId);
    }
}

// 6. 元の重い関数を軽量版に置換
if (window.saveOrderData) {
    window.saveOrderData = window.saveOrderSimple;
}

// 7. 初期化時の重い処理をスキップ
window.addEventListener('load', function() {
    // ファイル処理を完全停止
    setTimeout(() => {
        const fileElements = document.querySelectorAll('.quote-btn, .images-btn');
        fileElements.forEach(el => {
            el.style.display = 'none'; // ファイルボタンを非表示
        });
        console.log('📁 ファイルボタン非表示化完了');
    }, 1000);
});

console.log('🚀 軽量システム初期化完了 - 高速動作モード'); 