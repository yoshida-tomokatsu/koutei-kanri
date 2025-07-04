// アップロードモーダル関連の機能

let uploadOrderId = '';
let uploadFileType = '';

function showUploadModal(orderId, fileType) {
    console.log('モーダル表示:', orderId, fileType);
    
    uploadOrderId = orderId;
    uploadFileType = fileType;
    
    const modal = document.getElementById('uploadModal');
    const title = document.getElementById('uploadTitle');
    const subtitle = document.getElementById('uploadSubtitle');
    const dragMessage = document.getElementById('dragMessage');
    const dragSubmessage = document.getElementById('dragSubmessage');
    const fileInput = document.getElementById('modalFileInput');
    
    if (fileType === 'quotes') {
        title.textContent = '見積書アップロード';
        dragMessage.textContent = 'PDFファイルをここにドラッグ&ドロップ';
        dragSubmessage.textContent = 'または下のボタンでPDFファイルを選択';
        fileInput.accept = '.pdf';
        fileInput.multiple = false;
    } else {
        title.textContent = '商品画像アップロード';
        dragMessage.textContent = '画像ファイルをここにドラッグ&ドロップ';
        dragSubmessage.textContent = 'または下のボタンで画像ファイルを選択（複数選択可）';
        fileInput.accept = '.jpg,.jpeg,.png,.pdf';
        fileInput.multiple = true;
    }
    
    subtitle.textContent = `注文ID: ${orderId}`;
    document.getElementById('uploadProgress').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
    modal.style.display = 'flex';
    
    initializeModalDragDrop();
}

function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    modal.style.display = 'none';
    uploadOrderId = '';
    uploadFileType = '';
    const fileInput = document.getElementById('modalFileInput');
    fileInput.value = '';
}

function selectFiles() {
    const fileInput = document.getElementById('modalFileInput');
    fileInput.click();
}

function initializeModalDragDrop() {
    const dragArea = document.getElementById('dragDropArea');
    const dragMessage = document.getElementById('dragMessage');
    const originalMessage = dragMessage.textContent;
    
    dragArea.addEventListener('dragenter', handleModalDragEnter);
    dragArea.addEventListener('dragover', handleModalDragOver);
    dragArea.addEventListener('dragleave', handleModalDragLeave);
    dragArea.addEventListener('drop', handleModalDrop);
    dragArea.addEventListener('click', handleModalAreaClick);
    
    function handleModalDragEnter(e) {
        e.preventDefault();
        dragArea.classList.add('drag-over');
        const allowedTypes = CONFIG.FILE_SETTINGS.ALLOWED_EXTENSIONS[uploadFileType];
        dragMessage.textContent = `ここにドロップしてください（${allowedTypes}）`;
    }
    
    function handleModalDragOver(e) {
        e.preventDefault();
    }
    
    function handleModalDragLeave(e) {
        if (!dragArea.contains(e.relatedTarget)) {
            dragArea.classList.remove('drag-over');
            dragMessage.textContent = originalMessage;
        }
    }
    
    function handleModalDrop(e) {
        e.preventDefault();
        dragArea.classList.remove('drag-over');
        dragMessage.textContent = originalMessage;
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            processModalFiles(files);
        }
    }
    
    function handleModalAreaClick() {
        selectFiles();
    }
}

async function processModalFiles(files) {
    console.log('ファイル処理開始:', uploadOrderId, uploadFileType, files.length + '件');
    
    try {
        validateFileTypes(files, uploadFileType);
        validateFileSize(files);
        
        showUploadProgress();
        await uploadFilesToServer(uploadOrderId, files, uploadFileType);
        updateProgress(60, 'サーバー処理中...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateProgress(80, 'ファイル情報を更新中...');
        
        const latestFiles = await loadFilesFromServer(uploadOrderId);
        if (window.serverFiles) {
            window.serverFiles[uploadOrderId] = latestFiles;
        }
        
        updateProgress(90, '画面を更新中...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        for (let i = 0; i < 3; i++) {
            if (window.updateFileDisplay) {
                window.updateFileDisplay(uploadOrderId, uploadFileType);
            }
            if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        updateProgress(100, 'アップロード完了！');
        
        setTimeout(() => {
            alert(`${files.length}件のファイルがアップロードされました`);
            closeUploadModal();
        }, 800);
        
    } catch (error) {
        console.error('アップロードエラー:', error);
        hideUploadProgress();
        alert('ファイルのアップロードに失敗しました: ' + error.message);
    }
}

function showUploadProgress() {
    const progressContainer = document.getElementById('uploadProgress');
    progressContainer.style.display = 'block';
    updateProgress(20, 'アップロード準備中...');
}

function hideUploadProgress() {
    const progressContainer = document.getElementById('uploadProgress');
    progressContainer.style.display = 'none';
}

function updateProgress(percentage, message) {
    const progressMessage = document.getElementById('progressMessage');
    const progressFill = document.getElementById('progressFill');
    
    if (progressMessage) progressMessage.textContent = message;
    if (progressFill) progressFill.style.width = percentage + '%';
}

function initializeUploadModalEvents() {
    const modalFileInput = document.getElementById('modalFileInput');
    if (modalFileInput) {
        modalFileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                const files = Array.from(this.files);
                processModalFiles(files);
            }
        });
    }
    
    const uploadModal = document.getElementById('uploadModal');
    if (uploadModal) {
        uploadModal.addEventListener('click', function(e) {
            if (e.target === uploadModal) {
                closeUploadModal();
            }
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const uploadModal = document.getElementById('uploadModal');
            if (uploadModal && uploadModal.style.display === 'flex') {
                closeUploadModal();
            }
        }
    });
    
    console.log('アップロードモーダルイベント初期化完了');
}

console.log('アップロードモーダルファイル読み込み完了');