const express = require("express");
const expressHandlebars = require("express-handlebars");
const session = require("express-session");
const {createCanvas} = require("canvas");
const dotenv = require("dotenv");

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

dotenv.config();

const sqlite3 = require("sqlite3").verbose();

const db  = new sqlite3.Database("database.db", sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the database.");
});

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
  res.locals.accessToken = process.env.ACCESS_TOKEN
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
//
app.get("/", (req, res) => {
  const posts = getPosts();
  const user = getCurrentUser(req) || {};
  res.render("home", { posts, user });
});

// Register GET route is used for error response from registration
//
app.get("/register", (req, res) => {
  res.render("loginRegister", { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get("/login", (req, res) => {
  // res.render("https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=739559669034-08mgip9om96s9bk6ggokmjsk6rftbaag.apps.googleusercontent.com&redirect_uri=http://localhost:3000/auth/google/callback&scope=https://www.googleapis.com/auth/userinfo.email");
  res.render("loginRegister", { loginError: req.query.error });
});

// Error route: render error page
//
app.get("/error", (req, res) => {
  res.render("error");
});

// Additional routes that you must implement

app.post("/posts", (req, res) => {
  // TODO: Add a new post and redirect to home
  const title = req.body.title;
  const content = req.body.content;
  const user = getCurrentUser(req);

  addPost(title, content, user);
  res.redirect("/");
});
app.post("/like/:id", (req, res) => {
  // TODO: Update post likes
  updatePostLikes(req, res);
});
app.get("/profile", isAuthenticated, (req, res) => {
  // TODO: Render profile page
  renderProfile(req, res);
});
app.get("/avatar/:username", (req, res) => {
  // TODO: Serve the avatar image for the user
  handleAvatar(req, res);
});
app.post("/register", (req, res) => {
  // TODO: Register a new user
  registerUser(req, res);
});
app.post("/login", (req, res) => {
  // TODO: Login a user
  loginUser(req, res);
});
app.get("/logout", (req, res) => {
  // TODO: Logout the user
  logoutUser(req, res);
});
app.post("/delete/:id", (req, res) => {
  // TODO: Delete a post if the current user is the owner
  if (!req.session.loggedIn) {
    res.status(401).send("Login required to delete posts");
    return;
  }

  const postId = req.params.id;
  const post = findPostById(postId);
  const userId = req.session.userId;
  const user = findUserById(userId);

  if (user.username == post.username) {
    posts = posts.filter((post) => post.id != postId);
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
    const db = await connectToDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database:", error);
  }
})();

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Example data for posts and users
let posts = [
  {
    id: 1,
    title: "Sample Post",
    content: "This is a sample post.",
    username: "SampleUser",
    timestamp: "2024-01-01 10:00",
    likes: 0,
  },
  {
    id: 2,
    title: "Another Post",
    content: "This is another sample post.",
    username: "AnotherUser",
    timestamp: "2024-01-02 12:00",
    likes: 0,
  },
];
let users = [
  {
    id: 1,
    username: "SampleUser",
    avatar_url: undefined,
    memberSince: "2024-01-01 08:00",
  },
  {
    id: 2,
    username: "AnotherUser",
    avatar_url: undefined,
    memberSince: "2024-01-02 09:00",
  },
];

// Function to find a user by username
function findUserByUsername(username) {
  // TODO: Return user object if found, otherwise return undefined
  return users.find((user) => user.username == username);
}

// Function to find a user by user ID
function findUserById(userId) {
  // TODO: Return user object if found, otherwise return undefined
  return users.find((user) => user.id == userId);
}

function findPostById(postId) {
  return posts.find((post) => post.id == postId);
}

// Function to add a new user
function addUser(username) {
  // TODO: Create a new user object and add to users array
  users.push({
    id: users.length + 1,
    username: username,
    avatar_url: undefined,
    memberSince: new Date().toISOString(),
  });
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
function registerUser(req, res) {
  // TODO: Register a new user and redirect appropriately
  const username = req.body.username;
  if (findUserByUsername(username)) {
    res.redirect("/register?error=Username+already+exists");
  } else {
    addUser(username);
    res.redirect("/login");
  }
}

// Function to login a user
function loginUser(req, res) {
  // TODO: Login a user and redirect appropriately
  const username = req.body.username;
  const user = findUserByUsername(username);

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
  // TODO: Destroy session and redirect appropriately
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
  // TODO: Fetch user posts and render the profile page
  const user = getCurrentUser(req);
  const userPosts = posts.filter((post) => post.username == user.username);
  res.render("profile", { user, userPosts });
}

// Function to update post likes
function updatePostLikes(req, res) {
  // TODO: Increment post likes if conditions are met
  if (!req.session.loggedIn) {
    res.status(401).send("Login required to like posts");
    return;
  }

  const postId = req.params.id;
  const post = findPostById(postId);

  post.likes++;
  res.status(200).json({ postLikes: post.likes });
}

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
  // TODO: Generate and serve the user's avatar image
  const username = req.params.username;
  const user = findUserByUsername(username);

  avatarUrl = generateAvatar(user.username[0]);
  user.avatar_url = avatarUrl;

  res.send(avatarUrl);
}

// Function to get the current user from session
function getCurrentUser(req) {
  // TODO: Return the user object if the session user ID matches
  const userId = req.session.userId;
  return findUserById(userId);
}

// Function to get all posts, sorted by latest first
function getPosts() {
  return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
  // TODO: Create a new post object and add to posts array
  posts.push({
    id: posts.length + 1,
    title: title,
    content: content,
    username: user.username,
    timestamp: new Date().toISOString(),
    likes: 0,
  });
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
  
  const backgroundColor = '#3498db';
  const textColor = '#ffffff';

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = textColor;
  ctx.font = `${Math.floor(height * 0.7)}px sans-serif`; // Dynamic font size based on canvas height
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(letter, width / 2, height / 2);

  return canvas.toBuffer('image/png');
}

async function connectToDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database("database.db", sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log("Connected to the database.");
        resolve(db);
      }
    });
  });
}