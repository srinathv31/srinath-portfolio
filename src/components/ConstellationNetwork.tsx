"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

// Particle data structure
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  homeX: number;
  homeY: number;
}

// Spatial hash for efficient neighbor detection
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

  private getKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(index: number, x: number, y: number) {
    const key = this.getKey(x, y);
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

export default function ConstellationNetwork() {
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
      particleCount: isMobile ? 80 : 120,
      connectionDistance: isMobile ? 0.12 : 0.1,
      maxConnections: isMobile ? 1000 : 2000,
      pointSize: prefersReducedMotion ? 3 : 4,
      driftSpeed: prefersReducedMotion ? 0.00005 : 0.0001,
      mouseRadius: 0.18,
      mouseStrength: 0.00012,
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

    // Shaders
    const particleVert = `
      precision mediump float;
      attribute vec2 aPosition;
      attribute float aAlpha;
      uniform float uTime;
      uniform float uPointSize;
      uniform float uDPR;
      varying float vAlpha;
      varying float vGlow;

      void main() {
        vec2 clipPos = aPosition * 2.0 - 1.0;
        float pulse = 1.0 + 0.12 * sin(uTime * 0.8 + aPosition.x * 6.28 + aPosition.y * 3.14);
        vAlpha = aAlpha;
        vGlow = pulse;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        gl_PointSize = uPointSize * pulse * uDPR;
      }
    `;

    const particleFrag = `
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

    const lineVert = `
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

    const lineFrag = `
      precision mediump float;
      uniform vec3 uLineColor;
      varying float vLineAlpha;

      void main() {
        gl_FragColor = vec4(uLineColor * 0.8, vLineAlpha * 0.35);
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

    // Create program helper
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

    // Create programs
    const particleProgram = createProgram(particleVert, particleFrag);
    const lineProgram = createProgram(lineVert, lineFrag);
    if (!particleProgram || !lineProgram) return;

    // Get locations
    const particleLocs = {
      aPosition: gl.getAttribLocation(particleProgram, "aPosition"),
      aAlpha: gl.getAttribLocation(particleProgram, "aAlpha"),
      uTime: gl.getUniformLocation(particleProgram, "uTime"),
      uPointSize: gl.getUniformLocation(particleProgram, "uPointSize"),
      uDPR: gl.getUniformLocation(particleProgram, "uDPR"),
      uParticleColor: gl.getUniformLocation(particleProgram, "uParticleColor"),
    };

    const lineLocs = {
      aLinePos: gl.getAttribLocation(lineProgram, "aLinePos"),
      aLineAlpha: gl.getAttribLocation(lineProgram, "aLineAlpha"),
      uLineColor: gl.getUniformLocation(lineProgram, "uLineColor"),
    };

    // Initialize particles
    const particles: Particle[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = config.driftSpeed * (0.5 + Math.random());
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const x = Math.random();
      const y = Math.random();
      particles.push({
        x,
        y,
        vx,
        vy,
        baseVx: vx,
        baseVy: vy,
        homeX: x,
        homeY: y,
      });
    }

    // Create buffers
    const particleData = new Float32Array(config.particleCount * 3);
    const particleBuffer = gl.createBuffer();

    const maxLineVertices = config.maxConnections * 2;
    const lineData = new Float32Array(maxLineVertices * 3);
    const lineBuffer = gl.createBuffer();

    // Spatial hash
    const spatialHash = new SpatialHash(config.connectionDistance);

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
    const colors = {
      particle: isDark
        ? [0xd4 / 255, 0xa5 / 255, 0x74 / 255]
        : [0x5a / 255, 0x48 / 255, 0x38 / 255],
      line: isDark
        ? [0xe0 / 255, 0x78 / 255, 0x56 / 255]
        : [0x7a / 255, 0x5a / 255, 0x45 / 255],
    };

    // GL state
    gl.clearColor(0, 0, 0, 0);
    if (isDark) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.enable(gl.BLEND);

    // Smoothstep helper
    function smoothstep(edge0: number, edge1: number, x: number): number {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
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
      mouseX += (targetMouseX - mouseX) * 0.08;
      mouseY += (targetMouseY - mouseY) * 0.08;

      // Update physics
      const EDGE_MARGIN = 0.05;
      const DAMPING = 0.992;

      for (const p of particles) {
        let ax = 0,
          ay = 0;

        // Mouse gravity with repulsion zone
        const MIN_DISTANCE = 0.04; // Particles won't collapse closer than this
        if (mouseActive) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.mouseRadius && dist > 0.01) {
            if (dist < MIN_DISTANCE) {
              // Repel when too close - prevents collapse
              const repelStrength =
                (1 - dist / MIN_DISTANCE) * config.mouseStrength * 8;
              ax -= (dx / dist) * repelStrength;
              ay -= (dy / dist) * repelStrength;
            } else {
              // Normal attraction
              const influence =
                (1 - dist / config.mouseRadius) * (dist / config.mouseRadius);
              ax += (dx / dist) * config.mouseStrength * influence * 4;
              ay += (dy / dist) * config.mouseStrength * influence * 4;
            }
          }
        }

        // Apply acceleration
        p.vx += ax;
        p.vy += ay;

        // Drift back to base velocity
        if (!mouseActive) {
          p.vx += (p.baseVx - p.vx) * 0.005;
          p.vy += (p.baseVy - p.vy) * 0.005;
        }

        // Return-to-home force (keeps constellation shape)
        const homeForce = 0.0003;
        const homeDx = p.homeX - p.x;
        const homeDy = p.homeY - p.y;
        p.vx += homeDx * homeForce;
        p.vy += homeDy * homeForce;

        // Damping
        p.vx *= DAMPING;
        p.vy *= DAMPING;

        // Update position
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;

        // Wrap edges
        if (p.x < -EDGE_MARGIN) p.x = 1 + EDGE_MARGIN;
        if (p.x > 1 + EDGE_MARGIN) p.x = -EDGE_MARGIN;
        if (p.y < -EDGE_MARGIN) p.y = 1 + EDGE_MARGIN;
        if (p.y > 1 + EDGE_MARGIN) p.y = -EDGE_MARGIN;
      }

      // Rebuild spatial hash
      spatialHash.clear();
      for (let i = 0; i < particles.length; i++) {
        spatialHash.insert(i, particles[i].x, particles[i].y);
      }

      // Find connections
      const connections: { i: number; j: number; alpha: number }[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const neighbors = spatialHash.getPotentialNeighbors(p.x, p.y);

        for (const j of neighbors) {
          if (j <= i) continue;
          const key = `${i},${j}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const q = particles[j];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.connectionDistance) {
            const alpha = 1 - dist / config.connectionDistance;
            const pAlpha = smoothstep(0, EDGE_MARGIN, Math.min(p.x, 1 - p.x, p.y, 1 - p.y));
            const qAlpha = smoothstep(0, EDGE_MARGIN, Math.min(q.x, 1 - q.x, q.y, 1 - q.y));
            connections.push({ i, j, alpha: alpha * Math.min(pAlpha, qAlpha) });

            if (connections.length >= config.maxConnections) break;
          }
        }
        if (connections.length >= config.maxConnections) break;
      }

      // Update particle buffer
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const alpha = smoothstep(0, EDGE_MARGIN, Math.min(p.x, 1 - p.x, p.y, 1 - p.y));
        particleData[i * 3] = p.x;
        particleData[i * 3 + 1] = p.y;
        particleData[i * 3 + 2] = alpha;
      }

      // Update line buffer
      let lineVertexCount = 0;
      for (const conn of connections) {
        const p = particles[conn.i];
        const q = particles[conn.j];

        lineData[lineVertexCount * 3] = p.x;
        lineData[lineVertexCount * 3 + 1] = p.y;
        lineData[lineVertexCount * 3 + 2] = conn.alpha;
        lineVertexCount++;

        lineData[lineVertexCount * 3] = q.x;
        lineData[lineVertexCount * 3 + 1] = q.y;
        lineData[lineVertexCount * 3 + 2] = conn.alpha;
        lineVertexCount++;
      }

      // Clear
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Draw lines
      if (lineVertexCount > 0) {
        gl.useProgram(lineProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, lineData.subarray(0, lineVertexCount * 3), gl.DYNAMIC_DRAW);

        gl.enableVertexAttribArray(lineLocs.aLinePos);
        gl.vertexAttribPointer(lineLocs.aLinePos, 2, gl.FLOAT, false, 12, 0);
        gl.enableVertexAttribArray(lineLocs.aLineAlpha);
        gl.vertexAttribPointer(lineLocs.aLineAlpha, 1, gl.FLOAT, false, 12, 8);

        gl.uniform3fv(lineLocs.uLineColor, colors.line);
        gl.drawArrays(gl.LINES, 0, lineVertexCount);
      }

      // Draw particles
      gl.useProgram(particleProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(particleLocs.aPosition);
      gl.vertexAttribPointer(particleLocs.aPosition, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(particleLocs.aAlpha);
      gl.vertexAttribPointer(particleLocs.aAlpha, 1, gl.FLOAT, false, 12, 8);

      gl.uniform1f(particleLocs.uTime, elapsed);
      gl.uniform1f(particleLocs.uPointSize, config.pointSize);
      gl.uniform1f(particleLocs.uDPR, DPR);
      gl.uniform3fv(particleLocs.uParticleColor, colors.particle);

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
      gl.deleteBuffer(particleBuffer);
      gl.deleteBuffer(lineBuffer);
      gl.deleteProgram(particleProgram);
      gl.deleteProgram(lineProgram);
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
