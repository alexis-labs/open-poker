# Performance Budget (Desktop First)

This budget is a practical baseline for contributor validation until formal profiling automation is added.

## Targets

- Average FPS: 55+ during normal hand interactions.
- Frame-time spikes: avoid sustained spikes above 33ms during score popup sequences.
- Draw calls: <=130 idle and <=220 during active score popups.
- UI responsiveness: button taps and key actions should feel immediate (<100ms perceived latency).

## Test scenario

Run this check in a desktop Chromium browser:

1. Start a run.
2. Play at least 5 hands with score popups.
3. Trigger a restart and replay at least 2 more hands.
4. Toggle the debug panel (`F3`) and inspect FPS, draw calls, and triangles.

## Pass criteria

- FPS estimate remains near or above 55 most of the time.
- Draw calls stay under the targets above and do not trend upward each hand (no obvious leak pattern).
- No visible input lag when selecting cards and pressing play/discard.
- Overlay transitions remain smooth.

## Notes

- This budget is intentionally simple and manual.
- Use it as a guardrail in PR reviews, not a hard shipping benchmark.
