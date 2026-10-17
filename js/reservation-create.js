import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { equalTo, get, orderByChild, push, query, ref, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";

const form = document.querySelector("#reservation-form");
const staySelect = document.querySelector("#stay-select");
const statusNode = document.querySelector("#reservation-status");
const staysById = new Map();
let signedInUser = null;

function say(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", isError);
}

function utcDay(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.alert("로그인후 예약하시오");
    window.location.replace("../index.html");
    return;
  }
  signedInUser = user;
  try {
    const publishedQuery = query(ref(database, "stays"), orderByChild("status"), equalTo("published"));
    const snapshot = await get(publishedQuery);
    const stays = Object.entries(snapshot.val() || {});
    staySelect.replaceChildren(new Option(stays.length ? "숙소를 선택해 주세요" : "공개된 숙소가 없습니다", ""));
    for (const [id, stay] of stays) {
      staysById.set(id, stay);
      const option = new Option(`${stay.name || "이름 없는 숙소"} · ₩${new Intl.NumberFormat("ko-KR").format(Number(stay.pricePerNight) || 0)} / 1박`, id);
      staySelect.add(option);
    }
    if (!stays.length) say("공개된 숙소가 없습니다. 나중에 다시 확인해 주세요.", true);
  } catch (error) {
    console.error("숙소 목록 읽기 실패", error);
    staySelect.replaceChildren(new Option("숙소 목록을 불러오지 못했습니다", ""));
    say("숙소 정보를 불러오지 못했습니다. Firebase 규칙을 확인해 주세요.", true);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!signedInUser) {
    window.alert("로그인후 예약하시오");
    return;
  }
  const formData = new FormData(form);
  const stayId = String(formData.get("stayId"));
  const checkIn = String(formData.get("checkIn"));
  const checkOut = String(formData.get("checkOut"));
  const guestCount = Number(formData.get("guestCount"));
  const stay = staysById.get(stayId);
  if (!stay || stay.status !== "published") {
    say("예약할 수 있는 숙소를 선택해 주세요.", true);
    return;
  }
  if (!checkIn || !checkOut || utcDay(checkOut) <= utcDay(checkIn) || utcDay(checkIn) < utcDay(new Date().toISOString().slice(0, 10))) {
    say("체크아웃은 체크인 다음 날 이후로 선택하고, 체크인 날짜는 오늘 이후로 입력해 주세요.", true);
    return;
  }
  const nights = (utcDay(checkOut) - utcDay(checkIn)) / 86400000;
  const maxGuests = Number(stay.maxGuests);
  const pricePerNight = Number(stay.pricePerNight);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > maxGuests || !Number.isInteger(pricePerNight) || pricePerNight <= 0) {
    say("인원 또는 숙소 요금 정보를 확인해 주세요.", true);
    return;
  }

  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  say("예약 요청을 저장하고 있습니다.");
  try {
    const reservationRef = push(ref(database, "reservations"));
    await set(reservationRef, {
      memberId: signedInUser.uid,
      stayId,
      destinationId: stay.destinationId,
      checkIn,
      checkOut,
      guestCount,
      nights,
      pricePerNight,
      totalPrice: nights * pricePerNight,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    window.alert("예약 요청이 접수되었습니다.");
    window.location.href = "reservations.html";
  } catch (error) {
    console.error("예약 저장 실패", error);
    say("예약을 저장하지 못했습니다. 로그인 상태와 Firebase 규칙을 확인해 주세요.", true);
    window.alert("예약 요청에 실패했습니다.");
  } finally {
    submit.disabled = false;
  }
});
