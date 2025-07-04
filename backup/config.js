// システム設定
const CONFIG = {
    // APIエンドポイント
    API_BASE_URL: './upload.php',
    
    // ファイルアップロード設定
    FILE_SETTINGS: {
        MAX_FILE_SIZE: 10 * 1024 * 1024,
        ALLOWED_TYPES: {
            quotes: ['application/pdf'],
            images: ['image/jpeg', 'image/png', 'application/pdf']
        },
        ALLOWED_EXTENSIONS: {
            quotes: 'PDF',
            images: 'JPG, PNG, PDF'
        }
    },
    
    // UI設定
    UI_SETTINGS: {
        UPDATE_DELAY: 300,
        RETRY_COUNT: 3,
        LOADING_TIMEOUT: 5000
    }
};

// 動的選択肢の初期設定
const DYNAMIC_OPTIONS = {
    注文担当: ['大島', '山田', '佐藤'],
    支払い方法: ['クレジット', '銀行振込'],
    プリント工場: ['川島エンブ', '田中プリント', '高橋縫製'],
    縫製工場: ['周東縫製', '高橋縫製'],
    検品担当: ['小林', '佐藤'],
    配送会社: ['ヤマト宅急便', 'ヤマト（ネコポス）', '佐川急便']
};

// デバッグ設定
const DEBUG = {
    ENABLED: true,
    LOG_API_CALLS: true,
    LOG_FILE_OPERATIONS: true,
    LOG_UI_UPDATES: true
};

console.log('設定ファイル読み込み完了:', CONFIG);
