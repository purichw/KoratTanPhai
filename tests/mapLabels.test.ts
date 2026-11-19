import { describe, expect, it } from "vitest";
import { makeVisibleMapLabels, projectedLabelPlacement, type LabelGeometry } from "../src/mapLabels";

const projection = { x: (x: number) => x, y: (y: number) => y };
const textSize = { width: 3, height: 1.25 };
const rectangle = (left: number, top: number, right: number, bottom: number) =>
  [[left, top], [right, top], [right, bottom], [left, bottom], [left, top]];
const polygon = (...rings: number[][][]): LabelGeometry => ({ type: "Polygon", coordinates: rings });

describe("map labels inside boundaries", () => {
  it("uses the district outline across shared subdistrict borders", () => {
    const placement = projectedLabelPlacement(
      [polygon(rectangle(0, 0, 10, 10)), polygon(rectangle(10, 0, 20, 10))],
      projection,
      textSize,
    );
    expect(placement.x).toBeCloseTo(10);
    expect(Math.max(...placement.interiorFit!.placements.map(({ available }) => available.width))).toBeCloseTo(20);
  });

  it("keeps a label clear of a hole and reveals it when there is room at a readable size", () => {
    const placement = projectedLabelPlacement(
      [polygon(rectangle(0, 0, 30, 30), rectangle(8, 8, 22, 22))],
      projection,
      textSize,
    );
    for (const { x, y, available: room } of placement.interiorFit!.placements) {
      expect(y + room.height / 2 <= 8 || y - room.height / 2 >= 22
        || x + room.width / 2 <= 8 || x - room.width / 2 >= 22).toBe(true);
    }
    const candidate = { ...placement, id: "area", text: "ชื่อพื้นที่", minZoom: 0, force: true };
    expect(makeVisibleMapLabels([candidate], { x: 0, y: 0, k: 1 })).toEqual([]);
    expect(makeVisibleMapLabels([candidate], { x: 0, y: 0, k: 3 })).toHaveLength(1);
  });
});
