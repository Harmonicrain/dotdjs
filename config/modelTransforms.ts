/** Transform applied to a GLB model after parenting to its root node. */
export interface ModelTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scaling: [number, number, number];
}

/** Default GLB transforms per model key. Maps can override in their config.ts. */
export const DEFAULT_MODEL_TRANSFORMS: Record<string, ModelTransform> = {
  juggernog: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scaling: [-1.50, 1.50, 1.50],
  },
  speed_cola: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scaling: [-0.035, 0.035, 0.035],
  },
  quick_revive: {
    position: [0, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    scaling: [-0.03, 0.03, 0.03],
  },
  pack_a_punch: {
    position: [0.5, 0, 0],
    rotation: [0, 0, 0],
    scaling: [-1.5, 1.5, 1.5],
  },
  power_switch: {
    position: [0, 0, -0.15],
    rotation: [0, Math.PI, 0],
    scaling: [-0.0025, 0.0025, 0.0025],
  },
  m1911_fps: {
    position: [0, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    scaling: [0.00012, 0.00012, 0.00012],
  },
  m1911_world: {
    position: [0, 0, 0],
    rotation: [Math.PI / 2, 0, 0],
    scaling: [0.00012, 0.00012, 0.00012],
  },
  ray_gun_fps: {
    position: [0, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    scaling: [0.3615, 0.3615, 0.3615],
  },
  ray_gun_world: {
    position: [0, 0, 0],
    rotation: [Math.PI / 2, Math.PI, 0],
    scaling: [0.482, 0.482, 0.482],
  },
};

/** Merge a partial override on top of defaults. */
export function resolveModelTransform(
  modelKey: string,
  override?: Partial<ModelTransform>
): ModelTransform {
  const base = DEFAULT_MODEL_TRANSFORMS[modelKey] ?? {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scaling: [1, 1, 1],
  };
  return {
    position: override?.position ?? base.position,
    rotation: override?.rotation ?? base.rotation,
    scaling: override?.scaling ?? base.scaling,
  };
}
