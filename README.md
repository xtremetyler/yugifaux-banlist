# YugiFaux Dynamic Limeade List

Static public website for the YugiFaux custom-card league.

## Preview locally

Serve this directory with any static web server. The page loads card information from `data/banlist.json`; opening `index.html` directly will not work in every browser because browsers restrict local JSON requests.

## GitHub Pages

Publish the repository from the `main` branch and `/(root)` folder. The `.nojekyll` file tells GitHub Pages to serve these files without Jekyll processing.

The included JSON contains preview data. It will be replaced by the bot-generated public export after the layout is approved.
