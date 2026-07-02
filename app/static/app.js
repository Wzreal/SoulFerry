const state = {
  auth: { username: "student", password: "student123" },
  profile: null,
  sessionId: null,
  sending: false,
  modelName: "mock",
  reports: [],
  excelRecords: [],
  alertRecords: []
};

const els = {
  serviceState: document.querySelector("#serviceState"),
  modelState: document.querySelector("#modelState"),
  loginForm: document.querySelector("#loginForm"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  loginState: document.querySelector("#loginState"),
  accountPanel: document.querySelector("#accountPanel"),
  activeAccount: document.querySelector("#activeAccount"),
  activeRole: document.querySelector("#activeRole"),
  switchAccount: document.querySelector("#switchAccount"),
  studentModes: document.querySelector("#studentModes"),
  adminRecordsPanel: document.querySelector("#adminRecordsPanel"),
  sideReports: document.querySelector("#sideReports"),
  studentView: document.querySelector("#studentView"),
  adminView: document.querySelector("#adminView"),
  studentName: document.querySelector("#studentName"),
  welcomeHero: document.querySelector("#welcomeHero"),
  messages: document.querySelector("#messages"),
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  newSession: document.querySelector("#newSession"),
  sessionBadge: document.querySelector("#sessionBadge"),
  reports: document.querySelector("#reports"),
  excelRecords: document.querySelector("#excelRecords"),
  alertRecords: document.querySelector("#alertRecords"),
  refreshAdmin: document.querySelector("#refreshAdmin"),
  refreshAdminSide: document.querySelector("#refreshAdminSide"),
  metricReports: document.querySelector("#metricReports"),
  metricHigh: document.querySelector("#metricHigh"),
  metricExcel: document.querySelector("#metricExcel"),
  metricAlerts: document.querySelector("#metricAlerts"),
  riskStats: document.querySelector("#riskStats"),
  emotionStats: document.querySelector("#emotionStats"),
  intentStats: document.querySelector("#intentStats"),
  toolStats: document.querySelector("#toolStats"),
  knowledgeUploadForm: document.querySelector("#knowledgeUploadForm"),
  knowledgeFile: document.querySelector("#knowledgeFile"),
  chooseFileButton: document.querySelector("#chooseFileButton"),
  knowledgeUploadState: document.querySelector("#knowledgeUploadState"),
  modal: document.querySelector("#detailModal"),
  modalKicker: document.querySelector("#modalKicker"),
  modalTitle: document.querySelector("#modalTitle"),
  modalSubTitle: document.querySelector("#modalSubTitle"),
  modalBody: document.querySelector("#modalBody"),
  closeModal: document.querySelector("#closeModal")
};

function authHeader() {
  return `Basic ${btoa(`${state.auth.username}:${state.auth.password}`)}`;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}), Authorization: authHeader() };
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function setStatusLine(el, text, tone = "ok") {
  el.textContent = text;
  el.className = `status-line ${tone}`;
}

function setSession(text, tone = "ok") {
  els.sessionBadge.textContent = text;
  els.sessionBadge.className = tone;
}

function isAdmin(profile) {
  return profile?.roles?.some((role) => role.authority === "ROLE_ADMIN");
}

function displayModel(model) {
  return (model || "").includes("mindbridge-qwen2.5-7b-ft") ? "微调后的 Qwen2.5-7B" : model;
}

async function checkHealth() {
  try {
    const response = await fetch("/actuator/health");
    const body = await response.json();
    setStatusLine(els.serviceState, body.status === "UP" ? "服务正常" : `服务 ${body.status}`, body.status === "UP" ? "ok" : "danger");
  } catch {
    setStatusLine(els.serviceState, "服务 DOWN", "danger");
  }
}

async function loadAgentStatus() {
  const response = await api("/api/agent/status");
  const status = await response.json();
  state.modelName = status.model || "mock";
  if (status.realModelEnabled) {
    setStatusLine(els.modelState, `${status.provider} · ${displayModel(state.modelName)}`, "ok");
  } else {
    setStatusLine(els.modelState, "mock 演示", "warn");
  }
}

async function login(event) {
  event?.preventDefault();
  state.auth.username = els.username.value.trim();
  state.auth.password = els.password.value;
  try {
    const response = await api("/api/profile");
    state.profile = await response.json();
    await loadAgentStatus();
    showApp();
    els.loginState.textContent = "登录成功";
    if (isAdmin(state.profile)) await loadAdminDashboard();
  } catch (error) {
    els.loginState.textContent = `登录失败：${error.message}`;
  }
}

function showApp() {
  const admin = isAdmin(state.profile);
  const displayName = state.profile.displayName || state.profile.username;
  els.accountPanel.hidden = false;
  els.activeAccount.textContent = displayName;
  els.activeRole.textContent = admin ? "管理员账号" : "学生账号";
  els.studentName.textContent = displayName;
  els.loginForm.hidden = true;
  els.studentModes.hidden = admin;
  els.adminRecordsPanel.hidden = !admin;
  els.studentView.hidden = admin;
  els.adminView.hidden = !admin;
}

function logout() {
  state.profile = null;
  state.sessionId = null;
  els.accountPanel.hidden = true;
  els.loginForm.hidden = false;
  els.studentModes.hidden = false;
  els.adminRecordsPanel.hidden = true;
  els.studentView.hidden = false;
  els.adminView.hidden = true;
  els.username.focus();
  setSession("READY");
}

function clearWelcome() {
  els.welcomeHero.hidden = true;
}

function resetConversation() {
  state.sessionId = null;
  els.messages.innerHTML = "";
  els.welcomeHero.hidden = false;
  setSession("READY");
}

function addMessage(role, content) {
  clearWelcome();
  const row = document.createElement("article");
  row.className = `message ${role}`;
  row.innerHTML = `
    <div class="message-role">${role === "user" ? "你" : "AI"}</div>
    <div class="bubble"></div>
  `;
  row.querySelector(".bubble").textContent = content;
  els.messages.append(row);
  els.messages.scrollTop = els.messages.scrollHeight;
  return row.querySelector(".bubble");
}

function parseSse(buffer, onEvent) {
  const parts = buffer.split("\n\n");
  const rest = parts.pop();
  for (const part of parts) {
    const dataLine = part.split("\n").find((line) => line.startsWith("data: "));
    if (!dataLine) continue;
    onEvent(JSON.parse(dataLine.slice(6)));
  }
  return rest;
}

async function sendMessage(event) {
  event.preventDefault();
  if (state.sending || isAdmin(state.profile)) return;
  const message = els.messageInput.value.trim();
  if (!message) return;
  state.sending = true;
  els.sendButton.disabled = true;
  setSession("THINKING", "warn");
  els.messageInput.value = "";
  addMessage("user", message);
  const assistant = addMessage("assistant", "");
  let raw = "";

  try {
    const response = await api("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, message })
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamFailed = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = parseSse(buffer, (eventData) => {
        if (eventData.type === "meta") state.sessionId = eventData.sessionId;
        if (eventData.type === "token") {
          raw += eventData.content || "";
          assistant.textContent = raw;
          els.messages.scrollTop = els.messages.scrollHeight;
        }
        if (eventData.type === "error") {
          streamFailed = true;
          if (!raw) assistant.textContent = eventData.message || "MCP 工具调用失败";
          setSession("ERROR", "danger");
        }
      });
    }
    if (!streamFailed) setSession("DONE", "ok");
  } catch (error) {
    assistant.textContent = `发送失败：${error.message}`;
    setSession("ERROR", "danger");
  } finally {
    state.sending = false;
    els.sendButton.disabled = false;
  }
}

async function loadAdminDashboard() {
  const [reportsRes, excelRes, alertsRes] = await Promise.all([
    api("/api/admin/reports"),
    api("/api/admin/excel-records"),
    api("/api/admin/alerts")
  ]);
  state.reports = await reportsRes.json();
  state.excelRecords = await excelRes.json();
  state.alertRecords = await alertsRes.json();
  renderAdminDashboard();
}

function renderAdminDashboard() {
  const highCount = state.reports.filter((item) => item.riskLevel === "HIGH").length;
  const successAlerts = state.alertRecords.filter((item) => item.status === "SUCCESS").length;
  els.metricReports.textContent = state.reports.length;
  els.metricHigh.textContent = highCount;
  els.metricExcel.textContent = state.excelRecords.length;
  els.metricAlerts.textContent = successAlerts;

  renderStats(els.riskStats, countBy(state.reports, "riskLevel"), ["LOW", "MEDIUM", "HIGH"]);
  renderStats(els.emotionStats, countBy(state.reports, "emotion"), ["NORMAL", "ANXIETY", "DEPRESSED", "HIGH_RISK"]);
  renderStats(els.intentStats, countBy(state.reports, "intent"), ["CHAT", "CONSULT", "RISK"]);
  renderStats(els.toolStats, {
    Excel: state.excelRecords.length,
    邮件成功: successAlerts,
    邮件失败: state.alertRecords.filter((item) => item.status !== "SUCCESS").length
  }, ["Excel", "邮件成功", "邮件失败"]);

  renderReports(state.reports);
  renderSideReports(state.reports);
  renderToolRecords(els.excelRecords, state.excelRecords, "excel");
  renderToolRecords(els.alertRecords, state.alertRecords, "alert");
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "UNKNOWN";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderStats(container, counts, preferredOrder) {
  container.innerHTML = "";
  const keys = [...new Set([...preferredOrder, ...Object.keys(counts)])];
  const max = Math.max(1, ...Object.values(counts));
  for (const key of keys) {
    const value = counts[key] || 0;
    const row = document.createElement("div");
    const tone = key.includes("HIGH") || key.includes("失败") ? "danger" : key.includes("MEDIUM") ? "warn" : "";
    row.className = "stat-row";
    row.innerHTML = `
      <span>${escapeHtml(key)}</span>
      <div class="bar ${tone}"><span style="width: ${(value / max) * 100}%"></span></div>
      <strong>${value}</strong>
    `;
    container.append(row);
  }
}

function badgeClass(value) {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("high") || lower.includes("fail")) return "high failed";
  if (lower.includes("medium") || lower.includes("pending")) return "medium pending";
  if (lower.includes("low") || lower.includes("success")) return "low success";
  return "";
}

function renderReports(reports) {
  els.reports.innerHTML = "";
  if (!reports.length) {
    els.reports.innerHTML = `<div class="empty-state">暂无对话报告</div>`;
    return;
  }
  for (const item of reports) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-top">
        <span class="record-title">${escapeHtml(item.displayName || item.username || "student")}</span>
        <span class="badge ${badgeClass(item.riskLevel)}">${escapeHtml(item.riskLevel)}</span>
      </div>
      <div class="record-meta">${escapeHtml(item.emotion)} / ${escapeHtml(item.intent)} · ${formatDate(item.createdAt)}</div>
      <div class="record-summary">${escapeHtml(item.summary || item.content)}</div>
    `;
    card.addEventListener("click", () => openReportDetail(item));
    els.reports.append(card);
  }
}

function renderSideReports(reports) {
  els.sideReports.innerHTML = "";
  if (!reports.length) {
    els.sideReports.innerHTML = `<div class="empty-state">暂无后台记录</div>`;
    return;
  }
  for (const item of reports.slice(0, 8)) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "record-card";
    card.innerHTML = `
      <div class="record-top">
        <span class="record-title">${escapeHtml(item.emotion)} / ${escapeHtml(item.intent)}</span>
        <span class="badge ${badgeClass(item.riskLevel)}">${escapeHtml(item.riskLevel)}</span>
      </div>
      <div class="record-meta">${formatDate(item.createdAt)}</div>
      <div class="record-summary">${escapeHtml(item.summary)}</div>
      <div class="record-meta">点击查看完整对话</div>
    `;
    card.addEventListener("click", () => openReportDetail(item));
    els.sideReports.append(card);
  }
}

function renderToolRecords(container, records, type) {
  container.innerHTML = "";
  if (!records.length) {
    container.innerHTML = `<div class="empty-state">暂无记录</div>`;
    return;
  }
  for (const item of records) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "record-card";
    const title = type === "excel" ? `#${item.reportId} · student` : `报告 #${item.reportId}`;
    const detail = type === "excel" ? item.filePath || item.message : `${item.recipient || "counselor@example.com"} · ${item.message}`;
    card.innerHTML = `
      <div class="record-top">
        <span class="record-title">${escapeHtml(title)}</span>
        <span class="badge ${badgeClass(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <div class="record-meta">${formatDate(item.createdAt)}</div>
      <div class="record-summary">${escapeHtml(detail)}</div>
    `;
    card.addEventListener("click", () => openToolDetail(item, type));
    container.append(card);
  }
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(value || "-")}</p>
    </div>
  `;
}

function openModal(kicker, title, subtitle, html) {
  els.modalKicker.textContent = kicker;
  els.modalTitle.textContent = title;
  els.modalSubTitle.textContent = subtitle || "";
  els.modalBody.innerHTML = html;
  els.modal.hidden = false;
}

function closeModal() {
  els.modal.hidden = true;
  els.modalBody.innerHTML = "";
}

async function openReportDetail(item) {
  const baseRows = [
    detailRow("学生账号", item.username || item.displayName),
    detailRow("报告编号", `#${item.id}`),
    detailRow("意图类型", item.intent),
    detailRow("情绪识别", item.emotion),
    detailRow("风险等级", item.riskLevel),
    detailRow("置信度", item.confidence),
    detailRow("原始输入", item.content),
    detailRow("创建时间", formatDate(item.createdAt)),
    detailRow("内容摘要", item.summary)
  ].join("");
  openModal("对话记录 · 报告 #" + item.id, `${item.displayName || item.username} 的对话报告`, "管理员视图", baseRows);

  if (!item.sessionId) return;
  try {
    const response = await api(`/api/admin/conversations/${encodeURIComponent(item.sessionId)}`);
    const conversation = await response.json();
    const messages = conversation.messages.map((message) => `
      <article class="message ${message.role === "user" ? "user" : "assistant"}">
        <div class="message-role">${escapeHtml(message.role === "user" ? "学生" : state.modelName)}</div>
        <div class="bubble">${escapeHtml(message.content)}</div>
      </article>
    `).join("");
    els.modalBody.innerHTML = `${baseRows}<section class="conversation">${messages}</section>`;
  } catch (error) {
    els.modalBody.innerHTML = `${baseRows}${detailRow("完整对话", `读取失败：${error.message}`)}`;
  }
}

function openToolDetail(item, type) {
  const rows = [
    detailRow("学生账号", "student"),
    detailRow("报告编号", `#${item.reportId}`),
    detailRow(type === "excel" ? "写入状态" : "发送状态", item.status),
    detailRow(type === "excel" ? "文件路径" : "收件人", type === "excel" ? item.filePath : item.recipient),
    detailRow(type === "excel" ? "写入时间" : "创建时间", formatDate(item.createdAt)),
    detailRow("内容摘要", item.message),
    type === "alert" ? detailRow("通知渠道", item.channel) : ""
  ].join("");
  openModal(type === "excel" ? `EXCEL 写入 · 报告 #${item.reportId}` : `邮件发送 · 报告 #${item.reportId}`, type === "excel" ? "Excel 写入数据" : "邮件发送记录", "管理员视图", rows);
}

async function uploadKnowledgeFile(event) {
  event.preventDefault();
  const file = els.knowledgeFile.files?.[0];
  if (!file) {
    els.knowledgeUploadState.textContent = "请先选择文件";
    return;
  }
  const data = new FormData();
  data.append("file", file);
  els.knowledgeUploadState.textContent = "正在切分入库...";
  try {
    const response = await api("/api/admin/knowledge/file", { method: "POST", body: data });
    const result = await response.json();
    els.knowledgeUploadState.textContent = `${result.source} 已入库 ${result.chunks} 个片段`;
    els.knowledgeFile.value = "";
  } catch (error) {
    els.knowledgeUploadState.textContent = `上传失败：${error.message}`;
  }
}

function bindQuickPrompts() {
  document.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      els.messageInput.value = button.dataset.quick;
      els.messageInput.focus();
    });
  });
}

bindQuickPrompts();
els.loginForm.addEventListener("submit", login);
els.chatForm.addEventListener("submit", sendMessage);
els.newSession.addEventListener("click", resetConversation);
els.switchAccount.addEventListener("click", logout);
els.refreshAdmin?.addEventListener("click", loadAdminDashboard);
els.refreshAdminSide?.addEventListener("click", loadAdminDashboard);
els.knowledgeUploadForm?.addEventListener("submit", uploadKnowledgeFile);
els.chooseFileButton?.addEventListener("click", () => els.knowledgeFile.click());
els.knowledgeFile?.addEventListener("change", () => {
  els.knowledgeUploadState.textContent = els.knowledgeFile.files?.[0]?.name || "等待选择文件";
});
els.closeModal.addEventListener("click", closeModal);
els.modal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.modal.hidden) closeModal();
});

checkHealth();
login();
