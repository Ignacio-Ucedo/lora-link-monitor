# Hardware de la estación meteorológica

> Notas del armado físico: alimentación, sensores y pines.
> Pensado para que la próxima persona entienda **qué hay, por qué está así y qué falta cambiar**.

## Contexto

La estación fue originalmente de otra persona, con electrónica más vieja que consumía
bastante más y funcionaba con una **batería de plomo de 12V** y un **panel solar grande**
(~60×40 cm). Hoy el cerebro es un **ESP32**, que consume mucho menos, así que gran parte
del hardware heredado quedó sobredimensionado.

---

## Alimentación

### Cadena actual

```
                 ┌─ USB header (hembra)  ─┐
                 │  (carga / debug)        │
                 ▼                         ▼
   Panel solar → [MCP73871] → 18650 Li-ion (3.0–4.2V)
                     │
                     ▼
                 [Step-up a 5V] → Vin del ESP32 → LDO de la placa (AMS1117) → 3.3V
```

### Componentes

| Componente | Qué hace |
|---|---|
| **MCP73871** | Cargador Li-ion de 1 celda con *power-path* (alimenta la carga mientras carga la batería) y doble entrada (USB + solar/AC). |
| **18650 Li-ion** | Batería, 1 celda, 3.0–4.2V. |
| **Step-up a 5V** | Sube la tensión de la batería a 5V para entrar por Vin. **A eliminar** (ver abajo). |
| **USB header (hembra, micro USB)** | **Entrada de carga de la batería** (vía MCP73871, con power-path). Distinta del USB de la placa ESP32. Se mantiene. |
| **Switch de encendido** | Corte maestro on/off. Hoy está entre Vout del step-up y Vin. **A reubicar y cambiar de tipo** (ver abajo). |
| **ESP32** | Controlador. Corre a 3.3V. La placa dev trae su propio LDO (AMS1117) en Vin. |

> **Sobre el USB header:** es la vía de carga de la batería, **distinta del micro USB de
> la placa ESP32** (ese solo programa/alimenta el chip, no carga la batería). Como en el
> prototipo el solar está pospuesto, es hoy **la única forma de cargar el 18650**, y a
> futuro queda como carga de emergencia/mantenimiento. **No agrega costo.** El único
> "pero" es el conector: es micro USB (el de los Android pre-2016); un **USB-C** sería
> más práctico (reversible, cables más comunes), pero es preferencia, no algo funcional.

### ⚠️ TODO: reemplazar el step-up por un LDO HT7333

**Qué cambiar:** sacar el step-up a 5V y alimentar el ESP32 con un **HT7333** (LDO
4.2V→3.3V) directo desde la batería, entrando por el pin **3V3** (no por Vin).

**Por qué:** hoy la energía hace `batería 3.7V → sube a 5V → baja a 3.3V`. Son dos
conversiones con pérdidas, justo lo que no querés en algo a batería/solar. La celda ya
vive en 3.0–4.2V, casi el rango del ESP32, así que alcanza con **un solo regulador** que
baje a 3.3V.

**Orden importante — NO al revés:**
1. Primero tener el HT7333 en mano.
2. Recién ahí desconectar el step-up y conectar el HT7333.

Nunca quedarse en un estado intermedio sin regulación:
- Batería → Vin no sirve: el AMS1117 necesita ~1.1V de dropout; apenas la batería baje
  de ~3.7V ya no mantiene los 3.3V → brownouts y reinicios.
- Batería 4.2V → pin 3V3 directo (sin regulador): **peligroso**, supera el máximo del
  rail de 3.3V (~3.6V) y puede dañar el ESP32.

El step-up actual **no es peligroso, solo ineficiente**: se puede seguir usando tal cual
hasta que llegue el HT7333.

> **Por qué alimentamos por 3V3 y no por Vin:** el chip ESP32 corre a 3.3V, no a 5V. Los
> 5V del Vin existen **solo** para alimentar el regulador de la placa (AMS1117), que los
> baja a 3.3V. Como el HT7333 ya nos da 3.3V limpios, los inyectamos directo en el pin
> 3V3 (que es el riel de 3.3V del chip) y nos salteamos tanto el Vin como el AMS1117. Por
> eso el step-up a 5V sobra: fabricaba una tensión que nunca hizo falta.

> **No tener dos fuentes a la vez sobre el riel de 3.3V:** si se alimenta por 3V3, no
> conectar USB/Vin al mismo tiempo (el AMS1117 sacaría 3.3V y pelearía con el HT7333).

**Para flashear/programar:** sacar la batería (así el HT7333 queda sin entrada y no toca
el riel) y programar por el USB de la placa, que alimenta por 5V → AMS1117 → 3.3V. Al
terminar, volver a poner la batería. Sin llaves ni diodos de por medio.

### Switch de encendido

Corte maestro on/off del sistema. Dos cambios respecto de lo actual:

- **Cambiar el pulsador momentáneo por un switch con retención (latching).** La carcasa
  trae un push *sin hold* (vuelve al soltarlo), que no sirve como on/off: al soltarlo
  corta la alimentación. Reemplazarlo por un switch que retenga. Si se quiere conservar
  el formato/encaje del agujero, existen los **push latching (push-on / push-off)**; si
  no, un mini toggle o slide que entre en el hueco. Va sobre la línea de 3.3V (consumo
  chico), así que cualquier switch pequeño alcanza.
- **Reubicarlo** cuando se saque el step-up: ponerlo en el **camino de carga → HT7333**
  (no directo sobre el borne de la batería). Así, apagado, el sistema **puede seguir
  cargando** con sol/USB.

### Panel solar

El panel heredado (~60×40 cm) es "de 12V" (alimentaba una batería de plomo de 12V), así
que su Voc en vacío ronda **18–21V**. El MCP73871 tolera **~6V máx** en la entrada →
**no se puede conectar el panel directo, lo dañaría.**

- El voltaje del panel lo define la **cantidad de celdas en serie**, no su tamaño. **No
  se puede "capar" recortándolo** físicamente (rompería las celdas en serie). Para bajar
  el voltaje hace falta electrónica (un buck / cargador MPPT tipo CN3791).
- Para el **prototipo** no vale la pena comprar eso para un panel que no va a estar en el
  producto final. Dos caminos razonables:
  - **Cargar/alimentar por USB** y dejar el solar para después (cero compras).
  - Comprar un **panel chico de 6V / 1–2W**: se enchufa directo al MCP73871 y es más
    representativo del producto final que el panel viejo.

### Ideas para el producto final

- Evaluar **LiFePO4** en vez de Li-ion si la estación va a la intemperie con fríos: el
  Li-ion **no se puede cargar por debajo de 0 °C** sin dañarse. El LiFePO4 aguanta mejor
  la temperatura y su rango (3.2–3.6V) matchea aún mejor los 3.3V.
- Dimensionar el panel real al consumo del ESP32 (con deep sleep, unos pocos mA promedio):
  el panel viejo está muy sobredimensionado.

---

## Sensores y pines

| Sensor | Pin ESP32 | Notas |
|---|---|---|
| DHT22 (temp/humedad) | 21 | Lectura cada 2 s; se descarta si `isnan`. |
| Anemómetro (viento) | 26 | Interrupt + debounce 5 ms (5000 µs entre pulsos válidos). |

- Factor de conversión de viento: `velocidad_km_h = (pulsos / intervalo_s) * 2.4`
- Dirección de viento y lluvia: **aún sin hardware** (mockeadas en la app).

---

## Pendientes de hardware

- [ ] Reemplazar step-up por HT7333 (LDO a 3.3V, alimentar por pin 3V3).
- [ ] Cambiar el push momentáneo por un switch latching y reubicarlo en el camino de carga.
- [ ] Resolver alimentación solar del prototipo (USB por ahora, o panel chico de 6V).
- [ ] Definir batería del producto final (Li-ion vs LiFePO4 según clima).
- [ ] Agregar hardware de dirección de viento y lluvia (hoy mockeados).
