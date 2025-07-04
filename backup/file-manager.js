// PDF表示問題を修正したfile-manager.js（修正版）

window.showFileInViewer = async function(fileIndex) {
    console.log('showFileInViewer呼び出し:', fileIndex);
    
    if (fileIndex < 0 || fileIndex >= window.currentFiles.length) {
        console.log('無効なfileIndex:', fileIndex, 'ファイル数:', window.currentFiles.length);
        return;
    }
    
    const file = window.currentFiles[fileIndex];
    const viewer = document.getElementById('fileViewer');
    
    // アクティブ状態を更新
    document.querySelectorAll('.file-item').forEach((item, index) => {
        if (index === fileIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    currentFileIndex = fileIndex;
    updateNavigationState();
    
    viewer.innerHTML = '<div style="text-align: center; padding: 20px;">ファイルを読み込み中...</div>';
    
    try {
        const downloadUrl = getFileDownloadUrl(window.currentOrderId, file.filename);
        console.log('ダウンロードURL:', downloadUrl);
        
        // PDFファイルの判定を改善
        const isPDF = file.filename.toLowerCase().includes('.pdf') || 
                     file.originalName?.toLowerCase().endsWith('.pdf') ||
                     file.originalName?.toLowerCase().includes('.pdf');
        
        if (isPDF) {
            console.log('PDFファイルとして処理中:', file.originalName);
            
            // PDFの表示方法を複数パターンで試行
            await displayPDF(viewer, downloadUrl, file);
            
        } else if (file.originalName?.match(/\.(jpg|jpeg|png|gif)$/i)) {
            console.log('画像ファイルとして処理中:', file.originalName);
            
            const img = document.createElement('img');
            img.src = downloadUrl;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            img.style.borderRadius = '4px';
            
            // 画像読み込みエラーハンドリング
            img.onerror = function() {
                viewer.innerHTML = `
                    <div class="pdf-placeholder">
                        <div class="pdf-icon">❌</div>
                        <div class="pdf-message">画像の表示に失敗しました</div>
                        <div class="pdf-info">${file.originalName}</div>
                        <div style="margin-top: 20px;">
                            <a href="${downloadUrl}" target="_blank" style="color: #3498db; text-decoration: none; padding: 8px 16px; border: 1px solid #3498db; border-radius: 4px;">📥 ダウンロード</a>
                        </div>
                    </div>
                `;
            };
            
            viewer.innerHTML = '';
            viewer.appendChild(img);
            
        } else {
            // その他のファイル形式
            viewer.innerHTML = `
                <div class="pdf-placeholder">
                    <div class="pdf-icon">📄</div>
                    <div class="pdf-message">${file.originalName}</div>
                    <div class="pdf-info">ファイルサイズ: ${(file.size / 1024).toFixed(1)} KB</div>
                    <div style="margin-top: 20px;">
                        <a href="${downloadUrl}" target="_blank" style="color: #3498db; text-decoration: none; padding: 8px 16px; border: 1px solid #3498db; border-radius: 4px;">📥 ダウンロード</a>
                    </div>
                </div>
            `;
        }
        
        addNavigationElements();
        
    } catch (error) {
        console.error('ファイル表示エラー:', error);
        viewer.innerHTML = `
            <div class="pdf-placeholder">
                <div class="pdf-icon">❌</div>
                <div class="pdf-message">ファイルの表示に失敗しました</div>
                <div class="pdf-info">${error.message}</div>
                <div style="margin-top: 20px;">
                    <a href="${downloadUrl}" target="_blank" style="color: #3498db; text-decoration: none; padding: 8px 16px; border: 1px solid #3498db; border-radius: 4px;">📥 ダウンロード</a>
                </div>
            </div>
        `;
        addNavigationElements();
    }
};

// PDF表示の専用関数（複数の方法を試行）
async function displayPDF(viewer, downloadUrl, file) {
    console.log('PDF表示開始:', downloadUrl);
    
    // 方法1: iframe with embed
    const method1 = () => {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.src = downloadUrl + '#view=Fit&toolbar=1&navpanes=0&scrollbar=1&page=1&zoom=page-fit';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '4px';
            
            iframe.onload = () => {
                console.log('iframe読み込み完了');
                resolve(iframe);
            };
            
            iframe.onerror = () => {
                console.log('iframe読み込みエラー');
                reject(new Error('iframe読み込み失敗'));
            };
            
            // タイムアウト設定
            setTimeout(() => {
                reject(new Error('iframe読み込みタイムアウト'));
            }, 5000);
            
            viewer.innerHTML = '';
            viewer.appendChild(iframe);
        });
    };
    
    // 方法2: embed タグ
    const method2 = () => {
        return new Promise((resolve, reject) => {
            const embed = document.createElement('embed');
            embed.src = downloadUrl;
            embed.type = 'application/pdf';
            embed.style.width = '100%';
            embed.style.height = '100%';
            embed.style.borderRadius = '4px';
            
            embed.onload = () => {
                console.log('embed読み込み完了');
                resolve(embed);
            };
            
            embed.onerror = () => {
                console.log('embed読み込みエラー');
                reject(new Error('embed読み込み失敗'));
            };
            
            setTimeout(() => {
                reject(new Error('embed読み込みタイムアウト'));
            }, 3000);
            
            viewer.innerHTML = '';
            viewer.appendChild(embed);
        });
    };
    
    // 方法3: object タグ
    const method3 = () => {
        return new Promise((resolve, reject) => {
            const object = document.createElement('object');
            object.data = downloadUrl;
            object.type = 'application/pdf';
            object.style.width = '100%';
            object.style.height = '100%';
            object.style.borderRadius = '4px';
            
            object.onload = () => {
                console.log('object読み込み完了');
                resolve(object);
            };
            
            object.onerror = () => {
                console.log('object読み込みエラー');
                reject(new Error('object読み込み失敗'));
            };
            
            setTimeout(() => {
                reject(new Error('object読み込みタイムアウト'));
            }, 3000);
            
            viewer.innerHTML = '';
            viewer.appendChild(object);
        });
    };
    
    // 方法4: フォールバック（ダウンロードリンク）
    const fallback = () => {
        viewer.innerHTML = `
            <div class="pdf-placeholder">
                <div class="pdf-icon">📄</div>
                <div class="pdf-message">PDF: ${file.originalName}</div>
                <div class="pdf-info">ファイルサイズ: ${(file.size / 1024).toFixed(1)} KB</div>
                <div class="pdf-info" style="color: #666; margin-top: 10px;">
                    ブラウザでPDFを表示できませんでした
                </div>
                <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                    <a href="${downloadUrl}" target="_blank" style="color: #3498db; text-decoration: none; padding: 8px 16px; border: 1px solid #3498db; border-radius: 4px;">
                        📥 ダウンロード
                    </a>
                    <button onclick="retryPDFDisplay(${currentFileIndex})" style="color: #2ecc71; background: none; border: 1px solid #2ecc71; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        🔄 再試行
                    </button>
                </div>
            </div>
        `;
    };
    
    // 順番に試行
    try {
        console.log('PDF表示方法1 (iframe) を試行中...');
        await method1();
        console.log('PDF表示成功 (iframe)');
    } catch (error1) {
        console.log('方法1失敗:', error1.message);
        
        try {
            console.log('PDF表示方法2 (embed) を試行中...');
            await method2();
            console.log('PDF表示成功 (embed)');
        } catch (error2) {
            console.log('方法2失敗:', error2.message);
            
            try {
                console.log('PDF表示方法3 (object) を試行中...');
                await method3();
                console.log('PDF表示成功 (object)');
            } catch (error3) {
                console.log('方法3失敗:', error3.message);
                console.log('すべての表示方法が失敗、フォールバックを表示');
                fallback();
            }
        }
    }
}

// PDF表示の再試行関数
window.retryPDFDisplay = function(fileIndex) {
    console.log('PDF表示を再試行:', fileIndex);
    window.showFileInViewer(fileIndex);
};

// URL生成関数の改善版
function getFileDownloadUrl(orderId, filename) {
    const baseUrl = CONFIG.API_BASE_URL;
    const params = new URLSearchParams({
        action: 'download',
        orderId: orderId,
        filename: filename,
        t: Date.now() // キャッシュバスター
    });
    
    const url = `${baseUrl}?${params.toString()}`;
    console.log('生成されたURL:', url);
    return url;
}

// PDF表示テスト機能
window.testPDFDisplay = async function(orderId, filename) {
    try {
        const baseUrl = CONFIG.API_BASE_URL;
        const testUrl = `${baseUrl}?action=pdf_test&orderId=${encodeURIComponent(orderId)}&filename=${encodeURIComponent(filename)}`;
        
        const response = await fetch(testUrl);
        const result = await response.json();
        
        console.log('PDF表示テスト結果:', result);
        
        if (result.success) {
            console.log('✅ PDF表示テスト成功');
            console.log('ファイル存在:', result.file_exists);
            console.log('ファイルサイズ:', result.file_size);
            console.log('MIMEタイプ:', result.mime_type);
            console.log('ダウンロードURL:', result.download_url);
        } else {
            console.error('❌ PDF表示テストエラー:', result.message);
        }
        
        return result;
    } catch (error) {
        console.error('❌ PDF表示テスト失敗:', error);
        return { success: false, message: error.message };
    }
};

console.log('PDF表示問題修正版 file-manager.js 読み込み完了');