/* global window, document, PhiloGL */

window.webGLStart = function() {

  var Application = PhiloGL.Application;
  var Program = PhiloGL.Program;
  var PerspectiveCamera = PhiloGL.PerspectiveCamera;
  var createGLContext = PhiloGL.createGLContext;

  var canvas = document.getElementById('lesson01-canvas');

  var app = new Application(canvas);

  var gl = app.gl;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.clearDepth(1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var program = Program.fromHTMLTemplates(app, 'shader-vs', 'shader-fs');

  program.use();

  program.setBuffers({
    'triangle': {
      attribute: 'aVertexPosition',
      value: new Float32Array([0, 1, 0, -1, -1, 0, 1, -1, 0]),
      size: 3
    },

    'square': {
      attribute: 'aVertexPosition',
      value: new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0]),
      size: 3
    }
  });

  var camera = new PerspectiveCamera({
    aspect: canvas.width/canvas.height,
  });

  // Draw Triangle
  camera.view.$translate(-1.5, 0, -7);
  program.setUniform('uMVMatrix', camera.view);
  program.setUniform('uPMatrix', camera.projection);
  program.setBuffer('triangle');
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // Draw Square
  camera.view.$translate(3, 0, 0);
  program.setUniform('uMVMatrix', camera.view);
  program.setUniform('uPMatrix', camera.projection);
  program.setBuffer('square');
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

};
