export const VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMass;
uniform float uDisk;
uniform float uSpin;
uniform float uBloom;
uniform float uQuality;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

vec3 starField(vec3 dir) {
  float n = noise(dir * 80.0);
  float stars = pow(max(n - 0.72, 0.0) / 0.28, 14.0);
  float warm = hash(dir * 40.0);
  vec3 tint = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.85, 0.65), warm);
  float milky = pow(noise(dir * 3.0 + 2.0), 2.5) * 0.08;
  return tint * stars * 1.4 + vec3(0.04, 0.05, 0.08) * milky;
}

mat3 lookAt(vec3 eye, vec3 target) {
  vec3 f = normalize(target - eye);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  return mat3(r, u, f);
}

vec3 diskColor(float r, float angle, float vz) {
  float heat = clamp(2.2 / (r * 0.55 + 0.35), 0.0, 3.5);
  vec3 cool = vec3(0.15, 0.35, 0.95);
  vec3 mid = vec3(0.95, 0.45, 0.12);
  vec3 hot = vec3(1.0, 0.92, 0.75);
  vec3 col = mix(cool, mid, smoothstep(0.4, 1.6, heat));
  col = mix(col, hot, smoothstep(1.4, 2.8, heat));

  float spiral = sin(angle * 3.0 - log(r + 0.2) * 6.0 + uTime * (1.2 + uSpin * 2.0));
  float turbulence = noise(vec3(r * 2.0, angle * 1.5, uTime * 0.35));
  float structure = 0.55 + 0.45 * spiral * turbulence;

  // Doppler / beaming: approaching side brighter & cooler, receding warmer
  float beam = 1.0 + vz * 0.85 * uSpin;
  col *= structure * heat * beam;
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime;

  float az = uMouse.x * 3.2 + 0.35;
  float el = mix(-0.15, 1.15, uMouse.y * 0.5 + 0.5);
  float dist = mix(14.0, 7.5, clamp(uMass / 2.2, 0.0, 1.0));

  vec3 eye = vec3(
    dist * cos(el) * sin(az),
    dist * sin(el) + 0.8,
    dist * cos(el) * cos(az)
  );
  mat3 cam = lookAt(eye, vec3(0.0));
  vec3 rd = normalize(cam * vec3(uv, 1.35));

  float mass = 0.55 + uMass * 0.55;
  float horizon = mass * 0.92;
  float photon = horizon * 1.55;

  vec3 pos = eye;
  vec3 dir = rd;
  vec3 color = vec3(0.0);
  float transmittance = 1.0;

  int steps = int(mix(48.0, 96.0, uQuality));
  float stepSize = mix(0.22, 0.12, uQuality);

  bool swallowed = false;
  float closest = 1e5;

  for (int i = 0; i < 96; i++) {
    if (i >= steps) break;

    float r = length(pos);
    closest = min(closest, r);

    if (r < horizon) {
      swallowed = true;
      break;
    }
    if (r > 42.0) break;

    // Soft GR-inspired deflection
    float soft = r * r + 0.08;
    vec3 accel = -mass * pos / (soft * sqrt(soft));
    // Frame dragging from spin
    vec3 spinPull = uSpin * 0.35 * vec3(-pos.z, 0.0, pos.x) / (soft + 0.5);
    dir = normalize(dir + (accel + spinPull) * stepSize);
    vec3 next = pos + dir * stepSize;

    // Accretion disk (thin plane y≈0)
    if ((pos.y > 0.0) != (next.y > 0.0) && r > horizon * 1.35 && r < 9.5) {
      float f = pos.y / (pos.y - next.y);
      vec3 hit = mix(pos, next, f);
      float hr = length(hit.xz);
      if (hr > horizon * 1.4 && hr < 9.0) {
        float angle = atan(hit.z, hit.x);
        vec3 tang = normalize(vec3(-hit.z, 0.0, hit.x));
        float vz = dot(normalize(dir), tang);
        float dens = smoothstep(9.0, 3.5, hr) * smoothstep(horizon * 1.3, horizon * 2.2, hr);
        dens *= uDisk;
        vec3 emit = diskColor(hr, angle, vz) * dens * 1.8;
        color += transmittance * emit;
        transmittance *= 1.0 - dens * 0.55;
      }
    }

    // Volumetric corona near photon sphere
    float corona = exp(-abs(r - photon) * 3.5) * 0.015 * uDisk;
    color += transmittance * corona * vec3(1.0, 0.55, 0.25);

    pos = next;
  }

  if (!swallowed) {
    color += transmittance * starField(dir);
  } else {
    // Soft swallow — faint photon ring bleed
    float ring = exp(-abs(closest - photon) * 8.0);
    color += ring * 0.35 * vec3(1.0, 0.7, 0.35) * uDisk;
  }

  // Photon ring highlight from closest approach
  float pr = exp(-abs(closest - photon) * 6.0) * 0.4;
  color += pr * vec3(0.55, 0.85, 1.0) * (0.4 + 0.6 * uDisk);

  // Cheap bloom
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color += color * lum * uBloom * 0.55;

  // Vignette + film
  float vig = 1.0 - 0.35 * dot(uv, uv);
  color *= vig;
  color += (hash(vec3(gl_FragCoord.xy, t)) - 0.5) * 0.02;

  // Tone map
  color = color / (1.0 + color * 0.65);
  color = pow(max(color, 0.0), vec3(0.92));

  fragColor = vec4(color, 1.0);
}`
