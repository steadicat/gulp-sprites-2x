var through = require('through2');
var merge = require('merge-stream');
var stream = require('vinyl-source-stream');
var spritesmith = require('gulp.spritesmith');

var x2selector = '@media (-webkit-min-device-pixel-ratio: 1.5), (min--moz-device-pixel-ratio: 1.5), (min-resolution: 1.5dppx), (min-resolution: 144dpi)';

function backgroundSize(width, height) {
  var size = width+'px '+height+'px';
  return '-webkit-background-size: '+size+'; -moz-background-size: '+size+'; -o-background-size: '+size+'; background-size: '+size+';';
}

function px(name, number) {
  return (is2x(name) ? (number / 2) : number) + 'px';
}

function spriteTemplate(prefix) {
  return function(params) {
    var classes = [];
    var rules = [];
    var lastItem;
    params.items.forEach(function(item) {
      var className = '.' + prefix + '-' + remove2x(item.name);
      classes.push(className);
      var width = px(item.name, item.width);
      var height = px(item.name, item.height);
      var x = px(item.name, item.offset_x);
      var y = px(item.name, item.offset_y);
      rules.push(className + ' {\n  background-position: '+x+' '+y+'; width: '+width+'; height: '+height+';\n}\n');
      lastItem = item;
    })
    var bgSize = is2x(lastItem.name) ? (' ' + backgroundSize(lastItem.total_width / 2, lastItem.total_height / 2)) : '';
    var prelude =
      classes.join(', ') + ' {\n  background-image: url(/' + lastItem.image + ');'+bgSize+'\n}\n';
    return [prelude].concat(rules).join('');
  }
}

function getSpriteName(filePath) {
  return path.basename(path.dirname(filePath)).split('-')[0];
}

function is2x(baseName) {
  return baseName.split('@')[1] == '2x';
}

function remove2x(baseName) {
  return is2x(baseName) ? baseName.split('@')[0] : baseName;
}

function getSprite(sprites, name, x2) {
  if (sprites[name]) return sprites[name];
  sprites[name] = spritesmith({
    imgName: name + (x2 ? '@2x': '') + '.png',
    cssName: name + (x2 ? '@2x': '') + '.css',
    algorithm: 'binary-tree',
    cssTemplate: spriteTemplate(name)
  });
  return sprites[name];
}

var path = require('path');

module.exports = function(options) {
  var sprites1x = {};
  var sprites2x = {};

  return through.obj(function(file, enc, cb) {
    var spriteName = getSpriteName(file.path);
    var fileName = path.basename(file.path, path.extname(file.path));
    var sprite = getSprite(is2x(fileName) ? sprites2x : sprites1x, spriteName, is2x(fileName));
    sprite.write(file);
    cb();

  }, function() {
    var out = this;
    var merged = merge();
    var cssFiles = {};
    Object.keys(sprites1x).forEach(function(k) {
      merged.add(sprites1x[k].img);
      var cssStream = sprites1x[k].css;
      if (sprites2x[k]) {
        merged.add(sprites2x[k].img);
        cssStream = merge(cssStream, sprites2x[k].css);
      }

      var outCssStream = stream();
      //merged.add(outCssStream);

      cssStream.on('data', function(file) {
        cssFiles[k] || (cssFiles[k] = {});
        var fileName = path.basename(file.path, path.extname(file.path));
        cssFiles[k][is2x(fileName) ? '2x' : '1x'] = file;
      });
      cssStream.on('end', function() {
        var content = cssFiles[k]['1x'].contents.toString();
        if (cssFiles[k]['2x']) {
          content += x2selector + ' {\n' + cssFiles[k]['2x'].contents.toString() + '}';
        }
        cssFiles[k]['1x'].contents = new Buffer(content);
        merged.push(cssFiles[k]['1x']);
        //outCssStream.emit('end');
      });
      sprites1x[k].end();
      sprites2x[k] && sprites2x[k].end();
    });
    merged.on('data', function(data) {
      out.push(data);
    });
    merged.on('end', function() {
      out.emit('end');
    });
  });
};
