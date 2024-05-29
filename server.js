const express = require("express");
const expressHandlebars = require("express-handlebars");
const session = require("express-session");
const { createCanvas } = require("canvas");
const fs = require("fs")
const dotenv = require("dotenv");
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const initializeDB = require("./db/populatedb");
const showDatabaseContents = require("./db/showdb");

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

dotenv.config();

const app = express();
const PORT = 3000;
const dbFileName = "database.db";
let db;

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//

app.engine(
  "handlebars",
  expressHandlebars.engine({
    helpers: {
      toLowerCase: function (str) {
        return str.toLowerCase();
      },
      ifCond: function (v1, v2, options) {
        if (v1 === v2) {
          return options.fn(this);
        }
        return options.inverse(this);
      },
    },
  })
);

app.set("view engine", "handlebars");
app.set("views", "./views");

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
  session({
    secret: "oneringtorulethemall", // Secret key to sign the session ID cookie
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: { secure: false }, // True if using https. Set to false for development without https
  })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files.
//
app.use((req, res, next) => {
  res.locals.appName = "Portfolio";
  res.locals.copyrightYear = 2024;
  res.locals.postNeoType = "Post";
  res.locals.loggedIn = req.session.loggedIn || false; // res.locals allows these variables to be used in templates
  res.locals.userId = req.session.userId || "";
  res.locals.accessToken = process.env.ACCESS_TOKEN;
  next();
});

app.use(express.static("public")); // Serve static files
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json()); // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
app.get("/", async (req, res) => {
  const posts = await getPosts();
  const users = getCurrentUser(req) || {};
  res.render("home", { posts, users });
});

// Register GET route is used for error response from registration
app.get("/register", (req, res) => {
  res.render("loginRegister", { regError: req.query.error });
});

// Login route GET route is used for error response from login
app.get("/login", (req, res) => {
  res.render("loginRegister", { loginError: req.query.error });
});

// Error route: render error page
app.get("/error", (req, res) => {
  res.render("error");
});

app.post("/posts", async (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const user = await getCurrentUser(req);

  await addPost(title, content, user);
  res.redirect("/");
});
app.post("/like/:id", (req, res) => {
  updatePostLikes(req, res);
});
app.get("/profile", isAuthenticated, (req, res) => {
  renderProfile(req, res);
});
app.get("/avatar/:username", (req, res) => {
  handleAvatar(req, res);
});
app.post("/register", (req, res) => {
  registerUser(req, res);
});
app.post("/login", (req, res) => {
  loginUser(req, res);
});
app.get("/logout", (req, res) => {
  logoutUser(req, res);
});
app.post("/delete/:id", async (req, res) => { // colon in :id allows access to the id in the req.params
  if (!req.session.loggedIn) {
    res.status(401).send("Login required to delete posts");
    return;
  }

  const postId = req.params.id;
  const post = await findPostById(postId);
  const userId = req.session.userId;
  const user = await findUserById(userId);

  if (user.username == post.username) {
    await db.run("DELETE FROM posts WHERE id = ?", postId);
    res.status(200).send("Post deleted");
  } else {
    res.status(401).send("Unauthorized to delete post");
  }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

(async () => {
  try {
    await initializeDB();
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Error connecting to database:", err);
  }
})();

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to find a user by username
async function findUserByUsername(username) {
  try {
    const user = await db.get(
      "SELECT * FROM users WHERE username = ?",
      username
    );
    return user;
  } catch (error) {
    console.error("Error finding user by username: ", error);
    return undefined;
  }
}

// Function to find a user by user ID
async function findUserById(userId) {
  try {
    const user = await db.get("SELECT * FROM users WHERE id = ?", userId);
    return user;
  } catch (error) {
    console.error("Error finding user by ID: ", error);
    return undefined;
  }
}

async function findPostById(postId) {
  try {
    const post = await db.get("SELECT * FROM posts WHERE id = ?", postId);
    return post;
  } catch (error) {
    console.error("Error finding post by ID: ", error);
    return undefined;
  }
}

// Function to add a new user
async function addUser(username) {
  try {
    await db.run(
      "INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)",
      username,
      "hashedGoogleId4523",
      "",
      new Date().toISOString()
    );
    showDatabaseContents();
  } catch (error) {
    console.error("Error adding user: ", error);
  }
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// Function to register a user
async function registerUser(req, res) {
  const username = req.body.username;

  try {
    const user = await findUserByUsername(username);
    if (user) {
      res.redirect("/register?error=Username+already+exists");
    } else {
      await addUser(username);
      res.redirect("/login");
    }
  } catch (error) {
    console.error("Error registering user: ", error);
    res.redirect("/error");
  }
}

// Function to login a user
async function loginUser(req, res) {
  const username = req.body.username;
  const user = await findUserByUsername(username);

  if (user) {
    req.session.userId = user.id;
    req.session.loggedIn = true;
    res.redirect("/");
  } else {
    res.redirect("/login?error=Invalid+username");
  }
}

// Function to logout a user
function logoutUser(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session: ", err);
      res.redirect("/error");
    } else {
      res.redirect("/login");
    }
  });
}

// Function to render the profile page
function renderProfile(req, res) {
  const user = getCurrentUser(req);
  const userPosts = posts.filter((post) => post.username == user.username);
  res.render("profile", { user, userPosts });
}

// Function to update post likes
async function updatePostLikes(req, res) {
  if (!req.session.loggedIn) {
    res.status(401).send("Login required to like posts");
    return;
  }

  const postId = req.params.id;
  const post = await findPostById(postId);

  db.run("UPDATE posts SET likes = likes + 1 WHERE id = ?", postId);
  res.status(200).json({ postLikes: post.likes });
}

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
  const username = req.params.username;
  const user = findUserByUsername(username);

  avatarUrl = generateAvatar(user.username[0]);
  user.avatar_url = avatarUrl;

  res.send(avatarUrl);
}

// Function to get the current user from session
async function getCurrentUser(req) {
  const userId = req.session.userId;
  const user = await findUserById(userId);
  return user
}

// Function to get all posts, sorted by latest first
async function getPosts() {
  const posts = await db.all("SELECT * FROM posts");
  return posts;
}

// Function to add a new post
async function addPost(title, content, user) {
  await db.run(
    "INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)",
    title,
    content,
    user.username,
    new Date().toISOString(),
    0
  );
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
  // TODO: Generate an avatar image with a letter
  // Steps:
  // 1. Choose a color scheme based on the letter
  // 2. Create a canvas with the specified width and height
  // 3. Draw the background color
  // 4. Draw the letter in the center
  // 5. Return the avatar as a PNG buffer
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const backgroundColor = "#3498db";
  const textColor = "#ffffff";

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = textColor;
  ctx.font = `${Math.floor(height * 0.7)}px sans-serif`; // Dynamic font size based on canvas height
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(letter, width / 2, height / 2);

  return canvas.toBuffer("image/png");
}

async function connectDB() {
  db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });
}
