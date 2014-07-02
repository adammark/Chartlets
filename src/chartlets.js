/*
  Chartlets v0.9.10: http://chartlets.com
  MIT License
  (c) 2013 Adam Mark
*/
(function (win) {
  var Chartlets, type, ctx, width, height, rotated, range, sets, opts, colors, themes, renderers, animate;

  // Type of chart ("line", "bar" or "pie")
  type = null;

  // Canvas 2d context
  ctx = null;

  // Canvas dimensions
  width = 0;
  height = 0;

  // Is the canvas rotated 90 degrees (for horizontal bar charts)?
  rotated = false;

  // Input range [min, max] across sets
  range = [0, 0];

  // Data sets (an array of arrays)
  sets = [];

  // Options from data-opts
  opts = {};

  // Renderers for line, bar and pie charts
  renderers = {
    "line": renderLineChart,
    "bar": renderBarChart,
    "pie": renderPieChart
  };

  // Built-in color themes. A theme can have any number of colors (as hex, RGB/A, or HSL/A)
  themes = {
    "blues":  ["#7eb5d6", "#2a75a9", "#214b6b", "#dfc184", "#8f6048"],
    "money":  ["#009b6d", "#89d168", "#d3eb87", "#666666", "#aaaaaa"],
    "circus": ["#9351a4", "#ff99cc", "#e31a1c", "#66cdaa", "#ffcc33"],
    "party":  ["#ffcc00", "#ff66cc", "#3375cd", "#e43b3b", "#96cb3f"],
    "garden": ["#3c7bb0", "#ffa07a", "#2e8b57", "#7eb5d6", "#89d168"],
    "crayon": ["#468ff0", "#ff8000", "#00c000", "#ffd700", "#ff4500"],
    "ocean":  ["#3375cd", "#62ccb2", "#4aa5d5", "#a6cee3", "#ffcc33"],
    "spring": ["#ed729d", "#72caed", "#9e9ac8", "#a6d854", "#f4a582"],
    "beach":  ["#f92830", "#2fb4b1", "#ffa839", "#3375cd", "#5fd1d5"],
    "fire":   ["#dc143c", "#ff8c00", "#ffcc33", "#b22222", "#cd8540"]
  };

  // Animation shim. See http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  animate =
    win.requestAnimationFrame || 
    win.webkitRequestAnimationFrame ||
    win.mozRequestAnimationFrame ||
    win.msRequestAnimationFrame ||
    function (callback) {
      win.setTimeout(callback, 1000 / 60);
    };

  // Split attribute value into array. "a b c" -> ["a", "b", "c"]
  function parseAttr(elem, attr) {
    var val = elem.getAttribute(attr);

    return val ? val.replace(/, +/g, ",").split(/ +/g) : null;
  }

  // Parse data-opts attribute. "a:b c:d" -> {a:"b", c:"d"}
  function parseOpts(elem) {
    var pairs, pair, opts, i;

    pairs = parseAttr(elem, "data-opts") || [];
    opts = {};

    for (i = 0; i < pairs.length; i++) {
      pair = pairs[i].split(":");
      opts[pair[0]] = pair[1];
    }

    return opts;
  }

  // Parse data-sets attribute. "[1 2] [3 4]" -> [[1,2], [3,4]]
  function parseSets(str) {
    // or "[[1,2], [3,4]]" -> [[1,2], [3,4]]
    var sets = str.match(/\[[^\[]+\]/g) || [], i, j;

    for (i = 0; i < sets.length; i++) {
      sets[i] = sets[i].match(/[-\d\.]+/g);

      for (j = 0; j < sets[i].length; j++) {
        sets[i][j] = +sets[i][j];
      }
    }

    return sets;
  }

  // Is the bar or line chart stacked?
  function isStacked() {
    return opts.transform === "stack";
  }

  // Is the line chart filled?
  function isFilled() {
    return opts.fill !== undefined;
  }

  // Get the range [min, max] across all data sets
  function getRange(sets, stacked) {
    return stacked ? computeStackRange(sets) : computeRange(sets);
  }

  // Compute the range [min, max] across all data sets
  function computeRange(sets) {
    var arr = Array.prototype.concat.apply([], sets);

    if (type === "bar" || isStacked()) {
      arr.push(0);
    }

    return [Math.min.apply(null, arr), Math.max.apply(null, arr)];
  }

  // Compute the range [min, max] across all data sets if they are *stacked*
  function computeStackRange(sets) {
    return computeRange(mergeSets(sets).concat(sets));
  }

  // Convert a color string (hex, rgb/a, or hsl/a) to an object with r, g, b, a values
  function parseColor(str) {
    var color = {
      "r": 0,
      "g": 0,
      "b": 0,
      "a": 1
    };
 
    if (str.match(/#/)) {
      color = parseHex(str);
    }
    else if (str.match(/rgb/)) {
      color = parseRGB(str);
    }
    else if (str.match(/hsl/)) {
      color = parseHSL(str);
    }

    return color;
  }

  // Convert an rgb or rgba string to an object with r, g, b, a values
  function parseRGB(str) {
    var c = str.match(/[\d\.]+/g);

    return {
      "r": +c[0],
      "g": +c[1],
      "b": +c[2],
      "a": +c[3] || 1
    };
  }

  // Convert a 3- or 6-digit hex string to an object with r, g, b, a values
  function parseHex(str) {
    var c = str.match(/\w/g), n;

    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }

    n = +("0x" + c.join(""));

    return {
      "r": (n & 0xFF0000) >> 16,
      "g": (n & 0x00FF00) >> 8,
      "b": (n & 0x0000FF),
      "a": 1
    };
  }

  // Convert an hsl or hsla string to an object with r, g, b, a values
  // See http://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
  function parseHSL(str) {
    var c, h, s, l, r, g, b, q, p, a;

    c = str.match(/[\d\.]+/g);
    h = +c[0] / 360;
    s = +c[1] / 100;
    l = +c[2] / 100;
    a = (+c[3] || 1) / 1;

    function hue2rgb(p, q, t) {
      if (t < 0) {
        t += 1;
      }
      if (t > 1) {
        t -= 1;
      }
      if (t < 1 / 6) {
        return p + (q - p) * 6 * t;
      }
      if (t < 1 / 2) {
        return q;
      }
      if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6;
      }

      return p;
    }

    if (s === 0) {
      r = g = b = l;
    } else {
      q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      "r": r * 255,
      "g": g * 255,
      "b": b * 255,
      "a": a
    };
  }

  // Multiply a color's alpha value (0 to 1) by n
  function sheerColor(color, n) {
    color.a *= n;

    return color;
  }

  // Convert a color object (with r, g, b, a properties) to an rgba string
  function toRGBString(color) {
    return "rgba(" + [
      Math.round(color.r),
      Math.round(color.g),
      Math.round(color.b),
      color.a
    ].join(",") + ")";
  }

  // Rotate the context 90 degrees
  function rotate() {
    rotated = true;
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);    
  }

  // Get the x step in pixels
  function getXStep(len) {
    return (rotated ? height : width) / (len - 1);
  }

  // Get the x position in pixels for the given index and length of set
  function getXForIndex(idx, len) {
    return idx * getXStep(len);
  }

  // Get the y position in pixels for the given data value
  function getYForValue(val) {
    var h = rotated ? width : height;

    return h - (h * ((val - range[0]) / (range[1] - range[0])));
  }

  // Sum all the values in a set. e.g. sumSet([1,2,3]) -> 6
  function sumSet(set) {
    var i, n = 0;

    for (i = 0; i < set.length; i++) {
      n += set[i];
    }

    return n;
  }

  // Sum all the values at the given index across sets. e.g. sumY([[4,5],[6,7]], 0) -> 10
  function sumY(sets, idx) {
    var i, n = 0;

    for (i = 0; i < sets.length; i++) {
      n += sets[i][idx];
    }

    return n;
  }

  // Merge two or more sets into one array. e.g. mergeSets([[1,2],[3,4]]) -> [4,6]
  function mergeSets(sets) {
    var i, set = [];

    for (i = 0; i < sets[0].length; i++) {
      set.push(sumY(sets, i));
    }

    return set;
  }

  // Get the color string for the given index. Return black if undefined
  function colorOf(idx) {
    return colors[idx] || "#000";
  }

  // Draw a line (or polygon) for a data set
  function drawLineForSet(set, strokeStyle, lineWidth, fillStyle, offset) {
    var i = 0, x, y, step;
    
    step = getXStep(set.length);

    ctx.lineWidth = Math.min(3, lineWidth);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.strokeStyle = strokeStyle;
    ctx.moveTo(0, getYForValue(set[0]));

    while (++i < set.length) {
      x = getXForIndex(i, set.length);
      y = getYForValue(set[i]);

      // TODO support stack + smooth
      if (isStacked()) {
        opts.shape = "straight";
      }

      drawLineSegment(set, i, x, y, step, opts.shape);
    }

    // TODO support transform=band (upper + lower baselines)
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      if (offset) {
        while (--i >= 0) {
          x = getXForIndex(i, offset.length);
          y = getYForValue(offset[i]);

          drawLineSegment(offset, i, x, y, step, opts.shape);
          //ctx.lineTo(x, y);
        }
      }
      else {
        ctx.lineTo(x, getYForValue(0));
        ctx.lineTo(0, getYForValue(0));
      }
      ctx.fill();
    }
    else {
      ctx.stroke();
    }
  }

  // Draw an individual line segment
  function drawLineSegment(set, i, x, y, step, shape) {
    var cx, cy;

    // curvy line
    if (shape === "smooth") {
      cx = getXForIndex(i - 0.5, set.length);
      cy = getYForValue(set[i - 1]);
      ctx.bezierCurveTo(cx, cy, cx, y, x, y);
    }
    else {
      // stepped line
      if (shape === "step") {
        ctx.lineTo(x - (step / 2), getYForValue(set[i - 1]));
        ctx.lineTo(x - (step / 2), y);
      }
      // else straight line
      ctx.lineTo(x, y);
    }
  }

  // Draw circle or square caps for a data set
  function drawCapsForSet(set, capStyle, fillStyle, lineWidth) {
    var i = -1, x, y, w;

    while (++i < set.length) {
      x = getXForIndex(i, set.length);
      y = getYForValue(set[i]);

      if (capStyle === "square") {
        w = Math.max(2, lineWidth) * 2.5;
        drawRect(fillStyle, x - (w / 2), y + (w / 2), w, w);
      }
      else {
        w = lineWidth + 1;
        drawCircle(fillStyle, x, y, w);
      }
    }
  }

  // Draw a circle
  function drawCircle(fillStyle, x, y, r) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.arc(x, y, r, 2 * Math.PI, false);
    ctx.fill();
  }

  // Draw a rectangle from bottom left corner
  function drawRect(fillStyle, x, y, w, h) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y - h, w, h);
  }

  // Draw an axis if a y-value is provided in data-opts
  function drawAxis() {
    var x, y;

    if (!isNaN(+opts.axis)) {
      x = 0;
      y = Math.round(getYForValue(opts.axis));

      ctx.lineWidth = 1;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#bbb";
      ctx.moveTo(x, y);

      while (x < width) {
        ctx.lineTo(x + 5, y);
        ctx.moveTo(x + 8, y);
        x += 8;
      }

      ctx.stroke();
    }
  }

  // Interpolate a value between a and b. e.g. interpolate(0,1,5,10) -> 0.5
  function interpolate(a, b, idx, steps) {
    return +a + ((+b - +a) * (idx / steps));
  }

  // Interpolate all values from set a to set b, returning an array of arrays
  function interpolateSet(a, b, n) {
    var i, j, c = [a];

    for (i = 0; i < a.length; i++) {
      for (j = 1; j < n; j++) {
        if (!c[j]) {
          c[j] = [];
        }

        c[j][i] = interpolate(a[i], b[i], j, n);
      }
    }

    return c.concat([b]);
  }

  // Interpolate all values across two arrays of sets, returning a multidimensional array
  function interpolateSets(a, b, n) {
    var i, c = [];

    for (i = 0; i < a.length; i++) {
      c.push(interpolateSet(a[i], b[i], n));
    }

    return c;
  }

  // Create a transition from one array of sets to another for the element with the given ID
  function Transition(elem, asets, bsets) {
    var i = 1, j = 0, n = 8, interpolated = interpolateSets(asets, bsets, n);

    if (!asets.length) {
      return Chartlets.update(elem, bsets);
    }

    function _render() {
      var set = [];

      for (j = 0; j < interpolated.length; j++) {
        set.push(interpolated[j][i]);
      }

      Chartlets.update(elem, set);

      if (++i <= n) {
        animate(_render);
      }
    }

    animate(_render);
  }

  // Render a line chart
  function renderLineChart() {
    var i, set, strokeStyle, fillStyle, alphaMultiplier, offset;

    drawAxis();

    for (i = 0; i < sets.length; i++) {
      set = sets[i];
      strokeStyle = colorOf(i);

      if (isStacked()) {
        set = mergeSets(sets.slice(0, i + 1));
        offset = i > 0 ? mergeSets(sets.slice(0, i)) : null;
      }

      drawLineForSet(set, strokeStyle, opts.stroke || 1.5, null);

      // TODO account for negative and positive values in same stack
      if (isStacked() || isFilled()) {
        alphaMultiplier = opts.alpha || (isStacked() ? 1 : 0.5);

        fillStyle = toRGBString(sheerColor(parseColor(strokeStyle), alphaMultiplier));

        drawLineForSet(set, strokeStyle, 0, fillStyle, offset);
      }

      if (opts.cap) {
        drawCapsForSet(set, opts.cap, strokeStyle, ctx.lineWidth);
      }
    }
  }

  // Render a bar chart
  function renderBarChart() {
    var i, j, p, a, x, y, w, h, len;

    if (opts.orient === "horiz") {
      rotate();
    }

    drawAxis();

    ctx.lineWidth = opts.stroke || 1;
    ctx.lineJoin = "miter";

    len = sets[0].length;

    // TODO fix right pad
    for (i = 0; i < sets.length; i++) {
      for (j = 0; j < len; j++) {
        p = 1;
        a = rotated ? height : width;
        w = ((a / len) / sets.length) - ((p / sets.length) * i) - 1;
        x = (p / 2) + getXForIndex(j, len + 1) + (w * i) + 1;
        y = getYForValue(sets[i][j]);
        h = y - getYForValue(0) || 1;

        if (isStacked()) {
          // TODO account for negative and positive values in same stack
          w = (a / len) - 2;
          x = getXForIndex(j, len + 1);
          y = getYForValue(sumY(sets.slice(0, i + 1), j));
        }

        drawRect(colorOf(i), x, y, w, h);
      }
    }
  }

  // Render a pie chart
  function renderPieChart() {
    var i, x, y, r, a1, a2, set, sum;

    x = width / 2;
    y = height / 2;
    r = Math.min(x, y) - 2;
    a1 = 1.5 * Math.PI;
    a2 = 0;
    set = sets[0];
    sum = sumSet(set);

    for (i = 0; i < set.length; i++) {
      ctx.fillStyle = colorOf(i);
      ctx.beginPath();
      a2 = a1 + (set[i] / sum) * (2 * Math.PI);

      // TODO opts.wedge
      ctx.arc(x, y, r, a1, a2, false);
      ctx.lineTo(x, y);
      ctx.fill();
      a1 = a2;
    }
  }

  // Render or re-render the chart for the given element
  function init(elem) {
    if (win.devicePixelRatio > 1) {
      if (!elem.__resized) {
        elem.style.width = elem.width + "px";
        elem.style.height = elem.height + "px";
        elem.width = 2 * elem.width;
        elem.height = 2 * elem.height;
        elem.__resized = true;
      }
    }

    type = parseAttr(elem, "data-type")[0];
    sets = parseSets(elem.getAttribute("data-sets"));
    opts = parseOpts(elem);
    ctx = elem.getContext("2d");
    width = elem.width;
    height = elem.height;
    colors = themes[opts.theme] || parseAttr(elem, "data-colors") || themes.basic;
    range = parseAttr(elem, "data-range") || getRange(sets, isStacked());
    rotated = false;

    // erase
    elem.width = elem.width;

    // set background color
    if (opts.bgcolor) {
      drawRect(opts.bgcolor || "#fff", 0, 0, width, -height);
    }

    try {
      renderers[type](ctx, width, height, sets, opts);
    }
    catch (e) {
      console.error(e.message);
    }
  }

  // The API
  Chartlets = {
    // Render charts for an array of elements, or render all elements with class "chartlet"
    render: function (elems) {
      var i;

      if (!elems) {
        elems = document.querySelectorAll(".chartlet");
      }

      for (i = 0; i < elems.length; i++) {
        init(elems[i]);
      }
    },

    // Set a color theme. e.g. setTheme("disco", ["#123", "#456", "#789"])
    setTheme: function (name, palette) {
      themes[name] = palette;
    },

    // Get a color theme as an array of strings
    getTheme: function (name) {
      return name ? themes[name] : colors;
    },

    setRenderer: function (type, renderer) {
      renderers[type] = renderer;
    },

    // Update data sets for the given element (or ID)
    update: function (elem, sets, options) {
      if (typeof elem === "string") {
        elem = document.getElementById(elem);
      }

      if (options && options.transition === "linear") {
        new Transition(elem, parseSets(elem.getAttribute("data-sets")), sets);
        return;
      }

      elem.setAttribute("data-sets", JSON.stringify(sets));

      this.render([elem]);
    }
  };

  win.Chartlets = Chartlets;

}(window));
