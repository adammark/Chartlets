/*
  Chartlets v0.9: http://github.com/adammark/Chartlets
  MIT License
  (c) 2013 Adam Mark
*/
(function (doc) {
  var type, ctx, width, height, rotated, range, sets, opts, colors, themes, renderers;

  type = null;
  ctx = null;
  width = 0;
  height = 0;
  rotated = false;
  range = [0, 0];
  sets = [];
  opts = {};
  themes = {
    // TODO
    "basic":   ["#7EB5D6", "#2A75A9", "#274257", "#DFC184", "#8F6048", "#644436"],
    "fire":    ["#ed1c24", "#000000", "#000000", "#000000", "#000000", "#000000"],
    "ice":     ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    "disco":   ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    "blues":   ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    "bubbles": ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    "beach":   ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    "night":   ["#000000", "#000000", "#000000", "#000000", "#000000", "#000000"],
    "circus":  ["#e31a1c", "#377eb8", "#4daf4a", "#9351a4", "#ff7f00", "#ffd92f"],
    "money":   ["#009B6D", "#89D168", "#55C2A2", "#D3EB87", "#666", "#999"],
    "todo":    ["#111", "#333", "#555", "#777", "#999", "#aaa"]
  };

  function parseAttr(elem, attr) {
    var val = elem.getAttribute(attr);

    return val ? val.replace(/, +/g, ",").split(/ +/g) : null;
  }

  function parseOpts(elem) {
    var pairs, pair, opts, i;

    pairs = parseAttr(elem, "data-opts");
    opts = {};

    for (i in pairs) {
      if (pairs.hasOwnProperty(i)) {
        pair = pairs[i].split(":");
        opts[pair[0]] = pair[1];
      }
    }

    return opts;
  }

  function parseVals(vals) {
    var sets = vals.match(/\[[^\[]+\]/g) || [], i;

    for (i = 0; i < sets.length; i++) {
      sets[i] = sets[i].match(/[-\d\.,]+/g);
    }

    return sets;
  }

  function isStacked() {
    return opts.transform === "stack";
  }

  function isFilled() {
    return opts.fill !== undefined;
  }

  function getRange(sets, stacked) {
    return stacked ? computeStackRange(sets) : computeRange(sets);
  }

  function computeRange(sets) {
    var arr = Array.prototype.concat.apply([], sets);

    if (type === "bar" || isStacked()) {
      arr.push(0);
    }

    return [Math.min.apply(null, arr), Math.max.apply(null, arr)];
  }

  function computeStackRange(sets) {
    return computeRange(mergeSets(sets).concat(sets));
  }

  function parseColor(str) {
    var color = {
      r: 0,
      g: 0,
      b: 0,
      a: 1
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

  function parseRGB(str) {
    var c = str.match(/[\d\.]+/g);

    return {
      r: +c[0],
      g: +c[1],
      b: +c[2],
      a: +c[3] || 1
    };
  }

  function parseHex(str) {
    var c = str.match(/\w/g),
        n;

    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }

    n = +("0x" + c.join(""));

    return {
      r: (n & 0xFF0000) >> 16,
      g: (n & 0x00FF00) >> 8,
      b: (n & 0x0000FF),
      a: 1
    };
  }

  // http://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
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
      r: r * 255,
      g: g * 255,
      b: b * 255,
      a: a
    };
  }

  function sheerColor(color, alpha) {
    color.a *= alpha;

    return color;
  }

  function toRGBString(color) {
    return "rgba(" + [
      Math.round(color.r),
      Math.round(color.g),
      Math.round(color.b),
      color.a
    ].join(",") + ")";
  }

  function rotate() {
    rotated = true;
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);    
  }

  function getXStep(len) {
    return (rotated ? height : width) / (len - 1);
  }

  function getXForIndex(idx, len) {
    return idx * getXStep(len);
  }

  function getYForValue(val) {
    var n = rotated ? width : height;

    return n - (n * ((val - range[0]) / (range[1] - range[0])));
  }

  function sumSet(set) {
    var i, n = 0;

    for (i = 0; i < set.length; i++) {
      n += +set[i];
    }

    return n;
  }

  function sumY(sets, idx) {
    var i, n = 0;

    for (i = 0; i < sets.length; i++) {
      n += +sets[i][idx];
    }

    return n;
  }

  function mergeSets(sets) {
    var i, set = [];

    for (i = 0; i < sets[0].length; i++) {
      set.push(sumY(sets, i));
    }

    return set;
  }

  function getColorForIndex(idx) {
    return colors[idx] || "#000";
  }

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

  function drawLineSegment(set, i, x, y, step, shape) {
    var cx, cy;

    if (shape === "smooth") {
      cx = getXForIndex(i - 0.5, set.length);
      cy = getYForValue(set[i - 1]);
      ctx.bezierCurveTo(cx, cy, cx, y, x, y);
    }
    else {
      if (shape === "step") {
        ctx.lineTo(x - (step / 2), getYForValue(set[i - 1]));
        ctx.lineTo(x - (step / 2), y);
      }
      ctx.lineTo(x, y);
    }
  }

  function drawCapsForSet(set, capStyle, fillStyle, lineWidth) {
    var i = -1, x, y, w;

    while (++i < set.length) {
      x = getXForIndex(i, set.length);
      y = getYForValue(set[i]);

      if (capStyle === "square") {
        w = Math.max(2, lineWidth) * 2.5;
        drawRect(x - (w / 2), y + (w / 2), w, w, fillStyle);
      }
      else {
        w = lineWidth + 1;
        drawCircle(fillStyle, null, x, y, w);
      }
    }
  }

  function drawCircle(fillStyle, strokeStyle, x, y, r) {
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.beginPath();
    ctx.arc(x, y, r, 2 * Math.PI, false);
    ctx.fill();

    if (strokeStyle) {
      ctx.stroke();
    }
  }

  function drawRect(x, y, w, h, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y - h, w, h);
  }

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

  function draw(elem) {
    type = parseAttr(elem, "data-type")[0];
    opts = parseOpts(elem);
    ctx = elem.getContext("2d");
    width = elem.width;
    height = elem.height;
    colors = themes[opts.theme] || parseAttr(elem, "data-colors") || themes.basic;
    sets = parseVals(elem.getAttribute("data-sets"));
    range = parseAttr(elem, "data-range") || getRange(sets, isStacked());
    rotated = false;

    // erase
    elem.width = elem.width;

    // set background color
    drawRect(0, 0, width, -height, opts.bgcolor || "white");

    try {
      renderers[type].call();
    }
    catch (e) {
      console.error(e.message);
    }
  }

  function interpolate(a, b, idx, len) {
    return +a + ((+b - +a) * (idx / len));
  }

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

  function interpolateSets(a, b, n) {
    var i, c = [];

    for (i = 0; i < a.length; i++) {
      c.push(interpolateSet(a[i], b[i], n));
    }

    return c;
  }

  function Transition(id, asets, bsets) {
    var interpolated = interpolateSets(asets, bsets, 10);
    var i = 0;
    var j = 0;
    var set;

    if (!asets.length) {
      return Chartlets.update(id, bsets);
    }

    var interval = setInterval(function() {
      set = [];

      for (j = 0; j < interpolated.length; j++) {
        set.push(interpolated[j][i]);
      }

      Chartlets.update(id, set);

      if (++i === set[0].length) {
        clearInterval(interval);
      }
    }, 20);
  }

  renderers = {
    line: function () {
      var i, set, strokeStyle, fillStyle, alphaMultiplier, offset;

      drawAxis();

      for (i = 0; i < sets.length; i++) {
        set = sets[i];
        strokeStyle = getColorForIndex(i);

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
    },

    bar: function () {
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

          drawRect(x, y, w, h, getColorForIndex(i));
        }
      }
    },

    pie: function () {
      var i, x, y, r, a1, a2, set, sum;

      i = 0;
      x = width / 2;
      y = height / 2;
      r = Math.min(x, y) - 2;
      a1 = 1.5 * Math.PI;
      a2 = 0;
      set = sets[0];
      sum = sumSet(set);

      ctx.lineWidth = 1.5;

      // TODO opts.sort none|up|down
      for (i = 0; i < set.length; i++) {
        ctx.fillStyle = getColorForIndex(i);
        ctx.beginPath();
        a2 = a1 + (set[i] / sum) * (2 * Math.PI);

        // TODO opts.wedge
        ctx.arc(x, y, r, a1, a2, false);
        ctx.lineTo(x, y);
        ctx.fill();
        a1 = a2;
      }
    }

  };

  window.Chartlets = {
    render: function (elems) {
      var i;

      if (!elems) {
        elems = [].slice.call(doc.getElementsByClassName("chartlet"));
      }

      for (i = 0; i < elems.length; i++) {
        draw(elems[i]);
      }
    },

    setTheme: function (name, palette) {
      themes[name] = palette;
    },

    getTheme: function (name) {
      return themes[name];
    },

    update: function (id, _sets, options) {
      var elem = document.getElementById(id);

      function _render() {
        var i, a = [];

        for (i = 0; i < _sets.length; i++) {
          a.push(_sets[i].join(" "));
        }

        elem.setAttribute("data-sets", "[" + a.join("] [") + "]");

        Chartlets.render([elem]);
      }

      if (options && options.animate) {
        return new Transition(id, parseVals(elem.getAttribute("data-sets")), _sets);
      }

      _render();
    }
  };

}(document));
