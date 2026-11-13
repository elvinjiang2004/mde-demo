(function () {
  "use strict";
  var T = MechanismTest, frame = document.getElementById("environment-frame");
  var groups = [
    { id: "auction-equilibria", title: "Auction Equilibria", modules: ["auction-equilibria/first-price", "auction-equilibria/second-price"], conditions: 0 },
    { id: "auction-design", title: "Auction Design", modules: ["auction-design/regular-optimal-auctions", "auction-design/general-optimal-auctions"], conditions: 2 },
    { id: "bilateral-trade", title: "Bilateral Trade", modules: ["bilateral-trade/bargaining-mechanism-sandbox", "bilateral-trade/myerson-satterthwaite-theorem"], conditions: 4 },
    { id: "voting", title: "Voting", modules: ["voting/gibbard-satterthwaite-theorem"], conditions: 3 }
  ];
  T.run(groups.map(function (group) {
    return { name: group.title + " Environment: navigation, local math and responsive layout", run: async function () {
      var loaded = new Promise(function (resolve) { frame.onload = resolve; });
      frame.src = "../" + group.id + "/environment/index.html";
      await loaded;
      var doc = frame.contentDocument;
      await T.waitFor(function () {
        return !!doc.querySelector(".introduction mjx-container") &&
          !/\\\(|\\\[/.test(doc.querySelector(".introduction").textContent);
      }, 15000);
      T.assert(doc.querySelector("h1").textContent === "Environment", "The page title should be Environment.");
      T.assert(doc.querySelector("page-header .header-content > span").textContent === group.title,
        "The header should identify the group.");
      T.assert(doc.querySelector(".wordmark").getAttribute("href") === "../../index.html",
        "The home link must work from the Environment page.");
      T.assertScriptOrder(doc, ["../../js/components.js", "../../js/mathjax-config.js",
        "../../assets/mathjax/tex-svg.js", "../../js/mathjax-runtime.js", "../../js/environment.js"]);
      T.assert(!doc.querySelector('script[src="model.js"], script[src="app.js"]'),
        "Static setup pages should load no economic model.");
      T.assert(!doc.querySelector("mjx-merror, merror") && !/\\\(|\\\[/.test(doc.querySelector(".introduction").textContent),
        "All setup mathematics should render without errors or raw delimiters.");
      var links = Array.from(doc.querySelectorAll(".environment-modules a"));
      T.assert(links.length === group.modules.length, "Each Environment page should link to its modules.");
      group.modules.forEach(function (route) {
        T.assert(links.some(function (link) { return link.getAttribute("href") === "../../" + route + "/index.html"; }),
          "Missing module backlink: " + route);
      });
      T.assert(!doc.querySelector("main h2, .introduction section"),
        "Environment pages should have no subsections.");
      T.assert(doc.querySelectorAll(".introduction > ol > li").length === group.conditions,
        "The shared condition definitions should be on the Environment page.");
      if (group.conditions) {
        T.assert(doc.querySelector('a[href="../../general-topics/revelation-principle/index.html"]'),
          "The direct-mechanism passage should retain its Revelation Principle link.");
      }
      if (group.id === "auction-design") {
        T.assert(doc.querySelector(".introduction").textContent.includes("A monopoly seller") &&
          !doc.querySelector(".introduction").textContent.includes("A seller intends to sell"),
        "General Optimal Auctions should share the Regular Optimal Auctions environment.");
      }
      if (group.id === "bilateral-trade") {
        var conditions = doc.querySelector(".introduction > ol").textContent;
        T.assert(conditions.includes("Bayesian IC (BIC)") && /dominant[- ]strategy IC \(DSIC\)/i.test(conditions) &&
          conditions.includes("ex ante, interim, and ex post"),
        "The condition definitions should use the sandbox opening's wording and timing variants.");
      }
      for (var width of [320, 375, 768, 1280]) {
        frame.style.width = width + "px";
        await T.nextAnimationFrames(frame.contentWindow, 2);
        T.assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1,
          group.title + " should fit at " + width + "px.");
      }
    } };
  }), { title: "Environment page tests" });
})();
