import { AssetStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getAssetStatusLabel } from "@/lib/constants";

const colors: Record<AssetStatus, "info" | "success" | "warning" | "default"> = {
  [AssetStatus.IN_STOCK]: "info",
  [AssetStatus.ASSIGNED]: "success",
  [AssetStatus.REPAIR]: "warning",
  [AssetStatus.RETIRED]: "default",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <Badge variant={colors[status]}>{getAssetStatusLabel(status)}</Badge>;
}
