import { MinHeap } from "./MinHeap";

/**
 * Generic A* Pathfinder implementation.
 * 
 * Works on any graph where nodes are of type T.
 */
export interface IPathfinderNode<T> {
    id: T;
    g: number;
    h: number;
    f: number;
    parent: IPathfinderNode<T> | null;
    heapIndex: number;
}

export class Pathfinder<T> {
    public static findPath<T>(
        start: T,
        goal: T,
        getNeighbors: (nodeId: T) => { id: T, cost: number }[],
        heuristic: (nodeId: T, goalId: T) => number
    ): T[] | null {
        if (start === goal) return [start];

        const openHeap = new MinHeap<IPathfinderNode<T>>();
        const openMap = new Map<T, IPathfinderNode<T>>();
        const closedList: Set<T> = new Set();

        const startNode: IPathfinderNode<T> = {
            id: start,
            g: 0,
            h: heuristic(start, goal),
            f: 0,
            parent: null,
            heapIndex: -1
        };
        startNode.f = startNode.g + startNode.h;
        openHeap.push(startNode, startNode.f);
        openMap.set(start, startNode);

        while (openHeap.size > 0) {
            const current = openHeap.pop();
            if (!current) break;

            openMap.delete(current.id);

            if (current.id === goal) {
                const path: T[] = [];
                let temp: IPathfinderNode<T> | null = current;
                while (temp) {
                    path.unshift(temp.id);
                    temp = temp.parent;
                }
                return path;
            }

            closedList.add(current.id);

            const neighbors = getNeighbors(current.id);
            for (const neighborData of neighbors) {
                if (closedList.has(neighborData.id)) continue;

                const gScore = current.g + neighborData.cost;
                const existingNode = openMap.get(neighborData.id);

                if (!existingNode) {
                    const neighborNode: IPathfinderNode<T> = {
                        id: neighborData.id,
                        g: gScore,
                        h: heuristic(neighborData.id, goal),
                        f: 0,
                        parent: current,
                        heapIndex: -1
                    };
                    neighborNode.f = neighborNode.g + neighborNode.h;
                    openHeap.push(neighborNode, neighborNode.f);
                    openMap.set(neighborData.id, neighborNode);
                } else if (gScore < existingNode.g) {
                    existingNode.g = gScore;
                    existingNode.f = existingNode.g + existingNode.h;
                    existingNode.parent = current;
                    openHeap.updatePriority(existingNode, existingNode.f);
                }
            }
        }

        return null;
    }
}
