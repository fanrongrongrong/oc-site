// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;

/*
  OC 小组件
  图片放在：iCloud 云盘 / Scriptable / oc-widget / <folder> /
    文件名用状态开头：morning*.png  day*.png  evening*.png  night*.png  tap*.png（被戳后显示）
    同一状态放几张就随机换几张；没有对应状态的图就用 default*.png，再没有就用文件夹里任意一张
  多个角色：照 wuyue 的格式在 OCS 里再加一个，长按小组件 → 编辑小组件 → Parameter 填它的 key
*/

const OCS = {
  wuyue: {
    name: "雾月",
    color: "#9A6FD0",
    bg: "#FFFFFF",          // 图是白底就填白色；图抠成透明背景后删掉这行，会变成代表色渐变
    folder: "wuyue",
    url: "https://fanrongrongrong.github.io/oc-site/",
    lines: {
      morning: ["……早。", "头发还没梳好。别看。", "上午有试装，早饭不吃了。"],
      day: ["在画图。有事吗。", "那个颜色……不对。", "午饭？便利店的饭团。"],
      evening: ["去工作室待一会儿。", "今天的采访……都是准备好的答案。", "……你作业写完了吗。"],
      night: ["还不睡？", "今晚月亮很亮。……你也早点睡。", "（趴在草图上睡着了）"],
      tap: ["……干嘛。", "是吗。", "没事的话我继续画了。", "……下一个问题。"],
    },
  },
};

// [从几点开始, 状态]
const SCHEDULE = [[6, "morning"], [10, "day"], [18, "evening"], [23, "night"]];
const LABELS = { morning: "早上", day: "白天", evening: "傍晚", night: "深夜", tap: "被戳了" };
const TAP_MINUTES = 10;   // 戳完之后多久内显示「被戳」状态

/* ---------------- 以下不用改 ---------------- */

const fm = FileManager.iCloud();
const root = fm.joinPath(fm.documentsDirectory(), "oc-widget");
if (!fm.fileExists(root)) fm.createDirectory(root, true);

const key = OCS[(args.widgetParameter || "").trim()] ? args.widgetParameter.trim() : Object.keys(OCS)[0];
const oc = OCS[key];
const dir = fm.joinPath(root, oc.folder);
if (!fm.fileExists(dir)) fm.createDirectory(dir, true);

const statePath = fm.joinPath(root, "state.json");
let store = {};
if (fm.fileExists(statePath)) {
  await fm.downloadFileFromiCloud(statePath);
  store = JSON.parse(fm.readString(statePath));
}
store[key] = store[key] || { pets: 0, lastTap: 0 };
const me = store[key];
const save = () => fm.writeString(statePath, JSON.stringify(store));

const pick = a => a[Math.floor(Math.random() * a.length)];

function stateAt(hour) {
  let s = SCHEDULE[SCHEDULE.length - 1][1];
  for (const [start, name] of SCHEDULE) if (hour >= start) s = name;
  return s;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, "0");
  return "#" + c(n >> 16) + c((n >> 8) & 255) + c(n & 255);
}

function placeholder() {
  const ctx = new DrawContext();
  ctx.size = new Size(200, 200);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setFillColor(new Color(oc.color));
  ctx.fillEllipse(new Rect(10, 10, 180, 180));
  ctx.setFont(Font.boldSystemFont(84));
  ctx.setTextColor(Color.white());
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(oc.name.slice(0, 1), new Rect(0, 48, 200, 110));
  return ctx.getImage();
}

async function imageFor(state) {
  const files = fm.listContents(dir).filter(f => /\.(png|jpe?g|gif|heic|webp)$/i.test(f));
  const group = p => files.filter(f => f.toLowerCase().startsWith(p));
  const list = [group(state), group("default"), files].find(l => l.length);
  if (!list) return placeholder();
  const path = fm.joinPath(dir, pick(list));
  await fm.downloadFileFromiCloud(path);
  return fm.readImage(path);
}

let ink = "#ffffff";
function text(parent, str, size, { bold = false, opacity = 1, lines = 0, center = false } = {}) {
  const t = parent.addText(str);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = new Color(ink, opacity);
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.7;
  if (center) t.centerAlignText();
  return t;
}

function image(parent, img, w, h) {
  const i = parent.addImage(img);
  i.imageSize = new Size(w, h);
  i.applyFittingContentMode();
  return i;
}

async function build(family) {
  const tapped = Date.now() - me.lastTap < TAP_MINUTES * 60 * 1000;
  const state = tapped ? "tap" : stateAt(new Date().getHours());
  const img = await imageFor(state);
  const line = pick(oc.lines[state] || oc.lines.day);

  const w = new ListWidget();
  w.url = URLScheme.forRunningScript() + "?tap=1&oc=" + encodeURIComponent(key);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  if (family.startsWith("accessory")) {
    if (family === "accessoryInline") text(w, `${oc.name}：${line}`, 12);
    else if (family === "accessoryCircular") image(w, img, 60, 60);
    else {
      const row = w.addStack();
      row.centerAlignContent();
      image(row, img, 46, 46);
      row.addSpacer(6);
      const col = row.addStack();
      col.layoutVertically();
      text(col, oc.name, 13, { bold: true });
      text(col, line, 12, { lines: 2 });
    }
    return w;
  }

  if (oc.bg) {
    w.backgroundColor = new Color(oc.bg);
    ink = shade(oc.color, -70);
  } else {
    const g = new LinearGradient();
    g.colors = [new Color(shade(oc.color, 25)), new Color(shade(oc.color, -55))];
    g.locations = [0, 1];
    g.startPoint = new Point(0, 0);
    g.endPoint = new Point(1, 1);
    w.backgroundGradient = g;
  }

  if (family === "small") {
    w.setPadding(10, 10, 10, 10);
    const r = w.addStack();
    r.addSpacer();
    image(r, img, 96, 96);
    r.addSpacer();
    w.addSpacer(4);
    text(w, line, 12, { lines: 2, center: true });
  } else if (family === "medium") {
    w.setPadding(12, 12, 12, 16);
    const row = w.addStack();
    row.centerAlignContent();
    image(row, img, 130, 130);
    row.addSpacer(12);
    const col = row.addStack();
    col.layoutVertically();
    text(col, oc.name, 18, { bold: true });
    text(col, LABELS[state], 12, { opacity: 0.7 });
    col.addSpacer();
    text(col, line, 15, { lines: 3 });
    col.addSpacer();
    text(col, `♥ 被戳了 ${me.pets} 次`, 11, { opacity: 0.7 });
  } else {
    w.setPadding(16, 16, 16, 16);
    const head = w.addStack();
    text(head, oc.name, 20, { bold: true });
    head.addSpacer();
    text(head, LABELS[state], 13, { opacity: 0.7 });
    w.addSpacer();
    const r = w.addStack();
    r.addSpacer();
    image(r, img, 240, 240);
    r.addSpacer();
    w.addSpacer();
    text(w, line, 16, { lines: 2, center: true });
    w.addSpacer(6);
    text(w, `♥ 被戳了 ${me.pets} 次`, 11, { opacity: 0.7, center: true });
  }
  return w;
}

if (config.runsInWidget) {
  Script.setWidget(await build(config.widgetFamily));
} else if (args.queryParameters.tap) {
  // 点了小组件：戳一下
  while (true) {
    me.pets++;
    me.lastTap = Date.now();
    save();
    const a = new Alert();
    a.title = oc.name;
    a.message = `${pick(oc.lines.tap)}\n\n被戳了 ${me.pets} 次`;
    a.addAction("再戳一下");
    a.addAction("打开设定站");
    a.addCancelAction("好");
    const i = await a.presentAlert();
    if (i === 0) continue;
    if (i === 1) Safari.open(oc.url);
    break;
  }
} else {
  // 在 App 里直接运行：预览
  const a = new Alert();
  a.title = "预览小组件";
  ["小", "中", "大"].forEach(s => a.addAction(s));
  a.addCancelAction("取消");
  const i = await a.presentAlert();
  if (i >= 0) {
    const fam = ["small", "medium", "large"][i];
    const w = await build(fam);
    await w[{ small: "presentSmall", medium: "presentMedium", large: "presentLarge" }[fam]]();
  }
}
Script.complete();
