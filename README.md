# Mechanism Design Explorer

A static, no-build collection of textbook-style mechanism-design lessons,
including interactive demos and introductory readings. MathJax 4 is vendored
locally so mathematical typesetting works offline.

**Live site:** https://elvinjiang2004.github.io/mde-demo/

## Open the site

Open `index.html` in a modern browser. It is the module menu and requires no
installation, local server, or internet connection.

The menu links to all available lessons using explicit `index.html` paths,
so navigation works through `file://`.

## Current menu

- **General Topics:** [What is Mechanism Design?](general-topics/what-is-mechanism-design/index.html), [The Envelope Theorem](general-topics/envelope-theorem/index.html), [The Revelation Principle](general-topics/revelation-principle/index.html).
- **Auction Equilibria:** [Environment](auction-equilibria/environment/index.html), [First-Price Auction Equilibrium](auction-equilibria/first-price/index.html), [Second-Price Auction Equilibrium](auction-equilibria/second-price/index.html).
- **Auction Design:** [Environment](auction-design/environment/index.html), [Regular Optimal Auctions](auction-design/regular-optimal-auctions/index.html), [General Optimal Auctions](auction-design/general-optimal-auctions/index.html).
- **Bilateral Trade:** [Environment](bilateral-trade/environment/index.html), [Bargaining Mechanism Sandbox](bilateral-trade/bargaining-mechanism-sandbox/index.html), [Myerson-Satterthwaite Theorem](bilateral-trade/myerson-satterthwaite-theorem/index.html).
- **Voting:** [The Gibbard-Satterthwaite Theorem](voting/gibbard-satterthwaite-theorem/index.html) (in progress).

## Browser checks

Open `tests/all.html` through a local static server to run the registered
module and shared suites. For example, run `py -m http.server 8000` from the
repository root and open `http://localhost:8000/tests/all.html`. Individual
suite pages are listed by the aggregate. The iframe-based checks need HTTP or
permission for cross-file iframe access; ordinary lessons work directly offline.
