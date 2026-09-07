package ai.lockin.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;

/**
 * LOCKIN.AI – Android-App (WebView-Wrapper).
 *
 * Beim ersten Start wird nach der Server-URL gefragt. Die URL wird gespeichert
 * und die App in einem Vollbild-WebView geladen. Zum Ändern der URL einfach
 * „⚙" oben rechts antippen und die neue URL eintragen.
 *
 * Verbesserungen:
 * - „Verbindung testen"-Button: prüft die URL per HTTP, bevor die App geladen wird
 * - Klare Fehlermeldungen, wenn der Server nicht erreichbar ist
 * - Bei Ladefehlern kann man zurück zum Setup-Screen (URL korrigieren)
 */
public class MainActivity extends Activity {

    private static final String PREFS = "lockin_prefs";
    private static final String KEY_URL = "server_url";
    // Direktstart für dieses Netzwerk. Auf einem anderen WLAN kann die IP abweichen;
    // dann erscheint automatisch der Setup-Screen zur Korrektur.
    private static final String DEFAULT_URL = "http://192.168.5.115:4000";

    private FrameLayout root;
    private WebView webView;
    private LinearLayout setupView;
    private Button settingsBtn;
    private EditText input;
    private TextView statusText;
    private Button testBtn;
    private Button goBtn;
    private ProgressBar progress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#04070F"));

        buildSetupView();
        buildWebView();
        buildProgressOverlay();

        root.addView(webView);
        root.addView(setupView);
        root.addView(settingsBtn = createSettingsButton());

        setContentView(root);

        // Direkt in die App starten. Die URL muss nicht mehr zuerst eingegeben werden.
        // Wenn der Server nicht erreichbar ist, zeigt onReceivedError den Setup-Screen.
        String url = getPrefs().getString(KEY_URL, DEFAULT_URL).trim();
        openApp(url.isEmpty() ? DEFAULT_URL : url);
    }

    /* ---------- Setup-Screen ---------- */

    private void buildSetupView() {
        setupView = new LinearLayout(this);
        setupView.setOrientation(LinearLayout.VERTICAL);
        setupView.setGravity(Gravity.CENTER);
        setupView.setPadding(dp(28), dp(28), dp(28), dp(28));
        setupView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // ScrollView, damit der längere Hinweistext auch auf kleinen Displays passt
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        android.widget.LinearLayout content = new android.widget.LinearLayout(this);
        content.setOrientation(android.widget.LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(dp(24), dp(28), dp(24), dp(28));
        scroll.addView(content);
        setupView.addView(scroll);

        TextView logo = new TextView(this);
        logo.setText("LOCKIN.AI");
        logo.setTextColor(Color.WHITE);
        logo.setTextSize(30);
        logo.setTypeface(Typeface.DEFAULT_BOLD);
        logo.setGravity(Gravity.CENTER);
        content.addView(logo);

        TextView sub = new TextView(this);
        sub.setText("Lock in. Level up.");
        sub.setTextColor(Color.parseColor("#38BDF8"));
        sub.setTextSize(15);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, dp(4), 0, dp(26));
        content.addView(sub);

        TextView hint = new TextView(this);
        hint.setText("Die App konnte den Server nicht automatisch erreichen.\n\n"
                + "Handy und Computer müssen im selben WLAN sein. Trage die IP deines Computers ein, z. B. http://192.168.1.20:4000.\n\n"
                + "⚠️ NICHT „localhost\" verwenden – das ist auf dem Handy das Handy selbst, nicht dein Computer!\n\n"
                + "Wenn du einen öffentlich gehosteten Server hast, kannst du hier auch dessen https://-Adresse eintragen.");
        hint.setTextColor(Color.parseColor("#9FB3C8"));
        hint.setTextSize(14);
        hint.setLineSpacing(dp(3), 1f);
        hint.setPadding(0, 0, 0, dp(14));
        content.addView(hint);

        input = new EditText(this);
        input.setSingleLine(true);
        input.setText(DEFAULT_URL);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.parseColor("#5A6B7F"));
        input.setTextSize(15);
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        input.setBackground(roundedRect("#16233D", "#2A3E5F"));
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO) {
                testConnection();
                return true;
            }
            return false;
        });
        LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ilp.bottomMargin = dp(16);
        input.setLayoutParams(ilp);
        content.addView(input);

        statusText = new TextView(this);
        statusText.setTextColor(Color.parseColor("#9FB3C8"));
        statusText.setTextSize(13);
        statusText.setGravity(Gravity.CENTER);
        statusText.setPadding(0, 0, 0, dp(14));
        statusText.setVisibility(View.GONE);
        content.addView(statusText);

        testBtn = new Button(this);
        testBtn.setText("🔍 Verbindung testen");
        testBtn.setTextColor(Color.parseColor("#38BDF8"));
        testBtn.setTextSize(15);
        testBtn.setTypeface(Typeface.DEFAULT_BOLD);
        testBtn.setPadding(dp(12), dp(6), dp(12), dp(6));
        testBtn.setBackground(roundedRect("#0F1A30", "#38BDF8"));
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tlp.bottomMargin = dp(10);
        testBtn.setLayoutParams(tlp);
        testBtn.setOnClickListener(v -> testConnection());
        content.addView(testBtn);

        goBtn = new Button(this);
        goBtn.setText("App öffnen →");
        goBtn.setTextColor(Color.parseColor("#04070F"));
        goBtn.setTextSize(16);
        goBtn.setTypeface(Typeface.DEFAULT_BOLD);
        goBtn.setPadding(dp(12), dp(6), dp(12), dp(6));
        goBtn.setBackground(roundedRect("#38BDF8", "#38BDF8"));
        goBtn.setOnClickListener(v -> {
            if (statusText.getVisibility() == View.VISIBLE
                    && statusText.getText().toString().startsWith("✅")) {
                // bereits erfolgreich getestet -> direkt öffnen
                openApp(normalizeUrl(input.getText().toString()));
            } else {
                testConnectionAndOpen();
            }
        });
        content.addView(goBtn);
    }

    private void testConnection() {
        testConnectionAndOpen(false);
    }

    private void testConnectionAndOpen() {
        testConnectionAndOpen(true);
    }

    private void testConnectionAndOpen(boolean openAfterSuccess) {
        String url = normalizeUrl(input.getText().toString());
        setBusy(true);
        statusText.setVisibility(View.VISIBLE);
        statusText.setTextColor(Color.parseColor("#9FB3C8"));
        statusText.setText("Prüfe " + url + " …");

        final Handler main = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            final String err = checkServer(url);
            main.post(() -> {
                setBusy(false);
                if (err == null) {
                    statusText.setTextColor(Color.parseColor("#4ADE80"));
                    statusText.setText("✅ Server erreichbar – App kann geladen werden.");
                    if (openAfterSuccess) openApp(url);
                } else {
                    statusText.setTextColor(Color.parseColor("#F87171"));
                    statusText.setText("❌ " + err);
                }
            });
        }).start();
    }

    /** Prüft, ob der Server unter der URL erreichbar ist. Gibt null bei Erfolg, sonst Fehlertext. */
    private String checkServer(String baseUrl) {
        // 1) TCP-Verbindung testen
        try {
            URL u = new URL(baseUrl);
            int port = u.getPort() > 0 ? u.getPort() : (u.getDefaultPort() > 0 ? u.getDefaultPort() : 80);
            try (Socket s = new Socket()) {
                s.connect(new InetSocketAddress(u.getHost(), port), 4000);
            }
        } catch (IOException e) {
            return "Server nicht erreichbar (" + baseUrl + ").\n"
                    + "Prüfe: gleiches WLAN? IP richtig? Server läuft?";
        }
        // 2) HTTP /api/health abfragen
        try {
            URL u = new URL(baseUrl + "/api/health");
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(4000);
            c.setReadTimeout(4000);
            int code = c.getResponseCode();
            c.disconnect();
            if (code != 200) {
                return "Server antwortet mit HTTP " + code + " – ist das die LOCKIN.AI-URL?";
            }
            return null;
        } catch (IOException e) {
            return "Server nicht erreichbar (" + baseUrl + ").\n"
                    + "Prüfe: gleiches WLAN? IP richtig? Server läuft?";
        }
    }

    private void setBusy(boolean busy) {
        testBtn.setEnabled(!busy);
        goBtn.setEnabled(!busy);
        testBtn.setText(busy ? "Prüfe …" : "🔍 Verbindung testen");
    }

    private String normalizeUrl(String raw) {
        String url = (raw == null ? "" : raw).trim();
        if (url.isEmpty()) url = DEFAULT_URL;
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://" + url;
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }

    /* ---------- WebView ---------- */

    private void buildWebView() {
        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(Color.parseColor("#04070F"));
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    String desc = (error != null && error.getDescription() != null)
                            ? error.getDescription().toString() : "Unbekannter Fehler";
                    showSetup(getPrefs().getString(KEY_URL, ""), "❌ Seite konnte nicht geladen werden.\n\n" + desc);
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request.isForMainFrame() && errorResponse != null) {
                    int code = errorResponse.getStatusCode();
                    showSetup(getPrefs().getString(KEY_URL, ""),
                            "❌ Server antwortet mit HTTP " + code + ".\n\nIst das die richtige LOCKIN.AI-URL?");
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progress != null) {
                    progress.setProgress(newProgress);
                    progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
                }
            }
        });

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
    }

    private void buildProgressOverlay() {
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#38BDF8")));
        FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP);
        progress.setLayoutParams(plp);
        progress.setVisibility(View.GONE);
        root.addView(progress);
    }

    private void openApp(String url) {
        getPrefs().edit().putString(KEY_URL, url).apply();
        setupView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        if (settingsBtn != null) settingsBtn.setVisibility(View.VISIBLE);
        statusText.setVisibility(View.GONE);
        webView.loadUrl(url);
    }

    private void showSetup(String url, String errorMsg) {
        webView.stopLoading();
        webView.setVisibility(View.GONE);
        setupView.setVisibility(View.VISIBLE);
        if (settingsBtn != null) settingsBtn.setVisibility(View.GONE);
        if (url != null && !url.isEmpty()) {
            input.setText(url);
            input.setSelection(input.getText().length());
        }
        if (errorMsg != null && !errorMsg.isEmpty()) {
            statusText.setVisibility(View.VISIBLE);
            statusText.setTextColor(Color.parseColor("#F87171"));
            statusText.setText(errorMsg);
        } else {
            statusText.setVisibility(View.GONE);
        }
    }

    /* ---------- URL-ändern-Button ---------- */

    private Button createSettingsButton() {
        Button b = new Button(this);
        b.setText("⚙");
        b.setTextColor(Color.WHITE);
        b.setTextSize(18);
        b.setPadding(0, 0, 0, 0);
        b.setBackground(roundedRect("#16233D", "#2A3E5F"));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(44), dp(44), Gravity.TOP | Gravity.END);
        lp.topMargin = dp(14);
        lp.rightMargin = dp(14);
        b.setLayoutParams(lp);
        b.setVisibility(View.GONE);
        b.setOnClickListener(v -> showSetup(getPrefs().getString(KEY_URL, ""), null));
        return b;
    }

    /* ---------- Back-Button ---------- */

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (setupView.getVisibility() == View.VISIBLE) {
                // Setup-Screen: zurück = App beenden
                return super.onKeyDown(keyCode, event);
            }
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    /* ---------- Helpers ---------- */

    private SharedPreferences getPrefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private Drawable roundedRect(String fill, String stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(Color.parseColor(fill));
        g.setCornerRadius(dp(12));
        g.setStroke(dp(1), Color.parseColor(stroke));
        return g;
    }
}