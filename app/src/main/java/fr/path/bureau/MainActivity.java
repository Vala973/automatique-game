package fr.path.bureau;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

/**
 * Bureau PATH : ouvre le bureau 3D (page Claude d'Oscar) en plein écran.
 * La page, la progression, le directeur et les agents restent sur le compte Claude :
 * l'appli n'en garde aucune copie, elle affiche simplement la vraie page.
 */
public class MainActivity extends Activity {

    private static final String URL = "https://claude.ai/artifact/1DZvg5pfYmk873mj7usg9u";
    private static final String MSG_GOOGLE =
            "Google n’autorise pas la connexion dans une appli intégrée. Choisis « Continuer avec l’e-mail » : "
            + "ouvre le lien reçu, puis tape ici le code affiché.";

    private WebView web;
    private ProgressBar barre;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout racine = new FrameLayout(this);
        racine.setBackgroundColor(Color.rgb(250, 247, 242));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri u = request.getUrl();
                String h = u.getHost();
                if (h == null) return false;
                if (h.equals("claude.ai") || h.endsWith(".claude.ai") || h.equals("claude.com") || h.endsWith(".claude.com")
                        || h.endsWith("claudeusercontent.com") || h.equals("anthropic.com") || h.endsWith(".anthropic.com")) {
                    return false; // reste dans l'appli
                }
                if (h.equals("accounts.google.com")) {
                    Toast.makeText(MainActivity.this, MSG_GOOGLE, Toast.LENGTH_LONG).show();
                    return true;
                }
                ouvrirAilleurs(u); // autres sites : navigateur
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String page = "<html><body style='font-family:sans-serif;background:#FAF7F2;color:#1E1B2E;padding:32px'>"
                            + "<h2 style='color:#6B5FE5'>Bureau PATH</h2>"
                            + "<p>Pas de connexion à Internet pour l’instant.</p>"
                            + "<p><a href='" + URL + "' style='color:#6B5FE5;font-weight:bold'>Réessayer</a></p></body></html>";
                    view.loadDataWithBaseURL(URL, page, "text/html", "utf-8", null);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progres) {
                barre.setProgress(progres);
                barre.setVisibility(progres >= 100 ? View.GONE : View.VISIBLE);
            }
        });

        web.setDownloadListener((url, userAgent, contentDisposition, mimetype, length) -> {
            if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) ouvrirAilleurs(Uri.parse(url));
        });

        barre = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        barre.setMax(100);

        racine.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 12, Gravity.TOP);
        racine.addView(barre, lp);
        setContentView(racine);

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(URL);
    }

    private void ouvrirAilleurs(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception e) {
            Toast.makeText(this, "Aucune appli pour ouvrir ce lien.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
