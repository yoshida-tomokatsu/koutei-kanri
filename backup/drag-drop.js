// ドラッグ&ドロップ機能（ファイル並び替え用）

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

window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragEnter = handleDragEnter;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;

console.log('ドラッグ&ドロップファイル読み込み完了');