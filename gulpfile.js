'use strict';

var gulp = require('gulp');
var es6transpiler = require('gulp-es6-transpiler');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var DEST = 'dist/';

gulp.task('default', function() {
  return gulp.src('flask.js')
    .pipe(es6transpiler())
    // This will output the non-minified version
    .pipe(gulp.dest(DEST))
    // This will minify and rename to foo.min.js
    .pipe(uglify())
    .pipe(rename({ extname: '.min.js' }))
    .pipe(gulp.dest(DEST));
});
