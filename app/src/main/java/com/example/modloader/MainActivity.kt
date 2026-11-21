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
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

    private var profiles by mutableStateOf<List<GameProfile>>(emptyList())
    private var selectedId by mutableStateOf<String?>(null)
    private var status by mutableStateOf("Поиск поддерживаемых игр…")
    private var busy by mutableStateOf(false)
    private var showCreateDialog by mutableStateOf(false)

    private val pickMod = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? -> uri?.let { importMod(it) } }

    private val requestStorage = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ensureStoragePermission()
        profiles = GameProfiles.installedProfiles(this)
        selectedId = profiles.firstOrNull()?.id
        status = if (profiles.isEmpty()) {
            "Поддерживаемые игры не найдены. Установите Minecraft PE или GTA SA."
        } else {
            "Выберите игру, затем установите мод или создайте пак"
        }
        setContent {
            MaterialTheme {
                ModLoaderScreen(
                    onOpenEditor = {
                        startActivity(Intent(this, SaveEditorActivity::class.java))
                    }
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

    private fun selectedProfile(): GameProfile? {
        return profiles.firstOrNull { it.id == selectedId }
    }

    private fun importMod(uri: Uri) {
        val profile = selectedProfile() ?: profiles.firstOrNull()
        if (busy || profile == null) return
        busy = true
        status = "Установка в ${profile.name}…"

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val cached = copyToCache(uri)
                        ?: return@runCatching InstallResult.Failure("Не удалось прочитать файл")
                    ModInstaller.install(cached, profile)
                }.getOrElse { InstallResult.Failure("Ошибка: ${it.message}") }
            }
            busy = false
            status = when (result) {
                is InstallResult.Success ->
                    "Готово (${profile.name}): установлено файлов — ${result.installedFiles}"
                is InstallResult.Failure ->
                    "Ошибка: ${result.reason}"
            }
        }
    }

    private fun createPack(name: String, description: String) {
        if (busy || name.isBlank()) return
        busy = true
        showCreateDialog = false
        status = "Создание пака…"

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching { ModInstaller.createMinecraftPack(name.trim(), description.trim()) }
                    .getOrElse { InstallResult.Failure("Ошибка: ${it.message}") }
            }
            busy = false
            status = when (result) {
                is InstallResult.Success ->
                    "Пак создан: ${result.targetDir.path} — откройте scripts/main.js для своего кода"
                is InstallResult.Failure ->
                    "Ошибка: ${result.reason}"
            }
        }
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

    @Composable
    private fun ModLoaderScreen(onOpenEditor: () -> Unit) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("ModLoader", style = MaterialTheme.typography.headlineMedium)

            if (profiles.isEmpty()) {
                Text(status, style = MaterialTheme.typography.bodyMedium)
                OutlinedButton(
                    onClick = onOpenEditor,
                    enabled = !busy
                ) { Text("Save-редактор (без root)") }
            } else {
                Text("Поддерживаемые игры:", style = MaterialTheme.typography.titleSmall)
                profiles.forEach { profile ->
                    GameCard(
                        profile = profile,
                        selected = profile.id == selectedId,
                        enabled = !busy,
                        onClick = { selectedId = profile.id }
                    )
                }

                Text(
                    status,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 4.dp)
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = {
                        pickMod.launch(arrayOf("application/zip", "application/octet-stream"))
                    }, enabled = !busy) {
                        Text(if (busy) "Работаю…" else "Установить мод")
                    }
                    OutlinedButton(
                        onClick = { showCreateDialog = true },
                        enabled = !busy && selectedId == "minecraft"
                    ) {
                        Text("Создать пак")
                    }
                }
                OutlinedButton(onClick = onOpenEditor, enabled = !busy) {
                    Text("Save-редактор (без root)")
                }
            }
        }

        if (showCreateDialog) {
            CreatePackDialog(
                onConfirm = { name, description -> createPack(name, description) },
                onDismiss = { showCreateDialog = false }
            )
        }
    }
}

@Composable
private fun GameCard(
    profile: GameProfile,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val borderColor = if (selected) MaterialTheme.colorScheme.primary else Color.LightGray
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(2.dp, borderColor, MaterialTheme.shapes.medium)
            .background(
                if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                else Color.Transparent,
                MaterialTheme.shapes.medium
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(profile.name, style = MaterialTheme.typography.titleMedium)
        Text("Типы модов: ${profile.modTypes}", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun CreatePackDialog(
    onConfirm: (String, String) -> Unit,
    onDismiss: () -> Unit
) {
    var name by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новый пак Minecraft") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Название") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Описание") }
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(name, description) },
                enabled = name.isNotBlank()
            ) { Text("Создать") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Отмена") }
        }
    )
}
