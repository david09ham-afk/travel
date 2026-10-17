import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { equalTo, get, orderByChild, query, ref, serverTimestamp, update } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";

const list = document.querySelector("#reservation-list");
const statusNode = document.querySelector("#reservations-status");
const statusLabels = { pending: "확인 대기", confirmed: "예약 확정", rejected: "예약 거절", cancelled: "취소됨", completed: "이용 완료" };

function say(message, error = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", error);
  statusNode.hidden = !message;
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function renderReservations(uid) {
  try {
    const reservationQuery = query(ref(database, "reservations"), orderByChild("memberId"), equalTo(uid));
    const snapshot = await get(reservationQuery);
    const items = Object.entries(snapshot.val() || {}).sort((a, b) => String(b[1].createdAt || "").localeCompare(String(a[1].createdAt || "")));
    list.replaceChildren();
    if (!items.length) {
      say("아직 예약 내역이 없습니다.");
      return;
    }
    say("");
    for (const [id, reservation] of items) {
      const article = make("article", "reservation-item");
      const title = make("h2", "", `숙소 예약 · ${reservation.checkIn || ""} ~ ${reservation.checkOut || ""}`);
      const badge = make("span", `reservation-status status-${reservation.status}`, statusLabels[reservation.status] || reservation.status);
      const details = make("p", "reservation-details", `${reservation.guestCount}명 · ${reservation.nights}박 · ₩${new Intl.NumberFormat("ko-KR").format(Number(reservation.totalPrice) || 0)}`);
      article.append(title, badge, details);
      if (reservation.status === "pending") {
        const cancelButton = make("button", "inline-action", "예약 취소");
        cancelButton.type = "button";
        cancelButton.addEventListener("click", async () => {
          if (!window.confirm("이 예약 요청을 취소할까요?")) return;
          cancelButton.disabled = true;
          try {
            await update(ref(database, `reservations/${id}`), { status: "cancelled", updatedAt: serverTimestamp() });
            window.alert("예약이 취소되었습니다.");
            await renderReservations(uid);
          } catch (error) {
            console.error("예약 취소 실패", error);
            window.alert("예약을 취소하지 못했습니다. 다시 시도해 주세요.");
            cancelButton.disabled = false;
          }
        });
        article.append(cancelButton);
      }
      list.append(article);
    }
  } catch (error) {
    console.error("예약 목록 읽기 실패", error);
    say("예약 내역을 불러오지 못했습니다. Firebase 데이터베이스 규칙을 확인해 주세요.", true);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.alert("로그인 후 내 예약을 확인해 주세요.");
    window.location.replace("../index.html");
    return;
  }
  renderReservations(user.uid);
});
