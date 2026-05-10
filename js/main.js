import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "./firebase.js";

console.log("고래시티 아카이브 시작");

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
/* 기본 클립 데이터 */
/* ============================= */

const defaultClips = [
  {
    id: "1",
    title: "고래시티 레전드 장면",
    tag: "레전드",
    views: 1204,
    likes: 340,
    date: "2026.05.08",
    thumbnail: "./images/clip1.jpg",
    videoType: "soop",
    videoUrl: "https://vod.sooplive.com/player/193625775/embed?type=catch&showChat=false&mutePlay=false",
    description: "고래시티에서 나온 대표적인 레전드 장면입니다."
  },
  {
    id: "2",
    title: "모두가 터진 웃긴 순간",
    tag: "웃긴장면",
    views: 982,
    likes: 221,
    date: "2026.05.07",
    thumbnail: "./images/clip2.jpg",
    videoType: "youtube",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    description: "방송 중 예상치 못한 상황으로 모두가 웃음을 터뜨린 장면입니다."
  },
  {
    id: "3",
    title: "고래시티 최고의 명장면",
    tag: "명장면",
    views: 1842,
    likes: 512,
    date: "2026.05.06",
    thumbnail: "./images/clip3.jpg",
    videoType: "local",
    videoUrl: "./videos/sample1.mp4",
    description: "고래시티의 분위기와 캐릭터들의 매력이 잘 드러난 명장면입니다."
  },
  {
    id: "4",
    title: "갑자기 벌어진 대형 사건",
    tag: "사건",
    views: 2200,
    likes: 610,
    date: "2026.05.05",
    thumbnail: "./images/clip4.jpg",
    videoType: "soop",
    videoUrl: "https://vod.sooplive.co.kr/player/139399233/embed?type=catch&showChat=false&mutePlay=false",
    description: "고래시티 내에서 갑자기 벌어진 큰 사건을 기록한 클립입니다."
  },
  {
    id: "5",
    title: "생각보다 감동적인 장면",
    tag: "감동",
    views: 774,
    likes: 188,
    date: "2026.05.04",
    thumbnail: "./images/clip5.jpg",
    videoType: "local",
    videoUrl: "./videos/sample1.mp4",
    description: "처음에는 평범한 장면처럼 보였지만, 뒤로 갈수록 감동을 주었던 클립입니다."
  },
  {
    id: "6",
    title: "다시 봐도 웃긴 고래시티 일상",
    tag: "웃긴장면",
    views: 1550,
    likes: 430,
    date: "2026.05.03",
    thumbnail: "./images/clip6.jpg",
    videoType: "local",
    videoUrl: "./videos/sample1.mp4",
    description: "고래시티 일상 속에서 나온 자연스러운 웃음 포인트를 담은 클립입니다."
  }
];

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

function saveDeletedClipId(clipId) {
  const deletedIds = getDeletedClipIds();

  if (!deletedIds.includes(String(clipId))) {
    deletedIds.push(String(clipId));
  }

  localStorage.setItem("deletedClipIds", JSON.stringify(deletedIds));
}

function getAllClips() {
  const deletedIds = getDeletedClipIds();

  return [...firebaseClips, ...defaultClips].filter((clip) => {
    return !deletedIds.includes(String(clip.id));
  });
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

function listenFirebaseClips() {
  const needsClips =
    document.querySelector("#clipList") ||
    document.querySelector("#clipDetail");

  if (!needsClips) return;

  const clipsQuery = query(
    collection(db, "clips"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    clipsQuery,
    (snapshot) => {
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
          uid: data.uid || "",
          uploaderName: data.uploaderName || "알 수 없음"
        };
      });

      renderClips();
      renderClipDetail();
    },
    (error) => {
      console.error("Firestore 클립 불러오기 실패:", error);
    }
  );
}

/* ============================= */
/* 기본 인물 데이터 */
/* ============================= */

const people = [
  {
    id: 1,
    name: "울산큰고래",
    followers: "67,502",
    profileImage: "https://stimg.sooplive.com/LOGO/ba/bach023/m/bach023.webp",
    description: "SOOP",
    team: "123",
    role: "12",
    type: "시민",
    gangName: "",
    link: "https://www.sooplive.com/station/bach023"
  },
  {
    id: 2,
    name: "조디악",
    followers: "54,327",
    profileImage: "https://stimg.sooplive.com/LOGO/yj/yjkim5500/yjkim5500.jpg",
    description: "고래시티의 경찰서장입니다.",
    team: "경찰서장",
    role: "경찰",
    type: "경찰",
    gangName: "",
    link: "https://www.sooplive.com/station/yjkim5500"
  },
  {
    id: 3,
    name: "단츄",
    followers: "48,627",
    profileImage: "https://stimg.sooplive.com/LOGO/da/danchu17/danchu17.jpg",
    description: "고래시티의 EMS 병원장입니다.",
    team: "EMS병원장",
    role: "EMS",
    type: "EMS",
    gangName: "",
    link: "https://www.sooplive.com/station/danchu17"
  },
  {
    id: 4,
    name: "멜로딩딩",
    followers: "8,560",
    profileImage: "https://stimg.sooplive.com/LOGO/me/melodingding/melodingding.jpg",
    description: "고래시티의 운영자입니다.",
    team: "운영팀",
    role: "운영자",
    type: "운영자",
    gangName: "",
    link: "https://www.sooplive.com/station/melodingding"
  }
];

/* ============================= */
/* Firebase 인물 데이터 */
/* ============================= */

let firebasePeople = [];

function getAllPeople() {
  return [...firebasePeople, ...people];
}

function listenFirebasePeople() {
  const needsPeople = document.querySelector("#peopleList");

  if (!needsPeople) return;

  const peopleQuery = query(
    collection(db, "people"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    peopleQuery,
    (snapshot) => {
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
          uid: data.uid || "",
          uploaderName: data.uploaderName || "알 수 없음"
        };
      });

      renderPeople();
    },
    (error) => {
      console.error("Firestore 인물 불러오기 실패:", error);
    }
  );
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

  const isOwner =
    currentUser &&
    clip.uid &&
    String(currentUser.uid) === String(clip.uid);

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
        openClipEditPrompt(clip);
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
  if (!clip || !clip.uid) return;

  const viewedIds = getViewedClipIds();

  if (viewedIds.includes(String(clip.id))) {
    return;
  }

  try {
    const nextViews = Number(clip.views || 0) + 1;

    const response = await fetch(
      getClipDocumentUrl(clip.id) + "?updateMask.fieldPaths=views",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
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

  if (!clip || !clip.uid) {
    alert("기본 샘플 클립은 좋아요 저장을 지원하지 않습니다.");
    return;
  }

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
    "&updateMask.fieldPaths=updatedAt";

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
        updatedAt: { timestampValue: new Date().toISOString() }
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

  if (!clip.uid || currentUser.uid !== clip.uid) {
    alert("본인이 올린 클립만 수정할 수 있습니다.");
    return;
  }

  const title = prompt("클립 제목을 수정하세요.", clip.title);
  if (title === null) return;

  const tag = prompt("태그를 수정하세요. 예: 레전드, 웃긴장면, 명장면, 사건, 감동", clip.tag);
  if (tag === null) return;

  const thumbnail = prompt("썸네일 이미지 주소를 수정하세요.", clip.thumbnail);
  if (thumbnail === null) return;

  const videoType = prompt("영상 타입을 수정하세요. 예: soop, youtube, local", clip.videoType);
  if (videoType === null) return;

  const videoUrl = prompt("영상 URL을 수정하세요.", clip.videoUrl);
  if (videoUrl === null) return;

  const description = prompt("클립 설명을 수정하세요.", clip.description);
  if (description === null) return;

  const updateData = {
    title: title.trim(),
    tag: tag.trim(),
    thumbnail: thumbnail.trim(),
    videoType: videoType.trim(),
    videoUrl: videoUrl.trim(),
    description: description.trim()
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

  if (!targetClip.uid || currentUser.uid !== targetClip.uid) {
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
          currentUser &&
          person.uid &&
          String(currentUser.uid) === String(person.uid)
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
        openPersonEditPrompt(person);
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
    "&updateMask.fieldPaths=updatedAt";

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
        updatedAt: { timestampValue: new Date().toISOString() }
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

  if (!person.uid || currentUser.uid !== person.uid) {
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

  const updateData = {
    name: name.trim(),
    followers: followers.trim(),
    profileImage: profileImage.trim(),
    description: description.trim(),
    team: team.trim(),
    role: role.trim(),
    type: type.trim(),
    gangName: gangName.trim(),
    link: link.trim()
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

  if (!person.uid || currentUser.uid !== person.uid) {
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

const loginTab = document.querySelector("#loginTab");
const signupTab = document.querySelector("#signupTab");

const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");

const loginMessage = document.querySelector("#loginMessage");
const signupMessage = document.querySelector("#signupMessage");

function showMessage(target, text, type) {
  if (!target) return;

  target.className = "auth-message";
  target.textContent = text;

  if (type) {
    target.classList.add(type);
  }
}

function logoutUser() {
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
    const nickname = user.displayName || user.email.split("@")[0];

    headerLoginBtn.textContent = `${nickname}님`;
    headerLoginBtn.title = "메뉴 열기";

    const dropdown = document.createElement("div");
    dropdown.className = "login-dropdown";

    dropdown.innerHTML = `
      <button type="button" id="uploadClipBtn">클립 올리기</button>
      <button type="button" id="uploadPersonBtn">프로필 올리기</button>
      <button type="button" class="logout-option" id="logoutBtn">로그아웃</button>
    `;

    loginArea.appendChild(dropdown);

    headerLoginBtn.onclick = (event) => {
      event.stopPropagation();
      dropdown.classList.toggle("show");
    };

    const uploadClipBtn = document.querySelector("#uploadClipBtn");
    const uploadPersonBtn = document.querySelector("#uploadPersonBtn");
    const logoutBtn = document.querySelector("#logoutBtn");

    if (uploadClipBtn) {
      uploadClipBtn.addEventListener("click", () => {
        location.href = "./upload.html";
      });
    }

    if (uploadPersonBtn) {
      uploadPersonBtn.addEventListener("click", () => {
        location.href = "./people-upload.html";
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        const confirmLogout = confirm("로그아웃할까요?");

        if (confirmLogout) {
          logoutUser();
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

/* 로그인 / 회원가입 탭 전환 */
if (loginTab && signupTab && loginForm && signupForm) {
  loginTab.addEventListener("click", () => {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");

    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  });

  signupTab.addEventListener("click", () => {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");

    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  });
}

/* 회원가입 */
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nickname = document.querySelector("#signupNickname").value.trim();
    const email = document.querySelector("#signupEmail").value.trim();
    const password = document.querySelector("#signupPassword").value;
    const passwordCheck = document.querySelector("#signupPasswordCheck").value;

    if (nickname.length < 2) {
      showMessage(signupMessage, "닉네임은 2자 이상 입력해주세요.", "error");
      return;
    }

    if (password.length < 6) {
      showMessage(signupMessage, "비밀번호는 6자 이상 입력해주세요.", "error");
      return;
    }

    if (password !== passwordCheck) {
      showMessage(signupMessage, "비밀번호가 서로 다릅니다.", "error");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(userCredential.user, {
        displayName: nickname
      });

      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        nickname,
        email,
        createdAt: serverTimestamp()
      });

      showMessage(signupMessage, "회원가입이 완료되었습니다.", "success");

      setTimeout(() => {
        location.href = "./index.html";
      }, 800);
    } catch (error) {
      console.error(error);

      let message = "회원가입 중 오류가 발생했습니다.";

      if (error.code === "auth/email-already-in-use") {
        message = "이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.";
      }

      if (error.code === "auth/invalid-email") {
        message = "이메일 형식이 올바르지 않습니다.";
      }

      if (error.code === "auth/weak-password") {
        message = "비밀번호는 6자 이상 입력해주세요.";
      }

      if (error.code === "auth/network-request-failed") {
        message = "네트워크 연결을 확인해주세요.";
      }

      showMessage(signupMessage, message, "error");
    }
  });
}

/* 로그인 */
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.querySelector("#loginEmail").value.trim();
    const password = document.querySelector("#loginPassword").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);

      showMessage(loginMessage, "로그인 성공! 메인 페이지로 이동합니다.", "success");

      setTimeout(() => {
        location.href = "./index.html";
      }, 800);
    } catch (error) {
      console.error(error);

      let message = "로그인에 실패했습니다.";

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        message = "이메일 또는 비밀번호가 올바르지 않습니다.";
      }

      if (error.code === "auth/invalid-email") {
        message = "이메일 형식이 올바르지 않습니다.";
      }

      if (error.code === "auth/network-request-failed") {
        message = "네트워크 연결을 확인해주세요.";
      }

      showMessage(loginMessage, message, "error");
    }
  });
}

/* ============================= */
/* Firebase 클립 올리기 */
/* ============================= */

const uploadClipForm = document.querySelector("#uploadClipForm");
const uploadMessage = document.querySelector("#uploadMessage");
const uploadThumbnail = document.querySelector("#uploadThumbnail");
const thumbnailPreview = document.querySelector("#thumbnailPreview");
const previewPlaceholder = document.querySelector("#previewPlaceholder");

if (uploadThumbnail && thumbnailPreview && previewPlaceholder) {
  uploadThumbnail.addEventListener("input", () => {
    const imageUrl = uploadThumbnail.value.trim();

    if (!imageUrl) {
      thumbnailPreview.style.display = "none";
      previewPlaceholder.style.display = "block";
      thumbnailPreview.src = "";
      return;
    }

    thumbnailPreview.src = imageUrl;
    thumbnailPreview.style.display = "block";
    previewPlaceholder.style.display = "none";
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
  const token = await currentUser.getIdToken();

  const response = await fetch(
    "https://firestore.googleapis.com/v1/projects/whale-city-archive/databases/default/documents/clips",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
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
          uid: { stringValue: clipData.uid },
          uploaderName: { stringValue: clipData.uploaderName },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("REST 클립 저장 실패:", result);
    throw new Error(result.error?.message || "Firestore 클립 저장 실패");
  }

  return result;
}

if (uploadClipForm) {
  uploadClipForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = uploadClipForm.querySelector("button[type='submit']");

    if (!currentUser) {
      showMessage(uploadMessage, "로그인 후 클립을 올릴 수 있습니다.", "error");

      setTimeout(() => {
        location.href = "./login.html";
      }, 800);

      return;
    }

    const title = document.querySelector("#uploadTitle").value.trim();
    const tag = document.querySelector("#uploadTag").value;
    const thumbnail = document.querySelector("#uploadThumbnail").value.trim();
    const videoType = document.querySelector("#uploadVideoType").value;
    const videoUrl = document.querySelector("#uploadVideoUrl").value.trim();
    const description = document.querySelector("#uploadDescription").value.trim();

    if (!title || !tag || !thumbnail || !videoType || !videoUrl || !description) {
      showMessage(uploadMessage, "모든 항목을 입력해주세요.", "error");
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "등록 중...";
      }

      showMessage(uploadMessage, "클립 등록 중입니다...", "success");

      const clipData = {
        title,
        tag,
        thumbnail,
        videoType,
        videoUrl,
        description,
        views: 0,
        likes: 0,
        uid: currentUser.uid,
        uploaderName: currentUser.displayName || currentUser.email
      };

      const result = await saveClipToFirestoreRest(clipData);

      console.log("클립 등록 성공:", result.name);

      showMessage(uploadMessage, "클립이 등록되었습니다! 이동합니다.", "success");

      setTimeout(() => {
        location.href = "./clips.html";
      }, 1000);
    } catch (error) {
      console.error("클립 등록 실패:", error);

      const message = getFirestoreErrorMessage(error);
      showMessage(uploadMessage, "클립 등록 실패: " + message, "error");

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

const personProfileImage = document.querySelector("#personProfileImage");
const personProfilePreview = document.querySelector("#personProfilePreview");
const personPreviewPlaceholder = document.querySelector("#personPreviewPlaceholder");

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

if (personProfileImage && personProfilePreview && personPreviewPlaceholder) {
  personProfileImage.addEventListener("input", () => {
    const imageUrl = personProfileImage.value.trim();

    if (!imageUrl) {
      personProfilePreview.style.display = "none";
      personPreviewPlaceholder.style.display = "block";
      personProfilePreview.src = "";
      return;
    }

    personProfilePreview.src = imageUrl;
    personProfilePreview.style.display = "block";
    personPreviewPlaceholder.style.display = "none";
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
          uid: { stringValue: personData.uid },
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

      setTimeout(() => {
        location.href = "./login.html";
      }, 800);

      return;
    }

    const name = document.querySelector("#personName").value.trim();
    const followers = document.querySelector("#personFollowers").value.trim();
    const profileImage = document.querySelector("#personProfileImage").value.trim();
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
        uid: currentUser.uid,
        uploaderName: currentUser.displayName || currentUser.email
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
          uid: { stringValue: worldcupData.uid },
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

      setTimeout(() => {
        location.href = "./login.html";
      }, 800);

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

      const worldcupData = {
        title,
        description,
        category,
        candidates,
        uid: currentUser.uid,
        uploaderName: currentUser.displayName || currentUser.email
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

function listenFirebaseWorldcups() {
  if (!worldcupList) return;

  const worldcupQuery = query(
    collection(db, "worldcups"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    worldcupQuery,
    (snapshot) => {
      firebaseWorldcups = snapshot.docs.map((docItem) => {
        const data = docItem.data();

        return {
          id: docItem.id,
          title: data.title || "제목 없음",
          description: data.description || "설명이 없습니다.",
          category: data.category || "기타",
          candidates: Array.isArray(data.candidates) ? data.candidates : [],
          playCount: data.playCount || 0,
          uid: data.uid || "",
          uploaderName: data.uploaderName || "알 수 없음"
        };
      });

      renderWorldcups();
    },
    (error) => {
      console.error("월드컵 불러오기 실패:", error);

      worldcupList.innerHTML = `
        <div class="empty-message">
          월드컵을 불러오지 못했습니다.
        </div>
      `;
    }
  );
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
/* 초기 실행 */
/* ============================= */

renderClips();
renderClipDetail();
renderPeople();

listenFirebaseClips();
listenFirebasePeople();
listenFirebaseWorldcups();

initWorldcupPlayPage();