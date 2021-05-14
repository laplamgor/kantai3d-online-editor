(function ()
{
    'use strict';


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
    else
    {
        gl_FragColor = normalMixed(coord);
    }

}`;


    function init()
    {

        PIXI.DepthPerspectiveFilter = new PIXI.Filter(null, frag);

        PIXI.DepthPerspectiveFilter.apply = function (filterManager, input, output)
        {
            this.uniforms.dimensions = {};
            if (input && input.sourceFrame && input.size)
            {
                this.uniforms.dimensions[0] = input.sourceFrame.width;
                this.uniforms.dimensions[1] = input.sourceFrame.height;

                this.uniforms.frameWidth = input.size.width;
                this.uniforms.frameHeight = input.size.height;
            }

            this.uniforms.canvasSize = {};
            this.uniforms.canvasSize[0] = app.renderer.width;
            this.uniforms.canvasSize[1] = app.renderer.height;

            // draw the filter...
            filterManager.applyFilter(this, input, output);






            var zoom = window.displacementFilter.uniforms.zoom;
            var fit = Math.min(window.displacementFilter.uniforms.canvasSize[0] / window.displacementFilter.uniforms.textureSize[0], 
                window.displacementFilter.uniforms.canvasSize[1] / window.displacementFilter.uniforms.textureSize[1]);

            bunny.x = (app.renderer.plugins.interaction.mouse.global.x - window.displacementFilter.uniforms.canvasSize[0] / 2 + window.displacementFilter.uniforms.textureSize[0] / 2 * zoom * fit);
            bunny.x += window.displacementFilter.uniforms.pan[0];
            bunny.x = bunny.x / zoom / fit;
            bunny.x = bunny.x / window.displacementFilter.uniforms.textureSize[0] * window.displacementFilter.uniforms.canvasSize[0]  ;

            bunny.y = (app.renderer.plugins.interaction.mouse.global.y - window.displacementFilter.uniforms.canvasSize[1] / 2 + window.displacementFilter.uniforms.textureSize[1] / 2 * zoom * fit);
            bunny.y += window.displacementFilter.uniforms.pan[1];
            bunny.y = bunny.y / zoom / fit;
            bunny.y = bunny.y / window.displacementFilter.uniforms.textureSize[1] * window.displacementFilter.uniforms.canvasSize[1] ;

        }

        const app = new PIXI.Application(
            {
                view: document.querySelector("#canvas"),
                width: 50,
                height: 50
            }
            );

        var depthMapImage = new PIXI.Sprite.fromImage("");

        window.displacementFilter = PIXI.DepthPerspectiveFilter;
        window.displacementFilter.uniforms.textureScale = 1.0;
        window.displacementFilter.padding = 0;

        window.displacementFilter.uniforms.pan = [0.0, 0.0];
        window.displacementFilter.uniforms.scale = 1.0;
        window.displacementFilter.uniforms.focus = 0.5;
        window.displacementFilter.uniforms.offset = [0.0, 0.0];

        window.displacementFilter.uniforms.displayMode = 2;

        var container = new PIXI.Container();
        var bunny = new PIXI.Sprite(PIXI.Texture.from('https://pixijs.io/examples/examples/assets/bunny.png'));
        bunny.anchor.set(0.5);
        container.filters = [window.displacementFilter];
        app.stage.addChild(container);
        container.addChild(bunny);
        container.addChild(depthMapImage);
        container.addChild(bunny);

        var tiltX;
        var tiltY;
        var isTilting = false;

        var panX;
        var panY;
        var isPanning = false;

        window.addEventListener('mousedown', function (event)
        {
            switch (event.which)
            {
            case 1:
                tiltX = app.renderer.plugins.interaction.mouse.global.x;
                tiltY = app.renderer.plugins.interaction.mouse.global.y;
                console.log('case 1:!');
                isTilting = true;
                break;
            case 2:
                panX = app.renderer.plugins.interaction.mouse.global.x;
                panY = app.renderer.plugins.interaction.mouse.global.y;
                console.log('case 2:!');
                isPanning = true;
                break;
            case 3:
                console.log('case 3:!');
                break;
            default:
                alert('You have a strange Mouse!');
            }

            var zoom = window.displacementFilter.uniforms.zoom;
            console.log('pan ' + window.displacementFilter.uniforms.pan[0] + '   ' + window.displacementFilter.uniforms.pan[1]);
            console.log('zoom ' + zoom);

            var fit = Math.min(window.displacementFilter.uniforms.canvasSize[0] / window.displacementFilter.uniforms.textureSize[0], 
                window.displacementFilter.uniforms.canvasSize[1] / window.displacementFilter.uniforms.textureSize[1]);
            console.log('fit ' + fit);

        }
        );

        window.addEventListener('mouseup', function (event)
        {
            switch (event.which)
            {
            case 1:
                isTilting = false;
                break;
            case 2:
                isPanning = false;
                break;
            case 3:
                break;
            default:
                alert('You have a strange Mouse!');
            }
        }
        );

        window.displacementFilter.uniforms.zoom = 1.0;
        $('#canvas').bind('mousewheel', function (e)
        {
            if (e.originalEvent.wheelDelta / 120 > 0)
            {
                if (window.displacementFilter.uniforms.zoom < 30.0)
                {
                    window.displacementFilter.uniforms.zoom *= 1.1;

                    var mx = app.renderer.plugins.interaction.mouse.global.x - app.renderer.width / 2.0;
                    window.displacementFilter.uniforms.pan[0] += mx;
                    window.displacementFilter.uniforms.pan[0] *= 1.1;
                    window.displacementFilter.uniforms.pan[0] -= mx;

                    var my = app.renderer.plugins.interaction.mouse.global.y - app.renderer.height / 2.0;
                    window.displacementFilter.uniforms.pan[1] += my;
                    window.displacementFilter.uniforms.pan[1] *= 1.1;
                    window.displacementFilter.uniforms.pan[1] -= my;

                }
            }
            else
            {
                window.displacementFilter.uniforms.zoom /= 1.1;

                var mx = app.renderer.plugins.interaction.mouse.global.x - app.renderer.width / 2.0;
                window.displacementFilter.uniforms.pan[0] += mx;
                window.displacementFilter.uniforms.pan[0] /= 1.1;
                window.displacementFilter.uniforms.pan[0] -= mx;

                var my = app.renderer.plugins.interaction.mouse.global.y - app.renderer.height / 2.0;
                window.displacementFilter.uniforms.pan[1] += my;
                window.displacementFilter.uniforms.pan[1] /= 1.1;
                window.displacementFilter.uniforms.pan[1] -= my;
            }
        }
        );

        function step(timestamp)
        {
            if (depthMapImage && depthMapImage.texture && app.renderer.view.style)
            {
                var endx = app.renderer.plugins.interaction.mouse.global.x;
                var endy = app.renderer.plugins.interaction.mouse.global.y;

                if (isTilting)
                {
                    var radius = Math.min(app.renderer.width, app.renderer.height);
                    window.displacementFilter.uniforms.offset[0] -= ((endx - tiltX) / radius * 2);
                    window.displacementFilter.uniforms.offset[1] += ((endy - tiltY) / radius * 2);

                    var xy = Math.sqrt(window.displacementFilter.uniforms.offset[0] * window.displacementFilter.uniforms.offset[0] + window.displacementFilter.uniforms.offset[1] * window.displacementFilter.uniforms.offset[1]);
                    if (xy / 0.5 > 1)
                    {
                        window.displacementFilter.uniforms.offset[0] /= xy / 0.5;
                        window.displacementFilter.uniforms.offset[1] /= xy / 0.5;
                    }

                    tiltX = endx;
                    tiltY = endy;
                }

                if (isPanning)
                {
                    window.displacementFilter.uniforms.pan[0] -= ((endx - panX));
                    window.displacementFilter.uniforms.pan[1] -= ((endy - panY));

                    panX = endx;
                    panY = endy;
                }

            }
            window.requestAnimationFrame(step);
        }

        window.requestAnimationFrame(step);

        // Listen for window resize events
        window.addEventListener('resize', resize);

        // Resize function window
        function resize()
        {
            // Resize the renderer
            var c = $("#canvas");
            c.prop('width', window.innerWidth);
            c.prop('height', window.innerHeight);
            app.renderer.resize(window.innerWidth, window.innerHeight);

            depthMapImage.width = app.renderer.screen.width;
            depthMapImage.height = app.renderer.screen.height;
        }

        resize();



        function changeDisplayMode(mode)
        {
            switch (mode)
            {
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
        function loadBaseImage()
        {
            var path = './0463_7319_grmdtyheocuc_depth.psd';

            if (path.toLowerCase().indexOf("_depth.psd") === -1)
            {
                return; // Only generate PNG depth map if matching file name format
            }
            var url = path.replace('_depth', '').replace('.psd', '.png') + "?_=" + (new Date().getTime());
            var img = new Image();
            img.onload = function ()
            {
                var baseTexture = new PIXI.BaseTexture(img);
                var texture = new PIXI.Texture(baseTexture);
                depthMapImage.setTexture(texture);

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
        function updatePreview()
        {
            if (currentDepthPngPath.toLowerCase().indexOf("_depth.png") === -1)
            {
                return; // Only generate PNG depth map if matching file name format
            }

            var u = currentDepthPngPath + "?_=" + (new Date().getTime());
            var img = new Image();
            img.onload = function ()
            {
                var baseTexture = new PIXI.BaseTexture(img);
                var texture = new PIXI.Texture(baseTexture);
                window.displacementFilter.uniforms.displacementMap = texture;
            }
            img.src = './0463_7319_grmdtyheocuc_depth.png';
        }

        function adjustAllLevels(multiplier, addition)
        {
            var reduction = 0.0;
            if (addition < 0)
            {
                reduction = -addition;
                addition = 0.0;
            }

            var fromStart = 0 + reduction;
            var fromEnd = 255 - addition;
            var toStart = 0 + addition;
            var toEnd = 255 - reduction;

            if (multiplier > 1.0)
            {
                var offset = Math.floor(127.0 / multiplier);
                fromStart = 127 - offset + reduction;
                fromEnd = 128 + offset - addition;
            }
            else
            {
                var offset = Math.floor(127.0 * multiplier);
                toStart = 127 - offset + addition;
                toEnd = 128 + offset - reduction;
            }

            var scriptScale = `
                var allTopLevelLayers = app.activeDocument.layers;
                loopLayers(allTopLevelLayers);

                function loopLayers(gp) {
                    var layer;
                    for(var i=0; i<gp.length; i++) {
                        layer = gp[i];
                        if(layer.typename == 'LayerSet') {
                            loopLayers(layer.layers);
                        } else {
                            changeLayer(layer);
                        }
                    }
                }

                function changeLayer(layer) {
                    try {
                        if (layer.visible) {
                            app.activeDocument.activeLayer = layer;
                            layer.adjustLevels(${fromStart}, ${fromEnd}, 1.0, ${toStart}, ${toEnd});
                        }
                    } catch(e) {
                        activeDocument.selection.deselect();
                    }
                }
            `;

            csInterface.evalScript(scriptScale, function (path)  {}
            );
        }

        function mapToBase(mousePos) {
            var newPos = {};
            newPos.x = mousePos.x - window.displacementFilter.uniforms.pan[0];
            newPos.y = mousePos.y - window.displacementFilter.uniforms.pan[1];
            return newPos;
        }
    }
    init();
}
    ());


