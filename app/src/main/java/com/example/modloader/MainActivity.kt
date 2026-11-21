package com.example.modloader

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class MainActivity : ComponentActivity() {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + job)

    private var status by mutableStateOf("Выберите .mcaddon или .mcpack файл для установки")
    private var busy by mutableStateOf(false)

    private val pickMod = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? -> uri?.let { importMod(it) } }

    private val requestStorage = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* результат не требуется, поведение на Android 10 и так разрешено */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ensureStoragePermission()
        setContent {
            MaterialTheme {
                ModLoaderScreen(
                    status = status,
                    busy = busy,
                    onPick = { pickMod.launch(arrayOf("application/zip", "application/octet-stream")) }
                )
            }
        }
        handleIncomingIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun ensureStoragePermission() {
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.WRITE_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            requestStorage.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_VIEW) {
            val uri = intent.data ?: return
            importMod(uri)
        }
    }

    private fun importMod(uri: Uri) {
        if (busy) return
        busy = true
        status = "Установка…"

        scope.launch {
            val result = withContext(Dispatchers.IO) { runCatching { install(uri) } }
            busy = false
            result.fold(
                onSuccess = { r ->
                    status = when (r) {
                        is InstallResult.Success ->
                            "Готово: установлено файлов — ${r.installedFiles}"
                        is InstallResult.Failure ->
                            "Ошибка: ${r.reason}"
                    }
                },
                onFailure = { e ->
                    status = "Ошибка: ${e.message}"
                }
            )
        }
    }

    private fun install(uri: Uri): InstallResult {
        val gamesRoot = ModInstaller.minecraftGamesRoot()
            ?: return InstallResult.Failure("Внешнее хранилище недоступно")

        val cached = copyToCache(uri) ?: return InstallResult.Failure("Не удалось прочитать файл")
        return ModInstaller.installAddon(cached, gamesRoot)
    }

    private fun copyToCache(uri: Uri): File? {
        val name = queryFileName(uri) ?: "imported.mcaddon"
        val target = File(cacheDir, name.ifBlank { "imported.mcaddon" })
        return runCatching {
            contentResolver.openInputStream(uri)?.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            } ?: return null
            target
        }.getOrNull()
    }

    private fun queryFileName(uri: Uri): String? {
        return runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull()
    }
}

@Composable
private fun ModLoaderScreen(status: String, busy: Boolean, onPick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = "ModLoader", style = MaterialTheme.typography.headlineMedium)
        Text(
            text = status,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        )
        Button(onClick = onPick, enabled = !busy) {
            Text(if (busy) "Установка…" else "Выбрать файл мода")
        }
    }
}
