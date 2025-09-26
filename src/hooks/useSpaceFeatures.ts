"use client";
import { useAtomValue } from "jotai";
import { 
  spaceFeaturesAtom,
  teamCollaborationEnabledAtom,
  advancedReportingEnabledAtom
} from "@/atoms/spaceAtoms";

export function useSpaceFeatures() {
  const features = useAtomValue(spaceFeaturesAtom);
  const teamCollaboration = useAtomValue(teamCollaborationEnabledAtom);
  const advancedReporting = useAtomValue(advancedReportingEnabledAtom);

  return {
    teamCollaboration,
    advancedReporting,
    aiEnabled: features?.aiEnabled ?? false,
    features
  };
}

