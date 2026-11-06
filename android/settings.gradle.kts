pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // youtubedl-android (the embedded CPython + yt-dlp extractor) is published here.
        maven("https://jitpack.io") {
            content { includeGroup("com.github.yausername.youtubedl-android") }
        }
    }
}

rootProject.name = "melo"
include(":app")
