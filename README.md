<p align="center">
  <img src="droneroute.png" alt="DroneRoute" width="128" />
</p>

<h1 align="center">DroneRoute</h1>

<p align="center">
  <a href="https://github.com/MyrkoF/droneroute/actions/workflows/ci.yml"><img src="https://github.com/MyrkoF/droneroute/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://buymeacoffee.com/myrko.f"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-orange?logo=buy-me-a-coffee" alt="Buy Me a Coffee" /></a>
</p>

> **This is the [DataTerra](https://dataterra.co) fork of DroneRoute**, originally created by Ferran Basora ([fcsonline/droneroute](https://github.com/fcsonline/droneroute)). Since September 2026 it is developed independently: it keeps everything the original does and adds the features listed under [What this fork adds](#what-this-fork-adds). The working branch is `dataterra-build`.

A free, open-source mission planner for DJI drones. Plan waypoint missions on an interactive map, tweak flight parameters, and export KMZ files ready to fly.

**[Try the live demo](https://app.droneroute.io)** | **[Read the guide](GUIDE.md)**

![DroneRoute — Mission planner with waypoints, configuration panel, and elevation chart](docs/screenshots/main-map.png)

## Features

- **Interactive map** — Click to place waypoints and Points of Interest on OpenStreetMap
- **Waypoint configuration** — Set altitude, speed, gimbal pitch, heading mode, and turn mode per waypoint
- **Points of Interest** — Define POIs and auto-point the camera toward them
- **Smart gimbal pitch** — Automatically calculates the optimal gimbal angle based on distance and height to a POI
- **Waypoint actions** — Add photo, video, gimbal rotate, yaw, hover, zoom, and focus actions
- **KMZ export & import** — Generates DJI WPML-compliant KMZ files, or load existing ones
- **Upload to controller** — Push KMZ files directly to USB-connected DJI RC controllers with `npx droneroute`
- **Save & load** — Persist missions to a local database with user accounts
- **Share missions** — Generate a read-only link to share any saved route; recipients can preview stats, open in the editor, clone to their account, or export the KMZ directly
- **Mission templates** — Orbit, Orbit+Z (stacked orbits), grid survey, facade scan, and pencil path presets to get you flying faster
- **Animated flight path** — Dashed lines animate in flight direction, proportional to each waypoint's speed
- **Drag-and-drop reordering** — Reorder waypoints by dragging in the sidebar
- **Keyboard shortcuts** — `W` add waypoint, `P` add POI, `Z` pencil path, `Esc` deselect, `Delete` remove selected
- **Self-hosted** — Run it on your own machine or server with Docker

## What this fork adds

- **DJI Mini 5 Pro support** — drone profile and DJI Fly-compatible WPML export (round-trip tested on the aircraft)
- **Orbit+Z template** — stacked orbits at several altitudes around a point of interest, for 3D building and tower scans
- **Template drawing on touch devices** — draw orbits, grids and facade scans directly on a tablet or phone
- **Airspace layers for the Americas** — controlled/restricted airspace from the FAA (United States), Aerocivil (Colombia) and DECEA (Brazil), shown on the map while you plan

## Supported Drones

DJI M300 RTK, M350 RTK, M30/M30T, Mavic 3E/3T/3M/3D/3TD, Mini 4 Pro, Mini 5 Pro.

## Getting Started

You'll need **Node.js 22+** and **npm 10+**.

```bash
# Clone the repo
git clone https://github.com/MyrkoF/droneroute.git
cd droneroute

# Install dependencies
npm install

# Build the shared types package (required before first run)
npm run build -w packages/shared

# Start both backend and frontend in dev mode
npm run dev
```

That's it! Open `http://localhost:5173` and start planning missions.

### Docker

Prefer Docker? One command:

```bash
# This fork is not published on Docker Hub — build the image locally:
docker build -t droneroute:local .
docker run -d -p 3001:3001 -v droneroute-data:/app/data droneroute:local
# Open http://localhost:3001
```

A [docker-compose.yml](docker-compose.yml) with Traefik reverse proxy is also available in the repo.

### Self-hosted limitations

The self-hosted version is designed as a single-account, personal instance. Mission sharing is hidden since share links require your instance to be publicly reachable.

### Default map location

By default the map opens centered on Barcelona. Set `DEFAULT_MAP_VIEW` (in your `.env` or `docker-compose.yml`) to make the map open on your local area instead. The format is `lat,lng` or `lat,lng,zoom` — for example `DEFAULT_MAP_VIEW=51.5072,-0.1276,12`. See [.env.example](.env.example) for the accepted ranges.

## Upload to Your DJI Controller

After exporting a KMZ file, push it directly to a USB-connected DJI RC controller:

```bash
npx droneroute mission.kmz
```

The CLI detects connected controllers (via adb or mounted SD cards), creates a new mission slot, and places the file. See the [droneroute CLI docs](packages/cli/README.md) for details and prerequisites.

## Tech Stack

| Layer          | Technology                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite 6, Tailwind CSS v4, shadcn/ui, Zustand, Leaflet |
| Backend        | Node.js, Express 5, better-sqlite3, JWT auth                               |
| Shared         | TypeScript types package shared between frontend and backend               |
| Infrastructure | Docker, Traefik, SQLite                                                    |

The project is organized as an npm monorepo with four packages: `shared`, `backend`, `frontend`, and `cli`.

## Contributing

Contributions are welcome! Whether it's a bug fix, a new feature, or improving the docs — every bit helps.

1. Fork the repo
2. Create a branch (`git checkout -b my-feature`)
3. Make your changes
4. Run the dev server and make sure things work (`npm run dev`)
5. Open a Pull Request

If you find a bug or have an idea, feel free to [open an issue](https://github.com/MyrkoF/droneroute/issues). We'd love to hear from you. Changes are made in this fork; they are not submitted upstream.

## Support the Project

This fork is maintained by [DataTerra](https://dataterra.co) alongside our drone-survey work in Latin America. If it saves you time planning your flights, consider buying us a coffee — it helps keep the fork going.

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/myrko.f)

The original DroneRoute was created by Ferran Basora — thank you for building it and releasing it under MIT.

## Disclaimer

**This software is under active development.** DroneRoute is provided "as is" without warranty of any kind. The authors are not responsible for any damage to your drones, equipment, or property resulting from the use of this software. Always verify your mission parameters before flying.

DroneRoute is an independent, community-driven project. It is not affiliated with, endorsed by, or sponsored by DJI. "DJI" and related product names are trademarks of SZ DJI Technology Co., Ltd.

## License

MIT — original work © 2025 Ferran Basora; modifications © 2026 Myrko Federico (DataTerra). See [LICENSE](LICENSE).
