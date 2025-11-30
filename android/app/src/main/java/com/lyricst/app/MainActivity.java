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
                 */
                @Override
                public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                    // Console mesajını Android Logcat'e yaz
                    String message = consoleMessage.message();
                    String sourceId = consoleMessage.sourceId();
                    int lineNumber = consoleMessage.lineNumber();
                    ConsoleMessage.MessageLevel messageLevel = consoleMessage.messageLevel();
                    
                    // Log tag'i
                    String tag = "LYRICST_WEBVIEW";
                    
                    // Mesaj formatı: [sourceId:lineNumber] message
                    String formattedMessage = String.format("[%s:%d] %s", sourceId, lineNumber, message);
                    
                    // Log seviyesine göre Android Log seviyesi seç
                    switch (messageLevel) {
                        case ERROR:
                            Log.e(tag, formattedMessage);
                            break;
                        case WARNING:
                            Log.w(tag, formattedMessage);
                            break;
                        case TIP:
                            Log.i(tag, formattedMessage);
                            break;
                        case LOG:
                        default:
                            Log.d(tag, formattedMessage);
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
     */
    private void startNativeSpeechRecognition() {
        if (speechRecognizer == null) {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                Log.e("LYRICST", "Speech Recognition kullanılamıyor!");
                return;
            }
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle params) {
                    Log.d("LYRICST", "Speech Recognition hazır");
                }

                @Override
                public void onBeginningOfSpeech() {
                    Log.d("LYRICST", "Konuşma başladı");
                }

                @Override
                public void onRmsChanged(float rmsdB) {
                    // Ses seviyesi değişti
                }

                @Override
                public void onBufferReceived(byte[] buffer) {
                    // Buffer alındı
                }

                @Override
                public void onEndOfSpeech() {
                    Log.d("LYRICST", "Konuşma bitti");
                }

                @Override
                public void onError(int error) {
                    Log.e("LYRICST", "Speech Recognition hatası: " + error);
                    String errorMessage = "Speech Recognition hatası: " + error;
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        webView.post(() -> {
                            webView.evaluateJavascript(
                                "if (window.onNativeSpeechError) window.onNativeSpeechError('" + errorMessage + "');",
                                null
                            );
                        });
                    }
                    // Hata olursa yeniden başlat (sürekli dinleme için)
                    if (isListening) {
                        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                            startNativeSpeechRecognition();
                        }, 1000);
                    }
                }

                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    float[] confidenceScores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                    
                    if (matches != null && matches.size() > 0) {
                        String transcript = matches.get(0);
                        float confidence = confidenceScores != null && confidenceScores.length > 0 
                            ? confidenceScores[0] 
                            : 0.8f;
                        
                        Log.d("LYRICST", "Kelime algılandı: " + transcript + " | Confidence: " + confidence);
                        
                        // JavaScript'e gönder
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            webView.post(() -> {
                                String js = String.format(
                                    "if (window.onNativeSpeechResult) window.onNativeSpeechResult('%s', %f);",
                                    transcript.replace("'", "\\'").replace("\n", " ").replace("\r", " "),
                                    confidence
                                );
                                webView.evaluateJavascript(js, null);
                            });
                        }
                    }
                    
                    // Sürekli dinleme için yeniden başlat
                    if (isListening) {
                        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                            startNativeSpeechRecognition();
                        }, 100);
                    }
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    float[] confidenceScores = partialResults.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                    
                    if (matches != null && matches.size() > 0) {
                        String transcript = matches.get(0);
                        float confidence = confidenceScores != null && confidenceScores.length > 0 
                            ? confidenceScores[0] 
                            : 0.7f;
                        
                        Log.d("LYRICST", "Geçici sonuç: " + transcript + " | Confidence: " + confidence);
                        
                        // JavaScript'e gönder (interim result)
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            webView.post(() -> {
                                String js = String.format(
                                    "if (window.onNativeSpeechResult) window.onNativeSpeechResult('%s', %f);",
                                    transcript.replace("'", "\\'").replace("\n", " ").replace("\r", " "),
                                    confidence
                                );
                                webView.evaluateJavascript(js, null);
                            });
                        }
                    }
                }

                @Override
                public void onEvent(int eventType, Bundle params) {
                    // Event alındı
                }
            });
        }
        
        if (isListening && speechRecognizer != null) {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "tr-TR");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            
            try {
                speechRecognizer.startListening(intent);
                Log.d("LYRICST", "Native Speech Recognition başlatıldı");
            } catch (Exception e) {
                Log.e("LYRICST", "Speech Recognition başlatılamadı: " + e.getMessage());
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
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) 
                        == PackageManager.PERMISSION_GRANTED) {
                    isListening = true;
                    startNativeSpeechRecognition();
                } else {
                    Log.e("LYRICST", "Mikrofon izni yok!");
                }
            });
        }
        
        @JavascriptInterface
        public void stopListening() {
            runOnUiThread(() -> {
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
