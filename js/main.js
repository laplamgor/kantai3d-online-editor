(function () {
  'use strict';

  function init() {
    var imageData2;

    var curOnTexX = 0;
    var curOnTexY = 0;

    // Get texture data as buffer
    var path = './0463_7319_grmdtyheocuc_depth.png';
    var img2 = new Image();
    img2.onload = function () {
      var tempCanvas = document.createElement("CANVAS");;
      tempCanvas.width = img2.width;
      tempCanvas.height = img2.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img2, 0, 0);
      imageData2 = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }
    img2.src = path;

    var reverseMapBuffer;
    var needUpdateReverseMapBuffer = true;

    PIXI.DepthPerspectiveFilter = new PIXI.Filter(null, frag);
    PIXI.DepthPerspectiveFilter.apply = function (filterManager, input, output) {
      this.uniforms.dimensions = {};
      if (input && input.size) {
        this.uniforms.frameWidth = input.size.width;
        this.uniforms.frameHeight = input.size.height;
      }

      this.uniforms.canvasSize = {};
      this.uniforms.canvasSize[0] = app.renderer.width;
      this.uniforms.canvasSize[1] = app.renderer.height;

      // draw the filter...
      filterManager.applyFilter(this, input, output);
    }

    PIXI.DepthPerspectiveOffsetFilter = new PIXI.Filter(null, frag);
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

        this.uniforms.displacementMap = window.displacementFilter.uniforms.displacementMap;
      }
      this.uniforms.displayMode = 3;

      // draw the filter...
      filterManager.applyFilter(this, input, output);
    }

    const app = new PIXI.Application(
      {
        view: document.querySelector("#canvas"),
        width: 50,
        height: 50
      }
    );

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

    window.addEventListener('mousedown', function (event) {
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
          break;
      }

      if (imageData2 && imageData2.data) {
        console.log('curOnTexX: ' + curOnTexX + '  curOnTexY: ' + curOnTexY);
      }
    }
    );

    window.addEventListener('mouseup', function (event) {
      switch (event.button) {
        case 2:
          isTilting = false;
          break;
        case 1:
          isPanning = false;
          break;
      }
    }
    );

    window.displacementFilter.uniforms.zoom = 1.0;
    $('#canvas').bind('mousewheel', function (e) {
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
        if (endx != app.renderer.plugins.interaction.mouse.global.x || endy != app.renderer.plugins.interaction.mouse.global.y) {
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

      }


      if (needUpdateReverseMapBuffer) {
        needUpdateReverseMapBuffer = false;
        reverseMapBuffer = app.renderer.extract.pixels(containerReverseMap);
      }

      if (window.displacementFilter.uniforms && window.displacementFilter.uniforms.canvasSize && window.displacementFilter.uniforms.textureSize) {
        var xdiff = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4];
        var xdiffExtra = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4 + 2];
        var ydiff = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4 + 1];
        var ydiffExtra = reverseMapBuffer[(Math.round(app.renderer.plugins.interaction.mouse.global.y) * window.displacementFilter.uniforms.canvasSize[0] + Math.round(app.renderer.plugins.interaction.mouse.global.x)) * 4 + 3];
  
        bunnyReverse.x = (xdiff / 256.0 + xdiffExtra / 65536) * window.displacementFilter.uniforms.canvasSize[0];
        bunnyReverse.y = (ydiff / 256.0 + ydiffExtra / 65536) * window.displacementFilter.uniforms.canvasSize[1];
  
  
        curOnTexX = bunnyReverse.x * window.displacementFilter.uniforms.textureSize[0] / window.displacementFilter.uniforms.canvasSize[0];
        curOnTexY = bunnyReverse.y * window.displacementFilter.uniforms.textureSize[1] / window.displacementFilter.uniforms.canvasSize[1];
  
      }

      window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);

    // Listen for window resize events
    window.addEventListener('resize', resize);

    // Resize function window
    function resize() {
      // Resize the renderer
      var c = $("#canvas");
      c.prop('width', window.innerWidth);
      c.prop('height', window.innerHeight);
      app.renderer.resize(window.innerWidth, window.innerHeight);

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

    // Load the image as the default
    function loadBaseImage() {
      var path = './0463_7319_grmdtyheocuc_depth.psd';

      if (path.toLowerCase().indexOf("_depth.psd") === -1) {
        return; // Only generate PNG depth map if matching file name format
      }
      var url = path.replace('_depth', '').replace('.psd', '.png') + "?_=" + (new Date().getTime());
      var img = new Image();
      img.onload = function () {
        var baseTexture = new PIXI.BaseTexture(img);
        var texture = new PIXI.Texture(baseTexture);
        depthMapImage.texture = texture;
        depthMapImage2.texture = texture;
        needUpdateReverseMapBuffer = true;

        window.displacementFilter.uniforms.textureWidth = depthMapImage.texture.width;
        window.displacementFilter.uniforms.textureHeight = depthMapImage.texture.height;

        window.displacementFilter.uniforms.textureSize = [depthMapImage.texture.width, depthMapImage.texture.height];

        window.displacementFilter.uniforms.textureScale = 1.0;

      }
      img.src = url;

      currentDepthPngPath = path.replace('.psd', '.png');
      updatePreview();
    }

    loadBaseImage();

    var currentDepthPngPath = "";
    function updatePreview() {
      if (currentDepthPngPath.toLowerCase().indexOf("_depth.png") === -1) {
        return; // Only generate PNG depth map if matching file name format
      }

      var img = new Image();
      img.onload = function () {
        var baseTexture = new PIXI.BaseTexture(img);
        var texture = new PIXI.Texture(baseTexture);
        window.displacementFilter.uniforms.displacementMap = texture;
        window.offsetFilter.uniforms.displacementMap = texture;
      }
      img.src = './0463_7319_grmdtyheocuc_depth.png';
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
    vec2 lineW = vec2(0.5 / frameWidth, 0.0);
    vec2 lineH = vec2(0.0, 0.5 / frameHeight);


    float leftD = textureDepth(coord - lineW).r;
    float rightD = textureDepth(coord + lineW).r;
    float upD = textureDepth(coord - lineH).r;
    float downD = textureDepth(coord + lineH).r;

    if (textureDiffuseNoBg(coord)[3] < 1.0)
    {
        return vec4(0.5, 0.5, 1.0, 1.0);
    }

    return vec4(0.5, 0.5, 1.0, 1.0) + vec4(leftD - rightD, upD - downD, 0.0, 0.0) * 100.0 * zoom;
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
        vec2 originCoor = textureDiffuseCoor(coord);
        gl_FragColor = vec4(originCoor[0] ,originCoor[1], originCoor[0] * 256.0  - floor(originCoor[0] * 256.0) , originCoor[1] * 256.0  - floor(originCoor[1] * 256.0));
    }

}`;


  init();
}
  ());


