# YugiFaux Dynamic Limeade List

Static public website for the YugiFaux custom-card league, including the Dynamic Limeade List, Draft Night, league rules, the Archetype Archive, and the YugiFAUX DuelingBook Companion page.

## Preview locally

Serve this directory with any static web server. The Limeade List, Draft Night, and Archetype Archive load their public data from `data/banlist.json`; opening the pages directly will not work in every browser because browsers restrict local JSON requests.

## GitHub Pages

Publish the repository from the `main` branch and `/(root)` folder. The `.nojekyll` file tells GitHub Pages to serve these files without Jekyll processing.

The included JSON contains preview data. It will be replaced by the bot-generated public export after the layout is approved.
