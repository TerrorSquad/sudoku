<script setup lang="ts">
import type { Grid } from "../types/sudoku";
import type { Placement } from "../utils/stuckMoments";

// "Your solve in 3D": the finished board as a small city (utils/skyline.ts), each cell a column as
// tall as its digit, the givens in ink and the player's digits from cool (early) to warm (late).
// three.js loads here, on mount, so it stays in its own chunk.
const props = defineProps<{
  puzzle: Grid;
  placements: Placement[];
}>();
const { t } = useI18n();

const host = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();
const failed = ref(false);
const ready = ref(false);
// Reduced motion: no turning by itself, only drag. Read once, like SolveReplay.
const still = useMediaQuery("(prefers-reduced-motion: reduce)").value;

const CELL = 1;
const BOX_GAP = 0.22; // the extra space between 3×3 boxes
const UNIT = 0.36; // column height per digit
const at = (i: number) => i * CELL + Math.floor(i / 3) * BOX_GAP - (8 * CELL + 2 * BOX_GAP) / 2;

let yaw = 0.6;
let pitch = 0.55;
let draw = () => {};
let cleanup = () => {};
let gone = false;
let dragging = false;
let lastX = 0;
let lastY = 0;

onMounted(async () => {
  try {
    const {
      BoxGeometry,
      Color,
      DirectionalLight,
      Group,
      HemisphereLight,
      InstancedMesh,
      MathUtils,
      Matrix4,
      Mesh,
      MeshStandardMaterial,
      PerspectiveCamera,
      Scene,
      SRGBColorSpace,
      WebGLRenderer,
    } = await import("three");
    if (gone || !canvas.value || !host.value) return;
    const renderer = new WebGLRenderer({
      canvas: canvas.value,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // for Save image
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.1, 100);
    scene.add(new HemisphereLight(0xffffff, 0x8f9cad, 2));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-4, 10, 6);
    scene.add(sun);

    const city = new Group();
    scene.add(city);
    const side = 9 * CELL + 2 * BOX_GAP;
    const plateGeometry = new BoxGeometry(side + 0.5, 0.2, side + 0.5);
    const plateMaterial = new MeshStandardMaterial({ color: 0xc2ccd7, roughness: 0.9 });
    const plate = new Mesh(plateGeometry, plateMaterial);
    plate.position.y = -0.1;
    city.add(plate);

    const columns = skylineOf(props.puzzle, props.placements);
    const last = Math.max(1, ...columns.map((col) => col.order));
    const boxGeometry = new BoxGeometry(0.86 * CELL, 1, 0.86 * CELL);
    const boxMaterial = new MeshStandardMaterial({ roughness: 0.65 });
    const mesh = new InstancedMesh(boxGeometry, boxMaterial, columns.length);
    const ink = new Color(0x475870);
    const matrix = new Matrix4();
    const color = new Color();
    columns.forEach((col, i) => {
      const h = Math.max(col.height, 0.2) * UNIT;
      matrix.makeScale(1, h, 1).setPosition(at(col.c), h / 2, at(col.r));
      mesh.setMatrixAt(i, matrix);
      // Blue for the first move, through green and gold, to orange-red for the last.
      const late = last > 1 ? (col.order - 1) / (last - 1) : 0;
      mesh.setColorAt(
        i,
        col.given ? ink : color.setHSL(0.6 - 0.57 * late, 0.65, 0.55, SRGBColorSpace),
      );
    });
    city.add(mesh);

    draw = () => {
      city.rotation.set(pitch, yaw, 0);
      renderer.render(scene, camera);
    };

    // Fit the board (a sphere around it) to the narrower side of the canvas.
    const fit = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = host.value!;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const vfov = MathUtils.degToRad(camera.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      camera.position.set(0, 0, 7.2 / Math.sin(Math.min(vfov, hfov) / 2));
      camera.updateProjectionMatrix();
      draw();
    });
    fit.observe(host.value);

    let frame = 0;
    let before = performance.now();
    const turn = (now: number) => {
      if (!dragging) yaw += ((now - before) / 1000) * 0.18;
      before = now;
      draw();
      frame = requestAnimationFrame(turn);
    };
    if (!still) frame = requestAnimationFrame(turn);

    cleanup = () => {
      cancelAnimationFrame(frame);
      fit.disconnect();
      mesh.dispose();
      for (const x of [boxGeometry, boxMaterial, plateGeometry, plateMaterial]) x.dispose();
      renderer.dispose();
      // Browsers keep only a few WebGL contexts: give this one back now, not at garbage collection.
      renderer.forceContextLoss();
    };
    ready.value = true;
  } catch {
    // No WebGL (or the chunk didn't load): say so instead of a blank box.
    failed.value = true;
  }
});
onUnmounted(() => {
  gone = true;
  cleanup();
});

// Drag to turn it: across for yaw, up and down for pitch (kept between a low view and overhead).
function onDown(e: PointerEvent) {
  dragging = true;
  [lastX, lastY] = [e.clientX, e.clientY];
  canvas.value?.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!dragging) return;
  yaw += (e.clientX - lastX) * 0.01;
  pitch = Math.min(1.45, Math.max(0.1, pitch + (e.clientY - lastY) * 0.01));
  [lastX, lastY] = [e.clientX, e.clientY];
  if (still) draw();
}
function onUp() {
  dragging = false;
}

function save() {
  if (!canvas.value) return;
  const a = document.createElement("a");
  a.href = canvas.value.toDataURL("image/png");
  a.download = "sudoku-skyline.png";
  a.click();
}
</script>

<template>
  <div data-testid="solve-skyline">
    <h2 class="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
      {{ t("modal.skyline") }}
    </h2>
    <p
      v-if="failed"
      class="py-6 text-center text-sm text-zinc-600 dark:text-zinc-400"
      data-testid="skyline-fallback"
    >
      {{ t("modal.skylineNoWebgl") }}
    </p>
    <template v-else>
      <div ref="host" class="mx-auto aspect-square w-full max-w-sm">
        <canvas
          ref="canvas"
          role="img"
          :aria-label="t('modal.skylineLabel')"
          class="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        />
      </div>
      <p class="mt-1 text-center text-xs text-zinc-600 dark:text-zinc-400">
        {{ t("modal.skylineDrag") }}
      </p>
      <div class="mt-2 flex justify-center">
        <button
          class="tile h-8 px-3 text-xs font-bold"
          :disabled="!ready"
          data-testid="skyline-save"
          @click="save"
        >
          {{ t("modal.skylineSave") }}
        </button>
      </div>
    </template>
  </div>
</template>
