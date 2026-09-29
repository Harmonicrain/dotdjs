
export class ObjectPool<T> {
    private pool: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;
    private disposeObj: (obj: T) => void;

    constructor(factory: () => T, reset: (obj: T) => void, disposeObj: (obj: T) => void, initialSize: number = 0) {
        this.factory = factory;
        this.reset = reset;
        this.disposeObj = disposeObj;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    acquire(): T {
        const obj = this.pool.length > 0 ? this.pool.pop()! : this.factory();
        this.reset(obj); // Always reset, whether recycled or new
        return obj;
    }

    release(obj: T) {
        this.pool.push(obj);
    }

    dispose() {
        this.pool.forEach(obj => this.disposeObj(obj));
        this.pool = [];
    }
}
