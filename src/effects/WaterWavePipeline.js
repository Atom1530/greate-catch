// Лёгкий water/wave pipeline для Phaser 3 (WebGL) с режимом «полосы-гармошка».
// Совместим с set1f/set2f/setFloat*.
import Phaser from "phaser";

export class WaterWavePipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game) {
    super({
      game,
      fragShader: `
      precision mediump float;

      uniform sampler2D uMainSampler;
      varying vec2 outTexCoord;

      uniform vec2  uResolution;   // (W, H)
      uniform float uTime;         // сек

      // Классическая волна по Y (можно поставить amp=0, чтобы выключить)
      uniform float uAmp;          // px
      uniform float uWaveLen;      // px
      uniform float uSpeed;        // px/сек

      // Новый режим: вертикальные полосы, соседние двигаются навстречу
      uniform float uStripeCount;  // сколько полос по ширине (например 30)
      uniform float uStripeAmp;    // амплитуда сдвига в px (2..3 смотрится мягко)
      uniform float uStripeSpeed;  // скорость «захлоп/расхлоп» (рад/сек)

      // 0 = только волна, 1 = только полосы, 2 = смешать оба
      uniform float uMode;

      // helper: плавная маска к центру полосы, чтобы не было швов на стыках
      float centerMask(float x01) {
        // x01 в [0..1] внутри полосы; 1 в центре, 0 у краёв
        return 0.5 + 0.5 * cos( (x01 - 0.5) * 3.14159265 * 2.0 );
      }

      void main() {
        vec2 uv = outTexCoord;
        vec2 px = uv * uResolution;

        float offsetX = 0.0;

        // --- Базовая волна (по желанию) ---
        if (uMode < 0.5 || uMode > 1.5) { // 0 или 2
          float w1 = sin((px.y + uSpeed * uTime) / max(1.0, uWaveLen));
          float w2 = 0.5 * sin((px.y * 1.7 - uSpeed * 1.3 * uTime) / max(1.0, uWaveLen * 0.6));
          float wave = w1 + w2;
          offsetX += (uAmp * wave) / uResolution.x;
        }

        // --- Полосы «гармошка» ---
        if (uMode > 0.5) { // 1 или 2
          float N = max(1.0, uStripeCount);
          float step = uResolution.x / N;           // ширина полосы в px
          float idx  = floor(px.x / step);          // индекс полосы
          float odd  = mod(idx, 2.0) * 2.0 - 1.0;   // -1, +1 чередование

          float osc  = sin(uTime * uStripeSpeed);   // туда ↔ сюда
          float local= fract(px.x / step);          // 0..1 в пределах полосы
          float mask = centerMask(local);           // 1 в центре, 0 у края

          float stripe = odd * osc * mask * (uStripeAmp / uResolution.x);
          offsetX += stripe;
        }

        vec2 uv2 = vec2(uv.x + offsetX, uv.y);
        gl_FragColor = texture2D(uMainSampler, uv2);
      }
      `
    });
  }
}
export default WaterWavePipeline;
