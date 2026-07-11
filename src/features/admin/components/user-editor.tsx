"use client";

import type { Role, StudyDegree, StudyGrade, UserStatus } from "@prisma/client";
import { AlertTriangle, KeyRound, ShieldAlert, Trash2, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/toast";
import type { ActionResult } from "@/shared/lib/action-result";
import { STUDY_GRADES, STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";

import { cancelGraduationResult } from "../actions/cancel-user-graduation";
import { permanentlyDeleteUserResult } from "../actions/delete-user-account";
import { revokeUserSessionsResult } from "../actions/revoke-user-sessions";
import { updateUserAdvisorResult } from "../actions/update-user-advisor";
import { updateUserIdentityResult } from "../actions/update-user-identity";
import { updateUserRoleResult } from "../actions/update-user-role";
import { updateUserStatusResult } from "../actions/update-user-status";
import { updateUserStudyIdentityResult } from "../actions/update-user-study-identity";

export type UserEditorRecord = {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  studentId: string | null;
  role: Role;
  status: UserStatus;
  studyDegree: StudyDegree | null;
  studyGrade: StudyGrade | null;
  identityNeedsReview: boolean;
  advisorId: string | null;
  graduatedAt: string | null;
  scheduledDeletionAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Array<{
    id: string;
    name: string;
    displayName: string;
    source: string;
    scope: string;
    projectName: string | null;
  }>;
};

export type UserEditorAdvisor = {
  id: string;
  displayName: string;
  username: string;
};

type Confirmation = "role" | "suspend" | "graduate" | "cancel-graduation" | "delete" | null;

const degreeLabels: Record<StudyDegree, string> = {
  MASTER: "硕士",
  DOCTOR: "博士",
  MENTOR: "导师",
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "在用",
  SUSPENDED: "已暂停",
  GRADUATED: "毕业清理期",
};

export function UserEditor({
  user,
  advisors,
  isCurrentUser,
}: {
  user: UserEditorRecord;
  advisors: readonly UserEditorAdvisor[];
  isCurrentUser: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [studentId, setStudentId] = useState(user.studentId ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const initialDegree = user.studyDegree ?? "MASTER";
  const [studyDegree, setStudyDegree] = useState<StudyDegree>(initialDegree);
  const [studyGrade, setStudyGrade] = useState<StudyGrade | "">(
    user.studyGrade ?? STUDY_GRADES[initialDegree][0] ?? "",
  );
  const [advisorId, setAdvisorId] = useState(user.advisorId ?? "");
  const [confirmUsername, setConfirmUsername] = useState("");
  const gradeOptions = useMemo(
    () => STUDY_GRADES[studyDegree] as readonly StudyGrade[],
    [studyDegree],
  );
  const usernameError = username.trim().length < 2
    ? "用户名至少需要 2 个字符。"
    : username.trim().length > 80
      ? "用户名不能超过 80 个字符。"
      : null;
  const displayNameError = !displayName.trim()
    ? "姓名不能为空。"
    : displayName.trim().length > 120
      ? "姓名不能超过 120 个字符。"
      : null;
  const studentIdError = studentId.trim().length > 80 ? "学号不能超过 80 个字符。" : null;
  const studyGradeError = user.role === "MEMBER" && studyDegree !== "MENTOR" && !studyGrade
    ? "请选择与培养身份匹配的年级。"
    : null;
  const canGraduate = user.role === "MEMBER"
    && (user.studyDegree === "MASTER" || user.studyDegree === "DOCTOR")
    && !user.identityNeedsReview
    && user.status !== "GRADUATED";

  function runAction(action: () => Promise<ActionResult<unknown>>, successTitle: string, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.message);
          toast({ title: "操作未完成", description: result.message, variant: "error" });
          return;
        }
        setConfirmation(null);
        toast({ title: successTitle, variant: "success" });
        onSuccess?.();
        router.refresh();
      } catch {
        const message = "操作请求失败，请稍后重试。";
        setError(message);
        toast({ title: "操作未完成", description: message, variant: "error" });
      }
    });
  }

  function changeDegree(nextDegree: StudyDegree) {
    setStudyDegree(nextDegree);
    setStudyGrade(nextDegree === "MENTOR" ? "" : STUDY_GRADES[nextDegree][0]);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar src={user.avatar} name={user.displayName} size={72} priority />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-semibold tracking-[-0.03em]">{user.displayName}</h2>
              <Badge>{user.role === "ADMIN" ? "管理员" : "成员"}</Badge>
              <Badge>{statusLabels[user.status]}</Badge>
              {user.identityNeedsReview ? <Badge className="border-destructive/30 bg-destructive/10 text-destructive">身份待修复</Badge> : null}
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{user.username}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              创建于 {user.createdAt} · 最近更新 {user.updatedAt}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基础资料</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">用户名</span>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                maxLength={80}
                aria-invalid={Boolean(usernameError)}
                aria-describedby={usernameError ? "user-editor-username-error" : undefined}
              />
              {usernameError ? <span id="user-editor-username-error" className="text-xs text-destructive">{usernameError}</span> : null}
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">姓名</span>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={120}
                aria-invalid={Boolean(displayNameError)}
                aria-describedby={displayNameError ? "user-editor-display-name-error" : undefined}
              />
              {displayNameError ? <span id="user-editor-display-name-error" className="text-xs text-destructive">{displayNameError}</span> : null}
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">学号</span>
              <Input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="导师可留空"
                maxLength={80}
                aria-invalid={Boolean(studentIdError)}
                aria-describedby={studentIdError ? "user-editor-student-id-error" : undefined}
              />
              {studentIdError ? <span id="user-editor-student-id-error" className="text-xs text-destructive">{studentIdError}</span> : null}
            </label>
            <Button
              className="w-fit"
              disabled={isPending || Boolean(usernameError || displayNameError || studentIdError)}
              onClick={() => runAction(
                () => updateUserIdentityResult({ userId: user.id, username, displayName, studentId }),
                "基础资料已保存",
              )}
            >
              保存基础资料
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统角色</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm leading-6 text-muted-foreground">
              管理员只承担治理职责，不具备内容创作能力。角色切换会清空原培养身份，成员角色需要随后重新确认培养身份。
            </p>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">目标角色</span>
              <Select value={role} onChange={(event) => setRole(event.target.value as Role)} disabled={isPending || user.status === "GRADUATED"}>
                <option value="MEMBER">成员</option>
                <option value="ADMIN">管理员</option>
              </Select>
            </label>
            <Button
              variant="secondary"
              className="w-fit"
              disabled={isPending || role === user.role || user.status === "GRADUATED" || (isCurrentUser && role !== "ADMIN")}
              onClick={() => setConfirmation("role")}
            >
              保存系统角色
            </Button>
            {isCurrentUser ? <p className="text-xs text-muted-foreground">不能移除当前登录账号自己的管理员角色。</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>培养身份</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {user.role === "ADMIN" ? (
              <p className="text-sm leading-6 text-muted-foreground">管理员账号不设置培养身份、年级或导师。</p>
            ) : (
              <>
                {user.identityNeedsReview ? (
                  <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    当前身份未完成迁移或刚从管理员切换为成员，请在此重新确认。
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">培养身份</span>
                    <Select
                      value={studyDegree}
                      onChange={(event) => changeDegree(event.target.value as StudyDegree)}
                      disabled={isPending || user.status === "GRADUATED"}
                    >
                      {Object.entries(degreeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">年级</span>
                    <Select
                      value={studyGrade}
                      onChange={(event) => setStudyGrade(event.target.value as StudyGrade)}
                      disabled={isPending || user.status === "GRADUATED" || studyDegree === "MENTOR"}
                      aria-invalid={Boolean(studyGradeError)}
                      aria-describedby={studyGradeError ? "user-editor-study-grade-error" : undefined}
                    >
                      {studyDegree === "MENTOR" ? <option value="">导师不设置年级</option> : null}
                      {gradeOptions.map((grade) => <option key={grade} value={grade}>{STUDY_GRADE_LABELS[grade]}</option>)}
                    </Select>
                    {studyGradeError ? <span id="user-editor-study-grade-error" className="text-xs text-destructive">{studyGradeError}</span> : null}
                  </label>
                </div>
                <Button
                  className="w-fit"
                  disabled={isPending || user.status === "GRADUATED" || Boolean(studyGradeError)}
                  onClick={() => runAction(
                    () => updateUserStudyIdentityResult({
                      userId: user.id,
                      studyDegree,
                      studyGrade: studyDegree === "MENTOR" ? undefined : studyGrade,
                    }),
                    "培养身份已更新",
                  )}
                >
                  保存培养身份
                </Button>

                {studyDegree !== "MENTOR" ? (
                  <div className="grid gap-3 border-t border-border/75 pt-4">
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">导师</span>
                      <Select
                        value={advisorId}
                        onChange={(event) => setAdvisorId(event.target.value)}
                        disabled={isPending || user.status !== "ACTIVE" || user.identityNeedsReview}
                      >
                        <option value="">暂不设置</option>
                        {advisors.map((advisor) => (
                          <option key={advisor.id} value={advisor.id}>{advisor.displayName}（{advisor.username}）</option>
                        ))}
                      </Select>
                    </label>
                    <Button
                      variant="secondary"
                      className="w-fit"
                      disabled={isPending || user.status !== "ACTIVE" || user.identityNeedsReview || advisorId === (user.advisorId ?? "")}
                      onClick={() => runAction(
                        () => updateUserAdvisorResult({ userId: user.id, advisorId: advisorId || null }),
                        "导师已更新",
                      )}
                    >
                      保存导师
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>账号与会话</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{statusLabels[user.status]}</Badge>
              {isCurrentUser ? <Badge className="bg-secondary">当前登录账号</Badge> : null}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              暂停账号或使现有登录失效都会递增会话版本；服务端会在后续请求中拒绝旧会话。
            </p>
            <div className="flex flex-wrap gap-2">
              {user.status === "ACTIVE" ? (
                <Button
                  variant="secondary"
                  disabled={isPending || isCurrentUser}
                  onClick={() => setConfirmation("suspend")}
                >
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  暂停账号
                </Button>
              ) : user.status === "SUSPENDED" ? (
                <Button
                  disabled={isPending}
                  onClick={() => runAction(
                    () => updateUserStatusResult({ userId: user.id, status: "ACTIVE" }),
                    "账号已恢复",
                  )}
                >
                  <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                  恢复为在用
                </Button>
              ) : null}
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => runAction(
                  () => revokeUserSessionsResult({ userId: user.id }),
                  "现有登录已失效",
                )}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                使现有登录失效
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>有效 Tag</CardTitle>
        </CardHeader>
        <CardContent>
          {user.tags.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {user.tags.map((tag) => (
                <li key={tag.id} className="rounded-xl border border-border/80 bg-muted/35 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tag.displayName}</span>
                    <Badge>{tag.scope === "PROJECT" ? "项目" : "全局"}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{tag.name}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    来源：{tag.source}{tag.projectName ? ` · ${tag.projectName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">当前没有有效 Tag。</p>}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            高风险操作
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 rounded-xl border border-border/80 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h3 className="font-semibold">毕业与计划删除</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                毕业会立即撤销权限、使会话失效并进入宽限清理期。宽限期内可由管理员取消。
              </p>
              {user.graduatedAt ? <p className="mt-2 text-xs text-muted-foreground">毕业时间：{user.graduatedAt}</p> : null}
              {user.scheduledDeletionAt ? <p className="text-xs font-medium text-destructive">计划永久删除：{user.scheduledDeletionAt}</p> : null}
            </div>
            {user.status === "GRADUATED" ? (
              <Button variant="secondary" disabled={isPending} onClick={() => setConfirmation("cancel-graduation")}>
                取消毕业
              </Button>
            ) : (
              <Button variant="destructive" disabled={isPending || !canGraduate || isCurrentUser} onClick={() => setConfirmation("graduate")}>
                标记毕业
              </Button>
            )}
          </div>

          <div className="grid gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h3 className="font-semibold">永久删除账号</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                删除后无法恢复。历史内容保留不可变作者快照，账号、权限、通知与运行时计数会被清理。
              </p>
            </div>
            <Button variant="destructive" disabled={isPending || isCurrentUser} onClick={() => setConfirmation("delete")}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              永久删除
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmation === "role"}
        onOpenChange={(open) => setConfirmation(open ? "role" : null)}
        title="确认变更系统角色？"
        description="此操作会调整基础权限并清空原培养身份。切换为成员后必须重新确认培养身份。"
        confirmLabel="确认变更"
        pending={isPending}
        onConfirm={() => runAction(() => updateUserRoleResult({ userId: user.id, role }), "系统角色已更新")}
      />
      <ConfirmDialog
        open={confirmation === "suspend"}
        onOpenChange={(open) => setConfirmation(open ? "suspend" : null)}
        title="暂停这个账号？"
        description="用户将立即失去访问权限，现有登录也会失效。稍后可以恢复。"
        confirmLabel="确认暂停"
        destructive
        pending={isPending}
        onConfirm={() => runAction(() => updateUserStatusResult({ userId: user.id, status: "SUSPENDED" }), "账号已暂停")}
      />
      <ConfirmDialog
        open={confirmation === "graduate"}
        onOpenChange={(open) => setConfirmation(open ? "graduate" : null)}
        title="确认标记毕业？"
        description="权限与现有登录会立即失效，所有有效 Tag 将被撤销，并安排宽限期后的永久删除。"
        confirmLabel="确认毕业"
        destructive
        pending={isPending}
        onConfirm={() => runAction(() => updateUserStatusResult({ userId: user.id, status: "GRADUATED" }), "账号已进入毕业清理期")}
      />
      <ConfirmDialog
        open={confirmation === "cancel-graduation"}
        onOpenChange={(open) => setConfirmation(open ? "cancel-graduation" : null)}
        title="取消毕业状态？"
        description="账号将恢复为在用，但已撤销的手动 Tag 不会自动恢复。"
        confirmLabel="恢复账号"
        pending={isPending}
        onConfirm={() => runAction(() => cancelGraduationResult({ userId: user.id }), "毕业状态已取消")}
      />
      <ConfirmDialog
        open={confirmation === "delete"}
        onOpenChange={(open) => {
          setConfirmation(open ? "delete" : null);
          if (!open) setConfirmUsername("");
        }}
        title="永久删除账号"
        description={`将永久删除 ${user.displayName}（${user.username}）的登录账号且无法恢复；历史内容仍保留原署名，但该用户将无法再登录。请输入用户名确认。`}
        confirmLabel="永久删除"
        destructive
        pending={isPending}
        confirmDisabled={confirmUsername !== user.username}
        onConfirm={() => runAction(
          () => permanentlyDeleteUserResult({ userId: user.id, confirmUsername }),
          "账号已永久删除",
          () => router.push("/admin/users"),
        )}
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">确认用户名</span>
          <Input
            data-autofocus
            value={confirmUsername}
            onChange={(event) => setConfirmUsername(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
