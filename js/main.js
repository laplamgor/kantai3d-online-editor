{
  'use strict';

  function init() {
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    const app = new PIXI.Application(
      {
        view: document.querySelector("#canvas"),
        autoResize: true
      }
    );

    let curOnTexX = 0;
    let curOnTexY = 0;

    // Load base map as buffer
    let bmImageData;
    let bmPath = './f2152.png';
    let bmCanvas;
    let bmCtx;
    let bmImage = new Image();
    let bmTexture = PIXI.Texture.EMPTY;
    bmImage.onload = function () {
      bmCanvas = document.createElement("CANVAS");;
      bmCanvas.width = bmImage.width;
      bmCanvas.height = bmImage.height;
      bmCtx = bmCanvas.getContext('2d');
      bmCtx.drawImage(bmImage, 0, 0);

      bmImageData = bmCtx.getImageData(0, 0, bmCanvas.width, bmCanvas.height);

      bmTexture = PIXI.Texture.from(bmCanvas);
      depthMapImage.texture = bmTexture;
      depthMapImage2.texture = bmTexture;
      needUpdateReverseMapBuffer = true;

      window.displacementFilter.uniforms.textureWidth = bmImage.width;
      window.displacementFilter.uniforms.textureHeight = bmImage.height;
      window.displacementFilter.uniforms.textureSize = [bmImage.width, bmImage.height];
      window.displacementFilter.uniforms.textureScale = 1.0;


      refreshMaskListPanel();
    }
    bmImage.src = bmPath;


    // Load depth map as buffer
    let dmCanvas;
    let dmCtx;
    let dmPath = './f2152_depth.png';
    let dmImage = new Image();
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


      refreshMaskListPanel();
    }
    dmImage.src = dmPath;



    let reverseMapBuffer;
    let needUpdateReverseMapBuffer = true;

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

    let depthMapImage = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    let depthMapImage2 = new PIXI.Sprite.from(PIXI.Texture.EMPTY);

    window.displacementFilter = PIXI.DepthPerspectiveFilter;
    window.displacementFilter.uniforms.textureScale = 1.0;
    window.displacementFilter.padding = 0;

    window.displacementFilter.uniforms.pan = [0.0, 0.0];
    window.displacementFilter.uniforms.scale = 1.0;
    window.displacementFilter.uniforms.focus = 0.5;
    window.displacementFilter.uniforms.offset = [0.0, 0.0];

    window.displacementFilter.uniforms.displayMode = 2;


    let container = new PIXI.Container();
    let cursorSpirte = new PIXI.Sprite(PIXI.Texture.WHITE);
    cursorSpirte.anchor.set(0.5);
    container.filters = [window.displacementFilter];
    container.addChild(depthMapImage);



    window.offsetFilter = PIXI.DepthPerspectiveOffsetFilter;

    let containerReverseMap = new PIXI.Container();
    container.addChild(cursorSpirte);
    containerReverseMap.filters = [window.offsetFilter];
    containerReverseMap.addChild(depthMapImage2);



    app.stage.addChild(containerReverseMap);
    app.stage.addChild(container);


    let tiltX;
    let tiltY;
    let isTilting = false;

    let panX;
    let panY;
    let isPanning = false;

    let isDrawing = false;

    $('#canvas').bind('mousedown', function (event) {
      switch (event.button) {
        case 2:
          tiltX = app.renderer.plugins.interaction.mouse.global.x;
          tiltY = app.renderer.plugins.interaction.mouse.global.y;
          isTilting = true;
          break;
        case 1:
          panX = app.renderer.plugins.interaction.mouse.global.x;
          panY = app.renderer.plugins.interaction.mouse.global.y;
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

    let endx = 0;
    let endy = 0;
    function step(timestamp) {
      if (depthMapImage && depthMapImage.texture && app.renderer.view.style) {

        if ((isPanning || isTilting || isDrawing) && (endx != app.renderer.plugins.interaction.mouse.global.x || endy != app.renderer.plugins.interaction.mouse.global.y)) {
          needUpdateReverseMapBuffer = true;
        }
        endx = app.renderer.plugins.interaction.mouse.global.x;
        endy = app.renderer.plugins.interaction.mouse.global.y;

        if (isTilting) {
          let radius = Math.min(app.renderer.width, app.renderer.height);
          window.displacementFilter.uniforms.offset[0] -= ((endx - tiltX) / radius * 2);
          window.displacementFilter.uniforms.offset[1] += ((endy - tiltY) / radius * 2);

          let xy = Math.sqrt(window.displacementFilter.uniforms.offset[0] * window.displacementFilter.uniforms.offset[0] + window.displacementFilter.uniforms.offset[1] * window.displacementFilter.uniforms.offset[1]);
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

      if (window.displacementFilter.uniforms && window.displacementFilter.uniforms.canvasSize && window.displacementFilter.uniforms.textureSize) {

        let r, g, b, a;

        let x = Math.round(app.renderer.plugins.interaction.mouse.global.x);
        let y = Math.round(app.renderer.plugins.interaction.mouse.global.y);
        let w = window.displacementFilter.uniforms.canvasSize[0];
        let h = window.displacementFilter.uniforms.canvasSize[1];
        let pos = (y * w + x) * 4;
        if (needUpdateReverseMapBuffer) {

          if (isPanning || isTilting || isDrawing) {
            // If the user is changing the viewport, there is not useful to cache the full screen reverse map
            // We only pick one pixel for the current cursor position
            let rgba = extractOnePixel(containerReverseMap, x, y);

            r = rgba[0];
            g = rgba[1];
            b = rgba[2];
            a = rgba[3];
          } else {
            // The user is moving cursor but not changing the viewport nor drawing
            // It is helpful to cache the whole screen size reverse map buffer for better performance
            needUpdateReverseMapBuffer = false;
            reverseMapBuffer = extractPixelsWithoutPostmultiply(containerReverseMap);
            r = reverseMapBuffer[pos];
            g = reverseMapBuffer[pos + 1];
            b = reverseMapBuffer[pos + 2];
            a = reverseMapBuffer[pos + 3];
          }
        } else {
          // existing reverse map buffer cache is still valid
          r = reverseMapBuffer[pos];
          g = reverseMapBuffer[pos + 1];
          b = reverseMapBuffer[pos + 2];
          a = reverseMapBuffer[pos + 3];
        }





        // scale = zoom * fit
        let scale = window.displacementFilter.uniforms.zoom *
          Math.min(w / window.displacementFilter.uniforms.textureSize[0], h / window.displacementFilter.uniforms.textureSize[1]);

        let mouseX = (app.renderer.plugins.interaction.mouse.global.x - w / 2 + window.displacementFilter.uniforms.textureSize[0] / 2 * scale);
        mouseX += window.displacementFilter.uniforms.pan[0];
        mouseX = mouseX / scale;
        curOnTexX = mouseX + ((r - 128. + (b - 128.) / 256.) / 256.) * window.displacementFilter.uniforms.textureSize[0];

        let mouseY = (app.renderer.plugins.interaction.mouse.global.y - h / 2 + window.displacementFilter.uniforms.textureSize[1] / 2 * scale);
        mouseY += window.displacementFilter.uniforms.pan[1];
        mouseY = mouseY / scale;
        curOnTexY = mouseY + ((g - 128. + (a - 128.) / 256.) / 256.) * window.displacementFilter.uniforms.textureSize[1];

        cursorSpirte.x = curOnTexX / window.displacementFilter.uniforms.textureSize[0] * w;
        cursorSpirte.y = curOnTexY / window.displacementFilter.uniforms.textureSize[1] * h;
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

    function startDrawing() {
      if (strokes.length == 0 || strokes[strokes.length - 1].path == null || strokes[strokes.length - 1].path.length > 0) {
        strokes.push({ path: [], mask: 65535, brushId: 0 });
        document.getElementById('undo-button').disabled = strokes.length == 0;
      }
      strokes[strokes.length - 1].brushId = brushId;

      if (isMaskEditing) {
        strokes[strokes.length - 1].r1 = parseInt(document.getElementById('pen-inner-radius-slider').value);
        strokes[strokes.length - 1].value = maskEditingId;
        strokes[strokes.length - 1].isMaskEditing = true;
      } else {
        switch (brushId) {
          default:
          case 0:
            strokes[strokes.length - 1].r1 = parseInt(document.getElementById('pen-inner-radius-slider').value);
            strokes[strokes.length - 1].r2 = parseInt(document.getElementById('pen-outer-radius-slider').value);
            strokes[strokes.length - 1].value = parseInt(document.getElementById('pen-value-slider').value) * penFlip;
            break;
          case 1:
            strokes[strokes.length - 1].r1 = parseInt(document.getElementById('roller-inner-radius-slider').value);
            strokes[strokes.length - 1].value = parseInt(document.getElementById('roller-value-slider').value);
            break;
          case 2:
            strokes[strokes.length - 1].r1 = parseInt(document.getElementById('smooth-inner-radius-slider').value);
            strokes[strokes.length - 1].value = parseInt(document.getElementById('smooth-value-slider').value);
            break; f
        }
      }



      isDrawing = true;
    }

    function endDrawing() {
      isDrawing = false;
      updateCache();
      refreshMaskListPanel();
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
      cacheCtx.clearRect(0, 0, dmCanvas.width, dmCanvas.height);
      cacheCtx.drawImage(dmCanvas, 0, 0);
      cacheBaseMapHistoryIndex = strokes.length - 1;
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

      if (strokes.length > 0) {
        strokes[strokes.length - 1].mask = getCurrentMaskSelected();
      }

      // Draw all steps
      let maskUpdated = false;
      for (let i = cacheValid ? cacheBaseMapHistoryIndex + 1 : 0; i < strokes.length; i++) {
        if (strokes[i].isMaskEditing) {
          drawMaskLine(strokes[i].path, strokes[i].r1, strokes[i].value);
          maskUpdated = true;
        } else {
          updateMaskCanvas(strokes[i].mask);

          switch (strokes[i].brushId) {
            default:
            case 0:
              drawSmoothLine(strokes[i].path, strokes[i].r1, strokes[i].r2, strokes[i].value, false);
              break;
            case 1:
              drawSmoothLine(strokes[i].path, strokes[i].r1, 0, strokes[i].value, true);
              break;
            case 2:
              updateMedianMask(strokes[i].path, strokes[i].r1, strokes[i].value);
              break; f
          }
          drawMaskedArea(strokes[i].mask);
        }
      }

      if (maskUpdated) {
        updateMaskIndicator();
      }

      dmTexture.update();
    }



    function updateMedianMask(path, radius, blurRadius) {
      // Prepare the original image but earsed the stroke area
      // With very shape edge
      let strokeInverseCanvas = new OffscreenCanvas(dmCanvas.width, dmCanvas.height);
      let strokeInverseCtx = strokeInverseCanvas.getContext('2d');
      strokeInverseCtx.drawImage(dmCanvas, 0, 0);
      strokeInverseCtx.globalCompositeOperation = 'destination-out'; // eraser effect
      strokeInverseCtx.beginPath();
      strokeInverseCtx.lineWidth = radius * 2. - 1.;
      strokeInverseCtx.lineCap = "round";
      strokeInverseCtx.lineJoin = "round";
      strokeInverseCtx.strokeStyle = "rgba(0,0,0,255)";
      strokeInverseCtx.moveTo(path[0].x, path[0].y);
      for (let index = 0; index < path.length; ++index) {
        let point = path[index];
        strokeInverseCtx.lineTo(point.x, point.y);
      }
      strokeInverseCtx.stroke();
      let strokeInverseData = strokeInverseCtx.getImageData(0, 0, dmCanvas.width, dmCanvas.height);
      let sidd = strokeInverseData.data;
      for (let i = 3; i < sidd.length; i += 4) {
        sidd[i] = sidd[i] < 255 ? 0 : 255; // a, make it shape
      }
      strokeInverseCtx.putImageData(strokeInverseData, 0, 0);

      // Prepare the original image with only the stroke area
      let strokeCanvas = new OffscreenCanvas(dmCanvas.width, dmCanvas.height);
      let strokeCtx = strokeCanvas.getContext('2d');
      strokeCtx.drawImage(dmCanvas, 0, 0);
      let strokeData = strokeCtx.getImageData(0, 0, dmCanvas.width, dmCanvas.height);
      let sdd = strokeData.data;
      for (let i = 3; i < sdd.length; i += 4) {
        sdd[i] = sidd[i] < 255 ? 255 : 0; // invert of strokeInverse
      }
      strokeCtx.putImageData(strokeData, 0, 0);

      // draw the stroke canvas multiple time with offset
      // to have a Dilation effect before bluring
      // So that after apply the blur filter, the edge of image will not become transparent
      let expandedStrokeCanvas = new OffscreenCanvas(dmCanvas.width, dmCanvas.height);
      let expandedStrokeCtx = expandedStrokeCanvas.getContext('2d');
      for (let i = blurRadius + 5; i > 0; i--) { // From outter to inner
        for (let j = -i; j < i; j++) {
          // Draw the point on each of the edges (square)
          expandedStrokeCtx.drawImage(strokeCanvas, -i, j);
          expandedStrokeCtx.drawImage(strokeCanvas, j, i);
          expandedStrokeCtx.drawImage(strokeCanvas, i, -j);
          expandedStrokeCtx.drawImage(strokeCanvas, -j, -i);
        }
      }
      expandedStrokeCtx.drawImage(strokeCanvas, 0, 0); // Center

      // Blur canvas with padding
      // transparent effect on the edge causing poor image in Chromium as dithering is enabled
      // p.s. reusing the strokeCtx object
      strokeCtx.clearRect(0, 0, dmCanvas.width, dmCanvas.height);
      strokeCtx.globalCompositeOperation = 'source-over';
      strokeCtx.globalAlpha = 1;
      strokeCtx.filter = 'blur(' + blurRadius / 2 + 'px)';
      strokeCtx.drawImage(expandedStrokeCanvas, 0, 0);
      sdd = strokeCtx.getImageData(0, 0, dmCanvas.width, dmCanvas.height).data;



      let dmData = dmCtx.getImageData(0, 0, dmCanvas.width, dmCanvas.height);
      let dmdd = dmData.data;
      for (let i = 0; i < dmdd.length; i += 4) {
        dmdd[i] = sidd[i + 3] < 255 ? sdd[i] : sidd[i]; // copy from the blur canvas
      }
      dmCtx.putImageData(dmData, 0, 0);
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

    function getCurrentMaskSelected() {
      let newMasks = { length: 0 };
      for (let i = 0; i < 255; i++) {
        let checkbox = document.getElementById('mask-' + i);
        if (!checkbox || checkbox.checked) {
          newMasks[i] = 1;
          newMasks.length = newMasks.length + 1;
        }
      }
      return newMasks;
    }


    // Call this when the mask data changed 
    // or user select another set of masks
    function updateMaskCanvas(newMasks) {
      if (newMasks.length == 255) {
        return; // For select-all mask -> dont need to build the mask area
      }

      maskCanvas = new OffscreenCanvas(dmCanvas.width, dmCanvas.height);
      let maskCtx = maskCanvas.getContext('2d');
      let dmData = dmCtx.getImageData(0, 0, dmCanvas.width, dmCanvas.height);
      let buf = new ArrayBuffer(dmData.data.length);
      let dmdd = dmData.data;
      let buf8 = new Uint8ClampedArray(buf);


      for (let i = 0; i < dmdd.length; i++) {
        buf8[i] = dmdd[i]; // r
        let mask = dmdd[++i]; // g + b channels are storing the mask data
        buf8[i] = dmdd[i]; // g
        buf8[++i] = dmdd[i]; // b
        buf8[++i] = newMasks[mask] == 1 ? 0 : 255; // a, if it match any given mask, opacity set to 1
      }

      dmData.data.set(buf8);
      maskCtx.putImageData(dmData, 0, 0);
    }


    function drawMaskedArea(mask) {
      if (maskCanvas && mask.length != 255) {
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
      dmCtx.clearRect(0, 0, dmCanvas.width, dmCanvas.height);
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

    // Function to extract only one pixel at specific location
    function extractOnePixel(target, x, y) {
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

      const webglPixels = new Uint8Array(BYTES_PER_PIXEL * 1 * 1);

      // read pixels to the array
      const gl = renderer.gl;

      gl.readPixels(
        (frame.x + x) * resolution,
        (frame.y + y) * resolution,
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        webglPixels
      );

      if (generated) {
        renderTexture.destroy(true);
      }

      return webglPixels;
    }


    const maskColor = {};
    for (let i = 0; i < 256; i++) {
      let color = {};
      color.r = 255 - ((i & 0b01000000) << 1) - ((i & 0b00001000) << 3) - ((i & 0b00000001) << 5); // r
      color.g = 255 - ((i & 0b10000000) << 0) - ((i & 0b00010000) << 2) - ((i & 0b00000010) << 4); // g
      color.b = 255 - ((i & 0b00100000) << 2) - ((i & 0b00000100) << 4) - 0b00100000; // b
      maskColor[i] = color;
    }


    function refreshMaskListPanel() {
      if (!bmImage.width || !dmCtx || !bmImageData) {
        return;
      }

      let set1 = new Map();
      let dmImageData = dmCtx.getImageData(0, 0, bmImage.width, bmImage.height);
      let dmdd = dmImageData.data;
      let bmdd = bmImageData.data;


      for (let j = 0; j < dmdd.length; j += 4) {
        let maskId = dmdd[j + 1];
        set1.set(maskId, maskId);
      }

      let tempCanvas = new OffscreenCanvas(bmImage.width, bmImage.height);
      const tmCtx = tempCanvas.getContext('2d');

      let maskList = document.getElementById('mask-list');
      maskList.replaceChildren();
      for (const [maskId, value] of (new Map([...set1].sort((a, b) => String(a[0]).localeCompare(b[0])))).entries()) {
        let li = document.createElement('li');
        li.style.backgroundColor = "rgba(" + maskColor[maskId].r + "," + maskColor[maskId].g + "," + maskColor[maskId].b + "," + 0.5 + ")";;

        // Create checkbox
        let input = document.createElement("input");
        input.type = 'checkbox';
        input.classList.add("uk-checkbox");
        input.id = 'mask-' + maskId;
        input.name = 'mask-checkbox';
        input.checked = true;
        input.addEventListener('change', updateMaskIndicator);

        // Create thumbnail
        // Draw the temp canvas
        let tmImageData = tmCtx.getImageData(0, 0, bmImage.width, bmImage.height);
        let tmdd = tmImageData.data;
        tmCtx.globalCompositeOperation = 'source-over';
        tmCtx.clearRect(0, 0, bmImage.width, bmImage.height);
        for (let j = 3; j < dmdd.length; j += 4) {
          tmdd[j] = dmdd[j - 2] == maskId ? 255 : 0; // a, if it match any given mask, opacity set to 1
        }
        tmCtx.putImageData(tmImageData, 0, 0);
        tmCtx.globalCompositeOperation = 'source-in';
        tmCtx.drawImage(bmImage, 0, 0);
        let liCanvas = document.createElement("CANVAS");
        liCanvas.width = 100;
        liCanvas.height = 100;
        let ctx = liCanvas.getContext('2d');
        ctx.drawImage(tempCanvas, 0, 0, 100, 100);


        // Create edit button
        let a = document.createElement("a");
        a.innerHTML = '<i class="material-icons icon-align">edit</i>';
        a.classList.add("uk-link-heading");
        a.classList.add("uk-padding-small");
        a.name = "mask-edit-icon";
        a.href = "#";
        a.setAttribute('uk-tooltip', "Edit");
        a.setAttribute('mask-id', maskId);
        a.addEventListener('click', function (e) {
          let editButtons = document.getElementsByName('mask-edit-icon');
          for (let button of editButtons) {
            button.innerHTML = '<i class="material-icons icon-align">edit</i>';
            button.setAttribute('uk-tooltip', "Edit");
          }
          if (this.getAttribute('mask-id') != maskEditingId || !isMaskEditing) {
            this.innerHTML = '<i class="material-icons icon-align">done_outline</i>';
            this.setAttribute('uk-tooltip', "Done");
            maskEditingId = maskId;
            isMaskEditing = true;
          } else if (isMaskEditing) {
            isMaskEditing = false;
          }
          updateMaskIndicator();
        });

        let label = document.createElement("label");

        li.appendChild(label);
        label.appendChild(a);
        label.appendChild(input);
        label.appendChild(liCanvas);
        maskList.appendChild(li);
      }
    }


    let isMaskEditing = false;
    let maskEditingId = 0;



    let isMaskIndicatorOn = true;
    function updateMaskIndicator() {

      // Redraw the basemap
      bmCtx = bmCanvas.getContext('2d');
      bmCtx.clearRect(0, 0, bmImage.width, bmImage.height);
      bmCtx.drawImage(bmImage, 0, 0);
      if (isMaskEditing) {
        let tempCanvas = new OffscreenCanvas(bmImage.width, bmImage.height);
        let tmCtx = tempCanvas.getContext('2d');
        let tmImageData = tmCtx.getImageData(0, 0, bmImage.width, bmImage.height);
        let tmdd = tmImageData.data;


        let dmImageData = dmCtx.getImageData(0, 0, bmImage.width, bmImage.height);
        let dmdd = dmImageData.data;

        for (var i = 0; i < dmdd.length; i += 4) {
          let maskId = dmdd[i + 1];
          let color = maskColor[maskId];
          tmdd[i + 0] = color.r; // r
          tmdd[i + 1] = color.g; // g
          tmdd[i + 2] = color.b; // b
          tmdd[i + 3] = maskId == maskEditingId ? 0 : 192; // a
        }
        tmCtx.putImageData(tmImageData, 0, 0);
        bmCtx.drawImage(tempCanvas, 0, 0);
      } else if (isMaskIndicatorOn) {

        let mask = getCurrentMaskSelected();

        let dmImageData = dmCtx.getImageData(0, 0, bmImage.width, bmImage.height);
        let dmdd = dmImageData.data;

        let tempCanvas = new OffscreenCanvas(bmImage.width, bmImage.height);
        let tmCtx = tempCanvas.getContext('2d');
        let tmImageData = tmCtx.getImageData(0, 0, bmImage.width, bmImage.height);
        let tmdd = tmImageData.data;

        tmCtx.clearRect(0, 0, bmImage.width, bmImage.height);
        for (let j = 0; j < dmdd.length; j += 4) {
          // Red
          tmdd[j] = 255;
          tmdd[j + 1] = 0;
          tmdd[j + 2] = 0;

          // half transparent on the masked area. invisible on the editable area
          tmdd[j + 3] = mask[dmdd[j + 1]] == 1 ? 0 : 128;
        }
        tmCtx.putImageData(tmImageData, 0, 0);
        bmCtx.drawImage(tempCanvas, 0, 0);
      }

      bmTexture.update();
    }

    function drawMaskLine(path, radius, value) {
      let depth;

      dmCtx.globalAlpha = 1;
      depth = value;
      dmCtx.globalCompositeOperation = 'source-over';

      let tempCanvas = new OffscreenCanvas(bmImage.width, bmImage.height);
      let tmCtx = tempCanvas.getContext('2d');

      // Draw stroke on a temp canvas
      tmCtx.beginPath();
      tmCtx.lineWidth = radius * 2. - 1.;
      tmCtx.lineCap = "round";
      tmCtx.lineJoin = "round";
      tmCtx.strokeStyle = "rgba(" + 0 + "," + value + "," + 0 + "," + 255 + ")";
      tmCtx.moveTo(path[0].x, path[0].y);
      for (let index = 0; index < path.length; ++index) {
        let point = path[index];
        tmCtx.lineTo(point.x, point.y);
      }
      tmCtx.stroke();


      // Copy the solid pixel onto the dmCanvas
      let dmData = dmCtx.getImageData(0, 0, dmCanvas.width, dmCanvas.height);
      let dmdd = dmData.data;
      let tmImageData = tmCtx.getImageData(0, 0, bmImage.width, bmImage.height);
      let tmdd = tmImageData.data;
      for (let j = 1; j < dmdd.length; j += 4) {
        if (tmdd[j + 2] > 0) { // a
          dmdd[j] = value;
        }
      }
      dmCtx.putImageData(dmData, 0, 0);
    }

    document.getElementById('mask-select-all').onclick = function () {
      let checkboxes = document.getElementsByName('mask-checkbox');
      for (let checkbox of checkboxes) {
        checkbox.checked = true;
      }
      updateMaskIndicator();
    }

    document.getElementById('mask-select-none').onclick = function () {
      let checkboxes = document.getElementsByName('mask-checkbox');
      for (let checkbox of checkboxes) {
        checkbox.checked = false;
      }
      updateMaskIndicator();
    }

    // UI event for download button
    let downloadButton = document.getElementById('file-download-button');
    downloadButton.addEventListener('click', function (e) {
      let link = document.createElement('a');
      link.download = 'download.png';
      link.href = dmCanvas.toDataURL('image/png');
      link.click();
      link.delete;
    });


    let brushId = 0;
    document.getElementById('brush-switcher').addEventListener("show", function (e) {
      brushId = e.detail[0].index();
    });

    let penFlip = 1;
    document.getElementById('pen-flip-switcher').addEventListener("show", function (e) {
      penFlip = 1 - e.detail[0].index() * 2; // 1 or -1
    });


    let redoList = []
    document.getElementById('undo-button').addEventListener("click", function (e) {
      redoList.push(strokes.pop());
      redraw();
      document.getElementById('undo-button').disabled = strokes.length == 0;
      document.getElementById('redo-button').disabled = false;
    });

    document.getElementById('redo-button').addEventListener("click", function (e) {
      strokes.push(redoList.pop());
      redraw()
      document.getElementById('undo-button').disabled = false;
      document.getElementById('redo-button').disabled = redoList.length == 0;
    });



    function onKeyDown(key) {

      if (key.key === '\\') {
        // Toggle the mask indicator, just like in Photoshop
        isMaskIndicatorOn = !isMaskIndicatorOn;
        updateMaskIndicator();
      } else if (key.key === '1') {
        window.displacementFilter.uniforms.displayMode = 0;
      } else if (key.key === '2') {
        window.displacementFilter.uniforms.displayMode = 1;
      } else if (key.key === '3') {
        window.displacementFilter.uniforms.displayMode = 2;
      }
    }
    document.addEventListener('keydown', onKeyDown);

  }


  let frag =
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
}
init();