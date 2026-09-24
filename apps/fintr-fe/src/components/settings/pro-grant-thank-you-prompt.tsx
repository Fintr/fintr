"use client";

import { useState } from "react";

import { ProGrantThankYouDialog } from "@/components/settings/pro-grant-thank-you-dialog";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useProAccess } from "@/hooks/async/useProAccess";

type ProGrantThankYouPromptProps = {
  enabled: boolean;
};

export const ProGrantThankYouPrompt = ({ enabled }: ProGrantThankYouPromptProps) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user",
  });
  const { data } = useProAccess();
  const [dismissed, setDismissed] = useState(false);
  const notice = data?.grantNotice;
  const open = enabled && !dismissed && notice?.pending === true;

  return (
    <ProGrantThankYouDialog
      api={api}
      open={open}
      expiresAt={notice?.expiresAt ?? null}
      onAcknowledged={() => setDismissed(true)}
    />
  );
};
