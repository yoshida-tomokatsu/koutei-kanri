/**
 * 即座更新ヘルパー - 本番環境でテストページ同様の即座更新を実現
 */

/**
 * 保存後の即座更新を実行
 * @param {string} orderId - 注文ID
 * @param {Object} orderData - 更新されたデータ
 */
async function performInstantUpdate(orderId, orderData) {
    console.log('⚡ 即座更新開始:', orderId, orderData);
    
    try {
        // 1. 全キャッシュを即座にクリア
        console.log('🗑️ 即座キャッシュクリア...');
        if (window.clearAllCaches) {
            window.clearAllCaches();
        }
        
        // 2. 該当行を即座に更新
        console.log('🔄 行データ即座更新...');
        const normalizedOrderId = String(orderId).replace(/[^0-9]/g, '');
        const sanitizedId = `id_${normalizedOrderId}`;
        
        // 複数のセレクタで行を検索
        const selectors = [
            `[data-order-id="${sanitizedId}"]`,
            `[data-order-id="${normalizedOrderId}"]`,
            `[data-order-id="#${normalizedOrderId}"]`,
            `tr[data-order-id*="${normalizedOrderId}"]`
        ];
        
        let targetRow = null;
        for (const selector of selectors) {
            targetRow = document.querySelector(selector);
            if (targetRow) {
                console.log('✅ 対象行発見:', selector);
                break;
            }
        }
        
        if (targetRow) {
            // 行のデータを即座に更新
            updateRowInstantly(targetRow, orderData);
            
            // 編集モードを即座に終了
            const editBtn = targetRow.querySelector('.edit-btn');
            if (editBtn && editBtn.textContent === '保存') {
                editBtn.textContent = '編集';
                editBtn.style.backgroundColor = '#6c757d';
                
                // 読み取り専用モードに即座に戻す
                if (window.setRowEditMode) {
                    window.setRowEditMode(targetRow, false);
                }
            }
            
            console.log('✅ 行データ即座更新完了');
        } else {
            console.warn('⚠️ 対象行が見つかりません:', orderId);
        }
        
        // 3. バックグラウンドでデータ同期（軽量版）
        console.log('🔄 バックグラウンド同期開始...');
        setTimeout(async () => {
            try {
                // 軽量データ取得を使用
                if (window.loadDataLightweight) {
                    await window.loadDataLightweight();
                    console.log('✅ バックグラウンド同期完了（軽量版）');
                } else if (window.loadOrdersNoCache) {
                    await window.loadOrdersNoCache();
                    console.log('✅ バックグラウンド同期完了（no-cache強制）');
                }
            } catch (error) {
                console.warn('⚠️ バックグラウンド同期失敗:', error);
            }
        }, 100);
        
        console.log('⚡ 即座更新完了');
        
    } catch (error) {
        console.error('❌ 即座更新エラー:', error);
    }
}

/**
 * 行のデータを即座に更新
 * @param {HTMLElement} row - 対象行
 * @param {Object} orderData - 更新データ
 */
function updateRowInstantly(row, orderData) {
    console.log('🔄 行データ更新中...', orderData);
    
    // カテゴリ更新
    if (orderData.category) {
        const categorySelect = row.querySelector('select[name="category"]');
        if (categorySelect) {
            categorySelect.value = orderData.category;
            // カテゴリ色も即座に更新
            if (window.updateCategoryColor) {
                window.updateCategoryColor(categorySelect);
            }
        }
    }
    
    // 顧客名更新
    if (orderData.customerName) {
        const customerInput = row.querySelector('input[name="customer_name"], input[name="customerName"]');
        if (customerInput) {
            customerInput.value = orderData.customerName;
        }
    }
    
    // 会社名更新
    if (orderData.companyName) {
        const companyInput = row.querySelector('input[name="company_name"], input[name="companyName"]');
        if (companyInput) {
            companyInput.value = orderData.companyName;
        }
    }
    
    // 納品日更新
    if (orderData.deliveryDate) {
        const deliveryInput = row.querySelector('input[name="delivery_date"], input[name="deliveryDate"]');
        if (deliveryInput) {
            deliveryInput.value = orderData.deliveryDate;
        }
    }
    
    // 制作事例掲載許可更新
    if (orderData.publicationPermission) {
        const publicationSelect = row.querySelector('select[name="publication_permission"], select[name="publicationPermission"]');
        if (publicationSelect) {
            publicationSelect.value = orderData.publicationPermission;
        }
    }
    
    console.log('✅ 行データ更新完了');
}

// グローバルに公開
window.performInstantUpdate = performInstantUpdate;
window.updateRowInstantly = updateRowInstantly;

console.log('⚡ 即座更新ヘルパー初期化完了'); 