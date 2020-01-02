var _hitMargin = void 0
var _lineWidth = void 0

var Flast = (function(){"use strict";var PRS$0 = (function(o,t){o["__proto__"]={"a":t};return o["a"]===t})({},{});var DP$0 = Object.defineProperty;var GOPD$0 = Object.getOwnPropertyDescriptor;var MIXIN$0 = function(t,s){for(var p in s){if(s.hasOwnProperty(p)){DP$0(t,p,GOPD$0(s,p));}}return t};var DPS$0 = Object.defineProperties;var static$0={},proto$0={};var S_ITER$0 = typeof Symbol!=='undefined'&&Symbol&&Symbol.iterator||'@@iterator';var S_MARK$0 = typeof Symbol!=='undefined'&&Symbol&&Symbol["__setObjectSetter__"];function GET_ITER$0(v){if(v){if(Array.isArray(v))return 0;var f;if(S_MARK$0)S_MARK$0(v);if(typeof v==='object'&&typeof (f=v[S_ITER$0])==='function'){if(S_MARK$0)S_MARK$0(void 0);return f.call(v);}if(S_MARK$0)S_MARK$0(void 0);if((v+'')==='[object Generator]')return v;}throw new Error(v+' is not iterable')};
  function Flast(canvas) {var options = arguments[1];if(options === void 0)options = {};
    this._canvas = canvas
    this._once(canvas)
    this._init(options)
    this.redraw()
  }DP$0(Flast,"prototype",{"configurable":false,"enumerable":false,"writable":false});

  proto$0.reinit = function(options) {
    var merged = Object.assign(this.originalOptions, options)
    this._init(merged)
    this.redraw()
  };

  proto$0._init = function(options) {
    this.originalOptions = options
    this.maxZoom = options.maxZoom || 4
    this.zoomSpeed = options.zoomSpeed || 1.01
    this.getTileUrl =
      options.getTileUrl ||
      function(zoom, x, y) {
        return (("https://s3-us-west-2.amazonaws.com/useredline-api/development/tiles/168d136e60b14850d7a671e8/tile_" + zoom) + ("_" + x) + ("x" + y) + ".jpg")
      }
    this.tools = options.tools || [Flast.ARROW, Flast.LINE, Flast.CIRCLE, Flast.RECTANGLE]
    this.annotations = options.annotations || []
    this.callbacks = options.callbacks || {}
    this._currentAnnotation = null
    this._currentShape = null
    this._maxScale = options.maxScale || 2
    this._authorColor = options.authorColor
    this._state = {
      mouse: 'up', // 'down'
      tool: 'none', // 'arrow', 'line', 'circle', 'rectangle', 'freehand'
      dragging: false,
      drawing: false,
      enabled: true,
    }
    this._contentSize = {
      width: options.width || 624 * Math.pow(2, this.maxZoom),
      height: options.height || 416 * Math.pow(2, this.maxZoom),
    }
    this.setTileSize({
      width: this._contentSize.width / Math.pow(2, this.maxZoom),
      height: this._contentSize.height / Math.pow(2, this.maxZoom),
    })
    this._transform.e = this._transform.f = 0
    this._transform.a = this._transform.d = this._minScale
    this._clampToBounds()
    this._applyTransform(this._transform)
  };

  proto$0._once = function(canvas) {
    this.canvasWidth = canvas.clientWidth
    this.canvasHeight = canvas.clientHeight
    var context = canvas.getContext('2d')
    // context.imageSmoothingEnabled = false
    this._ctx = context
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this._transform = this._svg.createSVGMatrix()
    this._addEventListeners()
    this._configureCanvas()
  };

  proto$0.resize = function() {
    var canvas = this._canvas
    this.canvasWidth = canvas.clientWidth
    this.canvasHeight = canvas.clientHeight
    this._transform.e = this._transform.f = 0
    this._transform.a = this._transform.d = this._minScale
    this.setTileSize(this.tileSize)
    this._configureCanvas()
    this._clampToBounds()
    this._applyTransform(this._transform)
    this.redraw()
  };

  proto$0._pixelRatio = function() {
    // return 1
    return window.devicePixelRatio
  };

  proto$0.setTool = function(toolName) {
    var tool = this.tools.find(function(tool ) {
      return tool.name === toolName
    })
    if (tool) {
      this._state.tool = toolName
      if (this.callbacks.didSelectTool) {
        this.callbacks.didSelectTool(this._state.tool)
      }
      this.redraw()
    } else {
      console.error('Flask: That tool is not defined.')
    }
  };

  proto$0.setEnabled = function(enabled) {
    this._state.enabled = enabled
  };

  proto$0.setTileSize = function(size) {
    this.tileSize = size
    this._tileCache = {}
    var minScaleX = this.canvasWidth / this._contentSize.width
    var minScaleY = this.canvasHeight / this._contentSize.height
    this._minScale = Math.min(minScaleX, minScaleY)
  };

  // clear the canvas and draw the tiles
  proto$0.redraw = function() {var $D$0;var $D$1;var $D$2;var $D$3;var $D$4;var $D$5;var $D$6;;var $that$0=this;
    // Clear the entire canvas
    var p1 = this._transformedPoint(0, 0)
    var p2 = this._transformedPoint(this.canvasWidth, this.canvasHeight)
    var rect = {
      x: p1.x,
      y: p1.y,
      width: p2.x - p1.x,
      height: p2.y - p1.y,
    }
    this._ctx.clearRect(rect.x, rect.y, rect.width, rect.height)

    this._ctx.fillStyle = '#cccccc'
    this._ctx.fillRect(-1000000000, -1000000000, 2000000000, 2000000000)
    var mins = Math.log(this._minScale) / Math.LN2
    var maxs = Math.log(this._maxScale) / Math.LN2
    var s = Math.log(this._transform.a) / Math.LN2
    var zoomPercent = (s - mins) / (maxs - mins)
    var zoomLevel = Math.max(Math.ceil(zoomPercent * this.maxZoom), 1)
    var numTiles = Math.pow(2, zoomLevel)
    var tileWidth = (this._contentSize.width / numTiles) * this._pixelRatio()
    var tileHeight = (this._contentSize.height / numTiles) * this._pixelRatio()
    for (var j = 0; j < numTiles; j++) {
      for (var k = 0; k < numTiles; k++) {
        var tile = {
          x: j * tileWidth,
          y: k * tileHeight,
          width: tileWidth,
          height: tileHeight,
        }
        if (this._intersectRect(rect, tile)) {
          var image = this._tileImage(zoomLevel, j, k)
          if (image.complete && image.naturalHeight !== 0) {
            // this._ctx.imageSmoothingEnabled = false;
            // this._ctx.imageSmoothingQuality = 'low';
            this._ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height)
          }
          // if the tile at that zoom level is not loaded, show the lower
          // res version at the lower zoom level
          else {
            var zl = zoomLevel - 1
            while (zl > 0) {
              var parentJ = Math.floor((j / Math.pow(2, zoomLevel)) * Math.pow(2, zl))
              var parentK = Math.floor((k / Math.pow(2, zoomLevel)) * Math.pow(2, zl))
              var image$0 = this._tileImage(zl, parentJ, parentK)
              if (image$0.complete && image$0.naturalHeight !== 0) {
                var childTilesPerParent = Math.pow(2, zoomLevel) / Math.pow(2, zl)
                var jRemainder = j - childTilesPerParent * parentJ
                var kRemainder = k - childTilesPerParent * parentK
                var sWidth = image$0.width / childTilesPerParent
                var sHeight = image$0.height / childTilesPerParent
                var sx = Math.floor(jRemainder * sWidth)
                var sy = Math.floor(kRemainder * sHeight)
                // this._ctx.imageSmoothingEnabled = false;
                // this._ctx.imageSmoothingQuality = 'low';
                this._ctx.drawImage(image$0, sx, sy, sWidth, sHeight, tile.x, tile.y, tile.width, tile.height)
                break
              }
              zl -= 1
            }
          }
        }
      }
    }

    // draw in-progress annotation/shapes
    var currentAnnotation = this._currentAnnotation || { shapes: [] }

    // draw all annotations
    $D$3 = (this.annotations.concat(currentAnnotation));$D$0 = GET_ITER$0($D$3);$D$2 = $D$0 === 0;$D$1 = ($D$2 ? $D$3.length : void 0);for (var annotation ;$D$2 ? ($D$0 < $D$1) : !($D$1 = $D$0["next"]())["done"];){annotation = ($D$2 ? $D$3[$D$0++] : $D$1["value"]);
      // when drawing, fade out all other shapes except the current annotation
      if (!this._currentAnnotation || annotation === this._currentAnnotation) {
        this._ctx.globalAlpha = 1.0
      } else {
        this._ctx.globalAlpha = 0.2
      }
      // draw in-progress shapes
      var shapes = annotation.shapes
      if (annotation === currentAnnotation) {
        shapes = shapes.concat(this._currentShape || [])
      }
      // draw shapes
      $D$4 = GET_ITER$0(shapes);$D$6 = $D$4 === 0;$D$5 = ($D$6 ? shapes.length : void 0);for (var shape ;$D$6 ? ($D$4 < $D$5) : !($D$5 = $D$4["next"]())["done"];){shape = ($D$6 ? shapes[$D$4++] : $D$5["value"]);(function(shape){
        // find the right tool for the job
        var tool = $that$0.tools.find(function(tool ) {
          return tool.name === shape.kind
        })

        // set how shape should look by default
        // (can be overriden in drawInContext)
        $that$0._ctx.fillStyle = annotation.color || $that$0._authorColor || '#FF0000'
        $that$0._ctx.strokeStyle = annotation.color || $that$0._authorColor || '#FF0000'
        $that$0._ctx.lineWidth = _lineWidth

        tool.drawInContext($that$0._ctx, tool.scaleGeometry(shape.geometry, $that$0._pixelRatio()))

        // tests bounding box
        // this._ctx.lineWidth = 1;
        // let g = tool.boundingRect(shape.geometry);
        // this._ctx.beginPath();
        // this._ctx.strokeRect(g.x, g.y, g.width, g.height);
        // this._ctx.stroke();
      })(shape);};$D$4 = $D$5 = $D$6 = void 0;

      // tests annotation bounding box
      // this._ctx.lineWidth = 1;
      // let g = this.boundingRectFor(annotation);
      // this._ctx.beginPath();
      // this._ctx.strokeRect(g.x, g.y, g.width, g.height);
      // this._ctx.stroke();
    };$D$0 = $D$1 = $D$2 = $D$3 = void 0;

    this._ctx.globalAlpha = 1.0
  };

  proto$0.setAnnotations = function(annotations) {
    this.annotations = annotations
    this.redraw()
  };

  proto$0.completeAnnotation = function() {
    if (this._currentAnnotation) {
      // if (this.annotations.indexOf(this._currentAnnotation) === -1) {
      //   this.annotations.push(this._currentAnnotation)
      // }
      if (this.callbacks.didFinishAnnotation) {
        this.callbacks.didFinishAnnotation(this._currentAnnotation)
      }
    }
    // this._currentAnnotation = null
    this._state.tool = 'none'
    if (this.callbacks.didSelectTool) {
      this.callbacks.didSelectTool(null)
    }
    this.redraw()
  };

  proto$0.cancelAnnotation = function() {
    if (this._currentAnnotation) {
      if (this.callbacks.didCancelAnnotation) {
        this.callbacks.didCancelAnnotation(this._currentAnnotation)
      }
    }
    this._currentAnnotation = null
    this._state.tool = 'none'
    if (this.callbacks.didSelectTool) {
      this.callbacks.didSelectTool(null)
    }
    this.redraw()
  };

  proto$0.cancelShape = function() {
    if (this._currentShape) {
      if (this.callbacks.didCancelDrawingShape) {
        this.callbacks.didCancelDrawingShape(this._currentShape)
      }
    }
    this._state.drawing = false
    this._currentShape = null
    this.redraw()
  };

  proto$0.selectAnnotation = function(annotation) {
    this._currentAnnotation = annotation
    if (this.callbacks.didSelectAnnotation) {
      this.callbacks.didSelectAnnotation(annotation)
    }
    this.redraw()
  };

  proto$0.boundingRectFor = function(annotation) {var $D$7;var $D$8;var $D$9;var $D$10;;var $that$0=this;
    var minX = Infinity
    var maxX = 0
    var minY = Infinity
    var maxY = 0
    $D$10 = (annotation.shapes);$D$7 = GET_ITER$0($D$10);$D$9 = $D$7 === 0;$D$8 = ($D$9 ? $D$10.length : void 0);for (var shape ;$D$9 ? ($D$7 < $D$8) : !($D$8 = $D$7["next"]())["done"];){shape = ($D$9 ? $D$10[$D$7++] : $D$8["value"]);(function(shape){
      var tool = $that$0.tools.find(function(tool ) {
        return tool.name === shape.kind
      })
      var box = tool.boundingRect(tool.scaleGeometry(shape.geometry, $that$0._pixelRatio()))
      minX = Math.min(minX, box.x)
      maxX = Math.max(maxX, box.x + box.width)
      minY = Math.min(minY, box.y)
      maxY = Math.max(maxY, box.y + box.height)
    })(shape);};$D$7 = $D$8 = $D$9 = $D$10 = void 0;
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  };

  proto$0.zoomToRect = function(rect) {
    var width = this.canvasWidth * this._pixelRatio()
    var height = this.canvasHeight * this._pixelRatio()
    var scaleX = width / rect.width
    var scaleY = height / rect.height
    var scale = Math.min(scaleX, scaleY)
    scale = Flast.clamp(scale, this._minScale, this._maxScale)
    this._transform.a = this._transform.d = scale

    this._transform.e = -rect.x * scale
    this._transform.f = -rect.y * scale

    // this._transform.e += width / 2.0 - (rect.width * scale) / 2.0
    // this._transform.f += height / 2.0 - (rect.height * scale) / 2.0

    this._clampToBounds()
    this._updateTransform()
  };

  proto$0.setTransform = function(transform) {
    this._transform = transform
    this._clampToBounds()
    this._updateTransform()
  };

  proto$0._addEventListeners = function() {
    this._canvas.addEventListener('mousedown', this._mouseDown.bind(this), false)
    this._canvas.addEventListener('mousemove', this._mouseMove.bind(this), false)
    this._canvas.addEventListener('mouseleave', this._mouseLeave.bind(this), false)
    this._canvas.addEventListener('mouseup', this._mouseUp.bind(this), false)
    this._canvas.addEventListener('DOMMouseScroll', this._updateZoom.bind(this), false)
    this._canvas.addEventListener('mousewheel', this._updateZoom.bind(this), false)
    window.addEventListener('keyup', this._keyUp.bind(this), false)
  };

  proto$0._configureCanvas = function() {
    var scale = this._pixelRatio()
    this._canvas.style.width = this.canvasWidth + 'px'
    this._canvas.style.height = this.canvasHeight + 'px'
    // this._canvas.width = this.canvasWidth * scale;
    // this._canvas.height = this.canvasHeight * scale;
    this._canvas.setAttribute('width', this.canvasWidth * scale)
    this._canvas.setAttribute('height', this.canvasHeight * scale)
    this._ctx.scale(scale, scale)
    _hitMargin = 60 * this._pixelRatio() * 2
    _lineWidth = 20 * this._pixelRatio() * 2
  };

  proto$0._updateZoom = function(e) {
    var delta = e.wheelDelta ? e.wheelDelta / 40 : e.detail ? -e.detail : 0
    if (delta) {
      var pt = this._eventPoint(e)

      // update any shape that is currently being drawn
      if (this._currentShape) {
        var tool = this._currentTool()
        this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, {
          x: pt.x / this._pixelRatio(),
          y: pt.y / this._pixelRatio(),
        })
      }

      var factor = Math.pow(this.zoomSpeed, delta)
      var scale = Flast.clamp(this._transform.a * factor, this._minScale, this._maxScale)

      // move point of mouse to center
      this._transform = this._transform.translate(pt.x, pt.y)
      // scale
      this._transform.a = this._transform.d = scale
      // move back
      this._transform = this._transform.translate(-pt.x, -pt.y)

      this._clampToBounds()
      this._updateTransform()
    }
    return e.preventDefault() && false
  };

  proto$0._mouseDown = function(e) {
    console.log('mouse down')
    this._state.mouse = 'down'
    document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none'
    this._dragStart = this._eventPoint(e)
  };

  proto$0._mouseUp = function(e) {var $D$11;var $D$12;var $D$13;var $D$14;var $D$15;var $D$16;var $D$17;var $D$18;;var $that$0=this;
    console.log('mouse up')
    console.log(this._state)
    this._state.mouse = 'up'

    // stop dragging
    if (this._state.dragging) {
      console.log('stop dragging')
      this._state.dragging = false
    }

    // start drawing
    else if (!this._state.drawing && this._state.tool !== 'none' && this._state.enabled) {
      console.log('start dragging')
      this._state.drawing = true
      var pt = this._eventPoint(e)
      var tool = this._currentTool()
      // set current shape
      var scaled = { x: pt.x / this._pixelRatio(), y: pt.y / this._pixelRatio() }
      this._currentShape = {
        kind: tool.name,
        geometry: tool.startGeometry(scaled),
      }
      // callback
      if (this.callbacks.didBeginDrawingShape) {
        this.callbacks.didBeginDrawingShape(this._currentShape)
      }
    }

    // stop drawing
    else if (this._state.drawing) {
      console.log('stop dragging')
      this._state.drawing = false
      // if there is not a current annotation
      if (!this._currentAnnotation) {
        // start new annotation
        this._currentAnnotation = { shapes: [] }
        // callback
        if (this.callbacks.didStartAnnotation) {
          this.callbacks.didStartAnnotation(this._currentAnnotation)
        }
      }
      // finalize drawing if tool provides it
      var tool$0 = this._currentTool()
      if (tool$0.finalGeometry) {
        this._currentShape.geometry = tool$0.finalGeometry(this._currentShape.geometry)
      }

      // add shape to current annotation
      this._currentAnnotation.shapes.push(this._currentShape)
      // callback
      if (this.callbacks.didFinishDrawingShape) {
        this.callbacks.didFinishDrawingShape(this._currentShape)
      }
      this._currentShape = null
      this.redraw()
    }

    // if nothing already selected
    else if (this._state.enabled) {
      console.log('try select annotation')
      // if mouse up over a shape
      var pt$0 = this._eventPoint(e)
      $D$14 = (this.annotations);$D$11 = GET_ITER$0($D$14);$D$13 = $D$11 === 0;$D$12 = ($D$13 ? $D$14.length : void 0);for (var annotation ;$D$13 ? ($D$11 < $D$12) : !($D$12 = $D$11["next"]())["done"];){annotation = ($D$13 ? $D$14[$D$11++] : $D$12["value"]);
        $D$18 = (annotation.shapes);$D$15 = GET_ITER$0($D$18);$D$17 = $D$15 === 0;$D$16 = ($D$17 ? $D$18.length : void 0);for (var shape ;$D$17 ? ($D$15 < $D$16) : !($D$16 = $D$15["next"]())["done"];){shape = ($D$17 ? $D$18[$D$15++] : $D$16["value"]);;var $retVoid$0;(function(shape){
          // find the tool that drew this shape
          var tool = $that$0.tools.find(function(tool ) {
            return tool.name === shape.kind
          })
          if (tool.hitTest(tool.scaleGeometry(shape.geometry, $that$0._pixelRatio()), pt$0)) {
            $that$0.selectAnnotation(annotation)
            if ($that$0.callbacks.didSelectAnnotation) {
              $that$0.callbacks.didSelectAnnotation(annotation)
            }
            {$retVoid$0 = true;return}
          }
        })(shape);if($retVoid$0===true){$retVoid$0=void 0;return}};$D$15 = $D$16 = $D$17 = $D$18 = void 0;
      };$D$11 = $D$12 = $D$13 = $D$14 = void 0;
    }
  };

  proto$0._mouseMove = function(e) {var $D$19;var $D$20;var $D$21;var $D$22;var $D$23;var $D$24;var $D$25;var $D$26;;var $that$0=this;
    var pt = this._eventPoint(e)
    if (this._state.mouse === 'down' && !this._state.dragging) {
      var distance = Flast._distance(pt, this._dragStart)
      // have to move a threshold distance to be counted as dragging
      if (distance > 10) {
        this._state.dragging = true
      }
    }
    if (this._state.dragging) {
      var dx = pt.x - this._dragStart.x
      var dy = pt.y - this._dragStart.y
      this._transform = this._transform.translate(dx, dy)
      this._clampToBounds()
      this._updateTransform()
    }
    if (this._state.drawing) {
      var tool = this._currentTool()
      this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, {
        x: pt.x / this._pixelRatio(),
        y: pt.y / this._pixelRatio(),
      })
      this.redraw()
    }
    if (this._state.mouse === 'up' && !this._state.drawing && this._state.enabled) {
      var pt$1 = this._eventPoint(e)
      var found = false
      $D$22 = (this.annotations);$D$19 = GET_ITER$0($D$22);$D$21 = $D$19 === 0;$D$20 = ($D$21 ? $D$22.length : void 0);for (var annotation ;$D$21 ? ($D$19 < $D$20) : !($D$20 = $D$19["next"]())["done"];){annotation = ($D$21 ? $D$22[$D$19++] : $D$20["value"]);
        $D$26 = (annotation.shapes);$D$23 = GET_ITER$0($D$26);$D$25 = $D$23 === 0;$D$24 = ($D$25 ? $D$26.length : void 0);for (var shape ;$D$25 ? ($D$23 < $D$24) : !($D$24 = $D$23["next"]())["done"];){shape = ($D$25 ? $D$26[$D$23++] : $D$24["value"]);(function(shape){
          // find the tool that drew this shape
          var tool = $that$0.tools.find(function(tool ) {
            return tool.name === shape.kind
          })
          if (tool.hitTest(tool.scaleGeometry(shape.geometry, $that$0._pixelRatio()), pt$1)) {
            found = true
          }
        })(shape);};$D$23 = $D$24 = $D$25 = $D$26 = void 0;
      };$D$19 = $D$20 = $D$21 = $D$22 = void 0;
      if (this.callbacks.mouseOverAnnotation) {
        this.callbacks.mouseOverAnnotation(found)
      }
    }
  };

  proto$0._mouseLeave = function(e) {
    if (this._state.dragging) {
      this._state.dragging = false
      this._state.mouse = 'up'
    }
  };

  proto$0._keyUp = function(e) {var $D$27;var $D$28;var $D$29;var $D$30;
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return true
    }

    // cancel drawing
    if (this._state.drawing && e.which === 27) {
      this.cancelShape()
      e.preventDefault()
      e.stopPropagation()
      return true
    } else if (e.which === 13 && this._currentAnnotation) {
      this.completeAnnotation()
    } else if (this._state.enabled) {
      $D$30 = (this.tools);$D$27 = GET_ITER$0($D$30);$D$29 = $D$27 === 0;$D$28 = ($D$29 ? $D$30.length : void 0);for (var tool ;$D$29 ? ($D$27 < $D$28) : !($D$28 = $D$27["next"]())["done"];){tool = ($D$29 ? $D$30[$D$27++] : $D$28["value"]);
        if (e.which === tool.keyCode) {
          this._state.tool = tool.name
          if (this.callbacks.didSelectTool) {
            this.callbacks.didSelectTool(this._state.tool)
          }
          e.preventDefault()
          e.stopPropagation()
          return true
        }
      };$D$27 = $D$28 = $D$29 = $D$30 = void 0;
    }
    return true
  };

  // transform the point from page space to canvas space
  proto$0._transformedPoint = function(x, y) {
    var pt = this._svg.createSVGPoint()
    pt.x = x * this._pixelRatio()
    pt.y = y * this._pixelRatio()
    return pt.matrixTransform(this._transform.inverse())
  };

  proto$0._applyTransform = function(t) {
    this._ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f)
  };

  // set the transform on the context
  proto$0._updateTransform = function() {
    this._applyTransform(this._transform)
    this.redraw()
    if (this.callbacks.didUpdateTransform) {
      this.callbacks.didUpdateTransform(this._transform)
    }
  };

  proto$0._clampToBounds = function() {
    var contentWidth = this._contentSize.width * this._transform.a * this._pixelRatio()
    var contentHeight = this._contentSize.height * this._transform.d * this._pixelRatio()
    var canvasWidth = this.canvasWidth * this._pixelRatio()
    var canvasHeight = this.canvasHeight * this._pixelRatio()
    var adjustedContentWidth = contentWidth
    var adjustedContentHeight = contentHeight
    if (contentWidth / contentHeight < canvasWidth / canvasHeight) {
      adjustedContentWidth = canvasWidth * (contentHeight / canvasHeight)
    } else {
      adjustedContentHeight = canvasHeight * (contentWidth / canvasWidth)
    }

    var xMax = (adjustedContentWidth - contentWidth) / 2.0
    var xMin = -adjustedContentWidth + canvasWidth + xMax
    this._transform.e = Flast.clamp(this._transform.e, xMin, xMax)

    var yMax = (adjustedContentHeight - contentHeight) / 2.0
    var yMin = -adjustedContentHeight + canvasHeight + yMax
    this._transform.f = Flast.clamp(this._transform.f, yMin, yMax)
  };

  static$0.clamp = function(value, min, max) {
    return Math.max(Math.min(value, max), min)
  };

  proto$0._eventPoint = function(e) {
    var x = e.offsetX || e.pageX - this._canvas.offsetLeft
    var y = e.offsetY || e.pageY - this._canvas.offsetTop
    return this._transformedPoint(x, y)
  };

  proto$0._tileImage = function(zoom, x, y) {var this$0 = this;
    var url = this.getTileUrl(zoom, x, y)
    var image = this._tileCache[url]
    if (!image) {
      image = new Image()
      image.src = url
      image.onload = function()  {
        this$0.redraw()
      }
      this._tileCache[url] = image
    }
    return image
  };

  proto$0._intersectRect = function(r1, r2) {
    r1 = {
      left: r1.x,
      right: r1.x + r1.width,
      top: r1.y,
      bottom: r1.y + r1.height,
    }
    r2 = {
      left: r2.x,
      right: r2.x + r2.width,
      top: r2.y,
      bottom: r2.y + r2.height,
    }
    return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top)
  };

  proto$0._currentTool = function() {var this$0 = this;
    return this.tools.find(function(tool ) {
      return tool.name === this$0._state.tool
    })
  };

  static$0._distance = function(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
  };

  function $static_LINE_get$0() {
    return {
      name: 'line',
      keyCode: 76,
      startGeometry: function(pt) {
        return {
          p1: {
            x: pt.x,
            y: pt.y,
          },
          p2: {
            x: pt.x,
            y: pt.y,
          },
        }
      },
      updateGeometry: function(geometry, pt) {
        geometry.p2 = {
          x: pt.x,
          y: pt.y,
        }
        return geometry
      },
      boundingRect: function(geometry) {
        var minX = Math.min(geometry.p1.x, geometry.p2.x)
        var maxX = Math.max(geometry.p1.x, geometry.p2.x)
        var minY = Math.min(geometry.p1.y, geometry.p2.y)
        var maxY = Math.max(geometry.p1.y, geometry.p2.y)
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      },
      drawInContext: function(ctx, geometry) {
        var p1 = geometry.p1
        var p2 = geometry.p2
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      },
      hitTest: function(geometry, pt) {
        return Flast._onLine(geometry, pt)
      },
      scaleGeometry: function(geometry, factor) {
        return {
          p1: { x: geometry.p1.x * factor, y: geometry.p1.y * factor },
          p2: { x: geometry.p2.x * factor, y: geometry.p2.y * factor },
        }
      },
    }
  };DPS$0(Flast,{LINE: {"get": $static_LINE_get$0, "configurable":true,"enumerable":true}, ARROW: {"get": $static_ARROW_get$0, "configurable":true,"enumerable":true}, CIRCLE: {"get": $static_CIRCLE_get$0, "configurable":true,"enumerable":true}, RECTANGLE: {"get": $static_RECTANGLE_get$0, "configurable":true,"enumerable":true}});

  function $static_ARROW_get$0() {
    return {
      name: 'arrow',
      keyCode: 65,
      startGeometry: function(pt) {
        return {
          p1: {
            x: pt.x,
            y: pt.y,
          },
          p2: {
            x: pt.x,
            y: pt.y,
          },
        }
      },
      updateGeometry: function(geometry, pt) {
        geometry.p2 = {
          x: pt.x,
          y: pt.y,
        }
        return geometry
      },
      boundingRect: function(geometry) {
        var minX = Math.min(geometry.p1.x, geometry.p2.x)
        var maxX = Math.max(geometry.p1.x, geometry.p2.x)
        var minY = Math.min(geometry.p1.y, geometry.p2.y)
        var maxY = Math.max(geometry.p1.y, geometry.p2.y)
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      },
      drawInContext: function(ctx, geometry) {
        var p1 = geometry.p1
        var p2 = geometry.p2
        var arrowHeight = _lineWidth * 6

        ctx.beginPath()
        ctx.moveTo(p2.x, p2.y)
        var vector = {
          dx: p1.x - p2.x,
          dy: p1.y - p2.y,
        }
        var length = Math.sqrt(Math.pow(vector.dx, 2) + Math.pow(vector.dy, 2))
        var percent = (length - arrowHeight) / length
        ctx.lineTo(p2.x + vector.dx * percent, p2.y + vector.dy * percent)
        ctx.stroke()

        var radians = Math.atan((p1.y - p2.y) / (p1.x - p2.x))
        radians += ((p2.x <= p1.x ? 90 : -90) * Math.PI) / 180

        ctx.save()
        ctx.beginPath()
        ctx.translate(p1.x, p1.y)
        ctx.rotate(radians)
        ctx.moveTo(0, 0)
        ctx.lineTo(_lineWidth * 3, arrowHeight)
        ctx.lineTo(-(_lineWidth * 3), arrowHeight)
        ctx.closePath()
        ctx.restore()
        ctx.fill()
      },
      hitTest: function(geometry, pt) {
        return Flast._onLine(geometry, pt)
      },
      scaleGeometry: function(geometry, factor) {
        return {
          p1: { x: geometry.p1.x * factor, y: geometry.p1.y * factor },
          p2: { x: geometry.p2.x * factor, y: geometry.p2.y * factor },
        }
      },
    }
  }

  function $static_CIRCLE_get$0() {
    return {
      name: 'circle',
      keyCode: 67,
      startGeometry: function(pt) {
        return {
          center: {
            x: pt.x,
            y: pt.y,
          },
          radius: 0,
        }
      },
      updateGeometry: function(geometry, pt) {
        var c = geometry.center
        geometry.radius = Flast._distance(pt, c)
        return geometry
      },
      boundingRect: function(geometry) {
        var minX = geometry.center.x - geometry.radius
        var maxX = geometry.center.x + geometry.radius
        var minY = geometry.center.y - geometry.radius
        var maxY = geometry.center.y + geometry.radius
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      },
      drawInContext: function(ctx, geometry) {
        var g = geometry
        ctx.beginPath()
        ctx.arc(g.center.x, g.center.y, g.radius, 0, 2 * Math.PI)
        ctx.stroke()
      },
      hitTest: function(geometry, pt) {
        var distance = Flast._distance(pt, geometry.center)
        return Math.abs(distance - geometry.radius) < _hitMargin
      },
      scaleGeometry: function(geometry, factor) {
        return {
          center: {
            x: geometry.center.x * factor,
            y: geometry.center.y * factor,
          },
          radius: geometry.radius * factor,
        }
      },
    }
  }

  function $static_RECTANGLE_get$0() {
    return {
      name: 'rectangle',
      keyCode: 82,
      startGeometry: function(pt) {
        return {
          x: pt.x,
          y: pt.y,
          width: 0,
          height: 0,
        }
      },
      updateGeometry: function(geometry, pt) {
        geometry.width = pt.x - geometry.x
        geometry.height = pt.y - geometry.y
        return geometry
      },
      finalGeometry: function(geometry) {
        return {
          x: Math.min(geometry.x, geometry.x + geometry.width),
          y: Math.min(geometry.y, geometry.y + geometry.height),
          width: Math.abs(geometry.width),
          height: Math.abs(geometry.height),
        }
      },
      boundingRect: function(geometry) {
        return geometry
      },
      drawInContext: function(ctx, geometry) {
        var g = geometry
        ctx.beginPath()
        ctx.strokeRect(g.x, g.y, g.width, g.height)
        ctx.stroke()
      },
      hitTest: function(geometry, pt) {var $D$31;var $D$32;var $D$33;
        var distances = [
          Math.abs(geometry.x - pt.x),
          Math.abs(geometry.x + geometry.width - pt.x),
          Math.abs(geometry.y - pt.y),
          Math.abs(geometry.y + geometry.height - pt.y),
        ]
        $D$31 = GET_ITER$0(distances);$D$33 = $D$31 === 0;$D$32 = ($D$33 ? distances.length : void 0);for (var dist ;$D$33 ? ($D$31 < $D$32) : !($D$32 = $D$31["next"]())["done"];){dist = ($D$33 ? distances[$D$31++] : $D$32["value"]);
          if (dist < _hitMargin) return true
        };$D$31 = $D$32 = $D$33 = void 0;
      },
      scaleGeometry: function(geometry, factor) {
        return {
          x: geometry.x * factor,
          y: geometry.y * factor,
          width: geometry.width * factor,
          height: geometry.height * factor,
        }
      },
    }
  }

  static$0._onLine = function(line, point) {
    var distance = this._pointDistToLine(point, line)
    return distance < _hitMargin
  };

  static$0._pointDistToLine = function(point, line) {
    var x = point.x
    var y = point.y
    var x1 = line.p1.x
    var y1 = line.p1.y
    var x2 = line.p2.x
    var y2 = line.p2.y

    var A = x - x1
    var B = y - y1
    var C = x2 - x1
    var D = y2 - y1

    var dot = A * C + B * D
    var len_sq = C * C + D * D
    var param = -1
    if (len_sq != 0)
      //in case of 0 length line
      param = dot / len_sq

    var xx, yy

    if (param < 0) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }

    var dx = x - xx
    var dy = y - yy
    return Math.sqrt(dx * dx + dy * dy)
  };
MIXIN$0(Flast,static$0);MIXIN$0(Flast.prototype,proto$0);static$0=proto$0=void 0;return Flast;})();
