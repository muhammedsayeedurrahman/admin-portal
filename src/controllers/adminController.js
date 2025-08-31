// controllers/adminController.js
import path from "path";
import fs from "fs";

// Dummy admin credentials (replace with DB later)
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "password";

export const loginPage = (req, res) => {
  res.render("admin/login");
};

export const login = (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = { username };
    req.flash("success", "Welcome, Admin!");
    return res.redirect("/admin/dashboard");
  }
  req.flash("error", "Invalid username or password.");
  return res.redirect("/admin/login");
};

export const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
};

export const dashboard = (req, res) => {
  res.render("admin/dashboard", {
    admin: req.session.admin,
  });
};

export const uploadDoc = (req, res) => {
  if (!req.file) {
    req.flash("error", "No file uploaded.");
    return res.redirect("/admin/dashboard");
  }

  // TODO: Extract text and index for RAG here
  console.log("Uploaded:", req.file.path);

  req.flash("success", "File uploaded successfully.");
  res.redirect("/admin/dashboard");
};

// Example enquiries list
export const enquiries = (req, res) => {
  res.render("admin/enquiries", { enquiries: [] });
};
