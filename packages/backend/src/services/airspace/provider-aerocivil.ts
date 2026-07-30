/**
 * Aerocivil airspace provider – Colombia.
 *
 * Source: "Visor Geográfico UAS", the official public drone-restriction map
 * published by the Unidad Administrativa Especial de Aeronáutica Civil
 * (Aerocivil) as an ArcGIS Online FeatureServer (service UAS_WEBLAYER). Public,
 * no API key required.
 *
 * Service resolution: the direct service host
 * (services7.arcgis.com/oJtolNh5k8HxCVtB) is NOT a contractual URL and can
 * change if Aerocivil republishes the service. We therefore resolve it at
 * runtime from the public web map item 3c762b4735e54843ada7e206580dc48f – whose
 * single operational layer is a GroupLayer whose sub-layers carry the
 * FeatureServer URLs – and fall back to the last known direct URL if the
 * resolution fails. The resolved base is cached for 24 h.
 *
 * Layers selected (drone relevance). Point layers 10/20/30 (airports /
 * heliports) are reference points, not restriction zones, so they are omitted;
 * the corresponding buffer polygons (40/50/60/70) carry the actual restriction.
 *  - 110 ZONA_NO_VUELO_DRONES (ZNVD) – explicit drone no-fly zones → prohibited
 *  - 80  ÁREAS_AIP – P/R/D & training areas; severity from CLASIFICACIÓN
 *  - 90  AVIACIÓN_DEPORTIVA → restricted
 *  - 50 / 40 airport 9 km / 6 km buffers → restricted
 *  - 60 / 70 heliport 3 km buffers → restricted
 *  - 100 INFRAESTRUCTURA_AERONAUTICA → restricted
 *
 * Pitfalls:
 *  - Field names carry accents (UBICACIÓN, CLASIFICACIÓN); we request
 *    outFields=* to avoid URL-encoding issues.
 *  - Vertical limits (LIMITES_VERTICALES) are free text with mixed references
 *    ("GND / 18500 FT AGL"), so they go to the description, not numeric fields.
 */

import type {
  AirspaceProvider,
  AirspaceZone,
  BBox,
  ZoneSeverity,
} from "./types.js";

// ---------------------------------------------------------------------------
// Service resolution
// ---------------------------------------------------------------------------

const WEBMAP_ITEM_ID = "3c762b4735e54843ada7e206580dc48f";
const WEBMAP_DATA_URL = `https://www.arcgis.com/sharing/rest/content/items/${WEBMAP_ITEM_ID}/data?f=json`;
const FALLBACK_BASE =
  "https://services7.arcgis.com/oJtolNh5k8HxCVtB/arcgis/rest/services/UAS_WEBLAYER/FeatureServer";

const FEATURE_SERVER_MARKER = "/FeatureServer";
const BASE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let baseCache: { base: string; at: number } | null = null;
let baseInFlight: Promise<string> | null = null;

/**
 * Walk an ArcGIS web-map "data" JSON and return the FeatureServer base URL,
 * i.e. the URL truncated right after "/FeatureServer". Handles GroupLayers
 * (operationalLayers[].layers[]).
 */
function extractFeatureServerBase(data: unknown): string | null {
  let found: string | null = null;

  const visit = (node: unknown): void => {
    if (found) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const url = obj.url;
      if (typeof url === "string" && url.includes(FEATURE_SERVER_MARKER)) {
        const end =
          url.indexOf(FEATURE_SERVER_MARKER) + FEATURE_SERVER_MARKER.length;
        found = url.slice(0, end);
        return;
      }
      if (Array.isArray(obj.layers)) visit(obj.layers);
      if (Array.isArray(obj.operationalLayers)) visit(obj.operationalLayers);
    }
  };

  visit(data);
  return found;
}

async function resolveBase(): Promise<string> {
  try {
    const res = await fetch(WEBMAP_DATA_URL);
    if (res.ok) {
      const data = await res.json();
      const base = extractFeatureServerBase(data);
      if (base) return base;
    } else {
      console.error(`Aerocivil: web map resolution failed – ${res.status}`);
    }
  } catch (err) {
    console.error("Aerocivil: web map resolution error", err);
  }
  return FALLBACK_BASE;
}

async function getBase(): Promise<string> {
  if (baseCache && Date.now() - baseCache.at < BASE_TTL_MS) {
    return baseCache.base;
  }
  if (baseInFlight) return baseInFlight;

  baseInFlight = resolveBase()
    .then((base) => {
      baseCache = { base, at: Date.now() };
      baseInFlight = null;
      return base;
    })
    .catch(() => {
      baseInFlight = null;
      return FALLBACK_BASE;
    });

  return baseInFlight;
}

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

type Props = Record<string, unknown>;

interface AeroLayer {
  /** FeatureServer layer id. */
  id: number;
  severity: ZoneSeverity;
  category: string;
  /** Static human label appended to the description (e.g. "6 km airport buffer"). */
  note: string;
  /** Field used as stable id. Falls back to OBJECTID. */
  idField: string;
  /** Field holding a human-readable name. */
  nameField: string;
  /** Text fields concatenated into the description. */
  descFields: string[];
  /** When set, the classification field overrides the severity (P → prohibited). */
  classField?: string;
}

const LAYERS: AeroLayer[] = [
  {
    id: 110,
    severity: "prohibited",
    category: "no-fly-drone",
    note: "Drone no-fly zone (ZNVD)",
    idField: "ID",
    nameField: "ENTIDAD",
    descFields: ["UBICACIÓN", "OBSERVACIONES"],
  },
  {
    id: 80,
    severity: "restricted",
    category: "aip-area",
    note: "AIP area",
    idField: "OBJECTID",
    nameField: "DESIGNADOR",
    classField: "CLASIFICACIÓN",
    descFields: [
      "CLASIFICACIÓN",
      "UBICACIÓN",
      "LIMITES_VERTICALES",
      "OBSERVACIONES",
    ],
  },
  {
    id: 90,
    severity: "restricted",
    category: "sport-aviation",
    note: "Sport aviation area",
    idField: "OBJECTID",
    nameField: "DESIGNADOR",
    descFields: ["CLASIFICACIÓN", "UBICACIÓN", "LIMITES_VERTICALES"],
  },
  {
    id: 50,
    severity: "restricted",
    category: "airport",
    note: "9 km airport buffer",
    idField: "DESIGNADOR_OACI",
    nameField: "NOMBRE_DEL_AD",
    descFields: ["CIUDAD", "OBSERVACIONES"],
  },
  {
    id: 40,
    severity: "restricted",
    category: "airport",
    note: "6 km airport buffer",
    idField: "DESIGNADOR_OACI",
    nameField: "DESIGNADOR_OACI",
    descFields: [],
  },
  {
    id: 60,
    severity: "restricted",
    category: "heliport",
    note: "3 km heliport buffer",
    idField: "OBJECTID",
    nameField: "NOMBRE",
    descFields: ["MUNICIPIO"],
  },
  {
    id: 70,
    severity: "restricted",
    category: "heliport",
    note: "3 km heliport buffer (Bogotá)",
    idField: "OBJECTID",
    nameField: "NOMBRE",
    descFields: ["MUNICIPIO"],
  },
  {
    id: 100,
    severity: "restricted",
    category: "aeronautical-infrastructure",
    note: "Aeronautical infrastructure",
    idField: "ID",
    nameField: "ESTACION",
    descFields: [],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rough bounding box around Colombia (incl. San Andrés). */
const COLOMBIA_BOUNDS: BBox = {
  south: -4.5,
  west: -82.0,
  north: 13.6,
  east: -66.8,
};

function boundsOverlap(a: BBox, b: BBox): boolean {
  return (
    a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south
  );
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Join non-empty description pieces, returning undefined when all are empty. */
function pieces(parts: (string | undefined)[]): string | undefined {
  const out = parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" · ");
  return out.length > 0 ? out : undefined;
}

function severityFor(layer: AeroLayer, p: Props): ZoneSeverity {
  if (layer.classField) {
    const cls = str(p[layer.classField]).toUpperCase();
    if (cls.includes("PROHIB")) return "prohibited";
  }
  return layer.severity;
}

function bboxToEnvelope(b: BBox): string {
  return `${b.west},${b.south},${b.east},${b.north}`;
}

async function queryLayer(
  base: string,
  layer: AeroLayer,
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

  const url = `${base}/${layer.id}/query?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(
      `Aerocivil: failed to query layer ${layer.id} – ${res.status}`,
    );
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
      const descParts = [layer.note, ...layer.descFields.map((k) => str(p[k]))];
      return {
        id: `${layer.id}-${str(p[layer.idField]) || str(p.OBJECTID)}`,
        name: str(p[layer.nameField]) || layer.note,
        severity: severityFor(layer, p),
        geometry: f.geometry as Record<string, unknown>,
        description: pieces(descParts),
        category: layer.category,
        source: "aerocivil",
      };
    });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const aerocivilProvider: AirspaceProvider = {
  id: "aerocivil",
  name: "Colombia (Aerocivil)",

  async fetchZones(bounds: BBox): Promise<AirspaceZone[]> {
    // Skip if the viewport doesn't overlap Colombia at all.
    if (!boundsOverlap(bounds, COLOMBIA_BOUNDS)) {
      return [];
    }

    const base = await getBase();

    const results = await Promise.allSettled(
      LAYERS.map((layer) => queryLayer(base, layer, bounds)),
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
