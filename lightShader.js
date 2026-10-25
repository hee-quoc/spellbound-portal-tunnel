const lightingVertShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;

varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vPosition;

void main() {
  vTexCoord = aTexCoord;
  vNormal = normalize(uNormalMatrix * aNormal);
  
  vec4 worldPosition = uModelViewMatrix * vec4(aPosition, 1.0);
  vPosition = worldPosition.xyz;
  
  gl_Position = uProjectionMatrix * worldPosition;
}
`;

// ライティング対応のフラグメントシェーダー
const lightingFragShader = `
#ifdef GL_ES
precision highp float;
#endif

varying vec3 vNormal;
varying vec2 vTexCoord;
varying vec3 vPosition;

uniform float uTime;
uniform float uGradientType;
uniform float uAnimationType;
uniform float uSpeed;
uniform float uAngle;
uniform float uScale;
uniform float uStripeWidth;
uniform float uStripeCount;
uniform int uColorCount;

// ライト情報 (renamed: p5 overwrites uAmbientColor / uDirectionalColor / uLightDirection with its own lights)
uniform vec3 uSbAmbient;
uniform vec3 uSbDirectional;
uniform vec3 uSbLightDir;

// 透明度
uniform float uAlpha;

// Spellbound additions
uniform float uSteps;      // 0 = smooth gradient, 2+ = flat poster bands (brand two-tone look)
uniform float uTwist;      // how much vortex stripes wind along the tube
uniform vec3  uFogColor;   // depth fog fades walls into the background
uniform float uFogAmount;
uniform float uFogNear;
uniform float uFogFar;

// Brush texture (brush.js geometry: uv.x along the stroke, uv.y across; walls carry uv.x + 2)
uniform float uBristles;   // number of bristle lanes across the stroke (0 = solid)
uniform float uDry;        // 0..1 bristles run dry and break up toward the stroke end
uniform float uRough;      // 0..1 ragged edges
uniform float uStreak;     // 0..1 light/dark lanes along each bristle
uniform float uReveal;     // 0..1 how much of the stroke is painted (paint-on)
uniform float uSeed;
uniform float uWallShade;
uniform sampler2D uMask;   // uploaded brush tip (alpha = paint)
uniform float uMaskOn;
uniform float uFade;       // portal opening: 0 = background colour, 1 = full paint  // walls of an extruded stroke are darker, so they read as the stroke's thickness

float bh(float n) { return fract(sin(n * 91.345 + uSeed * 7.13) * 47453.5453); }
float bnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = bh(i.x + i.y * 57.0), b = bh(i.x + 1.0 + i.y * 57.0), c = bh(i.x + (i.y + 1.0) * 57.0), d = bh(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 最大16色まで対応
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
uniform vec3 uColor8;
uniform vec3 uColor9;
uniform vec3 uColor10;
uniform vec3 uColor11;
uniform vec3 uColor12;
uniform vec3 uColor13;
uniform vec3 uColor14;
uniform vec3 uColor15;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 getColorAt(float position) {
  if (uColorCount <= 1) return uColor0;
  
  position = clamp(position, 0.0, 1.0);
  float scaledPos = position * float(uColorCount - 1);
  int index = int(floor(scaledPos));
  float fraction = fract(scaledPos);
  
  vec3 color1, color2;
  
  // インデックスに基づいて色を選択
  if (index == 0) {
    color1 = uColor0;
    color2 = uColor1;
  } else if (index == 1) {
    color1 = uColor1;
    color2 = (uColorCount > 2) ? uColor2 : uColor1;
  } else if (index == 2) {
    color1 = uColor2;
    color2 = (uColorCount > 3) ? uColor3 : uColor2;
  } else if (index == 3) {
    color1 = uColor3;
    color2 = (uColorCount > 4) ? uColor4 : uColor3;
  } else if (index == 4) {
    color1 = uColor4;
    color2 = (uColorCount > 5) ? uColor5 : uColor4;
  } else if (index == 5) {
    color1 = uColor5;
    color2 = (uColorCount > 6) ? uColor6 : uColor5;
  } else if (index == 6) {
    color1 = uColor6;
    color2 = (uColorCount > 7) ? uColor7 : uColor6;
  } else if (index == 7) {
    color1 = uColor7;
    color2 = (uColorCount > 8) ? uColor8 : uColor7;
  } else if (index == 8) {
    color1 = uColor8;
    color2 = (uColorCount > 9) ? uColor9 : uColor8;
  } else if (index == 9) {
    color1 = uColor9;
    color2 = (uColorCount > 10) ? uColor10 : uColor9;
  } else if (index == 10) {
    color1 = uColor10;
    color2 = (uColorCount > 11) ? uColor11 : uColor10;
  } else if (index == 11) {
    color1 = uColor11;
    color2 = (uColorCount > 12) ? uColor12 : uColor11;
  } else if (index == 12) {
    color1 = uColor12;
    color2 = (uColorCount > 13) ? uColor13 : uColor12;
  } else if (index == 13) {
    color1 = uColor13;
    color2 = (uColorCount > 14) ? uColor14 : uColor13;
  } else if (index == 14) {
    color1 = uColor14;
    color2 = (uColorCount > 15) ? uColor15 : uColor14;
  } else {
    color1 = uColor15;
    color2 = uColor15;
  }
  return mix(color1, color2, fraction);
}

void main() {
  vec2 tc = vTexCoord;
  float isWall = step(1.5, tc.x);
  tc.x -= 2.0 * isWall;

  // ---- brush texture: decide which fragments get paint
  if (tc.x > uReveal) discard;
  float lane = 0.0;
  if (uBristles > 0.5) {
    lane = floor(clamp(tc.y, 0.0, 0.9999) * uBristles);
    float bl = bh(lane);
    // dry brush: each bristle runs out of paint at its own point near the end
    float runOut = 1.0 - uDry * (0.15 + 0.85 * bl) * 0.9;
    if (tc.x > runOut) discard;
    // dry brush: skips inside the stroke, longer toward the end
    float skip = bnoise(vec2(lane * 3.7, tc.x * 38.0));
    if (skip < uDry * 0.55 * smoothstep(0.0, 1.0, tc.x + 0.25)) discard;
  }
  if (uMaskOn > 0.5) {
    // keep the uploaded artwork's exact silhouette; rough edges jitter the lookup instead of eating the rectangle edge
    vec2 mu = vec2(tc.x, 1.0 - tc.y);
    if (uRough > 0.0) mu += (vec2(bnoise(tc * 140.0), bnoise(tc * 140.0 + 31.0)) - 0.5) * uRough * 0.012;
    if (texture2D(uMask, mu).a < 0.5) discard;
  } else if (uRough > 0.0 && isWall < 0.5) {
    float edge = min(tc.y, 1.0 - tc.y);
    float rag = bnoise(vec2(tc.x * 90.0, step(0.5, tc.y) * 13.0)) * 0.6 + bnoise(vec2(tc.x * 260.0, 5.0 + step(0.5, tc.y) * 13.0)) * 0.4;
    if (edge < uRough * 0.22 * rag) discard;
  }

  vec2 st = (tc - 0.5) * uScale;
  float t = uTime;
  float mixValue = 0.0;
  
  // グラデーションタイプ
  if (uGradientType == 0.0) { // Linear
    vec2 rotated = rotate2d(uAngle) * st;
    mixValue = rotated.x + 0.5;
  }
  else if (uGradientType == 1.0) { // Radial
    mixValue = 1.0 - length(st);
  }
  else if (uGradientType == 2.0) { // Stripe
    vec3 normal = normalize(vec3(st.x, st.y, sqrt(1.0 - dot(st, st))));
    float lat = normal.y;
    float normalizedLat = (lat + 1.0) * 0.5;
    mixValue = mod(normalizedLat * uStripeCount, 1.0) < uStripeWidth ? 1.0 : 0.0;
  }
  else if (uGradientType == 3.0) { // Checker
    float checkerSize = 0.1;
    vec2 checker = floor(st / checkerSize);
    mixValue = mod(checker.x + checker.y, 2.0);
  }
  else if (uGradientType == 4.0) { // Conic
    mixValue = (atan(st.y, st.x) + PI) / TWO_PI;
  }
  else if (uGradientType == 5.0) { // Diamond
    mixValue = 1.0 - (abs(st.x) + abs(st.y));
  }
  else if (uGradientType == 6.0) { // Spiral
    float r = length(st);
    float a = atan(st.y, st.x);
    mixValue = 1.0 - mod(r + a / TWO_PI, 1.0);
  }
  else if (uGradientType == 7.0) { // Star
    float a = atan(st.y, st.x);
    float r = length(st);
    float star = 0.5 + 0.5 * cos(5.0 * a);
    mixValue = 1.0 - (r / star);
  }
  else if (uGradientType == 8.0) { // Kaleidoscope
    float a = atan(st.y, st.x);
    float segments = 8.0;
    float segmentAngle = mod(a, TWO_PI / segments) * segments;
    mixValue = 1.0 - (sin(segmentAngle + length(st) * 5.0) * 0.5 + 0.5);
  }
  
  else if (uGradientType == 9.0) { // Vortex: stripes wound around the tube
    mixValue = fract(tc.x * uStripeCount + tc.y * uTwist);
    mixValue = abs(mixValue * 2.0 - 1.0);
  }
  else if (uGradientType == 10.0) { // Depth rings: bands along the tube length
    mixValue = fract(tc.y * uStripeCount * 0.5);
    mixValue = abs(mixValue * 2.0 - 1.0);
  }

  // アニメーション
  if (uSpeed > 0.0) {
    if (uAnimationType == 1.0) { // Move
      mixValue = mod(mixValue + t, 1.0);
    }
    else if (uAnimationType == 2.0) { // Rotate
      vec2 rotated = rotate2d(t) * st;
      if (uGradientType == 0.0) {
        mixValue = rotated.x + 0.5;
      } else if (uGradientType == 4.0) {
        mixValue = (atan(rotated.y, rotated.x) + PI) / TWO_PI;
      }
    }
    else if (uAnimationType == 3.0) { // Wave
      mixValue += sin(st.y * 10.0 + t * 3.0) * 0.1;
    }
    else if (uAnimationType == 4.0) { // Pulse
      float pulse = sin(t * 2.0) * 0.5 + 0.5;
      mixValue *= (0.5 + pulse * 0.5);
    }
    else if (uAnimationType == 5.0) { // Wave Pattern
      float wave = sin(mixValue * 3.0 + t * 2.0) * 0.5 + 0.5;
      mixValue = wave;
    }
    else if (uAnimationType == 6.0) { // Noise
      float n = noise(st * 5.0 + t);
      mixValue = mix(mixValue, n, 0.3);
    }
  }
  
  mixValue = clamp(mixValue, 0.0, 1.0);

  // Poster steps: flat colour bands instead of a smooth blend
  if (uSteps > 1.5) {
    mixValue = floor(mixValue * uSteps * 0.9999) / (uSteps - 1.0);
  }
  
  // ベース色を取得
  vec3 baseColor = getColorAt(mixValue);
  
  // ライティング処理
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uSbLightDir);
  
  // 環境光
  vec3 ambient = uSbAmbient * baseColor;
  
  // 拡散反射
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 diffuse = uSbDirectional * diff * baseColor;
  
  // 最終的な色を計算
  vec3 finalColor = ambient + diffuse;

  finalColor *= mix(1.0, uWallShade, isWall);

  // bristle streaks: light / dark lanes running along the stroke
  if (uBristles > 0.5 && uStreak > 0.0) {
    float sv = bh(lane + 17.0) * 0.7 + bnoise(vec2(lane * 1.3, tc.x * 6.0)) * 0.3;
    finalColor *= 1.0 - uStreak * 0.45 + uStreak * 0.45 * 2.0 * sv;
  }

  // Depth fog toward the background colour
  float depth = -vPosition.z;
  float fog = smoothstep(uFogNear, uFogFar, depth) * uFogAmount;
  finalColor = mix(finalColor, uFogColor, fog);
  finalColor = mix(uFogColor, finalColor, uFade);
  
  gl_FragColor = vec4(finalColor, uAlpha);
}
`;

// ライティング対応のGradientShaderクラス
class LightingGradientShader {
  constructor(colors = null) {
    // one compiled program shared by every element (the original compiled one per element)
    if (!LightingGradientShader.shared) LightingGradientShader.shared = createShader(lightingVertShader, lightingFragShader);
    this.shader = LightingGradientShader.shared;
    const defaultColors = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
      [1.0, 1.0, 0.0]
    ];
    this.config = {
      gradientType: 0,
      animationType: 0,
      speed: 0.0,
      angle: 0,
      scale: 1.0,
      stripeWidth: 0.2,
      stripeCount: 8.0,
      colors: colors || defaultColors,
      // ライティング設定
      ambientStrength: 0.1,
      diffuseStrength: 1.0,
      lightingEnabled: true,
      steps: 0,
      twist: 2.0,
      fogColor: [0, 0, 0],
      fogAmount: 0,
      fogNear: 600,
      fogFar: 6000,
      timeOffset: 0,
      bristles: 0, dry: 0, rough: 0, streak: 0, reveal: 1, seed: 0, wallShade: .6, mask: null, fade: 1
    };
  }
  
  apply() {
    shader(this.shader);
    this.updateUniforms();
  }
  
  updateUniforms() {
    const currentTime = (typeof window.sbTime === 'number') ? window.sbTime : millis() / 1000.0;
    this.shader.setUniform('uTime', currentTime * this.config.speed + this.config.timeOffset);
    this.shader.setUniform('uGradientType', this.config.gradientType);
    this.shader.setUniform('uAnimationType', this.config.animationType);
    this.shader.setUniform('uSpeed', this.config.speed);
    this.shader.setUniform('uAngle', this.config.angle);
    this.shader.setUniform('uScale', this.config.scale);
    this.shader.setUniform('uStripeWidth', this.config.stripeWidth);
    this.shader.setUniform('uStripeCount', this.config.stripeCount);
    this.shader.setUniform('uColorCount', this.config.colors.length);
    
    for (let i = 0; i < Math.min(16, this.config.colors.length); i++) {
      this.shader.setUniform(`uColor${i}`, this.config.colors[i]);
    }
    
    for (let i = this.config.colors.length; i < 16; i++) {
      this.shader.setUniform(`uColor${i}`, [0.0, 0.0, 0.0]);
    }
    
    this.shader.setUniform('uSbAmbient', [
      this.config.ambientStrength, 
      this.config.ambientStrength, 
      this.config.ambientStrength
    ]);
    this.shader.setUniform('uSbDirectional', [
      this.config.diffuseStrength, 
      this.config.diffuseStrength, 
      this.config.diffuseStrength
    ]);

    this.shader.setUniform('uSbLightDir', this.config.lightDirection || [0.5, -1.0, 0.5]);
    this.shader.setUniform('uAlpha', this.config.alpha || 1.0);
    this.shader.setUniform('uSteps', this.config.steps);
    this.shader.setUniform('uTwist', this.config.twist);
    this.shader.setUniform('uFogColor', this.config.fogColor);
    this.shader.setUniform('uFogAmount', this.config.fogAmount);
    this.shader.setUniform('uFogNear', this.config.fogNear);
    this.shader.setUniform('uFogFar', this.config.fogFar);
    this.shader.setUniform('uBristles', this.config.bristles);
    this.shader.setUniform('uDry', this.config.dry);
    this.shader.setUniform('uRough', this.config.rough);
    this.shader.setUniform('uStreak', this.config.streak);
    this.shader.setUniform('uReveal', this.config.reveal);
    this.shader.setUniform('uSeed', this.config.seed);
    this.shader.setUniform('uWallShade', this.config.wallShade);
    this.shader.setUniform('uMaskOn', this.config.mask ? 1 : 0);
    this.shader.setUniform('uFade', this.config.fade);
    if (this.config.mask) this.shader.setUniform('uMask', this.config.mask);
  }
  
  setGradientType(type) {
    this.config.gradientType = type;
  }
  
  setAnimationType(type) {
    this.config.animationType = type;
  }
  
  setColors(...colors) {
    if (Array.isArray(colors[0])) {
      this.config.colors = colors[0].map(color => {
        if (typeof color === 'string' && color.startsWith('#')) {
          const c = window.color(color);
          return [red(c) / 255, green(c) / 255, blue(c) / 255];
        }
        return color;
      });
    } else {
      this.config.colors = colors.map(color => {
        if (typeof color === 'string' && color.startsWith('#')) {
          const c = window.color(color);
          return [red(c) / 255, green(c) / 255, blue(c) / 255];
        }
        return color;
      });
    }
  }
  
  setColorsFromP5(...p5Colors) {
    this.config.colors = p5Colors.map(c => [
      red(c) / 255,
      green(c) / 255,
      blue(c) / 255
    ]);
  }
  
  setColorsFromPalette(palette) {
    this.config.colors = palette.colors.map(hexColor => {
      const c = color(hexColor);
      return [red(c) / 255, green(c) / 255, blue(c) / 255, alpha(c) / 255];
    });
  }
  
  setSpeed(speed) {
    this.config.speed = speed;
  }
  
  setAngle(angle) {
    this.config.angle = angle;
  }
  
  setScale(scale) {
    this.config.scale = scale;
  }

  setStripeWidth(width) {
    this.config.stripeWidth = width;
  }
  
  setStripeCount(count) {
    this.config.stripeCount = count;
  }

  setRandomSpeed(min = -10, max = 10) {
    this.config.speed = random(min, max);
  }

  setLightingMode(enabled) {
    this.config.lightingEnabled = enabled;
  }
  
  setAmbientStrength(strength) {
    this.config.ambientStrength = strength;
  }
  
  setDiffuseStrength(strength) {
    this.config.diffuseStrength = strength;
  }
  
  setAlpha(alpha) {
    this.config.alpha = alpha;
  }

  setNormal(normalX, normalY, normalZ) {
    this.config.normalX = normalX;
    this.config.normalY = normalY;
    this.config.normalZ = normalZ;
  }
}