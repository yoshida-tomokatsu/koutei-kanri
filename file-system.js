// ========================================
// FILE-SYSTEM.JS - ファイル管理・データベース（DB専用版）
// ========================================

console.log('📁 FILE-SYSTEM.JS 読み込み開始 - データベース専用版');

// ========================================
// ファイル管理・表示機能
// ========================================

/**
 * ファイルビューアーでファイルを表示
 */
window.showFileInViewer = async function(fileIndex) {
    console.log('🔍 showFileInViewer呼び出し:', fileIndex);
    
    if (fileIndex < 0 || fileIndex >= window.currentFiles.length) {
        console.log('無効なfileIndex:', fileIndex, 'ファイル数:', window.currentFiles.length);
        return;
    }
    
    const file = window.currentFiles[fileIndex];
    const viewer = document.getElementById('fileViewer');
    
    if (!file) {
        console.error('❌ ファイルが見つかりません:', fileIndex);
        return;
    }
    
    if (!viewer) {
        console.error('❌ fileViewer要素が見つかりません');
        return;
    }
    
    // ファイルオブジェクトの構造を確認（軽量化）
    console.log('🔍 ファイル表示:', {
        index: fileIndex,
        filename: file.filename,
        originalName: file.originalName
    });
    
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
    
    // downloadUrlを関数スコープで宣言
    let downloadUrl = '';
    
    try {
        // 新しいPDF表示APIのURLを使用
        if (file.url) {
            // PDF表示APIから取得したファイルの場合
            downloadUrl = file.url;
        } else if (file.filename && window.currentOrderId) {
            // 従来のファイルシステムの場合
            downloadUrl = getFileDownloadUrl(window.currentOrderId, file.filename);
        } else {
            // フォールバック：PDFアクセスの複数の方法を試行
            const orderId = window.currentOrderId || '#1308';
            const fileName = file.filename || file.name || file.originalName || '01308.pdf';
            const orderNumber = orderId.replace('#', '');
            
            // まず、PDFビューアーAPIを試行
            downloadUrl = `pdf-viewer-api.php?action=view&folder=01-001&file=${fileName}`;
            
            // 直接パスも準備（フォールバック用）
            window.directPdfPath = `aforms-pdf/01-001/${fileName}`;
        }
        console.log('ダウンロードURL:', downloadUrl);
        
        // PDFファイルの判定を改善（完全に安全な方法）
        const filename = file.filename || file.name || '';
        const originalName = file.originalName || '';
        const url = file.url || '';
        
        // 安全なlowerCase変換とPDF判定
        const safeToLower = (str) => (str && typeof str === 'string') ? str.toLowerCase() : '';
        
        const isPDF = safeToLower(filename).includes('.pdf') || 
                     safeToLower(originalName).endsWith('.pdf') ||
                     safeToLower(originalName).includes('.pdf') ||
                     safeToLower(url).includes('.pdf');
        
        console.log('🔍 PDF判定:', {
            filename: filename,
            originalName: originalName,
            url: url,
            isPDF: isPDF
        });
        
        if (isPDF) {
            const fileName = file.originalName || file.filename || file.name || 'Unknown PDF';
            console.log('PDFファイルとして処理中:', fileName);
            console.log('📋 使用するPDF URL:', downloadUrl);
            await displayPDF(viewer, downloadUrl, file);
        } else if (safeToLower(originalName).match(/\.(jpg|jpeg|png|gif)$/i) || safeToLower(filename).match(/\.(jpg|jpeg|png|gif)$/i)) {
            console.log('画像ファイルとして処理中:', originalName || filename);
            
            const img = document.createElement('img');
            img.src = downloadUrl;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            img.style.borderRadius = '4px';
            
            // 画像読み込みエラーハンドリング
            img.onerror = function() {
                viewer.innerHTML = createErrorDisplay(file, downloadUrl, '画像の表示に失敗しました');
            };
            
            viewer.innerHTML = '';
            viewer.appendChild(img);
            
        } else {
            // その他のファイル形式
            viewer.innerHTML = createFileDisplay(file, downloadUrl);
        }
        
        // ナビゲーション要素の追加（ui-modals.jsの関数）
        if (typeof addNavigationElements === 'function') {
            addNavigationElements();
        }
        
    } catch (error) {
        console.error('ファイル表示エラー:', error);
        console.error('エラー時のファイル情報:', file);
        console.error('エラー時のdownloadUrl:', downloadUrl);
        viewer.innerHTML = createErrorDisplay(file, downloadUrl || '(URL未設定)', 'ファイルの表示に失敗しました', error.message);
        // ナビゲーション要素の追加（ui-modals.jsの関数）
        if (typeof addNavigationElements === 'function') {
            addNavigationElements();
        }
    }
};

/**
 * PDF表示の専用関数（複数の方法を試行）
 */
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
            
            let loadTimeout;
            let errorOccurred = false;
            
            iframe.onload = () => {
                console.log('iframe読み込み完了');
                clearTimeout(loadTimeout);
                
                // iframe内でエラーが発生していないかチェック
                try {
                    // HTTP 404や400エラーをチェック（可能な場合）
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && iframeDoc.title && iframeDoc.title.includes('404')) {
                        console.log('iframe内で404エラーを検出');
                        errorOccurred = true;
                        reject(new Error('PDF not found (404)'));
                        return;
                    }
                } catch (e) {
                    // クロスオリジンアクセス制限は正常
                    console.log('iframe内容チェック制限（正常）');
                }
                
                if (!errorOccurred) {
                    resolve(iframe);
                }
            };
            
            iframe.onerror = () => {
                console.log('iframe読み込みエラー');
                clearTimeout(loadTimeout);
                errorOccurred = true;
                reject(new Error('iframe読み込み失敗'));
            };
            
            loadTimeout = setTimeout(() => {
                if (!errorOccurred) {
                    console.log('iframe読み込みタイムアウト');
                    errorOccurred = true;
                    reject(new Error('iframe読み込みタイムアウト'));
                }
            }, 8000); // タイムアウトを8秒に延長
            
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
    
    // 順番に試行（フォールバックURL付き）
    try {
        console.log('PDF表示方法1 (iframe) を試行中...');
        await method1();
        console.log('PDF表示成功 (iframe)');
    } catch (error1) {
        console.log('方法1失敗:', error1.message);
        
        // フォールバック1: 直接パスを試行
        if (window.directPdfPath) {
            try {
                console.log('PDF表示方法2 (直接パス) を試行中:', window.directPdfPath);
                const directIframe = document.createElement('iframe');
                directIframe.src = window.directPdfPath + '#view=Fit&toolbar=1&navpanes=0&scrollbar=1&page=1&zoom=page-fit';
                directIframe.style.width = '100%';
                directIframe.style.height = '100%';
                directIframe.style.border = 'none';
                directIframe.style.borderRadius = '4px';
                
                viewer.innerHTML = '';
                viewer.appendChild(directIframe);
                
                directIframe.onload = () => {
                    console.log('✅ 直接パスiframe読み込み成功');
                };
                
                directIframe.onerror = () => {
                    console.log('❌ 直接パスiframe読み込み失敗');
                    // sync_pdf URLを試行
                    trySyncPdfUrl();
                };
                
                console.log('PDF表示成功 (直接パス)');
                return;
                
            } catch (error2) {
                console.log('直接パス失敗:', error2.message);
                trySyncPdfUrl();
                return;
            }
        }
        
        // フォールバック2: sync_pdf URLを試行
        function trySyncPdfUrl() {
            const orderId = file.orderId || '#1308'; // デフォルトでテスト対象の注文ID
            const fallbackUrl = `upload.php?action=sync_pdf&orderId=${encodeURIComponent(orderId)}`;
            console.log('フォールバックURL試行:', fallbackUrl);
            
            try {
                console.log('PDF表示方法3 (sync_pdf URL) を試行中...');
                const fallbackIframe = document.createElement('iframe');
                fallbackIframe.src = fallbackUrl + '#view=Fit&toolbar=1&navpanes=0&scrollbar=1&page=1&zoom=page-fit';
                fallbackIframe.style.width = '100%';
                fallbackIframe.style.height = '100%';
                fallbackIframe.style.border = 'none';
                fallbackIframe.style.borderRadius = '4px';
                
                viewer.innerHTML = '';
                viewer.appendChild(fallbackIframe);
                
                fallbackIframe.onload = () => {
                    console.log('✅ sync_pdf URLでのiframe読み込み成功');
                };
                
                fallbackIframe.onerror = () => {
                    console.log('❌ sync_pdf URLでのiframe読み込み失敗');
                    // 最後の手段: embed/object を試行
                    tryEmbedAndObject();
                };
                
                console.log('PDF表示成功 (sync_pdf URL)');
                
            } catch (error3) {
                console.log('sync_pdf URL失敗:', error3.message);
                tryEmbedAndObject();
            }
        }
        
        trySyncPdfUrl();
    }
    
    // embed/object を試行する関数
    async function tryEmbedAndObject() {
        try {
            console.log('PDF表示方法3 (embed) を試行中...');
            await method2();
            console.log('PDF表示成功 (embed)');
        } catch (error3) {
            console.log('方法3失敗:', error3.message);
            
            try {
                console.log('PDF表示方法4 (object) を試行中...');
                await method3();
                console.log('PDF表示成功 (object)');
            } catch (error4) {
                console.log('方法4失敗:', error4.message);
                console.log('すべての表示方法が失敗、フォールバックを表示');
                viewer.innerHTML = createPDFFallback(file, downloadUrl);
            }
        }
    }
}

/**
 * ファイル表示のヘルパー関数
 */
function createFileDisplay(file, downloadUrl) {
    return `
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

function createErrorDisplay(file, downloadUrl, message, errorDetail = '') {
    return `
        <div class="pdf-placeholder">
            <div class="pdf-icon">❌</div>
            <div class="pdf-message">${message}</div>
            <div class="pdf-info">${file.originalName}</div>
            ${errorDetail ? `<div class="pdf-info" style="color: #666; margin-top: 10px;">${errorDetail}</div>` : ''}
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                <a href="${downloadUrl}" target="_blank" style="color: #3498db; text-decoration: none; padding: 8px 16px; border: 1px solid #3498db; border-radius: 4px;">📥 ダウンロード</a>
                <button onclick="retryPDFDisplay(${currentFileIndex})" style="color: #2ecc71; background: none; border: 1px solid #2ecc71; padding: 8px 16px; border-radius: 4px; cursor: pointer;">🔄 再試行</button>
            </div>
        </div>
    `;
}

function createPDFFallback(file, downloadUrl) {
    return `
        <div class="pdf-placeholder">
            <div class="pdf-icon">📄</div>
            <div class="pdf-message">PDF: ${file.originalName}</div>
            <div class="pdf-info">ファイルサイズ: ${(file.size / 1024).toFixed(1)} KB</div>
            <div class="pdf-info" style="color: #666; margin-top: 10px;">
                ブラウザでPDFを表示できませんでした
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
                <a href="${downloadUrl}" target="_blank" style="color: #3498db; text-decoration: none; padding: 8px 16px; border: 1px solid #3498db; border-radius: 4px;">📥 ダウンロード</a>
                <button onclick="retryPDFDisplay(${currentFileIndex})" style="color: #2ecc71; background: none; border: 1px solid #2ecc71; padding: 8px 16px; border-radius: 4px; cursor: pointer;">🔄 再試行</button>
            </div>
        </div>
    `;
}

/**
 * PDF表示の再試行関数
 */
window.retryPDFDisplay = function(fileIndex) {
    console.log('PDF表示を再試行:', fileIndex);
    window.showFileInViewer(fileIndex);
};

// ========================================
// ドラッグ&ドロップ機能
// ========================================

function handleDragStart(e) {
    window.draggedElement = this;
    window.draggedIndex = parseInt(this.getAttribute('data-index'));
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', window.draggedIndex);
    
    console.log('ドラッグ開始:', window.draggedIndex, this.querySelector('.file-name').textContent);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (this === window.draggedElement) return;
    
    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const mouseY = e.clientY;
    
    const insertAfter = mouseY > midY;
    
    clearDropIndicator();
    createDropIndicator(this, insertAfter);
}

function handleDragEnter(e) {
    e.preventDefault();
}

function handleDragLeave(e) {
    if (!this.contains(e.relatedTarget)) {
        clearDropIndicator();
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    clearDropIndicator();
    
    if (this === window.draggedElement) return;
    
    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const mouseY = e.clientY;
    const insertAfter = mouseY > midY;
    
    const dropIndex = parseInt(this.getAttribute('data-index'));
    let targetIndex = insertAfter ? dropIndex + 1 : dropIndex;
    
    if (window.draggedIndex < targetIndex) {
        targetIndex--;
    }
    
    console.log('ドロップ:', window.draggedIndex, '→', targetIndex);
    
    if (window.draggedIndex !== targetIndex) {
        reorderFiles(window.draggedIndex, targetIndex);
    }
}

function handleDragEnd(e) {
    console.log('ドラッグ終了');
    
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('drag-over', 'dragging');
    });
    
    clearDropIndicator();
    window.draggedElement = null;
    window.draggedIndex = null;
}

function createDropIndicator(targetElement, insertAfter) {
    window.dropIndicator = document.createElement('div');
    window.dropIndicator.className = 'drop-indicator';
    window.dropIndicator.style.cssText = `
        height: 3px;
        background-color: #3498db;
        margin: 2px 0;
        border-radius: 2px;
        box-shadow: 0 0 5px rgba(52, 152, 219, 0.5);
        animation: dropPulse 1s infinite;
    `;
    
    if (insertAfter) {
        targetElement.parentNode.insertBefore(window.dropIndicator, targetElement.nextSibling);
    } else {
        targetElement.parentNode.insertBefore(window.dropIndicator, targetElement);
    }
}

function clearDropIndicator() {
    if (window.dropIndicator && window.dropIndicator.parentNode) {
        window.dropIndicator.parentNode.removeChild(window.dropIndicator);
        window.dropIndicator = null;
    }
}

async function reorderFiles(fromIndex, toIndex) {
    console.log('ファイル並べ替え開始:', fromIndex, '→', toIndex);
    
    if (fromIndex === toIndex) {
        console.log('同じ位置なので並び替えなし');
        return;
    }
    
    const currentFiles = window.currentFiles;
    if (!currentFiles) {
        console.error('currentFilesが見つかりません');
        return;
    }
    
    console.log('並び替え前:', currentFiles.map((f, i) => `[${i}] ${f.originalName}`));
    
    const movedFile = currentFiles[fromIndex];
    const removedFiles = currentFiles.splice(fromIndex, 1);
    currentFiles.splice(toIndex, 0, removedFiles[0]);
    
    console.log('並び替え後:', currentFiles.map((f, i) => `[${i}] ${f.originalName}`));
    
    const currentOrderId = window.currentOrderId;
    const currentFileType = window.currentFileType;
    
    if (window.serverFiles && window.serverFiles[currentOrderId] && window.serverFiles[currentOrderId][currentFileType]) {
        const fileTypeArray = window.serverFiles[currentOrderId][currentFileType];
        const serverMovedFile = fileTypeArray.splice(fromIndex, 1)[0];
        fileTypeArray.splice(toIndex, 0, serverMovedFile);
    }
    
    await updateFileListAfterReorder();
    
    setTimeout(() => {
        if (window.showFileInViewer) {
            window.showFileInViewer(toIndex);
        }
    }, 100);
    
    await saveFileOrderToServer();
    
    console.log('ファイル並べ替え完了');
}

async function updateFileListAfterReorder() {
    const fileListContent = document.getElementById('fileListContent');
    const currentFiles = window.currentFiles;
    
    if (!currentFiles) return;
    
    console.log('UI更新開始:', currentFiles.length, '件');
    
    const existingItems = fileListContent.querySelectorAll('.file-item');
    existingItems.forEach(item => item.remove());
    
    currentFiles.forEach((file, index) => {
        const fileItem = window.createFileItem(file, index);
        fileListContent.appendChild(fileItem);
    });
    
    console.log('ファイルアイテム再作成完了:', currentFiles.length, '件');
}

async function saveFileOrderToServer() {
    console.log('並び順をサーバーに保存中...');
    
    try {
        const currentFiles = window.currentFiles;
        const currentOrderId = window.currentOrderId;
        const currentFileType = window.currentFileType;
        
        if (!currentFiles || !currentOrderId || !currentFileType) {
            console.error('必要な変数が見つかりません');
            return;
        }
        
        const fileOrder = currentFiles.map(file => file.filename);
        await saveFileOrder(currentOrderId, currentFileType, fileOrder);
        
        console.log('並び順保存成功');
    } catch (error) {
        console.error('並び順保存エラー:', error);
    }
}

/**
 * ドラッグ&ドロップイベントを追加
 */
function addDragDropEvents() {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

// ========================================
// ファイル操作（削除など）
// ========================================

/**
 * 個別ファイル削除
 */
function deleteFile(index) {
    if (index < 0 || index >= window.currentFiles.length) return;
    
    const file = window.currentFiles[index];
    const message = `「${file.originalName || file.filename}」を削除しますか？`;
    
    showDeleteConfirm(message, async () => {
        try {
            await deleteFileFromServer(window.currentOrderId, file.filename);
            
            // ファイル一覧から削除
            window.currentFiles.splice(index, 1);
            
            // UI更新
            if (window.buildFileList) {
                window.buildFileList();
            }
            
            // 表示ファイルの調整
            if (window.currentFiles.length === 0) {
                if (window.showEmptyState) {
                    window.showEmptyState();
                }
            } else {
                if (currentFileIndex >= window.currentFiles.length) {
                    currentFileIndex = window.currentFiles.length - 1;
                }
                window.showFileInViewer(currentFileIndex);
            }
            
            // サーバーファイル情報を更新
            const updatedFiles = await loadFilesFromServer(window.currentOrderId);
            if (window.serverFiles) {
                window.serverFiles[window.currentOrderId] = updatedFiles;
            }
            
            // メインテーブルの表示も更新
            if (window.updateFileDisplay) {
                window.updateFileDisplay(window.currentOrderId, window.currentFileType);
            }
            
            console.log('✅ ファイル削除成功:', file.filename);
            
        } catch (error) {
            console.error('❌ ファイル削除エラー:', error);
            console.error('❌ ファイルの削除に失敗しました:', error.message);
        }
    });
}

/**
 * 全選択
 */
function selectAllFiles() {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    
    updateDeleteButton();
}

/**
 * 選択されたファイルを削除
 */
function deleteSelectedFiles() {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    const selectedIndices = [];
    
    checkboxes.forEach((cb, index) => {
        if (cb.checked) {
            selectedIndices.push(index);
        }
    });
    
    if (selectedIndices.length === 0) return;
    
    const message = `選択された${selectedIndices.length}件のファイルを削除しますか？`;
    
    showDeleteConfirm(message, async () => {
        try {
            // 降順でソートして削除（インデックスがずれないように）
            selectedIndices.sort((a, b) => b - a);
            
            for (const index of selectedIndices) {
                const file = window.currentFiles[index];
                await deleteFileFromServer(window.currentOrderId, file.filename);
                window.currentFiles.splice(index, 1);
            }
            
            // UI更新
            if (window.buildFileList) {
                window.buildFileList();
            }
            
            if (window.currentFiles.length === 0) {
                if (window.showEmptyState) {
                    window.showEmptyState();
                }
            } else {
                currentFileIndex = Math.min(currentFileIndex, window.currentFiles.length - 1);
                window.showFileInViewer(currentFileIndex);
            }
            
            // サーバーファイル情報を更新
            const updatedFiles = await loadFilesFromServer(window.currentOrderId);
            if (window.serverFiles) {
                window.serverFiles[window.currentOrderId] = updatedFiles;
            }
            
            // メインテーブルの表示も更新
            if (window.updateFileDisplay) {
                window.updateFileDisplay(window.currentOrderId, window.currentFileType);
            }
            
            console.log('✅ 選択ファイル削除成功:', selectedIndices.length, '件');
            
        } catch (error) {
            console.error('❌ 選択ファイル削除エラー:', error);
            console.error('❌ ファイルの削除に失敗しました:', error.message);
        }
    });
}

/**
 * 削除ボタンの状態を更新
 */
function updateDeleteButton() {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    
    if (!deleteBtn) return;
    
    const hasSelected = Array.from(checkboxes).some(cb => cb.checked);
    deleteBtn.disabled = !hasSelected;
}

// ========================================
// データベース機能（改良版）
// ========================================

const DATABASE_CONFIG = {
    API_URL: './editable-orders-api.php',           // wp_wqorders_editableのみ使用
    FALLBACK_API_URL: './editable-orders-api.php',  // フォールバックも同じAPI
    KIRYU_API_URL: './editable-orders-api.php',     // 最終候補も同じAPI
    DEFAULT_PAGE_SIZE: 1000,  // 20 → 1000 に変更（全データ読み込み）
    MAX_PAGE_SIZE: 1000,      // 100 → 1000 に変更
    LOAD_TIMEOUT: 15000,
    RETRY_COUNT: 3
};

/**
 * タイムアウト付きfetch（改良版）
 */
async function fetchWithTimeout(url, options = {}, timeout = DATABASE_CONFIG.LOAD_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('リクエストがタイムアウトしました');
        }
        throw error;
    }
}

/**
 * 複数のAPIエンドポイントを試行
 */
async function tryMultipleEndpoints(action, params = {}) {
    const endpoints = [
        DATABASE_CONFIG.API_URL,
        DATABASE_CONFIG.FALLBACK_API_URL,
        DATABASE_CONFIG.KIRYU_API_URL
    ];
    
    let lastError = null;
    
    for (const endpoint of endpoints) {
        try {
            console.log(`🔄 ${endpoint} を試行中...`);
            
            const queryParams = new URLSearchParams({
                action,
                ...params,
                t: Date.now()
            });
            
            const response = await fetchWithTimeout(`${endpoint}?${queryParams}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ ${endpoint} で成功`);
                return { result, endpoint };
            } else {
                throw new Error(result.message || 'APIエラー');
            }
            
        } catch (error) {
            console.warn(`❌ ${endpoint} 失敗:`, error.message);
            lastError = error;
            continue;
        }
    }
    
    throw new Error(`すべてのAPIエンドポイントで失敗しました。最後のエラー: ${lastError?.message}`);
}

/**
 * データベース接続テスト（改良版）
 */
async function testDatabaseAdvanced() {
    console.log('🔌 高度なデータベース接続テスト開始...');
    
    try {
        const { result, endpoint } = await tryMultipleEndpoints('test_connection');
        
        console.log('✅ データベース接続テスト成功:', {
            endpoint,
            records: result.table_info?.total_records || 0
        });
        
        return {
            success: true,
            endpoint,
            data: result
        };
        
    } catch (error) {
        console.error('❌ データベース接続テスト失敗:', error);
        return {
            success: false,
            error: error.message,
            endpoint: null
        };
    }
}

/**
 * データベースからデータを取得（改良版）
 */
async function loadOrdersFromDatabaseAdvanced(page = 1, pageSize = DATABASE_CONFIG.DEFAULT_PAGE_SIZE) {
    console.log('📡 データベースから高度なデータ取得開始...', { page, pageSize });
    
    try {
        const { result, endpoint } = await tryMultipleEndpoints('get_orders', {
            page: page.toString(),
            limit: Math.min(pageSize, DATABASE_CONFIG.MAX_PAGE_SIZE).toString()
        });
        
        if (result.orders && result.orders.length > 0) {
            console.log('✅ データベースデータ取得成功:', {
                endpoint,
                count: result.orders.length,
                page,
                hasMore: result.pagination?.has_more
            });
            
            return {
                success: true,
                orders: result.orders,
                pagination: result.pagination || {},
                endpoint
            };
        } else {
            console.warn('⚠️ データベースにデータがありません');
            return {
                success: true,
                orders: [],
                pagination: {},
                endpoint
            };
        }
        
    } catch (error) {
        console.error('❌ データベースデータ取得エラー:', error);
        return {
            success: false,
            error: error.message,
            orders: [],
            endpoint: null
        };
    }
}

/**
 * データベース状態を取得
 */
async function getDatabaseStatus() {
    console.log('📊 データベース状態取得中...');
    
    try {
        const { result, endpoint } = await tryMultipleEndpoints('get_orders_count');
        
        return {
            success: true,
            totalCount: result.total_count || 0,
            endpoint,
            timestamp: new Date()
        };
        
    } catch (error) {
        console.error('❌ データベース状態取得エラー:', error);
        return {
            success: false,
            error: error.message,
            totalCount: 0,
            endpoint: null
        };
    }
}

/**
 * キャッシュ機能付きデータベース読み込み
 */
let databaseCache = {
    data: null,
    timestamp: null,
    ttl: 5 * 60 * 1000, // 5分
    
    isValid() {
        return this.data && this.timestamp && 
               (Date.now() - this.timestamp) < this.ttl;
    },
    
    set(data) {
        this.data = data;
        this.timestamp = Date.now();
    },
    
    get() {
        return this.isValid() ? this.data : null;
    },
    
    clear() {
        this.data = null;
        this.timestamp = null;
    }
};

/**
 * キャッシュ機能付きデータ取得
 */
async function loadOrdersWithCache(useCache = true) {
    console.log('💾 キャッシュ機能付きデータ取得開始...', { useCache });
    
    // キャッシュチェック
    if (useCache) {
        const cachedData = databaseCache.get();
        if (cachedData) {
            console.log('✅ キャッシュからデータを返却:', cachedData.orders.length, '件');
            return cachedData;
        }
    }
    
    // データベースから取得
    const result = await loadOrdersFromDatabaseAdvanced();
    
    if (result.success && result.orders.length > 0) {
        // キャッシュに保存
        databaseCache.set(result);
        console.log('💾 データをキャッシュに保存:', result.orders.length, '件');
    }
    
    return result;
}

// ========================================
// グローバル公開
// ========================================

// ファイル表示
window.showFileInViewer = window.showFileInViewer;
window.retryPDFDisplay = window.retryPDFDisplay;

// ドラッグ&ドロップ
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragEnter = handleDragEnter;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.addDragDropEvents = addDragDropEvents;

// ファイル操作
window.deleteFile = deleteFile;
window.selectAllFiles = selectAllFiles;
window.deleteSelectedFiles = deleteSelectedFiles;
window.updateDeleteButton = updateDeleteButton;

// データベース（改良版）
window.testDatabaseAdvanced = testDatabaseAdvanced;
window.loadOrdersFromDatabaseAdvanced = loadOrdersFromDatabaseAdvanced;
window.loadOrdersWithCache = loadOrdersWithCache;
window.getDatabaseStatus = getDatabaseStatus;
window.databaseCache = databaseCache;

/**
 * 見積書ファイル表示（改良版）
 */
function showQuoteFiles(orderId) {
    console.log('📄 見積書表示開始:', orderId);
    
    // PDFモーダルを開く前にタイトルを設定
    const pdfTitle = document.getElementById('pdfTitle');
    if (pdfTitle) {
        pdfTitle.innerHTML = `📄 見積書ファイル - ${orderId}`;
    }
    
    // 見積書専用のモーダル表示
    showFileModal(orderId, 'quotes');
    
    // 見積書ファイルの自動選択（最初のファイル）
    setTimeout(() => {
        const firstQuoteFile = document.querySelector('#fileListContent .file-item[data-file-type="quotes"]');
        if (firstQuoteFile) {
            console.log('📄 最初の見積書を自動選択');
            firstQuoteFile.click();
        } else {
            // 見積書がない場合の表示
            const fileViewer = document.getElementById('fileViewer');
            if (fileViewer) {
                fileViewer.innerHTML = `
                    <div class="pdf-placeholder">
                        <div style="font-size: 48px; color: #e67e22; margin-bottom: 15px;">📄</div>
                        <div class="pdf-message">見積書ファイルがありません</div>
                        <div class="pdf-info">注文 ${orderId} の見積書をアップロードしてください</div>
                        <button onclick="closeModal(); showUploadModal('${orderId}')" style="
                            margin-top: 15px;
                            background-color: #e67e22;
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                        ">📎 見積書をアップロード</button>
                    </div>
                `;
            }
        }
    }, 800);
}

/**
 * 見積書ダウンロード機能
 */
function downloadQuoteFile(orderId, filename) {
    console.log('📥 見積書ダウンロード:', orderId, filename);
    
    const downloadUrl = `uploads/${orderId}/${filename}`;
    
    // ダウンロードリンクを作成
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('✅ 見積書ダウンロード完了:', filename);
}

/**
 * 見積書の一括ダウンロード
 */
function downloadAllQuotes(orderId) {
    console.log('📦 見積書一括ダウンロード:', orderId);
    
    // APIから見積書ファイル一覧を取得
    fetch(`core.js?action=list_files&order_id=${orderId}&file_type=quotes`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.files) {
                data.files.forEach((filename, index) => {
                    setTimeout(() => {
                        downloadQuoteFile(orderId, filename);
                    }, index * 500); // 0.5秒間隔でダウンロード
                });
                
                console.log(`✅ ${data.files.length}件の見積書ダウンロード開始`);
            }
        })
        .catch(error => {
            console.error('❌ 見積書一括ダウンロードエラー:', error);
        });
}



console.log('✅ FILE-SYSTEM.JS 読み込み完了 - データベース専用版');