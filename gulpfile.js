'use strict';

/* VALUES */

// Includes

const autoprefixer = require('gulp-autoprefixer');
const gulp = require('gulp');
const gutil = require('gulp-util');
const kill = require('tree-kill');
const path = require('path');
const sass = require('gulp-sass');
const shell = require('gulp-shell');
const sourcemaps = require('gulp-sourcemaps');
const spawn = require('child_process').spawn;
const webdriver = require('gulp-webdriver');

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
var isWin = /^win/.test(process.platform);

var paths = {
  htmlPath: path.resolve('./src/main/resources/templates/**/*.html'),
  jsPath: path.resolve('./src/main/resources/static/js/**/*.js'),
  sassPath: path.resolve('./src/main/resources/static/sass/**/*.scss'),
  casSassPath: path.resolve('./target/cas/WEB-INF/classes/static/sass'),
  npmPath: path.resolve('./node_modules/bootstrap-sass/assets/stylesheets'),
  cssPath: path.resolve('./src/main/resources/static/css'),
  wdioPath: path.resolve('./wdio.conf.js'),
  warPath: path.resolve('./target/cas.war')
};

var watchPath = [
  paths.htmlPath,
  paths.jsPath,
  paths.sassPath
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
 * gulp sass
 * Builds all project SCSS files and copies them to src.
 * - In development, output is expanded and sourcemaps are produced
 * - In production, output is compressed with no sourcemaps
 */
gulp.task('sass', () => {
  gutil.log(
    gutil.colors.magenta('Compiling SASS ') + envStr(),
    '\n\tFrom -> ', paths.sassPath,
    '\n\t        ', paths.casSassPath,
    '\n\t        ', paths.npmPath,
    '\n\tTo   -> ', paths.cssPath
  );
  return gulp
    .src(paths.sassPath)
    .pipe(debug({ title: 'sass.src' }))
    .pipe(isDev ? sourcemaps.init() : gutil.noop())
    .pipe(
      sass({
        errLogToConsole: true,
        outputStyle: isDev ? 'expanded' : 'compressed',
        includePaths: [ paths.sassPath, paths.casSassPath, paths.npmPath ]
      })
      .on('error', sass.logError)
    )
    .pipe(isDev ? sourcemaps.write() : gutil.noop())
    .pipe(autoprefixer(autoprefixerOptions))
    .pipe(gulp.dest(paths.cssPath));
});

/**
 * gulp test
 * Initializes and starts webdriver tests.
 */
gulp.task('test', () => {
  return gulp
    .src(paths.wdioPath)
    .pipe(webdriver());
});

/**
 * gulp maven
 * Runs the Maven target 'clean package'.
 */
gulp.task('maven:before', gutil.noop);

gulp.task('maven:package', [], shell.task([
  isWin
    ? 'set HOSTNAME=' + argv.hostname + '&&'
    : 'HOSTNAME=' + argv.hostname,
  'mvn -P local clean package'
].join(' ')));

gulp.task('maven:after', ['maven:package'], shell.task([
  isWin
    ? 'del'
    : 'rm',
  path.resolve(__dirname, 'target/cas/WEB-INF/classes/application.properties')
].join(' ')));

gulp.task('maven', ['maven:after']); // alias

/**
 * gulp build
 * Runs frontend build tasks and then Maven package.
 */
gulp.task('build', ['sass', 'maven']);

// gulp.task('run', ['sass', 'maven:package'], shell.task('java -jar ' + paths.warPath));

/**
 * gulp run
 * Initializes the server process.
 * Note: This should be able to stop and restart the server on a watch trigger,
 *       but for some reason does not work.
 */
var runProcess;
gulp.task('run', ['build'], () => {
  if (runProcess) {
    kill(runProcess.pid);
  }

  runProcess = spawn('java', ['-jar', paths.warPath], { stdio: 'inherit' });

  runProcess.on('close', (code) => {
    if (code !== 0) {
      gutil.log(gutil.colors.red('Error detected, waiting for changes...'));
    }
  });
});

// Watchers

gulp.task('watch', () => {
  gulp.watch(watchPath, ['sass', 'maven:package']);
});

gulp.task('watch:sass', () => {
  gulp.watch(watchPath, ['sass']);
});

gulp.task('watch:run', ['run'], () => {
  gulp.watch(watchPath, ['run']);
});

gulp.task('default', ['build']);
