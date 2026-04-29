const MAX_ARRAY_COUNT = 20;
const MAX_CHECKBOX_COUNT = 30;

let isConnected = false;
let checkboxUI = [];

const socket = io();

socket.on("connect", () => {
  console.log("Connected to server");
  toggleAllCheckbox(1);
  isConnected = true;
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
  toggleAllCheckbox(0);
  isConnected = false;
  localStorage.removeItem("userId");
  localStorage.removeItem("colorAssigned");
});

socket.on("checkbox:init", (state) => {
  const { checkboxs, userId, colorAssigned } = state;

  localStorage.setItem("userId", userId);
  localStorage.setItem("colorAssigned", colorAssigned);

  checkboxUI = checkboxs;
  updateAllCheckbox(checkboxUI);

});

socket.on("stats:update", (stats) => {
  const { totalUsers } = stats;
  console.log('stats:update', totalUsers)
  updateTotalUsers(totalUsers);
});

socket.on("checkbox:update", (state) => {
  const { index, checked, userId, colorAssigned } = state;

  const checkbox = document.getElementById(`checkbox-${index}`);
  checkbox.checked = checked;
  checkboxUI[index].state = checked;
  checkboxUI[index].userId = userId;

  if (checked) {
    checkboxUI[index].styles = {
      backgroundColor: colorAssigned,
      borderColor: colorAssigned,
      boxShadow: `0 0 5px ${colorAssigned}`,
    };
  } else {
    checkboxUI[index].styles = {
      backgroundColor: "",
      borderColor: "",
      boxShadow: "",
    };
  }
  updateCheckboxStyle(index, checkboxUI[index].styles);
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
      checkbox.checked = states[i].state;
      updateCheckboxStyle(i, states[i].styles);
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

function updateIndividualCheckbox(index, data) {
  const checkbox = document.getElementById(`checkbox-${index}`);
  checkbox.checked = data.state;

  if (data.state) {
    updateCheckboxStyle(index, data.styles);
  } else {
    updateCheckboxStyle(index, {
      backgroundColor: "",
      borderColor: "",
      boxShadow: "",
    });
  }
}

function handleCheckboxChange(index) {
  const currentUserId = getUserId();

  const checkbox = document.getElementById(`checkbox-${index}`);
  const newState = checkbox.checked;
  const colorAssigned = getAssignedColor();
  const state = { index, checked: newState, userId: currentUserId };

  checkboxUI[index].state = newState;
  checkboxUI[index].userId = state.userId;

  if (newState) {
    checkboxUI[index].styles = {
      backgroundColor: colorAssigned,
      borderColor: colorAssigned,
      boxShadow: `0 0 5px ${colorAssigned}`,
    };
  } else {
    checkboxUI[index].styles = {
      backgroundColor: "",
      borderColor: "",
      boxShadow: "",
    };
  }
  updateCheckboxStyle(index, checkboxUI[index].styles);

  socket.emit("checkbox:change", state);
}

function updateTotalUsers(totalUsers) {
  const totalUsersElement = document.getElementById("usersCount");
  totalUsersElement.innerHTML = totalUsers;
}
// Generate 5 checkboxes when the page loads
window.addEventListener("DOMContentLoaded", () => {
  checkboxUI = new Array(MAX_ARRAY_COUNT).fill(false).map(() => ({
    state: false,
    userId: null,
    styles: {},
  }));
  generateCheckboxes(MAX_ARRAY_COUNT);
});

function getUserId() {
  return localStorage.getItem("userId") || "";
}

function updateCheckboxStyle(index, styles) {
  const checkbox = document.getElementById(`checkbox-${index}`);

  for (const [key, value] of Object.entries(styles)) {
    checkbox.style[key] = value;
  }
}

function getAssignedColor() {
  return localStorage.getItem("colorAssigned") || "#0099ff";
}
