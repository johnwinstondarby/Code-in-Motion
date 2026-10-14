# Mobile Player policy

The interactive Player does not load on mobile. The WordPress bootstrap checks before importing the Player, engine, renderer or lesson modules. It displays: “The interactive Player needs a desktop or laptop with a wider window. Widen this window and reload, or open the lesson on a larger screen.” Other page content remains available.

Mobile means a viewport at or below 767 CSS pixels, or a primary coarse pointer with no hover (including phones in landscape and touch-only tablets). Desktop and laptop browsers above that width continue to load normally. The decision is made at page load; reload after changing device or window size. Dynamically inserted lesson embeds receive the same notice.

This applies to all Code in Motion embeds. Mobile support is deferred until a usable layout and touch controls have been reviewed on real devices.
