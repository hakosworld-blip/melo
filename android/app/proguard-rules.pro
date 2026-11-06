# Media3 / ExoPlayer
-dontwarn androidx.media3.**

# Lets R8 merge and inline more aggressively. Everything reachable by reflection is
# already pinned by the keep rules AGP, Room and Media3 ship.
-allowaccessmodification

# ---------------------------------------------------------------------------------------
# youtubedl-android runs yt-dlp through an embedded CPython and turns its JSON output into
# objects with Jackson. Both paths are reflective, so none of it may be renamed or removed.
# ---------------------------------------------------------------------------------------
-keep class com.yausername.** { *; }
-keep class com.fasterxml.jackson.** { *; }
-keep class org.apache.commons.io.** { *; }
-dontwarn com.fasterxml.jackson.**
-dontwarn org.apache.commons.io.**
-dontwarn org.slf4j.**
-keepattributes Signature,*Annotation*,InnerClasses,EnclosingMethod
