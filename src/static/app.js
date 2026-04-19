document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupHelpText = document.getElementById("signup-help-text");
  const accountButton = document.getElementById("account-button");
  const accountButtonLabel = document.getElementById("account-button-label");
  const accountPanel = document.getElementById("account-panel");
  const sessionStatus = document.getElementById("session-status");
  const showLoginButton = document.getElementById("show-login-button");
  const logoutButton = document.getElementById("logout-button");
  const loginModal = document.getElementById("login-modal");
  const closeLoginModalButton = document.getElementById("close-login-modal");
  const loginForm = document.getElementById("login-form");

  let session = {
    authenticated: false,
    username: null,
  };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
    document.getElementById("username").focus();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  function renderSessionState() {
    const canManageRegistrations = session.authenticated;

    signupForm.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !canManageRegistrations;
    });

    if (canManageRegistrations) {
      accountButtonLabel.textContent = session.username;
      sessionStatus.textContent = `Logged in as ${session.username}. You can register and unregister students.`;
      signupHelpText.textContent = "Teacher mode is active. Registration changes are enabled.";
      showLoginButton.classList.add("hidden");
      logoutButton.classList.remove("hidden");
    } else {
      accountButtonLabel.textContent = "Account";
      sessionStatus.textContent = "Students can browse activities. Teachers can log in to manage registrations.";
      signupHelpText.textContent = "Teacher login is required to register or unregister students.";
      showLoginButton.classList.remove("hidden");
      logoutButton.classList.add("hidden");
    }
  }

  async function refreshSession() {
    try {
      const response = await fetch("/auth/session");
      session = await response.json();
      renderSessionState();
    } catch (error) {
      console.error("Error loading session:", error);
      session = { authenticated: false, username: null };
      renderSessionState();
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${
                        session.authenticated ? "" : "hidden"
                      }" data-activity="${name}" data-email="${email}" aria-label="Remove ${email} from ${name}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!session.authenticated) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!session.authenticated) {
      showMessage("Teacher login required", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  accountButton.addEventListener("click", () => {
    const isExpanded = accountButton.getAttribute("aria-expanded") === "true";
    accountButton.setAttribute("aria-expanded", String(!isExpanded));
    accountPanel.classList.toggle("hidden");
  });

  showLoginButton.addEventListener("click", () => {
    accountPanel.classList.add("hidden");
    accountButton.setAttribute("aria-expanded", "false");
    openLoginModal();
  });

  closeLoginModalButton.addEventListener("click", closeLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      closeLoginModal();
      showMessage(result.message, "success");
      await refreshSession();
      fetchActivities();
    } catch (error) {
      showMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
      }
    } catch (error) {
      showMessage("Failed to log out cleanly.", "error");
      console.error("Error logging out:", error);
    } finally {
      session = { authenticated: false, username: null };
      renderSessionState();
      fetchActivities();
      accountPanel.classList.add("hidden");
      accountButton.setAttribute("aria-expanded", "false");
    }
  });

  // Initialize app
  refreshSession().then(fetchActivities);
});
