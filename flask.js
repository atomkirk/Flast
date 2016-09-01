class Flask {

  constructor(canvas) {
    this.canvas = canvas;
    this.setup();

    // public
    this.zoomSpeed = 1.01;
    this.maxZoomLevel = 4;
    this.width = 624 * Math.pow(2, this.maxZoomLevel);
    this.height = 416 * Math.pow(2, this.maxZoomLevel);
    this.maxScale = 2;

    // private
    this.ctx = canvas.getContext('2d');
    this.dragStart;
    this.canvas;
    this.ctx;
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    this.transform = this.svg.createSVGMatrix();
    this.tileCache = {};

    var minScaleX = this.canvas.width / this.width;
    var minScaleY = this.canvas.height / this.height;
    this.minScale = Math.max(minScaleX, minScaleY);

    this.annotations = [];
    this.currentAnnotation = [];
    this.currentShape;
    this.state = {
      mouse: 'up', // 'down'
      tool: 'none', // 'arrow', 'line', 'circle', 'rectangle', 'freehand'
      dragging: false,
      drawing: false
    }

    this.redraw();
  }

  setup() {
    this.canvas.addEventListener('mousedown', this.mouseDown.bind(this), false);
    this.canvas.addEventListener('mousemove', this.mouseMove.bind(this), false);
    this.canvas.addEventListener('mouseup', this.mouseUp.bind(this), false);
    this.canvas.addEventListener('DOMMouseScroll', this.updateZoom.bind(this), false);
    this.canvas.addEventListener('mousewheel', this.updateZoom.bind(this), false);
    window.addEventListener('keyup', this.keyUp.bind(this), false);
  }

  updateZoom(e) {
    var delta = e.wheelDelta ? e.wheelDelta / 40 : (e.detail ? -e.detail : 0);
    if (delta) {
      var pt = this.eventPoint(e);

      // update any shape that is currently being drawn
      if (this.currentShape) {
        this.currentShape.geometry.p2 = pt;
      }

      var factor = Math.pow(this.zoomSpeed, delta);
      var scale = this.clamp(this.transform.a * factor, this.minScale, this.maxScale);

      // move point of mouse to center
      this.transform = this.transform.translate(pt.x, pt.y);
      // scale
      this.transform.a = this.transform.d = scale;
      // move back
      this.transform = this.transform.translate(-pt.x, -pt.y);

      this.clampToBounds();
      this.updateTransform();
    }
    return e.preventDefault() && false;
  }

  mouseDown(e) {
    this.state.mouse = 'down';
    document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
    this.dragStart = this.eventPoint(e);
  }

  mouseUp(e) {
    this.state.mouse = 'up';
    // draw
    if (this.state.dragging) {
      this.state.dragging = false;
    }
    else if (!this.state.drawing && this.state.tool !== 'none') {
      this.state.drawing = true;
      var pt = this.eventPoint(e);
      if (this.state.tool === 'arrow' || this.state.tool === 'line' || this.state.tool === 'rectangle') {
        this.currentShape = {
          kind: this.state.tool,
          geometry: {
            p1: pt,
            p2: pt
          }
        }
      }
      else if (this.state.tool === 'circle') {
        this.currentShape = {
          kind: 'circle',
          geometry: {
            center: pt,
            radius: 0
          }
        }
      }
    }
    else if (this.state.drawing) {
      this.state.drawing = false;
      this.currentAnnotation.push(this.currentShape);
      this.currentShape = null;
    }
  }

  mouseMove(e) {
    var pt = this.eventPoint(e);
    if (this.state.mouse === 'down' && !this.state.dragging) {
      this.state.dragging = true;
    }
    if (this.state.dragging) {
      var dx = (pt.x - this.dragStart.x);
      var dy = (pt.y - this.dragStart.y);
      this.transform = this.transform.translate(dx, dy);
      this.clampToBounds();
      this.updateTransform();
    }
    if (this.state.drawing) {
      if (this.state.tool === 'arrow' || this.state.tool === 'line' || this.state.tool === 'rectangle') {
        this.currentShape.geometry.p2 = pt;
        this.redraw();
      }
      else if (this.state.tool === 'circle') {
        var c = this.currentShape.geometry.center;
        this.currentShape.geometry.radius = Math.sqrt(Math.pow(pt.x - c.x, 2) + Math.pow(pt.y - c.y, 2));
        this.redraw();
      }
    }
  }

  keyUp(e) {
    // cancel drawing
    if (this.state.drawing && e.which === 27) {
      this.state.drawing = false;
      this.currentShape = null;
      this.redraw();
    }
    // arrow
    else if (e.which === 65) {
      this.state.tool = 'arrow';
    }
    // line
    else if (e.which === 76) {
      this.state.tool = 'line';
    }
    // circle
    else if (e.which === 67) {
      this.state.tool = 'circle';
    }
    // rectangle
    else if (e.which === 82) {
      this.state.tool = 'rectangle';
    }
  }

  // transform the point from page space to canvas space
  transformedPoint(x, y) {
    var pt  = this.svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(this.transform.inverse());
  }

  // set the transform on the context
  updateTransform() {
    var m = this.transform;
    this.ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    this.redraw();
  }

  // clear the canvas and draw the tiles
  redraw() {
    // Clear the entire canvas
    var p1 = this.transformedPoint(0, 0);
    var p2 = this.transformedPoint(this.canvas.width, this.canvas.height);
    var rect = {
      x: p1.x,
      y: p1.y,
      width: p2.x - p1.x,
      height: p2.y - p1.y
    }
    this.ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    var mins = Math.log(this.minScale) / Math.LN2;
    var maxs = Math.log(this.maxScale) / Math.LN2;
    var s = Math.log(this.transform.a) / Math.LN2;
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
        if (this.intersectRect(rect, tile)) {
          var image = this.tileImage(zoomLevel, j, k);
          if (image.complete && image.naturalHeight !== 0) {
            this.ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height);
          }
        }
      }
    }

    // set how annotations should look
    this.ctx.fillStyle = '#FF0000';
    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 10;

    // draw the current annotation
    this.currentAnnotation.concat(this.currentShape || []).forEach(annotation => {
      if (annotation.kind === 'arrow') {

        let p1 = annotation.geometry.p1;
        let p2 = annotation.geometry.p2;

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        var vector = {
          dx: p2.x - p1.x,
          dy: p2.y - p1.y
        }
        var length = Math.sqrt(Math.pow(vector.dx, 2) + Math.pow(vector.dy, 2));
        var percent = (length - 20.0) / length;
        this.ctx.lineTo(p1.x + (vector.dx * percent), p1.y + (vector.dy * percent));
        this.ctx.stroke();

        var radians = Math.atan((p2.y - p1.y) / (p2.x - p1.x));
        radians += ((p2.x > p1.x) ? 90 : -90) * Math.PI / 180;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.translate(p2.x, p2.y);
        this.ctx.rotate(radians);
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(15, 60);
        this.ctx.lineTo(-15, 60);
        this.ctx.closePath();
        this.ctx.restore();
        this.ctx.fill();
      }
      else if (annotation.kind === 'line') {
        let p1 = annotation.geometry.p1;
        let p2 = annotation.geometry.p2;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
      }
      else if (annotation.kind === 'circle') {
        this.ctx.beginPath();
        var g = annotation.geometry;
        this.ctx.arc(g.center.x, g.center.y, g.radius, 0, 2 * Math.PI);
        this.ctx.stroke();
      }
      else if (annotation.kind === 'rectangle') {
        this.ctx.beginPath();
        let p1 = annotation.geometry.p1;
        let p2 = annotation.geometry.p2;
        this.ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        this.ctx.stroke();
      }
    });
  }

  clampToBounds() {
    var maxWidth = this.width * this.transform.a;
    var maxHeight = this.height * this.transform.d;
    this.transform.e = this.clamp(this.transform.e, -(maxWidth - this.canvas.width), 0);
    this.transform.f = this.clamp(this.transform.f, -(maxHeight - this.canvas.height), 0);
  }

  clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
  }

  eventPoint(e) {
    var x = e.offsetX || (e.pageX - this.canvas.offsetLeft);
    var y = e.offsetY || (e.pageY - this.canvas.offsetTop);
    return this.transformedPoint(x, y);
  }

  tileImage(zoom, x, y) {
    var url = `http://useredline-api.s3.amazonaws.com/development/tiles/168d136e60b14850d7a671e8/tile_${zoom}_${x}x${y}.jpg`;
    var image = this.tileCache[url];
    if (!image) {
      image = new Image;
      image.src = url;
      image.onload = () => {
        this.redraw();
      };
      this.tileCache[url] = image;
    }
    return image;
  }

  intersectRect(r1, r2) {
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
