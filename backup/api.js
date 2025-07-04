// API通信関連の関数

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

/**
 * サーバーからファイル一覧を取得
 */
async function loadFilesFromServer(orderId) {
    if (DEBUG.LOG_API_CALLS) {
        console.log('📡 API: ファイル一覧取得開始:', orderId);
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
 * ファイルダウンロードURLを生成
 */
function getFileDownloadUrl(orderId, filename) {
    const timestamp = new Date().getTime();
    return `${CONFIG.API_BASE_URL}?action=download&orderId=${encodeURIComponent(orderId)}&filename=${encodeURIComponent(filename)}&_t=${timestamp}`;
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

console.log('API通信ファイル読み込み完了');