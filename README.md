# Mechanism Design Explorer

A static, no-build collection of textbook-style, interactive mechanism-design
modules. MathJax 4 is vendored locally for mathematical typesetting.

**Live site:** https://elvinjiang2004.github.io/mde-demo/

## Open the site

Open `index.html` in a modern browser. It is the module menu and requires no
installation, local server, or internet connection.

The available modules are located at:

    auctions/first-price/index.html
    auctions/second-price/index.html
    bilateral-trade/myerson-satterthwaite-theorem/index.html

Explicit `index.html` paths are used so navigation works through `file://`.

## Current menu

The menu currently contains two categories, Auctions and Bilateral Trade:

- First-Price Auction Equilibrium — available.
- Second-Price Auction Equilibrium — available.
- Myerson-Satterthwaite Theorem — available.

## Browser checks

Open these files in a browser to run the test suites:

- tests/menu-tests.html — menu structure, category, routes, and availability.
- tests/distribution-tests.html — shared Uniform/Beta kernel checks.
- tests/components-tests.html — shared page-header, page-footer, and
  model-parameter-controls custom-element checks.
- tests/model-tests.html — first-price economic model checks.
- tests/ui-tests.html — first-price interface and SVG checks.
- tests/second-price-model-tests.html — second-price economic model checks.
- tests/second-price-ui-tests.html — second-price interface and SVG checks.
- tests/bilateral-trade-model-tests.html — bilateral-trade grid, envelope,
  and welfare/revenue checks.
- tests/bilateral-trade-ui-tests.html — bilateral-trade interface and SVG
  checks.

The iframe-based menu and interface checks may require a local static server
or a browser configuration that permits local-file iframe access. This does
not affect ordinary use of the menu or module pages.

## Files

- index.html — module menu.
- auctions/first-price/ — first-price module page, model, and controls.
- auctions/second-price/ — second-price module page, model, and controls.
- bilateral-trade/myerson-satterthwaite-theorem/ — bilateral-trade module
  page, model, and controls.
- styles.css — shared module and menu styles.
- assets/mathjax/ — vendored MathJax 4 TeX-to-SVG build, license, fonts, and
  runtime support assets for offline use.
- js/mathjax-config.js — shared MathJax delimiter, SVG-output, offline-font,
  and SVG-exclusion configuration.
- js/distributions.js — shared validation, CDF, PDF, quantile, and
  integration functions for Uniform and transformed-Beta values.
- js/components.js — shared `<page-header>`, `<page-footer>`, and
  `<model-parameter-controls>` custom elements used across module pages.
- tests/ — browser-run test suites for the shared kernel and each module.
