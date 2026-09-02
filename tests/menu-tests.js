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

  function mediaRule(rules, query) {
    return Array.from(rules).find(function (rule) {
      return rule.type === CSSRule.MEDIA_RULE &&
        rule.conditionText.indexOf(query) !== -1;
    });
  }

  function rootRule(rules) {
    return Array.from(rules).find(function (rule) {
      return rule.selectorText === ":root";
    });
  }

  function parseHexColor(source) {
    var hex = source.trim().replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex.split("").map(function (character) {
        return character + character;
      }).join("");
    }
    assert(/^[0-9a-f]{6}$/i.test(hex),
      "Theme contrast tokens should use hexadecimal colors.");
    return [0, 2, 4].map(function (offset) {
      return parseInt(hex.slice(offset, offset + 2), 16) / 255;
    });
  }

  function relativeLuminance(source) {
    return parseHexColor(source).map(function (channel) {
      return channel <= 0.04045 ? channel / 12.92 :
        Math.pow((channel + 0.055) / 1.055, 2.4);
    }).reduce(function (total, channel, index) {
      return total + channel * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  }

  function contrastRatio(first, second) {
    var lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
    var darker = Math.min(relativeLuminance(first), relativeLuminance(second));
    return (lighter + 0.05) / (darker + 0.05);
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
        name: "The shared stylesheet supplies accessible automatic light and dark palettes",
        run: function () {
          var stylesheet = Array.from(menuDocument.styleSheets).find(
            function (sheet) {
              return sheet.href && /styles\.css$/.test(sheet.href);
            }
          );
          assert(stylesheet, "The menu should load the shared stylesheet.");

          var light = rootRule(stylesheet.cssRules);
          var darkMedia = mediaRule(
            stylesheet.cssRules, "prefers-color-scheme: dark"
          );
          var printMedia = mediaRule(stylesheet.cssRules, "print");
          var dark = darkMedia && rootRule(darkMedia.cssRules);
          var print = printMedia && rootRule(printMedia.cssRules);
          var requiredTokens = [
            "--page-background", "--surface-background", "--control-background",
            "--ink", "--muted", "--blue", "--green", "--orange", "--red",
            "--focus", "--annotation-halo", "--marker-fill",
            "--heatmap-neutral-rgb", "--heatmap-blue-rgb",
            "--heatmap-green-rgb", "--heatmap-orange-rgb", "--heatmap-red-rgb",
            "--envelope-line-a", "--envelope-line-b", "--envelope-line-c",
            "--envelope-line-d", "--envelope-line-e", "--envelope-line-f",
            "--envelope-line-g", "--envelope-line-h"
          ];

          assert(light && dark && print,
            "The stylesheet should define light, dark, and light-print palettes.");
          requiredTokens.forEach(function (propertyName) {
            assert(light.style.getPropertyValue(propertyName).trim() &&
              dark.style.getPropertyValue(propertyName).trim(),
            propertyName + " should be defined in both screen palettes.");
          });
          assert(light.style.getPropertyValue("color-scheme") === "light" &&
            dark.style.getPropertyValue("color-scheme") === "dark" &&
            print.style.getPropertyValue("color-scheme") === "light",
          "Native controls should follow the screen palette and print in light mode.");
          assert(dark.style.getPropertyValue("--page-background") !==
            light.style.getPropertyValue("--page-background"),
          "The dark palette should use a distinct page background.");
          assert(dark.style.getPropertyValue("--annotation-halo").trim() ===
            dark.style.getPropertyValue("--surface-background").trim() &&
            dark.style.getPropertyValue("--marker-fill").trim() ===
            dark.style.getPropertyValue("--surface-background").trim(),
          "Dark graph halos and hollow markers should match the graph surface.");
          ["--page-background", "--surface-background", "--ink"].forEach(
            function (propertyName) {
              assert(print.style.getPropertyValue(propertyName).trim() ===
                light.style.getPropertyValue(propertyName).trim(),
              "Print should restore the light " + propertyName + " token.");
            }
          );

          [light, dark].forEach(function (palette) {
            var background = palette.style.getPropertyValue(
              "--page-background"
            );
            [
              "--ink", "--muted", "--blue", "--green", "--orange", "--red",
              "--focus", "--error-text"
            ].forEach(function (propertyName) {
              assert(contrastRatio(
                palette.style.getPropertyValue(propertyName), background
              ) >= 4.5,
              propertyName + " should meet WCAG AA contrast against the page.");
            });
            var surface = palette.style.getPropertyValue(
              "--surface-background"
            );
            "abcdefgh".split("").forEach(function (letter) {
              var propertyName = "--envelope-line-" + letter;
              assert(contrastRatio(
                palette.style.getPropertyValue(propertyName), surface
              ) >= 3,
              propertyName + " should remain visible against the graph surface.");
            });
          });

          var activeStyle = menuWindow.getComputedStyle(
            menuDocument.documentElement
          );
          var expectedScheme = menuWindow.matchMedia(
            "(prefers-color-scheme: dark)"
          ).matches ? "dark" : "light";
          assert(activeStyle.colorScheme === expectedScheme,
            "The active palette should follow the operating-system preference.");
          var backgroundProbe = menuDocument.createElement("span");
          backgroundProbe.style.backgroundColor = "var(--page-background)";
          menuDocument.body.appendChild(backgroundProbe);
          var expectedBackground = menuWindow.getComputedStyle(
            backgroundProbe
          ).backgroundColor;
          backgroundProbe.remove();
          assert(menuWindow.getComputedStyle(menuDocument.body).backgroundColor ===
            expectedBackground,
          "The page should use the active theme background.");
        }
      },
      {
        name: "Auctions, Bilateral Trade, and General Topics are the only categories",
        run: function () {
          var categories = menuDocument.querySelectorAll(".module-category");
          assert(categories.length === 3,
            "The menu should contain exactly three categories.");
          var titles = Array.from(categories).map(function (category) {
            return category.querySelector("h2").textContent;
          });
          assert(titles[0] === "Auctions" && titles[1] === "Bilateral Trade" &&
            titles[2] === "General Topics",
          "The categories should be Auctions, Bilateral Trade, and General " +
            "Topics, in order.");
        }
      },
      {
        name: "Modules are arranged in category rows",
        run: function () {
          var rows = menuDocument.querySelectorAll(".module-row");
          assert(rows.length === 3 &&
            Array.from(rows).every(function (row) {
              return menuWindow.getComputedStyle(row).display === "flex";
            }),
          "Each category should arrange its modules in a row.");
          assert(rows[0].querySelectorAll(":scope > li").length === 2,
            "The Auctions row should contain two module entries.");
          assert(rows[1].querySelectorAll(":scope > li").length === 2,
            "The Bilateral Trade row should contain two module entries.");
          assert(rows[2].querySelectorAll(":scope > li").length === 2,
            "The General Topics row should contain two module entries.");
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
          assert(menuDocument.querySelectorAll(".module-link").length === 6,
            "Both auction modules, both bilateral-trade modules, and both " +
            "General Topics modules should be links.");
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
      },
      {
        name: "The bargaining sandbox is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="bilateral-trade/bargaining-mechanism-sandbox/index.html"]'
          );
          assert(link,
            "The bargaining sandbox should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "Bargaining Mechanism Sandbox",
          "The bargaining sandbox title is incorrect.");
        }
      },
      {
        name: "The envelope-theorem module is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="general-topics/envelope-theorem/index.html"]'
          );
          assert(link,
            "The envelope-theorem module should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "The Envelope Theorem",
          "The envelope-theorem module title is incorrect.");
        }
      },
      {
        name: "The payments-from-allocation-rule (draft) module is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="general-topics/payments-from-allocation-rule/index.html"]'
          );
          assert(link,
            "The payments-from-allocation-rule module should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "Payments from an Allocation Rule (draft)",
          "The payments-from-allocation-rule module title is incorrect.");
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
