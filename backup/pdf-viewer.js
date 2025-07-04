// PDFビューアー機能（見積・画像ボタン対応）

// グローバル変数
let currentOrderId = '';
let currentFileType = '';
let currentFiles = [];
let currentFileIndex = 0;
let deleteTarget = null;

// グローバルに公開
window.currentOrderId = currentOrderId;
window.currentFileType = currentFileType;
window.currentFiles = currentFiles;

/**
 * PDFビューアーモーダルを表示（見積・画像ボタンから呼び出される）
 */
function showPDF(type, orderId) {
    console.log('📄 PDFビューアー表示:', type, orderId);
    
    currentOrderId = orderId;
    currentFileType = type === '見積書' ? 'quotes' : 'images';
    
    // グローバルに設定
    window.currentOrderId = currentOrderId;
    window.currentFileType = currentFileType;
    
    // モーダルのタイトルを更新
    const modalTitle = document.getElementById('pdfTitle');
    modalTitle.textContent = `${type} - 注文ID: ${orderId}`;
    
    // モーダルを表示
    const modal = document.getElementById('pdfModal');
    modal.style.display = 'flex';
    
    // ファイル一覧を読み込み
    loadFileList();
}

/**
 * PDFビューアーモーダルを閉じる
 */
function closePDFModal() {
    console.log('📄 PDFビューアー閉じる');
    
    const modal = document.getElementById('pdfModal');
    modal.style.display = 'none';
    
    // 状態をリセット
    currentOrderId = '';
    currentFileType = '';
    currentFiles = [];
    currentFileIndex = 0;
    
    // グローバル変数もリセット
    window.currentOrderId = '';
    window.currentFileType = '';
    window.currentFiles = [];
}

/**
 * ファイル一覧を読み込み
 */
async function loadFileList() {
    console.log('📂 ファイル一覧読み込み:', currentOrderId, currentFileType);
    
    const fileListContent = document.getElementById('fileListContent');
    const fileCount = document.getElementById('fileCount');
    const fileViewer = document.getElementById('fileViewer');
    
    try {
        // ローディング表示
        fileListContent.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">読み込み中...</div>';
        fileViewer.innerHTML = `
            <div class="pdf-placeholder">
                <div class="pdf-icon">📄</div>
                <div class="pdf-message">ファイルを読み込み中...</div>
            </div>
        `;
        
        // サーバーからファイル情報を取得
        const allFiles = await loadFilesFromServer(currentOrderId);
        currentFiles = allFiles[currentFileType] || [];
        
        // グローバルに設定
        window.currentFiles = currentFiles;
        
        console.log('📂 読み込まれたファイル:', currentFiles.length, '件');
        
        // ファイル数を更新
        fileCount.textContent = `${currentFiles.length}件`;
        if (currentFiles.length > 1) {
            fileCount.classList.add('multiple');
        } else {
            fileCount.classList.remove('multiple');
        }
        
        // ファイル一覧を構築
        buildFileList();
        
        // 最初のファイルを表示
        if (currentFiles.length > 0) {
            showFileInViewer(0);
        } else {
            showEmptyState();
        }
        
    } catch (error) {
        console.error('❌ ファイル一覧読み込みエラー:', error);
        fileListContent.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">読み込みに失敗しました</div>';
        fileViewer.innerHTML = `
            <div class="pdf-placeholder">
                <div class="pdf-icon">❌</div>
                <div class="pdf-message">ファイルの読み込みに失敗しました</div>
                <div class="pdf-info">${error.message}</div>
            </div>
        `;
    }
}

/**
 * ファイル一覧UIを構築
 */
function buildFileList() {
    const fileListContent = document.getElementById('fileListContent');
    
    if (currentFiles.length === 0) {
        fileListContent.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #666;">
                <div style="font-size: 36px; margin-bottom: 15px;">📄</div>
                <div style="font-size: 14px; margin-bottom: 10px;">ファイルがありません</div>
                <div style="font-size: 12px; color: #999;">アップロードボタンからファイルを追加してください</div>
            </div>
        `;
        return;
    }
    
    // コントロールボタン
    const controlsHTML = `
        <div class="file-list-controls">
            <button class="select-all-btn" onclick="selectAllFiles()">全選択</button>
            <button class="delete-selected-btn" id="deleteSelectedBtn" onclick="deleteSelectedFiles()" disabled>削除</button>
        </div>
    `;
    
    // ファイルアイテム
    let filesHTML = '';
    currentFiles.forEach((file, index) => {
        const fileItem = createFileItem(file, index);
        filesHTML += fileItem.outerHTML;
    });
    
    fileListContent.innerHTML = controlsHTML + filesHTML;
    
    // ドラッグ&ドロップイベントを追加
    addDragDropEvents();
}

/**
 * ファイルアイテムを作成
 */
function createFileItem(file, index) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.setAttribute('data-index', index);
    item.draggable = true;
    
    const fileSize = file.size ? (file.size / 1024).toFixed(1) + ' KB' : '不明';
    const uploadDate = file.uploadDate || '不明';
    
    item.innerHTML = `
        <input type="checkbox" class="file-checkbox" onchange="updateDeleteButton()">
        <div class="file-content" onclick="showFileInViewer(${index})">
            <div class="file-name">${file.originalName || file.filename}</div>
            <div class="file-info-text">${fileSize} | ${uploadDate}</div>
        </div>
        <button class="file-delete" onclick="deleteFile(${index})" title="削除">&times;</button>
        <div class="drag-handle" title="ドラッグして並び替え">⋮⋮</div>
    `;
    
    return item;
}

// グローバルに公開
window.createFileItem = createFileItem;

/**
 * 空の状態を表示
 */
function showEmptyState() {
    const fileViewer = document.getElementById('fileViewer');
    fileViewer.innerHTML = `
        <div class="pdf-placeholder">
            <div class="pdf-icon">📄</div>
            <div class="pdf-message">ファイルがありません</div>
            <div class="pdf-info">アップロードボタンからファイルを追加してください</div>
        </div>
    `;
    
    // ナビゲーション要素を非表示
    const navigation = document.getElementById('fileNavigation');
    const infoBadge = document.getElementById('fileInfoBadge');
    if (navigation) navigation.classList.remove('show');
    if (infoBadge) infoBadge.classList.remove('show');
}

/**
 * ファイルナビゲーション
 */
function navigateFile(direction) {
    if (currentFiles.length === 0) return;
    
    const newIndex = currentFileIndex + direction;
    if (newIndex >= 0 && newIndex < currentFiles.length) {
        showFileInViewer(newIndex);
    }
}

/**
 * ナビゲーション状態を更新
 */
function updateNavigationState() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const navigation = document.getElementById('fileNavigation');
    const infoBadge = document.getElementById('fileInfoBadge');
    
    if (currentFiles.length <= 1) {
        if (navigation) navigation.classList.remove('show');
        if (infoBadge) infoBadge.classList.remove('show');
        return;
    }
    
    if (navigation) navigation.classList.add('show');
    if (infoBadge) {
        infoBadge.classList.add('show');
        infoBadge.textContent = `${currentFileIndex + 1} / ${currentFiles.length}`;
    }
    
    if (prevBtn) prevBtn.disabled = currentFileIndex === 0;
    if (nextBtn) nextBtn.disabled = currentFileIndex === currentFiles.length - 1;
}

/**
 * ナビゲーション要素をビューアーに追加
 */
function addNavigationElements() {
    updateNavigationState();
}

/**
 * ドラッグ&ドロップイベントを追加
 */
function addDragDropEvents() {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.addEventListener('dragstart', window.handleDragStart);
        item.addEventListener('dragover', window.handleDragOver);
        item.addEventListener('dragenter', window.handleDragEnter);
        item.addEventListener('dragleave', window.handleDragLeave);
        item.addEventListener('drop', window.handleDrop);
        item.addEventListener('dragend', window.handleDragEnd);
    });
}

/**
 * 個別ファイル削除
 */
function deleteFile(index) {
    if (index < 0 || index >= currentFiles.length) return;
    
    const file = currentFiles[index];
    const message = `「${file.originalName || file.filename}」を削除しますか？`;
    
    showDeleteConfirm(message, async () => {
        try {
            await deleteFileFromServer(currentOrderId, file.filename);
            
            // ファイル一覧から削除
            currentFiles.splice(index, 1);
            window.currentFiles = currentFiles;
            
            // UI更新
            buildFileList();
            
            // 表示ファイルの調整
            if (currentFiles.length === 0) {
                showEmptyState();
            } else {
                if (currentFileIndex >= currentFiles.length) {
                    currentFileIndex = currentFiles.length - 1;
                }
                showFileInViewer(currentFileIndex);
            }
            
            // サーバーファイル情報を更新
            const updatedFiles = await loadFilesFromServer(currentOrderId);
            if (window.serverFiles) {
                window.serverFiles[currentOrderId] = updatedFiles;
            }
            
            // メインテーブルの表示も更新
            if (window.updateFileDisplay) {
                window.updateFileDisplay(currentOrderId, currentFileType);
            }
            
            console.log('✅ ファイル削除成功:', file.filename);
            
        } catch (error) {
            console.error('❌ ファイル削除エラー:', error);
            alert('ファイルの削除に失敗しました: ' + error.message);
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
                const file = currentFiles[index];
                await deleteFileFromServer(currentOrderId, file.filename);
                currentFiles.splice(index, 1);
            }
            
            window.currentFiles = currentFiles;
            
            // UI更新
            buildFileList();
            
            if (currentFiles.length === 0) {
                showEmptyState();
            } else {
                currentFileIndex = Math.min(currentFileIndex, currentFiles.length - 1);
                showFileInViewer(currentFileIndex);
            }
            
            // サーバーファイル情報を更新
            const updatedFiles = await loadFilesFromServer(currentOrderId);
            if (window.serverFiles) {
                window.serverFiles[currentOrderId] = updatedFiles;
            }
            
            // メインテーブルの表示も更新
            if (window.updateFileDisplay) {
                window.updateFileDisplay(currentOrderId, currentFileType);
            }
            
            console.log('✅ 選択ファイル削除成功:', selectedIndices.length, '件');
            
        } catch (error) {
            console.error('❌ 選択ファイル削除エラー:', error);
            alert('ファイルの削除に失敗しました: ' + error.message);
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

/**
 * 削除確認ダイアログを表示
 */
function showDeleteConfirm(message, onConfirm) {
    const dialog = document.getElementById('deleteConfirm');
    const messageEl = document.getElementById('deleteMessage');
    
    messageEl.textContent = message;
    dialog.style.display = 'flex';
    
    deleteTarget = onConfirm;
}

/**
 * 削除を確認
 */
function confirmDelete() {
    const dialog = document.getElementById('deleteConfirm');
    dialog.style.display = 'none';
    
    if (deleteTarget) {
        deleteTarget();
        deleteTarget = null;
    }
}

/**
 * 削除をキャンセル
 */
function cancelDelete() {
    const dialog = document.getElementById('deleteConfirm');
    dialog.style.display = 'none';
    deleteTarget = null;
}

// グローバルに公開
window.showPDF = showPDF;
window.closePDFModal = closePDFModal;
window.navigateFile = navigateFile;
window.deleteFile = deleteFile;
window.selectAllFiles = selectAllFiles;
window.deleteSelectedFiles = deleteSelectedFiles;
window.updateDeleteButton = updateDeleteButton;
window.confirmDelete = confirmDelete;
window.cancelDelete = cancelDelete;

console.log('✅ PDFビューアー機能読み込み完了');