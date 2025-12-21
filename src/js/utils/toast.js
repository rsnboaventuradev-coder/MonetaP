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
        let classes = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border border-white/10 transform transition-all duration-300 translate-x-10 opacity-0 ';

        // Color classes
        if (type === 'success') classes += 'bg-green-600/90 shadow-lg';
        else if (type === 'error') classes += 'bg-red-600/90 shadow-lg';
        else if (type === 'warning') classes += 'bg-yellow-600/90 shadow-lg';
        else classes += 'bg-gray-800/90 shadow-lg';

        toast.className = classes;

        const icon = this.getIcon(type);

        toast.innerHTML = `
            <div class="text-xl">${icon}</div>
            <div class="text-sm font-semibold text-white">${message}</div>
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
