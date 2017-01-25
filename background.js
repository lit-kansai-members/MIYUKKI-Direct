"use strict";

chrome.alarms.onAlarm.addListener(({name}) =>{
  if (name === "postAllowed")
    chrome.notifications.create("test",{
      type:"basic",
      iconUrl:"./icons/128.png",
      title:"動画を起動できます | MIYUKKI Direct",
      message:"前回の投稿から5分間経ちました。"});
});
