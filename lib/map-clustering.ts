export type ProjectedMapPoint<T> = { item: T; x: number; y: number };
export type MapCluster<T> = { items: T[]; x: number; y: number };

export function clusterMapPoints<T>(points: ProjectedMapPoint<T>[], radius = 48): MapCluster<T>[] {
  if (radius <= 0) return points.map(({ item, x, y }) => ({ items: [item], x, y }));

  const parents = points.map((_, index) => index);
  const buckets = new Map<string, number[]>();
  const radiusSquared = radius * radius;
  const find = (index: number): number => parents[index] === index ? index : (parents[index] = find(parents[index]));
  const join = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  points.forEach((point, index) => {
    const column = Math.floor(point.x / radius);
    const row = Math.floor(point.y / radius);
    for (let x = column - 1; x <= column + 1; x += 1) {
      for (let y = row - 1; y <= row + 1; y += 1) {
        for (const candidateIndex of buckets.get(`${x}:${y}`) ?? []) {
          const candidate = points[candidateIndex];
          const deltaX = point.x - candidate.x;
          const deltaY = point.y - candidate.y;
          if (deltaX * deltaX + deltaY * deltaY <= radiusSquared) join(index, candidateIndex);
        }
      }
    }
    const key = `${column}:${row}`;
    buckets.set(key, [...(buckets.get(key) ?? []), index]);
  });

  const groups = new Map<number, ProjectedMapPoint<T>[]>();
  points.forEach((point, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), point]);
  });

  return [...groups.values()].map((group) => ({
    items: group.map((point) => point.item),
    x: group.reduce((sum, point) => sum + point.x, 0) / group.length,
    y: group.reduce((sum, point) => sum + point.y, 0) / group.length,
  }));
}
