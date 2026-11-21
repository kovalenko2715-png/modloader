package com.example.modloader

import android.content.Context
import android.os.Environment
import java.io.File

data class GameProfile(
    val id: String,
    val name: String,
    val packageName: String,
    val modsRootRelative: String,
    val modTypes: String
)

object GameProfiles {

    val all = listOf(
        GameProfile(
            id = "minecraft",
            name = "Minecraft PE",
            packageName = "com.mojang.minecraftpe",
            modsRootRelative = "Android/data/com.mojang.minecraftpe/files/games/com.mojang",
            modTypes = ".mcaddon, .mcpack, behavior/resource packs, Script API (.js)"
        ),
        GameProfile(
            id = "gtasa",
            name = "GTA: San Andreas",
            packageName = "com.rockstargames.gtasa",
            modsRootRelative = "Android/data/com.rockstargames.gtasa/files",
            modTypes = ".txd (текстуры), .dff (модели), .img (архивы), CLEO-скрипты"
        )
    )

    fun installedProfiles(context: Context): List<GameProfile> {
        return all.filter { profile ->
            runCatching {
                context.packageManager.getPackageInfo(profile.packageName, 0)
            }.isSuccess
        }
    }

    fun minecraftProfile(): GameProfile = all.first { it.id == "minecraft" }

    fun root(profile: GameProfile): File? {
        val storage = Environment.getExternalStorageDirectory() ?: return null
        return File(storage, profile.modsRootRelative)
    }
}
