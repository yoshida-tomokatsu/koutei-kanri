/**
 * キャッシュ無効化システム - JavaScript版
 * ファイルの最終更新時刻を基にバージョン番号を動的生成
 */

class CacheBuster {
    constructor() {
        this.versionCache = new Map();
        this.baseVersion = Date.now(); // フォールバック用のタイムスタンプ
    }

    /**
     * ファイルの最終更新時刻を取得
     */
    async getFileVersion(filename) {
        if (this.versionCache.has(filename)) {
            return this.versionCache.get(filename);
        }

        try {
            // HEADリクエストでファイルの最終更新時刻を取得
            const response = await fetch(filename, { method: 'HEAD' });
            const lastModified = response.headers.get('Last-Modified');
            
            if (lastModified) {
                const version = new Date(lastModified).getTime();
                this.versionCache.set(filename, version);
                return version;
            }
        } catch (error) {
            console.warn(`ファイルバージョン取得失敗: ${filename}`, error);
        }

        // フォールバック: 現在時刻を使用
        const fallbackVersion = this.baseVersion;
        this.versionCache.set(filename, fallbackVersion);
        return fallbackVersion;
    }

    /**
     * ファイルURLにバージョン番号を追加
     */
    async addVersionToUrl(url) {
        const version = await this.getFileVersion(url);
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}v=${version}`;
    }

    /**
     * スクリプトタグを動的に作成して読み込み
     */
    async loadScript(src) {
        const versionedSrc = await this.addVersionToUrl(src);
        const version = await this.getFileVersion(src);
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = versionedSrc;
            script.onload = () => {
                console.log(`✅ スクリプト読み込み完了: ${src} (v=${version})`);
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ スクリプト読み込み失敗: ${src}`);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * CSSファイルを動的に読み込み
     */
    async loadCSS(href) {
        const versionedHref = await this.addVersionToUrl(href);
        const version = await this.getFileVersion(href);
        
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = versionedHref;
            link.onload = () => {
                console.log(`✅ CSS読み込み完了: ${href} (v=${version})`);
                resolve();
            };
            link.onerror = () => {
                console.error(`❌ CSS読み込み失敗: ${href}`);
                reject(new Error(`Failed to load CSS: ${href}`));
            };
            document.head.appendChild(link);
        });
    }

    /**
     * 複数のスクリプトを順番に読み込み
     */
    async loadScriptsSequentially(scripts) {
        console.log('📦 スクリプト順次読み込み開始:', scripts.length, '件');
        
        for (const script of scripts) {
            try {
                await this.loadScript(script);
            } catch (error) {
                console.error(`スクリプト読み込みエラー: ${script}`, error);
                // エラーが発生しても続行
            }
        }
        
        console.log('✅ 全スクリプト読み込み完了');
    }

    /**
     * バージョン情報をクリア（開発用）
     */
    clearCache() {
        this.versionCache.clear();
        this.baseVersion = Date.now();
        console.log('🗑️ バージョンキャッシュをクリアしました');
    }

    /**
     * 現在のバージョン情報を表示（デバッグ用）
     */
    showVersionInfo() {
        console.log('📊 現在のバージョン情報:');
        for (const [file, version] of this.versionCache.entries()) {
            console.log(`  ${file}: ${version} (${new Date(version).toLocaleString()})`);
        }
    }
}

// グローバルインスタンス作成
window.cacheBuster = new CacheBuster();

// デバッグ用関数をグローバルに公開
window.clearFileCache = () => window.cacheBuster.clearCache();
window.showFileVersions = () => window.cacheBuster.showVersionInfo();

console.log('🚀 キャッシュ無効化システム初期化完了'); 