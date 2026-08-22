// --- Datos de prueba: relación tarea -> video de YouTube ---
// Reemplazaremos estos IDs por los videos reales más adelante.
const TASKS = {
  demo1: { title: "Tarea de prueba 1", youtubeId: "M7lc1UVf-VE" },
  demo2: { title: "Tarea de prueba 2", youtubeId: "aqz-KE-bpKQ" },
  demo3: { title: "Tarea de prueba 3", youtubeId: "ysz5S6PUM-U" },
};

let player;           // instancia del reproductor de YouTube
let isPlayerReady = false;

// --- Referencias a elementos del DOM ---
const taskSelect = document.getElementById("task-select");
const btnPlayPause = document.getElementById("btn-play-pause");
const btnRestart = document.getElementById("btn-restart");
const versionTag = document.getElementById("version-tag");

// --- 1. Cargar y mostrar la versión desde version.json ---
fetch("version.json")
  .then((response) => response.json())
  .then((data) => {
    versionTag.textContent = "v" + data.version;
  })
  .catch((error) => {
    console.error("No se pudo cargar version.json:", error);
  });

// --- 2. Función requerida por la YouTube IFrame API ---
// La API busca automáticamente una función global con este nombre exacto
// una vez terminó de cargar el script https://www.youtube.com/iframe_api
function onYouTubeIframeAPIReady() {
  player = new YT.Player("youtube-player", {
    height: "100%",
    width: "100%",
    playerVars: {
      controls: 0,      // ocultamos los controles nativos de YouTube,
                         // porque vamos a usar los nuestros
      rel: 0,            // evita mostrar videos relacionados de otros canales
      modestbranding: 1,
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

// --- 3. Actualiza el texto del botón según el estado real del video ---
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    btnPlayPause.textContent = "⏸ Pausar";
  } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    btnPlayPause.textContent = "▶ Reproducir";
  }
}

// --- 4. Selector de tarea: carga el video correspondiente ---
taskSelect.addEventListener("change", () => {
  const selectedTask = TASKS[taskSelect.value];
  if (!selectedTask || !isPlayerReady) return;

  player.loadVideoById(selectedTask.youtubeId);
  btnPlayPause.disabled = false;
  btnRestart.disabled = false;
});

// --- 5. Botón Reproducir/Pausar ---
btnPlayPause.addEventListener("click", () => {
  if (!isPlayerReady) return;

  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
});

// --- 6. Botón Reiniciar ---
btnRestart.addEventListener("click", () => {
  if (!isPlayerReady) return;

  player.seekTo(0, true);
  player.playVideo();
});