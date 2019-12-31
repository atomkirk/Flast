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
    let currentAnnotation = this._currentAnnotation || { shapes: [] }

    // draw all annotations
    for (let annotation of this.annotations.concat(currentAnnotation)) {
      // when drawing, fade out all other shapes except the current annotation
      if (!this._currentAnnotation || annotation === this._currentAnnotation) {
        this._ctx.globalAlpha = 1.0
      } else {
        this._ctx.globalAlpha = 0.2
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
  }

  cancelAnnotation() {
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
    this._currentAnnotation = annotation
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

  _addEventListeners() {
    this._canvas.addEventListener('mousedown', this._mouseDown.bind(this), false)
    this._canvas.addEventListener('mousemove', this._mouseMove.bind(this), false)
    this._canvas.addEventListener('mouseleave', this._mouseLeave.bind(this), false)
    this._canvas.addEventListener('mouseup', this._mouseUp.bind(this), false)
    this._canvas.addEventListener('DOMMouseScroll', this._updateZoom.bind(this), false)
    this._canvas.addEventListener('mousewheel', this._updateZoom.bind(this), false)
    window.addEventListener('keyup', this._keyUp.bind(this), false)
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
    _lineWidth = 20 * this._pixelRatio() * 2
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
    console.log('mouse down')
    this._state.mouse = 'down'
    document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none'
    this._dragStart = this._eventPoint(e)
  }

  _mouseUp(e) {
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
      let pt = this._eventPoint(e)
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
      let tool = this._currentTool()
      if (tool.finalGeometry) {
        this._currentShape.geometry = tool.finalGeometry(this._currentShape.geometry)
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
      let pt = this._eventPoint(e)
      for (let annotation of this.annotations) {
        for (let shape of annotation.shapes) {
          // find the tool that drew this shape
          let tool = this.tools.find(tool => {
            return tool.name === shape.kind
          })
          if (tool.hitTest(tool.scaleGeometry(shape.geometry, this._pixelRatio()), pt)) {
            this.selectAnnotation(annotation)
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
      if (distance > 10) {
        this._state.dragging = true
      }
    }
    if (this._state.dragging) {
      let dx = pt.x - this._dragStart.x
      let dy = pt.y - this._dragStart.y
      this._transform = this._transform.translate(dx, dy)
      this._clampToBounds()
      this._updateTransform()
    }
    if (this._state.drawing) {
      let tool = this._currentTool()
      this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, {
        x: pt.x / this._pixelRatio(),
        y: pt.y / this._pixelRatio(),
      })
      this.redraw()
    }
    if (this._state.mouse === 'up' && !this._state.drawing && this._state.enabled) {
      let pt = this._eventPoint(e)
      var found = false
      for (let annotation of this.annotations) {
        for (let shape of annotation.shapes) {
          // find the tool that drew this shape
          let tool = this.tools.find(tool => {
            return tool.name === shape.kind
          })
          if (tool.hitTest(tool.scaleGeometry(shape.geometry, this._pixelRatio()), pt)) {
            found = true
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

    // cancel drawing
    if (this._state.drawing && e.which === 27) {
      this.cancelShape()
      e.preventDefault()
      e.stopPropagation()
      return true
    } else if (e.which === 13 && this._currentAnnotation) {
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
        let p1 = geometry.p1
        let p2 = geometry.p2
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
    }
  }

  static get ARROW() {
    return {
      name: 'arrow',
      keyCode: 65,
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
      hitTest(geometry, pt) {
        return Flast._onLine(geometry, pt)
      },
      scaleGeometry(geometry, factor) {
        return {
          p1: { x: geometry.p1.x * factor, y: geometry.p1.y * factor },
          p2: { x: geometry.p2.x * factor, y: geometry.p2.y * factor },
        }
      },
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
      scaleGeometry(geometry, factor) {
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
        let distances = [
          Math.abs(geometry.x - pt.x),
          Math.abs(geometry.x + geometry.width - pt.x),
          Math.abs(geometry.y - pt.y),
          Math.abs(geometry.y + geometry.height - pt.y),
        ]
        for (let dist of distances) {
          if (dist < _hitMargin) return true
        }
      },
      scaleGeometry(geometry, factor) {
        return {
          x: geometry.x * factor,
          y: geometry.y * factor,
          width: geometry.width * factor,
          height: geometry.height * factor,
        }
      },
    }
  }

  static _onLine(line, point) {
    let distance = this._pointDistToLine(point, line)
    return distance < _hitMargin
  }

  static _pointDistToLine(point, line) {
    let x = point.x
    let y = point.y
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
}
