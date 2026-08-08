// ---------- Template layout (all coordinates in the template's native 1024x1536 pixel space) ----------

const TEMPLATE_W = 1024;
const TEMPLATE_H = 1536;

// Photo box: inset only slightly from the dashed border, so the photo fills the frame
const PHOTO_BOX = { x: 188, y: 588, w: 301, h: 357 };

// Both banners are now fully blank (no baked-in "NAME" / "STACK / ROLE" labels), so we
// draw a small label plus a large value in each — like a real form field — instead of
// squeezing text into a leftover gap next to the icon.
const NAME_BOX = {
  labelX: 545, labelBaselineY: 622,
  valueX: 545, valueBaselineY: 700, valueMaxWidth: 310 // stays clear of the starburst icon (~x870+)
};
const ROLE_BOX = {
  labelX: 545, labelBaselineY: 770,
  valueX: 545, valueBaselineY: 814, valueMaxWidth: 260 // stays clear of the squiggle icon (~x820+)
};

// Blank interior of the TIDE TRACK panel, above the scrubber bar.
const SONG_AREA = { x: 78, rightX: 928, baselineY: 1190, maxWidth: 850 };

const INK = '#002311';       // matches the dark text used for "NAME" / "STACK / ROLE" labels
const SONG_COLOR = '#c7d92e'; // matches the "TIDE TRACK" label color

// ---------- Elements ----------

const badgeCanvas = document.getElementById('badgeCanvas');
const bctx = badgeCanvas.getContext('2d');
badgeCanvas.width = TEMPLATE_W;
badgeCanvas.height = TEMPLATE_H;

const cropperCanvas = document.getElementById('cropperCanvas');
const cctx = cropperCanvas.getContext('2d');
const cropperWrap = document.getElementById('cropperWrap');

// Editor canvas mirrors the photo box's aspect ratio so drag/zoom is WYSIWYG
const EDITOR_W = 260;
const EDITOR_H = Math.round(EDITOR_W * (PHOTO_BOX.h / PHOTO_BOX.w));
cropperCanvas.width = EDITOR_W;
cropperCanvas.height = EDITOR_H;

const nameInput = document.getElementById('name');
const roleInput = document.getElementById('role');
const songInput = document.getElementById('song');
const photoInput = document.getElementById('photoInput');
const fileNameEl = document.getElementById('fileName');
const zoomRange = document.getElementById('zoomRange');
const recenterBtn = document.getElementById('recenterBtn');

const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const shareStatus = document.getElementById('shareStatus');
const tweetText = document.getElementById('tweetText');

let templateImg = null;
let photoImg = null;
let transform = { zoom: 1, offsetX: 0, offsetY: 0 }; // offsets are fractions of box width/height

// ---------- Load template ----------

templateImg = new Image();
templateImg.onload = renderAll;
templateImg.src = '/assets/template.png';

// ---------- Photo box drawing (shared between the small live editor and the final canvas) ----------

function drawPhotoIntoBox(ctx, img, x, y, w, h, t) {
  const coverScale = Math.max(w / img.width, h / img.height);
  const scale = coverScale * t.zoom;
  const drawW = img.width * scale;
  const drawH = img.height * scale;

  let dx = x + (w - drawW) / 2 + t.offsetX * w;
  let dy = y + (h - drawH) / 2 + t.offsetY * h;

  const minDx = x + w - drawW;
  const minDy = y + h - drawH;
  dx = Math.min(x, Math.max(minDx, dx));
  dy = Math.min(y, Math.max(minDy, dy));

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

function clampOffsetsForCurrentZoom() {
  if (!photoImg) return;
  const w = PHOTO_BOX.w, h = PHOTO_BOX.h;
  const coverScale = Math.max(w / photoImg.width, h / photoImg.height);
  const scale = coverScale * transform.zoom;
  const drawW = photoImg.width * scale;
  const drawH = photoImg.height * scale;
  const maxOffX = Math.max(0, (drawW - w) / 2) / w;
  const maxOffY = Math.max(0, (drawH - h) / 2) / h;
  transform.offsetX = Math.min(maxOffX, Math.max(-maxOffX, transform.offsetX));
  transform.offsetY = Math.min(maxOffY, Math.max(-maxOffY, transform.offsetY));
}

function drawCropper() {
  cctx.clearRect(0, 0, EDITOR_W, EDITOR_H);
  if (!photoImg) return;
  drawPhotoIntoBox(cctx, photoImg, 0, 0, EDITOR_W, EDITOR_H, transform);
}

// ---------- Autofit text helper ----------

function autofitFontSize(ctx, text, maxWidth, startSize, minSize, fontBuilder) {
  let size = startSize;
  ctx.font = fontBuilder(size);
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 1;
    ctx.font = fontBuilder(size);
  }
  return size;
}

// ---------- Final badge render ----------

function drawBadge() {
  const W = TEMPLATE_W, H = TEMPLATE_H;
  bctx.clearRect(0, 0, W, H);

  if (templateImg) {
    // 1. Template renders first (it's fully opaque — no cutout — so the photo must go
    //    on top). The photo box coordinates are already inset from the dashed border,
    //    so drawing the photo on top there covers the placeholder icon/text while
    //    leaving the dashed frame itself visible around it.
    bctx.drawImage(templateImg, 0, 0, W, H);
    if (photoImg) {
      drawPhotoIntoBox(bctx, photoImg, PHOTO_BOX.x, PHOTO_BOX.y, PHOTO_BOX.w, PHOTO_BOX.h, transform);
    }
  }

  // If there's no photo yet, the template's own "YOUR PHOTO HERE" placeholder shows through.

  // 2. Name + Role, stacked in the blank pocket of the NAME banner
  const name = (nameInput.value || '').trim().toUpperCase();
  if (name) {
    bctx.font = "600 26px 'Barlow Condensed', sans-serif";
    bctx.fillStyle = INK;
    bctx.textAlign = 'left';
    bctx.fillText('NAME', NAME_BOX.labelX, NAME_BOX.labelBaselineY);

    const nameFont = (s) => `800 ${s}px 'Barlow Condensed', sans-serif`;
    const size = autofitFontSize(bctx, name, NAME_BOX.valueMaxWidth, 74, 24, nameFont);
    bctx.font = nameFont(size);
    bctx.fillText(name, NAME_BOX.valueX, NAME_BOX.valueBaselineY);
  }

  const role = (roleInput.value || '').trim().toUpperCase();
  if (role) {
    bctx.font = "600 22px 'Barlow Condensed', sans-serif";
    bctx.fillStyle = INK;
    bctx.textAlign = 'left';
    bctx.fillText('STACK / ROLE', ROLE_BOX.labelX, ROLE_BOX.labelBaselineY);

    const roleFont = (s) => `700 ${s}px 'Barlow Condensed', sans-serif`;
    const size = autofitFontSize(bctx, role, ROLE_BOX.valueMaxWidth, 42, 16, roleFont);
    bctx.font = roleFont(size);
    bctx.fillText(role, ROLE_BOX.valueX, ROLE_BOX.valueBaselineY);
  }

  // 3. Beach song, in the blank Tide Track panel
  const song = (songInput.value || '').trim();
  if (song) {
    const songFont = (s) => `700 ${s}px 'Barlow Condensed', sans-serif`;
    const maxW = SONG_AREA.rightX - SONG_AREA.x;
    const centerX = (SONG_AREA.x + SONG_AREA.rightX) / 2;
    const size = autofitFontSize(bctx, song, maxW, 52, 20, songFont);
    bctx.font = songFont(size);
    bctx.fillStyle = SONG_COLOR;
    bctx.textAlign = 'center';
    bctx.fillText(song, centerX, SONG_AREA.baselineY);
  }
}

function renderAll() {
  drawCropper();
  drawBadge();
}

// ---------- Input wiring ----------

[nameInput, roleInput, songInput].forEach(el => el.addEventListener('input', drawBadge));

photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fileNameEl.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      photoImg = img;
      transform = { zoom: 1, offsetX: 0, offsetY: 0 };
      zoomRange.value = 100;
      cropperWrap.classList.remove('hidden');
      renderAll();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

zoomRange.addEventListener('input', () => {
  transform.zoom = Number(zoomRange.value) / 100;
  clampOffsetsForCurrentZoom();
  renderAll();
});

recenterBtn.addEventListener('click', () => {
  transform.offsetX = 0;
  transform.offsetY = 0;
  zoomRange.value = 100;
  transform.zoom = 1;
  renderAll();
});

// Drag-to-reposition (pointer events unify mouse + touch)
let dragging = false;
let dragStart = { x: 0, y: 0 };
let startOffset = { x: 0, y: 0 };

cropperCanvas.addEventListener('pointerdown', (e) => {
  if (!photoImg) return;
  dragging = true;
  cropperCanvas.setPointerCapture(e.pointerId);
  dragStart = { x: e.clientX, y: e.clientY };
  startOffset = { x: transform.offsetX, y: transform.offsetY };
});

cropperCanvas.addEventListener('pointermove', (e) => {
  if (!dragging || !photoImg) return;
  const rect = cropperCanvas.getBoundingClientRect();
  const scaleFactorX = EDITOR_W / rect.width;
  const scaleFactorY = EDITOR_H / rect.height;
  const dxPix = (e.clientX - dragStart.x) * scaleFactorX;
  const dyPix = (e.clientY - dragStart.y) * scaleFactorY;
  transform.offsetX = startOffset.x + dxPix / EDITOR_W;
  transform.offsetY = startOffset.y + dyPix / EDITOR_H;
  clampOffsetsForCurrentZoom();
  renderAll();
});

['pointerup', 'pointercancel', 'pointerleave'].forEach(evt =>
  cropperCanvas.addEventListener(evt, () => { dragging = false; })
);

// Pinch-zoom (two-touch) support
let pinchStartDist = null;
let pinchStartZoom = 1;
cropperCanvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && photoImg) {
    e.preventDefault();
    const [t1, t2] = e.touches;
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    if (pinchStartDist === null) {
      pinchStartDist = dist;
      pinchStartZoom = transform.zoom;
    } else {
      const newZoom = Math.min(3, Math.max(1, pinchStartZoom * (dist / pinchStartDist)));
      transform.zoom = newZoom;
      zoomRange.value = Math.round(newZoom * 100);
      clampOffsetsForCurrentZoom();
      renderAll();
    }
  }
}, { passive: false });
cropperCanvas.addEventListener('touchend', () => { pinchStartDist = null; });

// ---------- Download ----------

downloadBtn.addEventListener('click', () => {
  badgeCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hacker-house-goa-badge.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
});

// ---------- Share directly to X (no API call / no short-link generation) ----------

shareBtn.addEventListener('click', () => {
  const text = tweetText.value.trim();
  const intentUrl = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text);

  shareStatus.textContent = 'Opening X…';
  window.location.href = intentUrl;
});

// ---------- Init ----------

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(renderAll);
}
renderAll();
