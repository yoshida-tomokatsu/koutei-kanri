/**
 * デバッグ用同期スクリプト - ブラウザコンソールから実行
 */

/**
 * ID 1313の詳細確認
 */
async function checkOrder1313() {
    console.log('🔍 ID 1313の詳細確認を開始...');
    
    try {
        // 1. 編集可能APIから全データを取得
        console.log('📊 編集可能テーブルから全データを取得中...');
        const response = await fetch('editable-orders-api.php?action=get_orders&limit=99999&page=1');
        const data = await response.json();
        
        if (!data.success) {
            console.error('❌ データ取得失敗:', data.message);
            return false;
        }
        
        console.log(`📋 取得データ件数: ${data.data.orders.length}件`);
        
        // 2. ID 1313を検索
        const order1313 = data.data.orders.find(o => parseInt(o.id) === 1313);
        
        if (order1313) {
            console.log('✅ ID 1313が見つかりました:', order1313);
            return true;
        } else {
            console.log('❌ ID 1313が見つかりません');
            
            // 3. 近い範囲のIDを確認
            const nearIds = data.data.orders
                .filter(o => parseInt(o.id) >= 1310 && parseInt(o.id) <= 1320)
                .sort((a, b) => parseInt(a.id) - parseInt(b.id));
            
            console.log('📋 1310-1320範囲のID:', nearIds.map(o => ({id: o.id, customer: o.customer, formTitle: o.formTitle})));
            
            // 4. 最大・最小IDを確認
            const ids = data.data.orders.map(o => parseInt(o.id)).sort((a, b) => a - b);
            console.log(`📊 ID範囲: ${ids[0]} - ${ids[ids.length - 1]}`);
            
            return false;
        }
        
    } catch (error) {
        console.error('❌ 確認エラー:', error);
        return false;
    }
}

/**
 * 元データベースから直接同期を実行
 */
async function directSync1313() {
    console.log('🔧 ID 1313の直接同期を実行...');
    
    try {
        // カスタムAPIエンドポイントを作成して実行
        const syncData = {
            action: 'direct_sync_1313',
            target_id: 1313
        };
        
        const response = await fetch('editable-orders-api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(syncData)
        });
        
        const result = await response.json();
        console.log('📥 同期結果:', result);
        
        return result.success;
        
    } catch (error) {
        console.error('❌ 直接同期エラー:', error);
        return false;
    }
}

/**
 * 完全な診断とテスト
 */
async function fullDiagnostic() {
    console.log('🔬 完全診断を開始...');
    
    const results = {
        step1_check_existing: false,
        step2_sync_attempt: false,
        step3_verify_sync: false
    };
    
    // ステップ1: 既存データ確認
    console.log('\n=== ステップ1: 既存データ確認 ===');
    results.step1_check_existing = await checkOrder1313();
    
    if (results.step1_check_existing) {
        console.log('✅ ID 1313は既に存在します。同期は不要です。');
        return results;
    }
    
    // ステップ2: 同期実行
    console.log('\n=== ステップ2: 同期実行 ===');
    results.step2_sync_attempt = await directSync1313();
    
    if (!results.step2_sync_attempt) {
        console.log('❌ 同期に失敗しました。');
        return results;
    }
    
    // ステップ3: 同期後確認
    console.log('\n=== ステップ3: 同期後確認 ===');
    // 少し待ってから確認
    await new Promise(resolve => setTimeout(resolve, 1000));
    results.step3_verify_sync = await checkOrder1313();
    
    // 結果まとめ
    console.log('\n=== 診断結果 ===');
    console.log('既存データ確認:', results.step1_check_existing ? '✅' : '❌');
    console.log('同期実行:', results.step2_sync_attempt ? '✅' : '❌');
    console.log('同期後確認:', results.step3_verify_sync ? '✅' : '❌');
    
    if (results.step3_verify_sync) {
        console.log('🎉 ID 1313の同期が完了しました！');
        
        // データを再読み込み
        if (window.forceLoadFromEditableAPI) {
            console.log('🔄 データを再読み込み中...');
            await window.forceLoadFromEditableAPI();
        }
    }
    
    return results;
}

// グローバルに公開
window.checkOrder1313 = checkOrder1313;
window.directSync1313 = directSync1313;
window.fullDiagnostic = fullDiagnostic;

console.log('🔧 デバッグ同期スクリプト読み込み完了');
console.log('使用方法:');
console.log('  • checkOrder1313() - ID 1313の存在確認');
console.log('  • directSync1313() - ID 1313を直接同期');
console.log('  • fullDiagnostic() - 完全診断実行'); 