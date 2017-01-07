chrome.runtime.sendMessage(
  {roomId: location.search.match(/r=(.+)/).pop().split("&")[0]}
);

console.log("sent room id to extension!");
