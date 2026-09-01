// ================== ESTADO ==================
let allTasks = [];
let currentTask = null;
let steps = [];
let cumulativeStarts = [];
let totalTaskMs = 0;

let currentStepIndex = -1;
let playStartTimestamp = 0;
let elapsedAtPauseMs = 0;
let tickInterval = null;
let isPlaying = false;
let imagesPreloaded = false;

// ================== DOM ==================
const taskSelect = document.getElementById("task-select-inv");
const blockDurationInput = document.getElementById("block-duration-input");
const btnPlayPause = document.getElementById("btn-play-pause-inv");
const btnReset = document.getElementById("btn-reset-inv");
const btnFullscreen = document.getElementById("btn-fullscreen-inv");
const stageContainer = document.getElementById("stage-container");
const stageImage = document.getElementById("stage-image");
const currentBlockLabel = document.getElementById("current-block-label");
const progressLabel = document.getElementById("progress-label");
const progressBarFilled = document.getElementById("progress-bar-filled");
const statActPerImage = document.getElementById("stat-act-per-image");
const statRestPerImage = document.getElementById("stat-rest-per-image");
const statTotalTime = document.getElementById("stat-total-time");

// ================== CATÁLOGO DE TAREAS ==================
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
  blockDurationInput.disabled = true;
  btnPlayPause.disabled = true;
  btnFullscreen.disabled = false;

  rebuildSchedule();
  stopPlayback();
  preloadImages(() => {
    imagesPreloaded = true;
    blockDurationInput.disabled = false;
    btnPlayPause.disabled = false;
    loadVisualForStep(0);
  });
});

blockDurationInput.addEventListener("change", () => {
  if (!currentTask) return;
  const value = parseFloat(blockDurationInput.value);
  if (isNaN(value) || value <= 0) return;

  currentTask.duracionBloque = value;
  rebuildSchedule();
  stopPlayback();
  loadVisualForStep(0);
});

// ================== CONSTRUCCIÓN DE PASOS (lógica pura, sin tocar el DOM) ==================
// Convierte una tarea del catálogo en la lista plana de pasos (reposo + activación,
// bloque por bloque) que el reproductor va a recorrer, junto con sus tiempos acumulados.
// No lee ni escribe nada de la interfaz — solo recibe datos y devuelve datos.
function buildSchedule(task) {
  const halfBlock = task.duracionBloque / 2;
  const builtSteps = [];
  const perBlockStats = []; // [{ actDuration, restDuration }] — una entrada por bloque

  task.bloques.forEach((bloque, blockIdx) => {
    const blockNumber = blockIdx + 1;
    const count = bloque.cantidadImagenes;
    const durationPerImage = halfBlock / count; // 50/50: reposo y activación duran igual

    for (let i = 1; i <= count; i++) {
      builtSteps.push({
        type: "reposo",
        src: buildImagePath(task.prefijo, blockNumber, "reposo", i, task.extension || "jpg"),
        duration: durationPerImage,
        bloque: blockNumber,
        imgIndex: i,
        imgCount: count,
      });
    }
    for (let i = 1; i <= count; i++) {
      builtSteps.push({
        type: "activación",
        src: buildImagePath(task.prefijo, blockNumber, "activacion", i, task.extension || "jpg"),
        duration: durationPerImage,
        bloque: blockNumber,
        imgIndex: i,
        imgCount: count,
      });
    }

    perBlockStats.push({ actDuration: durationPerImage, restDuration: durationPerImage });
  });

  const starts = [];
  let acc = 0;
  builtSteps.forEach((step) => {
    starts.push(acc);
    acc += step.duration * 1000;
  });

  return {
    steps: builtSteps,
    cumulativeStarts: starts,
    totalTaskMs: acc,
    perBlockStats,
  };
}

// Construye el nombre de archivo según la convención: PREFIJO_B<bloque>_<R|A><n>
function buildImagePath(prefijo, blockNumber, type, imageIndex, extension) {
  const typeCode = type === "reposo" ? "R" : "A";
  return `imagenes/${prefijo}_B${blockNumber}_${typeCode}${imageIndex}.${extension}`;
}

// ================== ORQUESTACIÓN: calcula y refleja el resultado en la UI ==================
function rebuildSchedule() {
  const result = buildSchedule(currentTask);
  steps = result.steps;
  cumulativeStarts = result.cumulativeStarts;
  totalTaskMs = result.totalTaskMs;

  renderStats(result);

  imagesPreloaded = false;
  currentStepIndex = -1;
  elapsedAtPauseMs = 0;
}

function renderStats(result) {
  const firstBlockStats = result.perBlockStats[0];
  if (firstBlockStats) {
    statActPerImage.textContent = formatSeconds(firstBlockStats.actDuration);
    statRestPerImage.textContent = formatSeconds(firstBlockStats.restDuration);
  }
  const totalSeconds = currentTask.duracionBloque * currentTask.bloques.length;
  statTotalTime.textContent = formatSeconds(totalSeconds);
}

// ================== PRECARGA DE IMÁGENES ==================
function preloadImages(onDone) {
  const urls = steps.map((s) => s.src);
  let processedCount = 0;
  let missingFiles = [];
  progressLabel.textContent = `Cargando imágenes... (0/${urls.length})`;

  if (urls.length === 0) {
    onDone();
    return;
  }

  urls.forEach((url) => {
    const img = new Image();
    img.onload = () => {
      processedCount++;
      checkIfDone();
    };
    img.onerror = () => {
      processedCount++;
      missingFiles.push(url);
      console.warn(`⚠ Imagen no encontrada: ${url} — revisa el nombre exacto del archivo.`);
      checkIfDone();
    };
    img.src = url;
  });

  function checkIfDone() {
    progressLabel.textContent = `Cargando imágenes... (${processedCount}/${urls.length})`;
    if (processedCount === urls.length) {
      if (missingFiles.length > 0) {
        progressLabel.textContent = `⚠ Faltan ${missingFiles.length} imagen(es) — revisa la consola`;
        console.warn("Resumen de imágenes faltantes:", missingFiles);
      } else {
        progressLabel.textContent = "Listo para reproducir";
      }
      onDone();
    }
  }
}

// ================== PRESENTACIÓN DEL PASO ACTUAL ==================
function loadVisualForStep(index) {
  currentStepIndex = index;
  const step = steps[currentStepIndex];
  if (!step) return;

  stageImage.src = step.src;
  stageImage.hidden = false;
  currentBlockLabel.textContent =
    `Bloque ${step.bloque}/${currentTask.bloques.length} — ${step.type} — imagen ${step.imgIndex}/${step.imgCount}`;
}

// ================== REPRODUCCIÓN ==================
btnPlayPause.addEventListener("click", () => {
  if (!imagesPreloaded) return;
  if (isPlaying) {
    pausePlayback();
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

  playStartTimestamp = Date.now() - elapsedAtPauseMs;
  tickInterval = setInterval(tick, 50);
}

function pausePlayback() {
  isPlaying = false;
  btnPlayPause.textContent = "▶";
  clearInterval(tickInterval);
  elapsedAtPauseMs = Date.now() - playStartTimestamp;
  blockDurationInput.disabled = false;
  taskSelect.disabled = false;
}

function stopPlayback() {
  isPlaying = false;
  btnPlayPause.textContent = "▶";
  clearInterval(tickInterval);
  elapsedAtPauseMs = 0;
  blockDurationInput.disabled = false;
  taskSelect.disabled = false;
}

btnReset.addEventListener("click", () => {
  stopPlayback();
  loadVisualForStep(0);
});

btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    stageContainer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

function tick() {
  const elapsed = Date.now() - playStartTimestamp;

  if (elapsed >= totalTaskMs) {
    stopPlayback();
    currentBlockLabel.textContent = "Tarea completa";
    return;
  }

  let newIndex = currentStepIndex;
  while (
    newIndex + 1 < steps.length &&
    elapsed >= cumulativeStarts[newIndex + 1]
  ) {
    newIndex++;
  }

  if (newIndex !== currentStepIndex) {
    loadVisualForStep(newIndex);
    const drift = elapsed - cumulativeStarts[newIndex];
    console.log(
      `[Verificación] Bloque ${steps[newIndex].bloque} — ${steps[newIndex].type} ${steps[newIndex].imgIndex}/${steps[newIndex].imgCount} — desfase: ${drift.toFixed(1)}ms`
    );
  }

  updateProgressUI(elapsed);
}

function updateProgressUI(elapsed) {
  const step = steps[currentStepIndex];
  if (!step) return;
  const stepStart = cumulativeStarts[currentStepIndex];
  const stepEnd = stepStart + step.duration * 1000;
  const timeLeftMs = stepEnd - elapsed;
  const percentage = ((elapsed - stepStart) / (step.duration * 1000)) * 100;

  progressBarFilled.style.width = Math.max(0, Math.min(100, percentage)) + "%";
  progressLabel.textContent = formatSeconds(timeLeftMs / 1000) + " restantes en esta imagen";
}

// ================== VISIBILIDAD DE LA PESTAÑA ==================
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isPlaying) {
    pausePlayback();
    currentBlockLabel.textContent = "⚠ Pausado: la pestaña perdió el foco";
  }
});

// ================== UTILIDADES ==================
function formatSeconds(totalSeconds) {
  const rounded = Math.round(totalSeconds * 100) / 100;
  return rounded.toFixed(2) + "s";
}