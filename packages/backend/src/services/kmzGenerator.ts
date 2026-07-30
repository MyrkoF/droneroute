import archiver from "archiver";
import { PassThrough } from "stream";
import type { Mission } from "@droneroute/shared";
import { buildTemplateKml, buildWaylinesWpml } from "../lib/wpml.js";

export function generateKmzBuffer(mission: Mission): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();

    passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);

    archive.pipe(passthrough);

    // DJI Fly (consumer dialect) requires the mission files inside a wpmz/
    // directory — verified against a native Mini 5 Pro mission. The enterprise
    // layout is left untouched to avoid changing existing output.
    const prefix = mission.config.dialect === "consumer" ? "wpmz/" : "";

    // Add template.kml
    const templateKml = buildTemplateKml(mission);
    archive.append(templateKml, { name: `${prefix}template.kml` });

    // Add waylines.wpml
    const waylinesWpml = buildWaylinesWpml(mission);
    archive.append(waylinesWpml, { name: `${prefix}waylines.wpml` });

    // Add empty res/ directory
    archive.append("", { name: `${prefix}res/` });

    archive.finalize();
  });
}
