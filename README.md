# FMRI Assistant

Herramienta web para organizar y reproducir, desde el computador de la sala de control del resonador, los videos de los paradigmas que el paciente debe realizar durante un estudio de resonancia magnética funcional (fMRI).

Reemplaza el flujo actual de transportar un computador hasta el resonador para transmitir los paradigmas, todo corre directamente desde el navegador del equipo ya instalado en la sala.

![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)

---

## Características

- **Selección y orden de tareas por arrastre (drag & drop) o por botones:** arma la secuencia de la sesión arrastrando las tareas disponibles, o agrégalas con el botón "+" y reordénalas con las flechas ▲▼.
- **Controles de reproducción:** reproducir/pausar (incluye atajo de barra espaciadora), retroceder/adelantar 10s, reiniciar, navegar entre tareas, pantalla completa.
- **Barra de progreso interactiva:** clic o arrastre para saltar a cualquier punto del video.
- **Bloqueo inteligente:** una tarea no se puede reordenar ni eliminar mientras se está reproduciendo, evitando interrupciones accidentales durante la adquisición.
- **Pantalla de descanso:** al terminar cada video se muestra una pantalla negra con un botón para continuar a la siguiente tarea, pensada para el descanso del paciente entre paradigmas.
- **Interfaz limpia:** sin distracciones de YouTube (controles nativos, videos sugeridos y anotaciones ocultos).
- **Páginas reales independientes:** Home, Nueva sesión e Investigación son archivos HTML separados, cada uno con su propia URL, por lo que se pueden recargar o abrir directamente por link sin errores.

---

## Cómo usarlo

1. Entra a **Nueva sesión**.
2. Haz clic en **Mostrar tareas disponibles** para desplegar el catálogo de paradigmas.
3. Agrega las tareas que se van a evaluar con el botón **+**, o arrástralas hacia el cuadro de secuencia.
4. Ordénalas con las flechas ▲▼, o arrastrándolas directamente.
5. La primera tarea de la secuencia se carga automáticamente en el reproductor (en pausa).
6. Usa los controles o la **barra espaciadora** para reproducir.
7. Al terminar un video, aparece la pantalla de descanso; haz clic en **Siguiente tarea** para continuar.

---

## Stack técnico

Este proyecto es intencionalmente simple: **HTML, CSS y JavaScript puro**, sin frameworks ni build steps. Se aloja como sitio estático en **GitHub Pages**, con una página HTML real por cada sección (no una sola página con vistas ocultas por JavaScript).

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
├── docs/     # Raíz servida por GitHub Pages
│   ├── index.html    # Home
│   ├── nueva-sesion.html
│   ├── investigacion.html 
│   ├── css/
│   │   └── style.css # Estilos
│   ├── js/
│   │   └── session.js  # Lógica
│   ├── data/
│   │   └── tasks.json # Lista de tareas
│   ├── assets/
│   │   └── logo.png
│   └── version.json
├── .gitignore
└── README.md
```

**Nota sobre mantenimiento:** como las tres páginas son archivos HTML independientes, la barra de navegación está duplicada en cada una. Al cambiar el logo, un link del menú, o el nombre de la herramienta, hay que actualizar los tres archivos (`index.html`, `nueva-sesion.html`, `investigacion.html`), no solo uno.

### Agregar una tarea nueva

Edita `docs/data/tasks.json`, no requiere tocar el código:

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
3. Navega entre páginas usando los links de la barra de navegación, no editando la URL a mano.

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

### Puntos de restauración

Antes de fusionar cambios grandes de arquitectura, se marca el estado anterior con un tag para poder volver atrás fácilmente si algo sale mal:

```bash
git tag nombre-descriptivo-del-punto-anterior
git push origin nombre-descriptivo-del-punto-anterior
```

Para volver a ese punto:

```bash
git checkout nombre-descriptivo-del-punto-anterior
git checkout -b hotfix/restaurar
git push -u origin hotfix/restaurar
# abrir PR hacia main
```

Tags existentes: `esquema-una-pagina` (estado del sitio como una sola página con vistas ocultas por JavaScript, antes de dividirlo en páginas HTML reales).

---

## Autores

Desarrollado por el equipo de imágenes diagnósticas para uso interno.