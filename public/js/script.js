// --- Datos de prueba: relación tarea -> video de YouTube ---
const TASKS = {
  demo1: { title: "Tarea de prueba 1", youtubeId: "M7lc1UVf-VE" },
  demo2: { title: "Tarea de prueba 2", youtubeId: "aqz-KE-bpKQ" },
  demo3: { title: "Tarea de prueba 3", youtubeId: "ysz5S6PUM-U" },
};

let player;
let isPlayerReady = false;
let progressInterval; // guardamos la referencia para poder detenerlo después
let hideControlsTimeout;

// --- Referencias a elementos del DOM ---
const taskSelect = document.getElementById("task-select");
const versionTag = document.getElementById("version-tag");

const playerContainer = document.getElementById("player-container");
const videoOverlay = document.getElementById("video-overlay");
const customControls = document.getElementById("custom-controls");

const btnPlayPause = document.getElementById("btn-play-pause");
const btnRewind = document.getElementById("btn-rewind");
const btnRestart = document.getElementById("btn-restart");
const btnFullscreen = document.getElementById("btn-fullscreen");

const progressBarContainer = document.getElementById("progress-bar-container");
const progressBarFilled = document.getElementById("progress-bar-filled");

// --- 1. Cargar y mostrar la versión desde version.json ---
fetch("version.json")
  .then((response) => response.json())
  .then((data) => {
    versionTag.textContent = "v" + data.version;
  })
  .catch((error) => {
    console.error("No se pudo cargar version.json:", error);
  });

// --- 2. Inicializar el reproductor de YouTube ---
function onYouTubeIframeAPIReady() {
  player = new YT.Player("youtube-player", {
    height: "100%",
    width: "100%",
    playerVars: {
      controls: 0,       // ocultamos controles nativos de YouTube
      rel: 0,             // sin videos sugeridos de otros canales
      modestbranding: 1,  // reduce (no elimina) el branding de YouTube
      disablekb: 1,        // evita que el teclado controle el video por fuera de nuestros botones
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerReady() {
  isPlayerReady = true;
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    btnPlayPause.textContent = "⏸";
    startProgressTracking();
  } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    btnPlayPause.textContent = "▶";
    stopProgressTracking();
  }
}

// --- 3. Selector de tarea ---
taskSelect.addEventListener("change", () => {
  const selectedTask = TASKS[taskSelect.value];
  if (!selectedTask || !isPlayerReady) return;

  player.loadVideoById(selectedTask.youtubeId);
  [btnPlayPause, btnRewind, btnRestart, btnFullscreen].forEach((btn) => {
    btn.disabled = false;
  });
});

// --- 4. Función compartida: alternar reproducir/pausar ---
function togglePlayPause() {
  if (!isPlayerReady) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
}

btnPlayPause.addEventListener("click", togglePlayPause);

// Click sobre el video (la capa overlay) también reproduce/pausa —
// comportamiento estándar de cualquier reproductor de video
videoOverlay.addEventListener("click", togglePlayPause);

// --- 5. Retroceder 10 segundos ---
btnRewind.addEventListener("click", () => {
  if (!isPlayerReady) return;
  const newTime = Math.max(0, player.getCurrentTime() - 10);
  player.seekTo(newTime, true);
});

// --- 6. Reiniciar ---
btnRestart.addEventListener("click", () => {
  if (!isPlayerReady) return;
  player.seekTo(0, true);
  player.playVideo();
});

// --- 7. Barra de progreso ---
function startProgressTracking() {
  stopProgressTracking(); // evita duplicar intervalos si ya había uno corriendo
  progressInterval = setInterval(() => {
    if (!isPlayerReady) return;
    const current = player.getCurrentTime();
    const duration = player.getDuration();
    if (duration > 0) {
      const percentage = (current / duration) * 100;
      progressBarFilled.style.width = percentage + "%";
    }
  }, 500);
}

function stopProgressTracking() {
  clearInterval(progressInterval);
}

// Click en la barra de progreso: salta a ese punto del video
progressBarContainer.addEventListener("click", (event) => {
  if (!isPlayerReady) return;
  const rect = progressBarContainer.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percentage = clickX / rect.width;
  const duration = player.getDuration();
  player.seekTo(duration * percentage, true);
});

// --- 8. Pantalla completa ---
btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    playerContainer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// --- 9. Auto-ocultar controles cuando el mouse está inactivo ---
function showControls() {
  customControls.classList.remove("hidden");
  clearTimeout(hideControlsTimeout);
  hideControlsTimeout = setTimeout(() => {
    customControls.classList.add("hidden");
  }, 3000); // 3 segundos de inactividad antes de ocultar
}

playerContainer.addEventListener("mousemove", showControls);
playerContainer.addEventListener("mouseenter", showControls);