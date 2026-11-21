package com.example.modloader

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

object SaveEditor {

    enum class SearchType(val label: String) {
        INT16("Int16 (2 байта)"),
        INT32("Int32 (4 байта)"),
        FLOAT32("Float (дробное)"),
        TEXT("Текст")
    }

    data class Match(val offset: Int, val label: String)

    const val MAX_MATCHES = 200

    fun search(data: ByteArray, query: String, type: SearchType): List<Match> {
        if (query.isBlank()) return emptyList()
        return when (type) {
            SearchType.INT16 -> searchNumeric(data, query.toShortOrNull(), 2, type)
            SearchType.INT32 -> searchNumeric(data, query.toIntOrNull(), 4, type)
            SearchType.FLOAT32 -> searchFloat(data, query.toFloatOrNull(), type)
            SearchType.TEXT -> searchText(data, query)
        }
    }

    fun replace(data: ByteArray, offsets: List<Int>, query: String, type: SearchType): Result<ByteArray> {
        val result = data.copyOf()
        return when (type) {
            SearchType.INT16 -> replaceNumeric(result, offsets, query.toShortOrNull()?.toLong(), 2)
            SearchType.INT32 -> replaceNumeric(result, offsets, query.toIntOrNull()?.toLong(), 4)
            SearchType.FLOAT32 -> replaceFloat(result, offsets, query.toFloatOrNull())
            SearchType.TEXT -> Result.failure(IllegalArgumentException("Замена текста недоступна, используйте числа"))
        }
    }

    private fun searchNumeric(
        data: ByteArray,
        value: Number?,
        width: Int,
        type: SearchType
    ): List<Match> {
        if (value == null || data.size < width) return emptyList()
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        val matches = mutableListOf<Match>()
        val lastOffset = data.size - width
        for (off in 0..lastOffset) {
            val matched = when (type) {
                SearchType.INT16 -> buf.getShort(off) == value.toShort()
                SearchType.INT32 -> buf.getInt(off) == value.toInt()
                else -> false
            }
            if (matched) {
                matches += Match(off, "offset 0x${off.toString(16)} = ${value}")
                if (matches.size >= MAX_MATCHES) break
            }
        }
        return matches
    }

    private fun searchFloat(data: ByteArray, value: Float?, type: SearchType): List<Match> {
        if (value == null || data.size < 4) return emptyList()
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        val matches = mutableListOf<Match>()
        for (off in 0..data.size - 4) {
            if (buf.getFloat(off) == value) {
                matches += Match(off, "offset 0x${off.toString(16)} = $value")
                if (matches.size >= MAX_MATCHES) break
            }
        }
        return matches
    }

    private fun searchText(data: ByteArray, query: String): List<Match> {
        val needle = query.encodeToByteArray()
        if (needle.isEmpty() || data.size < needle.size) return emptyList()
        val matches = mutableListOf<Match>()
        var index = indexOf(data, needle, 0)
        while (index >= 0 && matches.size < MAX_MATCHES) {
            matches += Match(index, "offset 0x${index.toString(16)} — строка \"$query\"")
            index = indexOf(data, needle, index + 1)
        }
        return matches
    }

    private fun indexOf(data: ByteArray, needle: ByteArray, from: Int): Int {
        if (from + needle.size > data.size) return -1
        var i = from
        outer@ while (i + needle.size <= data.size) {
            for (j in needle.indices) {
                if (data[i + j] != needle[j]) {
                    i++
                    continue@outer
                }
            }
            return i
        }
        return -1
    }

    private fun replaceNumeric(
        result: ByteArray,
        offsets: List<Int>,
        value: Long?,
        width: Int
    ): Result<ByteArray> {
        if (value == null) {
            return Result.failure(IllegalArgumentException("Некорректное число"))
        }
        if (width == 2 && (value < Short.MIN_VALUE || value > Short.MAX_VALUE)) {
            return Result.failure(IllegalArgumentException("Не помещается в Int16"))
        }
        if (width == 4 && (value < Int.MIN_VALUE || value > Int.MAX_VALUE)) {
            return Result.failure(IllegalArgumentException("Не помещается в Int32"))
        }
        val buf = ByteBuffer.wrap(result).order(ByteOrder.LITTLE_ENDIAN)
        for (off in offsets) {
            if (off < 0 || off + width > result.size) continue
            if (width == 2) buf.putShort(off, value.toShort()) else buf.putInt(off, value.toInt())
        }
        return Result.success(result)
    }

    private fun replaceFloat(
        result: ByteArray,
        offsets: List<Int>,
        value: Float?
    ): Result<ByteArray> {
        if (value == null) {
            return Result.failure(IllegalArgumentException("Некорректное число"))
        }
        val buf = ByteBuffer.wrap(result).order(ByteOrder.LITTLE_ENDIAN)
        for (off in offsets) {
            if (off < 0 || off + 4 > result.size) continue
            buf.putFloat(off, value)
        }
        return Result.success(result)
    }

    fun bytesToDisplay(data: ByteArray, limit: Int = 16): String {
        val out = ByteArrayOutputStream()
        for (byte in data.take(limit)) out.write(byte.toInt())
        return out.toByteArray().joinToString(" ") { String.format("%02x", it) }
    }
}
