var gulp       = require('gulp');
var tsc        = require('gulp-typescript');
var babel      = require('gulp-babel');
var sass       = require('gulp-sass');
var cleanCSS   = require('gulp-clean-css');
var sourcemaps = require('gulp-sourcemaps');

gulp.task('css', function(){
  return gulp.src('assets/styles/main.scss')
    .pipe(sass())
    .pipe(cleanCSS())
    .pipe(gulp.dest('_compiled/css'))
});

gulp.task('js', function(){
  return gulp.src('assets/scripts/main.ts')
    .pipe(sourcemaps.init())
    .pipe(tsc({
        module  : 'system',
        target  : 'ES5',
        allowJs : true,
        outFile : 'main.js'
    }))
    .pipe(babel({
        presets: ['env']
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('_compiled/scripts'))
});

gulp.task('default', gulp.parallel('css', 'js'));