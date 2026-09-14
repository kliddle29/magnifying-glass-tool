# Working with AI on this engine

This engine is small enough to hand to an AI assistant almost whole.
That's useful, and also exactly how a sketch stops being yours. These
are the ground rules for this course.

## Write the charter yourself, first

If an AI assistant writes `docs/SYSTEM_CHARTER.md`, it will invent a
signal-parameter-behavior mapping instead of you deciding on one — the
charter stops being a record of your intent and becomes a record of
its guess. Ask for code only after the charter is written.

## Good prompts name the module

The engine is split on purpose: signal capture, parameter mapping, and
drawing are three different files. A prompt that names which one
you're changing gets a smaller, more honest diff than one that doesn't.

> Good: "In `src/canvas/loop.js`, map ring radius from mouse Y instead
> of mouse X, using the existing `mapRange` helper."
>
> Vague: "Make the ring respond to the mouse better."

## Templates

Fill in the blank and use as-is.

> "In `src/canvas/loop.js`, change the parameter from ring radius to
> ___, keeping the signal on `input.___`."

> "In `src/input/input.js`, the signal should come from ___ instead of
> mouse position. Update `input` and whichever listener captures it."

> "In `src/utils/math.js`, add a helper that ___. Keep it a pure
> function like the existing three."

> "Something in `___.js` is doing ___ instead of ___. Read the file
> back to me before changing anything."

## Ask for the tradeoff, not just the code

If a change is a real departure from the charter — a second signal, a
new dependency, a rewrite of a module instead of an edit — ask the
assistant to name that explicitly before it writes anything. Silent
scope creep is harder to catch in a diff than in a sentence.

## Verify what "working" means

An assistant that says a sketch works because the code looks right,
without having run it, is guessing. Ask it to actually load the page
and describe what moved, or check that yourself before trusting a
"done."

## Log what changed, in your own words

`process/changelog.md` entries should read as your account of what
happened, not a pasted commit message. If you can't summarize a change
in your own words, you don't understand it well enough to submit it.

## Don't let the writing sound like nobody wrote it

If a docstring, comment, or changelog entry reads like generic AI
prose, rewrite it or cut it. Constraints, tradeoffs, and specific
numbers are worth keeping; hedge words and filler aren't.
