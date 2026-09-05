# Rediseño UX/UI — WeatherStation

> **Estado**: Propuesta / visión. No implementado.
> **Objetivo**: Dejar de parecer una utilidad de dispositivo BLE y pasar a ser una
> experiencia de clima.

---

## El reframe de fondo

Hoy la app es, conceptualmente, **"conectate a un dispositivo BLE y leé sus campos"** —
un multímetro con estilo. La estructura lo delata: pantalla de conexión → dashboard de
6 cards iguales. El hardware y el Bluetooth son los protagonistas.

El rediseño invierte eso: **"el clima de tu lugar, en vivo"**. El dispositivo y la
conexión pasan a ser infraestructura invisible; el protagonista es el ambiente.

**Pregunta que guía el diseño**: ¿quién lo mira, dónde y cuándo? No es lo mismo un
hobbyista que chequea su estación del patio unas veces al día desde el sofá, que una
tablet montada en la pared como display ambiental. Caso asumido: **glance frecuente en
el teléfono + a veces display fijo**.

---

## Distinción: pulido vs. rediseño

- **Pulido** = mejorar lo que ya hay (íconos, números animados, sacar mocks). Parte del
  layout existente. Ver sección "Tácticas de ejecución".
- **Rediseño** = partir del concepto de producto, usuario y contexto; el layout es una
  consecuencia. Es lo que describe este documento.

En una frase: *el pulido hace que la app actual se vea profesional; el rediseño hace que
deje de parecer una utilidad de dispositivo.*

---

## Pilares del rediseño

### 1. Un lienzo ambiental, no una grilla
El fondo entero *es* el clima: un gradiente atmosférico que cambia con la temperatura
(frío azulado → cálido ámbar), la hora del día y el viento. En vez de rectángulos iguales
sobre negro plano, la pantalla respira y comunica el estado de un vistazo, incluso a
3 metros. Este es el diferenciador real contra el "card grid" genérico.

### 2. Jerarquía por significado
No todas las métricas del mismo tamaño. Un **héroe** (temperatura, gigante), un cinturón
de métricas de apoyo (humedad, viento), y el **tiempo como dimensión de primer nivel**.
Una app de clima sin eje temporal es un instrumento, no una experiencia.

### 3. La historia es la mitad del producto
Min/máx del día, tendencia de las últimas horas, "subiendo/bajando". Con sólo 3 sensores
reales, la profundidad no viene de *más* datos sino de *datos en el tiempo*.

### 4. Honestidad con pocos datos
Temp, humedad y viento son reales; dirección y lluvia están mockeadas. El rediseño no
rellena la pantalla con cards falsas en 0: hace **pocas métricas con mucha profundidad**
(grande, con contexto, tendencia, sensación) en vez de muchas vacías. Menos es más creíble.

### 5. El movimiento significa algo
El viento mueve el fondo/partículas a la velocidad real; los números hacen *ease*, no
cortan; conectar/perder señal es una transición física. La liveness es la estética, no un
banner de "Conectado".

### 6. La conexión se disuelve
Nada de pantalla-puerta de scan. La app abre mostrando el último estado conocido (atenuado)
mientras reconecta en background; un halo/pulso sutil indica "en vivo vs. última lectura
hace X". El BLE nunca es el protagonista.

---

## Wireframe de la pantalla-héroe

```
┌─────────────────────────────┐
│  ◜ gradiente cálido/frío ◝   │   ← fondo = estado del clima
│                             │
│   Patio · en vivo ·         │   ← lugar + liveness (no "Conectado")
│                             │
│        16.6°                │   ← HÉROE
│     ↑ subiendo · máx 21°    │   ← contexto temporal
│                             │
│   ╭─── sparkline 3h ───╮    │   ← el tiempo, primer nivel
│   ╰─────────────────────╯   │
│                             │
│  💧 50%      💨 12 km/h  NE  │   ← apoyo, secundario
│  humedad     viento         │
│                             │
│  ~ partículas de viento ~   │   ← movimiento = dato real
└─────────────────────────────┘
```

Una sola superficie viva, scroll para detalle/historia, sin saltos de pantalla.

---

## Tácticas de ejecución (subordinadas a la visión)

Estas son correctas tanto para el rediseño como para un pulido incremental del layout
actual. Pasan de ser *el plan* a ser *detalles de ejecución*.

| # | Táctica | Nota |
|---|---------|------|
| 1 | Reemplazar emojis por íconos vectoriales | `lucide-react-native` o `@expo/vector-icons` (Feather): Thermometer, Droplets, Wind, Compass. Lo que más "grita amateur" hoy. |
| 2 | Números con transición + `fontVariant: ['tabular-nums']` | Usar reanimated (ya presente por WindGauge). Evita el "baile" de dígitos. |
| 3 | Sacar/rediseñar los cards mock (lluvia 0, "sin sensor") | O quitarlos, o marcarlos explícitamente como "Próximamente". |
| 4 | Timestamp de última lectura + estado stale | Ámbar si pasan >6 s sin notify. Da confianza de dato en vivo. |
| 5 | Sparkline de historia (temp/humedad) | `react-native-svg` (ya presente) o `victory-native`. |
| 6 | Skeletons/shimmer en vez de `--` inicial | Estado de carga hasta la primera notificación. |
| 7 | Micro-interacciones | Haptics (`expo-haptics`), pull-to-refresh, press feedback. |
| 8 | Color con semántica | Temperatura teñida por rango (frío→calor). |
| 9 | Onboarding + priming de permisos BLE | Explicar antes de pedir; manejo elegante de BT apagado/permiso denegado. |
| 10 | Identidad | Ícono y splash propios (hoy es el robot de Expo), toggle °C/°F. |
| 11 | Reconexión automática en background | Más UX que UI; separa demo de producto. |

---

## Extensibilidad: sensores futuros (veleta, pluviómetro)

El pilar 4 (honestidad) sacó dirección y lluvia porque eran mock; cuando lleguen los
sensores reales, vuelven **como datos con profundidad**, y el layout ya tiene su lugar:

- **Veleta**: la dirección no es una métrica aparte, es un atributo del viento. Se funde
  en la métrica de viento ("18 km/h · NE", como ya muestra el wireframe) y orienta las
  partículas de fondo. Cero cambios de estructura.
- **Pluviómetro**: tercera métrica del cinturón ("0.4 mm hoy"). La lluvia es un evento:
  cuando llueve, además modula el lienzo (matiz más frío/gris, partículas de lluvia) y
  puede ascender temporalmente en jerarquía. El cinturón está diseñado para 2–4 métricas
  sin romperse.
- Regla general: **cada sensor nuevo entra por el cinturón**; solo asciende (héroe,
  fondo) si su estado presente cambia lo que el usuario debería sentir de un vistazo.

## Primer paso sugerido

Prototipo navegable de la **pantalla-héroe** (fondo ambiental + héroe + sparkline) en una
rama, para verlo en el teléfono con datos reales y decidir entre rediseño completo o un
híbrido.

---

## Stack disponible relevante

- `react-native-reanimated` — animaciones (ya usado en `components/WindGauge.tsx`)
- `react-native-svg` — gráficos/sparklines/gauges (ya presente)
- Faltaría evaluar: set de íconos, librería de charts, `expo-haptics`, `expo-linear-gradient`.

---

## Anexo: mini design system

> La visión de arriba define el *qué*; este anexo fija el *cómo* fino, que es donde se
> decide si el resultado se ve profesional o amateur. Toda decisión visual no cubierta
> acá se resuelve eligiendo la opción más sobria.

### A. Tipografía

Fuente del sistema (SF en iOS, Roboto en Android). Nada de fuentes custom: el nivel
"profesional" viene de la escala y los pesos, no de la tipografía exótica.

| Rol | Tamaño | Peso | Notas |
|-----|--------|------|-------|
| Héroe (temperatura) | 96 | 200 (ultralight) | `fontVariant: ['tabular-nums']`. El signo `°` en 0.4× del tamaño, alineado arriba. |
| Contexto del héroe ("↑ subiendo · máx 21°") | 15 | 500 | Color texto secundario. |
| Métrica de apoyo (valor) | 28 | 300 | `tabular-nums`. |
| Etiqueta / unidad | 12 | 500 | MAYÚSCULAS, `letterSpacing: 0.8`, texto secundario. |
| Cuerpo (onboarding, errores) | 15 | 400 | |

Regla dura: **máximo 3 tamaños visibles por pantalla** además del héroe. Si una pantalla
necesita un cuarto, sobra un elemento, no falta un tamaño.

### B. Paleta de gradientes por temperatura

El fondo es un gradiente vertical de dos paradas. La parada superior es siempre casi
negra (ahí vive el héroe → contraste garantizado); la inferior lleva el matiz térmico.
El recorrido de matiz es azul → teal → verde → ámbar → naranja, siempre desaturado y
oscuro — atmósfera, no arcoíris.

| Rango | Parada superior | Parada inferior | Acento (tinta del héroe e íconos) |
|-------|-----------------|-----------------|-----------------------------------|
| ≤ 0° helada | `#0A0F1E` | `#1E3A5F` | `#7EB6E8` |
| 0–10° frío | `#0B111C` | `#1F4A66` | `#6FB1D8` |
| 10–18° fresco | `#0C1319` | `#1E5252` | `#6FCFC3` |
| 18–24° templado | `#10131A` | `#33503F` | `#8FD694` |
| 24–30° cálido | `#14100E` | `#6B4226` | `#F0B269` |
| ≥ 30° calor | `#170D0A` | `#7A3B24` | `#F08C5A` |

Reglas:
- **Transición entre rangos**: interpolar el color continuamente por temperatura (no
  saltos al cruzar 18.0°). Reanimated `interpolateColor` sobre la temperatura suavizada.
- **Noche**: entre puesta y salida del sol, bajar la luminosidad de la parada inferior
  ~40%. La hora modula luz, la temperatura modula matiz — nunca al revés.
- **Sin conexión / stale**: desaturar el gradiente hacia gris (no cambiar de matiz). El
  color "se apaga", no "se rompe".
- Texto principal `#ECF2F8`, secundario `#9BA8B5`. Nunca blanco puro. El acento tiñe el
  número héroe y los íconos, **no** el texto de etiquetas.

### C. Legibilidad sobre fondo dinámico

- Contraste mínimo: 4.5:1 para texto de apoyo, 3:1 para el héroe (es enorme, califica
  como "large text"). Las paradas superiores de la tabla ya lo garantizan; si un cambio
  de paleta lo rompe, se oscurece el fondo, no se agranda el texto.
- Si algún elemento cae sobre la zona baja (más clara) del gradiente, lleva un scrim
  local: `rgba(0,0,0,0.25)` con radio 16. Prohibido el text-shadow como parche.
- El sparkline usa el color de acento del rango a opacidad 0.9, con relleno degradado
  del mismo color a 0.12 → 0.

### D. Espaciado, radios, capas

- Escala de 4pt: **4 / 8 / 12 / 16 / 24 / 32 / 48**. Ningún margen fuera de la escala.
- Padding horizontal de pantalla: 24 (hoy es 16; a 24 respira más y se ve menos "app de
  formulario").
- Radios: 16 para superficies chicas, 24 para contenedores grandes. Un solo borde
  permitido en toda la UI (`rgba(255,255,255,0.08)`); si algo necesita separarse más,
  se separa con espacio, no con más bordes.
- Máximo **dos niveles de superficie**: el lienzo (gradiente) y una elevación sutil
  (`rgba(255,255,255,0.05)`) para lo que necesite agruparse. No hay cards sobre cards.

### E. Movimiento

| Tipo | Duración | Easing |
|------|----------|--------|
| Micro (press, haptic visual) | 150 ms | ease-out |
| Transición de valor (números, color de fondo) | 500 ms | ease-in-out |
| Ambiente (gradiente por hora, respiración del halo "en vivo") | ≥ 3 s | linear/sine |

- Partículas de viento: opacidad ≤ 0.15, cantidad ≤ 30, velocidad mapeada linealmente a
  los km/h reales, y **quietas cuando el viento es < 3 km/h**. Si en algún momento
  parecen protagonistas, son screensaver: bajar opacidad o cantidad hasta que vuelvan a
  ser textura.
- Todo lo ambiental se pausa cuando la app está en background (batería).

### F. Referencias visuales (la vara)

- **Apple Weather** — fondo ambiental que comunica sin leer, jerarquía héroe/apoyo.
- **(Not Boring) Weather** — movimiento con significado, hasta dónde llegar (y no pasar).
- **Hello Weather** — honestidad con pocos datos: pocas métricas, mucha claridad.

Test de calidad antes de mergear cualquier pantalla: captura en el teléfono real, al
lado de Apple Weather. Si desentona en densidad, contraste o quietud, no pasa.

### G. Anti-patrones (lo que NO se hace)

- Emojis como íconos. Íconos: Feather/lucide, stroke 2, tamaño 20 en métricas de apoyo.
- Bordes de color, glows, sombras de color. La única "luz" es el gradiente.
- Más de un acento simultáneo en pantalla (el acento lo dicta el rango térmico).
- Texto que anuncia el sistema ("Conectado", "BLE", "notificación"). El estado se
  muestra (halo, atenuado, timestamp), no se declara.
- Rellenar espacio vacío. El vacío sobre el gradiente es parte del diseño.
