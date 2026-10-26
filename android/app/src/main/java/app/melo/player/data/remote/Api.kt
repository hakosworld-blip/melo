package app.melo.player.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * Shared HTTP plumbing for every provider.
 *
 * melo talks to the same public endpoints the desktop app used, but on-device:
 * YouTube Music search/streams through InnerTube, SoundCloud through api-v2,
 * metadata through iTunes/Deezer, lyrics through LRCLIB and NetEase.
 */
object Api {

    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
    }

    const val WEB_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

    /** Client identity that InnerTube will hand out audio URLs for. */
    const val ANDROID_VR_UA =
        "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"

    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .followRedirects(true)
        .build()

    val streamingClient: OkHttpClient = client.newBuilder()
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

    suspend fun get(
        url: String,
        headers: Map<String, String> = emptyMap(),
        userAgent: String = WEB_UA,
    ): String? = withContext(Dispatchers.IO) {
        runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .apply { headers.forEach { (k, v) -> header(k, v) } }
                .build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) null else res.body?.string()
            }
        }.getOrNull()
    }

    suspend fun getJson(
        url: String,
        headers: Map<String, String> = emptyMap(),
        userAgent: String = WEB_UA,
    ): JsonElement? = get(url, headers, userAgent)?.let { parse(it) }

    suspend fun postJson(
        url: String,
        body: String,
        headers: Map<String, String> = emptyMap(),
        userAgent: String = WEB_UA,
    ): JsonElement? = withContext(Dispatchers.IO) {
        runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .header("Content-Type", "application/json")
                .apply { headers.forEach { (k, v) -> header(k, v) } }
                .post(body.toRequestBody(JSON_MEDIA))
                .build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) null else res.body?.string()?.let { parse(it) }
            }
        }.getOrNull()
    }

    fun parse(raw: String): JsonElement? = runCatching { json.parseToJsonElement(raw) }.getOrNull()
}

/* ---------- forgiving JSON accessors for provider payloads ---------- */

fun JsonElement?.obj(key: String): JsonObject? = (this as? JsonObject)?.get(key) as? JsonObject

fun JsonElement?.arr(key: String): JsonArray? = (this as? JsonObject)?.get(key) as? JsonArray

fun JsonElement?.str(key: String): String? =
    ((this as? JsonObject)?.get(key) as? JsonPrimitive)
        ?.takeIf { it.isString }?.content

fun JsonElement?.num(key: String): Long? =
    ((this as? JsonObject)?.get(key) as? JsonPrimitive)?.content?.toLongOrNull()

fun JsonElement?.dbl(key: String): Double? =
    ((this as? JsonObject)?.get(key) as? JsonPrimitive)?.content?.toDoubleOrNull()

fun JsonElement?.bool(key: String): Boolean =
    ((this as? JsonObject)?.get(key) as? JsonPrimitive)
        ?.let { it.content.equals("true", true) || it.content == "1" } ?: false

/** Text of `{ runs: [{ text: "..." }] }` or a plain string, used all over InnerTube. */
fun JsonElement?.runsText(): String {
    val o = this as? JsonObject ?: (this as? JsonPrimitive)?.let { return it.content } ?: return ""
    (o["simpleText"] as? JsonPrimitive)?.let { return it.content }
    val runs = o["runs"] as? JsonArray ?: return ""
    return runs.joinToString("") { r -> r.str("text").orEmpty() }
}

/** Follows keys only through objects. */
fun JsonElement?.at(vararg keys: String): JsonElement? {
    var cur: JsonElement? = this
    for (k in keys) {
        cur = (cur as? JsonObject)?.get(k) ?: return null
    }
    return cur
}

/**
 * Depth-first collection of every object carrying [name] as a key.
 * InnerTube reshuffles wrapper layers between queries, so searching for the renderer
 * by name is far more stable than hardcoding a path.
 */
fun JsonElement?.collect(name: String): List<JsonObject> {
    val out = mutableListOf<JsonObject>()
    fun walk(el: JsonElement?) {
        when (el) {
            null -> return
            is JsonObject -> {
                (el[name] as? JsonObject)?.let { out += it }
                el.values.forEach { walk(it) }
            }
            is JsonArray -> el.forEach { walk(it) }
            else -> Unit
        }
    }
    walk(this)
    return out
}

fun JsonArray.objects(): List<JsonObject> = mapNotNull { it as? JsonObject }

fun JsonElement?.asObjects(): List<JsonObject> = (this as? JsonArray)?.objects() ?: emptyList()
