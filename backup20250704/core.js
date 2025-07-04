// ========================================
// CORE.JS - 基本設定・データ・API通信
// ========================================

console.log('📦 CORE.JS 読み込み開始');

// ========================================
// システム設定 (config.js統合)
// ========================================
const CONFIG = {
    // APIエンドポイント
    API_BASE_URL: './upload.php',  // ファイル操作用
    FILE_LIST_API_URL: './editable-orders-api.php',  // ファイル一覧取得用（wp_wqorders_editableのみ）
    
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
        LOADING_TIMEOUT: 120000  // 2分（大量データ処理対応）
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

// デバッグ設定（軽量化）
const DEBUG = {
    ENABLED: false,
    LOG_API_CALLS: false,
    LOG_FILE_OPERATIONS: false,
    LOG_UI_UPDATES: false
};

// コンソールログを一時的に有効化
// if (!LOG_CONFIG.ENABLE_ALL_LOGS) {
//     console.log = function() {};
//     console.warn = function() {};
//     console.error = function() {};
//     console.info = function() {};
//     console.debug = function() {};
// }

// 空のログ関数（何も出力しない）
window.logger = {
    debug: function(...args) { /* 無効 */ },
    info: function(...args) { /* 無効 */ },
    warn: function(...args) { /* 無効 */ },
    error: function(...args) { /* 無効 */ }
};

// ========================================
// サンプルデータ (data.js統合)
// ========================================
const SAMPLE_ORDERS = [
    {
        "注文ID": "#0001",
        "顧客名": "山田太郎様",
        "会社名": "株式会社サンプル",
        "注文日": "2025/05/09",
        "納品日": "2025-06-09",
        "カテゴリ": "ポリエステル スカーフ",
        "注文担当": "大島",
        "イメージ送付日": "2025-05-20",
        "支払い方法": "クレジット",
        "支払い完了日": "2025-05-20",
        "プリント依頼日": "2025-05-21",
        "プリント工場": "川島エンブ",
        "プリント納期": "2025-05-27",
        "縫製依頼日": "2025-05-28",
        "縫製工場": "周東縫製",
        "縫製納期": "2025-05-30",
        "検品担当": "",
        "発送日": "",
        "配送会社": "",
        "備考": "納品先変更：群馬県桐生市堤町3-4-9 株式会社FACTORY"
    },
    {
        "注文ID": "#0002",
        "顧客名": "田中花子様",
        "会社名": "株式会社サンプル",
        "注文日": "2025/05/10",
        "納品日": "2025-06-10",
        "カテゴリ": "ポリエステル スカーフ",
        "注文担当": "山田",
        "イメージ送付日": "2025-05-20",
        "支払い方法": "銀行振込",
        "支払い完了日": "2025-05-22",
        "プリント依頼日": "2025-05-23",
        "プリント工場": "田中プリント",
        "プリント納期": "2025-05-27",
        "縫製依頼日": "",
        "縫製工場": "",
        "縫製納期": "",
        "検品担当": "",
        "発送日": "",
        "配送会社": "",
        "備考": ""
    },
    {
        "注文ID": "#0003",
        "顧客名": "鈴木一郎様",
        "会社名": "株式会社サンプル",
        "注文日": "2025/05/12",
        "納品日": "2025-05-26",
        "カテゴリ": "ポリエステル スカーフ",
        "注文担当": "山田",
        "イメージ送付日": "2025-05-15",
        "支払い方法": "銀行振込",
        "支払い完了日": "2025-05-16",
        "プリント依頼日": "2025-05-17",
        "プリント工場": "田中プリント",
        "プリント納期": "2025-05-20",
        "縫製依頼日": "2025-05-21",
        "縫製工場": "高橋縫製",
        "縫製納期": "2025-05-23",
        "検品担当": "佐藤",
        "発送日": "2025-05-25",
        "配送会社": "佐川急便",
        "備考": "特急対応 追加料金あり"
    },
    {
        "注文ID": "#0004",
        "顧客名": "佐藤次郎様",
        "会社名": "株式会社サンプル",
        "注文日": "2025/05/13",
        "納品日": "2025-06-12",
        "カテゴリ": "ポリエステル スカーフ",
        "注文担当": "大島",
        "イメージ送付日": "2025-05-21",
        "支払い方法": "",
        "支払い完了日": "",
        "プリント依頼日": "",
        "プリント工場": "",
        "プリント納期": "",
        "縫製依頼日": "",
        "縫製工場": "",
        "縫製納期": "",
        "検品担当": "",
        "発送日": "",
        "配送会社": "",
        "備考": "大口注文 割引適用"
    },
    {
        "注文ID": "#0005",
        "顧客名": "高橋美智子様",
        "会社名": "株式会社サンプル",
        "注文日": "2025/05/14",
        "納品日": "2025-06-01",
        "カテゴリ": "ポリエステル スカーフ",
        "注文担当": "山田",
        "イメージ送付日": "2025-05-18",
        "支払い方法": "銀行振込",
        "支払い完了日": "2025-05-19",
        "プリント依頼日": "2025-05-20",
        "プリント工場": "川島エンブ",
        "プリント納期": "2025-05-25",
        "縫製依頼日": "2025-05-26",
        "縫製工場": "周東縫製",
        "縫製納期": "",
        "検品担当": "",
        "発送日": "",
        "配送会社": "",
        "備考": "サイズ変更あり"
    }
];

// ========================================
// API通信関連 (api.js統合)
// ========================================

/**
 * サーバーにファイルをアップロードする
 */
async function uploadFilesToServer(orderId, files, fileType) {
    if (DEBUG.LOG_API_CALLS) {
        console.log('📤 API: アップロード開始:', orderId, fileType, files.length + '件');
    }
    
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('orderId', orderId);
    formData.append('fileType', fileType);
    
    // 複数ファイルを追加
    Array.from(files).forEach(file => {
        formData.append('files[]', file);
    });
    
    try {
        const response = await fetch(CONFIG.API_BASE_URL, {
            method: 'POST',
            body: formData
        });
        
        const uploadResponse = await response.json();
        
        if (uploadResponse.success) {
            if (DEBUG.LOG_API_CALLS) {
                console.log('✅ API: アップロード成功:', uploadResponse.files?.length || 0, '件');
            }
            return uploadResponse;
        } else {
            throw new Error(uploadResponse.message || 'アップロードに失敗しました');
        }
        
    } catch (error) {
        console.error('❌ API: アップロードエラー:', error);
        throw error;
    }
}

// ファイル取得キャッシュ
const fileLoadCache = new Map();
const cacheExpireTime = 5 * 60 * 1000; // 5分間キャッシュ

/**
 * サーバーからファイル一覧を取得（キャッシュ機能付き）
 */
async function loadFilesFromServer(orderId) {
    if (DEBUG.LOG_API_CALLS) {
        console.log('📡 API: ファイル一覧取得開始:', orderId);
    }
    
    // キャッシュチェック
    const cacheKey = orderId;
    const cached = fileLoadCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < cacheExpireTime)) {
        if (DEBUG.LOG_API_CALLS) {
            console.log('📡 API: キャッシュから取得:', orderId);
        }
        return cached.data;
    }
    
    try {
        // キャッシュを無効化するためタイムスタンプを追加
        const timestamp = new Date().getTime();
        const response = await fetch(`${CONFIG.API_BASE_URL}?action=list&orderId=${encodeURIComponent(orderId)}&_t=${timestamp}`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const fileListResponse = await response.json();
        
        if (DEBUG.LOG_API_CALLS) {
            console.log('📡 API: レスポンス取得:', fileListResponse.files?.length || 0, '件');
        }
        
        // デバッグ：#1308の場合は詳細ログを出力
        if (orderId.includes('1308')) {
            console.log('🎯 #1308 API レスポンス詳細:', {
                orderId: orderId,
                success: fileListResponse.success,
                filesLength: fileListResponse.files?.length || 0,
                response: fileListResponse
            });
        }
        
        if (fileListResponse.success) {
            // ファイルをタイプ別に分類
            const files = { quotes: [], images: [] };
            fileListResponse.files.forEach(file => {
                if (file.fileType === 'quotes') {
                    files.quotes.push(file);
                } else if (file.fileType === 'images') {
                    files.images.push(file);
                }
            });
            
            // キャッシュに保存
            fileLoadCache.set(cacheKey, {
                data: files,
                timestamp: Date.now()
            });
            
            return files;
        } else {
            console.error('❌ API: ファイル取得エラー:', fileListResponse.message);
            return { quotes: [], images: [] };
        }
    } catch (error) {
        console.error('❌ API: ファイル一覧取得エラー:', error);
        return { quotes: [], images: [] };
    }
}

/**
 * サーバーからファイルを削除
 */
async function deleteFileFromServer(orderId, filename) {
    if (DEBUG.LOG_API_CALLS) {
        console.log('🗑️ API: ファイル削除開始:', orderId, filename);
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('orderId', orderId);
        formData.append('filename', filename);
        
        const response = await fetch(CONFIG.API_BASE_URL, {
            method: 'POST',
            body: formData
        });
        
        const deleteResponse = await response.json();
        
        if (deleteResponse.success) {
            if (DEBUG.LOG_API_CALLS) {
                console.log('✅ API: ファイル削除成功:', filename);
            }
            return deleteResponse;
        } else {
            throw new Error(deleteResponse.message || 'ファイル削除に失敗しました');
        }
        
    } catch (error) {
        console.error('❌ API: ファイル削除エラー:', error);
        throw error;
    }
}

/**
 * サーバーに並び順を保存
 */
async function saveFileOrder(orderId, fileType, fileOrder) {
    if (DEBUG.LOG_API_CALLS) {
        console.log('💾 API: 並び順保存開始:', orderId, fileType, fileOrder.length + '件');
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'reorder');
        formData.append('orderId', orderId);
        formData.append('fileType', fileType);
        formData.append('fileOrder', JSON.stringify(fileOrder));
        
        const response = await fetch(CONFIG.API_BASE_URL, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}\nResponse: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            if (DEBUG.LOG_API_CALLS) {
                console.log('✅ API: 並び順保存成功');
            }
            return result;
        } else {
            throw new Error(result.message || 'サーバーエラー');
        }
    } catch (error) {
        console.error('❌ API: 並び順保存エラー:', error);
        throw error;
    }
}

/**
 * 注文IDをサーバーフォルダ名にマッピング（JavaScript版・実際のフォルダ構造に基づく）
 */
function mapOrderIdToFolderName(orderId) {
    const match = orderId.match(/#?(\d+)/);
    if (match) {
        const number = parseInt(match[1]);
        
        // 特別対応：見積書#1308は既存の#0001フォルダに存在
        if (number === 1308) {
            console.log('🎯 特別対応: 見積書#1308 → #0001フォルダ');
            return '#0001';
        }
        
        // 既存の#形式フォルダを優先（実際のフォルダ構造に基づく）
        if (number >= 494 && number <= 503) {
            return '#0001';  // 実在するPDFファイルの範囲
        } else if (number >= 1001 && number <= 1999) {
            return '#0001';  // 暫定的に#0001に集約
        } else if (number >= 2000 && number <= 2999) {
            return '#0002';  // #0002フォルダ用
        }
        
        // 新形式フォルダのマッピング（フォールバック）
        else if (number >= 483 && number <= 999) {
            return '01-000';  // 00483.pdf ～ 00999.pdf
        } else if (number >= 1001 && number <= 1999) {
            return '01-001';  // 01001.pdf ～ 01999.pdf
        } else if (number >= 2000 && number <= 2999) {
            return '01-002';  // 02000.pdf ～ 02999.pdf
        } else if (number >= 3000 && number <= 3999) {
            return '01-003';  
        } else if (number >= 4000 && number <= 4999) {
            return '01-004';  
        } else if (number >= 5000 && number <= 5999) {
            return '01-005';  
        } else if (number >= 6000 && number <= 6999) {
            return '01-006';  
        } else if (number >= 7000 && number <= 7999) {
            return '01-007';  
        } else if (number >= 8000 && number <= 8999) {
            return '01-008';  
        } else if (number >= 9000 && number <= 9999) {
            return '01-009';  
        } else if (number >= 10000) {
            // 10000以上の場合は動的に判定
            const folderNum = Math.floor((number - 1) / 1000) + 1;
            return `01-${String(folderNum).padStart(3, '0')}`;
        } else {
            // デフォルト: 既存フォルダを優先
            return '#0001';
        }
    }
    
    // 従来の形式もサポート
    return orderId;
}

/**
 * ファイルダウンロードURLを生成（ローカル同期ファイル対応版）
 */
function getFileDownloadUrl(orderId, filename) {
    // 注文IDから番号を抽出（#1308 → 1308）- 全ての#を確実に削除
    const orderNumber = orderId.replace(/#/g, '').trim();
    
    // フォルダ名を決定（01308.pdf → 01-001）
    const folderName = mapOrderIdToFolderName(orderId);
    
    // 正常に動作するpdf-viewer-api.phpを使用（最優先）
    const viewerApiUrl = `pdf-viewer-api.php?action=view&folder=${folderName}&file=${filename}`;
    
    // フォールバック1: sync_pdf（テストで動作確認済み）
    const syncPdfUrl = `upload.php?action=sync_pdf&orderId=${encodeURIComponent(orderId)}`;
    
    // フォールバック2: 直接PDFサーバーURL
    const directPdfUrl = `https://original-scarf.com/aforms-admin-pdf/${orderNumber}`;
    
    // デバッグログ
    if (DEBUG.LOG_API_CALLS) {
        console.log('📡 PDF URL生成（pdf-viewer-api優先）:', {
            orderId: orderId,
            orderNumber: orderNumber,
            filename: filename,
            folderName: folderName,
            viewerApiUrl: viewerApiUrl,
            syncPdfUrl: syncPdfUrl,
            directPdfUrl: directPdfUrl
        });
    }
    
    // pdf-viewer-api.phpを返す（テストで200 OKを確認済み）
    return viewerApiUrl;
}

/**
 * ファイル形式の検証
 */
function validateFileTypes(files, fileType) {
    const allowedTypes = CONFIG.FILE_SETTINGS.ALLOWED_TYPES[fileType];
    if (!allowedTypes) {
        throw new Error('無効なファイルタイプです');
    }
    
    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));
    if (invalidFiles.length > 0) {
        const allowedExtensions = CONFIG.FILE_SETTINGS.ALLOWED_EXTENSIONS[fileType];
        throw new Error(`対応していないファイル形式です。\n許可された形式: ${allowedExtensions}`);
    }
    
    return true;
}

/**
 * ファイルサイズの検証
 */
function validateFileSize(files) {
    const maxSize = CONFIG.FILE_SETTINGS.MAX_FILE_SIZE;
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
        const maxSizeMB = maxSize / (1024 * 1024);
        throw new Error(`ファイルサイズが大きすぎます（${maxSizeMB}MB以下にしてください）`);
    }
    
    return true;
}

// ========================================
// グローバル変数
// ========================================
let ordersData = [];
let serverFiles = {};
let dynamicOptions = { ...DYNAMIC_OPTIONS };

/**
 * PDFアクセス（simple-pdf-viewer.js連携版）
 */
window.showDirectPDF = function(orderId, containerId = 'pdfViewer') {
    console.log('📁 PDF表示開始（simple-pdf-viewer連携）:', {
        orderId: orderId,
        containerId: containerId,
        hasSimplePDFFunction: typeof window.showSimplePDF === 'function'
    });
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ PDFコンテナーが見つかりません:', containerId);
        return false;
    }
    
    // simple-pdf-viewer.jsのshowSimplePDF関数を優先使用
    if (typeof window.showSimplePDF === 'function') {
        console.log('✅ simple-pdf-viewer.jsを使用:', orderId);
        return window.showSimplePDF(orderId, containerId);
    }
    
    // フォールバック: 従来の方式
    console.warn('⚠️ simple-pdf-viewer.jsが利用できません。フォールバック方式を使用');
    
    const orderNumber = orderId.replace(/#/g, '').trim();
    const localPdfUrl = `upload.php?action=sync_pdf&orderId=${encodeURIComponent(orderId)}`;
    const directPdfUrl = `https://original-scarf.com/aforms-admin-pdf/${orderNumber}`;
    
    // ローディング表示
    container.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;">
            <div style="text-align: center;">
                <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <div style="font-size: 16px; color: #666;">PDFを読み込み中...</div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">見積書 ${orderNumber} - フォールバック方式</div>
            </div>
        </div>
    `;
    
    // まずローカル同期ファイルを試行
    const testIframe = document.createElement('iframe');
    testIframe.style.width = '100%';
    testIframe.style.height = '100%';
    testIframe.style.border = 'none';
    testIframe.src = localPdfUrl;
    testIframe.title = `見積書 ${orderNumber}`;
    
    let loadSuccess = false;
    
    // ローカルファイル成功時
    testIframe.onload = function() {
        if (!loadSuccess) {
            loadSuccess = true;
            console.log('✅ フォールバック: ローカル同期PDF読み込み成功:', orderNumber);
            
            container.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                    <div style="padding: 8px 10px; background: #fff3cd; border-bottom: 1px solid #ffeaa7; font-size: 13px; color: #856404;">
                        📁 見積書 ${orderNumber} (フォールバック方式)
                        <a href="${localPdfUrl}" target="_blank" style="float: right; color: #007bff; text-decoration: none; font-size: 11px;">
                            📂 新しいタブで開く
                        </a>
                    </div>
                    <div style="flex: 1; overflow: hidden;" id="pdf-container-${orderNumber}"></div>
                </div>
            `;
            
            const pdfContainer = document.getElementById(`pdf-container-${orderNumber}`);
            if (pdfContainer) {
                pdfContainer.appendChild(testIframe);
            }
        }
    };
    
    // ローカルファイル失敗時：外部サイトアクセス
    testIframe.onerror = function() {
        if (!loadSuccess) {
            console.warn('⚠️ フォールバック: ローカル同期PDF読み込み失敗 - 外部サイトを試行:', orderNumber);
            
            container.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                    <div style="padding: 8px 10px; background: #f8d7da; border-bottom: 1px solid #f5c6cb; font-size: 13px; color: #721c24;">
                        ⚠️ 見積書 ${orderNumber} - 外部サイトアクセス
                        <a href="${directPdfUrl}" target="_blank" style="float: right; color: #007bff; text-decoration: none; font-size: 11px;">
                            🔗 新しいタブで開く
                        </a>
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        <iframe src="${directPdfUrl}" 
                                style="width: 100%; height: 100%; border: none;"
                                title="見積書 ${orderNumber}"
                                onload="console.log('✅ 外部PDF iframe 読み込み完了: ${orderNumber}')"
                                onerror="console.error('❌ 外部PDF iframe 読み込み失敗: ${orderNumber}')">
                        </iframe>
                    </div>
                </div>
            `;
        }
    };
    
    // タイムアウト処理（3秒後）
    setTimeout(() => {
        if (!loadSuccess) {
            console.warn('⏰ フォールバック: ローカルPDF読み込みタイムアウト - 外部サイトを試行:', orderNumber);
            testIframe.onerror();
        }
    }, 3000);
    
    return true;
};

/**
 * PDF同期実行とリトライ
 */
function showPDFSyncAndRetry(container, orderNumber, orderId, directPdfUrl, proxyPdfUrl) {
    container.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; padding: 40px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
                <h3 style="color: #333; margin-bottom: 15px;">PDF同期中...</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                    見積書 ${orderNumber} を取得するため、<br>
                    サーバーからファイルを同期しています。
                </p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="width: 200px; height: 4px; background: #e9ecef; border-radius: 2px; margin: 10px auto; overflow: hidden;">
                        <div id="sync-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #007bff, #0056b3); transition: width 0.3s ease;"></div>
                    </div>
                    <div id="sync-status" style="font-size: 14px; color: #6c757d; margin-top: 10px;">同期準備中...</div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="retryPDFSync('${orderId}', '${container.id}')" 
                            style="background: #17a2b8; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        🔄 手動同期実行
                    </button>
                    <a href="${directPdfUrl}" target="_blank" 
                       style="background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-size: 14px;">
                        📄 直接アクセス
                    </a>
                </div>
                
                <p style="font-size: 12px; color: #999; margin-top: 15px;">
                    ※ 同期完了後、自動的にPDFが表示されます
                </p>
            </div>
        </div>
    `;
    
    // 自動同期実行
    executePDFSync(orderId, container);
}

/**
 * PDF同期実行
 */
async function executePDFSync(orderId, container) {
    const progressBar = document.getElementById('sync-progress');
    const statusDiv = document.getElementById('sync-status');
    
    try {
        // プログレスバー開始
        if (progressBar) progressBar.style.width = '20%';
        if (statusDiv) statusDiv.textContent = 'サーバーに接続中...';
        
        // 同期API呼び出し
        const response = await fetch('pdf-sync.php?action=sync');
        
        if (progressBar) progressBar.style.width = '60%';
        if (statusDiv) statusDiv.textContent = 'ファイル同期中...';
        
        const result = await response.json();
        
        if (progressBar) progressBar.style.width = '80%';
        
        if (result.success) {
            if (statusDiv) statusDiv.textContent = `同期完了: ${result.stats.copied_files + result.stats.updated_files}件のファイルを更新`;
            
            if (progressBar) progressBar.style.width = '100%';
            
            // 成功時は1秒後にPDFを再読み込み
            setTimeout(() => {
                window.showDirectPDF(orderId, container.id);
            }, 1000);
            
        } else {
            throw new Error(result.message || '同期に失敗しました');
        }
        
    } catch (error) {
        console.error('PDF同期エラー:', error);
        
        if (progressBar) progressBar.style.width = '0%';
        if (statusDiv) statusDiv.textContent = `同期失敗: ${error.message}`;
        
        // エラー時は手動同期ボタンを有効化
        setTimeout(() => {
            const retryBtn = container.querySelector('button[onclick*="retryPDFSync"]');
            if (retryBtn) {
                retryBtn.disabled = false;
                retryBtn.textContent = '🔄 再試行';
            }
        }, 1000);
    }
}

/**
 * PDF同期のリトライ
 */
function retryPDFSync(orderId, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        executePDFSync(orderId, container);
    }
}

/**
 * グローバル同期トリガー（ボタンから呼び出し）
 */
window.triggerPDFSync = async function() {
    console.log('🔄 手動PDF同期開始');
    
    try {
        const response = await fetch('pdf-sync.php?action=sync');
        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ PDF同期完了！\n\nコピー: ${result.stats.copied_files}件\n更新: ${result.stats.updated_files}件\nスキップ: ${result.stats.skipped_files}件`);
            
            // ページを再読み込みして最新状態を反映
            window.location.reload();
        } else {
            console.error(`❌ PDF同期エラー: ${result.message}`);
        }
    } catch (error) {
        console.error('PDF同期エラー:', error);
        console.error(`❌ PDF同期エラー: ${error.message}`);
    }
};

/**
 * PDF認証が必要な場合のメッセージ表示（フォールバック用）
 */
function showPDFAuthRequiredMessage(container, orderNumber, directPdfUrl) {
    container.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; padding: 40px;">
            <div style="text-align: center; max-width: 500px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔐</div>
                <h3 style="color: #333; margin-bottom: 15px;">WordPress認証が必要です</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                    見積書 ${orderNumber} を表示するには、同じブラウザで<br>
                    <strong>original-scarf.com</strong> のWordPressにログインしてください。
                </p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                    <strong style="color: #495057;">📋 手順:</strong>
                    <ol style="margin: 10px 0 0 20px; color: #6c757d; font-size: 14px;">
                        <li>新しいタブで <a href="https://original-scarf.com/wp-admin/" target="_blank" style="color: #007bff;">WordPress管理画面</a> を開く</li>
                        <li>ログインを完了する</li>
                        <li>このページに戻って再度ファイルボタンをクリック</li>
                    </ol>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <a href="https://original-scarf.com/wp-admin/" target="_blank" 
                       style="background: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-size: 14px;">
                        🔑 WordPressログイン
                    </a>
                    <a href="${directPdfUrl}" target="_blank" 
                       style="background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-size: 14px;">
                        📄 PDF直接アクセス
                    </a>
                </div>
                
                <p style="font-size: 12px; color: #999; margin-top: 15px;">
                    ※ ログイン後は同じブラウザでPDFにアクセスできるようになります
                </p>
            </div>
        </div>
    `;
}

// グローバルに公開
window.CONFIG = CONFIG;
window.DYNAMIC_OPTIONS = DYNAMIC_OPTIONS;
window.DEBUG = DEBUG;
window.SAMPLE_ORDERS = SAMPLE_ORDERS;
window.ordersData = ordersData;
window.serverFiles = serverFiles;
window.dynamicOptions = dynamicOptions;

// API関数をグローバルに公開
window.uploadFilesToServer = uploadFilesToServer;
window.loadFilesFromServer = loadFilesFromServer;
window.deleteFileFromServer = deleteFileFromServer;
window.saveFileOrder = saveFileOrder;
window.getFileDownloadUrl = getFileDownloadUrl;
window.validateFileTypes = validateFileTypes;
window.validateFileSize = validateFileSize;
window.mapOrderIdToFolderName = mapOrderIdToFolderName;

console.log('✅ CORE.JS 読み込み完了');