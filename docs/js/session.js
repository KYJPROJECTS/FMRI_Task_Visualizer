// ================== ESTADO ==================
let allTasks = [];
let sequence = [];
let currentTaskId = null;

let player;
let isPlayerReady = false;
let progressInterval;
let hideControlsTimeout;
let isDraggingProgress = false;

// ================== DOM ==================
const btnToggleTasks = document.getElementById("btn-toggle-tasks");
const availableTasksPanel = document.getElementById("available-tasks-panel");
const availableTasksList = document.getElementById("available-tasks-list");
const sequenceList = document.getElementById("sequence-list");
const sequenceEmptyHint = document.getElementById("sequence-empty-hint");

const nowPlaying = document.getElementById("now-playing");
const currentTaskName = document.getElementById("current-task-name");
const progressLabel = document.getElementById("progress-label");

const playerContainer = document.getElementById("player-container");
const videoOverlay = document.getElementById("video-overlay");
const customControls = document.getElementById("custom-controls");
const restScreen = document.getElementById("rest-screen");
const btnContinueNext = document.getElementById("btn-continue-next");

const btnPlayPause = document.getElementById("btn-play-pause");
const btnRewind = document.getElementById("btn-rewind");
const btnForward = document.getElementById("btn-forward");
const btnRestart = document.getElementById("btn-restart");
const btnFullscreen = document.getElementById("btn-fullscreen");
const btnPrevTask = document.getElementById("btn-prev-task");
const btnNextTask = document.getElementById("btn-next-task");

const progressBarContainer = document.getElementById("progress-bar-container");
const progressBarFilled = document.getElementById("progress-bar-filled");

// ================== UTILIDADES ==================
function whenReady(fn) {
  return (...args) => { if (isPlayerReady) fn(...args); };
}

// ================== CATÁLOGO DE TAREAS ==================
fetch("data/tasks.json")
  .then((r) => r.json())
  .then((data) => {
    allTasks = data.tasks;
    renderAvailableTasks();
  })
  .catch((err) => {
    availableTasksList.innerHTML = "<li>⚠ No se pudo cargar el catálogo de tareas.</li>";
    console.error("Error cargando tasks.json:", err);
  });

btnToggleTasks.addEventListener("click", () => {
  const isHidden = availableTasksPanel.hidden;
  availableTasksPanel.hidden = !isHidden;
  btnToggleTasks.textContent = isHidden ? "Ocultar tareas disponibles" : "Mostrar tareas disponibles";
});

// ================== LISTA DE TAREAS DISPONIBLES ==================
function renderAvailableTasks() {
  availableTasksList.innerHTML = "";
  allTasks.forEach((task) => {
    const li = document.createElement("li");
    li.dataset.taskId = task.id;
    li.innerHTML = `
      <span class="task-title">${task.title}</span>
      <span class="task-duration">${task.duration}</span>
      <button class="task-action-btn btn-add" type="button" title="Agregar a la secuencia">+</button>
    `;

    li.addEventListener("dragstart", (e) => {
      if (sequence.includes(task.id)) { e.preventDefault(); return; }
      e.dataTransfer.setData("text/plain", JSON.stringify({ type: "new", taskId: task.id }));
    });

    li.querySelector(".task-action-btn").addEventListener("click", () => addTaskToSequence(task.id));

    availableTasksList.appendChild(li);
  });
  refreshAvailableTasksState();
}

// Oculta de la lista disponible cualquier tarea que ya esté en la secuencia.
function refreshAvailableTasksState() {
  [...availableTasksList.children].forEach((li) => {
    const taskId = li.dataset.taskId;
    const inSequence = sequence.includes(taskId);
    li.hidden = inSequence;
    li.draggable = !inSequence;
  });
}

// ================== AGREGAR / QUITAR DE LA SECUENCIA ==================
function addTaskToSequence(taskId) {
  if (sequence.includes(taskId)) return;
  const li = createSequenceItem(taskId);
  sequenceList.appendChild(li);
  syncSequenceFromDOM();
}

function removeTaskFromSequence(taskId) {
  if (isTaskCurrentlyPlaying(taskId)) return; // no se puede quitar lo que se está reproduciendo
  const li = sequenceList.querySelector(`.sequence-item[data-task-id="${taskId}"]`);
  if (li) li.remove();
  syncSequenceFromDOM();
}

// ================== SECUENCIA (drag & drop + botones) ==================
function createSequenceItem(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  const li = document.createElement("li");
  li.className = "sequence-item";
  li.draggable = true;
  li.dataset.taskId = taskId;
  li.innerHTML = `
    <span class="drag-handle">⠿</span>
    <span class="task-title">${task.title}</span>
    <span class="task-duration">${task.duration}</span>
    <div class="move-buttons">
      <button class="btn-move btn-move-up" type="button" title="Subir">▲</button>
      <button class="btn-move btn-move-down" type="button" title="Bajar">▼</button>
    </div>
    <button class="task-action-btn btn-remove" type="button" title="Quitar">✕</button>
  `;

  li.addEventListener("dragstart", (e) => {
    if (isTaskCurrentlyPlaying(taskId)) { e.preventDefault(); return; }
    li.classList.add("dragging");
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "move" }));
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    syncSequenceFromDOM();
  });

  li.querySelector(".btn-move-up").addEventListener("click", () => moveSequenceItem(li, -1));
  li.querySelector(".btn-move-down").addEventListener("click", () => moveSequenceItem(li, 1));
  li.querySelector(".task-action-btn").addEventListener("click", () => removeTaskFromSequence(taskId));

  return li;
}

// Mueve un <li> un puesto arriba (-1) o abajo (+1) dentro de la lista.
function moveSequenceItem(li, direction) {
  if (isTaskCurrentlyPlaying(li.dataset.taskId)) return;
  if (direction === -1 && li.previousElementSibling) {
    sequenceList.insertBefore(li, li.previousElementSibling);
  } else if (direction === 1 && li.nextElementSibling) {
    sequenceList.insertBefore(li.nextElementSibling, li);
  }
  syncSequenceFromDOM();
}

function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll(".sequence-item:not(.dragging)")];
  return items.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

sequenceList.addEventListener("dragover", (e) => {
  e.preventDefault();
  const draggingEl = sequenceList.querySelector(".dragging");
  if (draggingEl) {
    const afterElement = getDragAfterElement(sequenceList, e.clientY);
    afterElement ? sequenceList.insertBefore(draggingEl, afterElement) : sequenceList.appendChild(draggingEl);
  }
});

sequenceList.addEventListener("drop", (e) => {
  e.preventDefault();
  let data;
  try { data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}"); } catch { return; }

  if (data.type === "new") {
    if (sequence.includes(data.taskId)) return;
    const li = createSequenceItem(data.taskId);
    const afterElement = getDragAfterElement(sequenceList, e.clientY);
    afterElement ? sequenceList.insertBefore(li, afterElement) : sequenceList.appendChild(li);
    syncSequenceFromDOM();
  } else if (data.type === "move") {
    syncSequenceFromDOM();
  }
});

// Se llama siempre que la secuencia cambia: agregar, quitar o reordenar.
function syncSequenceFromDOM() {
  sequence = [...sequenceList.querySelectorAll(".sequence-item")].map((li) => li.dataset.taskId);
  sequenceEmptyHint.hidden = sequence.length > 0;
  refreshAvailableTasksState();

  if (sequence.length === 0) {
    currentTaskId = null;
    nowPlaying.hidden = true;
    restScreen.hidden = true;
    [btnPlayPause, btnRewind, btnForward, btnRestart, btnFullscreen, btnPrevTask, btnNextTask].forEach(
      (b) => (b.disabled = true)
    );
    if (isPlayerReady) player.stopVideo();
    return;
  }

  if (!currentTaskId || !sequence.includes(currentTaskId)) {
    loadTask(sequence[0]); // solo recarga si no había nada activo, o si quitaste la que estaba activa
  } else {
    updateNowPlayingLabel();
    updateNavButtonsState();
  }
  updateSequenceUI();
}

function isTaskCurrentlyPlaying(taskId) {
  return isPlayerReady && taskId === currentTaskId && player.getPlayerState() === YT.PlayerState.PLAYING;
}

// Sincroniza candados, flechas y botón de quitar de cada tarea de la secuencia
// según su posición y si está en reproducción; también refresca la lista disponible.
function updateSequenceUI() {
  const items = [...sequenceList.querySelectorAll(".sequence-item")];
  items.forEach((li, index) => {
    const taskId = li.dataset.taskId;
    const locked = isTaskCurrentlyPlaying(taskId);

    li.draggable = !locked;
    li.classList.toggle("locked", locked);

    li.querySelector(".btn-move-up").disabled = locked || index === 0;
    li.querySelector(".btn-move-down").disabled = locked || index === items.length - 1;
    li.querySelector(".task-action-btn").disabled = locked;
  });
  refreshAvailableTasksState();
}

function loadTask(taskId) {
  currentTaskId = taskId;
  restScreen.hidden = true;
  const task = allTasks.find((t) => t.id === taskId);
  if (isPlayerReady) player.cueVideoById(task.youtubeId);
  updateNowPlayingLabel();
  updateNavButtonsState();
  [btnPlayPause, btnRewind, btnForward, btnRestart, btnFullscreen].forEach((b) => (b.disabled = false));
  updateSequenceUI();
}

function updateNowPlayingLabel() {
  const index = sequence.indexOf(currentTaskId);
  const task = allTasks.find((t) => t.id === currentTaskId);
  currentTaskName.textContent = task ? task.title : "—";
  progressLabel.textContent = `(${index + 1}/${sequence.length})`;
  nowPlaying.hidden = false;
}

function updateNavButtonsState() {
  const index = sequence.indexOf(currentTaskId);
  btnPrevTask.disabled = index <= 0;
  btnNextTask.disabled = index === -1 || index >= sequence.length - 1;
}

// ================== NAVEGAR ENTRE TAREAS ==================
btnPrevTask.addEventListener("click", whenReady(() => {
  const index = sequence.indexOf(currentTaskId);
  if (index > 0) loadTask(sequence[index - 1]);
  btnPrevTask.blur();
}));

btnNextTask.addEventListener("click", whenReady(() => {
  const index = sequence.indexOf(currentTaskId);
  if (index !== -1 && index < sequence.length - 1) loadTask(sequence[index + 1]);
  btnNextTask.blur();
}));

btnContinueNext.addEventListener("click", whenReady(() => {
  const index = sequence.indexOf(currentTaskId);
  if (index !== -1 && index < sequence.length - 1) loadTask(sequence[index + 1]);
  btnContinueNext.blur();
}));

// ================== PLAYER DE YOUTUBE ==================
function onYouTubeIframeAPIReady() {
  player = new YT.Player("youtube-player", {
    height: "100%",
    width: "100%",
    playerVars: {
      controls: 0,
      rel: 0,
      modestbranding: 1,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
    },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange, onError: onPlayerError },
  });
}

function onPlayerReady() {
  isPlayerReady = true;
  if (currentTaskId) loadTask(currentTaskId);
}

function onPlayerError(event) {
  console.error("YouTube error, code:", event.data);
  currentTaskName.textContent = "⚠ Error al cargar el video (código " + event.data + ")";
}

function onPlayerStateChange(event) {
  updateSequenceUI();

  if (event.data === YT.PlayerState.PLAYING) {
    btnPlayPause.textContent = "⏸";
    restScreen.hidden = true;
    startProgressTracking();
  } else if (event.data === YT.PlayerState.PAUSED) {
    btnPlayPause.textContent = "▶";
    stopProgressTracking();
  } else if (event.data === YT.PlayerState.ENDED) {
    btnPlayPause.textContent = "▶";
    stopProgressTracking();
    showRestScreen();
  }
}

function showRestScreen() {
  const index = sequence.indexOf(currentTaskId);
  const isLast = index === -1 || index >= sequence.length - 1;
  btnContinueNext.hidden = isLast;
  restScreen.hidden = false;
}

// ================== REPRODUCIR / PAUSAR ==================
function togglePlayPause() {
  const state = player.getPlayerState();
  state === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
}

btnPlayPause.addEventListener("click", whenReady(() => { togglePlayPause(); btnPlayPause.blur(); }));
videoOverlay.addEventListener("click", whenReady(togglePlayPause));

document.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return;
  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  event.preventDefault();
  if (isPlayerReady) togglePlayPause();
});

// ================== RETROCEDER / ADELANTAR / REINICIAR ==================
btnRewind.addEventListener("click", whenReady(() => {
  player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
  btnRewind.blur();
}));

btnForward.addEventListener("click", whenReady(() => {
  const duration = player.getDuration();
  const target = player.getCurrentTime() + 10;
  player.seekTo(duration > 0 ? Math.min(duration, target) : target, true);
  btnForward.blur();
}));

btnRestart.addEventListener("click", whenReady(() => {
  player.seekTo(0, true);
  player.playVideo();
  btnRestart.blur();
}));

// ================== BARRA DE PROGRESO (clic + arrastre) ==================
function seekFromClientX(clientX) {
  const rect = progressBarContainer.getBoundingClientRect();
  const percentage = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const duration = player.getDuration();
  if (duration > 0) {
    player.seekTo(duration * percentage, true);
    progressBarFilled.style.width = percentage * 100 + "%";
  }
}

progressBarContainer.addEventListener("mousedown", whenReady((e) => {
  isDraggingProgress = true;
  seekFromClientX(e.clientX);
}));

document.addEventListener("mousemove", (e) => {
  if (isDraggingProgress) seekFromClientX(e.clientX);
});

document.addEventListener("mouseup", () => {
  isDraggingProgress = false;
});

function startProgressTracking() {
  stopProgressTracking();
  progressInterval = setInterval(() => {
    if (!isPlayerReady || isDraggingProgress) return;
    const current = player.getCurrentTime();
    const duration = player.getDuration();
    if (duration > 0) progressBarFilled.style.width = (current / duration) * 100 + "%";
  }, 500);
}
function stopProgressTracking() { clearInterval(progressInterval); }

// ================== PANTALLA COMPLETA ==================
btnFullscreen.addEventListener("click", () => {
  document.fullscreenElement ? document.exitFullscreen() : playerContainer.requestFullscreen();
  btnFullscreen.blur();
});

// ================== AUTO-OCULTAR CONTROLES ==================
function showControls() {
  customControls.classList.remove("hidden");
  clearTimeout(hideControlsTimeout);
  hideControlsTimeout = setTimeout(() => customControls.classList.add("hidden"), 3000);
}
playerContainer.addEventListener("mousemove", showControls);
playerContainer.addEventListener("mouseenter", showControls);