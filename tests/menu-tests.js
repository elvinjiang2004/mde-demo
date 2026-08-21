(function () {
  "use strict";

  var frame = document.getElementById("menu-frame");
  frame.addEventListener("load", runTests);

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function addResult(name, error) {
    var item = document.createElement("li");
    item.className = error ? "fail" : "pass";
    item.textContent = (error ? "FAIL — " : "PASS — ") + name +
      (error ? ": " + error.message : "");
    document.getElementById("results").appendChild(item);
  }

  function runTests() {
    var menuDocument = frame.contentDocument;
    var menuWindow = frame.contentWindow;
    var tests = [
      {
        name: "The root page is the module menu",
        run: function () {
          assert(menuDocument.body.classList.contains("catalog-page"),
            "The root page should use the catalog layout.");
          assert(menuDocument.querySelector("main h1").textContent === "Modules",
            "The menu should have the Modules page title.");
          assert(menuDocument.querySelector(".wordmark").textContent ===
            "Mechanism Design Explorer" &&
            menuDocument.title === "Modules | Mechanism Design Explorer",
          "The menu should use the Mechanism Design Explorer brand.");
          assert(menuDocument.querySelectorAll("script").length === 0,
            "The menu should not load an auction module script.");
        }
      },
      {
        name: "Auctions and Bilateral Trade are the only categories",
        run: function () {
          var categories = menuDocument.querySelectorAll(".module-category");
          assert(categories.length === 2,
            "The menu should contain exactly two categories.");
          var titles = Array.from(categories).map(function (category) {
            return category.querySelector("h2").textContent;
          });
          assert(titles[0] === "Auctions" && titles[1] === "Bilateral Trade",
            "The categories should be Auctions and Bilateral Trade, in order.");
        }
      },
      {
        name: "Modules are arranged in category rows",
        run: function () {
          var rows = menuDocument.querySelectorAll(".module-row");
          assert(rows.length === 2 &&
            Array.from(rows).every(function (row) {
              return menuWindow.getComputedStyle(row).display === "flex";
            }),
          "Each category should arrange its modules in a row.");
          assert(rows[0].querySelectorAll(":scope > li").length === 2,
            "The Auctions row should contain two module entries.");
          assert(rows[1].querySelectorAll(":scope > li").length === 1,
            "The Bilateral Trade row should contain one module entry.");
        }
      },
      {
        name: "The first-price module is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="auctions/first-price/index.html"]'
          );
          assert(link,
            "The first-price module should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "First-Price Auction Equilibrium",
          "The first-price module title is incorrect.");
        }
      },
      {
        name: "The second-price module is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="auctions/second-price/index.html"]'
          );
          assert(link,
            "The second-price module should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "Second-Price Auction Equilibrium",
          "The second-price module title is incorrect.");
          assert(menuDocument.querySelectorAll(".module-link").length === 3,
            "Both auction modules and the bilateral-trade module should be links.");
          assert(!menuDocument.querySelector(".module-pending") &&
            !menuDocument.querySelector('[aria-disabled="true"]'),
          "No implemented module should remain disabled.");
        }
      },
      {
        name: "The bilateral-trade module is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="bilateral-trade/myerson-satterthwaite-theorem/index.html"]'
          );
          assert(link,
            "The bilateral-trade module should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "Myerson-Satterthwaite Theorem",
          "The bilateral-trade module title is incorrect.");
        }
      }
    ];

    var failures = 0;
    tests.forEach(function (test) {
      try {
        test.run();
        addResult(test.name, null);
      } catch (error) {
        failures += 1;
        addResult(test.name, error);
      }
    });

    var summary = document.getElementById("summary");
    var passed = tests.length - failures;
    summary.textContent = passed + " of " + tests.length + " menu tests passed.";
    summary.className = failures ? "fail" : "pass";
    document.body.dataset.status = failures ? "failed" : "passed";
    document.title = (failures ? "FAIL" : "PASS") + " — Module menu tests";
  }
}());
