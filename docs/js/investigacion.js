let allTasks = [];
let currentTask = null;
let steps = [];          // secuencia completa: [{type, src, duration, rep}, ...]
let currentStepIndex = 0;
let stepTimeLeftMs = 0;
let tickInterval = null;
let isPlaying = false;

// --- Referencias al DOM ---
const taskSelect = document.getElementById("task-select-inv");
const blockDurationInput = document.getElementById("block-duration-input");
const btnPlayPause = document.getElementById("btn-play-pause-inv");
const btnReset = document.getElementById("btn-reset-inv");
const stageImage = document.getElementById("stage-image");
const currentBlockLabel = document.getElementById("current-block-label");
const progressLabel = document.getElementById("progress-label");
const progressBarFilled = document.getElementById("progress-bar-filled");
const statActPerImage = document.getElementById("stat-act-per-image");
const statRestPerImage = document.getElementById("stat-rest-per-image");
const statTotalTime = document.getElementById("stat-total-time");

// --- 1. Cargar catálogo de tareas ---
fetch("data/investigacion-tasks.json")
  .then((res) => res.json())
  .then((data) => {
    allTasks = data.tasks;
    allTasks.forEach((task) => {
      const option = document.createElement("option");
      option.value = task.id;
      option.textContent = task.title;
      taskSelect.appendChild(option);
    });
  })
  .catch((err) => console.error("No se pudo cargar investigacion-tasks.json:", err));

// --- 2. Al seleccionar una tarea ---
taskSelect.addEventListener("change", () => {
  currentTask = allTasks.find((t) => t.id === taskSelect.value);
  if (!currentTask) return;

  blockDurationInput.value = currentTask.duracionBloque;
  blockDurationInput.disabled = false;
  btnPlayPause.disabled = false;
  btnReset.disabled = false;

  rebuildSteps();
  stopPlayback();
  loadStep(0);
});

// --- 3. Cambiar la duración de bloque ---
blockDurationInput.addEventListener("change", () => {
  if (!currentTask) return;
  const value = parseFloat(blockDurationInput.value);
  if (isNaN(value) || value <= 0) return;

  currentTask.duracionBloque = value;
  rebuildSteps();
  stopPlayback();
  loadStep(0);
});

// --- 4. Construir la secuencia de pasos a partir de la tarea + duración de bloque ---
function rebuildSteps() {
  const actCount = currentTask.imagenesActivacion.length;
  const restCount = currentTask.imagenesReposo.length;

  // Aviso si alguien arma un JSON con cantidades distintas por error —
  // activación y reposo siempre deben tener la misma cantidad de imágenes
  // (si solo hay 1 imagen real de reposo, debe repetirse en el arreglo).
  if (actCount !== restCount) {
    console.warn(
      `Aviso: "${currentTask.title}" tiene ${actCount} imágenes de activación pero ${restCount} de reposo — deberían ser iguales.`
    );
  }

  const actDuration = currentTask.duracionBloque / actCount;
  const restDuration = currentTask.duracionBloque / restCount;

  steps = [];
  for (let r = 0; r < currentTask.repeticiones; r++) {
    currentTask.imagenesActivacion.forEach((src) => {
      steps.push({ type: "activación", src, duration: actDuration, rep: r + 1 });
    });
    currentTask.imagenesReposo.forEach((src) => {
      steps.push({ type: "reposo", src, duration: restDuration, rep: r + 1 });
    });
  }

  // --- Actualizar estadísticas visibles ---
  statActPerImage.textContent = formatTime(actDuration);
  statRestPerImage.textContent = formatTime(restDuration);
  const totalSeconds = currentTask.repeticiones * 2 * currentTask.duracionBloque;
  statTotalTime.textContent = formatTime(totalSeconds);
}

// --- 5. Cargar un paso específico en pantalla (sin reproducir) ---
function loadStep(index) {
  currentStepIndex = index;
  const step = steps[currentStepIndex];
  if (!step) {
    currentBlockLabel.textContent = "Tarea completa";
    stageImage.hidden = true;
    return;
  }

  stepTimeLeftMs = step.duration * 1000;
  stageImage.src = step.src;
  stageImage.hidden = false;
  currentBlockLabel.textContent = `Bloque: ${step.type} — repetición ${step.rep}/${currentTask.repeticiones}`;
  updateProgressUI();
}

// --- 6. Reproducir / Pausar ---
btnPlayPause.addEventListener("click", () => {
  if (isPlaying) {
    stopPlayback();
  } else {
    startPlayback();
  }
});

function startPlayback() {
  if (!currentTask || steps.length === 0) return;
  isPlaying = true;
  btnPlayPause.textContent = "⏸";
  blockDurationInput.disabled = true; // se bloquea la edición mientras reproduce, igual que el resto de la app
  taskSelect.disabled = true;

  let lastTick = Date.now();
  tickInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastTick;
    lastTick = now;
    stepTimeLeftMs -= elapsed;

    if (stepTimeLeftMs <= 0) {
      if (currentStepIndex + 1 < steps.length) {
        loadStep(currentStepIndex + 1);
      } else {
        stopPlayback();
        currentBlockLabel.textContent = "Tarea completa";
      }
    } else {
      updateProgressUI();
    }
  }, 100);
}

function stopPlayback() {
  isPlaying = false;
  btnPlayPause.textContent = "▶";
  clearInterval(tickInterval);
  blockDurationInput.disabled = false;
  taskSelect.disabled = false;
}

// --- 7. Reiniciar ---
btnReset.addEventListener("click", () => {
  stopPlayback();
  loadStep(0);
});

// --- 8. Actualizar barra de progreso y contador de tiempo por imagen ---
function updateProgressUI() {
  const step = steps[currentStepIndex];
  if (!step) return;
  const percentage = 100 - (stepTimeLeftMs / (step.duration * 1000)) * 100;
  progressBarFilled.style.width = Math.max(0, Math.min(100, percentage)) + "%";
  progressLabel.textContent = formatTime(stepTimeLeftMs / 1000) + " restantes en esta imagen";
}

// --- 9. Formatear segundos como m:ss ---
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}