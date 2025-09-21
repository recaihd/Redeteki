 const loginDiv = document.getElementById("login");
  const chatDiv = document.getElementById("chat-container");
  const loadingDiv = document.getElementById("loading");
  const chat = document.getElementById("chat");
  const msgInput = document.getElementById("msg");
  const loginError = document.getElementById("loginError");
  const counter = document.getElementById("counter");
  const usersList = document.getElementById("users");
  const usersTitle = document.querySelector("#users-list h4");

  let username = null;

  const socket = new WebSocket("link do servidor WebSocket aqui paezao");

  loadingDiv.style.display = "block";

  socket.addEventListener("open", () => {
    const savedUser = localStorage.getItem("username");
    const savedPass = localStorage.getItem("password");
    const savedAvatar = localStorage.getItem("avatar");

    if (savedUser && savedPass) {
      socket.send(JSON.stringify({
        type: "login",
        username: savedUser,
        password: savedPass,
        avatar: savedAvatar || "./img/redetekiIcon2.png"
      }));
    }
  });

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "login_required") {
      loadingDiv.style.display = "none";
      loginDiv.style.display = "block";
      chatDiv.style.display = "none";
    }

    if (data.type === "error") {
      loginError.textContent = data.text;
    }

    if (data.type === "login_success") {
      username = data.username;
      loadingDiv.style.display = "none";
      loginDiv.style.display = "none";
      chatDiv.style.display = "block";

      const pass = document.getElementById("password").value.trim();
      const avatarFile = document.getElementById("avatarFile").files[0];
      localStorage.setItem("username", username);
      localStorage.setItem("password", pass);
      if (!avatarFile) {
        localStorage.setItem("avatar", "./img/redetekiIcon2.png");
      }
    }

    if (data.type === "message") {
      const div = document.createElement("div");
      div.classList.add("message");
      div.innerHTML = `<img src="${data.avatar}" alt="pfp"><span>${data.text}</span>`;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }

    if (data.type === "user_list") {
      usersList.innerHTML = "";
      data.users.forEach(u => {
        const li = document.createElement("li");
        li.innerHTML = `<img src="${u.avatar}" alt="pfp"><span>${u.username}</span>`;
        usersList.appendChild(li);
      });
      usersTitle.textContent = `Usuários online (${data.users.length})`;
    }
  };

  function fazerLogin() {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();
    const avatarFile = document.getElementById("avatarFile").files[0];

    if (!user || !pass) {
      loginError.textContent = "Preencha usuário e senha!";
      return;
    }

    if (avatarFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(",")[1];
        socket.send(JSON.stringify({ 
          type: "login", 
          username: user, 
          password: pass, 
          avatarFile: { name: avatarFile.name, data: base64Data }
        }));
      };
      reader.readAsDataURL(avatarFile);
    } else {
      socket.send(JSON.stringify({ 
        type: "login", 
        username: user, 
        password: pass, 
        avatar: "./img/redetekiIcon2.png" 
      }));
    }
  }

  function enviar() {
    if (msgInput.value && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "message", text: msgInput.value }));
      msgInput.value = "";
      counter.textContent = "0/70";
    }
  }

  msgInput.addEventListener("keypress", (e) => { if (e.key === "Enter") enviar(); });

  msgInput.addEventListener("input", () => {
    let len = msgInput.value.length;
    if (len > 70) {
      msgInput.value = msgInput.value.substring(0, 70);
      len = 70;
    }
    counter.textContent = `${len}/70`;
  });

  setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ping" }));
    }
  }, 25000);