// ========================================
// AUTH.JS - 認証機能統合
// ========================================

console.log('🔐 AUTH.JS 読み込み開始');

// 認証関連の設定
const AUTH_CONFIG = {
    LOGIN_URL: 'login.html',
    AUTH_API_URL: 'login.php',
    SESSION_CHECK_INTERVAL: 5 * 60 * 1000, // 5分間隔でセッションチェック
    AUTO_LOGOUT_WARNING: 10 * 60 * 1000 // 10分前に警告
};

// 現在のユーザー情報
let currentUser = null;
let sessionCheckTimer = null;

/**
 * ページ読み込み時の認証チェック
 */
async function checkAuthentication() {
    console.log('🔐 認証状態をチェック中...');
    
    try {
        const response = await fetch(AUTH_CONFIG.AUTH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=check_session'
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ 認証済み:', result.user.name);
            currentUser = result.user;
            initializeAuthenticatedUser();
            startSessionMonitoring();
            return true;
        } else {
            console.log('❌ 未認証:', result.message);
            redirectToLogin();
            return false;
        }
        
    } catch (error) {
        console.error('❌ 認証チェックエラー:', error);
        redirectToLogin();
        return false;
    }
}

// 後方互換性のため
const checkAuthenticationOnLoad = checkAuthentication;

/**
 * 認証済みユーザーの初期化
 */
function initializeAuthenticatedUser() {
    // ヘッダーにユーザー情報を表示
    updateUserInfoInHeader();
    
    // 権限に応じたUI調整
    adjustUIByPermissions();
    
    console.log('👤 ユーザー初期化完了:', currentUser.name);
}

/**
 * ヘッダーにユーザー情報を追加
 */
function updateUserInfoInHeader() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;
    
    // 既存のユーザー情報があれば削除
    const existingUserInfo = document.getElementById('userInfoContainer');
    if (existingUserInfo) {
        existingUserInfo.remove();
    }
    
    // ユーザー情報コンテナを作成
    const userInfoContainer = document.createElement('div');
    userInfoContainer.id = 'userInfoContainer';
    userInfoContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
        margin-left: 20px;
        padding-left: 20px;
        border-left: 1px solid rgba(255,255,255,0.3);
    `;
    
    // ユーザー情報表示
    const userInfo = document.createElement('div');
    userInfo.style.cssText = `
        color: white;
        font-size: 12px;
        text-align: right;
        line-height: 1.3;
    `;
    
    const roleIcon = currentUser.role === 'admin' ? '👨‍💼' : '👥';
    const roleName = currentUser.role === 'admin' ? '管理者' : '従業員';
    
    userInfo.innerHTML = `
        <div style="font-weight: 600;">
            ${roleIcon} ${currentUser.name}
        </div>
        <div style="font-size: 10px; opacity: 0.8;">
            ${roleName} | ID: ${currentUser.id}
        </div>
    `;
    
    // ログアウトボタン
    const logoutButton = document.createElement('button');
    logoutButton.style.cssText = `
        background-color: #e74c3c;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        gap: 5px;
    `;
    logoutButton.innerHTML = '🚪 ログアウト';
    logoutButton.addEventListener('click', handleLogout);
    logoutButton.addEventListener('mouseover', function() {
        this.style.backgroundColor = '#c0392b';
    });
    logoutButton.addEventListener('mouseout', function() {
        this.style.backgroundColor = '#e74c3c';
    });
    
    // ユーザー管理ボタン（管理者のみ）
    if (currentUser.role === 'admin') {
        const userManagementButton = document.createElement('a');
        userManagementButton.href = 'user-management.html';
        userManagementButton.style.cssText = `
            background-color: #9b59b6;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: background-color 0.2s;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-right: 8px;
        `;
        userManagementButton.innerHTML = '👥 ユーザー管理';
        userManagementButton.addEventListener('mouseover', function() {
            this.style.backgroundColor = '#8e44ad';
        });
        userManagementButton.addEventListener('mouseout', function() {
            this.style.backgroundColor = '#9b59b6';
        });
        
        userInfoContainer.appendChild(userManagementButton);
    }
    
    userInfoContainer.appendChild(userInfo);
    userInfoContainer.appendChild(logoutButton);
    
    // ヘッダーの最後に追加
    headerControls.appendChild(userInfoContainer);
}

/**
 * 権限に応じたUI調整
 */
function adjustUIByPermissions() {
    if (!currentUser) return;
    
    // 管理者のみの機能
    if (currentUser.role !== 'admin') {
        // 管理者専用ボタンを無効化または非表示
        const adminOnlyElements = document.querySelectorAll('.admin-only');
        adminOnlyElements.forEach(element => {
            element.style.display = 'none';
        });
    }
    
    // 読み取り専用ユーザーの場合
    if (currentUser.permissions && !currentUser.permissions.includes('edit')) {
        // 編集機能を無効化
        const editElements = document.querySelectorAll('input, select, textarea');
        editElements.forEach(element => {
            element.disabled = true;
            element.style.backgroundColor = '#f8f9fa';
        });
        
        // アップロードボタンを無効化
        const uploadButtons = document.querySelectorAll('.upload-btn, .btn-select-files');
        uploadButtons.forEach(button => {
            button.disabled = true;
            button.textContent = '権限なし';
        });
    }
    
    console.log('🔒 権限調整完了:', currentUser.permissions);
}

/**
 * セッション監視を開始
 */
function startSessionMonitoring() {
    // 既存のタイマーをクリア
    if (sessionCheckTimer) {
        clearInterval(sessionCheckTimer);
    }
    
    // 定期的にセッションをチェック
    sessionCheckTimer = setInterval(async () => {
        try {
            const response = await fetch(AUTH_CONFIG.AUTH_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'action=check_session'
            });
            
            const result = await response.json();
            
            if (!result.success) {
                console.log('🔄 セッション期限切れ:', result.message);
                showSessionExpiredMessage(result.message);
                redirectToLogin();
            } else {
                // セッション情報を更新
                if (result.session_info) {
                    console.log('✅ セッション有効 - 残り時間:', 
                               Math.floor(result.session_info.remaining_time / 60), '分');
                    
                    // 自動ログアウト警告
                    if (result.session_info.remaining_time < AUTH_CONFIG.AUTO_LOGOUT_WARNING / 1000) {
                        showAutoLogoutWarning(result.session_info.remaining_time);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ セッションチェックエラー:', error);
        }
    }, AUTH_CONFIG.SESSION_CHECK_INTERVAL);
    
    console.log('👁️ セッション監視開始');
}

/**
 * ログアウト処理
 */
async function handleLogout() {
    if (!confirm('ログアウトしますか？')) {
        return;
    }
    
    console.log('🚪 ログアウト処理開始');
    
    try {
        const response = await fetch(AUTH_CONFIG.AUTH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=logout'
        });
        
        const result = await response.json();
        console.log('✅ ログアウト完了:', result.message);
        
    } catch (error) {
        console.error('❌ ログアウトエラー:', error);
    } finally {
        // セッション監視を停止
        if (sessionCheckTimer) {
            clearInterval(sessionCheckTimer);
        }
        
        // ログイン画面にリダイレクト
        redirectToLogin();
    }
}

/**
 * ログイン画面にリダイレクト
 */
function redirectToLogin() {
    console.log('🔄 ログイン画面にリダイレクト');
    window.location.href = AUTH_CONFIG.LOGIN_URL;
}

/**
 * セッション期限切れメッセージを表示
 */
function showSessionExpiredMessage(message) {
    // 既存のメッセージがあれば削除
    const existingMessage = document.getElementById('sessionExpiredMessage');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.id = 'sessionExpiredMessage';
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #e74c3c;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    messageDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span>⚠️</span>
            <div>
                <div style="font-weight: 600;">セッション期限切れ</div>
                <div style="font-size: 12px; margin-top: 2px; opacity: 0.9;">${message}</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(messageDiv);
    
    // 3秒後に自動削除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

/**
 * 自動ログアウト警告を表示
 */
function showAutoLogoutWarning(remainingTime) {
    // 既存の警告があれば削除
    const existingWarning = document.getElementById('autoLogoutWarning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    const warningDiv = document.createElement('div');
    warningDiv.id = 'autoLogoutWarning';
    warningDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #f39c12;
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        z-index: 10001;
        text-align: center;
        min-width: 300px;
    `;
    
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    
    warningDiv.innerHTML = `
        <div style="font-size: 18px; margin-bottom: 10px;">⏰ セッション期限警告</div>
        <div style="margin-bottom: 15px;">
            あと${minutes}分${seconds}秒でセッションが期限切れになります
        </div>
        <button onclick="extendSession()" style="
            background-color: white;
            color: #f39c12;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            margin-right: 10px;
        ">セッション延長</button>
        <button onclick="handleLogout()" style="
            background-color: #e74c3c;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
        ">ログアウト</button>
    `;
    
    document.body.appendChild(warningDiv);
}

/**
 * セッション延長
 */
async function extendSession() {
    try {
        const response = await fetch(AUTH_CONFIG.AUTH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=check_session'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 警告メッセージを削除
            const warningDiv = document.getElementById('autoLogoutWarning');
            if (warningDiv) {
                warningDiv.remove();
            }
            
            console.log('✅ セッション延長成功');
        }
        
    } catch (error) {
        console.error('❌ セッション延長エラー:', error);
    }
}

/**
 * ユーザー情報を取得
 */
async function getCurrentUser() {
    if (currentUser) {
        return currentUser;
    }
    
    try {
        const response = await fetch(AUTH_CONFIG.AUTH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'action=get_user_info'
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = result.user;
            return currentUser;
        }
        
    } catch (error) {
        console.error('❌ ユーザー情報取得エラー:', error);
    }
    
    return null;
}

/**
 * 権限チェック
 */
function hasPermission(permission) {
    if (!currentUser || !currentUser.permissions) {
        return false;
    }
    
    return currentUser.permissions.includes(permission) || 
           currentUser.permissions.includes('all');
}

/**
 * 管理者権限チェック
 */
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

// アニメーション用CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// 短縮版の認証チェック関数
async function checkAuth() {
    return await checkAuthentication();
}

// グローバル関数として公開
window.checkAuthentication = checkAuthentication;
window.checkAuthenticationOnLoad = checkAuthenticationOnLoad;
window.checkAuth = checkAuth;
window.handleLogout = handleLogout;
window.extendSession = extendSession;
window.getCurrentUser = getCurrentUser;
window.hasPermission = hasPermission;
window.isAdmin = isAdmin;
window.currentUser = currentUser;

console.log('✅ AUTH.JS 読み込み完了');