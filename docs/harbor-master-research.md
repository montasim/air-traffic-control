# Harbor game research

2026-10-04 — research for a separate 2D harbor traffic game, starting on the web and later packaged for desktop and Android. This note distinguishes published descriptions from proposed design. No games were playtested for this research, and no sales or demand estimate is implied.

## Verified reference games

| Reference | Evidence from its creator or developer listing | Design implication |
| --- | --- | --- |
| Imangi's **Harbor Master** | Imangi still names the game in its official studio history. In a 2009 developer announcement signed Natalia, ships enter docks, remain while unloading, and must leave to free the dock. Bigger vessels move more slowly, carry more cargo, and take longer to unload. [Studio history](https://imangistudios.com/), [developer announcement, posts 1 and 7](https://forums.macrumors.com/threads/sneak-peek-harbor-master-from-imangi-studios.699339/) | The proposed name already identifies an existing game. Dock occupancy, outbound routing, and ship size versus cargo tradeoffs are established mechanics. |
| **Harbor Captain**, Urban Isotope | Its Steam listing describes drawn routes, matching docks, unloading followed by departure, collision avoidance, and waiting for passage through narrow canals. Its Android listing describes touch drawing, ship speed, unloading time, and yachts, container ships, and tankers. [Steam developer listing](https://store.steampowered.com/app/2875480/Harbor_Captain/), [Google Play developer listing](https://play.google.com/store/apps/details?hl=en&id=com.urbanisotope.harborcaptain) | A very close contemporary reference already exists on desktop and Android. Simply replacing planes with boats and adding departures would offer little distinction. |
| **Lighthouse: Safe Harbor**, CleverJoy Games | Its official page describes selecting a vessel and tapping a new course, respecting turn radius, avoiding coastlines, rocks, currents, and other vessels, then crossing a harbor entrance. It advertises a browser experience with 27 levels. [Official game page](https://www.cleverjoygames.com/games/en/lighthouse-safe-harbor/) | Constrained turns, geographical obstacles, and a browser delivery format also have precedent. The control design differs from freehand routing. |

The historical Imangi product page and old Apple product listing could not be retrieved. The historical mechanical description above comes from the developer announcement, not a verified current installation. The official studio history independently supports the naming collision. Treat **Harbor Master** as a concept label and choose a separate release name; this research is not a name-availability clearance.

## Recommended direction — our proposal

Build a compact game about coordinating arrivals and departures through a shared channel. The visual promise is a small, readable working harbor: boats leave wakes, cranes visibly unload cargo, and every finished shipment requires a safe exit.

The distinctive emphasis should be a manually controlled channel signal. The player opens the channel for inbound or outbound traffic; switching direction waits until the current traffic clears. Ships queue at a marked anchorage or departure staging area. This creates an explicit scheduling decision alongside route drawing: when should arrivals stop so waiting departures can free the docks?

This is a proposed combination and emphasis, not a claim that channel signals or any individual mechanic are unprecedented. The researched competitors already include narrow channels and waiting.

An example situation: a cargo ship is approaching a busy berth while a serviced vessel is ready to leave. Hold the arrival at an anchorage, clear the outbound vessel through the channel, then reverse the signal and bring the arrival in. A smaller vessel can service its own berth sooner, but still needs a safe channel slot. The interesting choice is the order and timing of moves.

## First playable scope — our proposal

- One harbor map with land, one shared entrance channel, and two single-berth docks.
- Two ship classes with readable silhouettes and different speed, turn radius, and service duration.
- Draw or replace a ship's route using the same mouse/touch gesture.
- A visible lifecycle: arriving, holding if necessary, docking, servicing, ready to depart, outbound, completed.
- Obvious holding and staging locations; no invisible queue behavior or unexplained automatic departures.
- One channel direction control, including a clear “clearing” state before reversal.
- Ship-to-ship and ship-to-land collisions that match the visible hulls. Preview achievable curves so players can understand turn limitations.
- A short tutorial, pause, restart, and local best score. Award completion credit after safe departure so the outbound leg matters.

First validate that routing feels predictable, waiting is understandable, and choosing the next channel direction creates satisfying decisions. A handful of players should be able to explain why a collision happened and how they would avoid it next time. These are proposed playtest criteria, not measured results.

Defer tides, storms, tugboats, fuel, upgrades, port construction, multiple maps, online leaderboards, and monetization until this loop works. A tidal access window is a possible later scenario, but adds no value if basic scheduling is already confusing.

## Fit with the current project

The existing project already declares Phaser, TypeScript/Vite, Electron desktop scripts, and Capacitor Android scripts. That supports retaining the current web-first packaging approach. [Local package configuration](../package.json)

The simulation uses a fixed time step, seeded randomness, and route geometry without importing Phaser. Those are useful foundations for repeatable traffic and isolated gameplay tests. However, its aircraft move directly along the route polyline before their visible heading turns; reducing the heading rotation rate alone would not produce a ship's actual turning radius. A vessel movement model must constrain position as well as heading. [Simulation implementation](../src/core/Simulation.ts)

Aircraft currently disappear after a short landing animation, and the code explicitly states that runways are never reserved. Occupied berths, timed service, departing vessels, and channel ownership need new state and rules. This is a new game simulation built on useful infrastructure, not only an art replacement. [Landing and movement implementation](../src/core/Simulation.ts)

Phaser documents unified mouse/touch pointer input and custom hit areas, which fit route drawing and generous selection targets. Its official Capacitor tutorial describes packaging a Phaser web game for Android and iOS. These establish technical suitability, not a guarantee of device performance or zero porting work. [Phaser input documentation](https://docs.phaser.io/phaser/concepts/input), [Phaser Capacitor tutorial](https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor)

## Research limits

This is a bounded comparison of three close references, based on primary descriptions and local source inspection. It does not establish global originality, commercial demand, current historical-game availability, or the practical feel of competitors' controls. The next useful evidence is a playable harbor prototype and observed mouse/touch sessions.
