# World Feedback

The docs don't make it clear that Selfie Check (World ID 3.0) and the newer Actions (World ID 4.0) use different environment settings. Selfie Check needs sandbox, while Actions only registers staging or production. That mix-up caused a real bug in the codebase before it got caught and fixed.

IDKit's bundled widget also has a bug: it fails to load in Vite's dev server because of a WASM loading issue, not anything wrong with World's backend. The fix was calling World's request-signing function directly instead of using the widget.

Most testing went through the Developer Portal's API rather than the UI, so there isn't much feedback on that front, other than it's not obvious which settings apply to Selfie Check versus the newer Actions.

Edge cases tested and handled: a valid proof, an invalid or expired proof, a proof that's already been used once (World correctly rejects it), and World's server being unreachable.
