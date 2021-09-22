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


    window.jigglePositions = [];
    window.jiggleVelocities = [];
    window.jiggleForces = [];
  
    window.jiggleStaticFlags = [];
    window.jiggleMovement = [];
  
    window.damping = [];//1.0 / 8; // 1 2 4 8 16 
    window.springiness = [];//1.0 / 16.0; // 0 2 4 8 16 32 回彈力


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


      bm3Texture = PIXI.Texture.from(bm3Canvas);
      baseMapSprite.texture = bm3Texture;
      reverseMapSprite.texture = bm3Texture;
      needUpdateReverseMapBuffer = true;


      window.displacementFilter.uniforms.baseMap = bmFinalSprite.texture;
      window.offsetFilter.uniforms.baseMap = bm3Texture;


      window.displacementFilter.uniforms.textureWidth = bmImage.width;
      window.displacementFilter.uniforms.textureHeight = bmImage.height;
      window.displacementFilter.uniforms.textureSize = [bmImage.width, bmImage.height];
      window.displacementFilter.uniforms.textureScale = 1.0;


      // After updating baseMap, give it a blank depth map as start
      if (dmImage.src == bmImage.src) {
        let tempCanvas = document.createElement('canvas');
        tempCanvas.width = bmImage.width;
        tempCanvas.height = bmImage.height;
        let tmCtx = tempCanvas.getContext('2d');
        tmCtx.fillStyle = "rgba(127,0,0,1)"; // Everything on the middle plane and mask ID 0
        tmCtx.fillRect(0, 0, bmImage.width, bmImage.height);
        dmImage.src = tempCanvas.toDataURL('image/png');
      }

      resize();
      refreshMaskListPanel(true);
    }
    bmImage.src = bmPath;


    // Load depth map as buffer
    let dmCanvas = document.querySelector("#depth-map-canvas");;
    let dmCtx;
    let dmPath = './f2152_depth.png';
    let dmImage = new Image();
    let dm1Texture = null;
    let dm2Texture = PIXI.Texture.EMPTY;

    let mm2Texture = PIXI.Texture.EMPTY;

    let blueTexture = PIXI.Texture.EMPTY;


    let dm1Sprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    dm1Sprite.name = 'dm1Sprite';

    let dm2Sprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    dm2Sprite.name = 'dm2Sprite';

    let mm2Sprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    mm2Sprite.name = 'mm2Sprite';

    let blueSprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    blueSprite.name = 'blueSprite';

    let maskSprite = new PIXI.Sprite.from(PIXI.Texture.EMPTY);
    maskSprite.name = 'maskSprite';

    dmImage.onload = function () {
      dmCanvas.width = dmImage.width;
      dmCanvas.height = dmImage.height;
      dmCtx = dmCanvas.getContext('2d');
      dmCtx.globalCompositeOperation = 'source-over';
      dmCtx.globalAlpha = 1;
      dmCtx.drawImage(dmImage, 0, 0);

      if (!dm1Texture) {
        dm1Texture = PIXI.Texture.from(dmCanvas);
      } else {
        dm1Texture.update();
      }
      dm2Texture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);


      bmFinalSprite.texture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      dmFinalSprite.texture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      jmFinalSprite.texture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);


      dm1Sprite.texture = dm1Texture; // original opened depth map

      dm2Sprite.texture = dm2Texture;
      maskSprite.texture = dm2Texture;

      mm2Texture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      mm2Sprite.texture = mm2Texture;
      
      blueTexture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      blueSprite.texture = blueTexture;


      window.displacementFilter.uniforms.baseMap = bmFinalSprite.texture;
      window.offsetFilter.uniforms.baseMap = bm3Texture;

      window.displacementFilter.uniforms.displacementMap = dmFinalSprite.texture;
      window.offsetFilter.uniforms.displacementMap = dm2Texture;

      window.displacementFilter.uniforms.jiggleMap = jmFinalSprite.texture;
      window.offsetFilter.uniforms.jiggleMap = dm2Texture; // Not used for offsetFilter


      window.jiggleMeshW = Math.ceil(dmImage.width / 10.0);
      window.jiggleMeshH = Math.ceil(dmImage.height / 10.0);
      window.jiggledBaseMapMesh = new PIXI.SimplePlane(bmFinalSprite.texture, window.jiggleMeshW, window.jiggleMeshH);
      window.jiggledDepthMapMesh = new PIXI.SimplePlane(dm1Texture, window.jiggleMeshW, window.jiggleMeshH);
      window.jiggledBaseMapMesh.scale.set(1, 1);


      // This is the render texture of the jiggled mseh
      window.jiggledDepthMapRT = new PIXI.Sprite(PIXI.RenderTexture.create(dmImage.width, dmImage.height));
      window.jiggledDepthMapRT.visible = false;
      app.stage.addChild(window.jiggledDepthMapRT);

      window.mousex1 = null;
      window.mousey1 = null;
      prepareJiggle(dm1Texture, dm1Texture, dm1Texture);
      window.displacementFilter.uniforms.displacementMap = window.jiggledDepthMapRT.texture;

      window.displacementFilter.uniforms.baseMap = bmFinalSprite.texture;
      
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

      if (!this.uniforms.quality) {
        this.uniforms.quality = 1.0;
      }

      if (!this.uniforms.maskColors && maskColor) {
        this.uniforms.maskColors = [];
        for (let i = 0; i < 256; i++) {
          let color = maskColor[i];
          this.uniforms.maskColors.push(1.0 / 255.0 * color.r);
          this.uniforms.maskColors.push(1.0 / 255.0 * color.g);
          this.uniforms.maskColors.push(1.0 / 255.0 * color.b);
        }
      }


      
    
      ////////
      if (window.jiggledBaseMapMesh) {
        var vertices = window.jiggledBaseMapMesh.geometry.buffers[0].data;
        var vertices2 = window.jiggledDepthMapMesh.geometry.buffers[0].data;

        var newMx = window.displacementFilter.uniforms.offset[0];
        var newMy = window.displacementFilter.uniforms.offset[1];

        var baseMap = bm3Texture;
        var depthMap = dm2Texture;
        if (baseMap && baseMap.baseTexture && depthMap && depthMap.baseTexture) {

          window.My2 = window.My;
          window.Mx2 = window.Mx;
          window.My = newMy;
          window.Mx = newMx;
          for (var y = 0; y < window.jiggleMeshH; y++) {
            for (var x = 0; x < window.jiggleMeshW; x++) {
              resetForce(x, y);
            }
          }

          let aX, aY;
          if (window.Mx && window.My && window.Mx2 && window.My2 && newMx != -999999 && window.Mx != -999999 && window.Mx2 != -999999) {
            aX = (window.Mx2 - window.Mx) - (window.Mx - newMx);
            aY = (window.My2 - window.My) - (window.My - newMy);

            for (var y = 0; y < window.jiggleMeshH; y++) {
              for (var x = 0; x < window.jiggleMeshW; x++) {
                var m = window.jiggleMovement[y * window.jiggleMeshW + x];
                window.jiggleForces[y * window.jiggleMeshW + x].x += aX * m * -50;
                window.jiggleForces[y * window.jiggleMeshW + x].y += aY * m * 50;
              }
            }
          }


          for (var y = 0; y < window.jiggleMeshH; y++) {
            for (var x = 0; x < window.jiggleMeshW; x++) {
              if (x != 0) {
                springUpdate(x - 1, y, x, y);
              }
              if (y != 0) {
                springUpdate(x, y - 1, x, y);
              }
            }
          }


          for (var y = 0; y < window.jiggleMeshH; y++) {
            for (var x = 0; x < window.jiggleMeshW; x++) {
              addDampingForce(x, y);
              update(x, y);
            }
          }


          for (var i = 0; i < window.jigglePositions.length; i++) {
            var pos = window.jigglePositions[i];
            vertices[i * 2] = Math.min(Math.max(pos.x, 0), baseMap.width);
            vertices[i * 2 + 1] = Math.min(Math.max(pos.y, 0), baseMap.height);

            vertices2[i * 2] = vertices[i * 2];
            vertices2[i * 2 + 1] = vertices[i * 2 + 1];
          }
        }
        window.jiggledBaseMapMesh.geometry.buffers[0].update();
        window.jiggledDepthMapMesh.geometry.buffers[0].update();
    
        window.jiggledDepthMapMesh.visible = true;
        app.renderer.render(jiggledDepthMapMesh, window.jiggledDepthMapRT.texture);
        window.jiggledDepthMapMesh.visible = false;

        window.jiggledBaseMapMesh.visible = true;
        app.renderer.render(jiggledBaseMapMesh, window.jiggledBaseMapRT.texture);
        window.jiggledBaseMapMesh.visible = false;
        window.displacementFilter.uniforms.baseMap = window.jiggledBaseMapRT.texture;

      }
      window.displacementFilter.uniforms.maskMap = mmFinalSprite.texture;
      window.displacementFilter.uniforms.maskMapMode = isMaskEditing ? 1 : 0;
      window.displacementFilter.uniforms.selectedMaskId = maskEditingId;


      window.displacementFilter.uniforms.jiggleMap = jmFinalSprite.texture;

      window.displacementFilter.uniforms.jiggleMapMode = isJiggleEditing ? 1 : 0;

      // draw the filter...
      filterManager.applyFilter(this, input, output);
    }

    PIXI.DepthPerspectiveOffsetFilter.apply = function (filterManager, input, output) {
      if (window.displacementFilter && window.displacementFilter.uniforms) {
        this.uniforms.frameWidth = window.displacementFilter.uniforms.frameWidth;
        this.uniforms.frameHeight = window.displacementFilter.uniforms.frameHeight;
        this.uniforms.canvasSize = [app.renderer.width, app.renderer.height];

        this.uniforms.quality = window.displacementFilter.uniforms.quality;

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



    var bmFinalSprite = new PIXI.Sprite(PIXI.RenderTexture.create(600, 800));
    bmFinalSprite.name = 'bmFinalSprite';

    let bmContainer = new PIXI.Container();
    bmContainer.name = 'bmContainer';
    bmContainer.addChild(baseMapSprite);

    let cursorContainer = new PIXI.Container();
    cursorContainer.name = 'cursorContainer';
    bmContainer.addChild(cursorContainer);

    var gridGraphics = new PIXI.Graphics();
    bmContainer.addChild(gridGraphics);


    var dmFinalSprite = new PIXI.Sprite(PIXI.RenderTexture.create(600, 800));
    dmFinalSprite.name = 'dmFinalSprite';

    let dm1Container = new PIXI.Container();
    dm1Container.name = 'dm1Container';
    dm1Container.addChild(dm1Sprite);


    let dm2Container = new PIXI.Container();
    dm2Container.name = 'dm2Container';
    dm2Container.addChild(dm2Sprite);

    
    var mmFinalSprite = new PIXI.Sprite(PIXI.RenderTexture.create(600, 800));
    mmFinalSprite.name = 'mmFinalSprite';

    let mm2Container = new PIXI.Container();
    mm2Container.name = 'mm2Container';
    mm2Container.addChild(mm2Sprite);
    
    let blueContainer = new PIXI.Container();
    blueContainer.name = 'blueContainer';
    blueContainer.addChild(blueSprite);

    var jmFinalSprite = new PIXI.Sprite(PIXI.RenderTexture.create(600, 800));
    jmFinalSprite.name = 'jmFinalSprite';


    let maskContainer = new PIXI.Container();
    maskContainer.name = 'maskContainer';
    maskContainer.addChild(maskSprite);


    let depthCacheContainer = new PIXI.Container();
    depthCacheContainer.name = 'depthCacheContainer';

    let maskCacheContainer = new PIXI.Container();
    maskCacheContainer.name = 'maskCacheContainer';

    let jiggleCacheContainer = new PIXI.Container();
    jiggleCacheContainer.name = 'jiggleCacheContainer';

    app.stage.addChild(depthCacheContainer);
    app.stage.addChild(maskCacheContainer);
    app.stage.addChild(jiggleCacheContainer);

    app.stage.addChild(maskContainer);

    app.stage.addChild(dmFinalSprite);
    app.stage.addChild(bmFinalSprite);
    app.stage.addChild(mmFinalSprite);
    app.stage.addChild(jmFinalSprite);
    app.stage.addChild(mm2Container);
    app.stage.addChild(blueContainer);
    app.stage.addChild(bmContainer);
    app.stage.addChild(dm2Container);


    app.stage.addChild(containerReverseMap);
    app.stage.addChild(container);



    // app.stage.addChild(window.jiggledDepthMapRT);
    // app.stage.addChild(window.jiggledBaseMapRT);



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
          if (modifyKey == 'shift') {
            let checkbox = document.getElementById('mask-' + document.getElementById('mask-id-span').innerText);
            if (checkbox) {
              checkbox.checked = true;
              updateMaskIndicator();
            }
          } else if (modifyKey == 'alt') {
            let checkbox = document.getElementById('mask-' + document.getElementById('mask-id-span').innerText);
            if (checkbox) {
              checkbox.checked = false;
              updateMaskIndicator();
            }
          } else {
            startDrawing();
          }
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
          if (isDrawing) {
            endDrawing();
          }
          break;
      }
    }
    );

    window.displacementFilter.uniforms.zoom = 1.0;
    $('#main-canvas').bind('mousewheel', function (e) {

      // When pressing ctrl, change brush size
      if (e.ctrlKey) {
        // Prevent Chrome to scale the page
        e.preventDefault();

        if (e.originalEvent.wheelDelta > 0 && brushSizeSliders[0].value < 200 && !isDrawing) {
          brushSizeSliders[0].value = parseInt(brushSizeSliders[0].value) * 1.1 + 1;
          brushSizeChange({target:{value:brushSizeSliders[0].value}});
        } else if (e.originalEvent.wheelDelta < 0 && brushSizeSliders[0].value > 1 && !isDrawing) {
          brushSizeSliders[0].value = (parseInt(brushSizeSliders[0].value) - 1) * 0.9;
          brushSizeChange({target:{value:brushSizeSliders[0].value}});
        }
        return;
      }

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

        if (window.jiggledBaseMapMesh) {
          var vertices = window.jiggledBaseMapMesh.geometry.buffers[0].data;
          renderVertices(vertices);
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

          // only enable filter when updating cursor position map cache
          containerReverseMap.filters = [window.offsetFilter];

          if (isPanning || isTilting || isDrawing) {

            if (!isDrawing) {
              // Reduce cursor position accuracy if not drawing for high FPS when panning or tilting
              // Drawing still need high cursor position accuracy
              PIXI.DepthPerspectiveFilter.uniforms.quality = 0.1;
            }

            // If the user is changing the viewport, there is not useful to cache the full screen reverse map
            // We only pick one pixel for the current cursor position
            let rgba = extractOnePixel(containerReverseMap, x, y);

            // Resume cursor position accuracy
            PIXI.DepthPerspectiveFilter.uniforms.quality = 1.0;

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

          // disable filter to improve performance when no need to updating cursor position cache
          containerReverseMap.filters = [];
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


        
        // Update cursor tooltip
        if (modifyKey != '') {
          document.getElementById('tooltip-span').style.visibility = "visible";

          let depthValue = extractOnePixel(dm2Container, curOnTexX, curOnTexY)[0];
          let maskId = extractOnePixel(mm2Container, curOnTexX, curOnTexY)[1];
          document.getElementById('depth-value-span').innerText = depthValue;
          document.getElementById('mask-id-span').innerText = maskId;
          document.getElementById('tooltip-span').style.backgroundColor = "rgba(" + (maskColor[maskId].r / 2 + 127) + "," + (maskColor[maskId].g / 2 + 127) + "," + (maskColor[maskId].b / 2 + 127) + "," + 1 + ")";
        } else {
          document.getElementById('tooltip-span').style.visibility = "hidden";
        }
      }
      app.renderer.render(bmContainer, bmFinalSprite.texture);
      if (window.jiggledBaseMapMesh) {
        window.jiggledBaseMapMesh.textureUpdated();
      }
      app.renderer.render(dm2Container, dmFinalSprite.texture);
      if (window.jiggledDepthMapMesh) {
        window.jiggledDepthMapMesh.textureUpdated();
      }
      app.renderer.render(mm2Container, mmFinalSprite.texture);

      app.renderer.render(blueContainer, jmFinalSprite.texture);
      // if (window.jiggledDepthMapMesh) {
      //   window.jiggledDepthMapMesh.textureUpdated();
      // }
    }
    PIXI.Ticker.shared.add(step);

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
        invalidCacheSnapshots[k].jm.destroy(true);
      }
      cacheSnapshots = cacheSnapshots.filter(e => e.step <= strokes.length - 1);



      if (isMaskEditing) {
        strokes[strokes.length - 1].r1 = parseInt(brushSizeSliders[0].value);
        strokes[strokes.length - 1].value = maskEditingId;
        strokes[strokes.length - 1].isMaskEditing = true;
      } else if (isJiggleEditing) {
        strokes[strokes.length - 1].r1 = parseInt(brushSizeSliders[0].value);
        strokes[strokes.length - 1].value = parseInt(document.getElementById('jiggle-value-slider').value);
        strokes[strokes.length - 1].isJiggleEditing = true;
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
      updateCache();
      if (isDrawing) {
        resetJiggleMovementFromDepth(dm2Texture);
      }
      isDrawing = false;
      if (isMaskEditing) {
        refreshMaskListPanel();
      }
      if (isJiggleEditing) {

      
        let currentJiggleRenderTexture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
        var jiggleCacheSprite = new PIXI.Sprite(currentJiggleRenderTexture);
        jiggleCacheContainer.addChild(jiggleCacheSprite);
        app.renderer.render(blueContainer, currentJiggleRenderTexture);
  
        resetJiggleStrength(currentJiggleRenderTexture);
      }
    }

    let strokes = [];

    let cacheSnapshots = [];

    
    function updateCache() {
      let stepNum = strokes.length;

      let currentDepthRenderTexture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      var depthCacheSprite = new PIXI.Sprite(currentDepthRenderTexture);
      depthCacheSprite.name = 'stepCacheSprite-' + stepNum;
      depthCacheContainer.addChild(depthCacheSprite);

      let currentMaskRenderTexture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      var maskCacheSprite = new PIXI.Sprite(currentMaskRenderTexture);
      maskCacheSprite.name = 'maskCacheSprite-' + stepNum;
      maskCacheContainer.addChild(maskCacheSprite);


      let currentJiggleRenderTexture = PIXI.RenderTexture.create(dmImage.width, dmImage.height);
      var jiggleCacheSprite = new PIXI.Sprite(currentJiggleRenderTexture);
      jiggleCacheSprite.name = 'jiggleCacheSprite-' + stepNum;
      jiggleCacheContainer.addChild(jiggleCacheSprite);


      if (strokes.length == 0) {
        app.renderer.render(dm1Sprite, currentDepthRenderTexture);
        app.renderer.render(dm1Sprite, currentMaskRenderTexture);
        app.renderer.render(dm1Sprite, currentJiggleRenderTexture);
      } else {
        app.renderer.render(dm2Container, currentDepthRenderTexture);
        app.renderer.render(mm2Container, currentMaskRenderTexture);
        app.renderer.render(blueContainer, currentJiggleRenderTexture);
      }

      cacheSnapshots.push({ step: stepNum, dm: depthCacheSprite, mm: maskCacheSprite , jm: jiggleCacheSprite });
      let j = 0; // j is the position of the previous cached object. must older than current position
      for (let k = 1; k < cacheSnapshots.length; k++) {
        let c = cacheSnapshots[k];
        if (3 * c.step - 2 * j <= stepNum) {
          cacheSnapshots = cacheSnapshots.filter(e => e !== c); // delete this cache
          c.dm.destroy(true);
          c.mm.destroy(true);
          c.jm.destroy(true);
          break; // for each new step, it will at most delete one old cache
        } else {
          j = c.step;
        }
      }

      app.renderer.render(depthCacheSprite, dm2Texture);
      app.renderer.render(maskCacheSprite, mm2Texture);
      app.renderer.render(jiggleCacheSprite, blueTexture);

      // remove all children
      while (dm2Container.children[0]) {
        dm2Container.removeChild(dm2Container.children[0]);
      }
      dm2Container.addChild(dm2Sprite);

      while (mm2Container.children[0]) {
        mm2Container.removeChild(mm2Container.children[0]);
      }
      mm2Container.addChild(mm2Sprite);
      
      while (blueContainer.children[0]) {
        blueContainer.removeChild(blueContainer.children[0]);
      }
      blueContainer.addChild(blueSprite);
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
      if (cacheSnapshots.length == 0) {
        updateCache();
      }
      let cached;
      for (let k = 0; k < cacheSnapshots.length; k++) {
        if (cacheSnapshots[k].step <= strokes.length) {
          cached = cacheSnapshots[k];
        }
      }
      app.renderer.render(cached.dm, dm2Texture);
      app.renderer.render(cached.mm, mm2Texture);
      app.renderer.render(cached.jm, blueTexture);

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
      while (blueContainer.children[0]) {
        blueContainer.removeChild(blueContainer.children[0]);
      }
      blueContainer.addChild(blueSprite);


      // Draw all uncached steps
      let maskUpdated = false;
      for (let i = cached.step; i < strokes.length; i++) {
        if (strokes[i].isMaskEditing) {
          drawMaskLine2(strokes[i], strokes[i].path, strokes[i].r1, strokes[i].value)
          maskUpdated = true;
        } else if (strokes[i].isJiggleEditing) {
          drawJiggleine2(strokes[i], strokes[i].path, strokes[i].r1, strokes[i].value);
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

        let point3;
        let point2;
        let point1;
        for (let index = 0; index < path.length; ++index) {
          let point = path[index];
          if ((point3 && point.x == point3.x && point.y == point3.y)
           || (point2 && point.x == point2.x && point.y == point2.y)
           || (point1 && point.x == point1.x && point.y == point1.y)) {
            // pixi has bug when drawing line when position n is same as n+2
            // https://github.com/pixijs/pixijs/issues/5006
            // skip this position
          } else {
            pixiLine.lineTo(point.x - 0.5, point.y - 0.5);
            point3 = point2;
            point2 = point1;
            point1 = point;
          }
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
        li.style.backgroundColor = "rgba(" + maskColor[maskId].r + "," + maskColor[maskId].g + "," + maskColor[maskId].b + "," + 0.5 + ")";

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

    let isJiggleEditing = false;
    


    function updateMaskIndicator() {
      // Redraw the basemap
      bm2Ctx = bm2Canvas.getContext('2d');
      bm2Ctx.clearRect(0, 0, bmImage.width, bmImage.height);
      bm2Ctx.drawImage(bmImage, 0, 0);

      if (!isMaskEditing && isMaskIndicatorOn) {

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
      brushFilter.maskMap = mm2Texture;
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

        
        let point3;
        let point2;
        let point1;
        for (let index = 0; index < path.length; ++index) {
          let point = path[index];
          if ((point3 && point.x == point3.x && point.y == point3.y)
           || (point2 && point.x == point2.x && point.y == point2.y)
           || (point1 && point.x == point1.x && point.y == point1.y)) {
            // pixi has bug when drawing line when position n is same as n+2
            // https://github.com/pixijs/pixijs/issues/5006
            // skip this position
          } else {
            pixiLine.lineTo(point.x - 0.5, point.y - 0.5);
            point3 = point2;
            point2 = point1;
            point1 = point;
          }
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
    

    function drawJiggleine2(stroke, path, radius, depth) {
      if (stroke.lines) {
        for (let index = 0; index < stroke.lines.length; ++index) {
          stroke.lines[index].destroy(true);
        }
        stroke.lineContainer.destroy(true);
      }
      stroke.lineContainer = new PIXI.Container();
      stroke.lineContainer.name = 'line(jiggle)';
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
          color: depth << 0, // Red channel 8bit to RGB 32bit: no bitwise change
          alignment: 0.5,
          join: 'round',
          cap: 'round'
        }).moveTo(path[0].x - 0.5, path[0].y - 0.5);
        pixiLine.name = 'flatLine a:' + 1 + ' r:' + radius;

        
        let point3;
        let point2;
        let point1;
        for (let index = 0; index < path.length; ++index) {
          let point = path[index];
          if ((point3 && point.x == point3.x && point.y == point3.y)
           || (point2 && point.x == point2.x && point.y == point2.y)
           || (point1 && point.x == point1.x && point.y == point1.y)) {
            // pixi has bug when drawing line when position n is same as n+2
            // https://github.com/pixijs/pixijs/issues/5006
            // skip this position
          } else {
            pixiLine.lineTo(point.x - 0.5, point.y - 0.5);
            point3 = point2;
            point2 = point1;
            point1 = point;
          }
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
      brushFilter.maskIds = Array(256).fill(1); // Jiggle map don't care about mask

      blueContainer.addChild(stroke.lineContainer);
    }

    function createDownloadCanvas() {
      let tempCanvas = document.createElement('canvas');
      tempCanvas.width = dmCanvas.width;
      tempCanvas.height = dmCanvas.height;
      let tmCtx = tempCanvas.getContext('2d');
      let tmImageData = tmCtx.createImageData(dmCanvas.width, dmCanvas.height);
      let tmdd = tmImageData.data;


      let dmData = extractPixelsWithoutPostmultiply(dm2Container);
      let mmDate = extractPixelsWithoutPostmultiply(mm2Container);
      let jmDate = extractPixelsWithoutPostmultiply(blueContainer);

      for (var i = 0; i < tmdd.length; i += 4) {
        tmdd[i + 0] = dmData[i + 0]; // the depth data
        tmdd[i + 1] = mmDate[i + 1]; // the mask ID data
        tmdd[i + 2] = jmDate[i + 2]; // reserved only. currently not used.
        tmdd[i + 3] = 255; // reserved only. currently always full
      }
      tmCtx.putImageData(tmImageData, 0, 0);
      return tempCanvas;
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
      link.href = createDownloadCanvas().toDataURL('image/png');
      link.click();
      link.delete;
    });

    
    document.getElementById('top-switcher').addEventListener("show", function (e) {
      let old = isJiggleEditing;
      isJiggleEditing = e.detail[0].index() == 3;

      // TODO: add this logic to auto finish mask editing when switch tab
      // isMaskEditing = isMaskEditing && e.detail[0].index() == 2;
      // updateMaskIndicator();
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

              strokes = [];
              redoList = [];
              for (let k = 0; k < cacheSnapshots.length; k++) {
                cacheSnapshots[k].dm.destroy(true);
                cacheSnapshots[k].mm.destroy(true);
                cacheSnapshots[k].jm.destroy(true);
              }
              cacheSnapshots = [];


              // Just to make sure DM has an image of same size
              dmImage.src = e.target.result;
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

              for (let k = 0; k < cacheSnapshots.length; k++) {
                cacheSnapshots[k].dm.destroy(true);
                cacheSnapshots[k].mm.destroy(true);
                cacheSnapshots[k].jm.destroy(true);
              }
              cacheSnapshots = [];
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
      } else if (key.key === '4') {
        gridGraphics.visible = !gridGraphics.visible;
      } else if (key.key === 'q') {
        UIkit.switcher("#top-tab").show(0);
      } else if (key.key === 'w') {
        UIkit.switcher("#top-tab").show(1);
      } else if (key.key === 'e') {
        UIkit.switcher("#top-tab").show(2);
      } else if (key.key === 'r') {
        UIkit.switcher("#top-tab").show(3);
      } else if (key.key === 't') {
        UIkit.switcher("#top-tab").show(4);
      } else if (key.key === 'y') {
        UIkit.switcher("#top-tab").show(5);
      } else if (key.key === 'a') {
        UIkit.switcher("#top-tab").show(1);
        UIkit.switcher("#brush-tab").show(0);
        UIkit.switcher("#brush-switcher").show(0);
      } else if (key.key === 's') {
        UIkit.switcher("#top-tab").show(1);
        UIkit.switcher("#brush-tab").show(1);
        UIkit.switcher("#brush-switcher").show(1);
      } else if (key.key === 'd') {
        UIkit.switcher("#top-tab").show(1);
        UIkit.switcher("#brush-tab").show(2);
        UIkit.switcher("#brush-switcher").show(2);

      } else if (key.key === 'z') {
        UIkit.switcher("#top-tab").show(1);
        UIkit.switcher("#flip-switcher").show(0);
        UIkit.switcher("#pen-flip-switcher").show(0);
        UIkit.switcher("#brush-tab").show(0);
        UIkit.switcher("#brush-switcher").show(0);
      } else if (key.key === 'x') {
        UIkit.switcher("#top-tab").show(1);
        UIkit.switcher("#flip-switcher").show(1);
        UIkit.switcher("#pen-flip-switcher").show(1);
        UIkit.switcher("#brush-tab").show(0);
        UIkit.switcher("#brush-switcher").show(0);


      } else if (key.key === ',' && strokes.length != 0 && !isDrawing) {
        redoList.push(strokes.pop());
        redraw();
        document.getElementById('undo-button').disabled = strokes.length == 0;
        document.getElementById('redo-button').disabled = false;
      } else if (key.key === '.' && redoList.length != 0 && !isDrawing) {
        strokes.push(redoList.pop());
        redraw()
        document.getElementById('undo-button').disabled = false;
        document.getElementById('redo-button').disabled = redoList.length == 0;
      }


      if (key.altKey) {
        key.preventDefault();
        modifyKey = 'alt';
      } else if (key.shiftKey) {
        key.preventDefault();
        modifyKey = 'shift';
      } else {
        modifyKey = '';
      }
    }
    document.addEventListener('keydown', onKeyDown);

    
    function onKeyUp(key) {
      modifyKey = '';
    }
    document.addEventListener('keyup', onKeyUp);

    
    let modifyKey = '';

    var tooltipSpan = document.getElementById('tooltip-span');

    window.onmousemove = function (e) {
      let x = e.clientX;
      let y = e.clientY;
      tooltipSpan.style.top = (y + 40) + 'px';
      tooltipSpan.style.left = (x + 40) + 'px';


      if (e.altKey) {
        key.preventDefault();
        modifyKey = 'alt';
      } else if (e.shiftKey) {
        key.preventDefault();
        modifyKey = 'shift';
      } else {
        modifyKey = '';
      }
    };



    //// Jiggle related
    function prepareJiggle(baseMapTexture, DepthMapTexture, JiggleMapTexture) {

      window.jigglePositions = [];
      window.jiggleVelocities = [];
      window.jiggleForces = [];

      window.jiggleStaticFlags = [];
      window.jiggleMovement = [];

      window.damping = [];
      window.springiness = [];
      
     
      // the jiggle map is loaded from image resource, we can directly get the img data using a virtual canvas
      var depthImg = JiggleMapTexture.baseTexture.resource.source;
      var tempCanvas = document.createElement('canvas');
      tempCanvas.width = depthImg.width;
      tempCanvas.height = depthImg.height;
      let tmCtx = tempCanvas.getContext('2d');
      tmCtx.drawImage(depthImg, 0, 0);
      let jmData = tmCtx.getImageData(0, 0, depthImg.width, depthImg.height).data;


      // the jiggle map is loaded from image resource, we can directly get the img data using a virtual canvas
      var depthImg = DepthMapTexture.baseTexture.resource.source;
      var tempCanvas = document.createElement('canvas');
      tempCanvas.width = depthImg.width;
      tempCanvas.height = depthImg.height;
      tmCtx = tempCanvas.getContext('2d');
      tmCtx.drawImage(depthImg, 0, 0);
      let dmData = tmCtx.getImageData(0, 0, depthImg.width, depthImg.height).data;


      window.jiggleMeshW = Math.ceil(baseMapTexture.width / 10.0);
      window.jiggleMeshH = Math.ceil(baseMapTexture.height / 10.0);

      // This is the jiggled mseh
      window.jiggledDepthMapMesh = new PIXI.SimplePlane(dmFinalSprite.texture, window.jiggleMeshW, window.jiggleMeshH);

      // This is the render texture of the jiggled mseh
      window.jiggledDepthMapRT = new PIXI.Sprite(PIXI.RenderTexture.create(baseMapTexture.width, baseMapTexture.height));
      window.jiggledDepthMapRT.visible = false;
      window.jiggledBaseMapRT = new PIXI.Sprite(PIXI.RenderTexture.create(baseMapTexture.width, baseMapTexture.height));
      window.jiggledBaseMapRT.visible = false;

      
      window.jiggledBaseMapMesh = new PIXI.SimplePlane(bmFinalSprite.texture, window.jiggleMeshW, window.jiggleMeshH);
      
      app.stage.addChild(window.jiggledDepthMapRT);
      app.stage.addChild(window.jiggledDepthMapMesh);
      app.stage.addChild(window.jiggledBaseMapMesh);
      app.stage.addChild(window.jiggledBaseMapRT);
      
      window.gridW = baseMapTexture.width / (window.jiggleMeshW - 1.0);
      window.gridH = baseMapTexture.height / (window.jiggleMeshH - 1.0);
      for (var y = 0; y < window.jiggleMeshH; y++) {
        for (var x = 0; x < window.jiggleMeshW; x++) {
          window.jigglePositions.push({ x: window.gridW * x, y: y * window.gridH });
          window.jiggleVelocities.push({ x: 0, y: 0 });
          window.jiggleForces.push({ x: 0, y: 0 });

          var r = dmData[(Math.floor(y * window.gridH) * baseMapTexture.width + Math.floor(x * window.gridW)) * 4 + 0];
          var b = jmData[(Math.floor(y * window.gridH) * baseMapTexture.width + Math.floor(x * window.gridW)) * 4 + 2];

          window.damping.push(1.0 / (b / 255.0 * 16.0 + 1));
          window.springiness.push(1.0 / (b / 255.0 * 32.0 + 1));

          window.jiggleStaticFlags.push(b == 0);
          window.jiggleMovement.push((r - 127.0) / 128.0);
        }
      }
      
      window.Mx = null;
      window.My = null;
      window.Mx2 = null;
      window.My2 = null;
    }

    
    function resetJiggleMovementFromDepth(depthMapTexture) {
      console.log('resetJiggleMovementFromDepth');
      let dmData = extractPixelsWithoutPostmultiply(depthMapTexture);

      window.jiggleMovement = [];
      for (var y = 0; y < window.jiggleMeshH; y++) {
        for (var x = 0; x < window.jiggleMeshW; x++) {
          var r = dmData[(Math.floor(y * window.gridH) * depthMapTexture.width + Math.floor(x * window.gridW)) * 4 + 0];
          window.jiggleMovement.push((r - 127.0) / 128.0);
        }
      }

      window.Mx = null;
      window.My = null;
      window.Mx2 = null;
      window.My2 = null;
    }

    function resetJiggleStrength(JiggleMapTexture) {
      console.log('resetJiggleStrength');
      let jmData = extractPixelsWithoutPostmultiply(JiggleMapTexture);

      window.jiggleStaticFlags = [];
      window.damping = [];
      window.springiness = [];
      for (var y = 0; y < window.jiggleMeshH; y++) {
        for (var x = 0; x < window.jiggleMeshW; x++) {
          var b = jmData[(Math.floor(y * window.gridH) * JiggleMapTexture.width + Math.floor(x * window.gridW)) * 4 + 2];

          window.damping.push(1.0 / (b / 255.0 * 16.0 + 1));
          window.springiness.push(1.0 / (b / 255.0 * 32.0 + 1));
          window.jiggleStaticFlags.push(b == 0);
        }
      }


      window.Mx = null;
      window.My = null;
      window.Mx2 = null;
      window.My2 = null;
    }


    function resetForce(x, y) {
      window.jiggleForces[y * window.jiggleMeshW + x] = { x: 0, y: 0 };
    }

    function addForce(x, y, addX, addY) {
      var f = window.jiggleForces[y * window.jiggleMeshW + x];
      f.x += addX;
      f.y += addY;
    }

    function addDampingForce(x, y) {
      var v = jiggleVelocities[y * window.jiggleMeshW + x];
      var f = window.jiggleForces[y * window.jiggleMeshW + x];
      f.x -= v.x * window.damping[y * window.jiggleMeshW + x];
      f.y -= v.y * window.damping[y * window.jiggleMeshW + x];
    }


    function update(x, y) {
      var p = window.jigglePositions[y * window.jiggleMeshW + x];
      var v = window.jiggleVelocities[y * window.jiggleMeshW + x];
      var f = window.jiggleForces[y * window.jiggleMeshW + x];

      if (window.jiggleStaticFlags[y * window.jiggleMeshW + x] == false) {
          v.x += f.x;
          v.y += f.y;
          p.x += v.x;
          p.y += v.y;
      }
    }

    function springUpdate(x1, y1, x2, y2) {
      let i1 = x1 + y1 * window.jiggleMeshW;
      let i2 = x2 + y2 * window.jiggleMeshW;
      if (window.jiggleStaticFlags[i1] && window.jiggleStaticFlags[i2]) 
          return;

      let distanceOrigin = (x2 - x1) * window.gridW + (y2 - y1) * window.gridH;
      
      let diff = sub(window.jigglePositions[i1], window.jigglePositions[i2]);
      let distance = len(diff);

      let springiness = (window.springiness[i1] + window.springiness[i2]) / 2.0;

      let springForce = springiness * (distanceOrigin - distance);
      let frcToAdd = tim(diff, 1.0 / distance * springForce);

      addForce(x1, y1, frcToAdd.x, frcToAdd.y);
      addForce(x2, y2, -frcToAdd.x, -frcToAdd.y);
    }


    function len(v) {
      return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    function normalize(v) {
      var l = len(v);
      v.x /= l;
      v.y /= l;
      return v;
    }

    function sub(v1, v2) {
      return { x: v1.x - v2.x, y: v1.y - v2.y }
    }

    function tim(v1, s) {
      v1.x *= s;
      v1.y *= s;
      return v1;
    }

    function renderVertices(vertices) {
      // Drawing lines are very costly
      // Draw minimum number of lines by combining static vertices in a row

      gridGraphics.clear();
      gridGraphics.lineStyle(1, 0xffc2c2, 0.1);

      var w = window.jiggleMeshW;
      var h = window.jiggleMeshH;


      // Horizontal lines
      let lineCount = 0;
      for (var r = 0; r < h; r++) {
        let x = 0;
        gridGraphics.moveTo(vertices[(r * w + x) * 2], vertices[(r * w + x) * 2 + 1]);

        while (x + 1 < w) {
          if (window.jiggleStaticFlags[r * w + x]) {
            let x2 = x;
            while (window.jiggleStaticFlags[r * w + x2 + 1] && x2 + 1 < w) {
              x2++;
            }
            if (x2 != x) {
              gridGraphics.lineTo(vertices[(r * w + x2) * 2], vertices[(r * w + x2) * 2 + 1]);
              lineCount++;
              x = x2;
            } else {
              x++;
              gridGraphics.lineTo(vertices[(r * w + x) * 2], vertices[(r * w + x) * 2 + 1]);
              lineCount++;
            }
          } else {
            x++;
            gridGraphics.lineTo(vertices[(r * w + x) * 2], vertices[(r * w + x) * 2 + 1]);
            lineCount++;
          }
        }
      }

      // Vertical lines
      for (var r = 0; r < w; r++) {
        let y = 0;
        gridGraphics.moveTo(vertices[(r + w * y) * 2], vertices[(r + w * y) * 2 + 1]);

        while (y + 1 < h) {
          if (window.jiggleStaticFlags[r + w * y]) {
            let y2 = y;
            while (window.jiggleStaticFlags[r + w * y2 + w] && y2 + 1 < h) {
              y2++;
            }
            if (y2 != y) {
              gridGraphics.lineTo(vertices[(r + w * y2) * 2], vertices[(r + w * y2) * 2 + 1]);
              y = y2;
            } else {
              y++;
              gridGraphics.lineTo(vertices[(r + w * y) * 2], vertices[(r + w * y) * 2 + 1]);
            }
          } else {
            y++;
            gridGraphics.lineTo(vertices[(r + w * y) * 2], vertices[(r + w * y) * 2 + 1]);
          }
        }
      }
    }



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

uniform sampler2D jiggleMap;
uniform int jiggleMapMode;

uniform sampler2D maskMap;
uniform int selectedMaskId;
uniform float maskColors[768]; // 3 channels (RGB) * 256
uniform int maskMapMode;

uniform float textureScale;
uniform vec2 textureSize;
uniform float textureWidth;
uniform float textureHeight;
uniform float frameWidth;
uniform float frameHeight;
uniform vec2 canvasSize;

uniform vec4 filterArea;
uniform vec4 filterClamp;

uniform float quality;


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

vec4 textureDiffuseNoBg(vec2 coord)
{
    vec2 c = textureDiffuseCoor(coord);

    if (c[0] <= 0.0 || c[0] >= 1.0 || c[1] <= 0.0 || c[1] >= 1.0)
    {
        return vec4(0.0);
    }
    else
    {
        return texture2D(baseMap, c);
    }
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

const float dmin = 0.0;
const float dmax = 1.0;

// sqrt(2)
#define MAXOFFSETLENGTH 1.41421356
// 10 * 1.1
#define MAXZOOM 11.0

#define MAXSTEPS 1000.0


float fit = min(canvasSize[0] / textureSize[0], canvasSize[1] / textureSize[1]);
float steps = min(1000.0, max(MAXSTEPS *length(offset  / fit), 30.0)) * quality;

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

    float dstep = 1.0 / (steps - 1.0);
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

        // This is good for in-game rendering but bad for cursor projection when drawing depth maps
        // if (textureDiffuseNoBg(vpos)[3] == 0.0)
        // {
        //     depth = 0.0;
        // }

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

          return;
    }

    if (jiggleMapMode == 1) {
      float jiggleStr = texture2D(jiggleMap, textureDiffuseCoor(coord))[2];
      if (jiggleStr != 0.0) {
        gl_FragColor[0] /= 2.0;
        gl_FragColor[0] += jiggleStr / 2.0;
        gl_FragColor[1] /= 2.0;
        gl_FragColor[1] += 0.5 - jiggleStr / 2.0;
      }
    }


    if (maskMapMode == 1) {
      float maskId = texture2D(maskMap, textureDiffuseCoor(coord))[1];
      int j = int(1. * floor(maskId * 256.0 + 0.5));

      for (int i = 0; i < 256; i++) {
        if (i == j && selectedMaskId != i) {
          vec4 maskCol = vec4(maskColors[3 * i], maskColors[3 * i + 1], maskColors[3 * i + 2], 1.);
          gl_FragColor = gl_FragColor * 0.33 + maskCol * 0.64;
        }
      }
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