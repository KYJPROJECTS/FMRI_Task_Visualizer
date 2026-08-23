# FMRI Assistant

Herramienta web para organizar y reproducir, desde el computador de la sala de control del resonador, los videos de los paradigmas que el paciente debe realizar durante un estudio de **resonancia magnética funcional (fMRI)**.

Reemplaza el flujo actual de transportar un computador hasta el resonador para transmitir los paradigmas, todo corre directamente desde el navegador del equipo ya instalado en la sala.

![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)

---

## Características

- **Selección y orden de tareas por arrastre (drag & drop):** arma la secuencia de la sesión arrastrando las tareas disponibles, en el orden que necesites.
- **Controles de reproducció:** reproducir/pausar (incluye atajo de barra espaciadora), retroceder/adelantar 10s, reiniciar, navegar entre tareas, pantalla completa.
- **Barra de progreso interactiva:** clic o arrastre para saltar a cualquier punto del video.
- **Bloqueo inteligente:** una tarea no se puede reordenar ni eliminar mientras se está reproduciendo, evitando interrupciones accidentales durante la adquisición.
- **Pantalla de descanso:** al terminar cada video se muestra una pantalla negra con un botón para continuar a la siguiente tarea — pensada para el descanso del paciente entre paradigmas.
- **Interfaz limpia:** sin distracciones de YouTube (controles nativos, videos sugeridos y anotaciones ocultos).

---

## Cómo usarlo

1. Entra a **New Session**.
2. Haz clic en **Show available tasks** para desplegar el catálogo de paradigmas.
3. Arrastra las tareas que se van a evaluar hacia el cuadro de secuencia, en el orden deseado.
4. La primera tarea se carga automáticamente en el reproductor (en pausa).
5. Usa los controles o la **barra espaciadora** para reproducir.
6. Al terminar un video, aparece la pantalla de descanso — haz clic en **Next task** para continuar.

---

## Stack técnico

Este proyecto es intencionalmente simple: **HTML, CSS y JavaScript puro**, sin frameworks ni build steps. Se aloja como sitio estático en **GitHub Pages**.

| Pieza | Tecnología |
|---|---|
| Reproducción de video | [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) |
| Hosting | GitHub Pages |
| Catálogo de tareas | `data/tasks.json` |

---

## Estructura del repositorio

```
FMRI_Task_Visualizer/
├── private/  # Configuración sensible
├── docs/   # Raíz para GitHub Pages
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── script.js
│   ├── data/
│   │   └── tasks.json # Catálogo de tareas
│   ├── assets/
│   │   └── logo.png
│   └── version.json
├── .gitignore
└── README.md
```

### Agregar una tarea nueva

Edita `docs/data/tasks.json` — no requiere tocar el código:

```json
{
  "id": "identificador_unico",
  "title": "Nombre visible de la tarea",
  "youtubeId": "ID_DEL_VIDEO_DE_YOUTUBE",
  "duration": "MM:SS"
}
```

> El `youtubeId` es el código después de `v=` en la URL del video (ej. en `youtube.com/watch?v=dQw4w9WgXcQ`, el ID es `dQw4w9WgXcQ`).

---

## Correrlo en local

Este proyecto **no puede abrirse directamente con doble clic** (`file://`) por restricciones del navegador con `fetch()`. Necesitas un servidor local mínimo:

**Opción A — VS Code + Live Server (recomendada)**
1. Instala la extensión **Live Server**.
2. Clic derecho sobre `docs/index.html` → **Open with Live Server**.

**Opción B — Terminal con Python**
```bash
cd docs
python -m http.server 8000
```
Luego abre `http://localhost:8000`.

---

## Flujo de trabajo (Git)

Este repo sigue **GitHub Flow**:

- `main` siempre es la versión estable y desplegable.
- Todo cambio nuevo se hace en una rama descriptiva: `feature/lo-que-hace`.
- Se abre un **Pull Request** hacia `main`, se revisa entre el equipo, y se fusiona.
- La rama se borra después de fusionarse.

```bash
git checkout main
git pull origin main
git checkout -b feature/nombre-descriptivo

# ... trabajar y hacer commits ...

git push -u origin feature/nombre-descriptivo
# abrir Pull Request en GitHub hacia main
```

---

## Autores

Desarrollado por el equipo de imágenes diagnósticas para uso interno.
