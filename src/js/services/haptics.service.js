
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const HapticService = {
    async light() {
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch (e) {
            // Ignore if not supported
        }
    },

    async medium() {
        try {
            await Haptics.impact({ style: ImpactStyle.Medium });
        } catch (e) { }
    },

    async success() {
        try {
            await Haptics.notification({ type: NotificationType.Success });
        } catch (e) { }
    },

    async error() {
        try {
            await Haptics.notification({ type: NotificationType.Error });
        } catch (e) { }
    },

    async warning() {
        try {
            await Haptics.notification({ type: NotificationType.Warning });
        } catch (e) { }
    },

    async vibrate() {
        try {
            await Haptics.vibrate();
        } catch (e) { }
    }
};
