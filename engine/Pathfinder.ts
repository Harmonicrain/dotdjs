
/**
 * Generic A* Pathfinder implementation.
 * 
 * Works on any graph where nodes are of type T.
 */
export interface IPathfinderNode<T> {
    id: T;
    g: number; // Cost from start to this node
    h: number; // Estimated cost from this node to goal
    f: number; // Total cost (g + h)
    parent: IPathfinderNode<T> | null;
}

export class Pathfinder<T> {
    /**
     * Finds the shortest path between start and goal.
     * 
     * @param start The starting node ID.
     * @param goal The goal node ID.
     * @param getNeighbors A function that returns neighboring node IDs and the cost to reach them.
     * @param heuristic A function that estimates the cost from a node to the goal.
     * @returns A list of node IDs representing the path, or null if no path is found.
     */
    public static findPath<T>(
        start: T,
        goal: T,
        getNeighbors: (nodeId: T) => { id: T, cost: number }[],
        heuristic: (nodeId: T, goalId: T) => number
    ): T[] | null {
        if (start === goal) return [start];

        const openList: Map<T, IPathfinderNode<T>> = new Map();
        const closedList: Set<T> = new Set();

        const startNode: IPathfinderNode<T> = {
            id: start,
            g: 0,
            h: heuristic(start, goal),
            f: 0,
            parent: null
        };
        startNode.f = startNode.g + startNode.h;
        openList.set(start, startNode);

        while (openList.size > 0) {
            // Find node with lowest f in open list
            let current: IPathfinderNode<T> | null = null;
            for (const node of openList.values()) {
                if (!current || node.f < current.f) {
                    current = node;
                }
            }

            if (!current) break;

            if (current.id === goal) {
                // Path found, reconstruct it
                const path: T[] = [];
                let temp: IPathfinderNode<T> | null = current;
                while (temp) {
                    path.unshift(temp.id);
                    temp = temp.parent;
                }
                return path;
            }

            openList.delete(current.id);
            closedList.add(current.id);

            const neighbors = getNeighbors(current.id);
            for (const neighborData of neighbors) {
                if (closedList.has(neighborData.id)) continue;

                const gScore = current.g + neighborData.cost;
                let neighborNode = openList.get(neighborData.id);

                if (!neighborNode) {
                    neighborNode = {
                        id: neighborData.id,
                        g: gScore,
                        h: heuristic(neighborData.id, goal),
                        f: 0,
                        parent: current
                    };
                    neighborNode.f = neighborNode.g + neighborNode.h;
                    openList.set(neighborData.id, neighborNode);
                } else if (gScore < neighborNode.g) {
                    neighborNode.g = gScore;
                    neighborNode.f = neighborNode.g + neighborNode.h;
                    neighborNode.parent = current;
                }
            }
        }

        return null; // No path found
    }
}
