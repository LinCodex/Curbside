"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  CircleX,
  FlaskConical,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSupabaseAccount } from "./use-supabase-account";
import { usePreferences } from "./preferences";
import CrmLogin from "./crm-login";
import CrmSelect from "./crm-select";
import {
  CrmAccountActions,
  CrmDisplaySettings,
  CrmInbox,
  CrmTicketTest,
} from "./crm-tools";
import {
  crmClientRequest,
  type CrmAdmin,
  type CrmStats,
  type CrmUsers,
  type CrmUserDetail,
  type CrmCheck,
  type CrmAccess,
  type CrmRole,
  type CrmPreview,
  type CrmSendResult,
  type CrmEmail,
} from "@/lib/crm-client";

type Translate = (text: string) => string;
type Tab =
  "overview" | "customers" | "email" | "access" | "status" | "debug" | "inbox";
const chinese: Record<string, string> = {
  "Support & feedback": "支持与反馈",
  "A question, an idea, or something to fix": "有疑问、有建议，或遇到了问题？",
  "Send a message to our private support inbox. Messages are kept for up to 90 days.":
    "将消息发送至我们的专属客服收件箱。消息最多保留 90 天。",
  "Sign in to contact support": "登录后联系客服",
  "Message type": "消息类型",
  "Support question": "咨询客服",
  "Product feedback": "产品建议",
  "Report a problem": "报告问题",
  "Your message": "消息内容",
  "Do not include passwords, verification codes, or payment details.":
    "请勿填写密码、验证码或付款信息。",
  "Message sent to support.": "消息已发送至客服。",
  "Send message": "发送消息",
  "Could not send your message. Please try again.": "消息发送失败，请重试。",
  "Support inbox": "客服收件箱",
  "Private support questions and feedback. Messages expire after 90 days.":
    "查看用户咨询与产品反馈。消息将在 90 天后清除。",
  "All messages": "所有消息",
  "No messages yet.": "暂无消息。",
  "Delete this message permanently?": "确定永久删除此消息吗？",
  "Confirm delete": "确认删除",
  "Delete message": "删除消息",
  "Account tools": "账户管理",
  "Only act at the customer's request. Verification links keep email and password changes under their control.":
    "请仅在用户提出请求后操作。邮箱与密码变更需由用户通过验证链接完成。",
  Action: "操作",
  "Account action": "账户操作",
  "Send password reset": "发送密码重置链接",
  "Change email address": "更换邮箱",
  "New email address": "新邮箱地址",
  "Confirmation is sent to both the current and new address. Neither changes immediately.":
    "原邮箱和新邮箱都会收到验证邮件。完成确认后才会生效。",
  "Type the customer's email to confirm deletion": "输入用户邮箱以确认删除",
  "Deletion is permanent. Saved cars and private account data are removed.":
    "删除后无法恢复。已保存的车辆及私人账户数据将被移除。",
  "Email the customer a status update": "通过邮件向用户发送操作进度",
  "The customer requested this action.": "此操作由用户本人提出。",
  "The action or delivery needs review. Check the customer and Resend before repeating.":
    "操作或邮件发送状态待核实。请先查看用户账户及 Resend 记录，再决定是否重试。",
  "Verification sent. Check inboxes and spam folders.":
    "验证邮件已发送，请查看收件箱及垃圾邮件文件夹。",
  "Account action completed.": "账户操作已完成。",
  "Confirm action": "确认操作",
  "Test the latest saved ticket email": "测试最新历史罚单邮件",
  "Sends the selected customer's latest saved ticket, clearly marked TEST. It does not change discovery or reminder history.":
    "向所选用户发送其最近保存的历史罚单，邮件明确标注为测试。不会更改罚单发现或提醒记录。",
  "Select a customer above first.": "请先在上方选择用户。",
  "Send one test email to this customer.": "向此用户发送一封测试邮件。",
  "Test email accepted. Check Resend for delivery.":
    "测试邮件已提交，请在 Resend 查看投递状态。",
  "Send test ticket": "发送测试罚单",
  Appearance: "外观",
  "System theme": "跟随系统外观",
  "System language": "跟随系统语言",
  Light: "浅色",
  Dark: "深色",
  Language: "语言",
  "Checks do not send email. Test messages require explicit confirmation.":
    "运行检查不会发送邮件。测试邮件须明确确认后才会发送。",
  "Saving vehicle…": "正在保存车辆…",
  "Please wait before sending another message.": "发送过于频繁，请稍后再试。",
  "Check the subject and message.": "请检查主题和消息内容。",
  "Support inbox is full. Please try later.":
    "客服收件箱暂时已满，请稍后再试。",
  "No saved ticket is available for this customer.":
    "此用户暂无可用的已保存罚单。",
  "Customer not found.": "未找到已验证的用户。",
  "Daily account-action limit reached.": "已达到今日账户操作次数上限。",
  "Enter a valid new email address.": "请输入有效的新邮箱地址。",
  "Confirm this action first.": "请先确认此操作。",
  "Manage administrator accounts through their own account settings.":
    "管理员账户需通过其自身账户设置管理。",

  "Admin workspace": "管理工作台",
  "Admin sign in": "管理员登录",
  "Sign in": "登录",
  "Email address": "邮箱地址",
  Password: "密码",
  "New password": "新密码",
  "Show password": "显示密码",
  "Hide password": "隐藏密码",
  "Forgot password?": "忘记密码？",
  "Back to sign in": "返回登录",
  "Send reset link": "发送重置链接",
  "Save new password": "保存新密码",
  "Please wait…": "请稍候…",
  "Confirm your email before signing in.": "请先验证邮箱，再登录。",
  "Email or password is incorrect.": "邮箱或密码不正确。",
  "Security check failed. Please try again.": "安全验证失败，请重试。",
  "Too many attempts. Please wait before trying again.":
    "尝试次数过多，请稍后重试。",
  "Sign-in is unavailable right now. Please try again later.":
    "登录服务暂不可用，请稍后重试。",
  "Could not connect. Check your connection and try again.":
    "无法连接，请检查网络后重试。",
  "If you have an account, check your inbox for a reset link.":
    "如有此账户，请在收件箱查看密码重置链接。",
  "Use at least 8 characters, including a lowercase letter, an uppercase letter, and a digit.":
    "使用至少 8 个字符，包括小写字母、大写字母和数字。",
  Overview: "概览",
  Customers: "用户",
  Email: "邮件",
  Access: "权限",
  Status: "服务状态",
  Debug: "诊断",
  "Back to TicketSafe": "返回 TicketSafe",
  "Sign out": "退出登录",
  Refresh: "刷新",
  "Loading…": "加载中…",
  "Try again": "重试",
  "Admin access required": "需要管理员权限",
  "Sign in with your existing TicketSafe account.":
    "使用现有 TicketSafe 账户登录。",
  "Access is checked securely for every request.":
    "每次请求都会安全验证访问权限。",
  "This account does not have access to this action.": "此账户无权执行此操作。",
  "Your session expired. Please sign in again.": "会话已过期，请重新登录。",
  "CRM unavailable. Please try again.": "管理服务暂不可用，请重试。",
  "CRM returned an invalid response.": "管理服务返回了无效响应。",
  Admin: "管理员",
  "Master admin": "主管理员",
  Support: "客服",
  Workspace: "工作台",
  "Current account": "当前账户",
  "Your account has no CRM access.": "此账户没有管理工作台访问权限。",
  "Contact your master admin to request access.": "请联系主管理员申请权限。",
  "Total customers": "用户总数",
  "Verified accounts": "已验证账户",
  "Saved vehicles": "已保存车辆",
  "Online now": "当前在线",
  "Ticket email subscribers": "罚单邮件订阅者",
  "Announcement subscribers": "公告订阅者",
  "CRM emails sent today": "今日管理邮件发送数",
  "Emails pending": "待发送邮件",
  "Signed-in accounts active in the last 3 minutes.":
    "最近 3 分钟内活跃的已登录账户。",
  Accepted: "已受理",
  "Needs review": "需要核查",
  "Delivery uncertain. Check Resend before sending again.":
    "投递状态不确定，再次发送前请检查 Resend。",
  "Up to 100 email attempts daily; 10 campaigns per admin daily.":
    "每日最多尝试发送 100 封邮件；每位管理员每日最多 10 次群发。",
  complete: "已完成",
  review: "需要核查",
  "New email": "新邮件",
  Privacy: "隐私政策",
  Activity: "动态",
  "Customer accounts and notification subscriptions.": "用户账户及通知订阅。",
  "Manage customers": "管理用户",
  "Compose email": "撰写邮件",
  "Check services": "检查服务",
  "Only opted-in customers receive announcements.": "仅向已订阅用户发送公告。",
  "Find a customer": "查找用户",
  "Search by email": "按邮箱搜索",
  Search: "搜索",
  "All customers": "全部用户",
  Verified: "已验证",
  Unverified: "未验证",
  "Ticket emails": "罚单邮件",
  Announcements: "公告",
  "No customers found.": "未找到用户。",
  "View customer": "查看用户",
  Previous: "上一页",
  Next: "下一页",
  Page: "第",
  of: "页，共",
  "Customer details": "用户详情",
  Close: "关闭",
  Joined: "注册日期",
  "Last sign-in": "上次登录",
  Never: "从未",
  "Not available": "不可用",
  "Notification preferences": "通知偏好",
  Enabled: "已开启",
  Disabled: "已关闭",
  "No saved vehicles.": "没有已保存车辆。",
  "Customer notes": "用户备注",
  "Internal notes": "内部备注",
  Tags: "标签",
  "Separate tags with commas": "使用逗号分隔标签",
  "Save notes": "保存备注",
  Saved: "已保存",
  "Email this customer": "向此用户发送邮件",
  "Add CRM access": "添加管理权限",
  "Service message": "服务邮件",
  Announcement: "公告",
  Recipient: "收件人",
  "Select a customer": "选择用户",
  Subject: "主题",
  Message: "正文",
  "Preview email": "预览邮件",
  "Email preview": "邮件预览",
  Recipients: "收件人",
  "No eligible recipients.": "没有符合条件的收件人。",
  "Review before sending.": "发送前请核对内容。",
  "I confirm this service message is relevant to this account.":
    "我确认此服务邮件与该账户相关。",
  "Send to customers who opted in to announcements.":
    "发送给已同意接收公告的用户。",
  "Send email": "发送邮件",
  "Sending…": "发送中…",
  "Continue sending": "继续发送",
  Sent: "已发送",
  Failed: "失败",
  Remaining: "剩余",
  "Delivery history": "发送记录",
  "No email campaigns yet.": "暂无邮件发送记录。",
  "Support access can preview emails but cannot send them.":
    "客服权限可预览邮件，但不能发送。",
  "Select a customer from Customers to send a service message.":
    "请在用户页面选择收件人后发送服务邮件。",
  "Only current announcement opt-ins are included.":
    "仅包含当前已同意接收公告的用户。",
  Roles: "角色",
  "Master admin controls CRM access.": "主管理员管理工作台访问权限。",
  "Master access cannot be changed here.": "此处无法更改主管理员权限。",
  "Remove access": "移除权限",
  "Remove this account’s CRM access?": "移除此账户的管理工作台访问权限？",
  Remove: "移除",
  Cancel: "取消",
  "Edit role": "编辑角色",
  "Save role": "保存角色",
  "Choose a customer from Customers to add access.":
    "请从用户页面选择账户以添加管理权限。",
  Connections: "服务连接",
  "Connection checks run on demand.": "按需运行服务连接检查。",
  "Notification diagnostics": "通知诊断",
  "Run checks": "运行检查",
  "Dry run only. No customer emails are sent.":
    "仅进行诊断，不会向用户发送邮件。",
  "Send a test to my email": "向我的邮箱发送测试",
  "A real test email will be sent only to your signed-in address.":
    "仅向当前登录邮箱发送真实测试邮件。",
  "I want to receive a test email.": "我同意接收测试邮件。",
  "Test email sent": "测试邮件已发送",
  "Check a customer’s saved-vehicle notification setup.":
    "检查用户已保存车辆的通知配置。",
  "All notification checks": "全部通知检查",
  Ready: "就绪",
  Warning: "警告",
  Unavailable: "不可用",
  Pending: "等待中",
  Unknown: "未知",
  "No results yet.": "暂无结果。",
  "Clear selected customer": "清除所选用户",
  "Service messages must concern the account; promotional messages require announcement consent.":
    "服务邮件须与账户相关；推广邮件需要公告订阅同意。",
  "No passwords or payment details are shown here.":
    "此处不显示密码或支付信息。",
  "Role updated": "角色已更新",
  "Access removed": "权限已移除",
  "Access granted": "权限已授予",
  "Select role": "选择角色",
  "More recipients": "更多收件人",
  "Email queued": "邮件已排队",
  completed: "已完成",
  processing: "处理中",
  pending: "等待中",
  failed: "失败",
  sent: "已发送",
  healthy: "正常",
  ok: "正常",
  ready: "就绪",
  warning: "警告",
  error: "错误",
  disabled: "已关闭",
  not_configured: "未配置",
  unavailable: "不可用",
  Contact: "联系",
  CRM: "管理工作台",
};

function useCrmData<T>(
  client: SupabaseClient | null,
  action: string,
  input: Record<string, unknown> = {},
) {
  const [revision, setRevision] = useState(0);
  const inputKey = JSON.stringify({ action, input });
  const key = JSON.stringify({ action, input, revision });
  const [response, setResponse] = useState<{
    key: string;
    inputKey: string;
    data?: T;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    const parsed = JSON.parse(key);
    void crmClientRequest<T>(client, parsed.action, parsed.input).then(
      (data) => {
        if (alive) setResponse({ key, inputKey, data });
      },
      (error) => {
        if (alive)
          setResponse({
            key,
            inputKey,
            error:
              error instanceof Error
                ? error.message
                : "CRM unavailable. Please try again.",
          });
      },
    );
    return () => {
      alive = false;
    };
  }, [client, key, inputKey]);
  const current =
    response?.key === key ||
    (action === "me" && response?.inputKey === inputKey)
      ? response
      : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: !!client && response?.key !== key,
    reload: useCallback(() => setRevision((value) => value + 1), []),
  };
}

function Feedback({
  loading,
  error,
  retry,
  tr,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
  tr: Translate;
}) {
  if (error)
    return (
      <div className="crm-feedback crm-error" role="alert">
        <CircleX size={18} />
        <span>{tr(error)}</span>
        {retry && (
          <button className="crm-button" onClick={retry}>
            {tr("Try again")}
          </button>
        )}
      </div>
    );
  if (loading)
    return (
      <div className="crm-feedback" role="status">
        <LoaderCircle className="crm-spinner" size={18} />
        {tr("Loading…")}
      </div>
    );
  return null;
}

function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="crm-page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize = 20,
  onChange,
  tr,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
  tr: Translate;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="crm-pagination" aria-label={tr("Page")}>
      <button
        className="crm-button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label={tr("Previous")}
      >
        <ChevronLeft size={17} />
      </button>
      <span>
        {tr("Page")} {page} {tr("of")} {pages}
      </span>
      <button
        className="crm-button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label={tr("Next")}
      >
        <ChevronRight size={17} />
      </button>
    </nav>
  );
}

function roleLabel(role: CrmRole, tr: Translate) {
  return tr(
    role === "master" ? "Master admin" : role === "admin" ? "Admin" : "Support",
  );
}
function formatDate(
  value: string | null | undefined,
  locale: string,
  tr: Translate,
) {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
      }).format(new Date(value))
    : tr("Never");
}

async function sendStorageKey(userId: string, draft: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(draft),
  );
  const digest = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `ticketsafe.crm-send.${userId}.${digest}`;
}

export default function CrmDashboard() {
  const account = useSupabaseAccount();
  const { locale, ready: preferencesReady } = usePreferences();
  const tr: Translate = (text) =>
    locale === "zh" ? chinese[text] || text : text;
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const auth = useCrmData<{ admin: CrmAdmin }>(
    account.user ? account.client : null,
    "me",
    { userId: account.user?.id },
  );
  const [signOutError, setSignOutError] = useState("");
  const reloadAccess = auth.reload;
  useEffect(() => {
    if (!account.user) return;
    let checkedAt = Date.now();
    const recheck = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - checkedAt >= 30_000
      ) {
        checkedAt = Date.now();
        reloadAccess();
      }
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [account.user?.id, account.user, reloadAccess]);
  const admin = auth.data?.admin;
  const menu = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "customers", label: "Customers", icon: Users },
    { id: "email", label: "Email", icon: Mail },
    { id: "inbox", label: "Support inbox", icon: MessageSquare },
    { id: "access", label: "Access", icon: ShieldCheck },
    { id: "status", label: "Status", icon: Activity },
    { id: "debug", label: "Debug", icon: FlaskConical },
  ] as const;
  const signOut = async () => {
    try {
      const result = await account.client?.auth.signOut();
      if (result?.error) throw result.error;
    } catch {
      setSignOutError("CRM unavailable. Please try again.");
    }
  };
  if (
    !preferencesReady ||
    account.loading ||
    (account.user && auth.loading && !auth.data)
  )
    return (
      <main className="crm-entry">
        <div className="crm-entry-card">
          <div className="crm-brand">
            TicketSafe<span>.</span>
          </div>
          <Feedback loading tr={tr} />
        </div>
      </main>
    );
  if (!account.user || !admin)
    return (
      <main className="crm-entry">
        <div className="crm-entry-card">
          <Link href="/" className="crm-brand">
            TicketSafe<span>.</span>
          </Link>
          <p className="crm-eyebrow">{tr("Admin workspace")}</p>
          <h1>
            {tr(account.user ? "Admin access required" : "Admin sign in")}
          </h1>
          <p>
            {tr(
              account.user
                ? "Contact your master admin to request access."
                : "Sign in with your existing TicketSafe account.",
            )}
          </p>
          <Feedback
            error={
              auth.error ||
              (account.error ? "CRM unavailable. Please try again." : undefined)
            }
            retry={auth.reload}
            tr={tr}
          />
          {!account.user && account.client && (
            <CrmLogin
              client={account.client}
              captchaKey={account.configuration.hcaptchaKey}
              recovering={account.recovering}
              onComplete={auth.reload}
              tr={tr}
            />
          )}
          {account.user && (
            <button className="crm-button" onClick={signOut}>
              <LogOut size={16} />
              {tr("Sign out")}
            </button>
          )}
          <Link href="/" className="crm-back-link">
            <ArrowLeft size={16} />
            {tr("Back to TicketSafe")}
          </Link>
          <CrmDisplaySettings tr={tr} />
        </div>
      </main>
    );
  return (
    <div className="crm-shell">
      <header className="crm-header">
        <Link href="/" className="crm-brand">
          TicketSafe<span>.</span>
          <small>{tr("CRM")}</small>
        </Link>
        <div className="crm-header-actions">
          <CrmDisplaySettings tr={tr} />
          <span className="crm-role-badge">{roleLabel(admin.role, tr)}</span>
          <button
            className="crm-icon-button"
            onClick={signOut}
            aria-label={tr("Sign out")}
            title={tr("Sign out")}
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <aside className="crm-sidebar">
        <div className="crm-sidebar-label">{tr("Workspace")}</div>
        <nav aria-label={tr("Admin workspace")}>
          {menu.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={
                tab === id ? "crm-nav-button active" : "crm-nav-button"
              }
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{tr(label)}</span>
            </button>
          ))}
        </nav>
        <div className="crm-sidebar-account">
          <span>{tr("Current account")}</span>
          <strong>{admin.email}</strong>
          <Link href="/">
            <ArrowLeft size={15} />
            {tr("Back to TicketSafe")}
          </Link>
        </div>
      </aside>
      <main className="crm-main" id="crm-main">
        <Feedback error={signOutError} tr={tr} />
        {tab === "overview" && (
          <Overview client={account.client!} tr={tr} navigate={setTab} />
        )}
        {tab === "customers" && (
          <Customers
            client={account.client!}
            admin={admin}
            tr={tr}
            locale={locale}
            onEmail={(customer) => {
              setSelectedUser(customer);
              setTab("email");
            }}
          />
        )}
        {tab === "inbox" && (
          <CrmInbox client={account.client!} tr={tr} locale={locale} />
        )}
        {tab === "email" && (
          <EmailWorkspace
            client={account.client!}
            admin={admin}
            tr={tr}
            locale={locale}
            selectedUser={selectedUser}
            clearUser={() => setSelectedUser(null)}
            chooseUser={() => setTab("customers")}
          />
        )}
        {tab === "access" && (
          <AccessWorkspace
            client={account.client!}
            admin={admin}
            tr={tr}
            chooseUser={() => setTab("customers")}
          />
        )}
        {tab === "status" && (
          <StatusWorkspace client={account.client!} tr={tr} />
        )}
        {tab === "debug" && (
          <DebugWorkspace client={account.client!} admin={admin} tr={tr} />
        )}
      </main>
    </div>
  );
}

function Overview({
  client,
  tr,
  navigate,
}: {
  client: SupabaseClient;
  tr: Translate;
  navigate: (tab: Tab) => void;
}) {
  const result = useCrmData<CrmStats>(client, "stats");
  const reload = result.reload;
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 60_000);
    return () => clearInterval(id);
  }, [reload]);
  const metrics: { key: keyof CrmStats; label: string; icon: typeof Users }[] =
    [
      { key: "users", label: "Total customers", icon: Users },
      { key: "verifiedUsers", label: "Verified accounts", icon: CircleCheck },
      { key: "savedVehicles", label: "Saved vehicles", icon: Car },
      { key: "onlineUsers", label: "Online now", icon: Activity },
      {
        key: "ticketSubscribers",
        label: "Ticket email subscribers",
        icon: Mail,
      },
      {
        key: "announcementSubscribers",
        label: "Announcement subscribers",
        icon: Send,
      },
      { key: "emailsSentToday", label: "CRM emails sent today", icon: Check },
      { key: "pendingEmails", label: "Emails pending", icon: RefreshCw },
    ];
  return (
    <section>
      <PageHeading
        title={tr("Overview")}
        description={tr("Customer accounts and notification subscriptions.")}
      >
        <button
          className="crm-button"
          onClick={result.reload}
          disabled={result.loading}
        >
          <RefreshCw size={16} />
          {tr("Refresh")}
        </button>
      </PageHeading>
      <Feedback
        loading={result.loading}
        error={result.error}
        retry={result.reload}
        tr={tr}
      />
      {result.data && (
        <div className="crm-stats-grid">
          {metrics.map(({ key, label, icon: Icon }) => (
            <article className="crm-stat" key={key}>
              <div>
                <span>{tr(label)}</span>
                <Icon size={19} />
              </div>
              <strong>
                {new Intl.NumberFormat().format(result.data![key] || 0)}
              </strong>
              {key === "onlineUsers" && (
                <p>{tr("Signed-in accounts active in the last 3 minutes.")}</p>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="crm-quick-actions">
        <button onClick={() => navigate("customers")}>
          <Users size={22} />
          <span>{tr("Manage customers")}</span>
          <ArrowRight size={18} />
        </button>
        <button onClick={() => navigate("email")}>
          <Mail size={22} />
          <span>{tr("Compose email")}</span>
          <ArrowRight size={18} />
        </button>
        <button onClick={() => navigate("status")}>
          <Activity size={22} />
          <span>{tr("Check services")}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

function Customers({
  client,
  admin,
  tr,
  locale,
  onEmail,
}: {
  client: SupabaseClient;
  admin: CrmAdmin;
  tr: Translate;
  locale: string;
  onEmail: (customer: { id: string; email: string }) => void;
}) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);
  const result = useCrmData<CrmUsers>(client, "users", {
    search,
    filter,
    page,
    pageSize: 20,
  });
  return (
    <section>
      <PageHeading
        title={tr("Customers")}
        description={tr("No passwords or payment details are shown here.")}
      >
        <button
          className="crm-button"
          onClick={result.reload}
          disabled={result.loading}
        >
          <RefreshCw size={16} />
          {tr("Refresh")}
        </button>
      </PageHeading>
      <form
        className="crm-search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <label className="crm-search-input">
          <Search size={18} />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={tr("Search by email")}
            aria-label={tr("Search by email")}
            maxLength={120}
          />
        </label>
        <label className="crm-filter">
          <span className="crm-sr-only">{tr("Customers")}</span>
          <CrmSelect
            label={tr("Customers")}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
            options={[
              ["all", "All customers"],
              ["verified", "Verified"],
              ["unverified", "Unverified"],
              ["ticket_emails", "Ticket emails"],
              ["announcement_emails", "Announcements"],
            ].map(([value, label]) => ({ value, label: tr(label) }))}
          />
        </label>
        <button className="crm-button crm-primary" type="submit">
          {tr("Search")}
        </button>
      </form>
      <Feedback
        loading={result.loading}
        error={result.error}
        retry={result.reload}
        tr={tr}
      />
      {result.data && (
        <>
          <div className="crm-customer-list">
            {result.data.users.map((user) => (
              <button
                key={user.id}
                className="crm-customer-row"
                onClick={() => setDetail(user.id)}
              >
                <div className="crm-customer-avatar">
                  {(user.email || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="crm-customer-info">
                  <strong>{user.email}</strong>
                  <span>
                    {tr("Joined")} {formatDate(user.created_at, locale, tr)}
                  </span>
                  <div className="crm-customer-tags">
                    <span
                      className={
                        user.email_confirmed_at
                          ? "crm-tag crm-tag-success"
                          : "crm-tag"
                      }
                    >
                      {tr(user.email_confirmed_at ? "Verified" : "Unverified")}
                    </span>
                    {user.role && (
                      <span className="crm-tag">
                        {roleLabel(user.role, tr)}
                      </span>
                    )}
                    {user.ticket_emails && (
                      <span className="crm-tag">{tr("Ticket emails")}</span>
                    )}
                  </div>
                </div>
                <span className="crm-vehicle-count">
                  <Car size={16} />
                  {user.vehicle_count || 0}
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
          {!result.data.users.length && (
            <div className="crm-empty">{tr("No customers found.")}</div>
          )}
          <Pagination
            page={page}
            total={result.data.total}
            pageSize={result.data.pageSize || 20}
            onChange={setPage}
            tr={tr}
          />
        </>
      )}
      {detail && (
        <CustomerDetail
          key={detail}
          client={client}
          userId={detail}
          admin={admin}
          tr={tr}
          locale={locale}
          close={() => {
            setDetail(null);
            result.reload();
          }}
          onEmail={onEmail}
        />
      )}
    </section>
  );
}

function CustomerDetail({
  client,
  userId,
  admin,
  tr,
  locale,
  close,
  onEmail,
}: {
  client: SupabaseClient;
  userId: string;
  admin: CrmAdmin;
  tr: Translate;
  locale: string;
  close: () => void;
  onEmail: (customer: { id: string; email: string }) => void;
}) {
  const result = useCrmData<CrmUserDetail>(client, "user", { userId });
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="crm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="crm-customer-heading"
    >
      <div className="crm-dialog-heading">
        <h2 id="crm-customer-heading">{tr("Customer details")}</h2>
        <button
          className="crm-icon-button"
          onClick={close}
          aria-label={tr("Close")}
        >
          <X size={20} />
        </button>
      </div>
      <Feedback
        loading={result.loading}
        error={result.error}
        retry={result.reload}
        tr={tr}
      />
      {result.data && (
        <CustomerEditor
          client={client}
          detail={result.data}
          admin={admin}
          tr={tr}
          locale={locale}
          onEmail={() =>
            onEmail({ id: userId, email: result.data!.user.email })
          }
        />
      )}
    </dialog>
  );
}

function CustomerEditor({
  client,
  detail,
  admin,
  tr,
  locale,
  onEmail,
}: {
  client: SupabaseClient;
  detail: CrmUserDetail;
  admin: CrmAdmin;
  tr: Translate;
  locale: string;
  onEmail: () => void;
}) {
  const [notes, setNotes] = useState(detail.notes || "");
  const [tags, setTags] = useState((detail.tags || []).join(", "));
  const [role, setRole] = useState<"admin" | "support">("support");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const act = async (action: "notes_save" | "role_set") => {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      await crmClientRequest(
        client,
        action,
        action === "notes_save"
          ? {
              userId: detail.user.id,
              notes,
              tags: tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            }
          : { userId: detail.user.id, role },
      );
      setMessage(action === "notes_save" ? "Saved" : "Access granted");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="crm-customer-detail">
      <strong className="crm-customer-email">{detail.user.email}</strong>
      <dl className="crm-detail-facts">
        <div>
          <dt>{tr("Joined")}</dt>
          <dd>{formatDate(detail.user.created_at, locale, tr)}</dd>
        </div>
        <div>
          <dt>{tr("Last sign-in")}</dt>
          <dd>{formatDate(detail.user.last_sign_in_at, locale, tr)}</dd>
        </div>
        <div>
          <dt>{tr("Ticket emails")}</dt>
          <dd>{tr(detail.ticketEmails ? "Enabled" : "Disabled")}</dd>
        </div>
        <div>
          <dt>{tr("Announcements")}</dt>
          <dd>{tr(detail.announcementEmails ? "Enabled" : "Disabled")}</dd>
        </div>
      </dl>
      <button className="crm-button" onClick={onEmail}>
        <Mail size={16} />
        {tr("Email this customer")}
      </button>
      {admin.role !== "support" &&
        !detail.user.role &&
        detail.user.email_confirmed_at && (
          <CrmAccountActions
            key={detail.user.id}
            client={client}
            userId={detail.user.id}
            email={detail.user.email}
            tr={tr}
          />
        )}
      <h3>{tr("Saved vehicles")}</h3>
      <div className="crm-detail-vehicles">
        {detail.vehicles.map((vehicle) => (
          <div key={vehicle.id}>
            <Car size={18} />
            <div>
              <strong>{vehicle.nickname || vehicle.plate}</strong>
              <span>
                {vehicle.state} · {vehicle.plate}
                {vehicle.make ? ` · ${vehicle.make}` : ""}
                {vehicle.model ? ` ${vehicle.model}` : ""}
              </span>
            </div>
          </div>
        ))}
        {!detail.vehicles.length && <p>{tr("No saved vehicles.")}</p>}
      </div>
      <form
        className="crm-form"
        onSubmit={(event) => {
          event.preventDefault();
          void act("notes_save");
        }}
      >
        <h3>{tr("Customer notes")}</h3>
        <label>
          {tr("Internal notes")}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            maxLength={8000}
          />
        </label>
        <label>
          {tr("Tags")}
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            maxLength={500}
            placeholder={tr("Separate tags with commas")}
          />
        </label>
        <button className="crm-button crm-primary" disabled={!!busy}>
          {busy === "notes_save" ? (
            <LoaderCircle size={16} className="crm-spinner" />
          ) : (
            <Check size={16} />
          )}
          {tr("Save notes")}
        </button>
      </form>
      {admin.role === "master" && detail.user.role !== "master" && (
        <div className="crm-role-grant">
          <h3>{tr("Add CRM access")}</h3>
          <label>
            <span className="crm-sr-only">{tr("Select role")}</span>
            <CrmSelect
              label={tr("Select role")}
              value={role}
              onChange={(value) => setRole(value as "admin" | "support")}
              options={[
                { value: "support", label: tr("Support") },
                { value: "admin", label: tr("Admin") },
              ]}
            />
          </label>
          <button
            className="crm-button"
            onClick={() => void act("role_set")}
            disabled={!!busy || !detail.user.email_confirmed_at}
          >
            <ShieldCheck size={16} />
            {tr("Save role")}
          </button>
        </div>
      )}
      <Feedback error={error} tr={tr} />
      {message && (
        <p className="crm-success" role="status">
          <CircleCheck size={16} />
          {tr(message)}
        </p>
      )}
    </div>
  );
}

function EmailWorkspace({
  client,
  admin,
  tr,
  locale,
  selectedUser,
  clearUser,
  chooseUser,
}: {
  client: SupabaseClient;
  admin: CrmAdmin;
  tr: Translate;
  locale: string;
  selectedUser: { id: string; email: string } | null;
  clearUser: () => void;
  chooseUser: () => void;
}) {
  const [kind, setKind] = useState<"service" | "announcement">("service");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{
    key: string;
    data: CrmPreview;
  } | null>(null);
  const [confirmedKey, setConfirmedKey] = useState("");
  const [delivery, setDelivery] = useState<{
    key: string;
    idempotencyKey: string;
    result: CrmSendResult;
  } | null>(null);
  const sendAttempt = useRef<{ key: string; idempotencyKey: string } | null>(
    null,
  );
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const history = useCrmData<{
    emails: CrmEmail[];
    total: number;
    page: number;
    pageSize?: number;
  }>(client, "emails", { page });
  const input = {
    kind,
    ...(kind === "service" && selectedUser ? { userId: selectedUser.id } : {}),
    subject: subject.trim(),
    message: message.trim(),
  };
  const key = JSON.stringify(input);
  const currentPreview = preview?.key === key ? preview.data : null;
  const currentDelivery = delivery?.key === key ? delivery : null;
  const canPreview =
    !!input.subject &&
    !!input.message &&
    (kind === "announcement" || !!selectedUser) &&
    !busy;
  const canSend =
    admin.role !== "support" &&
    !!currentPreview?.eligible &&
    currentPreview.recipientCount > 0 &&
    confirmedKey === key &&
    !busy &&
    (!currentDelivery || currentDelivery.result.remaining > 0);
  const makePreview = async () => {
    setBusy("preview");
    setError("");
    setConfirmedKey("");
    try {
      const data = await crmClientRequest<CrmPreview>(
        client,
        "email_preview",
        input,
      );
      setPreview({ key, data });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };
  const send = async () => {
    if (!canSend) return;
    setBusy("send");
    setError("");
    try {
      if (sendAttempt.current?.key !== key) {
        const storageKey = await sendStorageKey(admin.userId, key);
        let idempotencyKey = crypto.randomUUID() as string;
        try {
          const remembered = sessionStorage.getItem(storageKey);
          if (remembered && /^[0-9a-f-]{36}$/i.test(remembered))
            idempotencyKey = remembered;
          sessionStorage.setItem(storageKey, idempotencyKey);
        } catch {
          /* A blocked-storage browser retains its in-memory retry key. */
        }
        sendAttempt.current = { key, idempotencyKey };
      }
      // Persist before sending so a lost response, tab switch, or reload does
      // not duplicate mail. Storage holds a digest and key, never the draft.
      const idempotencyKey = sendAttempt.current.idempotencyKey;
      const result = await crmClientRequest<CrmSendResult>(
        client,
        "email_send",
        { ...input, confirm: true, idempotencyKey },
      );
      setDelivery({ key, idempotencyKey, result });
      history.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };
  const newEmail = async () => {
    setBusy("preview");
    try {
      sessionStorage.removeItem(await sendStorageKey(admin.userId, key));
    } catch {
      /* Storage is optional. */
    }
    sendAttempt.current = null;
    setSubject("");
    setMessage("");
    setPreview(null);
    setDelivery(null);
    setConfirmedKey("");
    setError("");
    setBusy(null);
  };
  return (
    <section>
      <PageHeading
        title={tr("Email")}
        description={tr(
          "Service messages must concern the account; promotional messages require announcement consent.",
        )}
      >
        <button
          className="crm-button"
          disabled={!!busy}
          onClick={() => void newEmail()}
        >
          {tr("New email")}
        </button>
      </PageHeading>
      {admin.role === "support" && (
        <p className="crm-notice">
          {tr("Support access can preview emails but cannot send them.")}
        </p>
      )}
      <div className="crm-email-layout">
        <div className="crm-panel">
          <form
            className="crm-form"
            onSubmit={(event) => {
              event.preventDefault();
              void makePreview();
            }}
          >
            <fieldset className="crm-segmented">
              <legend className="crm-sr-only">{tr("Email")}</legend>
              {(["service", "announcement"] as const).map((value) => (
                <label className={kind === value ? "selected" : ""} key={value}>
                  <input
                    type="radio"
                    name="crm-email-kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    disabled={!!busy}
                  />
                  <span>
                    {tr(
                      value === "service" ? "Service message" : "Announcement",
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="crm-recipient">
              <span>{tr("Recipient")}</span>
              {kind === "service" ? (
                selectedUser ? (
                  <div>
                    <strong>{selectedUser.email}</strong>
                    <button
                      className="crm-icon-button"
                      type="button"
                      onClick={clearUser}
                      disabled={!!busy}
                      aria-label={tr("Clear selected customer")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="crm-button"
                    type="button"
                    onClick={chooseUser}
                  >
                    {tr("Select a customer")}
                    <ArrowRight size={16} />
                  </button>
                )
              ) : (
                <p>{tr("Only current announcement opt-ins are included.")}</p>
              )}
            </div>
            <label>
              {tr("Subject")}
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={150}
                required
                disabled={!!busy}
              />
            </label>
            <label>
              {tr("Message")}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={8}
                maxLength={10000}
                required
                disabled={!!busy}
              />
            </label>
            <button className="crm-button crm-primary" disabled={!canPreview}>
              {busy === "preview" ? (
                <LoaderCircle className="crm-spinner" size={16} />
              ) : (
                <Mail size={16} />
              )}
              {tr("Preview email")}
            </button>
          </form>
          <Feedback error={error} tr={tr} />
        </div>
        <div className="crm-panel crm-preview-panel">
          <h2>{tr("Email preview")}</h2>
          {currentPreview ? (
            <>
              <p className="crm-preview-count">
                <strong>{currentPreview.recipientCount}</strong>{" "}
                {tr("Recipients")}
              </p>
              <iframe
                title={tr("Email preview")}
                srcDoc={currentPreview.html}
                sandbox=""
                referrerPolicy="no-referrer"
                className="crm-email-preview"
              />
              <p className="crm-recipient-summary">
                {currentPreview.recipients
                  .slice(0, 5)
                  .map((recipient) => recipient.email)
                  .join(", ")}
                {currentPreview.recipientCount > 5
                  ? ` +${currentPreview.recipientCount - 5}`
                  : ""}
              </p>
              {!currentPreview.eligible ||
              currentPreview.recipientCount === 0 ? (
                <p className="crm-notice">{tr("No eligible recipients.")}</p>
              ) : (
                admin.role !== "support" && (
                  <>
                    <label className="crm-check-label">
                      <input
                        type="checkbox"
                        checked={confirmedKey === key}
                        onChange={(event) =>
                          setConfirmedKey(event.target.checked ? key : "")
                        }
                        disabled={
                          !!busy ||
                          (!!currentDelivery &&
                            currentDelivery.result.remaining === 0)
                        }
                      />
                      <span>
                        {tr(
                          kind === "service"
                            ? "I confirm this service message is relevant to this account."
                            : "Send to customers who opted in to announcements.",
                        )}
                      </span>
                    </label>
                    <button
                      className="crm-button crm-primary"
                      type="button"
                      disabled={!canSend}
                      onClick={() => void send()}
                    >
                      {busy === "send" ? (
                        <LoaderCircle className="crm-spinner" size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      {tr(
                        busy === "send"
                          ? "Sending…"
                          : currentDelivery?.result.remaining
                            ? "Continue sending"
                            : "Send email",
                      )}
                    </button>
                  </>
                )
              )}
              {currentDelivery && (
                <div className="crm-delivery-result" role="status">
                  <strong>{tr(currentDelivery.result.status)}</strong>
                  <span>
                    {tr("Accepted")}: {currentDelivery.result.sent} ·{" "}
                    {tr("Failed")}: {currentDelivery.result.failed} ·{" "}
                    {tr("Remaining")}: {currentDelivery.result.remaining}
                  </span>
                  {!!currentDelivery.result.uncertain && (
                    <span>
                      {tr("Needs review")}: {currentDelivery.result.uncertain}.{" "}
                      {tr(
                        "Delivery uncertain. Check Resend before sending again.",
                      )}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="crm-empty">
              <Mail size={28} />
              <p>{tr("Review before sending.")}</p>
            </div>
          )}
        </div>
      </div>
      <p className="crm-fine-print">
        {tr("Up to 100 email attempts daily; 10 campaigns per admin daily.")}
      </p>
      <div className="crm-panel crm-history">
        <h2>{tr("Delivery history")}</h2>
        <Feedback
          loading={history.loading}
          error={history.error}
          retry={history.reload}
          tr={tr}
        />
        {history.data && (
          <>
            {history.data.emails.map((email, index) => (
              <div
                className="crm-history-row"
                key={email.id || email.campaign_id || index}
              >
                <div>
                  <strong>
                    {email.subject ||
                      tr(
                        email.kind === "announcement"
                          ? "Announcement"
                          : "Service message",
                      )}
                  </strong>
                  <span>{formatDate(email.created_at, locale, tr)}</span>
                </div>
                <span className="crm-tag">{tr(email.status || "Pending")}</span>
              </div>
            ))}
            {!history.data.emails.length && (
              <p className="crm-empty">{tr("No email campaigns yet.")}</p>
            )}
            <Pagination
              page={page}
              total={history.data.total}
              pageSize={history.data.pageSize || 20}
              onChange={setPage}
              tr={tr}
            />
          </>
        )}
      </div>
    </section>
  );
}

function AccessWorkspace({
  client,
  admin,
  tr,
  chooseUser,
}: {
  client: SupabaseClient;
  admin: CrmAdmin;
  tr: Translate;
  chooseUser: () => void;
}) {
  const result = useCrmData<{ roles: CrmAccess[] }>(client, "roles");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [remove, setRemove] = useState<CrmAccess | null>(null);
  const [message, setMessage] = useState("");
  const update = async (row: CrmAccess, role?: "admin" | "support") => {
    setBusy(row.user_id);
    setError("");
    setMessage("");
    try {
      await crmClientRequest(client, role ? "role_set" : "role_remove", {
        userId: row.user_id,
        ...(role ? { role } : {}),
      });
      setMessage(role ? "Role updated" : "Access removed");
      setRemove(null);
      result.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <section>
      <PageHeading
        title={tr("Access")}
        description={tr("Master admin controls CRM access.")}
      >
        {admin.role === "master" && (
          <button className="crm-button crm-primary" onClick={chooseUser}>
            <Users size={16} />
            {tr("Add CRM access")}
          </button>
        )}
      </PageHeading>
      <Feedback
        loading={result.loading}
        error={result.error || error}
        retry={result.reload}
        tr={tr}
      />
      {message && (
        <p className="crm-success" role="status">
          <CircleCheck size={16} />
          {tr(message)}
        </p>
      )}
      {result.data && (
        <div className="crm-access-list">
          {result.data.roles.map((row) => (
            <article className="crm-access-row" key={row.user_id}>
              <div>
                <strong>{row.email}</strong>
                <span>{roleLabel(row.role, tr)}</span>
              </div>
              {row.role === "master" ? (
                <span className="crm-tag">
                  <ShieldCheck size={15} />
                  {tr("Master admin")}
                </span>
              ) : admin.role === "master" ? (
                <div className="crm-access-actions">
                  <label>
                    <span className="crm-sr-only">
                      {tr("Edit role")} {row.email}
                    </span>
                    <CrmSelect
                      label={`${tr("Edit role")}: ${row.email}`}
                      value={row.role}
                      disabled={!!busy}
                      onChange={(value) =>
                        void update(row, value as "admin" | "support")
                      }
                      options={[
                        { value: "admin", label: tr("Admin") },
                        { value: "support", label: tr("Support") },
                      ]}
                    />
                  </label>
                  <button
                    className="crm-button crm-danger"
                    disabled={!!busy}
                    onClick={() => setRemove(row)}
                    aria-label={`${tr("Remove access")}: ${row.email}`}
                  >
                    <X size={16} />
                    {tr("Remove")}
                  </button>
                </div>
              ) : (
                <span className="crm-tag">{roleLabel(row.role, tr)}</span>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="crm-fine-print">
        {tr(
          admin.role === "master"
            ? "Choose a customer from Customers to add access."
            : "Master admin controls CRM access.",
        )}
      </p>
      {remove && (
        <ConfirmDialog
          title={tr("Remove access")}
          tr={tr}
          close={() => setRemove(null)}
        >
          <p>{tr("Remove this account’s CRM access?")}</p>
          <strong className="crm-wrap">{remove.email}</strong>
          <Feedback error={error} tr={tr} />
          <div className="crm-dialog-actions">
            <button
              className="crm-button"
              onClick={() => setRemove(null)}
              disabled={!!busy}
            >
              {tr("Cancel")}
            </button>
            <button
              className="crm-button crm-danger"
              onClick={() => void update(remove)}
              disabled={!!busy}
            >
              {busy ? (
                <LoaderCircle className="crm-spinner" size={16} />
              ) : (
                <X size={16} />
              )}
              {tr("Remove access")}
            </button>
          </div>
        </ConfirmDialog>
      )}
    </section>
  );
}

function ConfirmDialog({
  title,
  tr,
  close,
  children,
}: {
  title: string;
  tr: Translate;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="crm-dialog crm-confirm-dialog"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="crm-confirm-heading"
    >
      <div className="crm-dialog-heading">
        <h2 id="crm-confirm-heading">{title}</h2>
        <button
          className="crm-icon-button"
          onClick={close}
          aria-label={tr("Close")}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function CheckList({ checks, tr }: { checks: CrmCheck[]; tr: Translate }) {
  return (
    <div className="crm-check-list">
      {checks.map((check) => {
        const healthy = [
          "ok",
          "healthy",
          "ready",
          "configured",
          "available",
          "pass",
          "passed",
        ].includes(check.state);
        const failed = [
          "error",
          "failed",
          "unavailable",
          "not_configured",
        ].includes(check.state);
        const Icon = healthy ? CircleCheck : failed ? CircleX : CircleHelp;
        return (
          <article className="crm-connection" key={check.name}>
            <Icon
              className={
                healthy
                  ? "crm-state-good"
                  : failed
                    ? "crm-state-bad"
                    : "crm-state-warning"
              }
              size={21}
            />
            <div>
              <h3>{tr(check.name)}</h3>
              <p>{tr(check.detail)}</p>
            </div>
            <span
              className={
                healthy
                  ? "crm-tag crm-tag-success"
                  : failed
                    ? "crm-tag crm-tag-error"
                    : "crm-tag"
              }
            >
              {tr(check.state || "Unknown")}
            </span>
          </article>
        );
      })}
    </div>
  );
}

function StatusWorkspace({
  client,
  tr,
}: {
  client: SupabaseClient;
  tr: Translate;
}) {
  const result = useCrmData<{ connections: CrmCheck[] }>(client, "status");
  return (
    <section>
      <PageHeading
        title={tr("Connections")}
        description={tr("Connection checks run on demand.")}
      >
        <button
          className="crm-button"
          disabled={result.loading}
          onClick={result.reload}
        >
          <RefreshCw size={16} />
          {tr("Refresh")}
        </button>
      </PageHeading>
      <Feedback
        loading={result.loading}
        error={result.error}
        retry={result.reload}
        tr={tr}
      />
      {result.data && <CheckList checks={result.data.connections} tr={tr} />}
    </section>
  );
}

function DebugWorkspace({
  client,
  admin,
  tr,
}: {
  client: SupabaseClient;
  admin: CrmAdmin;
  tr: Translate;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [userId, setUserId] = useState("");
  const users = useCrmData<CrmUsers>(client, "users", {
    search,
    page: 1,
    pageSize: 20,
  });
  const [result, setResult] = useState<{ checks: CrmCheck[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [testConfirmed, setTestConfirmed] = useState(false);
  const [testResult, setTestResult] = useState<CrmSendResult | null>(null);
  const testKey = useRef<string | null>(null);
  const run = async (test: boolean) => {
    setBusy(test ? "test" : "checks");
    setError("");
    try {
      if (test) {
        testKey.current ||= crypto.randomUUID();
        const sent = await crmClientRequest<CrmSendResult>(
          client,
          "test_email",
          { confirm: true, idempotencyKey: testKey.current },
        );
        setTestResult(sent);
        setTestConfirmed(false);
      } else {
        setResult(
          await crmClientRequest(client, "debug", userId ? { userId } : {}),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "CRM unavailable. Please try again.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <section>
      <PageHeading
        title={tr("Notification diagnostics")}
        description={tr(
          "Checks do not send email. Test messages require explicit confirmation.",
        )}
      />
      <div className="crm-panel">
        <form
          className="crm-search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setUserId("");
          }}
        >
          <label className="crm-search-input">
            <Search size={18} />
            <input
              type="search"
              placeholder={tr("Search by email")}
              aria-label={tr("Find a customer")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={120}
            />
          </label>
          <button className="crm-button" type="submit">
            {tr("Search")}
          </button>
        </form>
        <label className="crm-form-label">
          {tr("Customer details")}
          <CrmSelect
            label={tr("Customer details")}
            value={userId}
            onChange={(value) => {
              setUserId(value);
              setResult(null);
            }}
            disabled={!!busy}
            options={[
              { value: "", label: tr("All notification checks") },
              ...(users.data?.users.map((user) => ({
                value: user.id,
                label: user.email,
              })) || []),
            ]}
          />
        </label>
        <Feedback
          loading={users.loading}
          error={users.error}
          retry={users.reload}
          tr={tr}
        />
        <button
          className="crm-button crm-primary"
          disabled={!!busy}
          onClick={() => void run(false)}
        >
          {busy === "checks" ? (
            <LoaderCircle size={16} className="crm-spinner" />
          ) : (
            <FlaskConical size={16} />
          )}
          {tr("Run checks")}
        </button>
      </div>
      <Feedback error={error} tr={tr} />
      {result && <CheckList checks={result.checks} tr={tr} />}
      {admin.role !== "support" && (
        <CrmTicketTest key={userId} client={client} userId={userId} tr={tr} />
      )}
      {admin.role !== "support" && (
        <div className="crm-panel crm-test-panel">
          <h2>{tr("Send a test to my email")}</h2>
          <p>
            {tr(
              "A real test email will be sent only to your signed-in address.",
            )}
          </p>
          <strong className="crm-wrap">{admin.email}</strong>
          <label className="crm-check-label">
            <input
              type="checkbox"
              checked={testConfirmed}
              onChange={(event) => setTestConfirmed(event.target.checked)}
              disabled={!!busy || !!testResult}
            />
            <span>{tr("I want to receive a test email.")}</span>
          </label>
          <button
            className="crm-button"
            onClick={() => void run(true)}
            disabled={!testConfirmed || !!busy || !!testResult}
          >
            {busy === "test" ? (
              <LoaderCircle className="crm-spinner" size={16} />
            ) : (
              <Send size={16} />
            )}
            {tr("Send email")}
          </button>
          {testResult && (
            <p className="crm-success" role="status">
              <CircleCheck size={17} />
              {tr(
                testResult.uncertain
                  ? "Delivery uncertain. Check Resend before sending again."
                  : testResult.sent
                    ? "Test email sent"
                    : "Email queued",
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
