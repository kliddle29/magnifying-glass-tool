# Break Log

Real failures found by actually using the tool, not hypothetical ones.
Each entry: date, the commit that documents or fixes it, what broke,
what changed.

---

### 1. 2026-09-22 — macOS Accessibility Zoom causes double magnification

**Commit:** `67e1c77`

**What broke:** Turning on macOS's built-in Accessibility Zoom
(System Settings → Accessibility → Zoom) while the lens is active
magnifies the lens window itself along with everything else on
screen — the lens's own 3x zoom gets zoomed again by the OS on top of
it, and the result is illegible.

**What changed:** No code fix. Accessibility Zoom works by magnifying
the entire composited screen at the WindowServer level, above every
app running on the system, including this one. There's no API for a
regular app to exclude itself from it — `setContentProtection()`
excludes a window from screen *capture* (a different layer), not from
how the OS *displays* it. Documented as a known limitation in
`README.md` instead of attempting a workaround that can't actually
address the real cause.

---

### 2. 2026-09-22 — Lens shows wrong/clipped content after crossing monitors

**Commit:** `4abbeb2`

**What broke:** Dragging the cursor (and the lens, which follows it)
from one monitor onto a second one kept showing content from the first
monitor, clipped and misaligned, instead of switching to the new
display.

**What changed:** The video stream from `getDisplayMedia()` is
acquired once, for whichever display the cursor was on at toggle-on
time, and was never re-requested after that. `renderer/lens.js` still
computed crop coordinates from the *live* cursor position on the *new*
display, against video pixels captured from the *old* one — correct
bounds math, wrong source frame. Fixed by tagging each stream with the
display ID it was captured for and comparing that against the live
cursor's display on every update; a mismatch tears down the old stream
and reacquires for the current one.

Caught a bug in the fix itself while testing it: the mismatch check
required the previously-captured display ID to be non-null before
comparing, meant to avoid a spurious reacquire right after toggle-on.
But the very first capture on toggle-on can itself complete with a
null target (a real race between the activation message and the first
cursor-position update), which then permanently blocked every future
comparison — the multi-monitor fix would never have actually fired in
practice. Found by feeding a fabricated display-ID mismatch through
the same IPC channel the real cursor tracker uses (no second monitor
available to test against directly) and watching it fail to reacquire;
removing the null guard fixed it and was re-verified the same way.

---

### 3. 2026-09-22 — Lens freezes after the display sleeps and wakes

**Commit:** `eff8309`

**What broke:** After the Mac's display went to sleep and woke back
up, the lens stayed on but showed a frozen frame from before sleep
instead of a live one.

**What changed:** A `getDisplayMedia()` video track doesn't reliably
fire its `ended` event across a sleep/wake cycle — it can just stop
updating and sit on its last frame instead of signaling that anything
happened. Electron's `powerMonitor` fires a `resume` event when the OS
actually wakes, a direct signal from the system instead of an
assumption about video-track behavior. `main.js` now listens for it and
tells the renderer to reacquire the capture whenever the lens is
active.
