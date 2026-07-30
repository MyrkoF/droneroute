/**
 * FAA airspace provider – United States.
 *
 * Source: the FAA Aeronautical Information Services authoritative ArcGIS REST
 * services (the same data exposed by the FAA UAS Data Delivery System,
 * udds-faa.opendata.arcgis.com). All layers are public US Government data
 * (public domain), no API key required.
 *   org:   services6.arcgis.com/ssFJjBXIUyZDrSYZ
 *   owner: AeronauticalInformationServices_FAA
 *
 * Layers selected for drone (Part 107 / recreational) relevance:
 *  - National Security UAS Flight Restrictions (14 CFR 99.7) – hard no-fly over
 *    designated DoD / national-security sites → "prohibited".
 *  - Prohibited Areas (P-xx, e.g. P-56 over the White House) → "prohibited".
 *  - UAS Facility Map (LAANC ceiling grid) – the maximum altitude at which a
 *    LAANC authorization may be granted near controlled airports; a 0 ft
 *    ceiling means no automatic approval → "restricted", ceiling reported.
 *
 * Pitfalls:
 *  - Every FAA altitude is in FEET; we convert to metres for altitudeLower /
 *    altitudeUpper and keep the original wording in the description.
 *  - National Security Floor/Ceiling are FREE TEXT ("Surface", "400' AGL"),
 *    not numbers, so for that layer altitude goes to the description only.
 *  - The UAS Facility Map is a dense ~1 NM grid: a city-scale viewport can
 *    return thousands of cells, so we cap with resultRecordCount and rely on
 *    the bbox filter. Areas with no LAANC (e.g. the Washington DC SFRA)
 *    legitimately return zero cells.
 */

import type {
  AirspaceProvider,
  AirspaceZone,
  BBox,
  ZoneSeverity,
} from "./types.js";

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

type Props = Record<string, unknown>;

interface FaaLayer {
  /** ArcGIS FeatureServer URL up to and including the layer id. */
  url: string;
  severity: ZoneSeverity;
  category: string;
  /** Field used as stable id. Falls back to OBJECTID. */
  idField: string;
  /** Build a human-readable zone name from the feature properties. */
  buildName: (p: Props) => string;
  /** Build an optional description from the feature properties. */
  buildDescription: (p: Props) => string | undefined;
  /** Numeric field (feet) → altitudeUpper in metres. */
  upperFtField?: string;
  /** Numeric field (feet) → altitudeLower in metres. */
  lowerFtField?: string;
}

const BASE =
  "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services";

const LAYERS: FaaLayer[] = [
  {
    // National Security UAS Flight Restrictions – 14 CFR 99.7
    url: `${BASE}/DoD_Mar_13/FeatureServer/0`,
    severity: "prohibited",
    category: "national-security",
    idField: "FAA_ID",
    buildName: (p) =>
      joinNonEmpty([str(p.Base), str(p.Facility)], " – ") ||
      "National security UAS flight restriction",
    buildDescription: (p) =>
      pieces([
        str(p.Reason),
        str(p.Airspace),
        str(p.Branch),
        labelled("Floor", str(p.Floor)),
        labelled("Ceiling", str(p.Ceiling)),
      ]),
  },
  {
    // Prohibited areas – P-xx
    url: `${BASE}/Prohibited_Areas/FeatureServer/0`,
    severity: "prohibited",
    category: "prohibited-area",
    idField: "GLOBAL_ID",
    upperFtField: "UPPER_VAL",
    lowerFtField: "LOWER_VAL",
    buildName: (p) => str(p.NAME) || "Prohibited area",
    buildDescription: (p) =>
      pieces([
        str(p.COMM_NAME),
        joinNonEmpty([str(p.CITY), str(p.STATE)], ", "),
        ftRange(p.LOWER_VAL, p.UPPER_VAL, str(p.UPPER_CODE) || "MSL"),
        str(p.REMARKS),
      ]),
  },
  {
    // UAS Facility Map – LAANC ceiling grid
    url: `${BASE}/FAA_UAS_FacilityMap_Data_Primary/FeatureServer/0`,
    severity: "restricted",
    category: "uas-facility-map",
    idField: "GLOBALID",
    upperFtField: "CEILING",
    buildName: (p) =>
      joinNonEmpty([str(p.APT1_NAME), "UAS facility map"], " – ") ||
      "UAS facility map",
    buildDescription: (p) => {
      const ceiling = numOrUndef(p.CEILING);
      const parts = [
        ceiling === undefined
          ? undefined
          : ceiling === 0
            ? "LAANC ceiling: 0 ft AGL (no automatic authorization)"
            : `LAANC ceiling: ${ceiling} ft AGL`,
        str(p.APT1_ICAO) ? `Airport: ${str(p.APT1_ICAO)}` : undefined,
        str(p.AIRSPACE_1) ? `Class ${str(p.AIRSPACE_1)} airspace` : undefined,
      ];
      return pieces(parts);
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rough bounding box around the United States (incl. Alaska, Hawaii, PR). */
const US_BOUNDS: BBox = {
  south: 15.0,
  west: -172.0,
  north: 72.0,
  east: -64.0,
};

const FEET_TO_METRES = 0.3048;

function boundsOverlap(a: BBox, b: BBox): boolean {
  return (
    a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south
  );
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function ftToMetres(v: unknown): number | undefined {
  const ft = numOrUndef(v);
  return ft === undefined ? undefined : Math.round(ft * FEET_TO_METRES);
}

function joinNonEmpty(parts: string[], sep: string): string {
  return parts.filter((s) => s.length > 0).join(sep);
}

function labelled(label: string, value: string): string {
  return value ? `${label}: ${value}` : "";
}

function ftRange(lower: unknown, upper: unknown, ref: string): string {
  const lo = numOrUndef(lower);
  const hi = numOrUndef(upper);
  if (lo === undefined && hi === undefined) return "";
  const loTxt = lo === undefined ? "SFC" : `${lo} ft`;
  const hiTxt = hi === undefined ? "UNL" : `${hi} ft`;
  return `${loTxt} – ${hiTxt} ${ref}`.trim();
}

/** Join non-empty description pieces, returning undefined when all are empty. */
function pieces(parts: (string | undefined)[]): string | undefined {
  const out = parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" · ");
  return out.length > 0 ? out : undefined;
}

function bboxToEnvelope(b: BBox): string {
  return `${b.west},${b.south},${b.east},${b.north}`;
}

async function queryLayer(
  layer: FaaLayer,
  bounds: BBox,
): Promise<AirspaceZone[]> {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: bboxToEnvelope(bounds),
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outSR: "4326",
    outFields: "*",
    returnGeometry: "true",
    f: "geojson",
    resultRecordCount: "2000",
  });

  const url = `${layer.url}/query?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAA: failed to query ${layer.url} – ${res.status}`);
    return [];
  }

  const json = (await res.json()) as {
    features?: Array<{
      geometry: Record<string, unknown> | null;
      properties?: Props;
    }>;
  };
  if (!json.features) return [];

  return json.features
    .filter((f) => f.geometry != null)
    .map((f): AirspaceZone => {
      const p = f.properties ?? {};
      return {
        id: str(p[layer.idField]) || str(p.OBJECTID),
        name: layer.buildName(p),
        severity: layer.severity,
        geometry: f.geometry as Record<string, unknown>,
        altitudeLower: layer.lowerFtField
          ? ftToMetres(p[layer.lowerFtField])
          : undefined,
        altitudeUpper: layer.upperFtField
          ? ftToMetres(p[layer.upperFtField])
          : undefined,
        description: layer.buildDescription(p),
        category: layer.category,
        source: "faa",
      };
    });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const faaProvider: AirspaceProvider = {
  id: "faa",
  name: "United States (FAA)",

  async fetchZones(bounds: BBox): Promise<AirspaceZone[]> {
    // Skip if the viewport doesn't overlap the US at all.
    if (!boundsOverlap(bounds, US_BOUNDS)) {
      return [];
    }

    const results = await Promise.allSettled(
      LAYERS.map((layer) => queryLayer(layer, bounds)),
    );

    const zones: AirspaceZone[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        zones.push(...r.value);
      }
    }
    return zones;
  },
};
