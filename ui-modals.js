// ========================================
// UI-MODALS.JS - 全モーダル機能
// ========================================

console.log('🪟 UI-MODALS.JS 読み込み開始');

// ========================================
// アップロードモーダル機能
// ========================================

let uploadOrderId = '';
let uploadFileType = '';

function showUploadModal(orderId, fileType) {
    console.log('📤 アップロードモーダル表示:', orderId, fileType);
    
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
    
    // 既存のイベントリスナーを削除
    dragArea.removeEventListener('dragenter', handleModalDragEnter);
    dragArea.removeEventListener('dragover', handleModalDragOver);
    dragArea.removeEventListener('dragleave', handleModalDragLeave);
    dragArea.removeEventListener('drop', handleModalDrop);
    dragArea.removeEventListener('click', handleModalAreaClick);
    
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
    console.log('📁 ファイル処理開始:', uploadOrderId, uploadFileType, files.length + '件');
    
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
            console.log(`✅ ${files.length}件のファイルがアップロードされました`);
            closeUploadModal();
        }, 800);
        
    } catch (error) {
        console.error('❌ アップロードエラー:', error);
        hideUploadProgress();
        console.error('❌ ファイルのアップロードに失敗しました:', error.message);
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

// ========================================
// 絞り込みモーダル機能
// ========================================

// 現在のフィルタ設定
let currentFilters = {
    category: '',
    orderPerson: '',
    payment: '',
    printFactory: '',
    sewingFactory: '',
    inspectionPerson: '',
    shipping: ''
};

// グローバルに公開
window.currentFilters = currentFilters;

/**
 * 絞り込みモーダルを表示
 */
function showFilterModal() {
    console.log('🔍 絞り込みモーダル表示');
    
    // 動的選択肢を更新
    updateFilterOptions();
    
    // 現在のフィルタ値を設定
    document.getElementById('filterCategory').value = currentFilters.category;
    document.getElementById('filterOrderPerson').value = currentFilters.orderPerson;
    document.getElementById('filterPayment').value = currentFilters.payment;
    document.getElementById('filterPrintFactory').value = currentFilters.printFactory;
    document.getElementById('filterSewingFactory').value = currentFilters.sewingFactory;
    document.getElementById('filterInspectionPerson').value = currentFilters.inspectionPerson;
    document.getElementById('filterShipping').value = currentFilters.shipping;
    
    document.getElementById('filterModal').style.display = 'flex';
}

/**
 * 絞り込みモーダルを閉じる
 */
function closeFilterModal() {
    console.log('🔍 絞り込みモーダル閉じる');
    document.getElementById('filterModal').style.display = 'none';
}

/**
 * フィルタの選択肢を更新
 */
function updateFilterOptions() {
    // 注文担当
    const orderPersonSelect = document.getElementById('filterOrderPerson');
    orderPersonSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['注文担当'].forEach(person => {
        const option = document.createElement('option');
        option.value = person;
        option.textContent = person;
        orderPersonSelect.appendChild(option);
    });
    
    // 支払い方法
    const paymentSelect = document.getElementById('filterPayment');
    paymentSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['支払い方法'].forEach(payment => {
        const option = document.createElement('option');
        option.value = payment;
        option.textContent = payment;
        paymentSelect.appendChild(option);
    });
    
    // プリント工場
    const printFactorySelect = document.getElementById('filterPrintFactory');
    printFactorySelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['プリント工場'].forEach(factory => {
        const option = document.createElement('option');
        option.value = factory;
        option.textContent = factory;
        printFactorySelect.appendChild(option);
    });
    
    // 縫製工場
    const sewingFactorySelect = document.getElementById('filterSewingFactory');
    sewingFactorySelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['縫製工場'].forEach(factory => {
        const option = document.createElement('option');
        option.value = factory;
        option.textContent = factory;
        sewingFactorySelect.appendChild(option);
    });
    
    // 検品担当
    const inspectionPersonSelect = document.getElementById('filterInspectionPerson');
    inspectionPersonSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['検品担当'].forEach(person => {
        const option = document.createElement('option');
        option.value = person;
        option.textContent = person;
        inspectionPersonSelect.appendChild(option);
    });
    
    // 配送会社
    const shippingSelect = document.getElementById('filterShipping');
    shippingSelect.innerHTML = '<option value="">すべて</option>';
    dynamicOptions['配送会社'].forEach(shipping => {
        const option = document.createElement('option');
        option.value = shipping;
        option.textContent = shipping;
        shippingSelect.appendChild(option);
    });
}

/**
 * フィルタを適用
 */
function applyFilters() {
    console.log('🔍 フィルタ適用開始');
    
    // フィルタ値を取得
    currentFilters = {
        category: document.getElementById('filterCategory').value,
        orderPerson: document.getElementById('filterOrderPerson').value,
        payment: document.getElementById('filterPayment').value,
        printFactory: document.getElementById('filterPrintFactory').value,
        sewingFactory: document.getElementById('filterSewingFactory').value,
        inspectionPerson: document.getElementById('filterInspectionPerson').value,
        shipping: document.getElementById('filterShipping').value
    };
    
    // グローバルにも設定
    window.currentFilters = currentFilters;
    
    console.log('適用するフィルタ:', currentFilters);
    
    // フィルタを実行
    if (window.filterOrders) {
        window.filterOrders();
    }
    
    // アクティブフィルタ表示を更新
    updateActiveFiltersDisplay();
    
    // モーダルを閉じる
    closeFilterModal();
}

/**
 * フィルタをクリア
 */
function clearFilters() {
    console.log('🔍 フィルタクリア');
    
    // フィルタをリセット
    currentFilters = {
        category: '',
        orderPerson: '',
        payment: '',
        printFactory: '',
        sewingFactory: '',
        inspectionPerson: '',
        shipping: ''
    };
    
    // グローバルにも設定
    window.currentFilters = currentFilters;
    
    // フォームをリセット
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterOrderPerson').value = '';
    document.getElementById('filterPayment').value = '';
    document.getElementById('filterPrintFactory').value = '';
    document.getElementById('filterSewingFactory').value = '';
    document.getElementById('filterInspectionPerson').value = '';
    document.getElementById('filterShipping').value = '';
    
    // フィルタを実行
    if (window.filterOrders) {
        window.filterOrders();
    }
    
    // アクティブフィルタ表示を更新
    updateActiveFiltersDisplay();
}

/**
 * アクティブフィルタの表示を更新
 */
function updateActiveFiltersDisplay() {
    const activeFiltersContainer = document.getElementById('activeFiltersHorizontal');
    const filterDisplayArea = document.getElementById('filterDisplayArea');
    const filterBtn = document.querySelector('.btn-filter');
    const container = document.querySelector('.container');
    
    activeFiltersContainer.innerHTML = '';
    
    const filterLabels = {
        category: '商品種別',
        orderPerson: '注文担当',
        payment: '支払い方法',
        printFactory: 'プリント工場',
        sewingFactory: '縫製工場',
        inspectionPerson: '検品担当',
        shipping: '配送会社'
    };
    
    let hasActiveFilters = false;
    
    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key]) {
            hasActiveFilters = true;
            const filterTag = document.createElement('div');
            filterTag.className = 'filter-tag';
            filterTag.innerHTML = `
                ${filterLabels[key]}: ${currentFilters[key]}
                <button class="remove-filter" onclick="removeFilter('${key}')">&times;</button>
            `;
            activeFiltersContainer.appendChild(filterTag);
        }
    });
    
    // フィルタ表示エリアの表示/非表示
    if (hasActiveFilters) {
        filterDisplayArea.style.display = 'block';
        container.classList.add('with-filter');
        filterBtn.classList.add('filtering');
        filterBtn.innerHTML = '🔍 絞り込み中';
    } else {
        filterDisplayArea.style.display = 'none';
        container.classList.remove('with-filter');
        filterBtn.classList.remove('filtering');
        filterBtn.innerHTML = '🔍 絞り込み';
    }
}

/**
 * 個別フィルタを削除
 */
function removeFilter(filterKey) {
    console.log('🔍 フィルタ削除:', filterKey);
    
    currentFilters[filterKey] = '';
    window.currentFilters = currentFilters;
    
    if (window.filterOrders) {
        window.filterOrders();
    }
    updateActiveFiltersDisplay();
}

// ========================================
// PDFビューアーモーダル機能
// ========================================

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
 * PDFビューアーモーダルを表示
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
    if (modalTitle) {
        modalTitle.textContent = `${type} - 注文ID: ${orderId}`;
    } else {
        console.warn('⚠️ pdfTitle要素が見つかりません');
    }
    
    // モーダルを表示
    const modal = document.getElementById('pdfModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.error('❌ pdfModal要素が見つかりません。PDFモーダルを表示できません。');
        return;
    }
    
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
 * ローカルPDF APIからファイル情報を取得
 */
async function loadPDFFilesFromLocalAPI(orderId) {
    try {
        const response = await fetch(`pdf-viewer-api.php?action=list&order_id=${encodeURIComponent(orderId)}`);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        console.log('📄 ローカルPDF API応答:', data);
        
        // APIからのデータを整形
        return {
            quotes: data.quotes || [],
            images: data.images || []
        };
        
    } catch (error) {
        console.error('❌ ローカルPDF API エラー:', error);
        
        // エラー時は空の配列を返す
        return {
            quotes: [],
            images: []
        };
    }
}

/**
 * ファイル一覧を読み込み
 */
async function loadFileList() {
    console.log('📂 ファイル一覧読み込み:', currentOrderId, currentFileType);
    
    const fileListContent = document.getElementById('fileListContent');
    const fileCount = document.getElementById('fileCount');
    const fileViewer = document.getElementById('fileViewer');
    
    // 要素が存在しない場合のエラーチェック
    if (!fileListContent || !fileCount || !fileViewer) {
        console.error('❌ 必要なPDFモーダル要素が見つかりません:', {
            fileListContent: !!fileListContent,
            fileCount: !!fileCount,
            fileViewer: !!fileViewer
        });
        console.log('💡 PDFモーダルが正しく開かれているか確認してください');
        return;
    }
    
    try {
        // ローディング表示
        fileListContent.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">読み込み中...</div>';
        fileViewer.innerHTML = `
            <div class="pdf-placeholder">
                <div class="pdf-icon">📄</div>
                <div class="pdf-message">ファイルを読み込み中...</div>
            </div>
        `;
        
        // 新しいPDF表示APIからファイル情報を取得
        const allFiles = await loadPDFFilesFromLocalAPI(currentOrderId);
        currentFiles = allFiles[currentFileType] || [];
        
        // グローバルに設定
        window.currentFiles = currentFiles;
        
        console.log('📂 読み込まれたファイル:', currentFiles.length, '件');
        
        if (currentFiles.length === 0) {
            // ローカルファイルが見つからない場合の表示
            console.log('⚠️ 注文ID ' + currentOrderId + ' に対応するPDFファイルが見つかりません');
            
            // ファイル数を更新
            if (fileCount) {
                fileCount.textContent = '0件';
                fileCount.classList.remove('multiple');
            }
            
            // 空の状態を表示
            showEmptyState();
            
            // ナビゲーション非表示
            const navigation = document.getElementById('fileNavigation');
            const infoBadge = document.getElementById('fileInfoBadge');
            if (navigation) navigation.classList.remove('show');
            if (infoBadge) infoBadge.classList.remove('show');
            
            return;
        }
        
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
            if (window.showFileInViewer) {
                window.showFileInViewer(0);
            } else {
                console.warn('⚠️ showFileInViewer関数が利用できません');
            }
            
            // ナビゲーション状態を更新
            updateNavigationState();
        } else {
            showEmptyState();
        }
        
    } catch (error) {
        console.error('❌ ファイル一覧読み込みエラー:', error);
        if (fileListContent) {
            fileListContent.innerHTML = '<div style="text-align: center; padding: 20px; color: #e74c3c;">読み込みに失敗しました</div>';
        }
        if (fileViewer) {
            fileViewer.innerHTML = `
                <div class="pdf-placeholder">
                    <div class="pdf-icon">❌</div>
                    <div class="pdf-message">ファイルの読み込みに失敗しました</div>
                    <div class="pdf-info">${error.message}</div>
                </div>
            `;
        }
    }
}

/**
 * ファイル一覧UIを構築
 */
function buildFileList() {
    const fileListContent = document.getElementById('fileListContent');
    
    // 要素が存在しない場合のエラーチェック
    if (!fileListContent) {
        console.error('❌ fileListContent要素が見つかりません。PDFモーダルが正しく表示されていない可能性があります。');
        return;
    }
    
    if (currentFiles.length === 0) {
        console.log('🔍 ローカルファイルなし。直接PDFアクセスを試行:', currentOrderId);
        
        // ファイルリストに「直接アクセス中」を表示
        fileListContent.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #666;">
                <div style="font-size: 36px; margin-bottom: 15px;">🌐</div>
                <div style="font-size: 14px; margin-bottom: 10px;">サーバー直接アクセス中</div>
                <div style="font-size: 12px; color: #999;">見積書PDFを表示しています</div>
            </div>
        `;
        
        // シンプルPDF表示システムを使用
        const pdfViewer = document.getElementById('fileViewer');
        
        if (pdfViewer && window.showSimplePDF) {
            console.log('🔄 シンプルPDF表示システムを使用:', currentOrderId);
            window.showSimplePDF(currentOrderId, 'fileViewer');
        } else if (pdfViewer) {
            // フォールバック: 従来の直接アクセス方式
            const orderNumber = currentOrderId.replace(/#/g, '').trim();
            const directPdfUrl = `https://original-scarf.com/aforms-admin-pdf/${orderNumber}`;
            
            pdfViewer.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                    <div style="padding: 10px; background: #fff3cd; border-bottom: 1px solid #ffeaa7; font-size: 14px; color: #856404;">
                        ⚠️ フォールバック: 直接アクセス - 見積書 ${orderNumber}
                        <div style="font-size: 12px; margin-top: 4px;">
                            <a href="${directPdfUrl}" target="_blank" style="color: #007bff; text-decoration: none;">
                                🔗 新しいタブで開く
                            </a>
                        </div>
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        <iframe src="${directPdfUrl}" 
                                style="width: 100%; height: 100%; border: none;"
                                title="見積書 ${orderNumber}"
                                onload="console.log('✅ PDF iframe 読み込み完了: ${orderNumber}')"
                                onerror="console.error('❌ PDF iframe 読み込み失敗: ${orderNumber}')">
                            <div style="padding: 20px; text-align: center;">
                                <p>PDFを表示できません。</p>
                                <a href="${directPdfUrl}" target="_blank" style="color: #007bff; text-decoration: none;">
                                    📥 新しいタブでPDFを開く
                                </a>
                            </div>
                        </iframe>
                    </div>
                </div>
            `;
            console.log('⚠️ フォールバック: 直接PDFアクセス設定完了:', directPdfUrl);
        } else {
            console.error('❌ fileViewer要素が見つかりません');
        }
        
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
    
    // ドラッグ&ドロップイベントを追加（file-system.jsに依存）
    if (window.addDragDropEvents) {
        window.addDragDropEvents();
    }
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
        <div class="file-content" onclick="window.showFileInViewer && window.showFileInViewer(${index})">
            <div class="file-name">${file.originalName || file.filename}</div>
            <div class="file-info-text">${fileSize} | ${uploadDate}</div>
        </div>
        <button class="file-delete" onclick="deleteFile(${index})" title="削除">&times;</button>
        <div class="drag-handle" title="ドラッグして並び替え">⋮⋮</div>
    `;
    
    return item;
}

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
        if (window.showFileInViewer) {
            window.showFileInViewer(newIndex);
        } else {
            console.warn('⚠️ showFileInViewer関数が利用できません');
        }
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

// ========================================
// 削除確認ダイアログ
// ========================================

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

// ========================================
// イベント初期化
// ========================================

/**
 * 全モーダルのイベント初期化
 */
function initializeModalEvents() {
    // アップロードモーダル
    const modalFileInput = document.getElementById('modalFileInput');
    if (modalFileInput) {
        modalFileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                const files = Array.from(this.files);
                processModalFiles(files);
            }
        });
    }
    
    // フィルタモーダル
    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const filterModal = document.getElementById('filterModal');
            const uploadModal = document.getElementById('uploadModal');
            const pdfModal = document.getElementById('pdfModal');
            const deleteConfirm = document.getElementById('deleteConfirm');
            
            if (filterModal && filterModal.style.display === 'flex') {
                closeFilterModal();
            } else if (uploadModal && uploadModal.style.display === 'flex') {
                closeUploadModal();
            } else if (pdfModal && pdfModal.style.display === 'flex') {
                closePDFModal();
            } else if (deleteConfirm && deleteConfirm.style.display === 'flex') {
                cancelDelete();
            }
        }
    });
    
    // モーダル背景クリックで閉じる
    ['filterModal', 'uploadModal', 'pdfModal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    if (modalId === 'filterModal') closeFilterModal();
                    else if (modalId === 'uploadModal') closeUploadModal();
                    else if (modalId === 'pdfModal') closePDFModal();
                }
            });
        }
    });
    
    console.log('🪟 モーダルイベント初期化完了');
}

// ========================================
// グローバル公開
// ========================================

// アップロードモーダル
window.showUploadModal = showUploadModal;
window.closeUploadModal = closeUploadModal;
window.selectFiles = selectFiles;

// フィルタモーダル
window.showFilterModal = showFilterModal;
window.closeFilterModal = closeFilterModal;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.removeFilter = removeFilter;
window.updateActiveFiltersDisplay = updateActiveFiltersDisplay;

// PDFビューアー
window.showPDF = showPDF;
window.closePDFModal = closePDFModal;
window.navigateFile = navigateFile;
window.addNavigationElements = addNavigationElements;
window.createFileItem = createFileItem;

// 削除確認
window.showDeleteConfirm = showDeleteConfirm;
window.confirmDelete = confirmDelete;
window.cancelDelete = cancelDelete;

// 初期化
window.initializeModalEvents = initializeModalEvents;

console.log('✅ UI-MODALS.JS 読み込み完了');