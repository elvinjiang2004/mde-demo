(function () {
  "use strict";
  var assert = MechanismTest.assert, close = MechanismTest.assertClose;
  var frame, win, doc;
  function el(id) { return doc.getElementById(id); }
  function field(id) { return el("panel-" + id).querySelector('[data-layer="field"]'); }
  function fieldContent(node) { return node.tagName.toLowerCase() === "image" ? node.getAttribute("href") : node.innerHTML; }
  function pause() { return MechanismTest.nextAnimationFrames(win, 3); }
  function input(id, value) {
    el(id).value = value;
    el(id).dispatchEvent(new win.Event("input", { bubbles: true }));
  }
  // Existing symmetric regressions set both independent controls explicitly.
  function inputCosts(kind, value) {
    input("gammaB-" + kind, value); input("gammaS-" + kind, value);
  }
  async function renderedField(id, size) {
    var image = new win.Image();
    await new Promise(function (resolve, reject) {
      image.onload = resolve;
      image.onerror = function () { reject(new Error("Could not decode field image: " + id)); };
      var displayed = field(id);
      image.src = displayed.tagName.toLowerCase() === "svg" ?
        "data:image/svg+xml," + encodeURIComponent(new win.XMLSerializer().serializeToString(displayed)) :
        displayed.getAttribute("href");
    });
    var canvas = doc.createElement("canvas");
    canvas.width = canvas.height = size;
    var context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);
    return context.getImageData(0, 0, size, size).data;
  }
  MechanismTest.run([
    { name: "Module loads with local MathJax, separate lying-cost sliders, overlap, auction-only k and nine read-only plots", run: async function () {
      frame = document.createElement("iframe");
      frame.style.cssText = "width:1280px;height:1000px;position:absolute;left:-15000px;border:0";
      frame.src = "../special-topics/lying-cost/index.html";
      document.getElementById("frames").appendChild(frame);
      await MechanismTest.waitFor(function () {
        doc = frame.contentDocument; win = frame.contentWindow;
        return doc && doc.querySelectorAll('.field-chart [data-layer="field"]').length === 9 && doc.querySelectorAll(".math-chart-axis-label mjx-container").length === 18;
      }, 20000, "Module/math did not load");
      assert(doc.querySelectorAll('input[type="range"]').length === 4);
      assert(el("k-control").hidden && win.getComputedStyle(el("k-control")).display === "none");
      ["gammaB", "gammaS", "epsilon", "k"].forEach(function (name) {
        close(el(name + "-slider").valueAsNumber, el(name + "-number").valueAsNumber);
      });
      assert(el("preset-split-the-difference").textContent === "k-Double-Auction");
      assert(doc.querySelectorAll(".field-chart > svg").length === 9);
      assert(doc.querySelectorAll(".preset-button").length === Object.keys(win.LyingCostModel.presets).length);
      assert(el("preset-minimum-rent").getAttribute("aria-pressed") === "true");
      assert(!doc.querySelector("select, textarea"));
      assert(doc.querySelector("page-header .wordmark").textContent === "Mechanism Design Explorer");
      assert(doc.querySelector("page-header .header-content > span").textContent === "Special Topics");
      assert(el("page-title").textContent === "Bilateral Trade with Lying Costs");
      assert(doc.title === "Bilateral Trade with Lying Costs | Mechanism Design Explorer");
      var appendix = doc.querySelector('learning-sidebar[page="lying-cost"]');
      var toggle = appendix.querySelector(".learning-sidebar-toggle");
      toggle.click();
      await MechanismTest.waitFor(function () {
        var notation = appendix.querySelector(".learning-sidebar-page");
        return notation && notation.querySelector("dt mjx-container") && !notation.hasAttribute("aria-busy");
      }, 15000);
      appendix.querySelector(".learning-sidebar-close").click();
      assert(!doc.querySelector("mjx-merror, [data-mjx-error]"));
    } },
    { name: "Slider input updates all exact state before release and coalesces a frame", run: async function () {
      var root = el("lying-cost-explorable"), before = Number(root.dataset.liveRenderCount);
      inputCosts("slider", "0.1"); inputCosts("slider", "0.12"); inputCosts("slider", "0.15");
      await pause();
      close(Number(root.dataset.liveRenderCount), before + 1);
      close(Number(root.dataset.gammaB), 0.15);
      close(el("gammaB-number").valueAsNumber, 0.15);
      assert(el("lying-cost-explorable").dataset.implementable === "false");
      assert(doc.querySelector("#panel-revenue .field-status").textContent.includes("Ex-ante BB: fails"));
      assert(doc.querySelector("#panel-buyerIC .field-status").textContent.includes("BIC: passes"));
      assert(field("buyerIC").dataset.rasterQuality === "preview");
    } },
    { name: "Gamma preserves unrelated allocation regions and epsilon shifts seller axes", run: async function () {
      var image = field("q"), before = fieldContent(image);
      inputCosts("slider", "0.8"); await pause();
      assert(fieldContent(image) === before, "Gamma changed allocation region");
      input("epsilon-slider", "0.4"); await pause();
      assert(el("description-sellerIC").textContent.includes("0.6, 1.6"), "Seller support description must track epsilon.");
      assert(doc.querySelector("#panel-sellerIC .field-chart > svg").textContent.includes("1.6"), "Seller SVG: " + doc.querySelector("#panel-sellerIC .field-chart > svg").textContent);
      assert(fieldContent(image) !== before, "Epsilon did not change allocation region");
      assert(el("lying-cost-explorable").dataset.implementable === "true");
    } },
    { name: "Number inputs preserve exact threshold state and reject invalid drafts", run: async function () {
      var threshold = 0.4 * win.LyingCostModel.thresholdFactor;
      inputCosts("number", threshold); await pause();
      close(Number(el("lying-cost-explorable").dataset.gammaB), threshold, 1e-15);
      assert(el("lying-cost-explorable").dataset.implementable === "true");
      input("epsilon-number", "1.5"); await pause();
      assert(el("epsilon-number").getAttribute("aria-invalid") === "true");
      close(Number(el("lying-cost-explorable").dataset.epsilon), 0.4);
      el("epsilon-number").dispatchEvent(new win.Event("blur"));
      close(el("epsilon-number").valueAsNumber, 0.4);
      assert(el("input-error").textContent === "");
    } },
    { name: "All slider endpoints remain finite and actual support endpoints stay visible", run: async function () {
      for (var g of [0, 1]) {
        for (var e of [0, 1]) {
          inputCosts("slider", g); input("epsilon-slider", e); await pause();
          assert(!/NaN|Infinity/.test(el("lying-cost-explorable").textContent));
          assert(el("description-q").textContent.includes("vertical support [" + (1-e) + ", " + (2-e) + "]"));
        }
      }
    } },
    { name: "Keyboard and pointer probes evaluate the current actual-coordinate model", run: async function () {
      input("epsilon-slider", "0.4"); await pause();
      var svg = doc.querySelector("#panel-sellerIC .field-chart > svg"), probe = el("probe-sellerIC");
      var before = probe.textContent;
      svg.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      assert(probe.textContent !== before && probe.textContent.includes("c = 1.11"), "Keyboard probe: " + probe.textContent);
      var point = new win.DOMPoint(70 + 380 * 0.25, 40 + 380 * 0.75).matrixTransform(svg.getScreenCTM());
      svg.dispatchEvent(new win.PointerEvent("pointermove", { clientX: point.x, clientY: point.y, bubbles: true }));
      assert(probe.textContent.includes("c = 0.85") && probe.textContent.includes("c′ = 0.85"), "Pointer probe: " + probe.textContent);
    } },
    { name: "Completed gestures upgrade quality without reverting a newer input", run: async function () {
      el("gammaB-slider").dispatchEvent(new win.Event("change", { bubbles: true }));
      inputCosts("slider", "0.33"); await pause();
      close(Number(el("lying-cost-explorable").dataset.gammaB), 0.33);
      assert(field("buyerIC").dataset.rasterQuality === "preview");
      el("gammaB-slider").dispatchEvent(new win.Event("change", { bubbles: true })); await pause();
      assert(field("buyerIC").dataset.rasterQuality === "final");
      close(Number(el("lying-cost-explorable").dataset.gammaB), 0.33);
    } },
    { name: "Layouts at 320, 375, 768 and 1280 pixels have no horizontal overflow", run: async function () {
      for (var width of [320, 375, 768, 1280]) {
        frame.style.width = width + "px"; await pause();
        assert(doc.documentElement.scrollWidth <= width + 1, "Overflow at " + width + ": " + doc.documentElement.scrollWidth);
        assert(doc.querySelector(".color-legends").getBoundingClientRect().top >= doc.querySelector(".sandbox-toolbar").getBoundingClientRect().bottom);
        assert(el("surfaces").getBoundingClientRect().top >= doc.querySelector(".color-legends").getBoundingClientRect().bottom);
      }
      doc.documentElement.style.zoom = "2"; await pause();
      assert(doc.documentElement.scrollWidth <= 1281, "Overflow at 200% zoom");
      doc.documentElement.style.zoom = "";
    } },
    { name: "One preset toolbar and three shared legends precede sandbox-sized plots", run: async function () {
      assert(doc.querySelectorAll(".color-scale-bar").length === 3);
      assert(Array.from(doc.querySelectorAll(".color-legend-title")).map(function (node) {
        return node.textContent;
      }).join("|") === "Allocation|Effect on revenue|Utility");
      assert(doc.querySelectorAll(".field-panel .color-scale").length === 0);
      assert(doc.querySelector('.introduction a[href="../../assets/papers/Bilateral_Trade_with_Lying_Costs.pdf"]'),
        "The introduction should link to the included manuscript.");
      assert(doc.querySelectorAll(".introduction mjx-container").length >= 7);
      var details = doc.querySelector(".mechanism-details");
      assert(details.tagName === "DETAILS" && !details.open, "Mechanism Details should start collapsed");
      details.querySelector("summary").click();
      assert(details.open, "The summary should expand Mechanism Details");
      details.querySelector("summary").click();
      assert(!details.open, "The summary should collapse Mechanism Details");
      var table = doc.querySelector(".mechanism-details-table");
      assert(table && table.querySelectorAll("tbody tr").length === Object.keys(win.LyingCostModel.presets).length);
      assert(table.querySelectorAll("td mjx-container").length === 6, "Every allocation and payment rule must be typeset");
      assert(doc.querySelector(".mechanism-details").getBoundingClientRect().top >= el("lying-cost-explorable").getBoundingClientRect().bottom);
      assert(!doc.querySelector(".outcome-summary"));
      assert(doc.querySelector(".notes").textContent.trim() === "Notes", "Notes remain empty for the author");
      var reference = doc.querySelector(".references .reference-list a");
      assert(reference && reference.getAttribute("href") === "../../assets/papers/Bilateral_Trade_with_Lying_Costs.pdf");
      assert(reference.textContent === "Bilateral Trade with Lying Costs");
      assert(doc.querySelector(".references").textContent.includes("Jiang, Elvin."));
      assert(doc.querySelector(".references").textContent.includes("September 2026"));
      assert(doc.querySelector(".notes").getBoundingClientRect().top >= el("lying-cost-explorable").getBoundingClientRect().bottom);
      doc.querySelectorAll(".field-chart > svg").forEach(function (svg) {
        assert(svg.getAttribute("viewBox") === "0 0 480 520");
        assert(svg.closest(".chart-viewport"));
      });
      assert(doc.querySelectorAll(".math-chart-axis-label mjx-container").length === 18);
      inputCosts("slider", "0.41");
      el("preset-minimum-rent").click(); await pause();
      close(Number(el("lying-cost-explorable").dataset.gammaB), 0.41);
      assert(el("lying-cost-explorable").dataset.preset === "minimum-rent");
      assert(el("preset-minimum-rent").getAttribute("aria-pressed") === "true");
    } },
    { name: "Hovering in every plot margin clamps exact probes to all four edges", run: async function () {
      input("epsilon-slider", "0.4"); await pause();
      doc.querySelectorAll(".field-chart > svg").forEach(function (svg) {
        [[60,230,70,230], [460,230,450,230], [260,30,260,40], [260,430,260,420]].forEach(function (sample) {
          var point = new win.DOMPoint(sample[0],sample[1]).matrixTransform(svg.getScreenCTM());
          svg.dispatchEvent(new win.PointerEvent("pointermove", {clientX: point.x,clientY: point.y,bubbles: true}));
          var marker = svg.querySelector(".plot-probe-point");
          assert(marker, "Margin hover must show the sandbox marker");
          close(Number(marker.getAttribute("cx")), sample[2], 1e-4);
          close(Number(marker.getAttribute("cy")), sample[3], 1e-4);
          assert(svg.querySelectorAll(".plot-probe-line").length === 2);
          assert(svg.querySelector(".plot-probe-box") && svg.querySelector(".plot-probe-text").textContent.includes("("),
            "Field readouts use the full function notation.");
        });
        svg.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        assert(!svg.querySelector(".plot-probe-point"));
      });
      var seller = doc.querySelector("#panel-sellerIC .field-chart > svg");
      var corner = new win.DOMPoint(460,30).matrixTransform(seller.getScreenCTM());
      seller.dispatchEvent(new win.PointerEvent("pointermove", { clientX: corner.x, clientY: corner.y, bubbles: true }));
      assert(el("probe-sellerIC").textContent.includes("c = 1.600, c′ = 1.600; value = 0.000"));
    } },
    { name: "Live allocation and payment edges agree with exact trade on both sides of the diagonal", run: async function () {
      input("epsilon-slider", "0.47"); inputCosts("slider", "0.11"); await pause();
      var rule = win.LyingCostModel.create({epsilon:0.47,gamma:0.11});
      var palette = win.BilateralTradeVisuals.readHeatmapPalette(win.getComputedStyle(doc.documentElement));
      var size = 720;
      for (var id of ["q", "pB", "pS"]) {
        assert(field(id).dataset.edgeRenderer === "vector-regions", "Exact transfers render as vector regions during input");
        var pixels = await renderedField(id, size);
        var points = [];
        for (var px = 410; px < 710; px += 13) {
          var diagonal = Math.floor((rule.sellerSupport[1] - (px + 0.5) / size) * size);
          points.push([px, diagonal - 3], [px, diagonal + 3]);
        }
        // Both transfers may remain nonzero without trade; masking the whole
        // payment outside the triangle would silently erase these values.
        points.push([680, 180], [100, 650]);
        points.forEach(function (point) {
          var x = (point[0] + 0.5) / size;
          var y = rule.sellerSupport[1] - (point[1] + 0.5) / size;
          var value = rule.field(id, x, y);
          var expected;
          if (id === "q") {
            expected = value ? palette.blue : palette.neutral;
          } else {
            var effect = id === "pS" ? -value : value;
            var color = effect < 0 ? palette.red : palette.green;
            var amount = Math.min(1, Math.abs(value));
            expected = color.map(function (channel) { return Math.round(255 + amount * (channel - 255)); });
          }
          var offset = 4 * (point[1] * size + point[0]);
          expected.forEach(function (channel, i) {
            close(pixels[offset+i], channel, 3, id + " has wrong boundary color at " + x + "," + y);
          });
        });
      }
      var before = await renderedField("q", size);
      el("epsilon-slider").dispatchEvent(new win.Event("change", {bubbles:true})); await pause();
      var after = await renderedField("q", size);
      assert(before.every(function (channel, index) { return channel === after[index]; }), "Allocation edge must not shift when preview quality changes");
      input("epsilon-slider", "0"); await pause();
      assert(doc.querySelector("#panel-q .preset-boundary").tagName.toLowerCase() === "circle", "Keep the isolated equality-point marker");
    } },
    { name: "Preset switching preserves parameters and draws analytic best responses", run: async function () {
      input("epsilon-slider",1); inputCosts("slider",0);
      el("preset-split-the-difference").click(); await pause();
      assert(el("lying-cost-explorable").dataset.preset==="split-the-difference");
      assert(el("preset-split-the-difference").getAttribute("aria-pressed")==="true");
      close(el("gammaB-number").valueAsNumber,0); close(el("epsilon-number").valueAsNumber,1);
      var buyer=doc.querySelector("#panel-buyerIC .best-report-line");
      var seller=doc.querySelector("#panel-sellerIC .best-report-line");
      close(buyer.getPointAtLength(buyer.getTotalLength()).y,420-380*2/3,1e-4);
      close(seller.getPointAtLength(0).y,420-380/3,1e-4);
      ["buyerIC","sellerIC"].forEach(function(id) {
        var lines=doc.querySelectorAll("#panel-"+id+" .field-status p");
        assert(lines.length===2 && lines[0].textContent==="BIC: fails (best-response path (orange points) does not lie entirely on " +
          (id==="buyerIC" ? "v′ = v" : "c′ = c") + ")");
        assert(lines[1].textContent==="DSIC: fails (maximum deviation gain = 0.5000)");
        assert(Array.from(lines).every(function(p){return p.className==="verdict-fail" && p.children.length===0;}));
      });
      inputCosts("number",0.5); await pause();
      ["buyerIC","sellerIC"].forEach(function(id) {
        var lines=doc.querySelectorAll("#panel-"+id+" .field-status p");
        assert(lines[0].textContent==="BIC: passes (best-response path (orange points) lies on " +
          (id==="buyerIC" ? "v′ = v" : "c′ = c") + ")");
        assert(lines[1].textContent==="DSIC: passes (maximum deviation gain = 0)");
        assert(Array.from(lines).every(function(p){return p.className==="verdict-pass";}));
        var best=doc.querySelector("#panel-"+id+" .best-report-line");
        assert(best.getAttribute("d")===doc.querySelector("#panel-"+id+" .truthful-report-line").getAttribute("d"));
      });
      input("epsilon-slider",0.4); inputCosts("slider",0.2); await pause();
      assert(doc.querySelector("#panel-buyerIC .field-status").textContent.includes("BIC: passes (best-response path (orange points) lies on v′ = v)DSIC: fails"));
      var before=fieldContent(field("pB"));
      inputCosts("slider",0.7); await pause();
      assert(fieldContent(field("pB"))===before,"Gamma must not alter midpoint payments");
      el("preset-minimum-rent").click(); await pause();
      close(el("gammaB-number").valueAsNumber,0.7); close(el("epsilon-number").valueAsNumber,0.4);
      assert(doc.querySelector("#panel-buyerIC .field-status").textContent.includes("DSIC: fails"));
      assert(fieldContent(field("pB"))!==before,"Preset change must replace payment surfaces");
      inputCosts("slider",1); await pause();
      assert(doc.querySelector("#panel-buyerIC .field-status").textContent.includes("DSIC: passes"));
    } },
    { name: "Split payment colors retain smooth trade edges and exact probes while adjusting overlap", run: async function () {
      el("preset-split-the-difference").click();
      input("epsilon-slider",0.47); inputCosts("slider",0.11); await pause();
      var r=win.LyingCostModel.create({epsilon:0.47,gamma:0.11},"split-the-difference");
      var palette=win.BilateralTradeVisuals.readHeatmapPalette(win.getComputedStyle(doc.documentElement));
      var size=720;
      var buyerPixels = await renderedField("pB", size);
      var sellerPixels = await renderedField("pS", size);
      assert(buyerPixels.some(function (channel, index) { return channel !== sellerPixels[index]; }),
        "Equal buyer and seller payments have opposite effects on revenue");
      for(var id of ["q","pB","pS"]) {
        assert(field(id).dataset.edgeRenderer==="vector-regions");
        var pixels=await renderedField(id,size);
        for(var px=410;px<710;px+=13) {
          var diagonal=Math.floor((r.sellerSupport[1]-(px+0.5)/size)*size);
          for(var dy of [-3,3]) {
            var py=diagonal+dy,x=(px+0.5)/size,y=r.sellerSupport[1]-(py+0.5)/size;
            var value=r.field(id,x,y);
            var expected=id==="q" ? (value ? palette.blue : palette.neutral) :
              (id === "pS" ? palette.red : palette.green).map(function(channel){return Math.round(255+value*(channel-255));});
            expected.forEach(function(channel,i){close(pixels[4*(py*size+px)+i],channel,3,id+" boundary color");});
          }
        }
      }
      var svg=doc.querySelector("#panel-pB .field-chart > svg");
      var point=new win.DOMPoint(450,420).matrixTransform(svg.getScreenCTM());
      svg.dispatchEvent(new win.PointerEvent("pointermove",{clientX:point.x,clientY:point.y,bubbles:true}));
      assert(el("probe-pB").textContent.includes("value = 0.765"));
      input("epsilon-slider",0); inputCosts("slider",0); await pause();
      assert(doc.querySelector("#panel-q .preset-boundary").tagName.toLowerCase()==="circle");
      assert(doc.querySelector("#panel-buyerIC .field-status").textContent.includes("BIC: passes (best-response path (orange points) lies on v′ = v)DSIC: passes"));
      assert(!/NaN|Infinity/.test(el("lying-cost-explorable").textContent));
      frame.style.width="320px"; await pause();
      assert(doc.documentElement.scrollWidth<=321,"Preset row overflows on narrow screens");
      frame.style.width="1280px";
    } },
    { name: "Gamma updates preserve completed unrelated fields while refreshing IC", run: async function () {
      el("preset-split-the-difference").click();
      input("epsilon-slider", 0.47); inputCosts("slider", 0.11);
      el("gammaB-slider").dispatchEvent(new win.Event("change", { bubbles: true }));
      await pause();
      var fixed = ["q", "pB", "pS", "revenue", "buyerPayoff", "sellerPayoff", "efficiency"].map(function (id) {
        var panel = el("panel-" + id);
        var image = panel.querySelector('[data-layer="field"]');
        return { panel: panel, image: image, href: fieldContent(image),
          tick: panel.querySelector('[data-layer="frame"]').firstChild };
      });
      var ic = field("buyerIC");
      var beforeIC = ic.getAttribute("href");
      inputCosts("slider", 0.5); await pause();
      fixed.forEach(function (field) {
        assert(fieldContent(field.image) === field.href, "Unchanged field image was replaced");
        if (field.image.dataset.edgeRenderer === "raster") {
          assert(field.image.dataset.rasterQuality === "final", "Unchanged raster was downgraded to preview quality");
        }
        assert(field.panel.querySelector('[data-layer="frame"]').firstChild === field.tick,
          "Unchanged field axes were rebuilt");
      });
      assert(ic.getAttribute("href") !== beforeIC && ic.dataset.rasterQuality === "preview", "IC must still update during input");
      assert(doc.querySelector("#panel-buyerIC .field-status").textContent.includes("BIC: passes (best-response path (orange points) lies on v′ = v)DSIC: passes"));
      el("gammaB-slider").dispatchEvent(new win.Event("change", { bubbles: true })); await pause();
      assert(ic.dataset.rasterQuality === "final", "Changed IC must upgrade after release");
      fixed.forEach(function (field) {
        assert(field.panel.querySelector('[data-layer="frame"]').firstChild === field.tick,
          "Finishing a gesture rebuilt an unchanged field");
      });
    } },
    { name: "Epsilon keeps live shaded regions aligned with their boundaries in each input frame", run: async function () {
      for (var preset of ["minimum-rent", "split-the-difference"]) {
        el("preset-" + preset).click(); await pause();
        for (var epsilon of [0.91, 0.23, 0.76, 0, 0.01, 1]) {
          input("epsilon-slider", epsilon);
          // Inspect the input's first committed frame, without waiting for images.
          await new Promise(function (resolve) { win.requestAnimationFrame(resolve); });
          close(Number(el("lying-cost-explorable").dataset.epsilon), epsilon);
          assert(!field("efficiency").childElementCount, "Zero lost gains leave the efficiency field clear.");
          for (var id of ["q", "pB", "pS"]) {
            var region = field(id), chart = el(id + "-chart");
            assert(region.tagName.toLowerCase() === "svg", "Trade regions must paint directly, without SVG image decoding");
            assert(!region.querySelector('image[href^="data:image/svg"]'));
            var polygon = region.querySelector("polygon");
            var vertices = [polygon.points.getItem(0), polygon.points.getItem(2)].map(function (point) {
              return new win.DOMPoint(point.x, point.y).matrixTransform(region.getScreenCTM())
                .matrixTransform(chart.getScreenCTM().inverse());
            });
            var line = el("panel-" + id).querySelector('[data-layer="overlay"] > :first-child');
            var endpoints = epsilon === 0 ? [0, 0].map(function () {
              return { x: Number(line.getAttribute("cx")), y: Number(line.getAttribute("cy")) };
            }) : [line.getPointAtLength(0), line.getPointAtLength(line.getTotalLength())];
            vertices.forEach(function (point, index) {
              close(point.x, endpoints[index].x, 1e-4, id + " fill and line disagree horizontally");
              close(point.y, endpoints[index].y, 1e-4, id + " fill and line disagree vertically");
            });
            if (id === "q") {
              assert(!region.querySelector("image"), "Allocation shading must have no asynchronous image layer");
            }
          }
        }
      }
    } },
    { name: "Sticky sliders update scrolled graphs on desktop and mobile and stop at the demo end", run: async function () {
      var originalWidth = frame.style.width;
      var originalHeight = frame.style.height;
      var bar = doc.querySelector(".sticky-parameter-bar");
      try {
        el("preset-minimum-rent").click(); input("epsilon-slider", 1); await pause();
        for (var width of [1280, 375]) {
          frame.style.width = width + "px"; frame.style.height = "667px"; await pause();
          var chart = el("buyerPayoff-chart");
          win.scrollTo({top: win.scrollY + chart.getBoundingClientRect().top -
            bar.getBoundingClientRect().height - 24, behavior: "instant"});
          await pause();
          close(bar.getBoundingClientRect().top, 0, 1, "The sliders stay at the viewport top");
          assert(bar.getBoundingClientRect().height < 140, "Three compact sliders leave room for graphs");
          assert(chart.getBoundingClientRect().top > bar.getBoundingClientRect().bottom);
          assert(el("preset-buttons").getBoundingClientRect().bottom < 0, "Presets scroll normally");
          var before = fieldContent(field("buyerPayoff"));
          inputCosts("slider", width === 1280 ? 0.21 : 0.41); await pause();
          assert(fieldContent(field("buyerPayoff")) !== before, "The visible payoff changes during slider input");
          close(Number(el("lying-cost-explorable").dataset.gammaB), el("gammaB-slider").valueAsNumber);
          frame.style.height = "320px"; await pause();
          win.scrollTo({top: win.scrollY + el("lying-cost-explorable").getBoundingClientRect().bottom, behavior: "instant"});
          await pause();
          assert(bar.getBoundingClientRect().bottom <= 1, "The bar leaves with the graph section");
        }
      } finally {
        frame.style.width = originalWidth;
        frame.style.height = originalHeight;
        win.scrollTo({top: 0, behavior: "instant"});
        await pause();
      }
    } },
    { name: "Independent lying costs update only the affected agent and preserve exact probes", run: async function () {
      el("preset-minimum-rent").click();
      input("epsilon-number", 1); input("gammaB-number", 0.1); input("gammaS-number", 0.8); await pause();
      el("gammaB-slider").dispatchEvent(new win.Event("change", {bubbles:true})); await pause();
      var sellerIds = ["pS", "sellerIC", "sellerPayoff"];
      var sellerFields = sellerIds.map(function(id) { return fieldContent(field(id)); });
      var buyerBefore = fieldContent(field("pB"));
      var revenueBefore = fieldContent(field("revenue"));
      input("gammaB-number", 0.4); await pause();
      close(Number(el("lying-cost-explorable").dataset.gammaB), 0.4);
      close(Number(el("lying-cost-explorable").dataset.gammaS), 0.8);
      close(el("gammaB-slider").valueAsNumber, 0.4);
      sellerIds.forEach(function(id, i) { assert(fieldContent(field(id)) === sellerFields[i], "Buyer cost changed " + id); });
      assert(fieldContent(field("pB")) !== buyerBefore && fieldContent(field("revenue")) !== revenueBefore);
      var buyerIds = ["pB", "buyerIC", "buyerPayoff"];
      var buyerFields = buyerIds.map(function(id) { return fieldContent(field(id)); });
      input("gammaS-slider", 0.2); await pause();
      close(el("gammaS-number").valueAsNumber, 0.2);
      buyerIds.forEach(function(id, i) { assert(fieldContent(field(id)) === buyerFields[i], "Seller cost changed " + id); });
      var r = win.LyingCostModel.create({gammaB:0.4,gammaS:0.2,epsilon:1,k:0.5});
      var svg = el("sellerIC-chart");
      var point = new win.DOMPoint(70+380*0.2,420-380*0.7).matrixTransform(svg.getScreenCTM());
      svg.dispatchEvent(new win.PointerEvent("pointermove",{clientX:point.x,clientY:point.y,bubbles:true}));
      assert(el("probe-sellerIC").textContent.includes("value = " + win.PlotStyle.probe(r.sellerDeviation(0.2,0.7))));
    } },
    { name: "Auction k updates payments, payoffs, IC and probes live, survives switches, and rejects invalid input", run: async function () {
      el("preset-split-the-difference").click();
      assert(!el("k-control").hidden);
      input("epsilon-slider",1); input("gammaB-number",0.25); input("gammaS-number",0.75);
      input("k-number",0.25); await pause();
      close(el("k-slider").valueAsNumber,0.25);
      ["buyerIC","sellerIC"].forEach(function(id) {
        assert(el("panel-"+id).textContent.includes("DSIC: passes"));
      });
      var fixed = ["q","revenue","efficiency"].map(function(id){return fieldContent(field(id));});
      var paymentBefore = fieldContent(field("pB")), payoffBefore = fieldContent(field("buyerPayoff"));
      input("k-slider",0.75); await pause();
      close(el("k-number").valueAsNumber,0.75);
      close(Number(el("lying-cost-explorable").dataset.k),0.75);
      assert(el("panel-buyerIC").textContent.includes("BIC: fails") && el("panel-sellerIC").textContent.includes("BIC: passes"));
      assert(fieldContent(field("pB")) !== paymentBefore && fieldContent(field("buyerPayoff")) !== payoffBefore);
      ["q","revenue","efficiency"].forEach(function(id,i){assert(fieldContent(field(id))===fixed[i]);});
      var svg = el("pB-chart"), point = new win.DOMPoint(450,420).matrixTransform(svg.getScreenCTM());
      svg.dispatchEvent(new win.PointerEvent("pointermove",{clientX:point.x,clientY:point.y,bubbles:true}));
      assert(el("probe-pB").textContent.includes("value = " + win.PlotStyle.probe(0.75)));
      input("k-number",1.1); await pause();
      assert(el("k-number").getAttribute("aria-invalid")==="true");
      close(Number(el("lying-cost-explorable").dataset.k),0.75);
      el("k-number").dispatchEvent(new win.Event("blur"));
      close(el("k-number").valueAsNumber,0.75);
      input("gammaS-number",-0.1); await pause();
      assert(el("gammaS-number").getAttribute("aria-invalid")==="true");
      el("gammaS-number").dispatchEvent(new win.Event("blur"));
      close(el("gammaS-number").valueAsNumber,0.75);
      el("preset-minimum-rent").click(); await pause();
      assert(el("k-control").hidden);
      el("preset-split-the-difference").click(); await pause();
      close(el("k-number").valueAsNumber,0.75);
      for (var width of [320,375,768,1280]) {
        frame.style.width=width+"px"; await pause();
        assert(doc.documentElement.scrollWidth<=width+1);
        if(width<=375) { assert(doc.querySelector(".sticky-parameter-bar").getBoundingClientRect().height<180); }
      }
      assert(!doc.querySelector("mjx-merror,[data-mjx-error]"));
    } },
    { name: "Weighted auction gradients match model prices at k endpoints and an asymmetric interior weight", run: async function () {
      el("preset-split-the-difference").click(); input("epsilon-slider",0.6);
      for (var k of [0,0.2,1]) {
        input("k-slider",k); await pause();
        var r=win.LyingCostModel.create({gammaB:0.25,gammaS:0.75,epsilon:0.6,k:k},"split-the-difference");
        var palette=win.BilateralTradeVisuals.readHeatmapPalette(win.getComputedStyle(doc.documentElement));
        var size=400;
        for(var id of ["pB","pS"]) {
          var pixels=await renderedField(id,size);
          for(var point of [[360,360],[260,360],[360,260],[100,100]]) {
            var x=(point[0]+0.5)/size,c=r.sellerSupport[1]-(point[1]+0.5)/size;
            var value=r.field(id,x,c), color=id==="pB"?palette.green:palette.red;
            color.forEach(function(channel,i) {
              close(pixels[4*(point[1]*size+point[0])+i],Math.round(255+value*(channel-255)),3,"Weighted payment color");
            });
          }
        }
        assert(!/NaN|Infinity/.test(el("lying-cost-explorable").textContent));
      }
    } },
    { name: "Root menu is script-free and links to the working new module", run: async function () {
      frame.src = "../index.html";
      await MechanismTest.waitFor(function () { return frame.contentDocument && frame.contentDocument.querySelector(".module-link"); }, 10000);
      doc = frame.contentDocument;
      assert(doc.scripts.length === 0);
      var link = doc.querySelector('#special-topics a.module-link[href="special-topics/lying-cost/index.html"]');
      assert(link && link.textContent.trim() === "Bilateral Trade with Lying Costs");
      frame.remove();
    } }
  ], { title: "Lying-cost ui tests" });
})();
