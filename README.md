# ModLoader

Мод-менеджер для Android 10 (API 29): установка .mcaddon / .mcpack модов
для Minecraft Pocket Edition в один тап.

## Как работает

- `minSdk = 29`, `targetSdk = 29` + `android:requestLegacyExternalStorage="true"`
  дают полный доступ к файлам без root на Android 10.
- Мод (ZIP-архив) распаковывается прямо в
  `Android/data/com.mojang.minecraftpe/files/games/com.mojang/`
  (`behavior_packs/`, `resource_packs/`).
- Приложение регистрируется как обработчик `.mcaddon` / `.mcpack` — тап по файлу
  в любом файловом менеджере сразу запускает установку.

## Сборка

1. Открыть проект в Android Studio (или `./gradlew assembleDebug`).
2. Собрать APK и установить на устройство с Android 10.
3. Выдать разрешение на запись при первом запуске.

## Важно

На Android 11+ `targetSdk = 29` с legacy storage работать перестанет: план
апгрейда — `MANAGE_EXTERNAL_STORAGE` или Shizuku.
