"use strict";

window.EquationChain = Object.freeze({
  initDividers: function () {
    var toggles = Array.prototype.slice.call(
      document.querySelectorAll(".equation-chain-divider-toggle")
    );

    toggles.forEach(function (toggle) {
      var rows = [];
      var node = toggle.nextElementSibling;
      while (node && node.classList.contains("equation-step-extra")) {
        rows.push(node);
        node = node.nextElementSibling;
      }

      if (rows.length === 0) {
        return;
      }

      var bottomRule = document.createElement("div");
      bottomRule.className = "equation-chain-divider-rule";
      bottomRule.hidden = true;
      rows[rows.length - 1].after(bottomRule);

      toggle.hidden = false;
      var glyph = toggle.querySelector(".equation-chain-divider-toggle-glyph");

      toggle.addEventListener("click", function () {
        var expanded = toggle.getAttribute("aria-expanded") === "true";
        rows.forEach(function (row) {
          row.hidden = expanded;
        });
        bottomRule.hidden = expanded;
        toggle.setAttribute("aria-expanded", String(!expanded));
        if (glyph) {
          glyph.textContent = expanded ? "+" : "−";
        }
      });
    });
  }
});
