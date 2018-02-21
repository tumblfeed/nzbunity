'use strict';

/* VALUES */

// Includes

const autoprefixer = require('gulp-autoprefixer');
const clean = require('gulp-clean');
const gulp = require('gulp');
const gutil = require('gulp-util');
const path = require('path');
const ts = require('gulp-typescript');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const zip = require('gulp-zip');

// Options

var debug = gutil.noop;
var argv = require('yargs')
  .option('hostname', {
    alias: 'h',
    describe: 'Hostname',
    default: 'localhost'
  })
  .option('verbose', {
    alias: 'v',
    describe: 'Verbose output',
    default: false
  })
  .option('production', {
    alias: 'p',
    describe: 'Production; no sourcemaps or debug files',
    default: false
  })
  .help('help')
  .argv;

if (argv.verbose) {
  debug = require('gulp-debug');
}

// Config & Helpers

var isDev = !(argv.production || /^prod/i.test(process.env.NODE_ENV));

var paths = {
  tsPath: path.resolve('./src/**/*.ts'),
  sassPath: path.resolve('./src/content/css/*.scss'),
  buildPath: path.resolve('./build'),
  distPath: path.resolve('./dist')
};

var copyFiles = [
  'html', 'js', 'json', 'css', 'png', 'jpg',
  'svg', 'ttf', 'eot', 'otf', 'woff', 'woff2'
];

var watchPath = [
  path.resolve('./src/**/*')
  // paths.htmlPath,
  // paths.jsPath,
  // paths.sassPath
];

var autoprefixerOptions = {
  browsers: ['last 2 versions', '> 5%', 'Firefox ESR']
};

// Helper to output current environment string.
var envStr = () => { return gutil.colors.magenta('(') + gutil.colors.blue(isDev ? 'dev' : 'prod') + gutil.colors.magenta(')'); };

/* TASKS */

/**
 * gulp paths
 * Print the currently used paths (as resolved) and exit.
 */
gulp.task('paths', () => {
  gutil.log(gutil.colors.magenta('Currently using paths:'));
  Object.keys(paths).forEach((k) => {
    gutil.log(gutil.colors.white(k), '->', gutil.colors.green(paths[k]));
  });
});

/**
 * gulp copy
 * Copies all static files that do not require pre-processing / compilation
 */
gulp.task('clean', () => {
  return gulp.src([paths.buildPath + '/*', paths.distPath + '/*.zip'], {read: false})
    .pipe(clean());
});

/**
 * gulp clean
 * Deletes all files in the build and dist directories
 */
gulp.task('copy', () => {
  gutil.log(
    gutil.colors.magenta('Copying files ') + envStr(),
    '\n\tFrom -> ./src : ', copyFiles.join(', '),
    '\n\tTo   -> ', paths.buildPath
  );

  return gulp
    .src(copyFiles.map(
      (ext) => { return path.resolve('./src/**/*.' + ext); }
    ))
    .pipe(gulp.dest(paths.buildPath));
});

/**
 * gulp typescript
 * Compiles all TypesScript code to the build directory.
 */
gulp.task('typescript', () => {
  var tsProject = ts.createProject(path.resolve('./tsconfig.json'));

  gutil.log(
    gutil.colors.magenta('Compiling TypeScript ') + envStr(),
    '\n\tFrom -> ', paths.tsPath,
    '\n\tTo   -> ', paths.buildPath
  );

  return tsProject.src()
    .pipe(tsProject())
    .js
    .pipe(gulp.dest(paths.buildPath));
});

/**
 * gulp sass
 * Builds all project SCSS files and copies them to src.
 * - In development, output is expanded and sourcemaps are produced
 * - In production, output is compressed with no sourcemaps
 */
gulp.task('sass', () => {
  gutil.log(
    gutil.colors.magenta('Compiling SASS ') + envStr(),
    '\n\tFrom -> ', paths.sassPath,
    '\n\tTo   -> ', paths.buildPath
  );
  return gulp
    .src(paths.sassPath)
    .pipe(debug({ title: 'sass.src' }))
    .pipe(isDev ? sourcemaps.init() : gutil.noop())
    .pipe(
      sass({
        errLogToConsole: true,
        outputStyle: isDev ? 'expanded' : 'compressed',
        includePaths: [ paths.sassPath ]
      })
        .on('error', sass.logError)
    )
    .pipe(isDev ? sourcemaps.write() : gutil.noop())
    .pipe(autoprefixer(autoprefixerOptions))
    .pipe(gulp.dest(paths.buildPath + '/content/css'));
});

/**
 * gulp build
 * Runs frontend build tasks and then Maven package.
 */
gulp.task('build', ['copy', 'typescript', 'sass']);

/**
 * Zips up the build directory into the dist directory (webextensions are just zips)
 */
gulp.task('dist', ['build'], () => {
  gulp.src(paths.buildPath + '/**/*')
    .pipe(zip('nzbunity.zip'))
    .pipe(gulp.dest(paths.distPath));
});

// Watchers

gulp.task('watch', ['build'], () => {
  gulp.watch(watchPath, ['build']);
});

gulp.task('watch:copy', () => {
  gulp.watch(copyFiles.map(
    (ext) => { return path.resolve('./src/**/*.' + ext); }
  ), ['copy']);
});

gulp.task('watch:sass', () => {
  gulp.watch(paths.sassPath, ['sass']);
});

gulp.task('watch:ts', () => {
  gulp.watch(paths.tsPath, ['typescript']);
});

gulp.task('default', ['build']);
