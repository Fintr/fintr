"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { buildEarlyErrorDetectionScript } from "@/lib/early-error-detection-script";
import { shouldLoadKironBlogger } from "@/lib/kiron-blogger";
import {
  miniProfilerEarlyFetchQueueScript,
  miniProfilerInlineBootstrapScript,
  shouldEnableRackMiniProfiler,
} from "@/lib/rack-mini-profiler-inline-bootstrap";
import { buildServiceWorkerBootstrapScript } from "@/lib/service-worker-bootstrap-script";

const BLOGGER_CONNECT_SCRIPT_URL = "https://blogger.kiron.app/connect.js";
const BLOGGER_SITE_ID = "3";
const BLOGGER_API_KEY =
  "71b97f9302789af0b7819662214c939c491b43e72b9af960";
const BLOGGER_API_URL = "https://blogger.kiron.app";

type BootstrapScriptsProps = {
  serviceWorkerUrl: string;
  rackMiniProfilerApiBase?: string;
};

/**
 * Injects critical bootstrap scripts via SSR outside the React tree so React 19
 * does not warn about script tags inside component renders on the client.
 */
export function BootstrapScripts({
  serviceWorkerUrl,
  rackMiniProfilerApiBase,
}: BootstrapScriptsProps) {
  const serviceWorkerBootstrap = buildServiceWorkerBootstrapScript(serviceWorkerUrl);
  const rackMiniProfilerEnabled =
    rackMiniProfilerApiBase && shouldEnableRackMiniProfiler();
  const didInsertBootstrapScripts = useRef(false);

  useServerInsertedHTML(() => {
    if (didInsertBootstrapScripts.current) {
      return null;
    }

    didInsertBootstrapScripts.current = true;

    return (
      <>
        <script
          id="fintr-early-error-detection"
          dangerouslySetInnerHTML={{
            __html: buildEarlyErrorDetectionScript(),
          }}
        />
        <script
          id="fintr-service-worker-bootstrap"
          dangerouslySetInnerHTML={{
            __html: serviceWorkerBootstrap,
          }}
        />
        {shouldLoadKironBlogger() && (
          <script
            id="fintr-blogger-connect"
            src={BLOGGER_CONNECT_SCRIPT_URL}
            async
            data-site-id={BLOGGER_SITE_ID}
            data-api-key={BLOGGER_API_KEY}
            data-api-url={BLOGGER_API_URL}
          />
        )}
        {rackMiniProfilerEnabled && (
          <>
            <script
              id="fintr-rack-mini-profiler-fetch-shim"
              dangerouslySetInnerHTML={{
                __html: miniProfilerEarlyFetchQueueScript(),
              }}
            />
            <script
              id="fintr-rack-mini-profiler-bootstrap"
              dangerouslySetInnerHTML={{
                __html: miniProfilerInlineBootstrapScript(rackMiniProfilerApiBase),
              }}
            />
          </>
        )}
      </>
    );
  });

  return null;
}
