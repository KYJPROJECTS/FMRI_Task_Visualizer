// ================== PANTALLA DEL PACIENTE (modo presentador) ==================
// Esta ventana no tiene controles propios: solo refleja lo que le manda la
// ventana de control (investigacion.js) por BroadcastChannel. Se abre desde
// el botón "Pantalla del paciente" en Investigación y se arrastra al
// proyector/segundo monitor, poniéndola en pantalla completa con F11.

const presenterChannel = new BroadcastChannel("fmri-investigacion-presenter");

const stageImage = document.getElementById("stage-image");
const youtubeStage = document.getElementById("youtube-player-proj-wrapper"); // el envoltorio, NO el div que la API de YouTube reemplaza

let ytPlayer;
let isYtPlayerReady = false;
let pendingVideoId = null; // por si "show-explainer" llega antes de que el reproductor esté listo

function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player("youtube-player-proj", {
    height: "100%",
    width: "100%",
    playerVars: {
      controls: 0, // el paciente nunca ve controles de YouTube
      disablekb: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      cc_load_policy: 0,
    },
    events: { onReady: onYtPlayerReady },
  });
}

function onYtPlayerReady() {
  isYtPlayerReady = true;
  if (pendingVideoId) {
    ytPlayer.cueVideoById(pendingVideoId);
    pendingVideoId = null;
  }
}

function showImage(src) {
  if (isYtPlayerReady) ytPlayer.pauseVideo();
  youtubeStage.hidden = true;
  stageImage.hidden = false;
  stageImage.src = src;
}

function showExplainer(videoId) {
  stageImage.hidden = true;
  youtubeStage.hidden = false;
  if (isYtPlayerReady) ytPlayer.cueVideoById(videoId);
  else pendingVideoId = videoId;
}

function showBlank() {
  stageImage.hidden = true;
  stageImage.src = "";
  youtubeStage.hidden = true;
  if (isYtPlayerReady) ytPlayer.stopVideo();
}

presenterChannel.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg) return;
  switch (msg.type) {
    case "show-image":
      showImage(msg.src);
      break;
    case "show-explainer":
      showExplainer(msg.videoId);
      break;
    case "play-explainer":
      if (isYtPlayerReady) ytPlayer.playVideo();
      break;
    case "pause-explainer":
      if (isYtPlayerReady) ytPlayer.pauseVideo();
      break;
    case "seek-explainer":
      if (isYtPlayerReady) ytPlayer.seekTo(msg.seconds, true);
      break;
    case "show-blank":
      showBlank();
      break;
  }
});

// Al abrir (o reabrir) esta ventana, pide a la ventana de control que
// vuelva a mandar el estado actual — así no queda en blanco si se cerró y
// se reabrió a mitad de sesión.
presenterChannel.postMessage({ type: "request-state" });