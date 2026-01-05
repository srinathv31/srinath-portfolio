"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

// Sky particle data structure
interface SkyParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
}

// Spatial hash for efficient neighbor detection (sky connections)
class SpatialHash {
  private cellSize: number;
  private grid: Map<string, number[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  clear() {
    this.grid.clear();
  }

  insert(index: number, x: number, y: number) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const key = `${cx},${cy}`;
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(index);
  }

  getPotentialNeighbors(x: number, y: number): number[] {
    const neighbors: number[] = [];
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
          neighbors.push(...cell);
        }
      }
    }
    return neighbors;
  }
}

export default function SkyAndSea() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ========= Configuration =========
    const isMobile = window.innerWidth < 768;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const HORIZON_Y = 0.35; // 35% from top - more sea visible

    const config = {
      // Sky configuration
      skyParticleCount: prefersReducedMotion ? 40 : isMobile ? 50 : 80,
      connectionDistance: isMobile ? 0.15 : 0.12,
      maxConnections: isMobile ? 800 : 1500,
      skyPointSize: prefersReducedMotion ? 3 : 4,
      skyDriftSpeed: prefersReducedMotion ? 0.00003 : 0.00006,
      skyMouseRadius: 0.2,
      skyMouseStrength: 0.00015,
      // Sea configuration
      seaSpacing: isMobile ? 20 : 26,
      seaPointSize: prefersReducedMotion ? 3.2 : 4.0,
      seaMouseRadius: 0.12,
      // Horizon
      horizonY: HORIZON_Y,
    };

    // ========= WebGL Setup =========
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const gl = canvas.getContext("webgl", {
      antialias: false,
      depth: false,
      stencil: false,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    // ========= Shaders =========

    // --- Sky Particle Shaders ---
    const skyParticleVert = `
      precision mediump float;
      attribute vec2 aPosition;
      attribute float aAlpha;
      uniform float uTime;
      uniform float uPointSize;
      uniform float uDPR;
      uniform float uHorizonY;
      varying float vAlpha;
      varying float vGlow;

      void main() {
        vec2 clipPos = aPosition * 2.0 - 1.0;
        float pulse = 1.0 + 0.15 * sin(uTime * 0.6 + aPosition.x * 6.28 + aPosition.y * 3.14);

        // Fade as approaching horizon
        float horizonFade = smoothstep(uHorizonY, uHorizonY - 0.15, aPosition.y);

        vAlpha = aAlpha * horizonFade;
        vGlow = pulse;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        gl_PointSize = uPointSize * pulse * uDPR * horizonFade;
      }
    `;

    const skyParticleFrag = `
      precision mediump float;
      uniform vec3 uParticleColor;
      varying float vAlpha;
      varying float vGlow;

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        float alpha = 1.0 - smoothstep(0.2, 1.0, r);
        float core = exp(-r * r * 2.5);
        vec3 color = uParticleColor * (0.6 + 0.4 * vGlow);
        color += uParticleColor * core * 0.5;
        gl_FragColor = vec4(color, alpha * vAlpha * 0.9);
      }
    `;

    // --- Sky Line Shaders ---
    const skyLineVert = `
      precision mediump float;
      attribute vec2 aLinePos;
      attribute float aLineAlpha;
      varying float vLineAlpha;

      void main() {
        vec2 clipPos = aLinePos * 2.0 - 1.0;
        vLineAlpha = aLineAlpha;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
      }
    `;

    const skyLineFrag = `
      precision mediump float;
      uniform vec3 uLineColor;
      varying float vLineAlpha;

      void main() {
        gl_FragColor = vec4(uLineColor * 0.8, vLineAlpha * 0.3);
      }
    `;

    // --- Sea Particle Shaders ---
    const seaVert = `
      precision mediump float;
      attribute vec2 aPos;
      uniform vec2 uRes;
      uniform float uTime;
      uniform float uAmp;
      uniform float uPix;
      uniform float uFreqX;
      uniform float uFreqY;
      uniform float uSpeed;
      uniform vec2 uScroll;
      uniform float uTileW;
      uniform float uTileD;
      uniform float uCamH;
      uniform float uPitch;
      uniform float uFov;
      uniform float uAspect;
      uniform float uZPush;
      uniform vec2 uMouse;
      uniform float uMouseActive;
      uniform float uMouseRadius;
      uniform float uHorizonY;

      const int MAX_R = 6;
      uniform int uRCnt;
      uniform vec4 uRip[MAX_R];

      varying float vGlow;
      varying float vDepth;

      vec2 rot2(vec2 p, float a) {
        float s = sin(a), c = cos(a);
        return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      }

      void main() {
        float tx = aPos.x + uScroll.x;
        float tz = aPos.y + uScroll.y;
        vec2 t = fract(vec2(tx, tz));
        float X = (t.x - 0.5) * uTileW;
        float Z = t.y * uTileD;

        float phase = uTime * uSpeed;
        float w = sin(t.x * uFreqX + phase) * 0.7 + cos(t.y * uFreqY + phase * 0.9) * 0.3;

        float mouseEffect = 0.0;
        float mouseSizeBoost = 0.0;
        if (uMouseActive > 0.5) {
          vec2 particlePos = t;
          vec2 mousePos = uMouse;
          vec2 delta = particlePos - mousePos;
          delta = abs(fract(delta + 0.5) - 0.5);
          float mouseDist = length(delta);
          float influence = 1.0 - smoothstep(0.0, uMouseRadius, mouseDist);
          mouseEffect = influence * 0.8;
          mouseSizeBoost = influence * 1.2;
        }

        float extra = 0.0;
        float sizeBoost = 0.0;
        for (int i = 0; i < MAX_R; i++) {
          if (i >= uRCnt) break;
          vec2 c = uRip[i].xy;
          vec2 ripplePos = c + uScroll;
          vec2 delta = vec2(tx, tz) - ripplePos;
          delta = abs(fract(delta + 0.5) - 0.5);
          float d = length(delta);
          float t0 = uRip[i].z;
          float life = uRip[i].w;
          float tt = max(uTime - t0, 0.0);
          float prog = clamp(tt / life, 0.0, 1.0);
          float radius = prog * 0.6;
          float ring = 1.0 - smoothstep(radius - 0.02, radius + 0.02, d);
          extra += ring * (1.0 - prog);
          sizeBoost += ring * (1.0 - prog);
        }

        float Y = (w * uAmp) + extra * (uAmp * 0.9) + mouseEffect * (uAmp * 1.0);

        float cx = X;
        float cy = Y - uCamH;
        float cz = Z;
        vec2 ryz = rot2(vec2(cy, cz), uPitch);
        float y2 = ryz.x;
        float z2 = ryz.y + uZPush;

        float f = 1.0 / tan(uFov * 0.5);
        float ndcX = (cx * f / uAspect) / max(z2, 0.1);
        float ndcY = (y2 * f) / max(z2, 0.1);
        float ndcZ = clamp(z2 / 5000.0, -1.0, 1.0);

        vDepth = z2;
        vGlow = clamp(0.25 + 0.55 * abs(w) + 0.9 * extra + 0.8 * mouseEffect, 0.0, 1.8);

        // Map sea to lower portion of screen (below horizon)
        // horizonY is 0.35 meaning horizon is at 35% from top
        // In clip space: top = 1, bottom = -1
        // Horizon in clip space = 1 - 2*horizonY = 0.3
        // Sea needs to fill from horizonClip down to -1
        float horizonClip = 1.0 - 2.0 * uHorizonY;
        float seaHeight = horizonClip - (-1.0); // = horizonClip + 1

        // Scale ndcY to fit in sea region and offset to start at horizon
        float scaledY = ndcY * seaHeight * 0.5 + (horizonClip - seaHeight * 0.5);

        gl_Position = vec4(-ndcX, scaledY, ndcZ, 1.0);

        float distScale = clamp(800.0 / (50.0 + z2), 0.3, 2.5);
        gl_PointSize = max(1.0, uPix * (1.0 + 0.6 * abs(w) + 0.9 * sizeBoost + mouseSizeBoost) * distScale);
      }
    `;

    const seaFrag = `
      precision mediump float;
      varying float vGlow;
      varying float vDepth;
      uniform vec3 uColor;

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        float alpha = 1.0 - smoothstep(0.0, 1.0, r);
        float fog = clamp(exp(-vDepth * 0.0008), 0.05, 1.0);
        vec3 base = uColor * (0.55 + 0.7 * vGlow) * fog;
        gl_FragColor = vec4(base, alpha * (0.85 * fog));
      }
    `;

    // --- Horizon Glow Shaders ---
    const horizonVert = `
      precision mediump float;
      attribute vec2 aPosition;
      varying vec2 vUV;

      void main() {
        vUV = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const horizonFrag = `
      precision mediump float;
      uniform float uTime;
      uniform float uHorizonY;
      uniform vec3 uHorizonColor;
      varying vec2 vUV;

      void main() {
        // vUV.y is 0 at bottom, 1 at top
        // horizonY is fraction from top, so horizon in UV space is (1 - horizonY)
        float horizonUV = 1.0 - uHorizonY;
        float dist = abs(vUV.y - horizonUV);
        float glow = exp(-dist * dist * 500.0) * 0.4;
        float pulse = 1.0 + 0.1 * sin(uTime * 0.4);
        gl_FragColor = vec4(uHorizonColor * glow * pulse, glow * pulse * 0.85);
      }
    `;

    // ========= Shader Compilation =========
    function compileShader(type: number, source: string): WebGLShader | null {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl!.getShaderInfoLog(shader));
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function createProgram(
      vertSrc: string,
      fragSrc: string
    ): WebGLProgram | null {
      const vert = compileShader(gl!.VERTEX_SHADER, vertSrc);
      const frag = compileShader(gl!.FRAGMENT_SHADER, fragSrc);
      if (!vert || !frag) return null;

      const program = gl!.createProgram();
      if (!program) return null;
      gl!.attachShader(program, vert);
      gl!.attachShader(program, frag);
      gl!.linkProgram(program);

      if (!gl!.getProgramParameter(program, gl!.LINK_STATUS)) {
        console.error("Program link error:", gl!.getProgramInfoLog(program));
        return null;
      }
      return program;
    }

    // Create all programs
    const skyParticleProgram = createProgram(skyParticleVert, skyParticleFrag);
    const skyLineProgram = createProgram(skyLineVert, skyLineFrag);
    const seaProgram = createProgram(seaVert, seaFrag);
    const horizonProgram = createProgram(horizonVert, horizonFrag);

    if (!skyParticleProgram || !skyLineProgram || !seaProgram || !horizonProgram) {
      console.error("Failed to create shader programs");
      return;
    }

    // ========= Get Uniform/Attribute Locations =========
    const skyParticleLocs = {
      aPosition: gl.getAttribLocation(skyParticleProgram, "aPosition"),
      aAlpha: gl.getAttribLocation(skyParticleProgram, "aAlpha"),
      uTime: gl.getUniformLocation(skyParticleProgram, "uTime"),
      uPointSize: gl.getUniformLocation(skyParticleProgram, "uPointSize"),
      uDPR: gl.getUniformLocation(skyParticleProgram, "uDPR"),
      uParticleColor: gl.getUniformLocation(skyParticleProgram, "uParticleColor"),
      uHorizonY: gl.getUniformLocation(skyParticleProgram, "uHorizonY"),
    };

    const skyLineLocs = {
      aLinePos: gl.getAttribLocation(skyLineProgram, "aLinePos"),
      aLineAlpha: gl.getAttribLocation(skyLineProgram, "aLineAlpha"),
      uLineColor: gl.getUniformLocation(skyLineProgram, "uLineColor"),
    };

    const seaLocs = {
      aPos: gl.getAttribLocation(seaProgram, "aPos"),
      uRes: gl.getUniformLocation(seaProgram, "uRes"),
      uTime: gl.getUniformLocation(seaProgram, "uTime"),
      uAmp: gl.getUniformLocation(seaProgram, "uAmp"),
      uPix: gl.getUniformLocation(seaProgram, "uPix"),
      uFreqX: gl.getUniformLocation(seaProgram, "uFreqX"),
      uFreqY: gl.getUniformLocation(seaProgram, "uFreqY"),
      uSpeed: gl.getUniformLocation(seaProgram, "uSpeed"),
      uScroll: gl.getUniformLocation(seaProgram, "uScroll"),
      uTileW: gl.getUniformLocation(seaProgram, "uTileW"),
      uTileD: gl.getUniformLocation(seaProgram, "uTileD"),
      uCamH: gl.getUniformLocation(seaProgram, "uCamH"),
      uPitch: gl.getUniformLocation(seaProgram, "uPitch"),
      uFov: gl.getUniformLocation(seaProgram, "uFov"),
      uAspect: gl.getUniformLocation(seaProgram, "uAspect"),
      uZPush: gl.getUniformLocation(seaProgram, "uZPush"),
      uColor: gl.getUniformLocation(seaProgram, "uColor"),
      uRip: gl.getUniformLocation(seaProgram, "uRip[0]"),
      uRCnt: gl.getUniformLocation(seaProgram, "uRCnt"),
      uMouse: gl.getUniformLocation(seaProgram, "uMouse"),
      uMouseActive: gl.getUniformLocation(seaProgram, "uMouseActive"),
      uMouseRadius: gl.getUniformLocation(seaProgram, "uMouseRadius"),
      uHorizonY: gl.getUniformLocation(seaProgram, "uHorizonY"),
    };

    const horizonLocs = {
      aPosition: gl.getAttribLocation(horizonProgram, "aPosition"),
      uTime: gl.getUniformLocation(horizonProgram, "uTime"),
      uHorizonY: gl.getUniformLocation(horizonProgram, "uHorizonY"),
      uHorizonColor: gl.getUniformLocation(horizonProgram, "uHorizonColor"),
    };

    // ========= Initialize Sky Particles =========
    const skyParticles: SkyParticle[] = [];
    for (let i = 0; i < config.skyParticleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = config.skyDriftSpeed * (0.5 + Math.random());
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      skyParticles.push({
        x: Math.random(),
        y: Math.random() * config.horizonY, // Only in sky region
        vx,
        vy,
        baseVx: vx,
        baseVy: vy,
      });
    }

    // Sky buffers
    const skyParticleData = new Float32Array(config.skyParticleCount * 3);
    const skyParticleBuffer = gl.createBuffer();
    const maxSkyLineVertices = config.maxConnections * 2;
    const skyLineData = new Float32Array(maxSkyLineVertices * 3);
    const skyLineBuffer = gl.createBuffer();
    const spatialHash = new SpatialHash(config.connectionDistance);

    // ========= Initialize Sea Grid =========
    const tileW = 1600;
    const tileD = 1200;
    let seaPositions = new Float32Array(0);
    let seaCount = 0;
    const seaBuffer = gl.createBuffer()!;

    function rebuildSeaGrid() {
      if (!canvas || !gl) return;
      const spacing = config.seaSpacing;
      const w = Math.max(1, Math.floor(canvas.width / spacing));
      const h = Math.max(1, Math.floor(canvas.height / (spacing * 0.7)));
      const minCols = 60;
      const cols = Math.max(minCols, w + 80);
      const rows = h + 8;

      seaCount = cols * rows;
      seaPositions = new Float32Array(seaCount * 2);
      let i = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          seaPositions[i++] = x / (cols - 1);
          seaPositions[i++] = y / (rows - 1);
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, seaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, seaPositions, gl.STATIC_DRAW);
    }

    // Horizon quad buffer (fullscreen)
    const horizonQuad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const horizonBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, horizonBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, horizonQuad, gl.STATIC_DRAW);

    // ========= Resize Handler =========
    function resize() {
      if (!canvas || !gl) return;
      const vv = window.visualViewport;
      const w = Math.floor((vv?.width ?? window.innerWidth) * DPR);
      const h = Math.floor((vv?.height ?? window.innerHeight) * DPR);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        rebuildSeaGrid();
      }
    }

    window.addEventListener("resize", resize, { passive: true });
    window.visualViewport?.addEventListener("resize", resize, { passive: true });

    // Initial setup - always rebuild sea grid on effect run (handles theme changes)
    {
      const vv = window.visualViewport;
      const initW = Math.floor((vv?.width ?? window.innerWidth) * DPR);
      const initH = Math.floor((vv?.height ?? window.innerHeight) * DPR);
      canvas.width = initW;
      canvas.height = initH;
      gl.viewport(0, 0, initW, initH);
      rebuildSeaGrid();
    }

    // ========= Mouse State =========
    let skyMouseX = 0.5;
    let skyMouseY = 0.25;
    let targetSkyMouseX = 0.5;
    let targetSkyMouseY = 0.25;
    let skyMouseActive = false;

    let seaMouseX = 0.5;
    let seaMouseY = 0.5;
    let seaMouseActive = false;

    // ========= Sea Ripples =========
    const MAX_R = 6;
    const rip = new Float32Array(MAX_R * 4);
    for (let i = 0; i < MAX_R; i++) {
      rip[i * 4 + 2] = -999;
      rip[i * 4 + 3] = 1.2;
    }
    let rCount = 0;
    let nextSlot = 0;

    function now() {
      return performance.now() / 1000;
    }
    const startTime = now();

    function addRipple(nx: number, ny: number) {
      const idx = nextSlot * 4;
      rip[idx + 0] = nx;
      rip[idx + 1] = ny;
      rip[idx + 2] = now() - startTime;
      rip[idx + 3] = 1.2;
      nextSlot = (nextSlot + 1) % MAX_R;
      if (rCount < MAX_R) rCount++;
    }

    // Screen -> tile coords for sea
    const pitch = 0.18;
    const zPush = -50.0;
    function screenToSeaTile(clientX: number, clientY: number) {
      if (!canvas) return [0.5, 0.5] as const;
      const rect = canvas.getBoundingClientRect();

      // Screen coords normalized to full screen
      const screenX = (clientX - rect.left) / rect.width;
      const screenY = (clientY - rect.top) / rect.height;

      // Remap Y from sea region [horizonY, 1] to full range [0, 1]
      // Then convert to clip space [-1, 1]
      const seaY = (screenY - config.horizonY) / (1 - config.horizonY);
      const nx = -(screenX * 2 - 1);
      const ny = seaY * 2 - 1;

      const aspect = rect.width / rect.height;
      const fov = 1.2;
      const f = 1 / Math.tan(fov * 0.5);
      const camH = 80 * DPR;

      let dir = { x: (nx * aspect) / f, y: -ny / f, z: 1 };
      const s = Math.sin(pitch),
        c = Math.cos(pitch);
      const y2 = c * dir.y - s * dir.z;
      const z2 = s * dir.y + c * dir.z;
      dir = { x: dir.x, y: y2, z: z2 };

      const origin = { x: 0, y: camH, z: -zPush };
      if (dir.y >= 0) return [0.5, 0.5] as const;

      const t = -origin.y / dir.y;
      const hitX = origin.x + dir.x * t;
      const hitZ = origin.z + dir.z * t;

      const xNorm = hitX / tileW + 0.5;
      const zNorm = hitZ / tileD;
      const u = ((xNorm % 1) + 1) % 1;
      const v = ((zNorm % 1) + 1) % 1;
      return [u, v] as const;
    }

    // ========= Event Handlers =========
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const normalizedY = (e.clientY - rect.top) / rect.height;

      if (normalizedY < config.horizonY) {
        // Sky region
        targetSkyMouseX = (e.clientX - rect.left) / rect.width;
        targetSkyMouseY = normalizedY;
        skyMouseActive = true;
        seaMouseActive = false;
      } else {
        // Sea region
        const [u, v] = screenToSeaTile(e.clientX, e.clientY);
        seaMouseX = u;
        seaMouseY = v;
        seaMouseActive = true;
        skyMouseActive = false;
      }
    };

    const handleMouseLeave = () => {
      skyMouseActive = false;
      seaMouseActive = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const normalizedY = (e.clientY - rect.top) / rect.height;

      if (normalizedY >= config.horizonY) {
        // Only create ripples in sea region
        const [u, v] = screenToSeaTile(e.clientX, e.clientY);
        addRipple(u, v);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const normalizedY = (touch.clientY - rect.top) / rect.height;

      if (normalizedY < config.horizonY) {
        targetSkyMouseX = (touch.clientX - rect.left) / rect.width;
        targetSkyMouseY = normalizedY;
        skyMouseActive = true;
        seaMouseActive = false;
      } else {
        const [u, v] = screenToSeaTile(touch.clientX, touch.clientY);
        seaMouseX = u;
        seaMouseY = v;
        seaMouseActive = true;
        skyMouseActive = false;
      }
    };

    const handleTouchEnd = () => {
      skyMouseActive = false;
      seaMouseActive = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("mouseenter", () => {
      // Will be set properly on next mousemove
    });
    canvas.addEventListener("pointerdown", handleClick);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd);

    // ========= Theme Colors =========
    const isDark = resolvedTheme !== "light";
    const colors = {
      skyParticle: isDark
        ? [0xd4 / 255, 0xa5 / 255, 0x74 / 255]
        : [0x5a / 255, 0x48 / 255, 0x38 / 255],
      skyLine: isDark
        ? [0xe0 / 255, 0x78 / 255, 0x56 / 255]
        : [0x7a / 255, 0x5a / 255, 0x45 / 255],
      sea: isDark
        ? [0xd4 / 255, 0xa5 / 255, 0x74 / 255]
        : [0x6a / 255, 0x50 / 255, 0x38 / 255], // Slightly brighter brown for better visibility
      horizon: isDark
        ? [0xe0 / 255, 0x90 / 255, 0x60 / 255]
        : [0xc4 / 255, 0x85 / 255, 0x55 / 255],
    };

    // ========= GL State =========
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    if (isDark) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    // ========= Helpers =========
    function smoothstep(edge0: number, edge1: number, x: number): number {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }

    // ========= Animation Loop =========
    let rafId = 0;
    let lastTime = now();
    const scrollX = 0,
      scrollY = 0;

    function frame() {
      if (!gl || !canvas) return;

      const currentTime = now();
      const dt = Math.min(currentTime - lastTime, 0.05);
      lastTime = currentTime;
      const elapsed = currentTime - startTime;

      // Smooth sky mouse tracking
      skyMouseX += (targetSkyMouseX - skyMouseX) * 0.08;
      skyMouseY += (targetSkyMouseY - skyMouseY) * 0.08;

      // ===== Update Sky Physics =====
      const SKY_EDGE_MARGIN = 0.03;
      const DAMPING = 0.992;

      for (const p of skyParticles) {
        let ax = 0,
          ay = 0;

        // Mouse gravity for sky
        if (skyMouseActive) {
          const dx = skyMouseX - p.x;
          const dy = skyMouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.skyMouseRadius && dist > 0.01) {
            const influence =
              (1 - dist / config.skyMouseRadius) *
              (dist / config.skyMouseRadius);
            ax += (dx / dist) * config.skyMouseStrength * influence * 4;
            ay += (dy / dist) * config.skyMouseStrength * influence * 4;
          }
        }

        p.vx += ax;
        p.vy += ay;

        if (!skyMouseActive) {
          p.vx += (p.baseVx - p.vx) * 0.005;
          p.vy += (p.baseVy - p.vy) * 0.005;
        }

        p.vx *= DAMPING;
        p.vy *= DAMPING;

        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;

        // Wrap horizontally, bounce at top and horizon
        if (p.x < -SKY_EDGE_MARGIN) p.x = 1 + SKY_EDGE_MARGIN;
        if (p.x > 1 + SKY_EDGE_MARGIN) p.x = -SKY_EDGE_MARGIN;
        if (p.y < -SKY_EDGE_MARGIN) {
          p.y = -SKY_EDGE_MARGIN;
          p.vy *= -0.5;
        }
        if (p.y > config.horizonY - 0.02) {
          p.y = config.horizonY - 0.02;
          p.vy *= -0.5;
        }
      }

      // Rebuild spatial hash
      spatialHash.clear();
      for (let i = 0; i < skyParticles.length; i++) {
        spatialHash.insert(i, skyParticles[i].x, skyParticles[i].y);
      }

      // Find sky connections
      const connections: { i: number; j: number; alpha: number }[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < skyParticles.length; i++) {
        const p = skyParticles[i];
        const neighbors = spatialHash.getPotentialNeighbors(p.x, p.y);

        for (const j of neighbors) {
          if (j <= i) continue;
          const key = `${i},${j}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const q = skyParticles[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.connectionDistance) {
            const alpha = 1 - dist / config.connectionDistance;
            const pAlpha = smoothstep(
              0,
              SKY_EDGE_MARGIN,
              Math.min(p.x, 1 - p.x, p.y, config.horizonY - p.y)
            );
            const qAlpha = smoothstep(
              0,
              SKY_EDGE_MARGIN,
              Math.min(q.x, 1 - q.x, q.y, config.horizonY - q.y)
            );
            connections.push({ i, j, alpha: alpha * Math.min(pAlpha, qAlpha) });

            if (connections.length >= config.maxConnections) break;
          }
        }
        if (connections.length >= config.maxConnections) break;
      }

      // Update sky particle buffer
      for (let i = 0; i < skyParticles.length; i++) {
        const p = skyParticles[i];
        const alpha = smoothstep(
          0,
          SKY_EDGE_MARGIN,
          Math.min(p.x, 1 - p.x, p.y, config.horizonY - p.y)
        );
        skyParticleData[i * 3] = p.x;
        skyParticleData[i * 3 + 1] = p.y;
        skyParticleData[i * 3 + 2] = alpha;
      }

      // Update sky line buffer
      let skyLineVertexCount = 0;
      for (const conn of connections) {
        const p = skyParticles[conn.i];
        const q = skyParticles[conn.j];

        skyLineData[skyLineVertexCount * 3] = p.x;
        skyLineData[skyLineVertexCount * 3 + 1] = p.y;
        skyLineData[skyLineVertexCount * 3 + 2] = conn.alpha;
        skyLineVertexCount++;

        skyLineData[skyLineVertexCount * 3] = q.x;
        skyLineData[skyLineVertexCount * 3 + 1] = q.y;
        skyLineData[skyLineVertexCount * 3 + 2] = conn.alpha;
        skyLineVertexCount++;
      }

      // ===== Clear and Render =====
      gl.clear(gl.COLOR_BUFFER_BIT);

      // --- Draw Horizon Glow ---
      gl.useProgram(horizonProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, horizonBuffer);
      gl.enableVertexAttribArray(horizonLocs.aPosition);
      gl.vertexAttribPointer(horizonLocs.aPosition, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(horizonLocs.uTime, elapsed);
      gl.uniform1f(horizonLocs.uHorizonY, config.horizonY);
      gl.uniform3fv(horizonLocs.uHorizonColor, colors.horizon);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(horizonLocs.aPosition);

      // --- Draw Sky Lines ---
      if (skyLineVertexCount > 0) {
        gl.useProgram(skyLineProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, skyLineBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          skyLineData.subarray(0, skyLineVertexCount * 3),
          gl.DYNAMIC_DRAW
        );

        gl.enableVertexAttribArray(skyLineLocs.aLinePos);
        gl.vertexAttribPointer(skyLineLocs.aLinePos, 2, gl.FLOAT, false, 12, 0);
        gl.enableVertexAttribArray(skyLineLocs.aLineAlpha);
        gl.vertexAttribPointer(skyLineLocs.aLineAlpha, 1, gl.FLOAT, false, 12, 8);

        gl.uniform3fv(skyLineLocs.uLineColor, colors.skyLine);
        gl.drawArrays(gl.LINES, 0, skyLineVertexCount);

        // Disable line attributes
        gl.disableVertexAttribArray(skyLineLocs.aLinePos);
        gl.disableVertexAttribArray(skyLineLocs.aLineAlpha);
      }

      // --- Draw Sky Particles ---
      gl.useProgram(skyParticleProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, skyParticleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, skyParticleData, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(skyParticleLocs.aPosition);
      gl.vertexAttribPointer(skyParticleLocs.aPosition, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(skyParticleLocs.aAlpha);
      gl.vertexAttribPointer(skyParticleLocs.aAlpha, 1, gl.FLOAT, false, 12, 8);

      gl.uniform1f(skyParticleLocs.uTime, elapsed);
      gl.uniform1f(skyParticleLocs.uPointSize, config.skyPointSize);
      gl.uniform1f(skyParticleLocs.uDPR, DPR);
      gl.uniform3fv(skyParticleLocs.uParticleColor, colors.skyParticle);
      gl.uniform1f(skyParticleLocs.uHorizonY, config.horizonY);

      gl.drawArrays(gl.POINTS, 0, skyParticles.length);

      // Disable sky attributes before switching to sea
      gl.disableVertexAttribArray(skyParticleLocs.aPosition);
      gl.disableVertexAttribArray(skyParticleLocs.aAlpha);

      // --- Draw Sea Particles ---
      gl.useProgram(seaProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, seaBuffer);

      gl.enableVertexAttribArray(seaLocs.aPos);
      gl.vertexAttribPointer(seaLocs.aPos, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(seaLocs.uRes!, canvas.width, canvas.height);
      gl.uniform1f(seaLocs.uTime!, elapsed);
      gl.uniform1f(seaLocs.uAmp!, 15.0 * DPR);
      gl.uniform1f(seaLocs.uPix!, config.seaPointSize * DPR);
      gl.uniform1f(seaLocs.uFreqX!, 22.0);
      gl.uniform1f(seaLocs.uFreqY!, 18.0);
      gl.uniform1f(seaLocs.uSpeed!, 1.2);
      gl.uniform2f(seaLocs.uScroll!, scrollX, scrollY);
      gl.uniform1f(seaLocs.uTileW!, tileW);
      gl.uniform1f(seaLocs.uTileD!, tileD);
      gl.uniform1f(seaLocs.uCamH!, 80.0 * DPR);
      gl.uniform1f(seaLocs.uPitch!, -0.18);
      gl.uniform1f(seaLocs.uFov!, 1.2);
      gl.uniform1f(seaLocs.uAspect!, canvas.width / canvas.height);
      gl.uniform1f(seaLocs.uZPush!, -50.0);
      gl.uniform3fv(seaLocs.uColor!, colors.sea);
      gl.uniform1i(seaLocs.uRCnt!, rCount);
      gl.uniform4fv(seaLocs.uRip!, rip);
      gl.uniform2f(seaLocs.uMouse!, seaMouseX, seaMouseY);
      gl.uniform1f(seaLocs.uMouseActive!, seaMouseActive ? 1.0 : 0.0);
      gl.uniform1f(seaLocs.uMouseRadius!, config.seaMouseRadius);
      gl.uniform1f(seaLocs.uHorizonY!, config.horizonY);

      gl.drawArrays(gl.POINTS, 0, seaCount);
      gl.disableVertexAttribArray(seaLocs.aPos);

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    // ========= Cleanup =========
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("pointerdown", handleClick);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      gl.deleteBuffer(skyParticleBuffer);
      gl.deleteBuffer(skyLineBuffer);
      gl.deleteBuffer(seaBuffer);
      gl.deleteBuffer(horizonBuffer);
      gl.deleteProgram(skyParticleProgram);
      gl.deleteProgram(skyLineProgram);
      gl.deleteProgram(seaProgram);
      gl.deleteProgram(horizonProgram);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100dvh",
        outline: "none",
      }}
      aria-hidden="true"
    />
  );
}
