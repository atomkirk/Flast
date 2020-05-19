'use strict'

const { src, dest, series } = require('gulp')
var uglify = require('gulp-uglify')
var rename = require('gulp-rename')
let babel = require('gulp-babel')

var DEST = 'dist/'

const buildJs = () => {
  return (
    src('flast.js')
      .pipe(
        babel({
          presets: ['@babel/preset-env'],
        })
      )
      // This will output the non-minified version
      .pipe(dest(DEST))
      // This will minify and rename to foo.min.js
      .pipe(uglify())
      .pipe(rename({ extname: '.min.js' }))
      .pipe(dest(DEST))
  )
}

exports.default = buildJs
