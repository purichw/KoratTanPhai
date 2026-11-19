export type LabelProjection = {
  x: (lon: number) => number;
  y: (lat: number) => number;
};

export type LabelGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

export type LabelTransform = {
  x: number;
  y: number;
  k: number;
};

export type MapLabelBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type LabelSize = { width: number; height: number };

export type MapLabelCandidate = {
  id: string;
  text: string;
  x: number;
  y: number;
  bounds: MapLabelBounds;
  interiorFit?: { placements: Array<Point & { available: LabelSize }>; text: LabelSize };
  minZoom: number;
  className?: string;
  force?: boolean;
  priority?: number;
  maxWidthRatio?: number;
  maxHeightRatio?: number;
  minFeatureArea?: number;
};

export type VisibleMapLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  strokeWidth: number;
  className?: string;
};

type Point = {
  x: number;
  y: number;
};

type ProjectedPolygon = Point[][];
type BoundaryEdge = [Point, Point];

type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type MapLabelOptions = {
  baseScreenFontSize?: number;
  minScreenFontSize?: number;
  maxScreenFontSize?: number;
  zoomFontBoost?: number;
  haloStrokeWidth?: number;
  collisionPadding?: number;
  maxWidthRatio?: number;
  maxHeightRatio?: number;
  forceMaxWidthRatio?: number;
  forceMaxHeightRatio?: number;
  minFeatureArea?: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

const emptyBounds: MapLabelBounds = {
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0,
};

const labelGridSteps = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectedPolygonsForGeometry(geometry: LabelGeometry, projection: LabelProjection): ProjectedPolygon[] {
  const polygons = geometry.type === "MultiPolygon"
    ? (geometry.coordinates as number[][][][])
    : ([geometry.coordinates] as number[][][][]);

  return polygons
    .map((polygon) =>
      polygon
        .map((ring) =>
          ring.map(([lon, lat]) => ({
            x: projection.x(lon),
            y: projection.y(lat),
          })),
        )
        .filter((ring) => ring.length > 0),
    )
    .filter((polygon) => polygon.length > 0);
}

function boundsForPoints(points: Point[]): MapLabelBounds {
  if (points.length === 0) return emptyBounds;

  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const { x, y } of points) {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  }
  return bounds;
}

function boundsForPolygons(polygons: ProjectedPolygon[]): MapLabelBounds {
  return boundsForPoints(polygons.flat(2));
}

function signedRingArea(ring: Point[]) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function ringCentroid(ring: Point[]): Point {
  const area = signedRingArea(ring);

  if (Math.abs(area) < 0.001) {
    const bounds = boundsForPoints(ring);
    return {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const cross = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }

  return {
    x: x / (6 * area),
    y: y / (6 * area),
  };
}

function pointInRing(point: Point, ring: Point[]) {
  let inside = false;
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const current = ring[index];
    const previous = ring[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    if (!crossesY) continue;
    const edgeX = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || Number.EPSILON) + current.x;
    if (point.x < edgeX) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Point, polygon: ProjectedPolygon) {
  const [outerRing, ...holes] = polygon;
  if (!outerRing || !pointInRing(point, outerRing)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

function pointInAnyPolygon(point: Point, polygons: ProjectedPolygon[]) {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function distanceSquared(first: Point, second: Point) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function distanceToBoundsEdge(point: Point, bounds: MapLabelBounds) {
  return Math.max(
    0,
    Math.min(point.x - bounds.minX, bounds.maxX - point.x, point.y - bounds.minY, bounds.maxY - point.y),
  );
}

function labelPointCandidates(polygons: ProjectedPolygon[], bounds: MapLabelBounds, steps = labelGridSteps) {
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const candidates: Point[] = [center];
  let weightedX = 0;
  let weightedY = 0;
  let weightTotal = 0;

  polygons.forEach((polygon) => {
    const outerRing = polygon[0];
    if (!outerRing) return;
    const area = Math.abs(signedRingArea(outerRing));
    const centroid = ringCentroid(outerRing);
    candidates.push(centroid);
    if (Number.isFinite(area) && area > 0) {
      weightedX += centroid.x * area;
      weightedY += centroid.y * area;
      weightTotal += area;
    }
  });

  const areaCenter = weightTotal > 0
    ? { x: weightedX / weightTotal, y: weightedY / weightTotal }
    : center;
  candidates.push(areaCenter);

  for (let xIndex = 1; xIndex < steps; xIndex += 1) {
    for (let yIndex = 1; yIndex < steps; yIndex += 1) {
      candidates.push({
        x: bounds.minX + ((bounds.maxX - bounds.minX) * xIndex) / steps,
        y: bounds.minY + ((bounds.maxY - bounds.minY) * yIndex) / steps,
      });
    }
  }
  return { center, areaCenter, candidates };
}

function bestInteriorPoint(polygons: ProjectedPolygon[], bounds: MapLabelBounds): Point {
  const { center, candidates } = labelPointCandidates(polygons, bounds);
  const interiorCandidates = candidates.filter((candidate) => pointInAnyPolygon(candidate, polygons));
  if (interiorCandidates.length === 0) return center;

  return interiorCandidates
    .map((candidate) => ({
      candidate,
      score: distanceSquared(candidate, center) - distanceToBoundsEdge(candidate, bounds) * 24,
    }))
    .sort((first, second) => first.score - second.score)[0].candidate;
}

export function projectedBoundsForGeometries(geometries: LabelGeometry[], projection: LabelProjection): MapLabelBounds {
  const polygons = geometries.flatMap((geometry) => projectedPolygonsForGeometry(geometry, projection));
  if (polygons.length === 0) return emptyBounds;
  return boundsForPolygons(polygons);
}

export function projectedLabelPointForGeometries(geometries: LabelGeometry[], projection: LabelProjection): Point {
  const polygons = geometries.flatMap((geometry) => projectedPolygonsForGeometry(geometry, projection));
  if (polygons.length === 0) return { x: 0, y: 0 };
  return bestInteriorPoint(polygons, boundsForPolygons(polygons));
}

export function projectedLabelPointForGeometry(geometry: LabelGeometry, projection: LabelProjection): Point {
  return projectedLabelPointForGeometries([geometry], projection);
}

function outlineEdges(polygons: ProjectedPolygon[]): BoundaryEdge[] {
  const singleOutline: BoundaryEdge[] = [];
  const edges = new Map<string, BoundaryEdge>();
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const vertexKeys = polygons.length > 1 ? ring.map(({ x, y }) => `${x},${y}`) : [];
      for (let index = 0; index < ring.length; index += 1) {
        const nextIndex = (index + 1) % ring.length;
        const first = ring[index];
        const next = ring[nextIndex];
        if (first.x === next.x && first.y === next.y) continue;
        if (polygons.length === 1) {
          singleOutline.push([first, next]);
          continue;
        }
        const firstKey = vertexKeys[index];
        const nextKey = vertexKeys[nextIndex];
        // Neighboring tambons traverse a shared district seam in opposite
        // directions. Drop the pair so the district name can span the seam.
        if (!edges.delete(`${nextKey}|${firstKey}`)) {
          edges.set(`${firstKey}|${nextKey}`, [first, next]);
        }
      }
    }
  }
  return polygons.length === 1 ? singleOutline : [...edges.values()];
}

function distanceToEdgeForSquare(point: Point, [first, next]: BoundaryEdge) {
  const x = first.x - point.x;
  const y = first.y - point.y;
  const dx = next.x - first.x;
  const dy = next.y - first.y;
  let distance = Math.min(
    Math.max(Math.abs(x), Math.abs(y)),
    Math.max(Math.abs(next.x - point.x), Math.abs(next.y - point.y)),
  );

  // max(|x|, |y|) changes slope at the diagonals of the square.
  const ascending = (y - x) / (dx - dy);
  const descending = (-x - y) / (dx + dy);
  if (ascending > 0 && ascending < 1) {
    distance = Math.min(distance, Math.abs(x + ascending * dx));
  }
  if (descending > 0 && descending < 1) {
    distance = Math.min(distance, Math.abs(x + descending * dx));
  }
  return distance;
}

function interiorSquares(polygons: ProjectedPolygon[], bounds: MapLabelBounds, aspect: number) {
  const steps = 10;
  const { center, areaCenter, candidates } = labelPointCandidates(polygons, bounds, steps);
  const centerDistance = (point: Point) =>
    ((point.x - areaCenter.x) * aspect) ** 2 + (point.y - areaCenter.y) ** 2;
  const edges = outlineEdges(polygons);
  const parts = polygons.map((polygon) => ({ polygon, bounds: boundsForPoints(polygon[0]) }));
  const placements: Array<{ point: Point; radius: number }> = [];
  let largest = { point: center, radius: 0 };
  const tryPoint = (point: Point) => {
    let radius = distanceToBoundsEdge(point, bounds);
    if (radius <= largest.radius || !parts.some(({ polygon, bounds: part }) =>
      point.x >= part.minX && point.x <= part.maxX && point.y >= part.minY && point.y <= part.maxY
        && pointInPolygon(point, polygon))) return;
    for (const edge of edges) {
      const [first, next] = edge;
      if ((first.x < point.x - radius && next.x < point.x - radius)
        || (first.x > point.x + radius && next.x > point.x + radius)
        || (first.y < point.y - radius && next.y < point.y - radius)
        || (first.y > point.y + radius && next.y > point.y + radius)) continue;
      radius = Math.min(radius, distanceToEdgeForSquare(point, edge));
      if (radius <= largest.radius) return;
    }
    largest = { point, radius };
    placements.push(largest);
  };

  // A farther point is useful only when it creates more room for the name.
  candidates.sort((first, next) => centerDistance(first) - centerDistance(next)).forEach(tryPoint);
  const stepX = (bounds.maxX - bounds.minX) / steps;
  const stepY = (bounds.maxY - bounds.minY) / steps;
  for (const scale of [0.5, 0.25, 0.125]) {
    const anchor = largest.point;
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        tryPoint({ x: anchor.x + dx * stepX * scale, y: anchor.y + dy * stepY * scale });
      }
    }
  }
  return { point: largest.point, placements: placements.sort((first, next) => centerDistance(first.point) - centerDistance(next.point)) };
}

export function projectedLabelPlacement(
  geometries: LabelGeometry[],
  projection: LabelProjection,
  textSize?: LabelSize,
): Pick<MapLabelCandidate, "x" | "y" | "bounds" | "interiorFit"> {
  // Scale the horizontal axis so a square represents a whole name and its halo.
  const aspect = textSize ? (12 * textSize.width + 4) / (12 * textSize.height + 4) : 1;
  const labelProjection = { x: (lon: number) => projection.x(lon) / aspect, y: projection.y };
  const polygons = geometries.flatMap((geometry) => projectedPolygonsForGeometry(geometry, labelProjection));
  if (polygons.length === 0) return { x: 0, y: 0, bounds: emptyBounds };
  const bounds = boundsForPolygons(polygons);
  if (!textSize) return { ...bestInteriorPoint(polygons, bounds), bounds };

  const { point, placements } = interiorSquares(polygons, bounds, aspect);
  return {
    x: point.x * aspect,
    y: point.y,
    bounds: { ...bounds, minX: bounds.minX * aspect, maxX: bounds.maxX * aspect },
    interiorFit: {
      text: textSize,
      placements: placements.map(({ point: anchor, radius }) => ({
        x: anchor.x * aspect,
        y: anchor.y,
        available: { width: radius * 2 * aspect, height: radius * 2 },
      })),
    },
  };
}

function estimatedTextWidth(text: string, screenFontSize: number) {
  return Array.from(text).reduce((width, character) => {
    if (/[\u0e00-\u0e7f]/.test(character)) return width + screenFontSize * 0.84;
    if (/[A-Z0-9]/.test(character)) return width + screenFontSize * 0.62;
    if (character === " ") return width + screenFontSize * 0.32;
    return width + screenFontSize * 0.54;
  }, 0);
}

export function createMapLabelMeasurer(fontFamily?: string): (text: string) => LabelSize {
  const estimate = (text: string) => ({ width: estimatedTextWidth(text, 1), height: 1.4 });
  if (!fontFamily) return estimate;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return estimate;

  // Match the map's SVG labels, measuring at a larger size to reduce rounding.
  const fontSize = 100;
  context.font = `900 ${fontSize}px ${fontFamily}`;
  context.textAlign = "center";
  return (text) => {
    const metrics = context.measureText(text);
    const inkWidth = 2 * Math.max(metrics.actualBoundingBoxLeft || 0, metrics.actualBoundingBoxRight || 0);
    const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
    return {
      width: 1.02 * Math.max(metrics.width, inkWidth) / fontSize,
      height: fontHeight > 0 ? fontHeight / fontSize : 1.4,
    };
  };
}

function overlaps(first: ScreenRect, second: ScreenRect, padding: number) {
  return !(
    first.right + padding < second.left ||
    first.left - padding > second.right ||
    first.bottom + padding < second.top ||
    first.top - padding > second.bottom
  );
}

function isOffscreen(rect: ScreenRect, viewportWidth?: number, viewportHeight?: number) {
  if (viewportWidth === undefined || viewportHeight === undefined) return false;
  return rect.right < 0 || rect.left > viewportWidth || rect.bottom < 0 || rect.top > viewportHeight;
}

export function makeVisibleMapLabels(
  candidates: MapLabelCandidate[],
  transform: LabelTransform,
  options: MapLabelOptions = {},
): VisibleMapLabel[] {
  const minScreenFontSize = options.minScreenFontSize ?? 9.2;
  const preferredScreenFontSize = clamp(
    (options.baseScreenFontSize ?? 10.5) + Math.max(0, transform.k - 1) * (options.zoomFontBoost ?? 0.9),
    minScreenFontSize,
    options.maxScreenFontSize ?? 13.6,
  );
  const haloStrokeWidth = options.haloStrokeWidth ?? 3.2;
  const collisionPadding = options.collisionPadding ?? 6;
  const acceptedRects: ScreenRect[] = [];

  return candidates
    .filter((candidate) => candidate.text.trim().length > 0)
    .sort((first, second) => {
      const forcePriority = Number(Boolean(second.force)) - Number(Boolean(first.force));
      if (forcePriority !== 0) return forcePriority;
      return (second.priority ?? 0) - (first.priority ?? 0);
    })
    .reduce<VisibleMapLabel[]>((labels, candidate) => {
      const featureScreenWidth = Math.max(0, candidate.bounds.maxX - candidate.bounds.minX) * transform.k;
      const featureScreenHeight = Math.max(0, candidate.bounds.maxY - candidate.bounds.minY) * transform.k;
      const featureScreenArea = featureScreenWidth * featureScreenHeight;
      const minFeatureArea = candidate.minFeatureArea ?? options.minFeatureArea ?? 900;
      if (!candidate.force && transform.k < candidate.minZoom) return labels;
      if (!candidate.force && featureScreenArea < minFeatureArea) return labels;

      const interior = candidate.interiorFit;
      const inset = interior ? haloStrokeWidth / 2 + 1 : 0;
      const lineHeight = interior?.text.height ?? 1.22;
      const textWidthPerPixel = interior?.text.width ?? estimatedTextWidth(candidate.text, 1);
      let { x, y } = candidate;
      let screenFontSize = preferredScreenFontSize;
      if (interior) {
        const fontSizes = interior.placements.map(({ available }) => Math.min(
          preferredScreenFontSize,
          (available.width * transform.k - 2 * inset) / textWidthPerPixel,
          (available.height * transform.k - 2 * inset) / lineHeight,
        ));
        const sizeThreshold = Math.max(minScreenFontSize, Math.max(...fontSizes) * 0.9);
        const index = fontSizes.findIndex((size) => size >= sizeThreshold);
        if (index < 0) return labels;
        ({ x, y } = interior.placements[index]);
        screenFontSize = fontSizes[index];
      }

      const textWidth = textWidthPerPixel * screenFontSize + 2 * inset;
      const screenLineHeight = screenFontSize * lineHeight + 2 * inset;
      const maxWidthRatio = candidate.force
        ? (options.forceMaxWidthRatio ?? 1.04)
        : (candidate.maxWidthRatio ?? options.maxWidthRatio ?? 0.72);
      const maxHeightRatio = candidate.force
        ? (options.forceMaxHeightRatio ?? 0.86)
        : (candidate.maxHeightRatio ?? options.maxHeightRatio ?? 0.66);
      if (!interior && (textWidth > featureScreenWidth * maxWidthRatio || screenLineHeight > featureScreenHeight * maxHeightRatio)) return labels;

      const screenX = x * transform.k + transform.x;
      const screenY = y * transform.k + transform.y;
      const rect = {
        left: screenX - textWidth / 2,
        right: screenX + textWidth / 2,
        top: screenY - screenLineHeight / 2,
        bottom: screenY + screenLineHeight / 2,
      };

      if (isOffscreen(rect, options.viewportWidth, options.viewportHeight)) return labels;
      if (!candidate.force && acceptedRects.some((accepted) => overlaps(rect, accepted, collisionPadding))) {
        return labels;
      }

      acceptedRects.push(rect);
      labels.push({
        id: candidate.id,
        text: candidate.text,
        x,
        y,
        className: candidate.className,
        fontSize: Number((screenFontSize / transform.k).toFixed(3)),
        strokeWidth: Number((haloStrokeWidth / transform.k).toFixed(3)),
      });
      return labels;
    }, []);
}
