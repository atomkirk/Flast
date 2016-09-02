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
        zoomSpeed: 1.01
      });
    };

## Options

#### `getTileUrl`


#### `tileSize`

Default: `{ width: 624, height: 416 }`

#### `maxZoom`

Default: `4`

#### `zoomSpeed`

Default: `1.01`

## Notes

Name generated with http://mrsharpoblunto.github.io/foswig.js/
