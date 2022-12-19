let token = localStorage.getItem("token");
if (!token) {
    window.location.href = "/index.html";
}

let activeChatroomId = null;
let messages = [];

let ws = new WebSocket("ws://142.93.173.69:3000");
ws.onopen = function () {
    //Send token to server
    ws.send(JSON.stringify({
        token: JSON.parse(token).token
    }));
}

ws.onmessage = function (message) {
    let data = JSON.parse(message.data);

    //Check if token is valid
    if (data.tokenValid === false) {
        localStorage.removeItem("token");
        window.location.href = "/index.html";
    } else if (data.message) {
        //If message is a message, add the message to the messages array and update the latest message
        document.getElementById(`chatroom-${data.chatroomId}-latest-message`).innerHTML = data.message;
        messages.push(data);

        //If message is in active chatroom add to chatroom
        if (data.chatroomId === activeChatroomId) {
            addMessage(data);
        }
    } else if (data.chatroom) {
        //Check if message is a chatroom
        document.getElementById('chatroom-list').innerHTML += `
            <a id="chatroom-${data.id}" class="chatroom list-group-item list-group-item-action list-group-item-light rounded-0" onclick="selectChatroom(${data.id})">
                <div class="media">
                    <img src="${data.imageurl}" width="50" class="rounded-circle">
                    <div class="media-body ml-4">
                        <div class="d-flex align-items-center justify-content-between mb-1">
                            <h6 class="mb-0">${data.chatroom}</h6>
                        </div>
                        <p class="font-italic mb-0 text-small" id="chatroom-${data.id}-latest-message"></p>
                    </div>
                </div>
            </a>
            `

        if (activeChatroomId === null) {
            selectChatroom(data.id);
        }
    }
}

ws.onclose = function () {
    alert("Connection to server lost. Please refresh the page.");
    location.reload();
}

function selectChatroom(id) {
    //Remove active class from all chatrooms
    let chatrooms = document.getElementsByClassName("chatroom");
    for (let i = 0; i < chatrooms.length; i++) {
        chatrooms[i].classList.remove("active");
        chatrooms[i].classList.remove("text-white");
        chatrooms[i].classList.add("list-group-item-light");
    }

    //Add active class to selected chatroom
    let activeChatroom = document.getElementById(`chatroom-${id}`);
    activeChatroom.classList.add("active");
    activeChatroom.classList.add("text-white");
    activeChatroom.classList.remove("list-group-item-light");

    //Set active chatroom id
    activeChatroomId = id;

    //Clear messages and add messages for selected chatroom
    document.getElementById('chatroom-messages').innerHTML = "";
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].chatroomId === activeChatroomId) {
            addMessage(messages[i]);
        }
    }
}

function addMessage(data) {
    //Check if message is from logged in user
    if (data.user === JSON.parse(token).username) {
        document.getElementById('chatroom-messages').innerHTML = `
                    <div class="media w-50 ml-auto mb-3">
                        <div class="media-body">
                            <div class="bg-primary rounded py-2 px-3 mb-2">
                                <p class="text-small mb-0 text-white">${data.message}</p>
                            </div>
                            <p class="small text-muted">${data.user} | ${data.timestamp}</p>
                        </div>
                    </div>
                ` + document.getElementById('chatroom-messages').innerHTML;
    } else {
        document.getElementById('chatroom-messages').innerHTML = `
                    <div class="media w-50 mb-3">
                        <div class="media-body ml-3">
                            <div class="bg-light rounded py-2 px-3 mb-2">
                                <p class="text-small mb-0 text-muted">${data.message}</p>
                            </div>
                            <p class="small text-muted">${data.user} | ${data.timestamp}</p>
                        </div>
                    </div>
                ` + document.getElementById('chatroom-messages').innerHTML;
    }
}

document.getElementById("send-message").addEventListener("click", function () {
    let message = document.getElementById("message").value;
    ws.send(JSON.stringify({
        message: message,
        chatroomId: activeChatroomId
    }));
    document.getElementById("message").value = "";
});

document.getElementById("logout").addEventListener("click", function () {
    localStorage.removeItem("token");
    window.location.href = "/index.html";
});
