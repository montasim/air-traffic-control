# Arcade asset simplification

The runway and fleet now share the HUD's cream, dark teal, and cyan/amber/coral color system. Aircraft use retained vector geometry instead of the detailed raster atlas. Their minimum presentation lengths are 76 / 68 / 70 CSS pixels for liner / commuter / helicopter (bounded on very small viewports). A broad livery panel, cockpit and distinct silhouette replace fine windows and engine detail. The helicopter uses a symmetric, centered vector rotor.

Runways retain colored thresholds, sparse center dashes and clear L/C signs. Edge lights, numerals, wear marks, extra touchdown markings, parking lines and hold-short lines were removed from the first two maps. River Bend's commuter strip now fans southeast, differentiating it from Saltmarsh. Landing and guidance positions derive from the revised layout.

Terrain remains baked once. Airport vectors are retained separately to avoid the visibly jagged edges produced by rotating/downscaling a baked runway texture. Phaser scene teardown owns these retained graphics.

The simulation now bounds heading changes to four radians per second, taking the shortest angular turn. Route positions continue following the drawn path; this is orientation smoothing, not a new flight-dynamics model. Collision polygons use the same heading, outline and presentation scale as the visible airframes; decorative outlines, shadows and rotor blades are not fatal surfaces.

Validation: the new heading-continuity tests failed on the old 90-degree one-frame snap and angle-wrap behavior, then passed with the fix. All 224 tests pass; production build passes. Browser checks cover Saltmarsh and River Bend, including a 390 × 844 phone viewport.
