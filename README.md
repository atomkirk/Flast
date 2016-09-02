# Flast

Javascript library for panning, zooming and drawing on a tiled image.


## Usage

    window.onload = () => {
      var canvas = document.getElementsByTagName('canvas')[0];
      window.flastEditor = new Flast(canvas, {
        getTile: function(zoom, x, y) {
          return `http://useredline-api.s3.amazonaws.com/development/tiles/168d136e60b14850d7a671e8/tile_${zoom}_${x}x${y}.jpg`;
        },
        tileSize: {
          width: 624,
          height: 416
        },
        maxZoom: 4,
        zoomSpeed: 1.01,
        tools: [
          Flast.ARROW,
          Flast.LINE,
          Flast.CIRCLE,
          Flast.RECTANGLE
        ]
      });
    };

    flastEditor.setTool('arrow');

## Options

#### `getTileUrl`


#### `tileSize`

Default: `{ width: 624, height: 416 }`

#### `maxZoom`

Default: `4`

#### `zoomSpeed`

Default: `1.01`

## Custom Tool

You can define your own tools for drawing. Include your tool definition in
the `tools` array option and then you can call `setTool('[YOUR_TOOL_NAME'])` to
activate it.

Defining a new tool is easy:

    var lineTool = {
      return {

        // You'll pass this to `setTool()` to activate
        name: 'line',

        // When this key is pressed, the tool will be activated
        keyCode: 76, // 'l'

        // Implement this to tell Flask what the geometry of the
        // shape should be when the user starts drawing. The
        // geometry can be defined however you want. Flask doesn't
        // use the geometry, it just passes it back to you so you
        // can update and draw it
        startGeometry: function(startPoint) {
          return {
            p1: startPoint,
            p2: startPoint
          };
        },

        // As the user is drawing, they will move their mouse around. Update
        // the geometry to reflect how the object should look as a "live preview"
        updateGeometry: function(geometry, pt) {
          geometry.p2 = pt;
          return geometry;
        },

        // Draw the shape into the context using your the geometry you defined.
        drawInContext: function(ctx, geometry) {
          let p1 = geometry.p1;
          let p2 = geometry.p2;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      };
    }

    window.onload = () => {
      var canvas = document.getElementsByTagName('canvas')[0];
      window.flastEditor = new Flast(canvas, {
        getTile: function(zoom, x, y) {
          return `http://useredline-api.s3.amazonaws.com/development/tiles/168d136e60b14850d7a671e8/tile_${zoom}_${x}x${y}.jpg`;
        },
        tools: [
          lineTool
        ]
      });
    };

    flastEditor.setTool('line');

## Notes

Name generated with http://mrsharpoblunto.github.io/foswig.js/
