## Summary

Add an **Orbit+Z** mission template — stacked orbits at multiple altitudes around
a single center. It is the vertical counterpart of the orbit template, aimed at
3D reconstruction and inspection of tall vertical structures (towers, pylons,
wind turbines, silos, buildings) where a single orbit only captures one altitude
band.

## Changes

- Add the `orbitz` template type with a `generateOrbitZ` generator that reuses the
  native orbit waypoint logic (constant radius, camera pointed toward the center)
  and stacks N complete orbits between an initial and final height.
- The number of levels is derived automatically from a vertical-overlap
  percentage and the camera vertical field of view — the same idea the facade
  scan uses to turn overlap into vertical coverage. Levels are spread evenly
  between the two heights, endpoints included.
- Each orbit closes back to its starting azimuth; the transition to the next
  level is a pure vertical climb at that azimuth. Gimbal pitch follows the orbit
  formula per level, tilting further down as altitude increases.
- Add the template to the toolbar dropdown (Layers icon) and bind it to the `S`
  keyboard shortcut ("Stacked"). Add its configuration panel (radius, points per
  orbit, initial/final height, vertical overlap, clockwise, center POI) with a
  live readout of the computed level count.
- Update GUIDE.md, README.md, and the `specs/` templates and keyboard-shortcuts
  entries.

## Notes

- The level count is capped at 60 to keep waypoint counts within the server-side
  mission limit.
- Uses the DJI wide-angle vertical FOV (63°), matching the value used by the
  camera FOV frustum overlay.
