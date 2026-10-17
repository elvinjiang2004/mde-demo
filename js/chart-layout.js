"use strict";

(function (global) {
  function svgUnits(svg, pixels) {
    var width = parseFloat(getComputedStyle(svg).width);
    return width > 0 ? pixels * svg.viewBox.baseVal.width / width : pixels;
  }
  function setTextSize(svg) {
    var pixels = 0.86 * parseFloat(getComputedStyle(document.documentElement).fontSize);
    var size = svgUnits(svg, pixels) + "px";
    if (svg.style.getPropertyValue("--chart-font-size") !== size) {
      svg.style.setProperty("--chart-font-size", size);
    }
  }
  global.ChartLayout = Object.freeze({ svgUnits: svgUnits, setTextSize: setTextSize });
  document.addEventListener("DOMContentLoaded", function () {
    var observer = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) { setTextSize(entry.target); });
    });
    document.querySelectorAll(".chart-plot-viewport .chart-canvas-frame > svg").forEach(function (svg) {
      setTextSize(svg);
      observer.observe(svg);
    });
  });
}(window));
