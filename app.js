const greetings = ["こんにちは", "Hello", "Bonjour", "Hola", "안녕하세요"];
const message = document.getElementById("message");
const countLabel = document.getElementById("count");
const button = document.getElementById("greet-btn");

let index = 0;
let clicks = 0;

button.addEventListener("click", () => {
  index = (index + 1) % greetings.length;
  clicks += 1;
  message.textContent = greetings[index];
  countLabel.textContent = "クリック回数: " + clicks;
});
