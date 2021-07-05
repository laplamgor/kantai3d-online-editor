{
  'use strict';

  function init() {
    PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
    const app = new PIXI.Application(
      {
        view: document.querySelector("#main-canvas"),
        autoResize: true
      }
    );

    let curOnTexX = 0;
    let curOnTexY = 0;

    let bmImage = new Image(); // The base map image
    let bmPath = './f2152.png';

    let bm1Canvas = document.querySelector("#base-map-canvas"); // The canvas containing the base map image
    let bm1Ctx;

    let bm2Canvas, bm2Ctx;                                      // The canvas containing the base map image + mask indicators

    let bm3Canvas, bm3Ctx;                                      // The canvas containing the base map image + mask indicators + cursor


    let bm3Texture;
    let baseMapSprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    baseMapSprite.name = 'baseMapSprite';

    let reverseMapSprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    reverseMapSprite.name = 'reverseMapSprite';


    let container = new PIXI.Container();
    let dummySprite = new PIXI.Sprite.from(PIXI.Texture.WHITE); // Without this, PIXI will over-optimize to skip the shader
    dummySprite.name = 'dummySprite';

    // Load base map as buffer
    bmImage.onload = function () {
      bm1Canvas.width = bmImage.width;
      bm1Canvas.height = bmImage.height;
      bm1Ctx = bm1Canvas.getContext('2d');
      bm1Ctx.drawImage(bmImage, 0, 0);
      bm1ImageData = bm1Ctx.getImageData(0, 0, bmImage.width, bmImage.height);

      bm2Canvas = new OffscreenCanvas(bmImage.width, bmImage.height);
      bm2Ctx = bm2Canvas.getContext('2d');
      bm2Ctx.drawImage(bmImage, 0, 0);
      bm2ImageData = bm2Ctx.getImageData(0, 0, bmImage.width, bmImage.height);

      bm3Canvas = new OffscreenCanvas(bmImage.width, bmImage.height);
      bm3Ctx = bm3Canvas.getContext('2d');
      bm3Ctx.drawImage(bmImage, 0, 0);


      if (!bm3Texture) {
        bm3Texture = PIXI.Texture.from(bm3Canvas);
      } else {
        bm3Texture.update();
      }
      baseMapSprite.texture = bm3Texture;
      reverseMapSprite.texture = bm3Texture;
      needUpdateReverseMapBuffer = true;


      window.displacementFilter.uniforms.baseMap = bmRenderTexture;
      window.offsetFilter.uniforms.baseMap = bm3Texture;


      window.displacementFilter.uniforms.textureWidth = bmImage.width;
      window.displacementFilter.uniforms.textureHeight = bmImage.height;
      window.displacementFilter.uniforms.textureSize = [bmImage.width, bmImage.height];
      window.displacementFilter.uniforms.textureScale = 1.0;


      resize();
      refreshMaskListPanel(true);
    }
    bmImage.src = bmPath;


    // Load depth map as buffer
    let dmCanvas = document.querySelector("#depth-map-canvas");;
    let dmCtx;
    let dmPath = './f2152_depth.png';
    let dmImage = new Image();
    let dm1Texture = PIXI.Texture.EMPTY;
    let dm2Texture = PIXI.Texture.EMPTY;

    let mm1Texture = PIXI.Texture.EMPTY;
    let mm2Texture = PIXI.Texture.EMPTY;

    let dm1Sprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    dm1Sprite.name = 'dm1Sprite';

    let dm2Sprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    dm2Sprite.name = 'dm2Sprite';

    let mm1Sprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    mm1Sprite.name = 'mm1Sprite';

    let mm2Sprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    mm2Sprite.name = 'mm2Sprite';


    let maskSprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    maskSprite.name = 'maskSprite';

    dmImage.onload = function () {
      dmCanvas.width = dmImage.width;
      dmCanvas.height = dmImage.height;
      dmCtx = dmCanvas.getContext('2d');
      dmCtx.globalCompositeOperation = 'source-over';
      dmCtx.globalAlpha = 1;
      dmCtx.drawImage(dmImage, 0, 0);

      dm1Texture = PIXI.RenderTexture.from(dmCanvas);
      dm2Texture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);


      dm1Sprite.texture = dm1Texture; // original opened depth map

      dm2Sprite.texture = dm2Texture;
      maskSprite.texture = dm2Texture;

      mm2Texture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      mm1Sprite.texture = dm1Texture;
      mm2Sprite.texture = mm2Texture;

      window.displacementFilter.uniforms.displacementMap = dmRenderTexture;
      window.offsetFilter.uniforms.displacementMap = dm2Texture;

      window.displacementFilter.uniforms.baseMap = bmRenderTexture;
      window.offsetFilter.uniforms.baseMap = bm3Texture;


      updateCache2();


      resize();
      redraw();
      refreshMaskListPanel(true);
    }
    dmImage.src = dmPath;

    let reverseMapBuffer;
    let needUpdateReverseMapBuffer = true;

    PIXI.DepthPerspectiveFilter = new PIXI.Filter(null, displacementFrag, { displacementMap: PIXI.Texture.EMPTY, baseMap: PIXI.Texture.EMPTY });
    PIXI.DepthPerspectiveOffsetFilter = new PIXI.Filter(null, displacementFrag, { displacementMap: PIXI.Texture.EMPTY, baseMap: PIXI.Texture.EMPTY });
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




    window.displacementFilter = PIXI.DepthPerspectiveFilter;
    window.displacementFilter.uniforms.textureScale = 1.0;
    window.displacementFilter.padding = 0;

    window.displacementFilter.uniforms.pan = [0.0, 0.0];
    window.displacementFilter.uniforms.scale = 1.0;
    window.displacementFilter.uniforms.focus = 0.5;
    window.displacementFilter.uniforms.offset = [0.0, 0.0];

    window.displacementFilter.uniforms.displayMode = 2;




    container.filters = [window.displacementFilter];
    container.addChild(dummySprite); // let the filter to "do something"


    window.offsetFilter = PIXI.DepthPerspectiveOffsetFilter;

    let containerReverseMap = new PIXI.Container();
    containerReverseMap.filters = [window.offsetFilter];
    containerReverseMap.addChild(reverseMapSprite);



    app.stage.addChild(containerReverseMap);
    app.stage.addChild(container);


    let bmRenderTexture = PIXI.RenderTexture.create(600, 800);
    var bmRenderTextureSprite = new PIXI.Sprite(bmRenderTexture);
    bmRenderTextureSprite.name = 'sprite bmRenderTextureSprite';
    let bmContainer = new PIXI.Container();
    bmContainer.name = 'bmContainer';
    bmContainer.addChild(baseMapSprite);

    let cursorContainer = new PIXI.Container();
    cursorContainer.name = 'cursorContainer';
    bmContainer.addChild(cursorContainer);



    let dmRenderTexture = PIXI.RenderTexture.create(600, 800);
    var dmRTsprite = new PIXI.Sprite(dmRenderTexture);
    dmRTsprite.name = 'dmRTsprite';

    let dm1Container = new PIXI.Container();
    dm1Container.name = 'dm1Container';
    dm1Container.addChild(dm1Sprite);


    let dm2Container = new PIXI.Container();
    dm2Container.name = 'dm2Container';
    dm2Container.addChild(dm2Sprite);

    let mm1Container = new PIXI.Container();
    mm1Container.name = 'mm1Container';
    mm1Container.addChild(mm1Sprite);


    let mm2Container = new PIXI.Container();
    mm2Container.name = 'mm2Container';
    mm2Container.addChild(mm2Sprite);

    let maskContainer = new PIXI.Container();
    maskContainer.name = 'maskContainer';
    maskContainer.addChild(maskSprite);


    let depthCacheContainer = new PIXI.Container();
    depthCacheContainer.name = 'depthCacheContainer';

    let maskCacheContainer = new PIXI.Container();
    maskCacheContainer.name = 'maskCacheContainer';

    app.stage.addChild(depthCacheContainer);
    app.stage.addChild(maskCacheContainer);
    app.stage.addChild(bmContainer);

    app.stage.addChild(maskContainer);

    app.stage.addChild(dmRTsprite);
    app.stage.addChild(bmRenderTextureSprite);
    app.stage.addChild(mm1Container);
    app.stage.addChild(mm2Container);
    app.stage.addChild(dm2Container);




    let tiltX;
    let tiltY;
    let isTilting = false;

    let panX;
    let panY;
    let isPanning = false;

    let isDrawing = false;

    $('#main-canvas').bind('mousedown', function (event) {
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

    $('#main-canvas').bind('mouseup', function (event) {
      if (event.which == 3 & event.originalEvent.detail == 2) {
        // Double right click to reset the tilt angle
        tiltX = 0;
        tiltY = 0;
        isTilting = false;
        window.displacementFilter.uniforms.offset[0] = 0;
        window.displacementFilter.uniforms.offset[1] = 0;
        needUpdateReverseMapBuffer = true;
        return;
      }

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
    $('#main-canvas').bind('mousewheel', function (e) {

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
      if (baseMapSprite && baseMapSprite.texture && app.renderer.view.style) {

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
        curOnTexX = mouseX + ((r - 128. + (b - 128.) / 256.) / 256.) * window.displacementFilter.uniforms.textureSize[0] + 0.5;

        let mouseY = (app.renderer.plugins.interaction.mouse.global.y - h / 2 + window.displacementFilter.uniforms.textureSize[1] / 2 * scale);
        mouseY += window.displacementFilter.uniforms.pan[1];
        mouseY = mouseY / scale;
        curOnTexY = mouseY + ((g - 128. + (a - 128.) / 256.) / 256.) * window.displacementFilter.uniforms.textureSize[1] + 0.5;

        // Update cursor image
        updateCursorImage();
      }
      app.renderer.render(bmContainer, bmRenderTexture);
      app.renderer.render(dm2Container, dmRenderTexture);

      window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);

    // Listen for window resize events
    window.addEventListener('resize', resize);

    function updateCursorImage() {
      if (!isNaN(curOnTexX) && !isNaN(curOnTexY)) {
        bm3Ctx.clearRect(0, 0, dmCanvas.width, dmCanvas.height);
        bm3Ctx.drawImage(bm2Canvas, 0, 0);
        bm3Texture.update();

        while (cursorContainer.children[0]) {
          cursorContainer.removeChild(cursorContainer.children[0]);
        }
        let graphics = new PIXI.Graphics();
        graphics.blendMode = PIXI.BLEND_MODES.ADD;
        graphics.alpha = 0.5;
        const circle = graphics.lineStyle({
          width: 0, alignment: 0.5
        }).beginFill((128 << 16) + (128 << 8) + 255).drawCircle(Math.round(curOnTexX) - 0.5, Math.round(curOnTexY) - 0.5, brushSizeSliders[0].value - 0.5).endFill();
        cursorContainer.addChild(circle);
      }
    }

    // Resize function window
    function resize() {
      // Resize the renderer
      const parent = app.view.parentNode;
      app.renderer.resize(parent.clientWidth, parent.clientHeight);

      reverseMapSprite.width = app.renderer.screen.width;
      reverseMapSprite.height = app.renderer.screen.height;

      dummySprite.width = app.renderer.screen.width;
      dummySprite.height = app.renderer.screen.height;
    }


    function startDrawing() {
      if (strokes.length == 0 || strokes[strokes.length - 1].path == null || strokes[strokes.length - 1].path.length > 0) {
        strokes.push({ path: [], mask: 65535, brushId: 0 });
        document.getElementById('undo-button').disabled = strokes.length == 0;
      }
      strokes[strokes.length - 1].brushId = brushId;


      // Remove everything in the redo stack
      redoList = [];
      document.getElementById('undo-button').disabled = false;
      document.getElementById('redo-button').disabled = redoList.length == 0;

      // Remove invalid cache thats only for those redo steps
      let invalidCacheSnapshots = cacheSnapshots.filter(e => e.step > strokes.length - 1); // delete this cache
      for (let k = 0; k < invalidCacheSnapshots.length; k++) {
        invalidCacheSnapshots[k].dm.destroy(true);
        invalidCacheSnapshots[k].mm.destroy(true);
      }
      cacheSnapshots = cacheSnapshots.filter(e => e.step <= strokes.length - 1);



      if (isMaskEditing) {
        strokes[strokes.length - 1].r1 = parseInt(brushSizeSliders[0].value);
        strokes[strokes.length - 1].value = maskEditingId;
        strokes[strokes.length - 1].isMaskEditing = true;
      } else {
        switch (brushId) {
          default:
          case 0:
            strokes[strokes.length - 1].r1 = parseInt(brushSizeSliders[0].value);
            strokes[strokes.length - 1].r2 = parseInt(document.getElementById('pen-outer-radius-slider').value);
            strokes[strokes.length - 1].value = parseInt(document.getElementById('pen-value-slider').value) * penFlip;
            break;
          case 1:
            strokes[strokes.length - 1].r1 = parseInt(brushSizeSliders[0].value);
            strokes[strokes.length - 1].value = parseInt(document.getElementById('roller-value-slider').value);
            break;
          case 2:
            strokes[strokes.length - 1].r1 = parseInt(brushSizeSliders[0].value);
            strokes[strokes.length - 1].value = parseInt(document.getElementById('smooth-value-slider').value);
            break; f
        }
      }



      isDrawing = true;
    }

    function endDrawing() {
      isDrawing = false;
      // updateCache();
      updateCache2();
      console.log('endDrawing' + strokes.length);
      if (isMaskEditing) {
        refreshMaskListPanel();
      }
    }

    let strokes = [];


    let cacheSnapshots = [];

    function updateCache2() {
      let stepNum = strokes.length;

      let currentDepthRenderTexture = PIXI.RenderTexture.create(600, 800);
      var depthCacheSprite = new PIXI.Sprite(currentDepthRenderTexture);
      depthCacheSprite.name = 'stepCacheSprite-' + stepNum;
      depthCacheContainer.addChild(depthCacheSprite);

      let currentMaskRenderTexture = PIXI.RenderTexture.create(600, 800);
      var maskCacheSprite = new PIXI.Sprite(currentMaskRenderTexture);
      maskCacheSprite.name = 'maskCacheSprite-' + stepNum;
      maskCacheContainer.addChild(maskCacheSprite);

      if (strokes.length == 0) {
        app.renderer.render(dm1Sprite, currentDepthRenderTexture);
        app.renderer.render(dm1Sprite, currentMaskRenderTexture);
      } else {
        app.renderer.render(dm2Container, currentDepthRenderTexture);
        app.renderer.render(mm2Container, currentMaskRenderTexture);
      }

      cacheSnapshots.push({ step: stepNum, dm: depthCacheSprite, mm: maskCacheSprite });
      let j = 0; // j is the position of the previous cached object. must older than current position
      for (let k = 1; k < cacheSnapshots.length; k++) {
        let c = cacheSnapshots[k];
        if (3 * c.step - 2 * j <= stepNum) {
          cacheSnapshots = cacheSnapshots.filter(e => e !== c); // delete this cache
          c.dm.destroy(true);
          c.mm.destroy(true);
          break; // for each new step, it will at most delete one old cache
        } else {
          j = c.step;
        }
      }

      app.renderer.render(depthCacheSprite, dm2Texture);
      app.renderer.render(maskCacheSprite, mm2Texture);

      // remove all children
      while (dm2Container.children[0]) {
        dm2Container.removeChild(dm2Container.children[0]);
      }
      dm2Container.addChild(dm2Sprite);
      while (mm2Container.children[0]) {
        mm2Container.removeChild(mm2Container.children[0]);
      }
      mm2Container.addChild(mm2Sprite);
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
      // Get the closest cached steps
      let cached;
      for (let k = 0; k < cacheSnapshots.length; k++) {
        if (cacheSnapshots[k].step <= strokes.length) {
          cached = cacheSnapshots[k];
        }
      }
      app.renderer.render(cached.dm, dm2Texture);
      app.renderer.render(cached.mm, mm2Texture);

      if (strokes.length > 0) {
        strokes[strokes.length - 1].mask = getCurrentMaskSelected();
      }


      // remove all children
      while (dm2Container.children[0]) {
        dm2Container.removeChild(dm2Container.children[0]);
      }
      dm2Container.addChild(dm2Sprite);
      while (mm2Container.children[0]) {
        mm2Container.removeChild(mm2Container.children[0]);
      }
      mm2Container.addChild(mm2Sprite);


      // Draw all uncached steps
      let maskUpdated = false;
      for (let i = cached.step; i < strokes.length; i++) {
        if (strokes[i].isMaskEditing) {
          drawMaskLine2(strokes[i], strokes[i].path, strokes[i].r1, strokes[i].value)
          maskUpdated = true;
        } else {
          switch (strokes[i].brushId) {
            default:
            case 0:
              drawSmoothLine(strokes[i], strokes[i].path, strokes[i].r1, strokes[i].r2, strokes[i].value, false);
              break;
            case 1:
              drawSmoothLine(strokes[i], strokes[i].path, strokes[i].r1, 0, strokes[i].value, true);
              break;
            case 2:
              drawSmoothLine(strokes[i], strokes[i].path, strokes[i].r1, 0, strokes[i].value, false, 1, true);
              break;
          }
        }
      }

      if (maskUpdated) {
        updateMaskIndicator();
      }
    }


    function drawSmoothLine(stroke, path, innerRadius, outerRadius, value, isAbsolute, sign = 1, isBlur = false) {
      let depth;
      if (!isAbsolute) {
        if (value < 0) {
          // Darken delta brush = invert then lighter brush then invert
          drawSmoothLine(stroke, path, innerRadius, outerRadius, -value, isAbsolute, -1, isBlur)
          return;
        } else {
          depth = value;
        }
      } else {
        depth = value;
        sign = 0;
      }


      if (stroke.lines) {
        for (let index = 0; index < stroke.lines.length; ++index) {
          stroke.lines[index].destroy(true);
        }
        stroke.lineContainer.destroy(true);
      }
      stroke.lineContainer = new PIXI.Container();
      stroke.lineContainer.name = 'line';
      stroke.lines = [];


      let alphaSum = 0; // 0.1
      for (let i = innerRadius + outerRadius + 1; i > innerRadius + 1; i--) {

        let targetAlpha = (outerRadius - i + innerRadius + 1) * 1. / outerRadius * dmCtx.globalAlpha; // 0.2
        let alphaNeeded = (targetAlpha - alphaSum) / (1 - alphaSum) / dmCtx.globalAlpha;
        // Drawing threshold
        // if the alpha is too low, the canvas will not be able to result any change
        if (alphaNeeded * dmCtx.globalAlpha >= 1. / 256 * 2) {
          drawFlatLine(stroke, path, i, depth, alphaNeeded, sign, isBlur);
          alphaSum = targetAlpha;
        }
      }

      // Draw the solid center part
      if (innerRadius + outerRadius != 0) {
        let alphaNeeded = (dmCtx.globalAlpha - alphaSum) / (1 - alphaSum) / dmCtx.globalAlpha;
        drawFlatLine(stroke, path, innerRadius, depth, alphaNeeded, sign, isBlur);
      }

      dm2Container.addChild(stroke.lineContainer);
    }

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

    function drawFlatLine(stroke, path, radius, depth, alpha, sign, isBlur) {
      const graphics = new PIXI.Graphics();

      let brushFilter;
      if (isBlur) {
        brushFilter = new BlurFilter();
        brushFilter.maskMap = mm2Sprite.texture;
        brushFilter.depthMap = dm2Texture;

        brushFilter.alpha = 1; // roller mode
        graphics.filters = [brushFilter];

      } else {
        brushFilter = new BrushFilter();
        brushFilter.maskMap = mm2Texture;
        if (sign > 0) {
          brushFilter.alpha = alpha;
          brushFilter.blendMode = PIXI.BLEND_MODES.ADD;
        } else if (sign < 0) {
          brushFilter.alpha = alpha;
          brushFilter.blendMode = PIXI.BLEND_MODES.SUBTRACT;
        } else {
          brushFilter.alpha = 1; // roller mode
        }
        graphics.filters = [brushFilter];
      }

      if (path.length == 1) {
        // Single point only, cannot use path
        const circle = graphics.lineStyle({
          width: 0, alignment: 0.5
        }).beginFill(depth << 16 + 0 + 0).drawCircle(path[0].x - 0.5, path[0].y - 0.5, radius - 0.5).endFill();
        circle.name = 'circle a:' + alpha + ' r:' + radius;
      } else {
        // Multi points line
        const pixiLine = graphics.lineStyle({
          width: radius * 2. - 1.,
          color: depth << 16 + 0 + 0,
          alignment: 0.5,
          join: 'round',
          cap: 'round'
        }).moveTo(path[0].x - 0.5, path[0].y - 0.5);
        pixiLine.name = 'flatLine a:' + alpha + ' r:' + radius;

        for (let index = 0; index < path.length; ++index) {
          let point = path[index];
          pixiLine.lineTo(point.x - 0.5, point.y - 0.5);
        }
      }


      stroke.lines.push(graphics);
      stroke.lineContainer.addChild(graphics);

      let bounds = stroke.lineContainer.getBounds();
      graphics.filterArea = bounds.clone();
      graphics.filterArea.x = Math.max(graphics.filterArea.x, 0.0);
      graphics.filterArea.y = Math.max(graphics.filterArea.y, 0.0);
      graphics.filterArea.width = Math.min(graphics.filterArea.width + bounds.x - graphics.filterArea.x, bmImage.width - graphics.filterArea.x);
      graphics.filterArea.height = Math.min(graphics.filterArea.height + bounds.y - graphics.filterArea.y, bmImage.height - graphics.filterArea.y);
      brushFilter.brushPos = { 0: graphics.filterArea.x, 1: graphics.filterArea.y };
      brushFilter.brushSize = { 0: Math.pow(2, Math.ceil(Math.log2(graphics.filterArea.width))), 1: Math.pow(2, Math.ceil(Math.log2(graphics.filterArea.height))) };
      brushFilter.canvasSize = { 0: bmImage.width, 1: bmImage.height };
      brushFilter.maskIds = Array(256).fill(0);
      for (let i = 0; i < 256; i++) {
        brushFilter.maskIds[i] = stroke.mask[i];
      }
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
      color.r = 0b10000000 - ((i & 0b01000000) << 1) + ((i & 0b00000001) << 6) + 0b00100000 - ((i & 0b00001000) << 2); // r
      color.g = 0b10000000 - ((i & 0b00000010) << 6) + ((i & 0b10000000) >> 1) + 0b00100000 - ((i & 0b00010000) << 1); // g
      color.b = 0b10000000 - ((i & 0b00000100) << 5) + ((i & 0b00100000) << 1) + 0b00100000; // b
      maskColor[i] = color;
    }

    function initMaskListPanel() {
      let maskList = document.getElementById('mask-list');
      maskList.replaceChildren();


      for (let maskId = 0; maskId < 256; maskId++) {
        let li = document.createElement('li');
        li.id = 'mask-item-' + maskId;
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
        let liCanvas = document.createElement("CANVAS");
        liCanvas.width = 100;
        liCanvas.height = 100;
        liCanvas.id = 'mask-thumbnail-canvas-' + maskId;


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

        // The # number for easier identifying
        let dd = document.createElement("div")
        dd.innerText = '#' + maskId;
        dd.style.float = 'right';
        dd.style.position = 'absolute';
        dd.style.height = 'auto';
        dd.style.bottom = '0';
        dd.style.right = '0';
        dd.style.color = 'white';
        dd.style['font-size'] = '3em';
        dd.style['font-weight'] = '100';
        dd.style.display = 'inline-block';
        dd.style['line-height'] = '1';

        let label = document.createElement("label");
        label.appendChild(a);
        label.appendChild(input);
        label.appendChild(liCanvas);

        li.appendChild(label);
        li.style.position = 'relative';
        li.appendChild(dd);

        maskList.appendChild(li);
        maskList.appendChild(li);

      }
    }
    initMaskListPanel();

    function refreshMaskListPanel(refrashAll) {
      if (!bmImage.width || !dmCtx) {
        return;
      }

      let dmTempCanvas = app.renderer.extract.canvas(mm2Container);
      let dmImageData = dmTempCanvas.getContext('2d').getImageData(0, 0, bmImage.width, bmImage.height);
      let dmdd = dmImageData.data;

      let set1 = new Map();
      for (let j = 0; j < dmdd.length; j += 4) {
        let maskId = dmdd[j + 1];
        set1.set(maskId, maskId);
      }

      for (let maskId = 0; maskId < 256; maskId++) {
        let li = document.getElementById('mask-item-' + maskId);
        li.classList.remove('mask-non-empty');
      }


      let tempCanvas = new OffscreenCanvas(bmImage.width, bmImage.height);
      const tmCtx = tempCanvas.getContext('2d');
      for (let maskId = 0; maskId < 256; maskId++) {
        if ((set1.get(maskId) === maskId) || refrashAll) {
          let li = document.getElementById('mask-item-' + maskId);

          if (set1.get(maskId) === maskId) {
            li.classList.add('mask-non-empty');
          }

          // Update thumbnail
          // Draw the temp canvas
          tmCtx.globalCompositeOperation = 'source-over';
          tmCtx.clearRect(0, 0, bmImage.width, bmImage.height);
          let tmImageData = tmCtx.createImageData(bmImage.width, bmImage.height);
          let tmdd = tmImageData.data;
          for (let j = 3; j < dmdd.length; j += 4) {
            tmdd[j] = dmdd[j - 2] == maskId ? 255 : 0; // a, if it match any given mask, opacity set to 1
          }
          tmCtx.putImageData(tmImageData, 0, 0);
          tmCtx.globalCompositeOperation = 'source-in';
          tmCtx.drawImage(bmImage, 0, 0);
          let liCanvas = document.getElementById('mask-thumbnail-canvas-' + maskId);
          let ctx = liCanvas.getContext('2d');
          ctx.clearRect(0, 0, 100, 100);
          ctx.drawImage(tempCanvas, 0, 0, 100, 100);
        }
      }
    }

    let isMaskEditing = false;
    let maskEditingId = 0;

    let isMaskIndicatorOn = true;

    function updateMaskIndicator() {
      // Redraw the basemap
      bm2Ctx = bm2Canvas.getContext('2d');
      bm2Ctx.clearRect(0, 0, bmImage.width, bmImage.height);
      bm2Ctx.drawImage(bmImage, 0, 0);
      if (isMaskEditing) {

        let mask = getCurrentMaskSelected();


        let tempCanvas = new OffscreenCanvas(bmImage.width, bmImage.height);
        let tmCtx = tempCanvas.getContext('2d');
        let tmImageData = tmCtx.createImageData(bmImage.width, bmImage.height);
        tmImageData.data = extractPixelsWithoutPostmultiply(mm2Container);
        let tmdd = tmImageData.data;


        let dmTempCanvas = app.renderer.extract.canvas(mm2Container);
        let dmImageData = dmTempCanvas.getContext('2d').getImageData(0, 0, bmImage.width, bmImage.height);
        let dmdd = dmImageData.data;

        for (var i = 0; i < dmdd.length; i += 4) {
          if (mask[dmdd[i + 1]] == 1) {
            let maskId = dmdd[i + 1];
            let color = maskColor[maskId];
            tmdd[i + 0] = color.r; // r
            tmdd[i + 1] = color.g; // g
            tmdd[i + 2] = color.b; // b
            tmdd[i + 3] = maskId == maskEditingId ? 0 : 192; // a
          } else {
            // Red
            tmdd[i] = 255;
            tmdd[i + 1] = 0;
            tmdd[i + 2] = 0;
            tmdd[i + 3] = 128;
          }
        }
        tmCtx.putImageData(tmImageData, 0, 0);
        bm2Ctx.drawImage(tempCanvas, 0, 0);
      } else if (isMaskIndicatorOn) {

        let mask = getCurrentMaskSelected();

        let dmTempCanvas = app.renderer.extract.canvas(mm2Container);
        let dmImageData = dmTempCanvas.getContext('2d').getImageData(0, 0, bmImage.width, bmImage.height);
        let dmdd = dmImageData.data;

        let tempCanvas = new OffscreenCanvas(bmImage.width, bmImage.height);
        let tmCtx = tempCanvas.getContext('2d');
        let tmImageData = tmCtx.createImageData(bmImage.width, bmImage.height);
        tmImageData.data = extractPixelsWithoutPostmultiply(mm2Container);
        let tmdd = tmImageData.data;

        tmCtx.clearRect(0, 0, bmImage.width, bmImage.height);
        for (let i = 0; i < dmdd.length; i += 4) {
          // half transparent red on the masked area. invisible on the editable area
          if (mask[dmdd[i + 1]] != 1) {
            // Red
            tmdd[i] = 255;
            tmdd[i + 1] = 0;
            tmdd[i + 2] = 0;
            tmdd[i + 3] = 128;
          }
        }
        tmCtx.putImageData(new ImageData(tmdd, bmImage.width, bmImage.height), 0, 0);
        bm2Ctx.drawImage(tempCanvas, 0, 0);
      }

      bm3Texture.update();
    }










    function drawMaskLine2(stroke, path, radius, depth, maskid) {
      if (stroke.lines) {
        for (let index = 0; index < stroke.lines.length; ++index) {
          stroke.lines[index].destroy(true);
        }
        stroke.lineContainer.destroy(true);
      }
      stroke.lineContainer = new PIXI.Container();
      stroke.lineContainer.name = 'line(mask)';
      stroke.lines = [];



      const graphics = new PIXI.Graphics();

      let brushFilter;
      brushFilter = new BrushFilter();
      brushFilter.maskMap = mm2Sprite.texture;
      brushFilter.alpha = 1; // roller mode
      graphics.filters = [brushFilter];

      if (path.length == 1) {
        // Single point only, cannot use path
        const circle = graphics.lineStyle({
          width: 0, alignment: 0.5
        }).beginFill(depth << 8 + 0).drawCircle(path[0].x - 0.5, path[0].y - 0.5, radius - 0.5).endFill();
        circle.name = 'circle a:' + 1 + ' r:' + radius;
      } else {
        // Multi points line
        const pixiLine = graphics.lineStyle({
          width: radius * 2. - 1.,
          color: depth << 8 + 0 + 0,
          alignment: 0.5,
          join: 'round',
          cap: 'round'
        }).moveTo(path[0].x - 0.5, path[0].y - 0.5);
        pixiLine.name = 'flatLine a:' + 1 + ' r:' + radius;

        for (let index = 0; index < path.length; ++index) {
          let point = path[index];
          pixiLine.lineTo(point.x - 0.5, point.y - 0.5);
        }
      }


      stroke.lines.push(graphics);
      stroke.lineContainer.addChild(graphics);

      let bounds = stroke.lineContainer.getBounds();
      graphics.filterArea = bounds.clone();
      graphics.filterArea.x = Math.max(graphics.filterArea.x, 0.0);
      graphics.filterArea.y = Math.max(graphics.filterArea.y, 0.0);
      graphics.filterArea.width = Math.min(graphics.filterArea.width + bounds.x - graphics.filterArea.x, bmImage.width - graphics.filterArea.x);
      graphics.filterArea.height = Math.min(graphics.filterArea.height + bounds.y - graphics.filterArea.y, bmImage.height - graphics.filterArea.y);
      brushFilter.brushPos = { 0: graphics.filterArea.x, 1: graphics.filterArea.y };
      brushFilter.brushSize = { 0: Math.pow(2, Math.ceil(Math.log2(graphics.filterArea.width))), 1: Math.pow(2, Math.ceil(Math.log2(graphics.filterArea.height))) };
      brushFilter.canvasSize = { 0: bmImage.width, 1: bmImage.height };
      brushFilter.maskIds = Array(256).fill(0);
      for (let i = 0; i < 256; i++) {
        brushFilter.maskIds[i] = stroke.mask[i];
      }

      mm2Container.addChild(stroke.lineContainer);
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

    document.getElementById('mask-select-filter').onclick = function () {
      document.getElementById('mask-select-unfilter').hidden = false;
      this.hidden = true;
    }

    document.getElementById('mask-select-unfilter').onclick = function () {
      document.getElementById('mask-select-filter').hidden = false;
      this.hidden = true;
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

    // Sync the brush size slider across all brushes
    var brushSizeSliders = document.getElementsByClassName("brush-inner-radius-slider");
    var brushSizeLabels = document.getElementsByClassName("brush-inner-radius-slider-val");
    var brushSizeChange = function (e) {
      for (var i = 0; i < brushSizeSliders.length; i++) {
        brushSizeSliders[i].value = e.target.value;
        brushSizeLabels[i].innerHTML = e.target.value;
      }
    };
    for (var i = 0; i < brushSizeSliders.length; i++) {
      brushSizeSliders[i].addEventListener('input', brushSizeChange, false);
    }



    // Drop
    bm1Canvas.addEventListener('drop', dropBaseMap);
    bm1Canvas.addEventListener('dragover', allowDrop);
    bm1Canvas.addEventListener('dragenter', dragenter);
    bm1Canvas.addEventListener('dragleave', dragleave);
    dmCanvas.addEventListener('drop', dropDepthMap);
    dmCanvas.addEventListener('dragover', allowDrop);
    dmCanvas.addEventListener('dragenter', dragenter);
    dmCanvas.addEventListener('dragleave', dragleave);

    function allowDrop(event) {
      event.preventDefault();
    }
    function dropBaseMap(event) {
      event.preventDefault();
      if (event.dataTransfer.files.length != 1) {
        alert("Please only drag one PNG file at a time!");
        return;
      }
      if ("image/png" !== event.dataTransfer.items[0].type) {
        alert("Please make sure your file is in PNG format!");
        return;
      }

      var img = document.createElement("img");
      var reader = new FileReader();
      reader.onload = (function (tmpImg) {
        return function (e) {
          tmpImg.onload = function () {
            if (confirm('Changing the base map will reload the depth map with a blank one. Are you sure?')) {
              bmImage.src = e.target.result;

              // A 300x200 Black PNG
              dmImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAADIAQMAAABoEU4WAAAAA1BMVEUAAACnej3aAAAAHklEQVRYw+3BMQEAAADCIPunNsReYAAAAAAAAAAQHB54AAEGlim3AAAAAElFTkSuQmCC';
            }
          }
          tmpImg.src = e.target.result;
        };
      })(img);
      reader.readAsDataURL(event.dataTransfer.files[0]);
    }
    function dropDepthMap(event) {
      event.preventDefault();
      if (event.dataTransfer.files.length != 1) {
        alert("Please only drag one PNG file at a time!");
        return;
      }
      if ("image/png" !== event.dataTransfer.items[0].type) {
        alert("Please make sure your file is in PNG format!");
        return;
      }

      var img = document.createElement("img");
      var reader = new FileReader();
      reader.onload = (function (tmpImg) {
        return function (e) {
          tmpImg.onload = function () {
            if (confirm('Changing the depth map will reload the depth map with a blank one. Are you sure?')) {
              dmImage.src = e.target.result;
              strokes = [];
              redoList = [];
            }
          }
          tmpImg.src = e.target.result;
        };
      })(img);
      reader.readAsDataURL(event.dataTransfer.files[0]);
    }
    function dragenter(event) {
      event.target.classList.add('uk-dragover');
    }
    function dragleave(event) {
      event.target.classList.remove('uk-dragover');
    }







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


  class BlurFilter extends PIXI.Filter {
    constructor(alpha = 1.0) {
      super(null, blurFrag, { uAlpha: 1, maskMap: PIXI.Texture.EMPTY, depthMap: PIXI.Texture.EMPTY, maskIds: new Array(256) });
      this.alpha = alpha;
    }
    get alpha() {
      return this.uniforms.uAlpha;
    }
    set alpha(value) {
      this.uniforms.uAlpha = value;
    }
    get maskMap() {
      return this.uniforms.maskMap;
    }
    set maskMap(value) {
      this.uniforms.maskMap = value;
    }
    get depthMap() {
      return this.uniforms.depthMap;
    }
    set depthMap(value) {
      this.uniforms.depthMap = value;
    }
    get maskIds() {
      return this.uniforms.maskIds;
    }
    set maskIds(value) {
      this.uniforms.maskIds = value;
    }
    get brushSize() {
      return this.uniforms.brushSize;
    }
    set brushSize(value) {
      this.uniforms.brushSize = value;
    }
    get brushPos() {
      return this.uniforms.brushPos;
    }
    set brushPos(value) {
      this.uniforms.brushPos = value;
    }
    get canvasSize() {
      return this.uniforms.canvasSize;
    }
    set canvasSize(value) {
      this.uniforms.canvasSize = value;
    }
  }
  let blurFrag =
    `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform float uAlpha;

uniform sampler2D maskMap;
uniform int maskIds[256];


uniform sampler2D depthMap;

uniform vec2 brushSize;
uniform vec2 brushPos;
uniform vec2 canvasSize;

#define MAXDISTANCE 10.0

float getMaskColor(vec2 coord)
{
  return (texture2D(maskMap, (coord * brushSize + brushPos) / canvasSize) * uAlpha)[1];
}

vec4 getBrushColor(vec2 coord)
{
  return (texture2D(uSampler, coord));
}

vec4 getDepthColor(vec2 coord)
{
  return (texture2D(depthMap, (coord * brushSize + brushPos) / canvasSize));
}


bool checkDraw(vec2 coord) {
  float f = getMaskColor(coord);
  highp int index = int(f * 256.0);
  for (int i = 0; i < 256; i++) {
    if (index == i) return maskIds[i] == 1;
  }
  return false;
}

bool checkSelection(vec2 coord) {
  float f = getMaskColor(coord);
  highp int index = int(f * 256.0);
  for (int i = 0; i < 256; i++) {
    if (index == i) return maskIds[i] == 1;
  }
  return false;
}

void main(void)
{
  float pixelW = 1.0 / brushSize[0];
  float pixelH = 1.0 / brushSize[1];

  float count = 0.0;
  gl_FragColor =  vec4(0, 0, 0, 0);

  if (getBrushColor(vTextureCoord)[3] == 1.0 && checkSelection(vTextureCoord)) {
    for (float i = -MAXDISTANCE; i <= MAXDISTANCE; ++i) {
      for (float j = -MAXDISTANCE; j <= MAXDISTANCE; ++j) {
        vec2 c = vec2(vTextureCoord[0] + i * pixelW,  vTextureCoord[1] + j * pixelH);
        if (getBrushColor(c)[3] == 1.0 && checkSelection(c)) {
          gl_FragColor += getDepthColor(c);
          count++;
        }
      }
    }
  }

  gl_FragColor /= count;
}
`;

  class BrushFilter extends PIXI.Filter {
    constructor(alpha = 1.0) {
      super(null, brushFrag, { uAlpha: 1, maskMap: PIXI.Texture.EMPTY, maskIds: new Array(256) });
      this.alpha = alpha;
    }
    get alpha() {
      return this.uniforms.uAlpha;
    }
    set alpha(value) {
      this.uniforms.uAlpha = value;
    }
    get maskMap() {
      return this.uniforms.maskMap;
    }
    set maskMap(value) {
      this.uniforms.maskMap = value;
    }
    get maskIds() {
      return this.uniforms.maskIds;
    }
    set maskIds(value) {
      this.uniforms.maskIds = value;
    }
    get brushSize() {
      return this.uniforms.brushSize;
    }
    set brushSize(value) {
      this.uniforms.brushSize = value;
    }
    get brushPos() {
      return this.uniforms.brushPos;
    }
    set brushPos(value) {
      this.uniforms.brushPos = value;
    }
    get canvasSize() {
      return this.uniforms.canvasSize;
    }
    set canvasSize(value) {
      this.uniforms.canvasSize = value;
    }
  }
  let brushFrag =
    `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform float uAlpha;

uniform sampler2D maskMap;
uniform int maskIds[256];

uniform vec2 brushSize;
uniform vec2 brushPos;
uniform vec2 canvasSize;


float getMaskColor(vec2 coord)
{
  return (texture2D(maskMap, (coord * brushSize + brushPos) / canvasSize) * uAlpha)[1];
}

bool checkSelection(vec2 coord) {
  float f = getMaskColor(coord);
  highp int index = int(f * 256.0);
  for (int i = 0; i < 256; i++) {
    if (index == i) return maskIds[i] == 1;
  }
  return false;
}

void main(void)
{
  if (checkSelection(vTextureCoord)) {
    gl_FragColor = texture2D(uSampler, vTextureCoord) * uAlpha;
  } else {
    gl_FragColor =  vec4(0, 0, 0, 0);
  }
}
`;

  let displacementFrag =
    `precision mediump float;
uniform vec2 offset;
uniform vec2 pan;
uniform float zoom;
uniform int displayMode;

uniform sampler2D uSampler;
uniform sampler2D baseMap;
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
        return texture2D(baseMap, c);
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

#define MAXSTEPS 1000.0


float fit = min(canvasSize[0] / textureSize[0], canvasSize[1] / textureSize[1]);
float steps = min(1000.0, max(MAXSTEPS *length(offset  / fit), 30.0));

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


/*

A Custom Algorithm to preserve sub-optimal history snapshots effciently

Issue:
Without any cache snapshot, undoing in the canvas requires redrawing everything starting from the first step.
Adding cached snapshots (aka keyframes) will reduce the need of redrawing everything from beginning.
However, it is not ideal to snapshot after every new drawing step due to storage/memory space issue.

Goal:
Is to maintain only O(log(n)) amount of snapshots across n steps of history.
DO NOT rebuild all snapshots for every new step added. At most delete one old snapshots.


A step is considered a good snapshot position if:
a) its distance to previous snapshot is BIG (i.e. if no snapshot here, high cost to rebuild the stage if user want to undo to this step); and
b) its distance to final step is SMALL (i.e. more recent = user more likely to undo to this step)

Weight A and B the fairly the same

Condition to keep a snapshot:

                        {a} / {b}     > C    // Where C is a configurable constant
>> (distance to previous 1) / (n - i) > 0.5  // Set C to be 0.5
>>                       3 i - 2 j    >  n   // Where j is the index of previous snapshot, j < i


Code:


let cache = [];

for (let n = 1; n <= 50; n++) { // Add 50 steps one by one
  cache.push(n);
  let j = 0; // j is the position of the previous cached object. must older than current position
  for (let k = 0; k < cache.length; k++) {
  let i = cache[k];
    if (3 * i - 2 * j  <=  n) {
      cache = cache.filter(e => e !== i); // delete this cache
      break; // for each new step, it will at most delete one old cache
    } else {
      j = i;
    }
  }
  console.log(cache);
}


result:
[1]
[1,2]
[2,3]
[2,3,4]
[2,4,5]
[4,5,6]
[4,6,7]
[4,6,7,8]
[4,6,8,9]
[4,8,9,10]
[4,8,10,11]
[8,10,11,12]



*/