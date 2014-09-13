var through = require('through2');
var merge = require('merge-stream');
var spritesmith = require('gulp.spritesmith');
var path = require('path');

var selectors = {
  '2x': '@media (-webkit-min-device-pixel-ratio: 1.5), (min--moz-device-pixel-ratio: 1.5), (min-resolution: 1.5dppx), (min-resolution: 144dpi)',
  '3x': '@media (-webkit-min-device-pixel-ratio: 3), (min--moz-device-pixel-ratio: 3), (min-resolution: 3dppx), (min-resolution: 288dpi)'
};

var ratio = {
  '1x': 1,
  '2x': 2,
  '3x': 3
};

function hasSuffix(baseName) {
  return baseName.split('@').length > 1;
}

function getSuffix(baseName) {
  return hasSuffix(baseName) ? baseName.split('@')[1] : '1x';
}

function removeSuffix(baseName) {
  return hasSuffix(baseName) ? baseName.split('@')[0] : baseName;
}

function getRatio(baseName) {
  return ratio[getSuffix(baseName)];
}

function px(name, number) {
  return Math.floor(number / getRatio(name)) + 'px';
}

function backgroundSize(width, height) {
  var size = width+'px '+height+'px';
  return '-webkit-background-size: '+size+'; -moz-background-size: '+size+'; -o-background-size: '+size+'; background-size: '+size+';';
}

function spriteTemplate(prefix) {
  return function(params) {
    var classes = [];
    var rules = [];
    var lastItem;
    params.items.forEach(function(item) {
      var className = '.' + prefix + '-' + removeSuffix(item.name);
      classes.push(className);
      var width = px(item.name, item.width);
      var height = px(item.name, item.height);
      var x = px(item.name, item.offset_x);
      var y = px(item.name, item.offset_y);
      rules.push(className + ' {\n  background-position: '+x+' '+y+'; width: '+width+'; height: '+height+';\n}\n');
      lastItem = item;
    });
    var ratio = getRatio(lastItem.name);
    var bgSize = ratio > 1 ? (' ' + backgroundSize(lastItem.total_width / ratio, lastItem.total_height / ratio)) : '';
    var prelude =
      classes.join(', ') + ' {\n  background-image: url(/' + lastItem.image + ');'+bgSize+'\n}\n';
    return [prelude].concat(rules).join('');
  };
}

function getSpriteName(filePath) {
  return path.basename(path.dirname(filePath)).split('-')[0];
}

function getSprite(sprites, name, suffix) {
  if (sprites[name]) return sprites[name];
  sprites[name] = spritesmith({
    imgName: name + (suffix != '1x' ? ('@' + suffix) : '') + '.png',
    cssName: name + (suffix != '1x' ? ('@' + suffix) : '') + '.css',
    algorithm: 'binary-tree',
    padding: ratio[suffix],
    cssTemplate: spriteTemplate(name)
  });
  return sprites[name];
}

module.exports = function() {
  var sprites = {
    '1x': {},
    '2x': {},
    '3x': {}
  };

  var waiting = 0;
  function pipe(stream, out) {
    waiting++;
    stream.on('data', out.push.bind(out));
    stream.on('end', function() {
      waiting--;
      if (waiting === 0) {
        out.push(null);
      }
    });
  }

  return through.obj(function(file, enc, cb) {
    var spriteName = getSpriteName(file.path);
    var fileName = path.basename(file.path, path.extname(file.path));
    var sprite = getSprite(sprites[getSuffix(fileName)], spriteName, getSuffix(fileName));
    sprite.write(file);
    cb();
  }, function() {
    var out = this;
    var cssFiles = {};

    Object.keys(sprites['1x']).forEach(function(k) {
      var cssStream;

      Object.keys(sprites).forEach(function(suffix) {
        if (!sprites[suffix][k]) return;
        pipe(sprites[suffix][k].img, out);
        if (cssStream) {
          cssStream = merge(cssStream, sprites[suffix][k].css);
        } else {
          cssStream = sprites[suffix][k].css;
        }
      });

      waiting++;
      cssStream.on('data', function(file) {
        cssFiles[k] || (cssFiles[k] = {});
        var fileName = path.basename(file.path, path.extname(file.path));
        cssFiles[k][getSuffix(fileName)] = file;
      });
      cssStream.on('end', function() {
        var content = '';
        Object.keys(sprites).forEach(function(suffix) {
          if (!cssFiles[k][suffix]) return;
          if (!selectors[suffix]) {
            content += cssFiles[k][suffix].contents.toString();
          } else {
            content += selectors[suffix] + ' {\n' + cssFiles[k][suffix].contents.toString() + '}';
          }
        });

        cssFiles[k]['1x'].contents = new Buffer(content);
        out.push(cssFiles[k]['1x']);
        waiting--;
        if (waiting === 0) {
          out.push(null);
        }
      });
      Object.keys(sprites).forEach(function(suffix) {
        sprites[suffix][k] && sprites[suffix][k].end();
      });
    });
  });
};
