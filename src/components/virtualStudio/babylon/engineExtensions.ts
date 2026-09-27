/**
 * Babylon 8 ships engine capabilities as opt-in prototype extensions so the
 * core stays tree-shakeable. The WebGL2 path is self-registering (each class
 * module imports its `Engines/Extensions/*` patch), but the WebGPUEngine
 * patches in `Engines/WebGPU/Extensions/*` are NOT — without them the engine
 * is missing methods mid-boot (`createDynamicTexture is not a function`) and
 * the whole stage fails on any WebGPU-capable browser.
 *
 * Importing this module once registers every engine capability the Regal
 * Prism Babylon stage uses — dynamic textures (screens, talent plate,
 * procedural maps), video, HDR cube loading, render targets (shadow maps and
 * post pipelines) and raw/read texture paths — plus the scene components
 * those features require, for BOTH backends, so the stage boots identically
 * wherever WebGPU or WebGL2 is available.
 */
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.cubeTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.multiRender';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.rawTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.readTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTarget';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetCube';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetTexture';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.videoTexture';
// Scene-component registrations — same opt-in pattern as the engine patches:
// shadow maps, post-process pipelines (Default + SSAO2), the pre-pass renderer
// and depth-of-field's depth renderer each register through a side-effect.
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/core/Rendering/prePassRendererSceneComponent';

export {};
