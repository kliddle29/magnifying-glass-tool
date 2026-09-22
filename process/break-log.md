# Break Log

Real failures found by actually using the tool, not hypothetical ones.
Each entry: date, the commit that documents or fixes it, what broke,
what changed.

---

### 1. 2026-09-22 — macOS Accessibility Zoom causes double magnification

**Commit:** (filled in below, after this commit exists)

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
