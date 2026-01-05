/**
 * Simple Observable Pattern (Signal-like)
 * Allows creating reactive stores.
 */
export class Observable {
    constructor(initialState) {
        this._state = initialState;
        this._listeners = new Set();
    }

    get value() {
        return this._state;
    }

    set value(newState) {
        this._state = newState;
        this.notify();
    }

    /**
     * Update state partially (for objects)
     * @param {Object} partialState 
     */
    update(partialState) {
        if (typeof this._state === 'object' && this._state !== null) {
            this._state = { ...this._state, ...partialState };
            this.notify();
        } else {
            this.value = partialState;
        }
    }

    /**
     * Subscribe to changes
     * @param {Function} listener - Callback function(state)
     * @returns {Function} unsubscribe function
     */
    subscribe(listener) {
        this._listeners.add(listener);
        // Call immediately with current state allow immediate render
        // listener(this._state); // Optional: Preact Signals don't do this, but Svelte stores do. Let's keep manual init for now to avoid side effects during init.

        return () => this._listeners.delete(listener);
    }

    notify() {
        this._listeners.forEach(listener => listener(this._state));
    }
}


