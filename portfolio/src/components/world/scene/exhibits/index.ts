import type { ComponentType } from "react";
import type { ExhibitKey } from "@/lib/projects/exhibits";
import { ApprovalFlow } from "./ApprovalFlow";
import { BranchOps } from "./BranchOps";
import { CveLog } from "./CveLog";
import { GoodsTable } from "./GoodsTable";
import { NoticeLifecycle } from "./NoticeLifecycle";
import { PrintAnalytics } from "./PrintAnalytics";
import { ShopDashboard } from "./ShopDashboard";
import { TrainingFlow } from "./TrainingFlow";

/** Every exhibit component, by key. (lib/projects/exhibits.ts holds the keys and captions and is what the tests check against this.) */
export const EXHIBIT_COMPONENTS: Record<ExhibitKey, ComponentType> = {
  "branch-ops": BranchOps,
  "approval-flow": ApprovalFlow,
  "notice-lifecycle": NoticeLifecycle,
  "training-flow": TrainingFlow,
  "print-analytics": PrintAnalytics,
  "goods-table": GoodsTable,
  "shop-dashboard": ShopDashboard,
  "cve-log": CveLog,
};
