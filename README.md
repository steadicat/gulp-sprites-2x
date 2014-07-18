# gulp-sprites-2x

An easy-to-use wrapper around `gulp.spritesmith` which generates optimized CSS, supports mixing 1x and 2x images in the same folder and piping multiple folders of sprites at once.

Pass Gulp Sprites 2X a bunch of folders filled with mixed `.png` and `@2x.png` files (what most graphics programs export), and it will generate two sprites for each folder (1x and 2x), with the corresponding CSS file.

~~~javascript
gulp.src('images/*-sprite/*.png')
  .pipe(sprites)
  .pipe(gulp.dest('build');
~~~

Generates:

~~~shell
build/
  home-sprite.png
  home-sprite@2x.png
  home-sprite.css
  about-sprite.png
  about-sprite@2x.png
  about-sprite.css
~~~

You can pipe the output to `gulp-if` and, e.g., upload the pngs to S3 and concatenate the CSS with the rest of your CSS.

~~~javascript
var sprites = gulp.src('images/*-sprite/*.png')
  .pipe('sprites');
var spriteImages = sprites
  .pipe($.filter('**/*.png'))
  .pipe(gulp.dest(BUILD_DIR));
var spriteCss = sprites
  .pipe($.filter('**/*.css'));
var allCss = merge(css, spriteCss)
  .pipe(gulp-join())
  .pipe(gulp.dest(BUILD_DIR));
~~~
