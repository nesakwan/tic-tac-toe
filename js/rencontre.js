const continueButton = document.getElementById("continue-button");

continueButton.addEventListener("click", function () {

    const gameMode = document.querySelector(
        'input[name="game-mode"]:checked'
    ).value;

    const difficulty = document.querySelector(
        'input[name="difficulty"]:checked'
    ).value;

    localStorage.setItem("gameMode", gameMode);
    localStorage.setItem("difficulty", difficulty);

    console.log("Mode :", gameMode);
    console.log("Difficulté :", difficulty);
});