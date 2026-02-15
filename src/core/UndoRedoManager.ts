export class UndoRedoManager<T> {
    private past: T[] = []
    private future: T[] = []

    constructor(private present: T) {}

    get value(): T {
        return this.present
    }

    public push(next: T) {
        this.past.push(this.present)
        this.present = next
        this.future = []
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
