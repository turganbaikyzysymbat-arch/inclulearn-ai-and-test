const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  materialId: null,
  title: "",
  result: null,
  source: "",
  active: "simplified",
  language: "kk",
  progress: { completed: 0, score: 0 },
};

let labels = {
  simplified: "Жеңілдетілген мәтін",
  steps: "Қадам-қадаммен",
  examples: "Қосымша мысалдар",
  diagram: "Визуалды сызба",
  large: "Үлкейтілген қаріп",
  summary: "Қысқаша резюме",
  tasks: "Бейімделген тапсырмалар",
};

function t(key) {
  return window.LEARN4ALL_I18N?.[state.language]?.[key]
    || window.LEARN4ALL_I18N?.kk?.[key]
    || key;
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  labels = {
    simplified: t("simplified"),
    steps: t("steps"),
    examples: t("examples"),
    diagram: t("diagram"),
    large: t("large"),
    summary: t("summary"),
    tasks: t("tasks"),
  };
  $$("[data-i18n]").forEach((element) => {
    const value = t(element.dataset.i18n);
    if (element.dataset.i18n === "aboutHeadline" || element.dataset.i18n === "orChooseFile") {
      element.innerHTML = value;
    } else {
      element.textContent = value;
    }
  });
  $$("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  if (!$("#adaptButton").disabled) {
    const action = state.language === "kk" ? "Ayla AI арқылы бейімдеу" : state.language === "ru" ? "Адаптировать через Ayla AI" : "Adapt with Ayla AI";
    $("#adaptButton").innerHTML = `<span>✦</span> ${action} <kbd>Ctrl ↵</kbd>`;
  }
  $("#charCount").textContent = `${state.source.length.toLocaleString("kk-KZ")} ${state.language === "kk" ? "таңба" : state.language === "ru" ? "симв." : "characters"}`;
  if (state.result) {
    renderResult({
      id: state.materialId,
      title: state.title,
      source_text: state.source,
      adaptation: state.result,
      progress: state.progress,
    });
  }
}

function toast(text) {
  const element = $("#toast");
  element.textContent = text;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 3200);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[character]));
}

function selected() {
  return $$(".format input:checked").map((input) => input.value);
}

function updateCount() {
  $("#formatCount").textContent = selected().length;
}

function setSource(text) {
  state.source = text || "";
  $("#sourceText").value = state.source;
  $("#charCount").textContent = `${state.source.length.toLocaleString("kk-KZ")} таңба`;
}

function showView(name) {
  $$(".nav-link").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  $$(".view").forEach((item) => item.classList.add("hidden"));
  $(`#${name}View`).classList.remove("hidden");
  if (name === "materials") loadMaterials();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function content(key, result) {
  if (key === "diagram") {
    const nodes = result.diagram?.nodes || [];
    return `<div class="diagram">${nodes.map((node, index) => `${index ? '<span class="arrow">→</span>' : ""}<div class="node">${esc(node)}</div>`).join("")}</div><div class="chips">${(result.keywords || []).map((item) => `<span class="chip">${esc(item)}</span>`).join("")}</div>`;
  }
  return `<div class="result-body ${key === "large" ? "large" : ""}">${esc(result[key] || "Бұл формат таңдалмады.")}</div>${key === "summary" ? `<div class="chips">${(result.keywords || []).map((item) => `<span class="chip">${esc(item)}</span>`).join("")}</div>` : ""}`;
}

function renderProgress(progress = {}) {
  state.progress = {
    completed: Number(progress.completed || 0),
    score: Number(progress.score || 0),
  };
  const percent = state.progress.completed ? 100 : state.progress.score;
  $("#progressText").textContent = `${percent}% ${state.language === "kk" ? "аяқталды" : state.language === "ru" ? "завершено" : "completed"}`;
  $("#progressFill").style.width = `${percent}%`;
  $("#progressBar").classList.remove("hidden");
}

function renderPractice() {
  const rawTasks = String(state.result?.tasks || "")
    .split(/\n+/)
    .map((task) => task.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  if (!rawTasks.length) {
    $("#practiceCard").classList.add("hidden");
    return;
  }
  $("#practiceCard").classList.remove("hidden");
  $("#practiceCard").innerHTML = `
    <div class="practice-header"><div><span class="step">03</span><h3>${esc(t("practice"))}</h3><p>${esc(t("practiceHint"))}</p></div><span class="practice-score" id="practiceScore">0/${rawTasks.length}</span></div>
    <div class="practice-list">${rawTasks.map((task, index) => `<label><input type="checkbox" data-practice="${index}"><span>${esc(task)}</span></label>`).join("")}</div>
    <button id="finishPractice" class="secondary-button">${esc(t("saveProgress"))}</button>`;
  const checkboxes = $$("[data-practice]");
  const updateScore = () => {
    const score = checkboxes.filter((checkbox) => checkbox.checked).length;
    $("#practiceScore").textContent = `${score}/${checkboxes.length}`;
  };
  checkboxes.forEach((checkbox) => checkbox.addEventListener("change", updateScore));
  $("#finishPractice").onclick = async () => {
    const score = Math.round((checkboxes.filter((checkbox) => checkbox.checked).length / checkboxes.length) * 100);
    await saveProgress(score === 100, score);
    toast(score === 100 ? t("allTasksDone") : t("progressSaved"));
  };
}

function renderResult(data) {
  state.materialId = data.id || state.materialId;
  state.title = data.title || state.title || "Оқу материалы";
  state.result = data.adaptation || data;
  state.source = data.source_text || state.source;
  const formats = selected();
  if (!formats.includes(state.active)) state.active = formats[0] || "simplified";
  $("#outputMeta").textContent = `${state.title} · ${state.source.length.toLocaleString("kk-KZ")} таңба · ${formats.length} формат`;
  $("#tabs").innerHTML = formats.map((key) => `<button class="tab ${key === state.active ? "active" : ""}" data-tab="${key}">${labels[key]}</button>`).join("");
  $("#result").innerHTML = `<div class="result-top"><h3>${labels[state.active]}</h3><button class="result-copy" id="copyCurrent">${esc(t("copyAll").replace("▣ ", ""))}</button></div>${content(state.active, state.result)}`;
  $$(".tab").forEach((tab) => {
    tab.onclick = () => {
      state.active = tab.dataset.tab;
      renderResult({ id: state.materialId, title: state.title, source_text: state.source, adaptation: state.result, progress: state.progress });
    };
  });
  $("#copyCurrent").onclick = () => {
    const value = state.result[state.active];
    navigator.clipboard?.writeText(typeof value === "object" ? JSON.stringify(value) : value || "");
    toast(t("copied"));
  };
  renderProgress(data.progress || state.progress);
  renderPractice();
  $("#outputSection").classList.remove("hidden");
  $("#outputSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function adapt() {
  const text = $("#sourceText").value.trim();
  if (!text) return toast(t("chooseMaterial"));
  const button = $("#adaptButton");
  button.disabled = true;
  button.innerHTML = `<span>◌</span> ${state.language === "kk" ? "Ayla AI талдап жатыр…" : state.language === "ru" ? "Ayla AI анализирует…" : "Ayla AI is analyzing…"}`;
  try {
    const body = new FormData();
    body.append("title", $("#materialTitle").value.trim() || "Жаңа оқу материалы");
    body.append("text", text);
    body.append("language", state.language);
    const response = await fetch("/api/materials", { method: "POST", body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    renderResult(data);
    toast(t("saved"));
  } catch (error) {
    toast(error.message || "Қате болды.");
  } finally {
    button.disabled = false;
    button.innerHTML = `<span>✦</span> ${state.language === "kk" ? "Ayla AI арқылы бейімдеу" : state.language === "ru" ? "Адаптировать через Ayla AI" : "Adapt with Ayla AI"} <kbd>Ctrl ↵</kbd>`;
  }
}

async function upload(file) {
  if (!file) return;
  const note = $("#fileNote");
  note.className = "file-note";
  note.textContent = `${file.name} ${state.language === "kk" ? "оқылып жатыр…" : state.language === "ru" ? "читается…" : "is being read…"}`;
  $("#materialTitle").value = file.name.replace(/\.[^.]+$/, "");
  const body = new FormData();
  body.append("file", file);
  body.append("title", $("#materialTitle").value);
  body.append("language", state.language);
  try {
    const response = await fetch("/api/materials", { method: "POST", body });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setSource(data.source_text);
    note.textContent = `✓ ${file.name} · ${state.language === "kk" ? "мәтін алынды" : state.language === "ru" ? "текст извлечён" : "text extracted"}`;
    renderResult(data);
    toast(t("saved"));
  } catch (error) {
    note.className = "file-note error";
    note.textContent = error.message;
  }
}

function demo() {
  $("#materialTitle").value = "ООП — Мұрагерлік";
  setSource("Мұрагерлік — объектіге бағытталған бағдарламалауда бір кластың басқа кластың қасиеттері мен әдістерін иелену мүмкіндігі. Ата-ана класс ортақ сипаттамаларды анықтайды, ал бала класс оларды қайта пайдаланып, жаңа қасиеттер қоса алады. Мысалы, Көлік класы қозғалу әдісіне ие болса, Автокөлік класы Көліктен мұра алып, қозғалу әдісін пайдаланады және қозғалтқыш түрін қосады. Мұрагерлік кодты қайталамай жазуға, бағдарламаны кеңейтуге және кластар арасындағы байланысты ұйымдастыруға көмектеседі.");
  toast(state.language === "kk" ? "Үлгі материал жүктелді." : state.language === "ru" ? "Демо-материал загружен." : "Demo material loaded.");
}

async function ask() {
  const question = $("#questionInput").value.trim();
  if (!question) return toast(t("questionRequired"));
  const box = $("#answer");
  const button = $("#askButton");
  button.disabled = true;
  box.classList.remove("hidden");
  box.textContent = t("answerLoading");
  try {
    const response = await fetch(`/api/materials/${state.materialId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    box.textContent = data.answer;
  } catch (error) {
    box.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function saveProgress(completed, score) {
  if (!state.materialId) return;
  const response = await fetch(`/api/materials/${state.materialId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed, score }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  renderProgress(data);
}

async function loadMaterials() {
  const query = $("#searchMaterials").value.trim();
  const response = await fetch(`/api/materials${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  const data = await response.json();
  $("#materialsList").innerHTML = data.materials.length
    ? data.materials.map((item) => `
      <article class="material-card">
        <div class="material-card-top"><h3>${esc(item.title)}</h3><button class="delete-material" data-delete="${item.id}" title="${esc(t("materialDeleted"))}">×</button></div>
        <p>${esc(item.source_text || "")}${(item.source_text || "").length >= 180 ? "…" : ""}</p>
        <div class="card-meta"><span>${item.progress?.score || 0}% ${state.language === "kk" ? "прогресс" : state.language === "ru" ? "прогресс" : "progress"}</span><small>${esc(item.updated_at)}</small></div>
        <button class="open-material" data-open="${item.id}">${state.language === "kk" ? "Материалды ашу" : state.language === "ru" ? "Открыть материал" : "Open material"} →</button>
      </article>`).join("")
    : `<div class="empty">${t("noMaterials")}</div>`;
  $$("[data-open]").forEach((button) => button.onclick = () => openMaterial(button.dataset.open));
  $$("[data-delete]").forEach((button) => button.onclick = () => deleteMaterial(button.dataset.delete));
}

async function openMaterial(id) {
  const response = await fetch(`/api/materials/${id}`);
  const data = await response.json();
  if (!response.ok) return toast(data.error);
  state.progress = data.progress || { completed: 0, score: 0 };
  $("#materialTitle").value = data.title;
  setSource(data.source_text);
  renderResult(data);
  showView("dashboard");
}

async function deleteMaterial(id) {
  if (!window.confirm(t("deleteConfirm"))) return;
  const response = await fetch(`/api/materials/${id}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) return toast(data.error);
  toast(t("materialDeleted"));
  loadMaterials();
}

function setAccessibility() {
  const root = document.documentElement;
  const fontScale = Number(localStorage.getItem("learn4all-font-scale") || "1");
  root.style.setProperty("--font-scale", fontScale);
  document.body.classList.toggle("high-contrast", localStorage.getItem("learn4all-contrast") === "1");
  document.body.classList.toggle("dark-mode", localStorage.getItem("learn4all-theme") === "dark");
}

function changeFont(delta) {
  const current = Number(localStorage.getItem("learn4all-font-scale") || "1");
  const next = Math.max(0.9, Math.min(1.35, Math.round((current + delta) * 100) / 100));
  localStorage.setItem("learn4all-font-scale", String(next));
  setAccessibility();
}

$("#sourceText").oninput = (event) => {
  state.source = event.target.value;
  $("#charCount").textContent = `${state.source.length.toLocaleString("kk-KZ")} ${state.language === "kk" ? "таңба" : state.language === "ru" ? "симв." : "characters"}`;
};
$("#fileInput").onchange = (event) => upload(event.target.files[0]);
$("#demoButton").onclick = demo;
$("#adaptButton").onclick = adapt;
$("#askButton").onclick = ask;
$("#questionInput").onkeydown = (event) => { if (event.key === "Enter") ask(); };
$("#dropzone").ondragover = (event) => { event.preventDefault(); $("#dropzone").classList.add("dragging"); };
$("#dropzone").ondragleave = () => $("#dropzone").classList.remove("dragging");
$("#dropzone").ondrop = (event) => { event.preventDefault(); $("#dropzone").classList.remove("dragging"); upload(event.dataTransfer.files[0]); };
$$(".format").forEach((item) => item.onclick = () => setTimeout(() => {
  item.classList.toggle("selected", item.querySelector("input").checked);
  updateCount();
}, 0));
$$(".nav-link").forEach((item) => item.onclick = () => showView(item.dataset.view));
$("#printButton").onclick = () => window.print();
$("#copyButton").onclick = () => {
  const text = Object.entries(state.result || {})
    .filter(([key]) => labels[key])
    .map(([key, value]) => `${labels[key]}\n${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n\n");
  navigator.clipboard?.writeText(text);
  toast("Барлық нәтиже көшірілді");
};
$("#searchMaterials").oninput = () => loadMaterials();
$("#refreshMaterials").onclick = () => loadMaterials();
const savedLanguage = localStorage.getItem("learn4all-language");
if (savedLanguage && window.LEARN4ALL_I18N?.[savedLanguage]) state.language = savedLanguage;
$("#language").value = state.language;
$("#language").onchange = (event) => {
  state.language = event.target.value;
  localStorage.setItem("learn4all-language", state.language);
  applyLanguage();
  toast(state.language === "kk" ? "Қазақша тіл таңдалды" : state.language === "ru" ? "Выбран русский язык" : "English selected");
};
$("#fontDown").onclick = () => changeFont(-0.1);
$("#fontUp").onclick = () => changeFont(0.1);
$("#fontReset").onclick = () => { localStorage.setItem("learn4all-font-scale", "1"); setAccessibility(); };
$("#contrastButton").onclick = () => {
  localStorage.setItem("learn4all-contrast", localStorage.getItem("learn4all-contrast") === "1" ? "0" : "1");
  setAccessibility();
};
$("#themeButton").onclick = () => {
  localStorage.setItem("learn4all-theme", document.body.classList.contains("dark-mode") ? "light" : "dark");
  setAccessibility();
};
document.onkeydown = (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") adapt(); };

applyLanguage();
updateCount();
setAccessibility();
fetch("/api/health").then((response) => response.json()).then((data) => {
  if (!data.database) $("#dbStatus").innerHTML = `<i style='background:#e09a50'></i> ${t("databaseConnected")}`;
});

// Teacher-only authentication gate
const appSession = $("#appSession");
const currentUserName = appSession?.dataset.userName || "";
let authMode = "login";
function activateSession(user) {
  $("#authGate").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
  $("#teacherName").textContent = user.name || "Мұғалім";
  $("#authError").classList.add("hidden");
}
if (currentUserName) activateSession({name: currentUserName});
function setAuthMode(mode) {
  authMode = mode;
  $$(".auth-tab").forEach(b => b.classList.toggle("active", b.dataset.authTab === mode));
  const isRegister = mode === "register";
  $("#authNameWrap").classList.toggle("hidden", !isRegister);
  $("#authTitle").textContent = isRegister ? "Мұғалім ретінде тіркелу" : "Қош келдіңіз!";
  $("#authSubtitle").textContent = isRegister ? "Жаңа мұғалім аккаунтын жасаңыз." : "Мұғалім аккаунтыңызға кіріңіз.";
  $("#authSubmit").textContent = isRegister ? "Тіркелу" : "Кіру";
  $("#authPassword").autocomplete = isRegister ? "new-password" : "current-password";
  $("#authError").classList.add("hidden");
}
$$(".auth-tab").forEach(b => b.onclick = () => setAuthMode(b.dataset.authTab));
$("#authForm").onsubmit = async event => {
  event.preventDefault();
  const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
  const body = {name:$("#authName").value.trim(),email:$("#authEmail").value.trim(),password:$("#authPassword").value};
  const button=$("#authSubmit"); button.disabled=true;
  try {
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json(); if(!response.ok)throw new Error(data.error||"Кіру орындалмады.");
    activateSession(data.user); toast(authMode==="register"?"Аккаунт жасалды.":"Сәтті кірдіңіз."); loadTaskSets();
  } catch(error) { $("#authError").textContent=error.message;$("#authError").classList.remove("hidden"); }
  finally { button.disabled=false; }
};
$("#logoutButton").onclick=async()=>{await fetch("/auth/logout",{method:"POST"});location.reload();};

// AI task generator: teacher provides a source file or text; the app prepares a printable worksheet.
let generatedTasks=[], generatedTitle="", activeTaskSetId=null;
const taskTypeLabels={quiz:"Бір дұрыс жауап",multi:"Бірнеше дұрыс жауап",truefalse:"Дұрыс / бұрыс",matching:"Сәйкестендіру",scenario:"Жағдаяттық тапсырма",open:"Ашық сұрақ",fill:"Бос орынды толтыру",order:"Ретін анықтау"};
function renderGeneratedTasks(){
 const list=$("#generatedTaskList");
 list.innerHTML=generatedTasks.map((t,i)=>`<article class="generated-task"><div class="run-question-heading"><span>${i+1}</span><small>${esc(taskTypeLabels[t.type]||t.type)}</small></div><h3>${esc(t.question)}</h3>${["quiz","multi"].includes(t.type)?t.options.map(o=>`<p>□ ${esc(o)}</p>`).join(""):t.type==="matching"?t.pairs.map(p=>`<p>${esc(p.left)} — __________</p>`).join(""):t.type==="truefalse"?"<p>□ Дұрыс　 □ Бұрыс</p>":t.type==="order"?t.items.map(x=>`<p>□ ${esc(x)}</p>`).join(""):'<p class="answer-line">Жауап: __________________________________________________</p>'}${["open","scenario"].includes(t.type)?`<p class="rubric"><b>Бағалау критерийі:</b> ${esc(t.expected)}</p>`:""}</article>`).join("");
}
$("#generateTaskSetButton").onclick=async()=>{
 const button=$("#generateTaskSetButton"), status=$("#aiTaskStatus");
 const file=$("#aiTaskFile").files[0], source=$("#aiTaskSource").value.trim();
 if(!file && source.length<80){status.textContent="Мәтінді енгізіңіз немесе оқу материалын файлмен жүктеңіз (кемінде 80 таңба).";status.classList.remove("hidden");return;}
 const form=new FormData();form.append("title",$("#aiTaskTitle").value.trim()||"Жаңа тапсырмалар");form.append("source",source);form.append("kind",$("#aiTaskType").value);form.append("count",$("#aiTaskCount").value);form.append("level",$("#aiTaskLevel").value);if(file)form.append("file",file);
 button.disabled=true;button.textContent="Ayla AI тапсырмаларды дайындап жатыр…";status.textContent="Материал оқылып, тапсырмалар дайындалып жатыр.";status.classList.remove("hidden");
 try{const response=await fetch("/api/generate-task-set",{method:"POST",body:form});const data=await response.json();if(!response.ok)throw new Error(data.error||"Тапсырмалар жасалмады.");generatedTasks=data.tasks;generatedTitle=data.title;$("#generatedTaskHeading").textContent=generatedTitle;$("#generatedTaskMeta").textContent=`${generatedTasks.length} тапсырма дайын · Материал: ${data.source_length} таңба`;renderGeneratedTasks();$("#generatedTaskPanel").classList.remove("hidden");status.textContent=data.ai_used?"AI жасаған тапсырмаларды қарап шығыңыз. PDF сақтамас бұрын мазмұнын тексеріңіз.":"AI API кілті қосылмағандықтан, материал негізіндегі бастапқы тапсырмалар жасалды. Жауап кілттерін мұғалім тексеруі керек.";toast("Тапсырмалар дайын.");
 }catch(error){status.textContent=error.message;}finally{button.disabled=false;button.innerHTML="✦ Ayla AI тапсырмаларды құрсын";}
};
$("#saveGeneratedTaskButton").onclick=async()=>{
 const status=$("#generatedSaveStatus");if(!generatedTasks.length){status.textContent="Алдымен тапсырмалар жасаңыз.";status.classList.remove("hidden");return;}
 try{const response=await fetch("/api/task-sets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:generatedTitle,tasks:generatedTasks})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Сақтау қатесі");activeTaskSetId=data.id;status.textContent="Жұмыс сақталды.";status.classList.remove("hidden");loadTaskSets();toast("Жұмыс сақталды.");}catch(error){status.textContent=error.message;status.classList.remove("hidden");}
};
$("#downloadTaskPdfButton").onclick=()=>{
 if(!generatedTasks.length)return toast("Алдымен тапсырмалар жасаңыз.");
 const w=window.open("","_blank");if(!w)return toast("PDF жасау үшін браузердегі жаңа терезеге рұқсат беріңіз.");
 const content=generatedTasks.map((t,i)=>`<article><small>${i+1}. ${esc(taskTypeLabels[t.type]||t.type)}</small><h3>${esc(t.question)}</h3>${["quiz","multi"].includes(t.type)?t.options.map(o=>`<p>□ ${esc(o)}</p>`).join(""):t.type==="matching"?t.pairs.map(p=>`<p>${esc(p.left)} — ____________________</p>`).join(""):t.type==="truefalse"?"<p>□ Дұрыс　 □ Бұрыс</p>":t.type==="order"?t.items.map(o=>`<p>□ ${esc(o)}</p>`).join(""):'<p>Жауап: __________________________________________________</p><p>________________________________________________________</p>'}${["open","scenario"].includes(t.type)?`<p><b>Бағалау критерийі:</b> ${esc(t.expected)}</p>`:""}</article>`).join("");
 w.document.write(`<!doctype html><html lang="kk"><meta charset="utf-8"><title>${esc(generatedTitle)}</title><style>body{font:14px Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 24px;color:#17232b;line-height:1.55}h1{font-size:26px}article{page-break-inside:avoid;border-bottom:1px solid #ddd;padding:12px 0}small{color:#61717b}p{margin:8px 0}@media print{button{display:none}}</style><h1>${esc(generatedTitle)}</h1><p>IncluLearn AI · Тапсырмалар жинағы</p>${content}<script>window.onload=()=>window.print()<\/script></html>`);w.document.close();
};
async function loadTaskSets(){if($("#authGate")&&!$("#authGate").classList.contains("hidden"))return;const box=$("#savedTaskSets");if(!box)return;const response=await fetch("/api/task-sets");if(!response.ok)return;const data=await response.json();box.innerHTML=data.task_sets.length?data.task_sets.map(item=>`<article class="saved-task-item"><div><b>${esc(item.title)}</b><small>${item.count} тапсырма · ${esc(item.created_at)}</small></div><button class="secondary-button" data-open-set="${item.id}">Қарау / PDF</button></article>`).join(""):'<div class="empty">Әзірге сақталған жұмыс жоқ.</div>';$$('[data-open-set]').forEach(b=>b.onclick=async()=>{const r=await fetch(`/api/task-sets/${b.dataset.openSet}`);const d=await r.json();if(!r.ok)return toast(d.error);generatedTasks=d.tasks;generatedTitle=d.title;$("#generatedTaskHeading").textContent=d.title;$("#generatedTaskMeta").textContent=`${d.tasks.length} сақталған тапсырма`;renderGeneratedTasks();$("#generatedTaskPanel").classList.remove("hidden");$("#generatedTaskPanel").scrollIntoView({behavior:"smooth"});});}
$("#refreshTaskSets").onclick=loadTaskSets;
if(currentUserName)loadTaskSets();
