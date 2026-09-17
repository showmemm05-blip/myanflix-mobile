# Where a component goes

The split between `ui/` and `common/` is real, it just was never written down.
It is one question:

**`ui/` — design-system primitives that know NOTHING about MyanFlix.**
A `Button`, a `Surface`, a `BottomSheet`. If it would drop unchanged into
another app, it belongs here.

**`common/` — shared components that DO know the domain.** An `AccessBadge`
that reads `AccessType`, a `MediaCard` that lays out a poster, a `GamePlate`
that knows the arcade, a `StatTile` that speaks in role tones, an
`AuroraBackdrop` that knows the palette. Used by more than one feature folder.

**`<feature>/` — everything used by exactly one screen family:** `arcade`,
`auth`, `books`, `comments`, `detail`, `feedback`, `layout`, `movie`,
`player`, `profile`, `search`, `series`, `wallet`.

`Chip`, `Skeleton` and `ProgressTrack` are domain-free and would sit in `ui/`
under this rule. They are left in `common/` because moving them rewrites 22
import lines for no functional gain. Move one only if it is being edited
anyway.
