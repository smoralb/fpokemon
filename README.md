# POKÉMON AMARILLO FP

Demake fan de **Pokémon Amarillo** de Game Boy… pero en **primera persona**.
Motor raycasting propio: el mundo 3D se renderiza a 160×144 (la resolución
real de la Game Boy) con la paleta verde clásica de 4 tonos y se escala con
píxel nítido, mientras que los textos y menús se dibujan a alta resolución
para que sean legibles. Sin dependencias: HTML + JavaScript puro.

> Proyecto fan sin ánimo de lucro. Pokémon es propiedad de Nintendo/Game Freak.
> Todos los gráficos y sonidos de este demake son originales y procedurales.

## Cómo jugar en PC

Doble clic en **`index.html`** (Chrome, Edge o Firefox). No necesita servidor
ni instalación.

Si prefieres servirlo: `python -m http.server` (o `npx serve`) y abre
`http://localhost:8000`.

## Controles

| Tecla | Acción |
|---|---|
| `W` / `S` (o ↑/↓) | Avanzar / retroceder |
| `A` / `D` (o ←/→) | Girar |
| `Q` / `E` | Desplazamiento lateral |
| `Z` / `Espacio` / `Enter` | Hablar, aceptar, avanzar texto |
| `X` / `Esc` | Menú de pausa / cancelar |
| `M` | Mapa de la zona |
| Clic en pantalla | Captura el ratón para girar la vista |

## El juego

Vives la apertura de Pokémon Amarillo, en 3D y en primera persona:

- El **Prof. Oak** te entrega un **Pikachu** (que odia su Poké Ball, claro).
- Tu rival **Azul** te reta con su **Eevee** antes de dejarte salir.
- Cruza la **Ruta 1** hasta **Ciudad Verde**: hierba alta con encuentros
  salvajes (Pidgey, Rattata, Caterpie, Weedle, Spearow, Nidoran♂, Mankey,
  Oddish…).
- **Centro Pokémon** para curar, **Tienda** con Poké Balls y Pociones.
- Recoge el **Paquete de Oak** en la tienda y entrégaselo para completar la
  demo. Después puedes seguir capturando y entrenando.

Sistema de combate por turnos estilo Gen 1: tabla de tipos, golpes críticos,
STAB, cambios de stats, parálisis y veneno, captura con Poké Ball,
experiencia, subidas de nivel y aprendizaje de movimientos.
Guardado en el menú de pausa (localStorage).

## ⚠ El otro juego

Este no es solo un demake. **El mundo Pokémon es la ilusión de un niño
ingresado en un psiquiátrico**, y a veces la ilusión se rompe:

- **Visiones**: el escenario se transforma de golpe en lo que es de verdad —
  paleta de tonos carne y óxido, paredes que gotean, lodo, baldosas
  manchadas. Tu Pikachu es otra cosa. La gente del Centro Pokémon lleva
  mucho tiempo "durmiendo". Cada lugar tiene su nombre real (HABITACIÓN 9,
  ALCANTARILLADO, SALA DE OBSERVACIÓN...).
- **Screamers**: sustos repentinos a pantalla completa con ruido y
  disonancia. Poco frecuentes, para que nunca los esperes.
- **Asaltos**: figuras que aparecen de golpe delante de ti con un golpe
  musical y te hacen preguntas que no deberían tener respuesta (SÍ/NO).
- **Diálogos turbios**: a veces los NPCs del idílico mundo verde dicen cosas
  que no encajan, o su texto se corrompe.
- **Momentos guionizados**: acariciar a tu Pokémon desde el menú de equipo,
  la curación de la enfermera, tu madre, y el final de la demo… no siempre
  son lo que parecen.

Contenido: terror psicológico ligero, sin imágenes explícitas (todo es
pixel art de 4 tonos). Pensado para jugadores a los que les guste el
creepypasta clásico de Pokémon.

## Estructura

```
index.html      Pantalla y carga de módulos
js/audio.js     Sonido (ondas cuadradas WebAudio)
js/data.js      Especies, movimientos, tipos, sprites y fórmulas
js/maps.js      Mapas, warps, NPCs y tablas de encuentros
js/engine.js    Motor raycasting + texturas procedurales
js/battle.js    Sistema de combate por turnos
js/horror.js    Visiones, screamers, asaltos y diálogos turbios
js/main.js      Estados, movimiento, menús y guiones
tests/          Validaciones headless con Node
```

## Pruebas

```
node tests/sanity.js       # coherencia de datos y mapas
node tests/battle-sim.js   # 360 combates simulados
node tests/walkthrough.js  # la historia completa, de principio a fin
node tests/render.js       # humo del renderizador
```
