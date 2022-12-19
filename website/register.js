let token = localStorage.getItem("token");
if (token) {
    window.location.href = "/chat.html";
}

document.getElementById("register").addEventListener("click", function () {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    //Send username and password to server
    fetch("/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    }).then(function (response) {
        //Check if registration was successful
        if (response.status === 200) {
            //Redirect to login page
            window.location.href = "/index.html";
        } else {
            alert("Error registering new user");
        }
    });
});