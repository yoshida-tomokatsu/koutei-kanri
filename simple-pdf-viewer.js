/**
 * シンプルPDF表示システム
 * 複数フォルダ対応、確実な表示を重視
 */

/**
 * PDFファイルを表示（シンプル版）
 */
window.showSimplePDF = function(orderId, containerId = 'pdfViewer') {
    console.log('🔍 シンプルPDF表示開始:', orderId);
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ PDFコンテナーが見つかりません:', containerId);
        return false;
    }
    
    const orderNumber = orderId.replace(/#/g, '').trim();
    
    // ローディング表示
    container.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #f8f9fa;">
            <div style="text-align: center; padding: 40px;">
                <div style="width: 50px; height: 50px; border: 4px solid #e3e3e3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <h3 style="color: #333; margin-bottom: 10px;">PDFを読み込み中...</h3>
                <p style="color: #666; margin: 0;">見積書 ${orderNumber}</p>
                <p style="color: #999; font-size: 12px; margin-top: 10px;">複数の方法でアクセスを試行中...</p>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    // PDF表示を試行（複数の方法で）
    tryMultiplePDFMethods(orderId, container);
    
    return true;
};

/**
 * 複数の方法でPDF表示を試行
 */
async function tryMultiplePDFMethods(orderId, container) {
    const orderNumber = orderId.replace(/#/g, '').trim();
    
    // 試行するURL（優先順位順）
    const pdfUrls = [
        // 1. Upload API経由（同期ファイル）- 最優先
        `upload.php?action=sync_pdf&orderId=${encodeURIComponent(orderId)}`,
        
        // 2. PDF Viewer API経由（フォルダ自動判定）
        `pdf-viewer-api.php?action=view&folder=01-001&file=${String(orderNumber).padStart(5, '0')}.pdf`,
        
        // 3. 直接ファイルアクセス（相対パス）
        `aforms-pdf/01-001/${String(orderNumber).padStart(5, '0')}.pdf`,
        
        // 4. PDFプロキシ経由
        `pdf-proxy.php?order=${orderNumber}`,
        
        // 5. 外部サイト直接アクセス（最後の手段）
        `https://original-scarf.com/aforms-admin-pdf/${orderNumber}`
    ];
    
    console.log('🔍 PDF URL試行開始:', pdfUrls);
    
    let successUrl = null;
    let lastError = null;
    let attemptResults = [];
    
    // 各URLを順番に試行
    for (let i = 0; i < pdfUrls.length; i++) {
        const url = pdfUrls[i];
        
        try {
            console.log(`📡 PDF URL試行 ${i + 1}/${pdfUrls.length}:`, url);
            
            // まず軽量なHEADリクエストでファイルの存在確認
            let response;
            let requestMethod = 'HEAD';
            
            try {
                response = await fetch(url, { 
                    method: 'HEAD',
                    cache: 'no-cache'
                });
            } catch (headError) {
                // HEADリクエストが失敗した場合はGETで試行
                console.warn(`⚠️ HEADリクエスト失敗、GETで再試行: ${url}`);
                requestMethod = 'GET';
                response = await fetch(url, { cache: 'no-cache' });
            }
            
            const result = {
                url: url,
                method: requestMethod,
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type'),
                contentLength: response.headers.get('content-length')
            };
            
            attemptResults.push(result);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                console.log(`✅ PDF URL成功:`, result);
                
                // PDFかHTMLかを確認（content-typeが取得できない場合もOKとする）
                if (!contentType || 
                    contentType.includes('application/pdf') || 
                    url.includes('upload.php') ||
                    url.includes('pdf-viewer-api.php') || 
                    url.includes('pdf-proxy.php') ||
                    url.endsWith('.pdf')) {
                    successUrl = url;
                    break;
                } else {
                    console.warn(`⚠️ PDFではないコンテンツ:`, result);
                }
            } else {
                console.warn(`❌ PDF URL失敗:`, result);
            }
            
        } catch (error) {
            const errorResult = {
                url: url,
                error: error.message,
                errorType: error.name
            };
            
            attemptResults.push(errorResult);
            console.warn(`❌ PDF URL例外:`, errorResult);
            lastError = error;
        }
    }
    
    if (successUrl) {
        // 成功したURLでPDFを表示
        displayPDFInContainer(successUrl, container, orderNumber, attemptResults);
    } else {
        // 全て失敗した場合
        showPDFError(container, orderNumber, lastError, attemptResults);
    }
}

/**
 * PDFをコンテナに表示
 */
function displayPDFInContainer(pdfUrl, container, orderNumber, attemptResults = []) {
    console.log('📄 PDF表示実行:', pdfUrl);
    
    const iframe = document.createElement('iframe');
    iframe.src = pdfUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.title = `見積書 ${orderNumber}`;
    
    // 成功時のコンテナ構成
    container.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background: white;">
            <div style="padding: 8px 12px; background: #d4edda; border-bottom: 1px solid #c3e6cb; font-size: 13px; color: #155724; display: flex; justify-content: space-between; align-items: center;">
                <span>📄 見積書 ${orderNumber} ✅</span>
                <div>
                    <button onclick="refreshPDF('${pdfUrl}', '${container.id}')" 
                            style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 11px; cursor: pointer; margin-right: 5px;">
                        🔄 更新
                    </button>
                    <a href="${pdfUrl}" target="_blank" 
                       style="background: #17a2b8; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px; text-decoration: none;">
                        📂 新しいタブで開く
                    </a>
                </div>
            </div>
            <div style="flex: 1; overflow: hidden;" id="pdf-frame-container"></div>
        </div>
    `;
    
    // iframeを挿入
    const frameContainer = container.querySelector('#pdf-frame-container');
    if (frameContainer) {
        frameContainer.appendChild(iframe);
    }
    
    // 読み込み完了ハンドラ
    iframe.onload = function() {
        console.log('✅ PDF表示完了:', orderNumber);
        
        // 成功ログをコンソールに出力
        console.log('📊 PDF表示成功詳細:', {
            orderNumber: orderNumber,
            successUrl: pdfUrl,
            attemptResults: attemptResults
        });
    };
    
    iframe.onerror = function() {
        console.error('❌ PDF iframe読み込みエラー:', orderNumber);
        showPDFError(container, orderNumber, new Error('PDFの読み込みに失敗しました'), attemptResults);
    };
}

/**
 * PDFエラー表示
 */
function showPDFError(container, orderNumber, error, attemptResults = []) {
    console.error('❌ PDF表示エラー:', { orderNumber, error, attemptResults });
    
    // 試行結果の詳細を生成
    let attemptDetailsHtml = '';
    if (attemptResults.length > 0) {
        attemptDetailsHtml = '<div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 15px 0; text-align: left; font-size: 11px;">';
        attemptDetailsHtml += '<strong>🔍 試行結果:</strong><br>';
        
        attemptResults.forEach((result, index) => {
            const status = result.status ? `${result.status} ${result.statusText}` : `エラー: ${result.error}`;
            const icon = result.status && result.status < 400 ? '✅' : '❌';
            attemptDetailsHtml += `${icon} ${index + 1}. ${result.url.substring(0, 50)}... → ${status}<br>`;
        });
        
        attemptDetailsHtml += '</div>';
    }
    
    container.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background: #f8f9fa; padding: 40px;">
            <div style="text-align: center; max-width: 600px;">
                <div style="font-size: 64px; margin-bottom: 20px; color: #dc3545;">📄</div>
                <h3 style="color: #dc3545; margin-bottom: 15px;">PDFを読み込めませんでした</h3>
                <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">
                    見積書 ${orderNumber} のPDFファイルが見つからないか、<br>
                    読み込みに失敗しました。
                </p>
                
                ${attemptDetailsHtml}
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                    <strong>🔍 確認項目:</strong><br>
                    • PDFファイルが存在するか（aforms-pdf/01-001/01308.pdf）<br>
                    • ファイルが正しいフォルダにあるか<br>
                    • ファイルの権限設定<br>
                    • 同期処理の完了状況<br>
                    • ネットワーク接続の状態
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="showSimplePDF('${orderNumber.startsWith('#') ? orderNumber : '#' + orderNumber}', '${container.id}')" 
                            style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        🔄 再試行
                    </button>

                    <a href="aforms-pdf/01-001/${String(orderNumber).padStart(5, '0')}.pdf" target="_blank"
                       style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; text-decoration: none; font-size: 14px;">
                        📁 直接アクセス
                    </a>
                </div>
                
                ${error ? `<p style="font-size: 12px; color: #999; margin-top: 15px;">エラー詳細: ${error.message}</p>` : ''}
            </div>
        </div>
    `;
}

/**
 * PDF更新
 */
window.refreshPDF = function(pdfUrl, containerId) {
    console.log('🔄 PDF更新:', pdfUrl);
    const container = document.getElementById(containerId);
    if (container) {
        const iframe = container.querySelector('iframe');
        if (iframe) {
            iframe.src = pdfUrl + '?t=' + Date.now(); // キャッシュ回避
        }
    }
};



console.log('✅ シンプルPDF表示システム読み込み完了（改良版）');

console.log('🔧 PDF表示クイック修正を実行中...');

window.getFileDownloadUrl = function(orderId, filename) {
    const orderNumber = orderId.replace(/#/g, '').trim();
    let folderName;
    if (orderNumber >= 483 && orderNumber <= 999) {
        folderName = '01-000';
    } else if (orderNumber >= 1001 && orderNumber <= 1999) {
        folderName = '01-001';
    } else if (orderNumber >= 2000 && orderNumber <= 2999) {
        folderName = '01-002';
    } else {
        folderName = '01-001';
    }
    const viewerApiUrl = `pdf-viewer-api.php?action=view&folder=${folderName}&file=${filename}`;
    console.log('📡 修正版PDF URL:', viewerApiUrl);
    return viewerApiUrl;
};

console.log('✅ PDF表示修正完了！見積書ボタンをクリックしてテストしてください。'); 