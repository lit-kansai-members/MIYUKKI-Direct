const $window = $(window);

const $inputShortenURL = $("#inputShortenURL");
const $errorResult = $("#error-result");
const $inputKeepPeriod = $("#inputKeepPeriod");

const $showRoomId = $("#roomId");
const $showKeepPeriod = $("#showKeepPeriod");
const $getShortenURL  = $("#getShortenURL");

const $videoTitle = $("#videoTitle");
const $videoDescription = $("#videoDescription");
const $thumb = $("#thumb");
const $submitForm = $("#submit");

const $inputSearchQuery = $("#inputSearchQuery");

const $searchResult = $("#search-result")
const $searchResultTemplete = $("#searchResultTemplete")[0];

const error = e =>{
  console.error("something Error occured!", e)
  location.hash = "error"
  $errorResult.text(e);
}


const getRoomId = key =>{
  const url = `http://lit.sh/${key}`
  return fetch(url, {redirect: "manual", mode: "no-cors"})
    .then(responise =>{
      if(responise.type === "opaqueredirect"){
        Promise.resolve();
      } else {
        Promise.reject(new Error(`Requested URL ${url} is not redirectable.`));
      }
    })
    .then(() => new Promise((resolve, reject) =>
      chrome.tabs.create({active: false, url}, tab => resolve(tab))
    ))
    .then( tab => new Promise((resolve, reject) => { 
        chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
          if (tab.id === tabId && changeInfo.url != null
              && changeInfo.url !== url){
            resolve({url: changeInfo.url, tabId});
          }
        })
      })
    )
    .then(({url, tabId}) =>{
      chrome.tabs.remove(tabId);
      const match = url.match(/dj\.life-is-tech\.com\/submit\.html[&?]r=([^&]+)/);
      if(match){
        return match[1]
      } else {
        throw new Error("不正なURLです。")
      }
    })
}

const checkVideoDuration = id =>
  Promise.resolve()
    .then(() => new Promise(res => chrome.identity.getAuthToken({interactive:true}, res)))
    .then(token => fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${id}&access_token=${token}`))
    .then(res => {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return res.json();
      } else {
        throw new Error("不正な動画IDです。");
      }
    })
    .then(({items: [video]}) => {
      const match = video.contentDetails.duration.match(/PT((\d+)M)?\d+S/);
      if(match[2] > 10){
        throw new Error("動画は10分以内のものにしてください。");
      } else {
        return video;
      }
    })

const toPost = video => {
  $thumb.attr("src", video.snippet.thumbnails.high.url);
  $videoTitle.text(video.snippet.title);
  $videoDescription.text(video.snippet.description)
  $submitForm[0].id.value = video.id;
  location.hash = "post";
}

const renderSearchResult = (videos, reset=true) =>{
  if(reset) $searchResult.html("");
  videos.forEach(video =>{
    $searchResultTemplete.content
      .querySelector(".title").innerText = video.snippet.title;
    $searchResultTemplete.content
      .querySelector(".description").innerText = video.snippet.description;
    $searchResultTemplete.content
      .querySelector(".thumb").src = video.snippet.thumbnails.medium.url;
    $searchResultTemplete.content
      .querySelector("li").addEventListener("click", () => toPost(video));
    $searchResult.append(
      document.importNode($searchResultTemplete.content, true));
  })
}

$(".back").on("click", e =>{history.back();history.back()})

$getShortenURL.on("submit", e => {
  location.hash = "";
  getRoomId($inputShortenURL.val())
    .then( roomId => new Promise((resolve) => {
      const val = $inputKeepPeriod.val();
      let keepPeriod;
      if ( 0 >= val ){
        keepPeriod = "Infinity";
      } else {
        const toDay = new Date;
        keepPeriod = (new Date(
          toDay.getFullYear(),
          toDay.getMonth(),
          toDay.getDate() + ($inputKeepPeriod.val() - 0)
        )).getTime();
      }

      chrome.storage.sync.set({roomId, keepPeriod},
        () => resolve());
    }))
    .then(()=> location.reload())
    .catch(reason => error(reason))
    $getShortenURL[0].reset();
    return false;
});

$submitForm.on("submit", ()=> {
  location.hash = "";
  fetch("https://dj.life-is-tech.com/api",
    { method: "POST", body: new FormData($submitForm[0])})
    .then(res => {
      if(res.ok){
        location.hash = "success";
      } else {
        error(res.status + res.statusText);
      }
    })
    .catch(reason => error(reason));
  return false;
});

$("#logout").on("click", () => chrome.storage.sync.clear(location.reload));

$inputSearchQuery.on("focus", () => {
  location.hash = "search";
  $inputSearchQuery[0].focus();
});

(new Promise(res => chrome.storage.sync.get(["roomId", "keepPeriod"], v => res(v))))
  .then(v =>{
    if(!v.roomId || !v.keepPeriod || new Date > v.keepPeriod) {
      location.hash = "init";
    } else {
      $showRoomId.text(v.roomId);
      $submitForm[0].room_id.value = v.roomId;
      $showKeepPeriod.text(Math.floor((v.keepPeriod - new Date) / (1000 * 60 * 60 * 24) + 1));
      (new Promise((res, rej) => chrome.tabs.query({active:true}, t =>{
        const match = t[0].url.match(/youtube.com\/.*[?&]v=([-\w]+)/);
        if (match) {
          videoId = match[1]
          res(match[1])
        } else {
          rej(new Error("YouTube上で起動してください。"));
        }
      })))
        .then(checkVideoDuration)
        .then(toPost)
        .catch(error)
    }

    $window.trigger("hashchange");
  })
