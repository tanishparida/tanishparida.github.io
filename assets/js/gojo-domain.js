(function () {
  const container = document.getElementById('domain-expansion-background');
  if (!container || !window.THREE) return;

  const vertexShader = `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    uniform float uTwinkleAmplitude;
    uniform float uTwinkleSpeed;
    varying float vTwinkle;

    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vTwinkle = 1.0 - uTwinkleAmplitude + uTwinkleAmplitude * sin(uTime * uTwinkleSpeed + aPhase);
      gl_PointSize = aSize * vTwinkle * (42.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    varying float vTwinkle;

    void main() {
      float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
      float glow = 1.0 - smoothstep(0.08, 0.5, distanceFromCenter);
      if (glow < 0.02) discard;
      gl_FragColor = vec4(uColor, glow * vTwinkle);
    }
  `;

  function createStars(count, spread, size, color, seed, twinkleAmplitude, twinkleSpeed) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    let state = seed;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };

    for (let i = 0; i < count; i += 1) {
      const index = i * 3;
      positions[index] = (random() - 0.5) * spread.x;
      positions[index + 1] = (random() - 0.5) * spread.y;
      positions[index + 2] = -2 - random() * spread.z;
      sizes[i] = size * (0.65 + random() * 0.7);
      phases[i] = random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTwinkleAmplitude: { value: twinkleAmplitude },
        uTwinkleSpeed: { value: twinkleSpeed },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return new THREE.Points(geometry, material);
  }

  // Milky Way: a band-shaped brightness field (with dark dust lanes) computed once on the CPU.
  // The same field drives the diffuse glow texture and where the band's extra stars are placed,
  // so the stars thin out inside the dust lanes the way they do in long-exposure photos.
  const BAND = {
    angle: (26 * Math.PI) / 180, // tilt of the band, rising to the right
    offset: { x: 0, y: 2.5 }, // where the band's centre line crosses the middle of the screen
    coreU: 1, // galactic centre position along the band
    halfLength: 60,
    halfWidth: 22,
    planeDepth: 25, // distance from camera to the glow plane
  };

  function createNoise(seed) {
    let state = seed;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const size = 256;
    const values = new Float32Array(size * size);
    for (let i = 0; i < values.length; i += 1) values[i] = random();
    const smooth = (t) => t * t * (3 - 2 * t);
    const lattice = (x, y) => values[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
    const noise = (x, y) => {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const sx = smooth(x - x0);
      const sy = smooth(y - y0);
      const top = lattice(x0, y0) + (lattice(x0 + 1, y0) - lattice(x0, y0)) * sx;
      const bottom = lattice(x0, y0 + 1) + (lattice(x0 + 1, y0 + 1) - lattice(x0, y0 + 1)) * sx;
      return top + (bottom - top) * sy;
    };
    return (x, y, octaves) => {
      let total = 0;
      let amplitude = 0.5;
      let frequency = 1;
      let norm = 0;
      for (let o = 0; o < octaves; o += 1) {
        total += amplitude * noise(x * frequency, y * frequency);
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2.03;
      }
      return total / norm;
    };
  }

  const fbm = createNoise(7);
  const bandWidth = (u) => 2.3 + 1.7 * Math.exp(-(((u - BAND.coreU) / 9) ** 2));
  const coreWeight = (u) => Math.exp(-(((u - BAND.coreU) / 13) ** 2));

  // Brightness (0-1) and core warmth (0-1) at band coordinates (u along, v across).
  function bandField(u, v) {
    const w = bandWidth(u);
    const across = Math.exp(-1.6 * (v / w) ** 2);
    const along = (0.45 + 0.55 * coreWeight(u)) * Math.min(1, Math.max(0, (BAND.halfLength - Math.abs(u)) / 12));
    const clumps = 0.3 + 0.55 * fbm(u * 0.45 + 31, v * 0.7 + 7, 6) + 0.3 * fbm(u * 1.6 + 5, v * 1.6 + 2, 3);
    // Dust lanes: filaments hugging the centre line, densest towards the core.
    const dustNoise = fbm(u * 0.3 + 3, v * 1.1 - 11, 6);
    const dustMask = Math.exp(-(((v + 0.25) / (w * 0.5)) ** 2));
    const dust = Math.min(1, Math.max(0, (dustNoise - 0.4) / 0.32)) ** 1.5 * dustMask * (0.6 + 0.4 * coreWeight(u));
    const halo = 0.22 * Math.exp(-((v / (w * 2.4)) ** 2));
    const edgeFade = Math.max(0, 1 - (v / BAND.halfWidth) ** 2) ** 2;
    const brightness = along * edgeFade * ((across * clumps + halo) * (1 - 0.9 * dust));
    return { brightness: Math.min(1, brightness), warmth: coreWeight(u) * across };
  }

  function createMilkyWayTexture() {
    const width = 1024;
    const height = 256;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      const v = (y / (height - 1) - 0.5) * 2 * BAND.halfWidth;
      for (let x = 0; x < width; x += 1) {
        const u = (x / (width - 1) - 0.5) * 2 * BAND.halfLength;
        const { brightness, warmth } = bandField(u, v);
        const index = (y * width + x) * 4;
        data[index] = Math.round(brightness * 255);
        data[index + 1] = Math.round(warmth * 255);
        data[index + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function createMilkyWayGlow() {
    const direction = new THREE.Vector2(Math.cos(BAND.angle), Math.sin(BAND.angle));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uField: { value: createMilkyWayTexture() },
        uDirection: { value: direction },
        uOffset: { value: new THREE.Vector2(BAND.offset.x, BAND.offset.y) },
        uExtent: { value: new THREE.Vector2(BAND.halfLength, BAND.halfWidth) },
        uIntensity: { value: 0.3 },
      },
      vertexShader: `
        varying vec2 vPosition;
        void main() {
          vPosition = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uField;
        uniform vec2 uDirection;
        uniform vec2 uOffset;
        uniform vec2 uExtent;
        uniform float uIntensity;
        varying vec2 vPosition;
        void main() {
          vec2 p = vPosition - uOffset;
          float u = dot(p, uDirection);
          float v = dot(p, vec2(-uDirection.y, uDirection.x));
          vec2 uv = vec2(u / uExtent.x, v / uExtent.y) * 0.5 + 0.5;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          vec4 field = texture2D(uField, uv);
          vec3 cool = vec3(0.58, 0.64, 0.8);
          vec3 warm = vec3(1.0, 0.84, 0.64);
          vec3 color = mix(cool, warm, clamp(field.g * 1.3, 0.0, 1.0));
          float alpha = field.r * uIntensity;
          gl_FragColor = vec4(color * alpha, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      // Premultiplied additive blending: keeps the canvas alpha in step with its colour so the
      // faint outer glow isn't dropped (and cut off with a hard edge) when composited.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), material);
    plane.position.z = 5 - BAND.planeDepth;
    return plane;
  }

  // Extra stars packed into the band, placed by rejection sampling against the brightness field.
  function createMilkyWayStars(count, size, color, seed) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    let state = seed;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const gaussian = () => Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(2 * Math.PI * random());
    const cos = Math.cos(BAND.angle);
    const sin = Math.sin(BAND.angle);

    for (let i = 0; i < count; ) {
      const u = random() < 0.35 ? BAND.coreU + gaussian() * 12 : (random() - 0.5) * 2 * BAND.halfLength;
      const v = gaussian() * bandWidth(u) * 0.7;
      if (random() > 0.03 + 0.97 * bandField(u, v).brightness) continue;

      // Point on the glow plane, then pushed to a random depth along the same line of sight.
      const planeX = BAND.offset.x + u * cos - v * sin;
      const planeY = BAND.offset.y + u * sin + v * cos;
      const depth = 8 + random() * (BAND.planeDepth - 8);
      const scale = depth / BAND.planeDepth;
      const index = i * 3;
      positions[index] = planeX * scale;
      positions[index + 1] = planeY * scale;
      positions[index + 2] = 5 - depth;
      sizes[i] = size * (0.5 + random() * 0.8);
      phases[i] = random() * Math.PI * 2;
      i += 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTwinkleAmplitude: { value: 0.005 },
        uTwinkleSpeed: { value: 0.025 },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geometry, material);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Dense, dim stars create the texture; the smaller bright layer adds depth.
  const dimStars = createStars(30000, { x: 42, y: 28, z: 30 }, 0.045, 0x9db9e8, 17, 0.005, 0.025);
  const brightStars = createStars(7000, { x: 38, y: 25, z: 25 }, 0.075, 0xeaf3ff, 91, 0.005, 0.025);
  scene.add(dimStars, brightStars);

  const milkyWay = new THREE.Group();
  const milkyWayStars = createMilkyWayStars(45000, 0.05, 0xf3e6d2, 53);
  const milkyWayBrightStars = createMilkyWayStars(6000, 0.08, 0xfff6ea, 211);
  milkyWay.add(createMilkyWayGlow(), milkyWayStars, milkyWayBrightStars);
  scene.add(milkyWay);

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', resize);

  function animate(time) {
    const seconds = (time || 0) * 0.001;
    dimStars.material.uniforms.uTime.value = seconds;
    brightStars.material.uniforms.uTime.value = seconds;
    dimStars.rotation.z = seconds * 0.0015;
    brightStars.rotation.z = -seconds * 0.002;
    milkyWayStars.material.uniforms.uTime.value = seconds;
    milkyWayBrightStars.material.uniforms.uTime.value = seconds;
    milkyWay.rotation.z = seconds * 0.0015;
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }
  animate(0);
})();
