const express = require('express');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const ws = require('ws');
const http = require('http');

// Create express app
const app = express();
app.use(express.json());

// Create database
const db = new sqlite3.Database('db.sqlite3');
db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    token TEXT UNIQUE
    )`);
db.exec(`CREATE TABLE IF NOT EXISTS chatrooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        imageurl TEXT NOT NULL
    )`);
db.exec(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    chatroom INTEGER NOT NULL,
    user INTEGER NOT NULL,
    message TEXT NOT NULL,
    FOREIGN KEY(user) REFERENCES users(id)
    FOREIGN KEY(chatroom) REFERENCES chatrooms(id)
    )`);

//Create chatrooms if none exist
let chatrooms = db.all('SELECT * FROM chatrooms', (err, rows) => {
    if (err) {
        console.log(err);
    } else {
        if (rows.length === 0) {
            db.run('INSERT INTO chatrooms (name, imageurl) VALUES (?, ?)', ['Studygroup', 'https://www.pngkey.com/png/detail/206-2061109_diversity-clipart-group-debate-group-of-people-talking.png']);
            db.run('INSERT INTO chatrooms (name, imageurl) VALUES (?, ?)', ['Finance class', 'https://freesvg.org/img/Buecher-coloured.png']);
            db.run('INSERT INTO chatrooms (name, imageurl) VALUES (?, ?)', ['University news', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRh7ae2asIlDv1RVh4mY8M83VwheYlxWS7lYw&usqp=CAU']);
        }
    }
});

//Register new user endpoint
app.post('/register', (req, res) => {
    //Create salt and hash
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(req.body.password, salt, 1000, 64, 'sha512').toString('hex');

    db.run('INSERT INTO users (username, hash, salt) VALUES (?, ?, ?)', [req.body.username.toLowerCase(), hash, salt], (err) => {
        if (err) {
            res.status(500).send('Error registering new user');
        } else {
            res.status(200).send('User registered');
        }
    });
});

//Login endpoint
app.post('/login', (req, res) => {
    //Check if user exists
    db.get('SELECT * FROM users WHERE username = ?', [req.body.username.toLowerCase()], (err, row) => {
        if (err) {
            res.status(500).send('Error logging in');
        } else if (row === undefined) {
            res.status(400).send('User not found');
        } else {
            //Check if password is correct
            const hash = crypto.pbkdf2Sync(req.body.password, row.salt, 1000, 64, 'sha512').toString('hex');
            if (hash === row.hash) {

                //Create token
                const token = crypto.randomBytes(16).toString('hex');

                //Save token to database
                db.run('UPDATE users SET token = ? WHERE username = ?', [token, req.body.username.toLowerCase()], (err) => {
                    if (err) {
                        res.status(500).send('Error creating token');
                    }
                });

                //Send token to client
                res.status(200).send({ username: req.body.username.toLowerCase(), token: token });
            } else {
                res.status(400).send('Incorrect password');
            }
        }
    });
});

app.use(express.static(path.join(__dirname, 'website')));

const server = http.createServer(app);

//Create websocket server
const wss = new ws.Server({ server });
let connections = [];

//Handle websocket connections
wss.on('connection', (connection) => {
    connection.on('message', (message) => {
        //Handle message
        try {
            message = JSON.parse(message);

            //Check if token is valid
            if (message.token) {
                db.get('SELECT * FROM users WHERE token = ?', [message.token], (err, row) => {
                    if (err) {
                        console.log(err);
                    } else if (row === undefined) {
                        connection.send(JSON.stringify({
                            tokenValid: false
                        }));
                    } else {
                        //Check if user is already connected
                        let userConnected = false;
                        for (let i = 0; i < connections.length; i++) {
                            if (connections[i].user === row.id) {
                                userConnected = true;
                            }
                        }

                        //Add user to connections if not already connected
                        if (!userConnected) {
                            connections.push({
                                user: row.id,
                                connection: connection
                            });

                            //Send all chatrooms to user
                            db.all('SELECT * FROM chatrooms', (err, rows) => {
                                if (err) {
                                    console.log(err);
                                } else {
                                    //Loop through all chatrooms and send them to the user
                                    for (let i = 0; i < rows.length; i++) {
                                        connection.send(JSON.stringify({
                                            id: rows[i].id,
                                            chatroom: rows[i].name,
                                            imageurl: rows[i].imageurl
                                        }));
                                    }
                                }
                            });

                            //Fetch all messages from database and send them to the user
                            db.all(`SELECT timestamp, message, chatroom, name, username FROM messages
                                INNER JOIN chatrooms ON chatrooms.id = messages.chatroom
                                INNER JOIN users ON users.id = messages.user`, (err, rows) => {
                                if (err) {
                                    console.log(err);
                                } else {
                                    //Loop through all messages and send them to the user
                                    for (let i = 0; i < rows.length; i++) {
                                        connection.send(JSON.stringify({
                                            message: rows[i].message,
                                            user: rows[i].username,
                                            timestamp: rows[i].timestamp,
                                            chatroomId: rows[i].chatroom,
                                            chatroom: rows[i].name
                                        }));
                                    }
                                }
                            });
                        }
                    }
                });
            } else if (message.message) {
                //Send message to all users
                let connectionUser = null;
                for (let i = 0; i < connections.length; i++) {
                    if (connections[i].connection === connection) {
                        connectionUser = connections[i].user;
                    }
                }

                //Check if user is connected
                if (connectionUser !== null) {
                    //Add message to database
                    db.run('INSERT INTO messages (chatroom, user, message) VALUES (?, ?, ?)', [message.chatroomId, connectionUser, message.message], (err) => {
                        if (err) {
                            console.log(err);
                        }

                        //Fetch latest message from database
                        db.get(`SELECT timestamp, message, chatroom, name, username FROM messages
                            INNER JOIN chatrooms ON chatrooms.id = messages.chatroom
                            INNER JOIN users ON users.id = messages.user
                            WHERE messages.id = (SELECT MAX(id) FROM messages)`, (err, row) => {
                            if (err) {
                                console.log(err);
                            } else {
                                //Send message to all connected users
                                for (let i = 0; i < connections.length; i++) {
                                    connections[i].connection.send(JSON.stringify({
                                        message: row.message,
                                        user: row.username,
                                        timestamp: row.timestamp,
                                        chatroomId: row.chatroom,
                                        chatroom: row.name
                                    }));
                                }
                            }
                        });
                    });
                } else {
                    console.log('User not connected');
                }
            }
        } catch (error) {
            console.log(error);
        }
    });

    connection.on('close', () => {
        //Remove connection from connections
        for (let i = 0; i < connections.length; i++) {
            if (connections[i].connection === connection) {
                connections.splice(i, 1);
            }
        }
    });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});