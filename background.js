"use strict";

let beforeReference, data = null;

chrome.alarms.onAlarm.addListener(({name}) =>{
  chrome.storage.sync.get("settings", ({settings:{noticeAllowedPost}}) =>{
    console.log(noticeAllowedPost)
    if (name === "postAllowed" && (noticeAllowedPost || noticeAllowedPost == null))
      chrome.notifications.create("test",{
        type:"basic",
        iconUrl:"./icons/128.png",
        title:"動画を起動できます | MIYUKKI Direct",
        message:"前回の投稿から5分間経ちました。"});
  })
});

firebase.initializeApp({databaseURL: "https://dj-miyukki-system.firebaseio.com/"})

const handleLoggedIn = () =>
  chrome.storage.sync.get(["roomId", "keepPeriod"], ({roomId, keepPeriod}) => {
    if(roomId && keepPeriod && new Date < keepPeriod) {
      beforeReference && beforeReference.off();
      beforeReference = firebase.database().ref(`rooms/${roomId}/playing`);
      beforeReference.on("value", snapshot => {
        data = snapshot.val();
        chrome.runtime.sendMessage({type: "playingChanged", data});

      chrome.storage.sync.get("settings", ({settings:{noticeNowPlaying}}) =>{
        if (data != null && (noticeNowPlaying || noticeNowPlaying == null))
          chrome.notifications.create("nowPlaying",{
            type:"basic",
            iconUrl:"./icons/128.png",
            title:"Now Playing | MIYUKKI Direct",
            message: data
          }); // TODO: set message from video data.
        });
      });
    }
  });

handleLoggedIn();

chrome.runtime.onMessage.addListener(({type}) => {
  switch (type) {
    case "loggedIn":
      handleLoggedIn();
      break;
    case "openPopup":
      chrome.runtime.sendMessage({type: "playingChanged", data});
      break;
    }
});
