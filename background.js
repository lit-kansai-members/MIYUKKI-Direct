"use strict";

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
