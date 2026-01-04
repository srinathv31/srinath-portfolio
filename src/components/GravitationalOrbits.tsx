"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

// Particle with orbital mechanics
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  trail: { x: number; y: number }[];
  attractorIndex: number; // Which attractor this particle is bound to
}

// Invisible gravity attractor
interface Attractor {
  x: number;
  y: number;
  mass: number;
}

export default function GravitationalOrbits() {
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
      particleCount: isMobile ? 120 : 200,
      attractorCount: isMobile ? 3 : 5,
      trailLength: prefersReducedMotion ? 12 : 24,
      gravitationalConstant: 0.000008, // Much slower, more contemplative orbits
      mouseGravityMultiplier: 6,
      mouseRadius: 0.3,
      softening: 0.03, // Prevents singularity at zero distance
      pointSize: prefersReducedMotion ? 2.5 : 3.5,
      pulseStrength: 0.008,
      pulseDuration: 0.8,
      timeScale: 0.4, // Slow down overall physics
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
      attribute float aSize;
      uniform float uPointSize;
      uniform float uDPR;
      uniform float uTime;
      varying float vAlpha;
      varying float vGlow;

      void main() {
        vec2 clipPos = aPosition * 2.0 - 1.0;
        
        // Subtle pulse based on position
        float pulse = 1.0 + 0.1 * sin(uTime * 1.5 + aPosition.x * 8.0 + aPosition.y * 6.0);
        
        vAlpha = aAlpha;
        vGlow = pulse;
        
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
        gl_PointSize = uPointSize * aSize * pulse * uDPR;
      }
    `;

    const particleFrag = `
      precision mediump float;
      uniform vec3 uColor;
      varying float vAlpha;
      varying float vGlow;

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        
        // Soft circular particle with glow
        float alpha = 1.0 - smoothstep(0.2, 1.0, r);
        float core = exp(-r * r * 2.0);
        
        vec3 color = uColor * (0.5 + 0.5 * vGlow);
        color += uColor * core * 0.6;
        
        gl_FragColor = vec4(color, alpha * vAlpha * 0.9);
      }
    `;

    const trailVert = `
      precision mediump float;
      attribute vec2 aPosition;
      attribute float aAlpha;
      varying float vAlpha;

      void main() {
        vec2 clipPos = aPosition * 2.0 - 1.0;
        vAlpha = aAlpha;
        gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
      }
    `;

    const trailFrag = `
      precision mediump float;
      uniform vec3 uColor;
      varying float vAlpha;

      void main() {
        gl_FragColor = vec4(uColor * 0.6, vAlpha * 0.3);
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
    const trailProgram = createProgram(trailVert, trailFrag);
    if (!particleProgram || !trailProgram) return;

    // Get locations
    const particleLocs = {
      aPosition: gl.getAttribLocation(particleProgram, "aPosition"),
      aAlpha: gl.getAttribLocation(particleProgram, "aAlpha"),
      aSize: gl.getAttribLocation(particleProgram, "aSize"),
      uPointSize: gl.getUniformLocation(particleProgram, "uPointSize"),
      uDPR: gl.getUniformLocation(particleProgram, "uDPR"),
      uTime: gl.getUniformLocation(particleProgram, "uTime"),
      uColor: gl.getUniformLocation(particleProgram, "uColor"),
    };

    const trailLocs = {
      aPosition: gl.getAttribLocation(trailProgram, "aPosition"),
      aAlpha: gl.getAttribLocation(trailProgram, "aAlpha"),
      uColor: gl.getUniformLocation(trailProgram, "uColor"),
    };

    // Initialize attractors - positioned for visual interest
    const attractors: Attractor[] = [];
    const positions = isMobile
      ? [
          { x: 0.3, y: 0.35 },
          { x: 0.7, y: 0.5 },
          { x: 0.5, y: 0.75 },
        ]
      : [
          { x: 0.25, y: 0.3 },
          { x: 0.75, y: 0.25 },
          { x: 0.6, y: 0.6 },
          { x: 0.2, y: 0.7 },
          { x: 0.85, y: 0.75 },
        ];

    for (let i = 0; i < config.attractorCount; i++) {
      attractors.push({
        x: positions[i].x,
        y: positions[i].y,
        mass: 1.5 + Math.random() * 1.5,
      });
    }

    // Initialize particles in orbits around attractors
    const particles: Particle[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      const attractorIndex = i % attractors.length;
      const attractor = attractors[attractorIndex];

      // Random orbital parameters - wider orbits for more graceful movement
      const orbitRadius = 0.12 + Math.random() * 0.22;
      const angle = Math.random() * Math.PI * 2;
      const eccentricity = 0.15 + Math.random() * 0.35; // Lower eccentricity for smoother orbits

      // Position on ellipse
      const x =
        attractor.x +
        orbitRadius * (1 + eccentricity * Math.cos(angle)) * Math.cos(angle);
      const y =
        attractor.y +
        orbitRadius * (1 + eccentricity * Math.cos(angle)) * Math.sin(angle);

      // Velocity perpendicular to radius for orbit (Kepler)
      const dist = Math.sqrt((x - attractor.x) ** 2 + (y - attractor.y) ** 2);
      // Increased orbital speed to maintain stable orbits with slower physics
      const orbitalSpeed = Math.sqrt(
        (config.gravitationalConstant * attractor.mass * 2.5) /
          Math.max(dist, 0.01)
      );

      // Perpendicular direction
      const dx = x - attractor.x;
      const dy = y - attractor.y;
      const perpX = -dy / dist;
      const perpY = dx / dist;

      // Add some randomness to orbital direction
      const direction = Math.random() > 0.5 ? 1 : -1;

      particles.push({
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        vx: perpX * orbitalSpeed * direction * (0.9 + Math.random() * 0.2),
        vy: perpY * orbitalSpeed * direction * (0.9 + Math.random() * 0.2),
        mass: 0.5 + Math.random() * 0.5,
        trail: [],
        attractorIndex,
      });
    }

    // Create buffers
    const particleData = new Float32Array(config.particleCount * 4); // x, y, alpha, size
    const particleBuffer = gl.createBuffer();

    const maxTrailVertices = config.particleCount * config.trailLength * 2;
    const trailData = new Float32Array(maxTrailVertices * 3); // x, y, alpha
    const trailBuffer = gl.createBuffer();

    // Mouse state
    let mouseX = 0.5;
    let mouseY = 0.5;
    let targetMouseX = 0.5;
    let targetMouseY = 0.5;
    let mouseActive = false;

    // Pulse state (for click effects)
    interface Pulse {
      x: number;
      y: number;
      startTime: number;
    }
    const pulses: Pulse[] = [];

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

    // Mouse/touch events
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = (e.clientX - rect.left) / rect.width;
      targetMouseY = (e.clientY - rect.top) / rect.height;
      mouseActive = true;
    };

    const handleMouseLeave = () => {
      mouseActive = false;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      pulses.push({ x, y, startTime: performance.now() / 1000 });
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      targetMouseX = (touch.clientX - rect.left) / rect.width;
      targetMouseY = (touch.clientY - rect.top) / rect.height;
      mouseActive = true;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;
      const y = (touch.clientY - rect.top) / rect.height;
      targetMouseX = x;
      targetMouseY = y;
      mouseActive = true;
      pulses.push({ x, y, startTime: performance.now() / 1000 });
    };

    const handleTouchEnd = () => {
      mouseActive = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("mouseenter", () => (mouseActive = true));
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd);

    // Theme colors
    const isDark = resolvedTheme !== "light";
    const color = isDark
      ? [0xd4 / 255, 0xa5 / 255, 0x74 / 255] // Warm amber
      : [0x5a / 255, 0x48 / 255, 0x38 / 255]; // Earthy brown

    // GL state
    gl.clearColor(0, 0, 0, 0);
    if (isDark) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.enable(gl.BLEND);

    // Physics helpers
    function calculateGravity(
      px: number,
      py: number,
      ax: number,
      ay: number,
      mass: number,
      G: number
    ): [number, number] {
      const dx = ax - px;
      const dy = ay - py;
      const distSq = dx * dx + dy * dy + config.softening * config.softening;
      const dist = Math.sqrt(distSq);
      const force = (G * mass) / distSq;
      return [(dx / dist) * force, (dy / dist) * force];
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
      mouseX += (targetMouseX - mouseX) * 0.12;
      mouseY += (targetMouseY - mouseY) * 0.12;

      // Clean up old pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        if (now - pulses[i].startTime > config.pulseDuration) {
          pulses.splice(i, 1);
        }
      }

      // Update particles
      for (const p of particles) {
        let ax = 0;
        let ay = 0;

        // Gravity from all attractors
        for (const attractor of attractors) {
          const [gx, gy] = calculateGravity(
            p.x,
            p.y,
            attractor.x,
            attractor.y,
            attractor.mass,
            config.gravitationalConstant
          );
          ax += gx;
          ay += gy;
        }

        // Mouse gravity (black hole effect)
        if (mouseActive) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < config.mouseRadius) {
            const influence = 1 - dist / config.mouseRadius;
            const [gx, gy] = calculateGravity(
              p.x,
              p.y,
              mouseX,
              mouseY,
              3.0,
              config.gravitationalConstant * config.mouseGravityMultiplier
            );
            // Blend: stronger mouse influence when closer
            ax = ax * (1 - influence * 0.7) + gx * influence;
            ay = ay * (1 - influence * 0.7) + gy * influence;
          }
        }

        // Pulse effect (radial push)
        for (const pulse of pulses) {
          const dx = p.x - pulse.x;
          const dy = p.y - pulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const age = now - pulse.startTime;
          const progress = age / config.pulseDuration;
          const ringRadius = progress * 0.3;
          const ringWidth = 0.08;

          if (Math.abs(dist - ringRadius) < ringWidth) {
            const strength =
              (1 - progress) *
              (1 - Math.abs(dist - ringRadius) / ringWidth) *
              config.pulseStrength;
            if (dist > 0.001) {
              ax += (dx / dist) * strength;
              ay += (dy / dist) * strength;
            }
          }
        }

        // Update velocity (scaled for slower, more contemplative movement)
        const timeScale = config.timeScale;
        p.vx += ax * dt * 60 * timeScale;
        p.vy += ay * dt * 60 * timeScale;

        // Very gentle damping to maintain orbital energy
        p.vx *= 0.9998;
        p.vy *= 0.9998;

        // Update position
        p.x += p.vx * dt * 60 * timeScale;
        p.y += p.vy * dt * 60 * timeScale;

        // Soft boundary wrapping
        const margin = 0.1;
        if (p.x < -margin) p.x = 1 + margin;
        if (p.x > 1 + margin) p.x = -margin;
        if (p.y < -margin) p.y = 1 + margin;
        if (p.y > 1 + margin) p.y = -margin;

        // Update trail
        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > config.trailLength) {
          p.trail.pop();
        }
      }

      // Build trail buffer
      let trailVertexCount = 0;
      for (const p of particles) {
        for (let i = 0; i < p.trail.length - 1; i++) {
          const alpha = (1 - i / config.trailLength) * 0.6;
          trailData[trailVertexCount * 3] = p.trail[i].x;
          trailData[trailVertexCount * 3 + 1] = p.trail[i].y;
          trailData[trailVertexCount * 3 + 2] = alpha;
          trailVertexCount++;

          trailData[trailVertexCount * 3] = p.trail[i + 1].x;
          trailData[trailVertexCount * 3 + 1] = p.trail[i + 1].y;
          trailData[trailVertexCount * 3 + 2] = alpha * 0.7;
          trailVertexCount++;
        }
      }

      // Build particle buffer
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // Speed-based size and alpha
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const normalizedSpeed = Math.min(1, speed * 300);

        particleData[i * 4] = p.x;
        particleData[i * 4 + 1] = p.y;
        particleData[i * 4 + 2] = 0.6 + normalizedSpeed * 0.4; // alpha
        particleData[i * 4 + 3] = 0.7 + normalizedSpeed * 0.5; // size
      }

      // Clear
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Draw trails
      if (trailVertexCount > 0) {
        gl.useProgram(trailProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          trailData.subarray(0, trailVertexCount * 3),
          gl.DYNAMIC_DRAW
        );

        gl.enableVertexAttribArray(trailLocs.aPosition);
        gl.vertexAttribPointer(trailLocs.aPosition, 2, gl.FLOAT, false, 12, 0);
        gl.enableVertexAttribArray(trailLocs.aAlpha);
        gl.vertexAttribPointer(trailLocs.aAlpha, 1, gl.FLOAT, false, 12, 8);

        gl.uniform3fv(trailLocs.uColor, color);
        gl.drawArrays(gl.LINES, 0, trailVertexCount);
      }

      // Draw particles
      gl.useProgram(particleProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);

      gl.enableVertexAttribArray(particleLocs.aPosition);
      gl.vertexAttribPointer(particleLocs.aPosition, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(particleLocs.aAlpha);
      gl.vertexAttribPointer(particleLocs.aAlpha, 1, gl.FLOAT, false, 16, 8);
      gl.enableVertexAttribArray(particleLocs.aSize);
      gl.vertexAttribPointer(particleLocs.aSize, 1, gl.FLOAT, false, 16, 12);

      gl.uniform1f(particleLocs.uPointSize, config.pointSize);
      gl.uniform1f(particleLocs.uDPR, DPR);
      gl.uniform1f(particleLocs.uTime, elapsed);
      gl.uniform3fv(particleLocs.uColor, color);

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
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      gl.deleteBuffer(particleBuffer);
      gl.deleteBuffer(trailBuffer);
      gl.deleteProgram(particleProgram);
      gl.deleteProgram(trailProgram);
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
