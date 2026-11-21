package com.example.modloader

import android.os.Environment
import java.io.File
import java.io.IOException
import java.util.zip.ZipEntry
import java.util.zip.ZipFile

sealed class InstallResult {
    data class Success(val installedFiles: Int, val targetDir: File) : InstallResult()
    data class Failure(val reason: String) : InstallResult()
}

object ModInstaller {

    const val MINECRAFT_PACKAGE = "com.mojang.minecraftpe"

    val minecraftModDirs: List<String> = listOf(
        "resource_packs",
        "behavior_packs"
    )

    fun minecraftGamesRoot(): File? {
        val storage = Environment.getExternalStorageDirectory() ?: return null
        return File(
            storage,
            "Android/data/$MINECRAFT_PACKAGE/files/games/com.mojang"
        )
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
