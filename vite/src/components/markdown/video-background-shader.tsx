'use client'

/**
 * VideoBackgroundShader — full-screen video background rendered through a
 * dot-grid shader with interactive 2D Navier-Stokes fluid simulation.
 *
 * Uses raw WebGL (zero runtime dependencies). Video luminance drives dot
 * radius: bright = big dot, dark = invisible (unless minLuminance is set).
 * Mouse movement creates fluid splats that blend with the video.
 *
 * Future: `dotStyle` prop will add alternative render modes (e.g. 'ascii')
 * using different characters to mimic video pixel shapes.
 *
 * Usage in MDX:
 *   <VideoBackgroundShader src="/hero-bg.mp4" dotColor="#8da4ff" dotSize={6}>
 *     # My heading
 *   </VideoBackgroundShader>
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/css-vars.ts'

// ─── WebGL typed helpers ───────────────────────────────────────────────────
//
// Minimal utilities for shader-only 2D effects: program compilation with
// cached uniform locations, framebuffer objects for ping-pong rendering,
// and a full-screen quad. All programs share fixed attribute locations
// (0 = position, 1 = uv) so the quad only needs binding once.

interface GpuProgram {
  program: WebGLProgram
  /** Get a cached uniform location by name. Throws if not found. */
  loc(name: string): WebGLUniformLocation
  dispose(gl: WebGLRenderingContext): void
}

interface FBO {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
}

interface DoubleFBO {
  read: FBO
  write: FBO
  swap(): void
}

interface QuadBuffers {
  positionBuffer: WebGLBuffer
  uvBuffer: WebGLBuffer
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile: ${info}`)
  }
  return shader
}

function createGpuProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string): GpuProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  // Fixed attribute locations so quad binding is program-independent
  gl.bindAttribLocation(program, 0, 'position')
  gl.bindAttribLocation(program, 1, 'uv')
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link: ${info}`)
  }
  const uniforms = new Map<string, WebGLUniformLocation>()
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i)
    if (!info) continue
    const loc = gl.getUniformLocation(program, info.name)
    if (loc) uniforms.set(info.name, loc)
  }
  return {
    program,
    loc(name) {
      const l = uniforms.get(name)
      if (!l) throw new Error(`Unknown uniform: ${name}`)
      return l
    },
    dispose(gl) {
      gl.deleteProgram(program)
    },
  }
}

function createFBO(gl: WebGLRenderingContext, w: number, h: number, texType: number): FBO {
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, texType, null)
  const framebuffer = gl.createFramebuffer()!
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  return { framebuffer, texture, width: w, height: h }
}

function createDoubleFBO(gl: WebGLRenderingContext, w: number, h: number, texType: number): DoubleFBO {
  const dfbo: DoubleFBO = {
    read: createFBO(gl, w, h, texType),
    write: createFBO(gl, w, h, texType),
    swap() {
      const tmp = dfbo.read
      dfbo.read = dfbo.write
      dfbo.write = tmp
    },
  }
  return dfbo
}

function createQuadBuffers(gl: WebGLRenderingContext): QuadBuffers {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0])
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])
  const positionBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  const uvBuffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
  return { positionBuffer, uvBuffer }
}

/** Bind quad vertex attributes to locations 0 (position) and 1 (uv). Call once at init. */
function bindQuad(gl: WebGLRenderingContext, quad: QuadBuffers) {
  gl.bindBuffer(gl.ARRAY_BUFFER, quad.positionBuffer)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, quad.uvBuffer)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0)
}

/** Bind a texture to a unit and set the corresponding sampler uniform. */
function setTexture(gl: WebGLRenderingContext, prog: GpuProgram, name: string, texture: WebGLTexture, unit: number) {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniform1i(prog.loc(name), unit)
}

/** Draw the bound quad to an FBO, or to the screen when target is null. */
function drawPass(gl: WebGLRenderingContext, target: FBO | null) {
  if (target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

/** Create a 1x1 transparent placeholder texture. */
function createEmptyTexture(gl: WebGLRenderingContext): WebGLTexture {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
  return tex
}

function disposeFBO(gl: WebGLRenderingContext, fbo: FBO) {
  gl.deleteFramebuffer(fbo.framebuffer)
  gl.deleteTexture(fbo.texture)
}

function disposeDoubleFBO(gl: WebGLRenderingContext, dfbo: DoubleFBO) {
  disposeFBO(gl, dfbo.read)
  disposeFBO(gl, dfbo.write)
}

// ─── Shader sources ────────────────────────────────────────────────────────

const BASE_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`

const FLUID_VERTEX = /* glsl */ `
  precision highp float;
  attribute vec2 uv;
  attribute vec3 position;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;

  void main() {
    vUv = uv;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position, 1.0);
  }
`

const ADVECTION_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  varying vec2 vUv;

  void main() {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    gl_FragColor = dissipation * texture2D(uSource, coord);
  }
`

const DIVERGENCE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;

  void main() {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`

const CURL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;

  void main() {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`

const VORTICITY_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;

  void main() {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 vel = texture2D(uVelocity, vUv).xy;
    gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
  }
`

const PRESSURE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;

  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`

const GRADIENT_SUBTRACT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;

  void main() {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`

const SPLAT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`

const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uDye;
  uniform sampler2D uVideo;
  uniform sampler2D uMask;
  uniform bool enableMask;
  uniform float fluidStrength;
  uniform float gridCellSize;
  uniform float dotRadius;
  uniform float minDotRadius;
  uniform vec2 videoResolution;
  uniform float time;
  uniform float animSpeed;
  uniform float gamma;
  uniform int gridLayout;
  uniform vec3 dotColor;
  uniform float dotAlphaMultiplier;
  uniform bool dotsEnabled;
  uniform float minLuminance;
  uniform int dotStyle;
  uniform sampler2D uCharAtlas;
  uniform float charCount;
  varying vec2 vUv;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 gridPos;
    vec2 cellCenter;
    vec2 cellIndex;
    vec2 centerUv;
    float distanceFromCenter;
    float aspectRatio = videoResolution.x / videoResolution.y;

    if (gridLayout == 1) {
      // Radial layout
      vec2 pixelPos = vUv * videoResolution;
      vec2 center = videoResolution * 0.5;
      float minDim = min(videoResolution.x, videoResolution.y);
      vec2 normalizedPos = (pixelPos - center) / minDim;
      float angle = atan(normalizedPos.y, normalizedPos.x);
      float radius = length(normalizedPos) * minDim;
      float ringIndex = floor(radius / gridCellSize);
      vec2 dotCenterNormalized;
      float dotIndex;
      if (ringIndex < 0.5) {
        dotCenterNormalized = vec2(0.0, 0.0);
        dotIndex = 0.0;
      } else {
        float ringRadius = ringIndex * gridCellSize;
        float circumference = 6.28318 * ringRadius;
        float numDotsInRing = max(1.0, floor(circumference / gridCellSize));
        float anglePerDot = 6.28318 / numDotsInRing;
        dotIndex = floor(angle / anglePerDot);
        float dotAngle = (dotIndex + 0.5) * anglePerDot;
        float dotRad = (ringIndex + 0.5) * gridCellSize;
        dotCenterNormalized = vec2(cos(dotAngle), sin(dotAngle)) * (dotRad / minDim);
      }
      vec2 dotCenterPixel = dotCenterNormalized * minDim + center;
      vec2 toDotNormalized = normalizedPos - dotCenterNormalized;
      distanceFromCenter = length(toDotNormalized) * minDim;
      centerUv = dotCenterPixel / videoResolution;
      cellIndex = vec2(ringIndex, dotIndex);
      gridPos = vec2(0.0);
      cellCenter = vec2(0.0);
    } else if (gridLayout == 2) {
      // Alternating grid (brick pattern)
      cellIndex = floor(vUv * videoResolution / gridCellSize);
      float rowOffset = mod(cellIndex.y, 2.0) * gridCellSize * 0.5;
      vec2 offsetPixel = vUv * videoResolution + vec2(rowOffset, 0.0);
      cellIndex = floor(offsetPixel / gridCellSize);
      centerUv = ((cellIndex + 0.5) * gridCellSize - vec2(rowOffset, 0.0)) / videoResolution;
      gridPos = mod(offsetPixel, gridCellSize);
      cellCenter = vec2(gridCellSize * 0.5);
      distanceFromCenter = length(gridPos - cellCenter);
    } else {
      // Straight layout (default)
      gridPos = mod(vUv * videoResolution, gridCellSize);
      cellCenter = vec2(gridCellSize * 0.5);
      cellIndex = floor(vUv * videoResolution / gridCellSize);
      centerUv = ((cellIndex + 0.5) * gridCellSize) / videoResolution;
      distanceFromCenter = length(gridPos - cellCenter);
    }

    vec4 video = texture2D(uVideo, centerUv);
    vec4 dye = texture2D(uDye, centerUv);
    vec3 videoGammaCorrected = pow(video.rgb, vec3(gamma));
    vec3 scaledDye = dye.rgb * fluidStrength;
    scaledDye = pow(scaledDye + 0.001, vec3(0.7));
    float videoLuminance = dot(videoGammaCorrected + scaledDye, vec3(0.299, 0.587, 0.114));
    float dyeLuminance = dot(dye.rgb, vec3(0.299, 0.587, 0.114));
    float luminance = max(max(videoLuminance, dyeLuminance), minLuminance);

    if (enableMask) {
      vec4 mask = texture2D(uMask, vUv);
      float maskAlpha = mask.a;
      luminance = luminance * maskAlpha;
    }

    if (!dotsEnabled) {
      gl_FragColor = vec4(dotColor, luminance * dotAlphaMultiplier);
      return;
    }

    // ASCII mode: sample character glyph from a font atlas texture.
    // Characters are ordered by visual weight in the atlas. Luminance picks
    // the base index; per-cell random jitter adds variety so neighboring
    // cells at similar brightness show different characters.
    if (dotStyle == 1) {
      // Per-cell hash that changes over time: each cell shifts character
      // ~3 times/sec with a discrete jump (floor quantizes so it doesn't flicker)
      float r = random(cellIndex + floor(time * 3.0));
      float idx = luminance * (charCount - 1.0) + (r - 0.5) * 5.0;
      idx = clamp(idx, 0.0, charCount - 1.0);
      float ci = floor(idx);
      vec2 cellPos = clamp(gridPos / gridCellSize, vec2(0.01), vec2(0.99));
      vec2 atlasUv = vec2((ci + cellPos.x) / charCount, cellPos.y);
      float charMask = texture2D(uCharAtlas, atlasUv).r;
      float luminanceCutoff = smoothstep(0.0, 0.05, luminance);
      float finalAlpha = charMask * luminance * luminanceCutoff * dotAlphaMultiplier;
      gl_FragColor = vec4(dotColor, finalAlpha);
      return;
    }

    float randomValue = random(cellIndex);
    float phase = randomValue * 6.28318;
    float scaleAnimation = sin(time * animSpeed + phase) * 0.5 + 0.5;
    float randomScale = 1.0 - (scaleAnimation * 0.5);
    float luminanceMinScale = min(minDotRadius / dotRadius, 1.0);
    float finalScale = (luminanceMinScale + (luminance * (1.0 - luminanceMinScale))) * randomScale;
    float scaledRadiusVal = dotRadius * finalScale;
    float maxRadius = gridCellSize * 0.5;
    scaledRadiusVal = min(scaledRadiusVal, maxRadius);
    float edgeWidth = 0.5;
    float dotMask = 1.0 - smoothstep(scaledRadiusVal - edgeWidth, scaledRadiusVal + edgeWidth, distanceFromCenter);
    float luminanceCutoff = smoothstep(0.0, 0.1, luminance);
    float finalAlpha = dotMask * luminance * luminanceCutoff * dotAlphaMultiplier;

    gl_FragColor = vec4(dotColor, finalAlpha);
  }
`

// ─── Config ────────────────────────────────────────────────────────────────

export interface VideoShaderConfig {
  /** Video source path. Required. */
  src: string
  maskSrc?: string
  dotsEnabled?: boolean
  dotSize?: number
  minDotSize?: number
  dotMargin?: number
  dotColor?: string
  dotAlphaMultiplier?: number
  gridLayout?: 'straight' | 'radial' | 'alternating-grid'
  enableMask?: boolean
  animSpeed?: number
  gamma?: number
  loopAt?: number
  fluidCurl?: number
  fluidVelocityDissipation?: number
  fluidDyeDissipation?: number
  fluidSplatRadius?: number
  fluidPressureIterations?: number
  fluidStrength?: number
  /** Minimum luminance floor (0-1). Dots appear even in dark video areas
   *  when this is above 0. Higher = more dots everywhere. Default 0. */
  minLuminance?: number
  /** Render style: 'dots' (circle grid) or 'ascii' (character grid). Default 'dots'. */
  dotStyle?: 'dots' | 'ascii'
  /** Characters for ASCII mode, ordered lightest to heaviest. Default ' .:-~=+x?$%#@MW'. */
  chars?: string
  /** CSS font for ASCII mode. Must be monospaced. Default 'monospace'. */
  charFont?: string
}

const DEFAULT_CONFIG: Required<Omit<VideoShaderConfig, 'src'>> = {
  maskSrc: '',
  dotsEnabled: true,
  dotSize: 6,
  minDotSize: 1,
  dotMargin: 0,
  dotColor: '#5b7cff',
  dotAlphaMultiplier: 1,
  gridLayout: 'straight',
  enableMask: false,
  animSpeed: 4,
  gamma: 0.9,
  loopAt: 4,
  fluidCurl: 100,
  fluidVelocityDissipation: 0.93,
  fluidDyeDissipation: 0.95,
  fluidSplatRadius: 0.006,
  fluidPressureIterations: 1,
  fluidStrength: 0.15,
  minLuminance: 0.2,
  dotStyle: 'dots',
  chars: ' .:-~=+x?$%#@A',
  charFont: 'monospace',
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function hexToRgbNormalized(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 1, g: 1, b: 1 }
  return {
    r: Number.parseInt(result[1]!, 16) / 255,
    g: Number.parseInt(result[2]!, 16) / 255,
    b: Number.parseInt(result[3]!, 16) / 255,
  }
}

/** Render characters onto a single-row texture atlas using Canvas 2D.
 *  Each character occupies a square cell. Returns the GL texture + count. */
function createCharAtlas(gl: WebGLRenderingContext, chars: string, font: string): { texture: WebGLTexture; count: number } {
  const cellSize = 64 // px per character in the atlas (internal resolution)
  const atlasCanvas = document.createElement('canvas')
  atlasCanvas.width = chars.length * cellSize
  atlasCanvas.height = cellSize
  const ctx = atlasCanvas.getContext('2d')!
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, atlasCanvas.width, atlasCanvas.height)
  ctx.fillStyle = 'white'
  ctx.font = `900 ${Math.floor(cellSize * 0.85)}px ${font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i]!, (i + 0.5) * cellSize, cellSize * 0.52)
  }
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  atlasCanvas.width = 0
  atlasCanvas.height = 0
  return { texture, count: chars.length }
}

// ─── Engine ────────────────────────────────────────────────────────────────

function createVideoShaderEngine(container: HTMLElement, config: Required<Omit<VideoShaderConfig, 'src'>> & { src: string; onReady?: () => void }) {
  const width = container.clientWidth
  const height = container.clientHeight
  const dpr = Math.min(2, window.devicePixelRatio || 1)

  // Canvas + WebGL context
  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  container.appendChild(canvas)

  // premultipliedAlpha: false because the display shader outputs non-premultiplied
  // color (vec4(dotColor, finalAlpha) where dotColor is NOT pre-multiplied by alpha).
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false })!

  // Enable float texture extensions for fluid sim FBOs
  const halfFloatExt = gl.getExtension('OES_texture_half_float')
  gl.getExtension('OES_texture_float')
  gl.getExtension('EXT_color_buffer_half_float')
  gl.getExtension('WEBGL_color_buffer_float')
  const texType = halfFloatExt ? halfFloatExt.HALF_FLOAT_OES : gl.FLOAT

  // Sim resolution (half size for performance)
  const simW = Math.floor(width / 2)
  const simH = Math.floor(height / 2)

  // Fluid simulation FBOs (ping-pong pairs)
  const velocity = createDoubleFBO(gl, simW, simH, texType)
  const dye = createDoubleFBO(gl, simW, simH, texType)
  const divergenceFBO = createFBO(gl, simW, simH, texType)
  const curlFBO = createFBO(gl, simW, simH, texType)
  const pressure = createDoubleFBO(gl, simW, simH, texType)

  // Video element
  const video = document.createElement('video')
  video.src = config.src
  video.loop = false
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.addEventListener('ended', () => {
    video.currentTime = config.loopAt
    video.play().catch(() => {})
  })

  // Fire onReady when the video has enough data to render a frame.
  if (config.onReady) {
    if (video.readyState >= 3) {
      config.onReady()
    } else {
      video.addEventListener('canplay', () => config.onReady!(), { once: true })
    }
  }

  // Video texture (updated from the <video> element each frame)
  const videoTex = createEmptyTexture(gl)

  // Mask texture (only load image when mask is actually enabled to avoid 404s)
  let disposed = false
  const maskTex = createEmptyTexture(gl)
  if (config.enableMask && config.maskSrc) {
    const img = new Image()
    img.onload = () => {
      if (disposed) return
      gl.bindTexture(gl.TEXTURE_2D, maskTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    }
    img.src = config.maskSrc
  }

  // Character atlas for ASCII mode. Dots mode binds a 1x1 texture so the shader
  // setup stays linear without paying the Canvas 2D atlas cost for normal dots.
  const charAtlas =
    config.dotStyle === 'ascii'
      ? createCharAtlas(gl, config.chars, config.charFont)
      : { texture: createEmptyTexture(gl), count: 1 }

  // Full-screen quad (shared by all programs via fixed attrib locations)
  const quad = createQuadBuffers(gl)
  bindQuad(gl, quad)

  // ── GPU programs ──

  const advectionP = createGpuProgram(gl, FLUID_VERTEX, ADVECTION_FRAG)
  const divergenceP = createGpuProgram(gl, FLUID_VERTEX, DIVERGENCE_FRAG)
  const curlP = createGpuProgram(gl, FLUID_VERTEX, CURL_FRAG)
  const vorticityP = createGpuProgram(gl, FLUID_VERTEX, VORTICITY_FRAG)
  const pressureP = createGpuProgram(gl, FLUID_VERTEX, PRESSURE_FRAG)
  const gradientSubtractP = createGpuProgram(gl, FLUID_VERTEX, GRADIENT_SUBTRACT_FRAG)
  const splatP = createGpuProgram(gl, FLUID_VERTEX, SPLAT_FRAG)
  const displayP = createGpuProgram(gl, BASE_VERTEX, DISPLAY_FRAG)

  // ── Static uniforms (set once, persist across frames) ──

  const texelX = 1 / simW
  const texelY = 1 / simH
  for (const p of [advectionP, divergenceP, curlP, vorticityP, pressureP, gradientSubtractP, splatP]) {
    gl.useProgram(p.program)
    gl.uniform2f(p.loc('texelSize'), texelX, texelY)
  }

  gl.useProgram(vorticityP.program)
  gl.uniform1f(vorticityP.loc('curl'), config.fluidCurl)

  gl.useProgram(splatP.program)
  gl.uniform1f(splatP.loc('aspectRatio'), width / height)
  gl.uniform1f(splatP.loc('radius'), config.fluidSplatRadius)

  const gridLayoutIndex = { straight: 0, radial: 1, 'alternating-grid': 2 }[config.gridLayout] || 0
  const dotRgb = hexToRgbNormalized(config.dotColor)

  gl.useProgram(displayP.program)
  gl.uniform1f(displayP.loc('fluidStrength'), config.fluidStrength)
  gl.uniform1f(displayP.loc('gridCellSize'), config.dotSize + config.dotMargin)
  gl.uniform1f(displayP.loc('dotRadius'), config.dotSize / 2)
  gl.uniform1f(displayP.loc('minDotRadius'), config.minDotSize / 2)
  gl.uniform2f(displayP.loc('videoResolution'), width, height)
  gl.uniform1f(displayP.loc('animSpeed'), config.animSpeed)
  gl.uniform1f(displayP.loc('gamma'), config.gamma)
  gl.uniform1i(displayP.loc('gridLayout'), gridLayoutIndex)
  gl.uniform3f(displayP.loc('dotColor'), dotRgb.r, dotRgb.g, dotRgb.b)
  gl.uniform1f(displayP.loc('dotAlphaMultiplier'), config.dotAlphaMultiplier)
  gl.uniform1i(displayP.loc('enableMask'), config.enableMask ? 1 : 0)
  gl.uniform1i(displayP.loc('dotsEnabled'), config.dotsEnabled ? 1 : 0)
  gl.uniform1f(displayP.loc('minLuminance'), config.minLuminance)
  gl.uniform1i(displayP.loc('dotStyle'), config.dotStyle === 'ascii' ? 1 : 0)
  gl.uniform1f(displayP.loc('charCount'), charAtlas.count)

  // ── Fluid simulation step ──

  function stepFluid(dt: number) {
    gl.useProgram(advectionP.program)
    gl.uniform1f(advectionP.loc('dt'), dt)
    setTexture(gl, advectionP, 'uVelocity', velocity.read.texture, 0)
    setTexture(gl, advectionP, 'uSource', velocity.read.texture, 1)
    gl.uniform1f(advectionP.loc('dissipation'), config.fluidVelocityDissipation)
    drawPass(gl, velocity.write)
    velocity.swap()

    gl.useProgram(advectionP.program)
    setTexture(gl, advectionP, 'uVelocity', velocity.read.texture, 0)
    setTexture(gl, advectionP, 'uSource', dye.read.texture, 1)
    gl.uniform1f(advectionP.loc('dissipation'), config.fluidDyeDissipation)
    drawPass(gl, dye.write)
    dye.swap()

    gl.useProgram(curlP.program)
    setTexture(gl, curlP, 'uVelocity', velocity.read.texture, 0)
    drawPass(gl, curlFBO)

    gl.useProgram(vorticityP.program)
    setTexture(gl, vorticityP, 'uVelocity', velocity.read.texture, 0)
    setTexture(gl, vorticityP, 'uCurl', curlFBO.texture, 1)
    gl.uniform1f(vorticityP.loc('dt'), dt)
    drawPass(gl, velocity.write)
    velocity.swap()

    gl.useProgram(divergenceP.program)
    setTexture(gl, divergenceP, 'uVelocity', velocity.read.texture, 0)
    drawPass(gl, divergenceFBO)

    gl.useProgram(pressureP.program)
    setTexture(gl, pressureP, 'uDivergence', divergenceFBO.texture, 1)
    for (let i = 0; i < config.fluidPressureIterations; i++) {
      setTexture(gl, pressureP, 'uPressure', pressure.read.texture, 0)
      drawPass(gl, pressure.write)
      pressure.swap()
    }

    gl.useProgram(gradientSubtractP.program)
    setTexture(gl, gradientSubtractP, 'uPressure', pressure.read.texture, 0)
    setTexture(gl, gradientSubtractP, 'uVelocity', velocity.read.texture, 1)
    drawPass(gl, velocity.write)
    velocity.swap()
  }

  // ── Splat (mouse interaction) ──

  function splat(x: number, y: number, dx: number, dy: number) {
    gl.useProgram(splatP.program)
    gl.uniform1f(splatP.loc('aspectRatio'), width / height)

    setTexture(gl, splatP, 'uTarget', velocity.read.texture, 0)
    gl.uniform2f(splatP.loc('point'), x / width, 1.0 - y / height)
    gl.uniform3f(splatP.loc('color'), dx * 5000, -dy * 5000, 0)
    gl.uniform1f(splatP.loc('radius'), config.fluidSplatRadius)
    drawPass(gl, velocity.write)
    velocity.swap()

    setTexture(gl, splatP, 'uTarget', dye.read.texture, 0)
    gl.uniform3f(splatP.loc('color'), dotRgb.r * 0.8, dotRgb.g * 0.8, dotRgb.b * 0.8)
    drawPass(gl, dye.write)
    dye.swap()
  }

  // ── Mouse tracking ──

  let lastMouseX = 0
  let lastMouseY = 0

  function onMouseMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const dx = x - lastMouseX
    const dy = y - lastMouseY
    lastMouseX = x
    lastMouseY = y
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      splat(x, y, dx * 0.01, dy * 0.01)
    }
  }

  container.addEventListener('mousemove', onMouseMove)

  // ── Animation loop ──

  let animId: number
  let lastTime = performance.now()
  const startTime = performance.now()

  let tryPlay: (() => void) | undefined

  video.play().catch(() => {
    tryPlay = () => {
      video.play().catch(() => {})
      if (tryPlay) document.removeEventListener('click', tryPlay)
      tryPlay = undefined
    }
    document.addEventListener('click', tryPlay)
  })

  function animate() {
    animId = requestAnimationFrame(animate)
    const now = performance.now()
    const dt = Math.min((now - lastTime) / 1000, 0.033)
    lastTime = now

    if (video.readyState >= video.HAVE_CURRENT_DATA) {
      gl.bindTexture(gl.TEXTURE_2D, videoTex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
    }

    stepFluid(dt)

    gl.useProgram(displayP.program)
    gl.uniform1f(displayP.loc('time'), (now - startTime) / 1000)
    setTexture(gl, displayP, 'uDye', dye.read.texture, 0)
    setTexture(gl, displayP, 'uVideo', videoTex, 1)
    setTexture(gl, displayP, 'uMask', maskTex, 2)
    setTexture(gl, displayP, 'uCharAtlas', charAtlas.texture, 3)
    drawPass(gl, null)
  }

  animate()

  // ── Resize ──

  function onResize() {
    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    gl.useProgram(displayP.program)
    gl.uniform2f(displayP.loc('videoResolution'), w, h)
    gl.useProgram(splatP.program)
    gl.uniform1f(splatP.loc('aspectRatio'), w / h)
  }

  const resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(container)

  // ── Cleanup ──

  function cleanup() {
    disposed = true
    cancelAnimationFrame(animId)
    container.removeEventListener('mousemove', onMouseMove)
    if (tryPlay) document.removeEventListener('click', tryPlay)
    resizeObserver.disconnect()
    video.pause()
    video.src = ''
    advectionP.dispose(gl)
    divergenceP.dispose(gl)
    curlP.dispose(gl)
    vorticityP.dispose(gl)
    pressureP.dispose(gl)
    gradientSubtractP.dispose(gl)
    splatP.dispose(gl)
    displayP.dispose(gl)
    disposeDoubleFBO(gl, velocity)
    disposeDoubleFBO(gl, dye)
    disposeFBO(gl, divergenceFBO)
    disposeFBO(gl, curlFBO)
    disposeDoubleFBO(gl, pressure)
    gl.deleteTexture(videoTex)
    gl.deleteTexture(maskTex)
    gl.deleteTexture(charAtlas.texture)
    gl.deleteBuffer(quad.positionBuffer)
    gl.deleteBuffer(quad.uvBuffer)
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas)
    }
    const loseContext = gl.getExtension('WEBGL_lose_context')
    if (loseContext) loseContext.loseContext()
  }

  return { cleanup, canvas, video }
}

// ─── Gradient helpers ──────────────────────────────────────────────────────

const TOP_GRADIENT = [
  'linear-gradient(to bottom,',
  'var(--background) 0%,',
  'color-mix(in srgb, var(--background) 90%, transparent) 10%,',
  'color-mix(in srgb, var(--background) 70%, transparent) 22%,',
  'color-mix(in srgb, var(--background) 40%, transparent) 40%,',
  'color-mix(in srgb, var(--background) 15%, transparent) 60%,',
  'transparent 80%)',
].join(' ')

const BOTTOM_GRADIENT = [
  'linear-gradient(to top,',
  'var(--background) 0%,',
  'color-mix(in srgb, var(--background) 85%, transparent) 15%,',
  'color-mix(in srgb, var(--background) 50%, transparent) 35%,',
  'color-mix(in srgb, var(--background) 20%, transparent) 55%,',
  'transparent 75%)',
].join(' ')

// ─── React component ───────────────────────────────────────────────────────

export interface VideoBackgroundShaderProps extends Omit<VideoShaderConfig, 'src'> {
  /** Video source path (required). */
  src: string
  /** Content rendered over the video background. */
  children?: ReactNode
  className?: string
  /** Extra classes applied only to the canvas container (not gradients or children).
   *  Useful for light/dark opacity: `canvasClassName="dark:opacity-60 opacity-40"` */
  canvasClassName?: string
  /** Show top gradient overlay fading into page background. Default true. */
  fadeTop?: boolean
  /** Show bottom gradient overlay fading into page background. Default true. */
  fadeBottom?: boolean
}

export function VideoBackgroundShader({
  children,
  className,
  canvasClassName,
  src,
  fadeTop = true,
  fadeBottom = true,
  ...config
}: VideoBackgroundShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasReady, setCanvasReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Safety timeout: show content after 3s even if video never loads
    const timeout = setTimeout(() => setCanvasReady(true), 3000)

    const engine = createVideoShaderEngine(container, {
      ...DEFAULT_CONFIG,
      ...config,
      src,
      onReady() {
        clearTimeout(timeout)
        setCanvasReady(true)
      },
    })

    return () => {
      clearTimeout(timeout)
      engine.cleanup()
    }
  }, [src, ...Object.values(config)])

  const fadeTransition = 'opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1)'

  return (
    <div className={cn('relative flex flex-col items-center overflow-hidden', className)}>
      {/* WebGL canvas container */}
      <div
        ref={containerRef}
        className={cn('absolute inset-0 w-full h-full z-0 overflow-hidden', canvasClassName)}
        style={{
          opacity: canvasReady ? 1 : 0,
          transition: fadeTransition,
        }}
      />

      {/* Top gradient overlay */}
      {fadeTop && (
        <div
          className='absolute top-0 inset-x-0 h-[60%] z-[1] pointer-events-none'
          style={{
            background: TOP_GRADIENT,
            opacity: canvasReady ? 1 : 0,
            transition: fadeTransition,
          }}
        />
      )}

      {/* Bottom gradient overlay */}
      {fadeBottom && (
        <div
          className='absolute bottom-0 inset-x-0 h-[40%] z-[1] pointer-events-none'
          style={{
            background: BOTTOM_GRADIENT,
            opacity: canvasReady ? 1 : 0,
            transition: fadeTransition,
          }}
        />
      )}

      {/* Foreground content */}
      {children && (
        <div
          className='relative z-[2] flex flex-col items-center justify-center text-center w-full px-5 py-16 sm:py-24 gap-6'
          style={{
            opacity: canvasReady ? 1 : 0,
            transition: 'opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
