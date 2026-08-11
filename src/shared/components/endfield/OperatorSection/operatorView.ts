import { operators as operatorData, t } from "@/content";
import type { Operator } from "@/types/site";

/** Everything the landscape and portrait panels need for one operator. */
export interface OperatorView {
  operator: Operator;
  /** 1-based position in the roster, as shown in the `N / 31` readout. */
  position: number;
  total: number;
  camp: string;
  race: string;
  /** Biography paragraphs, already split on the `\n` separators in the data. */
  lines: string[];
}

/** Builds the derived view model for the operator at `index`. */
export function buildOperatorView(operator: Operator, index: number, total: number): OperatorView {
  return {
    operator,
    position: index + 1,
    total,
    camp: operatorData.camps[operator.camp] ?? "",
    race: operatorData.races[operator.race] ?? "",
    lines: operator.intro
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  };
}

/** `01 / 31`, zero-padded the way the original readout renders it. */
export function formatPosition(view: OperatorView): string {
  return `${String(view.position).padStart(2, "0")} / ${view.total}`;
}

/** The two chips on the first metadata row. */
export function metaTags(view: OperatorView): { label: string; value: string }[] {
  if (view.operator.presentation) return [...view.operator.presentation.metadata];

  return [
    { label: t("operator.camp"), value: view.camp },
    { label: t("operator.race"), value: view.race },
  ];
}

/** The two CV chips on the second metadata row. */
export function cvLabels(view?: OperatorView): string[] {
  if (view?.operator.presentation) return [...view.operator.presentation.secondaryLabels];

  return [t("operator.cv.zh-cn"), t("operator.cv.ja-jp")];
}
