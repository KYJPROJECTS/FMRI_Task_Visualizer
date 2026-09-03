// ================== ESTADO ==================
let allTasks = [];
let sequence = []; // array de instancias: { instanceId, taskId, label, numBlocks, blockDuration, stimuliPerBlock, schedule }
let currentInstanceId = null;
let nextInstanceNumber = 1;

let currentStepIndex = -1;
let playStartTimestamp = 0;
let elapsedAtPauseMs = 0;
let tickInterval = null;
let isPlaying = false;
let imagesPreloaded = false;

// ================== DOM ==================
const taskSelect = document.getElementById("task-select-inv");
const numBlocksInput = document.getElementById("num-blocks-input");
const numBlocksHint = document.getElementById("num-blocks-hint");
const blockDurationInput = document.getElementById("block-duration-input");
const stimuliPerBlockInput = document.getElementById("stimuli-per-block-input");
const stimuliPerBlockHint = document.getElementById("stimuli-per-block-hint");
const statStimulusTime = document.getElementById("stat-stimulus-time");
const statTaskTotalTime = document.getElementById("stat-task-total-time");
const btnAddInstance = document.getElementById("btn-add-instance");

const sequenceList = document.getElementById("sequence-list-inv");
const sequenceEmptyHint = document.getElementById("sequence-empty-hint-inv");
const sequenceTotalLabel = document.getElementById("sequence-total-duration-inv");

const nowPlaying = document.getElementById("now-playing-inv");
const currentInstanceName = document.getElementById("current-instance-name-inv");
const progressLabel = document.getElementById("progress-label-inv");

const stageContainer = document.getElementById("stage-container");
const stageImage = document.getElementById("stage-image");
const restScreen = document.getElementById("rest-screen-inv");
const btnContinueNext = document.getElementById("btn-continue-next-inv");

const btnPlayPause = document.getElementById("btn-play-pause-inv");
const btnReset = document.getElementById("btn-reset-inv");
const btnSkipStep = document.getElementById("btn-skip-step-inv");
const btnExtendStep = document.getElementById("btn-extend-step-inv");
const btnFullscreen = document.getElementById("btn-fullscreen-inv");

const progressBarFilled = document.getElementById("progress-bar-filled");

// ================== CATÁLOGO DE TAREAS ==================
fetch("data/investigacion-tasks.json")
  .then((r) => r.json())
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

// ================== UTILIDADES ==================
function formatSeconds(totalSeconds) {
  const rounded = Math.round(totalSeconds * 100) / 100;
  return rounded.toFixed(2) + "s";
}

function getTaskLimits(task) {
  const maxCycles = task.bloques.length;
  const maxBlocksReal = maxCycles * 2;
  const maxStimuliPerBlock = Math.min(...task.bloques.map((b) => Math.min(b.activacion, b.reposo)));
  return { maxCycles, maxBlocksReal, maxStimuliPerBlock };
}

// ================== SELECCIÓN DE TAREA BASE: prellenar con el estándar ==================
taskSelect.addEventListener("change", () => {
  const task = allTasks.find((t) => t.id === taskSelect.value);
  if (!task) return;

  const { maxBlocksReal, maxStimuliPerBlock } = getTaskLimits(task);
  const standardBlocks = Math.min(10, maxBlocksReal); // estándar: 10 bloques (5 ciclos), acotado a lo disponible

  numBlocksInput.disabled = false;
  numBlocksInput.min = 6;
  numBlocksInput.max = maxBlocksReal;
  numBlocksInput.step = 2;
  numBlocksInput.value = standardBlocks;
  numBlocksHint.textContent = `Disponible: entre 6 y ${maxBlocksReal} bloques (siempre en pares reposo+activación).`;

  blockDurationInput.disabled = false;
  blockDurationInput.value = task.duracionEstandarBloque;

  const isFixedStimuli = maxStimuliPerBlock === 1;
  stimuliPerBlockInput.disabled = isFixedStimuli;
  stimuliPerBlockInput.min = 1;
  stimuliPerBlockInput.max = maxStimuliPerBlock;
  stimuliPerBlockInput.value = maxStimuliPerBlock; // estándar: usar todas las imágenes preparadas
  stimuliPerBlockHint.textContent = isFixedStimiuli(isFixedStimuli);

  btnAddInstance.disabled = false;
  recomputePreview();
});

function isFixedStimiuli(isFixed) {
  return isFixed
    ? "Esta tarea usa un solo estímulo por bloque (no configurable)."
    : "";
}

[numBlocksInput, blockDurationInput, stimuliPerBlockInput].forEach((input) => {
  input.addEventListener("input", recomputePreview);
});

// Recalcula solo la vista previa (tiempo por estímulo, tiempo total).
// Sin advertencias ni bloqueos: los límites min/max de cada input ya
// evitan que se escriban valores fuera de lo disponible.
function recomputePreview() {
  const numBlocks = parseInt(numBlocksInput.value, 10) || 0;
  const blockDuration = parseFloat(blockDurationInput.value) || 0;
  const stimuliPerBlock = parseInt(stimuliPerBlockInput.value, 10) || 1;

  const stimulusSeconds = blockDuration / stimuliPerBlock;
  const totalSeconds = numBlocks * blockDuration;

  statStimulusTime.textContent = formatSeconds(stimulusSeconds);
  statTaskTotalTime.textContent = formatSeconds(totalSeconds);
}

// ================== AGREGAR INSTANCIA A LA SECUENCIA ==================
btnAddInstance.addEventListener("click", () => {
  const task = allTasks.find((t) => t.id === taskSelect.value);
  if (!task) return;

  const numBlocks = parseInt(numBlocksInput.value, 10);
  const blockDuration = parseFloat(blockDurationInput.value);
  const stimuliPerBlock = parseInt(stimuliPerBlockInput.value, 10);

  const instance = {
    instanceId: `inst-${nextInstanceNumber++}`,
    taskId: task.id,
    label: `${task.title} — ${numBlocks} bloques × ${blockDuration}s`,
    numBlocks,
    blockDuration,
    stimuliPerBlock,
  };
  instance.schedule = buildSchedule(task, instance);

  sequence.push(instance);
  renderSequenceItem(instance);
  syncSequenceState();
});

// ================== CONSTRUCCIÓN DEL SCHEDULE (sin jitter: duración fija siempre) ==================
function buildImagePath(taskId, prefijo, cycleNumber, typeCode, imageIndex, extension) {
  return `images/${taskId}/${prefijo}_b${cycleNumber}_${typeCode}${imageIndex}.${extension}`;
}

function buildSchedule(task, instance) {
  const numCycles = instance.numBlocks / 2;
  const steps = [];

  for (let cycle = 1; cycle <= numCycles; cycle++) {
    const restPerImage = instance.blockDuration / instance.stimuliPerBlock;
    for (let i = 1; i <= instance.stimuliPerBlock; i++) {
      steps.push({
        type: "reposo",
        src: buildImagePath(task.id, task.prefijo, cycle, "r", i, task.extension || "png"),
        duration: restPerImage,
        cycle,
        imgIndex: i,
        imgCount: instance.stimuliPerBlock,
      });
    }
    const actPerImage = instance.blockDuration / instance.stimuliPerBlock; // misma duración que reposo, siempre
    for (let i = 1; i <= instance.stimuliPerBlock; i++) {
      steps.push({
        type: "activación",
        src: buildImagePath(task.id, task.prefijo, cycle, "a", i, task.extension || "png"),
        duration: actPerImage,
        cycle,
        imgIndex: i,
        imgCount: instance.stimuliPerBlock,
      });
    }
  }

  const cumulativeStarts = [];
  let acc = 0;
  steps.forEach((step) => {
    cumulativeStarts.push(acc);
    acc += step.duration * 1000;
  });

  return { steps, cumulativeStarts, totalTaskMs: acc };
}

// ================== SECUENCIA: RENDER, REORDENAR, QUITAR ==================
function renderSequenceItem(instance) {
  const li = document.createElement("li");
  li.className = "sequence-item";
  li.dataset.instanceId = instance.instanceId;
  li.innerHTML = `
    <span class="task-title">${instance.label}</span>
    <div class="move-buttons">
      <button class="btn-move btn-move-up" type="button" title="Subir">▲</button>
      <button class="btn-move btn-move-down" type="button" title="Bajar">▼</button>
    </div>
    <button class="task-action-btn btn-remove" type="button" title="Quitar">✕</button>
  `;

  li.querySelector(".btn-move-up").addEventListener("click", () => moveInstance(li, -1));
  li.querySelector(".btn-move-down").addEventListener("click", () => moveInstance(li, 1));
  li.querySelector(".task-action-btn").addEventListener("click", () => removeInstance(instance.instanceId));

  sequenceList.appendChild(li);
}

function moveInstance(li, direction) {
  if (isInstanceCurrentlyPlaying(li.dataset.instanceId)) return;
  if (direction === -1 && li.previousElementSibling) {
    sequenceList.insertBefore(li, li.previousElementSibling);
  } else if (direction === 1 && li.nextElementSibling) {
    sequenceList.insertBefore(li.nextElementSibling, li);
  }
  syncSequenceState();
}

function removeInstance(instanceId) {
  if (isInstanceCurrentlyPlaying(instanceId)) return;
  sequence = sequence.filter((inst) => inst.instanceId !== instanceId);
  const li = sequenceList.querySelector(`.sequence-item[data-instance-id="${instanceId}"]`);
  if (li) li.remove();
  syncSequenceState();
}

function syncSequenceState() {
  const orderedIds = [...sequenceList.querySelectorAll(".sequence-item")].map((li) => li.dataset.instanceId);
  sequence.sort((a, b) => orderedIds.indexOf(a.instanceId) - orderedIds.indexOf(b.instanceId));

  sequenceEmptyHint.hidden = sequence.length > 0;
  updateSequenceTotalLabel();
  updateSequenceUI();

  if (sequence.length === 0) {
    currentInstanceId = null;
    nowPlaying.hidden = true;
    restScreen.hidden = true;
    stageImage.hidden = true;
    stageImage.src = "";
    progressBarFilled.style.width = "0%";
    stopPlayback();
    [btnPlayPause, btnReset, btnSkipStep, btnExtendStep, btnFullscreen].forEach((b) => (b.disabled = true));
    return;
  }

  if (isPlaying) {
    // No interrumpir la reproducción en curso — solo refrescar el número
    // de posición mostrado, por si el orden cambió alrededor de la que suena.
    updateProgressLabelPosition();
    return;
  }

  // En pausa (o sin nada reproduciéndose): el escenario siempre refleja
  // la primera tarea de la secuencia actual, sin importar cuál estaba antes.
  loadInstance(sequence[0].instanceId);
}

function updateProgressLabelPosition() {
  const index = sequence.findIndex((i) => i.instanceId === currentInstanceId);
  progressLabel.textContent = `(${index + 1}/${sequence.length})`;
}

function updateSequenceTotalLabel() {
  if (sequence.length === 0) {
    sequenceTotalLabel.textContent = "";
    return;
  }
  const totalSeconds = sequence.reduce((sum, inst) => sum + inst.schedule.totalTaskMs / 1000, 0);
  sequenceTotalLabel.innerHTML = `Duración total estimada: <strong>${formatSeconds(totalSeconds)}</strong>`;
}

function isInstanceCurrentlyPlaying(instanceId) {
  return isPlaying && instanceId === currentInstanceId;
}

function updateSequenceUI() {
  const items = [...sequenceList.querySelectorAll(".sequence-item")];
  items.forEach((li, index) => {
    const locked = isInstanceCurrentlyPlaying(li.dataset.instanceId);
    li.classList.toggle("locked", locked);
    li.querySelector(".btn-move-up").disabled = locked || index === 0;
    li.querySelector(".btn-move-down").disabled = locked || index === items.length - 1;
    li.querySelector(".task-action-btn").disabled = locked;
  });
}

// ================== CARGA Y REPRODUCCIÓN DE UNA INSTANCIA ==================
function loadInstance(instanceId) {
  currentInstanceId = instanceId;
  restScreen.hidden = true;
  stopPlayback();

  const instance = sequence.find((i) => i.instanceId === instanceId);
  const index = sequence.indexOf(instance);

  currentInstanceName.textContent = instance.label;
  progressLabel.textContent = `(${index + 1}/${sequence.length})`;
  nowPlaying.hidden = false;

  imagesPreloaded = false;
  [btnPlayPause, btnReset, btnSkipStep, btnExtendStep, btnFullscreen].forEach((b) => (b.disabled = true));

  preloadImages(instance.schedule.steps, () => {
    imagesPreloaded = true;
    [btnPlayPause, btnReset, btnFullscreen].forEach((b) => (b.disabled = false));
    loadVisualForStep(instance, 0);
  });

  updateSequenceUI();
}

function preloadImages(steps, onDone) {
  const urls = steps.map((s) => s.src);
  let processedCount = 0;
  let missingFiles = [];
  progressLabel.textContent = `Cargando imágenes... (0/${urls.length})`;

  if (urls.length === 0) { onDone(); return; }

  urls.forEach((url) => {
    const img = new Image();
    img.onload = () => { processedCount++; checkIfDone(); };
    img.onerror = () => {
      processedCount++;
      missingFiles.push(url);
      console.warn(`⚠ Imagen no encontrada: ${url}`);
      checkIfDone();
    };
    img.src = url;
  });

  function checkIfDone() {
    if (processedCount === urls.length) {
      if (missingFiles.length > 0) {
        progressLabel.textContent = `⚠ Faltan ${missingFiles.length} imagen(es) — revisa la consola`;
        console.warn("Resumen de imágenes faltantes:", missingFiles);
      } else {
        progressLabel.textContent = "";
      }
      onDone();
    }
  }
}

function loadVisualForStep(instance, index) {
  currentStepIndex = index;
  const step = instance.schedule.steps[index];
  if (!step) return;

  stageImage.src = step.src;
  stageImage.hidden = false;
}

function getCurrentInstance() {
  return sequence.find((i) => i.instanceId === currentInstanceId);
}

// ================== CONTROLES DE REPRODUCCIÓN ==================
btnPlayPause.addEventListener("click", () => {
  if (!imagesPreloaded) return;
  isPlaying ? pausePlayback() : startPlayback();
});

function startPlayback() {
  const instance = getCurrentInstance();
  if (!instance || instance.schedule.steps.length === 0) return;
  isPlaying = true;
  btnPlayPause.textContent = "⏸";
  btnSkipStep.disabled = false;
  btnExtendStep.disabled = false;

  playStartTimestamp = Date.now() - elapsedAtPauseMs;
  tickInterval = setInterval(tick, 50);
  updateSequenceUI();
}

function pausePlayback() {
  isPlaying = false;
  btnPlayPause.textContent = "▶";
  clearInterval(tickInterval);
  elapsedAtPauseMs = Date.now() - playStartTimestamp;
  btnSkipStep.disabled = true;
  btnExtendStep.disabled = true;
  updateSequenceUI();
}

function stopPlayback() {
  isPlaying = false;
  btnPlayPause.textContent = "▶";
  clearInterval(tickInterval);
  elapsedAtPauseMs = 0;
  btnSkipStep.disabled = true;
  btnExtendStep.disabled = true;
}

btnReset.addEventListener("click", () => {
  stopPlayback();
  const instance = getCurrentInstance();
  if (instance) loadVisualForStep(instance, 0);
});

btnFullscreen.addEventListener("click", () => {
  document.fullscreenElement ? document.exitFullscreen() : stageContainer.requestFullscreen();
});

// ================== CONTROLES MANUALES EN VIVO ==================
btnSkipStep.addEventListener("click", () => {
  if (!isPlaying) return;
  const instance = getCurrentInstance();
  const nextIndex = currentStepIndex + 1;

  if (nextIndex >= instance.schedule.steps.length) {
    finishCurrentInstance();
    return;
  }
  const targetElapsed = instance.schedule.cumulativeStarts[nextIndex];
  playStartTimestamp = Date.now() - targetElapsed;
});

btnExtendStep.addEventListener("click", () => {
  if (!isPlaying || currentStepIndex < 0) return;
  const instance = getCurrentInstance();
  const extraSeconds = 5;
  const extraMs = extraSeconds * 1000;

  instance.schedule.steps[currentStepIndex].duration += extraSeconds;
  for (let i = currentStepIndex + 1; i < instance.schedule.cumulativeStarts.length; i++) {
    instance.schedule.cumulativeStarts[i] += extraMs;
  }
  instance.schedule.totalTaskMs += extraMs;
});

function tick() {
  const instance = getCurrentInstance();
  if (!instance) return;
  const elapsed = Date.now() - playStartTimestamp;

  if (elapsed >= instance.schedule.totalTaskMs) {
    finishCurrentInstance();
    return;
  }

  let newIndex = currentStepIndex;
  while (
    newIndex + 1 < instance.schedule.steps.length &&
    elapsed >= instance.schedule.cumulativeStarts[newIndex + 1]
  ) {
    newIndex++;
  }
  if (newIndex !== currentStepIndex) loadVisualForStep(instance, newIndex);

  updateProgressBar(instance, elapsed);
}

function updateProgressBar(instance, elapsed) {
  const step = instance.schedule.steps[currentStepIndex];
  if (!step) return;
  const stepStart = instance.schedule.cumulativeStarts[currentStepIndex];
  const percentage = ((elapsed - stepStart) / (step.duration * 1000)) * 100;
  progressBarFilled.style.width = Math.max(0, Math.min(100, percentage)) + "%";
}

function finishCurrentInstance() {
  stopPlayback();
  const index = sequence.findIndex((i) => i.instanceId === currentInstanceId);
  const isLast = index === -1 || index >= sequence.length - 1;
  btnContinueNext.hidden = isLast;
  restScreen.hidden = false;
}

btnContinueNext.addEventListener("click", () => {
  const index = sequence.findIndex((i) => i.instanceId === currentInstanceId);
  if (index !== -1 && index < sequence.length - 1) {
    loadInstance(sequence[index + 1].instanceId);
  }
});

// ================== VISIBILIDAD DE LA PESTAÑA ==================
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isPlaying) {
    pausePlayback();
  }
});