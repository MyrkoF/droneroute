import type {
  Mission,
  MissionConfig,
  Waypoint,
  WaypointAction,
  PointOfInterest,
  WpmlDialect,
} from "@droneroute/shared";

// WPML namespace per dialect. Enterprise (DJI Pilot 2 / Cloud API) uses
// www.dji.com; consumer (DJI Fly, Mini series) uses www.uav.com. The consumer
// namespace and structure were verified against a native DJI Fly mission
// exported off a DJI RC2 with a Mini 5 Pro.
const WPML_NAMESPACE: Record<WpmlDialect, string> = {
  enterprise: "http://www.dji.com/wpmz/1.0.2",
  consumer: "http://www.uav.com/wpmz/1.0.2",
};

// ── XML Helpers ──────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compute bearing (degrees, 0=N, CW) from point A to point B */
function computeBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

function findPoi(
  pois: PointOfInterest[],
  id?: string,
): PointOfInterest | undefined {
  if (!id) return undefined;
  return pois.find((p) => p.id === id);
}

// ── Action XML ───────────────────────────────────────────

function buildActionXml(action: WaypointAction): string {
  let paramsXml = "";

  switch (action.actionType) {
    case "takePhoto":
      paramsXml = `
              <wpml:payloadPositionIndex>${(action.params as any).payloadPositionIndex ?? 0}</wpml:payloadPositionIndex>
              <wpml:fileSuffix>${escapeXml((action.params as any).fileSuffix || "")}</wpml:fileSuffix>`;
      break;
    case "startRecord":
      paramsXml = `
              <wpml:payloadPositionIndex>${(action.params as any).payloadPositionIndex ?? 0}</wpml:payloadPositionIndex>
              <wpml:fileSuffix>${escapeXml((action.params as any).fileSuffix || "")}</wpml:fileSuffix>`;
      break;
    case "stopRecord":
      paramsXml = `
              <wpml:payloadPositionIndex>${(action.params as any).payloadPositionIndex ?? 0}</wpml:payloadPositionIndex>`;
      break;
    case "gimbalRotate": {
      const p = action.params as any;
      paramsXml = `
              <wpml:gimbalHeadingYawBase>north</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>${p.gimbalRotateMode || "absoluteAngle"}</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>${p.gimbalPitchRotateAngle ?? 0}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>${p.gimbalRollRotateAngle ?? 0}</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>1</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>${p.gimbalYawRotateAngle ?? 0}</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>${p.payloadPositionIndex ?? 0}</wpml:payloadPositionIndex>`;
      break;
    }
    case "gimbalEvenlyRotate": {
      const p = action.params as any;
      paramsXml = `
              <wpml:gimbalPitchRotateAngle>${p.gimbalPitchRotateAngle ?? -45}</wpml:gimbalPitchRotateAngle>
              <wpml:payloadPositionIndex>${p.payloadPositionIndex ?? 0}</wpml:payloadPositionIndex>`;
      break;
    }
    case "rotateYaw": {
      const p = action.params as any;
      paramsXml = `
              <wpml:aircraftHeading>${p.aircraftHeading ?? 0}</wpml:aircraftHeading>
              <wpml:aircraftPathMode>${p.aircraftPathMode || "clockwise"}</wpml:aircraftPathMode>`;
      break;
    }
    case "hover":
      paramsXml = `
              <wpml:hoverTime>${(action.params as any).hoverTime ?? 5}</wpml:hoverTime>`;
      break;
    case "zoom":
      paramsXml = `
              <wpml:focalLength>${(action.params as any).focalLength ?? 24}</wpml:focalLength>`;
      break;
    case "focus": {
      const p = action.params as any;
      paramsXml = `
              <wpml:isPointFocus>${p.isPointFocus ? 1 : 0}</wpml:isPointFocus>
              <wpml:focusX>${p.focusX ?? 0.5}</wpml:focusX>
              <wpml:focusY>${p.focusY ?? 0.5}</wpml:focusY>
              <wpml:isInfiniteFocus>${p.isInfiniteFocus ? 1 : 0}</wpml:isInfiniteFocus>`;
      break;
    }
  }

  return `
          <wpml:action>
            <wpml:actionId>${action.actionId}</wpml:actionId>
            <wpml:actionActuatorFunc>${action.actionType}</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>${paramsXml}
            </wpml:actionActuatorFuncParam>
          </wpml:action>`;
}

function buildActionGroupXml(wp: Waypoint, groupIdOffset: number): string {
  if (wp.actions.length === 0) return "";

  const actionsXml = wp.actions.map(buildActionXml).join("");

  return `
        <wpml:actionGroup>
          <wpml:actionGroupId>${groupIdOffset}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${wp.index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${wp.index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>${actionsXml}
        </wpml:actionGroup>`;
}

// ── Template KML ─────────────────────────────────────────

export function buildTemplateKml(mission: Mission): string {
  const c = mission.config;
  if (c.dialect === "consumer") return buildConsumerTemplateKml(mission);
  const pois = mission.pois || [];
  const now = Date.now();

  const placemarks = mission.waypoints
    .map((wp, i) => {
      const actionGroupXml = buildActionGroupXml(wp, i);

      // Build per-waypoint heading param when using towardPOI
      let headingOverrideXml = "";
      if (
        !wp.useGlobalHeadingParam &&
        wp.headingMode === "towardPOI" &&
        wp.poiId
      ) {
        const poi = findPoi(pois, wp.poiId);
        if (poi) {
          headingOverrideXml = `
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>towardPOI</wpml:waypointHeadingMode>
          <wpml:waypointPoiPoint>${poi.latitude},${poi.longitude},${poi.height}</wpml:waypointPoiPoint>
          <wpml:waypointHeadingPathMode>clockwise</wpml:waypointHeadingPathMode>
        </wpml:waypointHeadingParam>`;
        }
      }

      return `
      <Placemark>
        <Point>
          <coordinates>${wp.longitude},${wp.latitude}</coordinates>
        </Point>
        <wpml:index>${wp.index}</wpml:index>
        <wpml:ellipsoidHeight>${wp.height}</wpml:ellipsoidHeight>
        <wpml:height>${wp.height}</wpml:height>
        <wpml:useGlobalHeight>${wp.useGlobalHeight ? 1 : 0}</wpml:useGlobalHeight>
        <wpml:useGlobalSpeed>${wp.useGlobalSpeed ? 1 : 0}</wpml:useGlobalSpeed>
        ${!wp.useGlobalSpeed ? `<wpml:waypointSpeed>${wp.speed}</wpml:waypointSpeed>` : ""}
        <wpml:useGlobalHeadingParam>${wp.useGlobalHeadingParam ? 1 : 0}</wpml:useGlobalHeadingParam>
        <wpml:useGlobalTurnParam>${wp.useGlobalTurnParam ? 1 : 0}</wpml:useGlobalTurnParam>
        <wpml:gimbalPitchAngle>${wp.gimbalPitchAngle}</wpml:gimbalPitchAngle>${headingOverrideXml}${actionGroupXml}
      </Placemark>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:createTime>${now}</wpml:createTime>
  <wpml:updateTime>${now}</wpml:updateTime>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>${c.flyToWaylineMode}</wpml:flyToWaylineMode>
    <wpml:finishAction>${c.finishAction}</wpml:finishAction>
    <wpml:exitOnRCLost>${c.exitOnRCLost}</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>${c.executeRCLostAction}</wpml:executeRCLostAction>
    <wpml:takeOffSecurityHeight>${c.takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
    <wpml:globalTransitionalSpeed>${c.globalTransitionalSpeed}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo>
      <wpml:droneEnumValue>${c.droneEnumValue}</wpml:droneEnumValue>
      <wpml:droneSubEnumValue>${c.droneSubEnumValue}</wpml:droneSubEnumValue>
    </wpml:droneInfo>
    <wpml:payloadInfo>
      <wpml:payloadEnumValue>${c.payloadEnumValue}</wpml:payloadEnumValue>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:payloadInfo>
  </wpml:missionConfig>
  <Folder>
    <wpml:templateType>waypoint</wpml:templateType>
    <wpml:templateId>0</wpml:templateId>
    <wpml:autoFlightSpeed>${c.autoFlightSpeed}</wpml:autoFlightSpeed>
    <wpml:waylineCoordinateSysParam>
      <wpml:coordinateMode>WGS84</wpml:coordinateMode>
      <wpml:heightMode>${c.heightMode}</wpml:heightMode>
    </wpml:waylineCoordinateSysParam>
    <wpml:gimbalPitchMode>${c.gimbalPitchMode}</wpml:gimbalPitchMode>
    <wpml:globalWaypointHeadingParam>
      <wpml:waypointHeadingMode>${c.globalHeadingMode}</wpml:waypointHeadingMode>
      <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
    </wpml:globalWaypointHeadingParam>
    <wpml:globalWaypointTurnMode>${c.globalTurnMode}</wpml:globalWaypointTurnMode>${placemarks}
  </Folder>
</Document>
</kml>`;
}

// ── Waylines WPML ────────────────────────────────────────

export function buildWaylinesWpml(mission: Mission): string {
  const c = mission.config;
  if (c.dialect === "consumer") return buildConsumerWaylinesWpml(mission);
  const pois = mission.pois || [];
  const now = Date.now();

  const placemarks = mission.waypoints
    .map((wp, i) => {
      const actionGroupXml = buildActionGroupXml(wp, i);
      const headingMode = wp.useGlobalHeadingParam
        ? c.globalHeadingMode
        : wp.headingMode || c.globalHeadingMode;
      const turnMode = wp.useGlobalTurnParam
        ? c.globalTurnMode
        : wp.turnMode || c.globalTurnMode;
      const speed = wp.useGlobalSpeed ? c.autoFlightSpeed : wp.speed;

      // POI pointing: compute bearing or emit POI coordinates
      let poiXml = "";
      let headingAngle = wp.headingAngle ?? 0;
      if (headingMode === "towardPOI" && wp.poiId) {
        const poi = findPoi(pois, wp.poiId);
        if (poi) {
          headingAngle = computeBearing(
            wp.latitude,
            wp.longitude,
            poi.latitude,
            poi.longitude,
          );
          poiXml = `
          <wpml:waypointPoiPoint>${poi.latitude},${poi.longitude},${poi.height}</wpml:waypointPoiPoint>`;
        }
      }

      return `
      <Placemark>
        <Point>
          <coordinates>${wp.longitude},${wp.latitude}</coordinates>
        </Point>
        <wpml:index>${wp.index}</wpml:index>
        <wpml:executeHeight>${wp.height}</wpml:executeHeight>
        <wpml:waypointSpeed>${speed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>${headingMode}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${headingAngle}</wpml:waypointHeadingAngle>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>${poiXml}
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>${wp.turnDampingDist ?? 0}</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:gimbalPitchAngle>${wp.gimbalPitchAngle}</wpml:gimbalPitchAngle>${actionGroupXml}
      </Placemark>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"
     xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:createTime>${now}</wpml:createTime>
  <wpml:updateTime>${now}</wpml:updateTime>
  <wpml:missionConfig>
    <wpml:flyToWaylineMode>${c.flyToWaylineMode}</wpml:flyToWaylineMode>
    <wpml:finishAction>${c.finishAction}</wpml:finishAction>
    <wpml:exitOnRCLost>${c.exitOnRCLost}</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>${c.executeRCLostAction}</wpml:executeRCLostAction>
    <wpml:takeOffSecurityHeight>${c.takeOffSecurityHeight}</wpml:takeOffSecurityHeight>
    <wpml:globalTransitionalSpeed>${c.globalTransitionalSpeed}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo>
      <wpml:droneEnumValue>${c.droneEnumValue}</wpml:droneEnumValue>
      <wpml:droneSubEnumValue>${c.droneSubEnumValue}</wpml:droneSubEnumValue>
    </wpml:droneInfo>
    <wpml:payloadInfo>
      <wpml:payloadEnumValue>${c.payloadEnumValue}</wpml:payloadEnumValue>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:payloadInfo>
  </wpml:missionConfig>
  <Folder>
    <wpml:templateId>0</wpml:templateId>
    <wpml:waylineId>0</wpml:waylineId>
    <wpml:autoFlightSpeed>${c.autoFlightSpeed}</wpml:autoFlightSpeed>
    <wpml:waylineCoordinateSysParam>
      <wpml:coordinateMode>WGS84</wpml:coordinateMode>
      <wpml:heightMode>${c.heightMode}</wpml:heightMode>
    </wpml:waylineCoordinateSysParam>${placemarks}
  </Folder>
</Document>
</kml>`;
}

// ── Consumer dialect (DJI Fly, Mini series) ──────────────
//
// The Mini series loads missions through the DJI Fly app, which expects the
// www.uav.com WPML dialect: a minimal template.kml (mission config only, no
// Folder), no payloadInfo, and heights relative to the take-off point. Verified
// against a native Mini 5 Pro mission exported off a DJI RC2.

/** Shared mission config block for the consumer dialect (no payloadInfo). */
function buildConsumerMissionConfig(c: MissionConfig): string {
  return `    <wpml:missionConfig>
      <wpml:flyToWaylineMode>${c.flyToWaylineMode}</wpml:flyToWaylineMode>
      <wpml:finishAction>${c.finishAction}</wpml:finishAction>
      <wpml:exitOnRCLost>${c.exitOnRCLost}</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>${c.executeRCLostAction}</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>${c.globalTransitionalSpeed}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${c.droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${c.droneSubEnumValue}</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>`;
}

function buildConsumerTemplateKml(mission: Mission): string {
  const c = mission.config;
  const now = Date.now();
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${WPML_NAMESPACE.consumer}">
  <Document>
    <wpml:author>fly</wpml:author>
    <wpml:createTime>${now}</wpml:createTime>
    <wpml:updateTime>${now}</wpml:updateTime>
${buildConsumerMissionConfig(c)}
  </Document>
</kml>`;
}

function buildConsumerPlacemark(
  wp: Waypoint,
  c: MissionConfig,
  pois: PointOfInterest[],
): string {
  const actionGroupXml = buildActionGroupXml(wp, wp.index);
  const headingMode = wp.useGlobalHeadingParam
    ? c.globalHeadingMode
    : wp.headingMode || c.globalHeadingMode;
  const turnMode = wp.useGlobalTurnParam
    ? c.globalTurnMode
    : wp.turnMode || c.globalTurnMode;
  const speed = wp.useGlobalSpeed ? c.autoFlightSpeed : wp.speed;

  let headingAngle = wp.headingAngle ?? 0;
  // "Toward POI" with no POI resolved must NOT write a target. This used to
  // default to "0.000000,0.000000,0.000000" and emit it unconditionally, so a
  // mission set to Toward POI whose waypoints keep `useGlobalHeadingParam`
  // (the default) — hence no `poiId` — asked the aircraft to aim at latitude 0
  // / longitude 0 at every waypoint: Null Island, in the Gulf of Guinea. Same
  // outcome if the POI is deleted after being assigned (`findPoi` returns
  // undefined). And since `waypointHeadingAngleEnable` is 0 outside "fixed"
  // mode, it is exactly this point that drives the gimbal.
  //
  // The enterprise path already degrades correctly (empty string, tag emitted
  // only when the POI resolves); this mirrors it, and additionally falls back
  // to `followWayline` — a heading mode that references a target absent from
  // the file is not a mode the aircraft can honour.
  let poiPointXml = "";
  let effectiveHeadingMode = headingMode;
  if (headingMode === "towardPOI") {
    const poi = wp.poiId ? findPoi(pois, wp.poiId) : undefined;
    if (poi) {
      headingAngle = computeBearing(
        wp.latitude,
        wp.longitude,
        poi.latitude,
        poi.longitude,
      );
      poiPointXml = `
          <wpml:waypointPoiPoint>${poi.latitude},${poi.longitude},${poi.height}</wpml:waypointPoiPoint>`;
    } else {
      effectiveHeadingMode = "followWayline";
    }
  }

  return `
      <Placemark>
        <Point>
          <coordinates>${wp.longitude},${wp.latitude}</coordinates>
        </Point>
        <wpml:index>${wp.index}</wpml:index>
        <wpml:executeHeight>${wp.height}</wpml:executeHeight>
        <wpml:waypointSpeed>${speed}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>${effectiveHeadingMode}</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${headingAngle}</wpml:waypointHeadingAngle>${poiPointXml}
          <wpml:waypointHeadingAngleEnable>${effectiveHeadingMode === "fixed" ? 1 : 0}</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${turnMode}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>${wp.turnDampingDist ?? 0}</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>0</wpml:useStraightLine>${actionGroupXml}
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>${wp.gimbalPitchAngle}</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>`;
}

function buildConsumerWaylinesWpml(mission: Mission): string {
  const c = mission.config;
  const pois = mission.pois || [];
  // DJI Fly waypoint missions fly relative to the take-off point; the enterprise
  // "aboveGroundLevel" mode has no equivalent in the consumer app.
  const heightMode =
    c.heightMode === "EGM96" ? "EGM96" : "relativeToStartPoint";

  const placemarks = mission.waypoints
    .map((wp) => buildConsumerPlacemark(wp, c, pois))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="${WPML_NAMESPACE.consumer}">
  <Document>
${buildConsumerMissionConfig(c)}
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>${heightMode}</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>0</wpml:distance>
      <wpml:duration>0</wpml:duration>
      <wpml:autoFlightSpeed>${c.autoFlightSpeed}</wpml:autoFlightSpeed>${placemarks}
    </Folder>
  </Document>
</kml>`;
}
