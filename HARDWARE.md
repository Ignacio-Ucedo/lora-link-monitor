# Estación Meteorológica — Documentación del prototipo

Este documento describe la estación meteorológica tal como está construida hoy y las
decisiones de diseño que se tomaron. Lo que se entrega es un **prototipo**: una base
funcional que valida el enfoque y sobre la cual se construye la versión definitiva.

## Punto de partida

La estación se recibió semiconstruida y pensada para operar de forma **autónoma**:
llevaba un módulo GSM dentro de la carcasa para enviar los datos por su cuenta, se
alimentaba con una **batería de plomo de 12V** y un panel solar grande (~60×40 cm), y
usaba electrónica de una generación anterior.

## Decisiones de diseño

### ESP32 como cerebro

Se adoptó un **ESP32** como centro de control de la estación. Es un microcontrolador
versátil y muy documentado, con Bluetooth y WiFi integrados, bajo consumo y un ecosistema
amplio de sensores y librerías. Además acompaña la dirección del proyecto: un ecosistema
de estaciones conectadas por **LoRa** (topología en estrella, cada estación como nodo de
la red). El ESP32 es una base natural para ese camino.

### Alcance del prototipo: Bluetooth

La red LoRa es la dirección del proyecto, y construirla es una etapa posterior. Para este
prototipo se definió un alcance concreto y verificable: la estación se vincula por
**Bluetooth a una app móvil** y muestra los datos en tiempo real. Los pines que necesita
el módulo LoRa (LR1121) ya quedan reservados para cuando se encare esa etapa.

### Alimentación

La estación funciona con una **batería de litio 18650** de una sola celda. Su rango de
tensión (3,0–4,2V) está cerca de los 3,3V que usa el ESP32, tiene buena densidad de
energía, es recargable y es un formato estándar.

La carga la administra un controlador **MCP73871**, que permite **cargar la batería y
alimentar la estación al mismo tiempo** y acepta dos fuentes de carga: USB y solar. Para
alimentar el ESP32, un regulador lleva la tensión de la batería a 3,3V estables.

## Funcionamiento actual

La estación mide y transmite en tiempo real:

- **Temperatura** y **humedad** (sensor DHT22)
- **Velocidad del viento** (anemómetro)
- **Dirección del viento** (veleta)

Los datos viajan por **Bluetooth** a una app móvil que los muestra. La estación se anuncia
con el nombre `WeatherStation` y la app se conecta a ella para recibir las lecturas.

En cuanto a energía, la batería se carga por USB o por panel solar a través del
controlador de carga, y un regulador entrega los 3,3V que necesita el ESP32.

## Estado del prototipo

**Funcionando:**

- Medición y envío por Bluetooth de temperatura, humedad y velocidad del viento.
- La app se conecta a la estación y muestra los datos.

**En calibración:**

- **Dirección del viento (veleta):** ya se lee y se transmite; se está ajustando el mapeo
  de la señal a los puntos cardinales.

**Pendiente:**

- **Lluvia (pluviómetro):** todavía no está cableado. El pin queda reservado para
  incorporarlo.
- **Simplificación de la alimentación:** el prototipo lleva un regulador elevador
  (step-up) que se reemplaza por un único regulador a 3,3V (HT7333), alimentando al ESP32
  de forma más directa y eficiente.
- **Llave de encendido:** el prototipo trae un pulsador momentáneo, que se reemplaza por
  una llave con retención (queda encendida al accionarla).
- **Carga solar:** en el prototipo la carga se hace por USB; la carga solar se integra más
  adelante.
- **LoRa:** queda fuera del alcance del prototipo, con los pines ya reservados.

## Recomendaciones para el diseño definitivo

Aprendizajes del prototipo, pensando la versión definitiva:

- **Batería:** para instalación a la intemperie con temperaturas bajas conviene una
  batería **LiFePO4**. Tolera mejor el frío y su rango de tensión se ajusta muy bien a los
  3,3V del ESP32.
- **Panel solar:** dimensionar el panel al consumo real del ESP32. Un panel chico de 6V
  alcanza, se integra directamente al controlador de carga y evita el tamaño y la tensión
  elevada del panel heredado.
- **Alimentación:** un solo regulador a 3,3V (es la dirección que toma el reemplazo del
  step-up por el HT7333).
- **Conector de carga:** USB-C en lugar de micro USB, por practicidad.
- **Llave de encendido:** una llave con retención accesible desde afuera de la carcasa.
- **LoRa:** incorporar el módulo LR1121 para integrar la estación a la red.

## Anexo técnico

### Componentes

| Componente | Función |
|---|---|
| ESP32 | Control central. Funciona a 3,3V. |
| DHT22 | Temperatura y humedad. |
| Anemómetro | Velocidad del viento (cuenta pulsos). |
| Veleta | Dirección del viento (lectura analógica). |
| Pluviómetro | Lluvia (a incorporar). |
| MCP73871 | Controlador de carga de la batería (USB + solar, carga y alimenta a la vez). |
| Batería 18650 Li-ion | Almacenamiento de energía (1 celda, 3,0–4,2V). |
| Regulador 3,3V | Alimenta el ESP32 desde la batería. |
| Header micro USB | Entrada de carga de la batería. |
| Llave de encendido | Corte de alimentación del sistema. |

### Sensores y pines del ESP32

| Señal | Pin |
|---|---|
| Temperatura / humedad (DHT22) | GPIO21 |
| Velocidad del viento (anemómetro) | GPIO26 |
| Dirección del viento (veleta) | GPIO34 |
| Lluvia (pluviómetro, a incorporar) | GPIO25 |

Factor de conversión de viento: `velocidad_km_h = (pulsos / intervalo_s) * 2,4`.

### Pines reservados para LoRa (LR1121)

Reservados para la etapa de red LoRa; no se usan en el prototipo.

| Función | Pin |
|---|---|
| CS | GPIO5 |
| CLK | GPIO18 |
| MOSI | GPIO23 |
| MISO | GPIO19 |
| RESET | GPIO33 |
| BUSY | GPIO32 |
