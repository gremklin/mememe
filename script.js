let video;
let handsProcessor;        // MediaPipe Hands instance
let results = null;        // latest onResults payload

// fingertip indices in MediaPipe
const fingertipIndices = [4, 8, 12, 16, 20];

// two sets of label text: [0] -> left hand set, [1] -> right hand set
const fingerTexts = [
  [ // left hand: use links
    { text: "2.1. graphics dept.", href: "/" },
    { text: "2.2. projects", href: "/projects.html" },
    { text: "2.3. gallery", href: "/gallery.html" },
    { text: "2.4. index", href: "/index.html" },
    { text: "2.5. about", href: "/about.html" }
  ],
  [ // right hand: plain text
    { text: "1.1. my name is dima b i am a graphic designer" },
    { text: "1.2. i value curiosity and fun in my work" },
    { text: "1.3. creativity drives me" },
    { text: "1.4. I like experimenting" },
    { text: "1.5. I love learning new things" }
  ]
];

const labels = [[], []];           // DOM elements per hand: labels[0] = left, labels[1] = right
let smoothKeypoints = [[], []];   // smoothed [x,y] per hand
let lastKeypoints   = [null, null];// last-known keypoints (for flicker)
const flickerFrames = 8;          // keep last position for N frames
let flickerCounter  = [0, 0];

// If your video is visually mirrored (CSS scaleX(-1)), set this true
// so we map MediaPipe "Left"/"Right" to the correct visual hand.
const swapHandsForMirror = true;

// ---------- helpers ----------
function lerp(a, b, t) { return a + (b - a) * t; }

// Map normalized landmark coordinates (x,y in 0..1) to overlay pixels for object-fit: cover
function mapPointCover(xNorm, yNorm) {
  const overlay = document.getElementById('overlay');
  const containerW = overlay.clientWidth;
  const containerH = overlay.clientHeight;

  const srcW = video.videoWidth || 640;
  const srcH = video.videoHeight || 480;

  // "cover" scale (fill and crop)
  const scale = Math.max(containerW / srcW, containerH / srcH);
  const renderW = srcW * scale;
  const renderH = srcH * scale;

  // cropped offset (how much the rendered content overflows the container)
  const offsetX = (renderW - containerW) / 2;
  const offsetY = (renderH - containerH) / 2;

  // point in rendered content coordinates
  const xInContent = xNorm * renderW;
  const yInContent = yNorm * renderH;

  // mirror horizontally inside rendered content (because video is mirrored)
  const xMirroredInContent = renderW - xInContent;

  // final coordinates in overlay (after cropping)
  const x = xMirroredInContent - offsetX;
  const y = yInContent - offsetY;

  return { x, y };
}

// Create label DOM elements
function setupLabels() {
  const overlay = document.getElementById('overlay');
  for (let h = 0; h < 2; h++) {
    labels[h] = [];
    fingerTexts[h].forEach((item, idx) => {
      let el;
      if (h === 0) {
        el = document.createElement('a');  // left hand -> links
        el.href = item.href || '#';
      } else {
        el = document.createElement('p');  // right hand -> text
      }
      el.className = 'finger-label';
      el.textContent = item.text;
      overlay.appendChild(el);
      labels[h].push(el);
    });
  }
}


// Initialize MediaPipe Hands
function initHands() {
  handsProcessor = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  handsProcessor.setOptions({
    maxNumHands: 2,
    modelComplexity: isMobile ? 0 : 1, // lite on mobile
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
  });

  handsProcessor.onResults((res) => {
    results = res; // store latest results for the animation loop
    // Note: we don't transform here — we'll handle mapping in the animation loop
  });
}

// Start camera and feed frames to MediaPipe
async function setupCameraAndStart() {
  video = document.getElementById('webcam');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
  });
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
  video.play();

  const camera = new Camera(video, {
    onFrame: async () => {
      if (handsProcessor) await handsProcessor.send({ image: video });
    },
    width: video.videoWidth || 640,
    height: video.videoHeight || 480
  });
  camera.start();
}

// Main label update logic:
// - map detected hands to left/right using results.multiHandedness
// - fill presentHands[0]/[1] with arrays of [x,y] normalized coords
// - fallback to lastKeypoints + flickerCounter when hand disappears
function updateLabels() {
  // presentHands[h] will be either null or an array of [x,y] for 21 keypoints
  const presentHands = [null, null];

  if (results && results.multiHandLandmarks && results.multiHandLandmarks.length) {
    // multiHandLandmarks and multiHandedness align by index
    results.multiHandLandmarks.forEach((landmarks, idx) => {
      // get handedness label ('Left' or 'Right') — fallback to 'Right'
      let handednessLabel = 'Right';
      if (results.multiHandedness && results.multiHandedness[idx] && results.multiHandedness[idx].classification) {
        handednessLabel = results.multiHandedness[idx].classification[0].label;
      } else if (results.multiHandedness && results.multiHandedness[idx] && results.multiHandedness[idx].label) {
        // some builds keep label at .label
        handednessLabel = results.multiHandedness[idx].label;
      }

      // map label -> hand index (0 = left set, 1 = right set)
      let handIndex = (handednessLabel === 'Left') ? 0 : 1;
      if (swapHandsForMirror) handIndex = 1 - handIndex; // swap if using mirrored display

      // convert landmarks to normalized [x,y] pairs (MediaPipe gives normalized coordinates)
      const pts = landmarks.map(pt => [pt.x, pt.y]);
      presentHands[handIndex] = pts;

      // update lastKeypoints and flicker counter
      lastKeypoints[handIndex] = pts.map(p => [...p]);
      flickerCounter[handIndex] = flickerFrames;
    });
  }

  // For each logical hand slot (0 = left, 1 = right)
  for (let h = 0; h < 2; h++) {
    let keypoints = null;

    if (presentHands[h]) {
      keypoints = presentHands[h];
    } else if (lastKeypoints[h] && flickerCounter[h] > 0) {
      keypoints = lastKeypoints[h];
      flickerCounter[h]--;
    } else {
      // no hand — hide labels for this side
      if (labels[h]) labels[h].forEach(lbl => lbl.style.opacity = 0);
      // and reset smoothing so it reinitializes cleanly when hand reappears
      smoothKeypoints[h] = [];
      continue;
    }

    // Initialize smoothKeypoints for this hand if needed
    if (!smoothKeypoints[h] || smoothKeypoints[h].length === 0) {
      smoothKeypoints[h] = keypoints.map(p => [...p]);
    }

    // For each fingertip index: smooth, map to overlay pixels, position label
    fingertipIndices.forEach((ptIndex, labelIdx) => {
      // keypoints are arrays [xNorm, yNorm]
      const targetX = keypoints[ptIndex][0];
      const targetY = keypoints[ptIndex][1];

      // smoothing (in normalized space)
      smoothKeypoints[h][ptIndex][0] = lerp(smoothKeypoints[h][ptIndex][0], targetX, 0.32);
      smoothKeypoints[h][ptIndex][1] = lerp(smoothKeypoints[h][ptIndex][1], targetY, 0.32);

      const mapped = mapPointCover(smoothKeypoints[h][ptIndex][0], smoothKeypoints[h][ptIndex][1]);

      const lbl = (labels[h] && labels[h][labelIdx]) ? labels[h][labelIdx] : null;
      if (!lbl) return; // safe-guard

      // hide if outside viewport by a margin
      if (mapped.x < -80 || mapped.x > window.innerWidth + 80 ||
          mapped.y < -80 || mapped.y > window.innerHeight + 80) {
        lbl.style.opacity = 0;
      } else {
        lbl.style.opacity = 1;
        lbl.style.left = `${mapped.x}px`;
        lbl.style.top  = `${mapped.y - 20}px`;
      }
    });
  }
}

// animation loop
function animate() {
  updateLabels();
  requestAnimationFrame(animate);
}

// ---- init sequence ----
setupLabels();
initHands();
setupCameraAndStart().then(() => animate());