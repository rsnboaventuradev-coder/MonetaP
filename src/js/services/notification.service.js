
import { LocalNotifications } from '@capacitor/local-notifications';

export const NotificationService = {
    async init() {
        try {
            // Check permissions
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display === 'prompt') {
                await LocalNotifications.requestPermissions();
            }
        } catch (e) {
            console.warn('Notifications not supported in this environment (Browser/Web)', e);
        }
    },

    async schedule(options) {
        try {
            await LocalNotifications.schedule({
                notifications: [
                    {
                        title: options.title,
                        body: options.body,
                        id: options.id || Math.floor(Math.random() * 100000),
                        schedule: { at: options.at },
                        sound: null,
                        attachments: null,
                        actionTypeId: '',
                        extra: null
                    }
                ]
            });
            console.log(`Notification scheduled: ${options.title} at ${options.at}`);
        } catch (e) {
            console.error('Error scheduling notification:', e);
        }
    },

    async getAllPending() {
        try {
            const pending = await LocalNotifications.getPending();
            return pending.notifications;
        } catch (e) {
            return [];
        }
    },

    async cancelAll() {
        try {
            const pending = await this.getAllPending();
            if (pending.length > 0) {
                await LocalNotifications.cancel({ notifications: pending });
            }
        } catch (e) {
            console.error('Error cancelling notifications:', e);
        }
    }
};

// Auto-init on import? No, let main app call it.
