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

## Primer paso sugerido

Prototipo navegable de la **pantalla-héroe** (fondo ambiental + héroe + sparkline) en una
rama, para verlo en el teléfono con datos reales y decidir entre rediseño completo o un
híbrido.

---

## Stack disponible relevante

- `react-native-reanimated` — animaciones (ya usado en `components/WindGauge.tsx`)
- `react-native-svg` — gráficos/sparklines/gauges (ya presente)
- Faltaría evaluar: set de íconos, librería de charts, `expo-haptics`, `expo-linear-gradient`.
