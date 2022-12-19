let token = localStorage.getItem("token");
if (token) {
    window.location.href = "/chat.html";
}

document.getElementById("login").addEventListener("click", function () {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    //Send username and password to server
    fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    }).then(function (response) {
        //Check if login was successful
        if (response.status === 200) {
            response.json().then(function (data) {
                //Save token to local storage
                localStorage.setItem("token", JSON.stringify(data));
                window.location.href = "/chat.html";
            });
        } else {
            alert("Error logging in");
        }
    });
});