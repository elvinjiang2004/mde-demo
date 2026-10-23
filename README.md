# Mechanism Design Explorer

A static, no-build collection of textbook-style, interactive mechanism-design
modules. MathJax 4 is vendored locally so mathematical typesetting works
offline.

**Live site:** https://elvinjiang2004.github.io/mde-demo/

## Open the site

Open `index.html` in a modern browser. It is the module menu and requires no
installation, local server, or internet connection.

The available modules are located at:

    general-topics/what-is-mechanism-design/index.html
    general-topics/envelope-theorem/index.html
    general-topics/revelation-principle/index.html
    auction-equilibria/first-price/index.html
    auction-equilibria/second-price/index.html
    auction-design/optimal-auctions/index.html
    auction-design/ironing/index.html
    bilateral-trade/bargaining-mechanism-sandbox/index.html
    bilateral-trade/myerson-satterthwaite-theorem/index.html

Explicit `index.html` paths are used so navigation works through `file://`.

## Current menu

The menu contains four groups. Auction Equilibria, Auction Design and Bilateral
Trade link to shared Environment pages beside their group titles. General Topics
keeps its definitions on the individual module pages:

- **General Topics**
  - What is Mechanism Design?
  - The Envelope Theorem
  - The Revelation Principle
- **Auction Equilibria**
  - [Environment](auction-equilibria/environment/index.html)
  - First-Price Auction Equilibrium
  - Second-Price Auction Equilibrium
- **Auction Design**
  - [Environment](auction-design/environment/index.html)
  - Optimal Auctions
  - Ironing
- **Bilateral Trade**
  - [Environment](bilateral-trade/environment/index.html)
  - Bargaining Mechanism Sandbox
  - Myerson-Satterthwaite Theorem

Auction module folders now match their menu groups: `auction-design/` and
`auction-equilibria/`. Each module links to its group's
Environment page where present. Environments have no subsections. Auction Design
shares the Optimal Auctions setup, including its Revelation Principle passage
and IC/IR conditions. Bilateral Trade uses the sandbox's condition definitions
and the direct-mechanism passage from Myerson-Satterthwaite. Both Environments
also define interim allocation, payment, payoff and virtual-value notation and
BIC/DSIC implementability; Auction Design defines regularity. Existing results
and demo instructions remain on the module pages.

## Browser checks

Open these files in a browser to run the test suites:

- `tests/all.html` — runs every suite below and reports one total. It loads
  each suite in an iframe, so it must be served over HTTP: run
  `py -m http.server 8000` from the repository root and open
  `http://localhost:8000/tests/all.html`. Opened directly as a file it says
  so rather than reporting failures.
- `tests/menu-tests.html` — menu structure, categories, routes, and availability.
- `tests/environment-tests.html` — group Environment navigation, local math, and responsive layout.
- `tests/distribution-tests.html` — shared Uniform/Beta kernel checks.
- `tests/components-tests.html` — shared page-component checks.
- `tests/model-tests.html` — first-price economic model checks.
- `tests/ui-tests.html` — first-price interface and SVG checks.
- `tests/second-price-model-tests.html` — second-price economic model checks.
- `tests/optimal-auctions-model-tests.html` - exact interim payments, BIC, and virtual revenue.
- `tests/optimal-auctions-ui-tests.html` - allocation painting, lotteries, reset, and responsive charts.
- `tests/second-price-ui-tests.html` — second-price interface and SVG checks.
- `tests/bilateral-trade-model-tests.html` — bilateral-trade model checks.
- `tests/bilateral-trade-ui-tests.html` — bilateral-trade interface and SVG checks.
- `tests/bargaining-sandbox-model-tests.html` — bargaining-sandbox model checks.
- `tests/bargaining-sandbox-parity-tests.html` — formula/legacy-mesh parity and shared M-S payment checks.
- `tests/bargaining-sandbox-ui-tests.html` — bargaining-sandbox interface and SVG checks.
- `tests/envelope-theorem-model-tests.html` — envelope-theorem model checks.
- `tests/envelope-theorem-ui-tests.html` — envelope-theorem interface and responsive-layout checks.
- `tests/ironing-model-tests.html` — exact interim envelopes, piecewise-uniform distributions, Border feasibility, and Myerson ironing.
- `tests/ironing-ui-tests.html` — distribution and allocation editing, benchmark comparison, and responsive charts.
- `tests/revelation-principle-model-tests.html` — exhaustive voting equilibria and truthful-reporting checks.
- `tests/revelation-principle-ui-tests.html` — ranking swaps, mode transitions, voting history, and responsive layout.

The iframe-based menu and interface checks may require a local static server or
a browser configuration that permits local-file iframe access. This does not
affect ordinary use of the menu or module pages.

## Files

- `index.html` — module menu.
- `about.html` — About page, linked from the menu header.
- `auction-equilibria/first-price/` — first-price module page, model, and controls.
- `auction-design/optimal-auctions/` - two-bidder allocation editor and revenue diagnostics.
- `auction-design/ironing/` — symmetric interim-allocation editor, feasibility, revenue, and ironing.
- `auction-equilibria/second-price/` — second-price module page, model, and controls.
- `bilateral-trade/myerson-satterthwaite-theorem/` — bilateral-trade module.
- `bilateral-trade/bargaining-mechanism-sandbox/` — direct bargaining-mechanism editor.
- `general-topics/envelope-theorem/` — envelope-theorem module.
- `general-topics/revelation-principle/` — indirect voting and direct preference-reporting demo.
- `styles.css` — ordered entry point for the focused stylesheets in `css/`.
- `css/` — theme, shared page/control styling, chart families, and responsive rules.
- `assets/mathjax/` — vendored MathJax 4 TeX-to-SVG build and offline assets.
- `js/mathjax-config.js` — shared local MathJax configuration.
- `js/mathjax-runtime.js` — shared initial and dynamic MathJax lifecycle.
- `js/environment.js` — initial math rendering for the three shared Environment pages.
- `js/distributions.js` — shared auction distribution functions.
- `js/math-utils.js` — shared pure-number helpers for every model layer.
- `js/svg-utils.js` — shared SVG chart-drawing helpers for every app layer.
- `js/bilateral-trade-envelope.js` — shared exact split-triangle allocation,
  transfer, interim, and diagnostic calculations for the two bilateral-trade modules.
- `js/bilateral-trade-visuals.js` — shared chart frames, colors, and probe
  interactions for the two bilateral-trade modules.
- `js/auction-controls.js` — shared value/bid and shape-parameter control
  logic for first-price and second-price.
- `js/auction-chart.js` — shared panel scaffolding, SVG primitives, and result
  formatting for first-price and second-price.
- `js/components.js` — shared page and parameter-control components.
- `tests/` — browser-run checks for shared code and each module.
