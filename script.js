let video;
let hands;
let results = null;

const fingertipIndices = [4, 8, 12, 16, 20];
const fingerTexts = [
  ["1. my name is dima b i am a graphic designer",
   "2. i value curiosity and fun in my work",
   "3. creativity drives me",
   "4. I like experimenting",
   "5. I love learning new things"],
   
  ["1. Hello from second hand",
   "2. More fun text",
   "3. Another line",
   "4. Keep exploring",
   "5. Enjoy the process"]
];

const labels = [[],[]]; // labels for each hand
let smoothKeypoints = [[],[]];

function setupLabels() {
  const container = document.getElementById("video-container");
  fingerTexts.forEach((handTexts, hIdx) => {
    handTexts.forEach(text => {
      const p = document.createElement("p");
      p.className = "finger-label";
      p.textContent = text;
      container.appendChild(p);
      labels[hIdx].push(p);
    });
  });
}

function initHands() {
  hands = new Hands({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  });

  hands.onResults(res => {
    results = res;
  });
}

async function setupCamera() {
  video = document.getElementById("webcam");

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await new Promise(resolve => video.onloadedmetadata = () => resolve());

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({image: video});
    },
    width: 640,
    height: 480
  });
  camera.start();
}

function lerp(start,end,amt){ return start+(end-start)*amt; }

function updateLabels() {
  if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    return; // no hands → bail out early
  }

  results.multiHandLandmarks.forEach((landmarks, hIdx) => {
    if (!smoothKeypoints[hIdx] || smoothKeypoints[hIdx].length === 0) {
      smoothKeypoints[hIdx] = landmarks.map(pt => [pt.x, pt.y]);
    }

    fingertipIndices.forEach((i, idx) => {
      let lx = lerp(smoothKeypoints[hIdx][i][0], landmarks[i].x, 0.3);
      let ly = lerp(smoothKeypoints[hIdx][i][1], landmarks[i].y, 0.3);
      smoothKeypoints[hIdx][i] = [lx, ly];

      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      const finalX = videoWidth - (lx * videoWidth); // mirror
      const finalY = ly * videoHeight;

      if (labels[hIdx][idx]) {
        labels[hIdx][idx].style.left = finalX + "px";
        labels[hIdx][idx].style.top = finalY - 20 + "px";
      }
    });
  });
}

function animate() {
  updateLabels();
  requestAnimationFrame(animate);
}

// init
setupLabels();
initHands();
setupCamera().then(()=>animate());
