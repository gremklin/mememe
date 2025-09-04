let video, handpose, hands = [];
const fingerTexts = 
["1. my name is dima b i am a graphic designer",
  "2. i value curiosity and fun in my work",
  "3. i value curiosity and fun in my work",
  "4. i value curiosity and fun in my work",
  "5. i value curiosity and fun in my work"];
const fingertipIndices = [4,8,12,16,20];
const labels = [];

// Smoothing and flicker
let smoothKeypoints = [];
let lastKeypoints = null;
const flickerFrames = 5;
let flickerCounter = 0;

function setupLabels() {
  const container = document.getElementById("video-container");
  fingerTexts.forEach(text => {
    const p = document.createElement("p");
    p.className = "finger-label";
    p.textContent = text;
    container.appendChild(p);
    labels.push(p);
  });
}

async function setupVideo() {
  video = document.getElementById("webcam");
  const stream = await navigator.mediaDevices.getUserMedia({video:true});
  video.srcObject = stream;

  await new Promise(resolve => video.onloadedmetadata = () => resolve());
  video.play();

  resizeVideo(); // set initial size
  window.addEventListener("resize", resizeVideo);

  // Load handpose
  handpose = ml5.handpose(video, () => console.log("Handpose loaded"));
  handpose.on("predict", results => {
    hands = results;
    if (hands.length > 0) {
      lastKeypoints = hands[0].landmarks.map(k => [...k]);
      flickerCounter = flickerFrames;
    }
  });
}

function resizeVideo() {
  const maxWidth = window.innerWidth - 100; // 50px margins each side
  const maxHeight = window.innerHeight - 100; // 50px margins top/bottom

  const videoAspect = video.videoWidth / video.videoHeight;
  const windowAspect = maxWidth / maxHeight;

  if(videoAspect > windowAspect){
    video.style.width = maxWidth + "px";
    video.style.height = "auto";
  } else {
    video.style.width = "auto";
    video.style.height = maxHeight + "px";
  }
}

function updateLabels() {
  if(hands.length === 0 && (!lastKeypoints || flickerCounter <= 0)) return;

  const keypoints = hands.length > 0 ? hands[0].landmarks : lastKeypoints;
  if(hands.length === 0) flickerCounter--;

  if(smoothKeypoints.length === 0){
    smoothKeypoints = keypoints.map(k => [...k]);
  }

  const scaleX = video.clientWidth / video.videoWidth;
  const scaleY = video.clientHeight / video.videoHeight;

  fingertipIndices.forEach((i, idx) => {
    const [x, y] = keypoints[i];
    smoothKeypoints[i][0] = lerp(smoothKeypoints[i][0], x, 0.3);
    smoothKeypoints[i][1] = lerp(smoothKeypoints[i][1], y, 0.3);

    const finalX = video.clientWidth - (smoothKeypoints[i][0]*scaleX); // mirror
    const finalY = smoothKeypoints[i][1]*scaleY;

    labels[idx].style.left = finalX + "px";
    labels[idx].style.top = finalY - 20 + "px"; // above fingertip
  });
}

function lerp(start,end,amt){
  return start + (end-start)*amt;
}

function animate(){
  updateLabels();
  requestAnimationFrame(animate);
}

// Initialize
setupLabels();
setupVideo().then(()=>animate());

window.addEventListener("resize", resizeVideo);
video.onloadedmetadata = () => resizeVideo();