# Build del firmware en Windows.
# Uso:  .\build.ps1            (compila lora-tx y lora-rx en release)
#       .\build.ps1 -Flash rx  (compila y flashea lora-rx por USB)
param(
    [ValidateSet("", "tx", "rx")] [string]$Flash = ""
)

. "$env:USERPROFILE\export-esp.ps1"   # generado por espup: LIBCLANG_PATH + GCC xtensa
$py = "$env:LOCALAPPDATA\Programs\Python\Python311"
$env:Path = "$py;$py\Scripts;$env:USERPROFILE\.cargo\bin;$env:Path"

# CMake de ESP-IDF falla con rutas largas: target dir corto fuera del repo.
$env:CARGO_TARGET_DIR = "C:\lt"
# Con el target dir movido, embuild ya no puede deducir el workspace ni el crate raíz.
$env:CARGO_WORKSPACE_DIR = $PSScriptRoot
$env:ESP_IDF_SYS_ROOT_CRATE = "lora-rx"
# ESP-IDF y sus herramientas en ~/.espressif (compartido entre proyectos).
$env:ESP_IDF_TOOLS_INSTALL_DIR = "global"
# sdkconfig con BLE habilitado (necesario para esp32-nimble).
$env:ESP_IDF_SDKCONFIG_DEFAULTS = Join-Path $PSScriptRoot "lora-rx\sdkconfig.defaults"

Set-Location $PSScriptRoot
if ($Flash -ne "") {
    cargo run --release -p "lora-$Flash"
} else {
    cargo build --release
}
