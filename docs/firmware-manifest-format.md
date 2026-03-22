# Формат manifest прошивки (ZIP)

Приложение ищет в корне архива файл **`firmware-manifest.json`** (или `manifest.json` как запасной вариант при парсинге).

## Поля (рекомендуемая схема)

```json
{
  "version": "1",
  "target": "Unified_ESP32_900_RX",
  "chip": "ESP32",
  "firmwareVersion": "3.5.0",
  "segments": [
    { "file": "bootloader.bin", "offset": "0x1000" },
    { "file": "partitions.bin", "offset": "0x8000" },
    { "file": "firmware.bin", "offset": "0x10000" }
  ],
  "sha256": "optional-hex-for-primary-image",
  "md5": "optional"
}
```

- **`chip`**: строка из набора `ESP8266`, `ESP8285`, `ESP32`, `ESP32-C3`, `ESP32-S3` (регистронезависимо при сравнении).
- **`target`**: имя таргета ExpressLRS или платы для сопоставления с Expert Mode.
- **`segments`**: список файлов внутри ZIP и адресов прошивки (hex `0x...` или десятичное число).

## Приоритет метаданных

1. JSON manifest внутри ZIP  
2. Эвристики по имени файла (например `*_ESP32_*.bin`)  
3. Опциональный sidecar JSON в Expert Mode (отдельный выбор файла): поля `chip`, `target`, `firmwareVersion`, `offset` (hex/decimal). **Не применяется**, если в ZIP уже есть manifest (приоритет выше).  
4. Ручное переопределение в Expert Mode с предупреждением  

### Пример sidecar (`myrx.bin` + выбранный JSON)

```json
{
  "chip": "ESP32-C3",
  "target": "Unified_ESP32_2400_RX",
  "firmwareVersion": "3.5.0",
  "offset": "0x10000"
}
```
