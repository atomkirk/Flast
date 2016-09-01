class Flask {

  constructor(canvas) {
    this._canvas = canvas;
    this._setup();

    // public
    this.zoomSpeed = 1.01;
    this.maxZoomLevel = 4;
    this.width = 624 * Math.pow(2, this.maxZoomLevel);
    this.height = 416 * Math.pow(2, this.maxZoomLevel);
    this.maxScale = 2;

    // private
    this._ctx = canvas.getContext('2d');
    this._dragStart;
    this._svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    this._transform = this._svg.createSVGMatrix();
    this._tileCache = {};

    var minScaleX = this._canvas.width / this.width;
    var minScaleY = this._canvas.height / this.height;
    this._minScale = Math.max(minScaleX, minScaleY);

    this._annotations = [];
    this._currentAnnotation = [];
    this._currentShape;
    this._state = {
      mouse: 'up', // 'down'
      tool: 'none', // 'arrow', 'line', 'circle', 'rectangle', 'freehand'
      dragging: false,
      drawing: false
    }

    this._redraw();
  }

  _setup() {
    this._canvas.addEventListener('mousedown', this._mouseDown.bind(this), false);
    this._canvas.addEventListener('mousemove', this._mouseMove.bind(this), false);
    this._canvas.addEventListener('mouseup', this._mouseUp.bind(this), false);
    this._canvas.addEventListener('DOMMouseScroll', this._updateZoom.bind(this), false);
    this._canvas.addEventListener('mousewheel', this._updateZoom.bind(this), false);
    window.addEventListener('keyup', this._keyUp.bind(this), false);
  }

  _updateZoom(e) {
    var delta = e.wheelDelta ? e.wheelDelta / 40 : (e.detail ? -e.detail : 0);
    if (delta) {
      var pt = this._eventPoint(e);

      // update any shape that is currently being drawn
      if (this._currentShape) {
        this._currentShape.geometry.p2 = pt;
      }

      var factor = Math.pow(this.zoomSpeed, delta);
      var scale = Flask.clamp(this._transform.a * factor, this._minScale, this.maxScale);

      // move point of mouse to center
      this._transform = this._transform.translate(pt.x, pt.y);
      // scale
      this._transform.a = this._transform.d = scale;
      // move back
      this._transform = this._transform.translate(-pt.x, -pt.y);

      this._clampToBounds();
      this._updateTransform();
    }
    return e.preventDefault() && false;
  }

  _mouseDown(e) {
    this._state.mouse = 'down';
    document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
    this._dragStart = this._eventPoint(e);
  }

  _mouseUp(e) {
    this._state.mouse = 'up';
    // draw
    if (this._state.dragging) {
      this._state.dragging = false;
    }
    else if (!this._state.drawing && this._state.tool !== 'none') {
      this._state.drawing = true;
      var pt = this._eventPoint(e);
      if (this._state.tool === 'arrow' || this._state.tool === 'line' || this._state.tool === 'rectangle') {
        this._currentShape = {
          kind: this._state.tool,
          geometry: {
            p1: pt,
            p2: pt
          }
        }
      }
      else if (this._state.tool === 'circle') {
        this._currentShape = {
          kind: 'circle',
          geometry: {
            center: pt,
            radius: 0
          }
        }
      }
    }
    else if (this._state.drawing) {
      this._state.drawing = false;
      this._currentAnnotation.push(this._currentShape);
      this._currentShape = null;
    }
  }

  _mouseMove(e) {
    var pt = this._eventPoint(e);
    if (this._state.mouse === 'down' && !this._state.dragging) {
      this._state.dragging = true;
    }
    if (this._state.dragging) {
      var dx = (pt.x - this._dragStart.x);
      var dy = (pt.y - this._dragStart.y);
      this._transform = this._transform.translate(dx, dy);
      this._clampToBounds();
      this._updateTransform();
    }
    if (this._state.drawing) {
      if (this._state.tool === 'arrow' || this._state.tool === 'line' || this._state.tool === 'rectangle') {
        this._currentShape.geometry.p2 = pt;
        this._redraw();
      }
      else if (this._state.tool === 'circle') {
        var c = this._currentShape.geometry.center;
        this._currentShape.geometry.radius = Math.sqrt(Math.pow(pt.x - c.x, 2) + Math.pow(pt.y - c.y, 2));
        this._redraw();
      }
    }
  }

  _keyUp(e) {
    // cancel drawing
    if (this._state.drawing && e.which === 27) {
      this._state.drawing = false;
      this._currentShape = null;
      this._redraw();
    }
    // arrow
    else if (e.which === 65) {
      this._state.tool = 'arrow';
    }
    // line
    else if (e.which === 76) {
      this._state.tool = 'line';
    }
    // circle
    else if (e.which === 67) {
      this._state.tool = 'circle';
    }
    // rectangle
    else if (e.which === 82) {
      this._state.tool = 'rectangle';
    }
  }

  // transform the point from page space to canvas space
  _transformedPoint(x, y) {
    var pt  = this._svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(this._transform.inverse());
  }

  // set the transform on the context
  _updateTransform() {
    var m = this._transform;
    this._ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    this._redraw();
  }

  // clear the canvas and draw the tiles
  _redraw() {
    // Clear the entire canvas
    var p1 = this._transformedPoint(0, 0);
    var p2 = this._transformedPoint(this._canvas.width, this._canvas.height);
    var rect = {
      x: p1.x,
      y: p1.y,
      width: p2.x - p1.x,
      height: p2.y - p1.y
    }
    this._ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    var mins = Math.log(this._minScale) / Math.LN2;
    var maxs = Math.log(this.maxScale) / Math.LN2;
    var s = Math.log(this._transform.a) / Math.LN2;
    var zoomPercent = (s - mins) / (maxs - mins);
    var zoomLevel = Math.max(Math.ceil(zoomPercent * this.maxZoomLevel), 1);
    var numTiles = Math.pow(2, zoomLevel);
    var tileWidth = this.width / numTiles;
    var tileHeight = this.height / numTiles;
    for (var j = 0; j < numTiles; j++) {
      for (var k = 0; k < numTiles; k++) {
        var tile = {
          x: Math.floor(j * tileWidth),
          y: Math.floor(k * tileHeight),
          width: Math.floor(tileWidth),
          height: Math.floor(tileHeight)
        }
        if (this._intersectRect(rect, tile)) {
          var image = this._tileImage(zoomLevel, j, k);
          if (image.complete && image.naturalHeight !== 0) {
            this._ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height);
          }
        }
      }
    }

    // set how annotations should look
    this._ctx.fillStyle = '#FF0000';
    this._ctx.strokeStyle = '#FF0000';
    this._ctx.lineWidth = 10;

    // draw the current annotation
    this._currentAnnotation.concat(this._currentShape || []).forEach(annotation => {
      if (annotation.kind === 'arrow') {

        let p1 = annotation.geometry.p1;
        let p2 = annotation.geometry.p2;

        this._ctx.beginPath();
        this._ctx.moveTo(p1.x, p1.y);
        var vector = {
          dx: p2.x - p1.x,
          dy: p2.y - p1.y
        }
        var length = Math.sqrt(Math.pow(vector.dx, 2) + Math.pow(vector.dy, 2));
        var percent = (length - 20.0) / length;
        this._ctx.lineTo(p1.x + (vector.dx * percent), p1.y + (vector.dy * percent));
        this._ctx.stroke();

        var radians = Math.atan((p2.y - p1.y) / (p2.x - p1.x));
        radians += ((p2.x > p1.x) ? 90 : -90) * Math.PI / 180;

        this._ctx.save();
        this._ctx.beginPath();
        this._ctx.translate(p2.x, p2.y);
        this._ctx.rotate(radians);
        this._ctx.moveTo(0, 0);
        this._ctx.lineTo(15, 60);
        this._ctx.lineTo(-15, 60);
        this._ctx.closePath();
        this._ctx.restore();
        this._ctx.fill();
      }
      else if (annotation.kind === 'line') {
        let p1 = annotation.geometry.p1;
        let p2 = annotation.geometry.p2;
        this._ctx.beginPath();
        this._ctx.moveTo(p1.x, p1.y);
        this._ctx.lineTo(p2.x, p2.y);
        this._ctx.stroke();
      }
      else if (annotation.kind === 'circle') {
        this._ctx.beginPath();
        var g = annotation.geometry;
        this._ctx.arc(g.center.x, g.center.y, g.radius, 0, 2 * Math.PI);
        this._ctx.stroke();
      }
      else if (annotation.kind === 'rectangle') {
        this._ctx.beginPath();
        let p1 = annotation.geometry.p1;
        let p2 = annotation.geometry.p2;
        this._ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        this._ctx.stroke();
      }
    });
  }

  _clampToBounds() {
    var maxWidth = this.width * this._transform.a;
    var maxHeight = this.height * this._transform.d;
    this._transform.e = Flask.clamp(this._transform.e, -(maxWidth - this._canvas.width), 0);
    this._transform.f = Flask.clamp(this._transform.f, -(maxHeight - this._canvas.height), 0);
  }

  static clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
  }

  _eventPoint(e) {
    var x = e.offsetX || (e.pageX - this._canvas.offsetLeft);
    var y = e.offsetY || (e.pageY - this._canvas.offsetTop);
    return this._transformedPoint(x, y);
  }

  _tileImage(zoom, x, y) {
    var url = `http://useredline-api.s3.amazonaws.com/development/tiles/168d136e60b14850d7a671e8/tile_${zoom}_${x}x${y}.jpg`;
    var image = this._tileCache[url];
    if (!image) {
      image = new Image;
      image.src = url;
      image.onload = () => {
        this._redraw();
      };
      this._tileCache[url] = image;
    }
    return image;
  }

  _intersectRect(r1, r2) {
    r1 = {
      left: r1.x,
      right: r1.x + r1.width,
      top: r1.y,
      bottom: r1.y + r1.height
    }
    r2 = {
      left: r2.x,
      right: r2.x + r2.width,
      top: r2.y,
      bottom: r2.y + r2.height
    }
    return !(r2.left > r1.right ||
             r2.right < r1.left ||
             r2.top > r1.bottom ||
             r2.bottom < r1.top);
  }
}
