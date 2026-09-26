/**
 * WebGPU type compatibility shims.
 *
 * `@babylonjs/core/Engines/engine.d.ts` declares the WebGPU surface as
 * `class`es inside `declare global`, while TypeScript's `lib.dom` declares the
 * same names as `interface`s. The two describe the same runtime objects but
 * TS treats them as distinct brands (their `label` and `lost` members disagree
 * on optionality), so a value typed by one cannot be passed where the other is
 * expected — even though it is the identical object.
 *
 * These helpers are the single documented place where we cross that boundary.
 * They are pure type-level: no runtime work, no `any`, and every call site is
 * an explicit acknowledgement that the two declaration sets are the same shape.
 *
 * They return `never` on purpose: because the duplicate declarations are only
 * hidden by `skipLibCheck`, the bare names (`GPUBindGroupLayout`, `GPUAdapter`,
 * `GPUDevice`) do not reliably resolve to the same brand in every file. `never`
 * is assignable to either brand, so one helper serves every consumer.
 */

/** Cross from Babylon-branded to lib.dom-branded bind group layout. */
export function asBindGroupLayout(layout: unknown): never {
  return layout as never;
}

/** Cross from Babylon-branded to lib.dom-branded adapter. */
export function asAdapter(adapter: unknown): never {
  return adapter as never;
}

/** Cross from Babylon-branded to lib.dom-branded device. */
export function asDevice(device: unknown): never {
  return device as never;
}
