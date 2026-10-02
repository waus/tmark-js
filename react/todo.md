# React TODO

## Rendering

- `pre.language`: the field exists in the TS model, but React does not use it for the class/data attribute or highlighting. Need to choose the minimal contract (`className`, `data-language`, render prop).
- `map`: the default renderer lazily loads Leaflet + OpenStreetMap tiles. Need to decide later whether a `mapRenderer` prop is needed separately from the general `mediaRenderer`.

## Markup/CSS contract

- Check how refs and internal links work.
