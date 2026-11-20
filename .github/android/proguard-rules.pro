# Karyeram Accademy — mağaza (store) yığımı üçün əlavə R8/ProGuard qaydaları.
# Workflow bu faylı prebuild-dən sonra yaradılan apps/app/android/app/proguard-rules.pro-ya ƏLAVƏ edir
# (RN/Expo-nun defolt qaydaları saxlanılır). Yalnız build_type=store üçün; pilot-da minify söndürülür.

# --- @livekit/react-native-webrtc (org.webrtc JNI +反射) ---
-keep class org.webrtc.** { *; }
-keep class com.livekit.reactnative.** { *; }
-keep class com.oney.WebRTCModule.** { *; }
-dontwarn org.webrtc.**
-dontwarn com.livekit.reactnative.**

# --- react-native-screens (Fragment/view reflection) ---
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# --- Hermes (JNI sərhədi) ---
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.bridge.** { *; }

# --- expo-gl / three (OpenGL JNI çağırışları; three.js JS tərəfdədir, Java sinfi yoxdur) ---
-keep class expo.modules.gl.** { *; }
-keep class expo.modules.** { *; }
-dontwarn expo.modules.gl.**

# --- RN view manager / module reflection (Expo modulları ad ilə tapılır) ---
-keep @com.facebook.react.bridge.ReactModule class * { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod <methods>; }