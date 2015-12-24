// program.js
// Creates programs out of shaders and provides convenient methods for loading
// buffers attributes and uniforms

import Shaders from './shaders';
import {XHR} from './io';
import $ from './jquery-mini';

// Creates a shader from a string source.
function createShader(gl, shaderSource, shaderType) {
  var shader = gl.createShader(shaderType);
  if (shader === null) {
    throw new Error(`Error creating shader with type ${shaderType}`);
  }
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    var info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Error while compiling the shader ${info}`);
  }
  return shader;
}

// Creates a program from vertex and fragment shader sources.
function createProgram(gl, vertexShader, fragmentShader) {
  const vs = createShader(gl, vertexShader, gl.VERTEX_SHADER);
  const fs = createShader(gl, fragmentShader, gl.FRAGMENT_SHADER);

  const glProgram = gl.createProgram();
  gl.attachShader(glProgram, vs);
  gl.attachShader(glProgram, fs);

  gl.linkProgram(glProgram);
  const linked = gl.getProgramParameter(glProgram, gl.LINK_STATUS);
  if (!linked) {
    throw new Error(`Error linking shader ${gl.getProgramInfoLog(glProgram)}`);
  }

  return glProgram;
}

// recursiveLoad a source with `#include ""` support
// `duplist` records all the pending replacements
async function recursiveLoad(gl, base, source, duplist = {}) {

  function getpath(path) {
    var last = path.lastIndexOf('/');
    if (last === '/') {
      return './';
    }
    return path.substr(0, last + 1);
  }

  var match;
  if ((match = source.match(/#include "(.*?)"/))) {
    const url = getpath(base) + match[1];

    try {

      if (duplist[url]) {
        callbackError('Recursive include');
      }

      const response = new XHR({url: url, noCache: true}).sendAsync();
      duplist[url] = true;
      const replacement = await recursiveLoad(gl, url, response);
      delete duplist[url];
      source = source.replace(/#include ".*?"/, replacement);
      source = source.replace(
        /\sHAS_EXTENSION\s*\(\s*([A-Za-z_\-0-9]+)\s*\)/g,
        (all, ext) => gl.getExtension(ext) ? ' 1 ': ' 0 '
      );
      return recursiveLoad(gl, url, source, duplist);

    } catch (error) {
      throw (new Error(`Load including file ${url} failed`));
    }

  }
}

// Returns a Magic Uniform Setter
function getUniformSetter(gl, glProgram, info, isArray) {

  const {name, type} = info;
  const loc = gl.getUniformLocation(glProgram, name);

  let matrix = false;
  let vector = true;
  let glFunction;
  let typedArray;

  if (info.size > 1 && isArray) {
    switch (type) {

    case gl.FLOAT:
      glFunction = gl.uniform1fv;
      typedArray = Float32Array;
      vector = false;
      break;

    case gl.INT:
    case gl.BOOL:
    case gl.SAMPLER_2D:
    case gl.SAMPLER_CUBE:
      glFunction = gl.uniform1iv;
      typedArray = Uint16Array;
      vector = false;
      break;

    default:
      throw new Error('Uniform: Unknown GLSL type');

    }
  }

  if (vector) {
    switch (type) {
    case gl.FLOAT:
      glFunction = gl.uniform1f;
      break;
    case gl.FLOAT_VEC2:
      glFunction = gl.uniform2fv;
      typedArray = isArray ? Float32Array : new Float32Array(2);
      break;
    case gl.FLOAT_VEC3:
      glFunction = gl.uniform3fv;
      typedArray = isArray ? Float32Array : new Float32Array(3);
      break;
    case gl.FLOAT_VEC4:
      glFunction = gl.uniform4fv;
      typedArray = isArray ? Float32Array : new Float32Array(4);
      break;
    case gl.INT: case gl.BOOL: case gl.SAMPLER_2D: case gl.SAMPLER_CUBE:
      glFunction = gl.uniform1i;
      break;
    case gl.INT_VEC2: case gl.BOOL_VEC2:
      glFunction = gl.uniform2iv;
      typedArray = isArray ? Uint16Array : new Uint16Array(2);
      break;
    case gl.INT_VEC3: case gl.BOOL_VEC3:
      glFunction = gl.uniform3iv;
      typedArray = isArray ? Uint16Array : new Uint16Array(3);
      break;
    case gl.INT_VEC4: case gl.BOOL_VEC4:
      glFunction = gl.uniform4iv;
      typedArray = isArray ? Uint16Array : new Uint16Array(4);
      break;
    case gl.FLOAT_MAT2:
      matrix = true;
      glFunction = gl.uniformMatrix2fv;
      break;
    case gl.FLOAT_MAT3:
      matrix = true;
      glFunction = gl.uniformMatrix3fv;
      break;
    case gl.FLOAT_MAT4:
      matrix = true;
      glFunction = gl.uniformMatrix4fv;
      break;
    default:
      break;
    }
  }

  glFunction = glFunction.bind(gl);

  // Set a uniform array
  if (isArray && typedArray) {

    return val => glFunction(loc, new typedArray(val));

  } else if (matrix) {
    // Set a matrix uniform
    return val => glFunction(loc, false, val.toFloat32Array());

  } else if (typedArray) {

    // Set a vector/typed array uniform
    return val => {
      typedArray.set(val.toFloat32Array ? val.toFloat32Array() : val);
      glFunction(loc, typedArray);
    };

  } else {

    // Set a primitive-valued uniform
    return val => glFunction(loc, val);

  }

  // FIXME: Unreachable code
  throw new Error(`Unknown type: ${type}`);
}

export default class Program {

  /**
   * @classdesc Handles loading of programs, mapping of attributes and uniforms
   */
  constructor(app, vertexShader, fragmentShader) {
    const gl = app.gl;

    this.app = app;
    const glProgram = createProgram(gl, vertexShader, fragmentShader);
    if (!glProgram) {
      throw new Error('Failed to create program');
    }

    const attributes = {};
    const attributeEnabled = {};
    const uniforms = {};
    let info;
    let name;
    let index;

    // fill attribute locations
    let len = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < len; i++) {
      info = gl.getActiveAttrib(glProgram, i);
      name = info.name;
      index = gl.getAttribLocation(glProgram, info.name);
      attributes[name] = index;
    }

    // create uniform setters
    len = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < len; i++) {
      info = gl.getActiveUniform(glProgram, i);
      name = info.name;
      // if array name then clean the array brackets
      name = name[name.length - 1] === ']' ?
        name.substr(0, name.length - 3) : name;
      uniforms[name] =
        getUniformSetter(gl, glProgram, info, info.name !== name);
    }

    this.program = glProgram;

    // handle attributes and uniforms
    this.attributes = attributes;
    this.attributeEnabled = attributeEnabled;
    this.uniforms = uniforms;
  }

  // Alternate constructor
  // Create a program from vertex and fragment shader node ids
  static async fromShaderIds(...args) {
    const opt = Program._getOptions({}, ...args);
    const gl = opt.app.gl;

    const {vs, fs, path} = opt;
    const [vertexShader, fragmentShader] = await Promise.all(
      recursiveLoad(gl, path, document.getElementById(vs).innerHTML),
      recursiveLoad(gl, path, document.getElementById(fs).innerHTML)
    );

    return new Program(opt.app, vertexShader, fragmentShader);
  }

  // Alternate constructor
  // Create a program from vs and fs sources
  static async fromShaderSources(...args) {
    var opt = Program._getOptions({path: './', ...args});
    const gl = opt.app.gl;
    const [vertexShader, fragmentShader] = await Promise.all(
      recursiveLoad(gl, opt.path, opt.vs),
      recursiveLoad(gl, opt.path, opt.fs)
    );
    return new Program(opt.app, vertexShader, fragmentShader);
  }

  // Alternate constructor
  // Build program from default shaders (requires Shaders)
  static async fromDefaultShaders(opt = {}) {
    const {vs = 'Default', fs = 'Default'} = opt;
    return Program.fromShaderSources({
      ...opt,
      vs: Shaders.Vertex[vs],
      fs: Shaders.Fragment[fs]
    });
  }

  // Alternate constructor
  // Implement Program.fromShaderURIs (requires IO)
  static async fromShaderURIs(opt = {}) {
    const gl = opt.app.gl;
    const {path = '', vs = '', fs = '', noCache = false} = opt;

    const vertexShaderURI = path + vs;
    const fragmentShaderURI = path + fs;

    const responses = await new XHRGroup({
      urls: [vertexShaderURI, fragmentShaderURI],
      noCache: noCache,
    }).sendAsync();

    const [vertexShader, fragmentShader] = await Promise.all([
      recursiveLoad(gl, vertexShaderURI, responses[0]),
      recursiveLoad(gl, fragmentShaderURI, responses[1])
    ]);

    return Program.fromShaderSources({
      ...opt,
      vs: vertexShader,
      fs: fragmentShader
    });

  }

  // rye: TODO- This is a temporary measure to get things working
  //            until we decide on how to manage uniforms.
  setUniform(name, value) {
    if (name in this.uniforms) {
      this.uniforms[name](value);
    }
    return this;
  }

  // rye: TODO- This is a temporary measure to get things working
  //            until we decide on how to manage uniforms.
  setUniforms(forms) {
    for (const name of Object.keys(forms)) {
      if (name in this.uniforms) {
        this.uniforms[name](forms[name]);
      }
    }
    return this;
  }

  setBuffer(...args) {
    this.app.setBuffer(this, ...args);
    return this;
  }

  setBuffers(...args) {
    this.app.setBuffers(this, ...args);
    return this;
  }

  use(...args) {
    this.app.use(this, ...args);
    return this;
  }

  setFrameBuffer(...args) {
    this.app.setFrameBuffer(this.app, ...args);
    return this;
  }

  setFrameBuffers(...args) {
    this.app.setFrameBuffers(this.app, ...args);
    return this;
  }

  setRenderBuffer(...args) {
    this.app.setRenderBuffer(this.app, ...args);
    return this;
  }

  setRenderBuffers(...args) {
    this.app.setRenderBuffers(this.app, ...args);
    return this;
  }

  setTexture(...args) {
    this.app.setTexture(this.app, ...args);
    return this;
  }

  setTextures(...args) {
    this.app.setTextures(this.app, ...args);
    return this;
  }

  // Get options object or make options object from 2 arguments
  static _getOptions(base = {}, ...args) {
    let opt;
    if (args.length === 2) {
      return {
        ...base,
        vs: args[0],
        fs: args[1]
      };
    } else {
      return {
        ...base,
        ...(args[0] || {})
      };
    }
  }

}
