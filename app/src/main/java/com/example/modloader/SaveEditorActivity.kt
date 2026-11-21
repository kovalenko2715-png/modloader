package com.example.modloader

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class SaveEditorActivity : ComponentActivity() {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + job)

    private var fileUri by mutableStateOf<Uri?>(null)
    private var fileName by mutableStateOf("Файл не выбран")
    private var data by mutableStateOf<ByteArray?>(null)
    private var searchType by mutableStateOf(SaveEditor.SearchType.INT32)
    private var query by mutableStateOf("")
    private var newValue by mutableStateOf("")
    private var matches by mutableStateOf<List<SaveEditor.Match>>(emptyList())
    private var selected by mutableStateOf<Set<Int>>(emptySet())
    private var status by mutableStateOf("Выберите файл сохранения игры (через «…»)")
    private var busy by mutableStateOf(false)

    private val pickSave = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? -> uri?.let { load(it) } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                SaveEditorScreen()
            }
        }
    }

    private fun load(uri: Uri) {
        if (busy) return
        busy = true
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    contentResolver.openInputStream(uri)?.use { it.readBytes() }
                }.getOrNull()
            }
            busy = false
            if (result == null) {
                status = "Не удалось прочитать файл"
                return@launch
            }
            fileUri = uri
            data = result
            fileName = queryFileName(uri)
            matches = emptyList()
            selected = emptySet()
            status = "Файл загружен: ${
                String.format("%.2f", result.size / 1024f)
            } КБ — введите текущее значение и нажмите «Найти»"
        }
    }

    private fun doSearch() {
        val current = data ?: return
        if (busy) return
        busy = true
        scope.launch {
            val found = withContext(Dispatchers.Default) {
                SaveEditor.search(current, query.trim(), searchType)
            }
            busy = false
            matches = found
            selected = emptySet()
            status = if (found.isEmpty()) {
                "Совпадений не найдено — измените значение в игре и поищите заново"
            } else {
                "Найдено ${found.size} — тапните нужные, затем введите новое значение"
            }
        }
    }

    private fun doReplace() {
        val current = data ?: return
        if (busy || selected.isEmpty()) return
        busy = true
        scope.launch {
            val result = withContext(Dispatchers.Default) {
                SaveEditor.replace(current, selected.toList(), newValue.trim(), searchType)
            }
            result.fold(
                onSuccess = { updated ->
                    val backupOk = makeBackup(current)
                    val uri = fileUri
                    val written = if (uri == null) false else withContext(Dispatchers.IO) {
                        runCatching {
                            contentResolver.openOutputStream(uri)
                                ?.use { it.write(updated) } == true
                        }.getOrDefault(false)
                    }
                    busy = false
                    if (written) {
                        data = updated
                        status = "Заменено позиций: ${selected.size}" +
                            if (backupOk) " (бэкап сохранён в кэше приложения)" else ""
                        matches = emptyList()
                        selected = emptySet()
                    } else {
                        status = "Не удалось записать файл — доступ только для чтения?"
                    }
                },
                onFailure = { e ->
                    busy = false
                    status = "Ошибка: ${e.message}"
                }
            )
        }
    }

    private fun makeBackup(original: ByteArray): Boolean {
        return runCatching {
            val backup = File(cacheDir, "backup_${fileName.ifBlank { "save" }}")
            if (!backup.exists()) backup.writeBytes(original)
            true
        }.getOrDefault(false)
    }

    private fun queryFileName(uri: Uri): String {
        return runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull() ?: "save"
    }

    @Composable
    private fun SaveEditorScreen() {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Save-редактор", style = MaterialTheme.typography.headlineSmall)
            Text("Для оффлайн-игр: поиск и замена значений в файлах сохранений. Без root.", style = MaterialTheme.typography.bodySmall)

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = { pickSave.launch(arrayOf("*/*")) }, enabled = !busy) {
                    Text(if (fileUri == null) "Выбрать сейв…" else "Другой файл…")
                }
            }

            Text(fileName, style = MaterialTheme.typography.titleSmall)
            Text(status, style = MaterialTheme.typography.bodyMedium)

            if (data != null) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text("Текущее значение (например, монеты)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SaveEditor.SearchType.entries.forEach { type ->
                        OutlinedButton(
                            onClick = { searchType = type; matches = emptyList(); selected = emptySet() },
                            enabled = !busy,
                            colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
                                contentColor = if (searchType == type)
                                    MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurface
                            )
                        ) {
                            Text(
                                type.label.substringBefore(" ("),
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
                Button(onClick = { doSearch() }, enabled = !busy && query.isNotBlank()) {
                    Text(if (busy) "Ищу…" else "Найти")
                }

                if (matches.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 260.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        matches.forEach { match ->
                            Text(
                                text = (if (match.offset in selected) "✓ " else "• ") + match.label,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { toggle(match.offset) }
                                    .padding(vertical = 6.dp, horizontal = 4.dp)
                            )
                        }
                    }

                    OutlinedTextField(
                        value = newValue,
                        onValueChange = { newValue = it },
                        label = { Text("Новое значение") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = { doReplace() },
                            enabled = !busy && selected.isNotEmpty() && newValue.isNotBlank()
                        ) {
                            Text("Заменить выбранные (${selected.size})")
                        }
                        OutlinedButton(
                            onClick = { selected = matches.map { it.offset }.toSet() },
                            enabled = !busy
                        ) { Text("Выбрать все") }
                    }
                }
            }
        }
    }

    private fun toggle(offset: Int) {
        selected = if (offset in selected) selected - offset else selected + offset
    }
}
