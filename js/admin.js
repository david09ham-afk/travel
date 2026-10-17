import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { get, push, ref, remove, serverTimestamp, set, update } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";

const statusNode = document.querySelector("#admin-global-status");
const destinationForm = document.querySelector("#destination-form");
const stayForm = document.querySelector("#stay-form");
const destinationSelect = document.querySelector("#stay-destination");
const destinationList = document.querySelector("#destination-list");
const stayList = document.querySelector("#stay-list");
const reservationList = document.querySelector("#admin-reservation-list");
const memberList = document.querySelector("#member-list");
const memberSearch = document.querySelector("#member-search");
const destinationSearch = document.querySelector("#destination-search");
const staySearch = document.querySelector("#stay-search");
const reservationSearch = document.querySelector("#reservation-search");
const adminData = { destinations: {}, stays: {}, reservations: {}, members: {} };
let memberRoleFilter = "all";
const sectionNames = ["overview", "destinations", "stays", "reservations", "members"];
let authorized = false;
let authRedirecting = false;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setStatus(message, error = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", error);
}

function setBusy(form, busy, idleLabel = "저장") {
  const button = form.querySelector('[type="submit"]');
  button.disabled = busy;
  button.textContent = busy ? "저장 중…" : idleLabel;
}

function showSection(name) {
  for (const sectionName of sectionNames) {
    const section = document.querySelector(`#section-${sectionName}`);
    const active = sectionName === name;
    section.hidden = !active;
    section.classList.toggle("is-active", active);
  }
  for (const button of document.querySelectorAll(".admin-nav")) button.classList.toggle("is-active", button.dataset.section === name);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

for (const button of document.querySelectorAll(".admin-nav")) button.addEventListener("click", () => showSection(button.dataset.section));
for (const button of document.querySelectorAll("[data-open-section]")) button.addEventListener("click", () => showSection(button.dataset.openSection));

document.querySelector("#admin-logout").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.alert("로그아웃되었습니다");
    window.location.href = "index.html";
  } catch (error) {
    console.error("관리자 로그아웃 실패", error);
    window.alert("로그아웃하지 못했습니다. 다시 시도해 주세요.");
  }
});

function renderRecordList(container, items, emptyText, createItem) {
  container.replaceChildren();
  if (!items.length) {
    container.append(node("p", "record-empty", emptyText));
    return;
  }
  for (const item of items) container.append(createItem(item));
}

function statusLabel(status) {
  return ({ draft: "초안", published: "공개", archived: "보관", pending: "확인 대기", confirmed: "확정", rejected: "거절", cancelled: "취소", completed: "완료", active: "활성", suspended: "정지", deleted: "삭제됨" })[status] || status || "상태 없음";
}

function button(label, handler, danger = false) {
  const action = node("button", danger ? "danger" : "", label);
  action.type = "button";
  action.addEventListener("click", handler);
  return action;
}

function itemShell(title, meta, status) {
  const article = node("article", "record-item");
  const row = node("div", "record-title-row");
  row.append(node("h3", "record-title", title), node("span", "record-status", statusLabel(status)));
  article.append(row, node("p", "record-meta", meta));
  return article;
}

function matchesSearch(searchInput, values) {
  const query = searchInput.value.trim().toLocaleLowerCase("ko-KR");
  return !query || values.filter(Boolean).join(" ").toLocaleLowerCase("ko-KR").includes(query);
}

function renderDestinations() {
  const allEntries = Object.entries(adminData.destinations);
  const entries = allEntries.filter(([id, record]) => matchesSearch(destinationSearch, [id, record.name, record.region, record.address, record.description, statusLabel(record.status)]));
  const emptyText = allEntries.length && destinationSearch.value.trim() ? "검색 결과가 없습니다. 다른 검색어를 입력해 주세요." : "등록된 여행지가 없습니다.";
  renderRecordList(destinationList, entries, emptyText, ([id, record]) => {
    const item = itemShell(record.name, `${record.region} · ${record.address}`, record.status);
    const actions = node("div", "record-actions");
    actions.append(button("수정", () => editDestination(id, record)), button("삭제", () => deleteDestination(id, record.name), true));
    item.append(actions);
    return item;
  });
  destinationSelect.replaceChildren();
  const options = entries.map(([id, destination]) => new Option(`${destination.name} · ${destination.region}`, id));
  if (!options.length) options.push(new Option("먼저 여행지를 등록해 주세요", ""));
  destinationSelect.append(...options);
}

function renderStays() {
  const allEntries = Object.entries(adminData.stays);
  const entries = allEntries.filter(([id, record]) => {
    const destination = adminData.destinations[record.destinationId];
    return matchesSearch(staySearch, [id, record.name, record.address, record.description, record.contact, destination?.name, destination?.region, statusLabel(record.status)]);
  });
  const emptyText = allEntries.length && staySearch.value.trim() ? "검색 결과가 없습니다. 다른 검색어를 입력해 주세요." : "등록된 숙소가 없습니다.";
  renderRecordList(stayList, entries, emptyText, ([id, record]) => {
    const destination = adminData.destinations[record.destinationId];
    const item = itemShell(record.name, `${destination?.name || "연결 여행지 없음"} · ₩${new Intl.NumberFormat("ko-KR").format(Number(record.pricePerNight) || 0)} / 1박 · 최대 ${record.maxGuests}명`, record.status);
    const actions = node("div", "record-actions");
    actions.append(button("수정", () => editStay(id, record)), button("삭제", () => deleteStay(id, record.name), true));
    item.append(actions);
    return item;
  });
}

function renderReservations() {
  const allEntries = Object.entries(adminData.reservations).sort((a, b) => String(b[1].createdAt || "").localeCompare(String(a[1].createdAt || "")));
  const entries = allEntries.filter(([id, reservation]) => {
    const stay = adminData.stays[reservation.stayId];
    const member = adminData.members[reservation.memberId];
    return matchesSearch(reservationSearch, [id, reservation.stayId, reservation.memberId, reservation.checkIn, reservation.checkOut, reservation.status, statusLabel(reservation.status), stay?.name, member?.name, member?.email, member?.phone]);
  });
  const emptyText = allEntries.length && reservationSearch.value.trim() ? "검색 결과가 없습니다. 다른 검색어를 입력해 주세요." : "예약 요청이 없습니다.";
  renderRecordList(reservationList, entries, emptyText, ([id, reservation]) => {
    const stay = adminData.stays[reservation.stayId];
    const member = adminData.members[reservation.memberId];
    const item = itemShell(stay?.name || "숙소 정보 없음", `${member?.name || "회원"} · ${reservation.checkIn} ~ ${reservation.checkOut} · ${reservation.guestCount}명 · ₩${new Intl.NumberFormat("ko-KR").format(Number(reservation.totalPrice) || 0)}`, reservation.status);
    const actions = node("div", "record-actions");
    if (reservation.status === "pending") {
      actions.append(button("예약 확정", () => updateReservation(id, "confirmed")), button("예약 거절", () => updateReservation(id, "rejected"), true));
    } else if (reservation.status === "confirmed") {
      actions.append(button("이용 완료 처리", () => updateReservation(id, "completed")), button("취소 처리", () => updateReservation(id, "cancelled"), true));
    }
    if (actions.childElementCount) item.append(actions);
    return item;
  });
}

function renderMembers() {
  const query = memberSearch.value.trim().toLocaleLowerCase("ko-KR");
  const entries = Object.entries(adminData.members).filter(([uid, member]) => {
    const matchesRole = memberRoleFilter === "all" || (member.role || "member") === memberRoleFilter;
    const searchable = [member.name, member.email, member.phone, uid].join(" ").toLocaleLowerCase("ko-KR");
    return matchesRole && (!query || searchable.includes(query));
  });
  const emptyText = query ? "검색 결과가 없습니다. 검색어를 확인해 주세요." : memberRoleFilter === "all" ? "가입 회원이 없습니다." : memberRoleFilter === "admin" ? "등록된 관리자 프로필이 없습니다. 관리자 계정 설정 도구를 다시 실행해 주세요." : "등록된 사용자가 없습니다.";
  renderRecordList(memberList, entries, emptyText, ([uid, member]) => {
    const role = member.role || "member";
    const item = itemShell(member.name || "이름 없음", `${member.email || "이메일 없음"} · ${member.phone || "연락처 없음"} · UID ${uid}`, member.status);
    item.querySelector(".record-title-row").append(node("span", `role-badge role-${role}`, role === "admin" ? "관리자" : "사용자"));
    return item;
  });
}

memberSearch.addEventListener("input", renderMembers);
destinationSearch.addEventListener("input", renderDestinations);
staySearch.addEventListener("input", renderStays);
reservationSearch.addEventListener("input", renderReservations);
for (const clearButton of document.querySelectorAll("[data-clear-search]")) clearButton.addEventListener("click", () => {
  const input = document.getElementById(clearButton.dataset.clearSearch);
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
});
document.querySelector("#member-search-clear").addEventListener("click", () => {
  memberSearch.value = "";
  renderMembers();
  memberSearch.focus();
});

for (const filter of document.querySelectorAll("[data-member-role]")) filter.addEventListener("click", () => {
  memberRoleFilter = filter.dataset.memberRole;
  for (const item of document.querySelectorAll("[data-member-role]")) {
    const active = item === filter;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-pressed", String(active));
  }
  renderMembers();
});

function renderOverview() {
  document.querySelector("#metric-destinations").textContent = String(Object.keys(adminData.destinations).length);
  document.querySelector("#metric-stays").textContent = String(Object.keys(adminData.stays).length);
  document.querySelector("#metric-pending").textContent = String(Object.values(adminData.reservations).filter((reservation) => reservation.status === "pending").length);
  document.querySelector("#metric-members").textContent = String(Object.keys(adminData.members).length);
}

function refreshViews() {
  renderDestinations();
  renderStays();
  renderReservations();
  renderMembers();
  renderOverview();
}

async function loadAdminData() {
  setStatus("관리 데이터를 불러오고 있습니다.");
  try {
    const paths = ["destinations", "stays", "reservations", "members"];
    const snapshots = await Promise.all(paths.map((path) => get(ref(database, path))));
    paths.forEach((path, index) => { adminData[path] = snapshots[index].val() || {}; });
    refreshViews();
    setStatus("관리 데이터를 불러왔습니다.");
  } catch (error) {
    console.error("관리 데이터 읽기 실패", error);
    setStatus("데이터를 불러오지 못했습니다. 관리자 권한과 Firebase 규칙을 확인해 주세요.", true);
    window.alert("관리 정보를 불러오지 못했습니다.");
  }
}

function editDestination(id, record) {
  destinationForm.elements.id.value = id;
  for (const field of ["name", "region", "address", "description", "imageUrl", "status"]) destinationForm.elements[field].value = record[field] || "";
  document.querySelector("#destination-form-title").textContent = "여행지 수정";
  destinationForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function editStay(id, record) {
  stayForm.elements.id.value = id;
  for (const field of ["destinationId", "name", "address", "description", "imageUrl", "pricePerNight", "maxGuests", "contact", "status"]) stayForm.elements[field].value = record[field] ?? "";
  document.querySelector("#stay-form-title").textContent = "숙소 수정";
  stayForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

destinationForm.addEventListener("reset", () => setTimeout(() => { destinationForm.elements.id.value = ""; document.querySelector("#destination-form-title").textContent = "여행지 등록"; }, 0));
stayForm.addEventListener("reset", () => setTimeout(() => { stayForm.elements.id.value = ""; document.querySelector("#stay-form-title").textContent = "숙소 등록"; }, 0));

destinationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authorized) return;
  const data = Object.fromEntries(new FormData(destinationForm));
  const id = data.id || push(ref(database, "destinations")).key;
  const previous = adminData.destinations[id];
  const record = { name: data.name.trim(), region: data.region.trim(), address: data.address.trim(), description: data.description.trim(), imageUrl: data.imageUrl.trim(), status: data.status, createdAt: previous?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };
  setBusy(destinationForm, true);
  try {
    await set(ref(database, `destinations/${id}`), record);
    adminData.destinations[id] = { ...record, createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now() };
    refreshViews();
    destinationForm.reset();
    window.alert(previous ? "여행지 정보가 수정되었습니다." : "여행지가 등록되었습니다.");
  } catch (error) {
    console.error("여행지 저장 실패", error);
    window.alert("여행지를 저장하지 못했습니다. Firebase 관리자 규칙을 확인해 주세요.");
  } finally { setBusy(destinationForm, false, "저장"); }
});

stayForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authorized) return;
  const data = Object.fromEntries(new FormData(stayForm));
  const id = data.id || push(ref(database, "stays")).key;
  const previous = adminData.stays[id];
  const record = { destinationId: data.destinationId, name: data.name.trim(), address: data.address.trim(), description: data.description.trim(), imageUrl: data.imageUrl.trim(), pricePerNight: Number(data.pricePerNight), maxGuests: Number(data.maxGuests), contact: data.contact.trim(), status: data.status, createdAt: previous?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };
  setBusy(stayForm, true);
  try {
    await set(ref(database, `stays/${id}`), record);
    adminData.stays[id] = { ...record, createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now() };
    refreshViews();
    stayForm.reset();
    window.alert(previous ? "숙소 정보가 수정되었습니다." : "숙소가 등록되었습니다.");
  } catch (error) {
    console.error("숙소 저장 실패", error);
    window.alert("숙소를 저장하지 못했습니다. Firebase 관리자 규칙을 확인해 주세요.");
  } finally { setBusy(stayForm, false, "저장"); }
});

async function deleteDestination(id, name) {
  if (Object.values(adminData.stays).some((stay) => stay.destinationId === id) || Object.values(adminData.reservations).some((reservation) => reservation.destinationId === id)) {
    window.alert("연결된 숙소나 예약 이력이 있어 삭제할 수 없습니다. 보관 상태로 변경해 주세요.");
    return;
  }
  if (!window.confirm(`'${name}' 여행지를 삭제할까요?`)) return;
  try {
    await remove(ref(database, `destinations/${id}`));
    delete adminData.destinations[id];
    refreshViews();
    window.alert("여행지가 삭제되었습니다.");
  } catch (error) {
    console.error("여행지 삭제 실패", error);
    window.alert("여행지를 삭제하지 못했습니다.");
  }
}

async function deleteStay(id, name) {
  if (Object.values(adminData.reservations).some((reservation) => reservation.stayId === id)) {
    window.alert("예약 이력이 있어 삭제할 수 없습니다.");
    return;
  }
  if (!window.confirm(`'${name}' 숙소를 삭제할까요?`)) return;
  try {
    await remove(ref(database, `stays/${id}`));
    delete adminData.stays[id];
    refreshViews();
    window.alert("숙소가 삭제되었습니다.");
  } catch (error) {
    console.error("숙소 삭제 실패", error);
    window.alert("숙소를 삭제하지 못했습니다.");
  }
}

async function updateReservation(id, status) {
  const label = statusLabel(status);
  if (!window.confirm(`예약 상태를 '${label}'로 변경할까요?`)) return;
  try {
    await update(ref(database, `reservations/${id}`), { status, updatedAt: serverTimestamp() });
    adminData.reservations[id].status = status;
    refreshViews();
    window.alert(`예약 상태가 '${label}'로 변경되었습니다.`);
  } catch (error) {
    console.error("예약 상태 변경 실패", error);
    window.alert("예약 상태를 변경하지 못했습니다. 관리자 권한을 확인해 주세요.");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (authRedirecting) return;
  if (!user) {
    authRedirecting = true;
    window.alert("관리자 로그인 후 이용해 주세요.");
    window.location.replace("index.html");
    return;
  }
  try {
    const token = await user.getIdTokenResult(true);
    if (token.claims.admin !== true) {
      authRedirecting = true;
      await signOut(auth);
      window.alert("관리자 권한이 확인되지 않았습니다.");
      window.location.replace("index.html");
      return;
    }
    authorized = true;
    await loadAdminData();
  } catch (error) {
    console.error("관리자 권한 확인 실패", error);
    authRedirecting = true;
    window.alert("관리자 권한을 확인하지 못했습니다.");
    window.location.replace("index.html");
  }
});
