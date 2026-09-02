"use strict";

window.SvgUtils = Object.freeze({
  appendSvg: function (parent, name, attributes, text) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    if (typeof text === "string") {
      node.textContent = text;
    }
    parent.appendChild(node);
    return node;
  },
  formatTick: function (value) {
    return value.toFixed(value === 0 || value === 1 ? 0 : 2);
  },
  createFieldRaster: function (size, valueAt, colorFn) {
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var context = canvas.getContext("2d");
    var image = context.createImageData(size, size);
    var data = image.data;
    var pixelX;
    var pixelY;
    for (pixelY = 0; pixelY < size; pixelY += 1) {
      var yValue = 1 - (pixelY + 0.5) / size;
      for (pixelX = 0; pixelX < size; pixelX += 1) {
        var xValue = (pixelX + 0.5) / size;
        var color = colorFn(valueAt(xValue, yValue), pixelX, pixelY);
        var offset = (pixelY * size + pixelX) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = color.length > 3 ? color[3] : 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  },
  createTriangleMesh: function (resolution) {
    var appendSvg = window.SvgUtils.appendSvg;
    var cellSize = 1 / resolution;

    function clamp(value, lower, upper) {
      return Math.min(upper, Math.max(lower, value));
    }

    function svgXOf(value, layout) {
      return layout.left + value * (layout.right - layout.left);
    }

    function svgYOf(value, layout) {
      return layout.bottom - value * (layout.bottom - layout.top);
    }

    function cellRect(i, j, layout) {
      var x0 = i * cellSize;
      var x1 = (i + 1) * cellSize;
      var y0 = j * cellSize;
      var y1 = (j + 1) * cellSize;
      var x = svgXOf(x0, layout);
      var xEnd = svgXOf(x1, layout);
      var yTop = svgYOf(y1, layout);
      var yBottom = svgYOf(y0, layout);
      return { x: x, y: yTop, width: xEnd - x, height: yBottom - yTop };
    }

    function cellCorners(i, j, layout) {
      var x0 = i * cellSize;
      var x1 = (i + 1) * cellSize;
      var y0 = j * cellSize;
      var y1 = (j + 1) * cellSize;
      return {
        bottomLeft: { x: svgXOf(x0, layout), y: svgYOf(y0, layout) },
        bottomRight: { x: svgXOf(x1, layout), y: svgYOf(y0, layout) },
        topLeft: { x: svgXOf(x0, layout), y: svgYOf(y1, layout) },
        topRight: { x: svgXOf(x1, layout), y: svgYOf(y1, layout) }
      };
    }

    function trianglePoints(corners, isLower) {
      var points = isLower ?
        [corners.bottomLeft, corners.bottomRight, corners.topRight] :
        [corners.bottomLeft, corners.topLeft, corners.topRight];
      return points.map(function (point) {
        return point.x + "," + point.y;
      }).join(" ");
    }

    function pointerToTriangle(svg, event, layout) {
      var rect = svg.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) {
        return null;
      }
      var scaleX = layout.viewWidth / rect.width;
      var scaleY = layout.viewHeight / rect.height;
      var svgX = (event.clientX - rect.left) * scaleX;
      var svgY = (event.clientY - rect.top) * scaleY;
      var insidePlot = svgX >= layout.left && svgX <= layout.right &&
        svgY >= layout.top && svgY <= layout.bottom;
      var xValue = clamp(
        (svgX - layout.left) / (layout.right - layout.left), 0, 1
      );
      var yValue = clamp(
        (layout.bottom - svgY) / (layout.bottom - layout.top), 0, 1
      );
      var i = clamp(Math.floor(xValue / cellSize), 0, resolution - 1);
      var j = clamp(Math.floor(yValue / cellSize), 0, resolution - 1);
      var delta = xValue - i * cellSize;
      var epsilon = yValue - j * cellSize;
      return {
        i: i,
        j: j,
        isLower: delta >= epsilon,
        insidePlot: insidePlot
      };
    }

    function drawTriangleMesh(svg, grid, layout, colorFn) {
      var triangles = { lower: new Array(resolution), upper: new Array(resolution) };
      var i;
      var j;
      for (i = 0; i < resolution; i += 1) {
        triangles.lower[i] = new Array(resolution);
        triangles.upper[i] = new Array(resolution);
        for (j = 0; j < resolution; j += 1) {
          var corners = cellCorners(i, j, layout);
          triangles.lower[i][j] = appendSvg(svg, "polygon", {
            points: trianglePoints(corners, true),
            fill: colorFn(grid.lower[i][j], i, j, true),
            stroke: "none"
          });
          triangles.upper[i][j] = appendSvg(svg, "polygon", {
            points: trianglePoints(corners, false),
            fill: colorFn(grid.upper[i][j], i, j, false),
            stroke: "none"
          });
        }
      }
      return triangles;
    }

    return Object.freeze({
      svgXOf: svgXOf,
      svgYOf: svgYOf,
      cellRect: cellRect,
      cellCorners: cellCorners,
      trianglePoints: trianglePoints,
      pointerToTriangle: pointerToTriangle,
      drawTriangleMesh: drawTriangleMesh
    });
  }
});
