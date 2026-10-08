# Railway Rush: research and prototype recommendation

2026-10-05 — research conducted on October 4–5 for a separate 2D railway dispatch game, starting on the web and later packaged for desktop and Android. The proposed interaction is tapping switches and stop/go signals on a fixed track map. Published descriptions and our design inferences are separated below. No competing games were playtested for this research.

## Main finding

The concept has strong precedents, especially **Conduct THIS!**. A browser game already uses the exact name **Railway Rush** and describes a particularly close combination of colored destinations, junction switching, signals, and escalating arrivals. Treat the title as a working label and build a clear identity around the intended dispatch experience. These findings establish competition and naming overlap, not commercial demand or legal name clearance. [Conduct THIS! developer listing](https://play.google.com/store/apps/details?id=co.northplay.ConductTHIS), [Railway Rush official game page](https://bizzibeearcade.com/railway-rush/)

## Verified reference games

| Reference | Evidence from its developer or developer listing | Design implication — our inference |
| --- | --- | --- |
| **Conduct THIS! / Conduct TOGETHER!**, Northplay | Conduct THIS! explicitly uses taps to start/stop trains and operate switches. Its timed action puzzles involve transporting passengers and avoiding collisions, with unlockable trains and regions. Conduct TOGETHER! adapts commanding trains and switching tracks to solo or cooperative play on Switch. [Conduct THIS! on Google Play](https://play.google.com/store/apps/details?id=co.northplay.ConductTHIS), [Conduct TOGETHER! official page](https://www.conductthis.com/together) | The closest established reference for simple controls producing scheduling pressure. Changing aircraft into trains is insufficient differentiation. A strong local identity, readable decisions, and fair timing matter more than adding many systems. Cooperative play is a possible later direction, not an MVP requirement. |
| **Train Valley**, Flazm | Players build railways and use switches, sidings, and spurs to manage increasing traffic. They can plan, construct, and schedule while paused. The developer listing describes story sessions of 5–10 minutes and random sessions of 15–20 minutes. [Steam developer listing](https://store.steampowered.com/app/353640/Train_Valley/) | Sidings create meaningful overtaking and waiting decisions. Fixed maps can preserve those decisions while removing construction and money management. Decide deliberately whether pause is merely an interruption feature or also a planning tool; those produce different difficulty. |
| **Rail Route**, Bitrich.info | The game combines dispatching with network construction, upgrades, and automation. Its modes include open-ended network growth, preset timetable puzzles, and Rush Hour dispatching waves. It also includes a map editor. [Steam developer listing](https://store.steampowered.com/app/1124180/Rail_Route/), [official wiki](https://wiki.railroute.eu/) | Timetable sequencing and arcade pressure can support separate modes. Automation, contracts, and track construction are substantial additional products to design, so they should not define this small first version. Short fixed shifts are a proposed scope choice, not an unoccupied genre niche. |
| **Mini Metro**, Dinosaur Polo Club | Players draw subway lines, revise them as new stations appear, and allocate limited resources. The official game page links mobile, desktop, and console releases. [Official game page](https://dinopoloclub.com/games/mini-metro/) | A useful reference for reducing a transport system to a readable map and a few decisions. Railway dispatch should emphasize the immediate order of individual trains; network redesign would move the player toward a different central activity. Its platform spread is evidence of precedent, not proof that this project's port will be effortless. |
| **Train Conductor World**, The Voxel Agents | The developer describes fast train routing, crash avoidance, varied terrain, and a growing rail network. Its current Android update notes include distinct warning lights for fast and slow trains and an untimed Cargo Run mode. [Official game page](https://trainconductorworld.com/), [Google Play developer listing](https://play.google.com/store/apps/details?id=com.thevoxelagents.tc3) | Different train speeds need clear visual warnings before they create conflicts. Separate the arcade round from any longer progression layer; test whether the round is fun before adding unlock economies or world expansion. |

## Naming discovery

Two primary product pages already use **Railway Rush**:

- **BizziBeeArcade's browser game** describes routing trains to cargo platforms by color, cycling junctions, changing train speed, placing stop signals, and increasingly frequent arrivals. Its page distinguishes misrouting penalties from collisions and advertises mouse and touch controls. Its studio states that it develops its current catalog in-house. This is both an exact-title collision and close mechanical overlap. The page's claims about generated-map validation and solver tests were not independently reproduced. [Game page](https://bizzibeearcade.com/railway-rush/), [studio's ownership statement](https://bizzibeearcade.com/about)
- **Mini Mammoth Placements' Android game** uses the exact title for a different action game involving a moving cart, enemies, shooting, and escalating speed. The title remains relevant to discoverability even though the mechanics differ. [Google Play developer listing](https://play.google.com/store/apps/details?id=com.minimammothgames.RailwayRush)

Recommendation: choose a different release name after the prototype earns further investment. Search results do not establish trademark status, ownership priority, or worldwide name availability, and this research makes none of those claims.

## Lessons to test in our prototype

These are proposed design hypotheses, not features verified as unique or conclusions from player testing:

1. **Make the decision about priority.** Show the next arrivals so the player can decide which train should occupy a shared crossing or single-track section first. A satisfying sequence could be holding a passenger train, clearing freight into a siding, then releasing the passenger service.
2. **Use short shifts to give waiting a cost.** A fixed-duration round scored by completed deliveries prevents indefinite stopping from being a successful scoring strategy. A later endless mode would need an explicit backlog or lateness rule; collision-only survival invites excessive stalling.
3. **Make consequences readable.** Clearly show the selected branch, a signal's stopping point, a train's destination using both color and symbol, and whether a junction is occupied. These are proposals for fairness and usability, not a railway-simulation specification.
4. **Keep complexity spatial.** Introduce a siding, shared crossing, or single-track bridge as a new scheduling problem before introducing new currencies, construction tools, or upgrade menus.
5. **Validate interaction before content volume.** One strong map can establish whether switching and releasing trains feels intentional on both mouse and touch. Multiple maps, train collections, and monetization do not answer that question.

The proposed combination should be presented as a focused interpretation of an established genre. The research does not support claims that switches, signals, previewed arrivals, short shifts, or train priority are unprecedented.

## Recommended game direction

Everything in this section is a proposed design, not a measured player preference. **A three-minute railway dispatch shift: route trains to matching stations by choosing who waits and who moves.** Use one input gesture, a tap or click, on two kinds of control: switches select a branch; signals hold or release traffic. The first playable version should have fixed tracks and fixed signal locations.

An example from a later map: a long freight train occupies the shared route while a passenger train approaches. Hold the passenger train, let the freight's last wagon clear, set the junction, then release the passenger service. A preview of the next arrival makes the decision about available time and space. Start the actual prototype with identical short trains; differing lengths and speeds should earn their place through playtesting.

### Rules worth making explicit

| Rule | Proposed first implementation | Why it matters |
| --- | --- | --- |
| Session | Three minutes of active play; collision ends the shift early. | A predictable commitment with a reason to replay. Three minutes is a tuning hypothesis. |
| Goal | Correct delivery earns one point; wrong terminal subtracts one, with a score floor of zero, and removes that train. | Delivery throughput gives waiting an opportunity cost. Compare best scores for completed shifts; collision results can still show deliveries achieved. |
| Station behavior | A delivered train clears the board once its tail has entered the terminal. | Return trips, reversing, unloading, and platform queues can wait. |
| Arrivals | Preview approaching services and queue them safely outside an occupied entrance. | Do not spawn a collision. Unserved trains at shift end earn nothing; no hidden patience timers in this prototype. |
| Same-direction following | Trains queue safely behind a stopped train on the same approach. | The player's principal conflict is releasing traffic into shared junctions, rather than managing every rear-end gap. |
| Signals | A red signal stops approaching trains at its marked line. Once a train passes that line, changing the signal affects later trains. | Players need an unambiguous last point for intervention. |
| Switches | Highlight the selected branch continuously. Lock a switch while any part of a train is traversing it; show why a tap was rejected. | Wagons must follow their locomotive's chosen route. Never silently store a tap for an unexpected later change. |
| Collision | Conflicting trains physically overlap at a merge, crossing, or shared track. | A warning is advisory; the player still decides when to release. Parallel rails and bridges at different heights must not collide. |
| Pause | Freeze simulation and audio, disable dispatch input, and require explicit resume after backgrounding. | Interruptions must not consume the player's shift. |

The fixed duration makes holding every signal red worth zero points. Do not award progression merely for surviving the clock: future medals or unlocks should require successful deliveries. If endless survival is added, introduce a visible congestion or lateness limit so indefinite waiting cannot become the dominant strategy. These rules still need playtesting for exploits, especially deliberately discarding difficult trains.

Increase the frequency and overlap of arrivals before increasing train speed. Begin with an isolated delivery, introduce two competing arrivals, then require alternating releases through a shared route. Keep the early training sequence repeatable. Random arrival schedules should stay within a validated difficulty envelope; a connected map alone does not prove that its timetable is fair.

### Prototype, first release, and later additions

| Stage | Included | Question it answers |
| --- | --- | --- |
| Playable experiment | One map: two entrances merge into one trunk, then a binary switch selects two terminals. Two approach signals, two destination symbols, one train length and speed, arrival preview, scoring, collision, restart. | Is deciding release order and changing the branch enjoyable with a mouse and a finger? |
| First browser release | Three authored maps, three color-and-symbol destinations, a short interactive tutorial, a three-minute shift mode, local records, sound settings, offline support, pause/resume. Add desktop and Android builds after browser and real-device checks. | Does the loop remain readable and replayable across layouts and devices? |
| Later experiments | Long freight, express trains, passing loops, a single-track bridge, station dwell time, an endless mode with a clear congestion rule. | Does each addition create a distinct decision worth its complexity? |

Suggested first-release maps are **Meadow Junction** (one shared merge), **River Crossing** (a crossing where two routes conflict), and **Town Approach** (several junctions that must be set in sequence). These are unchecked internal map labels. Keep their tracks directed initially; two-way running, reversing, tunnels hiding traffic, and overtaking loops introduce extra rules and belong after the basic routing is proven. Every entrance must have a legal route to every destination it can be assigned.

Use a top-down miniature railway style with restrained scenery, strong track contrast, and prominent station symbols. Let tracks, route arrows, stop lines, and train destinations carry the important information. Trees and buildings should not obscure control targets or train tails. A full construction economy, map editor, multiplayer, and train upgrades would substantially widen the project.

### Touch and small-screen decisions

- Design and test the first map at an actual phone viewport, such as 390 × 844 CSS pixels, before expanding the desktop layout. Fit the complete playable network on screen; avoid requiring pan or zoom during dispatch.
- Target approximately 48 × 48 CSS pixels for frequent controls, measured after canvas scaling, with separated hit areas. This is a project recommendation informed by W3C's 44 × 44 CSS pixel enhanced target-size criterion, not a claim of overall accessibility conformance. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
- Pair destination colors with shapes or letters, and show stop/go with distinct symbols as well as colors. Essential meaning should not depend on color alone. [W3C use-of-color guidance](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- Make the selected branch and incoming destination visible without hovering. Do not require dragging, double-tapping, or precisely selecting a moving train for core play.
- Keep a stable track topology during a shift. A resize or rotation may pause and refit it, but must not reroute trains or rebuild the junction graph.
- Preserve the current pause-on-background pattern, and validate Android activity lifecycle handling on a device. Capacitor supplies app-state and pause/resume events; choosing and testing the pause policy is still application work. [Capacitor App API](https://capacitorjs.com/docs/apis/app)

## What Air Control can contribute

This assessment comes from the current local source, not solely its README. It is a reuse recommendation, not a claim that the components can be copied unchanged.

| Existing foundation | Verified local evidence | Reuse recommendation |
| --- | --- | --- |
| Web, desktop, and Android build paths | [package.json](../package.json), [Vite configuration](../vite.config.ts), [Electron entry](../electron/main.cjs), [Capacitor configuration](../capacitor.config.ts) | Keep the familiar TypeScript/Phaser/Vite approach and packaging patterns. Give the new game its own app identity, assets, protocol, save location, and store configuration. |
| Simulation separate from rendering | [Simulation](../src/core/Simulation.ts) uses fixed steps, seeded randomness, snapshots, and queued events. | Reuse this organization. Build a railway simulation around track segments and junctions. |
| Difficulty and traffic pacing | [Pacing functions](../src/core/pacing.ts) use configurable arrival and traffic-limit stages. | Reuse the staged-pacing approach; retune it for track capacity and terminal throughput. |
| Local persistence | [IndexedDB persistence](../src/storage/persistence.ts), [save schema](../src/storage/gameSave.ts) | Adapt the persistence pattern with a fresh railway save schema and database name. Existing map IDs, aircraft progress, and migration history are game-specific. |
| Audio and interruption behavior | [Audio manager](../src/audio/AudioManager.ts), [main application](../src/main.ts), [Android shell](../src/platform/android.ts) | Reuse audio unlocking, volume, suspension, and shell patterns; replace cues and feedback events. The main application already pauses when the document becomes hidden. |
| Responsive layout | [Viewport helpers](../src/game/viewport.ts) | Reuse resize/pause principles. Author and check railway layouts for reachable, non-overlapping controls instead of assuming scaled airfield layouts are suitable. |

The aircraft path drawing, flight turning, runway capture, aircraft collision polygons, and aircraft rendering are specific to the existing game. In particular, [aircraft collision detection](../src/core/aircraftCollision.ts) uses airframe outlines; a train's occupied track and trailing length require a different model.

For a small railway simulation, store each train's current segment and distance along it, plus its destination and traversal history. Junctions select the next segment. Track definitions identify merges, ground-level crossings, and non-conflicting overpasses explicitly. Follow the same chosen path with the tail and any wagons; do not calculate their path from the switch's current state. Test swept movement through conflict areas so a long frame cannot let trains jump through each other undetected. These are proposed implementation choices, not existing railway features in Air Control.

Overall scope is **small in interface and content, medium in simulation and balancing**. Reusing the platform work saves effort, but collision fairness, stopping behavior, touch readability, and schedules remain new work. A calendar estimate would be premature until the one-map experiment is playable.

## How to decide whether to continue

Use a small exploratory playtest with new mouse and touch players; for example, five people is a practical first round, not a statistically representative market test. Observe whether they can identify the destination, set the branch, hold one train, and safely release another after a brief tutorial. Record mis-taps, unexplained losses, reliance on pausing, and whether a player voluntarily restarts. Ask them to explain the cause of a loss before explaining it yourself.

Useful prototype checks include:

1. All assigned destinations are reachable, and scheduled arrivals are safely admitted.
2. Holding a train, changing a free switch, and releasing it has a predictable outcome.
3. Occupied switches remain locked until the tail clears; following trains keep a safe gap.
4. Conflicting paths collide correctly, parallel tracks and overpasses do not, and long frames do not skip a collision.
5. Pause, backgrounding, and resizing preserve trains, queues, switch settings, and elapsed time.
6. Holding everything, never touching a switch, and deliberately misrouting trains cannot outperform competent delivery play on the same arrival schedule.
7. Essential controls remain legible and tappable on the target phone with sound off.

Proceed to three maps when the first map creates understandable decisions and repeat play. If players mostly miss small controls, fix the layout; if they cannot predict a train's movement, fix route feedback; if the optimal strategy is repetitive waiting, revise the network and timetable before adding features. No game implementation or competitor playtesting was performed as part of this research.

## Evidence limits

This is a bounded comparison of five relevant game families plus two exact-title discoveries. It relies on developer websites, official documentation, and developer-authored store descriptions as retrieved on 2026-10-04. Store text can change, and descriptions are not substitutes for hands-on playtests. Review counts, sales, retention, revenue, and market-size estimates were intentionally not used to predict this project's success. The next useful evidence is a playable prototype and observed sessions with new mouse and touch players.
