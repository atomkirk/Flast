let _hitMargin
let _lineWidth

class Flast {
  constructor(canvas, options = {}) {
    this._canvas = canvas
    this._once(canvas)
    this._init(options)
    this.redraw()
  }

  reinit(options) {
    let merged = Object.assign(this.originalOptions, options)
    this._init(merged)
    this.redraw()
  }

  destroy() {
    window.removeEventListener('keyup', this._keyUpHandler)
  }

  _init(options) {
    this.originalOptions = options
    this.maxZoom = options.maxZoom || 4
    this.zoomSpeed = options.zoomSpeed || 1.01
    this.getTileUrl =
      options.getTileUrl ||
      function(zoom, x, y) {
        return `https://s3-us-west-2.amazonaws.com/useredline-api/development/tiles/168d136e60b14850d7a671e8/tile_${zoom}_${x}x${y}.jpg`
      }
    this.tools = options.tools || [Flast.ARROW, Flast.LINE, Flast.CIRCLE, Flast.RECTANGLE]
    this.annotations = options.annotations || []
    this.callbacks = options.callbacks || {}
    this._selectedAnnotation = null
    this._drawingAnnotation = null
    this._currentShape = null
    this._maxScale = options.maxScale || 2
    this._authorColor = options.authorColor
    this._state = {
      mouse: 'up', // 'down'
      tool: 'none', // 'arrow', 'line', 'circle', 'rectangle', 'freehand'
      dragging: false,
      drawing: false,
      enabled: true,
      calibration: options.calibration
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
  }

  _once(canvas) {
    this.canvasWidth = canvas.clientWidth
    this.canvasHeight = canvas.clientHeight
    let context = canvas.getContext('2d')
    // context.imageSmoothingEnabled = false
    this._ctx = context
    this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this._transform = this._svg.createSVGMatrix()
    this._addEventListeners()
    this._configureCanvas()
  }

  resize() {
    let canvas = this._canvas
    this.canvasWidth = canvas.clientWidth
    this.canvasHeight = canvas.clientHeight
    this._transform.e = this._transform.f = 0
    this._transform.a = this._transform.d = this._minScale
    this.setTileSize(this.tileSize)
    this._configureCanvas()
    this._clampToBounds()
    this._applyTransform(this._transform)
    this.redraw()
  }

  _pixelRatio() {
    // return 1
    return window.devicePixelRatio
  }

  setTool(toolName) {
    if (!toolName) {
      this._state.tool = 'none'
      if (this.callbacks.didSelectTool) {
        this.callbacks.didSelectTool(null)
      }
      return
    }
    let tool = this.tools.find(tool => {
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
  }

  setEnabled(enabled) {
    this._state.enabled = enabled
  }

  setTileSize(size) {
    this.tileSize = size
    this._tileCache = {}
    let minScaleX = this.canvasWidth / this._contentSize.width
    let minScaleY = this.canvasHeight / this._contentSize.height
    this._minScale = Math.min(minScaleX, minScaleY)
  }

  // clear the canvas and draw the tiles
  redraw() {
    // Clear the entire canvas
    let p1 = this._transformedPoint(0, 0)
    let p2 = this._transformedPoint(this.canvasWidth, this.canvasHeight)
    let rect = {
      x: p1.x,
      y: p1.y,
      width: p2.x - p1.x,
      height: p2.y - p1.y,
    }
    this._ctx.clearRect(rect.x, rect.y, rect.width, rect.height)

    this._ctx.fillStyle = '#cccccc'
    this._ctx.fillRect(-1000000000, -1000000000, 2000000000, 2000000000)
    let mins = Math.log(this._minScale) / Math.LN2
    let maxs = Math.log(this._maxScale) / Math.LN2
    let s = Math.log(this._transform.a) / Math.LN2
    let zoomPercent = (s - mins) / (maxs - mins)
    let zoomLevel = Math.max(Math.ceil(zoomPercent * this.maxZoom), 1)
    let numTiles = Math.pow(2, zoomLevel)
    let tileWidth = (this._contentSize.width / numTiles) * this._pixelRatio()
    let tileHeight = (this._contentSize.height / numTiles) * this._pixelRatio()
    for (let j = 0; j < numTiles; j++) {
      for (let k = 0; k < numTiles; k++) {
        let tile = {
          x: j * tileWidth,
          y: k * tileHeight,
          width: tileWidth,
          height: tileHeight,
        }
        if (this._intersectRect(rect, tile)) {
          let image = this._tileImage(zoomLevel, j, k)
          if (image.complete && image.naturalHeight !== 0) {
            // this._ctx.imageSmoothingEnabled = false;
            // this._ctx.imageSmoothingQuality = 'low';
            this._ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height)
          }
          // if the tile at that zoom level is not loaded, show the lower
          // res version at the lower zoom level
          else {
            let zl = zoomLevel - 1
            while (zl > 0) {
              let parentJ = Math.floor((j / Math.pow(2, zoomLevel)) * Math.pow(2, zl))
              let parentK = Math.floor((k / Math.pow(2, zoomLevel)) * Math.pow(2, zl))
              let image = this._tileImage(zl, parentJ, parentK)
              if (image.complete && image.naturalHeight !== 0) {
                let childTilesPerParent = Math.pow(2, zoomLevel) / Math.pow(2, zl)
                let jRemainder = j - childTilesPerParent * parentJ
                let kRemainder = k - childTilesPerParent * parentK
                let sWidth = image.width / childTilesPerParent
                let sHeight = image.height / childTilesPerParent
                let sx = Math.floor(jRemainder * sWidth)
                let sy = Math.floor(kRemainder * sHeight)
                // this._ctx.imageSmoothingEnabled = false;
                // this._ctx.imageSmoothingQuality = 'low';
                this._ctx.drawImage(image, sx, sy, sWidth, sHeight, tile.x, tile.y, tile.width, tile.height)
                break
              }
              zl -= 1
            }
          }
        }
      }
    }

    // draw in-progress annotation/shapes
    let currentAnnotation = this._drawingAnnotation || { shapes: [] }

    // draw all annotations
    for (let annotation of this.annotations.concat(currentAnnotation)) {
      // when drawing, fade out all other shapes except the current annotation
      if (
        (this._selectedAnnotation && !this.callbacks.compareAnnotations(annotation, this._selectedAnnotation)) ||
        (this._drawingAnnotation && !this.callbacks.compareAnnotations(annotation, this._drawingAnnotation))
      ) {
        this._ctx.globalAlpha = 0.2
      } else {
        this._ctx.globalAlpha = 1.0
      }
      // draw in-progress shapes
      let shapes = annotation.shapes
      if (annotation === currentAnnotation) {
        shapes = shapes.concat(this._currentShape || [])
      }
      // draw shapes
      for (let shape of shapes) {
        // find the right tool for the job
        let tool = this.tools.find(tool => {
          return tool.name === shape.kind
        })

        // set how shape should look by default
        // (can be overriden in drawInContext)
        this._ctx.fillStyle = annotation.color || this._authorColor || '#FF0000'
        this._ctx.strokeStyle = annotation.color || this._authorColor || '#FF0000'
        // if we decide we want the line to stay the same width at all scales:
        // this._ctx.lineWidth = (1 / this._transform.a) * _lineWidth
        this._ctx.lineWidth = _lineWidth

        tool.drawInContext(this._ctx, tool.scaleGeometry(shape.geometry, this._pixelRatio()))

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

    this._ctx.globalAlpha = 1.0
  }

  setAnnotations(annotations) {
    this.annotations = annotations
    this.redraw()
  }

  completeAnnotation() {
    let cb = () => {
      this._drawingAnnotation = null
      this._state.tool = 'none'
      if (this.callbacks.didSelectTool) {
        this.callbacks.didSelectTool(null)
      }
      this.redraw()
    }
    if (this._drawingAnnotation && this.callbacks.didFinishAnnotation) {
      this.callbacks.didFinishAnnotation(this._drawingAnnotation, cb)
    } else {
      cb()
    }
  }

  cancelAnnotation() {
    if (this._drawingAnnotation) {
      if (this.callbacks.didCancelAnnotation) {
        this.callbacks.didCancelAnnotation(this._drawingAnnotation)
      }
    }
    this._drawingAnnotation = null
    if (this.callbacks.didSelectTool && this._state.tool !== 'none') {
      this.callbacks.didSelectTool(null)
    }
    this._state.tool = 'none'
    this.redraw()
  }

  cancelShape() {
    if (this._currentShape) {
      if (this.callbacks.didCancelDrawingShape) {
        this.callbacks.didCancelDrawingShape(this._currentShape)
      }
    }
    this._state.drawing = false
    this._currentShape = null
    this.redraw()
  }

  selectAnnotation(annotation) {
    this._selectedAnnotation = annotation
    if (this.callbacks.didSelectAnnotation) {
      this.callbacks.didSelectAnnotation(annotation)
    }
    this.redraw()
  }

  boundingRectFor(annotation) {
    let minX = Infinity
    let maxX = 0
    let minY = Infinity
    let maxY = 0
    for (let shape of annotation.shapes) {
      let tool = this.tools.find(tool => {
        return tool.name === shape.kind
      })
      let box = tool.boundingRect(tool.scaleGeometry(shape.geometry, this._pixelRatio()))
      minX = Math.min(minX, box.x)
      maxX = Math.max(maxX, box.x + box.width)
      minY = Math.min(minY, box.y)
      maxY = Math.max(maxY, box.y + box.height)
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  zoomToRect(rect) {
    let width = this.canvasWidth * this._pixelRatio()
    let height = this.canvasHeight * this._pixelRatio()
    let scaleX = width / rect.width
    let scaleY = height / rect.height
    let scale = Math.min(scaleX, scaleY)
    scale = Flast.clamp(scale, this._minScale, this._maxScale)
    this._transform.a = this._transform.d = scale

    this._transform.e = -rect.x * scale
    this._transform.f = -rect.y * scale

    // this._transform.e += width / 2.0 - (rect.width * scale) / 2.0
    // this._transform.f += height / 2.0 - (rect.height * scale) / 2.0

    this._clampToBounds()
    this._updateTransform()
  }

  setTransform(transform) {
    this._transform = transform
    this._clampToBounds()
    this._updateTransform()
  }

  getTool(name) {
    return this.tools.find(tool => {
      return tool.name === name
    })
  }

  getDimensions({ kind, geometry }) {
    let tool = this.tools.find(tool => {
      return tool.name === kind
    })

    if (!this._state.calibration || !(tool && tool.dimensions)) {
      return null
    }

    return tool.dimensions(geometry).map(({ key, value }) => {
      if (key === 'area') {
        return { key: key, value: value * Math.pow(this._state.calibration, 2) }
      } else {
        return { key: key, value: value * this._state.calibration }
      }
    })
  }

  _addEventListeners() {
    this._canvas.addEventListener('mousedown', this._mouseDown.bind(this), false)
    this._canvas.addEventListener('mousemove', this._mouseMove.bind(this), false)
    this._canvas.addEventListener('mouseleave', this._mouseLeave.bind(this), false)
    this._canvas.addEventListener('mouseup', this._mouseUp.bind(this), false)
    this._canvas.addEventListener('DOMMouseScroll', this._updateZoom.bind(this), false)
    this._canvas.addEventListener('mousewheel', this._updateZoom.bind(this), false)
    this._keyUpHandler = this._keyUp.bind(this)
    window.addEventListener('keyup', this._keyUpHandler, false)
  }

  _configureCanvas() {
    var scale = this._pixelRatio()
    this._canvas.style.width = this.canvasWidth + 'px'
    this._canvas.style.height = this.canvasHeight + 'px'
    // this._canvas.width = this.canvasWidth * scale;
    // this._canvas.height = this.canvasHeight * scale;
    this._canvas.setAttribute('width', this.canvasWidth * scale)
    this._canvas.setAttribute('height', this.canvasHeight * scale)
    this._ctx.scale(scale, scale)
    _hitMargin = 60 * this._pixelRatio() * 2
    _lineWidth = 10 * this._pixelRatio() * 2
  }

  _updateZoom(e) {
    let delta = e.wheelDelta ? e.wheelDelta / 40 : e.detail ? -e.detail : 0
    if (delta) {
      let pt = this._eventPoint(e)

      // update any shape that is currently being drawn
      if (this._currentShape) {
        let tool = this._currentTool()
        this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, {
          x: pt.x / this._pixelRatio(),
          y: pt.y / this._pixelRatio(),
        })
      }

      let factor = Math.pow(this.zoomSpeed, delta)
      let scale = Flast.clamp(this._transform.a * factor, this._minScale, this._maxScale)

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
  }

  _mouseDown(e) {
    this._state.mouse = 'down'
    document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none'
    this._dragStart = this._eventPoint(e)
  }

  _mouseUp(e) {
    this._state.mouse = 'up'
    let pt = this._eventPoint(e)

    // stop dragging
    if (this._state.dragging) {
      this._state.dragging = false
      if (this.callbacks.didEndDragging) {
        this.callbacks.didEndDragging()
      }
    }

    // start drawing
    else if (!this._state.drawing && this._state.tool !== 'none' && this._state.enabled) {
      this._state.drawing = true
      let tool = this._currentTool()
      // set current shape
      let scaled = { x: pt.x / this._pixelRatio(), y: pt.y / this._pixelRatio() }
      this._currentShape = {
        kind: tool.name,
        geometry: tool.startGeometry(scaled),
      }
      // callback
      if (this.callbacks.didBeginDrawingShape) {
        this.callbacks.didBeginDrawingShape(this._currentShape)
      }
    }

    // stop drawing / update shape
    else if (this._state.drawing) {
      const tool = this._currentTool()

      const nextPoint = {
        x: pt.x / this._pixelRatio(),
        y: pt.y / this._pixelRatio(),
      }

      if (tool.shouldAddSegment && tool.shouldAddSegment(this._currentShape.geometry, nextPoint, e)) {
        this._currentShape.geometry = tool.addSegment(this._currentShape.geometry, nextPoint)
        if (this.callbacks.didUpdateDrawingShape) {
          this.callbacks.didUpdateDrawingShape({ shape: this._currentShape, event: e })
        }
        this.redraw()
      } else {
        this._state.drawing = false
        // if there is not a current annotation
        if (!this._drawingAnnotation) {
          // start new annotation
          this._drawingAnnotation = { shapes: [] }
          // callback
          if (this.callbacks.didStartAnnotation) {
            this.callbacks.didStartAnnotation(this._drawingAnnotation)
          }
        }
        // finalize drawing if tool provides it
        if (tool.finalGeometry) {
          this._currentShape.geometry = tool.finalGeometry(this._currentShape.geometry)
        }

        // add shape to current annotation
        this._drawingAnnotation.shapes.push(this._currentShape)
        // callback
        if (this.callbacks.didFinishDrawingShape) {
          this.callbacks.didFinishDrawingShape(this._currentShape)
        }

        // if we're calibrating, we don't want to keep drawing
        if (this._state.tool === 'calibrator') {
          let answer = Flast.parseUnits(this.callbacks.promptForCalibration())
          if (answer) {
            let feet = answer.value
            let { p1, p2 } = this._currentShape.geometry
            let pixels = Flast._distance(p2, p1)
            this._state.calibration = feet / pixels
            if (this.callbacks.didCalibrate) {
              this.callbacks.didCalibrate(this._state.calibration)
            }
          }
          this.cancelAnnotation()
        }

        this._currentShape = null
        this.redraw()
      }
    }

    // if nothing already selected
    else if (this._state.enabled) {
      // if mouse up over a shape
      for (let annotation of this.annotations) {
        for (let shape of annotation.shapes) {
          // find the tool that drew this shape
          let tool = this.tools.find(tool => {
            return tool.name === shape.kind
          })
          if (tool.hitTest(tool.scaleGeometry(shape.geometry, this._pixelRatio()), pt)) {
            if (this.callbacks.didSelectAnnotation) {
              this.callbacks.didSelectAnnotation(annotation)
            }
            return
          }
        }
      }
    }
  }

  _mouseMove(e) {
    let pt = this._eventPoint(e)
    if (this._state.mouse === 'down' && !this._state.dragging) {
      let distance = Flast._distance(pt, this._dragStart)
      // have to move a threshold distance to be counted as dragging
      if (distance > 10 / this._transform.a) {
        this._state.dragging = true
        if (this.callbacks.didBeginDragging) {
          this.callbacks.didBeginDragging()
        }
      }
      return
    }
    if (this._state.dragging) {
      let dx = pt.x - this._dragStart.x
      let dy = pt.y - this._dragStart.y
      this._transform = this._transform.translate(dx, dy)
      this._clampToBounds()
      this._updateTransform()
      return
    }
    if (this._state.drawing) {
      let tool = this._currentTool()
      this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, {
        x: pt.x / this._pixelRatio(),
        y: pt.y / this._pixelRatio(),
      })
      if (this.callbacks.didUpdateDrawingShape) {
        this.callbacks.didUpdateDrawingShape({ shape: this._currentShape, event: e })
      }
      this.redraw()
    }
    if (this._state.mouse === 'up' && !this._state.drawing && this._state.enabled) {
      let pt = this._eventPoint(e)
      var found = {}
      for (let annotation of this.annotations) {
        for (let shape of annotation.shapes) {
          // find the tool that drew this shape
          let tool = this.tools.find(tool => {
            return tool.name === shape.kind
          })
          if (tool.hitTest(tool.scaleGeometry(shape.geometry, this._pixelRatio()), pt)) {
            found = {
              annotation,
              shape,
              event: e
            }
          }
        }
      }
      if (this.callbacks.mouseOverAnnotation) {
        this.callbacks.mouseOverAnnotation(found)
      }
    }
  }

  _mouseLeave(e) {
    if (this._state.dragging) {
      this._state.dragging = false
      this._state.mouse = 'up'
    }
  }

  _keyUp(e) {
    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return true
    }

    if (!this._state.enabled) {
      return false
    }

    // cancel drawing
    if (this._state.drawing && e.which === 27) {
      this.cancelShape()
      e.preventDefault()
      e.stopPropagation()
      return true
    } else if (e.which === 13 && this._drawingAnnotation) {
      this.completeAnnotation()
    } else if (this._state.enabled) {
      for (let tool of this.tools) {
        if (e.which === tool.keyCode) {
          this._state.tool = tool.name
          if (this.callbacks.didSelectTool) {
            this.callbacks.didSelectTool(this._state.tool)
          }
          e.preventDefault()
          e.stopPropagation()
          return true
        }
      }
    }
    return true
  }

  // transform the point from page space to canvas space
  _transformedPoint(x, y) {
    let pt = this._svg.createSVGPoint()
    pt.x = x * this._pixelRatio()
    pt.y = y * this._pixelRatio()
    return pt.matrixTransform(this._transform.inverse())
  }

  _applyTransform(t) {
    this._ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f)
    _hitMargin = (1 / this._transform.a) * 10 * this._pixelRatio()
  }

  // set the transform on the context
  _updateTransform() {
    this._applyTransform(this._transform)
    this.redraw()
    if (this.callbacks.didUpdateTransform) {
      this.callbacks.didUpdateTransform(this._transform)
    }
  }

  _clampToBounds() {
    let contentWidth = this._contentSize.width * this._transform.a * this._pixelRatio()
    let contentHeight = this._contentSize.height * this._transform.d * this._pixelRatio()
    let canvasWidth = this.canvasWidth * this._pixelRatio()
    let canvasHeight = this.canvasHeight * this._pixelRatio()
    let adjustedContentWidth = contentWidth
    let adjustedContentHeight = contentHeight
    if (contentWidth / contentHeight < canvasWidth / canvasHeight) {
      adjustedContentWidth = canvasWidth * (contentHeight / canvasHeight)
    } else {
      adjustedContentHeight = canvasHeight * (contentWidth / canvasWidth)
    }

    let xMax = (adjustedContentWidth - contentWidth) / 2.0
    let xMin = -adjustedContentWidth + canvasWidth + xMax
    this._transform.e = Flast.clamp(this._transform.e, xMin, xMax)

    let yMax = (adjustedContentHeight - contentHeight) / 2.0
    let yMin = -adjustedContentHeight + canvasHeight + yMax
    this._transform.f = Flast.clamp(this._transform.f, yMin, yMax)
  }

  static clamp(value, min, max) {
    return Math.max(Math.min(value, max), min)
  }

  _eventPoint(e) {
    let x = e.offsetX || e.pageX - this._canvas.offsetLeft
    let y = e.offsetY || e.pageY - this._canvas.offsetTop
    return this._transformedPoint(x, y)
  }

  _tileImage(zoom, x, y) {
    let url = this.getTileUrl(zoom, x, y)
    let image = this._tileCache[url]
    if (!image) {
      image = new Image()
      image.src = url
      image.onload = () => {
        this.redraw()
      }
      this._tileCache[url] = image
    }
    return image
  }

  _intersectRect(r1, r2) {
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
  }

  _currentTool() {
    return this.tools.find(tool => {
      return tool.name === this._state.tool
    })
  }

  static _distance(a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
  }

  static get LINE() {
    return {
      name: 'line',
      keyCode: 76,
      startGeometry(pt) {
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
      updateGeometry(geometry, pt) {
        geometry.p2 = {
          x: pt.x,
          y: pt.y,
        }
        return geometry
      },
      boundingRect(geometry) {
        let minX = Math.min(geometry.p1.x, geometry.p2.x)
        let maxX = Math.max(geometry.p1.x, geometry.p2.x)
        let minY = Math.min(geometry.p1.y, geometry.p2.y)
        let maxY = Math.max(geometry.p1.y, geometry.p2.y)
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      },
      drawInContext(ctx, geometry) {
        const { p1, p2 } = geometry
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      },
      hitTest(geometry, pt) {
        return Flast._onLine(geometry, pt)
      },
      scaleGeometry(geometry, factor) {
        return {
          p1: { x: geometry.p1.x * factor, y: geometry.p1.y * factor },
          p2: { x: geometry.p2.x * factor, y: geometry.p2.y * factor },
        }
      },
      dimensions(geometry) {
        const { p1, p2 } = geometry
        return [{ key: 'length', value: Flast._distance(p2, p1) }]
      },
      hint(geometry) {
        return geometry ? 'Click to draw the second point.' : 'Click to draw the first point of a new line.'
      }
    }
  }

  static get CALIBRATOR() {
    return {
      name: 'calibrator',
      keyCode: 188, // comma
      startGeometry: Flast.LINE.startGeometry,
      updateGeometry: Flast.LINE.updateGeometry,
      boundingRect: Flast.LINE.boundingRect,
      drawInContext: Flast.LINE.drawInContext,
      hitTest: Flast.LINE.hitTest,
      scaleGeometry: Flast.LINE.scaleGeometry,
      hint(geometry) {
        return geometry ? 'Click the right side of the scale bar.' : 'Click the left side of the scale bar.'
      }
    }
  }

  static get ARROW() {
    return {
      name: 'arrow',
      keyCode: 65,
      startGeometry: Flast.LINE.startGeometry,
      updateGeometry: Flast.LINE.updateGeometry,
      boundingRect: Flast.LINE.boundingRect,
      drawInContext(ctx, geometry) {
        let p1 = geometry.p1
        let p2 = geometry.p2
        let arrowHeight = _lineWidth * 6

        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        let vector = {
          dx: p2.x - p1.x,
          dy: p2.y - p1.y,
        }
        let length = Math.sqrt(Math.pow(vector.dx, 2) + Math.pow(vector.dy, 2))
        let percent = (length - arrowHeight) / length
        ctx.lineTo(p1.x + vector.dx * percent, p1.y + vector.dy * percent)
        ctx.stroke()

        let radians = Math.atan((p2.y - p1.y) / (p2.x - p1.x))
        radians += ((p1.x <= p2.x ? 90 : -90) * Math.PI) / 180

        ctx.save()
        ctx.beginPath()
        ctx.translate(p2.x, p2.y)
        ctx.rotate(radians)
        ctx.moveTo(0, 0)
        ctx.lineTo(_lineWidth * 3, arrowHeight)
        ctx.lineTo(-(_lineWidth * 3), arrowHeight)
        ctx.closePath()
        ctx.restore()
        ctx.fill()
      },
      hitTest: Flast.LINE.hitTest,
      scaleGeometry: Flast.LINE.scaleGeometry,
      hint(geometry) {
        return geometry ? 'Click to draw the point of your arrow.' : 'Click to draw the end of a new arrow.'
      }
    }
  }

  static get CIRCLE() {
    return {
      name: 'circle',
      keyCode: 67,
      startGeometry(pt) {
        return {
          center: {
            x: pt.x,
            y: pt.y,
          },
          radius: 0,
        }
      },
      updateGeometry(geometry, pt) {
        let c = geometry.center
        geometry.radius = Flast._distance(pt, c)
        return geometry
      },
      boundingRect(geometry) {
        let minX = geometry.center.x - geometry.radius
        let maxX = geometry.center.x + geometry.radius
        let minY = geometry.center.y - geometry.radius
        let maxY = geometry.center.y + geometry.radius
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      },
      drawInContext(ctx, geometry) {
        let g = geometry
        ctx.beginPath()
        ctx.arc(g.center.x, g.center.y, g.radius, 0, 2 * Math.PI)
        ctx.stroke()
      },
      hitTest(geometry, pt) {
        let distance = Flast._distance(pt, geometry.center)
        return Math.abs(distance - geometry.radius) < _hitMargin
      },
      scaleGeometry({ center, radius }, factor) {
        return {
          center: {
            x: center.x * factor,
            y: center.y * factor,
          },
          radius: radius * factor,
        }
      },
      dimensions({ radius }) {
        return [
          { key: 'area', value: Math.PI * Math.pow(radius, 2) },
          { key: 'radius', value: radius },
          { key: 'diameter', value: radius * 2 },
        ]
      },
      hint(geometry) {
        return geometry ? 'Click to specificy the radius.' : 'Click where the center of a new circle should be.'
      }
    }
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
          height: 0,
        }
      },
      updateGeometry(geometry, pt) {
        geometry.width = pt.x - geometry.x
        geometry.height = pt.y - geometry.y
        return geometry
      },
      finalGeometry(geometry) {
        return {
          x: Math.min(geometry.x, geometry.x + geometry.width),
          y: Math.min(geometry.y, geometry.y + geometry.height),
          width: Math.abs(geometry.width),
          height: Math.abs(geometry.height),
        }
      },
      boundingRect(geometry) {
        return geometry
      },
      drawInContext(ctx, geometry) {
        let g = geometry
        ctx.beginPath()
        ctx.strokeRect(g.x, g.y, g.width, g.height)
        ctx.stroke()
      },
      hitTest(geometry, pt) {
        let bounding = [
          pt.x > geometry.x - _hitMargin,
          pt.x < geometry.x + geometry.width + _hitMargin,
          pt.y > geometry.y - _hitMargin,
          pt.y < geometry.y + geometry.height + _hitMargin,
        ]

        let distances = [
          Math.abs(geometry.x - pt.x),
          Math.abs(geometry.x + geometry.width - pt.x),
          Math.abs(geometry.y - pt.y),
          Math.abs(geometry.y + geometry.height - pt.y),
        ]

        return bounding.every(b => b) && Math.min.apply(null, distances) < _hitMargin
      },
      scaleGeometry(geometry, factor) {
        return {
          x: geometry.x * factor,
          y: geometry.y * factor,
          width: geometry.width * factor,
          height: geometry.height * factor,
        }
      },
      dimensions({ width, height }) {
        return [
          { key: 'area', value: width * height },
          { key: 'width', value: width },
          { key: 'height', value: height },
        ]
      },
      hint(geometry) {
        return geometry ? 'Click to draw the second corner.' : 'Click to draw the first corner of a new rectangle.'
      }
    }
  }

  static get FREEHAND() {
    return {
      name: 'freehand',
      keyCode: 70,
      startGeometry(pt) {
        return [[pt.x, pt.y]]
      },
      updateGeometry(geometry, pt) {
        let g = geometry.concat([[pt.x, pt.y]])
        if (g.length > 10) {
          g = g.map(([x, y]) => ({ x, y }))
          return simplify(g, 3, true).map(({ x, y }) => [x, y])
        }
        else {
          return g
        }
      },
      boundingRect(geometry) {
        const xs = geometry.map(([x, _y]) => x).sort()
        const ys = geometry.map(([x_, y]) => y).sort()
        let minX = xs[0]
        let maxX = xs[xs.length - 1]
        let minY = ys[0]
        let maxY = ys[ys.length - 1]
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      },
      drawInContext(ctx, geometry) {
        let g = geometry
        ctx.save()
        ctx.lineCap = 'round'
        ctx.beginPath()
        let p1 = geometry[0]
        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        geometry.forEach(([x, y]) => {
          ctx.lineTo(x, y)
        })
        ctx.stroke()
        ctx.restore()
      },
      hitTest(geometry, pt) {
        return geometry.some(([x, y], idx) => {
          if (geometry[idx - 1]) {
            const [px, py] = geometry[idx - 1]
            const line = {
              p1: { x, y },
              p2: { x: px, y: py },
            }
            return Flast._onLine(line, pt)
          }
        })
      },
      scaleGeometry(geometry, factor) {
        return geometry.map(([x, y]) => [x * factor, y * factor])
      },
      dimensions(geometry) {
        // Repeat the coordinates of the first point at the bottom of the list.
        geometry = geometry.concat([geometry[0]])
        // Multiply the x coordinate of each vertex by the y coordinate of the next vertex.
        const a = geometry.reduce((acc, [x, _], idx) => {
          const next = geometry[idx + 1]
          if (next) {
            return acc + (x * next[1])
          } else {
            return acc
          }
        }, 0)
        // Multiply the y coordinate of each vertex by the x coordinate of the next vertex.
        const b = geometry.reduce((acc, [_, y], idx) => {
          const next = geometry[idx + 1]
          if (next) {
            return acc + (y * next[0])
          } else {
            return acc
          }
        }, 0)

        // Subtract the sum of the second products from the sum of the first products & divide by 2
        return [
          { key: 'area', value: Math.abs((b - a) / 2) }
        ]
      },
      hint(geometry) {
        return geometry ? 'Click to stop drawing.' : 'Click to start drawing.'
      }
    }
  }

  static get POLYGON() {
    return {
      name: 'polygon',
      keyCode: 80,
      startGeometry(pt) {
        return [[pt.x, pt.y]]
      },
      updateGeometry(geometry, pt) {
        if (geometry.length === 1) {
          return geometry.concat([[pt.x, pt.y]])
        } else {
          // otherwise, replace the last item with the currently drawing point
          return geometry.slice(0,-1).concat([[pt.x, pt.y]])
        }
      },
      shouldAddSegment(_geometry, _pt, event) {
        return !event.shiftKey
      },
      addSegment(geometry, pt) {
        return geometry.concat([[pt.x, pt.y]])
      },
      boundingRect: Flast.FREEHAND.boundingRect,
      drawInContext: Flast.FREEHAND.drawInContext,
      hitTest: Flast.FREEHAND.hitTest,
      scaleGeometry: Flast.FREEHAND.scaleGeometry,
      dimensions: Flast.FREEHAND.dimensions,
      hint(geometry) {
        return geometry ? 'Click to draw another point or shift + click to draw the last point.' : 'Click to draw the first point.'
      }
    }
  }

  static _onLine(line, point) {
    let distance = this._pointDistToLine(point, line)
    return distance < _hitMargin
  }

  static _pointDistToLine(point, line) {
    const { x, y } = point
    let x1 = line.p1.x
    let y1 = line.p1.y
    let x2 = line.p2.x
    let y2 = line.p2.y

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
  }

  static parseUnits(string) {
    const units = [
      { variants: ['feet', 'foot', 'ft', "'"], multiplier: 1 },
      { variants: ['inches', 'inch', 'in', '"'], multiplier: 1.0 / 12.0 },
      { variants: ['meters', 'meter', 'metre', 'm'], multiplier: 3.281 },
      { variants: ['miles', 'mile', 'mi'], multiplier: 5280 },
      { variants: ['yards', 'yard', 'y'], multiplier: 3 },
    ]

    // if its nullish, return null
    if (!string) {
      return null
    }

    // if its just a number, the its assumed to be feet
    if (string.match(/^[\d.]+$/)) {
      return { value: string * 1, units: 'feet' }
    }

    const scope = { value: 0, unit: 'feet' }

    const allVariants = units.reduce((acc, { variants }) => acc.concat(variants), []).join('|')

    string.replace(new RegExp(`(([\\d.]{1,})( |)(${allVariants}]))`, 'g'), (_a, _b, value, _space, unit) => {
      const parsedUnit = units.find(n => n.variants.includes(unit))
      scope.value += value * parsedUnit.multiplier
    })

    return { value: scope.value, units: 'feet' }
  }
}


/***********************
* Simplify
***********************/

/*
 (c) 2017, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/

// square distance between 2 points
function getSqDist(p1, p2) {
  var dx = p1.x - p2.x,
      dy = p1.y - p2.y;

  return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getSqSegDist(p, p1, p2) {

  var x = p1.x,
      y = p1.y,
      dx = p2.x - x,
      dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
        x = p2.x;
        y = p2.y;

    } else if (t > 0) {
        x += dx * t;
        y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;

  return dx * dx + dy * dy;
}
// rest of the code doesn't care about point format

// basic distance-based simplification
function simplifyRadialDist(points, sqTolerance) {

  var prevPoint = points[0],
      newPoints = [prevPoint],
      point;

  for (var i = 1, len = points.length; i < len; i++) {
    point = points[i];

    if (getSqDist(point, prevPoint) > sqTolerance) {
        newPoints.push(point);
        prevPoint = point;
    }
  }

  if (prevPoint !== point) newPoints.push(point);

  return newPoints;
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
  var maxSqDist = sqTolerance,
      index;

  for (var i = first + 1; i < last; i++) {
    var sqDist = getSqSegDist(points[i], points[first], points[last]);

    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points, sqTolerance) {
  var last = points.length - 1;

  var simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);

  return simplified;
}

// both algorithms combined for awesome performance
function simplify(points, tolerance, highestQuality) {

  if (points.length <= 2) return points;

  var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

  points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
  points = simplifyDouglasPeucker(points, sqTolerance);

  return points;
}
