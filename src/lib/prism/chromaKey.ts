export interface ChromaKeySettings {
  keyColor: { r: number; g: number; b: number };
  similarity: number;
  smoothness: number;
  spill: number;
  lightWrap: number;
}

export const DEFAULT_KEY_SETTINGS: ChromaKeySettings = {
  keyColor: { r: 0, g: 177, b: 64 },
  similarity: 0.4,
  smoothness: 0.08,
  spill: 0.35,
  lightWrap: 0.15,
};

const VERT = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

const FRAG = `
  precision mediump float;
  uniform sampler2D u_video;
  uniform vec3 u_keyColor;
  uniform float u_similarity;
  uniform float u_smoothness;
  uniform float u_spill;
  uniform float u_lightWrap;
  varying vec2 v_texCoord;

  void main() {
    vec4 color = texture2D(u_video, v_texCoord);
    vec3 keyNorm = u_keyColor / 255.0;
    float diff = length(color.rgb - keyNorm);
    float alpha = smoothstep(u_similarity, u_similarity + u_smoothness, diff);

    float spillMask = 1.0 - smoothstep(0.0, u_spill, color.g - max(color.r, color.b));
    vec3 despilled = color.rgb;
    despilled.g = min(despilled.g, max(despilled.r, despilled.b) + 0.05);

    vec3 wrapped = mix(despilled, keyNorm, (1.0 - alpha) * u_lightWrap);
    gl_FragColor = vec4(wrapped, alpha);
  }
`;

/** Real-time GPU chroma key processor — outputs keyed RGBA to a canvas. */
export class ChromaKeyProcessor {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private video: HTMLVideoElement;
  private outputCanvas: HTMLCanvasElement;
  private rafId = 0;
  private settings: ChromaKeySettings = { ...DEFAULT_KEY_SETTINGS };

  constructor(video: HTMLVideoElement, outputCanvas: HTMLCanvasElement) {
    const gl = outputCanvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) throw new Error('WebGL not available');
    this.gl = gl;
    this.video = video;
    this.outputCanvas = outputCanvas;

    const vs = this.compileShader(gl.VERTEX_SHADER, VERT);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Chroma key shader link failed');
    }
    this.program = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]),
      gl.STATIC_DRAW,
    );

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.texture = tex;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    return shader;
  }

  updateSettings(settings: Partial<ChromaKeySettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  start() {
    const tick = () => {
      this.renderFrame();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  getOutputStream(fps = 30): MediaStream {
    return this.outputCanvas.captureStream(fps);
  }

  private renderFrame() {
    const { gl, video, settings } = this;
    if (video.readyState < 2) return;

    if (this.outputCanvas.width !== video.videoWidth || this.outputCanvas.height !== video.videoHeight) {
      this.outputCanvas.width = video.videoWidth || 1280;
      this.outputCanvas.height = video.videoHeight || 720;
      gl.viewport(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    }

    gl.useProgram(this.program);

    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    const texLoc = gl.getAttribLocation(this.program, 'a_texCoord');
    gl.enableVertexAttribArray(posLoc);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    gl.uniform1i(gl.getUniformLocation(this.program, 'u_video'), 0);
    gl.uniform3f(
      gl.getUniformLocation(this.program, 'u_keyColor'),
      settings.keyColor.r,
      settings.keyColor.g,
      settings.keyColor.b,
    );
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_similarity'), settings.similarity);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_smoothness'), settings.smoothness);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_spill'), settings.spill);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_lightWrap'), settings.lightWrap);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.stop();
    this.gl.deleteProgram(this.program);
    this.gl.deleteTexture(this.texture);
  }
}
