(function () {
  "use strict";

  var frame = document.getElementById("menu-frame");
  var didRun = false;
  frame.addEventListener("load", runTests);
  // A cached child can finish before this deferred parent script executes.
  if (frame.contentDocument && frame.contentDocument.readyState === "complete" &&
      frame.contentDocument.querySelector("body.catalog-page")) { runTests(); }

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

  function importedRules(rules) {
    return Array.from(rules).reduce(function (result, rule) {
      if (rule.type === CSSRule.IMPORT_RULE) {
        return result.concat(importedRules(rule.styleSheet.cssRules));
      }
      result.push(rule);
      return result;
    }, []);
  }

  function mediaRule(rules, query) {
    return importedRules(rules).find(function (rule) {
      return rule.type === CSSRule.MEDIA_RULE &&
        rule.conditionText.indexOf(query) !== -1;
    });
  }

  function rootRule(rules) {
    return importedRules(rules).find(function (rule) {
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
    if (didRun) { return; }
    didRun = true;
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
          var about = menuDocument.querySelector(".header-navigation .header-link");
          assert(about && about.getAttribute("href") === "about.html" &&
            about.previousElementSibling.classList.contains("wordmark") &&
            !about.classList.contains("module-tile"),
          "About should be a small link beneath the site name.");
          assert(menuDocument.querySelector(".header-content > span").textContent === "Modules",
            "The top-right Modules text should be restored.");
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
        name: "The menu includes the five registered module groups",
        run: function () {
          var categories = menuDocument.querySelectorAll(".module-category");
          assert(categories.length === 5,
            "The menu should contain exactly five groups.");
          var titles = Array.from(categories).map(function (category) {
            return category.querySelector("h2").textContent;
          });
          assert(titles.join("|") === "General Topics|Auction Equilibria|Auction Design|Bilateral Trade|Voting",
            "The five groups should appear in their established order.");
        }
      },
      {
        name: "Modules are arranged in category rows",
        run: function () {
          var rows = menuDocument.querySelectorAll(".module-row");
          assert(rows.length === 5 &&
            Array.from(rows).every(function (row) {
              return menuWindow.getComputedStyle(row).display === "flex";
            }),
          "Each category should arrange its modules in a row.");
          rows.forEach(function (row, index) {
            var count = index === 0 ? 3 : (index === 4 ? 1 : 2);
            assert(row.querySelectorAll(":scope > li").length === count &&
              row.querySelectorAll("a.module-link").length === count &&
              !row.querySelector("a.environment-link"),
            "General Topics has three lessons, Voting has one, and the other groups have two.");
            var category = row.closest("section");
            var environment = category.querySelector("a.environment-link");
            if (category.id === "voting") {
              assert(!environment, "Voting should keep its setup on the module page.");
              return;
            }
            if (index === 0) {
              assert(!environment, "General Topics should have no Environment page.");
              var introduction = row.querySelector("li:first-child a.module-link");
              assert(introduction.getAttribute("href") === "general-topics/what-is-mechanism-design/index.html" &&
                introduction.querySelector(".module-title").textContent === "What is Mechanism Design?",
              "The introductory reading should come first in General Topics.");
              return;
            }
            assert(environment && environment.textContent.trim() === "Environment" &&
              environment.getAttribute("href") === category.id + "/environment/index.html" &&
              environment.previousElementSibling === category.querySelector("h2") &&
              !environment.classList.contains("module-tile"),
            "Each Environment link should sit beside its group title and retain its explicit route.");
            var style = menuWindow.getComputedStyle(environment);
            var probe = menuDocument.createElement("span");
            probe.style.color = "var(--blue)";
            category.appendChild(probe);
            assert(style.textDecorationLine.indexOf("underline") !== -1 &&
              style.color === menuWindow.getComputedStyle(probe).color,
            "Environment links should be underlined blue text.");
            probe.remove();
          });
          assert(Array.from(rows[1].querySelectorAll("a.module-link")).map(function (a) {
            return a.getAttribute("href");
          }).join("|") === "auction-equilibria/first-price/index.html|auction-equilibria/second-price/index.html",
          "Auction Equilibria should contain first-price and second-price auctions.");
          assert(Array.from(rows[2].querySelectorAll("a.module-link")).map(function (a) {
            return a.getAttribute("href");
          }).join("|") === "auction-design/regular-optimal-auctions/index.html|auction-design/general-optimal-auctions/index.html",
          "Auction Design should contain Regular Optimal Auctions and General Optimal Auctions.");
        }
      },
      {
        name: "The first-price module is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="auction-equilibria/first-price/index.html"]'
          );
          assert(link,
            "The first-price module should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "First-Price Auction Equilibrium",
          "The first-price module title is incorrect.");
        }
      },
      {
        name: "The regular-optimal-auctions module is selectable",
        run: function () {
          var link = menuDocument.querySelector('a.module-link[href="auction-design/regular-optimal-auctions/index.html"]');
          assert(link && link.querySelector(".module-title").textContent === "Regular Optimal Auctions",
            "The regular-optimal-auctions editor should have an explicit working route.");
        }
      },
      {
        name: "The second-price module is selectable",
        run: function () {
          var link = menuDocument.querySelector(
            'a.module-link[href="auction-equilibria/second-price/index.html"]'
          );
          assert(link,
            "The second-price module should use its explicit index.html route.");
          assert(link.querySelector(".module-title").textContent ===
            "Second-Price Auction Equilibrium",
          "The second-price module title is incorrect.");
          assert(menuDocument.querySelectorAll(".module-link").length === 10,
            "All nine interactive modules and the introductory reading should be links.");
          assert(!menuDocument.querySelector('.module-link[aria-disabled="true"]') &&
            !menuDocument.querySelector("a.module-pending"),
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
        name: "General Optimal Auctions is selectable under Auction Design as a separate module",
        run: function () {
          var link = menuDocument.querySelector(
            '#auction-design a.module-link[href="auction-design/general-optimal-auctions/index.html"]'
          );
          assert(link,
            "General Optimal Auctions should use its own explicit auction route.");
          assert(link.querySelector(".module-title").textContent ===
            "General Optimal Auctions",
          "The General Optimal Auctions module title is incorrect.");
          assert(!link.querySelector(".module-status"),
            "Completed General Optimal Auctions should have no In progress marker.");
          assert(!menuDocument.querySelector('a[href="general-topics/payments-from-allocation-rule/index.html"]'),
            "The repurposed draft should no longer appear under General Topics.");
        }
      },
      {
        name: "The Gibbard-Satterthwaite module is selectable under Voting",
        run: function () {
          var link = menuDocument.querySelector(
            '#voting a.module-link[href="voting/gibbard-satterthwaite-theorem/index.html"]'
          );
          assert(link && link.querySelector(".module-title").textContent ===
            "The Gibbard-Satterthwaite Theorem" && link.querySelector(".module-status") &&
            link.querySelector(".module-status").textContent === "In progress",
          "Voting should link to the theorem demo using its exact title and In progress marker.");
        }
      },
      {
        name: "The Revelation Principle voting demo is selectable",
        run: function () {
          var tile = menuDocument.querySelector(
            'a.module-link[href="general-topics/revelation-principle/index.html"]'
          );
          assert(tile, "General Topics should link to the working voting demo.");
          assert(tile.querySelector(".module-title").textContent === "The Revelation Principle",
            "The module title is incorrect.");
          assert(!tile.hasAttribute("aria-disabled") && !tile.classList.contains("module-pending"),
            "The verified demo should be enabled.");
          assert(menuDocument.querySelectorAll(".module-pending").length === 0,
            "All current menu modules are functional.");
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
