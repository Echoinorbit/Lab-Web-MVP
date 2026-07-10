export const SYSTEM_SETTING_ID = "singleton";
export const MAX_SESSION_HOURS = 720;

export type RuntimeSettingsInput = {
  progressStartDay: number;
  progressStartMinute: number;
  progressEndDay: number;
  progressEndMinute: number;
  sessionHours: number;
};

export function assertRuntimeSettings(input: RuntimeSettingsInput) {
  const daysValid = [input.progressStartDay, input.progressEndDay].every(Number.isInteger)
    && input.progressStartDay >= 1
    && input.progressStartDay <= 31
    && input.progressEndDay >= 1
    && input.progressEndDay <= 31;
  const minutesValid = [input.progressStartMinute, input.progressEndMinute].every(Number.isInteger)
    && input.progressStartMinute >= 0
    && input.progressStartMinute <= 1439
    && input.progressEndMinute >= 0
    && input.progressEndMinute <= 1439;
  if (!daysValid || !minutesValid) throw new Error("进度窗口日期或时间无效。");

  const start = input.progressStartDay * 1440 + input.progressStartMinute;
  const end = input.progressEndDay * 1440 + input.progressEndMinute;
  if (start >= end) throw new Error("进度窗口结束时间必须晚于开始时间。");
  if (!Number.isInteger(input.sessionHours) || input.sessionHours < 1 || input.sessionHours > MAX_SESSION_HOURS) {
    throw new Error("会话时长必须在 1 到 720 小时之间。");
  }
}
