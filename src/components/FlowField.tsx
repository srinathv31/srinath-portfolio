"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

// Simplex noise implementation
// Based on Stefan Gustavson's implementation
class SimplexNoise {
  private perm: Uint8Array;
  private gradP: { x: number; y: number; z: number }[];

  private grad3 = [
    { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 }, { x: 1, y: -1, z: 0 }, { x: -1, y: -1, z: 0 },
    { x: 1, y: 0, z: 1 }, { x: -1, y: 0, z: 1 }, { x: 1, y: 0, z: -1 }, { x: -1, y: 0, z: -1 },
    { x: 0, y: 1, z: 1 }, { x: 0, y: -1, z: 1 }, { x: 0, y: 1, z: -1 }, { x: 0, y: -1, z: -1 },
  ];

  constructor(seed = Math.random() * 65536) {
    this.perm = new Uint8Array(512);
    this.gradP = new Array(512);

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Seed-based shuffle
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.gradP[i] = this.grad3[this.perm[i] % 12];
    }
  }

  noise3D(x: number, y: number, z: number): number {
    const F3 = 1 / 3;
    const G3 = 1 / 6;

    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);

    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;

    let i1: number, j1: number, k1: number;
    let i2: number, j2: number, k2: number;

    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3;
    const y2 = y0 - j2 + 2 * G3;
    const z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3;
    const y3 = y0 - 1 + 3 * G3;
    const z3 = z0 - 1 + 3 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    const gi0 = this.gradP[ii + this.perm[jj + this.perm[kk]]];
    const gi1 = this.gradP[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]];
    const gi2 = this.gradP[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]];
    const gi3 = this.gradP[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]];

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (gi0.x * x0 + gi0.y * y0 + gi0.z * z0);
    }

    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (gi1.x * x1 + gi1.y * y1 + gi1.z * z1);
    }

    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (gi2.x * x2 + gi2.y * y2 + gi2.z * z2);
    }

    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 >= 0) {
      t3 *= t3;
      n3 = t3 * t3 * (gi3.x * x3 + gi3.y * y3 + gi3.z * z3);
    }

    return 32 * (n0 + n1 + n2 + n3);
  }
}

// Particle interface
interface Particle {
  x: number;
  y: number;
  speed: number;
}

export default function FlowField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Configuration
    const isMobile = window.innerWidth < 768;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const config = {
      particleCount: isMobile ? 150 : 250,
      noiseScale: 3,
      noiseSpeed: 0.15,
      flowSpeed: prefersReducedMotion ? 0.0008 : 0.0015,
      vortexRadius: 0.2,
      vortexStrength: prefersReducedMotion ? 0.003 : 0.006,
      pointSize: prefersReducedMotion ? 2.5 : 3.5,
    };

    // WebGL setup
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

    // Initialize simplex noise
    const noise = new SimplexNoise(12345);

    // Shaders
    const vertexShader = `
      precision mediump float;
      attribute vec2 aPosition;
      attribute float aSpeed;
      uniform float uTime;
      uniform float uPointSize;
      uniform float uDPR;
      varying float vAlpha;
      varying float vSpeed;

      void main() {
        vec2 clipPos = aPosition * 2.0 - 1.0;

        // Pulse based on speed
        float pulse = 1.0 + 0.2 * sin(uTime * 2.0 + aPosition.x * 10.0);

        vAlpha = 1.0;
        vSpeed = aSpeed;

        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        gl_PointSize = uPointSize * (0.8 + aSpeed * 0.4) * pulse * uDPR;
      }
    `;

    const fragmentShader = `
      precision mediump float;
      uniform vec3 uColor;
      varying float vAlpha;
      varying float vSpeed;

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);

        // Soft circular particle
        float alpha = 1.0 - smoothstep(0.3, 1.0, r);

        // Core glow
        float core = exp(-r * r * 3.0);

        // Brighter when moving faster
        vec3 color = uColor * (0.6 + vSpeed * 0.5);
        color += uColor * core * 0.4;

        gl_FragColor = vec4(color, alpha * vAlpha * 0.85);
      }
    `;

    // Compile shader helper
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

    // Create program
    function createProgram(vertSrc: string, fragSrc: string): WebGLProgram | null {
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

    const program = createProgram(vertexShader, fragmentShader);
    if (!program) return;

    // Get locations
    const locs = {
      aPosition: gl.getAttribLocation(program, "aPosition"),
      aSpeed: gl.getAttribLocation(program, "aSpeed"),
      uTime: gl.getUniformLocation(program, "uTime"),
      uPointSize: gl.getUniformLocation(program, "uPointSize"),
      uDPR: gl.getUniformLocation(program, "uDPR"),
      uColor: gl.getUniformLocation(program, "uColor"),
    };

    // Initialize particles
    const particles: Particle[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.5 + Math.random() * 0.5,
      });
    }

    // Create buffer
    const particleData = new Float32Array(config.particleCount * 3);
    const buffer = gl.createBuffer();

    // Mouse state
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;
    let mouseActive = false;

    // Resize handler
    function resize() {
      if (!canvas || !gl) return;
      const w = Math.floor(window.innerWidth * DPR);
      const h = Math.floor(window.innerHeight * DPR);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();

    // Mouse events
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = (e.clientX - rect.left) / rect.width;
      targetMouseY = (e.clientY - rect.top) / rect.height;
      mouseActive = true;
    };

    const handleMouseLeave = () => {
      mouseActive = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      targetMouseX = (touch.clientX - rect.left) / rect.width;
      targetMouseY = (touch.clientY - rect.top) / rect.height;
      mouseActive = true;
    };

    const handleTouchEnd = () => {
      mouseActive = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("mouseenter", () => (mouseActive = true));
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd);

    // Theme colors
    const isDark = resolvedTheme !== "light";
    const color = isDark
      ? [0xd4 / 255, 0xa5 / 255, 0x74 / 255]
      : [0x5a / 255, 0x48 / 255, 0x38 / 255];

    // GL state
    gl.clearColor(0, 0, 0, 0);
    if (isDark) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.enable(gl.BLEND);

    // Get flow vector from noise
    function getFlowVector(x: number, y: number, time: number): [number, number] {
      const angle = noise.noise3D(
        x * config.noiseScale,
        y * config.noiseScale,
        time * config.noiseSpeed
      ) * Math.PI * 2;
      return [Math.cos(angle), Math.sin(angle)];
    }

    // Get vortex velocity
    function getVortexVelocity(px: number, py: number, mx: number, my: number): [number, number] {
      const dx = px - mx;
      const dy = py - my;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > config.vortexRadius || dist < 0.01) return [0, 0];

      // Tangential direction (perpendicular, counter-clockwise)
      const tx = -dy / dist;
      const ty = dx / dist;

      // Strength increases toward center, with soft falloff at edge
      const normalizedDist = dist / config.vortexRadius;
      const strength = (1 - normalizedDist * normalizedDist) * config.vortexStrength;

      return [tx * strength, ty * strength];
    }

    // Animation
    let rafId = 0;
    let lastTime = performance.now() / 1000;
    const startTime = lastTime;

    function frame() {
      if (!gl || !canvas) return;

      const now = performance.now() / 1000;
      const dt = Math.min(now - lastTime, 0.05);
      lastTime = now;
      const elapsed = now - startTime;

      // Smooth mouse tracking
      mouseX += (targetMouseX - mouseX) * 0.1;
      mouseY += (targetMouseY - mouseY) * 0.1;

      // Update particles
      for (const p of particles) {
        // Get flow field velocity
        const [fx, fy] = getFlowVector(p.x, p.y, elapsed);
        let vx = fx * config.flowSpeed * p.speed;
        let vy = fy * config.flowSpeed * p.speed;

        // Add vortex if mouse active
        if (mouseActive) {
          const [vortexX, vortexY] = getVortexVelocity(p.x, p.y, mouseX, mouseY);

          // Calculate blend based on distance to mouse
          const dx = p.x - mouseX;
          const dy = p.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const vortexInfluence = Math.max(0, 1 - dist / config.vortexRadius);

          // Blend flow and vortex
          vx = vx * (1 - vortexInfluence * 0.8) + vortexX;
          vy = vy * (1 - vortexInfluence * 0.8) + vortexY;
        }

        // Update position
        p.x += vx * dt * 60;
        p.y += vy * dt * 60;

        // Wrap edges
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;
      }

      // Update buffer
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        particleData[i * 3] = p.x;
        particleData[i * 3 + 1] = p.y;
        particleData[i * 3 + 2] = p.speed;
      }

      // Clear and draw
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(locs.aPosition);
      gl.vertexAttribPointer(locs.aPosition, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(locs.aSpeed);
      gl.vertexAttribPointer(locs.aSpeed, 1, gl.FLOAT, false, 12, 8);

      gl.uniform1f(locs.uTime, elapsed);
      gl.uniform1f(locs.uPointSize, config.pointSize);
      gl.uniform1f(locs.uDPR, DPR);
      gl.uniform3fv(locs.uColor, color);

      gl.drawArrays(gl.POINTS, 0, particles.length);

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        outline: "none",
      }}
      aria-hidden="true"
    />
  );
}
