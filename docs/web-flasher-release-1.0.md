# Релиз web-flasher 1.0.0

Первый стабильный номер версии для приложения в каталоге **`web-flasher/`** в этом репозитории.

## Что считается закрытым для 1.0

- P0 из roadmap: таргет RX (BF/INAV/EdgeTX flow), фазы прошивки (включая verify/reboot по событиям esptool-js), локальный файл без облачной сборки.
- Документированные ограничения платформ и транспортов: [honest-gap.md](./honest-gap.md), [hardware-limitations.md](./hardware-limitations.md).
- Сборка и тесты: `npm run lint`, `npm test`, `npm run build` в CI ([`.github/workflows/web-flasher.yml`](../.github/workflows/web-flasher.yml)).
- Развёртывание: [web-flasher-deployment.md](./web-flasher-deployment.md).

## Сборка артефакта

```bash
cd web-flasher
npm ci
npm run build
```

Результат: каталог **`dist/`** для статического хостинга по HTTPS (или `localhost` для Web Serial).

## Версия в UI и PWA

Версия подставляется из `web-flasher/package.json` при сборке (бейдж в шапке приложения, описание PWA manifest).

## Тег в git (по желанию команды)

Пример аннотированного тега только для web-flasher (не обязателен для работы приложения):

```bash
git tag -a web-flasher-v1.0.0 -m "web-flasher 1.0.0"
git push origin web-flasher-v1.0.0
```

История изменений: [web-flasher/CHANGELOG.md](../web-flasher/CHANGELOG.md).

Инструкция по установке и использованию: [web-flasher-user-guide.md](./web-flasher-user-guide.md).
