export interface IHeapItem {
    heapIndex: number;
}

export class MinHeap<T extends IHeapItem> {
    private items: T[] = [];

    public get size(): number {
        return this.items.length;
    }

    public push(item: T, priority: number): void {
        (item as unknown as { priority: number }).priority = priority;
        item.heapIndex = this.items.length;
        this.items.push(item);
        this.bubbleUp(item.heapIndex);
    }

    public pop(): T | undefined {
        if (this.items.length === 0) return undefined;
        const min = this.items[0];
        const last = this.items.pop()!;
        if (this.items.length > 0) {
            this.items[0] = last;
            last.heapIndex = 0;
            this.bubbleDown(0);
        }
        return min;
    }

    public peek(): T | undefined {
        return this.items[0];
    }

    public contains(item: T): boolean {
        return item.heapIndex >= 0 && item.heapIndex < this.items.length && this.items[item.heapIndex] === item;
    }

    public updatePriority(item: T, newPriority: number): void {
        if (!this.contains(item)) return;
        const oldPriority = (item as unknown as { priority: number }).priority;
        (item as unknown as { priority: number }).priority = newPriority;
        if (newPriority < oldPriority) {
            this.bubbleUp(item.heapIndex);
        } else {
            this.bubbleDown(item.heapIndex);
        }
    }

    private bubbleUp(index: number): void {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.compare(this.items[index], this.items[parentIndex]) >= 0) break;
            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    private bubbleDown(index: number): void {
        const length = this.items.length;
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < length && this.compare(this.items[leftChild], this.items[smallest]) < 0) {
                smallest = leftChild;
            }
            if (rightChild < length && this.compare(this.items[rightChild], this.items[smallest]) < 0) {
                smallest = rightChild;
            }
            if (smallest === index) break;

            this.swap(index, smallest);
            index = smallest;
        }
    }

    private swap(i: number, j: number): void {
        const temp = this.items[i];
        this.items[i] = this.items[j];
        this.items[j] = temp;
        this.items[i].heapIndex = i;
        this.items[j].heapIndex = j;
    }

    private compare(a: T, b: T): number {
        return (a as unknown as { priority: number }).priority - (b as unknown as { priority: number }).priority;
    }
}
