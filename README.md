# Mechanism Design Explorer

A static, no-build collection of textbook-style, interactive mechanism-design
modules. MathJax 4 is vendored locally so mathematical typesetting works
offline.

**Live site:** https://elvinjiang2004.github.io/mde-demo/

## Open the site

Open `index.html` in a modern browser. It is the module menu and requires no
installation, local server, or internet connection.

The available modules are located at:

    auctions/first-price/index.html
    auctions/second-price/index.html
    bilateral-trade/myerson-satterthwaite-theorem/index.html
    general-topics/envelope-theorem/index.html
    general-topics/payments-from-allocation-rule/index.html

Explicit `index.html` paths are used so navigation works through `file://`.

## Current menu

The menu contains three categories:

- **Auctions**
  - First-Price Auction Equilibrium
  - Second-Price Auction Equilibrium
- **Bilateral Trade**
  - Myerson-Satterthwaite Theorem
- **General Topics**
  - The Envelope Theorem
  - Payments from an Allocation Rule (draft)

## Browser checks

Open these files in a browser to run the test suites:

- `tests/menu-tests.html` — menu structure, categories, routes, and availability.
- `tests/distribution-tests.html` — shared Uniform/Beta kernel checks.
- `tests/components-tests.html` — shared page-component checks.
- `tests/model-tests.html` — first-price economic model checks.
- `tests/ui-tests.html` — first-price interface and SVG checks.
- `tests/second-price-model-tests.html` — second-price economic model checks.
- `tests/second-price-ui-tests.html` — second-price interface and SVG checks.
- `tests/bilateral-trade-model-tests.html` — bilateral-trade model checks.
- `tests/bilateral-trade-ui-tests.html` — bilateral-trade interface and SVG checks.
- `tests/envelope-theorem-model-tests.html` — envelope-theorem model checks.
- `tests/envelope-theorem-ui-tests.html` — envelope-theorem interface and responsive-layout checks.
- `tests/payments-from-allocation-rule-model-tests.html` — allocation-rule and
  payment model checks.
- `tests/payments-from-allocation-rule-ui-tests.html` — allocation-rule interface
  and SVG checks.

The iframe-based menu and interface checks may require a local static server or
a browser configuration that permits local-file iframe access. This does not
affect ordinary use of the menu or module pages.

## Files

- `index.html` — module menu.
- `auctions/first-price/` — first-price module page, model, and controls.
- `auctions/second-price/` — second-price module page, model, and controls.
- `bilateral-trade/myerson-satterthwaite-theorem/` — bilateral-trade module.
- `general-topics/envelope-theorem/` — envelope-theorem module.
- `general-topics/payments-from-allocation-rule/` — allocation-rule and payment
  module.
- `styles.css` — shared module and menu styles.
- `assets/mathjax/` — vendored MathJax 4 TeX-to-SVG build and offline assets.
- `js/mathjax-config.js` — shared local MathJax configuration.
- `js/distributions.js` — shared auction distribution functions.
- `js/components.js` — shared page and parameter-control components.
- `tests/` — browser-run checks for shared code and each module.
