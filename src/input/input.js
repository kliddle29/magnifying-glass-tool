const input = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  active: false,
};

function initInput() {
  window.addEventListener('mousemove', (event) => {
    input.x = event.clientX;
    input.y = event.clientY;
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'magnifier:toggle') {
      input.active = !input.active;
      setLensVisible(input.active);
    }
  });
}
