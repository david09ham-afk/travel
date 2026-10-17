import { equalTo, get, orderByChild, query, ref } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { database } from "./firebase-config.js";

const searchForm = document.querySelector("#destination-search");
const regionSelect = document.querySelector("#region");
const keywordInput = document.querySelector("#keyword");
const searchNote = document.querySelector("#search-note");
const destinationGrid = document.querySelector("#destination-grid");
const destinationState = document.querySelector("#destination-state");
const stayGrid = document.querySelector("#stay-grid");
const stayState = document.querySelector("#stay-state");
const emptyMessage = document.querySelector("#results-empty");
const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector("#primary-nav");
const backToTop = document.querySelector(".back-to-top");
const visualThemes = ["jeju", "gangneung", "busan"];
let destinationCards = [];
let stayCards = [];

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === "https:" || url.origin === window.location.origin) return url.href;
  } catch {
    // 잘못된 이미지 주소는 사용하지 않고 CSS 배경을 보여줍니다.
  }
  return null;
}

function setState(node, message = "", isError = false) {
  node.textContent = message;
  node.classList.toggle("is-error", isError);
  node.hidden = !message;
}

function createDestinationCard(destination, index) {
  const name = typeof destination.name === "string" ? destination.name : "이름 없는 여행지";
  const region = typeof destination.region === "string" ? destination.region : "국내 여행지";
  const theme = visualThemes[index % visualThemes.length];
  const card = makeElement("a", `destination-card card-${theme}`);
  card.href = "#stays";
  card.dataset.region = `${name} ${region} ${destination.description || ""}`;
  card.append(makeElement("span", "destination-number", `${String(index + 1).padStart(2, "0")} / DESTINATION`));
  card.append(makeElement("span", "destination-meta", region));
  card.append(makeElement("h3", "", name));
  card.append(makeElement("span", "card-arrow", "↗"));

  const landscape = makeElement("span", `card-landscape landscape-${theme}`);
  landscape.setAttribute("aria-hidden", "true");
  const imageUrl = safeImageUrl(destination.imageUrl);
  if (imageUrl) {
    card.classList.add("has-image");
    const image = makeElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    landscape.append(image);
  } else {
    const decorationClasses = theme === "jeju"
      ? ["island-sun", "island-mountain", "island-water"]
      : theme === "gangneung"
        ? ["wave wave-a", "wave wave-b", "wave wave-c", "island-sun"]
        : ["city-sun", "building building-a", "building building-b", "building building-c", "city-water"];
    for (const className of decorationClasses) landscape.append(makeElement("i", className));
  }
  card.append(landscape);
  return card;
}

function createStayCard(stay, destination, index) {
  const name = typeof stay.name === "string" ? stay.name : "이름 없는 숙소";
  const theme = visualThemes[index % visualThemes.length];
  const placeName = destination?.name || destination?.region || "국내";
  const address = typeof stay.address === "string" ? stay.address : "";
  const card = makeElement("article", "stay-card");
  card.dataset.region = `${name} ${placeName} ${destination?.region || ""} ${address} ${stay.description || ""}`;

  const imageLink = makeElement("a", `stay-image stay-${theme}`);
  imageLink.href = "#guide";
  imageLink.setAttribute("aria-label", `${placeName} ${name} 숙소 정보`);
  const imageUrl = safeImageUrl(stay.imageUrl);
  if (imageUrl) {
    imageLink.classList.add("has-image");
    const image = makeElement("img", "stay-photo");
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    imageLink.append(image);
  } else {
    const art = makeElement("span", "stay-art");
    art.setAttribute("aria-hidden", "true");
    art.append(makeElement("i"), makeElement("b"));
    imageLink.append(art);
  }
  imageLink.append(makeElement("span", "stay-badge", Number.isFinite(Number(stay.maxGuests)) ? `최대 ${stay.maxGuests}명` : "숙소 정보"));
  imageLink.append(makeElement("span", "favorite", "♡"));
  card.append(imageLink);

  const info = makeElement("div", "stay-info");
  const titleRow = makeElement("div", "stay-title-row");
  const titleGroup = makeElement("div");
  titleGroup.append(makeElement("p", "stay-region", address ? `${placeName} · ${address}` : placeName));
  titleGroup.append(makeElement("h3", "", name));
  titleRow.append(titleGroup, makeElement("span", "stay-label", "추천 숙소"));
  info.append(titleRow);
  info.append(makeElement("p", "stay-summary", typeof stay.description === "string" ? stay.description : "여행의 하루를 편안하게 채워줄 숙소입니다."));

  const price = Number(stay.pricePerNight);
  const priceLine = makeElement("p", "stay-price");
  priceLine.append(makeElement("strong", "", Number.isFinite(price) && price > 0 ? `₩${new Intl.NumberFormat("ko-KR").format(price)}` : "요금 문의"));
  if (Number.isFinite(price) && price > 0) priceLine.append(makeElement("span", "", " / 1박"));
  info.append(priceLine);
  card.append(info);
  return card;
}

function matchesRegion(card, region) {
  return region === "all" || card.dataset.region.toLocaleLowerCase().includes(region.toLocaleLowerCase());
}

function filterListings(region, keyword = "") {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase("ko-KR");
  let visibleDestinations = 0;
  for (const card of destinationCards) {
    card.hidden = !matchesRegion(card, region) || (normalizedKeyword && !card.dataset.region.toLocaleLowerCase("ko-KR").includes(normalizedKeyword));
    if (!card.hidden) visibleDestinations += 1;
  }

  let visibleStays = 0;
  for (const card of stayCards) {
    card.hidden = !matchesRegion(card, region) || (normalizedKeyword && !card.dataset.region.toLocaleLowerCase("ko-KR").includes(normalizedKeyword));
    if (!card.hidden) visibleStays += 1;
  }

  emptyMessage.hidden = visibleStays > 0;
  if (region !== "all" && visibleDestinations === 0 && destinationCards.length) {
    setState(destinationState, "선택한 지역의 여행지가 없습니다.");
  } else if (destinationCards.length) {
    setState(destinationState);
  }
}

async function loadHomepageContent() {
  setState(destinationState, "Firebase에서 여행지 정보를 불러오는 중입니다.");
  setState(stayState, "Firebase에서 숙소 정보를 불러오는 중입니다.");

  try {
    const publishedDestinations = query(ref(database, "destinations"), orderByChild("status"), equalTo("published"));
    const publishedStays = query(ref(database, "stays"), orderByChild("status"), equalTo("published"));
    const [destinationSnapshot, staySnapshot] = await Promise.all([get(publishedDestinations), get(publishedStays)]);
    const destinationEntries = Object.entries(destinationSnapshot.val() || {});
    const stayEntries = Object.entries(staySnapshot.val() || {});
    const destinationById = new Map(destinationEntries.map(([id, value]) => [id, value]));

    destinationGrid.replaceChildren(...destinationEntries.map(([, destination], index) => createDestinationCard(destination, index)));
    stayGrid.replaceChildren(...stayEntries.map(([, stay], index) => createStayCard(stay, destinationById.get(stay.destinationId), index)));
    destinationCards = [...destinationGrid.querySelectorAll(".destination-card")];
    stayCards = [...stayGrid.querySelectorAll(".stay-card")];

    setState(destinationState, destinationCards.length ? "" : "공개된 여행지가 아직 없습니다.");
    setState(stayState, stayCards.length ? "" : "공개된 숙소가 아직 없습니다.");
    filterListings(regionSelect.value);
  } catch (error) {
    console.error("Firebase 홈페이지 데이터를 불러오지 못했습니다.", error);
    setState(destinationState, "여행지 정보를 불러오지 못했습니다. Firebase 연결과 데이터베이스 규칙을 확인해 주세요.", true);
    setState(stayState, "숙소 정보를 불러오지 못했습니다. Firebase 연결과 데이터베이스 규칙을 확인해 주세요.", true);
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const region = regionSelect.value;
  const keyword = keywordInput.value;
  filterListings(region, keyword);
  const regionLabel = region === "all" ? "전체 지역" : region;
  const keywordLabel = keyword.trim() ? ` · '${keyword.trim()}' 검색` : "";
  searchNote.textContent = `${regionLabel}${keywordLabel} 여행지와 숙소를 보여드려요. 날짜별 예약 가능 여부는 숙소 확인 후 안내됩니다.`;
  document.querySelector("#stays").scrollIntoView({ behavior: "smooth", block: "start" });
});

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "메뉴 열기" : "메뉴 닫기");
  primaryNav.classList.toggle("is-open", !isOpen);
});

primaryNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    primaryNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "메뉴 열기");
  }
});

function updateBackToTop() {
  backToTop.hidden = window.scrollY < 20;
}

window.addEventListener("scroll", updateBackToTop, { passive: true });
updateBackToTop();
backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

loadHomepageContent();
