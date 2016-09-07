class Flast {

  constructor(canvas, options = {}) {

    // public
    this.width = canvas.clientWidth;

    this.height = canvas.clientHeight;

    this.maxZoom = options.maxZoom || 4;

    this.zoomSpeed = options.zoomSpeed || 1.01;

    this.getTileUrl = options.getTileUrl || function(zoom, x, y) {
      return `http://useredline-api.s3.amazonaws.com/development/tiles/168d136e60b14850d7a671e8/tile_${zoom}_${x}x${y}.jpg`;
    };

    this.tools = options.tools || [
      Flast.ARROW,
      Flast.LINE,
      Flast.CIRCLE,
      Flast.RECTANGLE
    ];

    this.annotations = options.annotations || [];

    this.callbacks = options.callbacks || {};

    // private
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._dragStart;
    this._svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
    this._transform = this._svg.createSVGMatrix();
    this._currentAnnotation = null;
    this._currentShape = null;
    this._maxScale = 2;
    this._state = {
      mouse: 'up', // 'down'
      tool: 'none', // 'arrow', 'line', 'circle', 'rectangle', 'freehand'
      dragging: false,
      drawing: false
    }

    this._addEventListeners();
    this._configureCanvas();

    this.setTileSize(options.tileSize || {
      width: 624,
      height: 416
    });

    this.redraw();
  }

  setTool(toolName) {
    let tool = this.tools.find((tool) => {
      return tool.name === toolName;
    });
    if (tool) {
      this._state.tool = toolName;
      this.redraw();
    }
    else {
      console.error("Flask: That tool is not defined.");
    }
  }

  setTileSize(size) {
    this.tileSize = size;
    this._tileCache = {};
    this._contentSize = {
      width: this.tileSize.width * Math.pow(2, this.maxZoom),
      height: this.tileSize.height * Math.pow(2, this.maxZoom)
    };
    let minScaleX = this.width / this._contentSize.width;
    let minScaleY = this.height / this._contentSize.height;
    this._minScale = Math.max(minScaleX, minScaleY);
  }

  // clear the canvas and draw the tiles
  redraw() {
    // Clear the entire canvas
    let p1 = this._transformedPoint(0, 0);
    let p2 = this._transformedPoint(this.width, this.height);
    let rect = {
      x: p1.x,
      y: p1.y,
      width: p2.x - p1.x,
      height: p2.y - p1.y
    }
    this._ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    let mins = Math.log(this._minScale) / Math.LN2;
    let maxs = Math.log(this._maxScale) / Math.LN2;
    let s = Math.log(this._transform.a) / Math.LN2;
    let zoomPercent = (s - mins) / (maxs - mins);
    let zoomLevel = Math.max(Math.ceil(zoomPercent * this.maxZoom), 1);
    let numTiles = Math.pow(2, zoomLevel);
    let tileWidth = this._contentSize.width / numTiles;
    let tileHeight = this._contentSize.height / numTiles;
    for (let j = 0; j < numTiles; j++) {
      for (let k = 0; k < numTiles; k++) {
        let tile = {
          x: Math.floor(j * tileWidth),
          y: Math.floor(k * tileHeight),
          width: Math.floor(tileWidth),
          height: Math.floor(tileHeight)
        }
        if (this._intersectRect(rect, tile)) {
          let image = this._tileImage(zoomLevel, j, k);
          if (image.complete && image.naturalHeight !== 0) {
            this._ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height);
          }
          // if the tile at that zoom level is not loaded, show the lower
          // res version at the lower zoom level
          else {
            let zl = zoomLevel - 1;
            while (zl > 0) {
              let parentJ = Math.floor((j / Math.pow(2, zoomLevel)) * Math.pow(2, zl));
              let parentK = Math.floor((k / Math.pow(2, zoomLevel)) * Math.pow(2, zl));
              let image = this._tileImage(zl, parentJ, parentK);
              if (image.complete && image.naturalHeight !== 0) {
                let childTilesPerParent = Math.pow(2, zoomLevel) / Math.pow(2, zl);
                let jRemainder = j - (childTilesPerParent * parentJ);
                let kRemainder = k - (childTilesPerParent * parentK);
                let sWidth = image.width / childTilesPerParent;
                let sHeight = image.height / childTilesPerParent;
                let sx = Math.floor(jRemainder * sWidth);
                let sy = Math.floor(kRemainder * sHeight);
                this._ctx.drawImage(image, sx, sy, sWidth, sHeight, tile.x, tile.y, tile.width, tile.height);
                break;
              }
              zl -= 1;
            }
          }
        }
      }
    }

    // draw in-progress annotation/shapes
    let currentAnnotation = this._currentAnnotation || { shapes: [] };

    // draw all annotations
    for (let annotation of this.annotations.concat(currentAnnotation)) {
      // when drawing, fade out all other shapes except the current annotation
      if (!this._currentAnnotation || annotation === this._currentAnnotation) {
        this._ctx.globalAlpha = 1.0;
      }
      else {
        this._ctx.globalAlpha = 0.2;
      }
      // draw in-progress shapes
      let shapes = annotation.shapes;
      if (annotation === currentAnnotation) {
        shapes = shapes.concat(this._currentShape || []);
      }
      // draw shapes
      for (let shape of shapes) {
        // find the right tool for the job
        let tool = this.tools.find((tool) => {
          return tool.name === shape.kind;
        });

        // set how shape should look by default
        // (can be overriden in drawInContext)
        this._ctx.fillStyle = '#FF0000';
        this._ctx.strokeStyle = '#FF0000';
        this._ctx.lineWidth = 10;

        tool.drawInContext(this._ctx, shape.geometry);

        // tests bounding box
        // this._ctx.lineWidth = 1;
        // let g = tool.boundingRect(shape.geometry);
        // this._ctx.beginPath();
        // this._ctx.strokeRect(g.x, g.y, g.width, g.height);
        // this._ctx.stroke();
      }

      // tests annotation bounding box
      // this._ctx.lineWidth = 1;
      // let g = this.boundingRectFor(annotation);
      // this._ctx.beginPath();
      // this._ctx.strokeRect(g.x, g.y, g.width, g.height);
      // this._ctx.stroke();
    }
    this._ctx.globalAlpha = 1.0;
  }

  completeAnnotation() {
    if (this._currentAnnotation) {
      if (this.annotations.indexOf(this._currentAnnotation) === -1) {
        this.annotations.push(this._currentAnnotation);
      }
      if (this.callbacks.annotationCompleted) {
        this.callbacks.annotationCompleted(this._currentAnnotation);
      }
    }
    this._currentAnnotation = null;
    this._state.tool = 'none';
    this.redraw();
  }

  selectAnnotation(annotation) {
    this._currentAnnotation = annotation;
    if (this.callbacks.annotationSelected) {
      this.callbacks.annotationSelected(annotation);
      // if (this.callbacks.editingAnnotation) {
      //   this.callbacks.editingAnnotation(annotation);
      // }
    }
    this.redraw();
  }

  boundingRectFor(annotation) {
    let minX = Infinity;
    let maxX = 0;
    let minY = Infinity;
    let maxY = 0;
    for (let shape of annotation.shapes) {
      let tool = this.tools.find((tool) => {
        return tool.name === shape.kind;
      });
      let box = tool.boundingRect(shape.geometry);
      minX = Math.min(minX, box.x);
      maxX = Math.max(maxX, box.x + box.width);
      minY = Math.min(minY, box.y);
      maxY = Math.max(maxY, box.y + box.height);
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  zoomToRect(rect) {
    let scaleX = this.width / rect.width;
    let scaleY = this.height / rect.height;
    let scale = Math.min(scaleX, scaleY);
    scale = Flast.clamp(scale, this._minScale, this._maxScale);
    this._transform.a = this._transform.d = scale;

    let portWidth = this.width * (1.0 / scale);
    let portHeight = this.height * (1.0 / scale);
    this._transform.e = -rect.x * scale;
    this._transform.f = -rect.y * scale;

    this._transform.e += ((portWidth * scale) / 2.0) - ((rect.width * scale) / 2.0);
    this._transform.f += ((portHeight * scale) / 2.0) - ((rect.height * scale) / 2.0);

    this._updateTransform();
  }

  _addEventListeners() {
    this._canvas.addEventListener('mousedown', this._mouseDown.bind(this), false);
    this._canvas.addEventListener('mousemove', this._mouseMove.bind(this), false);
    this._canvas.addEventListener('mouseleave', this._mouseLeave.bind(this), false);
    this._canvas.addEventListener('mouseup', this._mouseUp.bind(this), false);
    this._canvas.addEventListener('DOMMouseScroll', this._updateZoom.bind(this), false);
    this._canvas.addEventListener('mousewheel', this._updateZoom.bind(this), false);
    window.addEventListener('keyup', this._keyUp.bind(this), false);
  }

  _configureCanvas() {
    this._canvas.setAttribute('width', this.width);
    this._canvas.setAttribute('height', this.height);
  }

  _updateZoom(e) {
    let delta = e.wheelDelta ? e.wheelDelta / 40 : (e.detail ? -e.detail : 0);
    if (delta) {
      let pt = this._eventPoint(e);

      // update any shape that is currently being drawn
      if (this._currentShape) {
        let tool = this._currentTool();
        this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, pt);
      }

      let factor = Math.pow(this.zoomSpeed, delta);
      let scale = Flast.clamp(this._transform.a * factor, this._minScale, this._maxScale);
      console.log(scale);

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
    document.body.style.mozUserSelect =
      document.body.style.webkitUserSelect =
      document.body.style.userSelect = 'none';
    this._dragStart = this._eventPoint(e);
  }

  _mouseUp(e) {
    this._state.mouse = 'up';

    // stop dragging
    if (this._state.dragging) {
      this._state.dragging = false;
    }

    // start drawing
    else if (!this._state.drawing && this._state.tool !== 'none') {
      this._state.drawing = true;
      let pt = this._eventPoint(e);
      let tool = this._currentTool();
      // set current shape
      this._currentShape = {
        kind: tool.name,
        geometry: tool.startGeometry(pt)
      }
      // callback
      if (this.callbacks.beganDrawingShape) {
        this.callbacks.beganDrawingShape(this._currentShape);
      }
    }

    // stop drawing
    else if (this._state.drawing) {
      this._state.drawing = false;
      // if there is not a current annotation
      if (!this._currentAnnotation) {
        // start new annotation
        this._currentAnnotation = { shapes: [] };
        // callback
        if (this.callbacks.editingAnnotation) {
          this.callbacks.editingAnnotation(this._currentAnnotation);
        }
      }
      // finalize drawing if tool provides it
      let tool = this._currentTool();
      if (tool.finalGeometry) {
        this._currentShape.geometry = tool.finalGeometry(this._currentShape.geometry);
      }

      // add shape to current annotation
      this._currentAnnotation.shapes.push(this._currentShape);
      // callback
      if (this.callbacks.finishedDrawingShape) {
        this.callbacks.finishedDrawingShape(this._currentShape);
      }
      this._currentShape = null;
      this.redraw();
    }

    // if nothing already selected
    else if (!this._currentAnnotation) {
      // if mouse up over a shape
      let pt = this._eventPoint(e);
      for (let annotation of this.annotations) {
        for (let shape of annotation.shapes) {
          // find the tool that drew this shape
          let tool = this.tools.find((tool) => {
            return tool.name === shape.kind;
          });
          if (tool.hitTest(shape.geometry, pt)) {
            this.selectAnnotation(annotation);
            return;
          }
        }
      }
    }
  }

  _mouseMove(e) {
    let pt = this._eventPoint(e);
    if (this._state.mouse === 'down' && !this._state.dragging) {
      this._state.dragging = true;
    }
    if (this._state.dragging) {
      let dx = (pt.x - this._dragStart.x);
      let dy = (pt.y - this._dragStart.y);
      this._transform = this._transform.translate(dx, dy);
      this._clampToBounds();
      this._updateTransform();
    }
    if (this._state.drawing) {
      let tool = this._currentTool();
      this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, pt);
      this.redraw();
    }
  }

  _mouseLeave(e) {
    if (this._state.dragging) {
      this._state.dragging = false;
      this._state.mouse = 'up';
    }
  }

  _keyUp(e) {
    // cancel drawing
    if (this._state.drawing && e.which === 27) {
      if (this.callbacks.cancelledDrawingShape) {
        this.callbacks.cancelledDrawingShape(this._currentShape);
      }
      this._state.drawing = false;
      this._currentShape = null;
      this.redraw();
    }
    else {
      for (let tool of this.tools) {
        if (e.which === tool.keyCode) {
          this._state.tool = tool.name;
        }
      }
    }
  }

  // transform the point from page space to canvas space
  _transformedPoint(x, y) {
    let pt  = this._svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(this._transform.inverse());
  }

  // set the transform on the context
  _updateTransform() {
    let m = this._transform;
    this._ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    this.redraw();
    if (this.callbacks.transformWasUpdated) {
      this.callbacks.transformWasUpdated(m);
    }
  }

  _clampToBounds() {
    let maxWidth = this._contentSize.width * this._transform.a;
    let maxHeight = this._contentSize.height * this._transform.d;
    this._transform.e = Flast.clamp(this._transform.e, -(maxWidth - this.width), 0);
    this._transform.f = Flast.clamp(this._transform.f, -(maxHeight - this.height), 0);
  }

  static clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
  }

  _eventPoint(e) {
    let x = e.offsetX || (e.pageX - this._canvas.offsetLeft);
    let y = e.offsetY || (e.pageY - this._canvas.offsetTop);
    return this._transformedPoint(x, y);
  }

  _tileImage(zoom, x, y) {
    let url = this.getTileUrl(zoom, x, y);
    let image = this._tileCache[url];
    if (!image) {
      image = new Image;
      image.src = url;
      image.onload = () => {
        this.redraw();
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

  _currentTool() {
    return this.tools.find((tool) => {
      return tool.name === this._state.tool;
    });
  }

  static get ARROW() {
    return {
      name: 'arrow',
      keyCode: 65,
      startGeometry(pt) {
        return {
          p1: {
            x: pt.x,
            y: pt.y
          },
          p2: {
            x: pt.x,
            y: pt.y
          }
        };
      },
      updateGeometry: function(geometry, pt) {
        geometry.p2 = {
          x: pt.x,
          y: pt.y
        };
        return geometry;
      },
      boundingRect(geometry) {
        let minX = Math.min(geometry.p1.x, geometry.p2.x);
        let maxX = Math.max(geometry.p1.x, geometry.p2.x);
        let minY = Math.min(geometry.p1.y, geometry.p2.y);
        let maxY = Math.max(geometry.p1.y, geometry.p2.y);
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        }
      },
      drawInContext(ctx, geometry) {
        let p1 = geometry.p1;
        let p2 = geometry.p2;
        let arrowHeight = 60.0;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        let vector = {
          dx: p2.x - p1.x,
          dy: p2.y - p1.y
        }
        let length = Math.sqrt(Math.pow(vector.dx, 2) + Math.pow(vector.dy, 2));
        let percent = (length - arrowHeight) / length;
        ctx.lineTo(p1.x + (vector.dx * percent), p1.y + (vector.dy * percent));
        ctx.stroke();

        let radians = Math.atan((p2.y - p1.y) / (p2.x - p1.x));
        radians += ((p2.x > p1.x) ? 90 : -90) * Math.PI / 180;

        ctx.save();
        ctx.beginPath();
        ctx.translate(p2.x, p2.y);
        ctx.rotate(radians);
        ctx.moveTo(0, 0);
        ctx.lineTo(15, arrowHeight);
        ctx.lineTo(-15, arrowHeight);
        ctx.closePath();
        ctx.restore();
        ctx.fill();
      },
      hitTest(geometry, pt) {
        return Flast._onLine(geometry, pt);
      }
    };
  }

  static get LINE() {
    return {
      name: 'line',
      keyCode: 76,
      startGeometry: function(pt) {
        return {
          p1: {
            x: pt.x,
            y: pt.y
          },
          p2: {
            x: pt.x,
            y: pt.y
          }
        };
      },
      updateGeometry: function(geometry, pt) {
        geometry.p2 = {
          x: pt.x,
          y: pt.y
        };
        return geometry;
      },
      boundingRect(geometry) {
        let minX = Math.min(geometry.p1.x, geometry.p2.x);
        let maxX = Math.max(geometry.p1.x, geometry.p2.x);
        let minY = Math.min(geometry.p1.y, geometry.p2.y);
        let maxY = Math.max(geometry.p1.y, geometry.p2.y);
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        }
      },
      drawInContext: function(ctx, geometry) {
        let p1 = geometry.p1;
        let p2 = geometry.p2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      },
      hitTest: function(geometry, pt) {
        return Flast._onLine(geometry, pt);
      }
    };
  }

  static get CIRCLE() {
    return {
      name: 'circle',
      keyCode: 67,
      startGeometry(pt) {
        return {
          center: {
            x: pt.x,
            y: pt.y
          },
          radius: 0
        };
      },
      updateGeometry: function(geometry, pt) {
        let c = geometry.center;
        geometry.radius = Math.sqrt(Math.pow(pt.x - c.x, 2) + Math.pow(pt.y - c.y, 2));
        return geometry;
      },
      boundingRect(geometry) {
        let minX = geometry.center.x - geometry.radius;
        let maxX = geometry.center.x + geometry.radius;
        let minY = geometry.center.y - geometry.radius;
        let maxY = geometry.center.y + geometry.radius;
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        }
      },
      drawInContext: function(ctx, geometry) {
        let g = geometry;
        ctx.beginPath();
        ctx.arc(g.center.x, g.center.y, g.radius, 0, 2 * Math.PI);
        ctx.stroke();
      },
      hitTest: function(geometry, pt) {
        let distance = Math.sqrt(Math.pow(pt.x - geometry.center.x, 2) +
                       Math.pow(pt.y - geometry.center.y, 2));
        return Math.abs(distance - geometry.radius) < 10;
      }
    };
  }

  static get RECTANGLE() {
    return {
      name: 'rectangle',
      keyCode: 82,
      startGeometry(pt) {
        return {
          x: pt.x,
          y: pt.y,
          width: 0,
          height: 0
        };
      },
      updateGeometry(geometry, pt) {
        geometry.width = pt.x - geometry.x;
        geometry.height = pt.y - geometry.y;
        return geometry;
      },
      finalGeometry(geometry) {
        return {
          x: Math.min(geometry.x, geometry.x + geometry.width),
          y: Math.min(geometry.y, geometry.y + geometry.height),
          width: Math.abs(geometry.width),
          height: Math.abs(geometry.height)
        }
      },
      boundingRect(geometry) {
        return geometry;
      },
      drawInContext(ctx, geometry) {
        let g = geometry;
        ctx.beginPath();
        ctx.strokeRect(g.x, g.y, g.width, g.height);
        ctx.stroke();
      },
      hitTest(geometry, pt) {
        let distances = [
          Math.abs(geometry.x - pt.x),
          Math.abs((geometry.x + geometry.width) - pt.x),
          Math.abs(geometry.y - pt.y),
          Math.abs((geometry.y + geometry.height) - pt.y)
        ];
        for (let dist of distances) {
          if (dist < 10) return true;
        }
      }
    };
  }

  static _onLine(line, point) {
    let dxc = point.x - line.p1.x;
    let dyc = point.y - line.p1.y;

    let dxl = line.p2.x - line.p1.x;
    let dyl = line.p2.y - line.p1.y;

    let cross = dxc * dyl - dyc * dxl;

    return Math.abs(cross) < 20000 &&
           point.x < Math.max(line.p1.x, line.p2.x) + 10 &&
           point.x > Math.min(line.p1.x, line.p2.x) - 10 &&
           point.y < Math.max(line.p1.y, line.p2.y) + 10 &&
           point.y > Math.min(line.p1.y, line.p2.y) - 10;
  }

}
