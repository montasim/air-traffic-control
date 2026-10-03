package dev.montasim.airtrafficcontrol;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private Insets cutout = Insets.NONE;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The game draws edge to edge, including beside the camera cutout. Android 15+ does this by default;
        // older versions fit the window inside the cutout unless told otherwise, leaving a band on that edge.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        // Capacitor's inset handling is disabled (capacitor.config.ts) because it pads the WebView on older
        // WebViews. Instead nothing is padded and the cutout reaches the page as --safe-area-inset-* values,
        // which the layout uses to keep the HUD and menus clear of the camera.
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            publishSafeArea();
            return insets;
        });
        // Page reloads start without the injected values.
        getBridge().addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    publishSafeArea();
                }
            }
        );
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Returning from another app, the notification shade, or a dialog can restore the bars.
        if (hasFocus) hideSystemBars();
    }

    /**
     * The whole app stays immersive so the game never resizes when play starts or pauses.
     * An edge swipe shows the bars over the game briefly; they hide again on their own.
     */
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    /** Only the cutout matters: the system bars are hidden and appear over the game when revealed. */
    private void publishSafeArea() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return;
        float density = getResources().getDisplayMetrics().density;
        String script = String.format(
            Locale.US,
            "(()=>{const s=document.documentElement.style;" +
            "s.setProperty('--safe-area-inset-top','%.1fpx');s.setProperty('--safe-area-inset-right','%.1fpx');" +
            "s.setProperty('--safe-area-inset-bottom','%.1fpx');s.setProperty('--safe-area-inset-left','%.1fpx');})()",
            cutout.top / density,
            cutout.right / density,
            cutout.bottom / density,
            cutout.left / density
        );
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
