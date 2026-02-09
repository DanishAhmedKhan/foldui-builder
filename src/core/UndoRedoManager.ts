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
        if (!this.past.length) return null
        this.future.unshift(this.present)
        this.present = this.past.pop()!
        return this.present
    }

    public redo(): T | null {
        if (!this.future.length) return null
        this.past.push(this.present)
        this.present = this.future.shift()!
        return this.present
    }
}
