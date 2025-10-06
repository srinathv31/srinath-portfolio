"use client";

import { useEffect, useRef } from "react";

export default function ParticleSea() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const diagRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // ---- run only in the browser after mount ----
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    const diag = diagRef.current;
    if (!canvas) return;

    // ========= WebGL particle sea (SEA-LEVEL) =========
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
      if (diag) diag.textContent = "ERROR: WebGL not supported";
      return;
    }

    // Logger
    const log = (m: string) => {
      if (diag) diag.textContent += m + "\n";
    };
    const assert = (cond: boolean, msg: string) =>
      log(`${cond ? "TEST OK" : "TEST FAIL"}: ${msg}`);

    // ----- Shaders (template literals for multiline) -----
    const vert = `
precision mediump float;
attribute vec2 aPos;       // grid coord in [0,1] for XZ tile
uniform vec2 uRes;         // pixels
uniform float uTime;
uniform float uAmp;        // wave height px
uniform float uPix;        // base point size px
uniform float uFreqX;
uniform float uFreqY;
uniform float uSpeed;
uniform vec2 uScroll;      // scroll in tile space (x,z)
uniform float uTileW;      // world tile width (px units)
uniform float uTileD;      // world tile depth (px units)

// Camera
uniform float uCamH;       // camera height (world px)
uniform float uPitch;      // radians, negative looks down
uniform float uFov;        // radians
uniform float uAspect;
uniform float uZPush;      // pushes scene forward in view

// Mouse hover
uniform vec2 uMouse;       // mouse position in tile space (x,z)
uniform float uMouseActive; // 1.0 if mouse is over canvas, 0.0 otherwise
uniform float uMouseRadius; // hover effect radius in tile space

// Ripples (up to 6)
const int MAX_R = 6;
uniform int uRCnt;
uniform vec4 uRip[MAX_R];  // (xNorm,yNorm,start,life) in tile space (x,z)

varying float vGlow;
varying float vDepth;

vec2 rot2(vec2 p, float a){
  float s=sin(a), c=cos(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y);
}

void main(){
  // World position on repeating XZ tile
  float tx = aPos.x + uScroll.x;   // tile space (wrap by fract)
  float tz = aPos.y + uScroll.y;
  vec2 t = fract(vec2(tx, tz));
  float X = (t.x - 0.5) * uTileW;
  float Z = t.y * uTileD;

  // Wave height
  float phase = uTime * uSpeed;
  float w = sin((t.x)*uFreqX + phase) * 0.7 + cos((t.y)*uFreqY + phase*0.9) * 0.3;

  // Mouse hover effect
  float mouseEffect = 0.0; float mouseSizeBoost = 0.0;
  if(uMouseActive > 0.5) {
    // Compare wrapped tile positions directly (both in 0-1 space)
    vec2 particlePos = t; // wrapped position after fract()
    vec2 mousePos = uMouse; // absolute mouse position (already in tile space)
    // Calculate wrapped distance (handles tile boundaries)
    vec2 delta = particlePos - mousePos;
    delta = abs(fract(delta + 0.5) - 0.5);
    float mouseDist = length(delta);
    // Smooth falloff from center to radius
    float influence = 1.0 - smoothstep(0.0, uMouseRadius, mouseDist);
    mouseEffect = influence * 0.8; // height boost
    mouseSizeBoost = influence * 1.2; // size boost
  }

  // Ripples
  float extra = 0.0; float sizeBoost = 0.0;
  for(int i=0;i<MAX_R;i++){
    if(i>=uRCnt) break;
    vec2 c = uRip[i].xy; // ripple center in aPos space
    // Apply current scroll to ripple position
    vec2 ripplePos = c + uScroll;
    // Calculate wrapped distance
    vec2 delta = vec2(tx, tz) - ripplePos;
    delta = abs(fract(delta + 0.5) - 0.5);
    float d = length(delta);
    float t0 = uRip[i].z; float life = uRip[i].w; float tt = max(uTime - t0, 0.0);
    float prog = clamp(tt/life, 0.0, 1.0);
    float radius = prog * 0.6; // up to 60% of tile
    float ring = 1.0 - smoothstep(radius-0.02, radius+0.02, d);
    extra += ring * (1.0 - prog);
    sizeBoost += ring * (1.0 - prog);
  }

  float Y = (w * uAmp) + extra * (uAmp * 0.9) + mouseEffect * (uAmp * 1.0);

  // Camera transform: camera at (0,uCamH,0), looking +Z
  float cx = X; float cy = Y - uCamH; float cz = Z;
  vec2 ryz = rot2(vec2(cy, cz), uPitch); // rotate around X
  float y2 = ryz.x;
  float z2 = ryz.y + uZPush; // push scene forward

  // Perspective projection with proper NDC depth
  float f = 1.0 / tan(uFov * 0.5);
  float ndcX = (cx * f / uAspect) / max(z2, 0.1); // prevent division by very small numbers
  float ndcY = (y2 * f) / max(z2, 0.1);
  float ndcZ = clamp(z2 / 5000.0, -1.0, 1.0); // map depth to [-1,1] range

  vDepth = z2;
  vGlow = clamp(0.25 + 0.55*abs(w) + 0.9*extra + 0.8*mouseEffect, 0.0, 1.8);

  gl_Position = vec4(-ndcX, ndcY, ndcZ, 0.5);

  // Distance-based size falloff with better scaling
  float distScale = clamp(800.0 / (50.0 + z2), 0.3, 2.5);
  gl_PointSize = max(1.0, (uPix * (1.0 + (0.6*abs(w)) + (0.9*sizeBoost) + mouseSizeBoost) * distScale));
}
    `;

    const frag = `
precision mediump float;
varying float vGlow;
varying float vDepth;
uniform vec3 uColor;
void main(){
  vec2 uv = gl_PointCoord*2.0-1.0;
  float r = length(uv);
  // Safe alpha: 1 center -> 0 edge
  float alpha = 1.0 - smoothstep(0.0, 1.0, r);
  // Gentle depth fog for horizon
  float fog = clamp(exp(-vDepth*0.0008), 0.05, 1.0);
  vec3 base = uColor * (0.55 + 0.7*vGlow) * fog;
  gl_FragColor = vec4(base, alpha * (0.85 * fog));
}
    `;

    function compile(type: number, src: string, label: string) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      const ok = gl.getShaderParameter(s, gl.COMPILE_STATUS);
      log(`TEST ${label} compile: ${ok ? "OK" : "FAIL"}`);
      if (!ok) log(gl.getShaderInfoLog(s) || "no shader infoLog");
      return s;
    }
    function program(vs: WebGLShader, fs: WebGLShader) {
      const p = gl.createProgram()!;
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      const ok = gl.getProgramParameter(p, gl.LINK_STATUS);
      log(`TEST program link: ${ok ? "OK" : "FAIL"}`);
      if (!ok) log(gl.getProgramInfoLog(p) || "no program infoLog");
      return p;
    }

    const prog = program(
      compile(gl.VERTEX_SHADER, vert, "vertex"),
      compile(gl.FRAGMENT_SHADER, frag, "fragment")
    );
    gl.useProgram(prog);

    // ----- Uniform/Attrib locations -----
    const loc = {
      aPos: gl.getAttribLocation(prog, "aPos"),
      uRes: gl.getUniformLocation(prog, "uRes"),
      uTime: gl.getUniformLocation(prog, "uTime"),
      uAmp: gl.getUniformLocation(prog, "uAmp"),
      uPix: gl.getUniformLocation(prog, "uPix"),
      uFreqX: gl.getUniformLocation(prog, "uFreqX"),
      uFreqY: gl.getUniformLocation(prog, "uFreqY"),
      uSpeed: gl.getUniformLocation(prog, "uSpeed"),
      uScroll: gl.getUniformLocation(prog, "uScroll"),
      uTileW: gl.getUniformLocation(prog, "uTileW"),
      uTileD: gl.getUniformLocation(prog, "uTileD"),
      uCamH: gl.getUniformLocation(prog, "uCamH"),
      uPitch: gl.getUniformLocation(prog, "uPitch"),
      uFov: gl.getUniformLocation(prog, "uFov"),
      uAspect: gl.getUniformLocation(prog, "uAspect"),
      uZPush: gl.getUniformLocation(prog, "uZPush"),
      uColor: gl.getUniformLocation(prog, "uColor"),
      uRip: gl.getUniformLocation(prog, "uRip[0]"),
      uRCnt: gl.getUniformLocation(prog, "uRCnt"),
      uMouse: gl.getUniformLocation(prog, "uMouse"),
      uMouseActive: gl.getUniformLocation(prog, "uMouseActive"),
      uMouseRadius: gl.getUniformLocation(prog, "uMouseRadius"),
    };
    assert((loc.aPos as number) >= 0, "attrib aPos present");

    // ----- Grid (tile coords 0..1) -----
    const isMobile = window.innerWidth < 768;
    let spacing = isMobile ? 18 : 24; // pixels between particles (wheel adjusts)
    let positions = new Float32Array(0);
    let count = 0;
    const buffer = gl.createBuffer()!;
    const tileW = 900; // narrower tile to keep within FOV
    const tileD = 1200; // depth of tile

    function rebuild() {
      // Calculate base grid size from spacing
      const w = Math.max(1, Math.floor(canvas.width / spacing));
      const h = Math.max(1, Math.floor(canvas.height / (spacing * 0.7))); // a bit denser in depth

      // Ensure minimum columns on narrow screens to avoid "line" effect
      const minCols = 25; // minimum columns regardless of screen width
      const cols = Math.max(minCols, w + 6);
      const rows = h + 8;

      count = cols * rows;
      positions = new Float32Array(count * 2);
      let i = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          positions[i++] = x / (cols - 1);
          positions[i++] = y / (rows - 1);
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }

    function resize() {
      const w = Math.floor(window.innerWidth * DPR);
      const h = Math.floor(window.innerHeight * DPR);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        rebuild();
      }
    }
    window.addEventListener("resize", resize, { passive: true });
    resize();

    // ----- Attributes -----
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc.aPos as number);
    gl.vertexAttribPointer(loc.aPos as number, 2, gl.FLOAT, false, 0, 0);

    // ----- GL State -----
    gl.clearColor(0, 0, 0, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // ----- Uniforms (static-ish) -----
    const color = [0x69 / 255, 0xe5 / 255, 0xff / 255];
    gl.uniform3fv(loc.uColor, color);
    gl.uniform1f(loc.uAmp, 15.0 * DPR); // Increased wave amplitude for more dramatic effect
    gl.uniform1f(
      loc.uPix,
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 3.2
        : 4.0) * DPR
    );
    gl.uniform1f(loc.uFreqX, 22.0);
    gl.uniform1f(loc.uFreqY, 18.0);
    gl.uniform1f(loc.uSpeed, 1.2);
    gl.uniform1f(loc.uCamH, 80.0 * DPR); // Lower camera, slightly above water
    gl.uniform1f(loc.uPitch, -0.15); // Looking slightly downward to push horizon up
    gl.uniform1f(loc.uFov, 1.2); // Wider FOV for more expansive view
    gl.uniform1f(loc.uTileW, tileW);
    gl.uniform1f(loc.uTileD, tileD);
    gl.uniform1f(loc.uZPush, -50.0); // Negative to pull scene back

    // Mouse hover setup
    gl.uniform1f(loc.uMouseRadius, 0.12); // hover effect radius in tile space
    gl.uniform1f(loc.uMouseActive, 0.0); // initially no mouse
    gl.uniform2f(loc.uMouse, 0.5, 0.5);

    let scrollX = 0,
      scrollY = 0; // tile-space scroll (x,z)
    let mouseX = 0.5,
      mouseY = 0.5; // mouse position in tile space
    let mouseActive = false;

    // ----- Ripples -----
    const MAX_R = 6;
    const rip = new Float32Array(MAX_R * 4);
    let rCount = 0;
    function addRipple(nx: number, ny: number) {
      for (let i = MAX_R - 1; i > 0; i--) {
        rip[i * 4 + 0] = rip[(i - 1) * 4 + 0];
        rip[i * 4 + 1] = rip[(i - 1) * 4 + 1];
        rip[i * 4 + 2] = rip[(i - 1) * 4 + 2];
        rip[i * 4 + 3] = rip[(i - 1) * 4 + 3];
      }
      rip[0] = nx;
      rip[1] = ny;
      rip[2] = now();
      rip[3] = 1.2;
      rCount = Math.min(rCount + 1, MAX_R);
    }
    function now() {
      return performance.now() / 1000;
    }

    // Screen -> tile coords for click ripples
    let dragging = false,
      lastX = 0,
      lastY = 0,
      pitch = 0.15; // Match initial pitch
    const zPush = -50.0; // Match uZPush value
    function screenToWorldTile(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      const nx = -(((clientX - rect.left) / rect.width) * 2 - 1); // -1..1 (negated to match shader flip)
      const ny = ((clientY - rect.top) / rect.height) * 2 - 1; // -1..1

      const aspect = rect.width / rect.height;
      const fov = 1.2;
      const f = 1 / Math.tan(fov * 0.5);
      const camH = 80 * DPR; // Match camera height

      // camera ray in camera space (before rotation)
      let dir = { x: (nx * aspect) / f, y: -ny / f, z: 1 };
      // rotate around X by current pitch
      const s = Math.sin(pitch),
        c = Math.cos(pitch);
      const y2 = c * dir.y - s * dir.z;
      const z2 = s * dir.y + c * dir.z;
      dir = { x: dir.x, y: y2, z: z2 };

      // Account for zPush in world origin
      const origin = { x: 0, y: camH, z: -zPush };

      // Only calculate intersection if ray is pointing down
      if (dir.y >= 0) return [0.5, 0.5] as const;

      const t = -origin.y / dir.y; // intersect plane y=0
      const hitX = origin.x + dir.x * t;
      const hitZ = origin.z + dir.z * t;

      // World -> tile [0,1] with wrapping (no scroll adjustment for fixed position)
      const xNorm = hitX / tileW + 0.5;
      const zNorm = hitZ / tileD;
      const u = ((xNorm % 1) + 1) % 1;
      const v = ((zNorm % 1) + 1) % 1;
      return [u, v] as const;
    }

    canvas.addEventListener("pointerdown", (e) => {
      dragging = e.button === 1 || e.shiftKey; // MMB or shift-drag to look
      lastX = e.clientX;
      lastY = e.clientY;
      if (!dragging) {
        const [u, v] = screenToWorldTile(e.clientX, e.clientY);
        // Store ripple position relative to current scroll so it stays fixed
        const ripX = (((u - scrollX) % 1) + 1) % 1;
        const ripY = (((v - scrollY) % 1) + 1) % 1;
        addRipple(ripX, ripY);
      }
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      pitch = Math.max(-0.3, Math.min(0.4, pitch + dy * -0.002)); // Allow looking up and down
      gl.uniform1f(loc.uPitch!, pitch);
      scrollX += dx * 0.0006; // slight lateral drift when looking
    });
    window.addEventListener("pointerup", () => (dragging = false));
    window.addEventListener("pointercancel", () => (dragging = false));

    window.addEventListener(
      "wheel",
      (e) => {
        spacing = Math.min(60, Math.max(14, spacing + (e.deltaY > 0 ? 2 : -2)));
        rebuild();
      },
      { passive: true }
    );

    // Mouse hover tracking
    canvas.addEventListener("mousemove", (e) => {
      const [u, v] = screenToWorldTile(e.clientX, e.clientY);
      // Store absolute mouse position (not relative to scroll)
      // The shader will handle the scroll comparison
      mouseX = u;
      mouseY = v;
      mouseActive = true;
    });
    canvas.addEventListener("mouseenter", () => {
      mouseActive = true;
    });
    canvas.addEventListener("mouseleave", () => {
      mouseActive = false;
    });

    // ----- Animation -----
    const start = now();
    let rafId = 0;
    function frame() {
      const t = now() - start;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(loc.uRes!, canvas.width, canvas.height);
      gl.uniform1f(loc.uTime!, t);

      // Endless forward drift along Z, slight sideways wander
      scrollY = (scrollY + 0.008) % 1.0; // Slower forward movement
      scrollX = (scrollX + Math.sin(t * 0.1) * 0.0002) % 1.0; // Gentle wander
      gl.uniform2f(loc.uScroll!, scrollX, scrollY);

      gl.uniform1i(loc.uRCnt!, rCount);
      gl.uniform4fv(loc.uRip!, rip);

      // Update mouse position
      gl.uniform2f(loc.uMouse!, mouseX, mouseY);
      gl.uniform1f(loc.uMouseActive!, mouseActive ? 1.0 : 0.0);

      // Update aspect each frame (in case of resize)
      const aspect = canvas.width / canvas.height;
      gl.uniform1f(loc.uAspect!, aspect);

      gl.drawArrays(gl.POINTS, 0, count);
      rafId = requestAnimationFrame(frame);
    }

    // ----- Runtime Tests (Added) -----
    (function runTests() {
      rebuild();
      log("TEST buffer size (floats): " + positions.length);
      assert(positions.length > 0, "positions not empty");

      const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
      log(
        "TEST point size range: " +
          range[0].toFixed(2) +
          " .. " +
          range[1].toFixed(2)
      );
      assert(range && range[1] >= 4.0, "hardware supports visible point sizes");

      assert(
        !!loc.uRes && !!loc.uTime && !!loc.uZPush,
        "uniforms present (uRes,uTime,uZPush)"
      );

      const err = gl.getError();
      log(
        "TEST gl.getError after init: " +
          (err === gl.NO_ERROR ? "NO_ERROR" : "0x" + err.toString(16))
      );
    })();

    rafId = requestAnimationFrame(frame);

    // ---- CLEANUP (prevents stale GL state on fast refresh) ----
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.useProgram(null);
    };
  }, []);

  return (
    <>
      {/* Canvas fixed behind the page */}
      <canvas
        id="gl"
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          outline: "none",
        }}
        aria-hidden="true"
      />
      {/* Diagnostics box (optional) */}
      <div
        ref={diagRef}
        style={{
          position: "fixed",
          right: 10,
          top: 10,
          maxWidth: "min(46vw, 520px)",
          maxHeight: "40vh",
          overflow: "auto",
          font: "12px/1.4 ui-monospace,Consolas,monospace",
          background: "rgba(0,0,0,.45)",
          color: "#d1fae5",
          border: "1px solid rgba(255,255,255,.15)",
          padding: "8px 10px",
          borderRadius: 10,
          boxShadow: "0 8px 30px rgba(0,0,0,.35)",
          whiteSpace: "pre-wrap",
        }}
        aria-live="polite"
      />
      {/* Helper text */}
      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 12,
          fontSize: 12,
          opacity: 0.75,
          userSelect: "none",
          letterSpacing: ".02em",
        }}
      >
        Sea-level particles: hover = reactive • click / tap to ripple • wheel =
        density • Shift+drag or MMB = look
      </div>
    </>
  );
}
