document.addEventListener("DOMContentLoaded", () => {
  const storageKey = "one-card-bingo-v1";
  const maxGames = 6;
  const columnLetters = ["B", "I", "N", "G", "O"];
  const columnRanges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ];
  const bingoGrid = document.getElementById("bingo-grid");
  const progress = document.getElementById("progress");
  const gameStatus = document.getElementById("game-status");
  const storageNotice = document.getElementById("storage-notice");
  const celebration = document.getElementById("celebration");
  const celebrationClose = document.getElementById("celebration-close");
  const gameNumber = document.getElementById("game-number");
  const calledNumber = document.getElementById("called-number");
  const calledHistory = document.getElementById("called-history");
  const callerCount = document.getElementById("caller-count");
  const drawButton = document.getElementById("draw-button");
  const nextGameButton = document.getElementById("next-game");
  const gameLimit = document.getElementById("game-limit");

  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }

  function createCard() {
    const columns = columnRanges.map(([first, last]) =>
      shuffle(
        Array.from({ length: last - first + 1 }, (_, offset) => first + offset),
      ).slice(0, 5),
    );
    const numbers = Array.from({ length: 25 }, (_, index) => {
      const column = index % 5;
      return columns[column][Math.floor(index / 5)];
    });

    numbers[12] = "FREE";
    const marked = Array(25).fill(false);
    marked[12] = true;
    return { numbers, marked, game: 1, called: [] };
  }

  function isValidGame(savedCard) {
    return (
      Number.isInteger(savedCard.game) &&
      savedCard.game >= 1 &&
      savedCard.game <= maxGames &&
      Array.isArray(savedCard.called) &&
      savedCard.called.length <= 75 &&
      savedCard.called.every(
        (number) => Number.isInteger(number) && number >= 1 && number <= 75,
      ) &&
      new Set(savedCard.called).size === savedCard.called.length
    );
  }

  function isValidCard(savedCard) {
    if (
      !savedCard ||
      !Array.isArray(savedCard.numbers) ||
      savedCard.numbers.length !== 25 ||
      !Array.isArray(savedCard.marked) ||
      savedCard.marked.length !== 25 ||
      !savedCard.marked.every((value) => typeof value === "boolean") ||
      savedCard.numbers[12] !== "FREE" ||
      savedCard.marked[12] !== true
    ) {
      return false;
    }

    return columnRanges.every(([first, last], column) => {
      const columnNumbers = savedCard.numbers.filter(
        (_, index) => index % 5 === column && index !== 12,
      );
      return (
        columnNumbers.length === (column === 2 ? 4 : 5) &&
        columnNumbers.every(
          (number) =>
            Number.isInteger(number) && number >= first && number <= last,
        ) &&
        new Set(columnNumbers).size === columnNumbers.length
      );
    });
  }

  let card;
  let persistenceAvailable = true;
  let invalidGame = false;
  let initialNotice = "";
  let savedCard;

  try {
    savedCard = localStorage.getItem(storageKey);
  } catch (error) {
    persistenceAvailable = false;
    initialNotice =
      "This browser cannot access saved cards. Keep this page open for your game.";
    console.error("Could not access the saved bingo card:", error);
  }

  if (persistenceAvailable && savedCard) {
    try {
      const parsedCard = JSON.parse(savedCard);
      if (isValidCard(parsedCard)) {
        if (!("game" in parsedCard) && !("called" in parsedCard)) {
          parsedCard.game = 1;
          parsedCard.called = [];
        }
        if (isValidGame(parsedCard)) {
          card = parsedCard;
        } else {
          persistenceAvailable = false;
          invalidGame = true;
          initialNotice = "Saved game data is invalid. The card cannot be played safely.";
        }
      } else {
        initialNotice = "The saved card could not be read, so a new card was created.";
      }
    } catch (error) {
      initialNotice = "The saved card data could not be read, so a new card was created.";
      console.error("Could not parse the saved bingo card:", error);
    }
  }

  if (!card && !invalidGame) {
    card = createCard();
  }

  if (!card) {
    showUnavailable();
    return;
  }

  function showStorageNotice(message) {
    storageNotice.textContent = message;
    storageNotice.classList.toggle("hidden", !message);
  }

  function showUnavailable() {
    drawButton.disabled = true;
    nextGameButton.disabled = true;
    gameStatus.textContent = "The saved card is unavailable.";
    showStorageNotice(initialNotice);
  }

  function saveCard() {
    if (!persistenceAvailable) {
      return;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(card));
    } catch (error) {
      persistenceAvailable = false;
      showStorageNotice(
        "Your card can no longer be saved. Keep this page open for your game.",
      );
      console.error("Could not save the bingo card:", error);
    }
  }

  function winningLines() {
    const lines = [];
    for (let index = 0; index < 5; index += 1) {
      lines.push(
        Array.from({ length: 5 }, (_, offset) => index * 5 + offset),
        Array.from({ length: 5 }, (_, offset) => offset * 5 + index),
      );
    }
    lines.push(
      Array.from({ length: 5 }, (_, index) => index * 6),
      Array.from({ length: 5 }, (_, index) => (index + 1) * 4),
    );

    return lines
      .filter((line) => line.every((index) => card.marked[index]))
      .map((line) => line.join(","));
  }

  function updateStatus(previousLines) {
    const markedCount = card.marked.filter(
      (isMarked, index) => isMarked && index !== 12,
    ).length;
    progress.textContent = `${markedCount} / 24`;
    progress.setAttribute("aria-label", `${markedCount} of 24 numbers marked`);

    const currentLines = winningLines();
    if (currentLines.length) {
      gameStatus.textContent =
        "BINGO! You have a winning line.";
    } else if (markedCount === 0) {
      gameStatus.textContent = "Your card is ready. Good luck!";
    } else {
      gameStatus.textContent = `${markedCount} of 24 marked. Keep an eye out for your line.`;
    }

    if (
      previousLines &&
      currentLines.some((line) => !previousLines.includes(line))
    ) {
      celebration.hidden = true;
      void celebration.offsetWidth;
      celebration.hidden = false;
    } else if (!currentLines.length) {
      celebration.hidden = true;
    }
  }

  celebrationClose.addEventListener("click", () => {
    celebration.hidden = true;
  });

  function formatCall(number) {
    return `${columnLetters[Math.floor((number - 1) / 15)]} ${number}`;
  }

  function renderGameControls() {
    gameNumber.textContent = `GAME ${card.game} OF ${maxGames}`;
    calledNumber.textContent = card.called.length
      ? formatCall(card.called[card.called.length - 1])
      : "--";
    callerCount.textContent = `${card.called.length} / 75 called`;
    calledHistory.textContent = card.called.length
      ? card.called.map(formatCall).join(", ")
      : "No numbers called yet.";
    drawButton.disabled = card.called.length === 75;
    drawButton.textContent = drawButton.disabled ? "All numbers called" : "Draw number";
    nextGameButton.disabled = card.game === maxGames;
    nextGameButton.textContent = nextGameButton.disabled
      ? "Final game"
      : `Start game ${card.game + 1}`;
    gameLimit.textContent = nextGameButton.disabled
      ? "This is the last game for this card."
      : "Starting the next game clears marks and called numbers.";
  }

  drawButton.addEventListener("click", () => {
    if (card.called.length === 75) return;
    const remaining = Array.from({ length: 75 }, (_, index) => index + 1)
      .filter((number) => !card.called.includes(number));
    card.called.push(remaining[Math.floor(Math.random() * remaining.length)]);
    saveCard();
    renderGameControls();
  });

  nextGameButton.addEventListener("click", () => {
    if (card.game === maxGames) return;
    if (!window.confirm(
      `Start game ${card.game + 1}? This clears your marks and called numbers.`,
    )) return;
    card.game += 1;
    card.marked.fill(false);
    card.marked[12] = true;
    card.called = [];
    celebration.hidden = true;
    saveCard();
    renderCard();
    renderGameControls();
    updateStatus();
  });

  function renderCard() {
    bingoGrid.replaceChildren();

    card.numbers.forEach((number, index) => {
      const column = index % 5;
      const button = document.createElement("button");
      const isFree = index === 12;

      button.type = "button";
      button.className = "bingo-square";
      button.textContent = number;
      button.setAttribute("aria-pressed", String(card.marked[index]));
      button.setAttribute(
        "aria-label",
        isFree
          ? "Free space, marked"
          : `${columnLetters[column]} ${number}, ${
              card.marked[index] ? "marked" : "not marked"
            }`,
      );

      if (card.marked[index]) {
        button.classList.add("is-marked");
      }

      if (isFree) {
        button.classList.add("is-free");
        button.disabled = true;
      } else {
        button.addEventListener("click", () => {
          const previousLines = winningLines();
          card.marked[index] = !card.marked[index];
          button.classList.toggle("is-marked", card.marked[index]);
          button.setAttribute("aria-pressed", String(card.marked[index]));
          button.setAttribute(
            "aria-label",
            `${columnLetters[column]} ${number}, ${
              card.marked[index] ? "marked" : "not marked"
            }`,
          );
          saveCard();
          updateStatus(previousLines);
        });
      }

      bingoGrid.appendChild(button);
    });
  }

  if (initialNotice) {
    showStorageNotice(initialNotice);
  }

  renderCard();
  renderGameControls();
  updateStatus();
  saveCard();
});
