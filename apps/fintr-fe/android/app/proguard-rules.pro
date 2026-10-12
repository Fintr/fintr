# Capacitor, its plugins, and RevenueCat ship consumer rules in their AARs.
# Only rules for code without bundled rules belong here.

# Readable release stack traces; Play Console de-obfuscates with the mapping in the AAB.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# FintrAppearanceBridge is exposed to JS via addJavascriptInterface.
-keepclassmembers class com.fintr.app.FintrAppearanceBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# MediaPipe (@capgo/capacitor-llm) ships no consumer rules and resolves Java
# classes, fields, and callbacks by name from native code.
-keep class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.**
