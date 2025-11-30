package com.lyricst.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    private static final int PERMISSION_REQUEST_CODE = 1001;
    
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
            // WebChromeClient - mikrofon izinleri için
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
            });
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
