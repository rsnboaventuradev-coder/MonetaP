
import { LocalNotifications } from '@capacitor/local-notifications';
import Platform from '../utils/platform.js';

export const NotificationService = {
    async init() {
        if (!Platform.isCapacitor) {
            // On desktop/web, use browser Notification API
            if ('Notification' in window && Notification.permission === 'default') {
                try {
                    await Notification.requestPermission();
                } catch (e) {
                    console.warn('Browser notifications not supported', e);
                }
            }
            return;
        }

        try {
            // Check permissions for Capacitor
            const perm = await LocalNotifications.checkPermissions();
            if (perm.display === 'prompt') {
                await LocalNotifications.requestPermissions();
            }
        } catch (e) {
            console.warn('Notifications not supported in this environment', e);
        }
    },

    async schedule(options) {
        if (!Platform.isCapacitor) {
            // Fallback: show browser notification immediately (can't schedule in browser)
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(options.title, {
                    body: options.body,
                    icon: '/logo.webp'
                });
            }
            return;
        }

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
        if (!Platform.isCapacitor) return [];

        try {
            const pending = await LocalNotifications.getPending();
            return pending.notifications;
        } catch (e) {
            return [];
        }
    },

    async cancelAll() {
        if (!Platform.isCapacitor) return;

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


