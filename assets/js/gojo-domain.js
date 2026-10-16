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
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }
  animate(0);
})();
