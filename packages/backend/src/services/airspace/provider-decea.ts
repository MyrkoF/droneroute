/**
 * DECEA airspace provider – Brazil.
 *
 * Source: GeoAISWEB, the public GeoServer WFS operated by DECEA (Departamento
 * de Controle do Espaço Aéreo), https://geoaisweb.decea.gov.br/geoserver/ows.
 * Public, no API key required.
 *
 * Layers selected (ENR 5.1 special-use airspace + low-level controlled zones
 * relevant to drones):
 *  - ICA:eac_p  Área Proibida  → prohibited
 *  - ICA:eac_r  Área Restrita  → restricted
 *  - ICA:eac_d  Área Perigosa (danger area) → restricted
 *  - ICA:CTR    Zona de Controle (control zone) → restricted
 *  - ICA:ATZ    Zona de Tráfego de Aeródromo → restricted
 *
 * Pitfall – WFS axis order: with WFS 2.0.0 and the URN CRS
 * urn:ogc:def:crs:EPSG::4326 the server uses EPSG axis order, i.e. the BBOX is
 * south,west,north,east (lat,lon). GeoJSON output is always lon,lat (RFC 7946).
 * Verified live against Rio (SBRJ / SBGL CTRs). Using the short "EPSG:4326"
 * form would silently flip to lon,lat and return nothing – always keep the URN.
 *
 * Pitfall – altitude columns: the two table families use DIFFERENT columns.
 * eac_* stores the values in upperlimit / lowerlimit (units in uom_ulimit /
 * uom_llimit). CTR / ATZ store the upper value in upperlimit but the LOWER
 * value in lowerlimi1 (the column named "lowerlimit" there holds the unit
 * string). Limits are in feet; we convert to metres and keep the raw feet
 * range in the description.
 */

import type {
  AirspaceProvider,
  AirspaceZone,
  BBox,
  ZoneSeverity,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WFS_BASE = "https://geoaisweb.decea.gov.br/geoserver/ows";
const CRS = "urn:ogc:def:crs:EPSG::4326";
const MAX_FEATURES = 2000;
const FEET_TO_METRES = 0.3048;

type Props = Record<string, unknown>;

interface DeceaLayer {
  /** WFS typeName, e.g. "ICA:eac_p". */
  typeName: string;
  severity: ZoneSeverity;
  category: string;
  /** Static label used as a name suffix and description prefix. */
  label: string;
  /** Field holding a human-readable name. */
  nameField: string;
  /** Field used as stable id. Falls back to the GeoJSON feature id. */
  idField: string;
  /** Numeric field (feet) for the upper vertical limit. */
  upperField: string;
  /** Numeric field (feet) for the lower vertical limit. */
  lowerField: string;
  /** Extra text fields concatenated into the description. */
  descFields: string[];
}

const LAYERS: DeceaLayer[] = [
  {
    typeName: "ICA:eac_p",
    severity: "prohibited",
    category: "prohibited-area",
    label: "Prohibited area",
    nameField: "nome",
    idField: "id",
    upperField: "upperlimit",
    lowerField: "lowerlimit",
    descFields: ["designador", "observacao"],
  },
  {
    typeName: "ICA:eac_r",
    severity: "restricted",
    category: "restricted-area",
    label: "Restricted area",
    nameField: "nome",
    idField: "id",
    upperField: "upperlimit",
    lowerField: "lowerlimit",
    descFields: ["designador", "observacao"],
  },
  {
    typeName: "ICA:eac_d",
    severity: "restricted",
    category: "danger-area",
    label: "Danger area",
    nameField: "nome",
    idField: "id",
    upperField: "upperlimit",
    lowerField: "lowerlimit",
    descFields: ["designador", "observacao"],
  },
  {
    typeName: "ICA:CTR",
    severity: "restricted",
    category: "control-zone",
    label: "CTR",
    nameField: "nam",
    idField: "ident",
    upperField: "upperlimit",
    lowerField: "lowerlimi1",
    descFields: ["relatedfir"],
  },
  {
    typeName: "ICA:ATZ",
    severity: "restricted",
    category: "aerodrome-traffic-zone",
    label: "ATZ",
    nameField: "nam",
    idField: "ident",
    upperField: "upperlimit",
    lowerField: "lowerlimi1",
    descFields: ["relatedfir"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Rough bounding box around Brazil. */
const BRAZIL_BOUNDS: BBox = {
  south: -34.0,
  west: -74.5,
  north: 6.0,
  east: -33.0,
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

function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function ftToMetres(v: unknown): number | undefined {
  const ft = numOrUndef(v);
  return ft === undefined ? undefined : Math.round(ft * FEET_TO_METRES);
}

/** Human-readable feet range for the description, e.g. "0 – 2000 ft". */
function ftRange(lower: unknown, upper: unknown): string {
  const lo = numOrUndef(lower);
  const hi = numOrUndef(upper);
  if (lo === undefined && hi === undefined) return "";
  const loTxt = lo === undefined ? "SFC" : `${lo} ft`;
  const hiTxt = hi === undefined ? "UNL" : `${hi} ft`;
  return `${loTxt} – ${hiTxt}`;
}

/** Join non-empty description pieces, returning undefined when all are empty. */
function pieces(parts: (string | undefined)[]): string | undefined {
  const out = parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .join(" · ");
  return out.length > 0 ? out : undefined;
}

function buildUrl(typeName: string, bounds: BBox): string {
  const params = new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: typeName,
    OUTPUTFORMAT: "application/json",
    SRSNAME: CRS,
    COUNT: String(MAX_FEATURES),
    // Axis order is lat,lon because of the URN CRS – see file header.
    BBOX: `${bounds.south},${bounds.west},${bounds.north},${bounds.east},${CRS}`,
  });
  return `${WFS_BASE}?${params}`;
}

async function queryLayer(
  layer: DeceaLayer,
  bounds: BBox,
): Promise<AirspaceZone[]> {
  const url = buildUrl(layer.typeName, bounds);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`DECEA: failed to query ${layer.typeName} – ${res.status}`);
    return [];
  }

  const json = (await res.json()) as {
    features?: Array<{
      id?: string;
      geometry: Record<string, unknown> | null;
      properties?: Props;
    }>;
  };
  if (!json.features) return [];

  return json.features
    .filter((f) => f.geometry != null)
    .map((f): AirspaceZone => {
      const p = f.properties ?? {};
      const named = str(p[layer.nameField]);
      const name = named ? `${named} (${layer.label})` : layer.label;
      const descParts = [
        ...layer.descFields.map((k) => str(p[k])),
        ftRange(p[layer.lowerField], p[layer.upperField]),
      ];
      return {
        id: str(p[layer.idField]) || str(f.id),
        name,
        severity: layer.severity,
        geometry: f.geometry as Record<string, unknown>,
        altitudeLower: ftToMetres(p[layer.lowerField]),
        altitudeUpper: ftToMetres(p[layer.upperField]),
        description: pieces(descParts),
        category: layer.category,
        source: "decea",
      };
    });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const deceaProvider: AirspaceProvider = {
  id: "decea",
  name: "Brazil (DECEA)",

  async fetchZones(bounds: BBox): Promise<AirspaceZone[]> {
    // Skip if the viewport doesn't overlap Brazil at all.
    if (!boundsOverlap(bounds, BRAZIL_BOUNDS)) {
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
