var webGLStart = function() {
  var $id = function(d) { return document.getElementById(d); };

  var pgl = PhiloGL;

  //Get Model
  new pgl.IO.XHR({
    url: 'Teapot.json',
    onSuccess: function(text) {
      var json = JSON.parse(text);
      animateObject(json);
    }
  }).send();

  var canvas = document.getElementById('lesson14-canvas');

  var gl = pgl.createGLContext(canvas);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.viewport(0, 0, +canvas.width, +canvas.height);

  var camera = new pgl.PerspectiveCamera({
    aspect: canvas.width/canvas.height,
    position: new pgl.Vec3(0, 0, -50),
  });

  function animateObject(teapotJSON) {
    Promise.all([
      pgl.Program.fromShaderURIs(gl, 'frag-lighting.vs.glsl', 'frag-lighting.fs.glsl', {
          path: '../../../shaders/',
          noCache: true
      }),
      pgl.loadTextures(gl, {
        src: ['arroway.de_metal+structure+06_d100_flat.jpg', 'earth.jpg'],
        parameters: [{
          magFilter: gl.LINEAR,
          minFilter: gl.LINEAR_MIPMAP_NEAREST,
          wrapS: gl.REPEAT,
          wrapT: gl.REPEAT,
          generateMipmap: true
        },{
          magFilter: gl.LINEAR,
          minFilter: gl.LINEAR_MIPMAP_NEAREST,
          wrapS: gl.REPEAT,
          wrapT: gl.REPEAT,
          generateMipmap: true
        }]
      })
    ]).then(function(results) {
      var program = results[0];
      var tGalvanized = results[1][0];
      var tEarth = results[1][1];
      teapotJSON.colors = [1, 1, 1, 1];
      teapotJSON.textures = tGalvanized;
      var teapot = new pgl.O3D.Model(teapotJSON);
      program.use();
      var scene = new pgl.Scene(gl, program, camera);
      var shininess = $id('shininess'),
          //specular
          specular = $id('specular'),
          //get light config from forms
          lighting = $id('lighting'),
          ambient = {
            r: $id('ambientR'),
            g: $id('ambientG'),
            b: $id('ambientB')
          },
          point = {
            x: $id('lightPositionX'),
            y: $id('lightPositionY'),
            z: $id('lightPositionZ'),

            sr: $id('specularR'),
            sg: $id('specularG'),
            sb: $id('specularB'),

            dr: $id('diffuseR'),
            dg: $id('diffuseG'),
            db: $id('diffuseB')
          },
          texture = $id('texture'),
          //object rotation
          theta = 0;

      //Basic gl setup
      //Add objects to the scene
      scene.add(teapot);

      //Animate
      draw();

      //Draw the scene
      function draw() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        //Setup lighting
        var lights = scene.config.lights;
        lights.enable = lighting.checked;
        lights.ambient = {
          r: +ambient.r.value,
          g: +ambient.g.value,
          b: +ambient.b.value
        };
        lights.points = {
          diffuse: {
            r: +point.dr.value,
            g: +point.dg.value,
            b: +point.db.value
          },
          specular: {
            r: +point.sr.value,
            g: +point.sg.value,
            b: +point.sb.value
          },
          position: {
            x: +point.x.value,
            y: +point.y.value,
            z: +point.z.value
          }
        };
        //Set/Unset specular highlights
        if (!specular.checked) {
          delete lights.points.specular;
        }
        //Set shininess
        teapot.uniforms.shininess = +shininess.value;
        //Set texture
        if (texture.value == 'none') {
          delete teapot.textures;
        } else if (texture.value == 'galvanized') {
          teapot.textures = tGalvanized;
        } else {
          teapot.textures = tEarth;
        }

        //Update position
        theta += 0.01;
        teapot.rotation.set(theta / 100, theta, 0);
        teapot.update();

        //render objects
        scene.render();

        //request new frame
        pgl.Fx.requestAnimationFrame(draw);
      }
    });
  }
}
