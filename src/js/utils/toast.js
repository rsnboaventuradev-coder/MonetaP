export class Toast {
    static container = null;

    static init() {
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    static show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        // Base classes
        let classes = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border border-brand-border bg-brand-surface transform transition-all duration-300 translate-x-10 opacity-0 ';

        // Color classes (Border indicators)
        if (type === 'success') classes += 'border-l-4 border-l-brand-green';
        else if (type === 'error') classes += 'border-l-4 border-l-brand-red';
        else if (type === 'warning') classes += 'border-l-4 border-l-brand-gold';
        else classes += 'border-l-4 border-l-blue-500';

        toast.className = classes;

        const icon = this.getIcon(type);

        toast.innerHTML = `
            <div class="text-xl">${icon}</div>
            <div class="text-sm font-semibold text-brand-text-primary">${message}</div>
        `;

        this.container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-10', 'opacity-0');
        });

        // Auto Remove
        setTimeout(() => {
            toast.classList.add('translate-x-10', 'opacity-0');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    static getIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }
}


