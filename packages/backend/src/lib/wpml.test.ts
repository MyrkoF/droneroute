import { describe, it, expect } from "vitest";
import { buildWaylinesWpml } from "./wpml.js";
import {
  DEFAULT_MISSION_CONFIG,
  DEFAULT_WAYPOINT,
  type Mission,
} from "@droneroute/shared";

/**
 * "Toward POI" with no POI resolved used to write Null Island (0,0,0) into the
 * exported waylines, at every waypoint — the reachable path being: pick a
 * consumer drone (Mini 5 Pro), set Heading mode = Toward POI in Mission config,
 * and leave the waypoints on `useGlobalHeadingParam` (the default), so no
 * waypoint carries a `poiId`. Same outcome when a POI is deleted after being
 * assigned. Since `waypointHeadingAngleEnable` is 0 outside "fixed" mode, that
 * point is exactly what drives the gimbal.
 */
function mission(over: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    name: "test",
    createdAt: "2026-09-04T00:00:00Z",
    updatedAt: "2026-09-04T00:00:00Z",
    config: { ...DEFAULT_MISSION_CONFIG, dialect: "consumer" },
    waypoints: [
      {
        ...DEFAULT_WAYPOINT,
        index: 0,
        name: "WP1",
        latitude: 41.25,
        longitude: 0.93,
      },
      {
        ...DEFAULT_WAYPOINT,
        index: 1,
        name: "WP2",
        latitude: 41.26,
        longitude: 0.94,
      },
    ],
    pois: [],
    obstacles: [],
    ...over,
  };
}

describe("consumer waylines — toward POI without a POI", () => {
  it("never writes 0,0,0 as a POI point", () => {
    const m = mission();
    m.config.globalHeadingMode = "towardPOI";
    const xml = buildWaylinesWpml(m);
    expect(xml).not.toContain("0.000000,0.000000,0.000000");
    expect(xml).not.toContain("waypointPoiPoint");
  });

  it("falls back to a heading mode the aircraft can honour", () => {
    const m = mission();
    m.config.globalHeadingMode = "towardPOI";
    const xml = buildWaylinesWpml(m);
    expect(xml).not.toContain(
      "<wpml:waypointHeadingMode>towardPOI</wpml:waypointHeadingMode>",
    );
    expect(xml).toContain(
      "<wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>",
    );
  });

  it("degrades the same way when the assigned POI was deleted", () => {
    const m = mission();
    m.config.globalHeadingMode = "towardPOI";
    m.waypoints[0].useGlobalHeadingParam = false;
    m.waypoints[0].headingMode = "towardPOI";
    m.waypoints[0].poiId = "poi-supprime";
    const xml = buildWaylinesWpml(m);
    expect(xml).not.toContain("0.000000,0.000000,0.000000");
    expect(xml).not.toContain("waypointPoiPoint");
  });
});

describe("consumer waylines — toward POI with a real POI", () => {
  it("emits the POI point and keeps the towardPOI mode", () => {
    const m = mission({
      pois: [
        {
          id: "poi-1",
          name: "tour",
          latitude: 41.255,
          longitude: 0.935,
          height: 20,
        },
      ],
    });
    m.config.globalHeadingMode = "towardPOI";
    m.waypoints[0].useGlobalHeadingParam = false;
    m.waypoints[0].headingMode = "towardPOI";
    m.waypoints[0].poiId = "poi-1";
    const xml = buildWaylinesWpml(m);
    expect(xml).toContain(
      "<wpml:waypointPoiPoint>41.255,0.935,20</wpml:waypointPoiPoint>",
    );
    expect(xml).toContain(
      "<wpml:waypointHeadingMode>towardPOI</wpml:waypointHeadingMode>",
    );
  });
});

describe("consumer waylines — other heading modes are untouched", () => {
  it("keeps fixed mode and its angle enable flag", () => {
    const m = mission();
    m.config.globalHeadingMode = "fixed";
    const xml = buildWaylinesWpml(m);
    expect(xml).toContain(
      "<wpml:waypointHeadingMode>fixed</wpml:waypointHeadingMode>",
    );
    expect(xml).toContain(
      "<wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>",
    );
    expect(xml).not.toContain("waypointPoiPoint");
  });
});
