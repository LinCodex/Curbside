import { renderEmailMap } from "./email-map";
import {
  cleanLocationLabel,
  geoSearchLocation,
  hasPoint,
} from "./map-locations";
import type { Location } from "./domain";
export type TicketEmailDetail = {
  id: string;
  plate: string;
  state: string;
  nickname: string;
  description: string;
  issued: string | null;
  time: string | null;
  due: number | null;
  status: string;
  location: Location;
};
export type TicketEmailContent = {
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    content_type: string;
    content_id: string;
  }>;
};
export const OFFICIAL_TICKET_PAYMENT =
  "https://a836-citypay.nyc.gov/citypay/Parking";
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const string = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";
export function readTicketEmailDetails(input: unknown): TicketEmailDetail[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).flatMap((item) => {
    if (
      !item ||
      !/^\d{8,12}$/.test(item.id) ||
      !/^[A-Z0-9]{1,10}$/.test(item.plate) ||
      !/^[A-Z]{2}$/.test(item.state)
    )
      return [];
    const location: Location = {
      label: string(item.location?.label, 200),
      precision: ["address", "intersection", "approximate"].includes(
        item.location?.precision,
      )
        ? item.location.precision
        : "unknown",
    };
    if (
      typeof item.location?.lat === "number" &&
      typeof item.location?.lng === "number" &&
      hasPoint(item.location)
    )
      Object.assign(location, {
        lat: item.location.lat,
        lng: item.location.lng,
      });
    return [
      {
        id: item.id,
        plate: item.plate,
        state: item.state,
        nickname: string(item.nickname, 60),
        description: string(item.description, 200),
        issued: /^\d{4}-\d{2}-\d{2}$/.test(item.issued) ? item.issued : null,
        time: string(item.time, 30) || null,
        due:
          typeof item.due === "number" &&
          Number.isFinite(item.due) &&
          item.due >= 0 &&
          item.due <= 1e7
            ? item.due
            : null,
        status: string(item.status, 80),
        location,
      },
    ];
  });
}
/** Public NYC address lookup only; never send the plate, account or nickname. */
export async function enrichTicketEmailDetails(
  details: TicketEmailDetail[],
  send: typeof fetch = fetch,
) {
  const result = details.map((detail) => ({
    ...detail,
    location: { ...detail.location },
  }));
  for (let start = 0; start < result.length; start += 4)
    await Promise.all(
      result.slice(start, start + 4).map(async (detail) => {
        if (
          hasPoint(detail.location) ||
          !detail.location.label ||
          !["address", "intersection"].includes(detail.location.precision)
        )
          return;
        try {
          const url = new URL("https://geosearch.planninglabs.nyc/v2/search");
          url.searchParams.set(
            "text",
            cleanLocationLabel(detail.location.label),
          );
          url.searchParams.set("size", "1");
          const response = await send(url, {
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) return;
          const data = await response.json(),
            match = geoSearchLocation(detail.location, data.features?.[0]);
          if (match) detail.location = match;
        } catch {
          /* Unknown locations remain explicitly unknown. */
        }
      }),
    );
  return result;
}
export async function detailedTicketEmail(
  count: number,
  language: string,
  garageUrl: string,
  unsubscribeUrl: string,
  details: TicketEmailDetail[],
): Promise<TicketEmailContent> {
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
    throw new Error("Invalid ticket count");
  for (const url of [garageUrl, unsubscribeUrl])
    if (new URL(url).protocol !== "https:")
      throw new Error("Invalid email link");
  const zh = language === "zh",
    copy = (en: string, cn: string) => (zh ? cn : en);
  const money = (amount: number) =>
    new Intl.NumberFormat(zh ? "zh-CN" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  const selected = readTicketEmailDetails(details),
    known = selected.filter((ticket) => ticket.due !== null),
    total = known.reduce((sum, ticket) => sum + ticket.due!, 0);
  const complete = known.length === count;
  const amountLabel = complete
    ? copy("Reported balance for these new tickets", "这些新罚单的报告余额")
    : copy("Known balance for tickets shown", "已显示罚单的已知余额");
  const points = selected.flatMap((ticket, index) =>
    hasPoint(ticket.location)
      ? [
          {
            lat: ticket.location.lat!,
            lng: ticket.location.lng!,
            number: index + 1,
          },
        ]
      : [],
  );
  const map = await renderEmailMap(points);
  const summary = copy(
    `${count} newly found ticket${count === 1 ? "" : "s"} for your saved vehicles.`,
    `您保存的车辆中发现 ${count} 张新罚单。`,
  );
  const ticketText = selected
    .map(
      (ticket, index) =>
        `${index + 1}. ${ticket.nickname || ticket.plate} · ${ticket.state} ${ticket.plate}\n${copy("Ticket", "罚单")} #${ticket.id} · ${ticket.description || copy("Description unavailable", "暂无描述")}\n${ticket.issued || copy("Date unavailable", "日期未知")}${ticket.time ? " · " + ticket.time : ""}\n${copy("Reported balance", "报告余额")}: ${ticket.due === null ? copy("Unknown — verify with NYC", "未知，请向纽约市核实") : money(ticket.due)}\n${ticket.location.label || copy("Location unavailable", "地点未知")}`,
    )
    .join("\n\n");
  const rows = selected
    .map(
      (ticket, index) =>
        `<tr><td style="padding:22px 0;border-top:1px solid #303943"><p style="margin:0 0 9px;color:#a6adb8;font-size:12px;letter-spacing:1px">${index + 1} / ${escape(ticket.nickname || copy("SAVED VEHICLE", "保存的车辆"))} · ${escape(ticket.state + " " + ticket.plate)}</p><h2 style="margin:0 0 10px;font-size:18px;font-weight:600;color:#f5f6f8">${escape(ticket.description || copy("NYC violation", "纽约市违章"))}</h2><p style="margin:0;color:#c1c8d0;font-size:13px;line-height:1.8">${copy("Ticket", "罚单")} #${escape(ticket.id)}<br>${escape(ticket.issued || copy("Date unavailable", "日期未知"))}${ticket.time ? " · " + escape(ticket.time) : ""}<br>${escape(ticket.location.label || copy("Location unavailable", "地点未知"))}${hasPoint(ticket.location) ? " · " + copy("Map pin", "地图标记") + " " + (index + 1) : ""}</p><p style="margin:12px 0;color:#f0c17d;font-size:20px;font-weight:600">${ticket.due === null ? copy("Balance unknown", "余额未知") : money(ticket.due)}</p><p style="margin:0;color:#a6adb8;font-size:12px">${copy("Reported balance. Confirm the current amount and status with NYC.", "报告余额。请向纽约市核实当前金额及状态。")}</p><p style="margin:14px 0 0"><a href="${OFFICIAL_TICKET_PAYMENT}" style="color:#8cbbff;font-size:14px;text-decoration:underline">${copy("Review or pay at NYC CityPay →", "前往纽约市 CityPay 查看或支付 →")}</a></p></td></tr>`,
    )
    .join("");
  const warning = copy(
    "City records may be delayed or incomplete. A newly found record may be older. Verify the ticket, balance and deadlines with NYC before paying. TicketSafe is independent of NYC.",
    "市政府记录可能延迟或不完整。首次发现的记录可能属于较早日期。付款前请向纽约市核实罚单、余额及期限。罚单卫士与纽约市政府无关联。",
  );
  const overflow =
    count > selected.length
      ? copy(
          `Showing ${selected.length} of ${count} new tickets. Open your garage for every ticket and your saved-vehicle totals.`,
          `显示 ${count} 张新罚单中的 ${selected.length} 张。打开车库查看全部罚单及保存车辆的总余额。`,
        )
      : copy(
          "Only new tickets trigger this email; balance changes alone do not.",
          "本邮件仅由新罚单触发，余额变动不会单独触发。",
        );
  const html = `<!doctype html><html lang="${zh ? "zh-CN" : "en"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"></head><body style="margin:0;background:#0b0d10;color:#f5f6f8;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escape(summary)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0d10"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#191c21;border:1px solid #303943;border-radius:20px"><tr><td style="padding:30px 28px"><p style="margin:0 0 32px;font-size:25px;font-weight:bold;letter-spacing:-1px">${copy("TicketSafe", "罚单卫士")}<span style="color:#8cbbff">.</span></p><p style="margin:0 0 12px;color:#8cbbff;font-size:12px;letter-spacing:2px">${copy("YOUR SAVED VEHICLES", "您保存的车辆")}</p><h1 style="margin:0 0 16px;font-size:30px;line-height:1.15">${copy("New tickets. A clearer next step.", "新罚单，清晰掌握。")}</h1><p style="margin:0 0 22px;color:#c1c8d0;line-height:1.7">${escape(summary)}</p><p style="margin:0;color:#a6adb8;font-size:12px">${amountLabel}</p><p style="margin:8px 0 24px;color:#f0c17d;font-size:34px;font-weight:bold">${known.length ? money(total) : copy("Unknown", "未知")}</p>${!complete ? `<p style="color:#a6adb8;font-size:12px">${copy("This is a partial total; unknown or omitted balances are excluded.", "此为部分合计，不包含未知或未显示的余额。")}</p>` : ""}<a href="${escape(garageUrl)}" style="display:inline-block;background:#8cbbff;color:#101820;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">${copy("Open my garage →", "打开我的车库 →")}</a><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px">${rows}</table>${map ? `<h2 style="font-size:18px;margin:26px 0 12px">${copy("Where the tickets happened", "罚单地点")}</h2><img src="cid:ticketsafe-map" width="544" alt="${copy("NYC overview with numbered ticket locations", "纽约市概览及编号罚单地点")}" style="display:block;width:100%;height:auto;border-radius:12px"><p style="color:#a6adb8;font-size:12px;line-height:1.6">${copy("Numbers match the tickets above. Approximate locations; tickets without reliable coordinates remain unpinned. Map: NYC DCP Borough Boundaries.", "编号与上述罚单对应。地点可能为近似位置，没有可靠坐标的罚单不会标记。地图来源：纽约市城市规划局行政区边界。")}</p>` : `<p style="color:#a6adb8;font-size:13px">${copy("A location map is unavailable for these records. Check the location text above and your garage.", "这些记录暂无地点地图，请查看上述地点文字及车库。")}</p>`}<p style="color:#c1c8d0;font-size:13px;line-height:1.6">${escape(overflow)}</p><p style="color:#a6adb8;font-size:12px;line-height:1.7;border-top:1px solid #303943;padding-top:20px">${warning}</p><p style="font-size:12px"><a href="${escape(unsubscribeUrl)}" style="color:#a6adb8">${copy("Turn off new-ticket emails", "关闭新罚单邮件")}</a> · <a href="${escape(new URL("/legal/privacy", garageUrl).toString())}" style="color:#a6adb8">${copy("Privacy", "隐私政策")}</a></p></td></tr></table></td></tr></table></body></html>`;
  return {
    subject: copy(
      "TicketSafe: new tickets for your saved vehicles",
      "罚单卫士：保存车辆有新罚单",
    ),
    text: `${copy("TicketSafe", "罚单卫士")}\n\n${summary}\n${amountLabel}: ${known.length ? money(total) : copy("Unknown", "未知")}\n\n${ticketText}\n\n${overflow}\n\n${copy("Review or pay at NYC CityPay", "前往纽约市 CityPay 查看或支付")}: ${OFFICIAL_TICKET_PAYMENT}\n${copy("Enter the ticket number shown above.", "请输入上述罚单编号。")}\n\n${copy("Open my garage", "打开我的车库")}: ${garageUrl}\n\n${warning}\n\n${copy("Turn off new-ticket emails", "关闭新罚单邮件")}: ${unsubscribeUrl}`,
    html,
    ...(map
      ? {
          attachments: [
            {
              filename: "ticketsafe-ticket-locations.png",
              content: map,
              content_type: "image/png",
              content_id: "ticketsafe-map",
            },
          ],
        }
      : {}),
  };
}
