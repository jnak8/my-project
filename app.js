const greetings = ["こんにちは", "Hello", "Bonjour", "Hola", "안녕하세요"];
const message = document.getElementById("message");
const button = document.getElementById("greet-btn");

let index = 0;

button.addEventListener("click", () => {
  index = (index + 1) % greetings.length;
  message.textContent = greetings[index];
});
