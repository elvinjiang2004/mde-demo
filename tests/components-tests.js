(function () {
  "use strict";

  var tests = [];
  var sandbox = null;

  function test(name, callback) {
    tests.push({ name: name, callback: callback });
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed.");
    }
  }

  function render(tagName, attributes) {
    var element = document.createElement(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    sandbox.replaceChildren(element);
    return element;
  }

  test("page-header, page-footer, and model-parameter-controls are defined", function () {
    ["page-header", "page-footer", "model-parameter-controls"].forEach(function (tagName) {
      assert(typeof window.customElements.get(tagName) === "function",
        tagName + " should be a registered custom element.");
    });
  });

  test("page-header renders the wordmark and category from its attributes", function () {
    var header = render("page-header", {
      category: "Auctions",
      home: "../../index.html"
    });
    var wordmark = header.querySelector(".wordmark");
    assert(wordmark && wordmark.getAttribute("href") === "../../index.html" &&
      wordmark.textContent === "Mechanism Design Explorer",
    "The wordmark should link home with the shared brand text.");
    assert(header.querySelector(".header-content > span").textContent === "Auctions",
      "The category span should read the category attribute.");
    assert(header.querySelector(".page-width.header-content"),
      "The rendered row should keep the page-width and header-content classes.");
  });

  test("page-header falls back to index.html with no home attribute", function () {
    var header = render("page-header", { category: "Modules" });
    assert(header.querySelector(".wordmark").getAttribute("href") === "index.html",
      "With no home attribute, the wordmark should default to index.html.");
  });

  test("page-footer renders the shared footer content", function () {
    var footer = render("page-footer", {});
    var content = footer.querySelector(".page-width");
    assert(content && content.textContent === "Mechanism Design Explorer",
      "The footer should render the shared brand text inside .page-width.");
  });

  test("model-parameter-controls renders every id the auction pages depend on", function () {
    var controls = render("model-parameter-controls", {});
    [
      "parameters-title", "beta-shape-controls", "bidder-count", "lower-bound",
      "upper-bound", "alpha-control-label", "alpha-number", "alpha-slider",
      "beta-control-label", "beta-number", "beta-slider", "value-pdf-preview",
      "value-pdf-preview-title", "value-pdf-preview-description", "input-error"
    ].forEach(function (id) {
      assert(controls.querySelector("#" + id),
        "model-parameter-controls should render an element with id=\"" + id + "\".");
    });
    assert(controls.querySelector("#input-error").hidden,
      "The input-error region should start hidden.");
    assert(controls.querySelector("#bidder-count").querySelectorAll("option").length === 9,
      "The bidder-count select should offer 2 through 10.");
  });

  test("model-parameter-controls keeps the MathJax inline-math delimiters", function () {
    var controls = render("model-parameter-controls", {});
    var html = controls.innerHTML;
    ["\\(n\\)", "\\(a\\)", "\\(b\\)", "\\(\\alpha\\)", "\\(\\beta\\)"].forEach(function (delimiter) {
      assert(html.indexOf(delimiter) >= 0,
        "The rendered controls should still contain " + delimiter + " for MathJax.");
    });
  });

  run();

  function run() {
    sandbox = document.getElementById("sandbox");
    var results = document.getElementById("results");
    var passed = 0;
    tests.forEach(function (item) {
      var row = document.createElement("li");
      try {
        item.callback();
        row.className = "pass";
        row.textContent = "PASS — " + item.name;
        passed += 1;
      } catch (error) {
        row.className = "fail";
        row.textContent = "FAIL — " + item.name + ": " + error.message;
      }
      results.appendChild(row);
    });
    sandbox.replaceChildren();

    var allPassed = passed === tests.length;
    var summary = document.getElementById("summary");
    summary.className = allPassed ? "pass" : "fail";
    summary.textContent = passed + " of " + tests.length +
      " shared-component tests passed.";
    document.body.setAttribute("data-status", allPassed ? "passed" : "failed");
    document.title = (allPassed ? "PASS" : "FAIL") +
      " — Shared component tests";
  }
})();
