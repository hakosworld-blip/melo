# Media3 / ExoPlayer
-dontwarn androidx.media3.**

# Lets R8 merge and inline more aggressively. Everything reachable by reflection is
# already pinned by the keep rules AGP, Room and Media3 ship.
-allowaccessmodification
