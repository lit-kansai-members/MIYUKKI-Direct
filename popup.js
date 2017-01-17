"use strict"

const $ = selector => Array.from(document.querySelectorAll(selector));
const $id = id => document.getElementById(id);

const $inputShortenURL = $id("inputShortenURL");
const $selectUrlType = $id("selectUrlType");
const $errorResult = $id("error-result");
const $inputKeepPeriod = $id("inputKeepPeriod");

const $showRoomId = $id("roomId");
const $showKeepPeriod = $id("showKeepPeriod");
const $getShortenURL  = $id("getShortenURL");

const $videoTitle = $id("videoTitle");
const $videoDescription = $id("videoDescription");
const $player = $id("player");
const $submitForm = $id("submit");

const $inputSearchQuery = $id("inputSearchQuery");
const $autocompletes = $id("autocompletes");

const $search = $id("search");
const $searchResult = $id("search-result")
const $searchResultTemplete = $id("searchResultTemplete");
const searchHeight = $search.offsetHeight;

const $removeHistory = $id("removeHistory");
const $history = $id("history");

const error = e =>{
  console.error("something Error occured!", e)
  location.hash = "error"
  $errorResult.innerText = e;
}

let lastFetch = 0;
let lastFetchURL = "";
let nextPageToken = "";
let searchResults = [];
let videoInfo = {};
let completeList = [];
let focused = 0;
let isFirstKeydown = true;

$("a:not(#tweet)").forEach(e => e.addEventListener("click", ({target:{href: url}}) => chrome.tabs.create({url})))

const getRoomId = url =>{
  return fetch(url, {redirect: "manual", mode: "no-cors"})
    .then(responise =>{
      if(responise.type !== "opaqueredirect"){
        throw new Error(`Requested URL ${url} is not redirectable.`);
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
      const match = url.match(/dj\.life-is-tech\.com\/submit\.html?.*r=([^&]+)/);
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
  $player.src = `https://www.youtube.com/embed/${video.id}?color=white&fs=0&rel=0&showinfo=0`;
  $videoTitle.innerText = video.snippet.title;
  $videoDescription.innerText = video.snippet.description;
  $submitForm.id.value = video.id;
  location.hash = "post";
}

const renderSearchResult = (videos, reset=true) =>{
  if(reset){
    $searchResult.innerHTML = "";
    searchResults = [];
    isFirstKeydown = true;
  }
  const frag = document.createDocumentFragment();
  videos.forEach(video =>{
    $searchResultTemplete.content
      .querySelector(".title").innerText = video.snippet.title;
    $searchResultTemplete.content
      .querySelector(".description").innerText = video.snippet.description;
    $searchResultTemplete.content
      .querySelector(".thumb").src = video.snippet.thumbnails.medium.url;
    $searchResultTemplete.content
      .querySelector("li").addEventListener("click", () => toPost(video));
    frag.appendChild(
      document.importNode($searchResultTemplete.content, true));
  })
  $searchResult.appendChild(frag);
  searchResults = searchResults.concat(videos);
}

const search = isFirstFetch =>{
  const {value} = $inputSearchQuery
  let URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${encodeURIComponent(value)}`;
  if(isFirstFetch) nextPageToken = null;
  if(!nextPageToken && lastFetchURL === URL){
    return;
  }
  const fetchId = ++lastFetch;
  let _token;
  lastFetchURL = URL;
  if(nextPageToken){
    URL = `${URL}&pageToken=${nextPageToken}`
  }
  $searchResult.classList.add("loading");
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
        _token = t;
        return Promise.all(results
        .map(({id:{videoId}}) =>
          checkVideoDuration(videoId)
            .catch(() => null)));
      })
      .then(results => results.filter(v => v))
      .then(videos => {
        if(fetchId === lastFetch) {
          nextPageToken = _token;
          $history.classList.add("hidden");
          renderSearchResult(videos, isFirstFetch);
          $searchResult.classList.remove("loading");
        }
      })
      .catch(r => {location.hash = ""; error(r)})
  } else {
    nextPageToken = null;
    $history.classList.remove("hidden");
    chrome.storage.sync.get("history",({history=[]}) =>{
      renderSearchResult(history);
      $searchResult.classList.remove("loading");
    });
  }
}

window.addEventListener("hashchange", () =>{
  const {hash} = location;
  if(hash === "#search" && !$inputSearchQuery.value){
    search();
  }
  if(hash === "#search"){
    $inputSearchQuery.focus();
  } else if(hash !== "#" || hash !== ""){
    const target = document.querySelector(`${hash} .autofocus`);
    if(target) target.focus();
  }
});

document.addEventListener("keyup", e =>{
  if(e.keyCode === 83 && document.activeElement.tagName !== "INPUT"
      && getComputedStyle($inputSearchQuery).display !== "none"){
    location.hash = "search";
  }
});

$(".back").forEach(e => e.addEventListener("click", e =>{
  history.go(-2);
}))

$getShortenURL.addEventListener("submit", e => {
  location.hash = "";
  const {value: baseURL} = $selectUrlType;
  const {value: param} = $inputShortenURL;
  Promise.resolve()
    .then(() => baseURL === "direct" ? param : getRoomId(baseURL + param))
    .then( roomId => new Promise((resolve) => {
      const {value} = $inputKeepPeriod;
      let keepPeriod;
      if ( 0 >= value ){
        keepPeriod = "Infinity";
      } else {
        const toDay = new Date;
        keepPeriod = (new Date(
          toDay.getFullYear(),
          toDay.getMonth(),
          toDay.getDate() + (value - 0)
        )).getTime();
      }

      chrome.storage.sync.set({roomId, keepPeriod},
        () => resolve());
    }))
    .then(()=> location.reload())
    .catch(reason => error(reason))
    $getShortenURL.reset();
    e.preventDefault();
});

$submitForm.addEventListener("submit", e => {
  location.hash = "";
  chrome.storage.sync.get("lastPost", ({lastPost=0}) => {
    if(new Date - lastPost < 1000 * 60 * 5){
      error("一回投稿したら最低五分間は間を空けて投稿してください。");
    } else {
      fetch("https://dj.life-is-tech.com/api",
        { method: "POST", body: new FormData($submitForm)})
        .then(res => {
          if(res.ok){
            chrome.storage.sync.get("history", ({history = []}) =>{
              history.push(videoInfo);
              chrome.storage.sync.set({history, lastPost: (new Date).getTime()}, () =>
                location.hash = "success" );
            });
          } else {
            error(res.status + res.statusText);
          }
        })
        .catch(reason => error(reason));
    }
  })
  e.preventDefault();
});

$id("logout").addEventListener("click", () => 
  chrome.storage.sync.remove(["roomId", "keepPeriod"], ()=> location.reload()));

$removeHistory.addEventListener("click", ()=>
  chrome.storage.sync.remove("history", () => location.reload()))

$inputSearchQuery.addEventListener("focus", () => {
  location.hash = "search";
});

$inputSearchQuery.addEventListener("input", () =>{
  $autocompletes.innerHTML = "";
  completeList = [];
  if($inputSearchQuery.value)
    fetch("http://suggestqueries.google.com/complete/search?client=firefox&hl=ja&ds=yt&q="
    + encodeURIComponent($inputSearchQuery.value))
    .then(res => res.ok && res.json())
    .then(([input, result]) => {
      if(input === $inputSearchQuery.value){
        const frag = document.createDocumentFragment();
        result.forEach(value =>{
          const element = document.createElement("li");
          element.classList.add("elipsis");
          element.innerText = value;
          frag.appendChild(element);
        })
        $autocompletes.innerHTML = "";
        completeList = [];
        $autocompletes.appendChild(frag);
        completeList = result.map((value, i) =>
          ({value, element: $autocompletes.childNodes[i]}))
        focused = 0;
        if(completeList.length)
          completeList[0].element.classList.add("focused");
      }
    })
  search(true);
});

$inputSearchQuery.addEventListener("keydown", e => {
  if(!completeList.length){
    const children = Array.from($searchResult.childNodes)
      .filter(v => v.tagName && v.tagName === "LI");
    if(!children.length) return;
    children[focused] && children[focused].classList.remove("focused");

    if (e.keyCode === 38 || (e.keyCode === 9 && e.shiftKey)){
      if(--focused < 0) focused = 0;
    } else if(e.keyCode === 40 || (e.keyCode === 9 && !e.shiftKey)){
      if(isFirstKeydown || ++focused > searchResults.length - 1) focused = 0;
    } else if(e.keyCode === 13){
      isFirstKeydown = true;
      toPost(searchResults[focused]);
      focused = 0;
      return;
    } else {
      return;
    }

    isFirstKeydown = false;
    const {offsetHeight: itemHeight, offsetTop} = children[focused];
    const {offsetHeight: height, scrollTop} = $searchResult;
    if(scrollTop > offsetTop){
      $searchResult.scrollTop = offsetTop;
    } else if(scrollTop + height < offsetTop + itemHeight){
      $searchResult.scrollTop = offsetTop + itemHeight - height;
    }
    if(focused > searchResults.length - 4 || nextPageToken) search(false);
    children[focused].classList.add("focused");
  }else{
    completeList[focused].element.classList.remove("focused");

    if (e.keyCode === 38 || (e.keyCode === 9 && e.shiftKey)){
      if(--focused < 0) focused = completeList.length - 1;
    } else if(e.keyCode === 40 || (e.keyCode === 9 && !e.shiftKey)){
      if(++focused > completeList.length - 1) focused = 0;
    } else if(e.keyCode === 13){
      $inputSearchQuery.value = completeList[focused].value;
      $autocompletes.innerHTML = "";
      completeList = [];
      focused = 0;
      return;
    } else {
      return;
    }

    const {value, element} = completeList[focused];
    $inputSearchQuery.value = value;
    element.classList.add("focused");
    search(true);

    const {offsetHeight: itemHeight, offsetTop} = element;
    const {offsetHeight: height, scrollTop} = $autocompletes;
    if(scrollTop > offsetTop){
      $autocompletes.scrollTop = offsetTop;
    } else if(scrollTop + height < offsetTop + itemHeight){
      $autocompletes.scrollTop = offsetTop + itemHeight - height;
    }
  }

  e.preventDefault();
})

$inputSearchQuery.addEventListener("blur", () =>{
  $autocompletes.innerHTML = "";
  completeList = [];
  focused = 0;
})

$search.addEventListener("scroll", () =>{
  if($search.scrollTop >= $searchResult.offsetHeight - searchHeight - 70 && nextPageToken){
    search(false);
  }
});

$searchResult.addEventListener("click", ({target}) =>{
  const clicked = searchResults[
    Array.from(document.querySelectorAll("#search-result li"))
    .findIndex(el => el.contains(target))]
  if(clicked) toPost(clicked);
});

$id("tweet").addEventListener("click", e => {
  chrome.windows.create({
    url: `https://twitter.com/intent/tweet?url=${
      encodeURIComponent("http://youtu.be/" + videoInfo.id)
    }&text=${
      encodeURIComponent(`DJ MIYUKKI SYSTEM に ${videoInfo.snippet.title}を投稿しました`)
    }&hashtags=${encodeURIComponent(`#DJMIYUKKI_${$submitForm.room_id.value}`)}`,
    type: "popup"
  });
  e.preventDefault();
  e.stopPropagation();
});

(new Promise(res => chrome.storage.sync.get(["roomId", "keepPeriod"], v => res(v))))
  .then(({roomId, keepPeriod}) =>{
    if(!roomId || !keepPeriod || new Date > keepPeriod) {
      location.hash = "init";
      $("header *:not(p):not(#logo)").forEach(e => e.style.display = "none")
    } else {
      $showRoomId.innerText = roomId;
      $submitForm.room_id.value = roomId;
      $showKeepPeriod.innerText = Math.floor((keepPeriod - new Date) / (1000 * 60 * 60 * 24) + 1);
      (new Promise((res, rej) => chrome.tabs.query({active:true, currentWindow: true}, t =>{
        const match = t[0].url.match(/youtube.com\/.*[?&]v=([-\w]+)/);
        if (match) {
          res(match[1])
        } else {
          location.hash = "search";
        }
      })))
        .then(checkVideoDuration)
        .then(toPost)
        .catch(error);
    }
  })
