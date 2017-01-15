const $window = $(window);

const $inputShortenURL = $("#inputShortenURL")[0];
const $selectUrlType = $("#selectUrlType")[0]
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

const $search = $("#search");
const $searchResult = $("#search-result")
const $searchResultTemplete = $("#searchResultTemplete")[0];
const searchHeight = $search.height();

const $removeHistory = $("#removeHistory");
const $history = $("#history");

const error = e =>{
  console.error("something Error occured!", e)
  location.hash = "error"
  $errorResult.text(e);
}

let lastFetch = 0;
let lastFetchURL = "";
let nextPageToken = "";
let searchResults = [];
let videoInfo = {};

$("a").on("click", ({target:{href: url}}) => chrome.tabs.create({url}))

const getRoomId = url =>{
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
  videoInfo = video;
  $thumb.attr("src", video.snippet.thumbnails.high.url);
  $videoTitle.text(video.snippet.title);
  $videoDescription.text(video.snippet.description)
  $submitForm[0].id.value = video.id;
  location.hash = "post";
}

const renderSearchResult = (videos, reset=true) =>{
  if(reset){
    $searchResult.html("");
    searchResults = [];
  }
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
  searchResults = searchResults.concat(videos);
}

const search = () =>{
  const {value} = $inputSearchQuery[0]
  let URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${encodeURIComponent(value)}`;
  if(lastFetchURL !== URL){nextPageToken = null};
  const isFirstFetch = !nextPageToken;
  if(!nextPageToken && lastFetchURL === URL){
    return;
  }
  const fetchId = ++lastFetch;
  lastFetchURL = URL;
  if(nextPageToken){
    URL = `${URL}&pageToken=${nextPageToken}`
  }
  $searchResult.addClass("loading");
  if(value){
    Promise.resolve()
      .then(() => new Promise(res => 
        chrome.identity.getAuthToken({interactive:true}, res)))
      .then(token => fetch(`${URL}&access_token=${token}`))
      .then(res => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        } else {
          throw new Error("No result found.");
        }
      })
      .then(({nextPageToken: t, items: results}) =>{
        nextPageToken = t;
        return Promise.all(results
        .map(({id:{videoId}}) =>
          checkVideoDuration(videoId)
            .catch(() => null)));
      })
      .then(results => results.filter(v => v))
      .then(videos => {
        if(fetchId === lastFetch) {
          $history.css({display: "none"});
          renderSearchResult(videos, isFirstFetch);
          $searchResult.removeClass("loading");
        }
      })
      .catch(error)
  } else {
    nextPageToken = null;
    $history.css({display: ""});
    chrome.storage.sync.get("history",({history=[]}) =>{
      renderSearchResult(history);
      $searchResult.removeClass("loading");
    });
  }
}

$window.on("hashchange", () =>{
  if(location.hash === "#search" && !$inputSearchQuery.val()){
    search();
  }
});

$(".back").on("click", e =>{history.back();history.back()})

$getShortenURL.on("submit", e => {
  location.hash = "";
  const {value: baseURL} = $selectUrlType;
  const {value: param} = $inputShortenURL;
  Promise.resolve()
    .then(() => baseURL === "direct" ? param : getRoomId(baseURL + param))
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
        chrome.storage.sync.get("history", ({history = []}) =>{
          history.push(videoInfo);
          chrome.storage.sync.set({history});
        });
        location.hash = "success";
      } else {
        error(res.status + res.statusText);
      }
    })
    .catch(reason => error(reason));
  return false;
});

$("#logout").on("click", () => 
  chrome.storage.sync.remove(["roomId", "keepPeriod"], ()=> location.reload()));

$removeHistory.on("click", ()=>
  chrome.storage.sync.remove("history", () => location.reload()))

$inputSearchQuery.on("focus", () => {
  location.hash = "search";
  $inputSearchQuery[0].focus();
});

$inputSearchQuery.on("input", search);

$search.on("scroll", () =>{
  if($search.scrollTop() >= $searchResult.height() - searchHeight - 70){
    search();
  }
});

$searchResult.on("click", ({target}) =>{
  const clicked = searchResults[
    Array.from(document.querySelectorAll("#search-result li"))
    .findIndex(el => el.contains(target))]
  if(clicked) toPost(clicked);
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
        .catch(() => location.hash = "search")
    }

    $window.trigger("hashchange");
  })
