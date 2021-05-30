  'use strict';

  function init() {
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    const app = new PIXI.Application(
      {
        view: document.querySelector("#canvas"),
        autoResize: true
      }
    );

    var curOnTexX = 0;
    var curOnTexY = 0;

    // Load base map as buffer
    var bmImageData;
    var bmPath = './f2152.png';
    var bmImage = new Image();
    bmImage.onload = function () {
      let tempCanvas = document.createElement("CANVAS");;
      tempCanvas.width = bmImage.width;
      tempCanvas.height = bmImage.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(bmImage, 0, 0);
      bmImageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

      let texture = PIXI.Texture.fromBuffer(bmImageData.data, bmImage.width, bmImage.height);
      depthMapImage.texture = texture;
      depthMapImage2.texture = texture;
      needUpdateReverseMapBuffer = true;

      window.displacementFilter.uniforms.textureWidth = bmImage.width;
      window.displacementFilter.uniforms.textureHeight = bmImage.height;
      window.displacementFilter.uniforms.textureSize = [bmImage.width, bmImage.height];
      window.displacementFilter.uniforms.textureScale = 1.0;
    }
    bmImage.src = bmPath;


    // Load depth map as buffer
    let dmCanvas;
    let dmCtx;
    var dmPath = './f2152_depth.png';
    var dmImage = new Image();
    let dmTexture = PIXI.Texture.EMPTY;
    dmImage.onload = function () {
      dmCanvas = document.createElement("CANVAS");
      dmCanvas.width = dmImage.width;
      dmCanvas.height = dmImage.height;
      dmCtx = dmCanvas.getContext('2d');
      dmCtx.globalCompositeOperation = 'source-over';
      dmCtx.globalAlpha = 1;
      dmCtx.drawImage(dmImage, 0, 0);

      dmTexture = PIXI.Texture.from(dmCanvas);
      window.displacementFilter.uniforms.displacementMap = dmTexture;
      window.offsetFilter.uniforms.displacementMap = dmTexture;
    }
    dmImage.src = dmPath;



    var reverseMapBuffer;
    var needUpdateReverseMapBuffer = true;

    PIXI.DepthPerspectiveFilter = new PIXI.Filter(null, frag, { displacementMap: PIXI.Texture.EMPTY });
    PIXI.DepthPerspectiveOffsetFilter = new PIXI.Filter(null, frag, { displacementMap: PIXI.Texture.EMPTY });
    PIXI.DepthPerspectiveFilter.apply = function (filterManager, input, output) {
      this.uniforms.dimensions = {};
      if (input && input.width && input.height) {
        this.uniforms.frameWidth = input.width;
        this.uniforms.frameHeight = input.height;
      }

      this.uniforms.canvasSize = {};
      this.uniforms.canvasSize[0] = app.renderer.width;
      this.uniforms.canvasSize[1] = app.renderer.height;

      // draw the filter...
      filterManager.applyFilter(this, input, output);
    }

    PIXI.DepthPerspectiveOffsetFilter.apply = function (filterManager, input, output) {
      if (window.displacementFilter && window.displacementFilter.uniforms) {
        this.uniforms.frameWidth = window.displacementFilter.uniforms.frameWidth;
        this.uniforms.frameHeight = window.displacementFilter.uniforms.frameHeight;
        this.uniforms.canvasSize = [app.renderer.width, app.renderer.height];

        this.uniforms.textureScale = window.displacementFilter.uniforms.textureScale;
        this.padding = window.displacementFilter.padding;

        this.uniforms.pan = window.displacementFilter.uniforms.pan;
        this.uniforms.scale = window.displacementFilter.uniforms.scale;
        this.uniforms.focus = window.displacementFilter.uniforms.focus;
        this.uniforms.offset = window.displacementFilter.uniforms.offset;

        this.uniforms.zoom = window.displacementFilter.uniforms.zoom;

        this.uniforms.textureWidth = window.displacementFilter.uniforms.textureWidth;
        this.uniforms.textureHeight = window.displacementFilter.uniforms.textureHeight;
        this.uniforms.textureSize = [this.uniforms.textureWidth, this.uniforms.textureHeight];
        this.uniforms.textureScale = window.displacementFilter.uniforms.textureScale;
      }
      this.uniforms.displayMode = 3;

      // draw the filter...
      filterManager.applyFilter(this, input, output);
    }

    var depthMapImage = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    var depthMapImage2 = new PIXI.Sprite.from(PIXI.Texture.EMPTY);

    window.displacementFilter = PIXI.DepthPerspectiveFilter;
    window.displacementFilter.uniforms.textureScale = 1.0;
    window.displacementFilter.padding = 0;

    window.displacementFilter.uniforms.pan = [0.0, 0.0];
    window.displacementFilter.uniforms.scale = 1.0;
    window.displacementFilter.uniforms.focus = 0.5;
    window.displacementFilter.uniforms.offset = [0.0, 0.0];

    window.displacementFilter.uniforms.displayMode = 2;


    var container = new PIXI.Container();
    var bunnyReverse = new PIXI.Sprite(PIXI.Texture.WHITE);
    bunnyReverse.anchor.set(0.5);
    container.filters = [window.displacementFilter];
    container.addChild(depthMapImage);



    window.offsetFilter = PIXI.DepthPerspectiveOffsetFilter;

    var containerReverseMap = new PIXI.Container();
    container.addChild(bunnyReverse);
    containerReverseMap.filters = [window.offsetFilter];
    containerReverseMap.addChild(depthMapImage2);



    app.stage.addChild(containerReverseMap);
    app.stage.addChild(container);


    var tiltX;
    var tiltY;
    var isTilting = false;

    var panX;
    var panY;
    var isPanning = false;

    var isDrawing = false;

    let r, g, b, a;
    $('#canvas').bind('mousedown', function (event) {
      switch (event.button) {
        case 2:
          tiltX = app.renderer.plugins.interaction.mouse.global.x;
          tiltY = app.renderer.plugins.interaction.mouse.global.y;
          console.log('case 1:!');
          isTilting = true;
          break;
        case 1:
          panX = app.renderer.plugins.interaction.mouse.global.x;
          panY = app.renderer.plugins.interaction.mouse.global.y;
          console.log('case 2:!');
          isPanning = true;
          return false;
        case 0:
          startDrawing();
          break;
      }
    }
    );

    $('#canvas').bind('mouseup', function (event) {
      switch (event.button) {
        case 2:
          isTilting = false;
          break;
        case 1:
          isPanning = false;
          break;
        case 0:
          endDrawing();
          break;
      }
    }
    );

    window.displacementFilter.uniforms.zoom = 1.0;
    $('#canvas').bind('mousewheel', function (e) {
      
      needUpdateReverseMapBuffer = true;

      if (e.originalEvent.wheelDelta / 120 > 0) {
        if (window.displacementFilter.uniforms.zoom < 30.0) {
          window.displacementFilter.uniforms.zoom *= 1.1;

          let mx = app.renderer.plugins.interaction.mouse.global.x - app.renderer.width / 2.0;
          window.displacementFilter.uniforms.pan[0] += mx;
          window.displacementFilter.uniforms.pan[0] *= 1.1;
          window.displacementFilter.uniforms.pan[0] -= mx;

          let my = app.renderer.plugins.interaction.mouse.global.y - app.renderer.height / 2.0;
          window.displacementFilter.uniforms.pan[1] += my;
          window.displacementFilter.uniforms.pan[1] *= 1.1;
          window.displacementFilter.uniforms.pan[1] -= my;

        }
      }
      else {
        window.displacementFilter.uniforms.zoom /= 1.1;

        let mx = app.renderer.plugins.interaction.mouse.global.x - app.renderer.width / 2.0;
        window.displacementFilter.uniforms.pan[0] += mx;
        window.displacementFilter.uniforms.pan[0] /= 1.1;
        window.displacementFilter.uniforms.pan[0] -= mx;

        let my = app.renderer.plugins.interaction.mouse.global.y - app.renderer.height / 2.0;
        window.displacementFilter.uniforms.pan[1] += my;
        window.displacementFilter.uniforms.pan[1] /= 1.1;
        window.displacementFilter.uniforms.pan[1] -= my;
      }
    }
    );

    var endx = 0;
    var endy = 0;
    function step(timestamp) {
      if (depthMapImage && depthMapImage.texture && app.renderer.view.style) {

        if ((isPanning || isTilting || isDrawing) && (endx != app.renderer.plugins.interaction.mouse.global.x || endy != app.renderer.plugins.interaction.mouse.global.y)) {
          needUpdateReverseMapBuffer = true;
        }
        endx = app.renderer.plugins.interaction.mouse.global.x;
        endy = app.renderer.plugins.interaction.mouse.global.y;

        if (isTilting) {
          var radius = Math.min(app.renderer.width, app.renderer.height);
          window.displacementFilter.uniforms.offset[0] -= ((endx - tiltX) / radius * 2);
          window.displacementFilter.uniforms.offset[1] += ((endy - tiltY) / radius * 2);

          var xy = Math.sqrt(window.displacementFilter.uniforms.offset[0] * window.displacementFilter.uniforms.offset[0] + window.displacementFilter.uniforms.offset[1] * window.displacementFilter.uniforms.offset[1]);
          if (xy / 0.5 > 1) {
            window.displacementFilter.uniforms.offset[0] /= xy / 0.5;
            window.displacementFilter.uniforms.offset[1] /= xy / 0.5;
          }

          tiltX = endx;
          tiltY = endy;
        }

        if (isPanning) {
          window.displacementFilter.uniforms.pan[0] -= ((endx - panX));
          window.displacementFilter.uniforms.pan[1] -= ((endy - panY));

          panX = endx;
          panY = endy;
        }

        handleMouseMove();

      }


      if (needUpdateReverseMapBuffer) {
        needUpdateReverseMapBuffer = false;
        reverseMapBuffer = extractPixelsWithoutPostmultiply(containerReverseMap);
      }

      if (window.displacementFilter.uniforms && window.displacementFilter.uniforms.canvasSize && window.displacementFilter.uniforms.textureSize) {
        r = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4];
        g = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4 + 1];
        b = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4 + 2];
        a = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4 + 3];





        var zoom = window.displacementFilter.uniforms.zoom;
        var fit = Math.min(window.displacementFilter.uniforms.canvasSize[0] / window.displacementFilter.uniforms.textureSize[0],
          window.displacementFilter.uniforms.canvasSize[1] / window.displacementFilter.uniforms.textureSize[1]);
        let mouseX = (app.renderer.plugins.interaction.mouse.global.x - window.displacementFilter.uniforms.canvasSize[0] / 2 + window.displacementFilter.uniforms.textureSize[0] / 2 * zoom * fit);
        mouseX += window.displacementFilter.uniforms.pan[0];
        mouseX = mouseX / zoom / fit;
        curOnTexX = mouseX + ((r - 128. + (b - 128.) / 256.) / 256.) * window.displacementFilter.uniforms.textureSize[0];

        let mouseY = (app.renderer.plugins.interaction.mouse.global.y - window.displacementFilter.uniforms.canvasSize[1] / 2 + window.displacementFilter.uniforms.textureSize[1] / 2 * zoom * fit);
        mouseY += window.displacementFilter.uniforms.pan[1];
        mouseY = mouseY / zoom / fit;
        curOnTexY = mouseY + ((g - 128. + (a - 128.) / 256.) / 256.) * window.displacementFilter.uniforms.textureSize[1];

        bunnyReverse.x = curOnTexX / window.displacementFilter.uniforms.textureSize[0] * window.displacementFilter.uniforms.canvasSize[0];
        bunnyReverse.y = curOnTexY / window.displacementFilter.uniforms.textureSize[1] * window.displacementFilter.uniforms.canvasSize[1];
      }

      window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);

    // Listen for window resize events
    window.addEventListener('resize', resize);

    // Resize function window
    function resize() {
      // Resize the renderer
      const parent = app.view.parentNode;
      app.renderer.resize(parent.clientWidth, parent.clientHeight);

      depthMapImage.width = app.renderer.screen.width;
      depthMapImage.height = app.renderer.screen.height;

      depthMapImage2.width = app.renderer.screen.width;
      depthMapImage2.height = app.renderer.screen.height;
    }

    resize();

    function changeDisplayMode(mode) {
      switch (mode) {
        case "basicTextureMode":
          window.displacementFilter.uniforms.displayMode = 0;
          break;
        case "normalMapMode":
          window.displacementFilter.uniforms.displayMode = 1;
          break;
        case "mixedMode":
          window.displacementFilter.uniforms.displayMode = 2;
      }
    }


    function startDrawing() {
      if (strokes.length == 0 || strokes[strokes.length - 1].path == null || strokes[strokes.length - 1].path.length > 0) {
        strokes.push({ path: [] });
      }
      strokes[strokes.length - 1].r1 = parseInt(document.getElementById('brush-inner-radius-slider').value);
      strokes[strokes.length - 1].r2 = parseInt(document.getElementById('brush-outer-radius-slider').value);
      isDrawing = true;
    }

    function endDrawing() {
      isDrawing = false;
      updateCache();
    }

    let strokes = [];

    let cacheBaseMap; // The image of a stage, reducing the need to drawing old history brush repeatedly
    let cacheCtx;
    let cacheBaseMapHistoryIndex = -1; // The history index of the cache

    // Call me when a new history change is confirmed (i.e. mouse up)
    function updateCache() {
      if (!cacheBaseMap || cacheBaseMap.width != dmCanvas.width || cacheBaseMap.height != dmCanvas.height) {
        cacheBaseMap = new OffscreenCanvas(dmCanvas.width, dmCanvas.height);
        cacheCtx = cacheBaseMap.getContext('2d');
      }
      cacheCtx.fillStyle = 'white';
      cacheCtx.fillRect(0, 0, dmCanvas.width, dmCanvas.height);
      cacheCtx.drawImage(dmCanvas, 0, 0);
      cacheBaseMapHistoryIndex = strokes.length -1;
    }

    function handleMouseMove() {
      let currentPoint = { x: Math.round(curOnTexX), y: Math.round(curOnTexY) };
      let currentStroke = strokes[strokes.length - 1];
      if (isDrawing && +
        (currentStroke.path.length == 0 ||
          currentPoint.x != currentStroke.path[currentStroke.path.length - 1].x ||
          currentPoint.y != currentStroke.path[currentStroke.path.length - 1].y)) {
        // It is the first point or new point
        currentStroke.path.push(currentPoint);

        redraw()
      }
    }

    function redraw() {
      let cacheValid = cacheBaseMap != null && cacheBaseMapHistoryIndex < strokes.length;

      // Draw the base image
      dmCtx.globalAlpha = 1;
      dmCtx.globalCompositeOperation = 'source-over';
      if (cacheValid) {
        dmCtx.drawImage(cacheBaseMap, 0, 0);
      } else {
        // Start over from the first history
        dmCtx.drawImage(dmImage, 0, 0);
      }

      updateMaskCanvas();

      // Draw all steps
      for (let i = cacheValid ? cacheBaseMapHistoryIndex + 1 : 0; i < strokes.length; i++) {
        drawSmoothLine(strokes[i].path, strokes[i].r1, strokes[i].r2, 1, false)
      }

      drawCurrentMask();
  
      dmTexture.update();
    }

    function drawSmoothLine(path, innerRadius, outerRadius, value, isAbsolute) {
      let depth;
      if (!isAbsolute) {
        if (value < 0) {
          // Darken delta brush = invert then lighter brush then invert
          invert();
          drawSmoothLine(path, innerRadius, outerRadius, -value, isAbsolute)
          invert();
          return;
        } else {
          dmCtx.globalAlpha = value * 1. / 256;
          depth = 255;
          dmCtx.globalCompositeOperation = 'lighter';
        }
      } else {
        dmCtx.globalAlpha = 1;
        depth = value;
        dmCtx.globalCompositeOperation = 'source-over';
      }

      let alphaSum = 0; // 0.1
      for (let i = innerRadius + outerRadius + 1; i > innerRadius + 1; i--) {

        let targetAlpha = (outerRadius - i + innerRadius + 1) * 1. / outerRadius * dmCtx.globalAlpha; // 0.2
        let alphaNeeded = (targetAlpha - alphaSum) / (1 - alphaSum) / dmCtx.globalAlpha;
        // Drawing threshold
        // if the alpha is too low, the canvas will not be able to result any change
        if (alphaNeeded * dmCtx.globalAlpha >= 1. / 256 / 2) {
          drawFlatLine(path, i, depth, alphaNeeded);
          alphaSum = targetAlpha;
        }
      }

      // Draw the solid center part
      if (innerRadius + outerRadius != 0) {
        let alphaNeeded = (dmCtx.globalAlpha - alphaSum) / (1 - alphaSum) / dmCtx.globalAlpha;
        drawFlatLine(path, innerRadius, depth, alphaNeeded);
      }
    }


    let maskCanvas;
    let currentMasks = 65535; // 1111 1111 1111 1111 in binary
    // Call this when the mask data changed 
    // or user select another set of masks
    function updateMaskCanvas() {
      if (document.getElementById('mask-select-all').checked) {
        currentMasks = 65535;
        return; // For select-all mask -> dont need to build the mask area
      }
      let newMasks = 0;
      for (var i = 0; i < 8; i++) {
        var checkbox = document.getElementById('mask-' + i);
        newMasks = (newMasks << 1) + (checkbox.checked ? 1 : 0);
      }
      newMasks = newMasks << 8;
      if (currentMasks == newMasks) {
        // Mask selection not updated
        return;
      } else {
        currentMasks = newMasks;
      }

      maskCanvas = new OffscreenCanvas(dmCanvas.width, dmCanvas.height);
      let maskCtx = maskCanvas.getContext('2d');
      let dmData = dmCtx.getImageData(0, 0, dmCanvas.width, dmCanvas.height);
      var buf = new ArrayBuffer(dmData.data.length);
      var dmdd = dmData.data;
      var buf8 = new Uint8ClampedArray(buf);


      for (var i = 0; i < dmdd.length; i++) {
        buf8[i] = dmdd[i]; // r
        buf8[++i] = dmdd[i]; // g
        let masks = (dmdd[i] << 8) + dmdd[++i]; // g + b channels are storing the mask data
        buf8[i] = dmdd[i]; // b
        buf8[++i] = (masks & currentMasks) > 0 ? 0 : 255 ; // a, if it match any given mask, opacity set to 1
      }
      
      dmData.data.set(buf8);
      maskCtx.putImageData(dmData, 0, 0);
    }


    function drawCurrentMask() {
      if (maskCanvas && currentMasks != 65535) {
        // Draw the original image on the masked area
        // Leaving the changes only on the unmasked area
        dmCtx.globalCompositeOperation = 'source-over';
        dmCtx.globalAlpha = 1;
        dmCtx.drawImage(maskCanvas, 0, 0);
      }
    }


    function invert() {
      dmCtx.globalAlpha = 1;
      dmCtx.globalCompositeOperation = 'difference';
      dmCtx.fillStyle = 'white';
      dmCtx.fillRect(0, 0, dmCanvas.width, dmCanvas.height);
    }

    function drawFlatLine(path, radius, depth, alpha) {
      dmCtx.beginPath();
      dmCtx.lineWidth = radius * 2. - 1.;
      dmCtx.lineCap = "round";
      dmCtx.lineJoin = "round";
      dmCtx.strokeStyle = "rgba(" + depth + "," + 0 + "," + 0 + "," + alpha + ")";
      dmCtx.moveTo(path[0].x, path[0].y);

      for (let index = 0; index < path.length; ++index) {
        let point = path[index];
        dmCtx.lineTo(point.x, point.y);
      }
      dmCtx.stroke();
    }


    // Function to perform app.renderer.extract.pixels in V5 without Postmultiply alpha channel 
    function extractPixelsWithoutPostmultiply(target) {
      let BYTES_PER_PIXEL = 4;
      const renderer = app.renderer;
      let resolution;
      let frame;
      let renderTexture;
      let generated = false;

      if (target) {
        if (target instanceof PIXI.RenderTexture) {
          renderTexture = target;
        }
        else {
          renderTexture = renderer.generateTexture(target);
          generated = true;
        }
      }

      if (renderTexture) {
        resolution = renderTexture.baseTexture.resolution;
        frame = renderTexture.frame;

        // bind the buffer
        renderer.renderTexture.bind(renderTexture);
      }
      else {
        resolution = renderer.resolution;

        frame = TEMP_RECT;
        frame.width = renderer.width;
        frame.height = renderer.height;

        renderer.renderTexture.bind(null);
      }

      const width = frame.width * resolution;
      const height = frame.height * resolution;

      const webglPixels = new Uint8Array(BYTES_PER_PIXEL * width * height);

      // read pixels to the array
      const gl = renderer.gl;

      gl.readPixels(
        frame.x * resolution,
        frame.y * resolution,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        webglPixels
      );

      if (generated) {
        renderTexture.destroy(true);
      }

      return webglPixels;
    }


    // document.getElementById('file-download-button');

    document.getElementById('mask-select-all').onclick = function() {
      var checkboxes = document.getElementsByName('mask-checkbox');
      for (var checkbox of checkboxes) {
        checkbox.checked = this.checked;
      }
    }
    
  }


var frag =
  `precision mediump float;
uniform vec2 offset;
uniform vec2 pan;
uniform float zoom;
uniform int displayMode;

uniform sampler2D uSampler;
uniform sampler2D displacementMap;

uniform float textureScale;
uniform vec2 textureSize;
uniform float textureWidth;
uniform float textureHeight;
uniform float frameWidth;
uniform float frameHeight;
uniform vec2 canvasSize;

uniform vec4 filterArea;
uniform vec4 filterClamp;


varying vec2 vTextureCoord;
varying vec4 vColor;
uniform vec4 dimensions;
uniform vec2 mapDimensions;
uniform float scale;
uniform float focus;


vec2 mapPan(vec2 coord)
{
    return vec2((coord[0]  + pan[0] / textureWidth / textureScale) / zoom,
                (coord[1] + pan[1] / textureHeight / textureScale) / zoom);
}

vec2 mapCoord2(vec2 coord)
{
    return vec2(coord[0] * frameWidth / textureWidth / textureScale,
                coord[1] * frameHeight / textureHeight / textureScale);
}


vec4 textureDiffuseNoBg(vec2 coord)
{
    vec2 c = coord;
    vec2 scale = textureSize * ( min(canvasSize[0] / textureSize[0], canvasSize[1] / textureSize[1]) );

    c -= 0.5;                   // Normalize
    c = c * canvasSize + pan;   // Convert to pixel count, where origin is the center
    c /= scale;

    c /= zoom;
    c += 0.5;                   // Unnormalize


    if (c[0] <= 0.0 || c[0] >= 1.0 || c[1] <= 0.0 || c[1] >= 1.0)
    {
        return vec4(0.0);
    }
    else
    {
        return texture2D(uSampler, c);
    }
}


vec2 textureDiffuseCoor(vec2 coord)
{
    vec2 c = coord;
    vec2 scale = textureSize * ( min(canvasSize[0] / textureSize[0], canvasSize[1] / textureSize[1]) );

    c -= 0.5;                   // Normalize
    c = c * canvasSize + pan;   // Convert to pixel count, where origin is the center
    c /= scale;

    c /= zoom;
    c += 0.5;                   // Unnormalize

    return c;
}


vec4 textureDiffuse(vec2 coord)
{
    vec4 withoutBg = textureDiffuseNoBg(coord);

    return withoutBg * withoutBg[3] + vec4(0.5, 0.5, 1.0, 1.0) * (1.0 - withoutBg[3]);
}

vec4 textureDepth(vec2 coord)
{
    vec2 c = coord;

    vec2 scale = textureSize * ( min(canvasSize[0] / textureSize[0], canvasSize[1] / textureSize[1]) );

    c -= 0.5;                   // Normalize
    c = c * canvasSize + pan;   // Convert to pixel count, where origin is the center
    c /= scale;

    c /= zoom;
    c += 0.5;                   // Unnormalize


    // if (c[0] <= 0.0 || c[0] >= 1.0 || c[1] <= 0.0 || c[1] >= 1.0)
    // {
    //     return vec4(0.0, 0.0, 0.0, 0.0);
    // }
    return texture2D(displacementMap, c);
}

vec4 normal(vec2 coord)
{
    float fit = min(canvasSize[0] / textureSize[0], canvasSize[1] / textureSize[1]);
    vec2 lineW = vec2(0.0005 * fit * zoom, 0.0);
    vec2 lineH = vec2(0.0, 0.0005 * fit * zoom);


    float leftD = textureDepth(coord - lineW).r;
    float rightD = textureDepth(coord + lineW).r;
    float upD = textureDepth(coord - lineH).r;
    float downD = textureDepth(coord + lineH).r;

    if (textureDiffuseNoBg(coord)[3] < 1.0)
    {
        return vec4(0.5, 0.5, 1.0, 1.0);
    }

    return vec4(0.5, 0.5, 1.0, 1.0) + vec4(leftD - rightD, upD - downD, 0.0, 0.0) * 100.0  ;
}

vec4 normalMixed(vec2 coord)
{
    return textureDiffuse(coord)  - vec4(0.5, 0.5, 1.0, 1.0) + normal(coord);
}

const float compression = 1.0;
const float dmin = 0.0;
const float dmax = 1.0;

// sqrt(2)
#define MAXOFFSETLENGTH 1.41421356
// 10 * 1.1
#define MAXZOOM 11.0

#define MAXSTEPS 600.0


float fit = min(canvasSize[0] / textureSize[0], canvasSize[1] / textureSize[1]);
float steps = max(MAXSTEPS *length(offset *zoom *fit), 30.0);

void main(void)
{
    vec2 scale2 = scale * vec2(textureHeight / frameWidth,
                              textureWidth / frameHeight )
                  * vec2(1, -1);
    mat2 baseVector =
        mat2(vec2((0.5 - focus) * (offset * zoom * fit) - (offset * zoom * fit) / 2.0) * scale2,
            vec2((0.5 - focus) * (offset * zoom * fit) + (offset * zoom * fit) / 2.0) * scale2);


    vec2 pos = (vTextureCoord);
    mat2 vector = baseVector;

    float dstep = compression / (steps - 1.0);
    vec2 vstep = (vector[1] - vector[0]) / vec2((steps - 1.0));

    vec2 posSumLast = vec2(0.0);
    vec2 posSum = vec2(0.0);

    float weigth = 1.0;
    float dpos;
    float dposLast;

    for (float i = 0.0; i < MAXSTEPS * MAXOFFSETLENGTH * MAXZOOM; ++i)
    {
        vec2 vpos = pos + vector[1] - i * vstep;
        dpos = 1.0 - i * dstep;
        float depth = textureDepth(vpos).r;

        if (textureDiffuseNoBg(vpos)[3] == 0.0)
        {
            depth = 0.0;
        }

        depth = clamp(depth, dmin, dmax);

        if (dpos > depth)
        {
            posSumLast = vpos;
            dposLast = dpos;
        }
        else
        {
            posSum = vpos;
            weigth = (depth - dposLast) / dstep;
            break;
        }
    };
    vec2 coord = (posSum - posSumLast) * -clamp(weigth * 0.5 + 0.5, 0.0, 1.5) + posSum;
    if (displayMode == 0)
    {
        gl_FragColor = textureDiffuse(coord);
    }
    else if (displayMode == 1)
    {
        gl_FragColor = normal(coord);
    }
    else if (displayMode == 2)
    {
        gl_FragColor = normalMixed(coord);
    }
    else 
    {
        vec2 originCoor = (textureDiffuseCoor(coord) - textureDiffuseCoor(pos)) + 0.5;
        gl_FragColor = vec4(
          1. / 256. * floor(originCoor[0] * 256.0 + 0.5),
          1. / 256. * floor(originCoor[1] * 256.0 + 0.5),
          0.5 + 256. * (originCoor[0]  - (1. / 256. * floor(originCoor[0] * 256.0 + 0.5))), 
          0.5 + 256. * (originCoor[1]  - (1. / 256. * floor(originCoor[1] * 256.0 + 0.5))));
    }

}`;

  init();