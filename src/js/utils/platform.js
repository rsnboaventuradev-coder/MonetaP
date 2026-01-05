/**
 * Platform Detection Utility
 * Detects the current runtime environment and provides platform-specific flags.
 */

class PlatformDetector {
    constructor() {
        this._detect();
    }

    _detect() {
        // Check for Electron
        this.isElectron = !!(
            typeof window !== 'undefined' &&
            window.electronAPI &&
            window.electronAPI.platform &&
            window.electronAPI.platform.isElectron
        );

        // Check for Capacitor
        this.isCapacitor = !!(
            typeof window !== 'undefined' &&
            window.Capacitor &&
            window.Capacitor.isNativePlatform &&
            window.Capacitor.isNativePlatform()
        );

        // Determine if web
        this.isWeb = !this.isElectron && !this.isCapacitor;

        // Determine mobile vs desktop
        if (this.isCapacitor) {
            // Capacitor is always mobile
            this.isMobile = true;
            this.isDesktop = false;
        } else if (this.isElectron) {
            // Electron is always desktop
            this.isMobile = false;
            this.isDesktop = true;
        } else {
            // Web: detect based on user agent and screen size
            this.isMobile = this._isMobileWeb();
            this.isDesktop = !this.isMobile;
        }

        // Get OS information
        this.os = this._getOS();

        // Log detection results
        console.log('Platform Detection:', {
            isElectron: this.isElectron,
            isCapacitor: this.isCapacitor,
            isWeb: this.isWeb,
            isMobile: this.isMobile,
            isDesktop: this.isDesktop,
            os: this.os
        });
    }

    _isMobileWeb() {
        // Check user agent for mobile indicators
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

        // Also check screen size
        const isSmallScreen = window.innerWidth <= 768;

        return mobileRegex.test(userAgent.toLowerCase()) || isSmallScreen;
    }

    _getOS() {
        if (this.isElectron && window.electronAPI?.platform?.os) {
            // Get OS from Electron
            const electronOS = window.electronAPI.platform.os;
            switch (electronOS) {
                case 'win32':
                    return 'windows';
                case 'darwin':
                    return 'macos';
                case 'linux':
                    return 'linux';
                default:
                    return electronOS;
            }
        }

        if (this.isCapacitor && window.Capacitor?.getPlatform) {
            // Get platform from Capacitor
            return window.Capacitor.getPlatform(); // 'ios', 'android', etc.
        }

        // Fallback: detect from user agent
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('win')) return 'windows';
        if (userAgent.includes('mac')) return 'macos';
        if (userAgent.includes('linux')) return 'linux';
        if (userAgent.includes('android')) return 'android';
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';

        return 'unknown';
    }

    /**
     * Check if a specific Capacitor plugin is available
     * @param {string} pluginName - Name of the plugin (e.g., 'Haptics', 'LocalNotifications')
     * @returns {boolean}
     */
    hasCapacitorPlugin(pluginName) {
        return !!(
            this.isCapacitor &&
            window.Capacitor?.Plugins &&
            window.Capacitor.Plugins[pluginName]
        );
    }

    /**
     * Get app version
     * @returns {string}
     */
    getAppVersion() {
        if (this.isElectron && window.electronAPI?.app?.version) {
            return window.electronAPI.app.version;
        }
        return '1.0.0'; // Fallback
    }
}

// Create singleton instance
const Platform = new PlatformDetector();

// Export as default
export default Platform;

// Also export as named export for convenience
export { Platform };


