# Tracks Explorer

Small-scale fisheries tracking. Fishers see where their vessels have been, record
what they caught, and compare their results against their community.

## Language

### Fishers and vessels

**Fisher**:
A person who uses the application to track a vessel and record catches. Not
every fisher carries a tracking device.
_Avoid_: user, fisherman, boat owner

**Vessel**:
The boat a fisher goes to sea in.
_Avoid_: boat, ship, craft

**Fisher identity**:
The set of identifiers that select a fisher's records — IMEI, userId, username,
sometimes boat name. Which one applies depends on how the fisher joined, so
resolving them is a domain concern rather than a lookup detail.
_Avoid_: user resolution, auth, identification

**IMEI**:
The serial number of a vessel's tracking device, and the identifier that links
tracking data to a fisher. A self-registered fisher has none.
_Avoid_: device id, tracker id

**Community**:
The landing site a fisher operates from. The unit fisher stats compare against.
_Avoid_: village, region, port

### Movement

**Trip**:
One journey of a vessel, from leaving a landing site to returning. Built by
aggregating the trip points that share a trip id, not reported directly.
_Avoid_: voyage, journey, session

**Trip point**:
A single GPS fix within a trip: position, speed, heading, time.
_Avoid_: ping, fix, location, coordinate

**Live location**:
Where a vessel is now, as last reported by its tracking device. Distinct from a
trip point: it exists outside any trip and carries device state such as battery.
_Avoid_: current position, realtime location

**Waypoint**:
A place a fisher has saved and named — a port, an anchorage, a fishing ground, a
favourite spot. Private to the fisher who saved it.
_Avoid_: marker, pin, bookmark, favourite

### Catch

**Catch event**:
A fisher's report of what a trip landed, including a report of landing nothing.
_Avoid_: catch, landing, report, submission

**Fish group**:
The category a catch is recorded against — reef fish, sharks/rays, small
pelagics, large pelagics, tuna/tuna-like.
_Avoid_: species, fish type, category

**Fisher stats**:
A fisher's catch and effort figures over a period, alongside the equivalent
figures for their community.
_Avoid_: analytics, metrics, statistics, KPIs
