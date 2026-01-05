
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import Platform from '../utils/platform.js';

export const HapticService = {
    async light() {
        if (!Platform.isCapacitor) return; // Skip on desktop/web
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch (e) {
            // Ignore if not supported
        }
    },

    async medium() {
        if (!Platform.isCapacitor) return; // Skip on desktop/web
        try {
            await Haptics.impact({ style: ImpactStyle.Medium });
        } catch (e) { }
    },

    async success() {
        if (!Platform.isCapacitor) return; // Skip on desktop/web
        try {
            await Haptics.notification({ type: NotificationType.Success });
        } catch (e) { }
    },

    async error() {
        if (!Platform.isCapacitor) return; // Skip on desktop/web
        try {
            await Haptics.notification({ type: NotificationType.Error });
        } catch (e) { }
    },

    async warning() {
        if (!Platform.isCapacitor) return; // Skip on desktop/web
        try {
            await Haptics.notification({ type: NotificationType.Warning });
        } catch (e) { }
    },

    async vibrate() {
        if (!Platform.isCapacitor) return; // Skip on desktop/web
        try {
            await Haptics.vibrate();
        } catch (e) { }
    }
};


