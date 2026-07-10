// ── Heading & Turn Modes ─────────────────────────────────

export type HeadingMode =
  | "followWayline"
  | "manually"
  | "fixed"
  | "smoothTransition"
  | "towardPOI";

export type TurnMode =
  | "coordinateTurn"
  | "toPointAndStopWithDiscontinuityCurvature"
  | "toPointAndStopWithContinuityCurvature"
  | "toPointAndPassWithContinuityCurvature";

export type HeightMode = "EGM96" | "relativeToStartPoint" | "aboveGroundLevel";

export type FlyToWaylineMode = "safely" | "pointToPoint";

export type FinishAction =
  | "goHome"
  | "noAction"
  | "autoLand"
  | "gotoFirstWaypoint";

export type RCLostAction = "goBack" | "landing" | "hover";

export type GimbalPitchMode = "manual" | "usePointSetting";

// ── Action Types ─────────────────────────────────────────

export type ActionType =
  | "takePhoto"
  | "startRecord"
  | "stopRecord"
  | "gimbalRotate"
  | "gimbalEvenlyRotate"
  | "rotateYaw"
  | "hover"
  | "zoom"
  | "focus";

export interface TakePhotoParams {
  payloadPositionIndex: number;
  fileSuffix?: string;
}

export interface StartRecordParams {
  payloadPositionIndex: number;
  fileSuffix?: string;
}

export interface StopRecordParams {
  payloadPositionIndex: number;
}

export interface GimbalRotateParams {
  gimbalPitchRotateAngle: number; // -120 to 45
  gimbalYawRotateAngle: number; // -180 to 180
  gimbalRollRotateAngle: number; // typically 0
  gimbalRotateMode: "absoluteAngle";
  payloadPositionIndex: number;
}

export interface GimbalEvenlyRotateParams {
  gimbalPitchRotateAngle: number; // -120 to 45 — target pitch at this waypoint
  payloadPositionIndex: number;
}

export interface RotateYawParams {
  aircraftHeading: number; // -180 to 180
  aircraftPathMode: "clockwise" | "counterClockwise";
}

export interface HoverParams {
  hoverTime: number; // seconds
}

export interface ZoomParams {
  focalLength: number; // mm
}

export interface FocusParams {
  isPointFocus: boolean;
  focusX?: number;
  focusY?: number;
  isInfiniteFocus?: boolean;
}

export type ActionParams =
  | TakePhotoParams
  | StartRecordParams
  | StopRecordParams
  | GimbalRotateParams
  | GimbalEvenlyRotateParams
  | RotateYawParams
  | HoverParams
  | ZoomParams
  | FocusParams;

export interface WaypointAction {
  actionId: number;
  actionType: ActionType;
  params: ActionParams;
}

// ── Drone & Payload ──────────────────────────────────────

/**
 * WPML dialect a drone expects.
 *
 * - "enterprise": DJI Pilot 2 / Cloud API format — namespace www.dji.com, with
 *   payloadInfo and takeOffSecurityHeight. Used by M300/M30/Mavic 3E and friends.
 * - "consumer": DJI Fly format — namespace www.uav.com, no payloadInfo. Used by
 *   the Mini series. Absent means "enterprise".
 */
export type WpmlDialect = "enterprise" | "consumer";

export interface DroneModel {
  label: string;
  droneEnumValue: number;
  droneSubEnumValue: number;
  payloads: PayloadModel[];
  dialect?: WpmlDialect;
}

export interface PayloadModel {
  label: string;
  payloadEnumValue: number;
}

export const DRONE_MODELS: DroneModel[] = [
  {
    label: "DJI M300 RTK",
    droneEnumValue: 60,
    droneSubEnumValue: 0,
    payloads: [
      { label: "H20", payloadEnumValue: 42 },
      { label: "H20T", payloadEnumValue: 43 },
      { label: "H20N", payloadEnumValue: 61 },
      { label: "PSDK", payloadEnumValue: 65534 },
    ],
  },
  {
    label: "DJI M30",
    droneEnumValue: 67,
    droneSubEnumValue: 0,
    payloads: [{ label: "M30 Camera", payloadEnumValue: 52 }],
  },
  {
    label: "DJI M30T",
    droneEnumValue: 67,
    droneSubEnumValue: 1,
    payloads: [{ label: "M30T Camera", payloadEnumValue: 53 }],
  },
  {
    // droneEnumValue 68 appears in real DJI KMZ files (likely Dock-paired M30 variant)
    label: "DJI M30 (Dock)",
    droneEnumValue: 68,
    droneSubEnumValue: 0,
    payloads: [
      { label: "M30 Camera", payloadEnumValue: 52 },
      { label: "M30T Camera", payloadEnumValue: 53 },
    ],
  },
  {
    label: "DJI Mavic 3E",
    droneEnumValue: 77,
    droneSubEnumValue: 0,
    payloads: [{ label: "M3E Camera", payloadEnumValue: 66 }],
  },
  {
    label: "DJI Mavic 3T",
    droneEnumValue: 77,
    droneSubEnumValue: 1,
    payloads: [{ label: "M3T Camera", payloadEnumValue: 67 }],
  },
  {
    label: "DJI Mavic 3M",
    droneEnumValue: 77,
    droneSubEnumValue: 2,
    payloads: [{ label: "M3M Camera", payloadEnumValue: 68 }],
  },
  {
    label: "DJI M350 RTK",
    droneEnumValue: 89,
    droneSubEnumValue: 0,
    payloads: [
      { label: "H20", payloadEnumValue: 42 },
      { label: "H20T", payloadEnumValue: 43 },
      { label: "H20N", payloadEnumValue: 61 },
      { label: "H30", payloadEnumValue: 82 },
      { label: "H30T", payloadEnumValue: 83 },
      { label: "PSDK", payloadEnumValue: 65534 },
    ],
  },
  {
    label: "DJI Mavic 3D",
    droneEnumValue: 91,
    droneSubEnumValue: 0,
    payloads: [{ label: "M3D Camera", payloadEnumValue: 80 }],
  },
  {
    label: "DJI Mavic 3TD",
    droneEnumValue: 91,
    droneSubEnumValue: 1,
    payloads: [{ label: "M3TD Camera", payloadEnumValue: 81 }],
  },
  {
    label: "DJI Mini 4 Pro",
    droneEnumValue: 100,
    droneSubEnumValue: 0,
    payloads: [{ label: "Mini 4 Pro Camera", payloadEnumValue: 100 }],
    dialect: "consumer",
  },
  {
    // Verified from a native DJI Fly mission exported off a DJI RC2: the Mini 5
    // Pro flies as droneEnumValue 68 (shared with the Mini 4 Pro) using the
    // consumer WPML dialect (www.uav.com namespace, no payloadInfo). Note that
    // enum 68 is also used by "DJI M30 (Dock)" above, which is why the dialect
    // must be carried explicitly rather than inferred from the enum.
    label: "DJI Mini 5 Pro",
    droneEnumValue: 68,
    droneSubEnumValue: 0,
    payloads: [{ label: "Mini 5 Pro Camera", payloadEnumValue: 0 }],
    dialect: "consumer",
  },
];

/**
 * Stable identity for a drone model in UI selectors. The (enum, sub) pair is not
 * unique — the M30 Dock and the Mini 5 Pro both use 68/0 — so the dialect is part
 * of the key. Works for both DroneModel and MissionConfig.
 */
export function droneModelKey(x: {
  droneEnumValue: number;
  droneSubEnumValue: number;
  dialect?: WpmlDialect;
}): string {
  return `${x.droneEnumValue}-${x.droneSubEnumValue}-${x.dialect ?? "enterprise"}`;
}

// ── Point of Interest ────────────────────────────────────

export interface PointOfInterest {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  height: number;
}

// ── Obstacle ─────────────────────────────────────────────

export interface Obstacle {
  id: string;
  name: string;
  description: string;
  vertices: [number, number][]; // Array of [latitude, longitude] pairs
}

// ── Waypoint ─────────────────────────────────────────────

export interface Waypoint {
  index: number;
  name: string;
  latitude: number;
  longitude: number;
  height: number;
  speed: number;
  useGlobalSpeed: boolean;
  useGlobalHeight: boolean;
  useGlobalHeadingParam: boolean;
  useGlobalTurnParam: boolean;
  headingMode?: HeadingMode;
  headingAngle?: number;
  poiId?: string; // Reference to PointOfInterest when headingMode = "towardPOI"
  turnMode?: TurnMode;
  turnDampingDist?: number;
  gimbalPitchAngle: number;
  actions: WaypointAction[];
}

// ── Mission Config ───────────────────────────────────────

export interface MissionConfig {
  droneEnumValue: number;
  droneSubEnumValue: number;
  payloadEnumValue: number;
  flyToWaylineMode: FlyToWaylineMode;
  finishAction: FinishAction;
  exitOnRCLost: "goContinue" | "executeLostAction";
  executeRCLostAction: RCLostAction;
  takeOffSecurityHeight: number;
  globalTransitionalSpeed: number;
  autoFlightSpeed: number;
  maxBatteryMinutes: number;
  heightMode: HeightMode;
  globalHeadingMode: HeadingMode;
  globalTurnMode: TurnMode;
  gimbalPitchMode: GimbalPitchMode;
  /** WPML dialect to emit. Absent means "enterprise". Set from the selected drone. */
  dialect?: WpmlDialect;
}

// ── Mission ──────────────────────────────────────────────

export interface Mission {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  config: MissionConfig;
  waypoints: Waypoint[];
  pois: PointOfInterest[];
  obstacles: Obstacle[];
}

// ── Shared Mission ──────────────────────────────────────

export interface SharedMission {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  shareToken: string;
  ownerEmail?: string;
  config: MissionConfig;
  waypoints: Waypoint[];
  pois: PointOfInterest[];
  obstacles: Obstacle[];
}

// ── Admin ────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  missionCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  perPage: number;
  total: number;
}

// ── User Preferences ────────────────────────────────────

export interface VisualizationPreferences {
  viewMode: "2d" | "3d";
  mapStyle: "satellite" | "street";
}

export type UnitSystem = "metric" | "imperial";

export interface UserPreferences {
  unitSystem: UnitSystem;
  visualization: VisualizationPreferences;
  missionDefaults: MissionConfig;
}

// ── Map ──────────────────────────────────────────────────

/** Map center (latitude/longitude) and zoom shown when the app first loads. */
export interface MapViewState {
  latitude: number;
  longitude: number;
  zoom: number;
}

// ── Default Config ───────────────────────────────────────

export const DEFAULT_MISSION_CONFIG: MissionConfig = {
  droneEnumValue: 77,
  droneSubEnumValue: 0,
  payloadEnumValue: 66,
  flyToWaylineMode: "safely",
  finishAction: "goHome",
  exitOnRCLost: "executeLostAction",
  executeRCLostAction: "goBack",
  takeOffSecurityHeight: 20,
  globalTransitionalSpeed: 10,
  autoFlightSpeed: 7,
  maxBatteryMinutes: 25,
  heightMode: "aboveGroundLevel",
  globalHeadingMode: "followWayline",
  globalTurnMode: "toPointAndStopWithDiscontinuityCurvature",
  gimbalPitchMode: "usePointSetting",
};

export const DEFAULT_WAYPOINT: Omit<
  Waypoint,
  "index" | "name" | "latitude" | "longitude"
> = {
  height: 30,
  speed: 7,
  useGlobalSpeed: true,
  useGlobalHeight: false,
  useGlobalHeadingParam: true,
  useGlobalTurnParam: true,
  gimbalPitchAngle: -45,
  actions: [],
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  unitSystem: "metric",
  visualization: {
    viewMode: "2d",
    mapStyle: "satellite",
  },
  missionDefaults: { ...DEFAULT_MISSION_CONFIG },
};

/**
 * Built-in default map view (Barcelona). Used when no DEFAULT_MAP_* env vars are
 * configured, and as the client-side fallback before the config endpoint loads.
 */
export const DEFAULT_MAP_VIEW: MapViewState = {
  latitude: 41.3874,
  longitude: 2.1686,
  zoom: 13,
};
