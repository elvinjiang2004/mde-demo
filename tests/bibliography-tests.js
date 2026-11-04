(function () {
  "use strict";
  var T = MechanismTest, assert = T.assert;
  var fixture = document.getElementById("sandbox");
  var frame = document.getElementById("app-frame");
  var bibliography = MechanismBibliography;
  var tests = [];
  function test(name, run) { tests.push({ name: name, run: run }); }
  function render(html) {
    fixture.innerHTML = html;
    MechanismReferences.render(fixture);
    return fixture;
  }
  function throws(run, message) {
    var error;
    try { run(); } catch (caught) { error = caught; }
    assert(error && error.message.indexOf(message) >= 0, "Expected explicit error: " + message);
  }

  test("Deferred scripts render reference lists and prose on initial load", function () {
    assert(fixture.querySelector("li").textContent.indexOf("Auction Theory") >= 0 &&
      fixture.querySelector("[data-citation]").textContent === "Krishna (2009)",
    "The page should be populated before its app or tests initialize.");
  });
  test("Each canonical source has complete metadata and a unique stable link", function () {
    var seen = {};
    Object.keys(bibliography).forEach(function (id) {
      var source = bibliography[id];
      assert(/^[a-z0-9-]+$/.test(id), "Stable ASCII source ID: " + id);
      assert(source.title && Number.isInteger(source.year) && source.authors.length,
        "Title, publication year, and authors: " + id);
      source.authors.forEach(function (person) { assert(person.given && person.family, "Complete name: " + id); });
      assert(/^https:\/\//.test(source.url) && !seen[source.url], "A single record per linked work: " + id);
      seen[source.url] = true;
      if (source.type === "article") {
        assert(source.journal && source.volume && source.pages, "Journal metadata: " + id);
      } else if (source.type === "book") {
        assert(source.publisher, "Book publisher: " + id);
      } else {
        assert(source.type === "lecture" && source.section && source.container && source.publisher &&
          source.course && source.date, "Lecture-copy metadata: " + id);
      }
    });
  });
  test("One source generates identical references while locators remain local", function () {
    var root = render('<ul><li data-reference="krishna-2009"></li>' +
      '<li data-reference="krishna-2009" data-locator="sec. 2.3, Proposition 2.2, pp. 14–16"></li>' +
      '<li data-reference="krishna-2009" data-locator="sec. 2.2, Proposition 2.1, p. 13."></li></ul>');
    var items = root.querySelectorAll("li");
    var base = items[0].textContent;
    assert(items[1].textContent === base + " sec. 2.3, Proposition 2.2, pp. 14–16." &&
      items[2].textContent === base + " sec. 2.2, Proposition 2.1, p. 13.",
    "Source details agree without mixing the two auction propositions.");
    assert(items[1].querySelector("a").href === items[2].querySelector("a").href,
      "Both lessons use the same publisher link.");
  });
  test("Author–year citations handle one, two, and three authors", function () {
    var root = render('<p><span data-citation="myerson-1981"></span>; ' +
      '(<span data-citation="borgers-norman-2009" data-citation-style="parenthetical"></span>); ' +
      '<span data-citation="leininger-linhart-radner-1989"></span></p>');
    assert(root.textContent === "Myerson (1981); (Börgers and Norman, 2009); Leininger, Linhart, and Radner (1989)",
      "Punctuation and surname accents should be consistent across citation styles.");
  });
  test("Correcting one record updates both references and author–year citations", function () {
    var revised = Object.assign({}, bibliography, {
      "krishna-2009": Object.assign({}, bibliography["krishna-2009"], {
        title: "Corrected book title", year: 2010, url: "https://example.org/corrected"
      })
    });
    window.MechanismBibliography = revised;
    try {
      var root = render('<ul><li data-reference="krishna-2009"></li>' +
        '<li data-reference="krishna-2009" data-locator="p. 13"></li></ul>' +
        '<p><span data-citation="krishna-2009"></span></p>');
      root.querySelectorAll("li").forEach(function (item) {
        assert(item.textContent.indexOf("Corrected book title") >= 0 && item.textContent.indexOf("2010") >= 0 &&
          item.querySelector("a").href === "https://example.org/corrected", "Every selected reference updates.");
      });
      assert(root.querySelector("p").textContent === "Krishna (2010)", "The prose year updates from the same record.");
    } finally { window.MechanismBibliography = bibliography; }
  });
  test("Source text and locators are rendered literally, without parsing HTML", function () {
    window.MechanismBibliography = Object.assign({}, bibliography, {
      "literal-test": Object.assign({}, bibliography["krishna-2009"], { title: '<img src="x"> & a < b' })
    });
    try {
      var root = render('<ul><li data-reference="literal-test" data-locator="&lt;strong&gt;literal&lt;/strong&gt;"></li></ul>');
      assert(!root.querySelector("img, strong") && root.textContent.indexOf('<img src="x"> & a < b') >= 0 &&
        root.textContent.indexOf("<strong>literal</strong>") >= 0, "Bibliographic text should never become HTML markup.");
    } finally { window.MechanismBibliography = bibliography; }
  });
  test("Rendering twice keeps one entry and one link", function () {
    var root = render('<ul><li data-reference="myerson-satterthwaite-1983"></li></ul>');
    var before = root.innerHTML;
    MechanismReferences.render(root);
    assert(root.innerHTML === before && root.querySelectorAll("li").length === 1 && root.querySelectorAll("a").length === 1,
      "Repeated initialization must not duplicate citations.");
  });
  test("Unknown IDs and styles fail explicitly before replacing existing content", function () {
    fixture.innerHTML = '<ul><li data-reference="krishna-2009">Keep this</li><li data-reference="missing-id"></li></ul>';
    throws(function () { MechanismReferences.render(fixture); }, "Unknown bibliography ID: missing-id");
    assert(fixture.querySelector("li").textContent === "Keep this", "Invalid selections cannot leave partial output.");
    fixture.innerHTML = '<p data-citation="krishna-2009" data-citation-style="unknown"></p>';
    throws(function () { MechanismReferences.render(fixture); }, "Unknown citation style: unknown");
    fixture.innerHTML = '<p data-citation="toString"></p>';
    throws(function () { MechanismReferences.render(fixture); }, "Unknown bibliography ID: toString");
  });

  var lessons = [
    { path: "auction-equilibria/first-price", ids: ["krishna-2009"], locator: "pp. 14–16" },
    { path: "auction-equilibria/second-price", ids: ["krishna-2009"], locator: "p. 13" },
    { path: "auction-design/regular-optimal-auctions", ids: ["myerson-1981", "krishna-2009"], locator: "sec. 5.2" },
    { path: "auction-design/general-optimal-auctions", ids: ["myerson-1981", "border-1991"] },
    { path: "bilateral-trade/myerson-satterthwaite-theorem", ids: ["borgers-2015", "borgers-norman-2009", "myerson-satterthwaite-1983"], locator: "pp. 63–71" },
    { path: "bilateral-trade/bargaining-mechanism-sandbox", ids: ["groves-1973", "daspremont-gerard-varet-1979", "chatterjee-samuelson-1983", "myerson-satterthwaite-1983", "leininger-linhart-radner-1989"] },
    { path: "general-topics/envelope-theorem", ids: ["borgers-2015", "milgrom-segal-2002", "myerson-1981"], locator: "Lemma 2, pp. 63–64" },
    { path: "general-topics/revelation-principle", ids: ["borgers-2015", "stole-contracts-2017"] }
  ];
  var repeated = {};
  lessons.forEach(function (lesson) {
    test("Lesson references resolve correctly: " + lesson.path, async function () {
      var loaded = new Promise(function (resolve) { frame.onload = resolve; });
      frame.src = "../" + lesson.path + "/index.html";
      await loaded;
      var doc = frame.contentDocument;
      assert(doc && frame.contentWindow.MechanismReferences, "The renderer must load with the lesson.");
      T.assertScriptOrder(doc, ["../../js/bibliography.js", "../../js/references.js", "app.js"]);
      var items = Array.from(doc.querySelectorAll(".reference-list > li"));
      assert(items.map(function (item) { return item.dataset.reference; }).join("|") === lesson.ids.join("|"),
        "Reference selection and order should be preserved.");
      items.forEach(function (item) {
        var source = bibliography[item.dataset.reference];
        assert(item.textContent.indexOf(source.title) >= 0 && item.textContent.indexOf(String(source.year)) >= 0,
          "Title and year should come from the registry.");
        assert(item.querySelector('a[href="' + source.url + '"]'), "The source link should be canonical.");
        var normalized = item.textContent;
        if (item.dataset.locator) {
          normalized = normalized.slice(0, -(item.dataset.locator.length + 2));
        }
        if (repeated[item.dataset.reference]) {
          assert(repeated[item.dataset.reference] === normalized, "Shared source details must agree across lessons.");
        }
        repeated[item.dataset.reference] = normalized;
      });
      if (lesson.locator) { assert(doc.querySelector(".references").textContent.indexOf(lesson.locator) >= 0, "Retain the local locator."); }
      doc.querySelectorAll("[data-citation]").forEach(function (node) {
        var source = bibliography[node.dataset.citation];
        assert(node.textContent.indexOf(String(source.year)) >= 0 && node.textContent.indexOf(source.authors[0].family) >= 0,
          "Prose and theorem citations must resolve before initial rendering.");
      });
      if (lesson.path === "bilateral-trade/myerson-satterthwaite-theorem") {
        assert(!doc.querySelector('[data-reference="milgrom-segal-2002"]'), "Do not reintroduce the removed M-S citation.");
      }
    });
  });
  T.run(tests, { title: "Global bibliography tests", cleanup: function () { frame.remove(); fixture.remove(); } });
})();
