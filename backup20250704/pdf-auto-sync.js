/**
 * PDF自動同期システム - フロントエンド
 * 画面更新のたびにPDFファイルの差分をチェック・同期
 */

class PDFAutoSync {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || 'pdf-auto-sync.php';
        this.checkInterval = options.checkInterval || 30000; // 30秒間隔
        this.enableAutoSync = options.enableAutoSync !== false; // デフォルトで有効
        this.onSyncComplete = options.onSyncComplete || null;
        this.onError = options.onError || null;
        this.debug = false; // デバッグ機能を無効化
        
        this.isChecking = false;
        this.lastCheckTime = 0;
        this.syncStatus = null;
        
        // イベントリスナーを設定
        this.setupEventListeners();
        
        // 初回チェック
        if (this.enableAutoSync) {
            this.checkSyncStatus();
        }
        
        this.log('PDF自動同期システムが初期化されました');
    }
    
    /**
     * ログ出力
     */
    log(message, level = 'info') {
        if (this.debug) {
            const timestamp = new Date().toLocaleTimeString();
            console[level](`[${timestamp}] PDFAutoSync: ${message}`);
        }
    }
    
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // ページの可視性変更時
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.enableAutoSync) {
                this.log('ページが表示されました - 同期チェックを実行');
                this.checkSyncStatus();
            }
        });
        
        // フォーカス取得時
        window.addEventListener('focus', () => {
            if (this.enableAutoSync) {
                this.log('ウィンドウがフォーカスされました - 同期チェックを実行');
                this.checkSyncStatus();
            }
        });
        
        // 定期チェック
        if (this.enableAutoSync) {
            setInterval(() => {
                if (!document.hidden) {
                    this.checkSyncStatus();
                }
            }, this.checkInterval);
        }
    }
    
    /**
     * 同期状態のチェック
     */
    async checkSyncStatus() {
        if (this.isChecking) {
            this.log('既にチェック中のため、スキップします');
            return;
        }
        
        this.isChecking = true;
        this.lastCheckTime = Date.now();
        
        try {
            this.log('同期状態をチェック中...');
            
            const response = await fetch(`${this.apiUrl}?action=info`);
            const result = await response.json();
            
            if (result.success) {
                this.syncStatus = result.status;
                this.log(`同期状態を取得: ${result.status.total_files}ファイル`);
                
                // 自動同期が必要かチェック
                if (this.shouldPerformAutoSync()) {
                    await this.performAutoSync();
                }
            } else {
                this.handleError('同期状態の取得に失敗しました', result);
            }
        } catch (error) {
            this.handleError('同期状態チェック中にエラーが発生しました', error);
        } finally {
            this.isChecking = false;
        }
    }
    
    /**
     * 自動同期が必要かどうかを判定
     */
    shouldPerformAutoSync() {
        if (!this.syncStatus) return false;
        
        const currentTime = Math.floor(Date.now() / 1000);
        const timeSinceCheck = currentTime - this.syncStatus.last_check;
        
        // 5分以上チェックしていない場合は同期を実行
        return timeSinceCheck > 300;
    }
    
    /**
     * 自動同期の実行
     */
    async performAutoSync() {
        try {
            this.log('自動同期を実行中...');
            
            const response = await fetch(`${this.apiUrl}?action=auto_sync`);
            const result = await response.json();
            
            if (result.success) {
                this.log(`自動同期完了: ${result.message}`);
                
                // 同期結果の詳細をログ出力
                if (result.sync_result && result.sync_result.stats) {
                    const stats = result.sync_result.stats;
                    this.log(`同期統計: コピー${stats.copied}件, 更新${stats.updated}件, 削除${stats.deleted}件, エラー${stats.errors}件`);
                }
                
                // コールバック実行
                if (this.onSyncComplete) {
                    this.onSyncComplete(result);
                }
                
                // 同期通知を表示（変更があった場合のみ）
                if (result.check_result && result.check_result.changed_files > 0) {
                    this.showSyncNotification(result);
                }
            } else {
                this.handleError('自動同期に失敗しました', result);
            }
        } catch (error) {
            this.handleError('自動同期中にエラーが発生しました', error);
        }
    }
    
    /**
     * 強制同期の実行
     */
    async forcSync() {
        try {
            this.log('強制同期を実行中...');
            
            const response = await fetch(`${this.apiUrl}?action=force_sync`);
            const result = await response.json();
            
            if (result.success) {
                this.log(`強制同期完了: ${result.message}`);
                
                if (this.onSyncComplete) {
                    this.onSyncComplete(result);
                }
                
                this.showSyncNotification(result, true);
                return result;
            } else {
                this.handleError('強制同期に失敗しました', result);
                return null;
            }
        } catch (error) {
            this.handleError('強制同期中にエラーが発生しました', error);
            return null;
        }
    }
    
    /**
     * 差分チェックのみ実行
     */
    async checkDifferences() {
        try {
            this.log('差分チェックを実行中...');
            
            const response = await fetch(`${this.apiUrl}?action=check`);
            const result = await response.json();
            
            if (result.success) {
                this.log(`差分チェック完了: ${result.check_result.changed_files}件の変更`);
                return result.check_result;
            } else {
                this.handleError('差分チェックに失敗しました', result);
                return null;
            }
        } catch (error) {
            this.handleError('差分チェック中にエラーが発生しました', error);
            return null;
        }
    }
    
    /**
     * 同期通知の表示
     */
    showSyncNotification(result, isForced = false) {
        const stats = result.sync_result?.stats;
        if (!stats) return;
        
        const totalChanges = stats.copied + stats.updated + stats.deleted;
        if (totalChanges === 0 && !isForced) return;
        
        // 通知メッセージを作成
        let message = '📁 PDFファイル同期完了\n';
        if (stats.copied > 0) message += `新規: ${stats.copied}件\n`;
        if (stats.updated > 0) message += `更新: ${stats.updated}件\n`;
        if (stats.deleted > 0) message += `削除: ${stats.deleted}件\n`;
        if (stats.errors > 0) message += `エラー: ${stats.errors}件\n`;
        
        // ブラウザ通知（許可されている場合）
        // if ('Notification' in window && Notification.permission === 'granted') {
        //     new Notification('PDF同期完了', {
        //         body: message,
        //         icon: '/favicon.ico'
        //     });
        // }
        
        // コンソールに出力（エラーがある場合のみ）
        if (stats.errors > 0) {
            this.log(message.replace(/\n/g, ' '));
        }
        
        // カスタム通知UI（エラーがある場合のみ）
        if (stats.errors > 0) {
            this.showCustomNotification(message, 'error');
        }
    }
    
    /**
     * カスタム通知UIの表示
     */
    showCustomNotification(message, type = 'info') {
        // 既存の通知システムがある場合はそれを使用
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        // シンプルな通知UIを作成
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            font-size: 14px;
            line-height: 1.4;
            white-space: pre-line;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // クリックで削除
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }
    
    /**
     * エラーハンドリング
     */
    handleError(message, error) {
        this.log(`エラー: ${message}`, 'error');
        if (error) {
            this.log(`詳細: ${JSON.stringify(error)}`, 'error');
        }
        
        if (this.onError) {
            this.onError(message, error);
        }
    }
    
    /**
     * 同期状態の取得
     */
    getSyncStatus() {
        return this.syncStatus;
    }
    
    /**
     * 自動同期の有効/無効切り替え
     */
    setAutoSyncEnabled(enabled) {
        this.enableAutoSync = enabled;
        this.log(`自動同期を${enabled ? '有効' : '無効'}にしました`);
    }
    
    /**
     * デバッグモードの切り替え（無効化）
     */
    setDebugMode(enabled) {
        // デバッグ機能は無効化
        this.debug = false;
    }
}

// グローバルに公開
window.PDFAutoSync = PDFAutoSync;

// 自動初期化（オプション）
document.addEventListener('DOMContentLoaded', () => {
    // 設定が存在する場合は自動初期化
    if (window.PDF_AUTO_SYNC_CONFIG) {
        window.pdfAutoSync = new PDFAutoSync(window.PDF_AUTO_SYNC_CONFIG);
    }
});

// ブラウザ通知の許可を要求
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

console.log('PDF自動同期システム (pdf-auto-sync.js) が読み込まれました'); 