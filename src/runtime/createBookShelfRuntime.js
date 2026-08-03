import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { workingShelves } from "../data/workingVolumes";

const OPENING_ENVIRONMENT_CLEAR_PROGRESS = 0.24;
const CLOSING_ENVIRONMENT_REVEAL_PROGRESS = 0.24;
const OPEN_DURATION = 740;
const CLOSE_DURATION = 680;
const LEVEL_DURATION = 460;
const SPREAD_COUNT = 5;
const READING_LEAF_COUNT = SPREAD_COUNT - 1;
const PAGE_DRAG_DISTANCE = 150;
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

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function configureCanvasTexture(texture, { color = true, repeat = null } = {}) {
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
  }
  texture.needsUpdate = true;
  return texture;
}

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
  canvas.width = 768;
  canvas.height = 1152;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BookShelf could not create a cover canvas.");

  const { width, height } = canvas;
  const random = seededRandom(hashSeed(book.id) + book.seed);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, book.color);
  gradient.addColorStop(0.56, book.color);
  gradient.addColorStop(1, book.palette.paperDeep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const edgeShade = context.createLinearGradient(0, 0, width, 0);
  edgeShade.addColorStop(0, "rgba(0,0,0,0.25)");
  edgeShade.addColorStop(0.06, "rgba(255,255,255,0.04)");
  edgeShade.addColorStop(0.54, "rgba(255,255,255,0.012)");
  edgeShade.addColorStop(0.94, "rgba(0,0,0,0.08)");
  edgeShade.addColorStop(1, "rgba(0,0,0,0.22)");
  context.fillStyle = edgeShade;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < 1450; index += 1) {
    const x = random() * width;
    const y = random() * height;
    context.strokeStyle = random() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.032)";
    context.lineWidth = 0.35 + random() * 0.85;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 4 + random() * 23, y + (random() - 0.5) * 2);
    context.stroke();
  }

  context.globalAlpha = 0.38;
  context.strokeStyle = book.foil;
  context.lineWidth = 1.25;
  context.strokeRect(42, 42, width - 84, height - 84);
  context.strokeRect(56, 56, width - 112, height - 112);
  context.globalAlpha = 0.34;
  drawMotif(context, book, width / 2, height * 0.48);
  context.globalAlpha = 1;

  return configureCanvasTexture(new THREE.CanvasTexture(canvas));
}

function makeFoilTexture(book) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 1152;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BookShelf could not create a foil canvas.");
  const { width, height } = canvas;
  const foilBook = { ...book, foil: "#ffffff" };
  context.fillStyle = "#ffffff";
  context.globalAlpha = 0.86;
  context.fillRect(58, 72, 106, 1.4);
  context.globalAlpha = 1;
  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  context.font = "500 15px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`WORKING VOLUMES / ${book.roman}`, 58, 58);
  context.globalAlpha = 0.88;
  drawMotif(context, foilBook, width / 2, height * 0.49);
  context.globalAlpha = 1;
  context.font = `400 ${book.title.length > 10 ? 60 : 76}px Georgia, Times New Roman, serif`;
  context.fillText(book.title, 58, height - 112);
  context.font = "500 13px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(book.discipline.toUpperCase(), 60, height - 66);
  return configureCanvasTexture(new THREE.CanvasTexture(canvas), { color: false });
}

function makeClothMaps(book) {
  const size = 192;
  const normal = document.createElement("canvas");
  const roughness = document.createElement("canvas");
  normal.width = roughness.width = size;
  normal.height = roughness.height = size;
  const normalContext = normal.getContext("2d");
  const roughnessContext = roughness.getContext("2d");
  if (!normalContext || !roughnessContext) throw new Error("BookShelf could not create cloth maps.");
  const normalImage = normalContext.createImageData(size, size);
  const roughnessImage = roughnessContext.createImageData(size, size);
  const phase = (book.seed % 23) * 0.19;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const warp = Math.sin((x + phase) * 1.8) * 0.32;
      const weft = Math.sin((y - phase) * 1.45) * 0.27;
      normalImage.data[offset] = Math.round(128 + warp * 76);
      normalImage.data[offset + 1] = Math.round(128 + weft * 76);
      normalImage.data[offset + 2] = 244;
      normalImage.data[offset + 3] = 255;
      const value = Math.round(212 + (warp + weft) * 22);
      roughnessImage.data[offset] = value;
      roughnessImage.data[offset + 1] = value;
      roughnessImage.data[offset + 2] = value;
      roughnessImage.data[offset + 3] = 255;
    }
  }
  normalContext.putImageData(normalImage, 0, 0);
  roughnessContext.putImageData(roughnessImage, 0, 0);
  return {
    normal: configureCanvasTexture(new THREE.CanvasTexture(normal), { color: false, repeat: [5, 8] }),
    roughness: configureCanvasTexture(new THREE.CanvasTexture(roughness), { color: false, repeat: [5, 8] }),
  };
}

function drawCoverTypography(context, book, width, height) {
  const upperShade = context.createLinearGradient(0, 0, 0, height * 0.22);
  upperShade.addColorStop(0, "rgba(4, 8, 16, 0.42)");
  upperShade.addColorStop(1, "rgba(4, 8, 16, 0)");
  context.fillStyle = upperShade;
  context.fillRect(0, 0, width, height * 0.22);
  const lowerShade = context.createLinearGradient(0, height * 0.74, 0, height);
  lowerShade.addColorStop(0, "rgba(4, 8, 16, 0)");
  lowerShade.addColorStop(1, "rgba(4, 8, 16, 0.48)");
  context.fillStyle = lowerShade;
  context.fillRect(0, height * 0.74, width, height * 0.26);

  context.save();
  context.fillStyle = book.palette.ink;
  context.shadowColor = "rgba(0, 0, 0, 0.36)";
  context.shadowBlur = 5;
  context.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.letterSpacing = "4px";
  context.fillText(`VOLUME ${book.roman}`, 76, 88);
  context.font = "500 17px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(book.discipline.toUpperCase(), 76, 122);
  context.textAlign = "center";
  const titleSize = book.title.length > 13 ? 62 : 78;
  context.font = `500 ${titleSize}px Georgia, Times New Roman, serif`;
  context.fillText(book.title, width / 2, height - 126);
  context.font = "500 15px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText("BOOKSHELF EDITION", width / 2, height - 78);
  context.restore();
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

function makeContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BookShelf could not create a contact shadow.");
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 122);
  gradient.addColorStop(0, "rgba(0,0,0,0.8)");
  gradient.addColorStop(0.52, "rgba(0,0,0,0.34)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  return configureCanvasTexture(new THREE.CanvasTexture(canvas), { color: false });
}

function makeEndpaperTexture(book) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 960;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BookShelf could not create an endpaper texture.");
  const { width, height } = canvas;
  const paper = context.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, "#f4eee2");
  paper.addColorStop(1, "#ddd3c2");
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.09;
  context.strokeStyle = book.foil;
  context.lineWidth = 1.2;
  drawMotif(context, book, width / 2, height / 2);
  context.globalAlpha = 1;
  return configureCanvasTexture(new THREE.CanvasTexture(canvas));
}

function getSpreadLabels(book) {
  return [
    "Title page",
    `${book.chapters[0] ?? "Study"} · Plate`,
    `${book.chapters[1] ?? "Notes"} · Notes`,
    `${book.chapters[2] ?? "System"} · System`,
    "Colophon",
  ];
}

function drawReadingPage(canvas, book, spreadIndex) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("BookShelf could not draw a reading page.");
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  const paper = context.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, "#f7f1e5");
  paper.addColorStop(1, "#e7decf");
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 0.11;
  context.strokeStyle = "#705f4e";
  context.lineWidth = 0.55;
  for (let y = 42; y < height - 42; y += 13) {
    context.beginPath();
    context.moveTo(36, y);
    context.lineTo(width - 36, y);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.fillStyle = "#39332d";
  context.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`WORKING VOLUMES / ${book.roman}`, 48, 56);
  context.textAlign = "right";
  context.fillText(`${String(spreadIndex + 1).padStart(2, "0")} / 05`, width - 48, 56);
  context.textAlign = "left";
  context.strokeStyle = "rgba(57, 51, 45, 0.35)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(48, 78);
  context.lineTo(width - 48, 78);
  context.stroke();
  const label = getSpreadLabels(book)[spreadIndex];
  context.fillStyle = "#665c50";
  context.font = "500 13px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(book.discipline.toUpperCase(), 48, 148);
  context.fillStyle = "#2f2923";
  context.font = `400 ${spreadIndex === 0 ? 54 : 42}px Georgia, Times New Roman, serif`;
  context.fillText(spreadIndex === 0 ? book.title : label, 48, 214);
  context.fillStyle = "#6d6254";
  context.font = "400 22px Georgia, Times New Roman, serif";
  const copy = spreadIndex === 0 ? book.note : book.deck;
  const words = copy.split(" ");
  let line = "";
  let y = 330;
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > width - 98) {
      context.fillText(line, 48, y);
      line = word;
      y += 34;
    } else {
      line = candidate;
    }
  });
  if (line) context.fillText(line, 48, y);
  context.fillStyle = "#756a5b";
  context.font = "500 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(label.toUpperCase(), 48, height - 62);
  return context;
}

function createVolume(book, index) {
  const root = new THREE.Group();
  root.name = `BookShelf volume ${book.id}`;
  const motion = new THREE.Group();
  motion.name = `BookShelf volume motion ${book.id}`;
  root.add(motion);
  const width = book.width;
  const height = book.height;
  const depth = book.depth;
  const board = 0.032;
  const pageWidth = width - 0.074;
  const pageHeight = height - 0.068;
  const pageDepth = depth - 0.026;
  const materials = [];
  const coverTexture = makeCoverTexture(book);
  const foilTexture = makeFoilTexture(book);
  const clothMaps = makeClothMaps(book);
  const endpaperTexture = makeEndpaperTexture(book);
  const cloth = new THREE.MeshPhysicalMaterial({
    color: book.color,
    normalMap: clothMaps.normal,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughnessMap: clothMaps.roughness,
    roughness: 0.95,
    metalness: 0.02,
    sheen: 0.32,
    sheenRoughness: 0.76,
    sheenColor: new THREE.Color(book.foil),
    transparent: true,
  });
  const page = new THREE.MeshPhysicalMaterial({ color: "#e7dfcf", roughness: 0.96, sheen: 0.03, transparent: true });
  const artwork = new THREE.MeshPhysicalMaterial({
    map: coverTexture,
    normalMap: clothMaps.normal,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughnessMap: clothMaps.roughness,
    roughness: 0.9,
    metalness: 0.025,
    sheen: 0.22,
    sheenRoughness: 0.8,
    transparent: true,
  });
  const foil = new THREE.MeshPhysicalMaterial({
    color: book.foil,
    map: foilTexture,
    alphaMap: foilTexture,
    roughness: 0.22,
    metalness: 0.9,
    clearcoat: 0.18,
    clearcoatRoughness: 0.14,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const endpaper = new THREE.MeshPhysicalMaterial({
    color: "#f1eadc",
    map: endpaperTexture,
    roughness: 0.94,
    side: THREE.DoubleSide,
    transparent: true,
  });
  materials.push(cloth, page, artwork, foil, endpaper);

  const pageBlock = new THREE.Mesh(new RoundedBoxGeometry(pageWidth, pageHeight, pageDepth, 2, 0.0025), page);
  motion.add(pageBlock);

  const back = new THREE.Mesh(new RoundedBoxGeometry(width, height, board, 2, 0.0045), cloth);
  back.position.z = -pageDepth * 0.5 - board * 0.5;
  motion.add(back);

  const coverPivot = new THREE.Group();
  coverPivot.position.set(-width / 2, 0, pageDepth * 0.5 + board * 0.5);
  const cover = new THREE.Mesh(new RoundedBoxGeometry(width, height, board, 2, 0.0045), cloth);
  cover.position.x = width / 2;
  coverPivot.add(cover);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.01, height - 0.01), artwork);
  art.position.set(width / 2, 0, board * 0.505);
  coverPivot.add(art);
  const foilArt = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.014, height - 0.014), foil);
  foilArt.position.set(width / 2, 0, board * 0.512);
  coverPivot.add(foilArt);
  const innerCover = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.05, height - 0.05), endpaper);
  innerCover.position.set(width / 2, 0, -board * 0.515);
  innerCover.rotation.y = Math.PI;
  coverPivot.add(innerCover);
  motion.add(coverPivot);

  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.082, height - 0.01, depth + board * 2, 2, 0.0015), cloth);
  spine.position.set(-width * 0.5 + 0.041, 0, 0);
  motion.add(spine);

  const pageLines = new THREE.Group();
  pageLines.visible = false;
  motion.add(pageLines);

  const readingLeaves = [];
  const readingSurfaces = [];
  const readingMaterials = [endpaper];
  const readableWidth = pageWidth - 0.1;
  const readableHeight = pageHeight - 0.055;
  for (let leafIndex = 0; leafIndex < READING_LEAF_COUNT; leafIndex += 1) {
    const leafOrder = READING_LEAF_COUNT - 1 - leafIndex;
    const createPaperMaterial = () => {
      const material = new THREE.MeshPhysicalMaterial({
        color: "#f4ede0",
        roughness: 0.96,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      materials.push(material);
      readingMaterials.push(material);
      return material;
    };
    const pivot = new THREE.Group();
    const restZ = pageDepth * 0.5 + 0.008 + leafIndex * 0.0022;
    pivot.position.set(-width * 0.5 + 0.052, 0, restZ);
    const frontMaterial = createPaperMaterial();
    const backMaterial = createPaperMaterial();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(readableWidth, readableHeight), frontMaterial);
    front.position.set(readableWidth * 0.5, 0, 0.00024);
    const backPage = new THREE.Mesh(new THREE.PlaneGeometry(readableWidth, readableHeight), backMaterial);
    backPage.position.set(readableWidth * 0.5, 0, -0.00024);
    backPage.rotation.y = Math.PI;
    pivot.add(front, backPage);
    pivot.visible = false;
    motion.add(pivot);
      readingLeaves.push({
        pivot,
      order: leafOrder,
      restZ,
      turnedZ: pageDepth * 0.5 + board + 0.004 + leafIndex * 0.0022,
      frontMaterial,
      backMaterial,
      });
    readingSurfaces.push(front, backPage);
  }

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.26, depth * 2.1),
    new THREE.MeshBasicMaterial({ color: "#201209", alphaMap: makeContactShadowTexture(), opacity: 0.28, transparent: true, depthWrite: false }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, -height * 0.5 - 0.022, 0.035);
  root.add(contactShadow);

  root.traverse((child) => {
    if (!child.isMesh || child === contactShadow) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return {
    book,
    index,
    root,
    motion,
    coverPivot,
    pageLines,
    materials,
    coverTexture,
    foilTexture,
    endpaperTexture,
    clothMaps,
    contactShadow,
    hit: art,
    readingLeaves,
    readingSurfaces,
    readingMaterials,
    readingArtReady: false,
    readingFade: 0,
    dimensions: { width, height, depth },
    target: new THREE.Vector3(),
    targetRotation: new THREE.Euler(),
    coverTarget: 0,
    pageTarget: 0,
    opacity: 1,
  };
}

function disposeObject(object) {
  const disposedTextures = new Set();
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      [material.map, material.alphaMap, material.normalMap, material.roughnessMap, material.bumpMap]
        .filter(Boolean)
        .forEach((texture) => {
          if (!disposedTextures.has(texture)) {
            texture.dispose();
            disposedTextures.add(texture);
          }
        });
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
  let pageDrag = null;
  let currentIndex = clamp(Math.trunc(options.initialIndex || 0), 0, catalog.length - 1);
  let currentLevel = getBookLevel(levelSizes, currentIndex);
  let hoverIndex = -1;
  let pointerDown = null;

  try {
    if (!sceneCanvas) throw new Error("BookShelf could not find its scene canvas.");
    if (loading) loading.hidden = false;

    const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#202126");
    scene.fog = new THREE.FogExp2("#202126", 0.025);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    const browseCamera = new THREE.Vector3(0, 1.92, 8.1);
    const detailCamera = new THREE.Vector3(-0.52, 1.78, 5.25);
    const detailTarget = new THREE.Vector3(0, 1.56, 0);
    camera.position.copy(browseCamera);
    const cameraTarget = new THREE.Vector3(0, 1.55, 0);
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
    // Browse mode renders on demand, then keeps frames alive only while a book
    // is moving. The covers are authored synchronously into CanvasTextures.
    const volumes = catalog.map(createVolume);
    const hitMeshes = volumes.flatMap((volume, index) => {
      volume.hit.userData.volumeIndex = index;
      volume.readingSurfaces.forEach((surface) => { surface.userData.volumeIndex = index; });
      return [volume.hit, ...volume.readingSurfaces];
    });
    scene.add(environment, detailGroup);
    environment.add(shelfGroup);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: "#202126", roughness: 1 });
    const floorMaterial = new THREE.MeshStandardMaterial({ color: "#2a170f", roughness: 0.82, metalness: 0.02 });
    const shelfMaterial = new THREE.MeshStandardMaterial({ color: "#4a2b1d", roughness: 0.56, metalness: 0.02 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(28, 14), wallMaterial);
    wall.position.set(0, 5.5, -3.3);
    wall.receiveShadow = true;
    environment.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    environment.add(floor);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(17, 0.28, 1.08), shelfMaterial);
    shelf.position.set(0, 0.33, -0.03);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    environment.add(shelf);
    const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(17.05, 0.075, 1.14), floorMaterial);
    lowerShelf.position.set(0, 0.205, 0.02);
    lowerShelf.castShadow = true;
    lowerShelf.receiveShadow = true;
    environment.add(lowerShelf);
    const backRail = new THREE.Mesh(new THREE.BoxGeometry(17, 0.17, 0.2), shelfMaterial);
    backRail.position.set(0, 0.68, -0.52);
    backRail.castShadow = true;
    environment.add(backRail);

    RectAreaLightUniformsLib.init();
    const ambient = new THREE.HemisphereLight("#fff8e8", "#5b4030", 0.56);
    const key = new THREE.DirectionalLight("#ffe8c2", 1.42);
    key.position.set(-4.6, 7.4, 5.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -1.5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 18;
    key.shadow.bias = -0.00018;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 3.5;
    const fill = new THREE.DirectionalLight("#d8e3e7", 0.3);
    fill.position.set(5.5, 3.6, 4.2);
    const softKey = new THREE.RectAreaLight("#ffe8c2", 5.4, 4.8, 5.6);
    softKey.position.set(-3.2, 5.5, 4.6);
    softKey.lookAt(0, 1.45, 0);
    const rim = new THREE.RectAreaLight("#d5a45e", 3.45, 1.6, 4.8);
    rim.position.set(3.8, 3.6, -2.1);
    rim.lookAt(-0.2, 1.5, 0);
    const backFill = new THREE.RectAreaLight("#d8e3e7", 2.7, 3.8, 4.8);
    backFill.position.set(-1.8, 2.9, -4.5);
    backFill.lookAt(-0.1, 1.45, 0);
    const spineRake = new THREE.RectAreaLight("#ffe8c2", 1.9, 0.9, 4.6);
    spineRake.position.set(-4.6, 3.2, 1.1);
    spineRake.lookAt(-0.55, 1.5, 0);
    const pageRake = new THREE.RectAreaLight("#fff7e7", 2.15, 1.15, 3.8);
    pageRake.position.set(4.2, 4.8, 3.1);
    pageRake.lookAt(0.65, 1.55, 0);
    scene.add(ambient, key, fill, softKey, rim, backFill, spineRake, pageRake);
    volumes.forEach((volume) => shelfGroup.add(volume.root));

    const themeTargets = {
      floor: new THREE.Color(),
      wall: new THREE.Color(),
      shelf: new THREE.Color(),
      fog: new THREE.Color(),
      hemisphere: new THREE.Color(),
      hemisphereGround: new THREE.Color(),
      key: new THREE.Color(),
      fill: new THREE.Color(),
      rim: new THREE.Color(),
    };
    let themeMoving = false;
    let themeInitialized = false;

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

    function getDetailScale() {
      return experience.getBoundingClientRect().width < 820 ? 0.76 : 0.9;
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

    function applyThemeImmediately() {
      floorMaterial.color.copy(themeTargets.floor);
      wallMaterial.color.copy(themeTargets.wall);
      shelfMaterial.color.copy(themeTargets.shelf);
      scene.background.copy(themeTargets.wall);
      scene.fog.color.copy(themeTargets.fog);
      ambient.color.copy(themeTargets.hemisphere);
      ambient.groundColor.copy(themeTargets.hemisphereGround);
      key.color.copy(themeTargets.key);
      softKey.color.copy(themeTargets.key);
      fill.color.copy(themeTargets.fill);
      rim.color.copy(themeTargets.rim);
      backFill.color.copy(themeTargets.fill);
      spineRake.color.copy(themeTargets.key);
      pageRake.color.copy(themeTargets.hemisphere);
      themeMoving = false;
    }

    function setBookTheme(book) {
      const style = experience.style;
      style.setProperty("--paper", book.palette.paper);
      style.setProperty("--paper-deep", book.palette.paperDeep);
      style.setProperty("--paper-pale", book.palette.paperPale);
      style.setProperty("--ink", book.palette.ink);
      style.setProperty("--ink-soft", book.palette.inkSoft);
      style.setProperty("--shelf", book.palette.shelf);
      style.setProperty("--shelf-dark", book.palette.shelfDark);
      themeTargets.floor.set(book.palette.paperDeep);
      themeTargets.wall.set(book.palette.wall);
      themeTargets.shelf.set(book.palette.shelf);
      themeTargets.fog.set(book.palette.wall);
      themeTargets.hemisphere.set(book.palette.paperPale);
      themeTargets.hemisphereGround.set(book.palette.shelf);
      themeTargets.key.set(book.palette.light);
      themeTargets.fill.set(book.palette.fill);
      themeTargets.rim.set(book.foil);
      if (!themeInitialized) {
        themeInitialized = true;
        applyThemeImmediately();
      } else {
        themeMoving = true;
      }
    }

    function updateThemeMotion(delta) {
      if (!themeMoving) return false;
      const amount = 1 - Math.exp(-delta * 5.5);
      let largestGap = 0;
      const easeColor = (current, target) => {
        const redGap = current.r - target.r;
        const greenGap = current.g - target.g;
        const blueGap = current.b - target.b;
        largestGap = Math.max(largestGap, redGap * redGap + greenGap * greenGap + blueGap * blueGap);
        current.lerp(target, amount);
      };
      easeColor(floorMaterial.color, themeTargets.floor);
      easeColor(wallMaterial.color, themeTargets.wall);
      easeColor(shelfMaterial.color, themeTargets.shelf);
      easeColor(scene.background, themeTargets.wall);
      easeColor(scene.fog.color, themeTargets.fog);
      easeColor(ambient.color, themeTargets.hemisphere);
      easeColor(ambient.groundColor, themeTargets.hemisphereGround);
      easeColor(key.color, themeTargets.key);
      easeColor(softKey.color, themeTargets.key);
      easeColor(fill.color, themeTargets.fill);
      easeColor(rim.color, themeTargets.rim);
      easeColor(backFill.color, themeTargets.fill);
      easeColor(spineRake.color, themeTargets.key);
      easeColor(pageRake.color, themeTargets.hemisphere);
      if (largestGap < 0.0000025) applyThemeImmediately();
      return themeMoving;
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

    function ensureReadingLeafArt(volume) {
      if (volume.readingArtReady) return;
      const assignTexture = (material, spreadIndex) => {
        const canvas = document.createElement("canvas");
        canvas.width = 384;
        canvas.height = 576;
        drawReadingPage(canvas, volume.book, spreadIndex);
        material.map = configureCanvasTexture(new THREE.CanvasTexture(canvas));
        material.needsUpdate = true;
      };
      volume.readingLeaves.forEach((leaf) => {
        assignTexture(leaf.frontMaterial, leaf.order);
        assignTexture(leaf.backMaterial, Math.min(leaf.order + 1, SPREAD_COUNT - 1));
      });
      volume.readingArtReady = true;
    }

    function updateReadingUi() {
      const book = currentBook();
      const labels = getSpreadLabels(book);
      updateText(pageLabel, readingOpen ? labels[pageIndex] : "Closed");
      updateText(pageCounter, readingOpen ? `${String(pageIndex + 1).padStart(2, "0")} / ${String(SPREAD_COUNT).padStart(2, "0")}` : "Click book to open");
      if (previousPageButton) previousPageButton.disabled = !readingOpen || pageIndex === 0;
      if (nextPageButton) nextPageButton.disabled = !readingOpen || pageIndex === SPREAD_COUNT - 1;
      previousPageButton?.setAttribute("aria-label", pageIndex > 0 && readingOpen ? `Previous sample page: ${labels[pageIndex - 1]}` : "Previous sample page");
      nextPageButton?.setAttribute("aria-label", pageIndex < SPREAD_COUNT - 1 && readingOpen ? `Next sample page: ${labels[pageIndex + 1]}` : "Next sample page");
      if (toggleBookButton) {
        toggleBookButton.setAttribute("aria-pressed", String(readingOpen));
        toggleBookButton.textContent = readingOpen ? "Close book" : "Open book";
      }
      if (detailPanel) {
        detailPanel.querySelector(".detail-controls .microcopy")?.replaceChildren(
          document.createTextNode(readingOpen ? "Drag pages · Drag cover to close · Background to orbit" : "Drag cover or click once to open · Background to orbit"),
        );
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
      const count = levelLength();
      let offset = column - focus;
      offset -= Math.round(offset / count) * count;
      const distance = Math.abs(offset);
      const emphasis = 1 - clamp(distance, 0, 1);
      return new THREE.Vector3(
        offset * 1.5,
        0.47 + volume.dimensions.height / 2 + emphasis * 0.15,
        0.13 + emphasis * 0.24 - Math.min(distance, 2.8) * 0.07,
      );
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
        const focus = currentIndex - levelStart();
        const count = levelLength();
        let offset = column - focus;
        offset -= Math.round(offset / count) * count;
        volume.targetRotation.set(0, -offset * 0.105, -offset * 0.018);
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

    function getReadingLeafPose(volume, leaf) {
      let turn = 0;
      if (readingOpen && volume === currentVolume()) {
        turn = leaf.order < pageIndex ? 1 : 0;
        if (pageDrag?.volume === volume && pageDrag.direction !== 0) {
          const dragOrder = pageDrag.direction > 0 ? pageIndex : pageIndex - 1;
          if (leaf.order === dragOrder) {
            turn = pageDrag.direction > 0 ? pageDrag.progress : 1 - pageDrag.progress;
          }
        }
      }
      const restingAngle = -0.028 + leaf.order * 0.008;
      const turnedAngle = -Math.PI + 0.085 + leaf.order * 0.014;
      return {
        rotation: THREE.MathUtils.lerp(restingAngle, turnedAngle, turn),
        z: THREE.MathUtils.lerp(leaf.restZ, leaf.turnedZ, turn),
      };
    }

    function settleBooks(delta) {
      let isSettling = false;
      volumes.forEach((volume) => {
        const isHovered = mode === "browse" && hoverIndex === volume.index;
        const hoverCoverTarget = isHovered ? -0.085 : volume.coverTarget;
        const coverDifference = Math.abs(volume.coverPivot.rotation.y - hoverCoverTarget);
        const pageDifference = Math.abs(volume.pageLines.rotation.y - volume.pageTarget);
        const readingTarget = readingOpen && volume === currentVolume() ? 1 : 0;
        const readingDifference = Math.abs(volume.readingFade - readingTarget);
        const readingLeafDifference = volume.readingLeaves.some((leaf) => {
          const pose = getReadingLeafPose(volume, leaf);
          return Math.abs(leaf.pivot.rotation.y - pose.rotation) > 0.0005
            || Math.abs(leaf.pivot.position.z - pose.z) > 0.0005;
        });
        if (coverDifference > 0.0005 || pageDifference > 0.0005 || readingDifference > 0.0005 || readingLeafDifference) isSettling = true;
        volume.coverPivot.rotation.y = damp(volume.coverPivot.rotation.y, hoverCoverTarget, 13, delta);
        volume.pageLines.rotation.y = damp(volume.pageLines.rotation.y, volume.pageTarget, 13, delta);
        volume.readingFade = damp(volume.readingFade, readingTarget, 15, delta);
        volume.readingLeaves.forEach((leaf) => {
          const pose = getReadingLeafPose(volume, leaf);
          leaf.pivot.rotation.y = damp(leaf.pivot.rotation.y, pose.rotation, 14, delta);
          leaf.pivot.position.z = damp(leaf.pivot.position.z, pose.z, 14, delta);
          leaf.pivot.visible = volume.readingFade > 0.01;
        });
        volume.readingMaterials.forEach((material) => {
          material.opacity = volume.opacity * volume.readingFade;
          material.depthWrite = volume.readingFade > 0.98;
        });
        if (!volume.root.visible || volume.root.parent !== shelfGroup) return;
        const positionDifference = volume.root.position.distanceTo(volume.target);
        const rotationDifference = Math.abs(volume.root.rotation.y - volume.targetRotation.y)
          + Math.abs(volume.root.rotation.z - volume.targetRotation.z);
        if (positionDifference > 0.0005 || rotationDifference > 0.0005) isSettling = true;
        volume.root.position.x = damp(volume.root.position.x, volume.target.x, 12, delta);
        volume.root.position.y = damp(volume.root.position.y, volume.target.y, 12, delta);
        volume.root.position.z = damp(volume.root.position.z, volume.target.z, 12, delta);
        volume.root.rotation.y = damp(volume.root.rotation.y, volume.targetRotation.y, 12, delta);
        volume.root.rotation.z = damp(volume.root.rotation.z, volume.targetRotation.z, 12, delta);
        const focus = 1 - clamp(Math.abs(volume.target.x) / 1.5, 0, 1);
        const targetScale = 1 + focus * 0.09;
        if (Math.abs(volume.root.scale.x - targetScale) > 0.0005) isSettling = true;
        const nextScale = damp(volume.root.scale.x, targetScale, 12, delta);
        volume.root.scale.setScalar(nextScale);
        const hoverY = isHovered ? 0.035 : 0;
        const hoverTiltX = isHovered ? pointer.y * 0.035 : 0;
        const hoverTiltY = isHovered ? -pointer.x * 0.035 : 0;
        if (Math.abs(volume.motion.position.y - hoverY) > 0.0005
          || Math.abs(volume.motion.rotation.x - hoverTiltX) > 0.0005
          || Math.abs(volume.motion.rotation.y - hoverTiltY) > 0.0005) isSettling = true;
        volume.motion.position.y = damp(volume.motion.position.y, hoverY, 9, delta);
        volume.motion.rotation.x = damp(volume.motion.rotation.x, hoverTiltX, 10, delta);
        volume.motion.rotation.y = damp(volume.motion.rotation.y, hoverTiltY, 10, delta);
        volume.contactShadow.material.opacity = volume.opacity * (isHovered ? 0.3 : 0.24);
      });
      return isSettling;
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
        const shelfExit = easeInOut(clamp(progress / OPENING_ENVIRONMENT_CLEAR_PROGRESS, 0, 1));
        environment.visible = true;
        environment.position.y = THREE.MathUtils.lerp(0, -4.2, shelfExit);
        volume.root.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
        volume.root.rotation.y = THREE.MathUtils.lerp(transition.fromRotation, 0, eased);
        volume.root.scale.setScalar(THREE.MathUtils.lerp(transition.fromScale, transition.toScale, eased));
        camera.position.lerpVectors(transition.cameraFrom, detailCamera, eased);
        cameraTarget.lerpVectors(transition.targetFrom, detailTarget, eased);
        if (progress === 1) {
          mode = "detail";
          controls.enabled = true;
          experience.classList.remove("is-opening");
          transition = null;
          announce(`${currentBook().title} opened. Click the book to read sample chapters.`);
        }
      } else {
        const shelfReturn = easeInOut(clamp((progress - CLOSING_ENVIRONMENT_REVEAL_PROGRESS) / (1 - CLOSING_ENVIRONMENT_REVEAL_PROGRESS), 0, 1));
        environment.visible = true;
        environment.position.y = THREE.MathUtils.lerp(-4.2, 0, shelfReturn);
        volume.root.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
        volume.root.rotation.y = THREE.MathUtils.lerp(transition.fromRotation, transition.toRotation, eased);
        volume.root.rotation.z = THREE.MathUtils.lerp(transition.fromRotationZ, transition.toRotationZ, eased);
        volume.root.scale.setScalar(THREE.MathUtils.lerp(transition.fromScale, transition.toScale, eased));
        camera.position.lerpVectors(transition.cameraFrom, browseCamera, eased);
        cameraTarget.lerpVectors(transition.targetFrom, new THREE.Vector3(0, 1.55, 0), eased);
        if (progress === 1) {
          shelfGroup.add(volume.root);
          volume.root.position.copy(transition.toPosition);
          volume.root.rotation.y = transition.toRotation;
          volume.root.rotation.z = transition.toRotationZ;
          volume.root.scale.setScalar(transition.toScale);
          volume.contactShadow.visible = true;
          volume.target.copy(transition.toPosition);
          volume.targetRotation.set(0, transition.toRotation, transition.toRotationZ);
          environment.position.y = 0;
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
      setBookTheme(currentBook());
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
      volume.contactShadow.visible = false;
      environment.visible = true;
      environment.position.y = 0;
      controls.enabled = false;
      detailGroup.add(volume.root);
      transition = {
        kind: "opening",
        startedAt: performance.now(),
        duration: OPEN_DURATION,
        fromPosition: volume.root.position.clone(),
        toPosition: new THREE.Vector3(-0.95, 1.56, 0.15),
        fromRotation: volume.root.rotation.y,
        fromScale: volume.root.scale.x,
        toScale: getDetailScale(),
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
      pageIndex = 0;
      pageDrag = null;
      volume.coverTarget = 0;
      volume.pageTarget = 0;
      experience.classList.remove("is-reading");
      controls.enabled = false;
      const target = getTargetFor(volume, currentIndex - levelStart());
      const focus = 1 - clamp(Math.abs(target.x) / 1.5, 0, 1);
      transition = {
        kind: "closing",
        startedAt: performance.now(),
        duration: CLOSE_DURATION,
        fromPosition: volume.root.position.clone(),
        toPosition: target,
        fromRotation: volume.root.rotation.y,
        toRotation: volume.targetRotation.y,
        fromRotationZ: volume.root.rotation.z,
        toRotationZ: volume.targetRotation.z,
        fromScale: volume.root.scale.x,
        toScale: 1 + focus * 0.09,
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
      const volume = currentVolume();
      pageIndex = readingOpen ? pageIndex : 0;
      volume.coverTarget = readingOpen ? -Math.PI + 0.08 : 0;
      volume.pageTarget = 0;
      pageDrag = null;
      if (readingOpen) ensureReadingLeafArt(volume);
      experience.classList.toggle("is-reading", readingOpen);
      updateReadingUi();
      options.onReadingChange?.(readingOpen);
      announce(readingOpen ? `${currentBook().title} opened to its title page. Drag a page horizontally or use the arrow controls to read.` : `${currentBook().title} closed. Drag the cover, click the book, or use Open book to begin reading.`);
      requestRender();
    }

    function previousPage() {
      if (!readingOpen || pageIndex === 0) return;
      pageIndex -= 1;
      updateReadingUi();
      announce(`Page ${pageIndex + 1} of ${SPREAD_COUNT}: ${getSpreadLabels(currentBook())[pageIndex]}.`);
      requestRender();
    }

    function nextPage() {
      if (!readingOpen || pageIndex >= SPREAD_COUNT - 1) return;
      pageIndex += 1;
      updateReadingUi();
      announce(`Page ${pageIndex + 1} of ${SPREAD_COUNT}: ${getSpreadLabels(currentBook())[pageIndex]}.`);
      requestRender();
    }

    function resetView() {
      if (mode !== "detail") return;
      controls.reset();
      camera.position.copy(detailCamera);
      cameraTarget.copy(detailTarget);
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

    function beginPageDrag(event) {
      if (!readingOpen || readPointer(event) !== currentIndex) return false;
      pageDrag = {
        volume: currentVolume(),
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        direction: 0,
        progress: 0,
      };
      controls.enabled = false;
      sceneCanvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      requestRender();
      return true;
    }

    function updatePageDrag(event) {
      if (!pageDrag || event.pointerId !== pageDrag.pointerId) return;
      const deltaX = event.clientX - pageDrag.startX;
      const deltaY = event.clientY - pageDrag.startY;
      if (Math.abs(deltaX) < 4 || Math.abs(deltaX) < Math.abs(deltaY) * 0.72) {
        pageDrag.progress = 0;
        pageDrag.direction = 0;
      } else {
        const direction = deltaX < 0 ? 1 : -1;
        const available = direction > 0 ? pageIndex < SPREAD_COUNT - 1 : pageIndex > 0;
        pageDrag.direction = available ? direction : 0;
        pageDrag.progress = available ? clamp(Math.abs(deltaX) / PAGE_DRAG_DISTANCE, 0, 1) : 0;
      }
      event.preventDefault();
      requestRender();
    }

    function commitPageDrag(event) {
      if (!pageDrag || event.pointerId !== pageDrag.pointerId) return false;
      updatePageDrag(event);
      const drag = pageDrag;
      pageDrag = null;
      controls.enabled = mode === "detail";
      if (sceneCanvas.hasPointerCapture?.(event.pointerId)) sceneCanvas.releasePointerCapture(event.pointerId);
      if (drag.progress >= 0.3 && drag.direction > 0) nextPage();
      else if (drag.progress >= 0.3 && drag.direction < 0) previousPage();
      else requestRender();
      return true;
    }

    function onPointerMove(event) {
      if (pageDrag) {
        updatePageDrag(event);
        return;
      }
      if (mode !== "browse") return;
      const index = readPointer(event);
      if (hoverIndex === index) return;
      hoverIndex = index;
      sceneCanvas.classList.toggle("has-book-hover", index >= 0);
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
      requestRender();
    }

    function onPointerDown(event) {
      if (mode === "detail" && beginPageDrag(event)) return;
      pointerDown = { x: event.clientX, y: event.clientY, index: mode === "browse" ? readPointer(event) : -1 };
    }

    function onPointerUp(event) {
      if (commitPageDrag(event)) return;
      if (!pointerDown) return;
      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      const selected = pointerDown.index;
      pointerDown = null;
      if (distance > 8) return;
      if (mode === "browse" && selected >= 0) {
        if (selected !== currentIndex) select(selected);
        else inspect();
      } else if (mode === "detail") {
        const detailBook = readPointer(event);
        if (!readingOpen && detailBook === currentIndex) toggleBook();
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
      if (mode === "detail" && readingOpen && event.key === "ArrowLeft") { event.preventDefault(); previousPage(); }
      else if (mode === "detail" && readingOpen && event.key === "ArrowRight") { event.preventDefault(); nextPage(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
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
      let shelfIsSettling = false;
      if (mode === "browse") {
        updateShelfMotion(now);
        shelfIsSettling = settleBooks(delta);
      }
      const themeIsMoving = updateThemeMotion(delta);
      updateTransition(now, delta);
      if (mode !== "browse") {
        settleBooks(delta);
      }
      if (mode === "detail") {
        controls.update();
        cameraTarget.copy(controls.target);
      }
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
      if (transition || levelMotion || mode === "detail" || shelfIsSettling || themeIsMoving) requestRender();
    }

    function requestRender() {
      if (!frame && !destroyed) frame = requestAnimationFrame(render);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(experience);
    sceneCanvas.addEventListener("pointermove", onPointerMove, { signal });
    sceneCanvas.addEventListener("pointerleave", () => {
      hoverIndex = -1;
      sceneCanvas.classList.remove("has-book-hover");
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

    setBookTheme(currentBook());
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
