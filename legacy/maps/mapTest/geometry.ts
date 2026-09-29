import { GeometryDefinition } from '../../types/world';

/** Data-driven octagon arena geometry for use in MapTestDefinition. */
export const generateOctagonGeometry = (radius: number, wallHeight: number, thickness: number): GeometryDefinition[] => {
    const geo: GeometryDefinition[] = [];
    const sideCount = 8;
    const sliceAngle = (Math.PI * 2) / sideCount;
    const apothem = radius * Math.cos(sliceAngle / 2);
    const sideLength = 2 * radius * Math.sin(sliceAngle / 2);

    // Floor
    geo.push({
        type: 'box',
        pos: [0, -0.1, 0],
        size: [radius * 2.2, 0.2, radius * 2.2],
        texture: 'floor',
        uvScale: 20
    });

    for (let i = 0; i < sideCount; i++) {
        const angle = (i * sliceAngle) + (sliceAngle / 2);
        const dist = apothem + (thickness / 2);
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const rotY = -angle + Math.PI / 2;

        geo.push({
            type: 'box',
            pos: [x, wallHeight / 2, z],
            size: [sideLength + 0.5, wallHeight, thickness],
            rotation: [0, rotY, 0],
            texture: 'wall',
            uvScale: 0.25
        });
    }

    return geo;
};
