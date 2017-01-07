const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const getShortenURL = $("#getShortenURL");
const shortenURL    = $("#inputShortenURL");
const result        = $("#result");

getShortenURL.addEventListener("submit", e =>{
  e.preventDefault();
  result.innerText = "plz wait...";
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(!!sender.tab && !!request.roomId){
      result.innerText = `got room id: ${request.roomId}`;
      chrome.tabs.remove(sender.tab.id);
    }
  });
  chrome.tabs.create({url:`http://lit.sh/${shortenURL.value}`,active:false})
});

