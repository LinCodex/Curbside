type Point = { lng: number; lat: number };
const WORLD_METERS = 40075016.686;
const project = ({ lng, lat }: Point) => ({
  x: (lng + 180) / 360,
  y: (1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2,
});
const unproject = (x: number, y: number): [number, number] => [
  x * 360 - 180,
  (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
];

/** Center on the busiest 2 km neighborhood, with enough extent for outliers. */
export function ticketOverview(points: Point[]) {
  if (!points.length) return null;
  const projected = points.map(project).sort((a, b) => a.x - b.x || a.y - b.y);
  const radius = 2000 / (WORLD_METERS * Math.cos((40.7 * Math.PI) / 180));
  let group = [projected[0]],
    bestDistance = Infinity;
  for (const candidate of projected) {
    const neighbors = projected.filter(
      (p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) <= radius,
    );
    const distance = projected.reduce(
      (sum, p) => sum + Math.hypot(p.x - candidate.x, p.y - candidate.y),
      0,
    );
    if (
      neighbors.length > group.length ||
      (neighbors.length === group.length && distance < bestDistance)
    ) {
      group = neighbors;
      bestDistance = distance;
    }
  }
  const x = group.reduce((sum, p) => sum + p.x, 0) / group.length;
  const y = group.reduce((sum, p) => sum + p.y, 0) / group.length;
  // Symmetric Mercator bounds keep the cluster in the actual screen center.
  const dx = Math.max(radius / 4, ...projected.map((p) => Math.abs(p.x - x)));
  const dy = Math.max(radius / 4, ...projected.map((p) => Math.abs(p.y - y)));
  return {
    center: unproject(x, y),
    bounds: [unproject(x - dx, y + dy), unproject(x + dx, y - dy)] as [
      [number, number],
      [number, number],
    ],
  };
}
