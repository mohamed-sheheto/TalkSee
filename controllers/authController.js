const User = require("../models/userModel");
const Google = require("../models/googleModel");
const asyncWrapper = require("../utils/asyncWrapper");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const validator = require("validator");
const googleStrategy = require("passport-google-oauth20").Strategy;

const createSendToken = function (user, statusCode, res) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  user.password = undefined;

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
  });

  const cookieExpiresIn = Number(process.env.JWT_COOKIE_EXPIRES_IN) || 10;

  res.cookie("jwt", token, {
    expires: new Date(Date.now() + cookieExpiresIn * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.status(statusCode).json({
    status: "success",
    token,
    user,
  });
};

exports.signUp = asyncWrapper(async function (req, res, next) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      status: "error",
      message: "please provide username, email and password",
    });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid email format",
    });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      status: "error",
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    });
  }

  const newUser = await User.create({ username, email, password });
  createSendToken(newUser, 201, res);
});

exports.login = asyncWrapper(async function (req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "error",
      message: "please provide email and password",
    });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid email format",
    });
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.checkPassword(password))) {
    return res.status(401).json({
      status: "error",
      message: "invalid email and password",
    });
  }

  user.lastSeen = new Date();
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res);
});

exports.logout = asyncWrapper(async function (req, res, next) {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.set("Clear-Site-Data", '"cookies"');
  res.status(200).json({ status: "success" });
});

exports.protect = asyncWrapper(async function (req, res, next) {
  let token;

  if (req.cookies && req.cookies.jwt) token = req.cookies.jwt;
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ status: "fail", message: "please login first" });
  }

  const decoded = await jwt.verify(token, process.env.JWT_SECRET);

  let loggedUser = await User.findById(decoded.id);

  if (!loggedUser) {
    loggedUser = await Google.findById(decoded.id);
  }

  if (!loggedUser) {
    return res
      .status(401)
      .json({ status: "fail", message: "User doesn't exists" });
  }

  req.user = loggedUser;
  next();
});

exports.home = (req, res, next) => {
  const userData = {
    id: req.user._id,
    username: req.user.username,
  };

  if (req.user.email) {
    userData.email = req.user.email;
  }
  if (req.user.avatar) {
    userData.avatar = req.user.avatar;
  }

  res.status(200).json({
    status: "success",
    user: userData,
  });
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new googleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3000/api/v1/auth/google/redirect",
        scope: ["profile"],
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          const findUser = await Google.findOne({ googleId: profile.id });
          if (!findUser) {
            const newUser = await Google.create({
              username: profile.displayName,
              googleId: profile.id,
            });

            return cb(null, newUser);
          }

          return cb(null, findUser);
        } catch (err) {
          console.error("Google auth error:", err);
          return cb(err, null);
        }
      }
    )
  );
} else {
  console.error("Google OAuth credentials not found.");
}

exports.googleCallback = asyncWrapper(async function (req, res, next) {
  if (!req.user) {
    return res.redirect("/?error=Google authentication failed");
  }

  if (!process.env.JWT_SECRET) {
    return res.redirect("/?error=Server configuration error");
  }

  const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
  });

  const cookieExpiresIn = Number(process.env.JWT_COOKIE_EXPIRES_IN) || 90;

  res.cookie("jwt", token, {
    expires: new Date(Date.now() + cookieExpiresIn * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.redirect("/?auth=success");
});
