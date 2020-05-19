"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _createForOfIteratorHelper(o) { if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (o = _unsupportedIterableToArray(o))) { var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e2) { throw _e2; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var it, normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e3) { didErr = true; err = _e3; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var _hitMargin;

var _lineWidth;

var Flast = /*#__PURE__*/function () {
  function Flast(canvas) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, Flast);

    this._canvas = canvas;

    this._once(canvas);

    this._init(options);

    this.redraw();
  }

  _createClass(Flast, [{
    key: "reinit",
    value: function reinit(options) {
      var merged = Object.assign(this.originalOptions, options);

      this._init(merged);

      this.redraw();
    }
  }, {
    key: "destroy",
    value: function destroy() {
      window.removeEventListener('keyup', this._keyUpHandler);
    }
  }, {
    key: "_init",
    value: function _init(options) {
      this.originalOptions = options;
      this.maxZoom = options.maxZoom || 4;
      this.zoomSpeed = options.zoomSpeed || 1.01;

      this.getTileUrl = options.getTileUrl || function (zoom, x, y) {
        return "https://s3-us-west-2.amazonaws.com/useredline-api/development/tiles/168d136e60b14850d7a671e8/tile_".concat(zoom, "_").concat(x, "x").concat(y, ".jpg");
      };

      this.tools = options.tools || [Flast.ARROW, Flast.LINE, Flast.CIRCLE, Flast.RECTANGLE];
      this.annotations = options.annotations || [];
      this.callbacks = options.callbacks || {};
      this._selectedAnnotation = null;
      this._drawingAnnotation = null;
      this._currentShape = null;
      this._maxScale = options.maxScale || 2;
      this._authorColor = options.authorColor;
      this._state = {
        mouse: 'up',
        // 'down'
        tool: 'none',
        // 'arrow', 'line', 'circle', 'rectangle', 'freehand'
        dragging: false,
        drawing: false,
        enabled: true
      };
      this._contentSize = {
        width: options.width || 624 * Math.pow(2, this.maxZoom),
        height: options.height || 416 * Math.pow(2, this.maxZoom)
      };
      this.setTileSize({
        width: this._contentSize.width / Math.pow(2, this.maxZoom),
        height: this._contentSize.height / Math.pow(2, this.maxZoom)
      });
      this._transform.e = this._transform.f = 0;
      this._transform.a = this._transform.d = this._minScale;

      this._clampToBounds();

      this._applyTransform(this._transform);
    }
  }, {
    key: "_once",
    value: function _once(canvas) {
      this.canvasWidth = canvas.clientWidth;
      this.canvasHeight = canvas.clientHeight;
      var context = canvas.getContext('2d'); // context.imageSmoothingEnabled = false

      this._ctx = context;
      this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this._transform = this._svg.createSVGMatrix();

      this._addEventListeners();

      this._configureCanvas();
    }
  }, {
    key: "resize",
    value: function resize() {
      var canvas = this._canvas;
      this.canvasWidth = canvas.clientWidth;
      this.canvasHeight = canvas.clientHeight;
      this._transform.e = this._transform.f = 0;
      this._transform.a = this._transform.d = this._minScale;
      this.setTileSize(this.tileSize);

      this._configureCanvas();

      this._clampToBounds();

      this._applyTransform(this._transform);

      this.redraw();
    }
  }, {
    key: "_pixelRatio",
    value: function _pixelRatio() {
      // return 1
      return window.devicePixelRatio;
    }
  }, {
    key: "setTool",
    value: function setTool(toolName) {
      if (!toolName) {
        this._state.tool = 'none';

        if (this.callbacks.didSelectTool) {
          this.callbacks.didSelectTool(null);
        }

        return;
      }

      var tool = this.tools.find(function (tool) {
        return tool.name === toolName;
      });

      if (tool) {
        this._state.tool = toolName;

        if (this.callbacks.didSelectTool) {
          this.callbacks.didSelectTool(this._state.tool);
        }

        this.redraw();
      } else {
        console.error('Flask: That tool is not defined.');
      }
    }
  }, {
    key: "setEnabled",
    value: function setEnabled(enabled) {
      this._state.enabled = enabled;
    }
  }, {
    key: "setTileSize",
    value: function setTileSize(size) {
      this.tileSize = size;
      this._tileCache = {};
      var minScaleX = this.canvasWidth / this._contentSize.width;
      var minScaleY = this.canvasHeight / this._contentSize.height;
      this._minScale = Math.min(minScaleX, minScaleY);
    } // clear the canvas and draw the tiles

  }, {
    key: "redraw",
    value: function redraw() {
      var _this = this;

      // Clear the entire canvas
      var p1 = this._transformedPoint(0, 0);

      var p2 = this._transformedPoint(this.canvasWidth, this.canvasHeight);

      var rect = {
        x: p1.x,
        y: p1.y,
        width: p2.x - p1.x,
        height: p2.y - p1.y
      };

      this._ctx.clearRect(rect.x, rect.y, rect.width, rect.height);

      this._ctx.fillStyle = '#cccccc';

      this._ctx.fillRect(-1000000000, -1000000000, 2000000000, 2000000000);

      var mins = Math.log(this._minScale) / Math.LN2;
      var maxs = Math.log(this._maxScale) / Math.LN2;
      var s = Math.log(this._transform.a) / Math.LN2;
      var zoomPercent = (s - mins) / (maxs - mins);
      var zoomLevel = Math.max(Math.ceil(zoomPercent * this.maxZoom), 1);
      var numTiles = Math.pow(2, zoomLevel);

      var tileWidth = this._contentSize.width / numTiles * this._pixelRatio();

      var tileHeight = this._contentSize.height / numTiles * this._pixelRatio();

      for (var j = 0; j < numTiles; j++) {
        for (var k = 0; k < numTiles; k++) {
          var tile = {
            x: j * tileWidth,
            y: k * tileHeight,
            width: tileWidth,
            height: tileHeight
          };

          if (this._intersectRect(rect, tile)) {
            var image = this._tileImage(zoomLevel, j, k);

            if (image.complete && image.naturalHeight !== 0) {
              // this._ctx.imageSmoothingEnabled = false;
              // this._ctx.imageSmoothingQuality = 'low';
              this._ctx.drawImage(image, tile.x, tile.y, tile.width, tile.height);
            } // if the tile at that zoom level is not loaded, show the lower
            // res version at the lower zoom level
            else {
                var zl = zoomLevel - 1;

                while (zl > 0) {
                  var parentJ = Math.floor(j / Math.pow(2, zoomLevel) * Math.pow(2, zl));
                  var parentK = Math.floor(k / Math.pow(2, zoomLevel) * Math.pow(2, zl));

                  var _image = this._tileImage(zl, parentJ, parentK);

                  if (_image.complete && _image.naturalHeight !== 0) {
                    var childTilesPerParent = Math.pow(2, zoomLevel) / Math.pow(2, zl);
                    var jRemainder = j - childTilesPerParent * parentJ;
                    var kRemainder = k - childTilesPerParent * parentK;
                    var sWidth = _image.width / childTilesPerParent;
                    var sHeight = _image.height / childTilesPerParent;
                    var sx = Math.floor(jRemainder * sWidth);
                    var sy = Math.floor(kRemainder * sHeight); // this._ctx.imageSmoothingEnabled = false;
                    // this._ctx.imageSmoothingQuality = 'low';

                    this._ctx.drawImage(_image, sx, sy, sWidth, sHeight, tile.x, tile.y, tile.width, tile.height);

                    break;
                  }

                  zl -= 1;
                }
              }
          }
        }
      } // draw in-progress annotation/shapes


      var currentAnnotation = this._drawingAnnotation || {
        shapes: []
      }; // draw all annotations

      var _iterator = _createForOfIteratorHelper(this.annotations.concat(currentAnnotation)),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var annotation = _step.value;

          // when drawing, fade out all other shapes except the current annotation
          if (this._selectedAnnotation && !this.callbacks.compareAnnotations(annotation, this._selectedAnnotation) || this._drawingAnnotation && !this.callbacks.compareAnnotations(annotation, this._drawingAnnotation)) {
            this._ctx.globalAlpha = 0.2;
          } else {
            this._ctx.globalAlpha = 1.0;
          } // draw in-progress shapes


          var shapes = annotation.shapes;

          if (annotation === currentAnnotation) {
            shapes = shapes.concat(this._currentShape || []);
          } // draw shapes


          var _iterator2 = _createForOfIteratorHelper(shapes),
              _step2;

          try {
            var _loop = function _loop() {
              var shape = _step2.value;

              // find the right tool for the job
              var tool = _this.tools.find(function (tool) {
                return tool.name === shape.kind;
              }); // set how shape should look by default
              // (can be overriden in drawInContext)


              _this._ctx.fillStyle = annotation.color || _this._authorColor || '#FF0000';
              _this._ctx.strokeStyle = annotation.color || _this._authorColor || '#FF0000';
              _this._ctx.lineWidth = _lineWidth;
              tool.drawInContext(_this._ctx, tool.scaleGeometry(shape.geometry, _this._pixelRatio())); // tests bounding box
              // this._ctx.lineWidth = 1;
              // let g = tool.boundingRect(shape.geometry);
              // this._ctx.beginPath();
              // this._ctx.strokeRect(g.x, g.y, g.width, g.height);
              // this._ctx.stroke();
            };

            for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
              _loop();
            } // tests annotation bounding box
            // this._ctx.lineWidth = 1;
            // let g = this.boundingRectFor(annotation);
            // this._ctx.beginPath();
            // this._ctx.strokeRect(g.x, g.y, g.width, g.height);
            // this._ctx.stroke();

          } catch (err) {
            _iterator2.e(err);
          } finally {
            _iterator2.f();
          }
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      this._ctx.globalAlpha = 1.0;
    }
  }, {
    key: "setAnnotations",
    value: function setAnnotations(annotations) {
      this.annotations = annotations;
      this.redraw();
    }
  }, {
    key: "completeAnnotation",
    value: function completeAnnotation() {
      var _this2 = this;

      var cb = function cb() {
        _this2._drawingAnnotation = null;
        _this2._state.tool = 'none';

        if (_this2.callbacks.didSelectTool) {
          _this2.callbacks.didSelectTool(null);
        }

        _this2.redraw();
      };

      if (this._drawingAnnotation && this.callbacks.didFinishAnnotation) {
        this.callbacks.didFinishAnnotation(this._drawingAnnotation, cb);
      } else {
        cb();
      }
    }
  }, {
    key: "cancelAnnotation",
    value: function cancelAnnotation() {
      if (this._drawingAnnotation) {
        if (this.callbacks.didCancelAnnotation) {
          this.callbacks.didCancelAnnotation(this._drawingAnnotation);
        }
      }

      this._drawingAnnotation = null;

      if (this.callbacks.didSelectTool && this._state.tool !== 'none') {
        this.callbacks.didSelectTool(null);
      }

      this._state.tool = 'none';
      this.redraw();
    }
  }, {
    key: "cancelShape",
    value: function cancelShape() {
      if (this._currentShape) {
        if (this.callbacks.didCancelDrawingShape) {
          this.callbacks.didCancelDrawingShape(this._currentShape);
        }
      }

      this._state.drawing = false;
      this._currentShape = null;
      this.redraw();
    }
  }, {
    key: "selectAnnotation",
    value: function selectAnnotation(annotation) {
      this._selectedAnnotation = annotation;

      if (this.callbacks.didSelectAnnotation) {
        this.callbacks.didSelectAnnotation(annotation);
      }

      this.redraw();
    }
  }, {
    key: "boundingRectFor",
    value: function boundingRectFor(annotation) {
      var _this3 = this;

      var minX = Infinity;
      var maxX = 0;
      var minY = Infinity;
      var maxY = 0;

      var _iterator3 = _createForOfIteratorHelper(annotation.shapes),
          _step3;

      try {
        var _loop2 = function _loop2() {
          var shape = _step3.value;

          var tool = _this3.tools.find(function (tool) {
            return tool.name === shape.kind;
          });

          var box = tool.boundingRect(tool.scaleGeometry(shape.geometry, _this3._pixelRatio()));
          minX = Math.min(minX, box.x);
          maxX = Math.max(maxX, box.x + box.width);
          minY = Math.min(minY, box.y);
          maxY = Math.max(maxY, box.y + box.height);
        };

        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
          _loop2();
        }
      } catch (err) {
        _iterator3.e(err);
      } finally {
        _iterator3.f();
      }

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }
  }, {
    key: "zoomToRect",
    value: function zoomToRect(rect) {
      var width = this.canvasWidth * this._pixelRatio();

      var height = this.canvasHeight * this._pixelRatio();

      var scaleX = width / rect.width;
      var scaleY = height / rect.height;
      var scale = Math.min(scaleX, scaleY);
      scale = Flast.clamp(scale, this._minScale, this._maxScale);
      this._transform.a = this._transform.d = scale;
      this._transform.e = -rect.x * scale;
      this._transform.f = -rect.y * scale; // this._transform.e += width / 2.0 - (rect.width * scale) / 2.0
      // this._transform.f += height / 2.0 - (rect.height * scale) / 2.0

      this._clampToBounds();

      this._updateTransform();
    }
  }, {
    key: "setTransform",
    value: function setTransform(transform) {
      this._transform = transform;

      this._clampToBounds();

      this._updateTransform();
    }
  }, {
    key: "getDimensions",
    value: function getDimensions(_ref) {
      var _this4 = this;

      var kind = _ref.kind,
          geometry = _ref.geometry;

      if (!this._state.calibration) {
        return 'needs calibration';
      }

      var tool = this.tools.find(function (tool) {
        return tool.name === kind;
      });
      return tool.dimensions(geometry).map(function (_ref2) {
        var key = _ref2.key,
            value = _ref2.value;
        return {
          key: key,
          value: value * _this4._state.calibration
        };
      });
    }
  }, {
    key: "_addEventListeners",
    value: function _addEventListeners() {
      this._canvas.addEventListener('mousedown', this._mouseDown.bind(this), false);

      this._canvas.addEventListener('mousemove', this._mouseMove.bind(this), false);

      this._canvas.addEventListener('mouseleave', this._mouseLeave.bind(this), false);

      this._canvas.addEventListener('mouseup', this._mouseUp.bind(this), false);

      this._canvas.addEventListener('DOMMouseScroll', this._updateZoom.bind(this), false);

      this._canvas.addEventListener('mousewheel', this._updateZoom.bind(this), false);

      this._keyUpHandler = this._keyUp.bind(this);
      window.addEventListener('keyup', this._keyUpHandler, false);
    }
  }, {
    key: "_configureCanvas",
    value: function _configureCanvas() {
      var scale = this._pixelRatio();

      this._canvas.style.width = this.canvasWidth + 'px';
      this._canvas.style.height = this.canvasHeight + 'px'; // this._canvas.width = this.canvasWidth * scale;
      // this._canvas.height = this.canvasHeight * scale;

      this._canvas.setAttribute('width', this.canvasWidth * scale);

      this._canvas.setAttribute('height', this.canvasHeight * scale);

      this._ctx.scale(scale, scale);

      _hitMargin = 60 * this._pixelRatio() * 2;
      _lineWidth = 20 * this._pixelRatio() * 2;
    }
  }, {
    key: "_updateZoom",
    value: function _updateZoom(e) {
      var delta = e.wheelDelta ? e.wheelDelta / 40 : e.detail ? -e.detail : 0;

      if (delta) {
        var pt = this._eventPoint(e); // update any shape that is currently being drawn


        if (this._currentShape) {
          var tool = this._currentTool();

          this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, {
            x: pt.x / this._pixelRatio(),
            y: pt.y / this._pixelRatio()
          });
        }

        var factor = Math.pow(this.zoomSpeed, delta);
        var scale = Flast.clamp(this._transform.a * factor, this._minScale, this._maxScale); // move point of mouse to center

        this._transform = this._transform.translate(pt.x, pt.y); // scale

        this._transform.a = this._transform.d = scale; // move back

        this._transform = this._transform.translate(-pt.x, -pt.y);

        this._clampToBounds();

        this._updateTransform();
      }

      return e.preventDefault() && false;
    }
  }, {
    key: "_mouseDown",
    value: function _mouseDown(e) {
      this._state.mouse = 'down';
      document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
      this._dragStart = this._eventPoint(e);
    }
  }, {
    key: "_mouseUp",
    value: function _mouseUp(e) {
      var _this5 = this;

      this._state.mouse = 'up'; // stop dragging

      if (this._state.dragging) {
        this._state.dragging = false;

        if (this.callbacks.didEndDragging) {
          this.callbacks.didEndDragging();
        }
      } // start drawing
      else if (!this._state.drawing && this._state.tool !== 'none' && this._state.enabled) {
          this._state.drawing = true;

          var pt = this._eventPoint(e);

          var tool = this._currentTool(); // set current shape


          var scaled = {
            x: pt.x / this._pixelRatio(),
            y: pt.y / this._pixelRatio()
          };
          this._currentShape = {
            kind: tool.name,
            geometry: tool.startGeometry(scaled)
          }; // callback

          if (this.callbacks.didBeginDrawingShape) {
            this.callbacks.didBeginDrawingShape(this._currentShape);
          }
        } // stop drawing
        else if (this._state.drawing) {
            this._state.drawing = false; // if there is not a current annotation

            if (!this._drawingAnnotation) {
              // start new annotation
              this._drawingAnnotation = {
                shapes: []
              }; // callback

              if (this.callbacks.didStartAnnotation) {
                this.callbacks.didStartAnnotation(this._drawingAnnotation);
              }
            } // finalize drawing if tool provides it


            var _tool = this._currentTool();

            if (_tool.finalGeometry) {
              this._currentShape.geometry = _tool.finalGeometry(this._currentShape.geometry);
            } // add shape to current annotation


            this._drawingAnnotation.shapes.push(this._currentShape); // callback


            if (this.callbacks.didFinishDrawingShape) {
              this.callbacks.didFinishDrawingShape(this._currentShape);
            } // if we're calibrating, we don't want to keep drawing


            if (this._state.tool === 'calibrator') {
              var answer = Flast.parseUnits(this.callbacks.promptForCalibration());

              if (answer) {
                var feet = answer.value;
                var _this$_currentShape$g = this._currentShape.geometry,
                    p1 = _this$_currentShape$g.p1,
                    p2 = _this$_currentShape$g.p2;

                var pixels = Flast._distance(p2, p1);

                console.log(feet, ' -> ', pixels);
                this._state.calibration = feet / pixels;
              }

              this.cancelAnnotation();
            }

            this._currentShape = null;
            this.redraw();
          } // if nothing already selected
          else if (this._state.enabled) {
              // if mouse up over a shape
              var _pt = this._eventPoint(e);

              var _iterator4 = _createForOfIteratorHelper(this.annotations),
                  _step4;

              try {
                for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
                  var annotation = _step4.value;

                  var _iterator5 = _createForOfIteratorHelper(annotation.shapes),
                      _step5;

                  try {
                    var _loop3 = function _loop3() {
                      var shape = _step5.value;

                      // find the tool that drew this shape
                      var tool = _this5.tools.find(function (tool) {
                        return tool.name === shape.kind;
                      });

                      if (tool.hitTest(tool.scaleGeometry(shape.geometry, _this5._pixelRatio()), _pt)) {
                        if (_this5.callbacks.didSelectAnnotation) {
                          _this5.callbacks.didSelectAnnotation(annotation);
                        }

                        return {
                          v: void 0
                        };
                      }
                    };

                    for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
                      var _ret = _loop3();

                      if (_typeof(_ret) === "object") return _ret.v;
                    }
                  } catch (err) {
                    _iterator5.e(err);
                  } finally {
                    _iterator5.f();
                  }
                }
              } catch (err) {
                _iterator4.e(err);
              } finally {
                _iterator4.f();
              }
            }
    }
  }, {
    key: "_mouseMove",
    value: function _mouseMove(e) {
      var _this6 = this;

      var pt = this._eventPoint(e);

      if (this._state.mouse === 'down' && !this._state.dragging) {
        var distance = Flast._distance(pt, this._dragStart); // have to move a threshold distance to be counted as dragging


        if (distance > 10 / this._transform.a) {
          this._state.dragging = true;

          if (this.callbacks.didBeginDragging) {
            this.callbacks.didBeginDragging();
          }
        }

        return;
      }

      if (this._state.dragging) {
        var dx = pt.x - this._dragStart.x;
        var dy = pt.y - this._dragStart.y;
        this._transform = this._transform.translate(dx, dy);

        this._clampToBounds();

        this._updateTransform();

        return;
      }

      if (this._state.drawing) {
        var tool = this._currentTool();

        this._currentShape.geometry = tool.updateGeometry(this._currentShape.geometry, {
          x: pt.x / this._pixelRatio(),
          y: pt.y / this._pixelRatio()
        });
        this.redraw();
      }

      if (this._state.mouse === 'up' && !this._state.drawing && this._state.enabled) {
        var _pt2 = this._eventPoint(e);

        var found = {};

        var _iterator6 = _createForOfIteratorHelper(this.annotations),
            _step6;

        try {
          for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
            var annotation = _step6.value;

            var _iterator7 = _createForOfIteratorHelper(annotation.shapes),
                _step7;

            try {
              var _loop4 = function _loop4() {
                var shape = _step7.value;

                // find the tool that drew this shape
                var tool = _this6.tools.find(function (tool) {
                  return tool.name === shape.kind;
                });

                if (tool.hitTest(tool.scaleGeometry(shape.geometry, _this6._pixelRatio()), _pt2)) {
                  found = {
                    annotation: annotation,
                    shape: shape,
                    event: e
                  };
                }
              };

              for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
                _loop4();
              }
            } catch (err) {
              _iterator7.e(err);
            } finally {
              _iterator7.f();
            }
          }
        } catch (err) {
          _iterator6.e(err);
        } finally {
          _iterator6.f();
        }

        if (this.callbacks.mouseOverAnnotation) {
          this.callbacks.mouseOverAnnotation(found);
        }
      }
    }
  }, {
    key: "_mouseLeave",
    value: function _mouseLeave(e) {
      if (this._state.dragging) {
        this._state.dragging = false;
        this._state.mouse = 'up';
      }
    }
  }, {
    key: "_keyUp",
    value: function _keyUp(e) {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return true;
      }

      if (!this._state.enabled) {
        return false;
      } // cancel drawing


      if (this._state.drawing && e.which === 27) {
        this.cancelShape();
        e.preventDefault();
        e.stopPropagation();
        return true;
      } else if (e.which === 13 && this._drawingAnnotation) {
        this.completeAnnotation();
      } else if (this._state.enabled) {
        var _iterator8 = _createForOfIteratorHelper(this.tools),
            _step8;

        try {
          for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
            var tool = _step8.value;

            if (e.which === tool.keyCode) {
              this._state.tool = tool.name;

              if (this.callbacks.didSelectTool) {
                this.callbacks.didSelectTool(this._state.tool);
              }

              e.preventDefault();
              e.stopPropagation();
              return true;
            }
          }
        } catch (err) {
          _iterator8.e(err);
        } finally {
          _iterator8.f();
        }
      }

      return true;
    } // transform the point from page space to canvas space

  }, {
    key: "_transformedPoint",
    value: function _transformedPoint(x, y) {
      var pt = this._svg.createSVGPoint();

      pt.x = x * this._pixelRatio();
      pt.y = y * this._pixelRatio();
      return pt.matrixTransform(this._transform.inverse());
    }
  }, {
    key: "_applyTransform",
    value: function _applyTransform(t) {
      this._ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
    } // set the transform on the context

  }, {
    key: "_updateTransform",
    value: function _updateTransform() {
      this._applyTransform(this._transform);

      this.redraw();

      if (this.callbacks.didUpdateTransform) {
        this.callbacks.didUpdateTransform(this._transform);
      }
    }
  }, {
    key: "_clampToBounds",
    value: function _clampToBounds() {
      var contentWidth = this._contentSize.width * this._transform.a * this._pixelRatio();

      var contentHeight = this._contentSize.height * this._transform.d * this._pixelRatio();

      var canvasWidth = this.canvasWidth * this._pixelRatio();

      var canvasHeight = this.canvasHeight * this._pixelRatio();

      var adjustedContentWidth = contentWidth;
      var adjustedContentHeight = contentHeight;

      if (contentWidth / contentHeight < canvasWidth / canvasHeight) {
        adjustedContentWidth = canvasWidth * (contentHeight / canvasHeight);
      } else {
        adjustedContentHeight = canvasHeight * (contentWidth / canvasWidth);
      }

      var xMax = (adjustedContentWidth - contentWidth) / 2.0;
      var xMin = -adjustedContentWidth + canvasWidth + xMax;
      this._transform.e = Flast.clamp(this._transform.e, xMin, xMax);
      var yMax = (adjustedContentHeight - contentHeight) / 2.0;
      var yMin = -adjustedContentHeight + canvasHeight + yMax;
      this._transform.f = Flast.clamp(this._transform.f, yMin, yMax);
    }
  }, {
    key: "_eventPoint",
    value: function _eventPoint(e) {
      var x = e.offsetX || e.pageX - this._canvas.offsetLeft;
      var y = e.offsetY || e.pageY - this._canvas.offsetTop;
      return this._transformedPoint(x, y);
    }
  }, {
    key: "_tileImage",
    value: function _tileImage(zoom, x, y) {
      var _this7 = this;

      var url = this.getTileUrl(zoom, x, y);
      var image = this._tileCache[url];

      if (!image) {
        image = new Image();
        image.src = url;

        image.onload = function () {
          _this7.redraw();
        };

        this._tileCache[url] = image;
      }

      return image;
    }
  }, {
    key: "_intersectRect",
    value: function _intersectRect(r1, r2) {
      r1 = {
        left: r1.x,
        right: r1.x + r1.width,
        top: r1.y,
        bottom: r1.y + r1.height
      };
      r2 = {
        left: r2.x,
        right: r2.x + r2.width,
        top: r2.y,
        bottom: r2.y + r2.height
      };
      return !(r2.left > r1.right || r2.right < r1.left || r2.top > r1.bottom || r2.bottom < r1.top);
    }
  }, {
    key: "_currentTool",
    value: function _currentTool() {
      var _this8 = this;

      return this.tools.find(function (tool) {
        return tool.name === _this8._state.tool;
      });
    }
  }], [{
    key: "clamp",
    value: function clamp(value, min, max) {
      return Math.max(Math.min(value, max), min);
    }
  }, {
    key: "_distance",
    value: function _distance(a, b) {
      return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
    }
  }, {
    key: "_onLine",
    value: function _onLine(line, point) {
      var distance = this._pointDistToLine(point, line);

      return distance < _hitMargin;
    }
  }, {
    key: "_pointDistToLine",
    value: function _pointDistToLine(point, line) {
      var x = point.x,
          y = point.y;
      var x1 = line.p1.x;
      var y1 = line.p1.y;
      var x2 = line.p2.x;
      var y2 = line.p2.y;
      var A = x - x1;
      var B = y - y1;
      var C = x2 - x1;
      var D = y2 - y1;
      var dot = A * C + B * D;
      var len_sq = C * C + D * D;
      var param = -1;
      if (len_sq != 0) //in case of 0 length line
        param = dot / len_sq;
      var xx, yy;

      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      var dx = x - xx;
      var dy = y - yy;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }, {
    key: "parseUnits",
    value: function parseUnits(string) {
      var units = [{
        variants: ['feet', 'foot', 'ft', "'"],
        multiplier: 1
      }, {
        variants: ['inches', 'inch', 'in', '"'],
        multiplier: 1.0 / 12.0
      }, {
        variants: ['meters', 'meter', 'metre', 'm'],
        multiplier: 3.281
      }, {
        variants: ['miles', 'mile', 'mi'],
        multiplier: 5280
      }, {
        variants: ['yards', 'yard', 'y'],
        multiplier: 3
      }]; // if its nullish, return null

      if (!string) {
        return null;
      } // if its just a number, the its assumed to be feet


      if (string.match(/^[\d.]+$/)) {
        return {
          value: string * 1,
          units: 'feet'
        };
      }

      var scope = {
        value: 0,
        unit: 'feet'
      };
      var allVariants = units.reduce(function (acc, _ref3) {
        var variants = _ref3.variants;
        return acc.concat(variants);
      }, []).join('|');
      string.replace(new RegExp("(([\\d.]{1,})( |)(".concat(allVariants, "]))"), 'g'), function (_a, _b, value, _space, unit) {
        var parsedUnit = units.find(function (n) {
          return n.variants.includes(unit);
        });
        scope.value += value * parsedUnit.multiplier;
      });
      return {
        value: scope.value,
        units: 'feet'
      };
    }
  }, {
    key: "LINE",
    get: function get() {
      return {
        name: 'line',
        keyCode: 76,
        startGeometry: function startGeometry(pt) {
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
        updateGeometry: function updateGeometry(geometry, pt) {
          geometry.p2 = {
            x: pt.x,
            y: pt.y
          };
          return geometry;
        },
        boundingRect: function boundingRect(geometry) {
          var minX = Math.min(geometry.p1.x, geometry.p2.x);
          var maxX = Math.max(geometry.p1.x, geometry.p2.x);
          var minY = Math.min(geometry.p1.y, geometry.p2.y);
          var maxY = Math.max(geometry.p1.y, geometry.p2.y);
          return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };
        },
        drawInContext: function drawInContext(ctx, geometry) {
          var p1 = geometry.p1,
              p2 = geometry.p2;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        },
        hitTest: function hitTest(geometry, pt) {
          return Flast._onLine(geometry, pt);
        },
        scaleGeometry: function scaleGeometry(geometry, factor) {
          return {
            p1: {
              x: geometry.p1.x * factor,
              y: geometry.p1.y * factor
            },
            p2: {
              x: geometry.p2.x * factor,
              y: geometry.p2.y * factor
            }
          };
        },
        dimensions: function dimensions(geometry) {
          var p1 = geometry.p1,
              p2 = geometry.p2;
          return [{
            key: 'length',
            value: Flast._distance(p2, p1)
          }];
        }
      };
    }
  }, {
    key: "CALIBRATOR",
    get: function get() {
      return {
        name: 'calibrator',
        keyCode: 188,
        // comma
        startGeometry: Flast.LINE.startGeometry,
        updateGeometry: Flast.LINE.updateGeometry,
        boundingRect: Flast.LINE.boundingRect,
        drawInContext: Flast.LINE.drawInContext,
        hitTest: Flast.LINE.hitTest,
        scaleGeometry: Flast.LINE.scaleGeometry
      };
    }
  }, {
    key: "ARROW",
    get: function get() {
      return {
        name: 'arrow',
        keyCode: 65,
        startGeometry: Flast.LINE.startGeometry,
        updateGeometry: Flast.LINE.updateGeometry,
        boundingRect: Flast.LINE.boundingRect,
        drawInContext: function drawInContext(ctx, geometry) {
          var p1 = geometry.p1;
          var p2 = geometry.p2;
          var arrowHeight = _lineWidth * 6;
          ctx.beginPath();
          ctx.moveTo(p2.x, p2.y);
          var vector = {
            dx: p1.x - p2.x,
            dy: p1.y - p2.y
          };
          var length = Math.sqrt(Math.pow(vector.dx, 2) + Math.pow(vector.dy, 2));
          var percent = (length - arrowHeight) / length;
          ctx.lineTo(p2.x + vector.dx * percent, p2.y + vector.dy * percent);
          ctx.stroke();
          var radians = Math.atan((p1.y - p2.y) / (p1.x - p2.x));
          radians += (p2.x <= p1.x ? 90 : -90) * Math.PI / 180;
          ctx.save();
          ctx.beginPath();
          ctx.translate(p1.x, p1.y);
          ctx.rotate(radians);
          ctx.moveTo(0, 0);
          ctx.lineTo(_lineWidth * 3, arrowHeight);
          ctx.lineTo(-(_lineWidth * 3), arrowHeight);
          ctx.closePath();
          ctx.restore();
          ctx.fill();
        },
        hitTest: Flast.LINE.hitTest,
        scaleGeometry: Flast.LINE.scaleGeometry,
        dimensions: Flast.LINE.dimensions
      };
    }
  }, {
    key: "CIRCLE",
    get: function get() {
      return {
        name: 'circle',
        keyCode: 67,
        startGeometry: function startGeometry(pt) {
          return {
            center: {
              x: pt.x,
              y: pt.y
            },
            radius: 0
          };
        },
        updateGeometry: function updateGeometry(geometry, pt) {
          var c = geometry.center;
          geometry.radius = Flast._distance(pt, c);
          return geometry;
        },
        boundingRect: function boundingRect(geometry) {
          var minX = geometry.center.x - geometry.radius;
          var maxX = geometry.center.x + geometry.radius;
          var minY = geometry.center.y - geometry.radius;
          var maxY = geometry.center.y + geometry.radius;
          return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };
        },
        drawInContext: function drawInContext(ctx, geometry) {
          var g = geometry;
          ctx.beginPath();
          ctx.arc(g.center.x, g.center.y, g.radius, 0, 2 * Math.PI);
          ctx.stroke();
        },
        hitTest: function hitTest(geometry, pt) {
          var distance = Flast._distance(pt, geometry.center);

          return Math.abs(distance - geometry.radius) < _hitMargin;
        },
        scaleGeometry: function scaleGeometry(_ref4, factor) {
          var center = _ref4.center,
              radius = _ref4.radius;
          return {
            center: {
              x: center.x * factor,
              y: center.y * factor
            },
            radius: radius * factor
          };
        },
        dimensions: function dimensions(_ref5) {
          var radius = _ref5.radius;
          return [{
            key: 'area',
            value: Math.PI * Math.pow(radius, 2)
          }];
        }
      };
    }
  }, {
    key: "RECTANGLE",
    get: function get() {
      return {
        name: 'rectangle',
        keyCode: 82,
        startGeometry: function startGeometry(pt) {
          return {
            x: pt.x,
            y: pt.y,
            width: 0,
            height: 0
          };
        },
        updateGeometry: function updateGeometry(geometry, pt) {
          geometry.width = pt.x - geometry.x;
          geometry.height = pt.y - geometry.y;
          return geometry;
        },
        finalGeometry: function finalGeometry(geometry) {
          return {
            x: Math.min(geometry.x, geometry.x + geometry.width),
            y: Math.min(geometry.y, geometry.y + geometry.height),
            width: Math.abs(geometry.width),
            height: Math.abs(geometry.height)
          };
        },
        boundingRect: function boundingRect(geometry) {
          return geometry;
        },
        drawInContext: function drawInContext(ctx, geometry) {
          var g = geometry;
          ctx.beginPath();
          ctx.strokeRect(g.x, g.y, g.width, g.height);
          ctx.stroke();
        },
        hitTest: function hitTest(geometry, pt) {
          var bounding = [pt.x > geometry.x - _hitMargin, pt.x < geometry.x + geometry.width + _hitMargin, pt.y > geometry.y - _hitMargin, pt.y < geometry.y + geometry.height + _hitMargin];
          var distances = [Math.abs(geometry.x - pt.x), Math.abs(geometry.x + geometry.width - pt.x), Math.abs(geometry.y - pt.y), Math.abs(geometry.y + geometry.height - pt.y)];
          return bounding.every(function (b) {
            return b;
          }) && Math.min.apply(null, distances) < _hitMargin;
        },
        scaleGeometry: function scaleGeometry(geometry, factor) {
          return {
            x: geometry.x * factor,
            y: geometry.y * factor,
            width: geometry.width * factor,
            height: geometry.height * factor
          };
        },
        dimensions: function dimensions(_ref6) {
          var width = _ref6.width,
              height = _ref6.height;
          return [{
            key: 'area',
            value: width * height
          }];
        }
      };
    }
  }, {
    key: "FREEHAND",
    get: function get() {
      return {
        name: 'freehand',
        keyCode: 102,
        startGeometry: function startGeometry(pt) {
          return [[pt.x, pt.y]];
        },
        updateGeometry: function updateGeometry(geometry, pt) {
          return geometry.concat([[pt.x, pt.y]]);
        },
        boundingRect: function boundingRect(geometry) {
          var xs = geometry.map(function (_ref7) {
            var _ref8 = _slicedToArray(_ref7, 2),
                x = _ref8[0],
                _y = _ref8[1];

            return x;
          }).sort();
          var ys = geometry.map(function (_ref9) {
            var _ref10 = _slicedToArray(_ref9, 2),
                x_ = _ref10[0],
                y = _ref10[1];

            return y;
          }).sort();
          var minX = xs[0];
          var maxX = xs[xs.length - 1];
          var minY = ys[0];
          var maxY = ys[ys.length - 1];
          return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };
        },
        drawInContext: function drawInContext(ctx, geometry) {
          var g = geometry;
          ctx.beginPath();
          ctx.strokeRect(g.x, g.y, g.width, g.height);
          ctx.stroke();
          var p1 = geometry[0];
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          geometry.forEach(function (_ref11) {
            var _ref12 = _slicedToArray(_ref11, 2),
                x = _ref12[0],
                y = _ref12[1];

            ctx.lineTo(x, y);
          });
          ctx.stroke();
        },
        hitTest: function hitTest(geometry, pt) {
          return geometry.some(function (_ref13, idx) {
            var _ref14 = _slicedToArray(_ref13, 2),
                x = _ref14[0],
                y = _ref14[1];

            var _geometry = _slicedToArray(geometry[idx - 1], 2),
                px = _geometry[0],
                py = _geometry[1];

            if (px) {
              var line = {
                p1: {
                  x: x,
                  y: y
                },
                p2: {
                  x: px,
                  y: py
                }
              };
              return Flast._onLine(line, pt);
            }
          });
        },
        scaleGeometry: function scaleGeometry(geometry, factor) {
          return geometry.map(function (_ref15) {
            var _ref16 = _slicedToArray(_ref15, 2),
                x = _ref16[0],
                y = _ref16[1];

            return [x * factor, y * factor];
          });
        }
      };
    }
  }]);

  return Flast;
}();