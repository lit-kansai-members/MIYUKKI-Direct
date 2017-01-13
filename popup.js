const $window = $(window);

const $inputShortenURL = $("#inputShortenURL");
const $errorResult = $("#error-result");
const $inputKeepPeriod = $("#inputKeepPeriod");

const $showRoomId = $("#roomId");
const $showKeepPeriod = $("#showKeepPeriod");
const $getShortenURL  = $("#getShortenURL");

const $videoTitle = $("#videoTitle");
const $thumb = $("#thumb");
const $submit = $("#submit");

let roomId, keepPeriod, videoId;


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
    .then(token => fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoId}&access_token=${token}`))
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

$(".back").on("click", e =>{history.back();history.back()})

$getShortenURL.on("submit", e => {
  location.hash = "";
  getRoomId($inputShortenURL.val())
    .then( id => new Promise((resolve) => {
      roomId = id;
      const val = $inputKeepPeriod.val();
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
    .then(()=> location.hash = "post")
    .catch(reason => error(reason))
    $getShortenURL[0].reset();
    return false;
});

$window.on("hashchange", () =>{
  switch (location.hash.slice(1)){
    case "post":
      $showRoomId.text(roomId);
      $showKeepPeriod.text(Math.floor((keepPeriod - new Date) / (1000 * 60 * 60 * 24) + 1));
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
        .then(video => {
          $thumb.attr("src", video.snippet.thumbnails.high.url);
          $videoTitle.text(video.snippet.title);
        })
        .catch(error)
      break;
  }
});

$submit.on("click", ()=> {
  location.hash = "";
  const body = new FormData;
  body.append("room_id", roomId);
  body.append("id", videoId);
  fetch("https://dj.life-is-tech.com/api",
    { method: "POST", body})
    .then(res => {
      if(res.ok){
        location.hash = "success";
      } else {
        error(res.status + res.statusText);
      }
    })
    .catch(reason => error(reason));
});

$("#logout").on("click", () => {
  chrome.storage.sync.clear();
  location.reload();
});

(new Promise(res => chrome.storage.sync.get(["roomId", "keepPeriod"], v => res(v))))
  .then(v =>{
    if(!v.roomId || !v.keepPeriod || new Date > v.keepPeriod) {
      location.hash = "init";
    } else {
      ({roomId, keepPeriod} = v)
      location.hash = "post";
    }

    $window.trigger("hashchange");
  })
