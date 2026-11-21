package com.example.modloader

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipFile

sealed class InstallResult {
    data class Success(val installedFiles: Int, val targetDir: File) : InstallResult()
    data class Failure(val reason: String) : InstallResult()
}

object ModInstaller {

    fun install(zipFile: File, profile: GameProfile): InstallResult {
        val root = GameProfiles.root(profile)
            ?: return InstallResult.Failure("Внешнее хранилище недоступно")
        return when (profile.id) {
            "minecraft" -> installAddon(zipFile, root)
            else -> installArchive(zipFile, root)
        }
    }

    fun installAddon(zipFile: File, gamesRoot: File): InstallResult {
        if (!gamesRoot.exists() && !gamesRoot.mkdirs()) {
            return InstallResult.Failure("Не удалось создать папку игры: ${gamesRoot.path}")
        }

        return try {
            ZipFile(zipFile).use { zip ->
                var installed = 0
                val entries = zip.entries().asSequence().toList()

                for (entry in entries) {
                    if (entry.isDirectory) continue
                    val target = resolveTarget(gamesRoot, entry) ?: continue
                    target.parentFile?.mkdirs()
                    zip.getInputStream(entry).use { input ->
                        target.outputStream().use { output -> input.copyTo(output) }
                    }
                    installed++
                }

                if (installed == 0) {
                    InstallResult.Failure("В архиве не найдено файлов мода (behavior_packs / resource_packs)")
                } else {
                    InstallResult.Success(installed, gamesRoot)
                }
            }
        } catch (e: IOException) {
            InstallResult.Failure("Ошибка чтения архива: ${e.message}")
        } catch (e: SecurityException) {
            InstallResult.Failure("Нет доступа к папке игры: ${e.message}")
        }
    }

    fun installArchive(zipFile: File, root: File): InstallResult {
        if (!root.exists() && !root.mkdirs()) {
            return InstallResult.Failure("Не удалось создать папку игры: ${root.path}")
        }

        return try {
            ZipFile(zipFile).use { zip ->
                var installed = 0
                for (entry in zip.entries().asSequence()) {
                    if (entry.isDirectory) continue
                    val resolved = File(root, entry.name)
                    if (!resolved.canonicalPath.startsWith(root.canonicalPath)) continue
                    resolved.parentFile?.mkdirs()
                    zip.getInputStream(entry).use { input ->
                        resolved.outputStream().use { output -> input.copyTo(output) }
                    }
                    installed++
                }
                if (installed == 0) {
                    InstallResult.Failure("Архив пуст или повреждён")
                } else {
                    InstallResult.Success(installed, root)
                }
            }
        } catch (e: IOException) {
            InstallResult.Failure("Ошибка чтения архива: ${e.message}")
        } catch (e: SecurityException) {
            InstallResult.Failure("Нет доступа к папке игры: ${e.message}")
        }
    }

    fun createMinecraftPack(name: String, description: String): InstallResult {
        val gamesRoot = GameProfiles.root(GameProfiles.minecraftProfile())
            ?: return InstallResult.Failure("Внешнее хранилище недоступно")
        if (!gamesRoot.exists() && !gamesRoot.mkdirs()) {
            return InstallResult.Failure("Не удалось создать папку игры: ${gamesRoot.path}")
        }

        val safe = name.filter { it.isLetterOrDigit() }.take(24).ifEmpty { "ModPack" }
        val dir = File(gamesRoot, "behavior_packs/${safe}_${System.currentTimeMillis() % 100000}")

        return try {
            if (!dir.mkdirs()) {
                return InstallResult.Failure("Не удалось создать папку пака: ${dir.path}")
            }
            File(dir, "scripts").mkdirs()
            File(dir, "manifest.json").writeText(packManifest(name, description).toString(2))
            InstallResult.Success(1, dir)
        } catch (e: IOException) {
            InstallResult.Failure("Ошибка записи манифеста: ${e.message}")
        }
    }

    private fun packManifest(name: String, description: String): JSONObject {
        return JSONObject()
            .put("format_version", 2)
            .put(
                "header",
                JSONObject()
                    .put("name", name)
                    .put("description", description)
                    .put("uuid", UUID.randomUUID().toString())
                    .put("version", JSONArray(listOf(1, 0, 0)))
                    .put("min_engine_version", JSONArray(listOf(1, 20, 0)))
            )
            .put(
                "modules",
                JSONArray().put(
                    JSONObject()
                        .put("type", "data")
                        .put("uuid", UUID.randomUUID().toString())
                        .put("version", JSONArray(listOf(1, 0, 0)))
                )
            )
    }

    private fun resolveTarget(gamesRoot: File, entry: ZipEntry): File? {
        val normalized = entry.name.replace('\\', '/')
        val target = when {
            normalized.startsWith("behavior_packs/") ->
                File(gamesRoot, "behavior_packs/${normalized.removePrefix("behavior_packs/")}")
            normalized.startsWith("resource_packs/") ->
                File(gamesRoot, "resource_packs/${normalized.removePrefix("resource_packs/")}")
            isAddonManifestEntry(normalized) ->
                File(gamesRoot, "behavior_packs/$normalized")
            else -> null
        }
        if (target != null && !target.canonicalPath.startsWith(gamesRoot.canonicalPath)) {
            return null
        }
        return target
    }

    private fun isAddonManifestEntry(name: String): Boolean {
        return name == "manifest.json" || name == "pack_icon.png"
    }
}
