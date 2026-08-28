let allTasks = [];
let currentTask = null;
let steps = [];
let currentStepIndex = 0;
let stepTimeLeftMs = 0;
let tickInterval = null;
let isPlaying = false;

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

blockDurationInput.addEventListener("change", () => {
  if (!currentTask) return;
  const value = parseFloat(blockDurationInput.value);
  if (isNaN(value) || value <= 0) return;

  currentTask.duracionBloque = value;
  rebuildSteps();
  stopPlayback();
  loadStep(0);
});

// --- Construir la secuencia completa a partir de los bloques de la tarea ---
// Cada bloque trae SU PROPIO contenido (no se repite entre bloques),
// pero el orden interno de cada bloque nunca cambia ni se aleatoriza.
function rebuildSteps() {
  const halfBlock = currentTask.duracionBloque / 2;
  steps = [];

  currentTask.bloques.forEach((bloque, index) => {
    const restCount = bloque.imagenesReposo.length;
    const actCount = bloque.imagenesActivacion.length;

    if (actCount !== restCount) {
      console.warn(
        `Aviso: bloque ${index + 1} de "${currentTask.title}" tiene ${actCount} imágenes de activación pero ${restCount} de reposo — deberían ser iguales.`
      );
    }

    const restDuration = halfBlock / restCount;
    const actDuration = halfBlock / actCount;

    // Orden clínico: primero reposo, luego activación
    bloque.imagenesReposo.forEach((src) => {
      steps.push({ type: "reposo", src, duration: restDuration, bloque: index + 1 });
    });
    bloque.imagenesActivacion.forEach((src) => {
      steps.push({ type: "activación", src, duration: actDuration, bloque: index + 1 });
    });

    // Guardamos los tiempos del PRIMER bloque como referencia para el panel de estadísticas
    if (index === 0) {
      statActPerImage.textContent = formatSeconds(actDuration);
      statRestPerImage.textContent = formatSeconds(restDuration);
    }
  });

  const totalSeconds = currentTask.duracionBloque * currentTask.bloques.length;
  statTotalTime.textContent = formatSeconds(totalSeconds);
}

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
  currentBlockLabel.textContent = `Bloque ${step.bloque}/${currentTask.bloques.length} — ${step.type}`;
  updateProgressUI();
}

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
  blockDurationInput.disabled = true;
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

btnReset.addEventListener("click", () => {
  stopPlayback();
  loadStep(0);
});

function updateProgressUI() {
  const step = steps[currentStepIndex];
  if (!step) return;
  const percentage = 100 - (stepTimeLeftMs / (step.duration * 1000)) * 100;
  progressBarFilled.style.width = Math.max(0, Math.min(100, percentage)) + "%";
  progressLabel.textContent = formatSeconds(stepTimeLeftMs / 1000) + " restantes en esta imagen";
}

function formatSeconds(totalSeconds) {
  const rounded = Math.round(totalSeconds * 100) / 100;
  return rounded.toFixed(2) + "s";
}