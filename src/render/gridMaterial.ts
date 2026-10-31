import { Color, DoubleSide, type IUniform, ShaderMaterial, Vector3 } from 'three'

/** Uniforms every ground chunk shares, so one change reaches them all. */
export type SharedGroundUniforms = {
  cellSize: IUniform<number>
  showGrid: IUniform<number>
  /** How strongly the LoD debug tint shows (0 = off). */
  tintAmount: IUniform<number>
  /** The ground pattern (View → Show grid): 1 on, 0 off. */
  pattern: IUniform<number>
  /** Metres between the pattern's lines. */
  patternSpacing: IUniform<number>
}

export function makeSharedGroundUniforms(): SharedGroundUniforms {
  return {
    cellSize: { value: 1 },
    showGrid: { value: 1 },
    tintAmount: { value: 0 },
    pattern: { value: 1 },
    patternSpacing: { value: 10 },
  }
}

/**
 * The ground's material. Draws lit ground and, when showGrid is 1, the lines
 * between cells as a pattern on the graphics card, so a million cells cost no
 * more to draw than ten. `tint` colours the ground for the LoD debug view.
 *
 * Lines fade out where cells get smaller than a few pixels on screen (far
 * away, or tiny cells), instead of piling up into a grey blur.
 */
export function makeGridMaterial(shared: SharedGroundUniforms, tint: Color): ShaderMaterial {
  return new ShaderMaterial({
    side: DoubleSide, // skirts may face either way
    uniforms: {
      ...shared,
      groundColor: { value: new Color('#7a8b52') },
      lineColor: { value: new Color('#ffffff') },
      sunDir: { value: new Vector3(300, 500, 200).normalize() },
      tint: { value: tint },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normal;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 groundColor;
      uniform vec3 lineColor;
      uniform float cellSize;
      uniform float showGrid;
      uniform vec3 sunDir;
      uniform vec3 tint;
      uniform float tintAmount;
      uniform float pattern;
      uniform float patternSpacing;
      varying vec3 vWorld;
      varying vec3 vNormal;

      void main() {
        // Slopes facing away from the sun go noticeably darker, so hills read.
        float light = 0.4 + 0.7 * max(dot(normalize(vNormal), sunDir), 0.0);
        vec3 color = mix(groundColor, tint, tintAmount);

        if (pattern > 0.5) {
          // The ground pattern: a faint checker plus dark lines every
          // patternSpacing metres, painted onto the surface so it bends over
          // hills. Fades out where squares get too small on screen.
          vec2 coord = vWorld.xz / patternSpacing;
          vec2 perPixel = fwidth(coord);
          float crowding = 1.0 - smoothstep(0.08, 0.3, max(perPixel.x, perPixel.y));
          vec2 square = floor(coord);
          float checker = mod(square.x + square.y, 2.0);
          color *= 1.0 - 0.06 * checker * crowding;
          vec2 fromLine = abs(fract(coord - 0.5) - 0.5) / perPixel;
          float line = 1.0 - min(min(fromLine.x, fromLine.y) / 1.5, 1.0);
          color *= 1.0 - 0.35 * line * crowding;
        }
        color *= light;

        if (showGrid > 0.5) {
          vec2 coord = vWorld.xz / cellSize;
          vec2 perPixel = fwidth(coord);           // cells per screen pixel
          vec2 fromLine = abs(fract(coord - 0.5) - 0.5) / perPixel;
          float line = 1.0 - min(min(fromLine.x, fromLine.y), 1.0);
          // Fully drawn while cells are 10+ px wide, gone by 3 px.
          float crowding = 1.0 - smoothstep(0.1, 0.33, max(perPixel.x, perPixel.y));
          color = mix(color, lineColor, line * crowding * 0.6);
        }

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}
