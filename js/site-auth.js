import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { get, ref, serverTimestamp, set } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";

const signupDialog = document.querySelector("#signup-dialog");
const loginDialog = document.querySelector("#login-dialog");
const adminLoginDialog = document.querySelector("#admin-login-dialog");
const memberLogoutButton = document.querySelector("#member-logout");
const adminLogoutButton = document.querySelector("#admin-logout");
const reserveButton = document.querySelector('[data-action="reserve"]');
const signupButton = document.querySelector('[data-dialog="signup-dialog"]');
const loginButton = document.querySelector('[data-dialog="login-dialog"]');
const adminButton = document.querySelector('[data-dialog="admin-login-dialog"]');

function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function errorMessage(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "이미 가입된 이메일입니다.";
  if (code.includes("invalid-email")) return "이메일 형식을 확인해 주세요.";
  if (code.includes("weak-password")) return "비밀번호는 6자 이상 입력해 주세요.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) return "이메일 또는 비밀번호를 확인해 주세요.";
  if (code.includes("network-request-failed")) return "네트워크 연결을 확인해 주세요.";
  if (code.includes("permission-denied")) return "Firebase 데이터베이스 규칙을 확인해 주세요.";
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function setBusy(form, busy) {
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = busy;
  submit.textContent = busy ? "처리 중…" : form.dataset.idleLabel;
}

async function ensureMemberProfile(user) {
  const profileRef = ref(database, `members/${user.uid}`);
  const snapshot = await get(profileRef);
  if (snapshot.exists()) return;
  const timestamp = serverTimestamp();
  await set(profileRef, {
    name: user.displayName || "회원",
    email: user.email || "",
    phone: "",
    role: "member",
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

for (const button of document.querySelectorAll("[data-dialog]")) {
  button.addEventListener("click", () => showDialog(document.getElementById(button.dataset.dialog)));
}

for (const closeButton of document.querySelectorAll(".dialog-close")) {
  closeButton.addEventListener("click", () => closeButton.closest("dialog").close());
}

for (const dialog of document.querySelectorAll(".account-dialog")) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

reserveButton?.addEventListener("click", () => {
  if (!auth.currentUser) {
    window.alert("로그인후 예약하시오");
    showDialog(loginDialog);
    return;
  }
  window.location.href = "html/reservation-create.html";
});

const signupForm = document.querySelector("#signup-form");
signupForm.dataset.idleLabel = "가입하기";
signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const name = String(formData.get("name")).trim();
  const email = String(formData.get("email")).trim().toLowerCase();
  const phone = String(formData.get("phone")).trim();
  const password = String(formData.get("password"));
  const status = signupForm.querySelector(".form-status");
  status.textContent = "";
  setBusy(signupForm, true);
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await set(ref(database, `members/${credential.user.uid}`), {
      name,
      email,
      phone,
      role: "member",
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    signupDialog.close();
    signupForm.reset();
    window.alert("가입 완료되었습니다.");
  } catch (error) {
    console.error("회원가입 실패", error);
    const message = errorMessage(error);
    status.textContent = message;
    window.alert(`회원가입 실패되었습니다. ${message}`);
  } finally {
    setBusy(signupForm, false);
  }
});

const loginForm = document.querySelector("#login-form");
loginForm.dataset.idleLabel = "로그인";
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));
  const status = loginForm.querySelector(".form-status");
  status.textContent = "";
  setBusy(loginForm, true);
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const token = await credential.user.getIdTokenResult(true);
    loginDialog.close();
    loginForm.reset();
    if (token.claims.admin === true) {
      window.alert("관리자 로그인 성공");
      window.location.href = "admin.html";
      return;
    }
    await ensureMemberProfile(credential.user);
    window.alert("로그인 되었습니다.");
  } catch (error) {
    console.error("로그인 실패", error);
    const message = errorMessage(error);
    status.textContent = message;
    window.alert("로그인 실패되었습니다.");
  } finally {
    setBusy(loginForm, false);
  }
});

const adminLoginForm = document.querySelector("#admin-login-form");
adminLoginForm.dataset.idleLabel = "관리자 로그인";
adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(adminLoginForm);
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));
  const status = adminLoginForm.querySelector(".form-status");
  status.textContent = "";
  setBusy(adminLoginForm, true);
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const token = await credential.user.getIdTokenResult(true);
    if (token.claims.admin !== true) {
      await signOut(auth);
      throw new Error("관리자 권한이 설정되지 않은 계정입니다.");
    }
    adminLoginDialog.close();
    adminLoginForm.reset();
    window.alert("관리자 로그인 성공");
    window.location.href = "admin.html";
  } catch (error) {
    console.error("관리자 로그인 실패", error);
    const message = error.message?.startsWith("관리자") ? error.message : "아이디 또는 비밀번호를 확인해 주세요.";
    status.textContent = message;
    window.alert("관리자 로그인 실패되었습니다.");
  } finally {
    setBusy(adminLoginForm, false);
  }
});

async function logout(isAdminLogout) {
  try {
    await signOut(auth);
    window.alert("로그아웃되었습니다");
    if (isAdminLogout && window.location.pathname.endsWith("/admin.html")) window.location.href = "index.html";
  } catch (error) {
    console.error("로그아웃 실패", error);
    window.alert("로그아웃하지 못했습니다. 다시 시도해 주세요.");
  }
}

memberLogoutButton?.addEventListener("click", () => logout(false));
adminLogoutButton?.addEventListener("click", () => logout(true));

onAuthStateChanged(auth, async (user) => {
  let isAdmin = false;
  if (user) {
    try {
      isAdmin = (await user.getIdTokenResult()).claims.admin === true;
    } catch (error) {
      console.error("계정 권한 확인 실패", error);
    }
  }
  if (reserveButton) reserveButton.hidden = isAdmin;
  if (signupButton) signupButton.hidden = Boolean(user);
  if (loginButton) loginButton.hidden = Boolean(user);
  if (adminButton) adminButton.hidden = Boolean(user);
  if (memberLogoutButton) memberLogoutButton.hidden = !user || isAdmin;
  if (adminLogoutButton) adminLogoutButton.hidden = !isAdmin;
});
