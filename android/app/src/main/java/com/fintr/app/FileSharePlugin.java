package com.fintr.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Shares a file URI via {@link Intent#ACTION_SEND}. The stock {@code @capacitor/share} plugin
 * only accepts {@code file:} or {@code http:} in its {@code url} field; {@code Filesystem#getUri}
 * often returns {@code content:} on real devices, which would be rejected. This plugin forwards
 * {@code content:} unchanged and wraps {@code file:} with the app {@link FileProvider}.
 */
@CapacitorPlugin(name = "FileShare")
public class FileSharePlugin extends Plugin {

  @PluginMethod
  public void shareStream(PluginCall call) {
    String uriString = call.getString("uri");
    if (uriString == null || uriString.isEmpty()) {
      call.reject("uri is required");
      return;
    }

    String mimeType = call.getString("mimeType", "*/*");
    String dialogTitle = call.getString("dialogTitle", "Save or share file");

    Uri parsed = Uri.parse(uriString);
    final Uri streamUri;

    try {
      if ("file".equalsIgnoreCase(parsed.getScheme())) {
        File file = new File(parsed.getPath());
        streamUri =
          FileProvider.getUriForFile(
            getActivity(),
            getContext().getPackageName() + ".fileprovider",
            file
          );
      } else if ("content".equalsIgnoreCase(parsed.getScheme())) {
        streamUri = parsed;
      } else {
        call.reject("Unsupported uri scheme for sharing: " + parsed.getScheme());
        return;
      }
    } catch (Exception e) {
      call.reject("Could not prepare file for sharing", e);
      return;
    }

    Intent intent = new Intent(Intent.ACTION_SEND);
    intent.setType(mimeType);
    intent.putExtra(Intent.EXTRA_STREAM, streamUri);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      intent.setClipData(ClipData.newRawUri("", streamUri));
    }

    Intent chooser = Intent.createChooser(intent, dialogTitle);
    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

    getActivity()
      .runOnUiThread(
        () -> {
          try {
            getActivity().startActivity(chooser);
            call.resolve();
          } catch (Exception e) {
            call.reject("Failed to open share sheet", e);
          }
        }
      );
  }
}
