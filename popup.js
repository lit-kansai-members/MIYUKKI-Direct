const getRoomId = key =>
  fetch(`http://lit.sh/${key}`, {redirect: "manual", mode: "no-cors"})
    .then(responise =>{
      if(responise.type === "opaqueredirect"){
        Promise.resolve();
      } else {
        Promise.reject(`Requested URL ${url} is not redirectable URL.`);
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
      return url.match(/r=(.+)/).pop().split("&")[0];
    })
