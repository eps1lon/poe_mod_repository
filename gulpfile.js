'use strict';

var gulp = require('gulp');

var ghPages = require('gulp-gh-pages');
var gulpif = require('gulp-if');
var minifyCss = require('gulp-minify-css');
var rename = require("gulp-rename");
var uglify = require('gulp-uglify');
var useref = require('gulp-useref');
var browserify = require('gulp-browserify');

var del = require('del');
var mkdirp = require('mkdirp');

var SRC = './';
var DIST = './dist/';
var BUILD = './build/';

gulp.task('default', ['deploy'], function() {
  
});

/*
 * deployment to github pages
 * first run merge all js/css files
 */
gulp.task('deploy', ['stage-deploy'], function() {
    // deploy
    return gulp.src(DIST + '**/*')
                .pipe(ghPages());
});

/*
 * prepares DIST folder
 */
gulp.task('stage-deploy', ['html'], function () {
    mkdirp.sync(DIST);
    
    // copy json files
    gulp.src(SRC + 'js/data/**')
        .pipe(gulp.dest(DIST + 'js/data'));
        
    // assets
    gulp.src(SRC + 'css/icons/**')
        .pipe(gulp.dest(DIST + 'icons'));
    gulp.src(SRC + 'image/**')
        .pipe(gulp.dest(DIST + 'image/'));
        
    // gui is index
    return gulp.src(DIST + 'gui.html')
                .pipe(rename('index.html'))
                .pipe(gulp.dest(DIST));
});

/*
 * works through all html files and bundles the required js and css files
 * uglifies and minifies
 * browserifies first
 */
gulp.task('html', ['browserify'], function() {
    // bundle
    return gulp.src(['*.html'])
        .pipe(useref())
        .pipe(gulpif('*.js', uglify({preserveComments: 'license'})))
        .pipe(gulpif('*.css', minifyCss()))
        .pipe(gulp.dest(DIST));
});

// browserify
gulp.task('browserify', function () {
    mkdirp.sync(BUILD);
    
    return gulp.src(SRC + 'js/*.js')
                .pipe(browserify())
                .pipe(gulp.dest(BUILD));
});

/*
 * clears dist/build
 */
gulp.task('clean', function () {
    return del([DIST + "**", BUILD + "**"]);
});