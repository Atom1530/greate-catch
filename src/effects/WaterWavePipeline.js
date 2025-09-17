// // Лёгкий water/wave pipeline для Phaser 3 (WebGL).
// // Совместим с билдами, где у pipeline есть set1f/set2f/set4f или setFloat*.

// export class WaterWavePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
//   constructor(game) {
//     super({
//       game,
//       fragShader: `
//       precision mediump float;

//       uniform sampler2D uMainSampler;
//       varying vec2 outTexCoord;

//       uniform vec2  uResolution;  // (W, H)
//       uniform float uTime;        // сек
//       uniform float uAmp;         // амплитуда px
//       uniform float uWaveLen;     // длина волны px
//       uniform float uSpeed;       // скорость px/сек

//       void main() {
//         vec2 uv = outTexCoord;
//         vec2 px = uv * uResolution;

//         // две гармоники для «живости»
//         float w1 = sin((px.y + uSpeed * uTime) / uWaveLen);
//         float w2 = 0.5 * sin((px.y * 1.7 - uSpeed * 1.3 * uTime) / (uWaveLen * 0.6));
//         float wave = w1 + w2;

//         // смещение по X в uv-координатах
//         float offset = (uAmp * wave) / uResolution.x;
//         vec2 uvDistorted = vec2(uv.x + offset, uv.y);

//         gl_FragColor = texture2D(uMainSampler, uvDistorted);
//       }
//       `
//     });
//   }
// }
// export default WaterWavePipeline;
