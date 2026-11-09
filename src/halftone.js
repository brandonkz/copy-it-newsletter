/* Halftone reveal adapted from React Bits Halftone Reveal
   https://reactbits.dev/c/animations/halftone-reveal
   MIT License with Commons Clause. */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var roots = document.querySelectorAll("[data-halftone]");
  if (!roots.length) return;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  roots.forEach(function (root) {
    var img = root.querySelector("img");
    if (!img) return;
    if (img.complete && img.naturalWidth) mount(root, img);
    else img.addEventListener("load", function () { mount(root, img); });
  });

  function mount(root, img) {
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    root.classList.add("is-halftone");
    root.appendChild(canvas);
    var rect = root.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width));
    var height = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var sample = document.createElement("canvas");
    sample.width = width;
    sample.height = height;
    var sampleCtx = sample.getContext("2d", { willReadFrequently: true });
    sampleCtx.drawImage(img, 0, 0, width, height);
    var pixels = sampleCtx.getImageData(0, 0, width, height).data;
    var gap = width < 96 ? 4 : 6;
    var dots = [];
    for (var y = gap / 2; y < height; y += gap) {
      for (var x = gap / 2; x < width; x += gap) {
        var index = (Math.floor(y) * width + Math.floor(x)) * 4;
        var luminance = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
        dots.push({ x: x, y: y, dark: 1 - luminance });
      }
    }

    var pointer = { x: width / 2, y: height / 2, reveal: 0 };

    function paint() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#F7F5EE";
      ctx.fillRect(0, 0, width, height);
      if (pointer.reveal > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, pointer.reveal, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
      }
      ctx.fillStyle = "#0F3D2E";
      for (var i = 0; i < dots.length; i++) {
        var dot = dots[i];
        var dx = dot.x - pointer.x;
        var dy = dot.y - pointer.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var influence = pointer.reveal > 0 ? Math.max(0, 1 - distance / (pointer.reveal + gap)) : 0;
        if (influence > 0.9) continue;
        var radius = Math.max(0.45, dot.dark * gap * 0.46) + influence * gap * 0.5;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    paint();

    if (finePointer) {
      root.addEventListener("pointermove", function (event) {
        var bounds = canvas.getBoundingClientRect();
        pointer.x = event.clientX - bounds.left;
        pointer.y = event.clientY - bounds.top;
        pointer.reveal = Math.max(width, height) * 0.34;
        paint();
      });
      root.addEventListener("pointerleave", function () {
        pointer.reveal = 0;
        paint();
      });
      return;
    }

    if (!("IntersectionObserver" in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      var ratio = entries[0].intersectionRatio;
      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.reveal = ratio * Math.hypot(width, height);
      paint();
    }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
    observer.observe(root);
  }
})();
