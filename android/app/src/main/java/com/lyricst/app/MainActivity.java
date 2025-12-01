package com.lyricst.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private SpeechRecognizer speechRecognizer;
    private boolean isListening = false;
    
    @Override
    public void onStart() {
        super.onStart();
        
        // Mikrofon iznini kontrol et ve iste
        checkAndRequestMicrophonePermission();
        
        // AudioManager modunu ayarla - kesintisiz dinleme için (ChatGPT/Grok gibi)
        configureAudioManager();
        
        // WebView ayarlarını yapılandır
        configureWebView();
    }
    
    /**
     * AudioManager modunu ayarla - kesintisiz mikrofon erişimi için
     * ChatGPT/Grok gibi sistemlerde kullanılan yöntem
     */
    private void configureAudioManager() {
        try {
            AudioManager audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
            if (audioManager != null) {
                // MODE_IN_COMMUNICATION - kesintisiz iletişim modu
                // Bu mod mikrofonun sürekli açık kalmasını sağlar
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                // Speakerphone açık (opsiyonel - gerekirse kapatılabilir)
                // audioManager.setSpeakerphoneOn(true);
            }
        } catch (Exception e) {
            // Hata olursa devam et
        }
    }
    
    /**
     * Mikrofon iznini kontrol et ve iste
     */
    private void checkAndRequestMicrophonePermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
                != PackageManager.PERMISSION_GRANTED) {
            // İzin yoksa iste
            ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.RECORD_AUDIO},
                PERMISSION_REQUEST_CODE
            );
        }
    }
    
    /**
     * WebView ayarlarını yapılandır - JavaScript ve medya erişimi için
     */
    private void configureWebView() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // JavaScript bridge ekle - Native Speech Recognition için
            webView.getSettings().setJavaScriptEnabled(true);
            webView.addJavascriptInterface(new AndroidSpeechBridge(), "AndroidSpeechBridge");
            
            // WebChromeClient - mikrofon izinleri ve console logları için
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(PermissionRequest request) {
                    // Mikrofon izni isteği
                    if (request.getResources() != null) {
                        for (String resource : request.getResources()) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                                // Mikrofon izni verildiyse WebView'a bildir
                                if (ContextCompat.checkSelfPermission(MainActivity.this, 
                                        Manifest.permission.RECORD_AUDIO) 
                                        == PackageManager.PERMISSION_GRANTED) {
                                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                                    return;
                                } else {
                                    // İzin yoksa iste
                                    checkAndRequestMicrophonePermission();
                                    request.deny();
                                    return;
                                }
                            }
                        }
                    }
                    // Diğer izinler için varsayılan davranış
                    request.deny();
                }
                
                /**
                 * WebView console loglarını yakala ve Android Logcat'e yaz
                 * Bu sayede tüm console.log, console.error, console.warn mesajları görülebilir
                 * DETAYLI LOG FORMATI - Web'deki gibi
                 */
                @Override
                public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                    // Console mesajını Android Logcat'e yaz
                    String message = consoleMessage.message();
                    String sourceId = consoleMessage.sourceId();
                    int lineNumber = consoleMessage.lineNumber();
                    ConsoleMessage.MessageLevel messageLevel = consoleMessage.messageLevel();
                    
                    // Log tag'i - mesaj tipine göre
                    String tag = "LYRICST";
                    
                    // Özel log tag'leri - mesaj içeriğine göre
                    if (message.contains("[SPEECH]") || message.contains("[NATIVE SPEECH]")) {
                        tag = "LYRICST_SPEECH";
                    } else if (message.contains("[MATCHER]")) {
                        tag = "LYRICST_MATCHER";
                    } else if (message.contains("[PLAYER]")) {
                        tag = "LYRICST_PLAYER";
                    } else if (message.contains("[DUMMY]")) {
                        tag = "LYRICST_DUMMY";
                    } else if (message.contains("[AUDIO]")) {
                        tag = "LYRICST_AUDIO";
                    } else if (message.contains("[MOBİL") || message.contains("[ANDROID")) {
                        tag = "LYRICST_MOBILE";
                    } else {
                        tag = "LYRICST_WEBVIEW";
                    }
                    
                    // Timestamp ekle (ISO format)
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    final String timestamp = sdf.format(new java.util.Date());
                    
                    // Mesaj formatı: [timestamp] [sourceId:lineNumber] message
                    String formattedMessage = String.format("[%s] [%s:%d] %s", timestamp, sourceId, lineNumber, message);
                    
                    // Log seviyesine göre Android Log seviyesi seç
                    // ÖNEMLİ: Tüm logları Log.d ile yaz (filtreleme kolaylığı için)
                    // Ancak ERROR ve WARNING için özel tag'ler kullan
                    switch (messageLevel) {
                        case ERROR:
                            Log.e(tag, formattedMessage);
                            // Ayrıca ana tag'e de yaz (filtreleme için)
                            Log.e("LYRICST", formattedMessage);
                            break;
                        case WARNING:
                            Log.w(tag, formattedMessage);
                            // Ayrıca ana tag'e de yaz
                            Log.w("LYRICST", formattedMessage);
                            break;
                        case TIP:
                            Log.i(tag, formattedMessage);
                            break;
                        case LOG:
                        default:
                            // DETAYLI LOGLAR İÇİN - Her zaman Log.d kullan
                            Log.d(tag, formattedMessage);
                            // Önemli loglar için ana tag'e de yaz
                            if (message.contains("✅") || message.contains("❌") || message.contains("⚡") || 
                                message.contains("🎤") || message.contains("🔍") || message.contains("📱")) {
                                Log.d("LYRICST", formattedMessage);
                            }
                            break;
                    }
                    
                    // true döndür - mesaj işlendi
                    return true;
                }
            });
        }
    }
    
    /**
     * Native Android Speech Recognition başlat
     * KRİTİK: SpeechRecognizer'ı sadece bir kez oluştur ve yeniden kullan (mikrofon açılıp kapanmasını önlemek için)
     */
    private void startNativeSpeechRecognition() {
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        final String timestamp = sdf.format(new java.util.Date());
        
        Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔧 [NATIVE SPEECH] startNativeSpeechRecognition() çağrıldı", timestamp));
        Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔧 [NATIVE SPEECH] isListening=%s, speechRecognizer=%s", 
            timestamp, isListening, (speechRecognizer != null ? "var" : "null")));
        
        // SpeechRecognizer zaten varsa ve çalışıyorsa, restart etme
        if (speechRecognizer != null) {
            Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ⚠️ SpeechRecognizer zaten var, restart edilmiyor (mikrofon açılıp kapanmasını önlemek için)", timestamp));
            return;
        }
        
            Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔧 [NATIVE SPEECH] SpeechRecognizer.isRecognitionAvailable() kontrol ediliyor...", timestamp));
            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                Log.e("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ [NATIVE SPEECH] Speech Recognition kullanılamıyor!", timestamp));
                
                // JavaScript'e hata bildir
                WebView webViewError = getBridge().getWebView();
                if (webViewError != null) {
                    webViewError.post(() -> {
                        webViewError.evaluateJavascript(
                            String.format("console.error('[%s] [ERROR] ❌ [NATIVE SPEECH] Speech Recognition kullanılamıyor!'); if (window.onNativeSpeechError) window.onNativeSpeechError('Speech Recognition kullanılamıyor!');", timestamp),
                            null
                        );
                    });
                }
                return;
            }

            // SpeechRecognizer yoksa oluştur
            if (speechRecognizer == null) {
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔧 [NATIVE SPEECH] SpeechRecognizer.createSpeechRecognizer() çağrılıyor...", timestamp));
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ✅ [NATIVE SPEECH] SpeechRecognizer oluşturuldu: %s", timestamp, (speechRecognizer != null ? "başarılı" : "BAŞARISIZ")));
                
                if (speechRecognizer == null) {
                    Log.e("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ [NATIVE SPEECH] SpeechRecognizer oluşturulamadı!", timestamp));
                    
                    // JavaScript'e hata bildir
                    WebView webViewError = getBridge().getWebView();
                    if (webViewError != null) {
                        webViewError.post(() -> {
                            webViewError.evaluateJavascript(
                                String.format("console.error('[%s] [ERROR] ❌ [NATIVE SPEECH] SpeechRecognizer oluşturulamadı!'); if (window.onNativeSpeechError) window.onNativeSpeechError('SpeechRecognizer oluşturulamadı!');", timestamp),
                                null
                            );
                        });
                    }
                    return;
                }
            } else {
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ✅ [NATIVE SPEECH] SpeechRecognizer zaten var, yeniden oluşturulmuyor", timestamp));
            }
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle params) {
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    final String timestamp = sdf.format(new java.util.Date());
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ✅ [NATIVE SPEECH] Speech Recognition hazır - Dinlemeye başladı!", timestamp));
                    
                    // JavaScript'e bildir - Speech Recognition hazır
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.post(() -> {
                            webView.evaluateJavascript(
                                "if (window.onNativeSpeechReady) window.onNativeSpeechReady();",
                                null
                            );
                        });
                    }
                }

                @Override
                public void onBeginningOfSpeech() {
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    final String timestamp = sdf.format(new java.util.Date());
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🎤 [NATIVE SPEECH] Konuşma başladı - Ses algılanıyor!", timestamp));
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔍 [NATIVE SPEECH] onBeginningOfSpeech tetiklendi - onResults/onPartialResults bekleniyor...", timestamp));
                    
                    // JavaScript'e bildir - Konuşma başladı
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.post(() -> {
                            webView.evaluateJavascript(
                                String.format("console.log('[%s] [LOG] 🎤 [NATIVE SPEECH] Konuşma başladı - Ses algılanıyor!');", timestamp),
                                null
                            );
                        });
                    }
                }

                @Override
                public void onRmsChanged(float rmsdB) {
                    // Ses seviyesi değişti - mikrofon çalışıyor mu kontrol et
                    // Her 100 değişimde bir log (çok fazla log olmasın ama yeterince bilgi ver)
                    if (Math.random() < 0.01) { // %1 ihtimalle log
                        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                        sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                        final String timestamp = sdf.format(new java.util.Date());
                        Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔊 [NATIVE SPEECH] Ses seviyesi: %.2f dB (mikrofon çalışıyor!)", timestamp, rmsdB));
                        
                        // JavaScript'e bildir - Ses seviyesi değişti (sadece yüksek ses seviyelerinde)
                        if (rmsdB > 5.0) { // Yüksek ses seviyesi
                            WebView webViewRms = getBridge().getWebView();
                            if (webViewRms != null) {
                                webViewRms.post(() -> {
                                    webViewRms.evaluateJavascript(
                                        String.format("console.log('[%s] [LOG] 🔊 [NATIVE SPEECH] Ses seviyesi: %.2f dB (mikrofon çalışıyor!)');", timestamp, rmsdB),
                                        null
                                    );
                                });
                            }
                        }
                    }
                }

                @Override
                public void onBufferReceived(byte[] buffer) {
                    // Buffer alındı
                }

                @Override
                public void onEndOfSpeech() {
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    final String timestamp = sdf.format(new java.util.Date());
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🛑 [NATIVE SPEECH] Konuşma bitti - Sonuç bekleniyor...", timestamp));
                    
                    // JavaScript'e bildir - Konuşma bitti
                    WebView webViewEnd = getBridge().getWebView();
                    if (webViewEnd != null) {
                        webViewEnd.post(() -> {
                            webViewEnd.evaluateJavascript(
                                String.format("console.log('[%s] [LOG] 🛑 [NATIVE SPEECH] Konuşma bitti - Sonuç bekleniyor...');", timestamp),
                                null
                            );
                        });
                    }
                }

                @Override
                public void onError(int error) {
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    final String timestamp = sdf.format(new java.util.Date());
                    
                    String errorName = getErrorName(error);
                    Log.w("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ [NATIVE SPEECH] Speech Recognition hatası: %d (%s)", timestamp, error, errorName));
                    Log.w("LYRICST", "Speech Recognition hatası: " + error + " (" + errorName + ")");
                    
                    // ERROR_NO_MATCH (7) ve ERROR_SPEECH_TIMEOUT (6) normal durumlar - YENİ INTENT BAŞLAT
                    // Bu hatalar sürekli dinleme modunda normaldir - yeni intent başlat (sürekli dinleme için)
                    // JavaScript'e HATA GÖNDERME - bu normal durumlar
                    if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                        Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔄 [NATIVE SPEECH] ERROR_NO_MATCH/ERROR_SPEECH_TIMEOUT - Normal durum, yeni intent başlatılıyor (sürekli dinleme)...", timestamp));
                        // YENİ INTENT BAŞLAT - Sürekli dinleme için
                        if (isListening && speechRecognizer != null) {
                            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                                if (isListening && speechRecognizer != null) {
                                    try {
                                        Intent newIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "tr-TR");
                                        newIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 10);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 15000L);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 200L);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false);
                                        newIntent.putExtra("android.speech.extra.DICTATION_MODE", true);
                                        newIntent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
                                        speechRecognizer.startListening(newIntent);
                                        Log.d("LYRICST_SPEECH", "✅ Yeni intent başlatıldı (error sonrası - sürekli dinleme)");
                                    } catch (Exception e) {
                                        Log.e("LYRICST_SPEECH", "❌ Yeni intent başlatılamadı: " + e.getMessage());
                                    }
                                }
                            }, 100); // Çok kısa delay - hızlı sürekli dinleme
                        }
                        return; // JavaScript'e hata gönderme - normal durum
                    }
                    
                    // Diğer hatalar için JavaScript'e bildir
                    String errorMessage = "Speech Recognition hatası: " + error + " (" + errorName + ")";
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.post(() -> {
                            webView.evaluateJavascript(
                                String.format("console.error('[%s] [ERROR] ❌ [NATIVE SPEECH] Speech Recognition hatası: %d (%s)'); if (window.onNativeSpeechError) window.onNativeSpeechError('Speech Recognition hatası: %d (%s)');", 
                                    timestamp, error, errorName, error, errorName),
                                null
                            );
                        });
                    }
                    
                    // Kritik hatalar için restart (ERROR_RECOGNIZER_BUSY hariç) - SADECE GERÇEKTEN GEREKLİYSE
                    if (isListening && error != SpeechRecognizer.ERROR_RECOGNIZER_BUSY && error != SpeechRecognizer.ERROR_CLIENT) {
                        // SpeechRecognizer'ı destroy et ve yeniden oluştur (sadece kritik hatalarda)
                        if (speechRecognizer != null) {
                            try {
                                speechRecognizer.cancel();
                                speechRecognizer.destroy();
                                speechRecognizer = null;
                                Log.d("LYRICST_SPEECH", "⚠️ Kritik hata nedeniyle SpeechRecognizer destroy edildi, yeniden oluşturulacak");
                            } catch (Exception e) {
                                Log.e("LYRICST_SPEECH", "❌ SpeechRecognizer destroy edilemedi: " + e.getMessage());
                            }
                        }
                        
                        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                            if (isListening) {
                                startNativeSpeechRecognition();
                            }
                        }, 2000); // Uzun delay - kritik hatalar için
                    }
                }
                
                /**
                 * Error code'unu isme çevir
                 */
                private String getErrorName(int error) {
                    switch (error) {
                        case SpeechRecognizer.ERROR_AUDIO:
                            return "ERROR_AUDIO";
                        case SpeechRecognizer.ERROR_CLIENT:
                            return "ERROR_CLIENT";
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                            return "ERROR_INSUFFICIENT_PERMISSIONS";
                        case SpeechRecognizer.ERROR_NETWORK:
                            return "ERROR_NETWORK";
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                            return "ERROR_NETWORK_TIMEOUT";
                        case SpeechRecognizer.ERROR_NO_MATCH:
                            return "ERROR_NO_MATCH";
                        case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                            return "ERROR_RECOGNIZER_BUSY";
                        case SpeechRecognizer.ERROR_SERVER:
                            return "ERROR_SERVER";
                        case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                            return "ERROR_SPEECH_TIMEOUT";
                        default:
                            return "UNKNOWN_ERROR";
                    }
                }

                @Override
                public void onResults(Bundle results) {
                    // DETAYLI LOG - Web formatına uygun
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    final String timestamp = sdf.format(new java.util.Date());
                    
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ⚡⚡⚡ onResults TETİKLENDİ! ⚡⚡⚡", timestamp));
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    float[] confidenceScores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                    
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] Matches var mı: %s | Size: %d", 
                        timestamp, (matches != null), (matches != null ? matches.size() : 0)));
                    
                    // JavaScript'e bildir - onResults tetiklendi
                    WebView webViewResults = getBridge().getWebView();
                    if (webViewResults != null) {
                        webViewResults.post(() -> {
                            webViewResults.evaluateJavascript(
                                String.format("console.log('[%s] [LOG] ⚡⚡⚡ onResults TETİKLENDİ! ⚡⚡⚡');", timestamp),
                                null
                            );
                        });
                    }
                    
                    if (matches != null && matches.size() > 0) {
                        String transcript = matches.get(0);
                        float confidence = confidenceScores != null && confidenceScores.length > 0 
                            ? confidenceScores[0] 
                            : 0.8f;
                        
                        // DETAYLI LOG - Web formatına uygun
                        Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🎤 [SPEECH] Kelime algılandı: \"%s\" | Confidence: %.2f | Type: FINAL | Original: \"%s\" | Lang: tr-TR", 
                            timestamp, transcript, confidence, transcript));
                        
                        // JavaScript'e gönder
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            String escapedTranscript = transcript.replace("'", "\\'").replace("\n", " ").replace("\r", " ");
                            String js = String.format(
                                "if (window.onNativeSpeechResult) { console.log('[%s] [LOG] 🎤 [SPEECH] Kelime algılandı: \"%s\" | Confidence: %.2f | Type: FINAL | Original: \"%s\" | Lang: tr-TR'); window.onNativeSpeechResult('%s', %f); } else { console.error('[%s] [LOG] ❌ [ANDROID->JS] onNativeSpeechResult callback yok!'); }",
                                timestamp, escapedTranscript, confidence, escapedTranscript,
                                escapedTranscript, confidence,
                                timestamp
                            );
                            Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] JavaScript kodu hazırlandı", timestamp));
                            webView.post(() -> {
                                webView.evaluateJavascript(js, null);
                                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] JavaScript kodu çalıştırıldı", timestamp));
                            });
                        } else {
                            Log.e("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ WebView bulunamadı!", timestamp));
                        }
                    } else {
                        Log.w("LYRICST_SPEECH", String.format("[%s] [LOG] ⚠️ onResults tetiklendi ama matches boş!", timestamp));
                    }
                    
                    // Sürekli dinleme için yeni intent başlat - RESTART ETME (SpeechRecognizer zaten var)
                    if (isListening && speechRecognizer != null) {
                        Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔄 Final result alındı, yeni intent başlatılıyor (restart yok)...", timestamp));
                        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                            if (isListening && speechRecognizer != null) {
                                try {
                                    Intent newIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                                    newIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                                    newIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "tr-TR");
                                    newIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                                    newIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                                    newIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 5000L);
                                    newIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L);
                                    newIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1500L);
                                    speechRecognizer.startListening(newIntent);
                                    Log.d("LYRICST_SPEECH", "✅ Yeni intent başlatıldı (final result'tan sonra - restart yok)");
                                } catch (Exception e) {
                                    Log.e("LYRICST_SPEECH", "❌ Yeni intent başlatılamadı: " + e.getMessage());
                                }
                            }
                        }, 200); // Kısa delay - hızlı sürekli dinleme için
                    }
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    // DETAYLI LOG - Web formatına uygun
                    java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                    final String timestamp = sdf.format(new java.util.Date());
                    
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ⚡⚡⚡ onPartialResults TETİKLENDİ! ⚡⚡⚡", timestamp));
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    float[] confidenceScores = partialResults.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                    
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] Partial matches var mı: %s | Size: %d", 
                        timestamp, (matches != null), (matches != null ? matches.size() : 0)));
                    
                    // JavaScript'e bildir - onPartialResults tetiklendi
                    WebView webViewPartial = getBridge().getWebView();
                    if (webViewPartial != null) {
                        webViewPartial.post(() -> {
                            webViewPartial.evaluateJavascript(
                                String.format("console.log('[%s] [LOG] ⚡⚡⚡ onPartialResults TETİKLENDİ! ⚡⚡⚡');", timestamp),
                                null
                            );
                        });
                    }
                    
                    if (matches != null && matches.size() > 0) {
                        String transcript = matches.get(0);
                        float confidence = confidenceScores != null && confidenceScores.length > 0 
                            ? confidenceScores[0] 
                            : 0.7f;
                        
                        // DETAYLI LOG - Web formatına uygun
                        Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🎤 [SPEECH] Kelime algılandı: \"%s\" | Confidence: %.2f | Type: INTERIM | Original: \"%s\" | Lang: tr-TR", 
                            timestamp, transcript, confidence, transcript));
                        
                        // JavaScript'e gönder (interim result)
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            String escapedTranscript = transcript.replace("'", "\\'").replace("\n", " ").replace("\r", " ");
                            String js = String.format(
                                "if (window.onNativeSpeechResult) { console.log('[%s] [LOG] 🎤 [SPEECH] Kelime algılandı: \"%s\" | Confidence: %.2f | Type: INTERIM | Original: \"%s\" | Lang: tr-TR'); window.onNativeSpeechResult('%s', %f); } else { console.error('[%s] [LOG] ❌ [ANDROID->JS] onNativeSpeechResult callback yok!'); }",
                                timestamp, escapedTranscript, confidence, escapedTranscript,
                                escapedTranscript, confidence,
                                timestamp
                            );
                            Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] JavaScript kodu (PARTIAL) hazırlandı", timestamp));
                            webView.post(() -> {
                                webView.evaluateJavascript(js, null);
                                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] JavaScript kodu (PARTIAL) çalıştırıldı", timestamp));
                            });
                        } else {
                            Log.e("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ WebView bulunamadı (PARTIAL)!", timestamp));
                        }
                        
                        // KRİTİK: Partial result'tan sonra RESTART ETME (mikrofon açılıp kapanmasını önlemek için)
                        // Partial results sürekli gelir, her seferinde restart etmek mikrofonu açıp kapatır
                        // Bu yüzden partial results'tan sonra restart ETMİYORUZ - sadece final results'tan sonra restart ediyoruz
                        // if (isListening && transcript != null && transcript.trim().length() > 0) {
                        //     Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔄 Partial result alındı - restart edilmiyor (mikrofon açılıp kapanmasını önlemek için)", timestamp));
                        // }
                    } else {
                        Log.w("LYRICST_SPEECH", String.format("[%s] [LOG] ⚠️ onPartialResults tetiklendi ama matches boş!", timestamp));
                    }
                }

                @Override
                public void onEvent(int eventType, Bundle params) {
                    // Event alındı
                }
            });
            
            // SpeechRecognizer oluşturuldu, şimdi dinlemeyi başlat
            if (isListening && speechRecognizer != null) {
                java.text.SimpleDateFormat sdfIntent = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                sdfIntent.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                final String timestampIntent = sdfIntent.format(new java.util.Date());
                
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔧 [NATIVE SPEECH] Intent oluşturuluyor... isListening=%s, speechRecognizer=%s", 
                    timestampIntent, isListening, (speechRecognizer != null ? "var" : "null")));
                
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ✅ [NATIVE SPEECH] Intent oluşturuldu: %s", timestampIntent, RecognizerIntent.ACTION_RECOGNIZE_SPEECH));
                
                // KRİTİK: Intent ayarları - Web Speech API gibi davranması için
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "tr-TR");
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true); // Partial results al
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 10); // Daha fazla alternatif
                
                // SÜREKLI DİNLEME İÇİN KRİTİK AYARLAR - Web Speech API gibi
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 15000L); // 15 saniye sessizlik
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 10000L); // 10 saniye muhtemel sessizlik
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 200L); // Minimum 0.2 saniye konuşma (hassas)
                
                // ONLINE kullan - offline çalışmıyor
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false);
                
                // Dictation mode - sürekli dinleme için
                intent.putExtra("android.speech.extra.DICTATION_MODE", true);
                
                // Çağıran paketi belirt
                intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
                
                // KRİTİK: Web Speech API gibi davranması için - alternatif sonuçlar
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 10);
                
                // KRİTİK: Partial results'ı zorla - her kelime için partial result al
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            
                try {
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 📱 [NATIVE SPEECH] startListening() çağrılıyor... isListening=%s, speechRecognizer=%s", 
                        timestampIntent, isListening, (speechRecognizer != null ? "var" : "null")));
                    speechRecognizer.startListening(intent);
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ✅ [NATIVE SPEECH] startListening() çağrıldı - onReadyForSpeech bekleniyor...", timestampIntent));
                    
                    // 3 saniye sonra onReadyForSpeech tetiklenmediyse hata bildir
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        // onReadyForSpeech tetiklenmediyse JavaScript'e hata bildir
                        // (Bu kontrolü onReadyForSpeech içinde bir flag ile yapabiliriz, ama şimdilik basit tutuyoruz)
                    }, 3000);
                } catch (Exception e) {
                    Log.e("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ [NATIVE SPEECH] Speech Recognition başlatılamadı: %s", timestampIntent, e.getMessage()));
                    
                    // JavaScript'e hata bildir
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.post(() -> {
                            webView.evaluateJavascript(
                                "if (window.onNativeSpeechError) window.onNativeSpeechError('Speech Recognition başlatılamadı: " + e.getMessage() + "');",
                                null
                            );
                        });
                    }
                }
        }
    }
    
    /**
     * Native Android Speech Recognition durdur
     */
    private void stopNativeSpeechRecognition() {
        isListening = false;
        if (speechRecognizer != null) {
            speechRecognizer.stopListening();
            speechRecognizer.cancel();
            Log.d("LYRICST", "Native Speech Recognition durduruldu");
        }
    }
    
    /**
     * JavaScript Bridge - Native Speech Recognition için
     */
    public class AndroidSpeechBridge {
        @JavascriptInterface
        public void startListening() {
            runOnUiThread(() -> {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                final String timestamp = sdf.format(new java.util.Date());
                
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 📱 [NATIVE SPEECH] startListening() çağrıldı (JavaScript'ten)", timestamp));
                
                // KRİTİK: Mikrofon izni kontrolü
                boolean hasPermission = ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) 
                        == PackageManager.PERMISSION_GRANTED;
                
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🔍 [NATIVE SPEECH] Mikrofon izni kontrolü: %s", timestamp, hasPermission));
                
                if (hasPermission) {
                    isListening = true;
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] ✅ [NATIVE SPEECH] Mikrofon izni var, recognition başlatılıyor...", timestamp));
                    Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 📱 [NATIVE SPEECH] isListening=%s, speechRecognizer=%s", 
                        timestamp, isListening, (speechRecognizer != null ? "var" : "null")));
                    
                    // KRİTİK: SpeechRecognizer'ın mikrofon erişimini kontrol et
                    if (!SpeechRecognizer.isRecognitionAvailable(MainActivity.this)) {
                        Log.e("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ [NATIVE SPEECH] Speech Recognition kullanılamıyor!", timestamp));
                        return;
                    }
                    
                    startNativeSpeechRecognition();
                } else {
                    Log.e("LYRICST_SPEECH", String.format("[%s] [LOG] ❌ [NATIVE SPEECH] Mikrofon izni yok! İzin isteniyor...", timestamp));
                    checkAndRequestMicrophonePermission();
                }
            });
        }
        
        @JavascriptInterface
        public void stopListening() {
            runOnUiThread(() -> {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                final String timestamp = sdf.format(new java.util.Date());
                
                Log.d("LYRICST_SPEECH", String.format("[%s] [LOG] 🛑 [NATIVE SPEECH] stopListening() çağrıldı", timestamp));
                stopNativeSpeechRecognition();
            });
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }
    
    /**
     * İzin sonucunu işle
     */
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // İzin verildi - WebView'ı yenile
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.reload();
                }
            }
        }
    }
}
