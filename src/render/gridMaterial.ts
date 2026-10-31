import { Color, ShaderMaterial, Vector3 } from 'three'

/**
 * The ground's material. Draws a plain lit ground and, when showGrid is 1,
 * the lines between cells as a pattern on the graphics card, so a million
 * cells cost no more to draw than ten.
 *
 * Lines fade out where cells get smaller than a few pixels on screen (far
 * away, or tiny cells), instead of piling up into a grey blur.
 */
export function makeGridMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      groundColor: { value: new Color('#7a8b52') },
      lineColor: { value: new Color('#ffffff') },
      cellSize: { value: 1 },
      showGrid: { value: 1 },
      sunDir: { value: new Vector3(300, 500, 200).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 groundColor;
      uniform vec3 lineColor;
      uniform float cellSize;
      uniform float showGrid;
      uniform vec3 sunDir;
      varying vec3 vWorld;

      void main() {
        float light = 0.55 + 0.45 * max(sunDir.y, 0.0); // flat ground faces up
        vec3 color = groundColor * light;

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
