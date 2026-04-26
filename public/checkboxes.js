const MAX_ARRAY_COUNT = 10000;
const MAX_CHECKBOX_COUNT = 30;

let isConnected = false;
let checkboxUI = [];

const socket = io();

socket.on("connect", () => {
  console.log("Connected to server");
  toggleAllCheckbox(1);
  isConnected = true;
});

socket.on("checkbox:init", (state) => {
  const { checkboxs } = state;
  console.log("inital:state", state);
  checkboxUI = checkboxs;
  updateAllCheckbox(checkboxs);
});

socket.on("stats:update", (stats) => {
  const { totalUsers } = stats;
  updateTotalUsers(totalUsers);
});

socket.on("checkbox:update", (state) => {
  const { index, checked } = state;

  console.log("event:frontend", { ...state });

  const checkbox = document.getElementById(`checkbox-${index}`);

  checkbox.checked = checked;
  console.log("checkbox:new-state", checkbox.checked);
});

function generateCheckboxes(numberOfCheckboxes = 5, states = null) {
  const container = document.getElementById("checkboxContainer");

  // Clear any existing checkboxes
  container.innerHTML = "";

  // Create checkboxes
  for (let i = 0; i < numberOfCheckboxes; i++) {
    // Create checkbox input
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `checkbox-${i}`;
    checkbox.value = `option-${i}`;
    checkbox.className = "checkbox";
    checkbox.disabled = true;

    if (states) {
      checkbox.checkbox = states[i];
    }

    checkbox.addEventListener("change", () => handleCheckboxChange(i));

    // Append checkbox to container
    container.appendChild(checkbox);
  }
}

function updateAllCheckbox(states = []) {
  if (states.length > MAX_ARRAY_COUNT) {
    return;
  }

  for (let i = 0; i < MAX_ARRAY_COUNT; i++) {
    updateIndividualCheckbox(i, states[i]);
  }
}

function toggleAllCheckbox(state = 0) {
  for (let i = 0; i < MAX_ARRAY_COUNT; i++) {
    const checkbox = document.getElementById(`checkbox-${i}`);

    if (state === 0) {
      checkbox.checked = false;
      checkbox.disabled = true;
    } else if (state === 1) {
      checkbox.checked = true;
      checkbox.disabled = false;
    }
  }
}

function updateIndividualCheckbox(index, state) {
  const checkbox = document.getElementById(`checkbox-${index}`);
  checkbox.checked = state;
}

function handleCheckboxChange(index) {
  const newState = document.getElementById(`checkbox-${index}`).checked;

  const state = { index, checked: newState };
  
  checkboxUI[index] = newState;

  socket.emit("checkbox:change", state);
}

function updateTotalUsers(totalUsers) {
  const totalUsersElement = document.getElementById("usersCount");
  totalUsersElement.innerHTML = totalUsers;
}
// Generate 5 checkboxes when the page loads
window.addEventListener("DOMContentLoaded", () => {
  checkboxUI = new Array(MAX_ARRAY_COUNT).fill(false);
  generateCheckboxes(MAX_ARRAY_COUNT);
});
