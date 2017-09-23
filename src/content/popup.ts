$('#open-options').on('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});