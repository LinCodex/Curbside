// Customer-facing release notes shown in Account → What's new. Keep this in
// step with CHANGELOG.md and the package version; newest release first.
export type ChangelogText = { en: string; zh: string };
export type ChangelogRelease = {
  version: string | null;
  date: string;
  title: ChangelogText;
  changes: ChangelogText[];
};

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: "1.2.0",
    date: "2026-10-11",
    title: { en: "Smoother start and automatic updates", zh: "上手更顺畅，自动更新" },
    changes: [
      {
        en: "New accounts start with new-ticket emails on during the welcome tour, with a Turn off button right there.",
        zh: "新账户在欢迎导览中默认开启新罚单邮件，并可在导览中直接关闭。",
      },
      {
        en: "The Home Screen app now updates itself to the newest version when you open it.",
        zh: "主屏幕 App 打开时会自动更新到最新版本。",
      },
      {
        en: "Typing a plate with a Chinese keyboard no longer repeats the pinyin.",
        zh: "使用中文键盘输入车牌时，不再重复出现拼音。",
      },
      {
        en: "Privacy and legal pages stay in Chinese when you switch between them.",
        zh: "在隐私与法律页面之间切换时，页面会保持中文显示。",
      },
      {
        en: "Email choices are ready as soon as you sign in, with no loading flash.",
        zh: "登录后即可看到邮件选项，不再闪现加载状态。",
      },
      {
        en: "The guided tour shows once per account, on any device.",
        zh: "功能导览每个账户只自动显示一次，无论使用哪台设备。",
      },
      {
        en: "A reminder to check your spam folder for the verification email.",
        zh: "提醒您在垃圾邮件文件夹中查找验证邮件。",
      },
      {
        en: "Safari’s top and bottom bars match the page in light and dark mode on iPhone.",
        zh: "在 iPhone 上，Safari 顶部和底部栏会与页面的浅色或深色模式保持一致。",
      },
      {
        en: "A cleaner footer with Help & support and Cookie settings side by side, and the floating Edit search button removed.",
        zh: "页面底部更简洁：“帮助与支持”和“Cookie 设置”并排显示，并移除了悬浮的“修改查询”按钮。",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-11",
    title: { en: "Easier settings and navigation", zh: "设置与导航更简单" },
    changes: [
      {
        en: "Notifications now open from Account, right under Account details.",
        zh: "通知设置现在位于账户页的“账户详情”下方，点击即可打开。",
      },
      {
        en: "Saved email choices appear immediately after a refresh.",
        zh: "刷新页面后，已保存的邮件选项会立即显示。",
      },
      {
        en: "A short guided tour after sign-in, with a Skip button.",
        zh: "登录后提供简短的功能导览，可随时跳过。",
      },
      {
        en: "Browser Back now returns to the previous Garage, Search, Map or Account view.",
        zh: "浏览器“返回”现在会回到上一个车库、查询、地图或账户页面。",
      },
      {
        en: "Saving a searched plate continues after you confirm a new account.",
        zh: "新账户确认后，会继续保存您之前查询的车牌。",
      },
      {
        en: "On phones, swipe the map panel to collapse or expand it, and pinch to zoom the backup map.",
        zh: "在手机上，可滑动收起或展开地图面板，并可双指缩放备用地图。",
      },
      {
        en: "A quick Edit search button after scrolling long results on phones.",
        zh: "在手机上滚动较长结果后，可通过“修改查询”按钮快速返回。",
      },
      {
        en: "Android browsers can install TicketSafe directly from the install guide.",
        zh: "Android 浏览器可直接从安装指南安装罚单卫士。",
      },
      {
        en: "A Help & support link in the page footer, and form fields stay visible above the keyboard on small phones.",
        zh: "页面底部新增“帮助与支持”链接；在小屏手机上，输入框会保持在键盘上方可见。",
      },
      {
        en: "Release notes are available in Account.",
        zh: "可在账户页查看更新说明。",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-04",
    title: { en: "First production release", zh: "首个正式版本" },
    changes: [
      {
        en: "NYC parking and camera ticket searches, including out-of-state plates and records back to FY2014.",
        zh: "查询纽约市停车及摄像头罚单，包括外州车牌及 2014 财年以来的记录。",
      },
      {
        en: "A private garage for saved cars with balances, filters and full ticket histories.",
        zh: "私人车库：保存车辆并查看余额、筛选及完整罚单记录。",
      },
      {
        en: "Ticket maps with matched addresses and approximate areas.",
        zh: "罚单地图，显示匹配地址及大致区域。",
      },
      {
        en: "Optional new-ticket emails for saved cars.",
        zh: "可选的已保存车辆新罚单邮件提醒。",
      },
      {
        en: "English and Chinese, light and dark themes, and a Home Screen web app.",
        zh: "支持中英文、浅色及深色主题，并可添加到主屏幕。",
      },
      {
        en: "Faster, more reliable city-record loading and clearer partial results.",
        zh: "更快、更可靠地加载城市记录，部分结果说明更清晰。",
      },
    ],
  },
  {
    version: null,
    date: "2026-09-27 – 2026-10-03",
    title: { en: "Development previews", zh: "开发预览" },
    changes: [
      {
        en: "First Curbside ticket dashboard with bilingual themes and Mapbox maps.",
        zh: "首个 Curbside 罚单面板，支持双语主题和 Mapbox 地图。",
      },
      {
        en: "Accounts, saved vehicles and shared vehicle histories.",
        zh: "账户、保存车辆及共享车辆记录。",
      },
      {
        en: "Renamed to TicketSafe with branded account emails.",
        zh: "更名为罚单卫士，并启用品牌账户邮件。",
      },
      {
        en: "Privacy controls, cookie choices and private support messages.",
        zh: "隐私控制、Cookie 选择及私人支持留言。",
      },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG.find((r) => r.version)!.version!;
