// ================== CONSTANTES CIENTÍFICAS ==================
// La proporción estímulo:descanso queda fija en 50/50 — no es configurable.
const STIMULUS_RATIO = 0.5;
// Mínimo defendible: la señal BOLD llega a su meseta entre 6-9s tras el inicio
// del estímulo (Bandettini & Cox, 2000); por debajo de 8s se mide una respuesta
// parcial, no la meseta real.
const MIN_STIMULUS_SECONDS = 8;
// Su protocolo institucional ya usa 10s/15s de estímulo — por debajo de eso
// sigue siendo defendible, pero se avisa por quedar bajo el estándar propio.
const RECOMMENDED_MIN_STIMULUS_SECONDS = 10;
const MAX_STIMULUS_SECONDS = 50;

const JITTER_PERCENT = 15;

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

let calcMode = "blocks-block";
let jitterEnabled = true;

// Los tres parámetros "canónicos": duración total, número de bloques, duración de bloque.
// Con proporción fija, duración de estímulo = duración de bloque / 2, siempre.
let paramState = { totalDuration: 100, numBlocks: 5, blockDuration: 20 };

// ================== DOM ==================
const taskSelect = document.getElementById("task-select-inv");
const modeRadios = document.querySelectorAll('input[name="calc-mode"]');
const toggleJitter = document.getElementById("toggle-jitter");

const totalDurationInput = document.getElementById("total-duration-input");
const numBlocksInput = document.getElementById("num-blocks-input");
const numBlocksHint = document.getElementById("num-blocks-hint");
const blockDurationInput = document.getElementById("block-duration-input");
const stimulusDurationDisplay = document.getElementById("stimulus-duration-display");
const paramsWarning = document.getElementById("params-warning");

const btnRegenerate = document.getElementById("btn-regenerate-inv");

const btnPlayPause = document.getElementById("btn-play-pause-inv");
const btnReset = document.getElementById("btn-reset-inv");
const btnSkipStep = document.getElementById("btn-skip-step-inv");
const btnExtendStep = document.getElementById("btn-extend-step-inv");
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

  // Al elegir tarea, arrancamos siempre en el modo "bloques + duración de bloque",
  // con los valores que ya tenían definidos como estándar para esa tarea.
  calcMode = "blocks-block";
  document.querySelector('input[name="calc-mode"][value="blocks-block"]').checked = true;

  const maxBlocks = currentTask.bloques.length;
  numBlocksInput.max = maxBlocks;
  numBlocksHint.textContent = `Máximo ${maxBlocks} bloques: es cuántos hay con imágenes preparadas para esta tarea.`;

  paramState.numBlocks = maxBlocks;
  paramState.blockDuration = currentTask.duracionBloque;
  paramState.totalDuration = paramState.numBlocks * paramState.blockDuration;

  [totalDurationInput, numBlocksInput, blockDurationInput].forEach((el) => (el.disabled = false));
  btnFullscreen.disabled = false;

  applyMode();
  syncInputsFromState();
  loadAndPreloadCurrentTask();
});

// ================== SELECTOR DE MODO ==================
modeRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    calcMode = radio.value;
    applyMode();
  });
});

// Habilita/deshabilita los campos según qué dos variables se pueden editar en este modo.
function applyMode() {
  totalDurationInput.disabled = calcMode === "blocks-block";
  numBlocksInput.disabled = calcMode === "total-block";
  blockDurationInput.disabled = calcMode === "total-blocks";
}

// ================== ENTRADAS EDITABLES → RECALCULAR EL TERCER VALOR ==================
totalDurationInput.addEventListener("change", () => {
  paramState.totalDuration = parseFloat(totalDurationInput.value) || paramState.totalDuration;
  recomputeFromMode();
});

numBlocksInput.addEventListener("change", () => {
  const maxBlocks = currentTask ? currentTask.bloques.length : Infinity;
  const value = Math.min(maxBlocks, Math.max(1, parseInt(numBlocksInput.value, 10) || paramState.numBlocks));
  paramState.numBlocks = value;
  recomputeFromMode();
});

blockDurationInput.addEventListener("change", () => {
  paramState.blockDuration = parseFloat(blockDurationInput.value) || paramState.blockDuration;
  recomputeFromMode();
});

// A partir de los dos valores fijos del modo activo, calcula el tercero.
function recomputeFromMode() {
  if (calcMode === "blocks-block") {
    paramState.totalDuration = paramState.numBlocks * paramState.blockDuration;
  } else if (calcMode === "total-blocks") {
    paramState.blockDuration = paramState.totalDuration / paramState.numBlocks;
  } else if (calcMode === "total-block") {
    const rawBlocks = paramState.totalDuration / paramState.blockDuration;
    paramState.numBlocks = Math.round(rawBlocks);
    // Si no divide exacto, ajustamos la duración total al múltiplo real más cercano
    // en vez de dejar un residuo silencioso.
    paramState.totalDuration = paramState.numBlocks * paramState.blockDuration;
  }

  syncInputsFromState();
  if (currentTask) {
    currentTask.duracionBloque = paramState.blockDuration;
    rebuildAndReload();
  }
}

function syncInputsFromState() {
  totalDurationInput.value = round2(paramState.totalDuration);
  numBlocksInput.value = paramState.numBlocks;
  blockDurationInput.value = round2(paramState.blockDuration);

  const stimulusSeconds = paramState.blockDuration * STIMULUS_RATIO;
  stimulusDurationDisplay.value = round2(stimulusSeconds) + "s";

  validateStimulusDuration(stimulusSeconds);
}

// Aplica el piso científico: bloquea configuraciones por debajo de lo defendible,
// y avisa (sin bloquear) si queda por debajo del estándar institucional propio.
function validateStimulusDuration(stimulusSeconds) {
  if (stimulusSeconds < MIN_STIMULUS_SECONDS) {
    paramsWarning.textContent =
      `⚠ ${round2(stimulusSeconds)}s de estímulo está por debajo del mínimo recomendado ` +
      `(${MIN_STIMULUS_SECONDS}s) para que la señal BOLD alcance su meseta. Aumenta la duración de bloque.`;
    return false;
  }
  if (stimulusSeconds < RECOMMENDED_MIN_STIMULUS_SECONDS) {
    paramsWarning.textContent =
      `Nota: ${round2(stimulusSeconds)}s de estímulo queda por debajo del estándar institucional (10s), ` +
      `aunque sigue siendo estadísticamente defendible.`;
    return true;
  }
  if (stimulusSeconds > MAX_STIMULUS_SECONDS) {
    paramsWarning.textContent =
      `Nota: ${round2(stimulusSeconds)}s de estímulo es un bloque largo — considera si es necesario para esta tarea.`;
    return true;
  }
  paramsWarning.textContent = "";
  return true;
}

// ================== JITTER ==================
toggleJitter.addEventListener("change", () => {
  jitterEnabled = toggleJitter.checked;
  if (currentTask) rebuildAndReload();
});

btnRegenerate.addEventListener("click", () => {
  if (currentTask) rebuildAndReload();
});

function loadAndPreloadCurrentTask() {
  rebuildSchedule();
  stopPlayback();
  preloadImages(() => {
    imagesPreloaded = true;
    btnPlayPause.disabled = false;
    btnReset.disabled = false;
    btnRegenerate.disabled = false;
    loadVisualForStep(0);
  });
}

function rebuildAndReload() {
  rebuildSchedule();
  stopPlayback();
  loadVisualForStep(0);
}

// ================== CONSTRUCCIÓN DE PASOS (lógica pura, sin tocar el DOM) ==================
function jitteredBlockDuration(baseDuration) {
  if (!jitterEnabled) return baseDuration;
  const range = baseDuration * (JITTER_PERCENT / 100);
  const offset = (Math.random() * 2 - 1) * range;
  return baseDuration + offset;
}

function buildSchedule(task, numBlocks, blockDurationSeconds) {
  const builtSteps = [];
  const perBlockStats = [];
  const blocksToUse = task.bloques.slice(0, numBlocks);

  blocksToUse.forEach((bloque, blockIdx) => {
    const blockNumber = blockIdx + 1;
    const actCount = bloque.activacion;
    const restCount = bloque.reposo;

    const blockDuration = jitteredBlockDuration(blockDurationSeconds);
    const actTotal = blockDuration * STIMULUS_RATIO;
    const restTotal = blockDuration * (1 - STIMULUS_RATIO);
    const actDuration = actTotal / actCount;
    const restDuration = restTotal / restCount;

    for (let i = 1; i <= restCount; i++) {
      builtSteps.push({
        type: "reposo",
        src: buildImagePath(task.prefijo, blockNumber, "reposo", i, task.extension || "png"),
        duration: restDuration,
        bloque: blockNumber,
        imgIndex: i,
        imgCount: restCount,
      });
    }
    for (let i = 1; i <= actCount; i++) {
      builtSteps.push({
        type: "activación",
        src: buildImagePath(task.prefijo, blockNumber, "activacion", i, task.extension || "png"),
        duration: actDuration,
        bloque: blockNumber,
        imgIndex: i,
        imgCount: actCount,
      });
    }

    perBlockStats.push({ actDuration, restDuration, blockDuration });
  });

  const starts = [];
  let acc = 0;
  builtSteps.forEach((step) => {
    starts.push(acc);
    acc += step.duration * 1000;
  });

  return { steps: builtSteps, cumulativeStarts: starts, totalTaskMs: acc, perBlockStats };
}

function buildImagePath(prefijo, blockNumber, type, imageIndex, extension) {
  const typeCode = type === "reposo" ? "r" : "a";
  return `images/${prefijo}/${prefijo}_b${blockNumber}_${typeCode}${imageIndex}.${extension}`;
}

// ================== ORQUESTACIÓN: calcula y refleja el resultado en la UI ==================
function rebuildSchedule() {
  const result = buildSchedule(currentTask, paramState.numBlocks, paramState.blockDuration);
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
  statTotalTime.textContent = formatSeconds(result.totalTaskMs / 1000);
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
    `Bloque ${step.bloque}/${paramState.numBlocks} — ${step.type} — imagen ${step.imgIndex}/${step.imgCount}`;
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
  setParamControlsDisabled(true);
  btnRegenerate.disabled = true;
  btnSkipStep.disabled = false;
  btnExtendStep.disabled = false;

  playStartTimestamp = Date.now() - elapsedAtPauseMs;
  tickInterval = setInterval(tick, 50);
}

function pausePlayback() {
  isPlaying = false;
  btnPlayPause.textContent = "▶";
  clearInterval(tickInterval);
  elapsedAtPauseMs = Date.now() - playStartTimestamp;
  setParamControlsDisabled(false);
  btnRegenerate.disabled = false;
  btnSkipStep.disabled = true;
  btnExtendStep.disabled = true;
}

function stopPlayback() {
  isPlaying = false;
  btnPlayPause.textContent = "▶";
  clearInterval(tickInterval);
  elapsedAtPauseMs = 0;
  setParamControlsDisabled(false);
  btnRegenerate.disabled = false;
  btnSkipStep.disabled = true;
  btnExtendStep.disabled = true;
}

function setParamControlsDisabled(disabled) {
  taskSelect.disabled = disabled;
  modeRadios.forEach((r) => (r.disabled = disabled));
  if (disabled) {
    [totalDurationInput, numBlocksInput, blockDurationInput].forEach((el) => (el.disabled = true));
  } else {
    applyMode();
  }
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

// ================== CONTROLES MANUALES EN VIVO ==================
btnSkipStep.addEventListener("click", () => {
  if (!isPlaying) return;
  const nextIndex = currentStepIndex + 1;

  if (nextIndex >= steps.length) {
    stopPlayback();
    currentBlockLabel.textContent = "Tarea completa";
    return;
  }

  const targetElapsed = cumulativeStarts[nextIndex];
  playStartTimestamp = Date.now() - targetElapsed;
});

btnExtendStep.addEventListener("click", () => {
  if (!isPlaying || currentStepIndex < 0) return;
  const extraSeconds = 5;
  const extraMs = extraSeconds * 1000;

  steps[currentStepIndex].duration += extraSeconds;
  for (let i = currentStepIndex + 1; i < cumulativeStarts.length; i++) {
    cumulativeStarts[i] += extraMs;
  }
  totalTaskMs += extraMs;
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

function round2(value) {
  return Math.round(value * 100) / 100;
}