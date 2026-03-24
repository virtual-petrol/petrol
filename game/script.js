let score = 0;
const box = document.getElementById("box");
const scoreDisplay = document.getElementById("score");

function moveBox() {
  const x = Math.random() * 350;
  const y = Math.random() * 350;

  box.style.left = x + "px";
  box.style.top = y + "px";
}

// click गर्दा score बढ्छ
box.addEventListener("click", () => {
  score++;
  scoreDisplay.innerText = score;
  moveBox();
});

// start game
moveBox();
