package tj.tezkor.app;

import android.content.Context;
import android.content.pm.PackageInfo;

final class BuildInfo {
    private BuildInfo() {}

    static String version(Context c) {
        try {
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return p.versionName == null ? "1" : p.versionName;
        } catch (Exception e) {
            return "1";
        }
    }
}
