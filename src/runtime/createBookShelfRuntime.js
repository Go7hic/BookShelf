import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { workingShelves } from "../data/workingVolumes";

const OPENING_ENVIRONMENT_CLEAR_PROGRESS = 0.24;
const CLOSING_ENVIRONMENT_REVEAL_PROGRESS = 0.72;
const OPEN_DURATION = 740;
const CLOSE_DURATION = 680;
const LEVEL_DURATION = 460;
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const mod = (value, length) => ((value % length) + length) % length;
const damp = (current, target, smoothing, delta) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta));
const easeOut = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 4);
const easeInOut = (value) => {
  const safe = clamp(value, 0, 1);
  return safe < 0.5 ? 8 * safe ** 4 : 1 - Math.pow(-2 * safe + 2, 4) / 2;
};

function getLevelStart(levelSizes, level) {
  return levelSizes.slice(0, level).reduce((sum, size) => sum + size, 0);
}

function getBookLevel(levelSizes, index) {
  let cursor = 0;
  for (let level = 0; level < levelSizes.length; level += 1) {
    cursor += levelSizes[level];
    if (index < cursor) return level;
  }
  return levelSizes.length - 1;
}

function updateText(element, value) {
  if (element) element.textContent = value;
}

function setInert(element, value) {
  if (!element) return;
  if (value) element.setAttribute("inert", "");
  else element.removeAttribute("inert");
}

function makeCoverTexture(book) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1040;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BookShelf could not create a cover canvas.");

  const { width, height } = canvas;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, book.color);
  gradient.addColorStop(1, book.palette.paperDeep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.18;
  context.strokeStyle = book.palette.paperPale;
  context.lineWidth = 1;
  for (let y = 22; y < height; y += 18) {
    context.beginPath();
    context.moveTo(0, y + ((book.seed * 7) % 13));
    context.lineTo(width, y);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.fillStyle = book.foil;
  context.font = "600 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.letterSpacing = "3px";
  context.fillText(`VOLUME ${book.roman}`, 58, 68);
  context.font = "500 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(book.discipline.toUpperCase(), 58, 98);

  drawMotif(context, book, width / 2, 495);

  context.fillStyle = book.palette.paperPale;
  context.font = "500 68px Georgia, Times New Roman, serif";
  context.textAlign = "center";
  const title = book.title.length > 13 ? 52 : 68;
  context.font = `500 ${title}px Georgia, Times New Roman, serif`;
  context.fillText(book.title, width / 2, 895);
  context.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("BOOKSHELF EDITION", width / 2, 940);
  context.textAlign = "start";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawMotif(context, book, centerX, centerY) {
  const stroke = book.foil;
  context.save();
  context.strokeStyle = stroke;
  context.fillStyle = stroke;
  context.lineWidth = 7;
  context.globalAlpha = 0.9;

  if (book.motifKey === "brackets") {
    for (let step = 0; step < 5; step += 1) {
      const inset = step * 30;
      context.beginPath();
      context.moveTo(centerX - 170 + inset, centerY - 190 + inset);
      context.lineTo(centerX - 225 + inset, centerY - 190 + inset);
      context.lineTo(centerX - 225 + inset, centerY + 190 - inset);
      context.lineTo(centerX - 170 + inset, centerY + 190 - inset);
      context.stroke();
    }
  } else if (book.motifKey === "paths") {
    for (let step = 0; step < 6; step += 1) {
      context.beginPath();
      context.arc(centerX, centerY, 58 + step * 28, 0.2, Math.PI * 1.8);
      context.stroke();
    }
    context.beginPath();
    context.moveTo(centerX - 215, centerY + 128);
    context.bezierCurveTo(centerX - 70, centerY - 90, centerX + 60, centerY + 155, centerX + 222, centerY - 130);
    context.stroke();
  } else if (book.motifKey === "caret") {
    for (let step = 0; step < 8; step += 1) {
      const inset = step * 23;
      context.beginPath();
      context.moveTo(centerX - 170 + inset, centerY - 190 + inset * 0.45);
      context.lineTo(centerX + 145 - inset * 0.6, centerY);
      context.lineTo(centerX - 170 + inset, centerY + 190 - inset * 0.45);
      context.stroke();
    }
  } else if (book.motifKey === "orbits") {
    for (let step = 0; step < 4; step += 1) {
      context.save();
      context.translate(centerX, centerY);
      context.rotate(step * 0.67);
      context.beginPath();
      context.ellipse(0, 0, 220 - step * 28, 70 + step * 15, 0, 0, TAU);
      context.stroke();
      context.restore();
    }
    context.beginPath();
    context.arc(centerX, centerY, 24, 0, TAU);
    context.fill();
  } else if (book.motifKey === "modules") {
    for (let row = -1; row <= 1; row += 1) {
      for (let column = -1; column <= 1; column += 1) {
        const size = 64 + ((row + column + 4) % 2) * 24;
        context.strokeRect(centerX + column * 118 - size / 2, centerY + row * 118 - size / 2, size, size);
      }
    }
  } else if (book.motifKey === "frames") {
    for (let step = 0; step < 6; step += 1) {
      const size = 270 - step * 35;
      context.strokeRect(centerX - size / 2 + step * 12, centerY - size / 2 + step * 12, size, size);
    }
  } else {
    context.beginPath();
    context.arc(centerX, centerY, 115, 0, TAU);
    context.stroke();
    context.beginPath();
    context.moveTo(centerX - 148, centerY + 198);
    context.lineTo(centerX + 56, centerY - 104);
    context.lineTo(centerX + 148, centerY + 198);
    context.stroke();
    context.beginPath();
    context.arc(centerX + 55, centerY - 104, 18, 0, TAU);
    context.fill();
  }

  context.restore();
}

function createVolume(book) {
  const root = new THREE.Group();
  root.name = `BookShelf volume ${book.id}`;
  const width = book.width * 0.9;
  const height = book.height * 1.42;
  const depth = book.depth * 1.85;
  const materials = [];
  const coverTexture = makeCoverTexture(book);
  const cloth = new THREE.MeshStandardMaterial({ color: book.color, roughness: 0.72, metalness: 0.03, transparent: true });
  const page = new THREE.MeshStandardMaterial({ color: book.palette.paperPale, roughness: 0.92, transparent: true });
  const foil = new THREE.MeshStandardMaterial({ color: book.foil, roughness: 0.31, metalness: 0.58, transparent: true });
  const artwork = new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.66, metalness: 0.02, transparent: true });
  materials.push(cloth, page, foil, artwork);

  const pageBlock = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, height * 0.94, depth * 0.78), page);
  pageBlock.position.z = 0;
  root.add(pageBlock);

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth * 0.16), cloth);
  back.position.z = -depth * 0.46;
  root.add(back);

  const coverPivot = new THREE.Group();
  coverPivot.position.set(-width / 2, 0, depth * 0.49);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth * 0.14), cloth);
  cover.position.x = width / 2;
  coverPivot.add(cover);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.91, height * 0.91), artwork);
  art.position.set(width / 2, 0, depth * 0.079);
  coverPivot.add(art);
  root.add(coverPivot);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(depth * 0.2, height * 0.98, depth * 1.02), foil);
  spine.position.set(-width * 0.505, 0, 0);
  root.add(spine);

  const pageLines = new THREE.Group();
  for (let index = 0; index < 5; index += 1) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.8, 0.009, depth * 0.78),
      new THREE.MeshBasicMaterial({ color: book.foil, transparent: true, opacity: 0.32 }),
    );
    materials.push(line.material);
    line.position.y = -height * 0.35 + index * height * 0.17;
    line.position.z = depth * 0.42;
    pageLines.add(line);
  }
  root.add(pageLines);

  return {
    book,
    root,
    coverPivot,
    pageLines,
    materials,
    coverTexture,
    hit: art,
    dimensions: { width, height, depth },
    target: new THREE.Vector3(),
    targetRotation: new THREE.Euler(),
    coverTarget: 0,
    pageTarget: 0,
    opacity: 1,
  };
}

function disposeObject(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
  });
}

export function createBookShelfRuntime(experience, options = {}) {
  const shelves = options.shelves
    ?.filter((shelf) => shelf.length > 0)
    .map((shelf) => [...shelf]);
  const resolvedShelves = shelves?.length ? shelves : workingShelves;
  const catalog = resolvedShelves.flat();
  const levelSizes = resolvedShelves.map((shelf) => shelf.length);
  const sceneCanvas = experience.querySelector('[data-shelf="scene"]');
  const paletteLabel = experience.querySelector('[data-shelf="palette-label"]');
  const levelCounter = experience.querySelector('[data-shelf="level-counter"]');
  const pointerLabel = experience.querySelector('[data-shelf="pointer-label"]');
  const pointerLabelIndex = experience.querySelector('[data-shelf="pointer-label-index"]');
  const pointerLabelTitle = experience.querySelector('[data-shelf="pointer-label-title"]');
  const browseUi = experience.querySelector('[data-shelf="browse-ui"]');
  const counter = experience.querySelector('[data-shelf="counter"]');
  const selectionTitle = experience.querySelector('[data-shelf="selection-title"]');
  const selectionNote = experience.querySelector('[data-shelf="selection-note"]');
  const previousButton = experience.querySelector('[data-shelf="previous"]');
  const inspectButton = experience.querySelector('[data-shelf="inspect"]');
  const nextButton = experience.querySelector('[data-shelf="next"]');
  const markers = experience.querySelector('[data-shelf="markers"]');
  const detailPanel = experience.querySelector('[data-shelf="detail-panel"]');
  const closeDetailButton = experience.querySelector('[data-shelf="close-detail"]');
  const detailEyebrow = experience.querySelector('[data-shelf="detail-eyebrow"]');
  const detailTitle = experience.querySelector('[data-shelf="detail-title"]');
  const detailDeck = experience.querySelector('[data-shelf="detail-deck"]');
  const detailBinding = experience.querySelector('[data-shelf="detail-binding"]');
  const detailFormat = experience.querySelector('[data-shelf="detail-format"]');
  const detailTheme = experience.querySelector('[data-shelf="detail-theme"]');
  const detailMotif = experience.querySelector('[data-shelf="detail-motif"]');
  const previousPageButton = experience.querySelector('[data-shelf="previous-page"]');
  const pageLabel = experience.querySelector('[data-shelf="page-label"]');
  const pageCounter = experience.querySelector('[data-shelf="page-counter"]');
  const nextPageButton = experience.querySelector('[data-shelf="next-page"]');
  const toggleBookButton = experience.querySelector('[data-shelf="toggle-book"]');
  const resetViewButton = experience.querySelector('[data-shelf="reset-view"]');
  const liveRegion = experience.querySelector('[data-shelf="live-region"]');
  const fallbackStatus = experience.querySelector('[data-shelf="fallback-status"]');
  const loading = experience.querySelector('[data-shelf="loading"]');

  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  let destroyed = false;
  let frame = 0;
  let lastTime = performance.now();
  let wheelTotal = 0;
  let wheelTimer = 0;
  let wheelLocked = false;
  let transition = null;
  let levelMotion = null;
  let mode = "browse";
  let readingOpen = false;
  let pageIndex = 0;
  let currentIndex = clamp(Math.trunc(options.initialIndex || 0), 0, catalog.length - 1);
  let currentLevel = getBookLevel(levelSizes, currentIndex);
  let hoverIndex = -1;
  let pointerDown = null;

  try {
    if (!sceneCanvas) throw new Error("BookShelf could not find its scene canvas.");
    if (loading) loading.hidden = false;

    const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    const browseCamera = new THREE.Vector3(0, 1.25, 7.6);
    const detailCamera = new THREE.Vector3(0, 0.18, 5.05);
    camera.position.copy(browseCamera);
    const cameraTarget = new THREE.Vector3(0, 0.35, 0);
    const controls = new OrbitControls(camera, sceneCanvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.enabled = false;
    controls.minDistance = 3.9;
    controls.maxDistance = 7.2;
    controls.minPolarAngle = Math.PI * 0.33;
    controls.maxPolarAngle = Math.PI * 0.66;
    controls.target.copy(cameraTarget);

    const environment = new THREE.Group();
    const shelfGroup = new THREE.Group();
    const detailGroup = new THREE.Group();
    const volumes = catalog.map(createVolume);
    const hitMeshes = volumes.map((volume) => volume.hit);
    hitMeshes.forEach((mesh, index) => { mesh.userData.volumeIndex = index; });
    scene.add(environment, detailGroup);
    environment.add(shelfGroup);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: catalog[currentIndex].palette.wall, roughness: 0.94 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: catalog[currentIndex].palette.shelfDark, roughness: 0.85, metalness: 0.06 });
    const shelfMaterial = new THREE.MeshStandardMaterial({ color: catalog[currentIndex].palette.shelf, roughness: 0.58, metalness: 0.12 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), wallMaterial);
    wall.position.set(0, 2.4, -2.1);
    environment.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.07;
    environment.add(floor);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.22, 1.5), shelfMaterial);
    shelf.position.set(0, -0.9, -0.1);
    environment.add(shelf);
    const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(12.7, 0.12, 1.56), floorMaterial);
    lowerShelf.position.set(0, -1.18, -0.1);
    environment.add(lowerShelf);

    const ambient = new THREE.HemisphereLight(catalog[currentIndex].palette.light, catalog[currentIndex].palette.shelfDark, 2.2);
    const key = new THREE.DirectionalLight(catalog[currentIndex].palette.light, 3.4);
    key.position.set(-3.8, 5.2, 5.4);
    const rim = new THREE.PointLight(catalog[currentIndex].foil, 18, 12, 2);
    rim.position.set(3.4, 2.8, 3.2);
    scene.add(ambient, key, rim);
    volumes.forEach((volume) => shelfGroup.add(volume.root));

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const abort = new AbortController();
    const signal = abort.signal;

    function currentBook() {
      return catalog[currentIndex];
    }

    function currentVolume() {
      return volumes[currentIndex];
    }

    function levelStart(level = currentLevel) {
      return getLevelStart(levelSizes, level);
    }

    function levelLength(level = currentLevel) {
      return levelSizes[level];
    }

    function setMaterialOpacity(volume, opacity) {
      const safe = clamp(opacity, 0, 1);
      volume.opacity = safe;
      volume.materials.forEach((material) => {
        material.transparent = safe < 0.999 || material.transparent;
        material.opacity = safe;
        material.depthWrite = safe > 0.98;
      });
    }

    function updateTheme(book) {
      const style = experience.style;
      style.setProperty("--paper", book.palette.paper);
      style.setProperty("--paper-deep", book.palette.paperDeep);
      style.setProperty("--paper-pale", book.palette.paperPale);
      style.setProperty("--ink", book.palette.ink);
      style.setProperty("--ink-soft", book.palette.inkSoft);
      style.setProperty("--shelf", book.palette.shelf);
      style.setProperty("--shelf-dark", book.palette.shelfDark);
      scene.background = new THREE.Color(book.palette.wall);
      wallMaterial.color.set(book.palette.wall);
      floorMaterial.color.set(book.palette.shelfDark);
      shelfMaterial.color.set(book.palette.shelf);
      ambient.color.set(book.palette.light);
      key.color.set(book.palette.light);
      rim.color.set(book.foil);
    }

    function updateDetailCopy(book) {
      updateText(detailEyebrow, `Volume ${book.roman} · ${book.discipline}`);
      updateText(detailTitle, book.title);
      updateText(detailDeck, book.deck);
      updateText(detailBinding, book.binding);
      updateText(detailFormat, book.format);
      updateText(detailTheme, book.theme);
      updateText(detailMotif, book.motif);
    }

    function updateReadingUi() {
      const book = currentBook();
      updateText(pageLabel, readingOpen ? book.chapters[pageIndex] : "Closed");
      updateText(pageCounter, readingOpen ? `Chapter ${pageIndex + 1} / ${book.chapters.length}` : "Click book to open");
      if (previousPageButton) previousPageButton.disabled = !readingOpen || pageIndex === 0;
      if (nextPageButton) nextPageButton.disabled = !readingOpen || pageIndex === book.chapters.length - 1;
      if (toggleBookButton) {
        toggleBookButton.setAttribute("aria-pressed", String(readingOpen));
        toggleBookButton.textContent = readingOpen ? "Close book" : "Open book";
      }
    }

    function rebuildMarkers() {
      if (!markers) return;
      const start = levelStart();
      const count = levelLength();
      markers.replaceChildren();
      for (let column = 0; column < count; column += 1) {
        const index = start + column;
        const book = catalog[index];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "marker";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-label", `Select ${book.title}`);
        button.setAttribute("aria-selected", String(index === currentIndex));
        button.setAttribute("aria-current", String(index === currentIndex));
        button.toggleAttribute("data-active", index === currentIndex);
        button.addEventListener("click", () => select(index), { signal });
        markers.append(button);
      }
    }

    function announce(value) {
      updateText(liveRegion, value);
    }

    function updateBrowseCopy({ announceSelection = false } = {}) {
      const book = currentBook();
      const position = currentIndex - levelStart() + 1;
      const count = levelLength();
      updateText(paletteLabel, book.paletteLabel);
      updateText(levelCounter, levelSizes.length > 1 ? `Shelf ${String(currentLevel + 1).padStart(2, "0")} / ${String(levelSizes.length).padStart(2, "0")}` : "");
      updateText(counter, `${String(position).padStart(2, "0")} / ${String(count).padStart(2, "0")}`);
      updateText(selectionTitle, book.title);
      updateText(selectionNote, book.note);
      updateText(pointerLabelIndex, `Volume ${String(currentIndex + 1).padStart(2, "0")}`);
      updateText(pointerLabelTitle, book.title);
      updateDetailCopy(book);
      rebuildMarkers();
      if (announceSelection) announce(`${book.title}, volume ${position} of ${count} on shelf ${currentLevel + 1}.`);
      options.onSelectionChange?.({ index: currentIndex, id: book.id, title: book.title, book });
    }

    function getTargetFor(volume, column) {
      const focus = currentIndex - levelStart();
      const offset = column - focus;
      const spread = 1.16 + (volume.dimensions.width - 0.85) * 0.24;
      return new THREE.Vector3(offset * spread, -0.9 + volume.dimensions.height / 2, -Math.abs(offset) * 0.09);
    }

    function applyLevelLayout(level, opacity, yOffset = 0) {
      const start = getLevelStart(levelSizes, level);
      const count = levelSizes[level];
      for (let column = 0; column < count; column += 1) {
        const index = start + column;
        const volume = volumes[index];
        if (volume.root.parent !== shelfGroup) continue;
        const target = getTargetFor(volume, column);
        target.y += yOffset;
        volume.target.copy(target);
        volume.targetRotation.set(0, (column - (currentIndex - levelStart())) * -0.055, 0);
        volume.root.visible = opacity > 0.01;
        setMaterialOpacity(volume, opacity);
      }
    }

    function hideNonDisplayedLevels() {
      const allowed = new Set([currentLevel]);
      if (levelMotion) {
        allowed.add(levelMotion.from);
        allowed.add(levelMotion.to);
      }
      volumes.forEach((volume, index) => {
        if (volume.root.parent !== shelfGroup) return;
        const level = getBookLevel(levelSizes, index);
        if (!allowed.has(level)) volume.root.visible = false;
      });
    }

    function updateShelfMotion(now) {
      if (!levelMotion) return;
      const progress = clamp((now - levelMotion.startedAt) / LEVEL_DURATION, 0, 1);
      const eased = easeInOut(progress);
      const distance = 1.05 * levelMotion.direction;
      applyLevelLayout(levelMotion.from, 1 - eased, distance * eased);
      applyLevelLayout(levelMotion.to, eased, -distance * (1 - eased));
      if (progress === 1) {
        levelMotion = null;
        hideNonDisplayedLevels();
        applyLevelLayout(currentLevel, 1, 0);
      }
    }

    function settleBooks(delta) {
      volumes.forEach((volume) => {
        volume.coverPivot.rotation.y = damp(volume.coverPivot.rotation.y, volume.coverTarget, 13, delta);
        volume.pageLines.rotation.y = damp(volume.pageLines.rotation.y, volume.pageTarget, 13, delta);
        if (!volume.root.visible || volume.root.parent !== shelfGroup) return;
        volume.root.position.x = damp(volume.root.position.x, volume.target.x, 12, delta);
        volume.root.position.y = damp(volume.root.position.y, volume.target.y, 12, delta);
        volume.root.position.z = damp(volume.root.position.z, volume.target.z, 12, delta);
        volume.root.rotation.y = damp(volume.root.rotation.y, volume.targetRotation.y, 12, delta);
      });
    }

    function setEnvironmentVisible(visible) {
      environment.visible = visible;
    }

    function setDetailAccessible(open) {
      if (!detailPanel) return;
      detailPanel.setAttribute("aria-hidden", String(!open));
      setInert(detailPanel, !open);
    }

    function updateTransition(now, delta) {
      if (!transition) return;
      const progress = clamp((now - transition.startedAt) / transition.duration, 0, 1);
      const eased = transition.kind === "opening" ? easeOut(progress) : easeInOut(progress);
      const volume = currentVolume();
      if (transition.kind === "opening") {
        if (progress >= OPENING_ENVIRONMENT_CLEAR_PROGRESS) setEnvironmentVisible(false);
        volume.root.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
        volume.root.rotation.y = THREE.MathUtils.lerp(transition.fromRotation, 0, eased);
        camera.position.lerpVectors(transition.cameraFrom, detailCamera, eased);
        cameraTarget.lerpVectors(transition.targetFrom, new THREE.Vector3(0, 0.05, 0), eased);
        if (progress === 1) {
          mode = "detail";
          controls.enabled = true;
          experience.classList.remove("is-opening");
          transition = null;
          announce(`${currentBook().title} opened. Click the book to read sample chapters.`);
        }
      } else {
        if (progress >= CLOSING_ENVIRONMENT_REVEAL_PROGRESS) setEnvironmentVisible(true);
        volume.root.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
        volume.root.rotation.y = THREE.MathUtils.lerp(transition.fromRotation, transition.toRotation, eased);
        camera.position.lerpVectors(transition.cameraFrom, browseCamera, eased);
        cameraTarget.lerpVectors(transition.targetFrom, new THREE.Vector3(0, 0.35, 0), eased);
        if (progress === 1) {
          shelfGroup.add(volume.root);
          volume.root.position.copy(transition.toPosition);
          volume.root.rotation.y = transition.toRotation;
          volume.target.copy(transition.toPosition);
          volume.targetRotation.set(0, transition.toRotation, 0);
          setEnvironmentVisible(true);
          mode = "browse";
          transition = null;
          experience.classList.remove("mode-detail", "is-closing");
          setDetailAccessible(false);
          updateBrowseCopy();
          options.onDetailChange?.(false);
          announce(`${currentBook().title} returned to shelf ${currentLevel + 1}.`);
        }
      }
      camera.lookAt(cameraTarget);
      void delta;
    }

    function select(index, { animateLevel = true } = {}) {
      if (mode !== "browse") return;
      const safe = clamp(Math.trunc(index), 0, catalog.length - 1);
      const nextLevel = getBookLevel(levelSizes, safe);
      const previousLevel = currentLevel;
      currentIndex = safe;
      currentLevel = nextLevel;
      updateTheme(currentBook());
      if (previousLevel !== nextLevel && animateLevel) {
        levelMotion = {
          from: previousLevel,
          to: nextLevel,
          direction: nextLevel > previousLevel ? 1 : -1,
          startedAt: performance.now(),
        };
      } else {
        levelMotion = null;
        hideNonDisplayedLevels();
        applyLevelLayout(currentLevel, 1);
      }
      updateBrowseCopy({ announceSelection: true });
      requestRender();
    }

    function selectLevel(direction) {
      if (mode !== "browse" || levelSizes.length < 2) return;
      const nextLevel = mod(currentLevel + direction, levelSizes.length);
      const previousColumn = currentIndex - levelStart();
      const nextIndex = getLevelStart(levelSizes, nextLevel) + Math.min(previousColumn, levelSizes[nextLevel] - 1);
      select(nextIndex);
    }

    function previous() {
      if (mode !== "browse") return;
      const start = levelStart();
      const nextIndex = start + mod(currentIndex - start - 1, levelLength());
      select(nextIndex, { animateLevel: false });
    }

    function next() {
      if (mode !== "browse") return;
      const start = levelStart();
      const nextIndex = start + mod(currentIndex - start + 1, levelLength());
      select(nextIndex, { animateLevel: false });
    }

    function inspect() {
      if (mode !== "browse" || levelMotion) return;
      const volume = currentVolume();
      mode = "opening";
      readingOpen = false;
      pageIndex = 0;
      volume.coverTarget = 0;
      volume.pageTarget = 0;
      controls.enabled = false;
      detailGroup.add(volume.root);
      transition = {
        kind: "opening",
        startedAt: performance.now(),
        duration: OPEN_DURATION,
        fromPosition: volume.root.position.clone(),
        toPosition: new THREE.Vector3(0, -0.02, 0.72),
        fromRotation: volume.root.rotation.y,
        cameraFrom: camera.position.clone(),
        targetFrom: cameraTarget.clone(),
      };
      experience.classList.add("mode-detail", "is-opening");
      setDetailAccessible(true);
      updateReadingUi();
      options.onDetailChange?.(true);
      requestRender();
    }

    function close() {
      if ((mode !== "detail" && mode !== "opening") || !transition?.kind || transition.kind === "closing") {
        if (mode !== "detail") return;
      }
      const volume = currentVolume();
      mode = "closing";
      readingOpen = false;
      volume.coverTarget = 0;
      volume.pageTarget = 0;
      controls.enabled = false;
      const target = getTargetFor(volume, currentIndex - levelStart());
      transition = {
        kind: "closing",
        startedAt: performance.now(),
        duration: CLOSE_DURATION,
        fromPosition: volume.root.position.clone(),
        toPosition: target,
        fromRotation: volume.root.rotation.y,
        toRotation: 0,
        cameraFrom: camera.position.clone(),
        targetFrom: cameraTarget.clone(),
      };
      experience.classList.remove("is-opening");
      experience.classList.add("is-closing");
      updateReadingUi();
      requestRender();
    }

    function toggleBook() {
      if (mode !== "detail") return;
      readingOpen = !readingOpen;
      currentVolume().coverTarget = readingOpen ? -1.32 : 0;
      currentVolume().pageTarget = readingOpen ? -0.12 : 0;
      updateReadingUi();
      options.onReadingChange?.(readingOpen);
      announce(readingOpen ? `${currentBook().title} is open.` : `${currentBook().title} is closed.`);
      requestRender();
    }

    function previousPage() {
      if (!readingOpen || pageIndex === 0) return;
      pageIndex -= 1;
      currentVolume().pageTarget = -0.12 - pageIndex * 0.07;
      updateReadingUi();
      requestRender();
    }

    function nextPage() {
      if (!readingOpen || pageIndex >= currentBook().chapters.length - 1) return;
      pageIndex += 1;
      currentVolume().pageTarget = -0.12 - pageIndex * 0.07;
      updateReadingUi();
      requestRender();
    }

    function resetView() {
      if (mode !== "detail") return;
      controls.reset();
      camera.position.copy(detailCamera);
      cameraTarget.set(0, 0.05, 0);
      controls.target.copy(cameraTarget);
      requestRender();
    }

    function readPointer(event) {
      const rect = sceneCanvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitMeshes, false)[0];
      return hit?.object.userData.volumeIndex ?? -1;
    }

    function onPointerMove(event) {
      if (mode !== "browse") return;
      const index = readPointer(event);
      if (hoverIndex === index) return;
      hoverIndex = index;
      sceneCanvas.classList.toggle("has-closed-book-hover", index >= 0);
      if (pointerLabel) {
        pointerLabel.classList.toggle("is-visible", index >= 0);
        pointerLabel.setAttribute("aria-hidden", String(index < 0));
      }
      if (index >= 0) {
        const book = catalog[index];
        updateText(pointerLabelIndex, `Volume ${String(index + 1).padStart(2, "0")}`);
        updateText(pointerLabelTitle, book.title);
      } else {
        updateText(pointerLabelIndex, `Volume ${String(currentIndex + 1).padStart(2, "0")}`);
        updateText(pointerLabelTitle, currentBook().title);
      }
    }

    function onPointerDown(event) {
      pointerDown = { x: event.clientX, y: event.clientY, index: mode === "browse" ? readPointer(event) : -1 };
    }

    function onPointerUp(event) {
      if (!pointerDown) return;
      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      const selected = pointerDown.index;
      pointerDown = null;
      if (distance > 8) return;
      if (mode === "browse" && selected >= 0) {
        if (selected !== currentIndex) select(selected);
        else inspect();
      } else if (mode === "detail") {
        toggleBook();
      }
    }

    function onWheel(event) {
      if (mode !== "browse") return;
      event.preventDefault();
      if (wheelLocked) return;
      wheelTotal += Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => { wheelTotal = 0; wheelLocked = false; }, 150);
      if (Math.abs(wheelTotal) < 34) return;
      const direction = wheelTotal > 0 ? 1 : -1;
      wheelTotal = 0;
      wheelLocked = true;
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX) && levelSizes.length > 1) selectLevel(direction);
      else if (direction > 0) next();
      else previous();
    }

    function onKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); selectLevel(-1); }
      else if (event.key === "ArrowDown") { event.preventDefault(); selectLevel(1); }
      else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (mode === "browse") inspect(); else if (mode === "detail") toggleBook(); }
      else if (event.key === "Escape") { close(); }
    }

    function resize() {
      const rect = sceneCanvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
      requestRender();
    }

    function render(now) {
      frame = 0;
      if (destroyed) return;
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (mode === "browse") {
        updateShelfMotion(now);
        settleBooks(delta);
      }
      updateTransition(now, delta);
      if (mode === "detail") {
        settleBooks(delta);
        controls.update();
        cameraTarget.copy(controls.target);
      }
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
      if (transition || levelMotion || mode === "detail") requestRender();
    }

    function requestRender() {
      if (!frame && !destroyed) frame = requestAnimationFrame(render);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(experience);
    sceneCanvas.addEventListener("pointermove", onPointerMove, { signal });
    sceneCanvas.addEventListener("pointerleave", () => {
      hoverIndex = -1;
      sceneCanvas.classList.remove("has-closed-book-hover");
      pointerLabel?.classList.remove("is-visible");
      pointerLabel?.setAttribute("aria-hidden", "true");
    }, { signal });
    sceneCanvas.addEventListener("pointerdown", onPointerDown, { signal });
    sceneCanvas.addEventListener("pointerup", onPointerUp, { signal });
    sceneCanvas.addEventListener("wheel", onWheel, { passive: false, signal });
    sceneCanvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      experience.classList.remove("webgl-ready");
      updateText(fallbackStatus, "The graphics context was lost, so the complete static catalog is shown instead.");
      options.onError?.("BookShelf lost its WebGL graphics context.");
    }, { signal });
    experience.addEventListener("keydown", onKeyDown, { signal });
    previousButton?.addEventListener("click", previous, { signal });
    nextButton?.addEventListener("click", next, { signal });
    inspectButton?.addEventListener("click", inspect, { signal });
    closeDetailButton?.addEventListener("click", close, { signal });
    toggleBookButton?.addEventListener("click", toggleBook, { signal });
    previousPageButton?.addEventListener("click", previousPage, { signal });
    nextPageButton?.addEventListener("click", nextPage, { signal });
    resetViewButton?.addEventListener("click", resetView, { signal });
    controls.addEventListener("change", requestRender);

    updateTheme(currentBook());
    applyLevelLayout(currentLevel, 1);
    hideNonDisplayedLevels();
    volumes.forEach((volume) => {
      volume.root.position.copy(volume.target);
      volume.root.rotation.copy(volume.targetRotation);
    });
    updateBrowseCopy();
    updateReadingUi();
    resize();
    if (loading) loading.hidden = true;
    experience.classList.add("webgl-ready");
    options.onReady?.();
    resolveReady();

    return {
      ready,
      previous,
      next,
      select,
      inspect,
      close,
      toggleBook,
      previousPage,
      nextPage,
      resetView,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        window.clearTimeout(wheelTimer);
        if (frame) cancelAnimationFrame(frame);
        abort.abort();
        observer.disconnect();
        controls.removeEventListener("change", requestRender);
        controls.dispose();
        experience.classList.remove("webgl-ready", "mode-detail", "is-opening", "is-closing");
        setDetailAccessible(false);
        volumes.forEach((volume) => disposeObject(volume.root));
        disposeObject(environment);
        renderer.dispose();
        renderer.forceContextLoss();
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "BookShelf could not start the interactive scene.";
    if (loading) loading.hidden = true;
    updateText(fallbackStatus, "The interactive scene is unavailable, so the complete static catalog is shown instead.");
    options.onError?.(message);
    rejectReady(error);
    return {
      ready,
      previous() {},
      next() {},
      select() {},
      inspect() {},
      close() {},
      toggleBook() {},
      previousPage() {},
      nextPage() {},
      resetView() {},
      destroy() {},
    };
  }
}
