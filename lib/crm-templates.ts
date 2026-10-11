export type CrmEmailKind = "service" | "announcement";
export type CrmTemplateLanguage = "en" | "zh";
export type CrmTemplate = {
  id: string;
  kind: CrmEmailKind;
  name: string;
  content: Record<CrmTemplateLanguage, { subject: string; message: string }>;
};

export const CRM_TEMPLATES: CrmTemplate[] = [
  {
    id: "welcome",
    kind: "service",
    name: "Welcome and getting started",
    content: {
      en: {
        subject: "Welcome to TicketSafe",
        message:
          "Hi,\n\nThanks for creating a TicketSafe account. Here is how to get the most out of it:\n\n- Save your car in **Garage** so we can watch it for new tickets.\n- Turn on **New-ticket emails** under Account details.\n- Use **Map** to see where tickets were issued.\n\n[button: Open my garage](/?view=garage)\n\nIf you have any questions, reply to this email.\n\nThe TicketSafe team",
      },
      zh: {
        subject: "欢迎使用罚单卫士",
        message:
          "您好，\n\n感谢您注册罚单卫士账户。以下几步可帮助您充分使用：\n\n- 在**车库**中保存您的车辆，我们会为您留意新罚单。\n- 在账户详情中开启**新罚单邮件**。\n- 使用**地图**查看罚单开具地点。\n\n[button: 打开我的车库](/?view=garage)\n\n如有疑问，请直接回复此邮件。\n\n罚单卫士团队",
      },
    },
  },
  {
    id: "support-follow-up",
    kind: "service",
    name: "Support follow-up",
    content: {
      en: {
        subject: "Following up on your TicketSafe request",
        message:
          "Hi,\n\nThanks for contacting TicketSafe support about [topic]. [What we found or changed.]\n\nIf anything still doesn't look right, reply to this email and we'll take another look.\n\nThe TicketSafe team",
      },
      zh: {
        subject: "关于您的罚单卫士请求的跟进",
        message:
          "您好，\n\n感谢您就[问题]联系罚单卫士客服。[我们的发现或处理结果。]\n\n如仍有问题，请直接回复此邮件，我们会再次核查。\n\n罚单卫士团队",
      },
    },
  },
  {
    id: "issue-resolved",
    kind: "service",
    name: "Issue resolved",
    content: {
      en: {
        subject: "Your TicketSafe issue has been resolved",
        message:
          "Hi,\n\nGood news: the problem you reported with [feature] has been fixed. You don't need to do anything.\n\n[button: Open TicketSafe](/)\n\nThanks for letting us know.\n\nThe TicketSafe team",
      },
      zh: {
        subject: "您反馈的问题已解决",
        message:
          "您好，\n\n好消息：您反馈的[功能]问题已修复，无需进行任何操作。\n\n[button: 打开罚单卫士](/)\n\n感谢您的反馈。\n\n罚单卫士团队",
      },
    },
  },
  {
    id: "check-vehicle",
    kind: "service",
    name: "Check your saved car details",
    content: {
      en: {
        subject: "Please check your saved car on TicketSafe",
        message:
          "Hi,\n\nWe couldn't find NYC records for the plate saved as [plate]. This usually means the plate number, state, or plate type is slightly off.\n\nPlease open your garage and check:\n\n- Plate number (no spaces or dashes)\n- State\n- Plate type (for example, Passenger or Commercial)\n\n[button: Review my garage](/?view=garage)\n\nThe TicketSafe team",
      },
      zh: {
        subject: "请检查您在罚单卫士保存的车辆",
        message:
          "您好，\n\n我们未找到车牌 [车牌] 的纽约市记录。通常是车牌号、州或车牌类型有误。\n\n请打开车库并检查：\n\n- 车牌号（不含空格或连字符）\n- 州\n- 车牌类型（例如乘用车或商用车）\n\n[button: 查看我的车库](/?view=garage)\n\n罚单卫士团队",
      },
    },
  },
  {
    id: "enable-alerts",
    kind: "service",
    name: "Turn on ticket alerts",
    content: {
      en: {
        subject: "Get an email when your car gets a new ticket",
        message:
          "Hi,\n\nYou have a car saved on TicketSafe, but new-ticket emails are turned off. Turn them on and we'll email you as soon as a new ticket shows up, so you can pay or dispute it before late fees.\n\n[button: Turn on alerts](/?view=account)\n\nYou can turn them off any time.\n\nThe TicketSafe team",
      },
      zh: {
        subject: "车辆有新罚单时收到邮件提醒",
        message:
          "您好，\n\n您已在罚单卫士保存车辆，但尚未开启新罚单邮件。开启后，一旦发现新罚单我们会立即通知您，方便您在滞纳金产生前缴纳或申诉。\n\n[button: 开启提醒](/?view=account)\n\n您可随时关闭。\n\n罚单卫士团队",
      },
    },
  },
  {
    id: "feature-release",
    kind: "announcement",
    name: "New feature release",
    content: {
      en: {
        subject: "New in TicketSafe: [feature]",
        message:
          "## [Feature name] is here\n\n[One or two sentences on what it does and why it helps.]\n\n- [Highlight one]\n- [Highlight two]\n- [Highlight three]\n\n[button: Try it now](/)\n\nThanks for using TicketSafe.",
      },
      zh: {
        subject: "罚单卫士新功能：[功能]",
        message:
          "## [功能名称] 上线了\n\n[用一两句话介绍功能及其用途。]\n\n- [亮点一]\n- [亮点二]\n- [亮点三]\n\n[button: 立即体验](/)\n\n感谢您使用罚单卫士。",
      },
    },
  },
  {
    id: "maintenance",
    kind: "announcement",
    name: "Scheduled maintenance",
    content: {
      en: {
        subject: "Scheduled TicketSafe maintenance on [date]",
        message:
          "We're doing planned maintenance on **[date] from [start time] to [end time] ET**.\n\nDuring this window, searches and ticket alerts may be delayed. Your saved cars and settings are not affected, and any alerts will be sent once we're back.\n\nThanks for your patience.",
      },
      zh: {
        subject: "罚单卫士将于[日期]进行例行维护",
        message:
          "我们将于**美东时间 [日期] [开始时间] 至 [结束时间]**进行计划维护。\n\n维护期间，查询和罚单提醒可能会延迟。您保存的车辆和设置不受影响，恢复后将补发提醒。\n\n感谢您的耐心。",
      },
    },
  },
  {
    id: "service-restored",
    kind: "announcement",
    name: "Service restored",
    content: {
      en: {
        subject: "TicketSafe is back to normal",
        message:
          "Between [start time] and [end time] on [date], [what was affected] was unavailable. The issue is fixed and everything is working normally again.\n\nAny delayed ticket alerts have now been sent. You don't need to do anything.\n\nSorry for the trouble.",
      },
      zh: {
        subject: "罚单卫士已恢复正常",
        message:
          "[日期] [开始时间] 至 [结束时间] 期间，[受影响的功能]暂时无法使用。问题已修复，一切恢复正常。\n\n延迟的罚单提醒已全部补发，您无需进行任何操作。\n\n给您带来不便，敬请谅解。",
      },
    },
  },
  {
    id: "parking-rules",
    kind: "announcement",
    name: "Parking rules reminder",
    content: {
      en: {
        subject: "Heads up: [parking rule change] on [date]",
        message:
          "## Parking reminder\n\nAlternate side parking is suspended on [date] for [holiday].\n\n- Meters: [in effect / suspended]\n- Street cleaning: [in effect / suspended]\n\nRules can change at short notice, so check posted signs before you park.\n\n[button: Check my car for tickets](/?view=garage)",
      },
      zh: {
        subject: "提醒：[日期] [停车规则变化]",
        message:
          "## 停车提醒\n\n[日期] 因 [节日] 暂停交替停车规则。\n\n- 咪表：[照常 / 暂停]\n- 街道清扫：[照常 / 暂停]\n\n规则可能临时调整，停车前请留意现场标识。\n\n[button: 查看我的车辆罚单](/?view=garage)",
      },
    },
  },
  {
    id: "feedback-request",
    kind: "announcement",
    name: "Ask for feedback",
    content: {
      en: {
        subject: "Help us make TicketSafe better",
        message:
          "We're planning what to build next and would love to hear from you.\n\nWhat's one thing TicketSafe could do better? Send us a note from **Account → Support**. It only takes a minute.\n\n[button: Share feedback](/?view=account)\n\nThank you!",
      },
      zh: {
        subject: "帮助我们改进罚单卫士",
        message:
          "我们正在规划下一步的功能，非常希望听到您的意见。\n\n您觉得罚单卫士哪里可以做得更好？请通过**账户 → 客服**告诉我们，只需一分钟。\n\n[button: 提交反馈](/?view=account)\n\n谢谢！",
      },
    },
  },
];

const placeholderPattern = /\[(?!button:)([^\]\n]{1,60})\](?!\()/g;

export function unfilledPlaceholders(text: string) {
  return [...new Set([...text.matchAll(placeholderPattern)].map((m) => m[0]))];
}

export type SavedCrmTemplate = {
  id: string;
  name: string;
  kind: CrmEmailKind;
  subject: string;
  message: string;
};

const savedKey = (userId: string) => `ticketsafe.crm-templates.${userId}`;

export function readSavedTemplates(userId: string): SavedCrmTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedKey(userId)) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is SavedCrmTemplate =>
            typeof item?.id === "string" &&
            typeof item.name === "string" &&
            (item.kind === "service" || item.kind === "announcement") &&
            typeof item.subject === "string" &&
            typeof item.message === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function writeSavedTemplates(
  userId: string,
  templates: SavedCrmTemplate[],
) {
  try {
    localStorage.setItem(savedKey(userId), JSON.stringify(templates));
    return true;
  } catch {
    return false;
  }
}
