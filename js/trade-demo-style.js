(function (global) {
  "use strict";

  // The SVG margins remain interactive; painting still uses the strict mesh hit test.
  function bindEdgeHover(chart, layout, setProbe) {
    chart.addEventListener("pointermove", function (event) {
      if (event.buttons) { return; }
      var matrix = chart.getScreenCTM();
      if (!matrix) { return; }
      var point = chart.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      point = point.matrixTransform(matrix.inverse());
      if (point.x >= layout.left && point.x <= layout.right &&
          point.y >= layout.top && point.y <= layout.bottom) { return; }
      setProbe(
        Math.max(0, Math.min(1, (point.x - layout.left) / (layout.right - layout.left))),
        Math.max(0, Math.min(1, (layout.bottom - point.y) / (layout.bottom - layout.top)))
      );
    });
  }

  global.TradeDemoStyle = Object.freeze({ bindEdgeHover: bindEdgeHover });
}(window));
