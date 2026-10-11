export type SvgCamera = { k: number; x: number; y: number };
export type ViewBox = { x: number; y: number; width: number; height: number };

export const IDENTITY_CAMERA: SvgCamera = { k: 1, x: 0, y: 0 };
export const MAX_SVG_ZOOM = 8;

export function parseViewBox(value: string): ViewBox {
  const [x, y, width, height] = value.split(/[\s,]+/).map(Number);
  return { x, y, width, height };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Keeps the zoomed content covering the whole view box. */
export function clampCamera(camera: SvgCamera, box: ViewBox): SvgCamera {
  const k = clamp(camera.k, 1, MAX_SVG_ZOOM);
  return {
    k,
    x: clamp(camera.x, (box.x + box.width) * (1 - k), box.x * (1 - k)) || 0,
    y: clamp(camera.y, (box.y + box.height) * (1 - k), box.y * (1 - k)) || 0,
  };
}

/** Scales by `factor` while keeping the view-box point under the gesture fixed. */
export function zoomCamera(
  camera: SvgCamera,
  point: { x: number; y: number },
  factor: number,
  box: ViewBox,
): SvgCamera {
  const k = clamp(camera.k * factor, 1, MAX_SVG_ZOOM);
  const ratio = k / camera.k;
  return clampCamera(
    {
      k,
      x: point.x - (point.x - camera.x) * ratio,
      y: point.y - (point.y - camera.y) * ratio,
    },
    box,
  );
}

export function panCamera(
  camera: SvgCamera,
  dx: number,
  dy: number,
  box: ViewBox,
): SvgCamera {
  return clampCamera({ ...camera, x: camera.x + dx, y: camera.y + dy }, box);
}
