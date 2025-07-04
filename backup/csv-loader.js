// CSV読み込み機能（オプション）
// data.jsの代わりにCSVファイルからデータを読み込む場合に使用

/**
 * CSVファイルを読み込んでパース
 */
async function loadOrdersFromCSV(csvFilePath = 'orders_sample.csv') {
    try {
        console.log('📄 CSVファイル読み込み開始:', csvFilePath);
        
        const response = await fetch(csvFilePath);
        if (!response.ok) {
            throw new Error(`CSVファイルの読み込みに失敗しました: ${response.status}`);
        }
        
        const csvText = await response.text();
        const parsedData = parseCSV(csvText);
        
        console.log('✅ CSV読み込み完了:', parsedData.length, '件');
        return parsedData;
        
    } catch (error) {
        console.error('❌ CSV読み込みエラー:', error);
        
        // フォールバック: サンプルデータを使用
        console.log('🔄 サンプルデータにフォールバック');
        return SAMPLE_ORDERS;
    }
}

/**
 * CSVテキストをJSONオブジェクトに変換
 */
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('CSVファイルにデータがありません');
    }
    
    // ヘッダー行を取得
    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    console.log('📋 CSVヘッダー:', headers);
    
    // データ行をパース
    const orders = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        if (values.length !== headers.length) {
            console.warn(`⚠️ 行${i + 1}: カラム数が一致しません (期待値: ${headers.length}, 実際: ${values.length})`);
            continue;
        }
        
        // オブジェクトを作成
        const order = {};
        headers.forEach((header, index) => {
            order[header] = values[index] || '';
        });
        
        orders.push(order);
    }
    
    console.log('📊 パース完了:', orders.length, '件の注文データ');
    return orders;
}

/**
 * CSV行を正しくパース（カンマ区切り、クォート対応）
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // エスケープされたクォート
                current += '"';
                i++; // 次の文字をスキップ
            } else {
                // クォートの開始/終了
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // カンマ区切り（クォート外）
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // 最後の値を追加
    values.push(current.trim());
    
    return values;
}

/**
 * CSVデータをシステム用に正規化
 */
function normalizeOrderData(csvOrders) {
    return csvOrders.map(order => {
        // 必要に応じてデータ変換を行う
        const normalized = { ...order };
        
        // 日付フォーマットの統一
        if (normalized.注文日) {
            normalized.注文日 = formatDate(normalized.注文日);
        }
        if (normalized.納品日) {
            normalized.納品日 = formatDateForInput(normalized.納品日);
        }
        
        // 空文字の処理
        Object.keys(normalized).forEach(key => {
            if (normalized[key] === undefined || normalized[key] === null) {
                normalized[key] = '';
            }
        });
        
        return normalized;
    });
}

/**
 * 日付フォーマット変換（表示用）
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    // 様々な日付フォーマットに対応
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // 変換できない場合は元の値を返す
    
    return date.toLocaleDateString('ja-JP');
}

/**
 * 日付フォーマット変換（input[type="date"]用）
 */
function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ''; // 変換できない場合は空文字
    
    return date.toISOString().split('T')[0];
}

/**
 * CSVを使用したデータ読み込み（data.jsの代替）
 */
async function loadOrdersFromDataWithCSV() {
    console.log('📊 CSVからデータ読み込み開始...');
    
    try {
        // CSVファイルから読み込み
        const csvOrders = await loadOrdersFromCSV();
        const normalizedOrders = normalizeOrderData(csvOrders);
        
        console.log('✅ CSVデータ読み込み完了:', normalizedOrders.length, '件');
        return normalizedOrders;
        
    } catch (error) {
        console.error('❌ CSVデータ読み込みエラー:', error);
        
        // フォールバック: サンプルデータを使用
        console.log('🔄 サンプルデータを使用');
        return SAMPLE_ORDERS;
    }
}

/**
 * ファイル選択によるCSV読み込み
 */
function setupCSVFileInput() {
    // ファイル入力要素を作成
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // CSVファイル選択ボタンを追加
    const csvButton = document.createElement('button');
    csvButton.textContent = '📄 CSVファイル読み込み';
    csvButton.className = 'btn-new';
    csvButton.style.marginLeft = '10px';
    
    csvButton.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const csvText = await file.text();
            const parsedData = parseCSV(csvText);
            const normalizedData = normalizeOrderData(parsedData);
            
            // データを更新
            ordersData = normalizedData;
            
            // テーブルを再構築
            buildOrdersTable();
            
            alert(`${normalizedData.length}件のデータを読み込みました`);
            
        } catch (error) {
            console.error('CSVファイル読み込みエラー:', error);
            alert('CSVファイルの読み込みに失敗しました: ' + error.message);
        }
    });
    
    // ヘッダーにボタンを追加
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        headerActions.appendChild(csvButton);
    }
}

// 使用方法の説明をコンソールに出力
console.log(`
📋 CSV読み込み機能の使用方法:

1. script.jsのloadOrdersFromData()をloadOrdersFromDataWithCSV()に変更
2. またはsetupCSVFileInput()を呼び出してファイル選択機能を追加

例:
// data.jsの代わりにCSVを使用
async function loadOrdersFromData() {
    return await loadOrdersFromDataWithCSV();
}

// または初期化時にファイル選択機能を追加
document.addEventListener('DOMContentLoaded', function() {
    setupCSVFileInput();
    // 既存の初期化処理...
});
`);

console.log('CSV読み込み機能ファイル読み込み完了');