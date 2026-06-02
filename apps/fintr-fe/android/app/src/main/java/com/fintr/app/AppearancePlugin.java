package com.fintr.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Appearance")
public class AppearancePlugin extends Plugin {

  @PluginMethod
  public void setAppearance(PluginCall call) {
    String theme = call.getString("theme", "dark");
    boolean isLight = "light".equals(theme);

    if (getActivity() == null) {
      call.resolve();
      return;
    }

    getActivity().runOnUiThread(() -> {
      if (getActivity() instanceof MainActivity) {
        ((MainActivity) getActivity()).applyAppearance(isLight);
      }
      call.resolve();
    });
  }
}
