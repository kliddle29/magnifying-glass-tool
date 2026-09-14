# System Charter

Fill this out before writing any code. One paragraph per section, plain
language. Copy this file as-is into every fork; only the answers change.

*Drafted from the mechanics decisions made in chat (fixed zoom, cursor-only
signal, click-to-toggle activation) — read it over and edit anything that
doesn't actually match your intent before you call it final.*

## Intent

What is this sketch about — in one sentence, not a feature list?

> A lens that follows the cursor and shows a magnified view of whatever is
> underneath it, only while you've deliberately switched it on.

## Signal

What real-world input drives the system? Where does it come from?

> Cursor position, read from `mousemove` on the current page. A second,
> discrete signal — the toolbar icon click — comes in as a runtime message
> from the extension's background script.

## Parameter

What number in the sketch actually changes, and across what range?

> The lens's screen position, tracking the cursor 1:1. Zoom is a constant
> (2.5x), not a parameter — nothing currently varies it.

## Behavior

How does the signal map to the parameter — in words, before it's code?

> While active, the lens's center follows the cursor exactly, one frame
> behind at most. The toggle signal doesn't map to a number — it flips the
> lens between rendered and not-rendered.

## Constraints

What's off the table for this pass? Naming a constraint here is what
lets `loop.js` stay a sketch instead of growing into an app.

> One continuous signal (cursor position), one discrete signal (toggle).
> Fixed zoom — no scroll-to-zoom, no adjustable lens size. No persistence
> of the on/off state.

## Non-goals

What would be reasonable to add, but isn't part of this charter?

> Correctly magnifying `<canvas>`/`<video>` content or cross-origin
> iframes (the lens works by cloning DOM, which can't see into either).
> Following custom-scroll containers instead of native window scroll.
> Remembering the toggle state across a full page navigation. Any of
> these is a new charter, not an extension of this one.
