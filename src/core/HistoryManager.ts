export class HistoryManager<T> {
    private past: T[] = []
    private future: T[] = []

    private transactionSnapshot: T | null = null

    constructor(private present: T) {}

    get value(): T {
        return this.present
    }

    public push(next: T) {
        // If inside transaction, don't push immediately
        if (this.transactionSnapshot !== null) {
            this.present = next
            return
        }

        this.past.push(this.present)
        this.present = next
        this.future = []
    }

    public begin() {
        if (this.transactionSnapshot !== null) return
        this.transactionSnapshot = this.present
    }

    public commit() {
        if (this.transactionSnapshot === null) return

        this.past.push(this.transactionSnapshot)
        this.future = []
        this.transactionSnapshot = null
    }

    public cancel() {
        if (this.transactionSnapshot === null) return

        this.present = this.transactionSnapshot
        this.transactionSnapshot = null
    }

    public undo(): T | null {
        if (this.past.length === 0) return null

        const previous = this.past.pop() as T
        this.future.unshift(this.present)
        this.present = previous

        return this.present
    }

    public redo(): T | null {
        if (this.future.length === 0) return null

        const next = this.future.shift() as T
        this.past.push(this.present)
        this.present = next

        return this.present
    }
}
