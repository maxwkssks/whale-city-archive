import {
  auth,
  db,
  // [추가] signInAnonymously: SOOP 로그인 후 Firestore 쓰기 권한용 Firebase 세션 생성
  signInAnonymously,
  // [제거] createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  //        setDoc, doc, serverTimestamp
  //        → 이메일/비밀번호 회원가입·로그인 방식 제거로 불필요해짐
  signOut,
  onAuthStateChanged,
  collection,
  getDocs,
  query,
  orderBy
} from "./firebase.js";

console.log("고래시티 아카이브 시작");

/* ============================= */
/* [추가] SOOP 사용자 정보 관리  */
/* ============================= */

// SOOP 로그인 성공 시 soop-callback.js → URL 파라미터 → 여기서 localStorage 저장
// localStorage를 쓰는 이유: Firebase 익명 세션은 Firebase가 관리하고,
// SOOP 닉네임은 별도로 저장해야 수정 기록에 남길 수 있음

function getSoopUser() {
  const soopId   = localStorage.getItem("soop_id");
  const soopNick = localStorage.getItem("soop_nick");
  if (!soopId || !soopNick) return null;
  return { soopId, soopNick };
}

// login.html 에서만 실행: URL에 soop_id·soop_nick 파라미터가 있으면
// localStorage에 저장하고 Firebase 익명 로그인 후 홈으로 이동
if (location.pathname.includes("login.html")) {
  const soopParams  = new URLSearchParams(location.search);
  const soopIdParam = soopParams.get("soop_id");
  const soopNickParam = soopParams.get("soop_nick");
  const soopError   = soopParams.get("soop");

  const soopMessage = document.querySelector("#soopMessage");

  if (soopError === "error" && soopMessage) {
    // soop-callback.js에서 사용자 정보 조회 실패 시 오류 안내
    soopMessage.className = "auth-message error";
    soopMessage.textContent = "SOOP 로그인 중 오류가 발생했습니다. 다시 시도해주세요.";

  } else if (soopIdParam && soopNickParam) {
    // SOOP 콜백 성공: 닉네임·ID를 저장하고 Firebase 익명 로그인
    localStorage.setItem("soop_id",   soopIdParam);
    localStorage.setItem("soop_nick", soopNickParam);

    if (soopMessage) {
      soopMessage.className = "auth-message success";
      soopMessage.textContent = `${soopNickParam}님, 환영합니다! 잠시 후 홈으로 이동합니다.`;
    }

    // [버그 수정] 이미 로그인된 상태에서 SOOP 로그인을 다시 시도하면
    // signInAnonymously()가 새 익명 계정을 만들어 uid가 바뀜
    // → 기존에 본인이 올린 클립·인물의 uid와 달라져서 수정 불가해지는 문제
    // 해결: auth.currentUser로 이미 세션이 있는지 먼저 확인 후 분기
    if (auth.currentUser) {
      // 이미 로그인 중 → uid는 그대로 유지하고 SOOP 정보만 갱신 후 이동
      setTimeout(() => { location.href = "./index.html"; }, 1000);
    } else {
      // 신규 로그인 → Firebase 익명 로그인으로 Firestore 쓰기 권한 획득
      signInAnonymously(auth)
        .then(() => {
          setTimeout(() => { location.href = "./index.html"; }, 1000);
        })
        .catch((error) => {
          console.error("Firebase 익명 로그인 실패:", error);
          if (soopMessage) {
            soopMessage.className = "auth-message error";
            soopMessage.textContent = "로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
          }
        });
    }
  }
}

/* ============================= */
/* 전역 로그인 사용자 */
/* ============================= */

let currentUser = null;

/* ============================= */
/* 메인 페이지 버튼 */
/* ============================= */

const clipButton = document.querySelector(".primary-btn");
const worldcupButton = document.querySelector(".secondary-btn");

if (clipButton) {
  clipButton.addEventListener("click", () => {
    location.href = "./clips.html";
  });
}

if (worldcupButton) {
  worldcupButton.addEventListener("click", () => {
    location.href = "./worldcup-create.html";
  });
}

/* ============================= */
/* Firebase 클립 데이터 */
/* ============================= */

let firebaseClips = [];

function getDeletedClipIds() {
  const saved = localStorage.getItem("deletedClipIds");

  if (!saved) {
    return [];
  }

  return JSON.parse(saved);
}

// 클립 삭제 직후 getDocs가 재실행되기 전 잠깐 재표시되는 것을 막기 위한 낙관적 UI 처리
function saveDeletedClipId(clipId) {
  const deletedIds = getDeletedClipIds();

  if (!deletedIds.includes(String(clipId))) {
    deletedIds.push(String(clipId));
  }

  localStorage.setItem("deletedClipIds", JSON.stringify(deletedIds));
}

function getAllClips() {
  const deletedIds = getDeletedClipIds();
  return firebaseClips.filter((clip) => !deletedIds.includes(String(clip.id)));
}

function formatFirebaseDate(timestamp) {
  if (!timestamp || !timestamp.toDate) {
    return "방금 전";
  }

  const date = timestamp.toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

async function loadFirebaseClips() {
  const needsClips =
    document.querySelector("#clipList") ||
    document.querySelector("#clipDetail");

  if (!needsClips) return;

  try {
    const clipsQuery = query(
      collection(db, "clips"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(clipsQuery);

    firebaseClips = snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        title: data.title || "제목 없음",
        tag: data.tag || "기타",
        views: data.views || 0,
        likes: data.likes || 0,
        likedUsers: Array.isArray(data.likedUsers) ? data.likedUsers : [],
        date: formatFirebaseDate(data.createdAt),
        thumbnail: data.thumbnail || "./images/clip1.jpg",
        videoType: data.videoType || "youtube",
        videoUrl: data.videoUrl || "",
        description: data.description || "설명이 없습니다.",
        soopId: data.soopId || "",
        uid: data.uid || "",
        uploaderName: data.uploaderName || "알 수 없음"
      };
    });

    renderClips();
    renderClipDetail();
  } catch (error) {
    console.error("Firestore 클립 불러오기 실패:", error);
  }
}

/* ============================= */
/* Firebase 인물 데이터 */
/* ============================= */

let firebasePeople = [];

function getAllPeople() {
  return firebasePeople;
}

async function loadFirebasePeople() {
  const needsPeople = document.querySelector("#peopleList");

  if (!needsPeople) return;

  try {
    const peopleQuery = query(
      collection(db, "people"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(peopleQuery);

    firebasePeople = snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        name: data.name || "이름 없음",
        followers: data.followers || "0",
        profileImage: data.profileImage || "./images/profile1.jpg",
        description: data.description || "설명이 없습니다.",
        team: data.team || "소속 없음",
        role: data.role || "직책 없음",
        type: data.type || "시민",
        gangName: data.gangName || "",
        link: data.link || "#",
        soopId: data.soopId || "",
        uid: data.uid || "",
        uploaderName: data.uploaderName || "알 수 없음"
      };
    });

    renderPeople();
  } catch (error) {
    console.error("Firestore 인물 불러오기 실패:", error);
  }
}

/* ============================= */
/* clips.html 클립 목록 기능 */
/* ============================= */

const clipList = document.querySelector("#clipList");
const searchInput = document.querySelector("#searchInput");
const filterButtons = document.querySelectorAll(".filter-btn");
const sortSelect = document.querySelector("#sortSelect");
const clipCount = document.querySelector("#clipCount");

let currentTag = "전체";

function renderClips() {
  if (!clipList) return;

  const keyword = searchInput ? searchInput.value.toLowerCase() : "";
  const sortValue = sortSelect ? sortSelect.value : "latest";

  let result = getAllClips().filter((clip) => {
    const matchKeyword =
      clip.title.toLowerCase().includes(keyword) ||
      clip.tag.toLowerCase().includes(keyword) ||
      clip.description.toLowerCase().includes(keyword);

    const matchTag =
      currentTag === "전체" || clip.tag === currentTag;

    return matchKeyword && matchTag;
  });

  if (sortValue === "views") {
    result.sort((a, b) => Number(b.views) - Number(a.views));
  }

  if (sortValue === "likes") {
    result.sort((a, b) => Number(b.likes) - Number(a.likes));
  }

  if (sortValue === "latest") {
    result.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  if (clipCount) {
    clipCount.textContent = `${result.length}개`;
  }

  if (result.length === 0) {
    clipList.innerHTML = `
      <div class="empty-message">
        검색 결과가 없습니다.
      </div>
    `;
    return;
  }

  clipList.innerHTML = result.map((clip) => {
    return `
      <article class="clip-card clickable-card" onclick="location.href='./clip-detail.html?id=${clip.id}'">
        <div class="thumbnail">
          <img src="${clip.thumbnail}" alt="${clip.title}">
          <span class="thumbnail-badge">${String(clip.videoType).toUpperCase()}</span>
        </div>

        <div class="clip-info">
          <span class="tag">#${clip.tag}</span>
          <h3>${clip.title}</h3>
          <p>조회수 ${Number(clip.views).toLocaleString()} · 좋아요 ${Number(clip.likes).toLocaleString()}</p>
          <p>${clip.date}</p>
        </div>
      </article>
    `;
  }).join("");
}

if (searchInput) {
  searchInput.addEventListener("input", renderClips);
}

if (sortSelect) {
  sortSelect.addEventListener("change", renderClips);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    currentTag = button.dataset.tag;
    renderClips();
  });
});

/* ============================= */
/* 영상 플레이어 출력 함수 */
/* ============================= */

function renderVideoPlayer(clip) {
  if (!clip.videoUrl) {
    return `
      <div class="video-placeholder">
        <div class="play-icon">▶</div>
        <h2>NO VIDEO</h2>
      </div>
    `;
  }

  if (clip.videoType === "soop") {
    return `
      <iframe
        class="clip-video"
        src="${clip.videoUrl}"
        title="${clip.title}"
        frameborder="0"
        allow="clipboard-write; web-share; fullscreen"
        allowfullscreen>
      </iframe>
    `;
  }

  if (clip.videoType === "youtube") {
    return `
      <iframe
        class="clip-video"
        src="${clip.videoUrl}"
        title="${clip.title}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen>
      </iframe>
    `;
  }

  if (clip.videoType === "local") {
    return `
      <video class="clip-video" controls>
        <source src="${clip.videoUrl}" type="video/mp4">
        브라우저가 video 태그를 지원하지 않습니다.
      </video>
    `;
  }

  return `
    <div class="video-placeholder">
      <div class="play-icon">▶</div>
      <h2>NO VIDEO</h2>
    </div>
  `;
}

/* ============================= */
/* clip-detail.html 상세 페이지 */
/* ============================= */

const clipDetail = document.querySelector("#clipDetail");
const relatedClips = document.querySelector("#relatedClips");

function renderClipDetail() {
  if (!clipDetail) return;

  const params = new URLSearchParams(location.search);
  const clipId = params.get("id");

  const clip = getAllClips().find((item) => String(item.id) === String(clipId));

  if (!clip) {
    clipDetail.innerHTML = `
      <div class="empty-message">
        존재하지 않는 클립입니다.
      </div>
    `;
    return;
  }

  // [변경] Firebase uid 대신 SOOP ID로 소유권 확인
  //        soopId가 없는 기존 데이터(이메일 계정 시절 업로드)는 소유자 버튼 표시 안 함
  const soopUserForOwner = getSoopUser();
  const isOwner = soopUserForOwner && clip.soopId && soopUserForOwner.soopId === clip.soopId;

    const likedUsers = Array.isArray(clip.likedUsers) ? clip.likedUsers : [];

const isLiked =
  currentUser &&
  likedUsers.includes(currentUser.uid);

  document.title = `${clip.title} | 고래시티 아카이브`;

  clipDetail.innerHTML = `
    <div class="detail-top">
      <div class="detail-title-area">
        <span class="tag">#${clip.tag}</span>
        <h1>${clip.title}</h1>
        <div class="detail-meta">
          <span>${clip.date}</span>
          <span>조회수 ${Number(clip.views).toLocaleString()}</span>
          <span>좋아요 ${Number(clip.likes).toLocaleString()}</span>
          ${clip.uploaderName ? `<span>업로더 ${clip.uploaderName}</span>` : ""}
        </div>
      </div>

      <div class="detail-stat-box">
  <p>조회수</p>
  <h3>${Number(clip.views).toLocaleString()}</h3>

  <p>좋아요</p>
  <h3>${Number(clip.likes).toLocaleString()}</h3>

  <button type="button" class="like-clip-btn ${isLiked ? "liked" : ""}" id="likeClipBtn">
    ${isLiked ? "좋아요 취소" : "좋아요"}
  </button>
</div>
    </div>

    <div class="video-box">
      ${renderVideoPlayer(clip)}
    </div>

    <div class="detail-desc">
      <h2>클립 설명</h2>
      <p>${clip.description}</p>
    </div>

    ${
      isOwner
        ? `
          <div class="clip-owner-actions">
            <button type="button" class="edit-clip-btn" id="editClipBtn">클립 수정</button>
            <button type="button" class="delete-clip-btn" id="deleteClipBtn">클립 삭제</button>
          </div>
        `
        : ""
    }
  `;

  if (isOwner) {
    const editClipBtn = document.querySelector("#editClipBtn");
    const deleteClipBtn = document.querySelector("#deleteClipBtn");

    if (editClipBtn) {
      editClipBtn.addEventListener("click", () => {
        location.href = `./clip-edit.html?id=${clip.id}`;
      });
    }

    if (deleteClipBtn) {
      deleteClipBtn.addEventListener("click", () => {
        deleteCurrentClip(clip);
      });
    }
  }
  const likeClipBtn = document.querySelector("#likeClipBtn");

if (likeClipBtn) {
  likeClipBtn.addEventListener("click", () => {
    toggleClipLike(clip);
  });
}

increaseClipViewCount(clip);

  renderRelatedClips(clip);
}

function renderRelatedClips(currentClip) {
  if (!relatedClips) return;

  const allClips = getAllClips();

  const related = allClips
    .filter((clip) => String(clip.id) !== String(currentClip.id) && clip.tag === currentClip.tag)
    .slice(0, 3);

  const fallback = allClips
    .filter((clip) => String(clip.id) !== String(currentClip.id))
    .slice(0, 3);

  const result = related.length > 0 ? related : fallback;

  relatedClips.innerHTML = result.map((clip) => {
    return `
      <article class="clip-card clickable-card" onclick="location.href='./clip-detail.html?id=${clip.id}'">
        <div class="thumbnail">
          <img src="${clip.thumbnail}" alt="${clip.title}">
          <span class="thumbnail-badge">${String(clip.videoType).toUpperCase()}</span>
        </div>

        <div class="clip-info">
          <span class="tag">#${clip.tag}</span>
          <h3>${clip.title}</h3>
          <p>조회수 ${Number(clip.views).toLocaleString()} · 좋아요 ${Number(clip.likes).toLocaleString()}</p>
          <p>${clip.date}</p>
        </div>
      </article>
    `;
  }).join("");
}

/* ============================= */
/* 클립 수정 / 삭제 REST 기능 */
/* ============================= */

function getClipDocumentUrl(clipId) {
  return `https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/clips/${clipId}`;
}

/* ============================= */
/* 조회수 / 좋아요 기능 */
/* ============================= */

function getViewedClipIds() {
  const saved = sessionStorage.getItem("viewedClipIds");

  if (!saved) {
    return [];
  }

  return JSON.parse(saved);
}

function saveViewedClipId(clipId) {
  const viewedIds = getViewedClipIds();

  if (!viewedIds.includes(String(clipId))) {
    viewedIds.push(String(clipId));
  }

  sessionStorage.setItem("viewedClipIds", JSON.stringify(viewedIds));
}

async function increaseClipViewCount(clip) {
  // soopId와 uid 둘 다 없으면 Firestore에 저장되지 않은 비정상 문서이므로 건너뜀
  if (!clip || (!clip.soopId && !clip.uid)) return;

  const viewedIds = getViewedClipIds();

  if (viewedIds.includes(String(clip.id))) {
    return;
  }

  try {
    const nextViews = Number(clip.views || 0) + 1;

    // [버그 수정] Authorization 헤더 없이 PATCH 요청을 보내면
    // Firestore 보안 규칙(request.auth != null)에 막혀서 조회수가 올라가지 않음
    // currentUser가 없으면(비로그인) 조회수 증가 건너뜀
    if (!currentUser) return;

    const viewToken = await currentUser.getIdToken();

    const response = await fetch(
      getClipDocumentUrl(clip.id) + "?updateMask.fieldPaths=views",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${viewToken}`
        },
        body: JSON.stringify({
          fields: {
            views: { integerValue: String(nextViews) }
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("조회수 증가 실패:", result);
      return;
    }

    saveViewedClipId(clip.id);
  } catch (error) {
    console.error("조회수 증가 오류:", error);
  }
}

async function toggleClipLike(clip) {
  if (!currentUser) {
    alert("로그인 후 좋아요를 누를 수 있습니다.");
    location.href = "./login.html";
    return;
  }

  // soopId와 uid 둘 다 없으면 Firestore에 저장되지 않은 비정상 문서이므로 건너뜀
  if (!clip || (!clip.soopId && !clip.uid)) return;

  const likedUsers = Array.isArray(clip.likedUsers) ? [...clip.likedUsers] : [];
  const myUid = currentUser.uid;

  const alreadyLiked = likedUsers.includes(myUid);

  let nextLikedUsers = [];
  let nextLikes = Number(clip.likes || 0);

  if (alreadyLiked) {
    nextLikedUsers = likedUsers.filter((uid) => uid !== myUid);
    nextLikes = Math.max(0, nextLikes - 1);
  } else {
    nextLikedUsers = [...likedUsers, myUid];
    nextLikes = nextLikes + 1;
  }

  const token = await currentUser.getIdToken();

  const likedUserValues = nextLikedUsers.map((uid) => {
    return {
      stringValue: uid
    };
  });

  try {
    const response = await fetch(
      getClipDocumentUrl(clip.id) +
        "?updateMask.fieldPaths=likes" +
        "&updateMask.fieldPaths=likedUsers",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fields: {
            likes: { integerValue: String(nextLikes) },
            likedUsers: {
              arrayValue: {
                values: likedUserValues
              }
            }
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("좋아요 저장 실패:", result);
      alert("좋아요 저장 실패: " + (result.error?.message || "알 수 없는 오류"));
      return;
    }

    clip.likes = nextLikes;
    clip.likedUsers = nextLikedUsers;

    renderClipDetail();
  } catch (error) {
    console.error("좋아요 오류:", error);
    alert("좋아요 처리 중 오류가 발생했습니다.");
  }
}

async function updateClipToFirestoreRest(clipId, updateData) {
  const token = await currentUser.getIdToken();

  const url =
    getClipDocumentUrl(clipId) +
    "?updateMask.fieldPaths=title" +
    "&updateMask.fieldPaths=tag" +
    "&updateMask.fieldPaths=thumbnail" +
    "&updateMask.fieldPaths=videoType" +
    "&updateMask.fieldPaths=videoUrl" +
    "&updateMask.fieldPaths=description" +
    "&updateMask.fieldPaths=updatedAt" +
    // [추가] editedBy: 마지막으로 수정한 SOOP 닉네임을 Firestore에 기록
    //        updateMask에 명시해야 해당 필드만 PATCH로 업데이트됨
    "&updateMask.fieldPaths=editedBy";

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      fields: {
        title: { stringValue: updateData.title },
        tag: { stringValue: updateData.tag },
        thumbnail: { stringValue: updateData.thumbnail },
        videoType: { stringValue: updateData.videoType },
        videoUrl: { stringValue: updateData.videoUrl },
        description: { stringValue: updateData.description },
        updatedAt: { timestampValue: new Date().toISOString() },
        // [추가] 수정자 SOOP 닉네임 저장 (updateData.editedBy로 전달받음)
        editedBy: { stringValue: updateData.editedBy || "알 수 없음" }
      }
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("REST 클립 수정 실패:", result);
    throw new Error(result.error?.message || "Firestore 클립 수정 실패");
  }

  return result;
}

async function deleteClipFromFirestoreRest(clipId) {
  const token = await currentUser.getIdToken();

  const response = await fetch(getClipDocumentUrl(clipId), {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const result = await response.json();
    console.error("REST 클립 삭제 실패:", result);
    throw new Error(result.error?.message || "Firestore 클립 삭제 실패");
  }

  return true;
}

async function openClipEditPrompt(clip) {
  if (!currentUser) {
    alert("로그인 후 수정할 수 있습니다.");
    return;
  }

  // [변경] Firebase uid → SOOP ID로 소유권 확인
  const soopUserForEdit = getSoopUser();
  if (!soopUserForEdit || !clip.soopId || soopUserForEdit.soopId !== clip.soopId) {
    alert("본인이 올린 클립만 수정할 수 있습니다.");
    return;
  }

  const title = prompt("클립 제목을 수정하세요.", clip.title);
  if (title === null) return;

  const tag = prompt("태그를 수정하세요. 예: 레전드, 웃긴장면, 명장면, 사건, 감동 , 연애 , 노래 , 선거 , 전투", clip.tag);
  if (tag === null) return;

  const thumbnail = prompt("썸네일 이미지 주소를 수정하세요.", clip.thumbnail);
  if (thumbnail === null) return;

  const videoType = prompt("영상 타입을 수정하세요. 예: soop, youtube, local", clip.videoType);
  if (videoType === null) return;

  const videoUrl = prompt("영상 URL을 수정하세요.", clip.videoUrl);
  if (videoUrl === null) return;

  const description = prompt("클립 설명을 수정하세요.", clip.description);
  if (description === null) return;

  // [추가] editedBy: prompt 수정 시에도 SOOP 닉네임 기록
  const soopUserForClip = getSoopUser();
  const updateData = {
    title: title.trim(),
    tag: tag.trim(),
    thumbnail: thumbnail.trim(),
    videoType: videoType.trim(),
    videoUrl: videoUrl.trim(),
    description: description.trim(),
    editedBy: soopUserForClip ? soopUserForClip.soopNick : "알 수 없음"
  };

  if (
    !updateData.title ||
    !updateData.tag ||
    !updateData.thumbnail ||
    !updateData.videoType ||
    !updateData.videoUrl ||
    !updateData.description
  ) {
    alert("빈 값은 저장할 수 없습니다.");
    return;
  }

  try {
    await updateClipToFirestoreRest(clip.id, updateData);

    alert("클립이 수정되었습니다.");
    location.reload();
  } catch (error) {
    console.error("클립 수정 실패:", error);
    alert("클립 수정 실패: " + error.message);
  }
}

async function deleteCurrentClip(targetClip) {
  if (!currentUser) {
    alert("로그인 후 삭제할 수 있습니다.");
    return;
  }

  // [변경] Firebase uid → SOOP ID로 소유권 확인
  const soopUserForDelete = getSoopUser();
  if (!soopUserForDelete || !targetClip.soopId || soopUserForDelete.soopId !== targetClip.soopId) {
    alert("본인이 올린 클립만 삭제할 수 있습니다.");
    return;
  }

  const confirmDelete = confirm(`정말 "${targetClip.title}" 클립을 삭제할까요?`);

  if (!confirmDelete) return;

  try {
    await deleteClipFromFirestoreRest(targetClip.id);

    firebaseClips = firebaseClips.filter((item) => {
      return String(item.id) !== String(targetClip.id);
    });

    saveDeletedClipId(targetClip.id);

    alert("클립이 삭제되었습니다.");
    location.href = "./clips.html";
  } catch (error) {
    console.error("클립 삭제 실패:", error);
    alert("클립 삭제 실패: " + error.message);
  }
}

/* ============================= */
/* people.html 인물 아카이브 */
/* ============================= */

const peopleList = document.querySelector("#peopleList");
const peopleSearchInput = document.querySelector("#peopleSearchInput");
const peopleFilterButtons = document.querySelectorAll(".people-filter-btn");
const peopleCount = document.querySelector("#peopleCount");

let currentPeopleRole = "전체";

function renderPeople() {
  if (!peopleList) return;

  const keyword = peopleSearchInput ? peopleSearchInput.value.toLowerCase() : "";

  const result = getAllPeople().filter((person) => {
    const matchKeyword =
      person.name.toLowerCase().includes(keyword) ||
      person.description.toLowerCase().includes(keyword) ||
      person.team.toLowerCase().includes(keyword) ||
      person.role.toLowerCase().includes(keyword) ||
      person.type.toLowerCase().includes(keyword) ||
      (person.gangName && person.gangName.toLowerCase().includes(keyword));

    const matchRole =
      currentPeopleRole === "전체" || person.type === currentPeopleRole;

    return matchKeyword && matchRole;
  });

  if (peopleCount) {
    peopleCount.textContent = `${result.length}명`;
  }

  if (result.length === 0) {
    peopleList.innerHTML = `
      <div class="empty-message">
        검색 결과가 없습니다.
      </div>
    `;
    return;
  }

  peopleList.innerHTML = result.map((person) => {
    return `
      <article class="people-card">
        <div class="people-top">
          <div class="people-avatar">
            <img src="${person.profileImage}" alt="${person.name}">
          </div>

          <div class="people-name-area">
            <div class="people-name-row">
              <h3>${person.name}</h3>

              <a 
                href="${person.link}" 
                class="people-link" 
                title="외부 링크"
                target="_blank"
                rel="noopener noreferrer"
              >
                ↗
              </a>
            </div>

            <p class="people-followers">애청자 ${person.followers}</p>
          </div>
        </div>

        <p class="people-desc">${person.description}</p>

        <div class="people-divider"></div>

        <p class="people-info-title">RP 정보</p>

        <div class="people-info-box">
          <span class="people-team">${person.team}</span>
          <span class="people-role">${person.role}</span>
        </div>

        ${
          person.type === "갱" && person.gangName
            ? `
              <div class="people-info-box gang-info-box">
                <span class="people-team">갱단</span>
                <span class="people-role">${person.gangName}</span>
              </div>
            `
            : ""
        }

        ${
          // [변경] Firebase uid → SOOP ID로 소유자 버튼 표시 여부 결정
          getSoopUser() &&
          person.soopId &&
          getSoopUser().soopId === person.soopId
            ? `
              <div class="people-owner-actions">
                <button type="button" class="edit-person-btn" data-id="${person.id}">
                  프로필 수정
                </button>
                <button type="button" class="delete-person-btn" data-id="${person.id}">
                  프로필 삭제
                </button>
              </div>
            `
            : ""
        }
      </article>
    `;
  }).join("");

  const editPersonButtons = document.querySelectorAll(".edit-person-btn");
  const deletePersonButtons = document.querySelectorAll(".delete-person-btn");

  editPersonButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const personId = button.dataset.id;

      const person = getAllPeople().find((item) => {
        return String(item.id) === String(personId);
      });

      if (person) {
        location.href = `./people-edit.html?id=${person.id}`;
      }
    });
  });

  deletePersonButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const personId = button.dataset.id;

      const person = getAllPeople().find((item) => {
        return String(item.id) === String(personId);
      });

      if (person) {
        deleteCurrentPerson(person);
      }
    });
  });
}

if (peopleSearchInput) {
  peopleSearchInput.addEventListener("input", renderPeople);
}

peopleFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    peopleFilterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    currentPeopleRole = button.dataset.role;
    renderPeople();
  });
});

/* ============================= */
/* 프로필 수정 / 삭제 REST 기능 */
/* ============================= */

function getPersonDocumentUrl(personId) {
  return `https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/people/${personId}`;
}

async function updatePersonToFirestoreRest(personId, updateData) {
  const token = await currentUser.getIdToken();

  const url =
    getPersonDocumentUrl(personId) +
    "?updateMask.fieldPaths=name" +
    "&updateMask.fieldPaths=followers" +
    "&updateMask.fieldPaths=profileImage" +
    "&updateMask.fieldPaths=description" +
    "&updateMask.fieldPaths=team" +
    "&updateMask.fieldPaths=role" +
    "&updateMask.fieldPaths=type" +
    "&updateMask.fieldPaths=gangName" +
    "&updateMask.fieldPaths=link" +
    "&updateMask.fieldPaths=updatedAt" +
    // [추가] editedBy: 수정자 SOOP 닉네임 기록용
    "&updateMask.fieldPaths=editedBy";

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      fields: {
        name: { stringValue: updateData.name },
        followers: { stringValue: updateData.followers },
        profileImage: { stringValue: updateData.profileImage },
        description: { stringValue: updateData.description },
        team: { stringValue: updateData.team },
        role: { stringValue: updateData.role },
        type: { stringValue: updateData.type },
        gangName: { stringValue: updateData.gangName || "" },
        link: { stringValue: updateData.link },
        updatedAt: { timestampValue: new Date().toISOString() },
        // [추가] 수정자 SOOP 닉네임 저장
        editedBy: { stringValue: updateData.editedBy || "알 수 없음" }
      }
    })
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("REST 프로필 수정 실패:", result);
    throw new Error(result.error?.message || "Firestore 프로필 수정 실패");
  }

  return result;
}

async function deletePersonFromFirestoreRest(personId) {
  const token = await currentUser.getIdToken();

  const response = await fetch(getPersonDocumentUrl(personId), {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const result = await response.json();
    console.error("REST 프로필 삭제 실패:", result);
    throw new Error(result.error?.message || "Firestore 프로필 삭제 실패");
  }

  return true;
}

async function openPersonEditPrompt(person) {
  if (!currentUser) {
    alert("로그인 후 수정할 수 있습니다.");
    return;
  }

  // [변경] Firebase uid → SOOP ID로 소유권 확인
  const soopUserForPersonEdit = getSoopUser();
  if (!soopUserForPersonEdit || !person.soopId || soopUserForPersonEdit.soopId !== person.soopId) {
    alert("본인이 올린 프로필만 수정할 수 있습니다.");
    return;
  }

  const name = prompt("이름을 수정하세요.", person.name);
  if (name === null) return;

  const followers = prompt("애청자 수를 수정하세요.", person.followers);
  if (followers === null) return;

  const profileImage = prompt("프로필 사진 주소를 수정하세요.", person.profileImage);
  if (profileImage === null) return;

  const description = prompt("설명을 수정하세요.", person.description);
  if (description === null) return;

  const team = prompt("소속을 수정하세요.", person.team);
  if (team === null) return;

  const role = prompt("직책을 수정하세요.", person.role);
  if (role === null) return;

  const type = prompt("직업군을 수정하세요. 예: EMS, 경찰, 시청직원, 언론인, 정치인, 갱, 시민", person.type);
  if (type === null) return;

  let gangName = person.gangName || "";

  if (type.trim() === "갱") {
    gangName = prompt(
      "갱단 이름을 수정하세요. 예: 아자방, 블랙핀, 크라켄, 샤크, 고래파, 기타",
      person.gangName || ""
    );

    if (gangName === null) return;
  } else {
    gangName = "";
  }

  const link = prompt("외부 링크를 수정하세요.", person.link);
  if (link === null) return;

  // [추가] editedBy: prompt 수정 시에도 SOOP 닉네임 기록
  const soopUserForPerson = getSoopUser();
  const updateData = {
    name: name.trim(),
    followers: followers.trim(),
    profileImage: profileImage.trim(),
    description: description.trim(),
    team: team.trim(),
    role: role.trim(),
    type: type.trim(),
    gangName: gangName.trim(),
    link: link.trim(),
    editedBy: soopUserForPerson ? soopUserForPerson.soopNick : "알 수 없음"
  };

  if (
    !updateData.name ||
    !updateData.followers ||
    !updateData.profileImage ||
    !updateData.description ||
    !updateData.team ||
    !updateData.role ||
    !updateData.type ||
    !updateData.link
  ) {
    alert("빈 값은 저장할 수 없습니다.");
    return;
  }

  if (updateData.type === "갱" && !updateData.gangName) {
    alert("갱 직업군은 갱단 이름이 필요합니다.");
    return;
  }

  try {
    await updatePersonToFirestoreRest(person.id, updateData);

    alert("프로필이 수정되었습니다.");
    location.reload();
  } catch (error) {
    console.error("프로필 수정 실패:", error);
    alert("프로필 수정 실패: " + error.message);
  }
}

async function deleteCurrentPerson(person) {
  if (!currentUser) {
    alert("로그인 후 삭제할 수 있습니다.");
    return;
  }

  // [변경] Firebase uid → SOOP ID로 소유권 확인
  const soopUserForPersonDelete = getSoopUser();
  if (!soopUserForPersonDelete || !person.soopId || soopUserForPersonDelete.soopId !== person.soopId) {
    alert("본인이 올린 프로필만 삭제할 수 있습니다.");
    return;
  }

  const confirmDelete = confirm(`정말 "${person.name}" 프로필을 삭제할까요?`);

  if (!confirmDelete) return;

  try {
    await deletePersonFromFirestoreRest(person.id);

    firebasePeople = firebasePeople.filter((item) => {
      return String(item.id) !== String(person.id);
    });

    alert("프로필이 삭제되었습니다.");
    location.reload();
  } catch (error) {
    console.error("프로필 삭제 실패:", error);
    alert("프로필 삭제 실패: " + error.message);
  }
}

/* ============================= */
/* Firebase 로그인 / 회원가입 */
/* ============================= */

const headerLoginBtn = document.querySelector("#headerLoginBtn");

// [제거] loginTab, signupTab, loginForm, signupForm, loginMessage, signupMessage
//        이메일/비밀번호 로그인·회원가입 UI가 login.html에서 제거되었으므로
//        관련 querySelector와 이벤트 핸들러 전체 삭제

function showMessage(target, text, type) {
  if (!target) return;

  target.className = "auth-message";
  target.textContent = text;

  if (type) {
    target.classList.add(type);
  }
}


function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function makeAuthEmailFromLoginId(loginId) {
  return `${normalizeLoginId(loginId)}@whalecity.local`;
}

function isValidLoginId(loginId) {
  const loginIdRegex = /^[a-z0-9_]+$/;
  return loginIdRegex.test(loginId);
}

function logoutUser() {
  // [추가] 로그아웃 시 localStorage의 SOOP 정보도 함께 삭제
  // Firebase 익명 세션만 지우고 SOOP 닉네임이 남으면 다음 방문자가 이전 사람으로 보일 수 있음
  localStorage.removeItem("soop_id");
  localStorage.removeItem("soop_nick");

  signOut(auth)
    .then(() => {
      alert("로그아웃되었습니다.");
      location.href = "./index.html";
    })
    .catch((error) => {
      alert("로그아웃 실패: " + error.message);
    });
}

function setupLoginDropdown(user) {
  if (!headerLoginBtn) return;

  let loginArea = document.querySelector(".login-area");

  if (!loginArea) {
    loginArea = document.createElement("div");
    loginArea.className = "login-area";

    headerLoginBtn.parentNode.insertBefore(loginArea, headerLoginBtn);
    loginArea.appendChild(headerLoginBtn);
  }

  const oldDropdown = loginArea.querySelector(".login-dropdown");

  if (oldDropdown) {
    oldDropdown.remove();
  }

  if (user) {
    // [변경] 기존: Firebase displayName 또는 이메일 앞부분을 닉네임으로 사용
    //        변경: SOOP 로그인 닉네임을 우선 사용 (localStorage에 저장됨)
    //             SOOP 정보가 없을 경우 Firebase uid 앞 8자를 fallback으로 사용
    const soopUser = getSoopUser();
    const nickname = soopUser ? soopUser.soopNick : (user.uid.slice(0, 8) + "…");

    headerLoginBtn.textContent = `${nickname}님`;
    headerLoginBtn.title = "메뉴 열기";

    const dropdown = document.createElement("div");
    dropdown.className = "login-dropdown";

    dropdown.innerHTML = `
      <button type="button" class="logout-option" id="logoutBtn">
        로그아웃
      </button>
    `;

    loginArea.appendChild(dropdown);

    headerLoginBtn.onclick = (event) => {
      event.stopPropagation();
      dropdown.classList.toggle("show");
    };

    const logoutBtn = dropdown.querySelector("#logoutBtn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const confirmLogout = confirm("로그아웃할까요?");

        if (!confirmLogout) return;

        try {
          // [추가] 로그아웃 시 SOOP 닉네임 정보도 함께 삭제
          localStorage.removeItem("soop_id");
          localStorage.removeItem("soop_nick");
          await signOut(auth);
          alert("로그아웃되었습니다.");
          location.href = "./index.html";
        } catch (error) {
          console.error("로그아웃 실패:", error);
          alert("로그아웃 실패: " + error.message);
        }
      });
    }

    document.addEventListener("click", () => {
      dropdown.classList.remove("show");
    });

    dropdown.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  } else {
    headerLoginBtn.textContent = "로그인";
    headerLoginBtn.title = "로그인 페이지로 이동";

    headerLoginBtn.onclick = () => {
      location.href = "./login.html";
    };
  }
}
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  setupLoginDropdown(user);
  renderClipDetail();
  renderPeople();

  if (typeof initEditPersonPage === "function") {
    initEditPersonPage();
  }

  if (typeof initEditClipPage === "function") {
    initEditClipPage();
  }

  if (typeof initAdminPage === "function") {
    initAdminPage();
  }

  if (location.pathname.includes("upload.html") && !user) {
    showMessage(document.querySelector("#uploadMessage"), "로그인 후 클립을 올릴 수 있습니다.", "error");

    setTimeout(() => {
      location.href = "./login.html";
    }, 800);
  }

  if (location.pathname.includes("people-upload.html") && !user) {
    showMessage(document.querySelector("#personUploadMessage"), "로그인 후 프로필을 등록할 수 있습니다.", "error");

    setTimeout(() => {
      location.href = "./login.html";
    }, 800);
  }

  if (location.pathname.includes("worldcup-create.html") && !user) {
    showMessage(document.querySelector("#worldcupCreateMessage"), "로그인 후 월드컵을 만들 수 있습니다.", "error");

    setTimeout(() => {
      location.href = "./login.html";
    }, 800);
  }
});

// [제거] 이메일/비밀번호 탭 전환, 회원가입, 로그인 폼 이벤트 핸들러 전체 삭제
//        SOOP 로그인으로 완전 교체됨 (login.html 상단의 SOOP 버튼 참고)
//        로그인 처리 흐름: /api/soop-login → SOOP OAuth → /api/soop-callback
//        → login.html?soop_id=...&soop_nick=... → 이 파일 상단 SOOP 콜백 처리 블록

/* ============================= */
/* Firebase 클립 올리기 */
/* ============================= */

const uploadClipForm = document.querySelector("#uploadClipForm");
const uploadMessage = document.querySelector("#uploadMessage");

const uploadThumbnailFile = document.querySelector("#uploadThumbnailFile");
const thumbnailPreviewBox = document.querySelector("#thumbnailPreviewBox");
const thumbnailPreview = document.querySelector("#thumbnailPreview");
const previewPlaceholder = document.querySelector("#previewPlaceholder");

const clipCardThumbnailPreview = document.querySelector("#clipCardThumbnailPreview");
const clipCardPreviewPlaceholder = document.querySelector("#clipCardPreviewPlaceholder");
const fetchVideoInfoBtn = document.querySelector("#fetchVideoInfoBtn");

let selectedThumbnailDataUrl = "";

function convertImageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("이미지 파일이 없습니다."));
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 업로드할 수 있습니다."));
      return;
    }

    const maxSize = 1024 * 1024;

    if (file.size > maxSize) {
      reject(new Error("썸네일 이미지는 1MB 이하로 올려주세요."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };

    reader.readAsDataURL(file);
  });
}

if (thumbnailPreviewBox && uploadThumbnailFile) {
  thumbnailPreviewBox.addEventListener("click", () => {
    uploadThumbnailFile.click();
  });
}

function resetThumbnailPreviews() {
  selectedThumbnailDataUrl = "";

  if (thumbnailPreview && previewPlaceholder) {
    thumbnailPreview.src = "";
    thumbnailPreview.style.display = "none";
    previewPlaceholder.style.display = "block";
  }

  if (clipCardThumbnailPreview && clipCardPreviewPlaceholder) {
    clipCardThumbnailPreview.src = "";
    clipCardThumbnailPreview.style.display = "none";
    clipCardPreviewPlaceholder.style.display = "block";
  }
}

function showThumbnailPreviews(imageDataUrl) {
  if (thumbnailPreview && previewPlaceholder) {
    thumbnailPreview.src = imageDataUrl;
    thumbnailPreview.style.display = "block";
    previewPlaceholder.style.display = "none";
  }

  if (clipCardThumbnailPreview && clipCardPreviewPlaceholder) {
    clipCardThumbnailPreview.src = imageDataUrl;
    clipCardThumbnailPreview.style.display = "block";
    clipCardPreviewPlaceholder.style.display = "none";
  }
}

async function fetchSoopVideoInfo(videoUrl) {
  const response = await fetch(`/api/soop-info?url=${encodeURIComponent(videoUrl)}`);
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message || "SOOP 영상 정보를 가져오지 못했습니다.");
  }

  return result;
}

if (fetchVideoInfoBtn) {
  fetchVideoInfoBtn.addEventListener("click", async () => {
    const videoTypeSelect = document.querySelector("#uploadVideoType");
    const videoUrlInput = document.querySelector("#uploadVideoUrl");

    if (!videoTypeSelect || !videoUrlInput) return;

    const videoType = videoTypeSelect.value;
    const originalVideoUrl = videoUrlInput.value.trim();

    if (!originalVideoUrl) {
      alert("영상 URL을 먼저 입력해주세요.");
      return;
    }

    if (videoType !== "soop") {
      alert("자동 정보 가져오기는 현재 SOOP 영상만 지원합니다.");
      return;
    }

    try {
      fetchVideoInfoBtn.disabled = true;
      fetchVideoInfoBtn.textContent = "가져오는 중...";

      const info = await fetchSoopVideoInfo(originalVideoUrl);

      if (info.embedUrl) {
        videoUrlInput.value = info.embedUrl;
      }

      if (info.thumbnail) {
        selectedThumbnailDataUrl = info.thumbnail;
        showThumbnailPreviews(info.thumbnail);
      } else {
        alert("썸네일을 찾지 못했습니다.");
      }
    } catch (error) {
      console.error("SOOP 영상 정보 가져오기 실패:", error);
      alert(error.message);
    } finally {
      fetchVideoInfoBtn.disabled = false;
      fetchVideoInfoBtn.textContent = "영상 정보 자동 가져오기";
    }
  });
}


if (uploadThumbnailFile && thumbnailPreview && previewPlaceholder) {
  uploadThumbnailFile.addEventListener("change", async () => {
    const file = uploadThumbnailFile.files[0];

    if (!file) {
      resetThumbnailPreviews();
      return;
    }

    try {
      selectedThumbnailDataUrl = await convertImageFileToDataUrl(file);
      showThumbnailPreviews(selectedThumbnailDataUrl);
    } catch (error) {
      uploadThumbnailFile.value = "";
      resetThumbnailPreviews();
      alert(error.message);
    }
  });
}

function getFirestoreErrorMessage(error) {
  if (!error) {
    return "알 수 없는 오류가 발생했습니다.";
  }

  if (error.code === "permission-denied") {
    return "Firestore 권한 문제입니다. Firestore 보안 규칙을 확인해주세요.";
  }

  if (error.code === "unauthenticated") {
    return "로그인 정보가 확인되지 않았습니다. 다시 로그인해주세요.";
  }

  if (error.code === "unavailable") {
    return "Firebase 서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.";
  }

  if (error.code === "failed-precondition") {
    return "Firestore 설정 문제가 있습니다. 콘솔 설정을 확인해주세요.";
  }

  return error.message || "등록 중 오류가 발생했습니다.";
}

async function saveClipToFirestoreRest(clipData) {
  if (!currentUser) {
    throw new Error("로그인 정보가 없습니다.");
  }

  const token = await currentUser.getIdToken(true);

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(
      "https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/clips",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          fields: {
            title: { stringValue: clipData.title },
            tag: { stringValue: clipData.tag },
            thumbnail: { stringValue: clipData.thumbnail },
            videoType: { stringValue: clipData.videoType },
            videoUrl: { stringValue: clipData.videoUrl },
            description: { stringValue: clipData.description },
            views: { integerValue: String(clipData.views) },
            likes: { integerValue: String(clipData.likes) },
            likedUsers: {
              arrayValue: {
                values: []
              }
            },
            // [변경] uid → soopId: Firestore 문서에 SOOP ID 저장
            soopId: { stringValue: clipData.soopId },
            uploaderName: { stringValue: clipData.uploaderName },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        })
      }
    );

    clearTimeout(timeoutId);

    const result = await response.json();

    if (!response.ok) {
      console.error("REST 클립 저장 실패:", result);
      throw new Error(result.error?.message || "Firestore 클립 저장 실패");
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error("저장 요청 시간이 초과되었습니다. 인터넷 연결 또는 Firestore 규칙을 확인해주세요.");
    }

    throw error;
  }
}

if (uploadClipForm) {
  uploadClipForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = uploadClipForm.querySelector("button[type='submit']");

    if (!currentUser) {
      showMessage(uploadMessage, "로그인 후 클립을 올릴 수 있습니다.", "error");
      setTimeout(() => { location.href = "./login.html"; }, 800);
      return;
    }

    // [버그 수정] SOOP 로그인 정보 없이 등록하면 soopId가 빈 문자열로 저장되어
    // 나중에 본인 클립 수정/삭제가 불가능해짐 → 여기서 차단
    if (!getSoopUser()) {
      showMessage(uploadMessage, "SOOP 로그인 정보가 없습니다. 다시 로그인해주세요.", "error");
      setTimeout(() => { location.href = "./login.html"; }, 800);
      return;
    }

    const title = document.querySelector("#uploadTitle").value.trim();
    const tag = document.querySelector("#uploadTag").value;
    const thumbnail = selectedThumbnailDataUrl;
    const videoType = document.querySelector("#uploadVideoType").value;
    const videoUrl = document.querySelector("#uploadVideoUrl").value.trim();
    const description = document.querySelector("#uploadDescription").value.trim();

    if (!title || !tag || !videoType || !videoUrl || !description) {
      showMessage(uploadMessage, "클립 정보를 모두 입력해주세요.", "error");
      return;
    }

    if (!thumbnail) {
      showMessage(uploadMessage, "썸네일이 없습니다. SOOP 영상은 영상 정보 자동 가져오기를 먼저 눌러주세요.", "error");
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "등록 중...";
      }

      showMessage(uploadMessage, "클립 등록 중입니다...", "success");

      // [변경] uploaderName: 기존 Firebase displayName(이메일 계정 이름) →
      //        SOOP 닉네임으로 변경. 누가 올렸는지 SOOP 이름으로 기록됨
      const soopUser = getSoopUser();
      const clipData = {
        title,
        tag,
        thumbnail,
        videoType,
        videoUrl,
        description,
        views: 0,
        likes: 0,
        // [변경] uid(Firebase 익명 uid) → soopId(SOOP 계정 ID)로 소유자 식별
        soopId: soopUser ? soopUser.soopId : "",
        uploaderName: soopUser ? soopUser.soopNick : "알 수 없음"
      };

      const result = await saveClipToFirestoreRest(clipData);

      console.log("클립 등록 성공:", result);

      showMessage(uploadMessage, "클립이 등록되었습니다! 클립 목록으로 이동합니다.", "success");

      setTimeout(() => {
        location.href = "./clips.html";
      }, 1000);
    } catch (error) {
      console.error("클립 등록 실패:", error);

      showMessage(uploadMessage, "클립 등록 실패: " + error.message, "error");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "클립 등록하기";
      }
    }
  });
}
/* ============================= */
/* Firebase 프로필 올리기 */
/* ============================= */

const uploadPersonForm = document.querySelector("#uploadPersonForm");
const personUploadMessage = document.querySelector("#personUploadMessage");

const personProfileImageFile = document.querySelector("#personProfileImageFile");
const personProfilePreviewBox = document.querySelector("#personProfilePreviewBox");
const personProfilePreview = document.querySelector("#personProfilePreview");
const personPreviewPlaceholder = document.querySelector("#personPreviewPlaceholder");

let selectedPersonProfileDataUrl = "";

const personTypeSelect = document.querySelector("#personType");
const gangNameBox = document.querySelector("#gangNameBox");
const personGangName = document.querySelector("#personGangName");
const customGangNameBox = document.querySelector("#customGangNameBox");
const customGangName = document.querySelector("#customGangName");

if (personTypeSelect && gangNameBox && personGangName) {
  personTypeSelect.addEventListener("change", () => {
    if (personTypeSelect.value === "갱") {
      gangNameBox.classList.remove("hidden");
      personGangName.setAttribute("required", "required");
    } else {
      gangNameBox.classList.add("hidden");
      personGangName.removeAttribute("required");
      personGangName.value = "";

      if (customGangNameBox && customGangName) {
        customGangNameBox.classList.add("hidden");
        customGangName.removeAttribute("required");
        customGangName.value = "";
      }
    }
  });
}

if (personGangName && customGangNameBox && customGangName) {
  personGangName.addEventListener("change", () => {
    if (personGangName.value === "직접입력") {
      customGangNameBox.classList.remove("hidden");
      customGangName.setAttribute("required", "required");
    } else {
      customGangNameBox.classList.add("hidden");
      customGangName.removeAttribute("required");
      customGangName.value = "";
    }
  });
}

function convertProfileImageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("이미지 파일이 없습니다."));
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 업로드할 수 있습니다."));
      return;
    }

    const maxSize = 1024 * 1024;

    if (file.size > maxSize) {
      reject(new Error("프로필 이미지는 1MB 이하로 올려주세요."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };

    reader.readAsDataURL(file);
  });
}

if (personProfilePreviewBox && personProfileImageFile) {
  personProfilePreviewBox.addEventListener("click", () => {
    personProfileImageFile.click();
  });
}

if (personProfileImageFile && personProfilePreview && personPreviewPlaceholder) {
  personProfileImageFile.addEventListener("change", async () => {
    const file = personProfileImageFile.files[0];

    if (!file) {
      selectedPersonProfileDataUrl = "";
      personProfilePreview.src = "";
      personProfilePreview.style.display = "none";
      personPreviewPlaceholder.style.display = "block";
      return;
    }

    try {
      selectedPersonProfileDataUrl = await convertProfileImageFileToDataUrl(file);

      personProfilePreview.src = selectedPersonProfileDataUrl;
      personProfilePreview.style.display = "block";
      personPreviewPlaceholder.style.display = "none";
    } catch (error) {
      selectedPersonProfileDataUrl = "";
      personProfileImageFile.value = "";

      personProfilePreview.src = "";
      personProfilePreview.style.display = "none";
      personPreviewPlaceholder.style.display = "block";

      alert(error.message);
    }
  });
}

async function savePersonToFirestoreRest(personData) {
  const token = await currentUser.getIdToken();

  const response = await fetch(
    "https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/people",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: {
          name: { stringValue: personData.name },
          followers: { stringValue: personData.followers },
          profileImage: { stringValue: personData.profileImage },
          description: { stringValue: personData.description },
          team: { stringValue: personData.team },
          role: { stringValue: personData.role },
          type: { stringValue: personData.type },
          gangName: { stringValue: personData.gangName || "" },
          link: { stringValue: personData.link },
          // [변경] uid → soopId: Firestore 문서에 SOOP ID 저장
          soopId: { stringValue: personData.soopId },
          uploaderName: { stringValue: personData.uploaderName },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("REST 프로필 저장 실패:", result);
    throw new Error(result.error?.message || "Firestore 프로필 저장 실패");
  }

  return result;
}

if (uploadPersonForm) {
  uploadPersonForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = uploadPersonForm.querySelector("button[type='submit']");

    if (!currentUser) {
      showMessage(personUploadMessage, "로그인 후 프로필을 등록할 수 있습니다.", "error");
      setTimeout(() => { location.href = "./login.html"; }, 800);
      return;
    }

    // [버그 수정] soopId 없이 저장되면 나중에 수정/삭제 불가
    if (!getSoopUser()) {
      showMessage(personUploadMessage, "SOOP 로그인 정보가 없습니다. 다시 로그인해주세요.", "error");
      setTimeout(() => { location.href = "./login.html"; }, 800);
      return;
    }

    const name = document.querySelector("#personName").value.trim();
    const followers = document.querySelector("#personFollowers").value.trim();
    const profileImage = selectedPersonProfileDataUrl;
    const description = document.querySelector("#personDescription").value.trim();
    const team = document.querySelector("#personTeam").value.trim();
    const role = document.querySelector("#personRole").value.trim();
    const type = document.querySelector("#personType").value;

    const selectedGangName = document.querySelector("#personGangName")
      ? document.querySelector("#personGangName").value.trim()
      : "";

    const customGangNameValue = document.querySelector("#customGangName")
      ? document.querySelector("#customGangName").value.trim()
      : "";

    const gangName =
      selectedGangName === "직접입력"
        ? customGangNameValue
        : selectedGangName;

    const link = document.querySelector("#personLink").value.trim();

    if (!name || !followers || !profileImage || !description || !team || !role || !type || !link) {
      showMessage(personUploadMessage, "모든 항목을 입력해주세요.", "error");
      return;
    }

    if (type === "갱" && !gangName) {
      showMessage(personUploadMessage, "갱 직업군은 갱단 이름을 선택하거나 직접 입력해야 합니다.", "error");
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "등록 중...";
      }

      showMessage(personUploadMessage, "프로필 등록 중입니다...", "success");

      // [변경] uploaderName: Firebase displayName → SOOP 닉네임으로 변경
      const soopUser = getSoopUser();
      const personData = {
        name,
        followers,
        profileImage,
        description,
        team,
        role,
        type,
        gangName,
        link,
        // [변경] uid → soopId: Firestore 문서에 SOOP ID 저장
        soopId: soopUser ? soopUser.soopId : "",
        uploaderName: soopUser ? soopUser.soopNick : "알 수 없음"
      };

      const result = await savePersonToFirestoreRest(personData);

      console.log("프로필 등록 성공:", result.name);

      showMessage(personUploadMessage, "프로필이 등록되었습니다! 이동합니다.", "success");

      setTimeout(() => {
        location.href = "./people.html";
      }, 1000);
    } catch (error) {
      console.error("프로필 등록 실패:", error);

      showMessage(personUploadMessage, "프로필 등록 실패: " + error.message, "error");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "프로필 등록하기";
      }
    }
  });
}


/* ============================= */
/* people-edit.html 프로필 수정 페이지 */
/* ============================= */

const editPersonForm = document.querySelector("#editPersonForm");
const editPersonMessage = document.querySelector("#editPersonMessage");

const editPersonProfileImageFile = document.querySelector("#editPersonProfileImageFile");
const editPersonProfilePreviewBox = document.querySelector("#editPersonProfilePreviewBox");
const editPersonProfilePreview = document.querySelector("#editPersonProfilePreview");
const editPersonPreviewPlaceholder = document.querySelector("#editPersonPreviewPlaceholder");

const editPersonTypeSelect = document.querySelector("#editPersonType");
const editGangNameBox = document.querySelector("#editGangNameBox");
const editPersonGangName = document.querySelector("#editPersonGangName");
const editCustomGangNameBox = document.querySelector("#editCustomGangNameBox");
const editCustomGangName = document.querySelector("#editCustomGangName");

let editingPersonId = "";
let selectedEditPersonProfileDataUrl = "";

function getEditPersonIdFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get("id") || "";
}

async function fetchPersonById(personId) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/people/${personId}`
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("프로필 단일 불러오기 실패:", result);
    throw new Error(result.error?.message || "프로필 정보를 불러오지 못했습니다.");
  }

  const fields = result.fields || {};

  return {
    id: personId,
    name: fields.name?.stringValue || "",
    followers: fields.followers?.stringValue || "",
    profileImage: fields.profileImage?.stringValue || "",
    description: fields.description?.stringValue || "",
    team: fields.team?.stringValue || "",
    role: fields.role?.stringValue || "",
    type: fields.type?.stringValue || "",
    gangName: fields.gangName?.stringValue || "",
    link: fields.link?.stringValue || "",
    // [변경] uid → soopId: 소유권 확인을 SOOP ID 기반으로 변경
    soopId: fields.soopId?.stringValue || "",
    uid: fields.uid?.stringValue || ""  // 기존 데이터 호환성 유지용
  };
}

function showEditPersonPreview(imageUrl) {
  if (!editPersonProfilePreview || !editPersonPreviewPlaceholder) return;

  if (!imageUrl) {
    editPersonProfilePreview.src = "";
    editPersonProfilePreview.style.display = "none";
    editPersonPreviewPlaceholder.style.display = "block";
    return;
  }

  editPersonProfilePreview.src = imageUrl;
  editPersonProfilePreview.style.display = "block";
  editPersonPreviewPlaceholder.style.display = "none";
}

function updateEditGangUI(typeValue, gangNameValue = "") {
  if (!editGangNameBox || !editPersonGangName) return;

  if (typeValue === "갱") {
    editGangNameBox.classList.remove("hidden");
    editPersonGangName.setAttribute("required", "required");

    const defaultGangOptions = ["아자방", "블랙핀", "크라켄", "샤크", "고래파"];

    if (defaultGangOptions.includes(gangNameValue)) {
      editPersonGangName.value = gangNameValue;

      if (editCustomGangNameBox && editCustomGangName) {
        editCustomGangNameBox.classList.add("hidden");
        editCustomGangName.removeAttribute("required");
        editCustomGangName.value = "";
      }
    } else if (gangNameValue) {
      editPersonGangName.value = "직접입력";

      if (editCustomGangNameBox && editCustomGangName) {
        editCustomGangNameBox.classList.remove("hidden");
        editCustomGangName.setAttribute("required", "required");
        editCustomGangName.value = gangNameValue;
      }
    } else {
      editPersonGangName.value = "";
    }
  } else {
    editGangNameBox.classList.add("hidden");
    editPersonGangName.removeAttribute("required");
    editPersonGangName.value = "";

    if (editCustomGangNameBox && editCustomGangName) {
      editCustomGangNameBox.classList.add("hidden");
      editCustomGangName.removeAttribute("required");
      editCustomGangName.value = "";
    }
  }
}

function fillEditPersonForm(person) {
  const nameInput = document.querySelector("#editPersonName");
  const followersInput = document.querySelector("#editPersonFollowers");
  const descriptionInput = document.querySelector("#editPersonDescription");
  const teamInput = document.querySelector("#editPersonTeam");
  const roleInput = document.querySelector("#editPersonRole");
  const typeInput = document.querySelector("#editPersonType");
  const linkInput = document.querySelector("#editPersonLink");

  if (nameInput) nameInput.value = person.name;
  if (followersInput) followersInput.value = person.followers;
  if (descriptionInput) descriptionInput.value = person.description;
  if (teamInput) teamInput.value = person.team;
  if (roleInput) roleInput.value = person.role;
  if (typeInput) typeInput.value = person.type;
  if (linkInput) linkInput.value = person.link;

  selectedEditPersonProfileDataUrl = person.profileImage;
  showEditPersonPreview(person.profileImage);
  updateEditGangUI(person.type, person.gangName);
}

async function initEditPersonPage() {
  if (!editPersonForm) return;

  editingPersonId = getEditPersonIdFromUrl();

  if (!editingPersonId) {
    showMessage(editPersonMessage, "수정할 프로필 ID가 없습니다.", "error");
    return;
  }

  if (!currentUser) {
    showMessage(editPersonMessage, "로그인 후 수정할 수 있습니다.", "error");

    setTimeout(() => {
      location.href = "./login.html";
    }, 800);

    return;
  }

  try {
    showMessage(editPersonMessage, "프로필 정보를 불러오는 중입니다...", "success");

    const person = await fetchPersonById(editingPersonId);

    // [변경] Firebase uid → SOOP ID로 소유권 확인
    const soopUserForInitPerson = getSoopUser();
    if (!soopUserForInitPerson || !person.soopId || soopUserForInitPerson.soopId !== person.soopId) {
      showMessage(editPersonMessage, "본인이 올린 프로필만 수정할 수 있습니다.", "error");
      return;
    }

    fillEditPersonForm(person);
    showMessage(editPersonMessage, "", "");
  } catch (error) {
    console.error("프로필 수정 페이지 초기화 실패:", error);
    showMessage(editPersonMessage, "프로필 정보를 불러오지 못했습니다: " + error.message, "error");
  }
}

if (editPersonProfilePreviewBox && editPersonProfileImageFile) {
  editPersonProfilePreviewBox.addEventListener("click", () => {
    editPersonProfileImageFile.click();
  });
}

if (editPersonProfileImageFile && editPersonProfilePreview && editPersonPreviewPlaceholder) {
  editPersonProfileImageFile.addEventListener("change", async () => {
    const file = editPersonProfileImageFile.files[0];

    if (!file) return;

    try {
      selectedEditPersonProfileDataUrl = await convertProfileImageFileToDataUrl(file);
      showEditPersonPreview(selectedEditPersonProfileDataUrl);
    } catch (error) {
      editPersonProfileImageFile.value = "";
      alert(error.message);
    }
  });
}

if (editPersonTypeSelect) {
  editPersonTypeSelect.addEventListener("change", () => {
    updateEditGangUI(editPersonTypeSelect.value, "");
  });
}

if (editPersonGangName && editCustomGangNameBox && editCustomGangName) {
  editPersonGangName.addEventListener("change", () => {
    if (editPersonGangName.value === "직접입력") {
      editCustomGangNameBox.classList.remove("hidden");
      editCustomGangName.setAttribute("required", "required");
    } else {
      editCustomGangNameBox.classList.add("hidden");
      editCustomGangName.removeAttribute("required");
      editCustomGangName.value = "";
    }
  });
}

if (editPersonForm) {
  editPersonForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      showMessage(editPersonMessage, "로그인 후 수정할 수 있습니다.", "error");
      return;
    }

    const submitButton = editPersonForm.querySelector("button[type='submit']");

    const name = document.querySelector("#editPersonName").value.trim();
    const followers = document.querySelector("#editPersonFollowers").value.trim();
    const profileImage = selectedEditPersonProfileDataUrl;
    const description = document.querySelector("#editPersonDescription").value.trim();
    const team = document.querySelector("#editPersonTeam").value.trim();
    const role = document.querySelector("#editPersonRole").value.trim();
    const type = document.querySelector("#editPersonType").value;
    const link = document.querySelector("#editPersonLink").value.trim();

    const selectedGangName = editPersonGangName ? editPersonGangName.value.trim() : "";
    const customGangNameValue = editCustomGangName ? editCustomGangName.value.trim() : "";

    const gangName =
      selectedGangName === "직접입력"
        ? customGangNameValue
        : selectedGangName;

    if (!name || !followers || !profileImage || !description || !team || !role || !type || !link) {
      showMessage(editPersonMessage, "모든 항목을 입력해주세요.", "error");
      return;
    }

    if (type === "갱" && !gangName) {
      showMessage(editPersonMessage, "갱 직업군은 갱단 이름을 선택하거나 직접 입력해야 합니다.", "error");
      return;
    }

    // [추가] editedBy: 수정 시점의 SOOP 닉네임을 updateData에 포함
    //        updatePersonToFirestoreRest 내부에서 Firestore에 기록됨
    const soopUser = getSoopUser();
    const updateData = {
      name,
      followers,
      profileImage,
      description,
      team,
      role,
      type,
      gangName,
      link,
      editedBy: soopUser ? soopUser.soopNick : "알 수 없음"
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "수정 중...";
      }

      showMessage(editPersonMessage, "프로필 수정 중입니다...", "success");

      await updatePersonToFirestoreRest(editingPersonId, updateData);

      showMessage(editPersonMessage, "프로필이 수정되었습니다! 인물 페이지로 이동합니다.", "success");

      setTimeout(() => {
        location.href = "./people.html";
      }, 1000);
    } catch (error) {
      console.error("프로필 수정 실패:", error);
      showMessage(editPersonMessage, "프로필 수정 실패: " + error.message, "error");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "프로필 수정하기";
      }
    }
  });
}



/* ============================= */
/* clip-edit.html 클립 수정 페이지 */
/* ============================= */

const editClipForm = document.querySelector("#editClipForm");
const editClipMessage = document.querySelector("#editClipMessage");

const editClipThumbnailPreview = document.querySelector("#editClipThumbnailPreview");
const editClipPreviewPlaceholder = document.querySelector("#editClipPreviewPlaceholder");
const editFetchVideoInfoBtn = document.querySelector("#editFetchVideoInfoBtn");

let editingClipId = "";
let selectedEditClipThumbnail = "";

function getEditClipIdFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get("id") || "";
}

async function fetchClipById(clipId) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/clips/${clipId}`
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("클립 단일 불러오기 실패:", result);
    throw new Error(result.error?.message || "클립 정보를 불러오지 못했습니다.");
  }

  const fields = result.fields || {};

  return {
    id: clipId,
    title: fields.title?.stringValue || "",
    tag: fields.tag?.stringValue || "",
    thumbnail: fields.thumbnail?.stringValue || "",
    videoType: fields.videoType?.stringValue || "",
    videoUrl: fields.videoUrl?.stringValue || "",
    description: fields.description?.stringValue || "",
    // [변경] uid → soopId: 소유권 확인을 SOOP ID 기반으로 변경
    soopId: fields.soopId?.stringValue || "",
    uid: fields.uid?.stringValue || ""  // 기존 데이터 호환성 유지용
  };
}

function showEditClipThumbnail(imageUrl) {
  if (!editClipThumbnailPreview || !editClipPreviewPlaceholder) return;

  if (!imageUrl) {
    editClipThumbnailPreview.src = "";
    editClipThumbnailPreview.style.display = "none";
    editClipPreviewPlaceholder.style.display = "block";
    return;
  }

  editClipThumbnailPreview.src = imageUrl;
  editClipThumbnailPreview.style.display = "block";
  editClipPreviewPlaceholder.style.display = "none";
}

function fillEditClipForm(clip) {
  const titleInput = document.querySelector("#editClipTitle");
  const tagInput = document.querySelector("#editClipTag");
  const videoTypeInput = document.querySelector("#editClipVideoType");
  const videoUrlInput = document.querySelector("#editClipVideoUrl");
  const descriptionInput = document.querySelector("#editClipDescription");

  if (titleInput) titleInput.value = clip.title;
  if (tagInput) tagInput.value = clip.tag;
  if (videoTypeInput) videoTypeInput.value = clip.videoType;
  if (videoUrlInput) videoUrlInput.value = clip.videoUrl;
  if (descriptionInput) descriptionInput.value = clip.description;

  selectedEditClipThumbnail = clip.thumbnail;
  showEditClipThumbnail(clip.thumbnail);
}

async function initEditClipPage() {
  if (!editClipForm) return;

  editingClipId = getEditClipIdFromUrl();

  if (!editingClipId) {
    showMessage(editClipMessage, "수정할 클립 ID가 없습니다.", "error");
    return;
  }

  if (!currentUser) {
    showMessage(editClipMessage, "로그인 후 수정할 수 있습니다.", "error");

    setTimeout(() => {
      location.href = "./login.html";
    }, 800);

    return;
  }

  try {
    showMessage(editClipMessage, "클립 정보를 불러오는 중입니다...", "success");

    const clip = await fetchClipById(editingClipId);

    // [변경] Firebase uid → SOOP ID로 소유권 확인
    const soopUserForInitClip = getSoopUser();
    if (!soopUserForInitClip || !clip.soopId || soopUserForInitClip.soopId !== clip.soopId) {
      showMessage(editClipMessage, "본인이 올린 클립만 수정할 수 있습니다.", "error");
      return;
    }

    fillEditClipForm(clip);
    showMessage(editClipMessage, "", "");
  } catch (error) {
    console.error("클립 수정 페이지 초기화 실패:", error);
    showMessage(editClipMessage, "클립 정보를 불러오지 못했습니다: " + error.message, "error");
  }
}

if (editFetchVideoInfoBtn) {
  editFetchVideoInfoBtn.addEventListener("click", async () => {
    const videoTypeInput = document.querySelector("#editClipVideoType");
    const videoUrlInput = document.querySelector("#editClipVideoUrl");

    if (!videoTypeInput || !videoUrlInput) return;

    const videoType = videoTypeInput.value;
    const originalVideoUrl = videoUrlInput.value.trim();

    if (!originalVideoUrl) {
      alert("영상 URL을 먼저 입력해주세요.");
      return;
    }

    if (videoType !== "soop") {
      alert("SOOP 영상만 자동 가져오기를 지원합니다.");
      return;
    }

    try {
      editFetchVideoInfoBtn.disabled = true;
      editFetchVideoInfoBtn.textContent = "가져오는 중...";

      const info = await fetchSoopVideoInfo(originalVideoUrl);

      if (info.embedUrl) {
        videoUrlInput.value = info.embedUrl;
      }

      if (info.thumbnail) {
        selectedEditClipThumbnail = info.thumbnail;
        showEditClipThumbnail(info.thumbnail);
      } else {
        alert("썸네일을 찾지 못했습니다.");
      }
    } catch (error) {
      console.error("SOOP 영상 정보 가져오기 실패:", error);
      alert(error.message);
    } finally {
      editFetchVideoInfoBtn.disabled = false;
      editFetchVideoInfoBtn.textContent = "SOOP 영상 정보 다시 가져오기";
    }
  });
}

if (editClipForm) {
  editClipForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      showMessage(editClipMessage, "로그인 후 수정할 수 있습니다.", "error");
      return;
    }

    const submitButton = editClipForm.querySelector("button[type='submit']");

    const title = document.querySelector("#editClipTitle").value.trim();
    const tag = document.querySelector("#editClipTag").value;
    const thumbnail = selectedEditClipThumbnail;
    const videoType = document.querySelector("#editClipVideoType").value;
    const videoUrl = document.querySelector("#editClipVideoUrl").value.trim();
    const description = document.querySelector("#editClipDescription").value.trim();

    if (!title || !tag || !thumbnail || !videoType || !videoUrl || !description) {
      showMessage(editClipMessage, "모든 항목을 입력해주세요.", "error");
      return;
    }

    // [추가] editedBy: 수정 시점의 SOOP 닉네임을 updateData에 포함
    const soopUser = getSoopUser();
    const updateData = {
      title,
      tag,
      thumbnail,
      videoType,
      videoUrl,
      description,
      editedBy: soopUser ? soopUser.soopNick : "알 수 없음"
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "수정 중...";
      }

      showMessage(editClipMessage, "클립 수정 중입니다...", "success");

      await updateClipToFirestoreRest(editingClipId, updateData);

      showMessage(editClipMessage, "클립이 수정되었습니다! 상세 페이지로 이동합니다.", "success");

      setTimeout(() => {
        location.href = `./clip-detail.html?id=${editingClipId}`;
      }, 1000);
    } catch (error) {
      console.error("클립 수정 실패:", error);
      showMessage(editClipMessage, "클립 수정 실패: " + error.message, "error");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "클립 수정하기";
      }
    }
  });
}


/* ============================= */
/* Firebase 월드컵 만들기 / 목록 */
/* ============================= */

const worldcupCreateForm = document.querySelector("#worldcupCreateForm");
const worldcupCreateMessage = document.querySelector("#worldcupCreateMessage");
const addWorldcupItemBtn = document.querySelector("#addWorldcupItemBtn");
const worldcupItemList = document.querySelector("#worldcupItemList");

let firebaseWorldcups = [];
let currentWorldcupCategory = "전체";

const worldcupList = document.querySelector("#worldcupList");
const worldcupCount = document.querySelector("#worldcupCount");
const worldcupSearchInput = document.querySelector("#worldcupSearchInput");
const worldcupFilterButtons = document.querySelectorAll(".worldcup-filter-btn");

function createWorldcupItemRow() {
  if (!worldcupItemList) return;

  const row = document.createElement("div");
  row.className = "worldcup-item-row";

  row.innerHTML = `
    <input type="text" class="candidate-name" placeholder="후보 이름" required>
    <input type="text" class="candidate-image" placeholder="이미지 주소" required>
    <input type="text" class="candidate-video" placeholder="영상 링크 선택 입력">
    <button type="button" class="remove-candidate-btn">삭제</button>
  `;

  worldcupItemList.appendChild(row);
}

if (addWorldcupItemBtn && worldcupItemList) {
  addWorldcupItemBtn.addEventListener("click", () => {
    createWorldcupItemRow();
  });

  worldcupItemList.addEventListener("click", (event) => {
    if (!event.target.classList.contains("remove-candidate-btn")) return;

    const rows = document.querySelectorAll(".worldcup-item-row");

    if (rows.length <= 4) {
      alert("후보는 최소 4개 이상 필요합니다.");
      return;
    }

    event.target.closest(".worldcup-item-row").remove();
  });
}

function getWorldcupCandidates() {
  const rows = document.querySelectorAll(".worldcup-item-row");
  const candidates = [];

  rows.forEach((row) => {
    const name = row.querySelector(".candidate-name")?.value.trim() || "";
    const image = row.querySelector(".candidate-image")?.value.trim() || "";
    const video = row.querySelector(".candidate-video")?.value.trim() || "";

    if (name && image) {
      candidates.push({
        name,
        image,
        video
      });
    }
  });

  return candidates;
}

async function saveWorldcupToFirestoreRest(worldcupData) {
  const token = await currentUser.getIdToken();

  const candidateValues = worldcupData.candidates.map((candidate) => {
    return {
      mapValue: {
        fields: {
          name: { stringValue: candidate.name },
          image: { stringValue: candidate.image },
          video: { stringValue: candidate.video || "" }
        }
      }
    };
  });

  const response = await fetch(
    "https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/worldcups",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: {
          title: { stringValue: worldcupData.title },
          description: { stringValue: worldcupData.description },
          category: { stringValue: worldcupData.category },
          candidates: {
            arrayValue: {
              values: candidateValues
            }
          },
          playCount: { integerValue: "0" },
          // [변경] uid → soopId: Firestore 문서에 SOOP ID 저장
          soopId: { stringValue: worldcupData.soopId },
          uploaderName: { stringValue: worldcupData.uploaderName },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("REST 월드컵 저장 실패:", result);
    throw new Error(result.error?.message || "Firestore 월드컵 저장 실패");
  }

  return result;
}

if (worldcupCreateForm) {
  worldcupCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      showMessage(worldcupCreateMessage, "로그인 후 월드컵을 만들 수 있습니다.", "error");
      setTimeout(() => { location.href = "./login.html"; }, 800);
      return;
    }

    // [버그 수정] soopId 없이 저장되면 나중에 수정/삭제 불가
    if (!getSoopUser()) {
      showMessage(worldcupCreateMessage, "SOOP 로그인 정보가 없습니다. 다시 로그인해주세요.", "error");
      setTimeout(() => { location.href = "./login.html"; }, 800);
      return;
    }

    const submitButton = worldcupCreateForm.querySelector("button[type='submit']");

    const title = document.querySelector("#worldcupTitle").value.trim();
    const description = document.querySelector("#worldcupDescription").value.trim();
    const category = document.querySelector("#worldcupCategory").value;
    const candidates = getWorldcupCandidates();

    if (!title || !description || !category) {
      showMessage(worldcupCreateMessage, "월드컵 정보를 모두 입력해주세요.", "error");
      return;
    }

    if (candidates.length < 4) {
      showMessage(worldcupCreateMessage, "후보는 최소 4개 이상 등록해야 합니다.", "error");
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "등록 중...";
      }

      showMessage(worldcupCreateMessage, "월드컵 등록 중입니다...", "success");

      // [변경] uploaderName: Firebase displayName → SOOP 닉네임으로 변경
      const soopUser = getSoopUser();
      const worldcupData = {
        title,
        description,
        category,
        candidates,
        // [변경] uid → soopId: Firestore 문서에 SOOP ID 저장
        soopId: soopUser ? soopUser.soopId : "",
        uploaderName: soopUser ? soopUser.soopNick : "알 수 없음"
      };

      const result = await saveWorldcupToFirestoreRest(worldcupData);

      console.log("월드컵 등록 성공:", result.name);

      showMessage(worldcupCreateMessage, "월드컵이 등록되었습니다! 이동합니다.", "success");

      setTimeout(() => {
        location.href = "./worldcups.html";
      }, 1000);
    } catch (error) {
      console.error("월드컵 등록 실패:", error);

      showMessage(worldcupCreateMessage, "월드컵 등록 실패: " + error.message, "error");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "월드컵 등록하기";
      }
    }
  });
}

async function loadFirebaseWorldcups() {
  if (!worldcupList) return;

  try {
    const worldcupQuery = query(
      collection(db, "worldcups"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(worldcupQuery);

    firebaseWorldcups = snapshot.docs.map((docItem) => {
      const data = docItem.data();

      return {
        id: docItem.id,
        title: data.title || "제목 없음",
        description: data.description || "설명이 없습니다.",
        category: data.category || "기타",
        candidates: Array.isArray(data.candidates) ? data.candidates : [],
        playCount: data.playCount || 0,
        soopId: data.soopId || "",
        uid: data.uid || "",
        uploaderName: data.uploaderName || "알 수 없음"
      };
    });

    renderWorldcups();
  } catch (error) {
    console.error("월드컵 불러오기 실패:", error);

    worldcupList.innerHTML = `
      <div class="empty-message">
        월드컵을 불러오지 못했습니다.
      </div>
    `;
  }
}

function renderWorldcups() {
  if (!worldcupList) return;

  const keyword = worldcupSearchInput ? worldcupSearchInput.value.toLowerCase() : "";

  const result = firebaseWorldcups.filter((worldcup) => {
    const matchKeyword =
      worldcup.title.toLowerCase().includes(keyword) ||
      worldcup.description.toLowerCase().includes(keyword) ||
      worldcup.category.toLowerCase().includes(keyword);

    const matchCategory =
      currentWorldcupCategory === "전체" ||
      worldcup.category === currentWorldcupCategory;

    return matchKeyword && matchCategory;
  });

  if (worldcupCount) {
    worldcupCount.textContent = `${result.length}개`;
  }

  if (result.length === 0) {
    worldcupList.innerHTML = `
      <div class="empty-message">
        등록된 월드컵이 없습니다.
      </div>
    `;
    return;
  }

  worldcupList.innerHTML = result.map((worldcup) => {
    const candidateCount = worldcup.candidates.length;

    return `
      <article class="worldcup-card">
        <span class="tag">#${worldcup.category}</span>
        <h3>${worldcup.title}</h3>
        <p>${worldcup.description}</p>
        <p>후보 ${candidateCount}개 · 플레이 ${Number(worldcup.playCount).toLocaleString()}회</p>
        <button onclick="location.href='./worldcup-play.html?id=${worldcup.id}'">
          시작하기
        </button>
      </article>
    `;
  }).join("");
}

if (worldcupSearchInput) {
  worldcupSearchInput.addEventListener("input", renderWorldcups);
}

worldcupFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    worldcupFilterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    currentWorldcupCategory = button.dataset.category;
    renderWorldcups();
  });
});

/* ============================= */
/* 월드컵 플레이 */
/* ============================= */

const playWorldcupTitle = document.querySelector("#playWorldcupTitle");
const playWorldcupDesc = document.querySelector("#playWorldcupDesc");
const worldcupPlayArea = document.querySelector("#worldcupPlayArea");
const worldcupWinnerArea = document.querySelector("#worldcupWinnerArea");
const roundLabel = document.querySelector("#roundLabel");
const matchLabel = document.querySelector("#matchLabel");

let playWorldcupData = null;
let currentRoundCandidates = [];
let nextRoundCandidates = [];
let currentMatchIndex = 0;

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getRoundName(count) {
  if (count === 2) return "결승";
  if (count === 4) return "4강";
  if (count === 8) return "8강";
  if (count === 16) return "16강";
  if (count === 32) return "32강";
  if (count === 64) return "64강";

  return `${count}강`;
}

async function fetchWorldcupById(worldcupId) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/worldcups/${worldcupId}`
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("월드컵 단일 불러오기 실패:", result);
    throw new Error(result.error?.message || "월드컵 데이터를 불러오지 못했습니다.");
  }

  const fields = result.fields;

  const candidates = fields.candidates?.arrayValue?.values
    ? fields.candidates.arrayValue.values.map((item) => {
        const candidateFields = item.mapValue.fields;

        return {
          name: candidateFields.name?.stringValue || "후보 이름 없음",
          image: candidateFields.image?.stringValue || "",
          video: candidateFields.video?.stringValue || ""
        };
      })
    : [];

  return {
    id: worldcupId,
    title: fields.title?.stringValue || "제목 없음",
    description: fields.description?.stringValue || "설명이 없습니다.",
    category: fields.category?.stringValue || "기타",
    candidates
  };
}

function startWorldcupGame(worldcup) {
  playWorldcupData = worldcup;

  if (playWorldcupTitle) {
    playWorldcupTitle.textContent = worldcup.title;
  }

  if (playWorldcupDesc) {
    playWorldcupDesc.textContent = worldcup.description;
  }

  currentRoundCandidates = shuffleArray(worldcup.candidates);
  nextRoundCandidates = [];
  currentMatchIndex = 0;

  renderWorldcupMatch();
}

function renderWorldcupMatch() {
  if (!worldcupPlayArea) return;

  if (currentRoundCandidates.length === 1) {
    renderWorldcupWinner(currentRoundCandidates[0]);
    return;
  }

  if (currentMatchIndex >= currentRoundCandidates.length) {
    currentRoundCandidates = [...nextRoundCandidates];
    nextRoundCandidates = [];
    currentMatchIndex = 0;

    renderWorldcupMatch();
    return;
  }

  const left = currentRoundCandidates[currentMatchIndex];
  const right = currentRoundCandidates[currentMatchIndex + 1];

  if (!left || !right) {
    if (left) {
      nextRoundCandidates.push(left);
    }

    currentMatchIndex += 2;
    renderWorldcupMatch();
    return;
  }

  const roundName = getRoundName(currentRoundCandidates.length);
  const currentMatchNumber = Math.floor(currentMatchIndex / 2) + 1;
  const totalMatchNumber = Math.floor(currentRoundCandidates.length / 2);

  if (roundLabel) {
    roundLabel.textContent = roundName;
  }

  if (matchLabel) {
    matchLabel.textContent = `${currentMatchNumber} / ${totalMatchNumber}`;
  }

  worldcupPlayArea.innerHTML = `
    <article class="worldcup-choice-card" data-side="left">
      <div class="worldcup-choice-image">
        <img src="${left.image}" alt="${left.name}">
      </div>

      <div class="worldcup-choice-info">
        <div>
          <span class="tag">선택</span>
          <h2>${left.name}</h2>
          <p>이 후보를 다음 라운드로 올리려면 카드를 클릭하세요.</p>
        </div>

        ${
          left.video
            ? `<a class="worldcup-video-link" href="${left.video}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">영상 보기</a>`
            : ""
        }
      </div>
    </article>

    <div class="worldcup-vs">VS</div>

    <article class="worldcup-choice-card" data-side="right">
      <div class="worldcup-choice-image">
        <img src="${right.image}" alt="${right.name}">
      </div>

      <div class="worldcup-choice-info">
        <div>
          <span class="tag">선택</span>
          <h2>${right.name}</h2>
          <p>이 후보를 다음 라운드로 올리려면 카드를 클릭하세요.</p>
        </div>

        ${
          right.video
            ? `<a class="worldcup-video-link" href="${right.video}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">영상 보기</a>`
            : ""
        }
      </div>
    </article>
  `;

  const cards = document.querySelectorAll(".worldcup-choice-card");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const side = card.dataset.side;
      const winner = side === "left" ? left : right;

      selectWorldcupWinner(winner);
    });
  });
}

function selectWorldcupWinner(winner) {
  nextRoundCandidates.push(winner);
  currentMatchIndex += 2;
  renderWorldcupMatch();
}

function renderWorldcupWinner(winner) {
  if (!worldcupPlayArea || !worldcupWinnerArea) return;

  worldcupPlayArea.classList.add("hidden");
  worldcupWinnerArea.classList.remove("hidden");

  if (roundLabel) {
    roundLabel.textContent = "우승";
  }

  if (matchLabel) {
    matchLabel.textContent = "최종 결과";
  }

  worldcupWinnerArea.innerHTML = `
    <div class="worldcup-winner-card">
      <span class="winner-badge">WINNER</span>
      <h2>${winner.name}</h2>

      <img src="${winner.image}" alt="${winner.name}">

      <div class="winner-actions">
        ${
          winner.video
            ? `<a href="${winner.video}" target="_blank" rel="noopener noreferrer">우승 영상 보기</a>`
            : ""
        }

        <button type="button" onclick="location.reload()">
          다시 하기
        </button>

        <button type="button" onclick="location.href='./worldcups.html'">
          목록으로
        </button>
      </div>
    </div>
  `;
}

async function initWorldcupPlayPage() {
  if (!worldcupPlayArea) return;

  const params = new URLSearchParams(location.search);
  const worldcupId = params.get("id");

  if (!worldcupId) {
    worldcupPlayArea.innerHTML = `
      <div class="empty-message">
        월드컵 ID가 없습니다.
      </div>
    `;
    return;
  }

  try {
    const worldcup = await fetchWorldcupById(worldcupId);

    if (worldcup.candidates.length < 2) {
      worldcupPlayArea.innerHTML = `
        <div class="empty-message">
          후보가 부족해서 월드컵을 시작할 수 없습니다.
        </div>
      `;
      return;
    }

    startWorldcupGame(worldcup);
  } catch (error) {
    console.error(error);

    worldcupPlayArea.innerHTML = `
      <div class="empty-message">
        월드컵을 불러오지 못했습니다.
      </div>
    `;
  }
}

/* ============================= */
/* 관리자 페이지 기능 */
/* ============================= */

const ADMIN_UIDS = [
  "Y5hTrp5RxBOXlZe2VSpCOfdwK1t2"
];

const adminAccessBox = document.querySelector("#adminAccessBox");
const adminDashboard = document.querySelector("#adminDashboard");

const adminClipCount = document.querySelector("#adminClipCount");
const adminPeopleCount = document.querySelector("#adminPeopleCount");
const adminWorldcupCount = document.querySelector("#adminWorldcupCount");

const adminClipTableBody = document.querySelector("#adminClipTableBody");
const adminPeopleTableBody = document.querySelector("#adminPeopleTableBody");
const adminWorldcupTableBody = document.querySelector("#adminWorldcupTableBody");

const adminRefreshClipsBtn = document.querySelector("#adminRefreshClipsBtn");
const adminRefreshPeopleBtn = document.querySelector("#adminRefreshPeopleBtn");
const adminRefreshWorldcupsBtn = document.querySelector("#adminRefreshWorldcupsBtn");

function isAdminUser(user) {
  if (!user) return false;
  return ADMIN_UIDS.includes(user.uid);
}

function showAdminAccessMessage(title, message) {
  if (!adminAccessBox) return;

  adminAccessBox.innerHTML = `
    <h2>${title}</h2>
    <p>${message}</p>
  `;
}

function openAdminDashboard() {
  if (adminAccessBox) {
    adminAccessBox.classList.add("hidden");
  }

  if (adminDashboard) {
    adminDashboard.classList.remove("hidden");
  }

  loadAdminClips();
  loadAdminPeople();
  loadAdminWorldcups();
}

async function adminFetchDocuments(collectionName) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/${collectionName}`
  );

  const result = await response.json();

  if (!response.ok) {
    console.error(`${collectionName} 관리자 불러오기 실패:`, result);
    throw new Error(result.error?.message || `${collectionName} 데이터를 불러오지 못했습니다.`);
  }

  return result.documents || [];
}

function getDocumentIdFromName(name) {
  if (!name) return "";
  return name.split("/").pop();
}

function getStringField(fields, key, fallback = "") {
  return fields?.[key]?.stringValue || fallback;
}

function getIntegerField(fields, key, fallback = 0) {
  return Number(fields?.[key]?.integerValue || fallback);
}

function getArrayLengthField(fields, key) {
  const values = fields?.[key]?.arrayValue?.values;
  return Array.isArray(values) ? values.length : 0;
}

async function loadAdminClips() {
  if (!adminClipTableBody) return;

  adminClipTableBody.innerHTML = `
    <tr>
      <td colspan="6">클립 데이터를 불러오는 중입니다.</td>
    </tr>
  `;

  try {
    const docs = await adminFetchDocuments("clips");

    if (adminClipCount) {
      adminClipCount.textContent = docs.length;
    }

    if (docs.length === 0) {
      adminClipTableBody.innerHTML = `
        <tr>
          <td colspan="6">등록된 클립이 없습니다.</td>
        </tr>
      `;
      return;
    }

    adminClipTableBody.innerHTML = docs.map((docItem) => {
      const id = getDocumentIdFromName(docItem.name);
      const fields = docItem.fields || {};

      const title = getStringField(fields, "title", "제목 없음");
      const tag = getStringField(fields, "tag", "기타");
      const views = getIntegerField(fields, "views", 0);
      const likes = getIntegerField(fields, "likes", 0);
      const uploaderName = getStringField(fields, "uploaderName", "알 수 없음");

      return `
        <tr>
          <td>${title}</td>
          <td>${tag}</td>
          <td>${views.toLocaleString()}</td>
          <td>${likes.toLocaleString()}</td>
          <td>${uploaderName}</td>
          <td>
            <button 
              type="button" 
              class="admin-view-btn"
              onclick="location.href='./clip-detail.html?id=${id}'"
            >
              보기
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    console.error(error);

    if (adminClipCount) {
      adminClipCount.textContent = "0";
    }

    adminClipTableBody.innerHTML = `
      <tr>
        <td colspan="6">클립 데이터를 불러오지 못했습니다.</td>
      </tr>
    `;
  }
}

async function loadAdminPeople() {
  if (!adminPeopleTableBody) return;

  adminPeopleTableBody.innerHTML = `
    <tr>
      <td colspan="6">프로필 데이터를 불러오는 중입니다.</td>
    </tr>
  `;

  try {
    const docs = await adminFetchDocuments("people");

    if (adminPeopleCount) {
      adminPeopleCount.textContent = docs.length;
    }

    if (docs.length === 0) {
      adminPeopleTableBody.innerHTML = `
        <tr>
          <td colspan="6">등록된 프로필이 없습니다.</td>
        </tr>
      `;
      return;
    }

    adminPeopleTableBody.innerHTML = docs.map((docItem) => {
      const fields = docItem.fields || {};

      const name = getStringField(fields, "name", "이름 없음");
      const type = getStringField(fields, "type", "시민");
      const team = getStringField(fields, "team", "소속 없음");
      const role = getStringField(fields, "role", "역할 없음");
      const gangName = getStringField(fields, "gangName", "-");

      return `
        <tr>
          <td>${name}</td>
          <td>${type}</td>
          <td>${team}</td>
          <td>${role}</td>
          <td>${gangName || "-"}</td>
          <td>
            <button 
              type="button" 
              class="admin-view-btn"
              onclick="location.href='./people.html'"
            >
              보기
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    console.error(error);

    if (adminPeopleCount) {
      adminPeopleCount.textContent = "0";
    }

    adminPeopleTableBody.innerHTML = `
      <tr>
        <td colspan="6">프로필 데이터를 불러오지 못했습니다.</td>
      </tr>
    `;
  }
}

async function loadAdminWorldcups() {
  if (!adminWorldcupTableBody) return;

  adminWorldcupTableBody.innerHTML = `
    <tr>
      <td colspan="6">월드컵 데이터를 불러오는 중입니다.</td>
    </tr>
  `;

  try {
    const docs = await adminFetchDocuments("worldcups");

    if (adminWorldcupCount) {
      adminWorldcupCount.textContent = docs.length;
    }

    if (docs.length === 0) {
      adminWorldcupTableBody.innerHTML = `
        <tr>
          <td colspan="6">등록된 월드컵이 없습니다.</td>
        </tr>
      `;
      return;
    }

    adminWorldcupTableBody.innerHTML = docs.map((docItem) => {
      const id = getDocumentIdFromName(docItem.name);
      const fields = docItem.fields || {};

      const title = getStringField(fields, "title", "제목 없음");
      const category = getStringField(fields, "category", "기타");
      const candidateCount = getArrayLengthField(fields, "candidates");
      const playCount = getIntegerField(fields, "playCount", 0);
      const uploaderName = getStringField(fields, "uploaderName", "알 수 없음");

      return `
        <tr>
          <td>${title}</td>
          <td>${category}</td>
          <td>${candidateCount}</td>
          <td>${playCount.toLocaleString()}</td>
          <td>${uploaderName}</td>
          <td>
            <button 
              type="button" 
              class="admin-view-btn"
              onclick="location.href='./worldcup-play.html?id=${id}'"
            >
              보기
            </button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    console.error(error);

    if (adminWorldcupCount) {
      adminWorldcupCount.textContent = "0";
    }

    adminWorldcupTableBody.innerHTML = `
      <tr>
        <td colspan="6">월드컵 데이터를 불러오지 못했습니다.</td>
      </tr>
    `;
  }
}

function initAdminPage() {
  if (!adminAccessBox || !location.pathname.includes("admin.html")) return;

  if (!currentUser) {
    showAdminAccessMessage(
      "로그인이 필요합니다.",
      "관리자 페이지는 로그인 후 이용할 수 있습니다."
    );

    setTimeout(() => {
      location.href = "./login.html";
    }, 1000);

    return;
  }

  if (!isAdminUser(currentUser)) {
    showAdminAccessMessage(
      "관리자 권한이 없습니다.",
      `현재 로그인한 UID: ${currentUser.uid}<br><br>이 UID를 main.js의 ADMIN_UIDS 배열에 추가해야 관리자 페이지를 사용할 수 있습니다.`
    );

    return;
  }

  openAdminDashboard();
}

if (adminRefreshClipsBtn) {
  adminRefreshClipsBtn.addEventListener("click", loadAdminClips);
}

if (adminRefreshPeopleBtn) {
  adminRefreshPeopleBtn.addEventListener("click", loadAdminPeople);
}

if (adminRefreshWorldcupsBtn) {
  adminRefreshWorldcupsBtn.addEventListener("click", loadAdminWorldcups);
}

/* ============================= */
/* 초기 실행 */
/* ============================= */

renderClips();
renderClipDetail();
renderPeople();

loadFirebaseClips();
loadFirebasePeople();
loadFirebaseWorldcups();

initWorldcupPlayPage();